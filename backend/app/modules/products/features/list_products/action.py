"""Action (Presenter / Route) for List Products feature.

FastAPI route handler — thin Adapter layer.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.products.features.list_products.domain import (
    list_products as list_products_usecase,
)

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductListResponse(ApiResponse):
    """Collection envelope keeps the wire contract array-shaped in `data`."""

    data: list[dict] | None = None


@router.get("/list", response_model=ProductListResponse)
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Lightweight id+name catalog reference — no pagination, no parameters."""
    result = await list_products_usecase(db, current_user.tenant_id)
    return ProductListResponse(
        success=True,
        data=[item.model_dump(mode="json") for item in result],
    )
