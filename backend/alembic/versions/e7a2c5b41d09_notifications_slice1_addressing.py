"""notifications_slice1_addressing

Слайс 1 плана домена `notifications` — форма хранения, ни одного роута.

**П10 — строка ленты перестаёт быть адресатом.** До этой ревизии
`notifications.user_id` делал строку персональной: пять адресатов одного
события означали бы пять одинаковых снимков текста. Решение владельца обратное
— одна строка на событие, а «кто прочитал» и «прочитал ли вообще» переезжают в
отдельную таблицу `notification_reads` (тройка `tenant_id`/`notification_id`/
`user_id`, с `read_at`). `is_read` по той же причине снимается с `notifications`
целиком: общего флага на разделяемой строке не бывает.

**`event_key` — это и есть механизм П56.** «Уже уведомили» раньше не хранилось
нигде, память жила в процессе мока и терялась при перезапуске. Уникальность
`(tenant_id, event_key)` переносит эту проверку в саму вставку: повторная
запись того же события падает на ограничении, а не требует отдельного чтения
перед записью.

**`requires_action` — флаг тревоги (П55), не отбор.** Домен его ставит и
отдаёт; кто и когда его читает как «тревогу на дашборде» — дело `analytics`
поверх этой колонки, не этого слайса.

**`notification_subscriptions` — «пользователь × тип × канал» (П54).** Второй
канал (почта) существует предусловием в `settings`, здесь только адресная
книга подписки и отметка `email_sent_at` на самом уведомлении.

**Второй ключ индекса ленты.** Сортировка `created_at` при равных значениях
не определяла порядок ничем — строковый `localeCompare` в моке путал границы
страниц. `id` как второй ключ индекса `(tenant_id, created_at DESC, id)`
закрывает это без новой колонки.

**Разбиения по времени здесь нет.** П61 снимает срок хранения записи, то есть
лента растёт без предела, но чем она ограничена сверху — вопрос ещё открыт
владельцу. Секционирование меняет форму каждого будущего индекса и первичного
ключа, поэтому решать его за владельца сейчас нельзя; слайс кладёт только
индекс.

Данных в таблице нет — роутов у домена ноль ни до этой ревизии, ни после, —
поэтому `downgrade` восстанавливает `user_id`/`is_read` без переливки: это
единственный момент, когда такая миграция бесплатна.

Revision ID: e7a2c5b41d09
Revises: e7b2c40d9f15
Create Date: 2026-09-24 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e7a2c5b41d09"
down_revision: Union[str, Sequence[str], None] = "e7b2c40d9f15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Снять адресность строки, завести дедуп события, прочтения и подписки."""
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_constraint("notifications_user_id_fkey", "notifications", type_="foreignkey")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_column("notifications", "user_id")
    op.drop_column("notifications", "is_read")

    op.add_column(
        "notifications",
        sa.Column("event_key", sa.String(200), nullable=False, server_default=""),
    )
    op.alter_column("notifications", "event_key", server_default=None)
    op.add_column(
        "notifications",
        sa.Column(
            "requires_action", sa.Boolean(), nullable=False, server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "notifications",
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_unique_constraint(
        "uq_notifications_tenant_event_key", "notifications", ["tenant_id", "event_key"],
    )
    op.create_index(
        "ix_notifications_tenant_created_at_id",
        "notifications",
        ["tenant_id", sa.text("created_at DESC"), "id"],
    )

    op.create_table(
        "notification_reads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("notification_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_unique_constraint(
        "uq_notification_reads_tenant_notification_user",
        "notification_reads",
        ["tenant_id", "notification_id", "user_id"],
    )
    op.create_index(
        "ix_notification_reads_tenant_notification",
        "notification_reads",
        ["tenant_id", "notification_id"],
    )

    op.create_table(
        "notification_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("email", sa.String(255), nullable=True),
    )
    op.create_unique_constraint(
        "uq_notification_subscriptions_tenant_user_type_channel",
        "notification_subscriptions",
        ["tenant_id", "user_id", "type", "channel"],
    )


def downgrade() -> None:
    """Вернуть форму строки-адресата: `user_id` и `is_read` на `notifications`.

    Обратный порядок к `upgrade`: сперва снимаются новые таблицы и колонки,
    потом восстанавливаются снятые. Данных нет ни в одну сторону — переливки
    не требуется.
    """
    op.drop_table("notification_subscriptions")
    op.drop_table("notification_reads")

    op.drop_index("ix_notifications_tenant_created_at_id", table_name="notifications")
    op.drop_constraint("uq_notifications_tenant_event_key", "notifications", type_="unique")

    op.drop_column("notifications", "email_sent_at")
    op.drop_column("notifications", "requires_action")
    op.drop_column("notifications", "event_key")

    op.add_column(
        "notifications",
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_notifications_is_read", "notifications", ["is_read"])
    op.add_column(
        "notifications",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.create_foreign_key(
        "notifications_user_id_fkey", "notifications", "users", ["user_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
