"""phase_17_mail_settings

Per-tenant mail server settings — the storage the already-written SMTP transport
was waiting for (П53), created by the `settings` module rather than by `bcc`.

The password column holds ciphertext, never the password (П59, `app/core/crypto.py`):
it is written through the mail tab and never read back to any client.

Revision ID: 1c9d4f7b2e83
Revises: 7fff8d1e5810
Create Date: 2026-09-21 17:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "1c9d4f7b2e83"
down_revision: Union[str, Sequence[str], None] = "7fff8d1e5810"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── mail_settings (singleton per tenant) ──
    op.create_table(
        "mail_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("host", sa.String(255), nullable=False, server_default=""),
        sa.Column("port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("encryption", sa.String(20), nullable=False, server_default="starttls"),
        sa.Column("username", sa.String(255), nullable=False, server_default=""),
        sa.Column("password_encrypted", sa.Text(), nullable=True),
        sa.Column("from_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("from_name", sa.String(255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("mail_settings")
