"""Repository for Login feature (Infrastructure / Data Access layer).

Handles user lookup and session creation for authentication.
"""

from uuid import UUID
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import User, Session


async def get_user_by_email(
    db: AsyncSession,
    email: str,
) -> User | None:
    """Find a user by their email address."""
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalar_one_or_none()


async def create_session(
    db: AsyncSession,
    user_id: UUID,
    token_hash: str,
    csrf_token: str,
    expires_at: datetime,
    remember: bool = False,
) -> Session:
    """Create a new session for the user."""
    session = Session(
        user_id=user_id,
        token_hash=token_hash,
        csrf_token=csrf_token,
        expires_at=expires_at,
        remember=remember,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session
