"""Action (Routes) for Settings CRUD operations.

Provides GET/PATCH/POST/DELETE for all settings sub-resources:
  - Company, Constants (singleton per tenant)
  - Currencies, UOMs, Conversions, Order Statuses (collections per tenant)

Requires Bearer session token (same as /api/settings/profile).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError, ValidationError, ConflictError, ForbiddenError
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

class SettingsListResponse(ApiResponse):
    """Collection envelope keeps the existing array-shaped wire contract."""

    data: list[dict] | None = None


router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("/company", response_model=ApiResponse)
async def get_company_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get company info for the current tenant."""
    tenant_id = current_user.tenant_id
    result = await get_company_info(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/company", response_model=ApiResponse)
async def patch_company_route(
    input_data: CompanyPatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update company info (merge-patch)."""
    tenant_id = current_user.tenant_id
    result = await patch_company_info(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Constants
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/constants", response_model=ApiResponse)
async def get_constants_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get global financial constants."""
    tenant_id = current_user.tenant_id
    result = await get_global_constants(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/constants", response_model=ApiResponse)
async def patch_constants_route(
    input_data: ConstantsPatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update global constants (merge-patch)."""
    tenant_id = current_user.tenant_id
    result = await patch_global_constants(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Currencies
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/currencies", response_model=SettingsListResponse)
async def get_currencies_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all currencies for the tenant."""
    tenant_id = current_user.tenant_id
    result = await list_currencies(db, tenant_id)
    return SettingsListResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/currencies", response_model=ApiResponse)
async def create_currency_route(
    input_data: CurrencyCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new currency."""
    tenant_id = current_user.tenant_id
    try:
        result = await create_currency_item(db, tenant_id, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json", by_alias=True),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )


@router.patch("/currencies/{currency_id}", response_model=ApiResponse)
async def patch_currency_route(
    currency_id: uuid.UUID,
    input_data: CurrencyPatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a currency."""
    tenant_id = current_user.tenant_id
    try:
        result = await update_currency_item(db, currency_id, tenant_id, input_data)
    except NotFoundError as e:
        raise HTTPException(404, detail={"message": e.message, "code": e.code}) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/currencies/{currency_id}", response_model=ApiResponse)
async def delete_currency_route(
    currency_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a currency."""
    try:
        tenant_id = current_user.tenant_id
        await remove_currency_item(db, currency_id, tenant_id)
        return ApiResponse(success=True, message="Currency deleted")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )


# ═══════════════════════════════════════════════════════════════════════════
#  UOMs
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/uoms", response_model=SettingsListResponse)
async def get_uoms_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all units of measure."""
    tenant_id = current_user.tenant_id
    result = await list_uoms(db, tenant_id)
    return SettingsListResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/uoms", response_model=ApiResponse)
async def create_uom_route(
    input_data: UomCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new unit of measure."""
    tenant_id = current_user.tenant_id
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
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a unit of measure."""
    tenant_id = current_user.tenant_id
    try:
        result = await update_uom_item(db, uom_id, tenant_id, input_data)
    except NotFoundError as e:
        raise HTTPException(404, detail={"message": e.message, "code": e.code}) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/uoms/{uom_id}", response_model=ApiResponse)
async def delete_uom_route(
    uom_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a unit of measure."""
    try:
        tenant_id = current_user.tenant_id
        await remove_uom_item(db, uom_id, tenant_id)
        return ApiResponse(success=True, message="UOM deleted")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )


# ═══════════════════════════════════════════════════════════════════════════
#  Conversions
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/conversions", response_model=SettingsListResponse)
async def get_conversions_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all conversion rules."""
    tenant_id = current_user.tenant_id
    result = await list_conversions(db, tenant_id)
    return SettingsListResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/conversions", response_model=ApiResponse)
async def create_conversion_route(
    input_data: ConversionCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new conversion rule."""
    tenant_id = current_user.tenant_id
    try:
        result = await create_conversion_item(db, tenant_id, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json", by_alias=True),
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )


@router.patch("/conversions/{conv_id}", response_model=ApiResponse)
async def patch_conversion_route(
    conv_id: uuid.UUID,
    input_data: ConversionPatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a conversion rule."""
    tenant_id = current_user.tenant_id
    try:
        result = await update_conversion_item(db, conv_id, tenant_id, input_data)
    except NotFoundError as e:
        raise HTTPException(404, detail={"message": e.message, "code": e.code}) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/conversions/{conv_id}", response_model=ApiResponse)
async def delete_conversion_route(
    conv_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a conversion rule."""
    tenant_id = current_user.tenant_id
    try:
        await remove_conversion_item(db, conv_id, tenant_id)
    except NotFoundError as e:
        raise HTTPException(404, detail={"message": e.message, "code": e.code}) from e
    return ApiResponse(success=True, message="Conversion deleted")


# ═══════════════════════════════════════════════════════════════════════════
#  Order Statuses
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/order-statuses", response_model=SettingsListResponse)
async def get_order_statuses_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all order statuses (sorted by sort_order)."""
    tenant_id = current_user.tenant_id
    result = await list_order_statuses(db, tenant_id)
    return SettingsListResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/order-statuses", response_model=ApiResponse)
async def create_order_status_route(
    input_data: OrderStatusCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new order status."""
    tenant_id = current_user.tenant_id
    result = await create_order_status_item(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.put("/order-statuses/reorder", response_model=ApiResponse)
async def reorder_order_statuses_route(
    input_data: OrderStatusReorderInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Reorder order statuses."""
    tenant_id = current_user.tenant_id
    await reorder_statuses(db, tenant_id, input_data.ordered_ids)
    return ApiResponse(success=True, message="Statuses reordered")


@router.patch("/order-statuses/{status_id}", response_model=ApiResponse)
async def patch_order_status_route(
    status_id: uuid.UUID,
    input_data: OrderStatusPatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update an order status."""
    tenant_id = current_user.tenant_id
    try:
        result = await update_order_status_item(db, status_id, tenant_id, input_data)
    except NotFoundError as e:
        raise HTTPException(404, detail={"message": e.message, "code": e.code}) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/order-statuses/{status_id}", response_model=ApiResponse)
async def delete_order_status_route(
    status_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete an order status."""
    try:
        tenant_id = current_user.tenant_id
        await remove_order_status_item(db, status_id, tenant_id)
        return ApiResponse(success=True, message="Order status deleted")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ForbiddenError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"message": e.message, "code": e.code},
        )


# ═══════════════════════════════════════════════════════════════════════════
#  Order Permissions
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/order-permissions", response_model=ApiResponse)
async def get_order_permissions_route(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get the order pricing permission matrix (seeCost/manualCost/correction)."""
    from app.modules.settings.features.crud.domain import get_order_permissions_matrix

    tenant_id = current_user.tenant_id
    result = await get_order_permissions_matrix(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )
