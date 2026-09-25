"""Router registration is a walk of the filesystem now, not a hand-written list.

`app/main.py` used to hold thirteen named imports (`from ... import router as
..._router`) and thirteen matching `app.include_router(...)` calls — every new
feature had to edit the same lines as every other one. `discover_feature_routers()`
replaced that with a walk of `app/**/action.py`, picking up any module-level `router`
that is an `APIRouter`.

This file does not call `discover_feature_routers()` to build its expectation —
reusing the function under test would only prove it agrees with itself. Instead it
re-derives the expected route set with an independent, purely static read of the same
files (AST, no import), the way `test_route_auth.py` already does for its own guard,
and compares that against what the assembled `app.main.app` actually answers.

A second, separate test proves the ordering *rule* is load-bearing rather than
incidental: `GET /api/products/list` must resolve to the list handler, not to
`get_product_detail`'s `/{product_id}` — the reverse registration order still makes
both routes exist, but a real request to `/list` starts answering 422 (`invalid UUID`)
instead of 200.

**Проверяется НАСТОЯЩЕЕ приложение, а не собранное в тесте.** Первая версия этого
файла строила своё приложение рукописным списком роутеров в нужном порядке — и
оставалась зелёной при перевёрнутом правиле в `discover_feature_routers()`, потому
что до этой функции не доходила вовсе. Мутационный критерий задачи проверяет именно
её, значит и тест обязан спрашивать её вывод: один тест берёт `app.main.app`,
второй — список из `discover_feature_routers()`, отсортированный обратным правилом.
"""

from __future__ import annotations

import ast
import os
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

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

HTTP_METHODS = {"GET", "POST", "PATCH", "PUT", "DELETE"}

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/router-registry-unused.sqlite"},
):
    from app.core.database import get_db
    from app.core.exceptions import AppError
    from app.main import app as main_app
    from app.main import app_error_handler, discover_feature_routers
    from app.modules.auth.shared.models import Tenant, User
    from app.modules.auth.shared.session_tokens import issue_session_token
    from app.modules.products.shared.models import (
        Category,
        CategoryField,
        Product,
        ProductFieldValue,
    )


def _action_files() -> list[Path]:
    return sorted(APP.rglob("action.py"))


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _router_prefix(tree: ast.Module) -> str | None:
    """The literal `prefix=` a file passes to `router = APIRouter(...)`.

    Returns ``None`` when the file declares no module-level `router` at all — that
    file is not a route source and is skipped, not counted as an empty prefix.
    """
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign):
            continue
        if not (
            len(node.targets) == 1
            and isinstance(node.targets[0], ast.Name)
            and node.targets[0].id == "router"
        ):
            continue
        call = node.value
        if not (
            isinstance(call, ast.Call)
            and isinstance(call.func, ast.Name)
            and call.func.id == "APIRouter"
        ):
            continue
        for kw in call.keywords:
            if (
                kw.arg == "prefix"
                and isinstance(kw.value, ast.Constant)
                and isinstance(kw.value.value, str)
            ):
                return kw.value.value
        return ""
    return None


def _route_pairs(tree: ast.Module, prefix: str) -> set[tuple[str, str]]:
    """(METHOD, full_path) for every `@router.<method>("...")` decoration in `tree`."""
    pairs: set[tuple[str, str]] = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            func = dec.func
            if not (
                isinstance(func, ast.Attribute)
                and isinstance(func.value, ast.Name)
                and func.value.id == "router"
            ):
                continue
            method = func.attr.upper()
            if method not in HTTP_METHODS:
                continue
            if not dec.args or not isinstance(dec.args[0], ast.Constant):
                continue
            suffix = dec.args[0].value
            if not isinstance(suffix, str):
                continue
            pairs.add((method, (prefix + suffix) or "/"))
    return pairs


def _filesystem_route_pairs() -> set[tuple[str, str]]:
    """Independently re-derive the route set a correct walk would register."""
    expected: set[tuple[str, str]] = set()
    files_with_router = 0
    for path in _action_files():
        tree = ast.parse(path.read_text(encoding="utf-8"))
        prefix = _router_prefix(tree)
        if prefix is None:
            continue
        files_with_router += 1
        expected |= _route_pairs(tree, prefix)

    # Пол обхода. Разбор, переставший находить `action.py` с `router`, отчитался бы
    # пустым множеством и выглядел бы как "всё совпало" — а на деле ничего не проверил
    # бы. Числа замерены на 2026-09-25: 13 файлов, 40 пар (метод, путь).
    assert files_with_router >= 13, (
        "разбор перестал находить action.py с module-level router — сломан обход, "
        "а не код"
    )
    assert len(expected) >= 40, (
        "разбор перестал находить роуты — сломан обход, а не код"
    )
    return expected


def _registered_route_pairs() -> set[tuple[str, str]]:
    """(METHOD, path) the assembled `app.main.app` actually answers.

    `app.routes` alone will not do here: FastAPI wraps each `include_router()` call in
    a lazy `_IncludedRouter` that exposes no flat `.path`. `openapi()` is the view that
    flattens everything down to the paths the app will actually match.
    """
    pairs: set[tuple[str, str]] = set()
    for path, operations in main_app.openapi()["paths"].items():
        for method in operations:
            if method.upper() in HTTP_METHODS:
                pairs.add((method.upper(), path))
    return pairs


class RouterRegistryTest(unittest.TestCase):
    def test_registered_routes_match_the_filesystem_walk(self) -> None:
        expected = _filesystem_route_pairs()
        # `/health` is declared directly in main.py, not discovered from an
        # `action.py` — it is not part of either set being compared here.
        actual = _registered_route_pairs() - {("GET", "/health")}

        missing = expected - actual
        extra = actual - expected
        self.assertEqual(
            set(), missing, f"найдены на диске, но не зарегистрированы: {missing}"
        )
        self.assertEqual(
            set(), extra, f"зарегистрированы, но не найдены на диске: {extra}"
        )


class ProductsListRouteResolutionTest(unittest.IsolatedAsyncioTestCase):
    """`GET /api/products/list` must reach the list handler, not the detail one.

    Both routes share the `/api/products` prefix; `get_product_detail`'s
    `/{product_id}` is UUID-typed. Registered in the wrong order, it captures the
    literal `/list` segment and answers 422 (`invalid UUID`) instead of the list
    handler's 200.
    """

    async def _database(self):
        """Чистая база и токен к ней — общая часть обоих случаев."""
        # SQLite не знает JSONB: на время теста компилируем его как обычный JSON,
        # тем же приёмом, что `tests/modules/settings/test_settings_refusals.py`.
        @compiles(JSONB, "sqlite")
        def _jsonb_as_json(type_, compiler, **kw):  # noqa: ARG001
            return "JSON"

        self.addCleanup(deregister, JSONB)

        directory = tempfile.TemporaryDirectory(prefix="router-registry-")
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)

        engine = create_async_engine("sqlite+aiosqlite:///" + str(root / "test.sqlite"))
        self.addAsyncCleanup(engine.dispose)
        sessions = async_sessionmaker(engine, expire_on_commit=False)

        tenant_id, user_id = uuid4(), uuid4()
        async with engine.begin() as conn:
            for model in (Tenant, User, Category, CategoryField, Product, ProductFieldValue):
                await conn.run_sync(lambda sync, model=model: model.__table__.create(sync))
            await conn.execute(insert(Tenant), [{"id": tenant_id, "name": "A", "slug": "a"}])
            await conn.execute(
                insert(User),
                [
                    {
                        "id": user_id,
                        "tenant_id": tenant_id,
                        "email": "router-registry@example.test",
                        "first_name": "A",
                        "last_name": "User",
                        "password_hash": "fixture",
                        "secret_link_token": "router-registry-secret",
                    }
                ],
            )

        async def isolated_db():
            async with sessions() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

        return isolated_db, issue_session_token(user_id)

    async def _get_list(self, app, token):
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            return await client.get(
                "/api/products/list", headers={"Authorization": f"Bearer {token}"}
            )

    async def test_products_list_resolves_in_the_real_application(self):
        """Спрашивается `app.main.app` — то самое приложение, что соберёт сервер.

        Своё приложение с рукописным порядком роутеров здесь не годится: оно не
        вызывает `discover_feature_routers()` и остаётся зелёным при перевёрнутом
        правиле — на этом задача и была забракована ночью 2026-09-24-2225.
        """
        isolated_db, token = await self._database()
        main_app.dependency_overrides[get_db] = isolated_db
        self.addCleanup(main_app.dependency_overrides.pop, get_db, None)

        response = await self._get_list(main_app, token)

        self.assertEqual(200, response.status_code, response.text)
        self.assertEqual([], response.json()["data"])

    async def test_reversed_ordering_rule_breaks_it(self):
        """Мутационный: перевернуть правило порядка — и тот же запрос отвечает 422.

        Берётся вывод самой `discover_feature_routers()` и пересортировывается
        обратным правилом (сначала пути с `{param}`), а не собирается руками: так
        проверяется правило, а не удачно выписанный список.
        """
        isolated_db, token = await self._database()

        def has_param(router) -> bool:
            return any("{" in route.path for route in router.routes)

        reversed_order = sorted(discover_feature_routers(), key=lambda r: not has_param(r))
        # Пол проверки: если разворот ничего не переставил, 422 ниже означал бы не
        # «правило работает», а «оба списка одинаковы» — и тест не проверял бы ничего.
        self.assertNotEqual(
            [id(r) for r in reversed_order],
            [id(r) for r in discover_feature_routers()],
            "обратный порядок совпал с прямым — переставлять было нечего",
        )

        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        for router in reversed_order:
            app.include_router(router)
        app.dependency_overrides[get_db] = isolated_db

        response = await self._get_list(app, token)

        self.assertEqual(422, response.status_code, response.text)


if __name__ == "__main__":
    unittest.main()
