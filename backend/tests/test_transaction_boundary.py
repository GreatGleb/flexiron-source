"""Сторож границы транзакции — до сих пор не проверялось ничем.

`get_db` в `app/core/database.py` уже коммитит на успешном выходе из запроса и
откатывает на исключении (`app/core/database.py:22-30`). До 2026-09-25 слои
ниже коммитили сами — двадцать пять вызовов `await db.commit()` были рассыпаны
по репозиториям и одному `internal_api/interface.py`, и use case из двух
вызовов репозитория не мог откатиться: первый уже был зафиксирован. Этот файл
не даёт вернуться ни одному из них.

Замер на 2026-09-25 (AST, не текстовый grep — числа ниже воспроизводимы):
под `backend/app/` вызов метода `commit`/`rollback` встречается ровно дважды,
и оба — в `app/core/database.py` внутри `get_db`. Нигде больше ни одного.

Разбор — `ast.Call`, чей `func` — это `ast.Attribute` с именем `commit` или
`rollback`, независимо от того, на каком объекте он вызван (`db.commit()`,
`session.commit()`, `self.session.commit()` — все формы). Это шире, чем
буквально «вызов у `AsyncSession`», и поэтому не пропустит переименованный
параметр сессии; цена — теоретическая возможность найти `commit()`/`rollback()`
не-сессии где-то под `app/`, для чего и существует словарь изъятий ниже
(сегодня пустой: ни одного такого вызова нет).

    cd backend && python3 -m pytest tests/test_transaction_boundary.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

# Единственное место, где вызов commit()/rollback() у сессии разрешён.
ALLOWED_FILE = "app/core/database.py"

COMMIT_ROLLBACK_NAMES = ("commit", "rollback")


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _parse(path: Path) -> ast.Module:
    return ast.parse(path.read_text(encoding="utf-8"))


def _app_files() -> list[Path]:
    return sorted(APP.rglob("*.py"))


def _commit_or_rollback_calls(tree: ast.Module) -> list[tuple[str, int]]:
    """`(имя_метода, номер_строки)` для каждого `<что-угодно>.commit()` /
    `.rollback()` в модуле — независимо от имени объекта слева от точки."""
    found: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr in COMMIT_ROLLBACK_NAMES
        ):
            found.append((node.func.attr, node.lineno))
    return found


# Изъятия: файл, где вызов `commit()`/`rollback()` реально не о границе сессии
# запроса, с причиной. Пусто — сегодня ни один файл кроме `ALLOWED_FILE` не
# вызывает ни то, ни другое.
COMMIT_ROLLBACK_GAPS: dict[str, str] = {}


class SingleCommitPerRequestTest(unittest.TestCase):
    def test_only_get_db_commits_or_rolls_back(self) -> None:
        files = _app_files()
        # Пол проверки. Замер 2026-09-25 — 181 файл *.py под app/.
        self.assertGreaterEqual(
            len(files), 100, "обход перестал находить файлы app/ — сломан обход, а не код"
        )

        violations = []
        for path in files:
            rel = _rel(path)
            if rel == ALLOWED_FILE or rel in COMMIT_ROLLBACK_GAPS:
                continue
            calls = _commit_or_rollback_calls(_parse(path))
            for name, lineno in calls:
                violations.append(f"{rel}:{lineno} ({name})")

        self.assertEqual(
            [],
            violations,
            "коммит/роллбэк вне get_db — граница транзакции размножилась: "
            + ", ".join(violations),
        )

    def test_get_db_is_the_real_positive_control(self) -> None:
        """Утверждение выше не должно быть зелёным просто потому, что грепу
        нечего найти вообще: в `ALLOWED_FILE` обязаны быть ровно commit и
        rollback — иначе тест выше проходит вхолостую."""
        path = BACKEND / ALLOWED_FILE
        self.assertTrue(path.is_file())

        names = [name for name, _ in _commit_or_rollback_calls(_parse(path))]
        self.assertIn("commit", names)
        self.assertIn("rollback", names)

    def test_gap_list_is_not_stale(self) -> None:
        for rel in COMMIT_ROLLBACK_GAPS:
            path = BACKEND / rel
            self.assertTrue(path.is_file(), f"в списке изъятий нет файла: {rel}")
            self.assertTrue(
                _commit_or_rollback_calls(_parse(path)),
                f"{rel}: изъятие больше не нужно — убери строку из COMMIT_ROLLBACK_GAPS",
            )


if __name__ == "__main__":
    unittest.main()
