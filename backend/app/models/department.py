import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.escalation_rule import EscalationRule
    from app.models.grievance import Grievance
    from app.models.grievance_assignment import GrievanceAssignment
    from app.models.sla_event import SLAEvent
    from app.models.sla_policy import SLAPolicy


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    grievances: Mapped[list["Grievance"]] = relationship(
        back_populates="department",
        lazy="selectin",
    )
    grievance_assignments: Mapped[list["GrievanceAssignment"]] = relationship(
        back_populates="department",
        lazy="selectin",
    )
    sla_policies: Mapped[list["SLAPolicy"]] = relationship(
        back_populates="department",
        lazy="selectin",
    )
    escalation_rules: Mapped[list["EscalationRule"]] = relationship(
        back_populates="department",
        lazy="selectin",
    )
    sla_events: Mapped[list["SLAEvent"]] = relationship(
        back_populates="department",
        lazy="selectin",
    )
