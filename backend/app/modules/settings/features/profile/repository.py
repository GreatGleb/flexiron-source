"""Repository for Settings Profile feature."""

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import User


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    """Fetch a user by their ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def update_user(
    db: AsyncSession, user_id: UUID, patch: dict
) -> User | None:
    """Apply a partial update to a user record."""
    stmt = (
        update(User)
        .where(User.id == user_id)
        .values(**patch)
        .returning(User)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Fetch a user by email (used for uniqueness checks)."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
