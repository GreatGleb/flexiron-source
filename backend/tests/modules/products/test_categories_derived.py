"""Categories derived columns — `field_count`, `product_count`, `level` (П68).

All three were stored columns on `categories`; none of them had a writer, so
they drifted from the truth the moment a product or field changed underneath
them. `field_count` and `product_count` become the caller's responsibility to
compute (no reader in this codebase needs them today); `level` is still part
of the `GET /api/products/{id}` response, so it is recomputed at read time by
walking `parent_id` instead of being read off a column.

The metadata/revision half is checked the way
`test_supplier_schema.py` checks `b8f3d0c62a71` — no database needed. The
behavioural half — that `category.level` in the product detail response is
actually derived, not just present — is checked the way
`test_products_catalog.py` checks the product card: a private temporary
SQLite database, the real routers over ASGI, real Bearer authentication.
"""

import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import insert
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles, deregister
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.modules.products.shared.models import Category

REVISION_PATH = (
    Path(__file__).resolve().parents[3]
    / "alembic"
    / "versions"
    / "c1a7d9e4f2b3_categories_derived_columns.py"
)


class CategoryDerivedColumnsRemovedTests(unittest.TestCase):
    """`field_count`, `product_count`, `level` are read-time derived (П68)."""

    def test_field_count_removed_from_category(self):
        self.assertFalse(hasattr(Category, "field_count"))
        self.assertNotIn("field_count", Category.__table__.c)

    def test_product_count_removed_from_category(self):
        self.assertFalse(hasattr(Category, "product_count"))
        self.assertNotIn("product_count", Category.__table__.c)

    def test_level_removed_from_category(self):
        self.assertFalse(hasattr(Category, "level"))
        self.assertNotIn("level", Category.__table__.c)


class CategoryChildrenCascadeTests(unittest.TestCase):
    """`children` no longer declares `delete-orphan`, which fought `RESTRICT`."""

    def test_children_relationship_has_no_delete_orphan_cascade(self):
        cascade = Category.__mapper__.relationships["children"].cascade
        self.assertFalse(cascade.delete_orphan)
        self.assertNotIn("delete-orphan", cascade)
        self.assertNotIn("all", cascade)


class RevisionFileTests(unittest.TestCase):
    """The revision file itself: identity, a real downgrade."""

    @classmethod
    def setUpClass(cls):
        cls.text = REVISION_PATH.read_text()

    def test_revision_identity_and_parent(self):
        self.assertIn('revision: str = "c1a7d9e4f2b3"', self.text)
        # Родитель — голова на момент переноса, а не `b8f3d0c62a71` из ночного патча:
        # между ними легли принятые задачи соседних модулей.
        self.assertIn('down_revision: Union[str, Sequence[str], None] = "d41f6a7c02b9"', self.text)

    def test_downgrade_is_not_a_stub(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        self.assertIsNotNone(match, "downgrade() not found in revision file")
        body = match.group(1)

        stripped_first_statement = body.strip().splitlines()[0].strip()
        self.assertNotEqual(
            stripped_first_statement, "pass", "downgrade() must not be a bare pass"
        )

    def test_downgrade_restores_all_three_dropped_columns(self):
        match = re.search(r"def downgrade\(\) -> None:\n(.*)", self.text, re.DOTALL)
        body = match.group(1)

        self.assertIn('"field_count"', body)
        self.assertIn('"product_count"', body)
        self.assertIn('"level"', body)
        self.assertEqual(body.count("nullable=False"), 3)
        self.assertEqual(body.count('server_default="0"'), 3)


with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/categories-derived-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app_error_handler
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.features.get_product_detail.action import (
        router as get_product_detail_router,
    )
    from app.modules.products.shared.models import Product, ProductFieldValue


class CategoryLevelIsDerivedTests(unittest.IsolatedAsyncioTestCase):
    """`GET /api/products/{id}` still returns `category.level`, computed at read time."""

    async def asyncSetUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="categories-derived-")
        self.addCleanup(self.directory.cleanup)
        self.root_dir = Path(self.directory.name)

        # SQLite не знает JSONB: на время теста компилируем его как обычный JSON —
        # тем же приёмом, что `tests/modules/settings/test_settings_refusals.py`.
        @compiles(JSONB, "sqlite")
        def _jsonb_as_json(type_, compiler, **kw):  # noqa: ARG001
            return "JSON"

        self.addCleanup(deregister, JSONB)

        self.engine = create_async_engine(
            "sqlite+aiosqlite:///" + str(self.root_dir / "test.sqlite")
        )
        self.addAsyncCleanup(self.engine.dispose)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

        self.tenant = uuid4()
        self.user = uuid4()

        # Three-level tree: root -> child -> grandchild.
        self.category_root = uuid4()
        self.category_child = uuid4()
        self.category_grandchild = uuid4()

        self.product_at_root = uuid4()
        self.product_at_child = uuid4()
        self.product_at_grandchild = uuid4()

        async with self.engine.begin() as conn:
            for model in (Tenant, User, Category, Product, ProductFieldValue):
                await conn.run_sync(
                    lambda sync, model=model: model.__table__.create(sync)
                )

            await conn.execute(
                insert(Tenant),
                [{"id": self.tenant, "name": "A", "slug": "a"}],
            )
            await conn.execute(
                insert(User),
                [
                    {
                        "id": self.user,
                        "tenant_id": self.tenant,
                        "email": "a@example.test",
                        "first_name": "A",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "secret-a",
                    }
                ],
            )
            await conn.execute(
                insert(Category),
                [
                    {
                        "id": self.category_root,
                        "tenant_id": self.tenant,
                        "name_translations": {"ru": "Root", "en": "Root", "lt": "Root"},
                        "parent_id": None,
                    },
                    {
                        "id": self.category_child,
                        "tenant_id": self.tenant,
                        "name_translations": {"ru": "Child", "en": "Child", "lt": "Child"},
                        "parent_id": self.category_root,
                    },
                    {
                        "id": self.category_grandchild,
                        "tenant_id": self.tenant,
                        "name_translations": {"ru": "Grandchild", "en": "Grandchild", "lt": "Grandchild"},
                        "parent_id": self.category_child,
                    },
                ],
            )
            await conn.execute(
                insert(Product),
                [
                    {
                        "id": self.product_at_root,
                        "tenant_id": self.tenant,
                        "name": "At root",
                        "category_id": self.category_root,
                    },
                    {
                        "id": self.product_at_child,
                        "tenant_id": self.tenant,
                        "name": "At child",
                        "category_id": self.category_child,
                    },
                    {
                        "id": self.product_at_grandchild,
                        "tenant_id": self.tenant,
                        "name": "At grandchild",
                        "category_id": self.category_grandchild,
                    },
                ],
            )

        self.app = FastAPI()
        self.app.add_exception_handler(AppError, app_error_handler)
        self.app.include_router(get_product_detail_router)

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
        self.token = issue_session_token(self.user)

    @property
    def auth(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    async def test_root_category_level_is_zero(self):
        response = await self.client.get(
            f"/api/products/{self.product_at_root}", headers=self.auth
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(0, response.json()["data"]["category"]["level"])

    async def test_direct_child_category_level_is_one(self):
        response = await self.client.get(
            f"/api/products/{self.product_at_child}", headers=self.auth
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(1, response.json()["data"]["category"]["level"])

    async def test_grandchild_category_level_is_two(self):
        response = await self.client.get(
            f"/api/products/{self.product_at_grandchild}", headers=self.auth
        )

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual(2, response.json()["data"]["category"]["level"])


if __name__ == "__main__":
    unittest.main()
