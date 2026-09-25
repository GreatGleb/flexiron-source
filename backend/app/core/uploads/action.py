"""Upload endpoint — handles file uploads for all business modules.

Accepts multipart file upload, validates against whitelist, saves to local
storage, creates an UploadedFile record, and returns the public URL.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.uploads.service import store_file

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# ─── Upload directory ──────────────────────────────────────────────────────
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"

from app.modules.auth.internal_api.interface import CurrentUser, get_current_user


@router.post("", response_model=ApiResponse)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a file and return its public URL.

    Accepts a single file via multipart/form-data. Validates MIME type
    against the whitelist configured in app settings. Saves to local
    storage and returns the full URL (e.g. ``http://localhost:8000/static/uploads/<filename>``).

    Returns:
        ApiResponse with ``data.url`` containing the public file URL.
    """
    # ── Validate file type ──────────────────────────────────────────────
    if file.content_type not in app_settings.upload_whitelist_mime:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"File type '{file.content_type}' is not allowed",
                "code": "VALIDATION_ERROR",
            },
        )

    # ── Read file content (with size limit) ─────────────────────────────
    max_bytes = app_settings.max_upload_size_mb * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "message": f"File exceeds max size of {app_settings.max_upload_size_mb} MB",
                "code": "VALIDATION_ERROR",
            },
        )

    # ── Generate unique filename ────────────────────────────────────────
    ext = Path(file.filename or "upload").suffix if file.filename else ""
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = UPLOAD_DIR / unique_name

    # ── Write to disk ───────────────────────────────────────────────────
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(contents)

    # ── Create DB record ────────────────────────────────────────────────
    storage_path = str(file_path)
    uploaded = await store_file(
        db=db,
        tenant_id=current_user.tenant_id,
        original_name=file.filename or "upload",
        storage_path=storage_path,
        size=len(contents),
        mime=file.content_type or "application/octet-stream",
        uploaded_by=current_user.user_id,
        is_draft=False,
    )

    # ── Build full public URL from request base ─────────────────────────
    base_url = str(request.base_url).rstrip("/")
    public_url = f"{base_url}/static/uploads/{unique_name}"
    return ApiResponse(
        success=True,
        data={"url": public_url, "fileId": str(uploaded.id)},
    )
