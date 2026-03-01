"""add user profile fields

Revision ID: 20260301_0002
Revises: 20260227_0001
Create Date: 2026-03-01 13:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20260301_0002"
down_revision: Union[str, None] = "20260227_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("matric_number", sa.String(length=50), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("faculty", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("level", sa.String(length=32), nullable=True))
    op.create_index(
        op.f("ix_users_matric_number"),
        "users",
        ["matric_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_matric_number"), table_name="users")
    op.drop_column("users", "level")
    op.drop_column("users", "department")
    op.drop_column("users", "faculty")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "matric_number")
    op.drop_column("users", "last_name")
    op.drop_column("users", "first_name")

