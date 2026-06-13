"""phase_11_notifications

Per-tenant: notifications.

Revision ID: 7bf1730620f0
Revises: b2619dfeb90f
Create Date: 2026-06-12 12:15:15.013742

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "7bf1730620f0"
down_revision: Union[str, Sequence[str], None] = "b2619dfeb90f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title_translations", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("message_translations", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false"), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("notifications")
