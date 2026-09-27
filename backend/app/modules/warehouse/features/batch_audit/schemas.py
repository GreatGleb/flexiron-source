"""Schemas for the warehouse.batch_audit slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/warehouse.md`,
`frontend_vue/src/types/warehouse.ts` — `StockAuditEntry`), the same way
`warehouse.list_movements`'s `MovementAuditEntry` already does — no aliasing.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.core.schemas import TranslatedString


class BatchAuditEntry(BaseModel):
    """One row of `GET /api/warehouse/batches/:batchId/audit` — the seven
    contract fields.

    `id` is mandatory, not decorative: the paired
    `DELETE /api/warehouse/batches/:batchId/audit/:entryId` addresses a record
    by its own id and never by its position in the array (§9 of
    `roo_code/roo-context/api/00-conventions.md`). `user` and `property` are
    translation objects, not flat strings — the storage keeps them as JSONB
    (`stock_audit_entries.user_name_translations`/`.property_translations`).
    """

    id: UUID
    timestamp: datetime
    user: TranslatedString
    userInitials: str
    property: TranslatedString
    oldValue: str
    newValue: str
