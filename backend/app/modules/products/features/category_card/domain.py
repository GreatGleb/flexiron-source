"""Domain use case for the products.category_card slice.

Pure business logic — no FastAPI, no SQL built here. Two refusals for an unknown
or foreign category, and two conflict codes the delete checks in the same order
the mock does (`roo_code/roo-context/api/categories.md`,
`DELETE /api/categories/:id`).
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.core.schemas import TranslatedString
from app.modules.products.shared.models import Category, CategoryField

from .repository import (
    count_category_children,
    count_category_products,
    get_category_by_id,
    list_fields_of_categories,
    list_own_fields,
    list_tenant_categories,
)
from .repository import delete_category as delete_category_repo
from .schemas import CategoryDetailResponse, CategoryFieldResponse

#: Ceiling on the ancestor walk — the same guard `get_category_level` applies in
#: the sibling `get_product_detail` slice, so a broken `parent_id` chain (a cycle,
#: or a dangling reference) cannot turn the read into an endless loop.
MAX_ANCESTOR_DEPTH = 100


class CategoryNotFoundError(NotFoundError):
    """404 carrying the domain's own code — `CATEGORY_NOT_FOUND`.

    `NotFoundError.__init__` hardcodes `code="NOT_FOUND"`, so the domain code is
    set on the instance afterwards; `isinstance(exc, NotFoundError)` still holds,
    so the `AppError` handler in `app.main` answers 404 unchanged.
    """

    def __init__(self, category_id: UUID) -> None:
        super().__init__(entity="Category", entity_id=str(category_id))
        self.code = "CATEGORY_NOT_FOUND"


class CategoryHasProductsError(ConflictError):
    """409 carrying the domain's own code — `CATEGORY_HAS_PRODUCTS`."""

    def __init__(self, category_id: UUID) -> None:
        super().__init__(f"Category has products: {category_id}")
        self.code = "CATEGORY_HAS_PRODUCTS"


class CategoryHasChildrenError(ConflictError):
    """409 carrying the domain's own code — `CATEGORY_HAS_CHILDREN`."""

    def __init__(self, category_id: UUID) -> None:
        super().__init__(f"Category has children: {category_id}")
        self.code = "CATEGORY_HAS_CHILDREN"


def _ancestor_chain(category: Category, by_id: dict[UUID, Category]) -> list[Category]:
    """Ancestors of `category`, farthest ancestor first.

    Bounded by `MAX_ANCESTOR_DEPTH`. A parent missing from the tenant's own
    categories ends the walk rather than failing it — the chain is only read to
    assemble the inherited field set.
    """
    chain: list[Category] = []
    current = category
    for _ in range(MAX_ANCESTOR_DEPTH):
        if current.parent_id is None:
            break
        parent = by_id.get(current.parent_id)
        if parent is None:
            break
        chain.append(parent)
        current = parent
    chain.reverse()
    return chain


def _to_options(raw: object) -> list[TranslatedString]:
    """Enum options live in the `JSON` column; anything else is no options at all."""
    if not isinstance(raw, list):
        return []
    return [
        TranslatedString(**option) for option in raw if isinstance(option, dict)
    ]


def _to_field(field: CategoryField) -> CategoryFieldResponse:
    """Map an ORM field onto the contract's shape — the column names renamed."""
    return CategoryFieldResponse(
        id=field.id,
        name=TranslatedString(**field.name_translations),
        type=field.field_type,
        required=field.required,
        order=field.sort_order,
        options=_to_options(field.options),
    )


async def get_category_card(
    db: AsyncSession, tenant_id: UUID, category_id: UUID
) -> CategoryDetailResponse:
    """Read one category: its own fields and every ancestor's, computed at read time."""
    category = await get_category_by_id(db, category_id, tenant_id)
    if category is None:
        raise CategoryNotFoundError(category_id)

    by_id = {item.id: item for item in await list_tenant_categories(db, tenant_id)}
    ancestors = _ancestor_chain(category, by_id)

    own_fields = await list_own_fields(db, category_id, tenant_id)

    inherited: list[CategoryField] = []
    if ancestors:
        ancestor_ids = [ancestor.id for ancestor in ancestors]
        grouped: dict[UUID, list[CategoryField]] = {
            ancestor_id: [] for ancestor_id in ancestor_ids
        }
        for field in await list_fields_of_categories(db, ancestor_ids, tenant_id):
            grouped[field.category_id].append(field)
        # Farthest ancestor first, each ancestor's own fields in `sort_order`; two
        # fields sharing a name are both kept — collapsing them would change the
        # product's field set silently.
        for ancestor in ancestors:
            inherited.extend(grouped[ancestor.id])

    product_count = await count_category_products(db, category_id, tenant_id)
    description = category.description_translations or None

    return CategoryDetailResponse(
        id=category.id,
        name=TranslatedString(**category.name_translations),
        parentId=category.parent_id,
        description=TranslatedString(**description) if description else None,
        fieldCount=len(own_fields),
        productCount=product_count,
        inheritedFields=[_to_field(field) for field in inherited],
        fields=[_to_field(field) for field in own_fields],
        linkedSuppliers=[],
    )


async def delete_category(
    db: AsyncSession, tenant_id: UUID, category_id: UUID
) -> None:
    """Delete a category, refusing in the order the mock checks.

    `CATEGORY_NOT_FOUND` first, then `CATEGORY_HAS_PRODUCTS`, then
    `CATEGORY_HAS_CHILDREN` — each conflict counted by a query, not read from a
    stored column.
    """
    category = await get_category_by_id(db, category_id, tenant_id)
    if category is None:
        raise CategoryNotFoundError(category_id)

    if await count_category_products(db, category_id, tenant_id) > 0:
        raise CategoryHasProductsError(category_id)

    if await count_category_children(db, category_id, tenant_id) > 0:
        raise CategoryHasChildrenError(category_id)

    await delete_category_repo(db, category_id, tenant_id)
