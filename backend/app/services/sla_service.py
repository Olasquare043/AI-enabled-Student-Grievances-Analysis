import uuid
from collections.abc import Iterable
from datetime import datetime, timedelta, timezone

from sqlalchemy import Select, desc, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.grievance import (
    GRIEVANCE_STATUS_IN_PROGRESS,
    GRIEVANCE_STATUS_OPEN,
    Grievance,
)
from app.models.sla_event import SLAEvent
from app.models.sla_policy import SLAPolicy
from app.schemas.sla import SLABreachSummary, SLAPolicyUpsertRequest

SLA_EVENT_FIRST_RESPONSE_DEADLINE = "first_response_deadline"
SLA_EVENT_RESOLUTION_DEADLINE = "resolution_deadline"
SLA_EVENT_ESCALATION = "escalation"

SLA_STATUS_PENDING = "pending"
SLA_STATUS_MET = "met"
SLA_STATUS_BREACHED = "breached"
SLA_STATUS_CANCELED = "canceled"
SLA_STATUS_TRIGGERED = "triggered"

DEFAULT_SLA_MINUTES_BY_DEPARTMENT_CODE: dict[str, tuple[int, int]] = {
    "ICT": (120, 4320),
    "BURSARY": (180, 5760),
    "REGISTRY": (180, 7200),
    "HOSTEL": (180, 4320),
    "SECURITY": (60, 2880),
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _record_audit(
    db: Session,
    *,
    action: str,
    user_id: uuid.UUID | None,
    details: dict[str, object],
) -> None:
    db.add(AuditLog(user_id=user_id, action=action, details=details))


def list_sla_policies(db: Session) -> list[SLAPolicy]:
    stmt = (
        select(SLAPolicy)
        .options(selectinload(SLAPolicy.department))
        .order_by(SLAPolicy.department_id.asc())
    )
    return list(db.scalars(stmt))


def get_sla_policy_for_department(
    db: Session,
    department_id: int,
    *,
    only_active: bool = True,
) -> SLAPolicy | None:
    stmt: Select[tuple[SLAPolicy]] = select(SLAPolicy).where(
        SLAPolicy.department_id == department_id
    )
    if only_active:
        stmt = stmt.where(SLAPolicy.is_active.is_(True))
    return db.scalar(stmt)


def upsert_sla_policy(
    db: Session,
    department_id: int,
    payload: SLAPolicyUpsertRequest,
) -> SLAPolicy:
    department = db.get(Department, department_id)
    if department is None:
        raise ValueError("Department not found")

    policy = get_sla_policy_for_department(db, department_id, only_active=False)
    if policy is None:
        policy = SLAPolicy(
            department_id=department_id,
            first_response_minutes=payload.first_response_minutes,
            resolution_minutes=payload.resolution_minutes,
            is_active=payload.is_active,
        )
        db.add(policy)
    else:
        policy.first_response_minutes = payload.first_response_minutes
        policy.resolution_minutes = payload.resolution_minutes
        policy.is_active = payload.is_active
        db.add(policy)

    db.commit()
    db.refresh(policy)
    return policy


def seed_default_sla_policies(db: Session) -> None:
    departments = list(db.scalars(select(Department)).all())
    created = False

    for department in departments:
        existing = get_sla_policy_for_department(db, department.id, only_active=False)
        if existing is not None:
            continue

        default_values = DEFAULT_SLA_MINUTES_BY_DEPARTMENT_CODE.get(
            department.code.upper(),
            (180, 4320),
        )
        db.add(
            SLAPolicy(
                department_id=department.id,
                first_response_minutes=default_values[0],
                resolution_minutes=default_values[1],
                is_active=True,
            )
        )
        created = True

    if created:
        db.commit()


def _cancel_pending_deadline_events(
    db: Session,
    grievance_id: uuid.UUID,
    canceled_at: datetime,
) -> None:
    pending_events = list(
        db.scalars(
            select(SLAEvent).where(
                SLAEvent.grievance_id == grievance_id,
                SLAEvent.status == SLA_STATUS_PENDING,
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
            )
        )
    )

    for event in pending_events:
        event.status = SLA_STATUS_CANCELED
        event.occurred_at = canceled_at
        details = dict(event.details or {})
        details["canceled_reason"] = "grievance_rerouted"
        event.details = details
        db.add(event)


def reset_sla_timers_for_routing(
    db: Session,
    grievance: Grievance,
    *,
    department_id: int,
    policy: SLAPolicy,
    routed_by_user_id: uuid.UUID,
    routed_at: datetime | None = None,
) -> None:
    now = routed_at or _utcnow()
    _cancel_pending_deadline_events(db, grievance.id, now)

    first_response_due_at = now + timedelta(minutes=policy.first_response_minutes)
    resolution_due_at = now + timedelta(minutes=policy.resolution_minutes)

    first_response_status = (
        SLA_STATUS_MET if grievance.first_response_at else SLA_STATUS_PENDING
    )
    resolution_status = SLA_STATUS_MET if grievance.resolved_at else SLA_STATUS_PENDING

    db.add(
        SLAEvent(
            grievance_id=grievance.id,
            department_id=department_id,
            policy_id=policy.id,
            event_type=SLA_EVENT_FIRST_RESPONSE_DEADLINE,
            status=first_response_status,
            due_at=first_response_due_at,
            occurred_at=grievance.first_response_at,
            details={
                "policy_first_response_minutes": policy.first_response_minutes,
            },
        )
    )
    db.add(
        SLAEvent(
            grievance_id=grievance.id,
            department_id=department_id,
            policy_id=policy.id,
            event_type=SLA_EVENT_RESOLUTION_DEADLINE,
            status=resolution_status,
            due_at=resolution_due_at,
            occurred_at=grievance.resolved_at,
            details={
                "policy_resolution_minutes": policy.resolution_minutes,
            },
        )
    )

    _record_audit(
        db,
        action="sla.timers_initialized",
        user_id=routed_by_user_id,
        details={
            "grievance_id": str(grievance.id),
            "department_id": department_id,
            "policy_id": policy.id,
            "first_response_due_at": first_response_due_at.isoformat(),
            "resolution_due_at": resolution_due_at.isoformat(),
        },
    )


def _latest_trackable_deadline_event(
    db: Session,
    grievance_id: uuid.UUID,
    event_type: str,
) -> SLAEvent | None:
    return db.scalar(
        select(SLAEvent)
        .where(
            SLAEvent.grievance_id == grievance_id,
            SLAEvent.event_type == event_type,
            SLAEvent.status.in_([SLA_STATUS_PENDING, SLA_STATUS_BREACHED]),
        )
        .order_by(desc(SLAEvent.created_at))
        .limit(1)
    )


def mark_first_response_if_needed(
    db: Session,
    grievance: Grievance,
    *,
    actor_user_id: uuid.UUID,
    source: str,
    occurred_at: datetime | None = None,
) -> bool:
    now = occurred_at or _utcnow()
    changed = False

    if grievance.first_response_at is None:
        grievance.first_response_at = now
        db.add(grievance)
        changed = True

    event = _latest_trackable_deadline_event(
        db,
        grievance.id,
        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    )
    if event is not None:
        was_breached = event.status == SLA_STATUS_BREACHED
        event.status = SLA_STATUS_MET
        event.occurred_at = now
        details = dict(event.details or {})
        details["source"] = source
        if was_breached:
            due_at = event.due_at or now
            details["met_after_breach"] = True
            details["resolved_breach_minutes"] = max(
                0,
                int((now - due_at).total_seconds() // 60),
            )
        event.details = details
        db.add(event)
        changed = True

    if changed:
        _record_audit(
            db,
            action="sla.first_response_met",
            user_id=actor_user_id,
            details={
                "grievance_id": str(grievance.id),
                "source": source,
                "occurred_at": now.isoformat(),
            },
        )

    return changed


def mark_resolution_if_needed(
    db: Session,
    grievance: Grievance,
    *,
    actor_user_id: uuid.UUID,
    source: str,
    occurred_at: datetime | None = None,
) -> bool:
    now = occurred_at or _utcnow()
    changed = False

    if grievance.resolved_at is None:
        grievance.resolved_at = now
        db.add(grievance)
        changed = True

    event = _latest_trackable_deadline_event(
        db,
        grievance.id,
        SLA_EVENT_RESOLUTION_DEADLINE,
    )
    if event is not None:
        was_breached = event.status == SLA_STATUS_BREACHED
        event.status = SLA_STATUS_MET
        event.occurred_at = now
        details = dict(event.details or {})
        details["source"] = source
        if was_breached:
            due_at = event.due_at or now
            details["met_after_breach"] = True
            details["resolved_breach_minutes"] = max(
                0,
                int((now - due_at).total_seconds() // 60),
            )
        event.details = details
        db.add(event)
        changed = True

    if changed:
        _record_audit(
            db,
            action="sla.resolution_met",
            user_id=actor_user_id,
            details={
                "grievance_id": str(grievance.id),
                "source": source,
                "occurred_at": now.isoformat(),
            },
        )

    return changed


def evaluate_due_sla_breaches(
    db: Session,
    *,
    evaluated_at: datetime | None = None,
) -> list[SLAEvent]:
    now = evaluated_at or _utcnow()

    due_events = list(
        db.scalars(
            select(SLAEvent).where(
                SLAEvent.status == SLA_STATUS_PENDING,
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
                SLAEvent.due_at.is_not(None),
                SLAEvent.due_at <= now,
            )
        )
    )

    for event in due_events:
        event.status = SLA_STATUS_BREACHED
        event.occurred_at = now
        due_at = event.due_at or now
        breach_minutes = max(0, int((now - due_at).total_seconds() // 60))
        details = dict(event.details or {})
        details["breach_minutes"] = breach_minutes
        event.details = details
        db.add(event)

        _record_audit(
            db,
            action="sla.breached",
            user_id=None,
            details={
                "grievance_id": str(event.grievance_id),
                "sla_event_id": str(event.id),
                "event_type": event.event_type,
                "breach_minutes": breach_minutes,
            },
        )

    return due_events


def list_active_breaches(db: Session) -> list[SLABreachSummary]:
    now = _utcnow()
    active_grievances = list(
        db.scalars(
            select(Grievance)
            .options(
                selectinload(Grievance.student),
                selectinload(Grievance.assigned_to_user),
                selectinload(Grievance.department),
            )
            .where(
                Grievance.status.in_([GRIEVANCE_STATUS_OPEN, GRIEVANCE_STATUS_IN_PROGRESS])
            )
            .order_by(Grievance.created_at.asc())
        )
    )
    grievance_ids = [grievance.id for grievance in active_grievances]
    snapshot = get_latest_deadline_events_for_grievances(db, grievance_ids)

    active_breach_events: list[tuple[Grievance, SLAEvent, str]] = []
    active_breach_event_ids: list[uuid.UUID] = []

    for grievance in active_grievances:
        grievance_events = snapshot.get(grievance.id, {})
        for event_type, breach_type in (
            (SLA_EVENT_FIRST_RESPONSE_DEADLINE, "first_response"),
            (SLA_EVENT_RESOLUTION_DEADLINE, "resolution"),
        ):
            event = grievance_events.get(event_type)
            if event is None or event.status != SLA_STATUS_BREACHED:
                continue
            active_breach_events.append((grievance, event, breach_type))
            active_breach_event_ids.append(event.id)

    escalation_count_by_parent: dict[uuid.UUID, int] = {}
    if active_breach_event_ids:
        rows = db.execute(
            select(SLAEvent.parent_event_id, func.count())
            .where(
                SLAEvent.parent_event_id.in_(active_breach_event_ids),
                SLAEvent.event_type == SLA_EVENT_ESCALATION,
                SLAEvent.status == SLA_STATUS_TRIGGERED,
            )
            .group_by(SLAEvent.parent_event_id)
        ).all()
        escalation_count_by_parent = {
            row[0]: row[1]
            for row in rows
            if row[0] is not None
        }

    summaries: list[SLABreachSummary] = []
    for grievance, event, breach_type in active_breach_events:
        due_at = event.due_at or event.created_at
        breach_minutes = max(0, int((now - due_at).total_seconds() // 60))

        summaries.append(
            SLABreachSummary(
                event_id=event.id,
                grievance_id=event.grievance_id,
                grievance_title=grievance.title,
                grievance_status=grievance.status,
                department_id=event.department_id,
                breach_type=breach_type,
                due_at=due_at,
                occurred_at=event.occurred_at,
                breach_minutes=breach_minutes,
                escalation_count=escalation_count_by_parent.get(event.id, 0),
                student=grievance.student,
                assigned_to_user=grievance.assigned_to_user,
                department=grievance.department,
            )
        )

    summaries.sort(
        key=lambda item: (
            -item.breach_minutes,
            item.due_at,
            item.grievance_title.lower(),
        )
    )
    return summaries


def get_latest_deadline_events_for_grievances(
    db: Session,
    grievance_ids: Iterable[uuid.UUID],
) -> dict[uuid.UUID, dict[str, SLAEvent]]:
    grievance_ids_list = list(grievance_ids)
    if not grievance_ids_list:
        return {}

    events = list(
        db.scalars(
            select(SLAEvent)
            .where(
                SLAEvent.grievance_id.in_(grievance_ids_list),
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                        SLA_EVENT_ESCALATION,
                    ]
                ),
            )
            .order_by(SLAEvent.created_at.desc())
        )
    )

    snapshot: dict[uuid.UUID, dict[str, SLAEvent]] = {}
    for event in events:
        grievance_bucket = snapshot.setdefault(event.grievance_id, {})
        key = event.event_type
        if key not in grievance_bucket:
            grievance_bucket[key] = event

    return snapshot
