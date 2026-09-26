"""Action (Presenter / Route) for the suppliers.card_config read slice.

Two read-only routes, both narrowed to the caller's tenant from the token:

* `GET /api/config/fields` — the whole field library, no parameters;
* `GET /api/config/sections` — the card's sections with their ordered links.

The slice lives under `suppliers` because that is the module its three tables
(`field_definitions`, `section_configs`, `section_fields`) belong to; the router
prefix stays `/api/config` because that is what the contract requires. No write
verb is declared here — this task is the read half only.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.suppliers.features.card_config.domain import (
    get_field_library as get_field_library_usecase,
)
from app.modules.suppliers.features.card_config.domain import (
    get_sections as get_sections_usecase,
)

router = APIRouter(prefix="/api/config", tags=["config"])


class ConfigListResponse(ApiResponse):
    """Array-shaped envelope: both routes answer with a bare array in `data`."""

    data: list[dict] | None = None


@router.get("/fields", response_model=ConfigListResponse)
async def get_field_library(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """The tenant's whole field library — no pagination, no filter, no search.

    `options` is excluded when the column is NULL: the contract makes the key
    optional, and `options: null` would be a different promise than its absence.
    """
    library = await get_field_library_usecase(db, current_user.tenant_id)
    return ConfigListResponse(
        success=True,
        data=[item.model_dump(mode="json", exclude_none=True) for item in library],
    )


@router.get("/sections", response_model=ConfigListResponse)
async def get_sections(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """The tenant's card sections, ordered by `sort_order` — fields ordered too.

    The wire name of the order value is `order`; `sort_order` never leaves the
    database (the contract renames it on the way out, one direction only).
    """
    sections = await get_sections_usecase(db, current_user.tenant_id)
    return ConfigListResponse(
        success=True,
        data=[section.model_dump(mode="json") for section in sections],
    )
