"""Repository for Magic Link Login feature."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import User


async def get_user_by_secret_link(
    db: AsyncSession,
    token: str,
) -> User | None:
    """Find a user by their secret_link_token."""
    result = await db.execute(
        select(User).where(User.secret_link_token == token)
    )
    return result.scalar_one_or_none()
