"""finance_derived_and_author

Three changes to the finance domain schema, all owner decisions already made:

1. `FinancePayment.document_count` — dropped (П68). The number of attached
   documents is counted as related rows at read time; a stored value goes
   stale silently.
2. `DocumentArchiveItem.uploaded_by` (`String(255)`) — replaced by
   `uploaded_by_user_id` (FK on `users.id`, `nullable=True`,
   `ondelete="SET NULL"`) plus `uploaded_by_name` (frozen display-name
   snapshot), the same author shape already used by
   `StockAuditEntry.user_id` / naming in
   `backend/app/modules/warehouse/shared/models.py` (П36). Existing values
   move into `uploaded_by_name`; no user is resolved for historical rows.
3. `FinancePayment.currency` — both `default="EUR"` and `server_default="EUR"`
   dropped. The default belongs to the slice that creates the record, not to
   the column; the column stays `NOT NULL` and existing rows are untouched.

Revision ID: e5b2f47c9a10
Revises: c1a7d9e4f2b3
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e5b2f47c9a10"
down_revision: Union[str, Sequence[str], None] = "c1a7d9e4f2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. derived, nothing writes it (П68) ──
    op.drop_column("finance_payments", "document_count")

    # ── 2. author — reference plus frozen name snapshot (П36) ──
    op.add_column(
        "document_archive_items",
        sa.Column(
            "uploaded_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "document_archive_items",
        sa.Column("uploaded_by_name", sa.String(255), nullable=True),
    )
    op.execute(
        "UPDATE document_archive_items SET uploaded_by_name = uploaded_by"
    )
    op.alter_column(
        "document_archive_items",
        "uploaded_by_name",
        existing_type=sa.String(255),
        nullable=False,
    )
    op.drop_column("document_archive_items", "uploaded_by")

    # ── 3. currency default belongs to the creating slice, not the column ──
    op.alter_column(
        "finance_payments",
        "currency",
        existing_type=sa.String(10),
        server_default=None,
    )


def downgrade() -> None:
    # ── 3. restore the column default ──
    op.alter_column(
        "finance_payments",
        "currency",
        existing_type=sa.String(10),
        server_default="EUR",
    )

    # ── 2. restore uploaded_by, carrying values back ──
    op.add_column(
        "document_archive_items",
        sa.Column("uploaded_by", sa.String(255), nullable=True),
    )
    op.execute(
        "UPDATE document_archive_items SET uploaded_by = uploaded_by_name"
    )
    op.alter_column(
        "document_archive_items",
        "uploaded_by",
        existing_type=sa.String(255),
        nullable=False,
    )
    op.drop_column("document_archive_items", "uploaded_by_name")
    op.drop_column("document_archive_items", "uploaded_by_user_id")

    # ── 1. restore the derived column ──
    op.add_column(
        "finance_payments",
        sa.Column("document_count", sa.Integer(), nullable=False, server_default="0"),
    )
