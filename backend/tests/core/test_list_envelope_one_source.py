"""The five-key list envelope (`items`, `total`, `page`, `pageSize`, `totalPages`)
lives in exactly one place: `app.core.schemas.PaginatedResponse`.

Before this guard, `finance.payments` and `warehouse.list_batches` each declared
their own copy of the same five fields (`PaymentListResponse`, `BatchListResponse`)
while `PaginatedResponse` sat unused. This test parses every schema class under
`app/modules/**/features/**/schemas.py` and fails if any of them re-declares the
full five-key set — that would be a second instance of the same rule, not a
domain-specific type.

    cd backend && python3 -m pytest tests/core/test_list_envelope_one_source.py -q
"""

from __future__ import annotations

import ast
import unittest
from pathlib import Path

from app.core.schemas import PaginatedResponse

BACKEND = Path(__file__).resolve().parent.parent.parent
APP = BACKEND / "app"

ENVELOPE_KEYS = {"items", "total", "page", "pageSize", "totalPages"}


def _rel(path: Path) -> str:
    return str(path.relative_to(BACKEND))


def _class_field_names(node: ast.ClassDef) -> set[str]:
    """Direct pydantic-style fields — annotated assignments in the class body."""
    return {
        stmt.target.id
        for stmt in node.body
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name)
    }


def _schema_classes() -> list[tuple[str, str, set[str]]]:
    """(file, class name, field names) for every class in a feature's schemas.py."""
    classes: list[tuple[str, str, set[str]]] = []
    for path in sorted(APP.glob("modules/*/features/*/schemas.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                classes.append((_rel(path), node.name, _class_field_names(node)))
    return classes


class ListEnvelopeLivesInOnePlaceTest(unittest.TestCase):
    def test_the_parse_actually_finds_schema_classes(self) -> None:
        # Пол проверки: обход, переставший находить классы схем, даёт зелёный
        # отчёт о пустоте — он хуже отсутствующей проверки.
        classes = _schema_classes()
        self.assertGreaterEqual(
            len(classes),
            10,
            "обход перестал находить классы схем в app/modules/**/features/**/schemas.py "
            "— сломан обход, а не код",
        )

    def test_no_feature_schema_redeclares_the_five_envelope_keys(self) -> None:
        classes = _schema_classes()

        offenders = [
            f"{file}:{name}"
            for file, name, fields in classes
            if ENVELOPE_KEYS <= fields
        ]

        self.assertEqual(
            [],
            offenders,
            "класс в схемах фичи повторяет пятёрку ключей конверта "
            "(items/total/page/pageSize/totalPages) вместо PaginatedResponse из "
            "app.core.schemas: " + ", ".join(offenders),
        )

    def test_paginated_response_itself_carries_the_five_envelope_keys(self) -> None:
        self.assertEqual(ENVELOPE_KEYS, set(PaginatedResponse.model_fields.keys()))


if __name__ == "__main__":
    unittest.main()
