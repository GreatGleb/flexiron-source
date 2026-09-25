"""Action (Presenter / Route) for the warehouse.list_batches slice.

FastAPI route handler — thin Adapter layer.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import list_batches as list_batches_usecase

router = APIRouter(prefix="/api/warehouse/batches", tags=["warehouse"])


@router.get("", response_model=ApiResponse)
async def list_batches(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    product_id: UUID | None = Query(None, alias="productId"),
    supplier_id: UUID | None = Query(None, alias="supplierId"),
    status: str | None = Query(None),
    uom_id: UUID | None = Query(None, alias="uomId"),
    date_from: datetime | None = Query(None, alias="dateFrom"),
    date_to: datetime | None = Query(None, alias="dateTo"),
    sort_by: str | None = Query(None, alias="sortBy"),
    sort_dir: str | None = Query(None, alias="sortDir"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List warehouse batches — tenant-scoped, paginated, searchable.

    `search` matches the batch's own number and the linked product's name —
    the latter resolved through the products catalog, never a name field
    stored on the batch itself (`roo_code/roo-context/api/warehouse.md`,
    "GET /api/warehouse/batches"). Default order is `receivedAt` descending.
    """
    result = await list_batches_usecase(
        db,
        current_user.tenant_id,
        search=search,
        page=page,
        page_size=page_size,
        product_id=product_id,
        supplier_id=supplier_id,
        status=status,
        uom_id=uom_id,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))
