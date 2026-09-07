"""Каждый роут объявляет аутентификацию, а каждый геттер по id — арендатора.

Почему статикой, а не через `router.routes`. Правильный способ — собрать приложение
и перебрать `route.dependant`, но FastAPI и SQLAlchemy в этом окружении не установлены
(`python3 -c "import fastapi"` → ModuleNotFoundError), а проверка, которую нельзя
запустить, — это не проверка. Тот же довод записан в соседнем тесте
`tests/modules/bcc/test_send_request.py`. Поэтому разбор идёт по AST: он ловит ровно
тот дефект, который прогон сверки нашёл руками, и запускается везде.

    cd backend && python3 -m unittest discover -s tests -t .

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

# Имена зависимостей, каждая из которых означает «этот роут требует вошедшего».
#
# Их две, и это само по себе находка. `_resolve_user_id` — три ОТДЕЛЬНЫЕ копии одной
# функции (`settings/features/crud/action.py`, `settings/features/profile/action.py`,
# `core/uploads/action.py`, причём третья прямо пишет в докстринге «same logic as
# settings»). `_bearer` — четвёртый механизм: `HTTPBearer(auto_error=False)` плюс ручная
# проверка `credentials is None` в `auth/features/me/action.py`. Канонического места нет:
# `auth/shared/dependencies.py` обещает докстрингом «get_current_user, permission
# checkers, tenant isolation» и не содержит ни строки кода.
#
# Это и есть корень дыры 2026-09-04: восемь роутов забыли зависимость потому, что тянуться
# было не к чему — каждый модуль писал свою. Сведение зависимостей в одно место записано
# находкой `contract-sync-settings-bugs.md`, БАГ-22.
AUTH_DEPENDENCIES = ("_resolve_user_id", "_bearer")

# Роуты, которым вошедший не нужен ПО СМЫСЛУ, а не по недосмотру. Список закрытый:
# новый публичный роут придётся внести сюда руками, и это правильно — пусть решение
# «этот путь открыт всем» будет видно в дифе.
PUBLIC_ROUTES = {
    "app/modules/auth/features/login/action.py",       # вход — до входа
    "app/modules/auth/features/register/action.py",    # регистрация — до входа
    "app/modules/auth/features/magic_link/action.py",  # вход по ссылке из письма
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


def _declares_auth(fn: ast.AsyncFunctionDef) -> bool:
    """Есть ли среди значений по умолчанию Depends(<одна из зависимостей входа>)."""
    for default in list(fn.args.defaults) + list(fn.args.kw_defaults):
        if not isinstance(default, ast.Call):
            continue
        callee = default.func
        if not (isinstance(callee, ast.Name) and callee.id == "Depends"):
            continue
        for arg in default.args:
            if isinstance(arg, ast.Name) and arg.id in AUTH_DEPENDENCIES:
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
                if not _declares_auth(fn):
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
                all(_declares_auth(fn) for fn in handlers),
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
