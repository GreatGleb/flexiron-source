"""phase_6_suppliers

Per-tenant: suppliers, addresses, contacts, files, audit, prices.

Revision ID: a8dd7d7ba74b
Revises: 133fae13afbe
Create Date: 2026-06-11 23:16:37.703756

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a8dd7d7ba74b"
down_revision: Union[str, Sequence[str], None] = "133fae13afbe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── suppliers ──
    op.create_table(
        "suppliers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("company_ru", sa.String(255), nullable=False),
        sa.Column("company_en", sa.String(255), nullable=False),
        sa.Column("company_lt", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("contact_person_ru", sa.String(255), nullable=True),
        sa.Column("contact_person_en", sa.String(255), nullable=True),
        sa.Column("contact_person_lt", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="new"),
        sa.Column("categories", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("rating", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("tags", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("lead_time", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status_reason_ru", sa.String(500), nullable=True),
        sa.Column("status_reason_en", sa.String(500), nullable=True),
        sa.Column("status_reason_lt", sa.String(500), nullable=True),
        sa.Column("contract_date", sa.Date(), nullable=True),
        sa.Column("vat_code", sa.String(50), nullable=True),
        sa.Column("currency", sa.String(10), nullable=False, server_default="EUR"),
        sa.Column("payment_terms", sa.String(100), nullable=True),
        sa.Column("min_order", sa.Numeric(12, 2), nullable=True),
        sa.Column("bcc_emails", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("has_deficit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_bcc_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── supplier_addresses ──
    op.create_table(
        "supplier_addresses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("address_type", sa.String(50), nullable=False),
        sa.Column("line1", sa.String(255), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("zip", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── supplier_contacts ──
    op.create_table(
        "supplier_contacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("name_en", sa.String(255), nullable=False),
        sa.Column("name_lt", sa.String(255), nullable=False),
        sa.Column("position", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── supplier_files ──
    op.create_table(
        "supplier_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("uploaded_files.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name_ru", sa.String(255), nullable=False),
        sa.Column("name_en", sa.String(255), nullable=False),
        sa.Column("name_lt", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── supplier_audit_entries ──
    op.create_table(
        "supplier_audit_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
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

    # ── supplier_price_entries ──
    op.create_table(
        "supplier_price_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("supplier_price_entries")
    op.drop_table("supplier_audit_entries")
    op.drop_table("supplier_files")
    op.drop_table("supplier_contacts")
    op.drop_table("supplier_addresses")
    op.drop_table("suppliers")
