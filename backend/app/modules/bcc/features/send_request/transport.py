"""SMTP transport for the BCC send-request slice.

Thin on purpose: everything worth arguing about — one envelope, all addresses in
BCC — is decided in `domain.py` and tested there.  What is left here is the part
that needs a real server and therefore cannot be tested without one: opening the
session, encrypting it, logging in, closing it.
"""

from __future__ import annotations

import smtplib
import ssl
from contextlib import contextmanager
from email.message import EmailMessage
from typing import Iterator

from app.modules.bcc.features.send_request.domain import MailServerConfig


@contextmanager
def smtp_transport(mail: MailServerConfig, timeout: float = 30.0) -> Iterator[smtplib.SMTP]:
    """Open one SMTP session for one send, and close it afterwards.

    `encryption` carries the three values the settings form offers — `none`,
    `ssl`, `starttls` (`MAIL_ENCRYPTIONS` in `src/types/settings.ts`).  An
    unknown value is treated as `none` rather than raising: the form cannot
    produce one, and a send is not the place to discover that it did.
    """
    if mail.encryption == "ssl":
        client: smtplib.SMTP = smtplib.SMTP_SSL(
            mail.host, mail.port, timeout=timeout, context=ssl.create_default_context()
        )
    else:
        client = smtplib.SMTP(mail.host, mail.port, timeout=timeout)
        if mail.encryption == "starttls":
            client.starttls(context=ssl.create_default_context())

    try:
        if mail.username:
            client.login(mail.username, mail.password)
        yield client
    finally:
        client.quit()


def send_via_smtp(mail: MailServerConfig, message: EmailMessage) -> None:
    """Hand one already-built envelope to a real server, in one session.

    `send_message` without `to_addrs` is what turns the `Bcc` header into
    envelope recipients while leaving that header out of the bytes on the wire —
    the documented behaviour the privacy of the supplier list rests on.
    """
    with smtp_transport(mail) as client:
        client.send_message(message)
