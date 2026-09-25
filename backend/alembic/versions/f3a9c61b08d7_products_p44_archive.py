"""products_p44_archive

Add `archived_at` (nullable timestamp) to `products` — the P44 soft-delete:
a product is archived, not removed, so old orders keep reading it. There is
no separate boolean; the timestamp itself is the archive flag (§17 of the
API conventions, "derived values").

Revision ID: f3a9c61b08d7
Revises: b8f3d0c62a71
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3a9c61b08d7'
down_revision: Union[str, Sequence[str], None] = 'e7a3c81b04f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "archived_at")
