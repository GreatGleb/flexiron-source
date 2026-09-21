"""Settings module dependencies — session token and tenant resolution.

Both rules used to live twice: once in `features/crud/action.py` and once in
`features/profile/action.py`, byte for byte the same reading of the Bearer
token (БАГ-03).  The mail slice would have made it a third copy, so the rules
moved here — the module-level home of module DI — and the three callers import
them instead of restating them.  БАГ-22 asks for exactly this («сведение
зависимостей в одно место»); inside `settings` it is now done.

The names carry the leading underscore they had at the call sites on purpose.
The rule is module-internal — nothing outside `app.modules.settings` may read a
token this way — and the auth gate in `tests/test_route_auth.py` recognises a
guarded route by the dependency name, so keeping the name keeps that gate
watching these routes without teaching it new vocabulary.

The token format is unchanged: `URLSafeTimedSerializer` with the deployment
secret and the `session` salt, carrying `user_id` in the payload.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import Header, HTTPException, status
from itsdangerous import URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.settings.features.crud.repository import get_tenant_id_for_user

_serializer = URLSafeTimedSerializer(
    secret_key=settings.secret_key,
    salt="session",
)


async def _resolve_user_id(
    authorization: Optional[str] = Header(None),
) -> uuid.UUID:
    """Extract user_id from the Bearer session token.

    Reads the Authorization header, validates the token, and returns
    the embedded user_id.  Raises 401 if the token is missing or invalid.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Missing Authorization header", "code": "UNAUTHORIZED"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid Authorization header", "code": "UNAUTHORIZED"},
        )

    try:
        data = _serializer.loads(token)
        user_id_str = data.get("user_id")
        if not user_id_str:
            raise ValueError("Missing user_id in token")
        return uuid.UUID(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"message": "Invalid or expired session token", "code": "UNAUTHORIZED"},
        )


async def _resolve_tenant_id(db: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    """Resolve tenant ID for the authenticated user (or raise 404)."""
    tenant_id = await get_tenant_id_for_user(db, user_id)
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "User has no tenant", "code": "NOT_FOUND"},
        )
    return tenant_id
