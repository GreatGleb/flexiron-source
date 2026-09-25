"""settings_c9_warehouse_map

Слайс C9 домена `settings` — карта склада. Одна ревизия, один родитель: цепочка
у `settings` одна, и вторая ревизия с тем же родителем дала бы две головы.

**П65 а — карта склада это просто картинка, своя у каждого арендатора.** Форму
хранения контракт не назначает («хранить как удобно, лишь бы отдавал по этим
трём эндпоинтам»), поэтому под неё заводится своя синглтон-таблица
`warehouse_map` — по строке на арендатора, как у `company_info` и `mail_settings`.

**П11 — колонка хранит идентификатор файла, а не ссылку.** `map_file_id`
(`String(255)`) держит идентификатор записи `uploaded_files`; ссылка производна,
подписана и живёт ~15 минут, и собирается она при чтении. Колонки под ссылку
(`map_url`) не заводится: хранимая производная — то, чего у этого домена нет
(П68), ровно как `logo_url` у компании, снятый ревизией `b3f7a2c94d10`.

**Метаданные — документом JSON, а не четырьмя колонками.** `file_metadata`
(`JSONB`, умолчание `{}`) держит `name`, `mime`, `size` и `uploadedAt` — те
четыре поля, что уезжают одним объектом `WarehouseMapFile`
(`frontend_vue/src/types/settings.ts:111-119`). Умолчание `{}` стоит и в модели,
и здесь (в модели как `server_default`): колонка объявлена `NOT NULL`, и
`server_default` — то, что делает её добавление безопасным на непустой таблице.

Что этой ревизией **не** делается. Подписывание ссылок и уборщик черновиков не
строятся — они живут в `backend/app/core/uploads` и общие для всех доменов (§П11,
§П31). Пометка черновика лежит на `uploaded_files.is_draft`, и снимает её `PUT`
карты в коде слайса; колонки под неё у карты нет. Кто удаляет бинарник карты,
которая **была привязана и осиротела** после замены или удаления, — вопрос
владельца **В4**, и он открыт: ни таблица, ни ревизия этого не решают.

Revision ID: c9e4a1f70b23
Revises: b3f7a2c94d10
Create Date: 2026-09-22 12:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c9e4a1f70b23"
down_revision: Union[str, Sequence[str], None] = "b3f7a2c94d10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Завести таблицу карты склада — одна строка на арендатора."""
    op.create_table(
        "warehouse_map",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True,
        ),
        # П11: идентификатор файла, не ссылка.
        sa.Column("map_file_id", sa.String(255), nullable=False),
        # П65 а: четыре поля объекта WarehouseMapFile — одним документом.
        sa.Column(
            "file_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Снять таблицу целиком — точный обратный ход: таблица создана этой ревизией.

    Данных, переживших обратный ход, у неё нет и быть не может: до этой ревизии
    карты на сервере не существовало вовсе. Бинарники `uploaded_files` не
    трогаются ни вверх, ни вниз — их судьба вопросу В4 не подчинена.
    """
    op.drop_table("warehouse_map")
