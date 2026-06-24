"""Products Internal Service API — public contract for cross-module calls.

Other modules (e.g., warehouse) MUST call these functions to get product data.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.products.shared.models import Product
from app.modules.products.features.get_product_detail.repository import (
    get_product_by_id as _get_product_by_id,
)
from app.modules.products.features.get_product_detail.repository import (
    get_category_by_id as _get_category_by_id,
)
from app.modules.products.shared.models import Category


async def get_product_by_id(
    db: AsyncSession, product_id: UUID
) -> Product | None:
    """Get a product entity by ID.

    This is the ONLY way other modules should access product data.
    Returns the ORM model (or None) — the calling module is responsible
    for mapping to its own response schemas.
    """
    return await _get_product_by_id(db, product_id)


async def get_category_by_id(
    db: AsyncSession, category_id: UUID
) -> Category | None:
    """Get a category entity by ID.

    Cross-module access point for category lookups.
    """
    return await _get_category_by_id(db, category_id)


async def count_products_by_currency(
    db: AsyncSession, tenant_id: UUID, currency_id: UUID
) -> int:
    """Count products that reference a given currency."""
    from sqlalchemy import select, func
    result = await db.execute(
        select(func.count()).where(
            Product.tenant_id == tenant_id,
            Product.currency_id == currency_id,
        )
    )
    return result.scalar() or 0


async def count_products_by_uom(
    db: AsyncSession, tenant_id: UUID, uom_id: UUID
) -> int:
    """Count products that reference a given UOM in any of the 3 UoM fields."""
    from sqlalchemy import select, func, or_
    result = await db.execute(
        select(func.count()).where(
            Product.tenant_id == tenant_id,
            or_(
                Product.purchase_uom_id == uom_id,
                Product.warehouse_uom_id == uom_id,
                Product.sale_uom_id == uom_id,
            ),
        )
    )
    return result.scalar() or 0
