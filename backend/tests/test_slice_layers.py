"""Сторож слоёв внутри вертикального слайса — до сих пор не проверялось ничем.

`test_module_boundaries.py` смотрит на границы МЕЖДУ модулями и на то, что видно
снаружи; `test_route_auth.py` — на аутентификацию. Ни один не смотрит внутрь
слайса: на то, что HTTP не просачивается в domain/repository/schemas, что SQL не
строится прямо в роуте, что арендатор не хардкодится и что `app/core/` не
пролезает в модуль мимо `internal_api.interface`.

Замер на 2026-09-25 (см. AST, не текстовый grep, — числа ниже воспроизводимы):
`from fastapi import ...` встречается только в `*/action.py`, `main.py`,
`core/middleware/cors.py` и `auth/shared/{dependencies,session_tokens}.py` — ни
разу в domain/repository/schemas; литерал `00000000-0000-0000-0000-000000000001`
под `backend/app/` не встречается ни разу — хотя ровно этот литерал печатают
шаблоны `create-api-feature.md` как образец, то есть каждый новый слайс рискует
принести его с собой; `app.modules...` под `backend/app/core/` импортируется
ровно один раз — `auth.internal_api.interface` в `core/uploads/action.py`, и это
разрешённая форма, а не находка.

Все четыре правила сегодня выполняются без единого исключения — сторож вводится
зелёным, поэтому все четыре словаря изъятий ниже пустые.

    cd backend && python3 -m pytest tests/test_slice_layers.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"))


# ═════════════════════════════════════════════════════════════════════════
# Rule 1 — HTTP живёт только в action.py
# ═════════════════════════════════════════════════════════════════════════


def _slice_layer_files() -> list[Path]:
    """domain.py / repository.py / schemas.py под app/modules/*/features/*/."""
    out: list[Path] = []
    for name in ("domain.py", "repository.py", "schemas.py"):
        out.extend((APP / "modules").rglob(f"*/features/*/{name}"))
    return sorted(out)


def _imports_fastapi(tree: ast.Module) -> bool:
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            if any(
                alias.name == "fastapi" or alias.name.startswith("fastapi.")
                for alias in node.names
            ):
                return True
        elif isinstance(node, ast.ImportFrom) and node.module:
            if node.module == "fastapi" or node.module.startswith("fastapi."):
                return True
    return False


# Изъятия из правила 1: файл доменного слоя, который реально импортирует
# fastapi, с причиной. Пусто — сегодня правило не нарушается ни разу.
FASTAPI_IN_DOMAIN_GAPS: dict[str, str] = {}


class HttpOnlyInActionTest(unittest.TestCase):
    def test_domain_layer_never_imports_fastapi(self) -> None:
        files = _slice_layer_files()
        # Пол проверки. Замер 2026-09-25 — 47 файлов domain/repository/schemas.py.
        self.assertGreaterEqual(
            len(files),
            30,
            "обход перестал находить domain/repository/schemas.py — сломан обход, а не код",
        )

        violations = []
        for path in files:
            rel = _rel(path)
            if rel in FASTAPI_IN_DOMAIN_GAPS:
                continue
            if _imports_fastapi(_parse(path)):
                violations.append(rel)

        self.assertEqual(
            [],
            violations,
            "HTTP-слой просочился в domain/repository/schemas: " + ", ".join(violations),
        )

    def test_gap_list_is_not_stale(self) -> None:
        """Изъятие пережившее починку продолжает прятать файл от сторожа."""
        for rel in FASTAPI_IN_DOMAIN_GAPS:
            path = BACKEND / rel
            self.assertTrue(path.is_file(), f"в списке изъятий нет файла: {rel}")
            self.assertTrue(
                _imports_fastapi(_parse(path)),
                f"{rel} больше не импортирует fastapi — убери строку из FASTAPI_IN_DOMAIN_GAPS",
            )


# ═════════════════════════════════════════════════════════════════════════
# Rule 2 — SQL не живёт в action.py
# ═════════════════════════════════════════════════════════════════════════

SQL_CONSTRUCTOR_NAMES = ("select", "insert", "update", "delete")


def _action_files() -> list[Path]:
    return sorted((APP / "modules").rglob("*/features/*/action.py"))


def _sqlalchemy_bound_names(tree: ast.Module) -> set[str]:
    """Имена, которыми в ЭТОМ файле реально названы select/insert/update/delete
    из sqlalchemy — не любой символ с таким именем, а только импортированный
    оттуда (учитывая `as`)."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module == "sqlalchemy":
            for alias in node.names:
                if alias.name in SQL_CONSTRUCTOR_NAMES:
                    names.add(alias.asname or alias.name)
    return names


def _decorator_subtree_ids(tree: ast.Module) -> set[int]:
    """id() всех узлов внутри decorator_list.

    `@router.delete("/x")` — декоратор роута, не вызов `delete(...)` sqlalchemy.
    Без этого исключения сторож красит все четыре справочника settings/crud и
    warehouse_map, где такой декоратор есть, а конструктора запроса нет.
    """
    ids: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for dec in node.decorator_list:
                for sub in ast.walk(dec):
                    ids.add(id(sub))
    return ids


def _query_constructor_calls(tree: ast.Module) -> list[ast.Call]:
    names = _sqlalchemy_bound_names(tree)
    if not names:
        return []
    skip = _decorator_subtree_ids(tree)
    calls = []
    for node in ast.walk(tree):
        if id(node) in skip:
            continue
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id in names
        ):
            calls.append(node)
    return calls


# Изъятия из правила 2: action.py, который реально строит запрос сам, с
# причиной. Пусто — сегодня правило не нарушается ни разу.
SQL_IN_ACTION_GAPS: dict[str, str] = {}


class SqlOnlyOutsideActionTest(unittest.TestCase):
    def test_action_does_not_construct_queries(self) -> None:
        files = _action_files()
        # Пол проверки. Замер 2026-09-25 — 15 файлов action.py.
        self.assertGreaterEqual(
            len(files), 10, "обход перестал находить action.py — сломан обход, а не код"
        )

        violations = []
        for path in files:
            rel = _rel(path)
            if rel in SQL_IN_ACTION_GAPS:
                continue
            calls = _query_constructor_calls(_parse(path))
            if calls:
                violations.append(f"{rel}:{calls[0].lineno}")

        self.assertEqual(
            [],
            violations,
            "action.py строит SQL-запрос сам, в обход repository: " + ", ".join(violations),
        )

    def test_router_delete_decorator_is_not_a_false_positive(self) -> None:
        """На текущем коде пять `@router.delete(...)` — сторож обязан отличать их
        от вызова `delete(...)` sqlalchemy, а не просто их не находить."""
        decorator_count = 0
        for path in _action_files():
            tree = _parse(path)
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    continue
                for dec in node.decorator_list:
                    func = dec.func if isinstance(dec, ast.Call) else dec
                    if (
                        isinstance(func, ast.Attribute)
                        and func.attr == "delete"
                        and isinstance(func.value, ast.Name)
                        and func.value.id == "router"
                    ):
                        decorator_count += 1

        self.assertGreaterEqual(
            decorator_count,
            5,
            "разбор перестал находить @router.delete(...) — тесту нечего проверять на ложную тревогу",
        )

        crud = APP / "modules" / "settings" / "features" / "crud" / "action.py"
        warehouse_map = APP / "modules" / "settings" / "features" / "warehouse_map" / "action.py"
        for path in (crud, warehouse_map):
            self.assertEqual(
                [],
                _query_constructor_calls(_parse(path)),
                f"{_rel(path)}: декоратор @router.delete принят за вызов delete()",
            )

    def test_gap_list_is_not_stale(self) -> None:
        for rel in SQL_IN_ACTION_GAPS:
            path = BACKEND / rel
            self.assertTrue(path.is_file(), f"в списке изъятий нет файла: {rel}")
            self.assertTrue(
                _query_constructor_calls(_parse(path)),
                f"{rel}: изъятие больше не нужно — убери строку из SQL_IN_ACTION_GAPS",
            )


# ═════════════════════════════════════════════════════════════════════════
# Rule 3 — заглушка арендатора не возвращается
# ═════════════════════════════════════════════════════════════════════════

# `roo_code/skills/create-api-feature.md` печатает именно этот UUID как
# плейсхолдер в каждом шаблоне action.py — источник, из которого он мог бы
# попасть в код следующего слайса.
TENANT_PLACEHOLDER = "00000000-0000-0000-0000-000000000001"


def _app_files() -> list[Path]:
    return sorted(APP.rglob("*.py"))


def _string_constants(tree: ast.Module) -> set[str]:
    return {
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }


# Изъятия из правила 3: файл, где литерал реально нужен (например тест
# фикстуры), с причиной. Пусто — сегодня литерала нет нигде под app/.
TENANT_PLACEHOLDER_GAPS: dict[str, str] = {}


class NoHardcodedTenantPlaceholderTest(unittest.TestCase):
    def test_placeholder_tenant_is_not_returned(self) -> None:
        files = _app_files()
        # Пол проверки. Замер 2026-09-25 — 176 файлов *.py под app/.
        self.assertGreaterEqual(
            len(files), 100, "обход перестал находить файлы app/ — сломан обход, а не код"
        )

        violations = []
        for path in files:
            rel = _rel(path)
            if rel in TENANT_PLACEHOLDER_GAPS:
                continue
            if TENANT_PLACEHOLDER in _string_constants(_parse(path)):
                violations.append(rel)

        self.assertEqual(
            [],
            violations,
            "захардкоженный арендатор-заглушка вместо current_user.tenant_id: " + ", ".join(violations),
        )

    def test_gap_list_is_not_stale(self) -> None:
        for rel in TENANT_PLACEHOLDER_GAPS:
            path = BACKEND / rel
            self.assertTrue(path.is_file(), f"в списке изъятий нет файла: {rel}")
            self.assertIn(
                TENANT_PLACEHOLDER,
                _string_constants(_parse(path)),
                f"{rel}: изъятие больше не нужно — убери строку из TENANT_PLACEHOLDER_GAPS",
            )


# ═════════════════════════════════════════════════════════════════════════
# Rule 4 — ядро ходит в модули только через границу
# ═════════════════════════════════════════════════════════════════════════


def _core_files() -> list[Path]:
    return sorted((APP / "core").rglob("*.py"))


def _cross_boundary_module_imports(tree: ast.Module) -> list[str]:
    """Импорты `app.modules...`, которые не являются `app.modules.<X>.internal_api.interface`."""
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            if node.module == "app.modules" or node.module.startswith("app.modules."):
                names.append(node.module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "app.modules" or alias.name.startswith("app.modules."):
                    names.append(alias.name)

    bad = []
    for name in names:
        parts = name.split(".")
        # app . modules . <module> . internal_api . interface
        if len(parts) == 5 and parts[0] == "app" and parts[1] == "modules" and parts[3:] == [
            "internal_api",
            "interface",
        ]:
            continue
        bad.append(name)
    return bad


# Изъятия из правила 4: файл под app/core/, который реально импортирует чужой
# shared/features, с причиной. Пусто — сегодня правило не нарушается ни разу.
CORE_BOUNDARY_GAPS: dict[str, str] = {}


class CoreCrossesBoundaryOnlyTest(unittest.TestCase):
    def test_core_imports_modules_only_through_internal_api(self) -> None:
        files = _core_files()
        # Пол проверки. Замер 2026-09-25 — 13 файлов *.py под app/core/.
        self.assertGreaterEqual(
            len(files), 8, "обход перестал находить файлы app/core/ — сломан обход, а не код"
        )

        violations = []
        for path in files:
            rel = _rel(path)
            if rel in CORE_BOUNDARY_GAPS:
                continue
            for bad in _cross_boundary_module_imports(_parse(path)):
                violations.append(f"{rel}: {bad}")

        self.assertEqual(
            [],
            violations,
            "app/core импортирует модуль в обход internal_api.interface: " + ", ".join(violations),
        )

    def test_known_good_import_is_not_a_false_positive(self) -> None:
        """`core/uploads/action.py` импортирует `auth.internal_api.interface` — это
        разрешённая форма, а не находка (единственный сегодняшний импорт `app.modules`
        под `app/core/`)."""
        path = APP / "core" / "uploads" / "action.py"
        self.assertTrue(path.is_file())
        self.assertEqual(
            [],
            _cross_boundary_module_imports(_parse(path)),
            "разрешённый импорт internal_api.interface принят за нарушение границы",
        )

    def test_gap_list_is_not_stale(self) -> None:
        for rel in CORE_BOUNDARY_GAPS:
            path = BACKEND / rel
            self.assertTrue(path.is_file(), f"в списке изъятий нет файла: {rel}")
            self.assertTrue(
                _cross_boundary_module_imports(_parse(path)),
                f"{rel}: изъятие больше не нужно — убери строку из CORE_BOUNDARY_GAPS",
            )


if __name__ == "__main__":
    unittest.main()
