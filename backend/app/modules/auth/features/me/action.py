"""Current user projection, authenticated by the shared dependency."""

from fastapi import APIRouter, Depends

from app.core.schemas import ApiResponse
from app.modules.auth.shared.dependencies import CurrentUser, get_current_user
from app.modules.auth.features.me.domain import build_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=ApiResponse)
async def me(current_user: CurrentUser = Depends(get_current_user)):
    user = build_current_user(current_user.user)
    return ApiResponse(success=True, data=user.model_dump(mode="json"))
