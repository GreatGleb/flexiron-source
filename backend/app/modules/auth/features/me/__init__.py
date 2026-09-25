"""Get Current User (Me) feature — `GET /api/auth/me`."""

from app.modules.auth.features.me.domain import build_current_user
from app.modules.auth.features.me.schemas import MeInput, MeResponse

__all__ = ["router", "MeInput", "MeResponse", "build_current_user"]


def __getattr__(name: str):
    # `action.py` imports `app.modules.auth.shared.dependencies`, which itself
    # imports `me.repository` to build `get_current_user` — importing
    # `action` eagerly here at package-init time re-enters `dependencies`
    # before it finishes and raises a circular-import error. Deferring the
    # `router` lookup to first access breaks that cycle.
    if name == "router":
        from app.modules.auth.features.me.action import router

        return router
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
