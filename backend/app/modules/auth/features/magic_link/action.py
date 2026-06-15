"""Action (Route) for Magic Link Login feature.

GET /api/auth/link?token=xxx — validates a secret link token
and returns the user's email so the frontend can pre-fill the
login form. The user still enters their password.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import UnauthorizedError
from app.modules.auth.features.magic_link.domain import (
    verify_secret_link,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/link", response_model=ApiResponse)
async def magic_link_verify(
    token: str = Query(..., description="Secret link token"),
    db: AsyncSession = Depends(get_db),
):
    """Verify a secret magic link and return the user's email.

    The token is a unique URL-safe string that was generated during
    registration. On success, returns user's email so the frontend
    can redirect to the login page with email pre-filled.

    No session is created — the user still needs to enter their
    password on the login page.
    """
    try:
        result = await verify_secret_link(db, token)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
            message="Link verified successfully",
        )
    except UnauthorizedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": e.message, "code": e.code},
        )
