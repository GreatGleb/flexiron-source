"""Repository for Get Current User (Me) feature."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import User


async def get_user_by_id(
    db: AsyncSession, user_id: UUID
) -> User | None:
    """Fetch a user by their ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
