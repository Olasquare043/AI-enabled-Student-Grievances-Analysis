"""add AI triage fields to grievances

Revision ID: 20260927_0005
Revises: 20260301_0004
Create Date: 2026-09-27 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260927_0005"
down_revision: Union[str, None] = "20260301_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("grievances", sa.Column("predicted_category", sa.String(length=64), nullable=True))
    op.add_column("grievances", sa.Column("category_confidence", sa.Float(), nullable=True))
    op.add_column("grievances", sa.Column("sentiment_label", sa.String(length=16), nullable=True))
    op.add_column("grievances", sa.Column("sentiment_score", sa.Float(), nullable=True))
    op.add_column("grievances", sa.Column("urgency_label", sa.String(length=16), nullable=True))
    op.add_column("grievances", sa.Column("urgency_score", sa.Float(), nullable=True))
    op.add_column("grievances", sa.Column("priority", sa.String(length=4), nullable=True))
    op.add_column("grievances", sa.Column("topic_id", sa.Integer(), nullable=True))
    op.add_column(
        "grievances",
        sa.Column("ai_explanation", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "grievances",
        sa.Column("auto_routed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_grievances_priority", "grievances", ["priority"])
    op.create_index("ix_grievances_topic_id", "grievances", ["topic_id"])
    op.create_index("ix_grievances_predicted_category", "grievances", ["predicted_category"])

    # Every grievance category now has an owning department.
    op.execute(
        """
        INSERT INTO departments (code, name, is_active)
        VALUES ('ACADEMIC', 'Academic Affairs', true), ('WELFARE', 'Student Welfare', true)
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO sla_policies (department_id, first_response_minutes, resolution_minutes, is_active)
        SELECT d.id, v.first_response, v.resolution, true
        FROM departments d
        JOIN (VALUES ('ACADEMIC', 240, 7200), ('WELFARE', 120, 2880))
            AS v(code, first_response, resolution) ON v.code = d.code
        WHERE NOT EXISTS (SELECT 1 FROM sla_policies p WHERE p.department_id = d.id)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_grievances_predicted_category", table_name="grievances")
    op.drop_index("ix_grievances_topic_id", table_name="grievances")
    op.drop_index("ix_grievances_priority", table_name="grievances")
    for column in (
        "auto_routed",
        "ai_explanation",
        "topic_id",
        "priority",
        "urgency_score",
        "urgency_label",
        "sentiment_score",
        "sentiment_label",
        "category_confidence",
        "predicted_category",
    ):
        op.drop_column("grievances", column)
