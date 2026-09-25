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


class PermissionMatrixDefaultsTest(unittest.TestCase):
    """Умолчание у ВСЕХ четырёх действий и на ОБОИХ уровнях матрицы — `false`.

    П33: новый элемент видит только админ, значит строка, заведённая без явного
    значения, обязана быть непроходной. Правило одно на оба уровня 6.1 — роль и
    переопределение пользователя, — поэтому проверяются обе таблицы, а не одна.

    Раньше здесь стоял `can_read` одной лишь роли, и этого хватило, чтобы в дереве
    ужились три разных ответа: модель роли говорила `false`, модель пользователя не
    говорила ничего, а в базе умолчания не было ни у той, ни у другой. `alembic
    check` этого не видит вовсе — он не сравнивает `server_default`.
    """

    LEVELS = ("RolePermission", "UserPermission")
    ACTIONS = ("can_read", "can_edit", "can_create", "can_delete")

    @classmethod
    def setUpClass(cls) -> None:
        cls.tree = ast.parse(MODELS.read_text(encoding="utf-8"))

    def _column(self, classname: str, column: str):
        holder = next(
            (
                node
                for node in ast.walk(self.tree)
                if isinstance(node, ast.ClassDef) and node.name == classname
            ),
            None,
        )
        self.assertIsNotNone(holder, f"класс {classname} не найден в models.py")
        call = next(
            (
                node.value
                for node in ast.walk(holder)
                if isinstance(node, ast.AnnAssign)
                and isinstance(node.target, ast.Name)
                and node.target.id == column
            ),
            None,
        )
        self.assertIsNotNone(call, f"колонка {column} не найдена в {classname}")
        return {kw.arg: kw.value for kw in call.keywords}

    def test_models_file_exists(self) -> None:
        self.assertTrue(MODELS.is_file(), f"модель матрицы прав исчезла: {_rel(MODELS)}")

    def test_every_action_defaults_to_false_on_both_levels(self) -> None:
        for classname in self.LEVELS:
            for action in self.ACTIONS:
                with self.subTest(level=classname, action=action):
                    kwargs = self._column(classname, action)

                    self.assertIn(
                        "default", kwargs, f"{classname}.{action}: нет python-стороннего default="
                    )
                    self.assertIs(
                        ast.literal_eval(kwargs["default"]),
                        False,
                        f"{classname}.{action}.default обязан быть False — новый элемент "
                        "матрицы видит только админ (00-conventions.md §6.4)",
                    )

                    self.assertIn(
                        "server_default", kwargs, f"{classname}.{action}: нет server_default="
                    )
                    self.assertEqual(
                        str(ast.literal_eval(kwargs["server_default"])).lower(),
                        "false",
                        f"{classname}.{action}.server_default обязан быть \"false\" — новый "
                        "элемент матрицы видит только админ (00-conventions.md §6.4)",
                    )

    def test_the_revision_that_sets_the_defaults_touches_both_tables(self) -> None:
        """Модель — половина ответа; база про умолчание молчит в `alembic check`.

        Поэтому ревизию проверяем чтением: она обязана назвать обе таблицы, иначе
        модель и база снова разойдутся, и сказать об этом будет нечему.
        """
        revision = (
            MODELS.resolve().parents[4]
            / "alembic"
            / "versions"
            / "f1c4a8e07b26_matrix_can_read_defaults_false.py"
        )
        self.assertTrue(revision.is_file(), "ревизия умолчаний матрицы исчезла")
        body = revision.read_text(encoding="utf-8")
        self.assertIn('"role_permissions"', body)
        self.assertIn('"user_permissions"', body)
        self.assertIn('sa.text("false")', body)


if __name__ == "__main__":
    unittest.main()
