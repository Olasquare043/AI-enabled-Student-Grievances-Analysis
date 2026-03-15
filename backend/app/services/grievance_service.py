import uuid
from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

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
from app.models.user import User
from app.schemas.grievance import (
    GrievanceAssignRequest,
    GrievanceCreateRequest,
    GrievanceStatusUpdateRequest,
    ensure_grievance_status,
)
from app.services.user_service import ROLE_ADMIN, ROLE_STAFF, get_user_by_id
from app.services.sla_service import (
    mark_first_response_if_needed,
    mark_resolution_if_needed,
)

_ALLOWED_TRANSITIONS = {
    GRIEVANCE_STATUS_OPEN: {GRIEVANCE_STATUS_IN_PROGRESS, GRIEVANCE_STATUS_CLOSED},
    GRIEVANCE_STATUS_IN_PROGRESS: {GRIEVANCE_STATUS_RESOLVED, GRIEVANCE_STATUS_CLOSED},
    GRIEVANCE_STATUS_RESOLVED: {GRIEVANCE_STATUS_CLOSED},
    GRIEVANCE_STATUS_CLOSED: set(),
}


LIST_LOAD_OPTIONS = (
    selectinload(Grievance.student),
    selectinload(Grievance.assigned_to_user),
    selectinload(Grievance.department),
)

DETAIL_LOAD_OPTIONS = (
    selectinload(Grievance.student),
    selectinload(Grievance.assigned_to_user),
    selectinload(Grievance.department),
    selectinload(Grievance.comments).selectinload(GrievanceComment.user),
    selectinload(Grievance.status_history).selectinload(
        GrievanceStatusHistory.changed_by_user
    ),
)


def _normalize_text(value: str) -> str:
    cleaned = " ".join(value.split())
    if not cleaned:
        raise ValueError("Text value cannot be empty")
    return cleaned


def _normalize_multiline_text(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Text value cannot be empty")
    return cleaned


def _role_names(user: User) -> set[str]:
    return {role.name for role in user.roles}


def is_staff_or_admin(user: User) -> bool:
    role_names = _role_names(user)
    return ROLE_ADMIN in role_names or ROLE_STAFF in role_names


def is_admin(user: User) -> bool:
    return ROLE_ADMIN in _role_names(user)


def _normalize_department_lookup(value: str | None) -> tuple[str, str]:
    normalized_name = " ".join((value or "").strip().lower().split())
    normalized_code = "".join((value or "").strip().upper().split())
    return normalized_name, normalized_code


def get_staff_scope_department_ids(db: Session, user: User) -> set[int]:
    if ROLE_STAFF not in _role_names(user):
        return set()

    normalized_name, normalized_code = _normalize_department_lookup(user.department)
    if not normalized_name and not normalized_code:
        return set()

    department_ids: set[int] = set()
    departments = db.scalars(select(Department)).all()
    for department in departments:
        department_name = " ".join(department.name.strip().lower().split())
        department_code = "".join(department.code.strip().upper().split())

        if normalized_code and normalized_code == department_code:
            department_ids.add(department.id)
            continue

        if normalized_name and (
            normalized_name == department_name
            or normalized_name in department_name
            or department_name in normalized_name
        ):
            department_ids.add(department.id)

    return department_ids


def build_grievance_scope_filters(db: Session, current_user: User) -> list[object]:
    if is_admin(current_user):
        return []

    if ROLE_STAFF in _role_names(current_user):
        filters: list[object] = [Grievance.assigned_to_user_id == current_user.id]
        department_ids = get_staff_scope_department_ids(db, current_user)
        if department_ids:
            filters.append(Grievance.department_id.in_(department_ids))
        return filters

    return [Grievance.student_id == current_user.id]


def can_access_grievance_record(
    db: Session,
    user: User,
    *,
    student_id: uuid.UUID,
    department_id: int | None,
    assigned_to_user_id: uuid.UUID | None,
) -> bool:
    if is_admin(user):
        return True

    if ROLE_STAFF in _role_names(user):
        if assigned_to_user_id == user.id:
            return True
        if department_id is None:
            return False
        return department_id in get_staff_scope_department_ids(db, user)

    return student_id == user.id


def _record_audit(
    db: Session,
    *,
    action: str,
    user_id: uuid.UUID | None,
    details: dict[str, object],
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            details=details,
        )
    )


def get_grievance_by_id(
    db: Session,
    grievance_id: uuid.UUID,
    *,
    include_details: bool = True,
) -> Grievance | None:
    options: Sequence[object] = DETAIL_LOAD_OPTIONS if include_details else LIST_LOAD_OPTIONS
    stmt = (
        select(Grievance)
        .options(*options)
        .where(Grievance.id == grievance_id)
    )
    return db.scalar(stmt)


def ensure_can_access_grievance(db: Session, user: User, grievance: Grievance) -> None:
    if can_access_grievance_record(
        db,
        user,
        student_id=grievance.student_id,
        department_id=grievance.department_id,
        assigned_to_user_id=grievance.assigned_to_user_id,
    ):
        return

    raise PermissionError("You do not have access to this grievance")


def create_grievance(
    db: Session,
    student_user: User,
    payload: GrievanceCreateRequest,
) -> Grievance:
    grievance = Grievance(
        student_id=student_user.id,
        title=_normalize_text(payload.title),
        description=_normalize_multiline_text(payload.description),
        category=_normalize_text(payload.category).lower(),
        is_anonymous=payload.is_anonymous,
        status=GRIEVANCE_STATUS_OPEN,
    )
    db.add(grievance)
    db.flush()

    db.add(
        GrievanceStatusHistory(
            grievance_id=grievance.id,
            changed_by_user_id=student_user.id,
            from_status=None,
            to_status=GRIEVANCE_STATUS_OPEN,
            note="Grievance submitted",
        )
    )

    _record_audit(
        db,
        action="grievance.created",
        user_id=student_user.id,
        details={
            "grievance_id": str(grievance.id),
            "student_id": str(student_user.id),
            "category": grievance.category,
            "status": grievance.status,
        },
    )

    db.commit()
    created = get_grievance_by_id(db, grievance.id)
    if created is None:
        raise RuntimeError("Created grievance could not be reloaded")
    return created


def list_grievances(
    db: Session,
    current_user: User,
    *,
    status: str | None = None,
    category: str | None = None,
    mine: bool = False,
) -> list[Grievance]:
    status_filter = ensure_grievance_status(status) if status else None
    category_filter = category.strip().lower() if category else None

    stmt = select(Grievance).options(*LIST_LOAD_OPTIONS)

    if mine:
        stmt = stmt.where(Grievance.student_id == current_user.id)
    else:
        scope_filters = build_grievance_scope_filters(db, current_user)
        if scope_filters:
            stmt = stmt.where(or_(*scope_filters))

    if status_filter:
        stmt = stmt.where(Grievance.status == status_filter)
    if category_filter:
        stmt = stmt.where(Grievance.category == category_filter)

    stmt = stmt.order_by(Grievance.created_at.desc())
    return list(db.scalars(stmt))


def list_triage_queue(
    db: Session,
    current_user: User,
    *,
    status: str | None = None,
    category: str | None = None,
) -> list[Grievance]:
    if not is_staff_or_admin(current_user):
        raise PermissionError("Only staff or admins can access triage queue")

    status_filter = ensure_grievance_status(status) if status else None
    category_filter = category.strip().lower() if category else None

    stmt = (
        select(Grievance)
        .options(*LIST_LOAD_OPTIONS)
        .where(Grievance.status.in_([GRIEVANCE_STATUS_OPEN, GRIEVANCE_STATUS_IN_PROGRESS]))
    )

    scope_filters = build_grievance_scope_filters(db, current_user)
    if scope_filters:
        stmt = stmt.where(or_(*scope_filters))

    if status_filter:
        stmt = stmt.where(Grievance.status == status_filter)
    if category_filter:
        stmt = stmt.where(Grievance.category == category_filter)

    stmt = stmt.order_by(Grievance.created_at.asc())
    return list(db.scalars(stmt))


def assign_grievance(
    db: Session,
    grievance: Grievance,
    acting_user: User,
    payload: GrievanceAssignRequest,
) -> Grievance:
    if not is_staff_or_admin(acting_user):
        raise PermissionError("Only staff or admins can assign grievances")
    ensure_can_access_grievance(db, acting_user, grievance)

    assignee = get_user_by_id(db, payload.assignee_user_id)
    if assignee is None:
        raise ValueError("Assignee user not found")

    assignee_roles = _role_names(assignee)
    if ROLE_STAFF not in assignee_roles and ROLE_ADMIN not in assignee_roles:
        raise ValueError("Assignee must have staff or admin role")

    previous_assignee = grievance.assigned_to_user_id
    grievance.assigned_to_user_id = assignee.id
    db.add(grievance)
    db.add(
        GrievanceAssignment(
            grievance_id=grievance.id,
            department_id=grievance.department_id,
            assigned_to_user_id=assignee.id,
            assigned_by_user_id=acting_user.id,
            note="Direct assignment from grievances endpoint",
        )
    )

    _record_audit(
        db,
        action="grievance.assigned",
        user_id=acting_user.id,
        details={
            "grievance_id": str(grievance.id),
            "assigned_by_user_id": str(acting_user.id),
            "previous_assignee_user_id": (
                str(previous_assignee) if previous_assignee else None
            ),
            "assignee_user_id": str(assignee.id),
        },
    )

    db.commit()
    assigned = get_grievance_by_id(db, grievance.id)
    if assigned is None:
        raise RuntimeError("Assigned grievance could not be reloaded")
    return assigned


def update_grievance_status(
    db: Session,
    grievance: Grievance,
    acting_user: User,
    payload: GrievanceStatusUpdateRequest,
) -> Grievance:
    if not is_staff_or_admin(acting_user):
        raise PermissionError("Only staff or admins can change grievance status")
    ensure_can_access_grievance(db, acting_user, grievance)

    target_status = ensure_grievance_status(payload.status)
    current_status = grievance.status

    if target_status == current_status:
        return grievance

    allowed_targets = _ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed_targets:
        raise ValueError(
            f"Invalid status transition from '{current_status}' to '{target_status}'"
        )

    normalized_note = (
        _normalize_multiline_text(payload.resolution_note)
        if payload.resolution_note
        else None
    )

    if target_status in {GRIEVANCE_STATUS_RESOLVED, GRIEVANCE_STATUS_CLOSED}:
        if not normalized_note and not grievance.resolution_note:
            raise ValueError(
                "resolution_note is required when moving grievance to resolved or closed"
            )

    grievance.status = target_status
    if normalized_note:
        grievance.resolution_note = normalized_note
    db.add(grievance)

    if target_status in {
        GRIEVANCE_STATUS_IN_PROGRESS,
        GRIEVANCE_STATUS_RESOLVED,
        GRIEVANCE_STATUS_CLOSED,
    }:
        mark_first_response_if_needed(
            db,
            grievance,
            actor_user_id=acting_user.id,
            source="status_update",
        )

    db.add(
        GrievanceStatusHistory(
            grievance_id=grievance.id,
            changed_by_user_id=acting_user.id,
            from_status=current_status,
            to_status=target_status,
            note=normalized_note,
        )
    )

    _record_audit(
        db,
        action="grievance.status_changed",
        user_id=acting_user.id,
        details={
            "grievance_id": str(grievance.id),
            "from_status": current_status,
            "to_status": target_status,
        },
    )

    if target_status in {GRIEVANCE_STATUS_RESOLVED, GRIEVANCE_STATUS_CLOSED}:
        mark_resolution_if_needed(
            db,
            grievance,
            actor_user_id=acting_user.id,
            source="status_update",
        )

    db.commit()
    updated = get_grievance_by_id(db, grievance.id)
    if updated is None:
        raise RuntimeError("Updated grievance could not be reloaded")
    return updated
