"""Schemas for the Settings Profile feature.

Uses camelCase aliases to match the frontend UserProfile type.
"""

from pydantic import BaseModel, Field
from uuid import UUID


class ProfileResponse(BaseModel):
    """User profile returned by GET /api/settings/profile.

    Field names use camelCase aliases so the JSON matches
    the frontend's UserProfile interface exactly.
    """

    first_name: str = Field(alias="firstName")
    last_name: str = Field(alias="lastName")
    email: str
    phone: str
    role: str
    secret_link: str | None = Field(alias="secretLink", default=None)

    model_config = {"populate_by_name": True, "from_attributes": True}


class ProfilePatchInput(BaseModel):
    """Partial profile update — only supplied fields are changed."""

    first_name: str | None = Field(alias="firstName", default=None)
    last_name: str | None = Field(alias="lastName", default=None)
    email: str | None = None
    phone: str | None = None

    model_config = {"populate_by_name": True}


class ChangePasswordInput(BaseModel):
    """Input for the change-password endpoint."""

    current_password: str = Field(alias="currentPassword")
    new_password: str = Field(alias="newPassword")
    confirm_password: str = Field(alias="confirmPassword")

    model_config = {"populate_by_name": True}
