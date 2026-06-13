"""phase_7_config

Per-tenant zero-code config: field_definitions, section_configs,
section_fields, permission_items, role_permissions, user_permissions.

Revision ID: e24a3922ed01
Revises: a8dd7d7ba74b
Create Date: 2026-06-12 12:06:14.764655

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "e24a3922ed01"
down_revision: Union[str, Sequence[str], None] = "a8dd7d7ba74b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── field_definitions (global field library) ──
    op.create_table(
        "field_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("field_type", sa.String(50), nullable=False),
        sa.Column("required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("options", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("uq_field_definitions_tenant_name", "field_definitions", ["tenant_id", "name"], unique=True)

    # ── section_configs ──
    op.create_table(
        "section_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name_translations", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("collapsed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── section_fields (junction) ──
    op.create_table(
        "section_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("section_configs.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("field_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("field_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── permission_items ──
    op.create_table(
        "permission_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_id", sa.String(100), nullable=False),
        sa.Column("name_translations", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("item_type", sa.String(20), nullable=False),
        sa.Column("parent_id", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── role_permissions ──
    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_id", sa.String(100), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("can_read", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("can_edit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("can_create", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("can_delete", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("uq_role_permission", "role_permissions", ["tenant_id", "item_id", "role"], unique=True)

    # ── user_permissions ──
    op.create_table(
        "user_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_id", sa.String(100), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("can_read", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("can_edit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("can_create", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("can_delete", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("uq_user_permission", "user_permissions", ["tenant_id", "item_id", "user_id"], unique=True)


def downgrade() -> None:
    op.drop_table("user_permissions")
    op.drop_table("role_permissions")
    op.drop_table("permission_items")
    op.drop_table("section_fields")
    op.drop_table("section_configs")
    op.drop_table("field_definitions")
