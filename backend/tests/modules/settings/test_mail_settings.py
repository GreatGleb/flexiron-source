"""Behaviour of the settings mail slice that can be proved without a database.

The stored half of the slice needs a session; the rules around it do not, and
those rules are the part worth checking: the password is stored encrypted and
never travels back to a client, a server that is filled in only halfway refuses
instead of pretending, and the test letter is addressed to the sender itself.
Everything here calls the same functions the three endpoints call.

Inversions run 2026-09-21 (Л9 — a test that cannot fail proves nothing): dropping
the `is_mail_configured` gate reddens five tests; storing the password in clear
reddens one plus eight errors; taking the auth dependency off the mail GET route
reddens the route-auth gate in `tests/test_route_auth.py`. A fourth attempt —
`passwordSet` hardcoded to `True` — stayed **green**, and that is where
`test_a_row_without_a_password_says_so` came from: without it, nothing proved the
flag was derived from the stored password instead of typed into the answer.
"""

import asyncio
import unittest
import uuid
from unittest.mock import patch

from email.message import EmailMessage

from app.core.crypto import decrypt_secret, encrypt_secret
from app.modules.bcc.internal_api.interface import (
    MailNotConfiguredError,
    MailServerConfig,
)
from app.modules.settings.features.mail import domain
from app.modules.settings.features.mail.domain import (
    build_server_config,
    deliver_test_message,
    to_response,
)
from app.modules.settings.shared.models import MailSettings

PASSWORD = "smtp-token"
TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def make_row(**overrides) -> MailSettings:
    """A stored mail row, with the password already encrypted as storage does."""
    values = {
        "tenant_id": TENANT_ID,
        "host": "smtp.flexiron.lt",
        "port": 587,
        "encryption": "starttls",
        "username": "sales@flexiron.lt",
        "password_encrypted": encrypt_secret(PASSWORD),
        "from_email": "sales@flexiron.lt",
        "from_name": "Flexiron",
    }
    values.update(overrides)
    return MailSettings(**values)


class RecordingSender:
    """The transport, with the socket taken away: it records what it was handed."""

    def __init__(self) -> None:
        self.sent: list[tuple[MailServerConfig, EmailMessage]] = []

    def __call__(self, mail: MailServerConfig, message: EmailMessage) -> None:
        self.sent.append((mail, message))


class StoredPasswordTests(unittest.TestCase):
    """П59 — the password is written and never read back."""

    def test_the_stored_password_is_not_the_password(self) -> None:
        row = make_row()

        self.assertNotEqual(row.password_encrypted, PASSWORD)
        self.assertNotIn(PASSWORD, row.password_encrypted or "")

    def test_the_stored_password_can_be_read_back_for_login(self) -> None:
        mail = build_server_config(make_row())

        self.assertEqual(mail.password, PASSWORD)

    def test_the_response_says_whether_a_password_is_set_and_no_more(self) -> None:
        payload = to_response(make_row()).model_dump(mode="json", by_alias=True)

        self.assertIs(payload["passwordSet"], True)
        self.assertNotIn("password", payload)
        self.assertNotIn("passwordEncrypted", payload)
        self.assertEqual(
            set(payload),
            {
                "host",
                "port",
                "encryption",
                "username",
                "passwordSet",
                "fromEmail",
                "fromName",
            },
        )

    def test_a_tenant_without_a_row_reads_as_an_empty_form(self) -> None:
        payload = to_response(None).model_dump(mode="json", by_alias=True)

        self.assertEqual(payload["passwordSet"], False)
        self.assertEqual(payload["host"], "")
        self.assertEqual(payload["port"], 587)

    def test_a_row_without_a_password_says_so(self) -> None:
        """`passwordSet` answers about the stored row — it is derived, not typed in.

        Without this case the flag could be hardcoded to `True` and every other
        test here would still pass (found by inversion 2026-09-21).
        """
        payload = to_response(make_row(password_encrypted=None)).model_dump(
            mode="json", by_alias=True
        )

        self.assertIs(payload["passwordSet"], False)


class HalfConfiguredServerTests(unittest.TestCase):
    """A test that ran on a server nobody can send through would test itself."""

    def test_a_tenant_without_a_row_refuses_to_become_a_server(self) -> None:
        with self.assertRaises(MailNotConfiguredError):
            build_server_config(None)

    def test_every_leg_of_the_gate_refuses_on_its_own(self) -> None:
        sender = RecordingSender()
        lacking = (
            {"host": ""},
            {"from_email": ""},
            {"password_encrypted": None},
        )

        for overrides in lacking:
            with self.subTest(overrides=overrides):
                mail = build_server_config(make_row(**overrides))
                with self.assertRaises(MailNotConfiguredError):
                    deliver_test_message(sender, mail)

        self.assertEqual(sender.sent, [])

    def test_a_refused_test_sends_nothing(self) -> None:
        sender = RecordingSender()

        with self.assertRaises(MailNotConfiguredError):
            deliver_test_message(sender, build_server_config(make_row(host="")))

        self.assertEqual(len(sender.sent), 0)


class TestLetterTests(unittest.TestCase):
    """The letter the button sends: one envelope, to the sender's own address."""

    def test_the_letter_goes_to_the_sender_itself(self) -> None:
        sender = RecordingSender()
        mail = build_server_config(make_row())

        delivered_to = deliver_test_message(sender, mail)

        self.assertEqual(delivered_to, mail.from_email)
        self.assertEqual(len(sender.sent), 1)
        _, message = sender.sent[0]
        self.assertEqual(message["To"], mail.from_email)
        self.assertEqual(message["From"], f"{mail.from_name} <{mail.from_email}>")

    def test_the_letter_carries_a_subject_and_a_body(self) -> None:
        sender = RecordingSender()
        deliver_test_message(sender, build_server_config(make_row()))

        _, message = sender.sent[0]

        self.assertEqual(message["Subject"], domain.TEST_SUBJECT)
        self.assertIn(domain.TEST_BODY.splitlines()[0], message.get_content())

    def test_the_delivered_address_is_the_saved_one_not_a_draft(self) -> None:
        """The endpoint answers with the address the letter went to, which is the
        stored one — naming a draft would be a lie about the recipient."""
        sender = RecordingSender()
        mail = build_server_config(make_row(from_email="other@flexiron.lt"))

        delivered_to = deliver_test_message(sender, mail)

        self.assertEqual(delivered_to, "other@flexiron.lt")
        self.assertEqual(sender.sent[0][1]["To"], "other@flexiron.lt")


class SendMailTestUsecaseTests(unittest.TestCase):
    """Shown as `Task` semantics: the saved row is read, nothing is written."""

    def _run(self, row: MailSettings | None, sender: RecordingSender) -> dict:
        async def fake_repo(db, tenant_id):  # noqa: ANN001, ANN202
            return row

        with patch.object(domain, "get_mail_settings_repo", fake_repo):
            result = asyncio.run(domain.send_mail_test(None, TENANT_ID, sender=sender))

        return result.model_dump(mode="json", by_alias=True)

    def test_it_reports_the_address_the_saved_settings_send_to(self) -> None:
        sender = RecordingSender()

        payload = self._run(make_row(), sender)

        self.assertEqual(payload, {"deliveredTo": "sales@flexiron.lt"})
        self.assertEqual(len(sender.sent), 1)

    def test_it_refuses_when_nothing_was_ever_saved(self) -> None:
        sender = RecordingSender()

        with self.assertRaises(MailNotConfiguredError):
            self._run(None, sender)

        self.assertEqual(sender.sent, [])


if __name__ == "__main__":
    unittest.main()
