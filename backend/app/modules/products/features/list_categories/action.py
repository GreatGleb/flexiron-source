"""Action (Presenter / Route) for the products.list_categories slice.

FastAPI route handler — thin Adapter layer.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import list_categories as list_categories_usecase

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=ApiResponse)
async def list_categories(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List categories — tenant-scoped, paginated, searchable by name across ru/en/lt."""
    result = await list_categories_usecase(
        db,
        current_user.tenant_id,
        search=search,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))
