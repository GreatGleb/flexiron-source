"""enlarge_logo_url_to_text

Change logo_url column in company_info from VARCHAR(500) to TEXT
to accommodate base64-encoded image data.

Revision ID: 15f2c7d4e9b0
Revises: bbd27a3881a5
Create Date: 2026-06-16 13:24:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "15f2c7d4e9b0"
down_revision: Union[str, Sequence[str], None] = "bbd27a3881a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change logo_url from VARCHAR(500) to TEXT."""
    op.alter_column(
        "company_info",
        "logo_url",
        type_=sa.Text(),
        existing_type=sa.String(500),
        nullable=True,
    )


def downgrade() -> None:
    """Revert logo_url from TEXT back to VARCHAR(500)."""
    op.alter_column(
        "company_info",
        "logo_url",
        type_=sa.String(500),
        existing_type=sa.Text(),
        nullable=True,
    )
