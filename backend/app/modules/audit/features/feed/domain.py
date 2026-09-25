"""Domain use cases for the audit.feed read slice — the merged feed and its
author filter.

Contains pure business logic — no FastAPI, no DB session management.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.schemas import TranslatedString
from app.modules.audit.shared.models import AuditEntry

from .repository import list_feed_authors, list_feed_entries
from .schemas import ENTITY_TYPES, AuditFeedResponse, AuditFeedRow, AuditFeedUser

_DATE_FORMAT = "%Y-%m-%d"


def _normalize(value: str | None) -> str | None:
    """Empty string means "no filter", not "a filter equal to the empty
    string" — the request travels with all five filters always present, blank
    or not (contract, rule 11)."""
    if value is None or value == "":
        return None
    return value


def _parse_day_boundary(value: str | None, *, field: str) -> datetime | None:
    """Parse a `YYYY-MM-DD` filter edge as a UTC midnight.

    The tenant's company timezone is the eventual owner of "where a day
    starts" (П62), but no such column exists yet
    (`backend/app/modules/settings/shared/models.py` has no timezone field
    outside its own service `DateTime` columns) — this slice cuts the
    boundary in UTC and leaves the switch to whichever task adds that column.
    """
    if value is None:
        return None
    try:
        return datetime.strptime(value, _DATE_FORMAT).replace(tzinfo=timezone.utc)
    except ValueError:
        raise ValidationError(f"Invalid {field}: expected YYYY-MM-DD") from None


def _matches_search(entry: AuditEntry, needle: str) -> bool:
    """Case-insensitive substring across all `property_translations` values
    plus both `old_value`/`new_value` (contract: search hits four/five
    fields)."""
    needle_lower = needle.lower()
    haystacks = [*entry.property_translations.values(), entry.old_value, entry.new_value]
    return any(needle_lower in str(value).lower() for value in haystacks if value)


def _to_row(entry: AuditEntry) -> AuditFeedRow:
    return AuditFeedRow(
        entityType=entry.entity_type,
        entityId=str(entry.entity_id),
        # KNOWN_GAPS: entityLabel == entityId. A real label needs a lookup
        # into each of the nine owning modules (S4's job); this slice does not
        # do that, and says so instead of guessing a label.
        entityLabel=str(entry.entity_id),
        entryId=str(entry.id),
        timestamp=entry.timestamp,
        user=TranslatedString(**entry.user_name_translations),
        userInitials=entry.user_initials,
        property=TranslatedString(**entry.property_translations),
        oldValue=entry.old_value,
        newValue=entry.new_value,
    )


async def get_audit_feed(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    entity_type: str | None,
    user_key: str | None,
    date_from: str | None,
    date_to: str | None,
    search: str | None,
    page: int,
    page_size: int,
) -> AuditFeedResponse:
    """Execute the merged-feed read use case.

    KNOWN_GAPS, written here rather than worked around silently: (1)
    `entityLabel` equals `entityId` — see `_to_row`. (2) Date boundaries are
    cut in UTC — see `_parse_day_boundary`. (3) No permission check and no
    `sensitive` redaction run here: `check_permission` in
    `app.modules.auth.internal_api.interface` is a `return True` placeholder
    today, so there is no role matrix yet for this slice to consult, and
    nothing marks a row as needing to be hidden.
    """
    entity_type = _normalize(entity_type)
    if entity_type is not None and entity_type not in ENTITY_TYPES:
        raise ValidationError(f"Unknown entityType: {entity_type}")

    user_key = _normalize(user_key)
    search = _normalize(search)

    from_boundary = _parse_day_boundary(_normalize(date_from), field="dateFrom")
    to_boundary = _parse_day_boundary(_normalize(date_to), field="dateTo")
    to_boundary_exclusive = (
        to_boundary + timedelta(days=1) if to_boundary is not None else None
    )

    page = max(page, 1)
    page_size = max(page_size, 1)

    entries = await list_feed_entries(
        db,
        tenant_id,
        entity_type=entity_type,
        date_from=from_boundary,
        date_to_exclusive=to_boundary_exclusive,
    )

    if user_key is not None:
        entries = [e for e in entries if e.user_name_translations.get("en") == user_key]
    if search is not None:
        entries = [e for e in entries if _matches_search(e, search)]

    total = len(entries)
    total_pages = max(1, -(-total // page_size))

    # Зажим СВЕРХУ, а не только снизу. Без него запрос страницы за пределом отдаёт
    # пустые `items` и эхо-значение `page` — то есть клиент получает подтверждение,
    # что такая страница есть. У фронта на этом держится `skipNextPageWatch`: он
    # рассчитывает, что сервер вернёт настоящий номер, и против живого бэкенда без
    # зажима механизм мёртв (за это задачу и забраковали).
    page = min(page, total_pages)

    start = (page - 1) * page_size
    page_entries = entries[start : start + page_size]

    return AuditFeedResponse(
        items=[_to_row(entry) for entry in page_entries],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=total_pages,
    )


async def get_audit_feed_users(db: AsyncSession, tenant_id: UUID) -> list[AuditFeedUser]:
    """List distinct authors across every record of the tenant.

    Independent of the feed's own filters (contract, rule 9). De-duplicated
    by key, first-encountered wins — `list_feed_authors` returns oldest first,
    so "first encountered" means "earliest recorded name for this key".
    """
    entries = await list_feed_authors(db, tenant_id)
    seen: dict[str, AuditFeedUser] = {}
    for entry in entries:
        key = entry.user_name_translations.get("en", "")
        if key not in seen:
            seen[key] = AuditFeedUser(
                key=key,
                name=TranslatedString(**entry.user_name_translations),
                initials=entry.user_initials,
            )
    return sorted(seen.values(), key=lambda item: item.key)
