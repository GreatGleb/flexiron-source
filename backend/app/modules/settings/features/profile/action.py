"""Action (Routes) for the Settings Profile feature.

Provides:
  - GET    /api/settings/profile   → current user's profile + secret link
  - PATCH  /api/settings/profile   → update profile fields
  - POST   /api/settings/change-password → change password

Authenticates via Bearer token from the Authorization header.
"""


from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
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


@router.get("/profile", response_model=ApiResponse)
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get the current user's profile, including the secret login link.

    Returns fields matching the frontend UserProfile interface (camelCase).
    Requires a valid Bearer session token in the Authorization header.
    """
    try:
        result = await get_profile_usecase(db, current_user.user_id, current_user.tenant_id)
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
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update profile fields (firstName, lastName, email, phone).

    Only supplied fields are changed (merge-patch semantics).
    Requires a valid Bearer session token in the Authorization header.
    """
    try:
        result = await patch_profile_usecase(db, current_user.user_id, current_user.tenant_id, input_data)
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
    current_user: CurrentUser = Depends(get_current_user),
):
    """Change the current user's password.

    Requires currentPassword for verification.
    Requires a valid Bearer session token in the Authorization header.
    """
    try:
        await change_password_usecase(db, current_user.user_id, current_user.tenant_id, input_data)
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
