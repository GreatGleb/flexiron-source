import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class FieldDefinition(UUIDMixin, TimestampMixin, Base):
    """Global field library — reusable field definitions, per-tenant."""

    __tablename__ = "field_definitions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)
    required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_builtin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    usage_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_field_definitions_tenant_name"),
    )


class SectionConfig(UUIDMixin, TimestampMixin, Base):
    """Supplier card section configuration, per-tenant."""

    __tablename__ = "section_configs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    collapsed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    fields: Mapped[list["SectionField"]] = relationship(
        "SectionField", back_populates="section", cascade="all, delete-orphan"
    )


class SectionField(UUIDMixin, Base):
    """Junction: field placed in a section with order, per-tenant."""

    __tablename__ = "section_fields"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("section_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("field_definitions.id", ondelete="CASCADE"),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    section: Mapped["SectionConfig"] = relationship(
        "SectionConfig", back_populates="fields"
    )


class PermissionItem(UUIDMixin, Base):
    """Item in the permission matrix (section or field), per-tenant."""

    __tablename__ = "permission_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    item_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'section' | 'field'
    parent_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RolePermission(UUIDMixin, TimestampMixin, Base):
    """Role-based permission on an item, per-tenant."""

    __tablename__ = "role_permissions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    can_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    can_edit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_create: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_delete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "item_id", "role", name="uq_role_permission"
        ),
    )


class UserPermission(UUIDMixin, TimestampMixin, Base):
    """User-specific permission override on an item, per-tenant."""

    __tablename__ = "user_permissions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    can_read: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    can_edit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_create: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    can_delete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "item_id", "user_id", name="uq_user_permission"
        ),
    )
