"""Action (Routes) for the settings warehouse-map slice.

  - GET    /api/settings/warehouse-map  → the tenant's map, or `null`
  - PUT    /api/settings/warehouse-map  → replace it whole — this **is** the Save П31 speaks of
  - DELETE /api/settings/warehouse-map  → remove it, idempotently

One map per tenant, so no id appears in any path.  Authenticates with the Bearer
session token, the same as the rest of the domain.

No business logic here: the rules live in `domain.py`.  Two answers deviate from
the envelope's defaults on purpose:

* `GET` answers `200` with `data: null` when there is no map — the null **is** the
  successful answer (the page's empty state), not a 404;
* `PUT` answers `415` for a file that is not an image — the status the contract
  names for `MAP_NOT_AN_IMAGE`, which is not the status the core `ValidationError`
  class carries, so it is mapped here rather than left to the global handler.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.settings.features.warehouse_map.domain import (
    MapNotAnImageError,
    delete_warehouse_map as delete_warehouse_map_usecase,
    get_warehouse_map as get_warehouse_map_usecase,
    save_warehouse_map as save_warehouse_map_usecase,
)
from app.modules.settings.features.warehouse_map.schemas import WarehouseMapInput

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/warehouse-map", response_model=ApiResponse)
async def get_warehouse_map(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Read the tenant's map.

    Never refuses: a tenant that never saved a map is `null`, and that is a
    success — the empty state of the page is built on it (`useWarehouseMap.ts`
    puts any error into a toast, which is not how an empty warehouse should look).
    """
    result = await get_warehouse_map_usecase(db, current_user.tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True) if result else None,
    )


@router.put("/warehouse-map", response_model=ApiResponse)
async def save_warehouse_map(
    input_data: WarehouseMapInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Replace the tenant's map — the whole resource, hence `PUT`, not `PATCH`.

    Saving lifts the draft mark from the named file (П31), so an upload that is
    never confirmed stays a draft and leaves by TTL.  The previous map's binary
    is not deleted by anybody: that is В4, and it is open.
    """
    try:
        result = await save_warehouse_map_usecase(
            db, current_user.tenant_id, input_data
        )
    except MapNotAnImageError as e:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"message": e.message, "code": e.code},
        )
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.delete("/warehouse-map", response_model=ApiResponse)
async def delete_warehouse_map(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Remove the tenant's map.

    Idempotent: a repeat on an empty map is a success too.  The uploaded file is
    left exactly as it is — nobody is appointed to delete it (В4, open).
    """
    await delete_warehouse_map_usecase(db, current_user.tenant_id)
    return ApiResponse(success=True, message="Warehouse map deleted")
