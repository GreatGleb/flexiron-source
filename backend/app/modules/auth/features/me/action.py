"""Action (Route) for Get Current User (Me) feature.

NOTE: This is a demo endpoint. Real auth middleware (session token validation)
needs to be implemented to extract the current user from the request.
Currently uses a placeholder user ID.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from app.modules.auth.features.me.domain import (
    get_current_user as get_current_user_usecase,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=ApiResponse)
async def me(
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile.

    DEMO: uses a hardcoded placeholder user ID.
    Real implementation: extract user_id from session token via auth middleware.
    """
    # Placeholder — replace with real session extraction
    demo_user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    try:
        user = await get_current_user_usecase(db, demo_user_id)
        return ApiResponse(success=True, data=user.model_dump(mode="json"))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
