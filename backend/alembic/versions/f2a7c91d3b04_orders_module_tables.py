"""orders_module_tables

Per-tenant: orders, order_items. Storage-only slice — no routes, no
app/main.py changes.

Revision ID: f2a7c91d3b04
Revises: b5e2f7a31c40
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f2a7c91d3b04"
down_revision: Union[str, Sequence[str], None] = "a9d3c81b6f24"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── orders ──
    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("order_number", sa.String(50), nullable=False),
        sa.Column("document_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("vat_mode", sa.String(20), nullable=False),
        sa.Column("vat_percent", sa.Numeric(9, 6), nullable=False),
        sa.Column("default_margin_percent", sa.Numeric(9, 6), nullable=False),
        sa.Column("default_discount_percent", sa.Numeric(9, 6), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("client_name", sa.String(255), nullable=False),
        sa.Column("client_vat_code", sa.String(64), nullable=False),
        sa.Column("client_address", sa.Text(), nullable=False),
        sa.Column("client_payment_terms_days", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "order_number", name="uq_orders_tenant_order_number"),
    )

    # ── order_items ──
    op.create_table(
        "order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("product_name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 4), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("unit_price", sa.Numeric(18, 10), nullable=False),
        sa.Column("manual_unit_price", sa.Numeric(18, 10), nullable=True),
        sa.Column("margin_percent", sa.Numeric(12, 6), nullable=False),
        sa.Column("discount_percent", sa.Numeric(12, 6), nullable=False),
        sa.Column("unit_cost", sa.Numeric(18, 10), nullable=False),
        sa.Column("cost_source", sa.String(16), nullable=False),
        sa.Column("allocations", postgresql.JSONB(), nullable=False),
        sa.Column("received_currency", sa.String(10), nullable=False),
        sa.Column("shipped_quantity", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("document_issued", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_table("order_items")
    op.drop_table("orders")
