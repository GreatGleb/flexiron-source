"""Domain use case for Get Current User (Me) feature."""

from app.modules.auth.shared.models import User
from app.modules.auth.shared.secret_link import build_secret_link
from app.modules.auth.features.me.schemas import MeResponse


def build_current_user(user: User) -> MeResponse:
    """Project the identity already loaded by the authentication dependency."""
    # Build secret link if user has a token
    secret_link = None
    if user.secret_link_token:
        secret_link = build_secret_link(user.secret_link_token)

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
        secret_link=secret_link,
    )
