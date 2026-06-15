"""Domain use case for Magic Link Login feature.

Validates a secret link token and returns the user's email
so the frontend can redirect to the login page with the
email pre-filled — the user still enters their password.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.modules.auth.features.magic_link.repository import (
    get_user_by_secret_link as get_user_by_secret_link_repo,
)
from app.modules.auth.features.magic_link.schemas import (
    MagicLinkVerifyResponse,
)


async def verify_secret_link(
    db: AsyncSession,
    token: str,
) -> MagicLinkVerifyResponse:
    """Verify a secret link token and return the user's email.

    1. Find user by secret_link_token
    2. Validate user is active
    3. Return the email so frontend can pre-fill the login form

    The user still needs to enter their password on the login page.
    """
    # 1. Find user by secret link token
    user = await get_user_by_secret_link_repo(db, token)
    if user is None:
        raise UnauthorizedError("Invalid or expired secret link")

    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")

    # 2. Return email only — no session created
    return MagicLinkVerifyResponse(
        email=user.email,
    )
