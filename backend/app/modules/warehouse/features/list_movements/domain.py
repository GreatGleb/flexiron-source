"""Domain use case for the warehouse.list_movements slice.

Contains pure business logic — no FastAPI, no DB session management.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schemas import PaginatedResponse

from .repository import count_movements
from .repository import list_movements as list_movements_repo
from .schemas import MovementListItem

MAX_PAGE_SIZE = 100

#: Contract default (`roo_code/roo-context/api/warehouse.md`, "GET /api/warehouse/movements").
DEFAULT_SORT_BY = "movedAt"


def _normalize_search(search: str | None) -> str | None:
    if search is None or not search.strip():
        return None
    return search.strip()


def _to_list_item(row: Row) -> MovementListItem:
    movement, batch_number, product_id, currency = row
    return MovementListItem(
        id=movement.id,
        type=movement.type,
        batchId=movement.batch_id,
        batchNumber=batch_number,
        offcutId=movement.offcut_id,
        productId=product_id,
        quantity=float(movement.quantity),
        uomId=movement.unit,
        unitPrice=float(movement.unit_price) if movement.unit_price is not None else None,
        referenceId=movement.reference_id,
        referenceType=movement.reference_type,
        notes=movement.notes,
        movedAt=movement.moved_at,
        currency=currency,
    )


async def list_movements(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    page: int,
    page_size: int,
    type: str | None,
    product_id: UUID | None,
    uom_id: str | None,
    reference_id: str | None,
    offcut_id: UUID | None,
    batch_number: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
    sort_by: str | None,
    sort_dir: str | None,
) -> PaginatedResponse[MovementListItem]:
    """Execute the list warehouse movements use case."""
    search = _normalize_search(search)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    sort_by = sort_by or DEFAULT_SORT_BY
    sort_desc = (sort_dir or "desc").lower() != "asc"

    total = await count_movements(
        db,
        tenant_id,
        search=search,
        type=type,
        product_id=product_id,
        uom_id=uom_id,
        reference_id=reference_id,
        offcut_id=offcut_id,
        batch_number=batch_number,
        date_from=date_from,
        date_to=date_to,
    )
    rows = await list_movements_repo(
        db,
        tenant_id,
        search=search,
        type=type,
        product_id=product_id,
        uom_id=uom_id,
        reference_id=reference_id,
        offcut_id=offcut_id,
        batch_number=batch_number,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_desc=sort_desc,
        page=page,
        page_size=page_size,
    )

    return PaginatedResponse[MovementListItem](
        items=[_to_list_item(row) for row in rows],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )


# Appended below rather than merged into the top-of-file import block, so the
# addition doesn't shift the line numbers the contract already cites.
from app.core.exceptions import AppError, NotFoundError  # noqa: E402
from app.core.schemas import TranslatedString  # noqa: E402
from app.modules.audit.internal_api.interface import (  # noqa: E402
    read_audit_entries_for_entity,
)

from .repository import get_movement_by_id  # noqa: E402
from .schemas import MovementAuditEntry, MovementCard  # noqa: E402

#: Fixed entity kind this slice reads the shared journal under — one of the
#: closed set `AUDIT_ENTITY_TYPES` the audit module owns
#: (`app.modules.audit.shared.models`). `warehouse` never imports that models
#: module directly; only the string travels across the boundary.
AUDIT_ENTITY_TYPE = "movement"


class MovementNotFoundError(NotFoundError):
    """Unknown or foreign `movement_id` — the domain's own refusal code.

    Mirrors `BatchNotFoundError` (`list_batches.domain`): bypasses
    `NotFoundError.__init__`'s hardcoded `code="NOT_FOUND"` and calls
    `AppError.__init__` directly with the contract's own `MOVEMENT_NOT_FOUND`
    (`roo_code/roo-context/api/warehouse.md`,
    "GET /api/warehouse/movements/:movementId"). `isinstance(exc,
    NotFoundError)` still holds, so `app.main`'s `AppError` handler answers
    404 without any change to `app/core/exceptions.py`.
    """

    def __init__(self, movement_id: UUID) -> None:
        AppError.__init__(
            self, f"Movement not found: {movement_id}", code="MOVEMENT_NOT_FOUND"
        )


def _to_audit_entry(entry) -> MovementAuditEntry:
    return MovementAuditEntry(
        id=entry.id,
        timestamp=entry.timestamp,
        user=TranslatedString(**entry.user_name_translations),
        userInitials=entry.user_initials,
        property=TranslatedString(**entry.property_translations),
        oldValue=entry.old_value,
        newValue=entry.new_value,
    )


async def get_movement_audit(
    db: AsyncSession,
    tenant_id: UUID,
    movement_id: UUID,
) -> list[MovementAuditEntry]:
    """The movement's journal alone — same rows the card's `auditLog` field
    carries, read through the audit module's own internal API rather than a
    direct import of its models. Read-only: an unknown `movement_id` answers
    an empty list, never creates one (the mock's lazily-materialized copy is
    a mock property, not a server one)."""
    entries = await read_audit_entries_for_entity(
        db,
        tenant_id=tenant_id,
        entity_type=AUDIT_ENTITY_TYPE,
        entity_id=movement_id,
    )
    return [_to_audit_entry(entry) for entry in entries]


async def get_movement_card(
    db: AsyncSession,
    tenant_id: UUID,
    movement_id: UUID,
) -> MovementCard:
    """The movement card — the same list projection `list_movements` builds
    for one row, plus its journal. Unknown or foreign `movement_id` raises
    `MovementNotFoundError` rather than answering an empty body."""
    row = await get_movement_by_id(db, tenant_id, movement_id)
    if row is None:
        raise MovementNotFoundError(movement_id)

    list_item = _to_list_item(row)
    audit_log = await get_movement_audit(db, tenant_id, movement_id)
    return MovementCard(**list_item.model_dump(), auditLog=audit_log)
