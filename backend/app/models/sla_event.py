import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.escalation_rule import EscalationRule
    from app.models.grievance import Grievance
    from app.models.sla_policy import SLAPolicy


class SLAEvent(Base):
    __tablename__ = "sla_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    policy_id: Mapped[int | None] = mapped_column(
        ForeignKey("sla_policies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    escalation_rule_id: Mapped[int | None] = mapped_column(
        ForeignKey("escalation_rules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    parent_event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sla_events.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    grievance: Mapped["Grievance"] = relationship(
        back_populates="sla_events",
        lazy="selectin",
    )
    department: Mapped["Department | None"] = relationship(
        back_populates="sla_events",
        lazy="selectin",
    )
    policy: Mapped["SLAPolicy | None"] = relationship(
        back_populates="sla_events",
        lazy="selectin",
    )
    escalation_rule: Mapped["EscalationRule | None"] = relationship(
        back_populates="sla_events",
        lazy="selectin",
    )
    parent_event: Mapped["SLAEvent | None"] = relationship(
        remote_side=[id],
        lazy="selectin",
    )
