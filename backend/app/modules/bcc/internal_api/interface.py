"""BCC Internal Service API — public contract for cross-module calls.

Other modules MUST call these functions to reach BCC behaviour; they MUST NOT
import from `shared/` or `features/` directly.  Until the settings mail slice
existed this file was a docstring and nothing else, because nothing outside the
module needed anything from it.

What is exposed here is the sending half of the module: the mail server value
object, the "is it filled in far enough" rule and the refusal that goes with it,
and one function that hands an already-built envelope to a real server.  The BCC
envelope rule itself — everybody in `Bcc`, the sender in `To` — stays inside the
module: it belongs to price requests, not to every letter the system sends.
"""

from __future__ import annotations

from email.message import EmailMessage

from app.modules.bcc.features.send_request.domain import (
    MailNotConfiguredError,
    MailServerConfig,
    is_mail_configured,
)
from app.modules.bcc.features.send_request.transport import send_via_smtp

__all__ = [
    "MailNotConfiguredError",
    "MailServerConfig",
    "is_mail_configured",
    "send_smtp_message",
]


def send_smtp_message(mail: MailServerConfig, message: EmailMessage) -> None:
    """Hand one already-built envelope to the mail server, in one session.

    The single cross-module entry point for sending mail: `settings` uses it for
    the test letter of the mail tab, and nothing outside this interface has to
    know that a real `smtplib` client sits behind it.
    """
    send_via_smtp(mail, message)
