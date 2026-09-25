"""Auth Internal Service API — public contract for cross-module calls.

Other modules MUST import from here to access auth functions.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import Tenant, User
from app.modules.auth.shared.dependencies import CurrentUser, get_current_user
# Сборка ссылки — чистая функция, общая для всех читателей; чужие модули берут её
# отсюда, а не из auth.shared напрямую (Б1).
from app.modules.auth.shared.secret_link import (  # noqa: F401
    build_secret_link,
    issue_secret_link_token,
)
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


async def get_tenant_registration_data(db: AsyncSession, tenant_id: UUID) -> dict:
    """Read the tenant registry for lazy settings initialization."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    return {"name": tenant.name or "", "vat_code": tenant.vat_code or ""} if tenant else {}


async def get_profile_user(db: AsyncSession, user_id: UUID, tenant_id: UUID) -> User | None:
    result = await db.execute(select(User).where(
        User.id == user_id, User.tenant_id == tenant_id,
    ))
    return result.scalar_one_or_none()


async def update_profile_user(
    db: AsyncSession, user_id: UUID, tenant_id: UUID, patch: dict,
) -> User | None:
    result = await db.execute(update(User).where(
        User.id == user_id, User.tenant_id == tenant_id,
    ).values(**patch).returning(User))
    user = result.scalar_one_or_none()
    return user


async def get_profile_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Legacy global uniqueness check; company-aware email changes belong to C1."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
