"""Profile persistence goes through the auth module boundary."""

from app.modules.auth.internal_api.interface import (
    get_profile_user as get_user_by_id,
    update_profile_user as update_user,
    get_profile_user_by_email as get_user_by_email,
)

__all__ = ["get_user_by_id", "update_user", "get_user_by_email"]
