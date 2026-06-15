"""Action (Routes) for Settings CRUD operations.

Provides GET/PATCH/POST/DELETE for all settings sub-resources:
  - Company, Constants (singleton per tenant)
  - Currencies, UOMs, Conversions, Order Statuses (collections per tenant)
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from app.modules.settings.features.crud.schemas import (
    CompanyPatchInput,
    ConstantsPatchInput,
    CurrencyCreateInput,
    CurrencyPatchInput,
    UomCreateInput,
    UomPatchInput,
    ConversionCreateInput,
    ConversionPatchInput,
    OrderStatusCreateInput,
    OrderStatusPatchInput,
    OrderStatusReorderInput,
)
from app.modules.settings.features.crud.repository import (
    get_tenant_id_for_user,
    get_company,
    patch_company,
    create_company,
    get_constants,
    patch_constants,
    create_constants,
    get_currencies,
    get_currency,
    create_currency,
    patch_currency,
    delete_currency,
    get_uoms,
    get_uom,
    create_uom,
    patch_uom,
    delete_uom,
    get_conversions,
    get_conversion,
    create_conversion,
    patch_conversion,
    delete_conversion,
    get_order_statuses,
    get_order_status,
    create_order_status,
    patch_order_status,
    delete_order_status,
    reorder_order_statuses,
)
from app.modules.settings.features.crud.domain import (
    get_company_info,
    patch_company_info,
    get_global_constants,
    patch_global_constants,
    list_currencies,
    create_currency_item,
    update_currency_item,
    remove_currency_item,
    list_uoms,
    create_uom_item,
    update_uom_item,
    remove_uom_item,
    list_conversions,
    create_conversion_item,
    update_conversion_item,
    remove_conversion_item,
    list_order_statuses,
    create_order_status_item,
    update_order_status_item,
    remove_order_status_item,
    reorder_statuses,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ─── Demo user ID placeholder ─────────────────────────────────────────────
DEMO_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _get_tenant(db: AsyncSession) -> uuid.UUID:
    """Resolve tenant ID for the demo user (or raise 404)."""
    tenant_id = await get_tenant_id_for_user(db, DEMO_USER_ID)
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "User has no tenant", "code": "NOT_FOUND"},
        )
    return tenant_id


# ═══════════════════════════════════════════════════════════════════════════
#  Company
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/company", response_model=ApiResponse)
async def get_company_route(db: AsyncSession = Depends(get_db)):
    """Get company info for the current tenant."""
    tenant_id = await _get_tenant(db)
    result = await get_company_info(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/company", response_model=ApiResponse)
async def patch_company_route(
    input_data: CompanyPatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Update company info (merge-patch)."""
    tenant_id = await _get_tenant(db)
    result = await patch_company_info(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Constants
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/constants", response_model=ApiResponse)
async def get_constants_route(db: AsyncSession = Depends(get_db)):
    """Get global financial constants."""
    tenant_id = await _get_tenant(db)
    result = await get_global_constants(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/constants", response_model=ApiResponse)
async def patch_constants_route(
    input_data: ConstantsPatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Update global constants (merge-patch)."""
    tenant_id = await _get_tenant(db)
    result = await patch_global_constants(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Currencies
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/currencies", response_model=ApiResponse)
async def get_currencies_route(db: AsyncSession = Depends(get_db)):
    """List all currencies for the tenant."""
    tenant_id = await _get_tenant(db)
    result = await list_currencies(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/currencies", response_model=ApiResponse)
async def create_currency_route(
    input_data: CurrencyCreateInput,
    db: AsyncSession = Depends(get_db),
):
    """Create a new currency."""
    tenant_id = await _get_tenant(db)
    result = await create_currency_item(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/currencies/{currency_id}", response_model=ApiResponse)
async def patch_currency_route(
    currency_id: uuid.UUID,
    input_data: CurrencyPatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Update a currency."""
    result = await update_currency_item(db, currency_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/currencies/{currency_id}", response_model=ApiResponse)
async def delete_currency_route(
    currency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a currency."""
    await remove_currency_item(db, currency_id)
    return ApiResponse(success=True, message="Currency deleted")


# ═══════════════════════════════════════════════════════════════════════════
#  UOMs
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/uoms", response_model=ApiResponse)
async def get_uoms_route(db: AsyncSession = Depends(get_db)):
    """List all units of measure."""
    tenant_id = await _get_tenant(db)
    result = await list_uoms(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/uoms", response_model=ApiResponse)
async def create_uom_route(
    input_data: UomCreateInput,
    db: AsyncSession = Depends(get_db),
):
    """Create a new unit of measure."""
    tenant_id = await _get_tenant(db)
    result = await create_uom_item(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/uoms/{uom_id}", response_model=ApiResponse)
async def patch_uom_route(
    uom_id: uuid.UUID,
    input_data: UomPatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Update a unit of measure."""
    result = await update_uom_item(db, uom_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/uoms/{uom_id}", response_model=ApiResponse)
async def delete_uom_route(
    uom_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a unit of measure."""
    await remove_uom_item(db, uom_id)
    return ApiResponse(success=True, message="UOM deleted")


# ═══════════════════════════════════════════════════════════════════════════
#  Conversions
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/conversions", response_model=ApiResponse)
async def get_conversions_route(db: AsyncSession = Depends(get_db)):
    """List all conversion rules."""
    tenant_id = await _get_tenant(db)
    result = await list_conversions(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/conversions", response_model=ApiResponse)
async def create_conversion_route(
    input_data: ConversionCreateInput,
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversion rule."""
    tenant_id = await _get_tenant(db)
    result = await create_conversion_item(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/conversions/{conv_id}", response_model=ApiResponse)
async def patch_conversion_route(
    conv_id: uuid.UUID,
    input_data: ConversionPatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Update a conversion rule."""
    result = await update_conversion_item(db, conv_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/conversions/{conv_id}", response_model=ApiResponse)
async def delete_conversion_route(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a conversion rule."""
    await remove_conversion_item(db, conv_id)
    return ApiResponse(success=True, message="Conversion deleted")


# ═══════════════════════════════════════════════════════════════════════════
#  Order Statuses
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/order-statuses", response_model=ApiResponse)
async def get_order_statuses_route(db: AsyncSession = Depends(get_db)):
    """List all order statuses (sorted by sort_order)."""
    tenant_id = await _get_tenant(db)
    result = await list_order_statuses(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/order-statuses", response_model=ApiResponse)
async def create_order_status_route(
    input_data: OrderStatusCreateInput,
    db: AsyncSession = Depends(get_db),
):
    """Create a new order status."""
    tenant_id = await _get_tenant(db)
    result = await create_order_status_item(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.put("/order-statuses/reorder", response_model=ApiResponse)
async def reorder_order_statuses_route(
    input_data: OrderStatusReorderInput,
    db: AsyncSession = Depends(get_db),
):
    """Reorder order statuses."""
    tenant_id = await _get_tenant(db)
    await reorder_statuses(db, tenant_id, input_data.ordered_ids)
    return ApiResponse(success=True, message="Statuses reordered")


@router.patch("/order-statuses/{status_id}", response_model=ApiResponse)
async def patch_order_status_route(
    status_id: uuid.UUID,
    input_data: OrderStatusPatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Update an order status."""
    result = await update_order_status_item(db, status_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/order-statuses/{status_id}", response_model=ApiResponse)
async def delete_order_status_route(
    status_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete an order status."""
    await remove_order_status_item(db, status_id)
    return ApiResponse(success=True, message="Order status deleted")
