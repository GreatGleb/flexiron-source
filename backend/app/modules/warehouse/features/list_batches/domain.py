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


# Appended below rather than merged into the top-of-file import block, so the
# addition doesn't shift the line numbers the contract already cites.
from app.core.exceptions import AppError, NotFoundError  # noqa: E402

from .repository import get_batch_by_id, list_movements_for_batch  # noqa: E402
from .schemas import BatchAggregateItem  # noqa: E402


class BatchNotFoundError(NotFoundError):
    """Unknown or foreign `batch_id` — the domain's own refusal code.

    Mirrors `ClientNotFoundError` (`clients.read_clients.domain`):
    `NotFoundError.__init__` hardcodes `code="NOT_FOUND"`, so this bypasses it
    and calls `AppError.__init__` directly with the contract's own
    `BATCH_NOT_FOUND` (`roo_code/roo-context/api/warehouse.md`,
    "GET /api/warehouse/batches/:batchId/aggregates"). `isinstance(exc,
    NotFoundError)` still holds, so `app.main`'s `AppError` handler answers 404
    without any change to `app/core/exceptions.py`.
    """

    def __init__(self, batch_id: UUID) -> None:
        AppError.__init__(self, f"Batch not found: {batch_id}", code="BATCH_NOT_FOUND")


#: Movement types that carry metal OFF the batch — declared exactly once in the
#: backend, here. Mirrors `OUTGOING_MOVEMENT_TYPES` in
#: `frontend_vue/src/services/mocks/warehouse.ts`, the mock being the source of
#: truth for this rule while the endpoint stays otherwise unimplemented
#: (`roo_code/roo-context/api/warehouse.md`, "GET
#: /api/warehouse/batches/:batchId/aggregates", "Обязанности сервера" §1/§3).
#: `receipt` and `transfer` are deliberately absent: neither takes metal off
#: the batch.
OUTGOING_MOVEMENT_TYPES: frozenset[str] = frozenset(
    {
        "sale",
        "expense",
        "write-off",
        "production",
        "return-to-supplier",
        "storage",
        "offcut",
    }
)


def _moves_offcut(movement) -> bool:
    """Does this movement move the OFFCUT rather than the batch?

    The metal of an offcut leaves the batch exactly once — the `offcut`
    movement itself (the cut). Anything that later happens to that offcut —
    sale, write-off, a returned cancelled shipment — happens to the offcut,
    which sits apart from its parent batch; subtracting it from the batch a
    second time would destroy metal that is no longer there. Mirrors
    `movesOffcut` in the mock.
    """
    return movement.offcut_id is not None and movement.type != "offcut"


async def get_batch_aggregates(
    db: AsyncSession,
    tenant_id: UUID,
    batch_id: UUID,
) -> list[BatchAggregateItem]:
    """Execute the batch aggregates use case — the batch's metal distribution
    by status, tenant-scoped for both the batch and its movements.

    Two passes over the journal, exactly like the mock this mirrors
    (`mockGetBatchAggregates`): the first pass buckets every movement by its
    own type (or, for a `return`, subtracts from the bucket named by its
    `referenceType`, when that type is itself an outgoing one); the second
    pass lets a `correction` SET its `referenceType` bucket to its own
    quantity, overriding whatever the first pass accumulated there.
    """
    batch = await get_batch_by_id(db, batch_id, tenant_id)
    if batch is None:
        raise BatchNotFoundError(batch_id)

    movements = await list_movements_for_batch(db, batch_id, tenant_id)

    by_type: dict[str, float] = {}
    for movement in movements:
        if movement.type in ("receipt", "transfer"):
            continue
        if movement.type == "correction":
            continue  # applied in the second pass, below
        if _moves_offcut(movement):
            continue
        if movement.type == "return":
            reduce_type = movement.reference_type or ""
            if reduce_type and reduce_type in OUTGOING_MOVEMENT_TYPES:
                by_type[reduce_type] = by_type.get(reduce_type, 0.0) - float(
                    movement.quantity
                )
            continue
        by_type[movement.type] = by_type.get(movement.type, 0.0) + float(
            movement.quantity
        )

    for movement in movements:
        if (
            movement.type != "correction"
            or not movement.reference_type
            or movement.reference_type == "receipt"
        ):
            continue
        if movement.reference_type in OUTGOING_MOVEMENT_TYPES:
            by_type[movement.reference_type] = float(movement.quantity)

    result: list[BatchAggregateItem] = []
    receipt_quantity = max(0.0, float(batch.quantity_remaining))
    if receipt_quantity > 0:
        result.append(
            BatchAggregateItem(
                type="receipt", quantity=receipt_quantity, uomId=batch.uom_id
            )
        )

    positive_buckets = sorted(
        ((bucket_type, quantity) for bucket_type, quantity in by_type.items() if quantity > 0),
        key=lambda pair: pair[1],
        reverse=True,
    )
    for bucket_type, quantity in positive_buckets:
        result.append(
            BatchAggregateItem(type=bucket_type, quantity=quantity, uomId=batch.uom_id)
        )

    return result
