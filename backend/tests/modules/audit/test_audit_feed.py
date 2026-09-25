"""Behaviour of `GET /api/audit-feed` and `GET /api/audit-feed/users`.

No database anywhere in this file, by the same design as
`tests/modules/finance/test_finance_payments.py`: `FakeSession` never opens a
connection or an engine. Instead it walks the *real* `sqlalchemy.select(...)`
statement that `repository.py` builds — the same `WHERE`/`ORDER BY` clauses a
real engine would receive — and evaluates it against a fixed table of
transient `AuditEntry` ORM objects (instantiated directly, never flushed). A
mutation that drops the `tenant_id` filter or breaks the `timestamp DESC, id
ASC` tie-break changes what the *real* statement says, and this fake
evaluates that real statement — so the tests below redden on those mutations
rather than on a hand-picked expectation.

    cd backend && python3 -m pytest tests/modules/audit/test_audit_feed.py -q
"""

from __future__ import annotations

import operator as py_operator
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy.sql import operators as sa_operators

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/audit-feed-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.core.exceptions import AppError, ValidationError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.audit.features.feed.action import router as audit_feed_router
    from app.modules.audit.features.feed.domain import (
        get_audit_feed,
        get_audit_feed_users,
    )
    from app.modules.audit.features.feed.repository import (
        list_feed_authors,
        list_feed_entries,
    )
    from app.modules.audit.shared.models import AuditEntry


# ── ORM-like fixtures — transient model instances, never flushed ───────────────────


def make_entry(**overrides) -> AuditEntry:
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "entity_type": "product",
        "entity_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "user_name_translations": {"ru": "Иван Иванов", "en": "Ivan Ivanov", "lt": "Ivanas"},
        "user_initials": "II",
        "property_translations": {"ru": "Цена", "en": "Price", "lt": "Kaina"},
        "old_value": "10",
        "new_value": "20",
        "sensitive": None,
        "timestamp": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return AuditEntry(**values)


# ── Fake session — evaluates the real statement, touches no database ───────────────


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return self

    def all(self):
        return self._rows


def _eval_clause(clause, row) -> bool:
    name = type(clause).__name__
    if name == "Grouping":
        return _eval_clause(clause.element, row)
    if name == "BooleanClauseList":
        parts = [_eval_clause(c, row) for c in clause.clauses]
        return any(parts) if clause.operator is py_operator.or_ else all(parts)
    if name == "BinaryExpression":
        value = getattr(row, clause.left.name)
        right = clause.right.value
        if clause.operator is py_operator.eq:
            return value == right
        if clause.operator is py_operator.ge:
            return value >= right
        if clause.operator is py_operator.lt:
            return value < right
        raise AssertionError(f"fake session cannot evaluate operator {clause.operator!r}")
    raise AssertionError(f"fake session cannot evaluate clause type {name!r}")


def _order_spec(stmt):
    spec = []
    clause = getattr(stmt, "_order_by_clause", None)
    for unary in (clause.clauses if clause is not None else []):
        spec.append((unary.element.name, unary.modifier is sa_operators.desc_op))
    return spec


class FakeSession:
    """A fixed table of ORM-like rows; `execute()` interprets the real statement."""

    def __init__(self, rows):
        self.rows = list(rows)

    async def execute(self, stmt):
        where = stmt.whereclause
        matching = [row for row in self.rows if where is None or _eval_clause(where, row)]
        for name, reverse in reversed(_order_spec(stmt)):
            matching.sort(key=lambda r, name=name: getattr(r, name), reverse=reverse)
        return _FakeResult(matching)


TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()


# ── Repository — tenant scoping, date range, ordering ───────────────────────────────


class FeedEntriesRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_foreign_tenants_entry_is_absent_from_the_feed(self):
        mine = make_entry(tenant_id=TENANT_A)
        foreign = make_entry(tenant_id=TENANT_B)
        session = FakeSession([mine, foreign])

        entries = await list_feed_entries(session, TENANT_A)

        self.assertEqual([mine.id], [e.id for e in entries])

    async def test_entity_type_filter_narrows_the_feed(self):
        product = make_entry(tenant_id=TENANT_A, entity_type="product")
        order = make_entry(tenant_id=TENANT_A, entity_type="order")
        session = FakeSession([product, order])

        entries = await list_feed_entries(session, TENANT_A, entity_type="order")

        self.assertEqual([order.id], [e.id for e in entries])

    async def test_date_range_is_inclusive_of_both_edges(self):
        before = make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 1, 4, tzinfo=timezone.utc))
        on_from_edge = make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 1, 5, tzinfo=timezone.utc))
        on_to_edge = make_entry(
            tenant_id=TENANT_A, timestamp=datetime(2026, 1, 7, 23, 59, tzinfo=timezone.utc)
        )
        after = make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 1, 8, tzinfo=timezone.utc))
        session = FakeSession([before, on_from_edge, on_to_edge, after])

        entries = await list_feed_entries(
            session,
            TENANT_A,
            date_from=datetime(2026, 1, 5, tzinfo=timezone.utc),
            date_to_exclusive=datetime(2026, 1, 8, tzinfo=timezone.utc),
        )

        self.assertEqual({on_from_edge.id, on_to_edge.id}, {e.id for e in entries})


class FeedOrderingTieBreakTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop `AuditEntry.id.asc()` from `list_feed_entries`'s `order_by`."""

    async def test_newest_timestamp_comes_first(self):
        older = make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc))
        newer = make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 6, 1, tzinfo=timezone.utc))
        session = FakeSession([older, newer])

        entries = await list_feed_entries(session, TENANT_A)

        self.assertEqual([newer.id, older.id], [e.id for e in entries])

    async def test_equal_timestamps_break_the_tie_by_id_ascending_and_stay_stable(self):
        same_moment = datetime(2026, 3, 1, tzinfo=timezone.utc)
        low_id, high_id = sorted([uuid.uuid4(), uuid.uuid4()])
        first = make_entry(tenant_id=TENANT_A, id=low_id, timestamp=same_moment)
        second = make_entry(tenant_id=TENANT_A, id=high_id, timestamp=same_moment)
        # Passed in an order that does not already match id-ascending, so a
        # missing tie-break would leak table order through instead.
        session = FakeSession([second, first])

        run_one = await list_feed_entries(session, TENANT_A)
        run_two = await list_feed_entries(session, TENANT_A)

        self.assertEqual([low_id, high_id], [e.id for e in run_one])
        self.assertEqual([e.id for e in run_one], [e.id for e in run_two])


class FeedUsersRepositoryTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop `AuditEntry.tenant_id == tenant_id` from `list_feed_authors`."""

    async def test_a_foreign_tenants_entry_is_absent_from_the_author_source(self):
        mine = make_entry(tenant_id=TENANT_A, user_name_translations={"en": "Mine"})
        foreign = make_entry(tenant_id=TENANT_B, user_name_translations={"en": "Foreign"})
        session = FakeSession([mine, foreign])

        entries = await list_feed_authors(session, TENANT_A)

        self.assertEqual([mine.id], [e.id for e in entries])


# ── Domain — normalization, validation, row shape, pagination ──────────────────────


class FeedFilterNormalizationTests(unittest.IsolatedAsyncioTestCase):
    async def test_page_beyond_the_end_is_clamped_to_the_last_page(self):
        """Страница за пределом возвращает ПОСЛЕДНЮЮ, а не эхо запрошенного номера.

        Без верхнего зажима сервер отдаёт пустые `items` и тот номер, что прислали, —
        то есть подтверждает существование страницы, которой нет. Клиентский
        `skipNextPageWatch` построен на том, что номер в ответе настоящий, и против
        живого бэкенда без зажима он мёртв.
        """
        entries = [make_entry(tenant_id=TENANT_A, entity_type="product") for _ in range(3)]
        session = FakeSession(entries)

        far = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=99, page_size=2,
        )

        self.assertEqual(2, far.totalPages)
        self.assertEqual(2, far.page, "номер страницы обязан быть зажат сверху")
        self.assertEqual(1, len(far.items), "последняя страница трёх записей по две — одна")
        self.assertEqual(3, far.total)

    async def test_blank_entity_type_user_and_search_mean_no_filter(self):
        a = make_entry(tenant_id=TENANT_A, entity_type="product", user_name_translations={"en": "A"})
        b = make_entry(tenant_id=TENANT_A, entity_type="order", user_name_translations={"en": "B"})
        session = FakeSession([a, b])

        blank = await get_audit_feed(
            session, TENANT_A, entity_type="", user_key="", date_from=None,
            date_to=None, search="", page=1, page_size=25,
        )
        absent = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=1, page_size=25,
        )

        self.assertEqual(
            [row.entryId for row in absent.items], [row.entryId for row in blank.items]
        )
        self.assertEqual(2, blank.total)

    async def test_unknown_entity_type_is_a_validation_error_not_an_empty_page(self):
        session = FakeSession([make_entry(tenant_id=TENANT_A)])

        with self.assertRaises(ValidationError):
            await get_audit_feed(
                session, TENANT_A, entity_type="not-a-real-type", user_key=None,
                date_from=None, date_to=None, search=None, page=1, page_size=25,
            )

    async def test_search_matches_property_translations_and_both_values(self):
        by_property = make_entry(
            tenant_id=TENANT_A, property_translations={"ru": "", "en": "Special Price", "lt": ""}
        )
        by_old_value = make_entry(tenant_id=TENANT_A, old_value="unique-old-marker")
        by_new_value = make_entry(tenant_id=TENANT_A, new_value="unique-new-marker")
        unrelated = make_entry(tenant_id=TENANT_A)
        session = FakeSession([by_property, by_old_value, by_new_value, unrelated])

        for needle, expected in (
            ("special price", str(by_property.id)),
            ("unique-old-marker", str(by_old_value.id)),
            ("unique-new-marker", str(by_new_value.id)),
        ):
            with self.subTest(needle=needle):
                result = await get_audit_feed(
                    session, TENANT_A, entity_type=None, user_key=None, date_from=None,
                    date_to=None, search=needle, page=1, page_size=25,
                )
                self.assertEqual([expected], [row.entryId for row in result.items])

    async def test_user_filter_matches_the_en_name_key(self):
        target = make_entry(tenant_id=TENANT_A, user_name_translations={"en": "Target User"})
        other = make_entry(tenant_id=TENANT_A, user_name_translations={"en": "Other User"})
        session = FakeSession([target, other])

        result = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key="Target User", date_from=None,
            date_to=None, search=None, page=1, page_size=25,
        )

        self.assertEqual([str(target.id)], [row.entryId for row in result.items])


class FeedRowShapeTests(unittest.IsolatedAsyncioTestCase):
    async def test_row_carries_exactly_the_ten_contract_fields(self):
        session = FakeSession([make_entry(tenant_id=TENANT_A)])

        result = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=1, page_size=25,
        )

        self.assertEqual(
            {
                "entityType", "entityId", "entityLabel", "entryId", "timestamp",
                "user", "userInitials", "property", "oldValue", "newValue",
            },
            set(result.items[0].model_dump().keys()),
        )

    async def test_envelope_carries_exactly_the_five_pagination_keys(self):
        session = FakeSession([make_entry(tenant_id=TENANT_A)])

        result = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=1, page_size=25,
        )

        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"},
            set(result.model_dump().keys()),
        )


class FeedPaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_page_size_is_executed_as_sent_no_server_ceiling(self):
        entries = [
            make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc) - timedelta(days=i))
            for i in range(5)
        ]
        session = FakeSession(entries)

        result = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=1, page_size=1000,
        )

        self.assertEqual(1000, result.pageSize)
        self.assertEqual(5, len(result.items))

    async def test_page_two_continues_page_one_without_overlap(self):
        entries = [
            make_entry(tenant_id=TENANT_A, timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc) - timedelta(days=i))
            for i in range(5)
        ]
        session = FakeSession(entries)

        page_one = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=1, page_size=2,
        )
        page_two = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=None, date_from=None,
            date_to=None, search=None, page=2, page_size=2,
        )

        self.assertEqual(2, len(page_one.items))
        self.assertEqual(2, len(page_two.items))
        self.assertFalse(
            {r.entryId for r in page_one.items} & {r.entryId for r in page_two.items}
        )


# ── Domain — the author filter (GET /api/audit-feed/users) ─────────────────────────


class FeedUsersDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_foreign_tenants_author_is_absent(self):
        mine = make_entry(tenant_id=TENANT_A, user_name_translations={"en": "Mine"})
        foreign = make_entry(tenant_id=TENANT_B, user_name_translations={"en": "Foreign"})
        session = FakeSession([mine, foreign])

        users = await get_audit_feed_users(session, TENANT_A)

        self.assertEqual(["Mine"], [u.key for u in users])

    async def test_authors_are_deduplicated_by_key_and_sorted_by_key(self):
        first_seen = make_entry(
            tenant_id=TENANT_A,
            user_name_translations={"en": "Zed", "ru": "old-spelling"},
            user_initials="ZZ",
            timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        second_seen_same_key = make_entry(
            tenant_id=TENANT_A,
            user_name_translations={"en": "Zed", "ru": "new-spelling"},
            user_initials="QQ",
            timestamp=datetime(2026, 2, 1, tzinfo=timezone.utc),
        )
        alphabetically_first = make_entry(
            tenant_id=TENANT_A,
            user_name_translations={"en": "Anna"},
            timestamp=datetime(2026, 1, 15, tzinfo=timezone.utc),
        )
        session = FakeSession([second_seen_same_key, first_seen, alphabetically_first])

        users = await get_audit_feed_users(session, TENANT_A)

        self.assertEqual(["Anna", "Zed"], [u.key for u in users])
        zed = next(u for u in users if u.key == "Zed")
        self.assertEqual("ZZ", zed.initials)

    async def test_users_list_is_independent_of_any_feed_filter(self):
        product_author = make_entry(
            tenant_id=TENANT_A, entity_type="product", user_name_translations={"en": "Product Person"}
        )
        order_author = make_entry(
            tenant_id=TENANT_A, entity_type="order", user_name_translations={"en": "Order Person"}
        )
        session = FakeSession([product_author, order_author])

        feed = await get_audit_feed(
            session, TENANT_A, entity_type="product", user_key=None, date_from=None,
            date_to=None, search=None, page=1, page_size=25,
        )
        users = await get_audit_feed_users(session, TENANT_A)

        self.assertEqual(["Product Person"], [row.user.en for row in feed.items])
        self.assertEqual({"Order Person", "Product Person"}, {u.key for u in users})

    async def test_a_users_key_fed_back_into_the_feed_filter_is_not_empty(self):
        entry = make_entry(tenant_id=TENANT_A, user_name_translations={"en": "Round Trip"})
        session = FakeSession([entry])

        users = await get_audit_feed_users(session, TENANT_A)
        result = await get_audit_feed(
            session, TENANT_A, entity_type=None, user_key=users[0].key, date_from=None,
            date_to=None, search=None, page=1, page_size=25,
        )

        self.assertGreater(len(result.items), 0)


# ── Action — auth, tenant scoping over HTTP, envelope, refusal status ──────────────


def _db_override(session):
    async def _get_db():
        yield session

    return _get_db


def _user_override(tenant_id):
    async def _get_current_user():
        return CurrentUser(user_id=uuid.uuid4(), tenant_id=tenant_id, user=None)

    return _get_current_user


class AuditFeedHttpTests(unittest.IsolatedAsyncioTestCase):
    """Real routing and dependency wiring, a fake session standing in for the DB."""

    def _build_app(self, session, *, tenant_id=TENANT_A, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(audit_feed_router)
        app.dependency_overrides[get_db] = _db_override(session)
        if authenticated:
            app.dependency_overrides[get_current_user] = _user_override(tenant_id)
        return app

    async def _client(self, app):
        client = AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(client.aclose)
        return client

    async def test_missing_authorization_is_refused(self):
        app = self._build_app(FakeSession([]), authenticated=False)
        client = await self._client(app)

        response = await client.get("/api/audit-feed")

        self.assertEqual(401, response.status_code, response.text)

    async def test_authenticated_request_returns_the_envelope(self):
        session = FakeSession([make_entry(tenant_id=TENANT_A)])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/audit-feed")

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["success"])
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )

    async def test_unknown_entity_type_is_422_validation_error(self):
        app = self._build_app(FakeSession([make_entry(tenant_id=TENANT_A)]))
        client = await self._client(app)

        response = await client.get("/api/audit-feed", params={"entityType": "bogus"})

        self.assertEqual(422, response.status_code, response.text)
        self.assertEqual("VALIDATION_ERROR", response.json()["detail"]["code"])

    async def test_a_foreign_tenants_entries_are_invisible_over_http(self):
        foreign = make_entry(tenant_id=TENANT_B)
        session = FakeSession([foreign])
        app = self._build_app(session, tenant_id=TENANT_A)
        client = await self._client(app)

        feed_response = await client.get("/api/audit-feed")
        users_response = await client.get("/api/audit-feed/users")

        self.assertEqual([], feed_response.json()["data"]["items"])
        self.assertEqual([], users_response.json()["data"])

    async def test_users_endpoint_returns_a_list_envelope(self):
        session = FakeSession([make_entry(tenant_id=TENANT_A, user_name_translations={"en": "Someone"})])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/audit-feed/users")

        self.assertEqual(200, response.status_code, response.text)
        data = response.json()["data"]
        self.assertEqual(["Someone"], [item["key"] for item in data])


if __name__ == "__main__":
    unittest.main()
