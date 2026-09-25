"""Schemas for the notifications.feed slice (Responder / Boundary layer).

Field names repeat the contract's own casing
(`roo_code/roo-context/api/notifications.md`), the same way
`app/modules/finance/features/payments/schemas.py` does — no aliasing.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.core.schemas import PaginatedResponse, TranslatedString


class NotificationListItem(BaseModel):
    """Row of `GET /api/notifications` — the record shape the contract names."""

    id: UUID
    type: str
    title: TranslatedString
    message: TranslatedString
    entityType: str
    entityId: str
    entityRouteName: str
    isRead: bool
    createdAt: datetime


# Конверт списка живёт в одном экземпляре — `app.core.schemas.PaginatedResponse`
# (сторож `tests/core/test_list_envelope_one_source.py`). Здесь он только
# параметризуется строкой ленты уведомлений.
NotificationListResponse = PaginatedResponse[NotificationListItem]
