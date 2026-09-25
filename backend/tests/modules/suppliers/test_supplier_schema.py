"""T1/T2 of the suppliers domain plan — derived columns, types, notes, country.

Checked against ORM metadata and the revision files' own text; no database is
needed for any of it. `has_deficit` / `last_bcc_date` are asserted absent by
`hasattr` — reintroducing either column on `Supplier` reddens its test here,
which is the shape the inversion check in the acceptance criteria asks for.
Same shape applies to T2: reintroducing `Supplier.notes` reddens
`test_notes_column_removed_from_supplier` below.

Таблицу `supplier_notes` завела не ревизия T2, а `e7a3c81b04f6` соседней принятой
задачи, и форма автора у неё своя (`author_id` + `author_name`). T2 снимает только
колонку, которую эта таблица заменила, и сужает обе страны.
"""

import re
import unittest
from pathlib import Path

from sqlalchemy.dialects.postgresql import JSONB

from app.modules.suppliers.shared.models import (
    Supplier,
    SupplierAddress,
    SupplierContact,
    SupplierNote,
    SupplierPriceEntry,
)

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "b8f3d0c62a71_suppliers_t1_derived_and_types.py"
)

T2_REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "d41f6a7c02b9_suppliers_t2_notes_and_country.py"
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


class SupplierNotesAreRecordsTests(unittest.TestCase):
    """П35: notes become records — a table, not a glued-together string column."""

    def test_notes_column_removed_from_supplier(self):
        self.assertNotIn("notes", Supplier.__table__.c)
        self.assertFalse(hasattr(Supplier, "notes"))

    def test_supplier_note_table_columns(self):
        table = SupplierNote.__table__
        self.assertEqual(table.name, "supplier_notes")

        tenant_id = table.c["tenant_id"]
        self.assertFalse(tenant_id.nullable)
        self.assertTrue(tenant_id.index)
        fk = next(iter(tenant_id.foreign_keys))
        self.assertEqual(fk.column.table.name, "tenants")
        self.assertEqual(fk.ondelete, "CASCADE")

        supplier_id = table.c["supplier_id"]
        self.assertFalse(supplier_id.nullable)
        self.assertTrue(supplier_id.index)
        fk = next(iter(supplier_id.foreign_keys))
        self.assertEqual(fk.column.table.name, "suppliers")
        self.assertEqual(fk.ondelete, "CASCADE")

        # Автор хранится ДВУМЯ полями, и это решение соседней принятой задачи, а не
        # недосмотр: ссылка `author_id` переживает удаление пользователя как NULL, а
        # снимок `author_name` остаётся читаемым и после него. П35 требует «дату и
        # автора», а не конкретную из двух форм.
        author = table.c["author_id"]
        self.assertTrue(author.nullable)
        fk = next(iter(author.foreign_keys))
        self.assertEqual(fk.column.table.name, "users")
        self.assertEqual(fk.ondelete, "SET NULL")

        author_name = table.c["author_name"]
        self.assertFalse(author_name.nullable)

        text = table.c["text"]
        self.assertFalse(text.nullable)

        created_at = table.c["created_at"]
        self.assertFalse(created_at.nullable)

    def test_notes_are_deleted_with_their_supplier(self):
        """Связи в ORM у таблицы нет намеренно — каскад держит внешний ключ.

        Соседняя принятая задача завела `supplier_notes` плоской таблицей, без
        `relationship` на обеих сторонах. Значит проверять надо то, что там есть:
        `ondelete="CASCADE"` на `supplier_id`, — а не ORM-каскад, которого нет.
        """
        fk = next(iter(SupplierNote.__table__.c["supplier_id"].foreign_keys))
        self.assertEqual(fk.ondelete, "CASCADE")


class SupplierCountryIsIsoCodeTests(unittest.TestCase):
    """П67: country is an ISO 3166-1 alpha-2 code, not free text."""

    def test_supplier_country_is_two_chars(self):
        column = Supplier.__table__.c["country"]
        self.assertEqual(column.type.length, 2)
        self.assertTrue(column.nullable)

    def test_supplier_address_country_is_two_chars(self):
        column = SupplierAddress.__table__.c["country"]
        self.assertEqual(column.type.length, 2)
        self.assertFalse(column.nullable)


class T2RevisionFileTests(unittest.TestCase):
    """The T2 revision file itself: identity, real downgrade, continuation of T1."""

    @classmethod
    def setUpClass(cls):
        cls.text = T2_REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "d41f6a7c02b9"', self.text)
        # Родитель — голова на момент переноса, а не `b8f3d0c62a71` из ночного
        # патча: между T1 и этой ревизией легли принятые задачи соседних модулей.
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "d4c8a1f37b62"', self.text)

    def test_upgrade_drops_the_column_the_notes_table_replaced(self):
        """Таблицу заводит не эта ревизия — её завела `e7a3c81b04f6`.

        Второе `create_table("supplier_notes")` здесь означало бы падение на
        применении, а не «на всякий случай»: таблица уже есть.
        """
        match = re.search(r"def upgrade\(\) -> None:\n(.*)def downgrade", self.text, re.DOTALL)
        self.assertIsNotNone(match, "upgrade() not found in revision file")
        body = match.group(1)
        self.assertIn('op.drop_column("suppliers", "notes")', body)
        self.assertNotIn("op.create_table(", body)

    def test_upgrade_narrows_both_country_columns(self):
        match = re.search(r"def upgrade\(\) -> None:\n(.*)def downgrade", self.text, re.DOTALL)
        body = match.group(1)
        self.assertEqual(body.count("sa.String(2)"), 2)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_restores_notes_column_and_wide_country(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('sa.Column("notes", sa.Text()', body)
        # Таблицу заметок эта ревизия не создавала — значит и сносить ей нечего:
        # `drop_table` здесь унёс бы данные, которых она не заводила.
        self.assertNotIn("op.drop_table(", body)
        self.assertEqual(body.count("sa.String(100)"), 2)


if __name__ == "__main__":
    unittest.main()
