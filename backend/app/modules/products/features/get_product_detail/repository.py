"""Repository for Get Product Detail feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.products.shared.models import Product, ProductFieldValue
from app.modules.products.shared.models import Category, CategoryField


async def get_product_by_id(
    db: AsyncSession, product_id: UUID, tenant_id: UUID
) -> Product | None:
    """Fetch a product with its field values, scoped to its tenant."""
    result = await db.execute(
        select(Product)
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
        .options(selectinload(Product.field_values))
    )
    return result.scalar_one_or_none()


async def get_category_by_id(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> Category | None:
    """Fetch a category by ID, scoped to its tenant."""
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.tenant_id == tenant_id
        )
    )
    return result.scalar_one_or_none()


MAX_CATEGORY_DEPTH = 100


async def get_category_level(
    db: AsyncSession, category: Category, tenant_id: UUID
) -> int:
    """Derive a category's depth by walking `parent_id` up to the root (П68).

    Bounded by `MAX_CATEGORY_DEPTH` so a broken parent chain (a cycle, or a
    dangling reference) can't turn this into an infinite loop.
    """
    level = 0
    current = category
    while current.parent_id is not None:
        level += 1
        if level > MAX_CATEGORY_DEPTH:
            return level
        result = await db.execute(
            select(Category).where(
                Category.id == current.parent_id, Category.tenant_id == tenant_id
            )
        )
        parent = result.scalar_one_or_none()
        if parent is None:
            return level
        current = parent
    return level


async def get_category_fields_by_ids(
    db: AsyncSession, field_ids: list[UUID], tenant_id: UUID
) -> dict[UUID, CategoryField]:
    """Fetch field definitions for the given ids in one query, scoped to tenant."""
    if not field_ids:
        return {}
    result = await db.execute(
        select(CategoryField).where(
            CategoryField.id.in_(field_ids), CategoryField.tenant_id == tenant_id
        )
    )
    return {field.id: field for field in result.scalars().all()}
