"""Сторож пакетов вертикальных слайсов — каждый `features/<фича>/` каталог
обязан быть реальным пакетом, а не голой папкой с модулями.

`test_slice_layers.py` смотрит на то, что происходит ВНУТРИ файлов слайса
(HTTP не просачивается в domain, SQL не строится в action.py). Этот сторож
смотрит на границу пакета: `__init__.py` обязан существовать у каждого такого
каталога, а там, где он объявляет `__all__`, каждое перечисленное имя обязано
быть в этом же файле реально импортировано или определено — иначе `__all__`
обещает то, чего в модуле нет.

    cd backend && python3 -m pytest tests/test_feature_packages.py -q
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


def _feature_dirs() -> list[Path]:
    """Каталоги вида `app/modules/<модуль>/features/<фича>/`.

    `__pycache__` — не слайс, а мусор компиляции; он тоже лежит прямо под
    `features/` и без фильтра прошёл бы как каталог фичи без `__init__.py`.
    """
    out: list[Path] = []
    for features_dir in sorted((APP / "modules").glob("*/features")):
        for child in sorted(features_dir.iterdir()):
            if child.is_dir() and not child.name.startswith("__"):
                out.append(child)
    return out


class FeaturePackageHasInitTest(unittest.TestCase):
    def test_every_feature_dir_has_init(self) -> None:
        dirs = _feature_dirs()
        # Пол проверки. Замер 2026-09-25 — 18 каталогов features/*/.
        self.assertGreaterEqual(
            len(dirs),
            15,
            "обход перестал находить каталоги features/*/ — сломан обход, а не код",
        )

        missing = [_rel(d) for d in dirs if not (d / "__init__.py").is_file()]

        self.assertEqual(
            [],
            missing,
            "каталог фичи без __init__.py: " + ", ".join(missing),
        )


def _bound_names(tree: ast.Module) -> set[str]:
    """Имена, реально импортированные или определённые в этом файле."""
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                names.add(alias.asname or alias.name)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                names.add((alias.asname or alias.name).split(".")[0])
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    names.add(target.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            names.add(node.target.id)
    return names


def _declared_all(tree: ast.Module) -> list[str] | None:
    """Значение `__all__`, если модуль его объявляет на верхнем уровне."""
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "__all__" for t in node.targets
        ):
            if isinstance(node.value, (ast.List, ast.Tuple)):
                return [
                    elt.value
                    for elt in node.value.elts
                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str)
                ]
    return None


class FeaturePackageAllIsHonestTest(unittest.TestCase):
    def test_declared_all_names_exist_in_the_same_file(self) -> None:
        inits = [d / "__init__.py" for d in _feature_dirs() if (d / "__init__.py").is_file()]
        # Пол проверки. Замер 2026-09-25 — 18 файлов __init__.py под features/*/.
        self.assertGreaterEqual(
            len(inits),
            15,
            "обход перестал находить __init__.py под features/*/ — сломан обход, а не код",
        )

        with_all = 0
        violations = []
        for path in inits:
            tree = _parse(path)
            declared = _declared_all(tree)
            if declared is None:
                continue
            with_all += 1
            bound = _bound_names(tree)
            for name in declared:
                if name not in bound:
                    violations.append(f"{_rel(path)}: {name}")

        # Пол проверки. Замер 2026-09-25 — 5 файлов __init__.py объявляют __all__
        # (login, register, me, create_product, get_product_detail).
        self.assertGreaterEqual(
            with_all,
            5,
            "обход перестал находить __init__.py с __all__ — сломан обход, а не код",
        )

        self.assertEqual(
            [],
            violations,
            "__all__ называет имя, которого в файле нет: " + ", ".join(violations),
        )


if __name__ == "__main__":
    unittest.main()
