"""С1 of the clients domain plan — storage only, no routes, no DB needed.

Checked against ORM metadata and the revision file's own text, same style as
`tests/modules/suppliers/test_supplier_schema.py`.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy import Date

from app.modules.clients.shared.models import Client, ClientInteraction

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "d41c7a9b5e02_clients_module_tables.py"
)


class ClientUniqueConstraintsTests(unittest.TestCase):
    """Three tenant-paired uniques, none of them a bare single-column unique."""

    def _unique_column_sets(self):
        return [
            frozenset(col.name for col in constraint.columns)
            for constraint in Client.__table__.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        ]

    def test_exactly_three_unique_constraints(self):
        self.assertEqual(3, len(self._unique_column_sets()))

    def test_each_unique_constraint_starts_with_tenant_id(self):
        for columns in self._unique_column_sets():
            with self.subTest(columns=columns):
                self.assertIn("tenant_id", columns)
                self.assertEqual(2, len(columns))

    def test_unique_pairs_are_company_code_vat_code_email(self):
        second_columns = {
            frozenset(columns - {"tenant_id"}) for columns in self._unique_column_sets()
        }
        self.assertEqual(
            {frozenset({"company_code"}), frozenset({"vat_code"}), frozenset({"email"})},
            second_columns,
        )

    def test_no_single_column_unique_exists(self):
        for column in Client.__table__.c:
            with self.subTest(column=column.name):
                self.assertFalse(column.unique)


class ClientColumnShapeTests(unittest.TestCase):
    """rejection_reason is gone; status/payment_terms_days have no default; created_at is a Date."""

    def test_rejection_reason_column_does_not_exist(self):
        self.assertFalse(hasattr(Client, "rejection_reason"))
        self.assertNotIn("rejection_reason", Client.__table__.c)

    def test_status_is_not_null_without_server_default(self):
        column = Client.__table__.c["status"]
        self.assertFalse(column.nullable)
        self.assertIsNone(column.server_default)

    def test_payment_terms_days_is_not_null_without_server_default(self):
        column = Client.__table__.c["payment_terms_days"]
        self.assertFalse(column.nullable)
        self.assertIsNone(column.server_default)

    def test_created_at_is_date_not_datetime(self):
        column = Client.__table__.c["created_at"]
        self.assertIsInstance(column.type, Date)
        self.assertFalse(column.nullable)
        self.assertIsNone(column.server_default)


class ClientInteractionForeignKeysTests(unittest.TestCase):
    """client_id cascades with the client; user_id is a nullable set-null snapshot pair."""

    def _fk_ondelete(self, column_name: str) -> str:
        column = ClientInteraction.__table__.c[column_name]
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks), f"expected exactly one FK on {column_name}")
        return fks[0].ondelete

    def test_client_id_cascades_on_delete(self):
        self.assertEqual("CASCADE", self._fk_ondelete("client_id"))
        self.assertFalse(ClientInteraction.__table__.c["client_id"].nullable)

    def test_user_id_is_nullable_and_set_null_on_delete(self):
        self.assertEqual("SET NULL", self._fk_ondelete("user_id"))
        self.assertTrue(ClientInteraction.__table__.c["user_id"].nullable)

    def test_user_name_snapshot_is_not_null(self):
        column = ClientInteraction.__table__.c["user_name"]
        self.assertFalse(column.nullable)


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity/parent, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "d41c7a9b5e02"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "b8f3d0c62a71"', self.text)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_drops_both_new_tables(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('op.drop_table("clients")', body)
        self.assertIn('op.drop_table("client_interactions")', body)


if __name__ == "__main__":
    unittest.main()
