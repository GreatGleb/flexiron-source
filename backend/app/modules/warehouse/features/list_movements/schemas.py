"""Schemas for the warehouse.list_movements slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/warehouse.md`,
`frontend_vue/src/types/warehouse.ts` — `MovementListItem`), the same way
`warehouse.list_batches`'s schemas already do — no aliasing.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.core.schemas import TranslatedString


class MovementListItem(BaseModel):
    """Row of `GET /api/warehouse/movements` — the fourteen contract fields.

    `batchNumber`, `productId` and `currency` have no column of their own on
    the movement record — the movement copies them from its batch at write
    time, so the read side joins `warehouse_batches` for the same three
    values (`roo_code/roo-context/api/warehouse.md`, "GET
    /api/warehouse/movements"). `uomId` is the movement's own `unit` column —
    `WarehouseMovement` carries no `uom_id` FK the way `WarehouseBatch` does.
    `unitPrice` stays `None` for an unpriced batch's movement — an unknown
    cost is not a zero one, same rule as `BatchListItem.unitPrice`.
    """

    id: UUID
    type: str
    batchId: UUID
    batchNumber: str
    offcutId: UUID | None
    productId: UUID
    quantity: float
    uomId: str
    unitPrice: float | None
    referenceId: str | None
    referenceType: str | None
    notes: str | None
    movedAt: datetime
    currency: str


class MovementAuditEntry(BaseModel):
    """One row of a movement's journal — the seven fields the contract names
    for `GET /api/warehouse/movements/:movementId/audit`
    (`roo_code/roo-context/api/warehouse.md`), same shape as the audit
    module's own `AuditEntry`, translated to the wire's camelCase names."""

    id: UUID
    timestamp: datetime
    user: TranslatedString
    userInitials: str
    property: TranslatedString
    oldValue: str
    newValue: str


class MovementCard(MovementListItem):
    """`GET /api/warehouse/movements/:movementId` — the list projection this
    slice already builds, plus the journal field. No second, parallel
    projection of the movement is built for the card; `auditLog` is the same
    rows the sibling `/audit` endpoint returns on its own."""

    auditLog: list[MovementAuditEntry]
