"""add grievance mvp tables

Revision ID: 20260301_0003
Revises: 20260301_0002
Create Date: 2026-03-01 16:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260301_0003"
down_revision: Union[str, None] = "20260301_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


STATUS_CHECK = "status IN ('open', 'in_progress', 'resolved', 'closed')"


def upgrade() -> None:
    op.create_table(
        "grievances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default=sa.text("'open'"),
        ),
        sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(STATUS_CHECK, name="ck_grievances_status"),
        sa.ForeignKeyConstraint(["assigned_to_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_grievances_student_id"), "grievances", ["student_id"], unique=False)
    op.create_index(op.f("ix_grievances_category"), "grievances", ["category"], unique=False)
    op.create_index(op.f("ix_grievances_status"), "grievances", ["status"], unique=False)
    op.create_index(
        op.f("ix_grievances_assigned_to_user_id"),
        "grievances",
        ["assigned_to_user_id"],
        unique=False,
    )
    op.create_index(op.f("ix_grievances_created_at"), "grievances", ["created_at"], unique=False)

    op.create_table(
        "grievance_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grievance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["grievance_id"], ["grievances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_grievance_comments_grievance_id"),
        "grievance_comments",
        ["grievance_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_comments_user_id"),
        "grievance_comments",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_comments_created_at"),
        "grievance_comments",
        ["created_at"],
        unique=False,
    )

    op.create_table(
        "grievance_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grievance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("changed_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "to_status IN ('open', 'in_progress', 'resolved', 'closed')",
            name="ck_grievance_status_history_to_status",
        ),
        sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["grievance_id"], ["grievances.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_grievance_status_history_grievance_id"),
        "grievance_status_history",
        ["grievance_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_status_history_changed_by_user_id"),
        "grievance_status_history",
        ["changed_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_status_history_created_at"),
        "grievance_status_history",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_grievance_status_history_created_at"), table_name="grievance_status_history")
    op.drop_index(
        op.f("ix_grievance_status_history_changed_by_user_id"),
        table_name="grievance_status_history",
    )
    op.drop_index(op.f("ix_grievance_status_history_grievance_id"), table_name="grievance_status_history")
    op.drop_table("grievance_status_history")

    op.drop_index(op.f("ix_grievance_comments_created_at"), table_name="grievance_comments")
    op.drop_index(op.f("ix_grievance_comments_user_id"), table_name="grievance_comments")
    op.drop_index(op.f("ix_grievance_comments_grievance_id"), table_name="grievance_comments")
    op.drop_table("grievance_comments")

    op.drop_index(op.f("ix_grievances_created_at"), table_name="grievances")
    op.drop_index(op.f("ix_grievances_assigned_to_user_id"), table_name="grievances")
    op.drop_index(op.f("ix_grievances_status"), table_name="grievances")
    op.drop_index(op.f("ix_grievances_category"), table_name="grievances")
    op.drop_index(op.f("ix_grievances_student_id"), table_name="grievances")
    op.drop_table("grievances")
