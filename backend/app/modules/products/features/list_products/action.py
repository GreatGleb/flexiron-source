"""Action (Presenter / Route) for List Products feature.

FastAPI route handler — thin Adapter layer.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.products.features.list_products.domain import (
    list_products as list_products_usecase,
)
from app.modules.products.features.list_products.domain import (
    list_products_catalog as list_products_catalog_usecase,
)

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductListResponse(ApiResponse):
    """Collection envelope keeps the wire contract array-shaped in `data`."""

    data: list[dict] | None = None


@router.get("", response_model=ApiResponse)
async def list_products_catalog(
    search: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    category_ids: str | None = Query(None, alias="categoryIds"),
    sort_by: Literal["name", "category", "price"] | None = Query(None, alias="sortBy"),
    sort_dir: Literal["asc", "desc"] = Query("asc", alias="sortDir"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Paginated product catalog — tenant-scoped, searchable, sortable."""
    result = await list_products_catalog_usecase(
        db,
        current_user.tenant_id,
        search=search,
        category_ids_raw=category_ids,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


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
