import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.department import Department
    from app.models.grievance_comment import GrievanceComment
    from app.models.grievance_assignment import GrievanceAssignment
    from app.models.grievance_status_history import GrievanceStatusHistory
    from app.models.sla_event import SLAEvent
    from app.models.user import User

GRIEVANCE_STATUS_OPEN = "open"
GRIEVANCE_STATUS_IN_PROGRESS = "in_progress"
GRIEVANCE_STATUS_RESOLVED = "resolved"
GRIEVANCE_STATUS_CLOSED = "closed"
GRIEVANCE_STATUS_VALUES = (
    GRIEVANCE_STATUS_OPEN,
    GRIEVANCE_STATUS_IN_PROGRESS,
    GRIEVANCE_STATUS_RESOLVED,
    GRIEVANCE_STATUS_CLOSED,
)


class Grievance(Base):
    __tablename__ = "grievances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=GRIEVANCE_STATUS_OPEN, index=True
    )
    assigned_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    department_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("departments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_response_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    student: Mapped["User"] = relationship(
        "User",
        foreign_keys=[student_id],
        back_populates="submitted_grievances",
        lazy="selectin",
    )
    assigned_to_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_to_user_id],
        back_populates="assigned_grievances",
        lazy="selectin",
    )
    department: Mapped["Department | None"] = relationship(
        back_populates="grievances",
        lazy="selectin",
    )
    comments: Mapped[list["GrievanceComment"]] = relationship(
        back_populates="grievance",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="GrievanceComment.created_at",
    )
    status_history: Mapped[list["GrievanceStatusHistory"]] = relationship(
        back_populates="grievance",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="GrievanceStatusHistory.created_at",
    )
    assignments: Mapped[list["GrievanceAssignment"]] = relationship(
        back_populates="grievance",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="GrievanceAssignment.created_at",
    )
    sla_events: Mapped[list["SLAEvent"]] = relationship(
        back_populates="grievance",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="SLAEvent.created_at",
    )
