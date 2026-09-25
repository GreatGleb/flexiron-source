"""Repository for the notifications.feed slice (Infrastructure / Data Access layer).

**Адресность строки — П10.** Строка ленты принадлежит СОБЫТИЮ и арендатору, а не
человеку: пять адресатов одного события — одна строка, а не пять копий снимка текста.
Прочитанность — личная, и живёт она в `notification_reads`, а не флагом на разделяемой
строке. Поэтому здесь нет ни `Notification.user_id`, ни `Notification.is_read`: первый
снят вместе с адресностью, второй — вместе с общим флагом.

Из этого следует то, что сначала выглядит послаблением: `user_id` больше **не сужает
выборку**, он только отвечает на вопрос «прочитал ли ЭТОТ человек». Сужает по-прежнему
`tenant_id`, как во всех доменах (Б3).
"""

from uuid import UUID

from sqlalchemy import func, literal, literal_column, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.shared.models import Notification, NotificationRead

#: The six JSONB keys `search` matches against — title/message × three locales.
SEARCH_LOCALES = ("ru", "en", "lt")

#: `sortBy` accepts exactly these two values; anything else falls back upstream.
SORT_COLUMNS = {
    "createdAt": Notification.created_at,
    "type": Notification.type,
}


def _search_predicate(search: str):
    """Case-insensitive substring match across all six translation keys."""
    pattern = f"%{search}%"
    conditions = [
        column[locale].astext.ilike(pattern)
        for column in (Notification.title_translations, Notification.message_translations)
        for locale in SEARCH_LOCALES
    ]
    return or_(*conditions)


def _read_marker(tenant_id: UUID, user_id: UUID):
    """`EXISTS`-подзапрос «этот человек прочитал эту строку» — один на весь файл.

    Он же отвечает за `isRead` в выдаче и за фильтр `isRead`, и за счёт непрочитанных:
    три места, одно правило. Вторая запись того же предиката разошлась бы с первой
    молча — ровно то, на чём этот проект ловил себя трижды (Л5).
    """
    return (
        select(NotificationRead.id)
        .where(
            NotificationRead.tenant_id == tenant_id,
            NotificationRead.user_id == user_id,
            NotificationRead.notification_id == Notification.id,
        )
        .exists()
    )


def _filtered_query(
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None,
    type_: str | None,
    is_read: bool | None,
):
    """Shared WHERE clause for both the count and the page — one place for the rule.

    Сужает `tenant_id` (Б3). `user_id` сюда входит только через `_read_marker`: лента
    общая, личная в ней лишь прочитанность.
    """
    query = select(Notification).where(Notification.tenant_id == tenant_id)
    if type_:
        query = query.where(Notification.type == type_)
    if is_read is not None:
        marker = _read_marker(tenant_id, user_id)
        query = query.where(marker if is_read else ~marker)
    if search:
        query = query.where(_search_predicate(search))
    return query


async def count_notifications(
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None = None,
    type_: str | None = None,
    is_read: bool | None = None,
) -> int:
    """Total rows matching the filters, scoped to this caller's tenant."""
    query = _filtered_query(tenant_id, user_id, search=search, type_=type_, is_read=is_read)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def list_notifications(
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    *,
    search: str | None = None,
    type_: str | None = None,
    is_read: bool | None = None,
    sort_by: str = "createdAt",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> list[tuple[Notification, bool]]:
    """One page of the tenant's feed with THIS caller's read flag, tie-broken by `id`.

    Возвращает пары, а не сущности: `isRead` больше не колонка строки, и подставлять
    его вызывающему пришлось бы вторым запросом на каждую строку (N+1, Б4).
    """
    query = _filtered_query(tenant_id, user_id, search=search, type_=type_, is_read=is_read)
    column = SORT_COLUMNS.get(sort_by, Notification.created_at)
    ordered = column.desc() if sort_dir == "desc" else column.asc()
    query = query.add_columns(_read_marker(tenant_id, user_id).label("is_read"))
    query = query.order_by(ordered, Notification.id.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return [(row[0], bool(row[1])) for row in result.all()]


async def count_unread(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> int:
    """Bare count of what this caller has not read — no list filters applied.

    Shares `_filtered_query`'s WHERE clause rather than a second copy of it — only
    `is_read` is fixed, `search`/`type_` stay unset.
    """
    query = _filtered_query(tenant_id, user_id, search=None, type_=None, is_read=False)
    count_stmt = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_stmt)
    return result.scalar() or 0


async def get_notification_by_id(
    db: AsyncSession, notification_id: UUID, tenant_id: UUID, user_id: UUID
) -> tuple[Notification, bool] | None:
    """Fetch one notification of this tenant plus this caller's read flag.

    Сужение — по арендатору. «Чужого» уведомления внутри арендатора больше не бывает:
    строка общая, и П10 снял сам вопрос о праве отметить чужое — отмечается не строка,
    а собственная прочитанность.
    """
    result = await db.execute(
        select(Notification, _read_marker(tenant_id, user_id).label("is_read")).where(
            Notification.id == notification_id,
            Notification.tenant_id == tenant_id,
        )
    )
    row = result.first()
    return (row[0], bool(row[1])) if row else None


async def mark_read(
    db: AsyncSession, tenant_id: UUID, user_id: UUID, notification_id: UUID
) -> None:
    """Record that this caller has read this notification.

    `ON CONFLICT DO NOTHING` по тройке уникальности: повторная отметка — не ошибка,
    а то же самое состояние. Без неё второй вызов падал бы на ограничении.

    `flush`, а не `commit`: границу транзакции держит `get_db`, и она в проекте одна
    (сторож `tests/test_transaction_boundary.py`).
    """
    await db.execute(
        pg_insert(NotificationRead)
        .values(tenant_id=tenant_id, user_id=user_id, notification_id=notification_id)
        .on_conflict_do_nothing(
            constraint="uq_notification_reads_tenant_notification_user"
        )
    )
    await db.flush()


async def mark_all_read(db: AsyncSession, tenant_id: UUID, user_id: UUID) -> None:
    """Record this caller as having read every notification of their tenant.

    Один `INSERT ... SELECT`, а не выборка и цикл: строк столько же, сколько
    непрочитанных уведомлений у арендатора, и тащить их в питон незачем (Б4).

    `id` берётся из `gen_random_uuid()`, а не из питоновского умолчания модели:
    умолчание применяется к строке, которую строит ORM, а здесь строки рождаются
    внутри `SELECT` и до питона не доходят вовсе.
    """
    unread = select(
        Notification.tenant_id.label("tenant_id"),
        Notification.id.label("notification_id"),
        literal_column("gen_random_uuid()").label("id"),
        literal(str(user_id), type_=NotificationRead.user_id.type).label("user_id"),
    ).where(
        Notification.tenant_id == tenant_id,
        ~_read_marker(tenant_id, user_id),
    )
    await db.execute(
        pg_insert(NotificationRead)
        .from_select(["tenant_id", "notification_id", "id", "user_id"], unread)
        .on_conflict_do_nothing(
            constraint="uq_notification_reads_tenant_notification_user"
        )
    )
    await db.flush()
