"""T1 of the suppliers domain plan — derived columns and types.

Checked against ORM metadata and the revision file's own text; no database is
needed for any of it. `has_deficit` / `last_bcc_date` are asserted absent by
`hasattr` — reintroducing either column on `Supplier` reddens its test here,
which is the shape the inversion check in the acceptance criteria asks for.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy.dialects.postgresql import JSONB

from app.modules.suppliers.shared.models import (
    Supplier,
    SupplierContact,
    SupplierPriceEntry,
)

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "b8f3d0c62a71_suppliers_t1_derived_and_types.py"
)


class SupplierDerivedColumnsRemovedTests(unittest.TestCase):
    """`has_deficit` and `last_bcc_date` are read-time derived, nothing writes them."""

    def test_has_deficit_removed_from_supplier(self):
        self.assertFalse(hasattr(Supplier, "has_deficit"))
        self.assertNotIn("has_deficit", Supplier.__table__.c)

    def test_last_bcc_date_removed_from_supplier(self):
        self.assertFalse(hasattr(Supplier, "last_bcc_date"))
        self.assertNotIn("last_bcc_date", Supplier.__table__.c)


class SupplierContactPositionTranslatedTests(unittest.TestCase):
    """`position` (plain string) is replaced by `position_translations` (JSONB)."""

    def test_position_column_removed(self):
        self.assertFalse(hasattr(SupplierContact, "position"))
        self.assertNotIn("position", SupplierContact.__table__.c)

    def test_position_translations_is_jsonb_not_null(self):
        column = SupplierContact.__table__.c["position_translations"]
        self.assertIsInstance(column.type, JSONB)
        self.assertFalse(column.nullable)


class SupplierPriceEntryPriceNullableTests(unittest.TestCase):
    """A row for an unanswered price request has no price to store."""

    def test_price_is_nullable(self):
        column = SupplierPriceEntry.__table__.c["price"]
        self.assertTrue(column.nullable)


class SupplierJsonColumnsAreJsonbWithGinIndexTests(unittest.TestCase):
    """`categories`/`tags`/`bcc_emails` are JSONB, each with its own GIN index.

    Plain `JSON` has neither containment operators nor GIN support in
    Postgres — filtering by category without them is a sequential scan.
    """

    COLUMNS = ("categories", "tags", "bcc_emails")

    def test_columns_are_jsonb(self):
        for name in self.COLUMNS:
            with self.subTest(column=name):
                self.assertIsInstance(Supplier.__table__.c[name].type, JSONB)

    def test_each_column_has_a_gin_index(self):
        indexes_by_column = {}
        for index in Supplier.__table__.indexes:
            using = index.dialect_options["postgresql"]["using"]
            for column in index.columns:
                indexes_by_column.setdefault(column.name, set()).add(using)

        for name in self.COLUMNS:
            with self.subTest(column=name):
                self.assertIn(
                    "gin",
                    indexes_by_column.get(name, set()),
                    f"expected a GIN index covering {name!r}",
                )


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, a real downgrade, `postgresql_using`."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "b8f3d0c62a71"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "c9e4a1f70b23"', self.text)

    def test_type_changes_use_postgresql_using(self):
        # 3 alter_column type changes in upgrade() + 3 GIN create_index calls
        # in upgrade() + 3 alter_column type changes in downgrade() = 9.
        self.assertEqual(self.text.count("postgresql_using="), 9)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )
        # A real reversal touches every table this revision touches.
        self.assertGreaterEqual(body.count("op."), 10)

    def test_downgrade_restores_dropped_columns_and_constraints(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('"has_deficit"', body)
        self.assertIn('"last_bcc_date"', body)
        self.assertIn('sa.Column("position", sa.String(255)', body)
        self.assertIn('"position_translations"', body)
        # price goes back to NOT NULL on the way down.
        price_alter_start = body.index('"supplier_price_entries"')
        price_alter_snippet = body[price_alter_start : price_alter_start + 200]
        self.assertIn("nullable=False", price_alter_snippet)


if __name__ == "__main__":
    unittest.main()
