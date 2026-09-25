"""Domain use case for the products.list_categories slice.

Contains pure business logic — no FastAPI, no DB session management.
"""

from collections import defaultdict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schemas import PaginatedResponse, TranslatedString
from app.modules.products.shared.models import Category

from .repository import count_own_fields, count_own_products, list_all_categories
from .schemas import CategoryListItem

MAX_PAGE_SIZE = 100

#: The three locales a name search checks — description never participates
#: (contract `categories.md`, "Правила домена", rule 6).
SEARCH_LOCALES = ("ru", "en", "lt")


def _normalize_search(search: str | None) -> str | None:
    """Empty `search` means "no filter" (contract `categories.md`, "GET /api/categories")."""
    if search is None or not search.strip():
        return None
    return search.strip()


def _matches_search(category: Category, needle: str) -> bool:
    needle = needle.lower()
    return any(
        needle in (category.name_translations.get(locale) or "").lower()
        for locale in SEARCH_LOCALES
    )


def _depth_first_order(categories: list[Category]) -> list[UUID]:
    """Roots sorted by `name.en`, each child placed right after its own parent,
    recursively — the order an empty `search` returns (contract `categories.md`,
    "GET /api/categories", "Порядок выдачи")."""
    children: dict[UUID | None, list[Category]] = defaultdict(list)
    for category in categories:
        children[category.parent_id].append(category)
    for group in children.values():
        group.sort(key=lambda c: c.name_translations.get("en") or "")

    order: list[UUID] = []

    def visit(parent_id: UUID | None) -> None:
        for category in children.get(parent_id, []):
            order.append(category.id)
            visit(category.id)

    visit(None)
    return order


def _flat_search_order(categories: list[Category]) -> list[UUID]:
    """Flat, sorted by `name.en` — the order a non-empty `search` returns (same section)."""
    return [
        category.id
        for category in sorted(categories, key=lambda c: c.name_translations.get("en") or "")
    ]


def _level(category_id: UUID, by_id: dict[UUID, Category]) -> int:
    """Depth counted by climbing `parent_id` — 0 for a root."""
    level = 0
    current = by_id.get(category_id)
    while current is not None and current.parent_id is not None:
        level += 1
        current = by_id.get(current.parent_id)
    return level


async def list_categories(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    search: str | None,
    page: int,
    page_size: int,
) -> PaginatedResponse[CategoryListItem]:
    """Execute the list categories use case."""
    search = _normalize_search(search)
    page = max(page, 1)
    page_size = min(max(page_size, 1), MAX_PAGE_SIZE)

    all_categories = await list_all_categories(db, tenant_id)
    by_id = {category.id: category for category in all_categories}

    if search is None:
        order = _depth_first_order(all_categories)
    else:
        matched = [c for c in all_categories if _matches_search(c, search)]
        order = _flat_search_order(matched)

    total = len(order)
    page_ids = order[(page - 1) * page_size : page * page_size]

    field_counts = await count_own_fields(db, tenant_id, page_ids)
    product_counts = await count_own_products(db, tenant_id, page_ids)

    items = []
    for category_id in page_ids:
        category = by_id[category_id]
        parent = by_id.get(category.parent_id) if category.parent_id else None
        items.append(
            CategoryListItem(
                id=category.id,
                name=TranslatedString(**category.name_translations),
                parentId=category.parent_id,
                parentName=TranslatedString(**parent.name_translations) if parent else None,
                fieldCount=field_counts.get(category.id, 0),
                productCount=product_counts.get(category.id, 0),
                level=_level(category.id, by_id),
            )
        )

    return PaginatedResponse[CategoryListItem](
        items=items,
        total=total,
        page=page,
        pageSize=page_size,
        totalPages=max(1, -(-total // page_size)),
    )
