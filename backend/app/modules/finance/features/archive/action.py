"""Action (Presenter / Route) for the finance.archive read slice.

FastAPI route handler — thin Adapter layer.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import list_archive as list_archive_usecase

router = APIRouter(prefix="/api/finance/archive", tags=["finance"])


@router.get("", response_model=ApiResponse)
async def list_archive(
    search: str | None = Query(None),
    type: str | None = Query(None),
    relatedEntityType: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List archived documents — tenant-scoped, paginated, searchable, read-only."""
    result = await list_archive_usecase(
        db,
        current_user.tenant_id,
        search=search,
        type=type,
        related_entity_type=relatedEntityType,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))
