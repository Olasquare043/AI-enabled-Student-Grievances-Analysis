"""add routing sla escalation schema

Revision ID: 20260301_0004
Revises: 20260301_0003
Create Date: 2026-03-01 18:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260301_0004"
down_revision: Union[str, None] = "20260301_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_departments_id"), "departments", ["id"], unique=False)
    op.create_index(op.f("ix_departments_name"), "departments", ["name"], unique=True)
    op.create_index(op.f("ix_departments_code"), "departments", ["code"], unique=True)

    op.add_column("grievances", sa.Column("department_id", sa.Integer(), nullable=True))
    op.add_column(
        "grievances",
        sa.Column("first_response_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "grievances",
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_grievances_department_id"),
        "grievances",
        ["department_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_grievances_department_id_departments",
        "grievances",
        "departments",
        ["department_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "grievance_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grievance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("assigned_to_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["assigned_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assigned_to_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["grievance_id"], ["grievances.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_grievance_assignments_grievance_id"),
        "grievance_assignments",
        ["grievance_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_assignments_department_id"),
        "grievance_assignments",
        ["department_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_assignments_assigned_to_user_id"),
        "grievance_assignments",
        ["assigned_to_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_grievance_assignments_assigned_by_user_id"),
        "grievance_assignments",
        ["assigned_by_user_id"],
        unique=False,
    )

    op.create_table(
        "sla_policies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("first_response_minutes", sa.Integer(), nullable=False),
        sa.Column("resolution_minutes", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.CheckConstraint("first_response_minutes > 0", name="ck_sla_policies_first_response_positive"),
        sa.CheckConstraint("resolution_minutes > 0", name="ck_sla_policies_resolution_positive"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("department_id"),
    )
    op.create_index(op.f("ix_sla_policies_id"), "sla_policies", ["id"], unique=False)
    op.create_index(
        op.f("ix_sla_policies_department_id"),
        "sla_policies",
        ["department_id"],
        unique=True,
    )

    op.create_table(
        "escalation_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("breach_type", sa.String(length=32), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column(
            "threshold_minutes",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column("target_role", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
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
        sa.CheckConstraint("threshold_minutes >= 0", name="ck_escalation_rules_threshold_non_negative"),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_escalation_rules_id"), "escalation_rules", ["id"], unique=False)
    op.create_index(
        op.f("ix_escalation_rules_department_id"),
        "escalation_rules",
        ["department_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_escalation_rules_breach_type"),
        "escalation_rules",
        ["breach_type"],
        unique=False,
    )

    op.create_table(
        "sla_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("grievance_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=True),
        sa.Column("policy_id", sa.Integer(), nullable=True),
        sa.Column("escalation_rule_id", sa.Integer(), nullable=True),
        sa.Column("parent_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["escalation_rule_id"], ["escalation_rules.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["grievance_id"], ["grievances.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_event_id"], ["sla_events.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["policy_id"], ["sla_policies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sla_events_grievance_id"), "sla_events", ["grievance_id"], unique=False)
    op.create_index(op.f("ix_sla_events_department_id"), "sla_events", ["department_id"], unique=False)
    op.create_index(op.f("ix_sla_events_policy_id"), "sla_events", ["policy_id"], unique=False)
    op.create_index(
        op.f("ix_sla_events_escalation_rule_id"),
        "sla_events",
        ["escalation_rule_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_sla_events_parent_event_id"),
        "sla_events",
        ["parent_event_id"],
        unique=False,
    )
    op.create_index(op.f("ix_sla_events_event_type"), "sla_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_sla_events_status"), "sla_events", ["status"], unique=False)
    op.create_index(op.f("ix_sla_events_due_at"), "sla_events", ["due_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sla_events_due_at"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_status"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_event_type"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_parent_event_id"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_escalation_rule_id"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_policy_id"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_department_id"), table_name="sla_events")
    op.drop_index(op.f("ix_sla_events_grievance_id"), table_name="sla_events")
    op.drop_table("sla_events")

    op.drop_index(op.f("ix_escalation_rules_breach_type"), table_name="escalation_rules")
    op.drop_index(op.f("ix_escalation_rules_department_id"), table_name="escalation_rules")
    op.drop_index(op.f("ix_escalation_rules_id"), table_name="escalation_rules")
    op.drop_table("escalation_rules")

    op.drop_index(op.f("ix_sla_policies_department_id"), table_name="sla_policies")
    op.drop_index(op.f("ix_sla_policies_id"), table_name="sla_policies")
    op.drop_table("sla_policies")

    op.drop_index(op.f("ix_grievance_assignments_assigned_by_user_id"), table_name="grievance_assignments")
    op.drop_index(op.f("ix_grievance_assignments_assigned_to_user_id"), table_name="grievance_assignments")
    op.drop_index(op.f("ix_grievance_assignments_department_id"), table_name="grievance_assignments")
    op.drop_index(op.f("ix_grievance_assignments_grievance_id"), table_name="grievance_assignments")
    op.drop_table("grievance_assignments")

    op.drop_constraint("fk_grievances_department_id_departments", "grievances", type_="foreignkey")
    op.drop_index(op.f("ix_grievances_department_id"), table_name="grievances")
    op.drop_column("grievances", "resolved_at")
    op.drop_column("grievances", "first_response_at")
    op.drop_column("grievances", "department_id")

    op.drop_index(op.f("ix_departments_code"), table_name="departments")
    op.drop_index(op.f("ix_departments_name"), table_name="departments")
    op.drop_index(op.f("ix_departments_id"), table_name="departments")
    op.drop_table("departments")
