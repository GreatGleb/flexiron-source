import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin, UUIDMixin


# ── Identity Models ──


class Tenant(UUIDMixin, TimestampMixin, Base):
    """Multi-tenant organization/company."""

    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    vat_code: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Relationships
    users: Mapped[list["User"]] = relationship(
        "User", back_populates="tenant", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tenant {self.slug}>"


class User(UUIDMixin, TimestampMixin, Base):
    """System user — belongs to a tenant (or NULL = superadmin)."""

    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    secret_link_token: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True,
    )
    # ⚠️ DEPRECATED — kept as fallback until frontend migrates to multi-role
    role: Mapped[str] = mapped_column(
        String(50), nullable=False, default="owner", server_default="owner"
    )
    locale: Mapped[str] = mapped_column(
        String(10), nullable=False, default="ru", server_default="ru"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Relationships
    tenant: Mapped["Tenant | None"] = relationship(
        "Tenant", back_populates="users"
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    # Multi-role: user can have multiple roles (many-to-many via UserRole)
    roles: Mapped[list["UserRole"]] = relationship(
        "UserRole", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User {self.email} tenant={self.tenant_id}>"


class UserRole(UUIDMixin, Base):
    """Many-to-many junction: user → role."""

    __tablename__ = "user_roles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="roles")

    __table_args__ = (
        UniqueConstraint("user_id", "role_name", name="uq_user_role"),
    )

    def __repr__(self) -> str:
        return f"<UserRole user={self.user_id} role={self.role_name}>"


class Session(UUIDMixin, Base):
    """User session (HttpOnly cookie-based authentication)."""

    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False
    )
    csrf_token: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    remember: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:
        return f"<Session user_id={self.user_id}>"


# ── Permission / RBAC Models ──


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
    name_translations: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
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
