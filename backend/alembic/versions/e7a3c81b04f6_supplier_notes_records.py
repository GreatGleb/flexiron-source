"""supplier_notes_records

Owner decision П35: supplier internal notes become records, not one string.
Free text, unbounded count, each note carries its own author and timestamp.

Adds `supplier_notes` — `tenant_id`/`supplier_id` cascade with their parents,
`author_id` is a nullable set-null reference to `users.id` with an `author_name`
snapshot alongside it (the pattern `client_interactions` already uses for its
`user_id`/`user_name` pair), `text` free, `created_at` server-defaulted.

`Supplier.notes` (`Text`) is untouched here — its removal is a separate task.

Revision ID: e7a3c81b04f6
Revises: b4e7c02a91d3
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e7a3c81b04f6"
down_revision: Union[str, Sequence[str], None] = "d8b3f1c25a60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("author_name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(
        "ix_supplier_notes_tenant_supplier",
        "supplier_notes",
        ["tenant_id", "supplier_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_supplier_notes_tenant_supplier", table_name="supplier_notes")
    op.drop_table("supplier_notes")
