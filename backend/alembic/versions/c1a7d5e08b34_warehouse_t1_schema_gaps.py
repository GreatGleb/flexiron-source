"""warehouse_t1_schema_gaps

T1 of the warehouse domain plan — closes four schema gaps that
`contract-sync-warehouse-bugs.md` names as blocking the first server slice:

1. БАГ-17 — `WarehouseOffcut` gets dimensions, weight, category, QR data and an
   order reference. Column type follows the frontend field type: numbers become
   `Numeric`, a product/category identifier becomes a foreign key with
   `ondelete="SET NULL"`, a free string stays `String`/`Text`. All nullable —
   existing rows have none of these values.
2. БАГ-23 — `WarehouseMovement.offcut_id` — a nullable foreign key to
   `warehouse_offcuts.id` with `ondelete="SET NULL"`: the marker of "this
   movement moves a piece, not a batch".
3. БАГ-25 — `WarehouseDeficit.status` no longer defaults to a value from the
   priority enum (`"critical"`); its default becomes `"open"`, the value
   records are created with today. `priority`, `suggested_order_qty` and
   `purchase_order_id` are added.
4. БАГ-28 — `StockItem` uniqueness moves from a single `unique=True` column to
   a composite `UniqueConstraint("tenant_id", "product_id")`, matching the
   sibling pattern in `suppliers`/`billing`.

Revision ID: c1a7d5e08b34
Revises: e5b2f47c9a10
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c1a7d5e08b34"
down_revision: Union[str, Sequence[str], None] = "e5b2f47c9a10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── БАГ-17: WarehouseOffcut — dimensions, weight, category, QR, order ──
    op.add_column(
        "warehouse_offcuts",
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "warehouse_offcuts_category_id_fkey",
        "warehouse_offcuts",
        "categories",
        ["category_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "warehouse_offcuts",
        sa.Column("length_mm", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "warehouse_offcuts",
        sa.Column("width_mm", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "warehouse_offcuts",
        sa.Column("thickness_mm", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "warehouse_offcuts",
        sa.Column("weight_kg", sa.Numeric(12, 2), nullable=True),
    )
    op.add_column(
        "warehouse_offcuts",
        sa.Column("qr_data", sa.Text(), nullable=True),
    )
    op.add_column(
        "warehouse_offcuts",
        sa.Column("order_id", sa.String(100), nullable=True),
    )

    # БАГ-23 (offcut_id у движения) и БАГ-25 (статус, приоритет, предлагаемое
    # количество, заказ у дефицита) здесь НЕ повторяются: их закрыла принятая
    # ревизия `b5e2f7a31c40_warehouse_deficit_and_offcut_link.py`. Второй
    # `add_column` на ту же колонку упал бы на применении.

    # ── БАГ-28: StockItem uniqueness — per-tenant, not global ──
    # Уникальность `product_id` объявлена в модели как `unique=True, index=True`, то
    # есть в базе это УНИКАЛЬНЫЙ ИНДЕКС `ix_stock_items_product_id`, а не ограничение:
    # `drop_constraint` на него отвечает UndefinedObjectError. Индекс пересоздаётся
    # обычным — колонка остаётся индексированной, перестаёт быть глобально уникальной.
    op.drop_index("ix_stock_items_product_id", table_name="stock_items")
    op.create_index("ix_stock_items_product_id", "stock_items", ["product_id"])
    op.create_unique_constraint(
        "uq_stock_items_tenant_product",
        "stock_items",
        ["tenant_id", "product_id"],
    )


def downgrade() -> None:
    # ── БАГ-28 ──
    op.drop_constraint(
        "uq_stock_items_tenant_product", "stock_items", type_="unique"
    )
    op.drop_index("ix_stock_items_product_id", table_name="stock_items")
    op.create_index("ix_stock_items_product_id", "stock_items", ["product_id"], unique=True)

    # ── БАГ-17 ──
    op.drop_column("warehouse_offcuts", "order_id")
    op.drop_column("warehouse_offcuts", "qr_data")
    op.drop_column("warehouse_offcuts", "weight_kg")
    op.drop_column("warehouse_offcuts", "thickness_mm")
    op.drop_column("warehouse_offcuts", "width_mm")
    op.drop_column("warehouse_offcuts", "length_mm")
    op.drop_constraint(
        "warehouse_offcuts_category_id_fkey", "warehouse_offcuts", type_="foreignkey"
    )
    op.drop_column("warehouse_offcuts", "category_id")
