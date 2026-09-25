"""Action (Presenter / Route) for Supplier Reference feature.

FastAPI route handler — thin Adapter layer.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
from app.modules.suppliers.features.supplier_reference.domain import (
    list_suppliers_brief as list_suppliers_brief_usecase,
)

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])


class SupplierListResponse(ApiResponse):
    """Collection envelope keeps the wire contract array-shaped in `data`."""

    data: list[dict] | None = None


@router.get("/list", response_model=SupplierListResponse)
async def list_suppliers_brief(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Lightweight id+company catalog reference — no pagination, no parameters."""
    result = await list_suppliers_brief_usecase(db, current_user.tenant_id)
    return SupplierListResponse(
        success=True,
        data=[item.model_dump(mode="json") for item in result],
    )
