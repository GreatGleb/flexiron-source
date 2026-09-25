"""Repository for the products.list_categories slice (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Category, CategoryField, Product


async def list_all_categories(db: AsyncSession, tenant_id: UUID) -> list[Category]:
    """Every category of the tenant — one query.

    The domain layer builds the tree, the depth-first order and each row's
    `level`/`parentName` from this set in memory rather than one query per
    ancestor (contract `categories.md`, §17 "Производные значения").
    """
    result = await db.execute(select(Category).where(Category.tenant_id == tenant_id))
    return list(result.scalars().all())


async def count_own_fields(
    db: AsyncSession, tenant_id: UUID, category_ids: list[UUID]
) -> dict[UUID, int]:
    """Own `category_fields` rows per category, grouped — `fieldCount` excludes
    inherited fields (contract `categories.md`, "Правила домена", rule 4)."""
    if not category_ids:
        return {}
    result = await db.execute(
        select(CategoryField.category_id, func.count())
        .where(
            CategoryField.tenant_id == tenant_id,
            CategoryField.category_id.in_(category_ids),
        )
        .group_by(CategoryField.category_id)
    )
    return dict(result.all())


async def count_own_products(
    db: AsyncSession, tenant_id: UUID, category_ids: list[UUID]
) -> dict[UUID, int]:
    """Products carrying exactly this `category_id`, grouped — own only, not the
    subtree (task brief for `products.list_categories`)."""
    if not category_ids:
        return {}
    result = await db.execute(
        select(Product.category_id, func.count())
        .where(
            Product.tenant_id == tenant_id,
            Product.category_id.in_(category_ids),
        )
        .group_by(Product.category_id)
    )
    return dict(result.all())
