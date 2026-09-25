"""Action (Presenter / Route) for Patch Product feature.

FastAPI route handler — thin Adapter layer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError, ValidationError
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.products.features.patch_product.schemas import PatchProductInput
from app.modules.products.features.patch_product.domain import (
    patch_product as patch_product_usecase,
)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.patch("/{product_id}", response_model=ApiResponse)
async def patch_product(
    product_id: UUID,
    input_data: PatchProductInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Merge-patch a product; `fieldValues`, when present, replaces the full set."""
    try:
        product = await patch_product_usecase(
            db, current_user.tenant_id, product_id, input_data
        )
        return ApiResponse(
            success=True,
            data=product.model_dump(mode="json"),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
