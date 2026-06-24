"""Action (Presenter / Route) for Get Product Detail feature.

This is the FastAPI route handler — thin layer that:
1. Extracts input from the request
2. Calls the domain use case
3. Returns a formatted response (or raises HTTP exception)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from app.modules.products.features.get_product_detail.schemas import (
    GetProductInput,
    ProductDetailResponse,
)
from app.modules.products.features.get_product_detail.domain import (
    get_product_detail as get_product_detail_usecase,
)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/{product_id}", response_model=ApiResponse)
async def get_product_detail(
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed info about a product by its ID."""
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder
    try:
        product = await get_product_detail_usecase(db, tenant_id, product_id)
        return ApiResponse(
            success=True,
            data=product.model_dump(mode="json"),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
