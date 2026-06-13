"""Schemas for Login feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class LoginInput(BaseModel):
    """Input for user authentication (email + password)."""

    email: str
    password: str


class UserInfo(BaseModel):
    """User profile subset returned after login."""

    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    locale: str
    role: str
    tenant_id: UUID | None
    is_active: bool


class SessionInfo(BaseModel):
    """Session data returned after login (token-based)."""

    token: str
    csrf_token: str
    expires_at: datetime


class LoginResponse(BaseModel):
    """Successful login response payload."""

    user: UserInfo
    session: SessionInfo

    model_config = {"from_attributes": True}
