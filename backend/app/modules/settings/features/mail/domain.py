"""Domain use case for the settings mail slice.

Split in two halves by what they need to run:

* the **pure half** — build the test letter, decide whether the server is filled
  in far enough to send anything, hand the letter to a transport — takes no
  database and no server, which is what makes the rules testable;
* the **stored half** — read and merge the row, encrypt the password on write,
  decrypt it only to log in — needs the session.

The SMTP client is reached through `bcc`'s internal API and never by importing
its features (Б1).  The stored password leaves the database only inside
`build_server_config`, which exists for exactly one caller: the login that sends
the test letter.
"""

from __future__ import annotations

from email.message import EmailMessage
from typing import Callable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret
from app.modules.bcc.internal_api.interface import (
    MailNotConfiguredError,
    MailServerConfig,
    is_mail_configured,
    send_smtp_message,
)
from app.modules.settings.features.mail.repository import (
    get_mail_settings as get_mail_settings_repo,
    upsert_mail_settings,
)
from app.modules.settings.features.mail.schemas import (
    MailSettingsPatchInput,
    MailSettingsResponse,
    MailTestResponse,
)
from app.modules.settings.shared.models import MailSettings

#: What the send step needs: one server, one envelope, no return value.
MailSender = Callable[[MailServerConfig, EmailMessage], None]

# The test letter is written on the server, in one language: server-side
# translated templates are a separate concern (the notifications plan owns them),
# and inventing a three-language body here would put a second translator in the
# project. The reader is the company's own administrator.
TEST_SUBJECT = "Flexiron: test message from your mail server"
TEST_BODY = (
    "This is a test message from the Flexiron mail settings page.\n"
    "Receiving it means the company mail server is configured correctly, and "
    "letters to suppliers leave through this address."
)


def to_response(row: MailSettings | None) -> MailSettingsResponse:
    """Map the stored row to the shape the form reads.

    `passwordSet` is derived, never stored: it answers "is there a password",
    which is the only thing a client is allowed to know about it (П59).
    """
    if row is None:
        return MailSettingsResponse()
    return MailSettingsResponse(
        host=row.host,
        port=row.port,
        encryption=row.encryption,
        username=row.username,
        password_set=row.password_encrypted is not None,
        from_email=row.from_email,
        from_name=row.from_name,
    )


async def get_mail_settings(db: AsyncSession, tenant_id: UUID) -> MailSettingsResponse:
    """Read the tenant's mail server.

    A tenant that never saved anything is not an error: the form has to open
    with empty fields, not with a refusal.
    """
    row = await get_mail_settings_repo(db, tenant_id)
    return to_response(row)


async def patch_mail_settings(
    db: AsyncSession, tenant_id: UUID, input_data: MailSettingsPatchInput
) -> MailSettingsResponse:
    """Merge-patch the mail server, encrypting a password if one was typed.

    Absent and empty password both mean "leave the stored one alone" — the form
    sends the field only when somebody typed in it, and an empty field means the
    human did not type.  There is deliberately no way to erase the password here.
    """
    data = input_data.model_dump(exclude_none=True)
    password = data.pop("password", None)
    if password is not None and password.strip():
        data["password_encrypted"] = encrypt_secret(password)

    row = await upsert_mail_settings(db, tenant_id, data)
    return to_response(row)


def build_server_config(row: MailSettings | None) -> MailServerConfig:
    """Turn the stored row into the value object the transport expects.

    The only place the stored password is decrypted.
    """
    if row is None:
        raise MailNotConfiguredError()
    return MailServerConfig(
        host=row.host,
        port=row.port,
        encryption=row.encryption,
        username=row.username,
        password=decrypt_secret(row.password_encrypted) if row.password_encrypted else "",
        from_email=row.from_email,
        from_name=row.from_name,
    )


def build_test_message(
    mail: MailServerConfig,
    subject: str = TEST_SUBJECT,
    body: str = TEST_BODY,
) -> EmailMessage:
    """Build the one letter the test sends — addressed to the sender itself.

    Not `build_bcc_envelope`: that builder exists to hide many recipients behind
    one envelope, and a test letter has exactly one.  What is kept is the sender
    identity — the same `From` a price request leaves with — so a passing test
    says something about real letters too.

    The letter goes to the sender's own address, which means the server has to be
    able to accept its own mail: the contract says so out loud.
    """
    message = EmailMessage()
    message["From"] = (
        f"{mail.from_name} <{mail.from_email}>" if mail.from_name else mail.from_email
    )
    message["To"] = mail.from_email
    message["Subject"] = subject
    message.set_content(body)
    return message


def deliver_test_message(
    sender: MailSender,
    mail: MailServerConfig,
    subject: str = TEST_SUBJECT,
    body: str = TEST_BODY,
) -> str:
    """Send the test letter and name the address it went to.

    A half-configured server refuses instead of pretending: the button would
    otherwise be testing itself.  The refusal is the same `MAIL_NOT_CONFIGURED`
    code the BCC tool and the frontend gate already speak.
    """
    if not is_mail_configured(mail):
        raise MailNotConfiguredError()

    message = build_test_message(mail, subject, body)
    sender(mail, message)
    return mail.from_email


async def send_mail_test(
    db: AsyncSession,
    tenant_id: UUID,
    sender: MailSender = send_smtp_message,
) -> MailTestResponse:
    """Send the test letter from the **saved** settings, saving nothing.

    Parameters are read back from the row rather than taken from the request:
    what gets tested is the server as it is stored, not the draft in the form.
    """
    row = await get_mail_settings_repo(db, tenant_id)
    mail = build_server_config(row)
    delivered_to = deliver_test_message(sender, mail)
    return MailTestResponse(delivered_to=delivered_to)
