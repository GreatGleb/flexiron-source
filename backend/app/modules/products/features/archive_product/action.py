"""Action (Presenter / Route) for Archive Product feature.

FastAPI route handler — thin Adapter layer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.products.features.archive_product.domain import (
    archive_product as archive_product_usecase,
)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.delete("/{product_id}", response_model=ApiResponse)
async def archive_product(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Archive a product by ID (soft delete, П44) — the row is never removed."""
    try:
        result = await archive_product_usecase(db, current_user.tenant_id, product_id)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
            message="Product archived",
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
