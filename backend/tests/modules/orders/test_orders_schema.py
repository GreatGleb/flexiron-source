"""Storage-only slice for the orders module — no routes, no DB needed.

Checked against ORM metadata and the revision file's own text, same style as
`tests/modules/clients/test_clients_schema.py`.
"""

import re
import unittest
from pathlib import Path

from app.modules.orders.shared.models import Order, OrderItem

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "f2a7c91d3b04_orders_module_tables.py"
)


class OrderColumnShapeTests(unittest.TestCase):
    """tenant_id/client_id are FKs; version and the client snapshot exist."""

    def _fk_ondelete(self, table, column_name: str) -> str:
        column = table.__table__.c[column_name]
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks), f"expected exactly one FK on {column_name}")
        return fks[0].ondelete

    def test_tenant_id_cascades_and_is_indexed(self):
        self.assertEqual("CASCADE", self._fk_ondelete(Order, "tenant_id"))
        self.assertFalse(Order.__table__.c["tenant_id"].nullable)
        self.assertTrue(Order.__table__.c["tenant_id"].index)

    def test_client_id_restricts_on_delete(self):
        # A client with orders must not be deletable — the FK enforces the
        # symmetric rule the contract states in prose (§4.1).
        self.assertEqual("RESTRICT", self._fk_ondelete(Order, "client_id"))
        self.assertFalse(Order.__table__.c["client_id"].nullable)

    def test_version_column_exists_for_optimistic_locking(self):
        column = Order.__table__.c["version"]
        self.assertFalse(column.nullable)

    def test_client_requisites_are_snapshotted_not_nullable(self):
        for name in ("client_name", "client_vat_code", "client_address", "client_payment_terms_days"):
            with self.subTest(column=name):
                self.assertFalse(Order.__table__.c[name].nullable)

    def test_order_number_unique_per_tenant(self):
        unique_sets = [
            frozenset(col.name for col in constraint.columns)
            for constraint in Order.__table__.constraints
            if constraint.__class__.__name__ == "UniqueConstraint"
        ]
        self.assertIn(frozenset({"tenant_id", "order_number"}), unique_sets)

    def test_no_derived_totals_are_stored_on_the_order(self):
        # §1 rule 5: nothing derived is stored — these are computed from
        # order lines and payments at read time, not columns.
        for name in (
            "total_cost", "total_amount", "total_vat", "total_with_vat",
            "actual_margin_percent", "effective_discount_percent",
            "paid_amount", "paid_percent", "outstanding_amount",
        ):
            with self.subTest(column=name):
                self.assertFalse(hasattr(Order, name))

    def test_audit_log_is_out_of_scope(self):
        self.assertFalse(hasattr(Order, "audit_log"))


class OrderItemForeignKeysTests(unittest.TestCase):
    """order_id cascades with the order; product_id restricts deletion."""

    def _fk_ondelete(self, column_name: str) -> str:
        column = OrderItem.__table__.c[column_name]
        fks = list(column.foreign_keys)
        self.assertEqual(1, len(fks), f"expected exactly one FK on {column_name}")
        return fks[0].ondelete

    def test_tenant_id_cascades_and_is_indexed(self):
        self.assertEqual("CASCADE", self._fk_ondelete("tenant_id"))
        self.assertFalse(OrderItem.__table__.c["tenant_id"].nullable)
        self.assertTrue(OrderItem.__table__.c["tenant_id"].index)

    def test_order_id_cascades_on_delete(self):
        self.assertEqual("CASCADE", self._fk_ondelete("order_id"))
        self.assertFalse(OrderItem.__table__.c["order_id"].nullable)

    def test_product_id_restricts_on_delete(self):
        # A catalog product referenced by a line must not vanish silently
        # out from under the document — mutate this to CASCADE and this
        # test must go red.
        self.assertEqual("RESTRICT", self._fk_ondelete("product_id"))
        self.assertFalse(OrderItem.__table__.c["product_id"].nullable)

    def test_allocation_is_mandatory(self):
        column = OrderItem.__table__.c["allocations"]
        self.assertFalse(column.nullable)

    def test_unit_cost_and_source_are_not_null(self):
        self.assertFalse(OrderItem.__table__.c["unit_cost"].nullable)
        self.assertFalse(OrderItem.__table__.c["cost_source"].nullable)

    def test_named_price_is_stored_and_manual_price_is_optional(self):
        self.assertFalse(OrderItem.__table__.c["unit_price"].nullable)
        self.assertTrue(OrderItem.__table__.c["manual_unit_price"].nullable)

    def test_state_is_not_stored_it_is_derived(self):
        # §2 "Строка заказа": state is derived from quantities, never set by
        # hand — storing it would duplicate a value that can go stale.
        self.assertFalse(hasattr(OrderItem, "state"))

    def test_total_price_and_discount_amount_are_not_stored(self):
        # §2: these are a projection for old UI parts, computed by the
        # server — unlike unit_price, the contract gives no rounding-drift
        # argument for storing them too.
        self.assertFalse(hasattr(OrderItem, "total_price"))
        self.assertFalse(hasattr(OrderItem, "discount"))


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity/parent, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "f2a7c91d3b04"', self.text)
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "a9d3c81b6f24"', self.text)

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

        self.assertIn('op.drop_table("orders")', body)
        self.assertIn('op.drop_table("order_items")', body)


if __name__ == "__main__":
    unittest.main()
