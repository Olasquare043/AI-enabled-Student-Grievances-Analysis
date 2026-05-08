from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import NoReturn

from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import Base, SessionLocal
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


@dataclass(frozen=True)
class DemoUserSpec:
    key: str
    role_name: str
    email: str
    password: str
    first_name: str
    last_name: str
    matric_number: str
    phone_number: str
    faculty: str
    department: str
    level: str
    created_days_ago: int


@dataclass(frozen=True)
class DemoCommentSpec:
    author_key: str
    hours_after_created: float
    body: str


@dataclass(frozen=True)
class DemoCaseSpec:
    title: str
    description: str
    category: str
    student_key: str
    created_days_ago: int
    created_hour: int
    created_minute: int
    final_status: str
    is_anonymous: bool = False
    routed_department_code: str | None = None
    assigned_staff_key: str | None = None
    route_after_hours: float = 1.0
    first_response_after_hours: float | None = None
    resolution_after_hours: float | None = None
    close_after_hours: float | None = None
    resolution_note: str | None = None
    assignment_note: str | None = None
    comments: tuple[DemoCommentSpec, ...] = field(default_factory=tuple)
    escalate_first_response: bool = False
    escalate_resolution: bool = False


DEMO_USERS: tuple[DemoUserSpec, ...] = (
    DemoUserSpec(
        key="admin",
        role_name=ROLE_ADMIN,
        email="admin@gmail.com",
        password="password123",
        first_name="System",
        last_name="Administrator",
        matric_number="ADM/24/0001",
        phone_number="08030000001",
        faculty="Administration",
        department="Platform Operations",
        level="N/A",
        created_days_ago=180,
    ),
    DemoUserSpec(
        key="student_saheed",
        role_name=ROLE_STUDENT,
        email="ola2@gmail.com",
        password="password123",
        first_name="Saheed",
        last_name="Olayemi Olayinka",
        matric_number="CSC/24/214906",
        phone_number="08030796165",
        faculty="Science",
        department="Computer Science",
        level="500",
        created_days_ago=120,
    ),
    DemoUserSpec(
        key="student_adeyemi",
        role_name=ROLE_STUDENT,
        email="adeyemi.omooba@gmail.com",
        password="password123",
        first_name="Adeyemi",
        last_name="Omooba",
        matric_number="ACC/24/214905",
        phone_number="08035551234",
        faculty="Management Sciences",
        department="Accounting",
        level="400",
        created_days_ago=118,
    ),
    DemoUserSpec(
        key="staff_grace",
        role_name=ROLE_STAFF,
        email="grace.adebayo@campuspulse.edu.ng",
        password="password123",
        first_name="Grace",
        last_name="Adebayo",
        matric_number="STF/OPS/0001",
        phone_number="08031112221",
        faculty="Administration",
        department="Registry",
        level="N/A",
        created_days_ago=160,
    ),
    DemoUserSpec(
        key="staff_martins",
        role_name=ROLE_STAFF,
        email="martins.okafor@campuspulse.edu.ng",
        password="password123",
        first_name="Martins",
        last_name="Okafor",
        matric_number="STF/OPS/0002",
        phone_number="08032223332",
        faculty="Administration",
        department="ICT Support",
        level="N/A",
        created_days_ago=158,
    ),
)


DEMO_CASES: tuple[DemoCaseSpec, ...] = (
    DemoCaseSpec(
        title="Tuition receipt not generated",
        description="My school fees were debited successfully but the portal still does not generate a receipt, and course registration remains blocked.",
        category="bursary",
        student_key="student_saheed",
        created_days_ago=2,
        created_hour=9,
        created_minute=10,
        final_status=GRIEVANCE_STATUS_OPEN,
        routed_department_code="BURSARY",
        assignment_note="Needs payment ledger verification before registration closes.",
        comments=(
            DemoCommentSpec(
                author_key="student_saheed",
                hours_after_created=10,
                body="Payment alert and remita slip have already been uploaded to the portal.",
            ),
        ),
        escalate_first_response=True,
    ),
    DemoCaseSpec(
        title="Student portal authentication failure",
        description="The student portal keeps rejecting valid credentials and blocks access to course registration and fee statements.",
        category="ict",
        student_key="student_adeyemi",
        created_days_ago=5,
        created_hour=8,
        created_minute=25,
        final_status=GRIEVANCE_STATUS_IN_PROGRESS,
        routed_department_code="ICT",
        assigned_staff_key="staff_martins",
        first_response_after_hours=1.0,
        assignment_note="Password reset and account lock review in progress.",
        comments=(
            DemoCommentSpec(
                author_key="staff_martins",
                hours_after_created=7,
                body="We have traced the issue to an account sync failure and started remediation.",
            ),
        ),
        escalate_resolution=True,
    ),
    DemoCaseSpec(
        title="Hostel plumbing leak near room allocation block",
        description="Water has been leaking into the room for two days and the maintenance request has not been acknowledged.",
        category="hostel",
        student_key="student_saheed",
        created_days_ago=4,
        created_hour=11,
        created_minute=40,
        final_status=GRIEVANCE_STATUS_IN_PROGRESS,
        is_anonymous=True,
        routed_department_code="HOSTEL",
        first_response_after_hours=2.0,
        assignment_note="Maintenance contractor visit scheduled but not completed.",
        comments=(
            DemoCommentSpec(
                author_key="student_saheed",
                hours_after_created=20,
                body="The leak has now affected the neighboring room as well.",
            ),
        ),
        escalate_resolution=True,
    ),
    DemoCaseSpec(
        title="Missing course registration approval",
        description="I submitted my course form last week but approval is still pending, and the department has not responded.",
        category="registry",
        student_key="student_adeyemi",
        created_days_ago=1,
        created_hour=14,
        created_minute=5,
        final_status=GRIEVANCE_STATUS_OPEN,
        comments=(
            DemoCommentSpec(
                author_key="student_adeyemi",
                hours_after_created=5,
                body="This delay is affecting my exam clearance timeline.",
            ),
        ),
    ),
    DemoCaseSpec(
        title="Campus gate ID verification delay",
        description="Security officers still flag my renewed ID card as invalid even after biometric capture was completed.",
        category="security",
        student_key="student_saheed",
        created_days_ago=6,
        created_hour=7,
        created_minute=55,
        final_status=GRIEVANCE_STATUS_RESOLVED,
        routed_department_code="SECURITY",
        first_response_after_hours=0.5,
        resolution_after_hours=18.0,
        resolution_note="Security desk refreshed the biometric registry and cleared the ID profile.",
        comments=(
            DemoCommentSpec(
                author_key="staff_grace",
                hours_after_created=10,
                body="Security operations confirmed the renewed card record is now active.",
            ),
        ),
    ),
    DemoCaseSpec(
        title="Result upload delay for current semester",
        description="The semester result for two courses is still missing from the portal and faculty support has not clarified the timeline.",
        category="academic",
        student_key="student_adeyemi",
        created_days_ago=7,
        created_hour=10,
        created_minute=20,
        final_status=GRIEVANCE_STATUS_OPEN,
        routed_department_code="REGISTRY",
        assigned_staff_key="staff_grace",
        assignment_note="Awaiting departmental result collation and upload confirmation.",
        comments=(
            DemoCommentSpec(
                author_key="student_adeyemi",
                hours_after_created=16,
                body="The missing result is blocking my scholarship application update.",
            ),
        ),
        escalate_first_response=True,
        escalate_resolution=True,
    ),
    DemoCaseSpec(
        title="Hostel room allocation mix-up",
        description="My hostel allocation changed after payment confirmation and the current room assigned to me is already occupied.",
        category="hostel",
        student_key="student_saheed",
        created_days_ago=9,
        created_hour=9,
        created_minute=35,
        final_status=GRIEVANCE_STATUS_RESOLVED,
        routed_department_code="HOSTEL",
        first_response_after_hours=1.0,
        resolution_after_hours=28.0,
        resolution_note="Hostel desk reassigned the correct room and updated the allocation roster.",
    ),
    DemoCaseSpec(
        title="Duplicate fee charge on payment portal",
        description="The bursary portal generated a second debit notice for a fee that was already paid and verified last week.",
        category="bursary",
        student_key="student_adeyemi",
        created_days_ago=12,
        created_hour=8,
        created_minute=45,
        final_status=GRIEVANCE_STATUS_RESOLVED,
        routed_department_code="BURSARY",
        first_response_after_hours=1.5,
        resolution_after_hours=52.0,
        resolution_note="Bursary reconciled the duplicate posting and removed the extra balance.",
        comments=(
            DemoCommentSpec(
                author_key="student_adeyemi",
                hours_after_created=4,
                body="Attached proof of the original bank transaction for reconciliation.",
            ),
        ),
    ),
    DemoCaseSpec(
        title="Wi-Fi outage in software laboratory",
        description="Department lab connectivity has been unstable for three days and practical sessions now rely on mobile hotspots.",
        category="ict",
        student_key="student_saheed",
        created_days_ago=14,
        created_hour=13,
        created_minute=15,
        final_status=GRIEVANCE_STATUS_CLOSED,
        routed_department_code="ICT",
        assigned_staff_key="staff_martins",
        first_response_after_hours=0.75,
        resolution_after_hours=7.5,
        close_after_hours=6.0,
        resolution_note="ICT replaced the failed switch and restored stable wireless access in the laboratory.",
    ),
    DemoCaseSpec(
        title="Hostel refund still pending after withdrawal",
        description="I completed hostel withdrawal formalities but the approved refund has not been posted to my student ledger.",
        category="bursary",
        student_key="student_adeyemi",
        created_days_ago=18,
        created_hour=12,
        created_minute=5,
        final_status=GRIEVANCE_STATUS_OPEN,
        comments=(
            DemoCommentSpec(
                author_key="student_adeyemi",
                hours_after_created=26,
                body="Finance office asked me to raise a grievance because the ledger remains unchanged.",
            ),
        ),
    ),
    DemoCaseSpec(
        title="Transcript request not acknowledged",
        description="My transcript application payment has been confirmed but there has been no response from registry processing for days.",
        category="registry",
        student_key="student_saheed",
        created_days_ago=21,
        created_hour=15,
        created_minute=10,
        final_status=GRIEVANCE_STATUS_RESOLVED,
        routed_department_code="REGISTRY",
        assigned_staff_key="staff_grace",
        first_response_after_hours=0.9,
        resolution_after_hours=39.0,
        resolution_note="Registry validated the payment and moved the transcript request into dispatch processing.",
    ),
    DemoCaseSpec(
        title="Security incident report follow-up",
        description="A phone theft report was logged with campus security, but there has been no update on CCTV review or case closure.",
        category="security",
        student_key="student_adeyemi",
        created_days_ago=27,
        created_hour=18,
        created_minute=0,
        final_status=GRIEVANCE_STATUS_CLOSED,
        routed_department_code="SECURITY",
        first_response_after_hours=0.4,
        resolution_after_hours=10.0,
        close_after_hours=5.0,
        resolution_note="Security completed CCTV review, shared findings, and closed the incident follow-up.",
    ),
    DemoCaseSpec(
        title="Exam timetable conflict between required courses",
        description="Two compulsory courses were scheduled for overlapping slots and the class has not received an official correction notice.",
        category="academic",
        student_key="student_saheed",
        created_days_ago=35,
        created_hour=9,
        created_minute=5,
        final_status=GRIEVANCE_STATUS_CLOSED,
        routed_department_code="REGISTRY",
        assigned_staff_key="staff_grace",
        first_response_after_hours=1.5,
        resolution_after_hours=44.0,
        close_after_hours=8.0,
        resolution_note="Academic scheduling team published a corrected timetable and notified affected students.",
    ),
    DemoCaseSpec(
        title="Broken hostel access control panel",
        description="The block access panel has been faulty since the weekend and residents have been locked out repeatedly after lectures.",
        category="hostel",
        student_key="student_adeyemi",
        created_days_ago=42,
        created_hour=16,
        created_minute=50,
        final_status=GRIEVANCE_STATUS_RESOLVED,
        routed_department_code="HOSTEL",
        first_response_after_hours=3.0,
        resolution_after_hours=47.0,
        resolution_note="Hostel maintenance replaced the control panel and tested access cards successfully.",
    ),
    DemoCaseSpec(
        title="Laptop registration request delayed",
        description="ICT asset registration for my departmental laptop has been pending and network access credentials are still unavailable.",
        category="ict",
        student_key="student_saheed",
        created_days_ago=50,
        created_hour=11,
        created_minute=0,
        final_status=GRIEVANCE_STATUS_RESOLVED,
        routed_department_code="ICT",
        assigned_staff_key="staff_martins",
        first_response_after_hours=1.2,
        resolution_after_hours=34.0,
        resolution_note="ICT enrolled the device on the asset list and issued access credentials to the student.",
    ),
    DemoCaseSpec(
        title="Refund request requires final confirmation",
        description="My approved departmental fee refund still needs bursary confirmation and the process has exceeded the promised timeline.",
        category="bursary",
        student_key="student_adeyemi",
        created_days_ago=61,
        created_hour=10,
        created_minute=35,
        final_status=GRIEVANCE_STATUS_CLOSED,
        routed_department_code="BURSARY",
        first_response_after_hours=2.2,
        resolution_after_hours=72.0,
        close_after_hours=5.0,
        resolution_note="Bursary completed the refund confirmation and posted the final ledger update.",
    ),
    DemoCaseSpec(
        title="Hostel maintenance complaint follow-up",
        description="A previous hostel maintenance job was marked complete, but the electrical issue returned and required another intervention.",
        category="hostel",
        student_key="student_saheed",
        created_days_ago=72,
        created_hour=8,
        created_minute=40,
        final_status=GRIEVANCE_STATUS_CLOSED,
        routed_department_code="HOSTEL",
        first_response_after_hours=1.0,
        resolution_after_hours=68.0,
        close_after_hours=7.0,
        resolution_note="Hostel maintenance replaced the faulty wiring section and confirmed stable power restoration.",
    ),
    DemoCaseSpec(
        title="Missing carry-over course update",
        description="The carry-over course registration update is missing from my profile and faculty records still show the old status.",
        category="academic",
        student_key="student_adeyemi",
        created_days_ago=84,
        created_hour=14,
        created_minute=20,
        final_status=GRIEVANCE_STATUS_CLOSED,
        routed_department_code="REGISTRY",
        assigned_staff_key="staff_grace",
        first_response_after_hours=1.6,
        resolution_after_hours=58.0,
        close_after_hours=4.0,
        resolution_note="Registry updated the carry-over record and synchronized the correction across the portal.",
    ),
)


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


def abort(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reset the development database and seed realistic demo data.",
    )
    parser.add_argument(
        "--force-reset",
        action="store_true",
        help="Required. Confirms that the current development database should be cleared before seeding.",
    )
    return parser.parse_args()


def database_has_application_data(db: Session) -> bool:
    return (
        db.scalar(select(User.id).limit(1)) is not None
        or db.scalar(select(Grievance.id).limit(1)) is not None
    )


def reset_application_data(db: Session) -> None:
    bind = db.get_bind()
    if bind.dialect.name == "postgresql":
        joined_tables = ", ".join(RESET_TABLES)
        db.execute(text(f"TRUNCATE TABLE {joined_tables} RESTART IDENTITY CASCADE"))
    else:
        table_lookup = {table.name: table for table in Base.metadata.sorted_tables}
        for table_name in RESET_TABLES:
            table = table_lookup.get(table_name)
            if table is not None:
                db.execute(table.delete())
    db.commit()


def build_reference_now() -> datetime:
    now = datetime.now(UTC)
    return now.replace(second=0, microsecond=0)


def stamp(reference_now: datetime, *, days_ago: int, hour: int, minute: int) -> datetime:
    base = reference_now - timedelta(days=days_ago)
    return base.replace(hour=hour, minute=minute)


def duration(hours: float | None) -> timedelta | None:
    if hours is None:
        return None
    return timedelta(minutes=int(hours * 60))


def latest_timestamp(*values: datetime | None) -> datetime:
    defined_values = [value for value in values if value is not None]
    if not defined_values:
        raise ValueError("At least one timestamp is required")
    return max(defined_values)


def create_demo_users(db: Session, reference_now: datetime) -> dict[str, User]:
    roles = {role.name: role for role in db.scalars(select(Role)).all()}
    users: dict[str, User] = {}

    for spec in DEMO_USERS:
        created_at = stamp(reference_now, days_ago=spec.created_days_ago, hour=9, minute=0)
        user = User(
            email=spec.email.lower(),
            hashed_password=get_password_hash(spec.password),
            first_name=spec.first_name,
            last_name=spec.last_name,
            matric_number=spec.matric_number,
            phone_number=spec.phone_number,
            faculty=spec.faculty,
            department=spec.department,
            level=spec.level,
            is_active=True,
            created_at=created_at,
            updated_at=created_at,
        )
        user.roles = [roles[spec.role_name]]
        db.add(user)
        users[spec.key] = user

    db.flush()
    return users


def department_lookup(db: Session) -> dict[str, Department]:
    return {department.code.upper(): department for department in db.scalars(select(Department)).all()}


def policy_lookup(db: Session) -> dict[int, SLAPolicy]:
    return {policy.department_id: policy for policy in db.scalars(select(SLAPolicy)).all()}


def add_sla_events(
    db: Session,
    *,
    grievance: Grievance,
    department: Department,
    policy: SLAPolicy,
    route_at: datetime,
    first_response_at: datetime | None,
    resolved_at: datetime | None,
    reference_now: datetime,
    escalate_first_response: bool,
    escalate_resolution: bool,
) -> None:
    first_response_due_at = route_at + timedelta(minutes=policy.first_response_minutes)
    resolution_due_at = route_at + timedelta(minutes=policy.resolution_minutes)

    if first_response_at is not None:
        first_response_status = SLA_STATUS_MET
        first_response_occurred_at = first_response_at
        first_response_details: dict[str, object] = {
            "policy_first_response_minutes": policy.first_response_minutes,
            "source": "demo_seed",
        }
        if first_response_at > first_response_due_at:
            first_response_details["met_after_breach"] = True
            first_response_details["resolved_breach_minutes"] = max(
                0,
                int((first_response_at - first_response_due_at).total_seconds() // 60),
            )
    elif first_response_due_at < reference_now:
        first_response_status = SLA_STATUS_BREACHED
        first_response_occurred_at = reference_now
        first_response_details = {
            "policy_first_response_minutes": policy.first_response_minutes,
            "breach_minutes": max(
                0,
                int((reference_now - first_response_due_at).total_seconds() // 60),
            ),
        }
    else:
        first_response_status = SLA_STATUS_PENDING
        first_response_occurred_at = None
        first_response_details = {
            "policy_first_response_minutes": policy.first_response_minutes,
        }

    if resolved_at is not None:
        resolution_status = SLA_STATUS_MET
        resolution_occurred_at = resolved_at
        resolution_details: dict[str, object] = {
            "policy_resolution_minutes": policy.resolution_minutes,
            "source": "demo_seed",
        }
        if resolved_at > resolution_due_at:
            resolution_details["met_after_breach"] = True
            resolution_details["resolved_breach_minutes"] = max(
                0,
                int((resolved_at - resolution_due_at).total_seconds() // 60),
            )
    elif resolution_due_at < reference_now:
        resolution_status = SLA_STATUS_BREACHED
        resolution_occurred_at = reference_now
        resolution_details = {
            "policy_resolution_minutes": policy.resolution_minutes,
            "breach_minutes": max(
                0,
                int((reference_now - resolution_due_at).total_seconds() // 60),
            ),
        }
    else:
        resolution_status = SLA_STATUS_PENDING
        resolution_occurred_at = None
        resolution_details = {
            "policy_resolution_minutes": policy.resolution_minutes,
        }

    first_response_event = SLAEvent(
        grievance_id=grievance.id,
        department_id=department.id,
        policy_id=policy.id,
        event_type=SLA_EVENT_FIRST_RESPONSE_DEADLINE,
        status=first_response_status,
        due_at=first_response_due_at,
        occurred_at=first_response_occurred_at,
        details=first_response_details,
        created_at=route_at,
    )
    resolution_event = SLAEvent(
        grievance_id=grievance.id,
        department_id=department.id,
        policy_id=policy.id,
        event_type=SLA_EVENT_RESOLUTION_DEADLINE,
        status=resolution_status,
        due_at=resolution_due_at,
        occurred_at=resolution_occurred_at,
        details=resolution_details,
        created_at=route_at,
    )
    db.add(first_response_event)
    db.add(resolution_event)
    db.flush()

    if escalate_first_response and first_response_status == SLA_STATUS_BREACHED:
        db.add(
            SLAEvent(
                grievance_id=grievance.id,
                department_id=department.id,
                policy_id=policy.id,
                parent_event_id=first_response_event.id,
                event_type=SLA_EVENT_ESCALATION,
                status=SLA_STATUS_TRIGGERED,
                occurred_at=first_response_occurred_at or reference_now,
                details={
                    "breach_type": "first_response",
                    "severity": "warning",
                    "target_role": ROLE_STAFF,
                    "threshold_minutes": 0,
                    "breach_minutes": first_response_details.get("breach_minutes", 0),
                },
                created_at=latest_timestamp(route_at, first_response_occurred_at, reference_now),
            )
        )

    if escalate_resolution and resolution_status == SLA_STATUS_BREACHED:
        db.add(
            SLAEvent(
                grievance_id=grievance.id,
                department_id=department.id,
                policy_id=policy.id,
                parent_event_id=resolution_event.id,
                event_type=SLA_EVENT_ESCALATION,
                status=SLA_STATUS_TRIGGERED,
                occurred_at=resolution_occurred_at or reference_now,
                details={
                    "breach_type": "resolution",
                    "severity": "critical",
                    "target_role": ROLE_ADMIN,
                    "threshold_minutes": 0,
                    "breach_minutes": resolution_details.get("breach_minutes", 0),
                },
                created_at=latest_timestamp(route_at, resolution_occurred_at, reference_now),
            )
        )


def seed_case(
    db: Session,
    *,
    spec: DemoCaseSpec,
    users: dict[str, User],
    departments: dict[str, Department],
    policies: dict[int, SLAPolicy],
    reference_now: datetime,
) -> None:
    student = users[spec.student_key]
    assignee = users.get(spec.assigned_staff_key) if spec.assigned_staff_key else None
    department = departments.get(spec.routed_department_code.upper()) if spec.routed_department_code else None
    policy = policies.get(department.id) if department is not None else None

    created_at = stamp(
        reference_now,
        days_ago=spec.created_days_ago,
        hour=spec.created_hour,
        minute=spec.created_minute,
    )
    route_at = created_at + duration(spec.route_after_hours) if department is not None else None
    first_response_at = (
        route_at + duration(spec.first_response_after_hours)
        if route_at is not None and spec.first_response_after_hours is not None
        else None
    )
    resolved_at = (
        route_at + duration(spec.resolution_after_hours)
        if route_at is not None and spec.resolution_after_hours is not None
        else None
    )
    closed_at = (
        resolved_at + duration(spec.close_after_hours)
        if resolved_at is not None and spec.close_after_hours is not None
        else None
    )
    comment_timestamps = [created_at + duration(comment.hours_after_created) for comment in spec.comments]
    updated_at = latest_timestamp(
        created_at,
        route_at,
        first_response_at,
        resolved_at,
        closed_at,
        *comment_timestamps,
    )

    grievance = Grievance(
        student_id=student.id,
        title=spec.title,
        description=spec.description,
        category=spec.category,
        is_anonymous=spec.is_anonymous,
        status=spec.final_status,
        assigned_to_user_id=assignee.id if assignee is not None else None,
        department_id=department.id if department is not None else None,
        resolution_note=spec.resolution_note,
        first_response_at=first_response_at,
        resolved_at=resolved_at,
        created_at=created_at,
        updated_at=updated_at,
    )
    db.add(grievance)
    db.flush()

    db.add(
        GrievanceStatusHistory(
            grievance_id=grievance.id,
            changed_by_user_id=student.id,
            from_status=None,
            to_status=GRIEVANCE_STATUS_OPEN,
            note="Grievance submitted",
            created_at=created_at,
        )
    )

    if route_at is not None:
        db.add(
            GrievanceAssignment(
                grievance_id=grievance.id,
                department_id=department.id,
                assigned_to_user_id=assignee.id if assignee is not None else None,
                assigned_by_user_id=users["admin"].id,
                note=spec.assignment_note or f"Routed to {department.name} for triage.",
                created_at=route_at,
            )
        )

        if policy is None:
            raise RuntimeError(f"Missing SLA policy for department {department.code}")
        add_sla_events(
            db,
            grievance=grievance,
            department=department,
            policy=policy,
            route_at=route_at,
            first_response_at=first_response_at,
            resolved_at=resolved_at,
            reference_now=reference_now,
            escalate_first_response=spec.escalate_first_response,
            escalate_resolution=spec.escalate_resolution,
        )

    if first_response_at is not None:
        db.add(
            GrievanceStatusHistory(
                grievance_id=grievance.id,
                changed_by_user_id=(assignee or users["admin"]).id,
                from_status=GRIEVANCE_STATUS_OPEN,
                to_status=GRIEVANCE_STATUS_IN_PROGRESS,
                note="Case acknowledged and work started.",
                created_at=first_response_at,
            )
        )

    if resolved_at is not None:
        db.add(
            GrievanceStatusHistory(
                grievance_id=grievance.id,
                changed_by_user_id=(assignee or users["admin"]).id,
                from_status=GRIEVANCE_STATUS_IN_PROGRESS,
                to_status=GRIEVANCE_STATUS_RESOLVED,
                note=spec.resolution_note,
                created_at=resolved_at,
            )
        )

    if closed_at is not None:
        db.add(
            GrievanceStatusHistory(
                grievance_id=grievance.id,
                changed_by_user_id=users["admin"].id,
                from_status=GRIEVANCE_STATUS_RESOLVED,
                to_status=GRIEVANCE_STATUS_CLOSED,
                note="Case closed after confirmation from the student.",
                created_at=closed_at,
            )
        )

    for comment in spec.comments:
        comment_author = users[comment.author_key]
        db.add(
            GrievanceComment(
                grievance_id=grievance.id,
                user_id=comment_author.id,
                body=comment.body,
                created_at=created_at + duration(comment.hours_after_created),
            )
        )


def seed_demo_dataset(db: Session) -> None:
    reference_now = build_reference_now()
    users = create_demo_users(db, reference_now)
    departments = department_lookup(db)
    policies = policy_lookup(db)

    for case_spec in DEMO_CASES:
        seed_case(
            db,
            spec=case_spec,
            users=users,
            departments=departments,
            policies=policies,
            reference_now=reference_now,
        )

    db.commit()


def print_summary() -> None:
    print("Development demo data seeded successfully.")
    print("")
    print("Demo accounts")
    print("-------------")
    for spec in DEMO_USERS:
        role_label = spec.role_name.upper()
        print(f"{role_label}: {spec.email} / {spec.password}")
    print("")
    print(f"Users: {len(DEMO_USERS)}")
    print(f"Grievances: {len(DEMO_CASES)}")
    print("Coverage: realistic records across 7, 30, and 90 day reporting windows.")


def run_demo_seed(*, force_reset: bool) -> None:
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
            seed_demo_dataset(db)
        except (RuntimeError, ValueError, SQLAlchemyError) as exc:
            db.rollback()
            abort(f"Failed to seed development demo data: {exc}")


def main() -> None:
    args = parse_args()
    if not args.force_reset:
        abort("Seeder is destructive. Re-run with --force-reset to continue.")

    run_demo_seed(force_reset=True)
    print_summary()


if __name__ == "__main__":
    main()
