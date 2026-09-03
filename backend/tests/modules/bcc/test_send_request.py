"""The BCC price request leaves as ONE email with every address in BCC.

Spec 04.2 §4.  This is the requirement the plan calls out as impossible to check
by eye: a loop of one letter per supplier produces the same inboxes, the same
text and the same sender — the difference is the number of transactions and who
can read the recipient list, and neither is visible from outside.

Standard library only (`unittest`), because that is what can actually be run:
the backend has no pytest, no database and no mail server in this environment,
and a check that cannot be run is not a check.

    cd backend && python3 -m unittest discover -s tests -t .
"""

from __future__ import annotations

import smtplib
import unittest
from email.message import EmailMessage

from app.modules.bcc.features.send_request.domain import (
    MailNotConfiguredError,
    MailServerConfig,
    NoRecipientsError,
    build_bcc_envelope,
    is_mail_configured,
    send_bcc_request,
)

CONFIGURED = MailServerConfig(
    host="smtp.flexiron.lt",
    port=587,
    encryption="starttls",
    username="sales@flexiron.lt",
    password="smtp-token",
    from_email="sales@flexiron.lt",
    from_name="Flexiron Sales",
)

SUPPLIERS = ["metals@alpha.lt", "sales@beta.lv", "office@gamma.ee"]
SUBJECT = "Metal price request 28.08.2026 — Flexiron Enterprise"
BODY = "Please provide current prices."


class RecordingTransport:
    """Counts sends and keeps what was handed over."""

    def __init__(self) -> None:
        self.messages: list[EmailMessage] = []

    def send_message(self, message: EmailMessage) -> object:
        self.messages.append(message)
        return {}


class RecordingSmtp(smtplib.SMTP):
    """A real `smtplib.SMTP` with only the socket taken away.

    Everything that decides what goes on the wire — recipient list, header
    stripping — is the stdlib's own `send_message`, untouched.  A hand-written
    fake would prove that the fake behaves, not that SMTP does.
    """

    def __init__(self) -> None:  # noqa: D107 — deliberately skips the connect
        self.calls: list[tuple[str, list[str], str]] = []

    def ehlo_or_helo_if_needed(self) -> None:
        return None

    def sendmail(self, from_addr, to_addrs, msg, mail_options=(), rcpt_options=()):  # type: ignore[override]
        text = msg.decode() if isinstance(msg, (bytes, bytearray)) else msg
        self.calls.append((from_addr, list(to_addrs), text))
        return {}


class TestOneTransaction(unittest.TestCase):
    def test_many_recipients_cost_exactly_one_send(self) -> None:
        transport = RecordingTransport()
        self.assertGreater(len(SUPPLIERS), 1)

        send_bcc_request(transport, CONFIGURED, SUPPLIERS, SUBJECT, BODY)

        # A loop would leave len(SUPPLIERS) messages here and look identical
        # from every inbox.
        self.assertEqual(len(transport.messages), 1)

    def test_one_send_carries_every_recipient(self) -> None:
        transport = RecordingTransport()

        send_bcc_request(transport, CONFIGURED, SUPPLIERS, SUBJECT, BODY)

        bcc = transport.messages[0]["Bcc"]
        for address in SUPPLIERS:
            self.assertIn(address, bcc)

    def test_a_repeated_supplier_is_not_written_twice(self) -> None:
        transport = RecordingTransport()

        send_bcc_request(transport, CONFIGURED, [*SUPPLIERS, SUPPLIERS[0]], SUBJECT, BODY)

        bcc = transport.messages[0]["Bcc"]
        self.assertEqual(bcc.count(SUPPLIERS[0]), 1)


class TestNobodySeesAnybody(unittest.TestCase):
    def test_no_supplier_address_appears_in_a_visible_header(self) -> None:
        message = build_bcc_envelope(CONFIGURED, SUPPLIERS, SUBJECT, BODY)

        visible = f"{message['To']} {message.get('Cc', '')}"
        for address in SUPPLIERS:
            self.assertNotIn(address, visible)
        self.assertEqual(message["To"], CONFIGURED.from_email)
        self.assertIsNone(message.get("Cc"))

    def test_the_transmitted_bytes_carry_no_recipient_list(self) -> None:
        """The privacy of the list rests on this, not on the Bcc header alone.

        `send_message` turns Bcc into envelope recipients and drops the header
        before the bytes leave — so the letter each supplier receives contains
        no address but its own delivery, and no name of anyone else.
        """
        client = RecordingSmtp()

        client.send_message(build_bcc_envelope(CONFIGURED, SUPPLIERS, SUBJECT, BODY))

        self.assertEqual(len(client.calls), 1)
        from_addr, to_addrs, text = client.calls[0]
        self.assertEqual(from_addr, CONFIGURED.from_email)
        for address in SUPPLIERS:
            self.assertIn(address, to_addrs)  # delivered to
            self.assertNotIn(address, text)  # but named nowhere in the letter
        self.assertNotIn("Bcc", text)

    def test_the_envelope_is_addressed_from_the_mail_settings(self) -> None:
        message = build_bcc_envelope(CONFIGURED, SUPPLIERS, SUBJECT, BODY)

        self.assertEqual(message["From"], "Flexiron Sales <sales@flexiron.lt>")
        self.assertEqual(message["Subject"], SUBJECT)
        self.assertEqual(message.get_content().strip(), BODY)


class TestRefusals(unittest.TestCase):
    def test_an_unconfigured_server_refuses_instead_of_pretending(self) -> None:
        for field in ("host", "from_email", "password"):
            with self.subTest(missing=field):
                mail = MailServerConfig(**{**CONFIGURED.__dict__, field: ""})
                self.assertFalse(is_mail_configured(mail))

                transport = RecordingTransport()
                with self.assertRaises(MailNotConfiguredError):
                    send_bcc_request(transport, mail, SUPPLIERS, SUBJECT, BODY)
                self.assertEqual(transport.messages, [])

    def test_optional_fields_do_not_block_a_send(self) -> None:
        mail = MailServerConfig(**{**CONFIGURED.__dict__, "username": "", "from_name": ""})

        self.assertTrue(is_mail_configured(mail))
        self.assertEqual(build_bcc_envelope(mail, SUPPLIERS, SUBJECT, BODY)["From"], mail.from_email)

    def test_a_request_without_recipients_is_refused(self) -> None:
        transport = RecordingTransport()

        with self.assertRaises(NoRecipientsError):
            send_bcc_request(transport, CONFIGURED, ["", "   "], SUBJECT, BODY)
        self.assertEqual(transport.messages, [])


if __name__ == "__main__":
    unittest.main()
