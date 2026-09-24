"""Границы бэкенда, которые до сих пор проверялись глазами при ревью.

Три сторожа:

* `ModuleIsolationTest` — межмодульный доступ идёт только через
  `app.modules.<X>.internal_api`; прямой импорт чужих `features/` или `shared/`
  запрещён. Единственное объявленное исключение — `app/main.py`, точка сборки,
  которая обязана импортировать роутеры фич, чтобы их зарегистрировать.
* `OutwardContractTest` — то, что видно снаружи. Каждый зарегистрированный роут
  (кроме `/health` и монтирования статики) заворачивает ответ в подкласс
  `ApiResponse`; каждый `router`, объявленный в `action.py`, реально включён в
  `app` — написанный и не зарегистрированный роут снаружи не существует.

`app.routes` в этой версии FastAPI (0.141.1) не годится для перечисления
конечных путей напрямую: включённые роутеры лежат там ленивыми
`_IncludedRouter` с `path=None`. Настоящие маршруты и их `response_model`
достаются через `_IncludedRouter.original_router.routes` — так же, как и
`app.openapi()`, только без похода через генерацию схемы.

    cd backend && python3 -m pytest tests/test_module_boundaries.py -q
"""

from __future__ import annotations

import ast
import importlib
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

MODULES = sorted(
    p.name for p in (APP / "modules").iterdir() if p.is_dir() and p.name != "__pycache__"
)


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


# ─────────────────────────────────────────────────────────────────────────
# Guard 1 — module isolation
# ─────────────────────────────────────────────────────────────────────────

# Файлы, которым разрешено импортировать `features`/`shared` чужого модуля, с
# причиной. Список закрытый и объявлен поимённо — новый файл в этом списке
# должен быть виден в дифе, а не проскользнуть тихим исключением из обхода.
ISOLATION_EXCEPTIONS = {
    "app/main.py": (
        "точка сборки — импортирует роутеры фич из features/ по всем модулям, "
        "чтобы зарегистрировать их через app.include_router()"
    ),
}


def _own_module(path: Path) -> str | None:
    """Модуль, которому принадлежит файл, или None для app/core и app/main.py."""
    parts = path.relative_to(BACKEND).parts
    if len(parts) >= 3 and parts[0] == "app" and parts[1] == "modules":
        return parts[2]
    return None


def _cross_module_hits(path: Path) -> list[str]:
    """Импорты `app.modules.<X>.features...`/`...shared...` для X != свой модуль."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    own = _own_module(path)
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            names.append(node.module)
        elif isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)

    hits = []
    for name in names:
        for module in MODULES:
            if module == own:
                continue
            if name == f"app.modules.{module}.features" or name.startswith(
                f"app.modules.{module}.features."
            ):
                hits.append(name)
            elif name == f"app.modules.{module}.shared" or name.startswith(
                f"app.modules.{module}.shared."
            ):
                hits.append(name)
    return hits


class ModuleIsolationTest(unittest.TestCase):
    def test_no_direct_cross_module_imports(self) -> None:
        files = sorted(APP.rglob("*.py"))
        # Пол проверки: обход, переставший находить файлы или модули, даёт
        # зелёный отчёт о пустоте — он хуже отсутствующей проверки.
        self.assertGreaterEqual(
            len(files), 100, "обход перестал находить файлы app/ — сломан обход, а не код"
        )
        self.assertGreaterEqual(
            len(MODULES), 8, "обход перестал находить модули app/modules/* — сломан обход"
        )

        violations = []
        for path in files:
            rel = _rel(path)
            if rel in ISOLATION_EXCEPTIONS:
                continue
            for hit in _cross_module_hits(path):
                violations.append(f"{rel}: {hit}")

        self.assertEqual(
            [],
            violations,
            "прямой импорт чужих features/shared в обход internal_api: " + ", ".join(violations),
        )

    def test_isolation_exceptions_are_not_stale(self) -> None:
        for rel in ISOLATION_EXCEPTIONS:
            self.assertTrue((BACKEND / rel).is_file(), f"в списке исключений нет файла: {rel}")


# ─────────────────────────────────────────────────────────────────────────
# Guard 2 — контракт наружу и достижимость
# ─────────────────────────────────────────────────────────────────────────

# `/health` — служебный роут точки сборки, вне контракта фич по определению
# задачи; монтирование статики (`app.mount`) не роут вовсе и response_model
# не имеет.
ENVELOPE_EXCLUDED_PATHS = {"/health"}


def _registered_routes(app) -> list[tuple[str, str, object]]:
    """(метод, путь, response_model) для каждого реально включённого роута.

    Обходит `app.routes`: для включённых роутеров (`_IncludedRouter`) читает
    настоящие `APIRoute` через `.original_router.routes`, а не сам ленивый
    объект с `path=None`. `Mount` (статика) и голые `Route` (`/docs`,
    `/openapi.json`, `/redoc`) пропускаются — это не роуты фич.
    """
    routes: list[tuple[str, str, object]] = []
    for r in app.routes:
        original_router = getattr(r, "original_router", None)
        if original_router is not None:
            for rt in original_router.routes:
                for method in sorted(rt.methods or ()):
                    routes.append((method, rt.path, getattr(rt, "response_model", None)))
        elif type(r).__name__ == "APIRoute":
            for method in sorted(r.methods or ()):
                routes.append((method, r.path, getattr(r, "response_model", None)))
    return routes


class OutwardContractTest(unittest.TestCase):
    def setUp(self) -> None:
        from app.core.schemas import ApiResponse
        from app.main import app

        self.app = app
        self.ApiResponse = ApiResponse

    def test_every_route_wraps_in_api_response(self) -> None:
        routes = _registered_routes(self.app)
        checked = [r for r in routes if r[1] not in ENVELOPE_EXCLUDED_PATHS]
        self.assertGreaterEqual(
            len(checked), 30, "обход перестал находить роуты — сломан обход, а не код"
        )

        bad = [
            f"{method} {path}: response_model={response_model!r}"
            for method, path, response_model in checked
            if not (
                isinstance(response_model, type)
                and issubclass(response_model, self.ApiResponse)
            )
        ]
        self.assertEqual(
            [], bad, "роуты без конверта ApiResponse (голый dict или отсутствие модели): " + "; ".join(bad)
        )

    def test_every_action_router_is_registered(self) -> None:
        registered = {(method, path) for method, path, _ in _registered_routes(self.app)}

        action_files = sorted(APP.rglob("action.py"))
        self.assertGreaterEqual(
            len(action_files), 10, "обход перестал находить action.py — сломан обход, а не код"
        )

        unreachable: list[str] = []
        routers_seen = 0
        for path in action_files:
            dotted = ".".join(path.relative_to(BACKEND).with_suffix("").parts)
            module = importlib.import_module(dotted)
            router = getattr(module, "router", None)
            if router is None:
                unreachable.append(f"{_rel(path)}: файл не объявляет объект router")
                continue
            routers_seen += 1
            for rt in router.routes:
                for method in sorted(rt.methods or ()):
                    if (method, rt.path) not in registered:
                        unreachable.append(f"{_rel(path)}: {method} {rt.path} не включён в app")

        self.assertGreaterEqual(
            routers_seen, 10, "обход перестал находить объекты router — сломан обход, а не код"
        )
        self.assertEqual(
            [], unreachable, "написанный и не зарегистрированный роут: " + "; ".join(unreachable)
        )


if __name__ == "__main__":
    unittest.main()
