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
