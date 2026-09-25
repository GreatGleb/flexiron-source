"""suppliers_t1_derived_and_types

T1 of the suppliers domain plan — schema migration: derived columns and types.

Four changes, all pre-existing readers, none pre-existing writers:

1. `Supplier.has_deficit` / `Supplier.last_bcc_date` — dropped. Both are derived
   at read time and nothing writes them today (П68).
2. `SupplierContact.position` (`String(255)`) → `position_translations`
   (`JSONB`) — translatability is a cross-cutting rule, and the sibling column
   `name_translations` on the same table is already JSONB.
3. `SupplierPriceEntry.price` — `NOT NULL` dropped. A row for an unanswered
   price request has no price to store.
4. `Supplier.categories` / `tags` / `bcc_emails` — `JSON` → `JSONB` plus a GIN
   index each: Postgres has neither containment operators nor GIN support for
   plain `JSON`, and category filtering without them is a sequential scan.

Revision ID: b8f3d0c62a71
Revises: c9e4a1f70b23
Create Date: 2026-09-24 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "b8f3d0c62a71"
down_revision: Union[str, Sequence[str], None] = "c9e4a1f70b23"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. derived columns, nothing writes them ──
    op.drop_column("suppliers", "has_deficit")
    op.drop_column("suppliers", "last_bcc_date")

    # ── 2. translatable contact position ──
    op.add_column(
        "supplier_contacts",
        sa.Column(
            "position_translations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
    )
    op.drop_column("supplier_contacts", "position")

    # ── 3. unanswered price request has no price ──
    op.alter_column(
        "supplier_price_entries",
        "price",
        existing_type=sa.Numeric(12, 2),
        nullable=True,
    )

    # ── 4. JSON → JSONB + GIN, categories/tags/bcc_emails ──
    op.alter_column(
        "suppliers",
        "categories",
        existing_type=postgresql.JSON(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="categories::jsonb",
        nullable=False,
    )
    op.alter_column(
        "suppliers",
        "tags",
        existing_type=postgresql.JSON(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="tags::jsonb",
        nullable=False,
    )
    op.alter_column(
        "suppliers",
        "bcc_emails",
        existing_type=postgresql.JSON(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="bcc_emails::jsonb",
        nullable=False,
    )
    op.create_index(
        "ix_suppliers_categories_gin", "suppliers", ["categories"], postgresql_using="gin"
    )
    op.create_index(
        "ix_suppliers_tags_gin", "suppliers", ["tags"], postgresql_using="gin"
    )
    op.create_index(
        "ix_suppliers_bcc_emails_gin", "suppliers", ["bcc_emails"], postgresql_using="gin"
    )


def downgrade() -> None:
    op.drop_index("ix_suppliers_bcc_emails_gin", table_name="suppliers")
    op.drop_index("ix_suppliers_tags_gin", table_name="suppliers")
    op.drop_index("ix_suppliers_categories_gin", table_name="suppliers")

    op.alter_column(
        "suppliers",
        "bcc_emails",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=postgresql.JSON(),
        postgresql_using="bcc_emails::json",
        nullable=False,
    )
    op.alter_column(
        "suppliers",
        "tags",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=postgresql.JSON(),
        postgresql_using="tags::json",
        nullable=False,
    )
    op.alter_column(
        "suppliers",
        "categories",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=postgresql.JSON(),
        postgresql_using="categories::json",
        nullable=False,
    )

    op.alter_column(
        "supplier_price_entries",
        "price",
        existing_type=sa.Numeric(12, 2),
        nullable=False,
    )

    op.add_column(
        "supplier_contacts",
        sa.Column("position", sa.String(255), nullable=True),
    )
    op.drop_column("supplier_contacts", "position_translations")

    op.add_column(
        "suppliers",
        sa.Column(
            "has_deficit", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "suppliers",
        sa.Column("last_bcc_date", sa.Date(), nullable=True),
    )
