"""Action (Routes) for Settings CRUD operations.

Provides GET/PATCH/POST/DELETE for all settings sub-resources:
  - Company, Constants (singleton per tenant)
  - Currencies, UOMs, Conversions, Order Statuses (collections per tenant)

Requires Bearer session token (same as /api/settings/profile).
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
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

# ─── Session token serializer ────────────────────────────────────────────
_serializer = URLSafeTimedSerializer(
    secret_key=app_settings.secret_key,
    salt="session",
)


async def _resolve_user_id(
    authorization: Optional[str] = Header(None),
) -> uuid.UUID:
    """Extract user_id from the Bearer session token.

    Reads the Authorization header, validates the token, and returns
    the embedded user_id.  Raises 401 if the token is missing or invalid.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Missing Authorization header", "code": "UNAUTHORIZED"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid Authorization header", "code": "UNAUTHORIZED"},
        )

    try:
        data = _serializer.loads(token)
        user_id_str = data.get("user_id")
        if not user_id_str:
            raise ValueError("Missing user_id in token")
        return uuid.UUID(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid or expired session token", "code": "UNAUTHORIZED"},
        )


async def _get_tenant(db: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    """Resolve tenant ID for the authenticated user (or raise 404)."""
    tenant_id = await get_tenant_id_for_user(db, user_id)
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
async def get_company_route(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Get company info for the current tenant."""
    tenant_id = await _get_tenant(db, user_id)
    result = await get_company_info(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/company", response_model=ApiResponse)
async def patch_company_route(
    input_data: CompanyPatchInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Update company info (merge-patch)."""
    tenant_id = await _get_tenant(db, user_id)
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
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Get global financial constants."""
    tenant_id = await _get_tenant(db, user_id)
    result = await get_global_constants(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/constants", response_model=ApiResponse)
async def patch_constants_route(
    input_data: ConstantsPatchInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Update global constants (merge-patch)."""
    tenant_id = await _get_tenant(db, user_id)
    result = await patch_global_constants(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


# ═══════════════════════════════════════════════════════════════════════════
#  Currencies
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/currencies", response_model=ApiResponse)
async def get_currencies_route(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """List all currencies for the tenant."""
    tenant_id = await _get_tenant(db, user_id)
    result = await list_currencies(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/currencies", response_model=ApiResponse)
async def create_currency_route(
    input_data: CurrencyCreateInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Create a new currency."""
    tenant_id = await _get_tenant(db, user_id)
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
    try:
        await remove_currency_item(db, currency_id)
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

@router.get("/uoms", response_model=ApiResponse)
async def get_uoms_route(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """List all units of measure."""
    tenant_id = await _get_tenant(db, user_id)
    result = await list_uoms(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/uoms", response_model=ApiResponse)
async def create_uom_route(
    input_data: UomCreateInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Create a new unit of measure."""
    tenant_id = await _get_tenant(db, user_id)
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
    try:
        await remove_uom_item(db, uom_id)
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

@router.get("/conversions", response_model=ApiResponse)
async def get_conversions_route(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """List all conversion rules."""
    tenant_id = await _get_tenant(db, user_id)
    result = await list_conversions(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/conversions", response_model=ApiResponse)
async def create_conversion_route(
    input_data: ConversionCreateInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Create a new conversion rule."""
    tenant_id = await _get_tenant(db, user_id)
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
async def get_order_statuses_route(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """List all order statuses (sorted by sort_order)."""
    tenant_id = await _get_tenant(db, user_id)
    result = await list_order_statuses(db, tenant_id)
    return ApiResponse(
        success=True,
        data=[r.model_dump(mode="json", by_alias=True) for r in result],
    )


@router.post("/order-statuses", response_model=ApiResponse)
async def create_order_status_route(
    input_data: OrderStatusCreateInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Create a new order status."""
    tenant_id = await _get_tenant(db, user_id)
    result = await create_order_status_item(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.put("/order-statuses/reorder", response_model=ApiResponse)
async def reorder_order_statuses_route(
    input_data: OrderStatusReorderInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Reorder order statuses."""
    tenant_id = await _get_tenant(db, user_id)
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
    try:
        await remove_order_status_item(db, status_id)
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
