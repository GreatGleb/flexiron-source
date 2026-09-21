"""Каждый роут объявляет аутентификацию, а каждый геттер по id — арендатора.

AST-сторож проверяет декларацию Depends и происхождение get_current_user без
запуска приложения. Поведение настоящей dependency и SQL отдельно проверяют
tests.modules.auth.test_current_user и tests.modules.auth.test_auth_consumers.

    cd backend && .venv/bin/python -B -m unittest discover -s tests -t .

Что произошло 2026-09-04 и почему сторож появился. В модуле `settings` из 21 роута
восемь — PATCH и DELETE у всех четырёх коллекций — не объявляли зависимость
аутентификации, тогда как тринадцать соседних объявляли. Правку и удаление справочников
любого арендатора мог выполнить кто угодно без входа. Вторая половина той же дыры лежала
в репозитории: `get_currency`, `get_uom`, `get_conversion`, `get_order_status` искали
запись по одному `id`, без `tenant_id`, — то есть даже с токеном чужую валюту можно было
переименовать, зная её UUID. Ни ревью, ни тесты этого не показали: восемь пропусков из
двадцати одного на глаз не видны.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

# Only the shared dependency or its public re-export can authenticate a route.
AUTH_DEPENDENCIES = ("get_current_user",)
AUTH_ORIGINS = {
    "app.modules.auth.shared.dependencies",
    "app.modules.auth.internal_api.interface",
}

# Роуты, которым вошедший не нужен ПО СМЫСЛУ, а не по недосмотру. Список закрытый:
# новый публичный роут придётся внести сюда руками, и это правильно — пусть решение
# «этот путь открыт всем» будет видно в дифе.
PUBLIC_ROUTES = {
    "app/modules/auth/features/login/action.py",       # вход — до входа
    "app/modules/auth/features/register/action.py",    # регистрация — до входа
    "app/modules/auth/features/magic_link/action.py",  # разбор ссылки; сам по себе не аутентифицирует
}

# Роуты, где аутентификации нет и это ЗАПИСАННАЯ находка, а не новость. Пока находка не
# закрыта, сторож про неё молчит, но список не даёт о ней забыть. Закрыл находку —
# убери строку, и сторож начнёт её охранять.
KNOWN_GAPS = {
    # products БАГ-14: арендатор в обоих роутах захардкожен заглушкой
    # 00000000-0000-0000-0000-000000000001 с комментарием «until auth middleware
    # provides the current tenant context» — то есть слайс сознательно недоделан.
    "app/modules/products/features/create_product/action.py": "products БАГ-14",
    "app/modules/products/features/get_product_detail/action.py": "products БАГ-14",
}


def _action_files() -> list[Path]:
    return sorted(APP.rglob("action.py"))


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _route_handlers(tree: ast.Module) -> list[ast.AsyncFunctionDef]:
    """Функции, украшенные @router.<метод>(...) — то есть настоящие роуты."""
    out = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.AsyncFunctionDef):
            continue
        for dec in node.decorator_list:
            func = dec.func if isinstance(dec, ast.Call) else dec
            if (
                isinstance(func, ast.Attribute)
                and isinstance(func.value, ast.Name)
                and func.value.id == "router"
            ):
                out.append(node)
                break
    return out


def _auth_names(tree: ast.Module) -> set[str]:
    names = set()
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module in AUTH_ORIGINS:
            for alias in node.names:
                if alias.name in AUTH_DEPENDENCIES:
                    names.add(alias.asname or alias.name)
    # A local function/assignment/import with the same name is not authentication.
    for name in list(names):
        bindings = 0
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name == name:
                bindings += 1
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store) and node.id == name:
                bindings += 1
            if isinstance(node, ast.alias) and (node.asname or node.name) == name:
                bindings += 1
        if bindings != 1:
            names.remove(name)
    return names


def _declares_auth(fn: ast.AsyncFunctionDef, tree: ast.Module) -> bool:
    """Есть ли среди значений по умолчанию Depends(<одна из зависимостей входа>)."""
    for default in list(fn.args.defaults) + list(fn.args.kw_defaults):
        if not isinstance(default, ast.Call):
            continue
        callee = default.func
        if not (isinstance(callee, ast.Name) and callee.id == "Depends"):
            continue
        for arg in default.args:
            if isinstance(arg, ast.Name) and arg.id in _auth_names(tree):
                return True
    return False


class RouteAuthTest(unittest.TestCase):
    def test_every_route_declares_authentication(self) -> None:
        unguarded: list[str] = []
        counted = 0
        for path in _action_files():
            rel = _rel(path)
            if rel in PUBLIC_ROUTES or rel in KNOWN_GAPS:
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for fn in _route_handlers(tree):
                counted += 1
                if not _declares_auth(fn, tree):
                    unguarded.append(f"{rel}:{fn.lineno} {fn.name}")

        # Пол проверки. Экстрактор, который перестал находить роуты, выдаёт зелёный
        # отчёт и стоит меньше, чем отсутствующая проверка: он ещё и врёт. Число взято
        # с замера 2026-09-07 — 25 охраняемых роутов из 31 в бэкенде.
        self.assertGreaterEqual(
            counted, 25, "разбор перестал находить роуты — сломан экстрактор, а не код"
        )
        self.assertEqual(
            [], unguarded, "роуты без зависимости аутентификации: " + ", ".join(unguarded)
        )

    def test_legacy_decoders_are_not_reintroduced(self) -> None:
        for path in _action_files():
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    self.assertNotEqual("_resolve_user_id", node.name, str(path))
                if isinstance(node, ast.Name):
                    self.assertNotIn(node.id, ("_bearer", "URLSafeTimedSerializer"), str(path))

    def test_token_reader_lives_in_one_place(self) -> None:
        """Читатель сессионного токена во всём бэкенде ровно один.

        Прошлый сторож смотрел только `*/action.py`, и этого не хватило: 2026-09-21
        вторая копия правила завелась в `settings/shared/dependencies.py` — не в
        файле роутов, поэтому проверка её не видела. Дубль прожил бы ровно до
        следующей фичи, которая импортировала бы его четвёртым вызовом.
        """
        home = APP / "modules" / "auth" / "shared" / "session_tokens.py"
        self.assertTrue(home.is_file(), "канонический читатель токена исчез")

        elsewhere = [
            _rel(path)
            for path in sorted(APP.rglob("*.py"))
            if path != home
            and any(
                isinstance(node, ast.Name) and node.id == "URLSafeTimedSerializer"
                for node in ast.walk(ast.parse(path.read_text(encoding="utf-8")))
            )
        ]
        self.assertEqual(
            [],
            elsewhere,
            "второй читатель сессионного токена: " + ", ".join(elsewhere),
        )

    def test_dependency_origin_guard(self) -> None:
        for declaration, expected in (
            ("from app.modules.auth.shared.dependencies import get_current_user", True),
            ("from app.modules.auth.internal_api.interface import get_current_user", True),
            ("from fake import get_current_user", False),
            ("async def get_current_user(): pass", False),
            ("from app.modules.auth.internal_api.interface import get_current_user\nget_current_user = lambda: None", False),
            ("from fake import _resolve_user_id as get_current_user", False),
        ):
            tree = ast.parse(declaration + "\n@router.get('/')\nasync def route(user=Depends(get_current_user)): pass")
            self.assertEqual(expected, _declares_auth(_route_handlers(tree)[0], tree), declaration)

    def test_public_and_known_gap_lists_are_not_stale(self) -> None:
        """Список исключений обязан описывать существующие файлы.

        Иначе он тихо превращается в разрешение для файла, которого нет, — а когда
        путь появится снова, сторож промолчит.
        """
        for rel in sorted(PUBLIC_ROUTES | set(KNOWN_GAPS)):
            self.assertTrue((BACKEND / rel).is_file(), f"в списке исключений нет файла: {rel}")

    def test_known_gaps_really_lack_auth(self) -> None:
        """Находка закрыта — строку из KNOWN_GAPS надо убрать.

        Без этой проверки исключение переживает починку и продолжает прятать роут от
        сторожа: файл уже защищён, а сторож всё ещё смотрит мимо.
        """
        for rel, bug in sorted(KNOWN_GAPS.items()):
            tree = ast.parse((BACKEND / rel).read_text(encoding="utf-8"))
            handlers = _route_handlers(tree)
            self.assertTrue(handlers, f"{rel}: роутов не найдено, исключение бессмысленно")
            self.assertFalse(
                all(_declares_auth(fn, tree) for fn in handlers),
                f"{rel} уже требует аутентификацию — убери строку из KNOWN_GAPS ({bug})",
            )


class TenantScopedGetterTest(unittest.TestCase):
    """Геттер по id обязан принимать арендатора — вторая половина дыры 2026-09-04.

    Проверяется не только сигнатура, но и `where`: функция, принявшая `tenant_id` и не
    отфильтровавшая по нему, выглядит безопасной ровно до второго арендатора. Это же
    правило записано в products БАГ-14.
    """

    REPOSITORY = "app/modules/settings/features/crud/repository.py"
    GETTERS = ("get_currency", "get_uom", "get_conversion", "get_order_status")
    WRITERS = (
        "patch_currency",
        "patch_uom",
        "patch_conversion",
        "patch_order_status",
        "delete_currency",
        "delete_uom",
        "delete_conversion",
        "delete_order_status",
    )

    def setUp(self) -> None:
        path = BACKEND / self.REPOSITORY
        self.tree = ast.parse(path.read_text(encoding="utf-8"))
        self.functions = {
            n.name: n
            for n in ast.walk(self.tree)
            if isinstance(n, ast.AsyncFunctionDef)
        }

    def _assert_scoped(self, name: str) -> None:
        fn = self.functions.get(name)
        self.assertIsNotNone(fn, f"{name} в репозитории не найдена — переименована?")
        params = [a.arg for a in fn.args.args]
        self.assertIn(
            "tenant_id", params, f"{name} не принимает tenant_id: {params}"
        )
        body = ast.unparse(fn)
        self.assertIn(
            "tenant_id ==",
            body,
            f"{name} принимает tenant_id и не фильтрует по нему — сигнатура без where",
        )

    def test_getters_are_tenant_scoped(self) -> None:
        for name in self.GETTERS:
            with self.subTest(getter=name):
                self._assert_scoped(name)

    def test_writers_are_tenant_scoped(self) -> None:
        """Писатель обязан фильтровать сам, а не полагаться на чтение перед ним.

        `get` → проверка → `patch` двумя запросами — это окно: между ними строка может
        сменить владельца. Правило то же, что уже действовало у `reorder_order_statuses`,
        который писал по паре `(id, tenant_id)` ещё до починки.
        """
        for name in self.WRITERS:
            with self.subTest(writer=name):
                self._assert_scoped(name)


if __name__ == "__main__":
    unittest.main()
