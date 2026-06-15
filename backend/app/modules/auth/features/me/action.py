"""Action (Route) for Get Current User (Me) feature.

Extracts the user ID from the Bearer session token (itsdangerous-signed)
and returns the current user profile.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from app.modules.auth.features.me.domain import (
    get_current_user as get_current_user_usecase,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Same serializer as login/domain.py
_serializer = URLSafeTimedSerializer(
    secret_key=settings.secret_key,
    salt="session",
)

# FastAPI security scheme for Bearer token
_bearer = HTTPBearer(auto_error=False)


@router.get("/me", response_model=ApiResponse)
async def me(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
):
    """Get current user profile.

    Extracts user_id from the Bearer session token (itsdangerous-signed)
    and returns the user profile.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Missing authorization token", "code": "MISSING_TOKEN"},
        )

    # Decode the session token
    try:
        payload = _serializer.loads(credentials.credentials, max_age=86400)  # 24h
        user_id = UUID(payload["user_id"])
    except SignatureExpired:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Session token expired", "code": "TOKEN_EXPIRED"},
        )
    except (BadSignature, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid session token", "code": "INVALID_TOKEN"},
        )

    try:
        user = await get_current_user_usecase(db, user_id)
        return ApiResponse(success=True, data=user.model_dump(mode="json"))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
