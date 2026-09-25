"""Action (Presenter / Route) for the audit.feed read slice.

FastAPI route handlers — thin Adapter layer.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import get_audit_feed as get_audit_feed_usecase
from .domain import get_audit_feed_users as get_audit_feed_users_usecase

router = APIRouter(prefix="/api/audit-feed", tags=["audit"])


@router.get("", response_model=ApiResponse)
async def get_audit_feed(
    entityType: str | None = Query(None),
    user: str | None = Query(None),
    dateFrom: str | None = Query(None),
    dateTo: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    pageSize: int = Query(25, ge=1, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """The merged nine-entity history feed — tenant-scoped, filtered, paginated.

    `pageSize` has no server-side ceiling (П20: the client's own code owns the
    upper bound) — only `ge=1` so an empty or negative value cannot reach the
    domain layer's `offset`/slice math.
    """
    result = await get_audit_feed_usecase(
        db,
        current_user.tenant_id,
        entity_type=entityType,
        user_key=user,
        date_from=dateFrom,
        date_to=dateTo,
        search=search,
        page=page,
        page_size=pageSize,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.get("/users", response_model=ApiResponse)
async def get_audit_feed_users(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Distinct authors across the whole tenant journal — not the feed's
    current filters (contract, rule 9)."""
    result = await get_audit_feed_users_usecase(db, current_user.tenant_id)
    return ApiResponse(
        success=True, data=[item.model_dump(mode="json") for item in result]
    )
