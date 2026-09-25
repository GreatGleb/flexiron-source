"""Schemas for the audit.feed read slice (Responder / Boundary layer).

Field names repeat the contract's own casing
(`roo_code/roo-context/api/audit-feed.md`), the same way `finance.payments`
schemas already do — no aliasing.
"""

from datetime import datetime

from pydantic import BaseModel

from app.core.schemas import TranslatedString
from app.core.schemas import PaginatedResponse

#: The closed nine-entity enum the feed merges — one source, taken from the
#: client's own closed constant (`frontend_vue/src/types/audit.ts:16-26`), not
#: redeclared independently. An unlisted value is a request error
#: (`VALIDATION_ERROR`), not a legitimately empty page.
ENTITY_TYPES: tuple[str, ...] = (
    "product",
    "order",
    "client",
    "supplier",
    "batch",
    "stock",
    "offcut",
    "movement",
    "deficit",
)


class AuditFeedRow(BaseModel):
    """One line of the merged feed — exactly the ten contract fields."""

    entityType: str
    entityId: str
    entityLabel: str
    entryId: str
    timestamp: datetime
    user: TranslatedString
    userInitials: str
    property: TranslatedString
    oldValue: str
    newValue: str


# Конверт списка живёт в одном экземпляре — `app.core.schemas.PaginatedResponse`
# (сторож `tests/core/test_list_envelope_one_source.py`). Здесь он только
# параметризуется строкой ленты.
AuditFeedResponse = PaginatedResponse[AuditFeedRow]


class AuditFeedUser(BaseModel):
    """One distinct author, for the feed's user filter."""

    key: str
    name: TranslatedString
    initials: str
