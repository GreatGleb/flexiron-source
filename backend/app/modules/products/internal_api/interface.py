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
