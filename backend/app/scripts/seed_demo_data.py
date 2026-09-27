"""Seed the database with the synthetic grievance dataset.

Loads backend/data/grievances_synthetic.csv (see data/DATASET_CARD.md) and
replays 18 months of platform operation up to "now":

* every grievance is triaged by the trained models (category, confidence,
  urgency, priority, topic, explanation), exactly as live submissions are;
* confident predictions are auto-routed; the rest are routed manually by an
  administrator after the recorded delay;
* wrong auto-routes are corrected by staff (category override + re-route), so
  the live override rate reflects the model's real error rate;
* first response, resolution and closure follow the recorded durations, and
  SLA deadline / breach / escalation events are generated from the department
  SLA policies.

Timestamps are shifted so the newest grievance lands just before the seeding
time, keeping 7/30/90-day dashboards populated whenever the seed is run.
"""

from __future__ import annotations

import argparse
import csv
import random
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import NoReturn

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import Base, SessionLocal
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.grievance import (
    GRIEVANCE_STATUS_CLOSED,
    GRIEVANCE_STATUS_IN_PROGRESS,
    GRIEVANCE_STATUS_OPEN,
    GRIEVANCE_STATUS_RESOLVED,
    Grievance,
)
from app.models.grievance_assignment import GrievanceAssignment
from app.models.grievance_comment import GrievanceComment
from app.models.grievance_status_history import GrievanceStatusHistory
from app.models.role import Role
from app.models.sla_event import SLAEvent
from app.models.sla_policy import SLAPolicy
from app.models.user import User
from app.services import triage_service
from app.services.escalation_service import seed_default_escalation_rules
from app.services.routing_service import seed_departments
from app.services.sla_service import (
    SLA_EVENT_ESCALATION,
    SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    SLA_EVENT_RESOLUTION_DEADLINE,
    SLA_STATUS_BREACHED,
    SLA_STATUS_MET,
    SLA_STATUS_PENDING,
    SLA_STATUS_TRIGGERED,
    seed_default_sla_policies,
)
from app.services.user_service import ROLE_ADMIN, ROLE_STAFF, ROLE_STUDENT, seed_roles

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
GRIEVANCES_CSV = DATA_DIR / "grievances_synthetic.csv"
STUDENTS_CSV = DATA_DIR / "students_synthetic.csv"
DEMO_PASSWORD = "password123"
BATCH_SIZE = 250


@dataclass(frozen=True)
class DemoUserSpec:
    key: str
    role_name: str
    email: str
    first_name: str
    last_name: str
    matric_number: str
    phone_number: str
    faculty: str
    department: str
    level: str


# Fixed accounts documented in the README. Staff "department" must match a
# Department name so the staff member sees that department's queue.
DEMO_USERS: tuple[DemoUserSpec, ...] = (
    DemoUserSpec("admin", ROLE_ADMIN, "admin@gmail.com", "System", "Administrator",
                 "ADM/24/0001", "08030000001", "Administration", "Platform Operations", "N/A"),
    DemoUserSpec("admin_dsa", ROLE_ADMIN, "dean.students@campuspulse.edu.ng", "Folake", "Adeniran",
                 "ADM/24/0002", "08030000002", "Administration", "Dean of Students Affairs", "N/A"),
    DemoUserSpec("S0001", ROLE_STUDENT, "ola2@gmail.com", "Saheed", "Olayemi Olayinka",
                 "CSC/24/214906", "08030796165", "Science", "Computer Science", "500"),
    DemoUserSpec("S0002", ROLE_STUDENT, "adeyemi.omooba@gmail.com", "Adeyemi", "Omooba",
                 "ACC/24/214905", "08035551234", "Management Sciences", "Accounting", "400"),
    DemoUserSpec("staff_grace", ROLE_STAFF, "grace.adebayo@campuspulse.edu.ng", "Grace", "Adebayo",
                 "STF/REG/0001", "08031112221", "Administration", "Registry", "N/A"),
    DemoUserSpec("staff_martins", ROLE_STAFF, "martins.okafor@campuspulse.edu.ng", "Martins", "Okafor",
                 "STF/ICT/0001", "08032223332", "Administration", "ICT Support", "N/A"),
)

# Additional staff per department (first name, last name).
EXTRA_STAFF: dict[str, tuple[tuple[str, str], ...]] = {
    "ICT Support": (("Ifeoma", "Nwachukwu"), ("Kabiru", "Sani")),
    "Bursary": (("Oluwaseun", "Akande"), ("Ngozi", "Eze"), ("Musa", "Danladi")),
    "Registry": (("Tope", "Alabi"), ("Chinwe", "Obiora")),
    "Hostel Services": (("Rukayat", "Salami"), ("Emeka", "Udeh"), ("Bola", "Ajayi")),
    "Security": (("Sunday", "Okoro"), ("Abubakar", "Yusuf")),
    "Academic Affairs": (("Dr. Kemi", "Oladipo"), ("Dr. Uche", "Nnaji"), ("Lanre", "Afolabi")),
    "Student Welfare": (("Nurse Hadiza", "Bello"), ("Joy", "Okeke")),
}

ACK_COMMENTS = {
    "academic": "We have forwarded this to your department's exam officer and the course coordinator.",
    "bursary": "The bursary is verifying the payment with Remita and the bank. Please keep your receipt.",
    "registry": "Your request has been logged with the records unit and is being processed.",
    "ict": "ICT support is investigating. Please avoid multiple attempts while we check the logs.",
    "hostel": "The hall porter and maintenance unit have been notified and will inspect.",
    "security": "Security has been alerted and a patrol team has been dispatched to the area.",
    "welfare": "The student welfare unit has received your complaint and will contact you.",
}
RESOLUTION_NOTES = {
    "academic": "Result/score has been reviewed with the department and the record has been updated.",
    "bursary": "Payment confirmed and the fees record has been updated. Registration is now open.",
    "registry": "Record corrected and the requested document has been processed.",
    "ict": "Portal issue fixed and account access restored.",
    "hostel": "Maintenance work completed and the hall officer has confirmed the fix.",
    "security": "Incident investigated; patrols increased and the case documented.",
    "welfare": "The student has been attended to and follow-up support has been arranged.",
}
FOLLOW_UPS = (
    "Please is there any update on this?",
    "It has been days and nothing has changed.",
    "I am still waiting for a response.",
)


def abort(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reset the database and seed the synthetic dataset.")
    parser.add_argument(
        "--force-reset",
        action="store_true",
        help="Required. Confirms that the current database should be cleared before seeding.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Seed only the first N grievances.")
    return parser.parse_args()


RESET_TABLES: tuple[str, ...] = (
    "grievance_comments",
    "grievance_status_history",
    "grievance_assignments",
    "sla_events",
    "audit_logs",
    "grievances",
    "user_roles",
    "users",
    "escalation_rules",
    "sla_policies",
    "departments",
    "roles",
)


def database_has_application_data(db: Session) -> bool:
    return (
        db.scalar(select(User.id).limit(1)) is not None
        or db.scalar(select(Grievance.id).limit(1)) is not None
    )


def reset_application_data(db: Session) -> None:
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        db.execute(text(f"TRUNCATE TABLE {', '.join(RESET_TABLES)} RESTART IDENTITY CASCADE"))
    else:
        tables = {table.name: table for table in Base.metadata.sorted_tables}
        for name in RESET_TABLES:
            if name in tables:
                db.execute(tables[name].delete())
    db.commit()


def _hours(value: str) -> float | None:
    return float(value) if value else None


def _parse_created(value: str) -> datetime:
    return datetime.fromisoformat(value).replace(tzinfo=UTC)


class DatasetSeeder:
    def __init__(self, db: Session, *, limit: int | None = None, seed: int = 7) -> None:
        self.db = db
        self.rng = random.Random(seed)
        self.limit = limit
        self.password_hash = get_password_hash(DEMO_PASSWORD)
        self.now = datetime.now(UTC).replace(second=0, microsecond=0)
        self.users: dict[str, User] = {}
        self.staff_by_department: dict[str, list[User]] = {}
        self.departments = {d.code.upper(): d for d in db.scalars(select(Department)).all()}
        self.policies = {p.department_id: p for p in db.scalars(select(SLAPolicy)).all()}
        self.stats = {"grievances": 0, "auto_routed": 0, "overrides": 0, "breaches": 0}

    # ------------------------------------------------------------------ users
    def _new_user(self, *, email, first_name, last_name, matric, phone, faculty, department,
                  level, role: Role, created_at: datetime) -> User:
        user = User(
            id=uuid.uuid4(), email=email.lower(), hashed_password=self.password_hash,
            first_name=first_name, last_name=last_name, matric_number=matric, phone_number=phone,
            faculty=faculty, department=department, level=level, is_active=True,
            created_at=created_at, updated_at=created_at,
        )
        user.roles = [role]
        self.db.add(user)
        return user

    def create_users(self, first_activity: datetime) -> None:
        roles = {role.name: role for role in self.db.scalars(select(Role)).all()}
        joined = first_activity - timedelta(days=30)

        for spec in DEMO_USERS:
            self.users[spec.key] = self._new_user(
                email=spec.email, first_name=spec.first_name, last_name=spec.last_name,
                matric=spec.matric_number, phone=spec.phone_number, faculty=spec.faculty,
                department=spec.department, level=spec.level, role=roles[spec.role_name],
                created_at=joined,
            )

        staff_index = 2
        for department_name, people in EXTRA_STAFF.items():
            for first, last in people:
                staff_index += 1
                slug = f"{first.split()[-1]}.{last}".lower()
                self.users[f"staff_{staff_index}"] = self._new_user(
                    email=f"{slug}@campuspulse.edu.ng", first_name=first, last_name=last,
                    matric=f"STF/OPS/{staff_index:04d}", phone=f"0803{staff_index:07d}",
                    faculty="Administration", department=department_name, level="N/A",
                    role=roles[ROLE_STAFF], created_at=joined,
                )

        for user in self.users.values():
            if roles[ROLE_STAFF] in user.roles:
                self.staff_by_department.setdefault(user.department, []).append(user)

        used_matric = {spec.matric_number for spec in DEMO_USERS}
        with STUDENTS_CSV.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                ref = row["student_ref"]
                if ref in self.users:
                    continue  # demo account takes this student's place
                matric = row["matric"]
                while matric in used_matric:
                    matric = f"{matric}{self.rng.randint(0, 9)}"
                used_matric.add(matric)
                self.users[ref] = self._new_user(
                    email=f"{row['first_name']}.{row['last_name']}.{ref[1:]}@students.campuspulse.edu.ng",
                    first_name=row["first_name"], last_name=row["last_name"], matric=matric,
                    phone=f"080{self.rng.randint(10000000, 99999999)}", faculty=row["faculty"],
                    department=row["department"], level=row["level"], role=roles[ROLE_STUDENT],
                    created_at=joined,
                )
        self.db.flush()

    # ------------------------------------------------------------------ helpers
    def _staff_for(self, department: Department) -> User | None:
        pool = self.staff_by_department.get(department.name)
        return self.rng.choice(pool) if pool else None

    def _audit(self, action: str, user: User | None, at: datetime, details: dict) -> None:
        self.db.add(AuditLog(id=uuid.uuid4(), user_id=user.id if user else None, action=action,
                             details=details, created_at=at))

    def _history(self, grievance: Grievance, by: User | None, from_status, to_status, note, at) -> None:
        self.db.add(GrievanceStatusHistory(
            id=uuid.uuid4(), grievance_id=grievance.id, changed_by_user_id=by.id if by else None,
            from_status=from_status, to_status=to_status, note=note, created_at=at,
        ))

    def _sla_events(self, grievance: Grievance, department: Department, route_at: datetime,
                    first_response_at: datetime | None, resolved_at: datetime | None) -> None:
        policy = self.policies[department.id]
        due = {
            SLA_EVENT_FIRST_RESPONSE_DEADLINE: (
                route_at + timedelta(minutes=policy.first_response_minutes), first_response_at,
                "policy_first_response_minutes", policy.first_response_minutes, "first_response", ROLE_STAFF, "warning"),
            SLA_EVENT_RESOLUTION_DEADLINE: (
                route_at + timedelta(minutes=policy.resolution_minutes), resolved_at,
                "policy_resolution_minutes", policy.resolution_minutes, "resolution", ROLE_ADMIN, "critical"),
        }
        for event_type, (due_at, done_at, policy_key, minutes, breach_type, target, severity) in due.items():
            details: dict[str, object] = {policy_key: minutes, "source": "dataset_seed"}
            if done_at is not None:
                status, occurred = SLA_STATUS_MET, done_at
                if done_at > due_at:
                    details["met_after_breach"] = True
                    details["resolved_breach_minutes"] = int((done_at - due_at).total_seconds() // 60)
            elif due_at < self.now:
                status, occurred = SLA_STATUS_BREACHED, self.now
                details["breach_minutes"] = int((self.now - due_at).total_seconds() // 60)
                self.stats["breaches"] += 1
            else:
                status, occurred = SLA_STATUS_PENDING, None

            event = SLAEvent(
                id=uuid.uuid4(), grievance_id=grievance.id, department_id=department.id,
                policy_id=policy.id, event_type=event_type, status=status, due_at=due_at,
                occurred_at=occurred, details=details, created_at=route_at,
            )
            self.db.add(event)
            if status == SLA_STATUS_BREACHED and self.rng.random() < 0.7:
                self.db.add(SLAEvent(
                    id=uuid.uuid4(), grievance_id=grievance.id, department_id=department.id,
                    policy_id=policy.id, parent_event_id=event.id, event_type=SLA_EVENT_ESCALATION,
                    status=SLA_STATUS_TRIGGERED, occurred_at=self.now,
                    details={"breach_type": breach_type, "severity": severity, "target_role": target,
                             "threshold_minutes": 0, "breach_minutes": details["breach_minutes"]},
                    created_at=due_at + timedelta(minutes=5),
                ))

    # ------------------------------------------------------------------ grievances
    def seed_grievance(self, row: dict[str, str], shift: timedelta) -> None:
        rng = self.rng
        admin = self.users["admin"]
        student = self.users[row["student_ref"]]
        created_at = _parse_created(row["created_at"]) + shift
        true_category = row["true_category"]
        student_category = row["student_selected_category"]

        triage = triage_service.analyze(row["title"], row["description"], student_category=student_category)
        grievance = Grievance(
            id=uuid.uuid4(), student_id=student.id, title=row["title"], description=row["description"],
            category=student_category if student_category != "other" else (triage.predicted_category or "other"),
            is_anonymous=row["is_anonymous"] == "1", status=GRIEVANCE_STATUS_OPEN,
            created_at=created_at, updated_at=created_at,
        )
        triage_service.apply_triage(grievance, triage)
        self.db.add(grievance)
        self._history(grievance, student, None, GRIEVANCE_STATUS_OPEN, "Grievance submitted", created_at)
        self._audit("grievance.created", student, created_at, {
            "grievance_id": str(grievance.id), "category": grievance.category,
            "predicted_category": triage.predicted_category, "priority": triage.priority,
        })
        self.stats["grievances"] += 1

        true_department = self.departments[triage_service.CATEGORY_DEPARTMENT_CODES[true_category]]
        auto_department = triage_service.department_for_category(self.db, triage.predicted_category)
        auto = triage.should_auto_route and auto_department is not None

        # --- routing ------------------------------------------------------
        if auto:
            route_at = created_at + timedelta(minutes=1)
            grievance.auto_routed = True
            grievance.category = triage.predicted_category
            grievance.department_id = auto_department.id
            self.stats["auto_routed"] += 1
            self.db.add(GrievanceAssignment(
                id=uuid.uuid4(), grievance_id=grievance.id, department_id=auto_department.id,
                note=f"Auto-routed by AI triage: {triage.predicted_category} "
                     f"({round((triage.confidence or 0) * 100)}% confidence).",
                created_at=route_at,
            ))
            self._audit("grievance.auto_routed", None, route_at, {
                "grievance_id": str(grievance.id), "department_id": auto_department.id,
                "predicted_category": triage.predicted_category, "confidence": triage.confidence,
            })
        else:
            route_at = created_at + timedelta(hours=_hours(row["route_after_hours"]) or 4.0)
            recent_intake = (self.now - created_at) < timedelta(days=5) and rng.random() < 0.8
            if route_at > self.now or recent_intake:
                return  # still in the unrouted intake queue

        final_department = true_department
        work_start = route_at
        if auto and auto_department.id != true_department.id:
            # Staff in the wrong department correct the AI decision.
            fixer = self._staff_for(auto_department) or admin
            work_start = route_at + timedelta(hours=rng.uniform(0.5, 6))
            if work_start > self.now:
                work_start = None
            else:
                self._audit("grievance.category_overridden", fixer, work_start, {
                    "grievance_id": str(grievance.id), "from_category": grievance.category,
                    "to_category": true_category, "predicted_category": triage.predicted_category,
                    "category_confidence": triage.confidence, "auto_routed": True,
                })
                self.stats["overrides"] += 1
        if work_start is None:
            self._sla_events(grievance, auto_department, route_at, None, None)
            return

        if work_start != route_at or not auto:
            router = admin if not auto else (self._staff_for(auto_department) or admin)
            self.db.add(GrievanceAssignment(
                id=uuid.uuid4(), grievance_id=grievance.id, department_id=final_department.id,
                assigned_by_user_id=router.id, note=f"Routed to {final_department.name}.",
                created_at=work_start,
            ))
            self._audit("grievance.routed", router, work_start, {
                "grievance_id": str(grievance.id), "to_department_id": final_department.id,
            })
        grievance.department_id = final_department.id
        grievance.category = true_category

        # --- lifecycle ----------------------------------------------------
        first_hours = _hours(row["first_response_after_hours"]) or 2.0
        resolution_hours = _hours(row["resolution_after_hours"])
        close_hours = _hours(row["close_after_hours"])
        first_response_at = work_start + timedelta(hours=first_hours)
        resolved_at = (
            work_start + timedelta(hours=max(resolution_hours, first_hours + 0.5))
            if resolution_hours is not None else None
        )
        closed_at = resolved_at + timedelta(hours=close_hours) if resolved_at and close_hours else None
        first_response_at = first_response_at if first_response_at <= self.now else None
        resolved_at = resolved_at if resolved_at and first_response_at and resolved_at <= self.now else None
        closed_at = closed_at if closed_at and resolved_at and closed_at <= self.now else None

        assignee = self._staff_for(final_department)
        if first_response_at is not None:
            grievance.first_response_at = first_response_at
            grievance.assigned_to_user_id = assignee.id if assignee else None
            grievance.status = GRIEVANCE_STATUS_IN_PROGRESS
            self._history(grievance, assignee or admin, GRIEVANCE_STATUS_OPEN, GRIEVANCE_STATUS_IN_PROGRESS,
                          "Case acknowledged and work started.", first_response_at)
            self.db.add(GrievanceComment(
                id=uuid.uuid4(), grievance_id=grievance.id, user_id=(assignee or admin).id,
                body=ACK_COMMENTS[true_category], created_at=first_response_at,
            ))
        elif rng.random() < 0.3:
            self.db.add(GrievanceComment(
                id=uuid.uuid4(), grievance_id=grievance.id, user_id=student.id,
                body=rng.choice(FOLLOW_UPS), created_at=min(self.now, work_start + timedelta(hours=24)),
            ))

        if resolved_at is not None:
            grievance.resolved_at = resolved_at
            grievance.status = GRIEVANCE_STATUS_RESOLVED
            grievance.resolution_note = RESOLUTION_NOTES[true_category]
            self._history(grievance, assignee or admin, GRIEVANCE_STATUS_IN_PROGRESS,
                          GRIEVANCE_STATUS_RESOLVED, grievance.resolution_note, resolved_at)
        if closed_at is not None:
            grievance.status = GRIEVANCE_STATUS_CLOSED
            self._history(grievance, admin, GRIEVANCE_STATUS_RESOLVED, GRIEVANCE_STATUS_CLOSED,
                          "Case closed after confirmation from the student.", closed_at)

        grievance.updated_at = max(t for t in (created_at, work_start, first_response_at, resolved_at, closed_at) if t)
        self._sla_events(grievance, final_department, work_start, first_response_at, resolved_at)

    def run(self) -> None:
        with GRIEVANCES_CSV.open(encoding="utf-8") as handle:
            rows = list(csv.DictReader(handle))
        if self.limit:
            rows = rows[-self.limit:]
        first = _parse_created(rows[0]["created_at"])
        last = _parse_created(rows[-1]["created_at"])
        shift = (self.now - timedelta(hours=2)) - last

        self.create_users(first + shift)
        for index, row in enumerate(rows, start=1):
            self.seed_grievance(row, shift)
            if index % BATCH_SIZE == 0:
                self.db.commit()
                print(f"  seeded {index}/{len(rows)} grievances", flush=True)
        self.db.commit()


def print_summary(stats: dict[str, int] | None = None) -> None:
    print("Demo data seeded successfully.")
    print("")
    print("Demo accounts (password: %s)" % DEMO_PASSWORD)
    print("-------------")
    for spec in DEMO_USERS:
        print(f"{spec.role_name.upper()}: {spec.email}")
    if stats:
        print("")
        for key, value in stats.items():
            print(f"{key}: {value}")


def run_demo_seed(*, force_reset: bool, limit: int | None = None) -> dict[str, int]:
    with SessionLocal() as db:
        try:
            if force_reset:
                reset_application_data(db)
            elif database_has_application_data(db):
                raise RuntimeError(
                    "Database already contains application data. Re-run with --force-reset to replace it."
                )

            seed_roles(db)
            seed_departments(db)
            seed_default_sla_policies(db)
            seed_default_escalation_rules(db)
            seeder = DatasetSeeder(db, limit=limit)
            seeder.run()
            return seeder.stats
        except (RuntimeError, ValueError, KeyError, SQLAlchemyError) as exc:
            db.rollback()
            abort(f"Failed to seed demo data: {exc}")


def main() -> None:
    args = parse_args()
    if not args.force_reset:
        abort("Seeder is destructive. Re-run with --force-reset to continue.")
    stats = run_demo_seed(force_reset=True, limit=args.limit)
    print_summary(stats)


if __name__ == "__main__":
    main()
