"""Сторож скила создания слайса: скил не учит тому, что бэкенд уже запрещает.

`roo_code/skills/create-api-feature.md` печатает шаблоны слайса, которые автор
копирует дословно. Три места в нём расходились с кодом:

1. Шаблоны `action.py` брали арендатора из литерала-заглушки
   `00000000-0000-0000-0000-000000000001`, тогда как `tests/test_slice_layers.py`
   (константа `TENANT_PLACEHOLDER`, тест `test_placeholder_tenant_is_not_returned`)
   требует отсутствия этого литерала под `app/`. Скопировавший шаблон автор получал
   красный сторож. Настоящий слайс берёт арендатора у `current_user.tenant_id`
   (образец — `app/modules/products/features/create_product/action.py`).
2. Скил предписывал руками править `app/main.py` при добавлении слайса, тогда как
   `discover_feature_routers()` в `app/main.py` обходит `app/**/action.py` и
   регистрирует найденные роутеры сам.
3. Скил утверждал, что тестов в `backend/` нет, тогда как `backend/tests/` — это
   набор сторожей и помодульных тестов, гоняемых `python3 -m pytest tests -q`.

Разбор ведётся по содержанию, а не по номерам строк: номера в скиле поедут от первой
же правки. Сторож обязан доказать непустоту разбора — иначе усечённый или пустой
документ выглядел бы как чистота.

    cd backend && python3 -m pytest tests/test_create_api_feature_skill.py -q
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
SKILL = BACKEND.parent / "roo_code" / "skills" / "create-api-feature.md"

TENANT_PLACEHOLDER = "00000000-0000-0000-0000-000000000001"


class CreateApiFeatureSkillMatchesBackendTest(unittest.TestCase):
    def setUp(self) -> None:
        self.assertTrue(SKILL.is_file(), f"скил не найден: {SKILL}")
        self.text = SKILL.read_text(encoding="utf-8")

    def test_skill_is_read_and_contains_slice_templates(self) -> None:
        """Непустой разбор: пустой документ неотличим от чистого."""
        self.assertGreater(
            len(self.text), 1000, "скил подозрительно короткий — разбор сломался"
        )
        for token in ("action.py", "APIRouter", "router = APIRouter(", "@router.post"):
            self.assertIn(
                token, self.text, f"в скиле не найден шаблон слайса: {token}"
            )

    def test_no_tenant_placeholder_literal(self) -> None:
        self.assertNotIn(
            TENANT_PLACEHOLDER,
            self.text,
            "скил оставляет литерал-заглушку арендатора, за который краснеет "
            "test_slice_layers.py — арендатор берётся у current_user.tenant_id",
        )

    def test_no_manual_include_router_instruction(self) -> None:
        self.assertNotIn(
            "app.include_router(",
            self.text,
            "скил велит звать include_router руками — роутер находится обходом "
            "app/**/action.py в discover_feature_routers()",
        )

    def test_no_claim_that_backend_has_no_tests(self) -> None:
        pattern = re.compile(r"тестов\s+в\s+`?backend/?`?\s+нет", re.IGNORECASE)
        self.assertIsNone(
            pattern.search(self.text),
            "скил утверждает, что тестов в backend нет — они есть, в backend/tests/, "
            "и гоняются python3 -m pytest tests -q",
        )

    def test_skill_names_the_real_test_location_and_command(self) -> None:
        self.assertIn("backend/tests/", self.text)
        self.assertIn("python3 -m pytest tests -q", self.text)


if __name__ == "__main__":
    unittest.main()
