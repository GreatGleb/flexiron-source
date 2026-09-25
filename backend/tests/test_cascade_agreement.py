"""Каскад ORM согласован с `ondelete` внешнего ключа.

Правило: `relationship(...)`, чей аргумент `cascade` содержит `delete-orphan`
или `delete`, обещает удалить строки потомка средствами ORM. Это обещание
верно только тогда, когда внешний ключ потомка на таблицу родителя объявлен
`ondelete="CASCADE"` — иначе база откажет посреди транзакции вместо честного
отказа при попытке ORM удалить строку, защищённую `RESTRICT` (или молча
разойдётся с `SET NULL`). Самоссылающиеся отношения (дерево категорий и
подобные) входят в правило наравне с обычными — сторож не делает для них
исключения.

Сторож работает разбором исходников — AST по `app/**/models.py`, без базы и
без импорта приложения.

    cd backend && python3 -m pytest tests/test_cascade_agreement.py -q
"""

from __future__ import annotations

import ast
import unittest
from dataclasses import dataclass, field
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
APP = BACKEND / "app"

# Базовые классы, наследование от которых делает класс ORM-моделью — то же
# правило, что в test_schema_registry.py.
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


def _literal_str(node: ast.AST | None) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _call_name(node: ast.AST) -> str | None:
    if not isinstance(node, ast.Call):
        return None
    func = node.func
    if isinstance(func, ast.Name):
        return func.id
    if isinstance(func, ast.Attribute):
        return func.attr
    return None


def _find_call(node: ast.AST, name: str) -> ast.Call | None:
    """Ищет вызов `name(...)` внутри выражения — ForeignKey(...) вложен в
    mapped_column(...) как один из позиционных аргументов."""
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call) and _call_name(sub) == name:
            return sub
    return None


@dataclass
class ForeignKeyInfo:
    column: str
    target_table: str
    ondelete: str | None


@dataclass
class RelationshipInfo:
    owner_class: str
    attr: str
    target_class: str
    cascade: str | None
    file: Path


@dataclass
class ClassInfo:
    name: str
    tablename: str | None
    file: Path
    foreign_keys: list[ForeignKeyInfo] = field(default_factory=list)


def _foreign_key_info(call: ast.Call, column_attr: str) -> ForeignKeyInfo | None:
    fk_call = None
    for arg_node in list(call.args) + [kw.value for kw in call.keywords]:
        fk_call = _find_call(arg_node, "ForeignKey")
        if fk_call is not None:
            break
    if fk_call is None or not fk_call.args:
        return None
    target = _literal_str(fk_call.args[0])
    if not target or "." not in target:
        return None
    target_table = target.split(".", 1)[0]
    ondelete = None
    for kw in fk_call.keywords:
        if kw.arg == "ondelete":
            ondelete = _literal_str(kw.value)
    return ForeignKeyInfo(column=column_attr, target_table=target_table, ondelete=ondelete)


def _class_info(node: ast.ClassDef, path: Path) -> ClassInfo:
    tablename = None
    fks: list[ForeignKeyInfo] = []
    for stmt in node.body:
        if isinstance(stmt, ast.Assign) and len(stmt.targets) == 1:
            tgt = stmt.targets[0]
            if isinstance(tgt, ast.Name) and tgt.id == "__tablename__":
                tablename = _literal_str(stmt.value)
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            call = stmt.value
            if isinstance(call, ast.Call) and _call_name(call) == "mapped_column":
                fk = _foreign_key_info(call, stmt.target.id)
                if fk is not None:
                    fks.append(fk)
    return ClassInfo(name=node.name, tablename=tablename, file=path, foreign_keys=fks)


def _relationships_of(node: ast.ClassDef, path: Path) -> list[RelationshipInfo]:
    rels: list[RelationshipInfo] = []
    for stmt in node.body:
        attr_name = None
        call = None
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            attr_name, call = stmt.target.id, stmt.value
        elif (
            isinstance(stmt, ast.Assign)
            and len(stmt.targets) == 1
            and isinstance(stmt.targets[0], ast.Name)
        ):
            attr_name, call = stmt.targets[0].id, stmt.value
        if attr_name is None or not isinstance(call, ast.Call) or _call_name(call) != "relationship":
            continue

        target_class = _literal_str(call.args[0]) if call.args else None
        cascade = None
        secondary = None
        for kw in call.keywords:
            if kw.arg == "argument" and target_class is None:
                target_class = _literal_str(kw.value)
            elif kw.arg == "cascade":
                cascade = _literal_str(kw.value)
            elif kw.arg == "secondary":
                secondary = kw.value
        if target_class is None or secondary is not None:
            # Ссылка на класс не строковым литералом, либо это m2m через
            # association-таблицу — на child-стороне тогда нет прямого FK
            # на таблицу владельца, разбор строки не применим.
            continue

        rels.append(
            RelationshipInfo(
                owner_class=node.name,
                attr=attr_name,
                target_class=target_class,
                cascade=cascade,
                file=path,
            )
        )
    return rels


def _build_registry() -> tuple[list[Path], dict[str, ClassInfo], list[RelationshipInfo]]:
    files = sorted(APP.rglob("models.py"))
    classes: dict[str, ClassInfo] = {}
    relationships: list[RelationshipInfo] = []
    for path in files:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef) and _base_names(node) & MODEL_BASE_NAMES:
                classes[node.name] = _class_info(node, path)
                relationships.extend(_relationships_of(node, path))
    return files, classes, relationships


class CascadeAgreementTest(unittest.TestCase):
    def test_orm_cascade_matches_fk_ondelete(self) -> None:
        files, classes, relationships = _build_registry()

        # Пол обхода: обход, переставший находить модели или отношения, даёт
        # зелёный отчёт о пустоте — он хуже отсутствующей проверки.
        self.assertGreaterEqual(
            len(files),
            8,
            "обход перестал находить файлы app/**/models.py — сломан обход, а не код",
        )
        self.assertGreaterEqual(
            len(relationships),
            10,
            "обход перестал находить объявления relationship(...) — сломан обход, а не код",
        )

        violations = []
        for rel in relationships:
            if not rel.cascade or "delete" not in rel.cascade:
                continue
            owner = classes.get(rel.owner_class)
            child = classes.get(rel.target_class)
            if owner is None or owner.tablename is None or child is None:
                continue

            child_fks = [fk for fk in child.foreign_keys if fk.target_table == owner.tablename]
            if not child_fks:
                # Отношение без прямого FK потомка на таблицу владельца —
                # разбор строки не может судить об этом случае.
                continue

            bad = [fk for fk in child_fks if fk.ondelete != "CASCADE"]
            if bad:
                violations.append(
                    f"{rel.owner_class}.{rel.attr} ({_rel(rel.file)}) обещает "
                    f"cascade={rel.cascade!r}, а {rel.target_class}.{bad[0].column} "
                    f"({_rel(child.file)}) объявлен ondelete={bad[0].ondelete!r} вместо \"CASCADE\""
                )

        self.assertEqual(
            [],
            violations,
            "каскад ORM расходится с ondelete внешнего ключа на стороне потомка: "
            + "; ".join(violations),
        )


if __name__ == "__main__":
    unittest.main()
