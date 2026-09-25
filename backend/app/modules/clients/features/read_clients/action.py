"""Action (Presenter / Route) for the clients.read_clients slice.

FastAPI route handlers — thin Adapter layer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import get_client_audit as get_client_audit_usecase
from .domain import get_client_detail as get_client_detail_usecase
from .domain import list_clients as list_clients_usecase

router = APIRouter(prefix="/api/clients", tags=["clients"])


# `GET /api/clients` MUST be registered before `GET /api/clients/{client_id}`
# in this router — the task brief calls for it explicitly, even though the
# two paths don't actually collide (one has no path segment, the other has
# exactly one), unlike `products.list_products` vs `get_product_detail`.
@router.get("", response_model=ApiResponse)
async def list_clients(
    search: str | None = Query(None),
    status: str | None = Query(None),
    sort_by: str | None = Query(None, alias="sortBy"),
    sort_dir: str | None = Query(None, alias="sortDir"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List clients — tenant-scoped, paginated, searchable by name/companyCode/email."""
    result = await list_clients_usecase(
        db,
        current_user.tenant_id,
        search=search,
        status=status,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.get("/{client_id}", response_model=ApiResponse)
async def get_client_detail(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get one client card by id — tenant-scoped.

    An unknown or foreign id raises `ClientNotFoundError` from the domain
    layer, which propagates to `app.main`'s `AppError` handler and answers
    404 with `code=CLIENT_NOT_FOUND` — no `HTTPException` raised here.
    """
    result = await get_client_detail_usecase(db, current_user.tenant_id, client_id)
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.get("/{client_id}/audit", response_model=ApiResponse)
async def get_client_audit(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Client's change journal — a flat array, newest entry first.

    An unknown or foreign `client_id` answers with an empty array, not a
    refusal: the contract names no error for this endpoint
    (`roo_code/roo-context/api/clients.md`, "GET /api/clients/:id/audit",
    "Ошибки: ни одной").
    """
    result = await get_client_audit_usecase(db, current_user.tenant_id, client_id)
    return ApiResponse(success=True, data=[item.model_dump(mode="json") for item in result])
