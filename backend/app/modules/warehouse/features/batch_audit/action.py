"""Action (Presenter / Route) for the warehouse.batch_audit slice.

FastAPI route handler — thin Adapter layer.
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import delete_batch_audit_entry as delete_batch_audit_entry_usecase
from .domain import get_batch_audit as get_batch_audit_usecase

router = APIRouter(prefix="/api/warehouse/batches", tags=["warehouse"])


@router.get("/{batch_id}/audit", response_model=ApiResponse)
async def get_batch_audit(
    batch_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Batch's change journal — a flat array in the `ApiResponse` envelope,
    newest first.

    Request is the path alone and there are no errors: an unknown batch and a
    foreign tenant's batch both answer 200 with an empty array, never a refusal
    (`roo_code/roo-context/api/warehouse.md`, "GET
    /api/warehouse/batches/:batchId/audit"). Every entry carries its own `id`,
    because the paired `DELETE` addresses an entry by it, not by its position.
    """
    result = await get_batch_audit_usecase(db, current_user.tenant_id, batch_id)
    return ApiResponse(
        success=True, data=[item.model_dump(mode="json") for item in result]
    )


@router.delete("/{batch_id}/audit/{entry_id}", response_model=ApiResponse)
async def delete_batch_audit_entry(
    batch_id: UUID,
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete one batch journal entry by its `id`.

    No body in the request and none in the success answer. Two refusals, both
    404 and both raised as `AppError` subclasses from the domain layer so
    `app.main`'s handler answers with the domain code — no `HTTPException`
    raised here (mirrors `clients.read_clients`): `BATCH_NOT_FOUND` when the
    batch is unknown or foreign, `AUDIT_ENTRY_NOT_FOUND` when the batch exists
    but the entry does not. A repeated delete of the same entry answers the
    second code, never a silent success.
    """
    await delete_batch_audit_entry_usecase(
        db, current_user.tenant_id, batch_id, entry_id
    )
    return ApiResponse(success=True)
