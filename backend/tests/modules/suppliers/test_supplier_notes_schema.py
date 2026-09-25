"""Owner decision П35 — supplier notes become records, not one string.

Checked against ORM metadata and the revision file's own text, same style as
`tests/modules/clients/test_clients_schema.py`.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy import DateTime, Text

from app.modules.suppliers.shared.models import SupplierNote

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "e7a3c81b04f6_supplier_notes_records.py"
)


class SupplierNoteTableTests(unittest.TestCase):
    def test_table_name_is_supplier_notes(self):
        self.assertEqual("supplier_notes", SupplierNote.__tablename__)


class SupplierNoteForeignKeysTests(unittest.TestCase):
    """tenant_id and supplier_id cascade with their parents; both required and indexed."""

    def _fk_ondelete(self, column_name: str) -> str:
        column = SupplierNote.__table__.c[column_name]
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks), f"expected exactly one FK on {column_name}")
        return fks[0].ondelete

    def test_tenant_id_is_not_null_and_cascades_on_delete(self):
        column = SupplierNote.__table__.c["tenant_id"]
        self.assertFalse(column.nullable)
        self.assertEqual("CASCADE", self._fk_ondelete("tenant_id"))

    def test_tenant_id_is_indexed(self):
        indexed = any(
            "tenant_id" in index.columns.keys() for index in SupplierNote.__table__.indexes
        )
        self.assertTrue(indexed, "tenant_id must be indexed")

    def test_supplier_id_is_not_null_and_cascades_on_delete(self):
        column = SupplierNote.__table__.c["supplier_id"]
        self.assertFalse(column.nullable)
        self.assertEqual("CASCADE", self._fk_ondelete("supplier_id"))

    def test_supplier_id_is_indexed(self):
        indexed = any(
            "supplier_id" in index.columns.keys() for index in SupplierNote.__table__.indexes
        )
        self.assertTrue(indexed, "supplier_id must be indexed")

    def test_composite_index_on_tenant_and_supplier(self):
        composite = [
            index
            for index in SupplierNote.__table__.indexes
            if set(index.columns.keys()) == {"tenant_id", "supplier_id"}
        ]
        self.assertEqual(
            1,
            len(composite),
            "expected exactly one composite index on (tenant_id, supplier_id)",
        )


class SupplierNoteAuthorTests(unittest.TestCase):
    """author_id is a nullable set-null reference; author_name is a required snapshot."""

    def test_author_id_is_nullable_and_set_null_on_delete(self):
        column = SupplierNote.__table__.c["author_id"]
        self.assertTrue(column.nullable, "supplier note author_id must be nullable")
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks), "expected exactly one FK on author_id")
        self.assertEqual("SET NULL", fks[0].ondelete)

    def test_author_name_snapshot_is_not_null(self):
        column = SupplierNote.__table__.c["author_name"]
        self.assertFalse(column.nullable, "supplier note must record an author name")


class SupplierNoteContentTests(unittest.TestCase):
    """text is required free text; created_at is server-defaulted."""

    def test_text_is_not_null(self):
        column = SupplierNote.__table__.c["text"]
        self.assertFalse(column.nullable)
        self.assertIsInstance(column.type, Text)

    def test_created_at_has_server_default(self):
        column = SupplierNote.__table__.c["created_at"]
        self.assertFalse(column.nullable)
        self.assertIsInstance(column.type, DateTime)
        self.assertIsNotNone(column.server_default)


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity/parent, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "e7a3c81b04f6"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "d8b3f1c25a60"', self.text)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_drops_the_new_table(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('op.drop_table("supplier_notes")', body)


if __name__ == "__main__":
    unittest.main()
