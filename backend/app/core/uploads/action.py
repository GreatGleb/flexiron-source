"""Upload endpoint — handles file uploads for all business modules.

Accepts multipart file upload, validates against whitelist, saves to local
storage, creates an UploadedFile record, and returns the public URL.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.uploads.models import UploadedFile
from app.core.uploads.service import store_file

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# ─── Upload directory ──────────────────────────────────────────────────────
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ─── Session token serializer (same as settings/auth) ───────────────────────
from itsdangerous import URLSafeTimedSerializer

_serializer = URLSafeTimedSerializer(
    secret_key=app_settings.secret_key,
    salt="session",
)


async def _resolve_user_id(
    authorization: str | None = Header(None),
) -> uuid.UUID:
    """Extract user_id from the Bearer session token (same logic as settings)."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Missing Authorization header", "code": "UNAUTHORIZED"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid Authorization header", "code": "UNAUTHORIZED"},
        )
    try:
        data = _serializer.loads(token)
        user_id_str = data.get("user_id")
        if not user_id_str:
            raise ValueError("Missing user_id in token")
        return uuid.UUID(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid or expired session token", "code": "UNAUTHORIZED"},
        )


async def _get_tenant_id(
    db: AsyncSession, user_id: uuid.UUID
) -> uuid.UUID:
    """Resolve tenant ID for the authenticated user."""
    from sqlalchemy import select
    from app.modules.auth.shared.models import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "User has no tenant", "code": "NOT_FOUND"},
        )
    return user.tenant_id


@router.post("", response_model=ApiResponse)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
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
    file_path.write_bytes(contents)

    # ── Create DB record ────────────────────────────────────────────────
    tenant_id = await _get_tenant_id(db, user_id)
    storage_path = str(file_path)
    uploaded = await store_file(
        db=db,
        tenant_id=tenant_id,
        original_name=file.filename or "upload",
        storage_path=storage_path,
        size=len(contents),
        mime=file.content_type or "application/octet-stream",
        uploaded_by=str(user_id),
        is_draft=False,
    )
    await db.commit()

    # ── Build full public URL from request base ─────────────────────────
    base_url = str(request.base_url).rstrip("/")
    public_url = f"{base_url}/static/uploads/{unique_name}"
    return ApiResponse(
        success=True,
        data={"url": public_url, "fileId": str(uploaded.id)},
    )
