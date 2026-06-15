"""Action (Routes) for the Settings Profile feature.

Provides:
  - GET    /api/settings/profile   → current user's profile + secret link
  - PATCH  /api/settings/profile   → update profile fields
  - POST   /api/settings/change-password → change password

Authenticates via Bearer token from the Authorization header.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError, ValidationError, ConflictError
from app.modules.settings.features.profile.schemas import (
    ProfilePatchInput,
    ChangePasswordInput,
)
from app.modules.settings.features.profile.domain import (
    get_profile as get_profile_usecase,
    patch_profile as patch_profile_usecase,
    change_password as change_password_usecase,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ─── Session token serializer ────────────────────────────────────────────
_serializer = URLSafeTimedSerializer(
    secret_key=settings.secret_key,
    salt="session",
)


async def _resolve_user_id(
    authorization: Optional[str] = Header(None),
) -> uuid.UUID:
    """Extract user_id from the Bearer session token.

    Reads the Authorization header, validates the token, and returns
    the embedded user_id.  Raises 401 if the token is missing or invalid.
    """
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


@router.get("/profile", response_model=ApiResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Get the current user's profile, including the secret login link.

    Returns fields matching the frontend UserProfile interface (camelCase).
    Requires a valid Bearer session token in the Authorization header.
    """
    try:
        result = await get_profile_usecase(db, user_id)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json", by_alias=True),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )


@router.patch("/profile", response_model=ApiResponse)
async def patch_profile(
    input_data: ProfilePatchInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Update profile fields (firstName, lastName, email, phone).

    Only supplied fields are changed (merge-patch semantics).
    Requires a valid Bearer session token in the Authorization header.
    """
    try:
        result = await patch_profile_usecase(db, user_id, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json", by_alias=True),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )


@router.post("/change-password", response_model=ApiResponse)
async def change_password(
    input_data: ChangePasswordInput,
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(_resolve_user_id),
):
    """Change the current user's password.

    Requires currentPassword for verification.
    Requires a valid Bearer session token in the Authorization header.
    """
    try:
        await change_password_usecase(db, user_id, input_data)
        return ApiResponse(success=True, message="Password changed")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
