"""phase_9_warehouse

Per-tenant: warehouse_batches, movements, offcuts, deficits,
stock_items, stock_audit_entries.

Revision ID: fd0ecc1269df
Revises: f96e6fb2d5cf
Create Date: 2026-06-12 12:11:52.493148

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "fd0ecc1269df"
down_revision: Union[str, Sequence[str], None] = "f96e6fb2d5cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "warehouse_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("batch_number", sa.String(100), nullable=False),
        sa.Column("lot_code", sa.String(100), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantity_remaining", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("total_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False, server_default="EUR"),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("certificate_ref", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="available"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("order_id", sa.String(100), nullable=True),
        sa.Column("file_ids", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "warehouse_movements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouse_batches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("unit_price", sa.Numeric(12, 4), nullable=True),
        sa.Column("total_cost", sa.Numeric(14, 2), nullable=True),
        sa.Column("reference_id", sa.String(100), nullable=True),
        sa.Column("reference_type", sa.String(50), nullable=True),
        sa.Column("from_location", sa.Text(), nullable=True),
        sa.Column("to_location", sa.Text(), nullable=True),
        sa.Column("performed_by", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("moved_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "warehouse_offcuts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouse_batches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("parent_batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouse_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("offcut_type", sa.String(20), nullable=True),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="available"),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "warehouse_deficits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouse_batches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("current_stock", sa.Numeric(12, 2), nullable=False),
        sa.Column("min_required", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="critical"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "stock_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("total_quantity", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "stock_audit_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("warehouse_batches.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_name_ru", sa.String(255), nullable=False),
        sa.Column("user_name_en", sa.String(255), nullable=False),
        sa.Column("user_name_lt", sa.String(255), nullable=False),
        sa.Column("user_initials", sa.String(10), nullable=False),
        sa.Column("property_ru", sa.String(255), nullable=False),
        sa.Column("property_en", sa.String(255), nullable=False),
        sa.Column("property_lt", sa.String(255), nullable=False),
        sa.Column("old_value", sa.Text(), nullable=False),
        sa.Column("new_value", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("stock_audit_entries")
    op.drop_table("stock_items")
    op.drop_table("warehouse_deficits")
    op.drop_table("warehouse_offcuts")
    op.drop_table("warehouse_movements")
    op.drop_table("warehouse_batches")
