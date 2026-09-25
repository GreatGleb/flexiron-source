"""permission_item_domain_and_defaults

П33 of the auth domain — schema for the permission-matrix default rule
(`00-conventions.md`, §6.4 «Хранение матрицы и дефолт нового элемента»).

Two changes, both pre-existing readers gaining a writer:

1. `permission_items.domain` — new `NOT NULL` column. The 90% rule's
   denominator is "elements of the same domain", and today there is nothing
   to group by: the matrix is built only from the supplier card's sections
   and fields, so every existing row backfills to `'suppliers'`.
2. `role_permissions.can_read` / `user_permissions.can_read` — `server_default`
   of `true` dropped. The contract's mock reference gives Admin all four
   actions and every other role none; a schema default of "true for
   everyone" was a schema/contract divergence, and the contract calls for
   the schema to move, not the contract.

Revision ID: d4c8a1f37b62
Revises: b8f3d0c62a71
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4c8a1f37b62"
down_revision: Union[str, Sequence[str], None] = 'f3a9c61b08d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. permission_items.domain — existing rows are all supplier-card items ──
    op.add_column(
        "permission_items",
        sa.Column("domain", sa.String(50), nullable=False, server_default="suppliers"),
    )
    op.alter_column(
        "permission_items",
        "domain",
        existing_type=sa.String(50),
        server_default=None,
    )

    # ── 2. can_read is no longer true by default ──
    op.alter_column(
        "role_permissions",
        "can_read",
        existing_type=sa.Boolean(),
        server_default=None,
    )
    op.alter_column(
        "user_permissions",
        "can_read",
        existing_type=sa.Boolean(),
        server_default=None,
    )


def downgrade() -> None:
    op.alter_column(
        "user_permissions",
        "can_read",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
    )
    op.alter_column(
        "role_permissions",
        "can_read",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
    )
    op.drop_column("permission_items", "domain")
