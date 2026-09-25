"""Repository for the warehouse.list_batches slice (Infrastructure / Data Access layer)."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.internal_api.interface import Product as CatalogProduct
from app.modules.warehouse.shared.models import WarehouseBatch

#: Fixed allow-list of sortable columns — never a bare `getattr(Model, sort_by)`
#: on request input.
SORTABLE_COLUMNS: dict[str, Any] = {
    "batchNumber": WarehouseBatch.batch_number,
    "quantity": WarehouseBatch.quantity,
    "quantityRemaining": WarehouseBatch.quantity_remaining,
    "unitPrice": WarehouseBatch.unit_price,
    "currency": WarehouseBatch.currency,
    "receivedAt": WarehouseBatch.received_at,
    "status": WarehouseBatch.status,
}


async def _filtered_query(
    tenant_id: UUID,
    *,
    search: str | None,
    product_id: UUID | None,
    supplier_id: UUID | None,
    status: str | None,
    uom_id: UUID | None,
    date_from: datetime | None,
    date_to: datetime | None,
):
    """Shared WHERE clause for both the count and the page — one place for the rule.

    `search` matches the batch's own `batch_number` OR the linked product's
    name — a real SQL join to the products catalog, never a name field on the
    batch record itself (it doesn't have one). `Product` is read from
    `products.internal_api.interface`, the module's own cross-module contract
    (it already imports `Product` for its own use, re-exposing the name);
    module isolation forbids reaching into `products.shared.models` directly
    from here. The join is `LEFT OUTER` and additionally scoped by tenant, so
    a batch whose product row is missing or belongs to another tenant still
    matches on its own `batch_number` rather than being silently dropped.
    """
    query = select(WarehouseBatch).where(WarehouseBatch.tenant_id == tenant_id)
    if search:
        pattern = f"%{search}%"
        query = query.outerjoin(
            CatalogProduct,
            (CatalogProduct.id == WarehouseBatch.product_id)
            & (CatalogProduct.tenant_id == tenant_id),
        ).where(
            or_(
                WarehouseBatch.batch_number.ilike(pattern),
                CatalogProduct.name.ilike(pattern),
            )
        )
    if product_id is not None:
        query = query.where(WarehouseBatch.product_id == product_id)
    if supplier_id is not None:
        query = query.where(WarehouseBatch.supplier_id == supplier_id)
    if status:
        query = query.where(WarehouseBatch.status == status)
    if uom_id is not None:
        query = query.where(WarehouseBatch.uom_id == uom_id)
    if date_from is not None:
        query = query.where(WarehouseBatch.received_at >= date_from)
    if date_to is not None:
        query = query.where(WarehouseBatch.received_at <= date_to)
    return query


async def count_batches(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    product_id: UUID | None = None,
    supplier_id: UUID | None = None,
    status: str | None = None,
    uom_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> int:
    """Total rows matching the filters, tenant-scoped."""
    query = await _filtered_query(
        tenant_id,
        search=search,
        product_id=product_id,
        supplier_id=supplier_id,
        status=status,
        uom_id=uom_id,
        date_from=date_from,
        date_to=date_to,
    )
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_batches(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None = None,
    product_id: UUID | None = None,
    supplier_id: UUID | None = None,
    status: str | None = None,
    uom_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "receivedAt",
    sort_desc: bool = True,
    page: int = 1,
    page_size: int = 25,
) -> list[WarehouseBatch]:
    """One page of batches, tenant-scoped, sorted, paginated.

    Default order is `receivedAt DESC` (contract §13 — "сортировка принадлежит
    серверу", named default for this endpoint). Ties break by `id` ascending
    so pagination stays stable across pages when the sort column repeats.
    An unknown `sort_by` falls back to the default column rather than raising.
    """
    query = await _filtered_query(
        tenant_id,
        search=search,
        product_id=product_id,
        supplier_id=supplier_id,
        status=status,
        uom_id=uom_id,
        date_from=date_from,
        date_to=date_to,
    )
    column = SORTABLE_COLUMNS.get(sort_by, WarehouseBatch.received_at)
    order = column.desc() if sort_desc else column.asc()
    query = query.order_by(order, WarehouseBatch.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all())
