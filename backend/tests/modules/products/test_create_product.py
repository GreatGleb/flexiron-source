"""Behaviour of `POST /api/products` — the two server-side substitutions and the
name refusal that nothing exercises today.

`test_products_tenancy.py` already proves the tenant comes from the token, not the
body — its one `POST` sends `currency_id` explicitly, so the currency substitution
never runs there. This file is the complement: no test anywhere creates a product
*without* a currency, or leaves a UoM unset, or sends a blank name.

The harness is the one committed in `test_batches_list.py`: a real request, the
real router over ASGI, a private temporary SQLite database — only `get_db` and
`get_current_user` are overridden, and the error handler is the product's own
`app_error_handler` imported from `app.main`.

    cd backend && python3 -m pytest tests/modules/products/test_create_product.py -q
"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/create-product-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from sqlalchemy import insert, select
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy.ext.compiler import compiles, deregister
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.auth.shared.models import Tenant
    from app.modules.products.features.create_product.action import (
        router as create_product_router,
    )
    from app.modules.products.shared.models import Product
    from app.modules.settings.shared.models import Currency


TENANT = uuid4()


class CreateProductTestCase(unittest.IsolatedAsyncioTestCase):
    """Shared fixture: one tenant with a default and a non-default currency."""

    async def asyncSetUp(self):
        # SQLite has no JSONB: compile it as plain JSON for the test database only.
        @compiles(JSONB, "sqlite")
        def sqlite_jsonb(type_, compiler, **kw):
            return "JSON"

        self.addCleanup(deregister, JSONB)

        self.directory = tempfile.TemporaryDirectory(prefix="create-product-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.default_currency = uuid4()
        self.other_currency = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, Currency, Product):
                await conn.run_sync(
                    lambda sync, model=model: model.__table__.create(sync)
                )

            await conn.execute(
                insert(Tenant), [{"id": TENANT, "name": "A", "slug": f"a-{uuid4()}"}]
            )
            await conn.execute(
                insert(Currency),
                [
                    {
                        "id": self.other_currency,
                        "tenant_id": TENANT,
                        "code": "USD",
                        "name_translations": {"en": "US Dollar"},
                        "is_default": False,
                    },
                    {
                        "id": self.default_currency,
                        "tenant_id": TENANT,
                        "code": "EUR",
                        "name_translations": {"en": "Euro"},
                        "is_default": True,
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(create_product_router)

        async def isolated_db():
            async with self.sessions() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        async def current_user():
            return CurrentUser(user_id=uuid4(), tenant_id=TENANT, user=None)

        self.app.dependency_overrides[get_db] = isolated_db
        self.app.dependency_overrides[get_current_user] = current_user
        self.client = AsyncClient(
            transport=ASGITransport(app=self.app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(self.client.aclose)

    async def _created_product(self, product_id):
        async with self.sessions() as session:
            result = await session.execute(
                select(Product).where(Product.id == UUID(product_id))
            )
            return result.scalar_one()

    # ── Currency default substitution ───────────────────────────────────────

    async def test_product_created_without_currency_gets_the_tenant_default(self):
        """No `currency_id` in the body — the row must carry the tenant's
        default currency, not a null column. `CreateProductResponse` doesn't
        expose currency at all, so the row itself is the only witness."""
        response = await self.client.post("/api/products", json={"name": "Steel Beam"})

        self.assertEqual(201, response.status_code, response.text)
        product = await self._created_product(response.json()["data"]["id"])
        self.assertEqual(self.default_currency, product.currency_id)

    async def test_product_created_with_an_explicit_currency_keeps_it(self):
        """The substitution only fires when the field is absent — an explicit,
        non-default currency must not be overridden by the tenant default."""
        response = await self.client.post(
            "/api/products",
            json={"name": "Copper Wire", "currency_id": str(self.other_currency)},
        )

        self.assertEqual(201, response.status_code, response.text)
        product = await self._created_product(response.json()["data"]["id"])
        self.assertEqual(self.other_currency, product.currency_id)

    # ── UoM cascade: warehouse ← sale, purchase ← warehouse ─────────────────

    async def test_unset_uoms_cascade_from_sale_down_to_purchase(self):
        """Only `sale_uom_id` given — both warehouse and purchase must inherit
        it, not stay null."""
        sale_uom = uuid4()

        response = await self.client.post(
            "/api/products",
            json={"name": "Cascaded All", "sale_uom_id": str(sale_uom)},
        )

        self.assertEqual(201, response.status_code, response.text)
        product = await self._created_product(response.json()["data"]["id"])
        self.assertEqual(sale_uom, product.sale_uom_id)
        self.assertEqual(sale_uom, product.warehouse_uom_id)
        self.assertEqual(sale_uom, product.purchase_uom_id)

    async def test_explicit_warehouse_uom_is_kept_and_still_cascades_to_purchase(self):
        """`warehouse_uom_id` given explicitly, distinct from `sale_uom_id`,
        and `purchase_uom_id` left unset — purchase must inherit the
        (explicit) warehouse unit, and the explicit warehouse unit must not
        be overwritten by the sale unit."""
        sale_uom = uuid4()
        warehouse_uom = uuid4()

        response = await self.client.post(
            "/api/products",
            json={
                "name": "Explicit Warehouse",
                "sale_uom_id": str(sale_uom),
                "warehouse_uom_id": str(warehouse_uom),
            },
        )

        self.assertEqual(201, response.status_code, response.text)
        product = await self._created_product(response.json()["data"]["id"])
        self.assertEqual(sale_uom, product.sale_uom_id)
        self.assertEqual(warehouse_uom, product.warehouse_uom_id)
        self.assertEqual(warehouse_uom, product.purchase_uom_id)

    async def test_explicit_purchase_uom_is_not_overwritten_by_the_cascade(self):
        """`purchase_uom_id` given explicitly, `warehouse_uom_id` left unset —
        the cascade must fill warehouse from sale, and must leave the
        explicit purchase unit alone rather than replacing it with the
        (cascaded) warehouse unit."""
        sale_uom = uuid4()
        purchase_uom = uuid4()

        response = await self.client.post(
            "/api/products",
            json={
                "name": "Explicit Purchase",
                "sale_uom_id": str(sale_uom),
                "purchase_uom_id": str(purchase_uom),
            },
        )

        self.assertEqual(201, response.status_code, response.text)
        product = await self._created_product(response.json()["data"]["id"])
        self.assertEqual(sale_uom, product.sale_uom_id)
        self.assertEqual(sale_uom, product.warehouse_uom_id)
        self.assertEqual(purchase_uom, product.purchase_uom_id)

    # ── Name refusal ─────────────────────────────────────────────────────────

    async def test_blank_name_is_refused_with_its_code(self):
        response = await self.client.post("/api/products", json={"name": ""})

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])

    async def test_whitespace_only_name_is_refused_with_its_code(self):
        response = await self.client.post("/api/products", json={"name": "   "})

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])

    # ── Tenant from the token, not the body (brief — see test_products_tenancy.py) ──

    async def test_created_product_is_stored_under_the_tokens_tenant(self):
        response = await self.client.post("/api/products", json={"name": "Token Tenant"})

        self.assertEqual(201, response.status_code, response.text)
        product = await self._created_product(response.json()["data"]["id"])
        self.assertEqual(TENANT, product.tenant_id)


if __name__ == "__main__":
    unittest.main()
