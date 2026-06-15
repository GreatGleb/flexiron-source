"""Schemas for Register feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class RegisterInput(BaseModel):
    """Input for new user registration."""

    email: str
    password: str
    company_name: str
    vat_code: str
    locale: str = "ru"
    first_name: str
    last_name: str
    phone: str | None = None


class RegisterSessionInfo(BaseModel):
    """Session data returned after registration (auto-login)."""

    token: str
    csrf_token: str
    expires_at: datetime


class RegisterResponse(BaseModel):
    """Response after successful registration (User info + session + secret link)."""

    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    locale: str
    role: str
    tenant_id: UUID | None
    is_active: bool
    session: RegisterSessionInfo
    secret_link: str

    model_config = {"from_attributes": True}
