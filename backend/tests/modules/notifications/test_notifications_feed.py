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
from sqlalchemy.sql.dml import Insert

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
    """Строка ленты — СОБЫТИЕ арендатора, без адресата и без флага прочитанности.

    `user_id` и `is_read` сняты с таблицы по П10: одна строка на событие, а «кто
    прочитал» лежит в `notification_reads`. Тест, которому нужен прочитанный вид,
    передаёт пару `(notification, user)` в `FakeSession(reads=...)`, а не ставит
    флаг на строке.
    """
    values = {
        "id": uuid.uuid4(),
        "tenant_id": uuid.uuid4(),
        "type": "order_status",
        "title_translations": {"ru": "Заказ обновлён", "en": "Order updated", "lt": "Užsakymas atnaujintas"},
        "message_translations": {"ru": "Текст сообщения", "en": "Message text", "lt": "Pranešimo tekstas"},
        "entity_type": "order",
        "entity_id": "ORD-001",
        "event_key": "order_status:" + str(uuid.uuid4()),
        "requires_action": False,
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

    def first(self):
        return self._rows[0] if self._rows else None

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


def _exists_user(clause):
    """Из `EXISTS (SELECT … FROM notification_reads WHERE …)` достать, ЧЕЙ это читатель.

    Подзапрос собирается в `repository._read_marker` и сравнивает три вещи:
    арендатора, читателя и `notification_id` с колонкой внешней строки. Заглушке
    нужен второй — по нему она и отвечает, читал ли ЭТОТ человек ЭТУ строку.

    Разбирается настоящий statement, а не заранее условленный признак: сняв
    фильтр по `user_id` из `_read_marker`, мы получим здесь `None` и падение, а не
    молча прежний ответ.
    """
    where = clause.element.whereclause
    for part in getattr(where, "clauses", [where]):
        if type(part).__name__ != "BinaryExpression":
            continue
        left, right = part.left, part.right
        if getattr(left, "name", None) == "user_id" and hasattr(right, "value"):
            return right.value
    raise AssertionError("в подзапросе EXISTS не нашлось сравнения по user_id")


def _eval_clause(clause, row, reads) -> bool:
    name = type(clause).__name__
    if name == "Grouping":
        return _eval_clause(clause.element, row, reads)
    if name == "BooleanClauseList":
        parts = [_eval_clause(c, row, reads) for c in clause.clauses]
        return any(parts) if clause.operator is py_operator.or_ else all(parts)
    if name == "Exists":
        return (row.id, _exists_user(clause)) in reads
    if name == "UnaryExpression" and clause.operator is sa_operators.inv:
        return not _eval_clause(clause.element, row, reads)
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



def _read_marker_column(stmt):
    """Колонка-признак прочитанности, если выборка её просит, иначе `None`.

    Смотреть надо на `column_descriptions`, а не на `selected_columns`: у выборки
    сущности второй раскрывается во все двенадцать колонок таблицы, и признак в
    ней не вторым, а тринадцатым.
    """
    descriptions = stmt.column_descriptions
    if len(descriptions) == 2 and descriptions[1]["name"] == "is_read":
        return descriptions[1]["expr"]
    return None


def _order_spec(stmt):
    spec = []
    clause = getattr(stmt, "_order_by_clause", None)
    for unary in clause.clauses if clause is not None else []:
        spec.append((unary.element.name, unary.modifier is sa_operators.desc_op))
    return spec


class FakeSession:
    """A fixed table of ORM-like rows; `execute()` interprets the real statement.

    `reads` — множество пар `(notification_id, user_id)`: та самая таблица
    `notification_reads`, ради которой П10 и снял флаг со строки ленты. Заглушка
    держит её отдельно, как держит её база, а не подмешивает обратно в строку.
    """

    def __init__(self, rows, reads=()):
        self.rows = list(rows)
        self.reads = set(reads)
        self.statements = []

    async def execute(self, stmt):
        self.statements.append(stmt)

        if isinstance(stmt, Insert):
            # `INSERT ... VALUES` отмечает одну строку, `INSERT ... SELECT` — все
            # непрочитанные. Обе формы кладут пары в то же множество `reads`.
            if stmt.select is not None:
                where = _effective_whereclause(stmt.select)
                user_id = _exists_user_of_insert(stmt.select)
                for row in self.rows:
                    if where is None or _eval_clause(where, row, self.reads):
                        self.reads.add((row.id, user_id))
            else:
                values = {c.name: b.value for c, b in stmt._values.items()}
                self.reads.add((values["notification_id"], values["user_id"]))
            return _FakeResult()

        where = _effective_whereclause(stmt)
        matching = [row for row in self.rows if where is None or _eval_clause(where, row, self.reads)]

        if _is_count_statement(stmt):
            return _FakeResult(scalar_value=len(matching))

        for name, reverse in reversed(_order_spec(stmt)):
            matching.sort(key=lambda r, name=name: getattr(r, name), reverse=reverse)

        if stmt._limit is not None or stmt._offset:
            offset = stmt._offset or 0
            limit = stmt._limit
            matching = matching[offset : offset + limit] if limit is not None else matching[offset:]

        marker = _read_marker_column(stmt)
        if marker is not None:
            user_id = _exists_user(marker.element if hasattr(marker, "element") else marker)
            return _FakeResult(rows=[(row, (row.id, user_id) in self.reads) for row in matching])

        return _FakeResult(rows=matching)

    async def commit(self):
        pass

    async def flush(self):
        # Слайс границу транзакции не держит — он делает `flush`, а коммитит `get_db`
        # (сторож `tests/test_transaction_boundary.py`). Заглушка обязана знать оба.
        pass


def _exists_user_of_insert(select_stmt):
    """Чей читатель отмечается в `INSERT ... SELECT` — из колонки `user_id` выборки."""
    for column in select_stmt.selected_columns:
        if column.name == "user_id":
            return uuid.UUID(column.element.value) if hasattr(column, "element") else column.value
    raise AssertionError("в INSERT ... SELECT не нашлось колонки user_id")


TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()
USER_1 = uuid.uuid4()
USER_2 = uuid.uuid4()


# ── Repository — tenant scoping, per-reader read flag, search, ordering ───────────


class ListNotificationsScopingTests(unittest.IsolatedAsyncioTestCase):
    """Сужает ЛЕНТУ арендатор, а не читатель (П10).

    Мутационная цель: снять `Notification.tenant_id == tenant_id` из
    `_filtered_query` — покраснеет
    `test_a_foreign_tenants_notification_is_absent_from_the_list`.

    Второй мутационной цели — «снять фильтр по `user_id`» — здесь больше нет и быть
    не может: строка ленты общая для всех читателей арендатора, и фильтра по
    читателю в выборке не существует. Личное в ней ровно одно — прочитанность, и её
    стережёт `PerReaderReadFlagTests` ниже.
    """

    async def test_a_foreign_tenants_notification_is_absent_from_the_list(self):
        mine = make_notification(tenant_id=TENANT_A)
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession([mine, foreign])

        items = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([mine.id], [entity.id for entity, _ in items])

    async def test_a_colleagues_notification_in_the_same_tenant_is_visible(self):
        """Прямое следствие П10, и раньше здесь утверждалось обратное.

        До 2026-09-25 лента сужалась по `user_id`, и пять адресатов одного события
        означали бы пять копий снимка текста. Решение владельца — одна строка на
        событие; значит коллега по арендатору видит ту же строку, а не свою копию.
        """
        mine = make_notification(tenant_id=TENANT_A)
        colleagues = make_notification(tenant_id=TENANT_A)
        session = FakeSession([mine, colleagues])

        items = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual({mine.id, colleagues.id}, {entity.id for entity, _ in items})

    async def test_count_is_scoped_to_the_tenant(self):
        session = FakeSession(
            [
                make_notification(tenant_id=TENANT_A),
                make_notification(tenant_id=TENANT_A),
                make_notification(tenant_id=TENANT_B),
            ]
        )

        total = await count_notifications(session, TENANT_A, USER_1)

        self.assertEqual(2, total)


class PerReaderReadFlagTests(unittest.IsolatedAsyncioTestCase):
    """Личное в общей строке — только прочитанность, и она у каждого своя.

    Мутационная цель: сделать `_read_marker` не зависящим от `user_id` — покраснеет
    `test_the_same_row_is_read_for_one_reader_and_unread_for_another`.
    """

    async def test_the_same_row_is_read_for_one_reader_and_unread_for_another(self):
        shared = make_notification(tenant_id=TENANT_A)
        session = FakeSession([shared], reads=[(shared.id, USER_1)])

        for_first = await list_notifications_repo(session, TENANT_A, USER_1)
        for_second = await list_notifications_repo(session, TENANT_A, USER_2)

        self.assertEqual([(shared.id, True)], [(e.id, flag) for e, flag in for_first])
        self.assertEqual([(shared.id, False)], [(e.id, flag) for e, flag in for_second])


class GetNotificationByIdScopingTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_foreign_tenants_notification_reads_as_absent(self):
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession([foreign])

        result = await get_notification_by_id(session, foreign.id, TENANT_A, USER_1)

        self.assertIsNone(result)

    async def test_a_colleagues_notification_is_found_and_reads_as_unread(self):
        """П10 снял сам вопрос о праве отметить чужое: строка общая, чужой нет.

        Отмечается не строка, а собственная прочитанность, поэтому находится она у
        любого читателя арендатора — и находится непрочитанной, пока он её не
        отметил.
        """
        colleague = make_notification(tenant_id=TENANT_A)
        session = FakeSession([colleague], reads=[(colleague.id, USER_2)])

        result = await get_notification_by_id(session, colleague.id, TENANT_A, USER_1)

        self.assertIsNotNone(result)
        entity, is_read = result
        self.assertEqual(colleague.id, entity.id)
        self.assertFalse(is_read)

    async def test_a_row_of_this_tenant_is_found(self):
        mine = make_notification(tenant_id=TENANT_A)
        session = FakeSession([mine])

        result = await get_notification_by_id(session, mine.id, TENANT_A, USER_1)

        self.assertIsNotNone(result)
        self.assertEqual(mine.id, result[0].id)

    async def test_an_unknown_id_reads_as_absent(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A)])

        result = await get_notification_by_id(session, uuid.uuid4(), TENANT_A, USER_1)

        self.assertIsNone(result)


class SearchAcrossSixKeysTests(unittest.IsolatedAsyncioTestCase):
    async def _assert_matches(self, field: str, locale: str, needle: str):
        translations = {"ru": "неважно", "en": "irrelevant", "lt": "nesvarbu"}
        translations[locale] = "Baltic Steel Order"
        target = make_notification(tenant_id=TENANT_A, **{field: translations})
        other = make_notification(tenant_id=TENANT_A)
        session = FakeSession([target, other])

        items = await list_notifications_repo(session, TENANT_A, USER_1, search=needle)

        self.assertEqual([target.id], [entity.id for entity, _ in items])

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
        session = FakeSession([make_notification(tenant_id=TENANT_A)])

        items = await list_notifications_repo(
            session, TENANT_A, USER_1, search="does-not-match-anything"
        )

        self.assertEqual([], items)

    async def test_missing_locale_key_does_not_crash_the_search(self):
        sparse = make_notification(
            tenant_id=TENANT_A, title_translations={"en": "Only English"}
        )
        session = FakeSession([sparse])

        items = await list_notifications_repo(session, TENANT_A, USER_1, search="only english")

        self.assertEqual([sparse.id], [entity.id for entity, _ in items])


class TypeAndReadFilterTests(unittest.IsolatedAsyncioTestCase):
    async def test_a_given_type_narrows_the_list(self):
        status = make_notification(tenant_id=TENANT_A, type="order_status")
        deficit = make_notification(tenant_id=TENANT_A, type="stock_deficit")
        session = FakeSession([status, deficit])

        items = await list_notifications_repo(session, TENANT_A, USER_1, type_="stock_deficit")

        self.assertEqual([deficit.id], [entity.id for entity, _ in items])

    async def test_no_type_returns_every_type(self):
        status = make_notification(tenant_id=TENANT_A, type="order_status")
        deficit = make_notification(tenant_id=TENANT_A, type="stock_deficit")
        session = FakeSession([status, deficit])

        items = await list_notifications_repo(session, TENANT_A, USER_1, type_=None)

        self.assertEqual({status.id, deficit.id}, {entity.id for entity, _ in items})

    async def test_is_read_true_returns_only_what_this_reader_has_read(self):
        read = make_notification(tenant_id=TENANT_A)
        unread = make_notification(tenant_id=TENANT_A)
        session = FakeSession([read, unread], reads=[(read.id, USER_1)])

        items = await list_notifications_repo(session, TENANT_A, USER_1, is_read=True)

        self.assertEqual([read.id], [entity.id for entity, _ in items])

    async def test_is_read_false_returns_only_what_this_reader_has_not_read(self):
        read = make_notification(tenant_id=TENANT_A)
        unread = make_notification(tenant_id=TENANT_A)
        session = FakeSession([read, unread], reads=[(read.id, USER_1)])

        items = await list_notifications_repo(session, TENANT_A, USER_1, is_read=False)

        self.assertEqual([unread.id], [entity.id for entity, _ in items])

    async def test_the_filter_follows_the_reader_not_the_row(self):
        """Та же строка отбирается фильтром по-разному у двух читателей.

        Фильтр, который сравнивал бы колонку строки, дал бы обоим один ответ. Здесь
        он обязан дать разные — иначе прочитанность снова принадлежит строке, а не
        человеку, и П10 не выполнен.
        """
        shared = make_notification(tenant_id=TENANT_A)
        session = FakeSession([shared], reads=[(shared.id, USER_1)])

        for_first = await list_notifications_repo(session, TENANT_A, USER_1, is_read=True)
        for_second = await list_notifications_repo(session, TENANT_A, USER_2, is_read=True)

        self.assertEqual([shared.id], [entity.id for entity, _ in for_first])
        self.assertEqual([], for_second)

    async def test_is_read_absent_returns_both(self):
        read = make_notification(tenant_id=TENANT_A)
        unread = make_notification(tenant_id=TENANT_A)
        session = FakeSession([read, unread], reads=[(read.id, USER_1)])

        items = await list_notifications_repo(session, TENANT_A, USER_1, is_read=None)

        self.assertEqual({read.id, unread.id}, {entity.id for entity, _ in items})


class OrderingTests(unittest.IsolatedAsyncioTestCase):
    """Mutation target: drop the `Notification.id.asc()` tie-break."""

    async def test_newest_created_at_comes_first_by_default(self):
        older = make_notification(
            tenant_id=TENANT_A, created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)
        )
        newer = make_notification(
            tenant_id=TENANT_A, created_at=datetime(2026, 6, 1, tzinfo=timezone.utc)
        )
        session = FakeSession([older, newer])

        items = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([newer.id, older.id], [entity.id for entity, _ in items])

    async def test_equal_created_at_breaks_the_tie_by_id_ascending_and_stays_stable(self):
        same_moment = datetime(2026, 3, 1, tzinfo=timezone.utc)
        low_id, high_id = sorted([uuid.uuid4(), uuid.uuid4()])
        first = make_notification(tenant_id=TENANT_A, id=low_id, created_at=same_moment)
        second = make_notification(tenant_id=TENANT_A, id=high_id, created_at=same_moment)
        session = FakeSession([second, first])

        run_one = await list_notifications_repo(session, TENANT_A, USER_1)
        run_two = await list_notifications_repo(session, TENANT_A, USER_1)

        self.assertEqual([low_id, high_id], [entity.id for entity, _ in run_one])
        self.assertEqual(
            [entity.id for entity, _ in run_one], [entity.id for entity, _ in run_two]
        )

    async def test_sort_by_type_is_accepted(self):
        b_type = make_notification(tenant_id=TENANT_A, type="stock_deficit")
        a_type = make_notification(tenant_id=TENANT_A, type="batch_received")
        session = FakeSession([b_type, a_type])

        items = await list_notifications_repo(session, TENANT_A, USER_1, sort_by="type", sort_dir="asc")

        self.assertEqual([a_type.id, b_type.id], [entity.id for entity, _ in items])


class PaginationTests(unittest.IsolatedAsyncioTestCase):
    async def test_page_two_skips_the_first_page(self):
        rows = [
            make_notification(
                tenant_id=TENANT_A,
                created_at=datetime(2026, 1, 1, tzinfo=timezone.utc) - timedelta(days=i),
            )
            for i in range(5)
        ]
        session = FakeSession(rows)

        page_one = await list_notifications_repo(session, TENANT_A, USER_1, page=1, page_size=2)
        page_two = await list_notifications_repo(session, TENANT_A, USER_1, page=2, page_size=2)

        self.assertEqual(2, len(page_one))
        self.assertEqual(2, len(page_two))
        self.assertFalse(
            {entity.id for entity, _ in page_one} & {entity.id for entity, _ in page_two}
        )


class UnreadCountRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_counts_what_this_reader_has_not_read_in_this_tenant(self):
        read_by_me = make_notification(tenant_id=TENANT_A)
        read_by_colleague = make_notification(tenant_id=TENANT_A)
        unread = make_notification(tenant_id=TENANT_A)
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession(
            [read_by_me, read_by_colleague, unread, foreign],
            reads=[(read_by_me.id, USER_1), (read_by_colleague.id, USER_2)],
        )

        total = await count_unread(session, TENANT_A, USER_1)

        # Прочитанное КОЛЛЕГОЙ у меня непрочитано — иначе счётчик считает чужое.
        self.assertEqual(2, total)


class MarkAllReadRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_records_this_reader_as_having_read_every_row_of_the_tenant(self):
        first = make_notification(tenant_id=TENANT_A)
        second = make_notification(tenant_id=TENANT_A)
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession([first, second, foreign])

        await mark_all_read_repo(session, TENANT_A, USER_1)

        self.assertIn((first.id, USER_1), session.reads)
        self.assertIn((second.id, USER_1), session.reads)
        self.assertNotIn((foreign.id, USER_1), session.reads)

    async def test_it_does_not_mark_the_rows_read_for_anybody_else(self):
        """Отметка личная: «прочитать всё» за одного не трогает соседа.

        Прежняя реализация писала `is_read=True` в саму строку, то есть отмечала
        её за всех сразу. На разделяемой строке (П10) это было бы ровно той бедой,
        ради которой флаг с неё и сняли.
        """
        shared = make_notification(tenant_id=TENANT_A)
        session = FakeSession([shared])

        await mark_all_read_repo(session, TENANT_A, USER_1)

        self.assertIn((shared.id, USER_1), session.reads)
        self.assertNotIn((shared.id, USER_2), session.reads)

    async def test_is_a_single_insert_statement(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A)])

        await mark_all_read_repo(session, TENANT_A, USER_1)

        self.assertEqual(1, len(session.statements))
        self.assertIsInstance(session.statements[0], Insert)


# ── Domain — defaults, cap, entityRouteName mapping, refusal ───────────────────────


class ListNotificationsDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_defaults_are_page_one_and_page_size_twenty_five(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A)])

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
        rows = [make_notification(tenant_id=TENANT_A) for _ in range(150)]
        session = FakeSession(rows)

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read=None, sort_by=None, sort_dir=None,
            page=1, page_size=99999,
        )

        self.assertEqual(MAX_PAGE_SIZE, result.pageSize)
        self.assertLessEqual(len(result.items), MAX_PAGE_SIZE)

    async def test_empty_search_and_type_all_and_absent_is_read_mean_no_filter(self):
        status = make_notification(tenant_id=TENANT_A, type="order_status")
        deficit = make_notification(tenant_id=TENANT_A, type="stock_deficit")
        session = FakeSession([status, deficit], reads=[(status.id, USER_1)])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search="", type_="all", is_read=None, sort_by="createdAt", sort_dir="desc",
            page=1, page_size=25,
        )

        self.assertEqual({status.id, deficit.id}, {item.id for item in result.items})

    async def test_a_blank_is_read_string_also_means_no_filter(self):
        """The client always sends `isRead`, and blank means "all" the same as absent
        (`notificationsService.ts` sends `''` for the null tri-state)."""
        status = make_notification(tenant_id=TENANT_A)
        deficit = make_notification(tenant_id=TENANT_A)
        session = FakeSession([status, deficit], reads=[(status.id, USER_1)])

        result = await list_notifications(
            session, TENANT_A, USER_1,
            search=None, type_=None, is_read="", sort_by=None, sort_dir=None,
            page=1, page_size=25,
        )

        self.assertEqual({status.id, deficit.id}, {item.id for item in result.items})

    async def test_an_unknown_sort_by_falls_back_to_created_at(self):
        session = FakeSession([make_notification(tenant_id=TENANT_A)])

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
            make_notification(tenant_id=TENANT_A, entity_type=entity_type)
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
        session = FakeSession([make_notification(tenant_id=TENANT_A)])

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
        read = make_notification(tenant_id=TENANT_A, type="order_status")
        session = FakeSession(
            [
                read,
                make_notification(tenant_id=TENANT_A, type="stock_deficit"),
                make_notification(tenant_id=TENANT_A, type="order_status"),
            ],
            reads=[(read.id, USER_1)],
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
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession([foreign])

        with self.assertRaises(NotFoundError):
            await mark_notification_read(session, TENANT_A, USER_1, foreign.id)

    async def test_a_row_read_by_a_colleague_is_still_markable_and_stays_his_read(self):
        """П10: отмечается собственная прочитанность, а не строка.

        Раньше здесь ожидался 404 «чужое уведомление». Чужих внутри арендатора
        больше нет — строка общая. Проверять надо, что отметка ЛИЧНАЯ: она
        появляется у меня и не трогает запись коллеги.
        """
        shared = make_notification(tenant_id=TENANT_A)
        session = FakeSession([shared], reads=[(shared.id, USER_2)])

        result = await mark_notification_read(session, TENANT_A, USER_1, shared.id)

        self.assertTrue(result.isRead)
        self.assertIn((shared.id, USER_1), session.reads)
        self.assertIn((shared.id, USER_2), session.reads)

    async def test_marking_read_records_this_reader_and_nobody_else(self):
        mine = make_notification(tenant_id=TENANT_A)
        session = FakeSession([mine])

        result = await mark_notification_read(session, TENANT_A, USER_1, mine.id)

        self.assertTrue(result.isRead)
        self.assertEqual({(mine.id, USER_1)}, session.reads)


class MarkAllReadDomainTests(unittest.IsolatedAsyncioTestCase):
    async def test_marks_every_row_of_the_tenant_for_this_reader_only(self):
        first = make_notification(tenant_id=TENANT_A)
        second = make_notification(tenant_id=TENANT_A)
        session = FakeSession([first, second])

        await mark_all_read(session, TENANT_A, USER_1)

        self.assertEqual({(first.id, USER_1), (second.id, USER_1)}, session.reads)


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
        session = FakeSession([make_notification(tenant_id=TENANT_A)])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.get("/api/notifications")

        self.assertEqual(200, response.status_code, response.text)
        payload = response.json()["data"]
        self.assertEqual(
            {"items", "total", "page", "pageSize", "totalPages"}, set(payload.keys())
        )
        self.assertEqual(1, payload["total"])

    async def test_a_foreign_tenants_notification_is_invisible_in_list_and_count_over_http(self):
        """Сужает арендатор. Раньше здесь проверялся коллега — по П10 он видит ту же
        строку, и «невидимость коллеги» стала бы утверждением о несуществующем правиле.
        """
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession([foreign])
        app = self._build_app(session, tenant_id=TENANT_A)
        client = await self._client(app)

        list_response = await client.get("/api/notifications")
        count_response = await client.get("/api/notifications/unread-count")

        self.assertEqual([], list_response.json()["data"]["items"])
        self.assertEqual(0, count_response.json()["data"])

    async def test_a_colleagues_row_is_visible_but_unread_for_this_reader_over_http(self):
        """Общая строка доходит до коллеги, и доходит непрочитанной."""
        shared = make_notification(tenant_id=TENANT_A)
        session = FakeSession([shared], reads=[(shared.id, USER_2)])
        app = self._build_app(session, tenant_id=TENANT_A, user_id=USER_1)
        client = await self._client(app)

        list_response = await client.get("/api/notifications")
        count_response = await client.get("/api/notifications/unread-count")

        items = list_response.json()["data"]["items"]
        self.assertEqual([str(shared.id)], [item["id"] for item in items])
        self.assertFalse(items[0]["isRead"])
        self.assertEqual(1, count_response.json()["data"])

    async def test_unread_count_response_is_a_bare_number_in_the_envelope(self):
        session = FakeSession(
            [make_notification(tenant_id=TENANT_A)]
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
                make_notification(tenant_id=TENANT_A, type="order_status"),
                make_notification(tenant_id=TENANT_A, type="stock_deficit"),
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

    async def test_mark_one_read_on_a_foreign_tenants_id_is_404_and_records_nothing(self):
        """404 остаётся у ЧУЖОГО АРЕНДАТОРА. Внутри своего чужих строк нет (П10)."""
        foreign = make_notification(tenant_id=TENANT_B)
        session = FakeSession([foreign])
        app = self._build_app(session, tenant_id=TENANT_A)
        client = await self._client(app)

        response = await client.patch(f"/api/notifications/{foreign.id}/read")

        self.assertEqual(404, response.status_code, response.text)
        self.assertEqual(set(), session.reads)

    async def test_mark_one_read_on_the_callers_own_id_succeeds(self):
        mine = make_notification(tenant_id=TENANT_A)
        session = FakeSession([mine])
        app = self._build_app(session)
        client = await self._client(app)

        response = await client.patch(f"/api/notifications/{mine.id}/read")

        self.assertEqual(200, response.status_code, response.text)
        self.assertTrue(response.json()["data"]["isRead"])

    async def test_read_all_route_resolves_and_does_not_fall_through_to_the_id_route(self):
        """`read-all` is registered ahead of `/{notification_id}/read`; hitting it must
        never be swallowed by the UUID-typed path and answer 422/404 instead."""
        first = make_notification(tenant_id=TENANT_A)
        second = make_notification(tenant_id=TENANT_A)
        session = FakeSession([first, second])
        app = self._build_app(session, user_id=USER_1)
        client = await self._client(app)

        response = await client.patch("/api/notifications/read-all")

        self.assertEqual(200, response.status_code, response.text)
        self.assertIsNone(response.json().get("data"))
        # Обе строки арендатора отмечены прочитанными ЭТИМ читателем и только им.
        self.assertEqual({(first.id, USER_1), (second.id, USER_1)}, session.reads)


if __name__ == "__main__":
    unittest.main()
