"""Action (Presenter / Route) for the products.category_card slice.

FastAPI route handler — thin Adapter layer. Domain refusals travel as `AppError`
subclasses and are turned into `{message, code}` answers by the handler registered
in `app.main`; the routes add nothing to them.
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import delete_category as delete_category_usecase
from .domain import get_category_card as get_category_card_usecase

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("/{category_id}", response_model=ApiResponse)
async def get_category_card(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Read one category — its own and inherited fields, both computed at read time."""
    result = await get_category_card_usecase(db, current_user.tenant_id, category_id)
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.delete("/{category_id}", response_model=ApiResponse)
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a category that carries no products and no children."""
    await delete_category_usecase(db, current_user.tenant_id, category_id)
    return ApiResponse(success=True)
