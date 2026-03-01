from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.escalation_rule import EscalationRule
from app.models.sla_event import SLAEvent
from app.schemas.sla import EscalationRuleCreateRequest
from app.services.sla_service import (
    SLA_EVENT_ESCALATION,
    SLA_EVENT_FIRST_RESPONSE_DEADLINE,
    SLA_EVENT_RESOLUTION_DEADLINE,
    SLA_STATUS_BREACHED,
    SLA_STATUS_TRIGGERED,
)

DEFAULT_ESCALATION_RULES: tuple[dict[str, object], ...] = (
    {
        "department_id": None,
        "breach_type": "first_response",
        "severity": "warning",
        "threshold_minutes": 0,
        "target_role": "staff",
        "is_active": True,
    },
    {
        "department_id": None,
        "breach_type": "resolution",
        "severity": "critical",
        "threshold_minutes": 0,
        "target_role": "admin",
        "is_active": True,
    },
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _record_audit(
    db: Session,
    *,
    action: str,
    details: dict[str, object],
) -> None:
    db.add(AuditLog(user_id=None, action=action, details=details))


def list_escalation_rules(db: Session) -> list[EscalationRule]:
    stmt = (
        select(EscalationRule)
        .options(selectinload(EscalationRule.department))
        .order_by(EscalationRule.department_id.asc().nullsfirst(), EscalationRule.id.asc())
    )
    return list(db.scalars(stmt))


def create_escalation_rule(
    db: Session,
    payload: EscalationRuleCreateRequest,
) -> EscalationRule:
    if payload.department_id is not None:
        department = db.get(Department, payload.department_id)
        if department is None:
            raise ValueError("Department not found")

    rule = EscalationRule(
        department_id=payload.department_id,
        breach_type=payload.breach_type,
        severity=payload.severity,
        threshold_minutes=payload.threshold_minutes,
        target_role=payload.target_role,
        is_active=payload.is_active,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def seed_default_escalation_rules(db: Session) -> None:
    existing_rules = list(db.scalars(select(EscalationRule)).all())
    if existing_rules:
        return

    for item in DEFAULT_ESCALATION_RULES:
        db.add(EscalationRule(**item))
    db.commit()


def _map_breach_type(event_type: str) -> str:
    if event_type == SLA_EVENT_FIRST_RESPONSE_DEADLINE:
        return "first_response"
    return "resolution"


def evaluate_escalations(
    db: Session,
    *,
    evaluated_at: datetime | None = None,
) -> list[SLAEvent]:
    now = evaluated_at or _utcnow()

    breached_events = list(
        db.scalars(
            select(SLAEvent).where(
                SLAEvent.status == SLA_STATUS_BREACHED,
                SLAEvent.event_type.in_(
                    [
                        SLA_EVENT_FIRST_RESPONSE_DEADLINE,
                        SLA_EVENT_RESOLUTION_DEADLINE,
                    ]
                ),
            )
        )
    )

    active_rules = list(
        db.scalars(select(EscalationRule).where(EscalationRule.is_active.is_(True)))
    )

    created_escalations: list[SLAEvent] = []

    for breached_event in breached_events:
        breach_type = _map_breach_type(breached_event.event_type)
        due_at = breached_event.due_at or breached_event.created_at
        breach_minutes = max(0, int((now - due_at).total_seconds() // 60))

        matching_rules = [
            rule
            for rule in active_rules
            if rule.breach_type == breach_type
            and (rule.department_id is None or rule.department_id == breached_event.department_id)
            and breach_minutes >= rule.threshold_minutes
        ]

        for rule in matching_rules:
            existing = db.scalar(
                select(SLAEvent).where(
                    SLAEvent.parent_event_id == breached_event.id,
                    SLAEvent.event_type == SLA_EVENT_ESCALATION,
                    SLAEvent.escalation_rule_id == rule.id,
                    SLAEvent.status == SLA_STATUS_TRIGGERED,
                )
            )
            if existing is not None:
                continue

            escalation_event = SLAEvent(
                grievance_id=breached_event.grievance_id,
                department_id=breached_event.department_id,
                policy_id=breached_event.policy_id,
                escalation_rule_id=rule.id,
                parent_event_id=breached_event.id,
                event_type=SLA_EVENT_ESCALATION,
                status=SLA_STATUS_TRIGGERED,
                due_at=None,
                occurred_at=now,
                details={
                    "breach_type": breach_type,
                    "severity": rule.severity,
                    "target_role": rule.target_role,
                    "threshold_minutes": rule.threshold_minutes,
                    "breach_minutes": breach_minutes,
                },
            )
            db.add(escalation_event)
            created_escalations.append(escalation_event)

            _record_audit(
                db,
                action="sla.escalation_triggered",
                details={
                    "sla_event_id": str(breached_event.id),
                    "grievance_id": str(breached_event.grievance_id),
                    "escalation_rule_id": rule.id,
                    "severity": rule.severity,
                    "target_role": rule.target_role,
                    "breach_type": breach_type,
                    "breach_minutes": breach_minutes,
                },
            )

    return created_escalations
