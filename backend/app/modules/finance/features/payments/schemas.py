"""Schemas for the finance.payments read slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/finance.md`),
the same way `PaginatedResponse` in `app/core/schemas.py` already does — no aliasing.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PaymentListItem(BaseModel):
    """Row of `GET /api/finance/payments` — a twelve-field projection of the card."""

    id: UUID
    paymentNumber: str
    direction: str
    status: str
    amount: float
    currency: str
    counterpartyName: str
    orderNumber: str | None
    supplierInvoiceRef: str | None
    dueDate: datetime | None
    paidAt: datetime | None
    documentCount: int


class PaymentListResponse(BaseModel):
    """Paginated envelope for the payments list, wrapped in `ApiResponse`."""

    items: list[PaymentListItem]
    total: int
    page: int
    pageSize: int
    totalPages: int


class PaymentDocumentResponse(BaseModel):
    """Document attached to a payment — nested under the card response."""

    id: UUID
    name: str
    fileId: UUID
    url: str
    size: int
    mime: str
    uploadedAt: datetime


class PaymentDetailResponse(BaseModel):
    """Full `GET /api/finance/payments/{payment_id}` card — nineteen fields."""

    id: UUID
    paymentNumber: str
    direction: str
    status: str
    amount: float
    currency: str
    counterpartyId: str | None
    counterpartyName: str
    counterpartyVatCode: str | None
    orderId: str | None
    orderNumber: str | None
    supplierInvoiceRef: str | None
    description: str | None
    dueDate: datetime | None
    paidAt: datetime | None
    documents: list[PaymentDocumentResponse]
    notes: str | None
    createdAt: datetime
    updatedAt: datetime
