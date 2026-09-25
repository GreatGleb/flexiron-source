"""Роли пишутся строчными буквами; can_read матрицы по умолчанию — ложь.

roo_code/roo-context/api/00-conventions.md §6.3 требует строчный регистр роли
везде, где она записана литералом в бэкенде («Заглавные формы... подлежат
приведению к строчному»). §6.4 требует server_default=false у can_read в
role_permissions — верно поведение мока: новый элемент матрицы видит только
админ, а не все роли сразу.

Сторож разбирает исходники AST, без импорта приложения и без базы:

    cd backend && python3 -m pytest tests/modules/auth/test_role_conventions.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent.parent.parent
APP = BACKEND / "app"
MODELS = APP / "modules" / "auth" / "shared" / "models.py"

# Имена переменных/атрибутов/keyword-аргументов, которые несут значение роли.
ROLE_NAMES = {"role", "role_name"}


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _py_files() -> list[Path]:
    return sorted(APP.rglob("*.py"))


def _string_constants(node: ast.AST) -> list[str]:
    return [
        child.value
        for child in ast.walk(node)
        if isinstance(child, ast.Constant) and isinstance(child.value, str)
    ]


def _role_literals(path: Path) -> list[str]:
    """Все строковые литералы, записанные как значение роли, в этом файле."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found: list[str] = []

    for node in ast.walk(tree):
        # User(role="owner"), UserRole(role_name="owner") — keyword вызова.
        if isinstance(node, ast.Call):
            for kw in node.keywords:
                if (
                    kw.arg in ROLE_NAMES
                    and isinstance(kw.value, ast.Constant)
                    and isinstance(kw.value.value, str)
                ):
                    found.append(kw.value.value)
            continue

        # role: Mapped[str] = mapped_column(..., default="owner", server_default="owner")
        # user.role = "owner" / obj.role_name = "owner" — присваивание в role*.
        targets: list[ast.expr] | None = None
        if isinstance(node, ast.Assign):
            targets = node.targets
        elif isinstance(node, ast.AnnAssign):
            targets = [node.target] if node.target is not None else None
        if not targets or node.value is None:
            continue

        names = set()
        for target in targets:
            if isinstance(target, ast.Name):
                names.add(target.id)
            elif isinstance(target, ast.Attribute):
                names.add(target.attr)
        if names & ROLE_NAMES:
            found.extend(_string_constants(node.value))

    return found


class RoleLowercaseTest(unittest.TestCase):
    def test_no_uppercase_role_literal_under_app(self) -> None:
        files = _py_files()
        # Пол проверки: обход, переставший находить файлы, даёт зелёный отчёт
        # о пустоте — он хуже отсутствующей проверки.
        self.assertGreaterEqual(
            len(files),
            100,
            "обход перестал находить файлы в app/**/*.py — сломан обход, а не код",
        )

        violations = []
        for path in files:
            for literal in _role_literals(path):
                if literal[:1].isupper():
                    violations.append(f"{_rel(path)}: {literal!r}")

        self.assertEqual(
            [],
            violations,
            "литерал роли с заглавной буквы — регистр обязан быть строчным "
            "(00-conventions.md §6.3): " + ", ".join(violations),
        )


class RolePermissionCanReadDefaultTest(unittest.TestCase):
    def test_can_read_server_default_is_false(self) -> None:
        self.assertTrue(
            MODELS.is_file(), f"модель матрицы прав исчезла: {_rel(MODELS)}"
        )
        tree = ast.parse(MODELS.read_text(encoding="utf-8"))

        role_permission = next(
            (
                node
                for node in ast.walk(tree)
                if isinstance(node, ast.ClassDef) and node.name == "RolePermission"
            ),
            None,
        )
        self.assertIsNotNone(role_permission, "класс RolePermission не найден в models.py")

        can_read_call = next(
            (
                node.value
                for node in ast.walk(role_permission)
                if isinstance(node, ast.AnnAssign)
                and isinstance(node.target, ast.Name)
                and node.target.id == "can_read"
            ),
            None,
        )
        self.assertIsNotNone(can_read_call, "колонка can_read не найдена в RolePermission")

        kwargs = {kw.arg: kw.value for kw in can_read_call.keywords}

        self.assertIn("default", kwargs, "у can_read нет python-стороннего default=")
        self.assertIs(
            ast.literal_eval(kwargs["default"]),
            False,
            "can_read.default обязан быть False — новый элемент матрицы видит только "
            "админ (00-conventions.md §6.4)",
        )

        self.assertIn("server_default", kwargs, "у can_read нет server_default=")
        self.assertEqual(
            str(ast.literal_eval(kwargs["server_default"])).lower(),
            "false",
            "can_read.server_default обязан быть \"false\" — новый элемент матрицы видит "
            "только админ (00-conventions.md §6.4)",
        )


if __name__ == "__main__":
    unittest.main()
