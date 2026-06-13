"""Action (Presenter / Route) for Create Product feature.

FastAPI route handler — thin Adapter layer.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import ValidationError
from app.modules.products.features.create_product.schemas import (
    CreateProductInput,
    CreateProductResponse,
)
from app.modules.products.features.create_product.domain import (
    create_product as create_product_usecase,
)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    input_data: CreateProductInput,
    db: AsyncSession = Depends(get_db),
):
    """Create a new product.

    NOTE: tenant_id is hardcoded as a placeholder until auth middleware
    provides the current tenant context.
    """
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder

    try:
        product = await create_product_usecase(db, tenant_id, input_data)
        return ApiResponse(
            success=True,
            data=product.model_dump(mode="json"),
            message="Product created successfully",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
