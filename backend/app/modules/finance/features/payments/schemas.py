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


class PaymentPatchInput(BaseModel):
    """Delta body of `PATCH /api/finance/payments/{payment_id}` — two keys.

    This is the domain's whitelist, enforced by omission: the contract notes
    the client's own type is wider (`Partial<FinancePayment> & { fileIds?:
    string[] }`, `services/financeService.ts`), but `status`, `amount`,
    `paymentNumber` and every other card field are simply not declared here,
    so Pydantic drops them on the way in — they never reach the domain layer
    to be whitelisted a second time (`roo_code/roo-context/api/finance.md`,
    "PATCH /api/finance/payments/:id").

    Both fields default to unset rather than `None`, so the domain can tell
    "the client sent `null`" (clear the field / empty the documents) apart
    from "the client did not send this key at all" (leave it as is) via
    `model_fields_set` — the merge-patch contract of §3 conventions.
    """

    notes: str | None = None
    fileIds: list[str] | None = None
