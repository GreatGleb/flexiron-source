"""Domain use case for Archive Product feature.

П44: a product is never deleted, only archived. A foreign tenant's product
and a missing one are indistinguishable — both answer `PRODUCT_NOT_FOUND`.
Archiving an already-archived product succeeds without a second write.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.products.features.archive_product.repository import (
    get_product_for_archive,
    archive_product as archive_product_repo,
)
from app.modules.products.features.archive_product.schemas import ArchiveProductResponse


async def archive_product(
    db: AsyncSession, tenant_id: UUID, product_id: UUID
) -> ArchiveProductResponse:
    """Execute the archive product use case."""
    product = await get_product_for_archive(db, product_id, tenant_id)
    if product is None:
        raise NotFoundError(entity="Product", entity_id=str(product_id))

    if product.archived_at is None:
        await archive_product_repo(db, product)

    return ArchiveProductResponse(id=product.id, is_archived=True)
