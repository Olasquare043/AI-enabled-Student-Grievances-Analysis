import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.grievance import Grievance
from app.models.sla_event import SLAEvent
from app.models.user import User
from app.schemas.grievance import GrievanceRead
from app.schemas.routing import (
    DepartmentCreateRequest,
    DepartmentRead,
    DepartmentUpdateRequest,
    GrievanceCSVImportResponse,
    GrievanceAssignmentRead,
    OperationalGrievanceItem,
    RouteGrievanceRequest,
)
from app.schemas.sla import (
    EscalationRuleCreateRequest,
    EscalationRuleRead,
    SLABreachSummary,
    SLAEvaluationResponse,
    SLAPolicyRead,
    SLAPolicyUpsertRequest,
)
from app.schemas.user import UserRead
from app.services.escalation_service import (
    create_escalation_rule,
    evaluate_escalations,
    list_escalation_rules,
)
from app.services.grievance_service import (
    can_access_grievance_record,
    ensure_can_access_grievance,
    get_grievance_by_id,
    is_staff_or_admin,
)
from app.services.grievance_import_service import (
    CSVImportInputError,
    import_grievances_from_csv,
)
from app.services.routing_service import (
    create_department,
    list_departments,
    list_grievance_assignments,
    list_operational_queue,
    route_grievance,
    update_department,
)
from app.services.sla_service import (
    SLA_EVENT_ESCALATION,
    SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    SLA_EVENT_RESOLUTION_DEADLINE,
    SLA_STATUS_BREACHED,
    SLA_STATUS_TRIGGERED,
    evaluate_due_sla_breaches,
    get_latest_deadline_events_for_grievances,
    list_active_breaches,
    list_sla_policies,
    upsert_sla_policy,
)
from app.services.user_service import list_assignable_operational_users

router = APIRouter(prefix="/operations", tags=["operations"])
AdminUser = Annotated[User, Depends(require_role("admin"))]


def get_staff_or_admin_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not is_staff_or_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only staff or admins can access operations endpoints",
        )
    return current_user


StaffOrAdminUser = Annotated[User, Depends(get_staff_or_admin_user)]


@router.get("/departments", response_model=list[DepartmentRead])
def list_departments_endpoint(
    _: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
    active_only: bool = False,
) -> list[DepartmentRead]:
    departments = list_departments(db, active_only=active_only)
    return [DepartmentRead.model_validate(item) for item in departments]


@router.get("/assignable-users", response_model=list[UserRead])
def list_assignable_users_endpoint(
    _: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
    department_id: Annotated[int | None, Query(gt=0)] = None,
) -> list[UserRead]:
    try:
        users = list_assignable_operational_users(db, department_id=department_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [UserRead.model_validate(user) for user in users]


@router.post("/departments", response_model=DepartmentRead, status_code=status.HTTP_201_CREATED)
def create_department_endpoint(
    payload: DepartmentCreateRequest,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> DepartmentRead:
    try:
        department = create_department(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return DepartmentRead.model_validate(department)


@router.patch("/departments/{department_id}", response_model=DepartmentRead)
def update_department_endpoint(
    department_id: int,
    payload: DepartmentUpdateRequest,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> DepartmentRead:
    try:
        department = update_department(db, department_id, payload)
    except ValueError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc
    return DepartmentRead.model_validate(department)


@router.get("/sla/policies", response_model=list[SLAPolicyRead])
def list_sla_policies_endpoint(
    _: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[SLAPolicyRead]:
    policies = list_sla_policies(db)
    return [SLAPolicyRead.model_validate(item) for item in policies]


@router.put("/sla/policies/{department_id}", response_model=SLAPolicyRead)
def upsert_sla_policy_endpoint(
    department_id: int,
    payload: SLAPolicyUpsertRequest,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> SLAPolicyRead:
    try:
        policy = upsert_sla_policy(db, department_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return SLAPolicyRead.model_validate(policy)


@router.get("/escalation-rules", response_model=list[EscalationRuleRead])
def list_escalation_rules_endpoint(
    _: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[EscalationRuleRead]:
    rules = list_escalation_rules(db)
    return [EscalationRuleRead.model_validate(item) for item in rules]


@router.post(
    "/escalation-rules",
    response_model=EscalationRuleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_escalation_rule_endpoint(
    payload: EscalationRuleCreateRequest,
    _: AdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> EscalationRuleRead:
    try:
        rule = create_escalation_rule(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return EscalationRuleRead.model_validate(rule)


@router.post("/grievances/{grievance_id}/route", response_model=GrievanceRead)
def route_grievance_endpoint(
    grievance_id: uuid.UUID,
    payload: RouteGrievanceRequest,
    current_user: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> GrievanceRead:
    grievance = get_grievance_by_id(db, grievance_id)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        routed = route_grievance(
            db,
            grievance,
            acting_user=current_user,
            payload=payload,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        detail = str(exc)
        status_code = (
            status.HTTP_404_NOT_FOUND
            if "not found" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=detail) from exc

    return GrievanceRead.model_validate(routed)


@router.get(
    "/grievances/{grievance_id}/assignments",
    response_model=list[GrievanceAssignmentRead],
)
def grievance_assignments_endpoint(
    grievance_id: uuid.UUID,
    current_user: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[GrievanceAssignmentRead]:
    grievance = get_grievance_by_id(db, grievance_id, include_details=False)
    if grievance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

    try:
        ensure_can_access_grievance(db, current_user, grievance)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    assignments = list_grievance_assignments(db, grievance_id)
    return [GrievanceAssignmentRead.model_validate(item) for item in assignments]


@router.get("/queue", response_model=list[OperationalGrievanceItem])
def operations_queue_endpoint(
    current_user: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
    department_id: Annotated[int | None, Query(gt=0)] = None,
    include_closed: bool = False,
) -> list[OperationalGrievanceItem]:
    grievances = list_operational_queue(
        db,
        current_user,
        department_id=department_id,
        include_closed=include_closed,
    )

    grievance_ids = [item.id for item in grievances]
    snapshot = get_latest_deadline_events_for_grievances(db, grievance_ids)

    current_breach_event_ids: list[uuid.UUID] = []
    for grievance in grievances:
        grievance_events = snapshot.get(grievance.id, {})
        first_response_event = grievance_events.get(SLA_EVENT_FIRST_RESPONSE_DEADLINE)
        resolution_event = grievance_events.get(SLA_EVENT_RESOLUTION_DEADLINE)
        if first_response_event is not None and first_response_event.status == SLA_STATUS_BREACHED:
            current_breach_event_ids.append(first_response_event.id)
        if resolution_event is not None and resolution_event.status == SLA_STATUS_BREACHED:
            current_breach_event_ids.append(resolution_event.id)

    escalation_counts_by_parent: dict[uuid.UUID, int] = {}
    if current_breach_event_ids:
        rows = db.execute(
            select(SLAEvent.parent_event_id, func.count(SLAEvent.id))
            .where(
                SLAEvent.parent_event_id.in_(current_breach_event_ids),
                SLAEvent.event_type == SLA_EVENT_ESCALATION,
                SLAEvent.status == SLA_STATUS_TRIGGERED,
            )
            .group_by(SLAEvent.parent_event_id)
        ).all()
        escalation_counts_by_parent = {
            row[0]: row[1]
            for row in rows
            if row[0] is not None
        }

    items: list[OperationalGrievanceItem] = []
    for grievance in grievances:
        grievance_events = snapshot.get(grievance.id, {})
        first_response_event = grievance_events.get(SLA_EVENT_FIRST_RESPONSE_DEADLINE)
        resolution_event = grievance_events.get(SLA_EVENT_RESOLUTION_DEADLINE)

        first_response_status = first_response_event.status if first_response_event else None
        resolution_status = resolution_event.status if resolution_event else None

        has_active_breach = (
            first_response_status == SLA_STATUS_BREACHED
            or resolution_status == SLA_STATUS_BREACHED
        )

        escalation_count = 0
        if first_response_event is not None and first_response_status == SLA_STATUS_BREACHED:
            escalation_count += escalation_counts_by_parent.get(first_response_event.id, 0)
        if resolution_event is not None and resolution_status == SLA_STATUS_BREACHED:
            escalation_count += escalation_counts_by_parent.get(resolution_event.id, 0)

        items.append(
            OperationalGrievanceItem(
                id=grievance.id,
                title=grievance.title,
                category=grievance.category,
                status=grievance.status,
                created_at=grievance.created_at,
                department=grievance.department,
                student=grievance.student,
                assigned_to_user=grievance.assigned_to_user,
                first_response_due_at=(
                    first_response_event.due_at if first_response_event else None
                ),
                first_response_status=first_response_status,
                resolution_due_at=(
                    resolution_event.due_at if resolution_event else None
                ),
                resolution_status=resolution_status,
                escalation_count=escalation_count,
                has_active_breach=has_active_breach,
            )
        )

    return items


@router.post("/sla/evaluate", response_model=SLAEvaluationResponse)
def evaluate_sla_endpoint(
    _: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> SLAEvaluationResponse:
    evaluated_at = datetime.now(timezone.utc)
    new_breaches = evaluate_due_sla_breaches(db, evaluated_at=evaluated_at)
    db.flush()
    new_escalations = evaluate_escalations(db, evaluated_at=evaluated_at)
    db.commit()

    return SLAEvaluationResponse(
        evaluated_at=evaluated_at,
        new_breaches=len(new_breaches),
        new_escalations=len(new_escalations),
    )


@router.get("/sla/breaches", response_model=list[SLABreachSummary])
def sla_breaches_endpoint(
    current_user: StaffOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[SLABreachSummary]:
    breaches = list_active_breaches(db)
    return [
        breach
        for breach in breaches
        if can_access_grievance_record(
            db,
            current_user,
            student_id=breach.student.id,
            department_id=breach.department_id,
            assigned_to_user_id=breach.assigned_to_user.id if breach.assigned_to_user else None,
        )
    ]


@router.post(
    "/imports/grievances/csv",
    response_model=GrievanceCSVImportResponse,
)
async def import_grievances_csv_endpoint(
    current_user: AdminUser,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> GrievanceCSVImportResponse:
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are supported for this import endpoint.",
        )

    content = await file.read()
    try:
        result = import_grievances_from_csv(
            db,
            csv_bytes=content,
            acting_user=current_user,
        )
    except CSVImportInputError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return GrievanceCSVImportResponse(
        total_rows=result.total_rows,
        imported_count=result.imported_count,
        failed_count=result.failed_count,
        errors=[
            {"row_number": item.row_number, "message": item.message}
            for item in result.errors
        ],
    )
