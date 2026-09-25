"""Behaviour of the four `notifications.feed` endpoints.

No database anywhere in this file, by design of the task: `FakeSession` never opens a
connection or an engine. Instead it walks the *real* `sqlalchemy.select(...)` /
`update(...)` statements that `repository.py` builds — the same `WHERE`/`ORDER BY`/
`LIMIT` clauses a real engine would receive — and evaluates them against a fixed table
of transient `Notification` ORM objects (built the same way `make_payment()` builds a
`FinancePayment` row in `tests/modules/finance/test_finance_payments.py`: instantiated
directly, never flushed). A mutation that drops the `tenant_id` or `user_id` filter,
widens the page-size cap, or breaks the `created_at DESC, id ASC` tie-break changes what
the *real* statement says, and this fake evaluates that real statement — so the tests
below redden on those mutations rather than on a hand-picked expectation.

    cd backend && python3 -m pytest tests/modules/notifications/test_notifications_feed.py -q
"""

from __future__ import annotations

import operator as py_operator
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from sqlalchemy.sql import operators as sa_operators
from sqlalchemy.sql.dml import Update

with patch.dict(
    os.environ,
    {"DATABASE_URL": "sqlite+aiosqlite:////tmp/notifications-feed-unused.sqlite"},
):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.database import get_db
    from app.core.exceptions import AppError, NotFoundError
    from app.main import app_error_handler
    from app.modules.auth.internal_api.interface import CurrentUser, get_current_user
    from app.modules.notifications.features.feed.action import router as notifications_router
    from app.modules.notifications.features.feed.domain import (
        ENTITY_ROUTE_NAMES,
        MAX_PAGE_SIZE,
        get_unread_count,
        list_notifications,
        mark_all_read,
        mark_notification_read,
    )
    from app.modules.notifications.features.feed.repository import (
        count_notifications,
        count_unread,
        get_notification_by_id,
    )
    from app.modules.notifications.features.feed.repository import (
        list_notifications as list_notifications_repo,
    )
    from app.modules.notifications.features.feed.repository import (
        mark_all_read as mark_all_read_repo,
    )
    from app.modules.notifications.shared.models import Notification


# ── ORM-like fixtures — transient model instances, never flushed ───────────────────


def make_notification(**overrides) -> Notification:
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "type": "order_status",
        "title_translations": {"ru": "Заказ обновлён", "en": "Order updated", "lt": "Užsakymas atnaujintas"},
        "message_translations": {"ru": "Текст сообщения", "en": "Message text", "lt": "Pranešimo tekstas"},
        "entity_type": "order",
        "entity_id": "ORD-001",
        "is_read": False,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    values.update(overrides)
    return Notification(**values)


# ── Fake session — evaluates the real statement, touches no database ───────────────


class _FakeResult:
    def __init__(self, *, scalar_value=None, rows=None):
        self._scalar_value = scalar_value
        self._rows = rows if rows is not None else []

    def scalar(self):
        return self._scalar_value

    def scalar_one_or_none(self):
        if len(self._rows) > 1:
            raise AssertionError("fake table returned more than one row for a by-id query")
        return self._rows[0] if self._rows else None

    def scalars(self):
        return self

    def all(self):
        return self._rows


def _bool_literal(node):
    """`sqlalchemy.False_`/`True_` singletons carry no `.value` — read the type name."""
    name = type(node).__name__
    if name == "False_":
        return False
    if name == "True_":
        return True
    return None


def _eval_clause(clause, row) -> bool:
    name = type(clause).__name__
    if name == "Grouping":
        return _eval_clause(clause.element, row)
    if name == "BooleanClauseList":
        parts = [_eval_clause(c, row) for c in clause.clauses]
        return any(parts) if clause.operator is py_operator.or_ else all(parts)
    if name == "BinaryExpression":
        if clause.operator is py_operator.eq:
            literal = _bool_literal(clause.right)
            value = getattr(row, clause.left.name)
            return value == (literal if literal is not None else clause.right.value)
        if clause.operator is sa_operators.ilike_op:
            # Plain column ilike (unused today, kept for parity with finance's fake),
            # or a JSONB `col[key].astext.ilike(...)` — the left side is then itself
            # a BinaryExpression: `col ->> :key`.
            if type(clause.left).__name__ == "BinaryExpression":
                column_name = clause.left.left.name
                locale = clause.left.right.value
                value = (getattr(row, column_name) or {}).get(locale, "")
            else:
                value = getattr(row, clause.left.name)
            if value is None:
                return False
            needle = str(clause.right.value).strip("%").lower()
            return needle in str(value).lower()
        raise AssertionError(f"fake session cannot evaluate operator {clause.operator!r}")
    raise AssertionError(f"fake session cannot evaluate clause type {name!r}")


def _effective_whereclause(stmt):
    if stmt.whereclause is not None:
        return stmt.whereclause
    froms = stmt.get_final_froms()
    if froms and hasattr(froms[0], "element"):
        return froms[0].element.whereclause
    return None


def _is_count_statement(stmt) -> bool:
    columns = list(stmt.selected_columns)
    return len(columns) == 1 and str(columns[0]) == "count(*)"


def _order_spec(stmt):
    spec = []
    clause = getattr(stmt, "_order_by_clause", None)
    for unary in clause.clauses if clause is not None else []:
        spec.append((unary.element.name, unary.modifier is sa_operators.desc_op))
    return spec


def _update_values(stmt) -> dict:
    return {column.name: bind.value for column, bind in stmt._values.items()}


class FakeSession:
    """A fixed table of ORM-like rows; `execute()` interprets the real statement."""

    def __init__(self, rows):
        self.rows = list(rows)
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)
        where = _effective_whereclause(stmt)
        matching = [row for row in self.rows if where is None or _eval_clause(where, row)]

        if isinstance(stmt, Update):
            values = _update_values(stmt)
            for row in matching:
                for key, value in values.items():
                    setattr(row, key, value)
            return _FakeResult(rows=matching)

        if _is_count_statement(stmt):
            return _FakeResult(scalar_value=len(matching))

        for name, reverse in reversed(_order_spec(stmt)):
            matching.sort(key=lambda r, name=name: getattr(r, name), reverse=reverse)

        if stmt._limit is not None or stmt._offset:
            offset = stmt._offset or 0
            limit = stmt._limit
            matching = matching[offset : offset + limit] if limit is not None else matching[offset:]

        return _FakeResult(rows=matching)

    async def commit(self):
        pass

    async def flush(self):
        # Слайс границу транзакции не держит — он делает `flush`, а коммитит `get_db`
        # (сторож `tests/test_transaction_boundary.py`). Заглушка обязана знать оба.
        pass

    async def refresh(self, obj):
        pass


TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()
USER_1 = uuid.uuid4()
USER_2 = uuid.uuid4()


# ── Repository — tenant + user scoping, search, ordering, pagination ───────────────


class ListNotificationsScopingTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target (acceptance criterion 7): drop `Notification.user_id ==
    user_id` from `_filtered_query`, keeping only the tenant filter. That mutation
    must redden `test_a_different_users_notification_in_the_same_tenant_is_absent`."""

    async def test_a_foreign_tenants_notification_is_absent_from_the_list(self):
        mine = make_notification(tenant_id=TENANT_A, user_id=USER_1)
        foreign = make_notification(tenant_id=TENANT_B, user_id=USER_2)
        session = FakeSession([mine, foreign])

        items = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([mine.id], [item.id for item in items])

    async def test_a_different_users_notification_in_the_same_tenant_is_absent(self):
        mine = make_notification(tenant_id=TENANT_A, user_id=USER_1)
        colleagues = make_notification(tenant_id=TENANT_A, user_id=USER_2)
        session = FakeSession([mine, colleagues])

        items = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([mine.id], [item.id for item in items])

    async def test_count_is_scoped_to_tenant_and_user_too(self):
        session = FakeSession(
            [
                make_notification(tenant_id=TENANT_A, user_id=USER_1),
                make_notification(tenant_id=TENANT_A, user_id=USER_2),
                make_notification(tenant_id=TENANT_B, user_id=USER_1),
            ]
        )

        total = await count_notifications(session, TENANT_A, USER_1)

        self.assertEqual(1, total)


class GetNotificationByIdScopingTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_foreign_tenants_notification_reads_as_absent(self):
        foreign = make_notification(tenant_id=TENANT_B, user_id=USER_1)
        session = FakeSession([foreign])

        result = await get_notification_by_id(session, foreign.id, TENANT_A, USER_1)

        self.assertIsNone(result)

    async def test_a_colleagues_notification_reads_as_absent(self):
        colleague = make_notification(tenant_id=TENANT_A, user_id=USER_2)
        session = FakeSession([colleague])

        result = await get_notification_by_id(session, colleague.id, TENANT_A, USER_1)

        self.assertIsNone(result)

    async def test_the_callers_own_notification_is_found(self):
        mine = make_notification(tenant_id=TENANT_A, user_id=USER_1)
        session = FakeSession([mine])

        result = await get_notification_by_id(session, mine.id, TENANT_A, USER_1)

        self.assertEqual(mine.id, result.id)

    async def test_an_unknown_id_reads_as_absent(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])

        result = await get_notification_by_id(session, uuid.uuid4(), TENANT_A, USER_1)

        self.assertIsNone(result)


class SearchAcrossSixKeysTests(unittest.IsolatedAsyncioTestCase):
    async def _assert_matches(self, field: str, locale: str, needle: str):
        translations = {"ru": "неважно", "en": "irrelevant", "lt": "nesvarbu"}
        translations[locale] = "Baltic Steel Order"
        target = make_notification(tenant_id=TENANT_A, user_id=USER_1, **{field: translations})
        other = make_notification(tenant_id=TENANT_A, user_id=USER_1)
        session = FakeSession([target, other])

        items = await list_notifications_repo(session, TENANT_A, USER_1, search=needle)

        self.assertEqual([target.id], [item.id for item in items])

    async def test_matches_title_ru(self):
        await self._assert_matches("title_translations", "ru", "baltic steel")

    async def test_matches_title_en(self):
        await self._assert_matches("title_translations", "en", "BALTIC STEEL")

    async def test_matches_title_lt(self):
        await self._assert_matches("title_translations", "lt", "Baltic")

    async def test_matches_message_ru(self):
        await self._assert_matches("message_translations", "ru", "baltic steel")

    async def test_matches_message_en(self):
        await self._assert_matches("message_translations", "en", "steel order")

    async def test_matches_message_lt(self):
        await self._assert_matches("message_translations", "lt", "STEEL")

    async def test_a_notification_with_no_matching_key_is_excluded(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])

        items = await list_notifications_repo(
            session, TENANT_A, USER_1, search="does-not-match-anything"
        )

        self.assertEqual([], items)

    async def test_missing_locale_key_does_not_crash_the_search(self):
        sparse = make_notification(
            tenant_id=TENANT_A, user_id=USER_1, title_translations={"en": "Only English"}
        )
        session = FakeSession([sparse])

        items = await list_notifications_repo(session, TENANT_A, USER_1, search="only english")

        self.assertEqual([sparse.id], [item.id for item in items])


class TypeAndReadFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_given_type_narrows_the_list(self):
        status = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="order_status")
        deficit = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="stock_deficit")
        session = FakeSession([status, deficit])

        items = await list_notifications_repo(session, TENANT_A, USER_1, type_="stock_deficit")

        self.assertEqual([deficit.id], [item.id for item in items])

    async def test_no_type_returns_every_type(self):
        status = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="order_status")
        deficit = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="stock_deficit")
        session = FakeSession([status, deficit])

        items = await list_notifications_repo(session, TENANT_A, USER_1, type_=None)

        self.assertEqual({status.id, deficit.id}, {item.id for item in items})

    async def test_is_read_true_returns_only_read(self):
        read = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=True)
        unread = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        session = FakeSession([read, unread])

        items = await list_notifications_repo(session, TENANT_A, USER_1, is_read=True)

        self.assertEqual([read.id], [item.id for item in items])

    async def test_is_read_false_returns_only_unread(self):
        read = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=True)
        unread = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        session = FakeSession([read, unread])

        items = await list_notifications_repo(session, TENANT_A, USER_1, is_read=False)

        self.assertEqual([unread.id], [item.id for item in items])

    async def test_is_read_absent_returns_both(self):
        read = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=True)
        unread = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        session = FakeSession([read, unread])

        items = await list_notifications_repo(session, TENANT_A, USER_1, is_read=None)

        self.assertEqual({read.id, unread.id}, {item.id for item in items})


class OrderingTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop the `Notification.id.asc()` tie-break."""

    async def test_newest_created_at_comes_first_by_default(self):
        older = make_notification(
            tenant_id=TENANT_A, user_id=USER_1, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)
        )
        newer = make_notification(
            tenant_id=TENANT_A, user_id=USER_1, created_at=datetime(2026, 6, 1, tzinfo=timezone.utc)
        )
        session = FakeSession([older, newer])

        items = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([newer.id, older.id], [item.id for item in items])

    async def test_equal_created_at_breaks_the_tie_by_id_ascending_and_stays_stable(self):
        same_moment = datetime(2026, 3, 1, tzinfo=timezone.utc)
        low_id, high_id = sorted([uuid.uuid4(), uuid.uuid4()])
        first = make_notification(tenant_id=TENANT_A, user_id=USER_1, id=low_id, created_at=same_moment)
        second = make_notification(tenant_id=TENANT_A, user_id=USER_1, id=high_id, created_at=same_moment)
        session = FakeSession([second, first])

        run_one = await list_notifications_repo(session, TENANT_A, USER_1)
        run_two = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([low_id, high_id], [item.id for item in run_one])
        self.assertEqual([item.id for item in run_one], [item.id for item in run_two])

    async def test_sort_by_type_is_accepted(self):
        b_type = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="stock_deficit")
        a_type = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="batch_received")
        session = FakeSession([b_type, a_type])

        items = await list_notifications_repo(session, TENANT_A, USER_1, sort_by="type", sort_dir="asc")

        self.assertEqual([a_type.id, b_type.id], [item.id for item in items])


class PaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_page_two_skips_the_first_page(self):
        rows = [
            make_notification(
                tenant_id=TENANT_A,
                user_id=USER_1,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc) - timedelta(days=i),
            )
            for i in range(5)
        ]
        session = FakeSession(rows)

        page_one = await list_notifications_repo(session, TENANT_A, USER_1, page=1, page_size=2)
        page_two = await list_notifications_repo(session, TENANT_A, USER_1, page=2, page_size=2)

        self.assertEqual(2, len(page_one))
        self.assertEqual(2, len(page_two))
        self.assertFalse({r.id for r in page_one} & {r.id for r in page_two})


class UnreadCountRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_counts_only_unread_scoped_to_tenant_and_user(self):
        session = FakeSession(
            [
                make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False),
                make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=True),
                make_notification(tenant_id=TENANT_A, user_id=USER_2, is_read=False),
                make_notification(tenant_id=TENANT_B, user_id=USER_1, is_read=False),
            ]
        )

        total = await count_unread(session, TENANT_A, USER_1)

        self.assertEqual(1, total)


class MarkAllReadRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_updates_only_the_callers_own_rows(self):
        mine_unread = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        colleagues_unread = make_notification(tenant_id=TENANT_A, user_id=USER_2, is_read=False)
        session = FakeSession([mine_unread, colleagues_unread])

        await mark_all_read_repo(session, TENANT_A, USER_1)

        self.assertTrue(mine_unread.is_read)
        self.assertFalse(colleagues_unread.is_read)

    async def test_is_a_single_update_statement(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])

        await mark_all_read_repo(session, TENANT_A, USER_1)

        self.assertEqual(1, len(session.statements))
        self.assertIsInstance(session.statements[0], Update)


# ── Domain — defaults, cap, entityRouteName mapping, refusal ───────────────────────


class ListNotificationsDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_defaults_are_page_one_and_page_size_twenty_five(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read=None, sort_by=None, sort_dir=None,
            page=1, page_size=25,
        )

        self.assertEqual(1, result.page)
        self.assertEqual(25, result.pageSize)

    async def test_page_size_is_capped_at_one_hundred(self):
        """Mutation target: remove `min(page_size, MAX_PAGE_SIZE)` in
        `domain.list_notifications`."""
        rows = [make_notification(tenant_id=TENANT_A, user_id=USER_1) for _ in range(150)]
        session = FakeSession(rows)

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read=None, sort_by=None, sort_dir=None,
            page=1, page_size=99999,
        )

        self.assertEqual(MAX_PAGE_SIZE, result.pageSize)
        self.assertLessEqual(len(result.items), MAX_PAGE_SIZE)

    async def test_empty_search_and_type_all_and_absent_is_read_mean_no_filter(self):
        status = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="order_status", is_read=True)
        deficit = make_notification(tenant_id=TENANT_A, user_id=USER_1, type="stock_deficit", is_read=False)
        session = FakeSession([status, deficit])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search="", type_="all", is_read=None, sort_by="createdAt", sort_dir="desc",
            page=1, page_size=25,
        )

        self.assertEqual({status.id, deficit.id}, {item.id for item in result.items})

    async def test_a_blank_is_read_string_also_means_no_filter(self):
        """The client always sends `isRead`, and blank means "all" the same as absent
        (`notificationsService.ts` sends `''` for the null tri-state)."""
        status = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=True)
        deficit = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        session = FakeSession([status, deficit])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read="", sort_by=None, sort_dir=None,
            page=1, page_size=25,
        )

        self.assertEqual({status.id, deficit.id}, {item.id for item in result.items})

    async def test_an_unknown_sort_by_falls_back_to_created_at(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read=None, sort_by="nonsense", sort_dir=None,
            page=1, page_size=25,
        )

        self.assertEqual(1, len(result.items))

    async def test_entity_route_name_is_derived_for_all_five_contract_pairs(self):
        pairs = {
            "order": "admin-order-card",
            "client": "admin-client-card",
            "supplier": "admin-supplier-card",
            "product": "admin-product-card",
            "batch": "admin-warehouse-batch",
        }
        self.assertEqual(pairs, ENTITY_ROUTE_NAMES)

        rows = [
            make_notification(tenant_id=TENANT_A, user_id=USER_1, entity_type=entity_type)
            for entity_type in pairs
        ]
        session = FakeSession(rows)

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read=None, sort_by=None, sort_dir=None,
            page=1, page_size=25,
        )

        by_entity_type = {item.entityType: item.entityRouteName for item in result.items}
        self.assertEqual(pairs, by_entity_type)

    async def test_list_item_carries_exactly_the_nine_contract_fields(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read=None, sort_by=None, sort_dir=None,
            page=1, page_size=25,
        )

        self.assertEqual(
            {
                "id", "type", "title", "message", "entityType", "entityId",
                "entityRouteName", "isRead", "createdAt",
            },
            set(result.items[0].model_dump().keys()),
        )


class UnreadCountDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_ignores_every_list_filter(self):
        """The count is global to the caller: it does not accept `search`/`type`/
        `isRead` at all, unlike `list_notifications` (contract, "Правила домена", п.8)."""
        session = FakeSession(
            [
                make_notification(tenant_id=TENANT_A, user_id=USER_1, type="order_status", is_read=False),
                make_notification(tenant_id=TENANT_A, user_id=USER_1, type="stock_deficit", is_read=False),
                make_notification(tenant_id=TENANT_A, user_id=USER_1, type="order_status", is_read=True),
            ]
        )

        total = await get_unread_count(session, TENANT_A, USER_1)

        self.assertEqual(2, total)


class MarkNotificationReadDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_an_unknown_id_raises_not_found_with_a_nonempty_code(self):
        session = FakeSession([])

        with self.assertRaises(NotFoundError) as ctx:
            await mark_notification_read(session, TENANT_A, USER_1, uuid.uuid4())

        self.assertTrue(ctx.exception.code)
        self.assertIsInstance(ctx.exception, AppError)

    async def test_a_foreign_tenants_notification_also_raises_not_found(self):
        foreign = make_notification(tenant_id=TENANT_B, user_id=USER_1)
        session = FakeSession([foreign])

        with self.assertRaises(NotFoundError):
            await mark_notification_read(session, TENANT_A, USER_1, foreign.id)

    async def test_a_colleagues_notification_also_raises_not_found_and_stays_unread(self):
        colleagues = make_notification(tenant_id=TENANT_A, user_id=USER_2, is_read=False)
        session = FakeSession([colleagues])

        with self.assertRaises(NotFoundError):
            await mark_notification_read(session, TENANT_A, USER_1, colleagues.id)

        self.assertFalse(colleagues.is_read)

    async def test_the_callers_own_notification_becomes_read(self):
        mine = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        session = FakeSession([mine])

        result = await mark_notification_read(session, TENANT_A, USER_1, mine.id)

        self.assertTrue(result.isRead)
        self.assertTrue(mine.is_read)


class MarkAllReadDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_marks_only_the_callers_own_rows(self):
        mine = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        colleagues = make_notification(tenant_id=TENANT_A, user_id=USER_2, is_read=False)
        session = FakeSession([mine, colleagues])

        await mark_all_read(session, TENANT_A, USER_1)

        self.assertTrue(mine.is_read)
        self.assertFalse(colleagues.is_read)


# ── Action — auth, tenant+user scoping over HTTP, envelope, route order ────────────


def _db_override(session):
    async def _get_db():
        # Повторяет настоящий `get_db`: он держит границу транзакции и коммитит в конце
        # запроса. Слайс сам не коммитит (сторож `test_transaction_boundary.py`), поэтому
        # заглушка обязана делать это за него — иначе тест проверяет не поведение, а то,
        # что запись не долетела.
        yield session
        await session.commit()

    return _get_db


def _user_override(tenant_id, user_id):
    async def _get_current_user():
        return CurrentUser(user_id=user_id, tenant_id=tenant_id, user=None)

    return _get_current_user


class NotificationsHttpTests(unittest.IsolatedAsyncioTestCase):
    """Real routing and dependency wiring, a fake session standing in for the DB."""

    def _build_app(self, session, *, tenant_id=TENANT_A, user_id=USER_1, authenticated=True):
        app = FastAPI()
        app.add_exception_handler(AppError, app_error_handler)
        app.include_router(notifications_router)
        app.dependency_overrides[get_db] = _db_override(session)
        if authenticated:
            app.dependency_overrides[get_current_user] = _user_override(tenant_id, user_id)
        return app

    async def _client(self, app):
        client = AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        )
        self.addAsyncCleanup(client.aclose)
        return client

    async def test_missing_authorization_is_refused_on_every_route(self):
        app = self._build_app(FakeSession([]), authenticated=False)
        client = await self._client(app)

        list_response = await client.get("/api/notifications")
        count_response = await client.get("/api/notifications/unread-count")
        read_all_response = await client.patch("/api/notifications/read-all")
        read_one_response = await client.patch(f"/api/notifications/{uuid.uuid4()}/read")

        for response in (list_response, count_response, read_all_response, read_one_response):
            self.assertEqual(401, response.status_code, response.text)

    async def test_list_envelope_carries_pagination_keys(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A, user_id=USER_1)])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/notifications")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(1, payload["total"])

    async def test_a_colleagues_notification_is_invisible_in_list_and_count_over_http(self):
        colleagues = make_notification(tenant_id=TENANT_A, user_id=USER_2)
        session = FakeSession([colleagues])
        app = self._build_app(session, tenant_id=TENANT_A, user_id=USER_1)
        client = await self._client(app)

        list_response = await client.get("/api/notifications")
        count_response = await client.get("/api/notifications/unread-count")

        self.assertEqual([], list_response.json()["data"]["items"])
        self.assertEqual(0, count_response.json()["data"])

    async def test_unread_count_response_is_a_bare_number_in_the_envelope(self):
        session = FakeSession(
            [make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)]
        )
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/notifications/unread-count")

        self.assertEqual(200, response.status_code, response.text)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertEqual(1, body["data"])

    async def test_unread_count_ignores_list_query_filters(self):
        session = FakeSession(
            [
                make_notification(tenant_id=TENANT_A, user_id=USER_1, type="order_status", is_read=False),
                make_notification(tenant_id=TENANT_A, user_id=USER_1, type="stock_deficit", is_read=False),
            ]
        )
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get(
            "/api/notifications/unread-count",
            params={"type": "order_status", "isRead": "true", "search": "no-match"},
        )

        self.assertEqual(2, response.json()["data"])

    async def test_mark_one_read_on_an_unknown_id_is_404_with_a_nonempty_code(self):
        app = self._build_app(FakeSession([]))
        client = await self._client(app)

        response = await client.patch(f"/api/notifications/{uuid.uuid4()}/read")

        self.assertEqual(404, response.status_code, response.text)
        self.assertTrue(response.json()["detail"]["code"])

    async def test_mark_one_read_on_a_colleagues_id_is_404_and_leaves_it_unread(self):
        colleagues = make_notification(tenant_id=TENANT_A, user_id=USER_2, is_read=False)
        session = FakeSession([colleagues])
        app = self._build_app(session, tenant_id=TENANT_A, user_id=USER_1)
        client = await self._client(app)

        response = await client.patch(f"/api/notifications/{colleagues.id}/read")

        self.assertEqual(404, response.status_code, response.text)
        self.assertFalse(colleagues.is_read)

    async def test_mark_one_read_on_the_callers_own_id_succeeds(self):
        mine = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        session = FakeSession([mine])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.patch(f"/api/notifications/{mine.id}/read")

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["data"]["isRead"])

    async def test_read_all_route_resolves_and_does_not_fall_through_to_the_id_route(self):
        """`read-all` is registered ahead of `/{notification_id}/read`; hitting it must
        never be swallowed by the UUID-typed path and answer 422/404 instead."""
        mine_unread = make_notification(tenant_id=TENANT_A, user_id=USER_1, is_read=False)
        colleagues_unread = make_notification(tenant_id=TENANT_A, user_id=USER_2, is_read=False)
        session = FakeSession([mine_unread, colleagues_unread])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.patch("/api/notifications/read-all")

        self.assertEqual(200, response.status_code, response.text)
        self.assertIsNone(response.json().get("data"))
        self.assertTrue(mine_unread.is_read)
        self.assertFalse(colleagues_unread.is_read)


if __name__ == "__main__":
    unittest.main()
