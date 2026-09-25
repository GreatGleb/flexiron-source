"""bcc_p75_drop_categories_p101_currency

П75 — the BCC tree has no table of its own: the tool reads the shared
categories/products catalog, and the leaf count is derived at read time.
`bcc_categories` and its stored `product_count` column are dropped.

П101 — an accepted price keeps the actual currency of the offer, and a later
change to a supplier's currency must not rewrite a historical price. `bcc_events`
gains `currency_id`, a nullable FK to `currencies.id`: a "sent"/"no_response" row
has no price, so it has no currency either.

Revision ID: e7b2c40d9f15
Revises: c1a7d5e08b34
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e7b2c40d9f15"
down_revision: Union[str, Sequence[str], None] = "c1a7d5e08b34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── П75: BCC tree is a projection of the shared catalog, no table of its own ──
    op.drop_table("bcc_categories")

    # ── П101: accepted price keeps the actual currency of the offer ──
    op.add_column(
        "bcc_events",
        sa.Column(
            "currency_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("currencies.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("bcc_events", "currency_id")

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
