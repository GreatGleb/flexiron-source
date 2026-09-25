"""Domain use case for Get Product Detail feature.

Contains pure business logic — no FastAPI, no DB session management.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.schemas import TranslatedString
from app.modules.products.features.get_product_detail.repository import (
    get_product_by_id,
    get_category_by_id,
    get_category_fields_by_ids,
    get_category_level,
)
from app.modules.products.features.get_product_detail.schemas import (
    ProductDetailResponse,
    CategoryBriefResponse,
    ProductFieldValueResponse,
)
from app.modules.settings.internal_api.interface import (
    get_currency_by_id,
    get_uom_by_id,
)


async def _reconstruct_price_unit(
    db: AsyncSession, tenant_id: UUID, currency_id: UUID | None, uom_id: UUID | None
) -> str | None:
    """Reconstruct legacy 'EUR/kg' style price_unit from FK references."""
    if not currency_id or not uom_id:
        return None
    currency = await get_currency_by_id(db, currency_id, tenant_id)
    uom = await get_uom_by_id(db, uom_id, tenant_id)
    if not currency or not uom:
        return None
    # Get the code from the first available language
    uom_code = (
        uom.code_translations.get("en")
        or uom.code_translations.get("ru")
        or uom.code_translations.get("lt")
    )
    if not uom_code:
        return None
    return f"{currency.code}/{uom_code}"


async def get_product_detail(
    db: AsyncSession, tenant_id: UUID, product_id: UUID
) -> ProductDetailResponse:
    """Execute the get product detail use case."""
    product = await get_product_by_id(db, product_id, tenant_id)
    if product is None:
        raise NotFoundError(entity="Product", entity_id=str(product_id))

    # Fetch category if present
    category: CategoryBriefResponse | None = None
    if product.category_id:
        cat = await get_category_by_id(db, product.category_id, tenant_id)
        if cat:
            level = await get_category_level(db, cat, tenant_id)
            category = CategoryBriefResponse(
                id=cat.id,
                name=TranslatedString(**cat.name_translations),
                level=level,
            )

    # Map field values — one bulk lookup of their definitions, not one per value
    field_ids = [fv.field_id for fv in product.field_values]
    field_defs = await get_category_fields_by_ids(db, field_ids, tenant_id)
    field_values = [
        ProductFieldValueResponse(
            field_id=fv.field_id,
            field_name=TranslatedString(**field_defs[fv.field_id].name_translations)
                if fv.field_id in field_defs else TranslatedString(),
            value=fv.value,
        )
        for fv in product.field_values
    ]

    # Reconstruct legacy price_unit for backward compatibility
    price_unit = await _reconstruct_price_unit(
        db, tenant_id, product.currency_id, product.sale_uom_id
    )

    return ProductDetailResponse(
        id=product.id,
        name=product.name,
        sku=product.sku,
        description=product.description,
        price=float(product.price) if product.price is not None else None,
        price_unit=price_unit,
        price_quantity=product.price_quantity,
        currency_id=product.currency_id,
        min_stock=float(product.min_stock) if product.min_stock is not None else None,
        purchase_uom_id=product.purchase_uom_id,
        warehouse_uom_id=product.warehouse_uom_id,
        sale_uom_id=product.sale_uom_id,
        purchase_to_warehouse_formula_type=product.purchase_to_warehouse_formula_type,
        purchase_to_warehouse_factor=float(product.purchase_to_warehouse_factor)
            if product.purchase_to_warehouse_factor is not None else None,
        warehouse_to_sale_formula_type=product.warehouse_to_sale_formula_type,
        warehouse_to_sale_factor=float(product.warehouse_to_sale_factor)
            if product.warehouse_to_sale_factor is not None else None,
        category=category,
        field_values=field_values,
        created_at=product.created_at,
        updated_at=product.updated_at,
        is_archived=product.archived_at is not None,
    )
