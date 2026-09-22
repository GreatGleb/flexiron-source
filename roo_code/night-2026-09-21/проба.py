#!/usr/bin/env python3
"""Текстовый поиск по КОДУ, а не по файлу — общий инструмент для приёмки.

Зачем: критерий, считающий вхождения подстроки в файле, удовлетворяется правкой
прозы — докстринга или комментария (замер 2026-09-22: сторож П11 был обойдён
докстрингом `WarehouseMap`, счётчик С2 набрал третье совпадение на
`DateTime(timezone=True)`, а «три роута» считались числом строк `@router`).
Этот скрипт читает AST, поэтому:

* комментариев в потоке токенов нет вовсе — в AST они не попадают;
* докстринги выброшены как отдельные строковые выражения, а не как текст;
* поиск можно сузить до объявлений колонок (`mapped_column`) — так требует
  владелец: сторож «ссылка не хранится» обязан смотреть на объявления
  `mapped_column`, а не на файл целиком.

Использование:

    python3 проба.py --файл <путь.py> --токен <подстрока> [--область mapped_column]

    --файл   путь к python-файлу (относительный — от текущего каталога, то есть
             обычно от `backend/`, где пробы и запускаются);
    --токен  подстрока, которую ищем В ТОКЕНАХ кода: идентификаторах (`Name`,
             `Attribute.attr`), именах ключевых аргументов и строковых
             литералах, написанных в коде (не в докстрингах);
    --область  `модуль` (по умолчанию) — весь код файла;
               `mapped_column` — только то, что относится к объявлениям колонок:
               имя, которому присвоен вызов `mapped_column(...)`, и токены внутри
               самого вызова. Проза в докстринге в обоих случаях не считается.

Печатает ровно одно число: сколько токенов кода содержат подстроку (0 — ни
одного). Ненулевой код возврата — ошибка аргументов или разбора; это сигнал
«доказательство не исполнено», а не «доказано ноль».

Пример:

    cd backend
    python3 -B ../roo_code/night-2026-09-21/проба.py \\
        --файл app/modules/settings/shared/models.py \\
        --токен map_url --область mapped_column
"""

from __future__ import annotations

import argparse
import ast
import sys


def _is_docstring(node: ast.AST) -> bool:
    """Строковое выражение-проза: докстринг модуля, класса или функции."""
    return (
        isinstance(node, ast.Expr)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    )


def _tokens(node: ast.AST) -> list[str]:
    """Токены кода поддерева: идентификаторы, имена kwargs, строки-литералы."""
    found: list[str] = []
    for child in ast.iter_child_nodes(node):
        if _is_docstring(child):
            continue  # проза, а не код — в обе стороны
        if isinstance(child, ast.Name):
            found.append(child.id)
        elif isinstance(child, ast.Attribute):
            found.append(child.attr)
        elif isinstance(child, ast.keyword) and child.arg:
            found.append(child.arg)
        elif isinstance(child, ast.Constant) and isinstance(child.value, str):
            found.append(child.value)
        found.extend(_tokens(child))
    return found


def _assigned_names(node: ast.stmt) -> list[str]:
    """Имена, которым присвоено значение в AnnAssign/Assign."""
    target = getattr(node, "target", None)
    if isinstance(target, ast.Name):
        return [target.id]
    if isinstance(target, (ast.Tuple, ast.List)):
        return [item.id for item in target.elts if isinstance(item, ast.Name)]
    return []


def _call_name(func: ast.expr) -> str | None:
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return None


def _is_mapped_column(node: ast.AST) -> bool:
    """`x: Mapped[...] = mapped_column(...)` — объявление колонки."""
    value = getattr(node, "value", None)
    return isinstance(value, ast.Call) and _call_name(value.func) == "mapped_column"


def tokens_of(source: str, scope: str) -> list[str]:
    """Токены кода файла: всё (`модуль`) или только объявления колонок."""
    tree = ast.parse(source)
    if scope == "mapped_column":
        found: list[str] = []
        for node in ast.walk(tree):
            if not isinstance(node, (ast.AnnAssign, ast.Assign)):
                continue
            if not _is_mapped_column(node):
                continue
            found.extend(_assigned_names(node))
            found.extend(_tokens(node.value))  # типы, ForeignKey(...) и прочее
        return found
    return _tokens(tree)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Поиск подстроки в токенах кода (AST), а не в тексте файла."
    )
    parser.add_argument("--файл", dest="file", required=True)
    parser.add_argument("--токен", dest="token", required=True)
    parser.add_argument(
        "--область",
        dest="scope",
        choices=("модуль", "mapped_column"),
        default="модуль",
    )
    args = parser.parse_args(argv)

    try:
        with open(args.file, encoding="utf-8") as handle:
            source = handle.read()
    except OSError as exc:
        print(f"не читается {args.file}: {exc}", file=sys.stderr)
        return 2

    found = tokens_of(source, args.scope)
    print(sum(1 for token in found if args.token in token))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
