"""Реестр моделей для Alembic полон.

`backend/alembic/_alembic_imports.py` — единственное место, которое читает
`env.py` перед `alembic check`/автогенерацией: только импортированные там
классы попадают в `Base.metadata`. Модель, объявленная в `app/**/models.py`,
но не попавшая в этот файл, для Alembic не существует — новая ревизия для неё
не сгенерируется, `alembic check` промолчит «No new upgrade operations
detected» даже когда в базе нет соответствующей таблицы.

Сторож работает разбором исходников — AST по `app/**/models.py` и по самому
`_alembic_imports.py`, без импорта приложения и без базы.

    cd backend && python3 -m pytest tests/test_schema_registry.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"
ALEMBIC_IMPORTS = BACKEND / "alembic" / "_alembic_imports.py"

# Базовые классы, наследование от которых делает класс ORM-моделью. `Base` —
# прямой сигнал; `UUIDMixin`/`TimestampMixin` — миксины из app/core/base.py,
# которые в этом кодовой базе не встречаются без Base по соседству, но
# перечислены отдельно, чтобы обход не зависел от порядка баз в объявлении.
MODEL_BASE_NAMES = {"Base", "UUIDMixin", "TimestampMixin"}


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _base_names(node: ast.ClassDef) -> set[str]:
    names = set()
    for base in node.bases:
        if isinstance(base, ast.Name):
            names.add(base.id)
        elif isinstance(base, ast.Attribute):
            names.add(base.attr)
    return names


def _model_classes(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and _base_names(node) & MODEL_BASE_NAMES:
            names.append(node.name)
    return names


def _all_model_names() -> dict[str, Path]:
    """Имя ORM-класса -> файл, где оно объявлено."""
    result: dict[str, Path] = {}
    for path in sorted(APP.rglob("models.py")):
        for name in _model_classes(path):
            result[name] = path
    return result


def _imported_names(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                names.add(alias.asname or alias.name)
    return names


class SchemaRegistryTest(unittest.TestCase):
    def test_every_orm_model_is_imported_for_alembic(self) -> None:
        self.assertTrue(
            ALEMBIC_IMPORTS.is_file(), f"реестр импортов исчез: {_rel(ALEMBIC_IMPORTS)}"
        )

        models = _all_model_names()
        # Пол проверки: обход, переставший находить модели, даёт зелёный отчёт
        # о пустоте — он хуже отсутствующей проверки.
        self.assertGreaterEqual(
            len(models),
            30,
            "обход перестал находить модели в app/**/models.py — сломан обход, а не код",
        )

        imported = _imported_names(ALEMBIC_IMPORTS)
        missing = sorted(
            f"{name} ({_rel(path)})" for name, path in models.items() if name not in imported
        )
        self.assertEqual(
            [],
            missing,
            "модель не импортирована в alembic/_alembic_imports.py и невидима для "
            "миграций: " + ", ".join(missing),
        )


if __name__ == "__main__":
    unittest.main()
