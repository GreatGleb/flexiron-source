"""Граф ревизий Alembic цел — без раздвоений и оборванных ссылок.

Каждый файл в `alembic/versions/` объявляет `revision` и `down_revision`.
Сторож проверяет граф разбором исходников, без импорта Alembic и без базы:

* идентификаторы `revision` не повторяются — иначе граф не однозначен;
* каждый непустой `down_revision` (в том числе элемент кортежа у
  merge-ревизии) называет существующую ревизию — иначе апгрейд обрывается на
  ссылке в никуда;
* голова ровно одна — иначе `alembic upgrade head` падает с «Multiple head
  revisions are present», как это уже случилось однажды и было исправлено
  в `a6cd643b6f75_merge_logo_url_and_product_uom_heads.py`.

    cd backend && python3 -m pytest tests/test_migration_graph.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
VERSIONS = BACKEND / "alembic" / "versions"


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _assigned_value(tree: ast.Module, name: str) -> object:
    """Значение module-level `name = ...` / `name: Ann = ...`, разобранное литералом."""
    for node in tree.body:
        targets = None
        if isinstance(node, ast.Assign):
            targets = node.targets
        elif isinstance(node, ast.AnnAssign) and node.target is not None:
            targets = [node.target]
        if not targets:
            continue
        for target in targets:
            if isinstance(target, ast.Name) and target.id == name:
                return ast.literal_eval(node.value)
    raise AssertionError(f"{name} не найден на верхнем уровне модуля")


def _flatten(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple)):
        return list(value)
    raise AssertionError(f"неожиданный тип down_revision: {value!r}")


class MigrationGraphTest(unittest.TestCase):
    def setUp(self) -> None:
        self.files = sorted(VERSIONS.glob("*.py"))
        # Пол проверки: обход, переставший находить файлы ревизий, даёт
        # зелёный отчёт о пустоте — он хуже отсутствующей проверки.
        self.assertGreaterEqual(
            len(self.files),
            20,
            "обход перестал находить файлы в alembic/versions/ — сломан обход, а не код",
        )

        self.revisions: dict[str, Path] = {}
        self.down_revisions: dict[str, list[str]] = {}
        self.duplicates: list[str] = []
        for path in self.files:
            tree = ast.parse(path.read_text(encoding="utf-8"))
            revision = _assigned_value(tree, "revision")
            down_revision = _flatten(_assigned_value(tree, "down_revision"))
            if revision in self.revisions:
                self.duplicates.append(revision)
            self.revisions[revision] = path
            self.down_revisions[revision] = down_revision

    def test_revision_ids_are_unique(self) -> None:
        self.assertEqual(
            [],
            self.duplicates,
            "повторяющийся идентификатор revision: " + ", ".join(self.duplicates),
        )

    def test_every_down_revision_resolves(self) -> None:
        dangling = []
        for revision, downs in self.down_revisions.items():
            for down in downs:
                if down not in self.revisions:
                    dangling.append(f"{_rel(self.revisions[revision])}: down_revision={down!r}")
        self.assertEqual(
            [], dangling, "down_revision ссылается на несуществующую ревизию: " + ", ".join(dangling)
        )

    def test_exactly_one_head(self) -> None:
        referenced = {down for downs in self.down_revisions.values() for down in downs}
        heads = sorted(rev for rev in self.revisions if rev not in referenced)
        self.assertEqual(
            1,
            len(heads),
            "граф ревизий обязан иметь ровно одну голову, а не: " + ", ".join(heads),
        )


if __name__ == "__main__":
    unittest.main()
