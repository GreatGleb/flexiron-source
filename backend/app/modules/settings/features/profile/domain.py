"""Domain use cases for the Settings Profile feature."""

import secrets
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.exceptions import NotFoundError, ValidationError, ConflictError
from app.modules.settings.features.profile.schemas import (
    ProfileResponse,
    ProfilePatchInput,
    ChangePasswordInput,
)
from app.modules.settings.features.profile.repository import (
    get_user_by_id,
    update_user,
    get_user_by_email,
)


async def _ensure_secret_link(db: AsyncSession, user_id: UUID) -> str | None:
    """Ensure user has a secret_link_token, auto-generating if missing.

    Returns the full secret link URL, or None if DB update failed.
    """
    user = await get_user_by_id(db, user_id)
    if not user:
        return None

    if not user.secret_link_token:
        token = secrets.token_urlsafe(48)
        updated = await update_user(db, user_id, {"secret_link_token": token})
        if updated:
            user = updated

    if user.secret_link_token:
        return (
            f"{app_settings.frontend_url}/auth/link"
            f"?token={user.secret_link_token}"
        )
    return None


async def get_profile(db: AsyncSession, user_id: UUID) -> ProfileResponse:
    """Return the current user's profile including the secret link.

    Auto-generates a secret_link_token if the user doesn't have one yet.
    """
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise NotFoundError(entity="User", entity_id=str(user_id))

    secret_link = await _ensure_secret_link(db, user_id)

    return ProfileResponse(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone or "",
        role=user.role,
        secret_link=secret_link,
    )


async def patch_profile(
    db: AsyncSession,
    user_id: UUID,
    input_data: ProfilePatchInput,
) -> ProfileResponse:
    """Partially update the current user's profile fields."""
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise NotFoundError(entity="User", entity_id=str(user_id))

    # Build a dict of non-None fields to update
    updates: dict = {}
    if input_data.first_name is not None:
        updates["first_name"] = input_data.first_name
    if input_data.last_name is not None:
        updates["last_name"] = input_data.last_name
    if input_data.email is not None:
        # Check email uniqueness (exclude current user)
        existing = await get_user_by_email(db, input_data.email)
        if existing and existing.id != user_id:
            raise ConflictError("Email already in use")
        updates["email"] = input_data.email
    if input_data.phone is not None:
        updates["phone"] = input_data.phone

    if not updates:
        # Nothing to update — return current profile
        return await get_profile(db, user_id)

    updated = await update_user(db, user_id, updates)
    if updated is None:
        raise NotFoundError(entity="User", entity_id=str(user_id))

    secret_link = await _ensure_secret_link(db, user_id)

    return ProfileResponse(
        first_name=updated.first_name,
        last_name=updated.last_name,
        email=updated.email,
        phone=updated.phone or "",
        role=updated.role,
        secret_link=secret_link,
    )


async def change_password(
    db: AsyncSession,
    user_id: UUID,
    input_data: ChangePasswordInput,
) -> None:
    """Change the current user's password."""
    from passlib.context import CryptContext

    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise NotFoundError(entity="User", entity_id=str(user_id))

    # Validate current password
    if not _pwd_context.verify(input_data.current_password, user.password_hash):
        raise ValidationError("Current password is incorrect")

    # Validate new password length
    if len(input_data.new_password) < 6:
        raise ValidationError(
            "New password must be at least 6 characters"
        )

    # Validate confirmation match
    if input_data.new_password != input_data.confirm_password:
        raise ValidationError("Passwords do not match")

    # Hash and save the new password
    new_hash = _pwd_context.hash(input_data.new_password)
    await update_user(db, user_id, {"password_hash": new_hash})
