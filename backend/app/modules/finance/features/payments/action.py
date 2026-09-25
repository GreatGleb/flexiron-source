"""Action (Presenter / Route) for the finance.payments read slice.

FastAPI route handlers — thin Adapter layer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import get_payment_detail as get_payment_detail_usecase
from .domain import list_payments as list_payments_usecase

router = APIRouter(prefix="/api/finance/payments", tags=["finance"])


@router.get("", response_model=ApiResponse)
async def list_payments(
    search: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List outgoing supplier payments — tenant-scoped, paginated, searchable."""
    result = await list_payments_usecase(
        db,
        current_user.tenant_id,
        search=search,
        status=status,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.get("/{payment_id}", response_model=ApiResponse)
async def get_payment_detail(
    payment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get one supplier payment card by id — tenant-scoped.

    An unknown or foreign id raises `PaymentNotFoundError` from the domain layer,
    which propagates to `app.main`'s `AppError` handler and answers 404 with
    `code=PAYMENT_NOT_FOUND` — no `HTTPException` raised here.
    """
    result = await get_payment_detail_usecase(db, current_user.tenant_id, payment_id)
    return ApiResponse(success=True, data=result.model_dump(mode="json"))
