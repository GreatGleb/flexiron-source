"""phase_15_product_uom_restructure

Replace single uom_id with 3 separate UoM fields (purchase, warehouse, sale),
add price_quantity, add conversion fields, add batch audit trail columns.

Revision ID: a1b2c3d4e5f6
Revises: bbd27a3881a5
Create Date: 2026-06-16 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'bbd27a3881a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ═══════════════════════════════════════════════════════════════
    # Product table changes
    # ═══════════════════════════════════════════════════════════════

    # 1. Add new columns
    op.add_column(
        "products",
        sa.Column("price_quantity", sa.Integer(), nullable=False, server_default="1"),
    )

    op.add_column(
        "products",
        sa.Column(
            "purchase_uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "warehouse_uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "sale_uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="RESTRICT"),
            nullable=True,
            index=True,
        ),
    )

    op.add_column(
        "products",
        sa.Column("purchase_to_warehouse_formula_type", sa.String(30), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("purchase_to_warehouse_factor", sa.Numeric(20, 6), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("warehouse_to_sale_formula_type", sa.String(30), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("warehouse_to_sale_factor", sa.Numeric(20, 6), nullable=True),
    )

    # 2. Backfill: copy uom_id → all three UoM columns
    op.execute(
        """
        UPDATE products
        SET purchase_uom_id = uom_id,
            warehouse_uom_id = uom_id,
            sale_uom_id = uom_id
        WHERE uom_id IS NOT NULL
        """
    )

    # 3. Drop old uom_id column
    op.drop_column("products", "uom_id")

    # 4. Drop legacy price_unit string column
    op.drop_column("products", "price_unit")

    # ═══════════════════════════════════════════════════════════════
    # Warehouse batches table — add audit trail columns
    # ═══════════════════════════════════════════════════════════════

    op.add_column(
        "warehouse_batches",
        sa.Column("received_quantity", sa.Numeric(14, 4), nullable=True),
    )
    op.add_column(
        "warehouse_batches",
        sa.Column(
            "received_uom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("uoms.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "warehouse_batches",
        sa.Column("received_unit_price", sa.Numeric(14, 6), nullable=True),
    )
    op.add_column(
        "warehouse_batches",
        sa.Column(
            "received_currency_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("currencies.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "warehouse_batches",
        sa.Column("purchase_to_warehouse_rate", sa.Numeric(20, 6), nullable=True),
    )
    op.add_column(
        "warehouse_batches",
        sa.Column("exchange_rate", sa.Numeric(14, 6), nullable=True),
    )


def downgrade() -> None:
    # ── Warehouse batches ──
    op.drop_column("warehouse_batches", "exchange_rate")
    op.drop_column("warehouse_batches", "purchase_to_warehouse_rate")
    op.drop_column("warehouse_batches", "received_currency_id")
    op.drop_column("warehouse_batches", "received_unit_price")
    op.drop_column("warehouse_batches", "received_uom_id")
    op.drop_column("warehouse_batches", "received_quantity")

    # ── Products ──
    # Re-add legacy columns
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
    op.add_column(
        "products",
        sa.Column("price_unit", sa.String(50), nullable=True),
    )

    # Backfill: copy sale_uom_id → uom_id (best guess)
    op.execute(
        """
        UPDATE products
        SET uom_id = sale_uom_id
        WHERE sale_uom_id IS NOT NULL
        """
    )

    # Drop new columns
    op.drop_column("products", "warehouse_to_sale_factor")
    op.drop_column("products", "warehouse_to_sale_formula_type")
    op.drop_column("products", "purchase_to_warehouse_factor")
    op.drop_column("products", "purchase_to_warehouse_formula_type")
    op.drop_column("products", "sale_uom_id")
    op.drop_column("products", "warehouse_uom_id")
    op.drop_column("products", "purchase_uom_id")
    op.drop_column("products", "price_quantity")
