import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base, UUIDMixin


class Order(UUIDMixin, Base):
    """Customer order — per-tenant, carries a frozen client-requisites snapshot."""

    __tablename__ = "orders"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # `RESTRICT`, not `CASCADE`: the contract states the symmetric rule
    # explicitly — a client with orders may not be deleted
    # ("клиента с заказами удалять нельзя" — orders-backend-contract.md §4.1).
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    order_number: Mapped[str] = mapped_column(String(50), nullable=False)
    document_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)

    # Frozen at creation from tenant settings; a later settings change must
    # not rewrite an already-created order (§14 conventions, "Что осталось
    # нерешённым" п.1) — hence no server-side default of its own here.
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    vat_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    vat_percent: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)

    # Admin-writable, apply only to new lines; existing lines are untouched.
    default_margin_percent: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)
    default_discount_percent: Mapped[float] = mapped_column(Numeric(9, 6), nullable=False)

    # Optimistic-locking counter (contract §3): server bumps it on every
    # accepted write, client returns the version it last saw.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Client requisites snapshot — the document remembers who it was billed
    # to, not the client card's current data (orders-backend-contract.md §4.1).
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_vat_code: Mapped[str] = mapped_column(String(64), nullable=False)
    client_address: Mapped[str] = mapped_column(Text, nullable=False)
    client_payment_terms_days: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # `totalCost`/`totalAmount`/`totalVat`/`totalWithVat`, `actualMarginPercent`,
    # `effectiveDiscountPercent`, `paidAmount`/`paidPercent`/`outstandingAmount`
    # are deliberately NOT added: the contract's own rule 5 (§1) forbids
    # storing anything derived — they are computed from order lines and
    # payments at read time, and a stored copy goes stale on the very next
    # line added.
    #
    # `auditLog[]` is deliberately NOT added: the order's audit journal is out
    # of scope for this task (no table for it here), and separately its own
    # shape — what belongs in an entry, and whether the author is a display
    # name or a user reference — is itself still unresolved ("осталось" —
    # roo_code/roo-context/api/orders.md, «Что осталось нерешённым», п.3).

    __table_args__ = (
        UniqueConstraint("tenant_id", "order_number", name="uq_orders_tenant_order_number"),
    )


class OrderItem(UUIDMixin, Base):
    """Order line — the source of truth for pricing and cost, not the order."""

    __tablename__ = "order_items"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # `RESTRICT`: a catalog product must not silently vanish out from under a
    # document that names it.
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Snapshot on the catalog's base language, independent of who is reading
    # (orders-backend-contract.md §4.2).
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)

    # The named price is stored as-is, not always rebuilt from cost×margin:
    # restoring it from the percentage loses a cent on a measured share of
    # combinations (§7 "Цена хранится как цена"). `manual_unit_price` set
    # freezes the line: price stops following cost or order defaults.
    unit_price: Mapped[float] = mapped_column(Numeric(18, 10), nullable=False)
    manual_unit_price: Mapped[float | None] = mapped_column(Numeric(18, 10), nullable=True)
    margin_percent: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)

    # Cost is read from stock, never taken from the client as truth; the
    # allocation is mandatory — without it the cost is not reproducible and a
    # partial shipment has nothing to draw down against (§2 "Строка заказа").
    unit_cost: Mapped[float] = mapped_column(Numeric(18, 10), nullable=False)
    cost_source: Mapped[str] = mapped_column(String(16), nullable=False)
    allocations: Mapped[list] = mapped_column(JSONB, nullable=False)
    # Base-currency code signing `unit_cost`: cost is derived entirely from
    # warehouse batches, so its signature is always the base currency, never
    # the product's own currency (§7.1).
    received_currency: Mapped[str] = mapped_column(String(10), nullable=False)

    # Lifecycle. `state` is deliberately NOT added: the contract says it is
    # derived from quantity vs. shipped_quantity, never set by hand (§2
    # "Строка заказа", "state выводится из количеств").
    shipped_quantity: Mapped[float] = mapped_column(
        Numeric(14, 4), nullable=False, default=0, server_default="0"
    )
    document_issued: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # `totalPrice`/`discount` (the discount amount) are deliberately NOT
    # added: the contract names them a projection for old parts of the UI,
    # computed by the server, never written by the client (§2) — storing
    # them would duplicate `unit_price × quantity` arithmetic that has no
    # rounding-drift argument of its own, unlike `unit_price`.
