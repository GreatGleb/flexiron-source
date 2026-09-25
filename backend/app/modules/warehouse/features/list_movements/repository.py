"""Repository for the warehouse.list_movements slice (Infrastructure / Data Access layer)."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.internal_api.interface import Product as CatalogProduct
from app.modules.warehouse.shared.models import WarehouseBatch, WarehouseMovement

#: Fixed allow-list of sortable columns — never a bare `getattr(Model, sort_by)`
#: on request input. `productName` and `totalCost` have no column of their
#: own: the first sorts by the joined catalog's name, the second is the
#: quantity × unitPrice expression the contract names.
SORTABLE_COLUMNS: dict[str, Any] = {
    "movedAt": WarehouseMovement.moved_at,
    "type": WarehouseMovement.type,
    "productName": CatalogProduct.name,
    "batchNumber": WarehouseBatch.batch_number,
    "quantity": WarehouseMovement.quantity,
    "uomId": WarehouseMovement.unit,
    "unitPrice": WarehouseMovement.unit_price,
    "totalCost": WarehouseMovement.quantity * WarehouseMovement.unit_price,
    "referenceId": WarehouseMovement.reference_id,
}


async def _base_query(tenant_id: UUID):
    """`WarehouseMovement` joined with its batch and, outer, the batch's product.

    `batchNumber`, `productId` and `currency` live on `WarehouseBatch`, not on
    the movement — every row needs the join, not only a searched one, so it
    is unconditional here rather than added on demand the way `search` adds
    it in `list_batches`. The batch join is tenant-scoped in its `ON` clause
    (not only the top-level `WHERE`) so a foreign batch can never supply the
    three copied columns; the product join stays `LEFT OUTER` the same way
    `list_batches` keeps it, so a batch whose product row is missing or
    foreign still returns its movement rather than being dropped.
    """
    return (
        select(
            WarehouseMovement,
            WarehouseBatch.batch_number,
            WarehouseBatch.product_id,
            WarehouseBatch.currency,
        )
        .join(
            WarehouseBatch,
            (WarehouseBatch.id == WarehouseMovement.batch_id)
            & (WarehouseBatch.tenant_id == tenant_id),
        )
        .outerjoin(
            CatalogProduct,
            (CatalogProduct.id == WarehouseBatch.product_id)
            & (CatalogProduct.tenant_id == tenant_id),
        )
        .where(WarehouseMovement.tenant_id == tenant_id)
    )


async def _filtered_query(
    tenant_id: UUID,
    *,
    search: str | None,
    type: str | None,
    product_id: UUID | None,
    uom_id: str | None,
    reference_id: str | None,
    offcut_id: UUID | None,
    batch_number: str | None,
    date_from: datetime | None,
    date_to: datetime | None,
):
    """Shared WHERE clause for both the count and the page — one place for the rule.

    `search` matches the batch's own `batch_number` OR the linked product's
    name, mirroring `list_batches`. `productId`, `uomId`, `referenceId` and
    `offcutId` are exact matches; `batchNumber` is a case-insensitive
    substring, kept separate from `search` (the contract names both).
    """
    query = await _base_query(tenant_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                WarehouseBatch.batch_number.ilike(pattern),
                CatalogProduct.name.ilike(pattern),
            )
        )
    if type:
        query = query.where(WarehouseMovement.type == type)
    if product_id is not None:
        query = query.where(WarehouseBatch.product_id == product_id)
    if uom_id:
        query = query.where(WarehouseMovement.unit == uom_id)
    if reference_id:
        query = query.where(WarehouseMovement.reference_id == reference_id)
    if offcut_id is not None:
        query = query.where(WarehouseMovement.offcut_id == offcut_id)
    if batch_number:
        query = query.where(WarehouseBatch.batch_number.ilike(f"%{batch_number}%"))
    if date_from is not None:
        query = query.where(WarehouseMovement.moved_at >= date_from)
    if date_to is not None:
        query = query.where(WarehouseMovement.moved_at <= date_to)
    return query


async def count_movements(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    type: str | None = None,
    product_id: UUID | None = None,
    uom_id: str | None = None,
    reference_id: str | None = None,
    offcut_id: UUID | None = None,
    batch_number: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> int:
    """Total rows matching the filters, tenant-scoped."""
    query = await _filtered_query(
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
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_movements(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    type: str | None = None,
    product_id: UUID | None = None,
    uom_id: str | None = None,
    reference_id: str | None = None,
    offcut_id: UUID | None = None,
    batch_number: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "movedAt",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = 25,
) -> list[Row]:
    """One page of movements, tenant-scoped, sorted, paginated.

    Each row is `(WarehouseMovement, batch_number, product_id, currency)` —
    the movement entity plus the three values only its batch carries.
    Default order is `movedAt DESC` (contract §13 — named default for this
    endpoint). Ties break by `id` ascending so pagination stays stable across
    pages when the sort column repeats. An unknown `sort_by` falls back to
    the default column rather than raising.
    """
    query = await _filtered_query(
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
    column = SORTABLE_COLUMNS.get(sort_by, WarehouseMovement.moved_at)
    order = column.desc() if sort_desc else column.asc()
    query = query.order_by(order, WarehouseMovement.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.all())


async def get_movement_by_id(
    db: AsyncSession,
    tenant_id: UUID,
    movement_id: UUID,
) -> Row | None:
    """One movement row, same shape and same join as `list_movements` — the
    card is built off this, not a second projection."""
    query = await _base_query(tenant_id)
    query = query.where(WarehouseMovement.id == movement_id)
    result = await db.execute(query)
    return result.first()
