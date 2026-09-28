"""Action (Presenter / Route) for the clients.write_clients slice.

FastAPI route handlers — thin Adapter layer.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AppError
from app.core.schemas import ApiResponse
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

from .domain import ClientFieldTakenError, ClientValidationError
from .domain import create_client as create_client_usecase
from .domain import delete_client as delete_client_usecase
from .domain import delete_client_audit_entry as delete_client_audit_entry_usecase
from .domain import patch_client as patch_client_usecase
from .schemas import ClientCreateRequest, ClientPatchRequest

router = APIRouter(prefix="/api/clients", tags=["clients"])


def _refusal(status_code: int, error: AppError, field: str | None) -> JSONResponse:
    """One domain refusal, as `detail: {message, code}` plus a per-field map.

    `detail` keeps exactly the two keys of `00-conventions.md` §1 — the error
    catalogue watcher (`tests/test_error_catalogue.py`) reads every refusal dict
    and admits no third key inside `detail`. The offending field therefore
    travels in a sibling `fieldErrors` map, which is the shape the client's error
    type already exposes (`frontend_vue/src/types/api.ts`, `fieldErrors`).
    """
    content: dict[str, Any] = {"detail": {"message": error.message, "code": error.code}}
    if field:
        content["fieldErrors"] = {field: error.message}
    return JSONResponse(status_code=status_code, content=content)


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    input_data: ClientCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a client — 201 with the created client in the `ApiResponse` envelope."""
    try:
        result = await create_client_usecase(db, current_user.tenant_id, input_data)
    except ClientValidationError as error:
        return _refusal(status.HTTP_422_UNPROCESSABLE_ENTITY, error, error.field)
    except ClientFieldTakenError as error:
        return _refusal(status.HTTP_409_CONFLICT, error, error.field)
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.patch("/{client_id}", response_model=ApiResponse)
async def patch_client(
    client_id: UUID,
    input_data: ClientPatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Merge-patch a client — only the top-level keys sent in the body change.

    An unknown or foreign id raises `ClientNotFoundError` from the domain layer,
    which propagates to `app.main`'s `AppError` handler and answers 404 with
    `code=CLIENT_NOT_FOUND` — no `HTTPException` raised here.
    """
    try:
        result = await patch_client_usecase(
            db, current_user.tenant_id, client_id, input_data
        )
    except ClientValidationError as error:
        return _refusal(status.HTTP_422_UNPROCESSABLE_ENTITY, error, error.field)
    except ClientFieldTakenError as error:
        return _refusal(status.HTTP_409_CONFLICT, error, error.field)
    return ApiResponse(success=True, data=result.model_dump(mode="json"))


@router.delete("/{client_id}", response_model=ApiResponse)
async def delete_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a client — physical, no soft delete.

    Two refusals, and both surface through `app.main`'s `AppError` handler as
    `detail: {message, code}` (`00-conventions.md` §1): `CLIENT_NOT_FOUND` for
    an unknown or foreign id, `CONFLICT` when the client still has orders.
    Neither is caught here — the status is a property of the exception class,
    so the table lives in one place and not twice.
    """
    await delete_client_usecase(db, current_user.tenant_id, client_id)
    return ApiResponse(success=True, data=None)


@router.delete("/{client_id}/audit/{entry_id}", response_model=ApiResponse)
async def delete_client_audit_entry(
    client_id: UUID,
    entry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete one journal entry of one client — an `entryId`, not an index.

    `CLIENT_NOT_FOUND` and `AUDIT_ENTRY_NOT_FOUND` both answer 404; an unknown
    entry is a refusal, never a silent success. The right to delete a journal
    row (owner only, П8) is deliberately not checked here: permissions are a
    stub across the project today, and implementing them is outside this task.
    """
    await delete_client_audit_entry_usecase(
        db, current_user.tenant_id, client_id, entry_id
    )
    return ApiResponse(success=True, data=None)
