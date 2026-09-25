"""clients_module_tables

Per-tenant: clients, client_interactions. Storage-only slice (С1 of the
clients domain plan) — no routes, no app/main.py changes.

Revision ID: d41c7a9b5e02
Revises: b8f3d0c62a71
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d41c7a9b5e02"
down_revision: Union[str, Sequence[str], None] = "b8f3d0c62a71"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── clients ──
    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("company_code", sa.String(64), nullable=False),
        sa.Column("vat_code", sa.String(64), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("phone", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("payment_terms_days", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Date(), nullable=False),
        sa.UniqueConstraint("tenant_id", "company_code", name="uq_clients_tenant_company_code"),
        sa.UniqueConstraint("tenant_id", "vat_code", name="uq_clients_tenant_vat_code"),
        sa.UniqueConstraint("tenant_id", "email", name="uq_clients_tenant_email"),
    )

    # ── client_interactions ──
    op.create_table(
        "client_interactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("type", sa.String(16), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_name", sa.String(255), nullable=False),
    )
    op.create_index(
        "ix_client_interactions_tenant_client",
        "client_interactions",
        ["tenant_id", "client_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_client_interactions_tenant_client", table_name="client_interactions")
    op.drop_table("client_interactions")
    op.drop_table("clients")
