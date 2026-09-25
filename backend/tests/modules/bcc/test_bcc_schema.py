"""П75/П101 schema changes for the bcc module.

Checked against ORM metadata and the revision file's own text; no database is
needed for any of it. `BccCategory` / `bcc_categories` are asserted absent —
reintroducing the class on `models.py` reddens the metadata test here, and
removing `currency_id` reddens the column test, which is the shape the
inversion check in the acceptance criteria asks for.
"""

import re
import unittest
from pathlib import Path

from app.core.base import Base
from app.modules.bcc.shared import models as bcc_models
from app.modules.bcc.shared.models import BccEvent

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "e7b2c40d9f15_bcc_p75_drop_categories_p101_currency.py"
)

PRIOR_REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "f96e6fb2d5cf_phase_8_bcc.py"
)


class BccCategoryRemovedTests(unittest.TestCase):
    """П75 — the BCC tree is a projection of the shared catalog, no table of its own."""

    def test_bcc_category_class_removed_from_models_module(self):
        self.assertFalse(hasattr(bcc_models, "BccCategory"))

    def test_bcc_categories_table_removed_from_metadata(self):
        self.assertNotIn("bcc_categories", Base.metadata.tables)


class BccEventCurrencyTests(unittest.TestCase):
    """П101 — an accepted price keeps the actual currency of the offer."""

    def test_currency_id_column_exists(self):
        self.assertIn("currency_id", BccEvent.__table__.c)

    def test_currency_id_is_nullable(self):
        column = BccEvent.__table__.c["currency_id"]
        self.assertTrue(column.nullable)

    def test_currency_id_is_fk_to_currencies_with_set_null(self):
        column = BccEvent.__table__.c["currency_id"]
        self.assertEqual(len(column.foreign_keys), 1)
        fk = next(iter(column.foreign_keys))
        self.assertEqual(fk.target_fullname, "currencies.id")
        self.assertEqual(fk.ondelete, "SET NULL")


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, parent, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()
        cls.prior_text = PRIOR_REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "e7b2c40d9f15"', self.text)
        # Родитель — голова на момент переноса, а не `b8f3d0c62a71` из ночного патча.
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "c1a7d5e08b34"', self.text)

    def test_upgrade_drops_bcc_categories_and_adds_currency_id(self):
        match = re.search(r"def upgrade\(\) -> None:\n(.*?)def downgrade", self.text, re.DOTALL)
        self.assertIsNotNone(match, "upgrade() not found in revision file")
        body = match.group(1)

        self.assertIn('op.drop_table("bcc_categories")', body)
        self.assertIn('"bcc_events"', body)
        self.assertIn('"currency_id"', body)
        self.assertIn('ondelete="SET NULL"', body)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_drops_currency_id_and_recreates_bcc_categories(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('op.drop_column("bcc_events", "currency_id")', body)
        self.assertIn('op.create_table(\n        "bcc_categories"', body)

    def test_downgrade_restores_bcc_categories_in_the_same_column_shape_as_phase_8(self):
        # The column set the original phase_8 migration creates for
        # bcc_categories — downgrade() here must restore exactly this shape.
        prior_upgrade = re.search(
            r'op\.create_table\(\s*"bcc_categories",\n(.*?)\n    \)',
            self.prior_text,
            re.DOTALL,
        )
        self.assertIsNotNone(prior_upgrade, "bcc_categories creation not found in phase_8 revision")
        prior_columns = re.findall(r'sa\.Column\(\s*"(\w+)"', prior_upgrade.group(1))
        self.assertEqual(
            prior_columns,
            ["id", "tenant_id", "name_translations", "parent_id", "product_count", "created_at", "updated_at"],
        )

        downgrade_match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        downgrade_body = downgrade_match.group(1)
        restored = re.search(
            r'op\.create_table\(\s*"bcc_categories",\n(.*?)\n    \)',
            downgrade_body,
            re.DOTALL,
        )
        self.assertIsNotNone(restored, "bcc_categories re-creation not found in downgrade()")
        restored_columns = re.findall(r'sa\.Column\(\s*"(\w+)"', restored.group(1))

        self.assertEqual(restored_columns, prior_columns)


if __name__ == "__main__":
    unittest.main()
