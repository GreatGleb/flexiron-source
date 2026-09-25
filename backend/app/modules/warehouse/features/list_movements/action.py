"""Action (Presenter / Route) for the warehouse.list_movements slice.

FastAPI route handler — thin Adapter layer.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import list_movements as list_movements_usecase

router = APIRouter(prefix="/api/warehouse/movements", tags=["warehouse"])


@router.get("", response_model=ApiResponse)
async def list_movements(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    type: str | None = Query(None),
    product_id: UUID | None = Query(None, alias="productId"),
    uom_id: str | None = Query(None, alias="uomId"),
    reference_id: str | None = Query(None, alias="referenceId"),
    offcut_id: UUID | None = Query(None, alias="offcutId"),
    batch_number: str | None = Query(None, alias="batchNumber"),
    date_from: datetime | None = Query(None, alias="dateFrom"),
    date_to: datetime | None = Query(None, alias="dateTo"),
    sort_by: str | None = Query(None, alias="sortBy"),
    sort_dir: str | None = Query(None, alias="sortDir"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List warehouse movements — tenant-scoped, paginated, searchable.

    `search` matches the movement's own batch number and the linked product's
    name — the latter resolved through the products catalog, the same join
    `warehouse.list_batches` already uses
    (`roo_code/roo-context/api/warehouse.md`, "GET /api/warehouse/movements").
    Default order is `movedAt` descending. `categoryIds` is deliberately not
    a query parameter here: the contract records it as accepted-and-unused by
    the mock, an open finding this route does not resolve on its own.
    """
    result = await list_movements_usecase(
        db,
        current_user.tenant_id,
        search=search,
        page=page,
        page_size=page_size,
        type=type,
        product_id=product_id,
        uom_id=uom_id,
        reference_id=reference_id,
        offcut_id=offcut_id,
        batch_number=batch_number,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


# Appended below rather than merged into the top-of-file import block, so the
# addition doesn't shift the line numbers the contract already cites.
from .domain import get_movement_audit as get_movement_audit_usecase  # noqa: E402
from .domain import get_movement_card as get_movement_card_usecase  # noqa: E402


@router.get("/{movement_id}", response_model=ApiResponse)
async def get_movement_card(
    movement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Movement card — read-only, tenant-scoped, built off the same list
    projection `list_movements` uses plus the journal field.

    An unknown or foreign `movement_id` raises `MovementNotFoundError` from
    the domain layer, which propagates to `app.main`'s `AppError` handler and
    answers 404 with `code=MOVEMENT_NOT_FOUND` — no `HTTPException` raised
    here (mirrors `warehouse.list_batches.get_batch_aggregates`).
    """
    result = await get_movement_card_usecase(db, current_user.tenant_id, movement_id)
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.get("/{movement_id}/audit", response_model=ApiResponse)
async def get_movement_audit(
    movement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Movement's journal alone, tenant-scoped — the same rows the card's
    `auditLog` field carries. Unknown `movement_id` answers an empty list,
    not a refusal: the contract names no error for this path, and reading
    never creates anything.
    """
    result = await get_movement_audit_usecase(db, current_user.tenant_id, movement_id)
    return ApiResponse(
        success=True, data=[item.model_dump(mode="json") for item in result]
    )
