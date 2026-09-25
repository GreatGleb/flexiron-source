"""`ApiResponse.data` несёт любое значение контракта, `PaginatedResponse` типизирована.

Два места контракта требуют тела конверта, которые словарь не выражает:
`roo_code/roo-context/api/notifications.md` — счётчик непрочитанных едет
`ApiResponse<number>`, `roo_code/roo-context/api/audit-feed.md` — список авторов
ленты едет `ApiResponse<AuditFeedUser[]>`. Проверяем, что `data` переживает
сериализацию для объекта, массива, числа и отсутствия значения без потери типа,
и что `PaginatedResponse` — обобщённая модель: `items` проверяется типом
элемента, а не остаётся списком чего угодно.

    cd backend && python3 -m pytest tests/core/test_api_envelope.py -q
"""

import unittest

from pydantic import ValidationError

from app.core.schemas import ApiResponse, PaginatedResponse


class ApiResponseDataAcceptsAnyContractValueTests(unittest.TestCase):
    """`data` — объект, массив, число или отсутствие значения — без потери типа."""

    def test_object_survives(self):
        envelope = ApiResponse(data={"unreadCount": 3})
        self.assertEqual({"unreadCount": 3}, envelope.model_dump()["data"])

    def test_array_survives(self):
        authors = [{"id": "1", "name": "A"}, {"id": "2", "name": "B"}]
        envelope = ApiResponse(data=authors)
        dumped = envelope.model_dump()["data"]
        self.assertIsInstance(dumped, list)
        self.assertEqual(authors, dumped)

    def test_number_survives(self):
        envelope = ApiResponse(data=7)
        dumped = envelope.model_dump()["data"]
        self.assertIsInstance(dumped, int)
        self.assertEqual(7, dumped)

    def test_absent_value_survives(self):
        envelope = ApiResponse(data=None)
        self.assertIsNone(envelope.model_dump()["data"])

    def test_string_survives(self):
        envelope = ApiResponse(data="ok")
        self.assertEqual("ok", envelope.model_dump()["data"])

    def test_boolean_survives(self):
        envelope = ApiResponse(data=False)
        dumped = envelope.model_dump()["data"]
        self.assertIsInstance(dumped, bool)
        self.assertIs(False, dumped)


class PaginatedResponseIsGenericOverItemTypeTests(unittest.TestCase):
    """`items` проверяется типом строки, а не остаётся списком произвольных значений."""

    def test_accepts_items_of_declared_type(self):
        page = PaginatedResponse[str](
            items=["a", "b"], total=2, page=1, pageSize=2, totalPages=1
        )
        self.assertEqual(["a", "b"], page.items)

    def test_rejects_items_of_a_foreign_type(self):
        with self.assertRaises(ValidationError):
            PaginatedResponse[str](
                items=[{"id": "1"}], total=1, page=1, pageSize=1, totalPages=1
            )

    def test_carries_exactly_the_five_contract_fields(self):
        page = PaginatedResponse[str](
            items=["a"], total=1, page=1, pageSize=1, totalPages=1
        )
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"},
            set(page.model_dump().keys()),
        )


if __name__ == "__main__":
    unittest.main()
