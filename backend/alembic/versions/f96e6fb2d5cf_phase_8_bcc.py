"""phase_8_bcc

Per-tenant: bcc_categories (tree), bcc_events (event-sourcing).

Revision ID: f96e6fb2d5cf
Revises: e24a3922ed01
Create Date: 2026-06-12 12:08:50.911702

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f96e6fb2d5cf"
down_revision: Union[str, Sequence[str], None] = "e24a3922ed01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "bcc_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name_translations", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bcc_categories.id", ondelete="RESTRICT"), nullable=True, index=True),
        sa.Column("product_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "bcc_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("request_id", sa.String(50), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("unit", sa.String(20), nullable=True),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("attachment_file_ids", postgresql.JSON(), nullable=True),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("bcc_events")
    op.drop_table("bcc_categories")
