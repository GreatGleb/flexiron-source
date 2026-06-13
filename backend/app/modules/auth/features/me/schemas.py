"""Schemas for Get Current User (Me) feature."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class MeResponse(BaseModel):
    """Current user profile response."""

    id: UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    locale: str
    role: str
    tenant_id: UUID | None
    is_active: bool


class MeInput(BaseModel):
    """Input for the me use case — identifies the user."""

    user_id: UUID
