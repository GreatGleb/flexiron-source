"""Existing Bearer format; C0 absolute age is transitional, not session state."""

from uuid import UUID

from fastapi import HTTPException
from itsdangerous import BadPayload, BadSignature, SignatureExpired, URLSafeTimedSerializer

from app.core.config import settings

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="session")


def issue_session_token(user_id: UUID) -> str:
    return _serializer.dumps({"user_id": str(user_id)})


def decode_session_token(token: str) -> UUID:
    try:
        payload = _serializer.loads(token, max_age=86400)
    except SignatureExpired as exc:
        raise HTTPException(401, detail={
            "message": "Session token expired", "code": "TOKEN_EXPIRED",
        }) from exc
    except (BadSignature, BadPayload) as exc:
        raise HTTPException(401, detail={
            "message": "Invalid session token", "code": "INVALID_TOKEN",
        }) from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("user_id"), str):
        raise HTTPException(401, detail={
            "message": "Invalid session token", "code": "INVALID_TOKEN",
        })
    try:
        return UUID(payload["user_id"])
    except ValueError as exc:
        raise HTTPException(401, detail={
            "message": "Invalid session token", "code": "INVALID_TOKEN",
        }) from exc
