"""Warehouse schema guards — БАГ-17, БАГ-23, БАГ-25, БАГ-28
(`roo_code/roo-context/api/warehouse.md`).

Checked against ORM metadata and the revision file's own text; no database is
needed for any of it.

Ревизий здесь ДВЕ, и это не случайность: `b5e2f7a31c40` закрыла БАГ-23 и БАГ-25
(ссылка движения на кусок и колонки дефицита), `c1a7d5e08b34` — БАГ-17 (размеры,
вес, категория, QR и заказ у куска) и БАГ-28 (уникальность остатка по паре
арендатор+товар). Вторая не повторяет первую: `add_column` на уже созданную
колонку падает на применении.
"""

from pathlib import Path
import re
import unittest

from sqlalchemy import Numeric, Text

from app.modules.warehouse.shared.models import (
    StockItem,
    WarehouseDeficit,
    WarehouseMovement,
    WarehouseOffcut,
)

T1_REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "c1a7d5e08b34_warehouse_t1_schema_gaps.py"
)

PRIORITY_VALUES = {"critical", "high", "medium", "low"}


def _foreign_key(column):
    for fk in column.foreign_keys:
        return fk
    return None


class MovementOffcutLinkTests(unittest.TestCase):
    """`WarehouseMovement.offcut_id` — the field the whole offcut model hangs on."""

    def test_offcut_id_column_exists(self):
        self.assertIn("offcut_id", WarehouseMovement.__table__.c)

    def test_offcut_id_is_nullable(self):
        column = WarehouseMovement.__table__.c["offcut_id"]
        self.assertTrue(column.nullable)

    def test_offcut_id_is_indexed(self):
        column = WarehouseMovement.__table__.c["offcut_id"]
        self.assertTrue(column.index)

    def test_offcut_id_targets_warehouse_offcuts(self):
        column = WarehouseMovement.__table__.c["offcut_id"]
        fk = _foreign_key(column)
        self.assertIsNotNone(fk, "offcut_id carries no foreign key")
        self.assertEqual(fk.target_fullname, "warehouse_offcuts.id")

    def test_offcut_id_ondelete_is_set_null(self):
        """A movement record outlives the offcut it moved — SET NULL, not RESTRICT."""
        column = WarehouseMovement.__table__.c["offcut_id"]
        fk = _foreign_key(column)
        self.assertEqual(fk.ondelete, "SET NULL")


class DeficitRecordTypeColumnsTests(unittest.TestCase):
    """The four columns the client's `WarehouseDeficit` type carries and the schema lacked."""

    def test_priority_column_exists_and_is_required(self):
        column = WarehouseDeficit.__table__.c["priority"]
        self.assertFalse(column.nullable)

    def test_priority_has_no_default(self):
        """The owner has not decided a default priority — the column must not guess one."""
        column = WarehouseDeficit.__table__.c["priority"]
        self.assertIsNone(column.server_default)
        self.assertIsNone(column.default)

    def test_suggested_order_qty_column_is_nullable(self):
        self.assertIn("suggested_order_qty", WarehouseDeficit.__table__.c)
        column = WarehouseDeficit.__table__.c["suggested_order_qty"]
        self.assertTrue(column.nullable)

    def test_purchase_order_id_column_is_nullable(self):
        self.assertIn("purchase_order_id", WarehouseDeficit.__table__.c)
        column = WarehouseDeficit.__table__.c["purchase_order_id"]
        self.assertTrue(column.nullable)

    def test_uom_id_targets_uoms_with_restrict(self):
        """Every reference to a tenant reference table is RESTRICT (contract §22)."""
        column = WarehouseDeficit.__table__.c["uom_id"]
        self.assertTrue(column.nullable)
        fk = _foreign_key(column)
        self.assertIsNotNone(fk, "uom_id carries no foreign key")
        self.assertEqual(fk.target_fullname, "uoms.id")
        self.assertEqual(fk.ondelete, "RESTRICT")

    def test_product_name_and_deficit_amount_stay_undecided(self):
        """Snapshot vs. join is an open owner decision — no column guesses it."""
        self.assertNotIn("product_name", WarehouseDeficit.__table__.c)
        self.assertNotIn("deficit_amount", WarehouseDeficit.__table__.c)


class DeficitStatusDefaultTests(unittest.TestCase):
    """`status` is born `open` (`DeficitStatus`), never a `DeficitPriority` value."""

    def test_status_default_is_open(self):
        column = WarehouseDeficit.__table__.c["status"]
        self.assertIsNotNone(column.server_default)
        self.assertEqual(column.server_default.arg, "open")

    def test_status_default_is_not_a_priority_value(self):
        column = WarehouseDeficit.__table__.c["status"]
        default_value = column.server_default.arg
        self.assertNotIn(default_value, PRIORITY_VALUES)


class OffcutDimensionsWeightCategoryTests(unittest.TestCase):
    """БАГ-17: у куска есть размеры, вес, категория, QR и заказ."""

    DIMENSIONS = ("length_mm", "width_mm", "thickness_mm", "weight_kg")

    def test_numeric_dimension_and_weight_columns_are_nullable(self):
        for name in self.DIMENSIONS:
            with self.subTest(column=name):
                column = WarehouseOffcut.__table__.c[name]
                self.assertIsInstance(column.type, Numeric)
                self.assertTrue(column.nullable, f"{name} обязана быть nullable")

    def test_category_id_is_nullable_fk_to_categories_with_set_null(self):
        """Кусок переживает удаление категории — SET NULL, не RESTRICT."""
        column = WarehouseOffcut.__table__.c["category_id"]
        self.assertTrue(column.nullable)
        fk = _foreign_key(column)
        self.assertIsNotNone(fk, "category_id без внешнего ключа")
        self.assertEqual(fk.target_fullname, "categories.id")
        self.assertEqual(fk.ondelete, "SET NULL")

    def test_qr_data_and_order_id_are_nullable(self):
        qr_data = WarehouseOffcut.__table__.c["qr_data"]
        self.assertIsInstance(qr_data.type, Text)
        self.assertTrue(qr_data.nullable)
        order_id = WarehouseOffcut.__table__.c["order_id"]
        self.assertTrue(order_id.nullable)


class StockItemTenantScopedUniquenessTests(unittest.TestCase):
    """БАГ-28: остаток уникален в пределах арендатора, а не глобально.

    Глобальная уникальность `product_id` означала бы, что строка остатка по товару
    может существовать у одного арендатора во всём стенде — второй получил бы отказ
    на вставке за чужие данные.
    """

    def test_product_id_column_itself_is_not_unique(self):
        self.assertFalse(StockItem.__table__.c["product_id"].unique)

    def test_composite_unique_constraint_on_tenant_and_product(self):
        pairs = {
            tuple(column.name for column in constraint.columns)
            for constraint in StockItem.__table__.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        }
        self.assertIn(("tenant_id", "product_id"), pairs)


class T1RevisionFileTests(unittest.TestCase):
    """Сама ревизия: личность, настоящий downgrade и отсутствие повтора соседней."""

    @classmethod
    def setUpClass(cls):
        cls.text = T1_REVISION_PATH.read_text(encoding="utf-8")

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "c1a7d5e08b34"', self.text)
        # Родитель — голова на момент переноса, а не `b8f3d0c62a71` из ночного патча.
        self.assertIn(
            'down_revision: Union[str, Sequence[str], None] = "e5b2f47c9a10"', self.text
        )

    def test_upgrade_does_not_repeat_the_accepted_revision(self):
        """`offcut_id` и колонки дефицита уже созданы `b5e2f7a31c40`.

        Повторный `add_column` упал бы на применении, а не «на всякий случай»:
        колонка уже есть.
        """
        body = re.search(
            r"def upgrade\(\) -> None:\n(.*)def downgrade", self.text, re.DOTALL
        ).group(1)
        self.assertNotIn('"warehouse_movements"', body)
        self.assertNotIn('sa.Column("priority"', body)
        self.assertNotIn('sa.Column("purchase_order_id"', body)

    def test_uniqueness_is_swapped_as_an_index_not_a_constraint(self):
        """В базе это `ix_stock_items_product_id`, уникальный ИНДЕКС.

        Модель объявляла `unique=True, index=True`, и `drop_constraint` на него
        отвечает UndefinedObjectError — замерено на 5433 при переносе.
        """
        body = re.search(
            r"def upgrade\(\) -> None:\n(.*)def downgrade", self.text, re.DOTALL
        ).group(1)
        self.assertIn('op.drop_index("ix_stock_items_product_id"', body)
        self.assertIn("uq_stock_items_tenant_product", body)

    def test_downgrade_is_not_a_stub(self):
        body = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL).group(1)
        self.assertNotEqual(body.strip().splitlines()[0].strip(), "pass")
        self.assertIn('"warehouse_offcuts"', body)
        self.assertIn("uq_stock_items_tenant_product", body)


if __name__ == "__main__":
    unittest.main()
