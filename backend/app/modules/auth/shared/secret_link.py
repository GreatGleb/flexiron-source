"""Single source of truth for the secret link: its token and its URL.

Every reader/writer of the secret link (registration, /me, settings profile) must go
through this module instead of assembling the URL or drawing the token itself.

Длина токена жила здесь не всегда: до 2026-09-25 `auth` держал её именованной
константой, а `settings` — литералом `48` в собственном вызове `token_urlsafe`
(БАГ-16). Два числа на одно правило расходятся молча, поэтому и число, и обе
операции над ссылкой лежат в одном файле.
"""

import secrets

from app.core.config import settings


SECRET_LINK_BYTES = 48


def issue_secret_link_token() -> str:
    """Draw a fresh secret-link token. The only place this length is spelled out."""
    return secrets.token_urlsafe(SECRET_LINK_BYTES)


def build_secret_link(token: str) -> str:
    """Build the full secret-link URL for a given token."""
    return f"{settings.frontend_url}/auth/link?token={token}"
