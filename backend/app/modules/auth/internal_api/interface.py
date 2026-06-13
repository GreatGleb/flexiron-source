"""Auth Internal Service API — public contract for cross-module calls.

Other modules MUST import from here to access auth functions.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import User
from app.modules.auth.features.me.repository import (
    get_user_by_id as _get_user_by_id,
)


async def get_user_by_id(
    db: AsyncSession, user_id: UUID
) -> User | None:
    """Get a user entity by ID.

    Cross-module access point for user lookups.
    """
    return await _get_user_by_id(db, user_id)


async def check_permission(
    db: AsyncSession,
    user_id: UUID,
    permission_item_id: str,
    action: str,
) -> bool:
    """Check if a user has a specific permission.

    Placeholder — implement actual RBAC logic here.
    Returns True for now (permissive default).
    """
    return True
