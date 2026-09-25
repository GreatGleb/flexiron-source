"""Services archive-and-price-checks migration — derived columns and constraints.

Checked against ORM metadata and the revision file's own text; no database is
needed for any of it. `archived_at` is asserted `nullable=True` with no
default at all — a boolean archive flag or a default value would reintroduce
a second source of truth for the same fact, which is the shape the inversion
check in the acceptance criteria asks for.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy import CheckConstraint, UniqueConstraint

from app.modules.services.shared.models import Service

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "a9d3c81b6f24_services_archive_and_price_checks.py"
)


class ServiceArchivedAtColumnTests(unittest.TestCase):
    """`archived_at` is the sole source of truth for archive state."""

    def test_column_exists(self):
        self.assertIn("archived_at", Service.__table__.c)

    def test_column_is_nullable(self):
        column = Service.__table__.c["archived_at"]
        self.assertTrue(column.nullable)

    def test_column_has_no_default(self):
        column = Service.__table__.c["archived_at"]
        self.assertIsNone(column.default)
        self.assertIsNone(column.server_default)

    def test_no_separate_boolean_archive_flag(self):
        self.assertFalse(hasattr(Service, "is_archived"))
        self.assertNotIn("is_archived", Service.__table__.c)


class ServiceTenantArchivedAtIndexTests(unittest.TestCase):
    """One composite index covers `(tenant_id, archived_at)`, not two separate ones."""

    def test_composite_index_covers_both_columns(self):
        matching = [
            index
            for index in Service.__table__.indexes
            if {column.name for column in index.columns} == {"tenant_id", "archived_at"}
        ]
        self.assertEqual(
            len(matching),
            1,
            "expected exactly one index covering both tenant_id and archived_at",
        )

    def test_no_redundant_single_column_archived_at_index(self):
        single_column_indexes = [
            index
            for index in Service.__table__.indexes
            if [column.name for column in index.columns] == ["archived_at"]
        ]
        self.assertEqual(single_column_indexes, [])


class ServicePriceCheckConstraintTests(unittest.TestCase):
    """`cost_price` and `selling_price` are non-negative at the database level."""

    def _check_constraints(self):
        return [
            constraint
            for constraint in Service.__table__.constraints
            if isinstance(constraint, CheckConstraint)
        ]

    def test_cost_price_check_constraint_present(self):
        expressions = [str(c.sqltext) for c in self._check_constraints()]
        self.assertTrue(
            any("cost_price" in expr for expr in expressions),
            f"expected a CHECK constraint mentioning cost_price, got {expressions}",
        )

    def test_selling_price_check_constraint_present(self):
        expressions = [str(c.sqltext) for c in self._check_constraints()]
        self.assertTrue(
            any("selling_price" in expr for expr in expressions),
            f"expected a CHECK constraint mentioning selling_price, got {expressions}",
        )

    def test_exactly_two_check_constraints(self):
        self.assertEqual(len(self._check_constraints()), 2)


class ServiceNameUniquenessNotIntroducedTests(unittest.TestCase):
    """Name uniqueness is an owner decision that has not been made."""

    def test_no_unique_constraint_on_model(self):
        unique_constraints = [
            constraint
            for constraint in Service.__table__.constraints
            if isinstance(constraint, UniqueConstraint)
        ]
        self.assertEqual(unique_constraints, [])


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "a9d3c81b6f24"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "c3f81a26d740"', self.text)

    def test_upgrade_creates_column_index_and_both_constraints(self):
        match = re.search(r"def upgrade\(\) -> None:\n(.*?)\ndef downgrade", self.text, re.DOTALL)
        self.assertIsNotNone(match, "upgrade() not found in revision file")
        body = match.group(1)

        self.assertIn('"archived_at"', body)
        self.assertIn("create_index", body)
        self.assertIn("ck_services_cost_price_non_negative", body)
        self.assertIn("ck_services_selling_price_non_negative", body)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_removes_both_constraints_index_and_column(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn("ck_services_selling_price_non_negative", body)
        self.assertIn("ck_services_cost_price_non_negative", body)
        self.assertIn("drop_index", body)
        self.assertIn('"archived_at"', body)
        self.assertIn("drop_column", body)


if __name__ == "__main__":
    unittest.main()
