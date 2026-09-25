"""Action (Presenter / Route) for the notifications.feed slice.

FastAPI route handlers — thin Adapter layer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import get_unread_count as get_unread_count_usecase
from .domain import list_notifications as list_notifications_usecase
from .domain import mark_all_read as mark_all_read_usecase
from .domain import mark_notification_read as mark_notification_read_usecase

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=ApiResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    search: str | None = Query(None),
    type_: str | None = Query(None, alias="type"),
    is_read: str | None = Query(None, alias="isRead"),
    sort_by: str | None = Query(None, alias="sortBy"),
    sort_dir: str | None = Query(None, alias="sortDir"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List the caller's own notification feed — tenant- and user-scoped."""
    result = await list_notifications_usecase(
        db,
        current_user.tenant_id,
        current_user.user_id,
        search=search,
        type_=type_,
        is_read=is_read,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.get("/unread-count", response_model=ApiResponse)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Bare unread count for the caller — ignores every list filter."""
    result = await get_unread_count_usecase(db, current_user.tenant_id, current_user.user_id)
    return ApiResponse(success=True, data=result)


@router.patch("/read-all", response_model=ApiResponse)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark every one of the caller's own notifications read, one `UPDATE`."""
    await mark_all_read_usecase(db, current_user.tenant_id, current_user.user_id)
    return ApiResponse(success=True)


@router.patch("/{notification_id}/read", response_model=ApiResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark one of the caller's own notifications read.

    An unknown or foreign `notification_id` raises `NotFoundError` from the
    domain layer, which propagates to `app.main`'s `AppError` handler and
    answers 404 — no `HTTPException` raised here.
    """
    result = await mark_notification_read_usecase(
        db, current_user.tenant_id, current_user.user_id, notification_id
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))
