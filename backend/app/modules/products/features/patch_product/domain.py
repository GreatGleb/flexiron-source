"""Domain use case for Patch Product feature.

Merge-patch: only keys present in the request are applied. `field_values` is
the one full-array, replace-semantics key.

The response reuses `get_product_detail`'s response type and its category /
field-name / price-unit helpers — but not its own top-level fetch-by-id: that
function does its own tenant-scoped `SELECT`, and calling it here to build the
response would mean two selections of the product guard the request instead
of one, hiding a broken tenant filter on the first behind a correct one on
the second. So `get_product_for_update` is the single selection of the
product by id, and the response is assembled from that same row.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.products.features.get_product_detail.domain import (
    _reconstruct_price_unit,
)
from app.modules.products.features.get_product_detail.repository import (
    get_category_by_id,
    get_category_fields_by_ids,
)
from app.modules.products.features.get_product_detail.schemas import (
    CategoryBriefResponse,
    ProductDetailResponse,
    ProductFieldValueResponse,
)
from app.modules.products.features.patch_product.repository import (
    get_product_for_update,
    replace_field_values,
    update_product,
)
from app.modules.products.features.patch_product.schemas import PatchProductInput
from app.modules.products.shared.models import Product
from app.core.schemas import TranslatedString

_SCALAR_FIELDS = (
    "name",
    "sku",
    "description",
    "price",
    "min_stock",
    "price_quantity",
    "currency_id",
    "purchase_uom_id",
    "warehouse_uom_id",
    "sale_uom_id",
    "purchase_to_warehouse_formula_type",
    "purchase_to_warehouse_factor",
    "warehouse_to_sale_formula_type",
    "warehouse_to_sale_factor",
)


async def _to_detail_response(
    db: AsyncSession, tenant_id: UUID, product: Product
) -> ProductDetailResponse:
    """Build the card response from an already tenant-scoped product row."""
    category: CategoryBriefResponse | None = None
    if product.category_id:
        cat = await get_category_by_id(db, product.category_id, tenant_id)
        if cat:
            category = CategoryBriefResponse(
                id=cat.id, name=TranslatedString(**cat.name_translations), level=cat.level
            )

    field_ids = [fv.field_id for fv in product.field_values]
    field_defs = await get_category_fields_by_ids(db, field_ids, tenant_id)
    field_values = [
        ProductFieldValueResponse(
            field_id=fv.field_id,
            field_name=TranslatedString(**field_defs[fv.field_id].name_translations)
            if fv.field_id in field_defs
            else TranslatedString(),
            value=fv.value,
        )
        for fv in product.field_values
    ]

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
    )


async def patch_product(
    db: AsyncSession,
    tenant_id: UUID,
    product_id: UUID,
    input_data: PatchProductInput,
) -> ProductDetailResponse:
    """Execute the patch product use case."""
    product = await get_product_for_update(db, product_id, tenant_id)
    if product is None:
        raise NotFoundError(entity="Product", entity_id=str(product_id))

    provided = input_data.model_fields_set

    # Validate field ids before any write — a rejected patch must not leave a
    # partial change behind.
    field_values: list | None = None
    if "field_values" in provided:
        field_values = input_data.field_values or []
        field_ids = [fv.field_id for fv in field_values]
        known_fields = await get_category_fields_by_ids(db, field_ids, tenant_id)
        unknown_ids = [fid for fid in field_ids if fid not in known_fields]
        if unknown_ids:
            raise ValidationError(f"Unknown field id: {unknown_ids[0]}")

    updates = {
        field: getattr(input_data, field)
        for field in _SCALAR_FIELDS
        if field in provided
    }
    if updates:
        await update_product(db, product, updates)

    if field_values is not None:
        await replace_field_values(
            db,
            product_id,
            tenant_id,
            [(fv.field_id, fv.value) for fv in field_values],
        )
        await db.refresh(product, attribute_names=["field_values"])

    return await _to_detail_response(db, tenant_id, product)
