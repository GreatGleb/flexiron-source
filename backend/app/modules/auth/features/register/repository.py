"""Repository for Register feature (Infrastructure / Data Access layer).

Handles tenant + user creation during registration.
"""

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import Tenant, User, UserRole


def _slugify(name: str) -> str:
    """Generate a URL-safe slug from a company name."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug)
    slug = slug.strip("-")
    return slug or "company"


async def get_tenant_by_slug(
    db: AsyncSession,
    slug: str,
) -> Tenant | None:
    """Check if a tenant slug already exists."""
    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug)
    )
    return result.scalar_one_or_none()


async def get_user_by_email(
    db: AsyncSession,
    email: str,
) -> User | None:
    """Check if a user with this email already exists."""
    result = await db.execute(
        select(User).where(User.email == email)
    )
    return result.scalar_one_or_none()


async def create_tenant(
    db: AsyncSession,
    name: str,
    slug: str,
    vat_code: str,
) -> Tenant:
    """Create a new tenant (company) for the registration."""
    tenant = Tenant(
        name=name,
        slug=slug,
        vat_code=vat_code,
    )
    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)
    return tenant


async def create_user(
    db: AsyncSession,
    tenant_id: UUID,
    email: str,
    password_hash: str,
    locale: str,
    secret_link_token: str | None = None,
    first_name: str = "",
    last_name: str = "",
    phone: str | None = None,
) -> User:
    """Create a new user belonging to a tenant.

    The first (registering) user automatically gets the "Owner" role
    in both the legacy single-role column and the multi-role system.
    """
    user = User(
        tenant_id=tenant_id,
        email=email,
        password_hash=password_hash,
        first_name=first_name,
        last_name=last_name,
        phone=phone,
        locale=locale,
        secret_link_token=secret_link_token,
        # Legacy single-role default — first user is Owner
        role="owner",
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Multi-role: assign the "Owner" role to the first user
    owner_role = UserRole(user_id=user.id, role_name="Owner")
    db.add(owner_role)
    await db.flush()

    return user
