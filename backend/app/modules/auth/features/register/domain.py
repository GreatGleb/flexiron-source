"""Domain use case for Register feature.

Contains pure business logic — registration validation,
tenant/user creation, and auto-login session generation.
"""

import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from itsdangerous import URLSafeTimedSerializer

from app.core.config import settings
from app.core.exceptions import ValidationError, ConflictError
from app.modules.auth.features.register.repository import (
    get_user_by_email as get_user_by_email_repo,
    get_tenant_by_slug as get_tenant_by_slug_repo,
    create_tenant as create_tenant_repo,
    create_user as create_user_repo,
    _slugify,
)

_SECRET_LINK_BYTES = 48
from app.modules.auth.features.register.schemas import (
    RegisterInput,
    RegisterResponse,
)

# ── Password context (shared with login) ──
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _validate_vat(vat_code: str) -> None:
    """Basic VAT format validation (EU pattern)."""
    if not re.match(r"^[A-Z]{2}[A-Z0-9]{2,12}$", vat_code.strip().upper()):
        raise ValidationError(
            "Invalid VAT code format. Expected format: XX0000000000 "
            "(2-letter country code followed by digits/letters)"
        )


def _ensure_unique_slug(
    db: AsyncSession,
    base_slug: str,
) -> str:
    """Append numeric suffix if slug already exists."""
    slug = base_slug
    counter = 1
    # We'll check in the domain function itself — this is a sync helper
    return slug


def _generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(32)


def _hash_token(token: str) -> str:
    """Hash a session token for DB storage (SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()


async def register(
    db: AsyncSession,
    input_data: RegisterInput,
) -> RegisterResponse:
    """Execute the registration use case.

    1. Validate input (VAT format, required fields)
    2. Check email uniqueness
    3. Create tenant (company) with slug
    4. Create user with hashed password
    5. Generate session token for auto-login
    6. Return user info
    """
    # 1. Validate VAT format
    _validate_vat(input_data.vat_code)

    # 2. Check email uniqueness
    email = input_data.email.strip().lower()
    existing_user = await get_user_by_email_repo(db, email)
    if existing_user is not None:
        raise ConflictError("A user with this email already exists")

    # 3. Generate slug and ensure uniqueness
    base_slug = _slugify(input_data.company_name)
    slug = base_slug
    counter = 1
    while await get_tenant_by_slug_repo(db, slug) is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1

    # 4. Create tenant
    tenant = await create_tenant_repo(
        db=db,
        name=input_data.company_name.strip(),
        slug=slug,
        vat_code=input_data.vat_code.strip().upper(),
    )

    # 4a. Initialize company info singleton with name and VAT code
    from app.modules.settings.internal_api.interface import init_company_info
    await init_company_info(
        db=db,
        tenant_id=tenant.id,
        name=input_data.company_name.strip(),
        vat_code=input_data.vat_code.strip().upper(),
    )

    # 5. Generate unique secret link token
    secret_link_token = secrets.token_urlsafe(_SECRET_LINK_BYTES)

    # 6. Hash password and create user
    password_hash = _pwd_context.hash(input_data.password)
    user = await create_user_repo(
        db=db,
        tenant_id=tenant.id,
        email=email,
        password_hash=password_hash,
        locale=input_data.locale,
        secret_link_token=secret_link_token,
        first_name=input_data.first_name or "",
        last_name=input_data.last_name or "",
        phone=input_data.phone,
    )

    # 6. Auto-login: generate session token
    serializer = URLSafeTimedSerializer(
        secret_key=settings.secret_key,
        salt="session",
    )
    session_token = serializer.dumps({"user_id": str(user.id)})
    token_hash = _hash_token(session_token)

    # Store session (side-effect: auto-login after registration)
    from app.modules.auth.features.login.repository import (
        create_session as create_session_repo,
    )
    csrf_token = _generate_csrf_token()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours)
    await create_session_repo(
        db=db,
        user_id=user.id,
        token_hash=token_hash,
        csrf_token=csrf_token,
        expires_at=expires_at,
    )

    # 8. Build secret link URL
    secret_link = f"{settings.frontend_url}/auth/link?token={secret_link_token}"

    # 9. Return user info + session + secret link
    return RegisterResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        locale=user.locale,
        role=user.role,
        tenant_id=user.tenant_id,
        is_active=user.is_active,
        session={
            "token": session_token,
            "csrf_token": csrf_token,
            "expires_at": expires_at,
        },
        secret_link=secret_link,
    )
