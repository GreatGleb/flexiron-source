"""Action (Presenter / Route) for Login feature.

FastAPI route handler — thin Adapter layer for user authentication.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import UnauthorizedError
from app.modules.auth.features.login.schemas import (
    LoginInput,
)
from app.modules.auth.features.login.domain import (
    login as login_usecase,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse)
async def login(
    input_data: LoginInput,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user with email and password.

    Returns user profile + session token + CSRF token.
    The session token should be stored client-side (localStorage/sessionStorage)
    and sent as Bearer token. CSRF token sent as X-CSRF-Token header.
    """
    try:
        result = await login_usecase(db, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
            message="Login successful",
        )
    except UnauthorizedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": e.message, "code": e.code},
        )
