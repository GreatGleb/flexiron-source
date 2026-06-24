"""phase_14_add_currency_uom_fk_to_products

Add currency_id (FK → currencies.id) and uom_id (FK → uoms.id)
to the products table, replacing the string price_unit field.

Revision ID: bbd27a3881a5
Revises: 7bf1730620f0
Create Date: 2026-06-15 13:29:29.065089

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'bbd27a3881a5'
down_revision: Union[str, Sequence[str], None] = '4e8c9a3f1b2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add currency_id FK to products
    op.add_column(
        "products",
        sa.Column(
            "currency_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("currencies.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    # Add uom_id FK to products
    op.add_column(
        "products",
        sa.Column(
            "uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "uom_id")
    op.drop_column("products", "currency_id")
