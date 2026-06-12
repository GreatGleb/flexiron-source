import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Product(UUIDMixin, TimestampMixin, Base):
    """Product item — belongs to a category, per-tenant."""

    __tablename__ = "products"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    min_stock: Mapped[float | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    price_unit: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # 'EUR/vnt','EUR/kg','EUR/m'

    # Relationships
    field_values: Mapped[list["ProductFieldValue"]] = relationship(
        "ProductFieldValue", back_populates="product",
        cascade="all, delete-orphan",
    )


class ProductFieldValue(UUIDMixin, TimestampMixin, Base):
    """Dynamic field value for a product, per-tenant."""

    __tablename__ = "product_field_values"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("category_fields.id", ondelete="RESTRICT"),
        nullable=False,
    )
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "product_id", "field_id",
            name="uq_product_field_value",
        ),
    )

    product: Mapped["Product"] = relationship("Product", back_populates="field_values")
