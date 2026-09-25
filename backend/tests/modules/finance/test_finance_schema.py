"""finance_derived_and_author — derived column removed, author becomes a pair, currency loses its column default.

Checked against ORM metadata and the revision file's own text; no database is
needed for any of it.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.modules.auth.shared.models import User  # noqa: F401 — registers "users" for FK resolution
from app.modules.finance.shared.models import DocumentArchiveItem, FinancePayment

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "e5b2f47c9a10_finance_derived_and_author.py"
)


class FinancePaymentDocumentCountRemovedTests(unittest.TestCase):
    """`document_count` is read-time derived — a stored value goes stale silently (П68)."""

    def test_document_count_removed_from_model(self):
        self.assertFalse(hasattr(FinancePayment, "document_count"))

    def test_document_count_removed_from_table(self):
        self.assertNotIn("document_count", FinancePayment.__table__.c)


class FinancePaymentCurrencyHasNoDefaultTests(unittest.TestCase):
    """The default belongs to the creating slice, not the column."""

    def test_currency_has_no_python_default(self):
        column = FinancePayment.__table__.c["currency"]
        self.assertIsNone(column.default)

    def test_currency_has_no_server_default(self):
        column = FinancePayment.__table__.c["currency"]
        self.assertIsNone(column.server_default)

    def test_currency_stays_not_null(self):
        column = FinancePayment.__table__.c["currency"]
        self.assertFalse(column.nullable)


class DocumentArchiveItemAuthorIsReferencePlusSnapshotTests(unittest.TestCase):
    """`uploaded_by` (plain string) is replaced by a reference plus a frozen name (П36)."""

    def test_uploaded_by_column_removed(self):
        self.assertFalse(hasattr(DocumentArchiveItem, "uploaded_by"))
        self.assertNotIn("uploaded_by", DocumentArchiveItem.__table__.c)

    def test_uploaded_by_user_id_is_nullable_fk_on_users_with_set_null(self):
        column = DocumentArchiveItem.__table__.c["uploaded_by_user_id"]
        self.assertIsInstance(column.type, UUID)
        self.assertTrue(column.nullable)

        fks = list(column.foreign_keys)
        self.assertEqual(len(fks), 1)
        fk: ForeignKey = fks[0]
        self.assertEqual(fk.column.table.name, "users")
        self.assertEqual(fk.column.name, "id")
        self.assertEqual(fk.ondelete, "SET NULL")

    def test_uploaded_by_name_is_a_not_null_snapshot(self):
        column = DocumentArchiveItem.__table__.c["uploaded_by_name"]
        self.assertFalse(column.nullable)


class DocumentArchiveItemUntouchedNullableFieldsTests(unittest.TestCase):
    """`due_date` and the three archive relation fields stay `nullable=True` — the
    migration does not touch them; converting them is a separate, breaking revision."""

    def test_due_date_stays_nullable(self):
        column = FinancePayment.__table__.c["due_date"]
        self.assertTrue(column.nullable)

    def test_related_entity_fields_stay_nullable(self):
        for name in ("related_entity_type", "related_entity_id", "related_entity_number"):
            with self.subTest(column=name):
                column = DocumentArchiveItem.__table__.c[name]
                self.assertTrue(column.nullable)


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, a real downgrade, value migration."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "e5b2f47c9a10"', self.text)
        # Родитель — голова на момент переноса, а не `b8f3d0c62a71` из ночного патча.
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "c1a7d9e4f2b3"', self.text)

    def test_upgrade_copies_uploaded_by_into_uploaded_by_name(self):
        match = re.search(r"def upgrade\(\) -> None:\n(.*?)\ndef downgrade", self.text, re.DOTALL)
        self.assertIsNotNone(match, "upgrade() not found in revision file")
        body = match.group(1)
        self.assertIn("uploaded_by_name = uploaded_by", body)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_copies_uploaded_by_name_back_into_uploaded_by(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)
        self.assertIn("uploaded_by = uploaded_by_name", body)

    def test_downgrade_restores_document_count_and_currency_default(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)
        self.assertIn('"document_count"', body)
        self.assertIn('server_default="EUR"', body)

    def test_does_not_touch_due_date_or_related_entity_columns(self):
        for name in ("due_date", "related_entity_type", "related_entity_id", "related_entity_number"):
            with self.subTest(column=name):
                self.assertNotIn(f'"{name}"', self.text)


if __name__ == "__main__":
    unittest.main()
