"""Behaviour of the settings CRUD refusals — a real request, the code read from the body.

Before 2026-09-22 the acceptance criteria that name these codes counted FILES:
`файлов "UOM_IN_USE" backend/app > 0` is satisfied by a comment or a docstring just as
well as by a refusal, and it says nothing about whether a `DELETE` is refused at all.
The behavioural replacement is a request that receives the refusal and reads
`detail.code` from the body — this file *is* that test.

The harness is the one committed in `test_warehouse_map_draft.py`: a private temporary
SQLite database, the real routers over ASGI, real Bearer authentication; only `get_db`
is replaced, and the error handler is the product's own `app_error_handler` imported
from `app.main` (so the test proves the product, not a copy of it). No Postgres and no
Alembic. Fixtures create only the tables the refusals touch.

`raise_app_exceptions=False` is deliberate: an unregistered `AppError` handler must
show up as the 500 it is in production, not as a traceback inside the client.
"""

import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Importing database builds a lazy engine that must not look into .env — same guard the
# two committed harnesses use.
with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/settings-refusals-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.shared.models import Product
    from app.modules.services.shared.models import Service
    from app.modules.settings.features.crud.action import router as crud_router
    from app.modules.settings.shared.models import (
        Currency,
        GlobalConstants,
        OrderStatusSetting,
        Uom,
        UomConversion,
    )


class SettingsRefusalTests(unittest.IsolatedAsyncioTestCase):
    """Each refusal is a status plus a code; each pass is a status only."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="settings-refusals-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        # SQLite has no JSONB: compile it as plain JSON for the test database only.
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)
        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant_a, self.tenant_b = uuid4(), uuid4()
        self.user_a = uuid4()

        self.currency_default_a, self.currency_plain_a, self.currency_b = (
            uuid4(),
            uuid4(),
            uuid4(),
        )
        self.currency_service_only_a = uuid4()
        self.uom_a, self.uom_a2, self.uom_b = uuid4(), uuid4(), uuid4()
        self.uom_service_only_a = uuid4()
        self.product_x, self.product_y, self.product_b = uuid4(), uuid4(), uuid4()
        self.service_x = uuid4()
        self.status_a1, self.status_a2, self.status_b1 = uuid4(), uuid4(), uuid4()

        async with self.engine.begin() as conn:
            for model in (
                Tenant,
                User,
                Currency,
                Uom,
                UomConversion,
                OrderStatusSetting,
                GlobalConstants,
                Product,
                Service,
            ):
                await conn.run_sync(
                    lambda sync, model=model: model.__table__.create(sync)
                )

            await conn.execute(
                insert(Tenant),
                [
                    {"id": self.tenant_a, "name": "A", "slug": "a"},
                    {"id": self.tenant_b, "name": "B", "slug": "b"},
                ],
            )
            await conn.execute(
                insert(User),
                [
                    {
                        "id": self.user_a,
                        "tenant_id": self.tenant_a,
                        "email": "a@example.test",
                        "first_name": "A",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "secret-a",
                    }
                ],
            )
            await conn.execute(
                insert(Currency),
                [
                    self._currency(self.currency_default_a, self.tenant_a, "EUR", True),
                    self._currency(self.currency_plain_a, self.tenant_a, "USD", False),
                    self._currency(self.currency_service_only_a, self.tenant_a, "PLN", False),
                    self._currency(self.currency_b, self.tenant_b, "GBP", True),
                ],
            )
            await conn.execute(
                insert(Uom),
                [
                    self._uom(self.uom_a, self.tenant_a, "pcs"),
                    self._uom(self.uom_a2, self.tenant_a, "box"),
                    self._uom(self.uom_service_only_a, self.tenant_a, "hour"),
                    self._uom(self.uom_b, self.tenant_b, "kg"),
                ],
            )
            await conn.execute(
                insert(OrderStatusSetting),
                [
                    self._status(self.status_a1, self.tenant_a, "New", 0),
                    self._status(self.status_a2, self.tenant_a, "Done", 1),
                    self._status(self.status_b1, self.tenant_b, "Foreign", 0),
                ],
            )
            # Only the columns the two counters read. SQLite does not force foreign
            # keys, so no Category row is invented for `category_id`.
            await conn.execute(
                insert(Product),
                [
                    self._product(
                        self.product_x,
                        self.tenant_a,
                        "X",
                        purchase_uom_id=self.uom_a,
                        currency_id=self.currency_plain_a,
                    ),
                    self._product(
                        self.product_y,
                        self.tenant_a,
                        "Y",
                        currency_id=self.currency_default_a,
                    ),
                    self._product(
                        self.product_b,
                        self.tenant_b,
                        "B",
                        warehouse_uom_id=self.uom_b,
                    ),
                ],
            )
            # A service referencing a currency and a UOM that no product uses —
            # the gap this file closes: the reference existed only on the
            # `services` side of the boundary.
            await conn.execute(
                insert(Service),
                [
                    self._service(
                        self.service_x,
                        self.tenant_a,
                        "Cutting",
                        currency_id=self.currency_service_only_a,
                        uom_id=self.uom_service_only_a,
                    ),
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(crud_router)

        async def isolated_db():
            async with self.sessions() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        self.app.dependency_overrides[get_db] = isolated_db
        self.client = AsyncClient(
            transport=ASGITransport(app=self.app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(self.client.aclose)
        self.token = issue_session_token(self.user_a)

    # ── fixtures ─────────────────────────────────────────────────────────────

    @staticmethod
    def _currency(currency_id, tenant_id, code: str, is_default: bool) -> dict:
        return {
            "id": currency_id,
            "tenant_id": tenant_id,
            "code": code,
            "name_translations": {"en": code},
            "is_default": is_default,
        }

    @staticmethod
    def _uom(uom_id, tenant_id, code: str) -> dict:
        return {
            "id": uom_id,
            "tenant_id": tenant_id,
            "code_translations": {"en": code},
            "name_translations": {"en": code},
            "category": "quantity",
        }

    @staticmethod
    def _status(status_id, tenant_id, name: str, sort_order: int) -> dict:
        return {
            "id": status_id,
            "tenant_id": tenant_id,
            "name_translations": {"en": name},
            "color": "#000000",
            "sort_order": sort_order,
            "is_system": False,
        }

    @staticmethod
    def _product(product_id, tenant_id, name: str, **refs) -> dict:
        """Every row names the same keys — a Core executemany needs one shape."""
        row = {
            "id": product_id,
            "tenant_id": tenant_id,
            "name": name,
            "currency_id": None,
            "purchase_uom_id": None,
            "warehouse_uom_id": None,
            "sale_uom_id": None,
        }
        row.update(refs)
        return row

    @staticmethod
    def _service(service_id, tenant_id, name: str, **refs) -> dict:
        row = {
            "id": service_id,
            "tenant_id": tenant_id,
            "name_translations": {"en": name},
            "currency_id": None,
            "uom_id": None,
        }
        row.update(refs)
        return row

    @property
    def auth(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    # ── C4: the UOM / currency refusals ──────────────────────────────────────

    async def test_uom_in_use_is_refused_with_its_code(self):
        """A unit referenced by the tenant's own product cannot be deleted."""
        response = await self.client.delete(
            f"/api/settings/uoms/{self.uom_a}", headers=self.auth
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("UOM_IN_USE", response.json()["detail"]["code"])

    async def test_a_uom_of_another_tenant_reads_as_absent(self):
        """Tenant scoping runs first: a foreign unit is 404, not 409, even if used."""
        response = await self.client.delete(
            f"/api/settings/uoms/{self.uom_b}", headers=self.auth
        )

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual("NOT_FOUND", response.json()["detail"]["code"])

    async def test_currency_default_is_refused_before_in_use(self):
        """The default currency is refused as default, even though a product uses it."""
        response = await self.client.delete(
            f"/api/settings/currencies/{self.currency_default_a}", headers=self.auth
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("CURRENCY_IS_DEFAULT", response.json()["detail"]["code"])

    async def test_currency_in_use_is_refused_with_its_code(self):
        """A non-default currency referenced by a product is refused as in use."""
        response = await self.client.delete(
            f"/api/settings/currencies/{self.currency_plain_a}", headers=self.auth
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("CURRENCY_IN_USE", response.json()["detail"]["code"])

    async def test_currency_used_only_by_a_service_is_refused_with_its_code(self):
        """A currency no product references, but a service does, is still in use."""
        response = await self.client.delete(
            f"/api/settings/currencies/{self.currency_service_only_a}", headers=self.auth
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("CURRENCY_IN_USE", response.json()["detail"]["code"])

    async def test_uom_used_only_by_a_service_is_refused_with_its_code(self):
        """A UOM no product references, but a service does, is still in use."""
        response = await self.client.delete(
            f"/api/settings/uoms/{self.uom_service_only_a}", headers=self.auth
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("UOM_IN_USE", response.json()["detail"]["code"])

    async def test_uom_referenced_only_by_a_conversion_rule_is_refused(self):
        """A unit no product uses, but a conversion rule does, still cannot be deleted."""
        created = await self.client.post(
            "/api/settings/conversions",
            headers=self.auth,
            json={
                "fromUomId": str(self.uom_a2),
                "toUomId": str(self.uom_a),
                "type": "static",
                "factor": 2.0,
            },
        )
        self.assertEqual(200, created.status_code, created.text)

        response = await self.client.delete(
            f"/api/settings/uoms/{self.uom_a2}", headers=self.auth
        )

        self.assertEqual(409, response.status_code, response.text)
        self.assertEqual("UOM_IN_USE", response.json()["detail"]["code"])

    async def test_uom_without_any_reference_still_deletes(self):
        """`uom_a2` has neither a product nor a conversion rule pointing at it."""
        response = await self.client.delete(
            f"/api/settings/uoms/{self.uom_a2}", headers=self.auth
        )

        self.assertEqual(200, response.status_code, response.text)

    # ── БАГ-09: the tenant's default currency stays exactly one ────────────────

    async def test_patch_default_currency_unsets_the_previous_one(self):
        """Setting `isDefault` on one currency clears the flag from the rest."""
        response = await self.client.patch(
            f"/api/settings/currencies/{self.currency_plain_a}",
            headers=self.auth,
            json={"isDefault": True},
        )
        self.assertEqual(200, response.status_code, response.text)

        listing = await self.client.get("/api/settings/currencies", headers=self.auth)
        self.assertEqual(200, listing.status_code, listing.text)
        defaults = [c for c in listing.json()["data"] if c["isDefault"]]
        self.assertEqual([str(self.currency_plain_a)], [c["id"] for c in defaults])

    async def test_patch_default_currency_leaves_another_tenant_untouched(self):
        """Tenant B's own default currency is not affected by tenant A's PATCH."""
        response = await self.client.patch(
            f"/api/settings/currencies/{self.currency_plain_a}",
            headers=self.auth,
            json={"isDefault": True},
        )
        self.assertEqual(200, response.status_code, response.text)

        async with self.sessions() as session:
            result = await session.execute(
                select(Currency).where(Currency.id == self.currency_b)
            )
            currency_b = result.scalar_one()
        self.assertTrue(currency_b.is_default)

    async def test_create_default_currency_unsets_the_previous_one(self):
        """`POST` with `isDefault: true` also replaces the tenant's old default."""
        created = await self.client.post(
            "/api/settings/currencies",
            headers=self.auth,
            # Не PLN: этот код уже занят валютой `currency_service_only_a`, заведённой
            # соседней задачей, и POST ответил бы CURRENCY_CODE_TAKEN вместо проверяемого.
            json={"code": "CZK", "name": {"en": "Koruna"}, "isDefault": True},
        )
        self.assertEqual(200, created.status_code, created.text)
        new_id = created.json()["data"]["id"]

        listing = await self.client.get("/api/settings/currencies", headers=self.auth)
        self.assertEqual(200, listing.status_code, listing.text)
        defaults = [c for c in listing.json()["data"] if c["isDefault"]]
        self.assertEqual([new_id], [c["id"] for c in defaults])

    # ── C5: the reorder and the conversion pair ───────────────────────────────

    async def test_reorder_with_an_incomplete_list_is_refused(self):
        """A `PUT` carries the whole set; a subset is refused, not half-applied."""
        response = await self.client.put(
            "/api/settings/order-statuses/reorder",
            headers=self.auth,
            json={"orderedIds": [str(self.status_a1)]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual(
            "ORDER_STATUS_REORDER_INCOMPLETE", response.json()["detail"]["code"]
        )

    async def test_reorder_with_a_foreign_id_is_refused(self):
        """A list naming another tenant's status is not the tenant's whole set."""
        response = await self.client.put(
            "/api/settings/order-statuses/reorder",
            headers=self.auth,
            json={"orderedIds": [str(self.status_a1), str(self.status_b1)]},
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual(
            "ORDER_STATUS_REORDER_INCOMPLETE", response.json()["detail"]["code"]
        )

    async def test_reorder_with_the_whole_set_succeeds(self):
        """The refusal is about completeness — the complete list still reorders."""
        response = await self.client.put(
            "/api/settings/order-statuses/reorder",
            headers=self.auth,
            json={"orderedIds": [str(self.status_a2), str(self.status_a1)]},
        )

        self.assertEqual(200, response.status_code, response.text)

    async def test_conversion_pair_taken_on_the_second_create(self):
        """The same ordered pair answered once cannot be created a second time."""
        body = {
            "fromUomId": str(self.uom_a),
            "toUomId": str(self.uom_a2),
            "type": "static",
            "factor": 2.5,
        }

        first = await self.client.post(
            "/api/settings/conversions", headers=self.auth, json=body
        )
        self.assertEqual(200, first.status_code, first.text)

        second = await self.client.post(
            "/api/settings/conversions", headers=self.auth, json=body
        )
        self.assertEqual(409, second.status_code, second.text)
        self.assertEqual("CONVERSION_PAIR_TAKEN", second.json()["detail"]["code"])

    # ── C15: the owner-assigned bounds ────────────────────────────────────────

    async def test_constant_out_of_range_is_refused(self):
        response = await self.client.patch(
            "/api/settings/constants", headers=self.auth, json={"vatRate": 101}
        )

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("CONSTANT_OUT_OF_RANGE", response.json()["detail"]["code"])

    async def test_constant_bounds_are_inclusive(self):
        """The bounds are inclusive (П108–П110): the limits themselves pass."""
        for field, value in (
            ("vatRate", 0.0),
            ("vatRate", 100.0),
            ("defaultMargin", -100.0),
            ("defaultDiscountPercent", 100.0),
        ):
            with self.subTest(field=field, value=value):
                response = await self.client.patch(
                    "/api/settings/constants",
                    headers=self.auth,
                    json={field: value},
                )
                self.assertEqual(200, response.status_code, response.text)

    async def test_constant_without_a_bound_is_not_range_checked(self):
        """C2's three scalars have no owner-assigned bound — so none is invented."""
        response = await self.client.patch(
            "/api/settings/constants", headers=self.auth, json={"defaultKerfMm": 9999.0}
        )

        self.assertEqual(200, response.status_code, response.text)
