"""phase_2_settings

Per-tenant settings: company_info, global_constants, currencies,
uoms, uom_conversions, order_statuses.

Revision ID: 57ba67dda78c
Revises: 3a0b5d31bde7
Create Date: 2026-06-11 22:49:28.367149

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "57ba67dda78c"
down_revision: Union[str, Sequence[str], None] = "3a0b5d31bde7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── company_info (singleton per tenant) ──
    op.create_table(
        "company_info",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("legal_address", sa.Text(), nullable=True),
        sa.Column("vat_code", sa.String(50), nullable=True),
        sa.Column("bank_name", sa.String(255), nullable=True),
        sa.Column("bank_account", sa.String(100), nullable=True),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── global_constants (singleton per tenant) ──
    op.create_table(
        "global_constants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("vat_rate", sa.Numeric(5, 2), nullable=False, server_default="21"),
        sa.Column("default_margin", sa.Numeric(5, 2), nullable=False, server_default="15"),
        sa.Column("default_currency", sa.String(10), nullable=False, server_default="EUR"),
        sa.Column("default_discount_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── currencies ──
    op.create_table(
        "currencies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("name_ru", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("name_lt", sa.String(100), nullable=False),
        sa.Column("exchange_rate", sa.Numeric(12, 6), nullable=False, server_default="1"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_currencies_tenant_code", "currencies", ["tenant_id", "code"], unique=True)

    # ── uoms ──
    op.create_table(
        "uoms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("code_ru", sa.String(20), nullable=False),
        sa.Column("code_en", sa.String(20), nullable=False),
        sa.Column("code_lt", sa.String(20), nullable=False),
        sa.Column("name_ru", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("name_lt", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── uom_conversions ──
    op.create_table(
        "uom_conversions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("from_uom_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("uoms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_uom_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("uoms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("factor", sa.Numeric(20, 10), nullable=True),
        sa.Column("formula_type", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── order_statuses ──
    op.create_table(
        "order_statuses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name_ru", sa.String(100), nullable=False),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("name_lt", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("reserve_on_transition", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("write_off_on_transition", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("order_statuses")
    op.drop_table("uom_conversions")
    op.drop_table("uoms")
    op.drop_table("currencies")
    op.drop_table("global_constants")
    op.drop_table("company_info")
