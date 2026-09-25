"""Schema guard: category and category-field names are translated, not plain strings.

`Category.name`, `Category.description` and `CategoryField.name` used to be a single
`String(255)`/`Text` column — nowhere to put a second locale. They are now
`name_translations` / `description_translations`, JSONB with the `_translations`
suffix already used by `services.name_translations` and
`warehouse.user_name_translations`. Reintroducing a bare `name`/`description`
column on either table reddens this test.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy.dialects.postgresql import JSONB

from app.modules.products.shared.models import Category, CategoryField

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "a7c1d4e90b21_categories_translated_names.py"
)


class CategoryNameIsTranslatedTests(unittest.TestCase):
    def test_plain_name_column_is_gone(self):
        self.assertFalse(hasattr(Category, "name"))
        self.assertNotIn("name", Category.__table__.c)

    def test_name_translations_is_jsonb_not_null(self):
        column = Category.__table__.c["name_translations"]
        self.assertIsInstance(column.type, JSONB)
        self.assertFalse(column.nullable)

    def test_plain_description_column_is_gone(self):
        self.assertFalse(hasattr(Category, "description"))
        self.assertNotIn("description", Category.__table__.c)

    def test_description_translations_is_jsonb_nullable(self):
        column = Category.__table__.c["description_translations"]
        self.assertIsInstance(column.type, JSONB)
        self.assertTrue(column.nullable)


class CategoryFieldNameIsTranslatedTests(unittest.TestCase):
    def test_plain_name_column_is_gone(self):
        self.assertFalse(hasattr(CategoryField, "name"))
        self.assertNotIn("name", CategoryField.__table__.c)

    def test_name_translations_is_jsonb_not_null(self):
        column = CategoryField.__table__.c["name_translations"]
        self.assertIsInstance(column.type, JSONB)
        self.assertFalse(column.nullable)


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, single head, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "a7c1d4e90b21"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "9c2f5a7b31d4"', self.text)

    def test_type_changes_use_postgresql_using(self):
        # 3 alter_column type changes in upgrade() + 3 in downgrade() = 6.
        self.assertEqual(self.text.count("postgresql_using="), 6)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )
        self.assertGreaterEqual(body.count("op."), 3)

    def test_downgrade_restores_original_column_names(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('new_column_name="name"', body)
        self.assertIn('new_column_name="description"', body)


if __name__ == "__main__":
    unittest.main()
