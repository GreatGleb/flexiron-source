"""Action (Routes) for the services catalog feature.

Requires Bearer session token — same pattern as `settings/features/crud/action.py`.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import (
    CatalogServiceNotFoundError,
    ServiceCurrencyNotFoundError,
    ServiceUomNotFoundError,
    create_service_catalog_entry,
    get_service_detail,
    patch_service_catalog_entry,
)
from .schemas import ServiceCreateInput, ServicePatchInput

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("/{service_id}", response_model=ApiResponse)
async def get_service_route(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single service from the tenant's catalog."""
    try:
        result = await get_service_detail(db, current_user.tenant_id, service_id)
    except CatalogServiceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        ) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_service_route(
    input_data: ServiceCreateInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new catalog service."""
    try:
        result = await create_service_catalog_entry(db, current_user.tenant_id, input_data)
    except (ServiceCurrencyNotFoundError, ServiceUomNotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        ) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


@router.patch("/{service_id}", response_model=ApiResponse)
async def patch_service_route(
    service_id: UUID,
    input_data: ServicePatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Partially update a catalog service — merge-patch, dirty fields only."""
    try:
        result = await patch_service_catalog_entry(
            db, current_user.tenant_id, service_id, input_data
        )
    except CatalogServiceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        ) from e
    except (ServiceCurrencyNotFoundError, ServiceUomNotFoundError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        ) from e
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


# ── List and archive ────────────────────────────────────────────────────────
# Appended below the card/create/patch routes rather than merged into the top
# imports, so the addition doesn't shift the line numbers any document cites.
from fastapi import Query  # noqa: E402

from .domain import (  # noqa: E402
    archive_service_catalog_entry,
    list_service_catalog,
)


@router.get("", response_model=ApiResponse)
async def list_services_route(
    search: str | None = Query(None),
    sort_by: str | None = Query(None, alias="sortBy"),
    sort_dir: str | None = Query(None, alias="sortDir"),
    page: str | None = Query(None),
    page_size: str | None = Query(None, alias="pageSize"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List the tenant's live services — search, sort and server pagination.

    All five query params are optional and may arrive empty; the empty string
    means "no filter", and the server must never require a param's absence
    (`roo_code/roo-context/api/services.md`, "GET /api/services"). The list has no
    errors at all, so nothing here raises.
    """
    result = await list_service_catalog(
        db,
        current_user.tenant_id,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True, exclude_none=True),
    )


@router.delete("/{service_id}", response_model=ApiResponse)
async def delete_service_route(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Archive a service (П44) — the row stays, only `archived_at` is stamped.

    There is no success body. An unknown, foreign or already archived service is
    404 `CATALOG_SERVICE_NOT_FOUND`: the DELETE is not idempotent.
    """
    try:
        await archive_service_catalog_entry(db, current_user.tenant_id, service_id)
    except CatalogServiceNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        ) from e
    return ApiResponse(success=True, message="Service archived")
