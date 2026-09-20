"""One verified identity and tenant for the existing Bearer consumers."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.auth.features.me.repository import get_user_by_id
from app.modules.auth.shared.models import User
from app.modules.auth.shared.session_tokens import decode_session_token


@dataclass(frozen=True)
class CurrentUser:
    user_id: UUID
    tenant_id: UUID
    user: User


async def get_current_user(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    if authorization is None:
        raise HTTPException(401, detail={
            "message": "Missing authorization token", "code": "MISSING_TOKEN",
        })
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(401, detail={
            "message": "Invalid authorization token", "code": "INVALID_TOKEN",
        })
    user_id = decode_session_token(token)
    user = await get_user_by_id(db, user_id)
    if user is None or not user.is_active or user.tenant_id is None:
        raise HTTPException(401, detail={
            "message": "Unauthorized", "code": "UNAUTHORIZED",
        })
    return CurrentUser(user_id=user.id, tenant_id=user.tenant_id, user=user)
