"""Два правила бэкенда, каждое из которых раньше было записано дважды или трижды.

AST-сторож в том же стиле, что `test_token_reader_lives_in_one_place`
(`backend/tests/test_route_auth.py`): разбирает исходники без запуска приложения.

    cd backend && python3 -m pytest tests/modules/auth/test_secret_link_one_source.py -q

1. Полный URL секретной ссылки собирается f-строкой, склеивающей
`frontend_url` с путём `/auth/link` — раньше это делали `register/domain.py`,
`me/domain.py` и `settings/features/profile/domain.py` каждая своим выражением.
Канонический сборщик — ровно один: `auth/shared/secret_link.py`.

2. Запись роли первого пользователя раньше писала два регистра сразу:
`role="owner"` (легаси-колонка) и `role_name="Owner"` (таблица ролей). Решение
владельца П3 требует строчных везде — заглавной формы роли в продуктовом коде
быть не должно.
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[3]
APP = BACKEND / "app"

SECRET_LINK_HOME = APP / "modules" / "auth" / "shared" / "secret_link.py"

# Длина токена секретной ссылки. Второе её написание где угодно в `app` — находка:
# два числа на одно правило расходятся молча (вторая половина БАГ-16).
SECRET_LINK_BYTES = 48

# Канонический список ролей (§6.3 соглашений) — строчными. Заглавные формы этих
# же имён в продуктовом коде считаются находкой, а не совпадением.
KNOWN_ROLE_NAMES = ("owner", "admin", "sales", "warehouse", "accounting")


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _source_files() -> list[Path]:
    return sorted(APP.rglob("*.py"))


def _joined_strs(tree: ast.Module) -> list[ast.JoinedStr]:
    return [node for node in ast.walk(tree) if isinstance(node, ast.JoinedStr)]


def _assembles_secret_link(fstring: ast.JoinedStr) -> bool:
    """f-строка, где хотя бы один текстовый кусок содержит путь `/auth/link`.

    Плоская строка (докстринг, комментарий к роуту) — не JoinedStr, и её этот
    разбор не видит: ищется именно СБОРКА урла интерполяцией, а не упоминание пути.
    """
    for part in fstring.values:
        if isinstance(part, ast.Constant) and isinstance(part.value, str):
            if "/auth/link" in part.value:
                return True
    return False


def _is_token_urlsafe(call: ast.Call) -> bool:
    """`secrets.token_urlsafe(...)` или `token_urlsafe(...)` — обе формы вызова."""
    target = call.func
    if isinstance(target, ast.Attribute):
        return target.attr == "token_urlsafe"
    return isinstance(target, ast.Name) and target.id == "token_urlsafe"


def _string_constants(tree: ast.Module) -> list[tuple[int, str]]:
    return [
        (node.lineno, node.value)
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    ]


class SecretLinkOneSourceTest(unittest.TestCase):
    def test_home_file_exists(self) -> None:
        self.assertTrue(
            SECRET_LINK_HOME.is_file(), "канонический сборщик секретной ссылки исчез"
        )

    def test_secret_link_assembled_in_one_place(self) -> None:
        files = _source_files()
        # Пол проверки: разбор не должен молча найти ноль файлов.
        self.assertGreaterEqual(
            len(files), 25, "разбор перестал находить файлы — сломан экстрактор, а не код"
        )

        assemblers = []
        for path in files:
            tree = ast.parse(path.read_text(encoding="utf-8"))
            if any(_assembles_secret_link(fs) for fs in _joined_strs(tree)):
                assemblers.append(_rel(path))

        self.assertEqual(
            [_rel(SECRET_LINK_HOME)],
            assemblers,
            "секретная ссылка собирается не в одном месте: " + ", ".join(assemblers),
        )

    def test_no_second_reader_imports_frontend_url_for_the_link(self) -> None:
        """Settings обязан звать сборщик через internal_api/interface.py.

        Прямой импорт из app.modules.auth.shared в settings — обход правила
        изоляции модулей, даже если сама сборка ссылки уже вынесена в одно место.
        """
        settings_domain = APP / "modules" / "settings" / "features" / "profile" / "domain.py"
        tree = ast.parse(settings_domain.read_text(encoding="utf-8"))
        forbidden = [
            node.module
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom)
            and node.module is not None
            and node.module.startswith("app.modules.auth.shared")
        ]
        self.assertEqual(
            [], forbidden, "settings импортирует auth.shared напрямую: " + ", ".join(forbidden)
        )

    def test_secret_link_token_length_is_spelled_out_once(self) -> None:
        """Длина токена ссылки названа ровно в одном файле — том же, что собирает URL.

        До 2026-09-25 `auth` держал её именованной константой, а `settings` рисовал
        токен собственным `secrets.token_urlsafe(48)`. Вторая половина БАГ-16: URL
        свели, а число осталось в двух местах.
        """
        files = _source_files()
        self.assertGreaterEqual(
            len(files), 25, "разбор перестал находить файлы — сломан экстрактор, а не код"
        )

        spellings = []
        for path in files:
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if not (isinstance(node, ast.Call) and _is_token_urlsafe(node)):
                    continue
                for argument in node.args:
                    if isinstance(argument, ast.Constant) and argument.value == SECRET_LINK_BYTES:
                        spellings.append(f"{_rel(path)}:{node.lineno}")

        self.assertEqual(
            [], spellings,
            "длина токена ссылки написана вызовом token_urlsafe вне канонического файла: "
            + ", ".join(spellings),
        )
        home = ast.parse(SECRET_LINK_HOME.read_text(encoding="utf-8"))
        # Пол проверки: в каноническом файле длина обязана быть, иначе пустой список
        # выше означал бы «нигде», а не «ровно здесь».
        self.assertIn(
            SECRET_LINK_BYTES,
            [n.value for n in ast.walk(home) if isinstance(n, ast.Constant)],
            "в каноническом файле длины токена нет — проверка выше ничего не сторожит",
        )

    def test_no_capitalized_role_literal(self) -> None:
        files = _source_files()
        self.assertGreaterEqual(
            len(files), 25, "разбор перестал находить файлы — сломан экстрактор, а не код"
        )

        offenders = []
        for path in files:
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for lineno, value in _string_constants(tree):
                if value.lower() in KNOWN_ROLE_NAMES and value != value.lower():
                    offenders.append(f"{_rel(path)}:{lineno} {value!r}")

        self.assertEqual(
            [], offenders, "роль записана не строчными: " + ", ".join(offenders)
        )


if __name__ == "__main__":
    unittest.main()
