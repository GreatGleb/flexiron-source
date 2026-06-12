import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Supplier(UUIDMixin, TimestampMixin, Base):
    """Supplier/customer — core business entity, per-tenant."""

    __tablename__ = "suppliers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    company_en: Mapped[str] = mapped_column(String(255), nullable=False)
    company_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person_ru: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_person_lt: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="new", server_default="new"
    )
    categories: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    rating: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tags: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    lead_time: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    status_reason_ru: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status_reason_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status_reason_lt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    vat_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="EUR", server_default="EUR"
    )
    payment_terms: Mapped[str | None] = mapped_column(String(100), nullable=True)
    min_order: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    bcc_emails: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=list, server_default="[]"
    )
    has_deficit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    last_bcc_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    addresses: Mapped[list["SupplierAddress"]] = relationship(
        "SupplierAddress", back_populates="supplier", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["SupplierContact"]] = relationship(
        "SupplierContact", back_populates="supplier", cascade="all, delete-orphan"
    )
    files: Mapped[list["SupplierFile"]] = relationship(
        "SupplierFile", back_populates="supplier", cascade="all, delete-orphan"
    )
    audit_entries: Mapped[list["SupplierAuditEntry"]] = relationship(
        "SupplierAuditEntry", back_populates="supplier", cascade="all, delete-orphan"
    )
    price_entries: Mapped[list["SupplierPriceEntry"]] = relationship(
        "SupplierPriceEntry", back_populates="supplier", cascade="all, delete-orphan"
    )


class SupplierAddress(UUIDMixin, Base):
    """Physical address of a supplier."""

    __tablename__ = "supplier_addresses"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    address_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'Legal','Postal','Shipping'
    line1: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    zip: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="addresses")


class SupplierContact(UUIDMixin, Base):
    """Contact person at a supplier."""

    __tablename__ = "supplier_contacts"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="contacts")


class SupplierFile(UUIDMixin, Base):
    """File attached to a supplier card."""

    __tablename__ = "supplier_files"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_files.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="files")


class SupplierAuditEntry(UUIDMixin, Base):
    """Audit log entry for supplier field changes."""

    __tablename__ = "supplier_audit_entries"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    user_name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    user_initials: Mapped[str] = mapped_column(String(10), nullable=False)
    property_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    property_en: Mapped[str] = mapped_column(String(255), nullable=False)
    property_lt: Mapped[str] = mapped_column(String(255), nullable=False)
    old_value: Mapped[str] = mapped_column(Text, nullable=False)
    new_value: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="audit_entries")


class SupplierPriceEntry(UUIDMixin, Base):
    """Price history entry for a supplier."""

    __tablename__ = "supplier_price_entries"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suppliers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="price_entries")
