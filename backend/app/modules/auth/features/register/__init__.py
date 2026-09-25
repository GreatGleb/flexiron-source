"""Register feature — `POST /api/auth/register`."""

from app.modules.auth.features.register.action import router
from app.modules.auth.features.register.domain import register
from app.modules.auth.features.register.schemas import RegisterInput, RegisterResponse

__all__ = ["router", "RegisterInput", "RegisterResponse", "register"]
