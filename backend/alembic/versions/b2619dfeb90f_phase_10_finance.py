"""phase_10_finance

Per-tenant: finance_payments, payment_documents, document_archive_items.

Revision ID: b2619dfeb90f
Revises: fd0ecc1269df
Create Date: 2026-06-12 12:15:14.852355

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2619dfeb90f"
down_revision: Union[str, Sequence[str], None] = "fd0ecc1269df"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "finance_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("payment_number", sa.String(100), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="EUR"),
        sa.Column("counterparty_id", sa.String(100), nullable=True),
        sa.Column("counterparty_name", sa.String(255), nullable=False),
        sa.Column("counterparty_vat_code", sa.String(50), nullable=True),
        sa.Column("order_id", sa.String(100), nullable=True),
        sa.Column("order_number", sa.String(100), nullable=True),
        sa.Column("supplier_invoice_ref", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("document_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "payment_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("finance_payments.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("uploaded_files.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("mime", sa.String(100), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "document_archive_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("document_type", sa.String(50), nullable=False),
        sa.Column("file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("uploaded_files.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("mime", sa.String(100), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("related_entity_type", sa.String(50), nullable=True),
        sa.Column("related_entity_id", sa.String(100), nullable=True),
        sa.Column("related_entity_number", sa.String(100), nullable=True),
        sa.Column("uploaded_by", sa.String(255), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("document_archive_items")
    op.drop_table("payment_documents")
    op.drop_table("finance_payments")
