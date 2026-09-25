"""Domain use case for the warehouse.list_batches slice.

Contains pure business logic — no FastAPI, no DB session management.
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schemas import PaginatedResponse
from app.modules.warehouse.shared.models import WarehouseBatch

from .repository import count_batches
from .repository import list_batches as list_batches_repo
from .schemas import BatchListItem

MAX_PAGE_SIZE = 100

#: Contract default (`roo_code/roo-context/api/warehouse.md`, "GET /api/warehouse/batches").
DEFAULT_SORT_BY = "receivedAt"


def _normalize_search(search: str | None) -> str | None:
    if search is None or not search.strip():
        return None
    return search.strip()


def _normalize_status(status: str | None) -> str | None:
    """Empty string and `all` both mean "no filter" (§13 conventions)."""
    if not status or status == "all":
        return None
    return status


def _to_list_item(entity: WarehouseBatch) -> BatchListItem:
    return BatchListItem(
        id=entity.id,
        productId=entity.product_id,
        batchNumber=entity.batch_number,
        lotCode=entity.lot_code,
        quantity=float(entity.quantity),
        quantityRemaining=float(entity.quantity_remaining),
        uomId=entity.uom_id,
        unitPrice=float(entity.unit_price) if entity.unit_price is not None else None,
        currency=entity.currency,
        receivedAt=entity.received_at,
        status=entity.status,
        orderId=entity.order_id,
    )


async def list_batches(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    page: int,
    page_size: int,
    product_id: UUID | None,
    supplier_id: UUID | None,
    status: str | None,
    uom_id: UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
    sort_by: str | None,
    sort_dir: str | None,
) -> PaginatedResponse[BatchListItem]:
    """Execute the list warehouse batches use case."""
    search = _normalize_search(search)
    status = _normalize_status(status)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    sort_by = sort_by or DEFAULT_SORT_BY
    sort_desc = (sort_dir or "desc").lower() != "asc"

    total = await count_batches(
        db,
        tenant_id,
        search=search,
        product_id=product_id,
        supplier_id=supplier_id,
        status=status,
        uom_id=uom_id,
        date_from=date_from,
        date_to=date_to,
    )
    entities = await list_batches_repo(
        db,
        tenant_id,
        search=search,
        product_id=product_id,
        supplier_id=supplier_id,
        status=status,
        uom_id=uom_id,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_desc=sort_desc,
        page=page,
        page_size=page_size,
    )

    return PaginatedResponse[BatchListItem](
        items=[_to_list_item(entity) for entity in entities],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )
