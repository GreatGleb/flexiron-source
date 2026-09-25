"""Domain use case for List Products feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.schemas import TranslatedString
from app.modules.products.features.list_products.repository import (
    count_catalog as count_catalog_repo,
)
from app.modules.products.features.list_products.repository import (
    get_categories_by_ids as get_categories_by_ids_repo,
)
from app.modules.products.features.list_products.repository import (
    list_catalog as list_catalog_repo,
)
from app.modules.products.features.list_products.repository import (
    list_products as list_products_repo,
)
from app.modules.products.features.list_products.schemas import (
    ProductCatalogItem,
    ProductCatalogListResponse,
    ProductListItem,
)
from app.modules.products.shared.models import Category, Product

MAX_PAGE_SIZE = 100


async def list_products(db: AsyncSession, tenant_id: UUID) -> list[ProductListItem]:
    """Execute the list products use case — id + name, deterministic order."""
    products = await list_products_repo(db, tenant_id)
    return [ProductListItem(id=product.id, name=product.name) for product in products]


def _normalize_search(search: str | None) -> str | None:
    """Empty string means "no filter" (§13 conventions)."""
    if search is None or not search.strip():
        return None
    return search


def _parse_category_ids(raw: str | None) -> list[UUID] | None:
    """Comma-separated id list, or `None` when the client sent none at all."""
    if not raw:
        return None
    ids: list[UUID] = []
    for piece in raw.split(","):
        piece = piece.strip()
        if not piece:
            continue
        try:
            ids.append(UUID(piece))
        except ValueError:
            raise ValidationError(f"Invalid categoryIds entry: {piece!r}")
    return ids or None


def _to_catalog_item(product: Product, category: Category | None) -> ProductCatalogItem:
    return ProductCatalogItem(
        id=product.id,
        name=product.name,
        categoryId=product.category_id,
        categoryName=TranslatedString(**category.name_translations) if category else None,
        sku=product.sku,
        price=float(product.price) if product.price is not None else None,
        minStock=float(product.min_stock) if product.min_stock is not None else None,
        createdAt=product.created_at,
        saleUomId=product.sale_uom_id,
        warehouseUomId=product.warehouse_uom_id,
        warehouseToSaleFactor=float(product.warehouse_to_sale_factor)
            if product.warehouse_to_sale_factor is not None else None,
    )


async def list_products_catalog(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    category_ids_raw: str | None,
    sort_by: str | None,
    sort_dir: str,
    page: int,
    page_size: int,
) -> ProductCatalogListResponse:
    """Execute the paginated catalog use case (`GET /api/products`).

    Sorting rule (contract "GET /api/products", домен 7): no `sort_by` means
    no order is imposed at all, not a fallback order — the repository skips
    `ORDER BY` entirely in that case.
    """
    search = _normalize_search(search)
    category_ids = _parse_category_ids(category_ids_raw)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)
    sort_desc = sort_dir == "desc"

    total = await count_catalog_repo(db, tenant_id, search=search, category_ids=category_ids)
    products = await list_catalog_repo(
        db,
        tenant_id,
        search=search,
        category_ids=category_ids,
        sort_by=sort_by,
        sort_desc=sort_desc,
        page=page,
        page_size=page_size,
    )

    present_category_ids = list({p.category_id for p in products if p.category_id is not None})
    categories = await get_categories_by_ids_repo(db, present_category_ids, tenant_id)

    return ProductCatalogListResponse(
        items=[_to_catalog_item(p, categories.get(p.category_id)) for p in products],
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )
