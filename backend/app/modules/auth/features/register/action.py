"""Action (Presenter / Route) for Register feature.

FastAPI route handler — thin Adapter layer for user registration.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import ValidationError, ConflictError
from app.modules.auth.features.register.schemas import (
    RegisterInput,
)
from app.modules.auth.features.register.domain import (
    register as register_usecase,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def register(
    input_data: RegisterInput,
    db: AsyncSession = Depends(get_db),
):
    """Register a new company and user account.

    Creates a tenant (company) and user, then auto-login by generating
    a session token. Returns user info matching the MeResponse shape.
    """
    try:
        result = await register_usecase(db, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
            message="Registration successful",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"message": e.message, "code": e.code},
        )
    except ConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )
