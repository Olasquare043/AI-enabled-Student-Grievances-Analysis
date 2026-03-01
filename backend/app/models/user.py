import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.role import user_roles

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.grievance import Grievance
    from app.models.grievance_comment import GrievanceComment
    from app.models.grievance_status_history import GrievanceStatusHistory
    from app.models.role import Role


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    matric_number: Mapped[str | None] = mapped_column(
        String(50), unique=True, nullable=True, index=True
    )
    phone_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    faculty: Mapped[str | None] = mapped_column(String(120), nullable=True)
    department: Mapped[str | None] = mapped_column(String(120), nullable=True)
    level: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    roles: Mapped[list["Role"]] = relationship(
        secondary=user_roles,
        back_populates="users",
        lazy="selectin",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    submitted_grievances: Mapped[list["Grievance"]] = relationship(
        "Grievance",
        back_populates="student",
        foreign_keys="Grievance.student_id",
        lazy="selectin",
    )
    assigned_grievances: Mapped[list["Grievance"]] = relationship(
        "Grievance",
        back_populates="assigned_to_user",
        foreign_keys="Grievance.assigned_to_user_id",
        lazy="selectin",
    )
    grievance_comments: Mapped[list["GrievanceComment"]] = relationship(
        "GrievanceComment",
        back_populates="user",
        lazy="selectin",
    )
    grievance_status_events: Mapped[list["GrievanceStatusHistory"]] = relationship(
        "GrievanceStatusHistory",
        back_populates="changed_by_user",
        lazy="selectin",
    )
