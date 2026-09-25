"""Encryption for secrets that are written and never read back.

Written for П59: the mail server password is stored in the database
**encrypted**, not as-is — anybody with database access would otherwise read the
company's mail password.  The value is written through the settings mail tab and
never returned to any client, so the only reader of `decrypt_secret` is the
server itself, right before it logs in to that server.

Key material comes from `settings.secret_key`, the one long-lived secret the
application already has.  It is hashed to the 32 bytes Fernet wants rather than
used directly, so that the key length of the deployment secret does not decide
whether encryption works.  Changing `secret_key` makes stored secrets
unreadable — that is the point of a key, and the failure is explicit
(`SecretCryptoError`) rather than a silent empty password.

Infrastructure, not business logic: this module is part of `app/core/` for the
same reason `app/core/uploads/` is — it is shared machinery with no domain rules.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings
from app.core.exceptions import AppError


class SecretCryptoError(AppError):
    """A stored secret cannot be read back — the key changed or the row is damaged."""

    def __init__(self) -> None:
        super().__init__(
            "Stored secret cannot be decrypted", code="SECRET_UNREADABLE"
        )


def _fernet() -> Fernet:
    """Build the cipher for the current deployment secret."""
    digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(plain: str) -> str:
    """Encrypt one secret for storage."""
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    """Decrypt one stored secret, or fail loudly.

    Never returns an empty string on a damaged value: an empty password would
    read as "the server is not configured", which is a different fact and would
    hide the real one.
    """
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeDecodeError) as exc:
        raise SecretCryptoError() from exc
