"""Repository for List Products feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Category, Product


async def list_products(db: AsyncSession, tenant_id: UUID) -> list[Product]:
    """Fetch every product of the tenant, ordered by name then id."""
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id)
        .order_by(Product.name.asc(), Product.id.asc())
    )
    return list(result.scalars().all())


#: Locale fallback order for sorting by a JSONB-translated field — matches
#: `_reconstruct_price_unit` in `get_product_detail/domain.py` (en, then ru,
#: then lt). No client-facing locale-selection param exists for this sort.
_CATEGORY_NAME_SORT_LOCALES = ("en", "ru", "lt")


def _category_name_sort_column():
    return func.coalesce(
        *(Category.name_translations[locale].as_string() for locale in _CATEGORY_NAME_SORT_LOCALES),
        "",
    )


async def _catalog_query(
    tenant_id: UUID, *, search: str | None, category_ids: list[UUID] | None
):
    """Shared WHERE clause for both the count and the page — one place for the rule."""
    query = select(Product).where(Product.tenant_id == tenant_id)
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Product.sku.ilike(pattern), Product.name.ilike(pattern)))
    if category_ids:
        # `category_id IN (...)` never matches a NULL column — a product
        # without a category is excluded by construction, not by a guard.
        query = query.where(Product.category_id.in_(category_ids))
    return query


async def count_catalog(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    category_ids: list[UUID] | None,
) -> int:
    """Total rows matching the filters, tenant-scoped."""
    query = await _catalog_query(tenant_id, search=search, category_ids=category_ids)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_catalog(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    category_ids: list[UUID] | None,
    sort_by: str | None,
    sort_desc: bool,
    page: int,
    page_size: int,
) -> list[Product]:
    """One page of the catalog, tenant-scoped, filtered and (optionally) sorted.

    No `sort_by` means no `ORDER BY` at all — the order is whatever the
    storage returns, not an order this slice invents (contract "GET
    /api/products": "без sortBy порядок выдачи — порядок хранилища").
    """
    query = await _catalog_query(tenant_id, search=search, category_ids=category_ids)
    if sort_by == "category":
        query = query.outerjoin(Category, Product.category_id == Category.id)
        column = _category_name_sort_column()
        query = query.order_by(column.desc() if sort_desc else column.asc())
    elif sort_by == "price":
        query = query.order_by(Product.price.desc() if sort_desc else Product.price.asc())
    elif sort_by == "name":
        query = query.order_by(Product.name.desc() if sort_desc else Product.name.asc())

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_categories_by_ids(
    db: AsyncSession, category_ids: list[UUID], tenant_id: UUID
) -> dict[UUID, Category]:
    """Fetch category rows for the given ids in one query, scoped to tenant."""
    if not category_ids:
        return {}
    result = await db.execute(
        select(Category).where(
            Category.id.in_(category_ids), Category.tenant_id == tenant_id
        )
    )
    return {category.id: category for category in result.scalars().all()}
