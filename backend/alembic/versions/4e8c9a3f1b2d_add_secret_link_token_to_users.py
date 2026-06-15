"""add_secret_link_token_to_users

Add secret_link_token column to users table for magic-link authentication.

Revision ID: 4e8c9a3f1b2d
Revises: 64f1eca13a01
Create Date: 2026-06-13 14:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4e8c9a3f1b2d"
down_revision: Union[str, Sequence[str], None] = "64f1eca13a01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "secret_link_token",
            sa.String(255),
            nullable=True,
            unique=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "secret_link_token")
