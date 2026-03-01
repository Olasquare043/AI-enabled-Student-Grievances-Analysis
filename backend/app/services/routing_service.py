import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.grievance import (
    GRIEVANCE_STATUS_CLOSED,
    GRIEVANCE_STATUS_IN_PROGRESS,
    GRIEVANCE_STATUS_OPEN,
    Grievance,
)
from app.models.grievance_assignment import GrievanceAssignment
from app.models.user import User
from app.schemas.routing import (
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    RouteGrievanceRequest,
)
from app.services.grievance_service import get_grievance_by_id, is_staff_or_admin
from app.services.sla_service import (
    get_sla_policy_for_department,
    reset_sla_timers_for_routing,
)
from app.services.user_service import ROLE_ADMIN, ROLE_STAFF, get_user_by_id

DEFAULT_DEPARTMENTS: tuple[tuple[str, str], ...] = (
    ("ICT", "ICT Support"),
    ("BURSARY", "Bursary"),
    ("REGISTRY", "Registry"),
    ("HOSTEL", "Hostel Services"),
    ("SECURITY", "Security"),
)


def _record_audit(
    db: Session,
    *,
    action: str,
    user_id: uuid.UUID | None,
    details: dict[str, object],
) -> None:
    db.add(AuditLog(user_id=user_id, action=action, details=details))


def _normalize_department_name(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("Department name cannot be empty")
    return cleaned


def _normalize_department_code(value: str) -> str:
    cleaned = "".join(value.strip().upper().split())
    if not cleaned:
        raise ValueError("Department code cannot be empty")
    return cleaned


def seed_departments(db: Session) -> None:
    existing_codes = {
        code.upper()
        for code in db.execute(select(Department.code)).scalars().all()
    }
    created = False

    for code, name in DEFAULT_DEPARTMENTS:
        if code in existing_codes:
            continue
        db.add(Department(code=code, name=name, is_active=True))
        created = True

    if created:
        db.commit()


def list_departments(db: Session, *, active_only: bool = False) -> list[Department]:
    stmt = select(Department)
    if active_only:
        stmt = stmt.where(Department.is_active.is_(True))
    stmt = stmt.order_by(Department.name.asc())
    return list(db.scalars(stmt))


def create_department(db: Session, payload: DepartmentCreateRequest) -> Department:
    normalized_name = _normalize_department_name(payload.name)
    normalized_code = _normalize_department_code(payload.code)

    existing = db.scalar(
        select(Department).where(
            (func.lower(Department.name) == normalized_name.lower())
            | (func.lower(Department.code) == normalized_code.lower())
        )
    )
    if existing is not None:
        raise ValueError("Department with same name or code already exists")

    department = Department(name=normalized_name, code=normalized_code, is_active=True)
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


def update_department(
    db: Session,
    department_id: int,
    payload: DepartmentUpdateRequest,
) -> Department:
    department = db.get(Department, department_id)
    if department is None:
        raise ValueError("Department not found")

    incoming = payload.model_dump(exclude_unset=True)
    if not incoming:
        return department

    if "name" in incoming and incoming["name"] is not None:
        normalized_name = _normalize_department_name(incoming["name"])
        duplicate = db.scalar(
            select(Department).where(
                func.lower(Department.name) == normalized_name.lower(),
                Department.id != department.id,
            )
        )
        if duplicate is not None:
            raise ValueError("Another department already uses this name")
        department.name = normalized_name

    if "code" in incoming and incoming["code"] is not None:
        normalized_code = _normalize_department_code(incoming["code"])
        duplicate = db.scalar(
            select(Department).where(
                func.lower(Department.code) == normalized_code.lower(),
                Department.id != department.id,
            )
        )
        if duplicate is not None:
            raise ValueError("Another department already uses this code")
        department.code = normalized_code

    if "is_active" in incoming and incoming["is_active"] is not None:
        department.is_active = bool(incoming["is_active"])

    db.add(department)
    db.commit()
    db.refresh(department)
    return department


def route_grievance(
    db: Session,
    grievance: Grievance,
    *,
    acting_user: User,
    payload: RouteGrievanceRequest,
) -> Grievance:
    if not is_staff_or_admin(acting_user):
        raise PermissionError("Only staff or admins can route grievances")

    department = db.get(Department, payload.department_id)
    if department is None or not department.is_active:
        raise ValueError("Department not found or inactive")

    assignee: User | None = None
    if payload.assignee_user_id is not None:
        assignee = get_user_by_id(db, payload.assignee_user_id)
        if assignee is None:
            raise ValueError("Assignee user not found")

        assignee_roles = {role.name for role in assignee.roles}
        if ROLE_STAFF not in assignee_roles and ROLE_ADMIN not in assignee_roles:
            raise ValueError("Assignee must have staff or admin role")

    normalized_note = payload.note.strip() if payload.note else None

    previous_department_id = grievance.department_id
    previous_assignee_id = grievance.assigned_to_user_id
    grievance.department_id = department.id
    if assignee is not None:
        grievance.assigned_to_user_id = assignee.id

    db.add(grievance)
    db.add(
        GrievanceAssignment(
            grievance_id=grievance.id,
            department_id=department.id,
            assigned_to_user_id=grievance.assigned_to_user_id,
            assigned_by_user_id=acting_user.id,
            note=normalized_note,
        )
    )

    policy = get_sla_policy_for_department(db, department.id, only_active=True)
    if policy is None:
        raise ValueError("No active SLA policy configured for the selected department")

    reset_sla_timers_for_routing(
        db,
        grievance,
        department_id=department.id,
        policy=policy,
        routed_by_user_id=acting_user.id,
    )

    _record_audit(
        db,
        action="grievance.routed",
        user_id=acting_user.id,
        details={
            "grievance_id": str(grievance.id),
            "from_department_id": previous_department_id,
            "to_department_id": department.id,
            "previous_assignee_user_id": (
                str(previous_assignee_id) if previous_assignee_id else None
            ),
            "assignee_user_id": (
                str(grievance.assigned_to_user_id)
                if grievance.assigned_to_user_id
                else None
            ),
        },
    )

    db.commit()
    refreshed = get_grievance_by_id(db, grievance.id)
    if refreshed is None:
        raise RuntimeError("Routed grievance could not be reloaded")
    return refreshed


def list_grievance_assignments(
    db: Session,
    grievance_id: uuid.UUID,
) -> list[GrievanceAssignment]:
    stmt = (
        select(GrievanceAssignment)
        .options(
            selectinload(GrievanceAssignment.department),
            selectinload(GrievanceAssignment.assigned_to_user),
            selectinload(GrievanceAssignment.assigned_by_user),
        )
        .where(GrievanceAssignment.grievance_id == grievance_id)
        .order_by(GrievanceAssignment.created_at.asc())
    )
    return list(db.scalars(stmt))


def list_operational_queue(
    db: Session,
    *,
    department_id: int | None = None,
    include_closed: bool = False,
) -> list[Grievance]:
    stmt = select(Grievance).options(
        selectinload(Grievance.student),
        selectinload(Grievance.assigned_to_user),
        selectinload(Grievance.department),
    )

    if not include_closed:
        stmt = stmt.where(
            Grievance.status.in_([GRIEVANCE_STATUS_OPEN, GRIEVANCE_STATUS_IN_PROGRESS])
        )

    if department_id is not None:
        stmt = stmt.where(Grievance.department_id == department_id)

    stmt = stmt.order_by(Grievance.created_at.asc())
    return list(db.scalars(stmt))
