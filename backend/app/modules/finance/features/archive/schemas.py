"""Schemas for the finance.archive read slice (Responder / Boundary layer).

Field names repeat the contract's own casing (`roo_code/roo-context/api/finance.md`),
the same way `finance.features.payments.schemas` already does — no aliasing.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel
from app.core.schemas import PaginatedResponse


class ArchiveListItem(BaseModel):
    """Row of `GET /api/finance/archive` — the twelve contract fields.

    `relatedEntityType`, `relatedEntityId`, `relatedEntityNumber` are `nullable=True`
    on `DocumentArchiveItem` (`finance/shared/models.py:116-124`) while the frontend
    type declares all three required — a named contract discrepancy, not a bug this
    slice fixes. A `NULL` column is answered as `null`, never coerced to `""`.
    """

    id: UUID
    name: str
    type: str
    fileId: UUID
    url: str
    size: int
    mime: str
    relatedEntityType: str | None
    relatedEntityId: str | None
    relatedEntityNumber: str | None
    uploadedAt: datetime
    uploadedBy: str


# Конверт списка — один экземпляр на проект (`app.core.schemas.PaginatedResponse`),
# сторож `tests/core/test_list_envelope_one_source.py`.
ArchiveListResponse = PaginatedResponse[ArchiveListItem]
