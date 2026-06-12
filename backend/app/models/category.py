import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Category(UUIDMixin, TimestampMixin, Base):
    """Product category — self-referencing tree hierarchy, per-tenant."""

    __tablename__ = "categories"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    field_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    product_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    level: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    # Self-referencing relationships
    children: Mapped[list["Category"]] = relationship(
        "Category", back_populates="parent",
        cascade="all, delete-orphan",
        remote_side="Category.id",
    )
    parent: Mapped["Category | None"] = relationship(
        "Category", back_populates="children", remote_side="Category.id"
    )
    # Dynamic fields on this category
    fields: Mapped[list["CategoryField"]] = relationship(
        "CategoryField", back_populates="category",
        cascade="all, delete-orphan",
    )


class CategoryField(UUIDMixin, TimestampMixin, Base):
    """Dynamic field definition on a category, per-tenant."""

    __tablename__ = "category_fields"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'text','number','enum','date','boolean'
    required: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    options: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # JSON array for enum type values

    category: Mapped["Category"] = relationship("Category", back_populates="fields")
