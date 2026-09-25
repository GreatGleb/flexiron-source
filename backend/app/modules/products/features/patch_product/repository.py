"""Repository for Patch Product feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.products.shared.models import Product, ProductFieldValue


async def get_product_for_update(
    db: AsyncSession, product_id: UUID, tenant_id: UUID
) -> Product | None:
    """Fetch the product row to patch, scoped to its tenant.

    This is the one selection of the product by id for the whole request —
    the response is built from this same row (see `domain.py`), not by a
    second, independent fetch, so a broken tenant filter here isn't masked
    by a later, correctly-scoped read.
    """
    result = await db.execute(
        select(Product)
        .where(
            Product.id == product_id,
            Product.tenant_id == tenant_id,
        )
        .options(selectinload(Product.field_values))
    )
    return result.scalar_one_or_none()


async def update_product(db: AsyncSession, product: Product, data: dict) -> None:
    """Apply a dict of column values onto an already tenant-scoped product.

    `updated_at` has `onupdate=func.now()` (server-computed) — after the flush
    it's expired, and the async driver can't lazy-load it outside an `await`.
    `refresh()` reloads it (and every other column) within this awaited call.
    """
    for key, value in data.items():
        setattr(product, key, value)
    await db.flush()
    await db.refresh(product)


async def replace_field_values(
    db: AsyncSession,
    product_id: UUID,
    tenant_id: UUID,
    field_values: list[tuple[UUID, str | None]],
) -> None:
    """Replace the full set of a product's field values (delete then insert)."""
    await db.execute(
        delete(ProductFieldValue).where(
            ProductFieldValue.product_id == product_id,
            ProductFieldValue.tenant_id == tenant_id,
        )
    )
    for field_id, value in field_values:
        db.add(
            ProductFieldValue(
                tenant_id=tenant_id,
                product_id=product_id,
                field_id=field_id,
                value=value,
            )
        )
    await db.flush()
