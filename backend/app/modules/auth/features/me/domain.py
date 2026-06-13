"""Domain use case for Get Current User (Me) feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.auth.features.me.repository import get_user_by_id
from app.modules.auth.features.me.schemas import MeResponse


async def get_current_user(
    db: AsyncSession, user_id: UUID
) -> MeResponse:
    """Execute the get current user use case."""
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise NotFoundError(entity="User", entity_id=str(user_id))

    return MeResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        locale=user.locale,
        role=user.role,
        tenant_id=user.tenant_id,
        is_active=user.is_active,
    )
