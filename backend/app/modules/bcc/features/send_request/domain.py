"""Domain use case for the BCC send-request feature.

Spec 04.2 §4 states the requirement this module exists for: the price request
leaves as **one** email, every supplier address in BCC, so that suppliers never
see each other.  A loop of one letter per supplier looks identical from the
outside — same inboxes, same text — which is why the guarantee is expressed as
code with a test around it instead of a sentence in a review.

Deliberately dependency-free: only the standard library plus
``app.core.exceptions``.  The rule is worth nothing if it cannot be run, and the
backend has neither a database nor a mail server available while it is checked.
"""

from __future__ import annotations

from dataclasses import dataclass
from email.message import EmailMessage
from typing import Iterable, Protocol

from app.core.exceptions import AppError


class MailNotConfiguredError(AppError):
    """The mail server is not filled in far enough to send anything through it.

    Same code the frontend already speaks (`MAIL_NOT_CONFIGURED`), so a refused
    send reads the same on both sides of the wire.
    """

    def __init__(self) -> None:
        super().__init__("Mail server is not configured", code="MAIL_NOT_CONFIGURED")


class NoRecipientsError(AppError):
    """A price request without a single supplier is not a request."""

    def __init__(self) -> None:
        super().__init__("Request has no recipients", code="NO_RECIPIENTS")


@dataclass(frozen=True)
class MailServerConfig:
    """Mail server parameters — the backend half of `MailServerSettings`.

    The one field the frontend type does not have is `password`: it is written
    and never read back (spec 04.2 §6), so it lives only here.
    """

    host: str
    port: int
    encryption: str
    username: str
    password: str
    from_email: str
    from_name: str = ""


def is_mail_configured(mail: MailServerConfig) -> bool:
    """Can anything be sent through this server at all.

    Host, sender address and password — the same three conditions the frontend
    gate uses (`isMailConfigured` in `src/types/settings.ts`).  Login and sender
    name are optional: a server that wants neither still delivers.
    """
    return bool(mail.host) and bool(mail.from_email) and bool(mail.password)


class MailTransport(Protocol):
    """What `send_bcc_request` needs from a mail transport.

    Deliberately the signature of `smtplib.SMTP.send_message`, so the real
    client satisfies it as-is and a test double is three lines.
    """

    def send_message(self, message: EmailMessage) -> object: ...


def build_bcc_envelope(
    mail: MailServerConfig,
    recipient_emails: Iterable[str],
    subject: str,
    body: str,
) -> EmailMessage:
    """Build the single envelope that carries the request to every supplier.

    Every supplier address goes into `Bcc` and nowhere else; `To` is the sender
    itself, so the message is addressed to somebody without naming anyone the
    recipients could read.  `smtplib.SMTP.send_message` then takes the `Bcc`
    addresses as envelope recipients and — per its documented behaviour — does
    not transmit the `Bcc` header, which is exactly what keeps the list private.
    """
    if not is_mail_configured(mail):
        raise MailNotConfiguredError()

    # Order kept, duplicates dropped: the same supplier listed twice would
    # otherwise get the request twice out of one send.
    recipients = list(dict.fromkeys(e.strip() for e in recipient_emails if e and e.strip()))
    if not recipients:
        raise NoRecipientsError()

    message = EmailMessage()
    message["From"] = f"{mail.from_name} <{mail.from_email}>" if mail.from_name else mail.from_email
    message["To"] = mail.from_email
    message["Bcc"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)
    return message


def send_bcc_request(
    transport: MailTransport,
    mail: MailServerConfig,
    recipient_emails: Iterable[str],
    subject: str,
    body: str,
) -> EmailMessage:
    """Send the price request — one envelope, one call, all addresses in BCC.

    The single `send_message` call is the whole point of the function: it is the
    difference between one transaction and a loop, and the difference is not
    visible in the resulting inboxes, only here.
    """
    message = build_bcc_envelope(mail, recipient_emails, subject, body)
    transport.send_message(message)
    return message
