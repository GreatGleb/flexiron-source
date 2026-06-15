"""add_vat_code_to_tenant

Revision ID: 64f1eca13a01
Revises: 8cf3bfa380dd
Create Date: 2026-06-13 13:32:10.880354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '64f1eca13a01'
down_revision: Union[str, Sequence[str], None] = '8cf3bfa380dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add vat_code column to tenants table."""
    op.add_column(
        "tenants",
        sa.Column("vat_code", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    """Remove vat_code column from tenants table."""
    op.drop_column("tenants", "vat_code")
