"""Repository for the products.category_card slice (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Category, CategoryField, Product


async def get_category_by_id(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> Category | None:
    """Fetch one category, scoped to its tenant."""
    result = await db.execute(
        select(Category).where(
            Category.id == category_id, Category.tenant_id == tenant_id
        )
    )
    return result.scalar_one_or_none()


async def list_tenant_categories(db: AsyncSession, tenant_id: UUID) -> list[Category]:
    """Every category of the tenant — one query.

    The domain walks the ancestor chain in memory from this set rather than one
    query per ancestor, the same shape `list_categories` already uses.
    """
    result = await db.execute(
        select(Category).where(Category.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def list_own_fields(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> list[CategoryField]:
    """A category's own field definitions, ascending by `sort_order`."""
    result = await db.execute(
        select(CategoryField)
        .where(
            CategoryField.category_id == category_id,
            CategoryField.tenant_id == tenant_id,
        )
        .order_by(CategoryField.sort_order)
    )
    return list(result.scalars().all())


async def list_fields_of_categories(
    db: AsyncSession, category_ids: list[UUID], tenant_id: UUID
) -> list[CategoryField]:
    """Own fields of several categories in one query, ascending by `sort_order`."""
    if not category_ids:
        return []
    result = await db.execute(
        select(CategoryField)
        .where(
            CategoryField.category_id.in_(category_ids),
            CategoryField.tenant_id == tenant_id,
        )
        .order_by(CategoryField.sort_order)
    )
    return list(result.scalars().all())


async def count_category_products(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> int:
    """Products carrying exactly this `category_id` — counted, not read from a column.

    There is no stored `product_count` column left to read: the count happens at
    read time, as §17 of the conventions requires.
    """
    result = await db.execute(
        select(func.count())
        .select_from(Product)
        .where(Product.category_id == category_id, Product.tenant_id == tenant_id)
    )
    return result.scalar() or 0


async def count_category_children(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> int:
    """Direct descendants of this category — counted, scoped to the tenant."""
    result = await db.execute(
        select(func.count())
        .select_from(Category)
        .where(Category.parent_id == category_id, Category.tenant_id == tenant_id)
    )
    return result.scalar() or 0


async def delete_category(
    db: AsyncSession, category_id: UUID, tenant_id: UUID
) -> int:
    """Remove the category row, scoped to its tenant.

    The category's own `category_fields` rows go with it by the foreign key's
    `ON DELETE CASCADE`; nothing is caught here.
    """
    result = await db.execute(
        delete(Category).where(
            Category.id == category_id, Category.tenant_id == tenant_id
        )
    )
    return result.rowcount or 0
