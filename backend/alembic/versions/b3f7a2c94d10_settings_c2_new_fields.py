"""settings_c2_new_fields

Слайс C2 домена `settings` — новые поля схемы настроек. Одна ревизия на все
добавления: сид (C3) обязан увидеть окончательный набор колонок, а цепочка у
`settings` одна, и вторая ревизия с тем же родителем дала бы две головы.

**П62 — у компании есть часовой пояс.** Колонка `time_zone` хранит имя пояса
(IANA). По нему сервер режет границу суток, месяца и отчётных периодов; сегодня
день режется по Гринвичу, а время на экране местное.

**П66 — у компании есть страна, и хранится она кодом.** Колонка `country_code`
(`String(2)`) хранит код ISO 3166-1 alpha-2 из закрытого списка; название выводит
клиент по языку читателя. Свободного текста в поле страны у компании не остаётся.

**П73 — у компании есть код подтверждения.** Колонка `confirmation_code`
(`String(4)`) хранит четыре цифры, видимые админу и владельцу. Код постоянный и не
перевыпускается; потерянный — генерирует домен при чтении, тем же приёмом, каким он
достраивает отсутствующую строку компании.

**П11 — логотип хранится идентификатором файла, а не ссылкой.** Колонка `logo_url`
(`TEXT`) снимается, на её место встаёт `logo_file_id` (`String(255)`): ссылка
производна, собирается при чтении, а хранить её — хранимая производная, которой домен
не заводит (П68). Подписанная ссылка со сроком жизни — механизм
`backend/app/core/uploads`, общий для всех доменов; эта ревизия его не строит.

**П32, П34, П52 — пятая–седьмая константы ресурса `global_constants`.**
`payment_deferral_days` (отсрочка платежа, умолчание 0 — «оплата без отсрочки»),
`default_kerf_mm` (ширина реза по умолчанию, умолчание 3 мм — сегодняшний литерал
складского композабла) и `reservation_hold_days` (срок брони, умолчание 3 рабочих
дня) живут в том же синглтоне, что и финансовые величины, и отдаются теми же двумя
эндпоинтами: отдельный эндпоинт стоил бы десятого параллельного чтения ради одного
числа. Границ этих трёх величин владелец не назначал, и ревизия их не выдумывает.

Revision ID: b3f7a2c94d10
Revises: 7c4d1e9a3b58
Create Date: 2026-09-22 11:52:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b3f7a2c94d10"
down_revision: Union[str, Sequence[str], None] = "7c4d1e9a3b58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Добавить поля карточки компании и три скалярные константы."""
    # П62/П66/П73 — карточка компании
    op.add_column("company_info", sa.Column("time_zone", sa.String(64), nullable=True))
    op.add_column("company_info", sa.Column("country_code", sa.String(2), nullable=True))
    op.add_column(
        "company_info",
        sa.Column("confirmation_code", sa.String(4), nullable=False, server_default=""),
    )

    # П11: хранится идентификатор файла, ссылка производна. Прежние значения ссылки
    # не конвертируются: идентификатор из чужой строки не выводится, а выдумывать его
    # ревизия не вправе. Судьба уже сохранённых ссылок — вопрос владельцу.
    op.drop_column("company_info", "logo_url")
    op.add_column("company_info", sa.Column("logo_file_id", sa.String(255), nullable=True))

    # П32/П34/П52 — три скалярные константы рядом с финансовыми
    op.add_column(
        "global_constants",
        sa.Column("payment_deferral_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "global_constants",
        sa.Column("default_kerf_mm", sa.Numeric(6, 2), nullable=False, server_default="3"),
    )
    op.add_column(
        "global_constants",
        sa.Column("reservation_hold_days", sa.Integer(), nullable=False, server_default="3"),
    )


def downgrade() -> None:
    """Снять добавленные колонки и вернуть прежнюю колонку ссылки на логотип."""
    # П32/П34/П52 обратно
    op.drop_column("global_constants", "reservation_hold_days")
    op.drop_column("global_constants", "default_kerf_mm")
    op.drop_column("global_constants", "payment_deferral_days")

    # П11 обратно: колонка ссылки возвращается с типом, который оставил у неё
    # предыдущий head (`15f2c7d4e9b0_enlarge_logo_url_to_text.py` — TEXT)
    op.drop_column("company_info", "logo_file_id")
    op.add_column("company_info", sa.Column("logo_url", sa.Text(), nullable=True))

    # П62/П66/П73 обратно
    op.drop_column("company_info", "confirmation_code")
    op.drop_column("company_info", "country_code")
    op.drop_column("company_info", "time_zone")
