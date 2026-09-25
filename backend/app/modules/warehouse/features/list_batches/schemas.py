"""Schemas for the warehouse.list_batches slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/warehouse.md`,
`frontend_vue/src/types/warehouse.ts` — `BatchListItem`), the same way
`finance.payments`'s schemas already do — no aliasing.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BatchListItem(BaseModel):
    """Row of `GET /api/warehouse/batches` — the twelve contract fields.

    No product or supplier name here on purpose: the contract names the label
    as something assembled at the point of display from a lookup, not a field
    of the list record (`frontend_vue/src/types/warehouse.ts`, `BatchListItem`).
    `unitPrice` stays `None` for a batch nobody priced — an unknown cost is
    not a zero one.
    """

    id: UUID
    productId: UUID
    batchNumber: str
    lotCode: str | None
    quantity: float
    quantityRemaining: float
    uomId: UUID | None
    unitPrice: float | None
    currency: str
    receivedAt: datetime | None
    status: str
    orderId: str | None
