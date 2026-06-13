import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSON, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin, UUIDMixin


# ── Supplier Core Models ──


class Supplier(UUIDMixin, TimestampMixin, Base):
    """Supplier/customer — core business entity, per-tenant."""

    __tablename__ = "suppliers"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    company_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person_translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict, server_default="{}")
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
    status_reason_translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict, server_default="{}")
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
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
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
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
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
    user_name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    user_initials: Mapped[str] = mapped_column(String(10), nullable=False)
    property_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
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


# ── Supplier Card Field Config Models ──


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
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
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
