"""Domain use case for Login feature.

Contains pure business logic — password verification, token generation,
session creation, and rate-limit awareness.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext
from itsdangerous import URLSafeTimedSerializer

from app.core.config import settings
from app.core.exceptions import UnauthorizedError
from app.modules.auth.features.login.repository import (
    get_user_by_email as get_user_by_email_repo,
    create_session as create_session_repo,
)
from app.modules.auth.features.login.schemas import (
    LoginInput,
    LoginResponse,
    UserInfo,
    SessionInfo,
)

# ── Password context (bcrypt, auto-migration support) ──
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Session token serializer ──
_serializer = URLSafeTimedSerializer(
    secret_key=settings.secret_key,
    salt="session",
)


def _hash_token(token: str) -> str:
    """Hash a session token for DB storage (SHA-256)."""
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_urlsafe(32)


async def login(
    db: AsyncSession,
    input_data: LoginInput,
) -> LoginResponse:
    """Execute the login use case.

    1. Lookup user by email
    2. Verify password against stored hash
    3. Generate session token and CSRF token
    4. Persist session in database
    5. Return user info + session info
    """
    # 1. Find user
    user = await get_user_by_email_repo(db, input_data.email.strip().lower())
    if user is None:
        raise UnauthorizedError("Invalid email or password")

    # 2. Verify password
    if not _pwd_context.verify(input_data.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    # 3. Generate session token (signed)
    session_token = _serializer.dumps({"user_id": str(user.id)})
    token_hash = _hash_token(session_token)

    # 4. Generate CSRF token
    csrf_token = _generate_csrf_token()

    # 5. Set expiration (24h default, 30d if remember-me later)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    # 6. Create session in DB
    session = await create_session_repo(
        db=db,
        user_id=user.id,
        token_hash=token_hash,
        csrf_token=csrf_token,
        expires_at=expires_at,
    )

    # 7. Build response
    return LoginResponse(
        user=UserInfo(
            id=user.id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            phone=user.phone,
            locale=user.locale,
            role=user.role,
            tenant_id=user.tenant_id,
            is_active=user.is_active,
        ),
        session=SessionInfo(
            token=session_token,
            csrf_token=csrf_token,
            expires_at=session.expires_at,
        ),
    )
