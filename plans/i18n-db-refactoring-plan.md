# План рефакторинга: Мультиязычность в БД (i18n)

## Текущая ситуация

**Проблема:** Переводы хранятся в виде отдельных колонок `_ru`, `_en`, `_lt` прямо в таблицах. Это **14 таблиц**, каждая с дублирующимися колонками для 3 языков. Добавление нового языка требует:
1. ALTER TABLE на каждую из 14 таблиц (+N колонок на каждое переводимое поле)
2. Обновление ORM модели
3. Обновление Pydantic схем (`TranslatedString`)
4. Обновление хелперов `translated_string_to_columns()` / `columns_to_translated_string()`
5. Обновление всех сервисов и репозиториев

### Таблицы, затронутые проблемой

| Таблица | Переводимые поля | Модель |
|---------|-----------------|--------|
| `services` | `name`, `description` | [`service.py`](backend/app/models/service.py:21) |
| `suppliers` | `company`, `contact_person`, `status_reason` | [`supplier.py`](backend/app/models/supplier.py:22) |
| `supplier_contacts` | `name` | [`supplier.py`](backend/app/models/supplier.py:132) |
| `supplier_files` | `name` | [`supplier.py`](backend/app/models/supplier.py:167) |
| `supplier_audit_entries` | `user_name`, `property` | [`supplier.py`](backend/app/models/supplier.py:199) |
| `bcc_categories` | `name` | [`bcc.py`](backend/app/models/bcc.py:22) |
| `section_configs` | `name` | [`config.py`](backend/app/models/config.py:52) |
| `permission_items` | `name` | [`config.py`](backend/app/models/config.py:115) |
| `currencies` | `name` | [`settings.py`](backend/app/models/settings.py:73) |
| `uoms` | `code`, `name` | [`settings.py`](backend/app/models/settings.py:99) |
| `order_statuses` | `name` | [`settings.py`](backend/app/models/settings.py:153) |
| `feature_definitions` | `name`, `description` | [`billing.py`](backend/app/models/billing.py:164) |
| `notifications` | `title`, `message` | [`notification.py`](backend/app/models/notification.py:29) |
| `stock_audit_entries` | `user_name`, `property` | [`warehouse.py`](backend/app/models/warehouse.py:225) |

**Текущий API-слой** (из [`create-api-service.md`](roo_code/skills/create-api-service.md)) уже использует [`TranslatedString`](backend/app/schemas/common.py:492) — Pydantic-схему с фиксированными `ru`, `en`, `lt` полями, и хелперы для конвертации. Это означает, что фронтенд уже работает с объектом `{ ru, en, lt }`, а не с плоскими колонками.

---

## Варианты рефакторинга

### 🅰 Вариант A: EAV-подход (Entity-Attribute-Value) — одна таблица переводов

Создать единую таблицу `translations`, которая хранит переводы для любых сущностей.

```sql
CREATE TABLE translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,   -- 'service', 'supplier', 'uom', etc.
    entity_id UUID NOT NULL,            -- FK к соответствующей таблице
    field_name VARCHAR(100) NOT NULL,   -- 'name', 'description', 'company', etc.
    locale VARCHAR(10) NOT NULL,        -- 'ru', 'en', 'lt', 'de', 'fr', etc.
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (tenant_id, entity_type, entity_id, field_name, locale)
);

CREATE INDEX idx_translations_lookup 
    ON translations(tenant_id, entity_type, entity_id);
```

**В моделях** — удалить все `_ru`/`_en`/`_lt` колонки, добавить relationship:

```python
class Service(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "services"
    # ... все поля без name_ru/en/lt, description_ru/en/lt
    translations: Mapped[list["Translation"]] = relationship(
        "Translation",
        primaryjoin="and_(Translation.entity_id == Service.id, Translation.entity_type == 'service')",
        cascade="all, delete-orphan",
        viewonly=True,
    )
```

**Плюсы:**
- 🔥 **Максимальная гибкость** — новый язык добавляется INSERT'ом, неALTER'ом
- 🔥 Одна таблица для всех переводов — простой менеджмент
- 🔥 Можно легко добавить locale в API (фронтенд шлёт `Accept-Language`)
- 🔥 Не нужно менять схему БД при добавлении языка

**Минусы:**
- ❌ Нет FOREIGN KEY constraints на `entity_id` (проверка целостности только на уровне приложения)
- ❌ Сложнее JOIN'ы для получения данных (нужен `LEFT JOIN ... ON ... OR ...` или несколько запросов)
- ❌ Потеря типизации на уровне БД (все значения — TEXT)
- ❌ Более сложные миграции данных (перенос существующих значений)
- ❌ Производительность: больше запросов или сложные JOIN'ы

---

### 🅱 Вариант B: JSONB-колонка — хранение переводов в JSONB

Добавить JSONB-колонку для каждой группы переводимых полей:

```sql
ALTER TABLE services ADD COLUMN name_translations JSONB NOT NULL DEFAULT '{}';
ALTER TABLE services ADD COLUMN description_translations JSONB NOT NULL DEFAULT '{}';
```

**В модели:**
```python
from sqlalchemy.dialects.postgresql import JSONB

class Service(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "services"
    # Удалить: name_ru, name_en, name_lt, description_ru, description_en, description_lt
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    description_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    # ...
```

**Формат JSONB:**
```json
{
  "ru": "Название",
  "en": "Name",
  "lt": "Pavadinimas",
  "de": "Name",
  "fr": "Nom"
}
```

**Плюсы:**
- 🔥 **Новый язык = INSERT в JSONB** (никаких ALTER TABLE)
- 🔥 PostgreSQL поддерживает индексы на JSONB (`GIN`, `btree` на ключи)
- 🔥 Нет дополнительных таблиц и JOIN'ов
- 🔥 Простая миграция: один ALTER TABLE на таблицу (добавить JSONB-колонки), потом удалить старые `_ru`/`_en`/`_lt`
- 🔥 FOREIGN KEY на `entity_id` сохраняется

**Минусы:**
- ❌ PostgreSQL JSONB не поддерживает CHECK-constraints на структуру (можно через триггеры)
- ❌ Для поиска по переводам нужны GIN-индексы (но они работают)
- ❌ Немного больше места, чем отдельные колонки (но JSONB with compression — нормально)
- ❌ Каждое переводимое поле — отдельная JSONB колонка (если полей много, колонок много)

---

### 🅲 Вариант C: Гибрид — JSONB для справочников, отдельная таблица для "тяжёлых" сущностей

Разделить подход в зависимости от характера данных:

| Тип данных | Таблицы | Подход |
|-----------|---------|--------|
| **Справочники** (мало записей, много переводов) | `services`, `suppliers`, `currencies`, `uoms`, `order_statuses`, `bcc_categories`, `section_configs` | JSONB |
| **Аудит/логи** (много записей, перевод для истории) | `supplier_audit_entries`, `stock_audit_entries` | JSONB |
| **Уведомления** (динамические, генерируются на лету) | `notifications` | JSONB |
| **Feature definitions** (системные, редко меняются) | `feature_definitions` | JSONB |
| **Permission items** | `permission_items` | JSONB |

**Плюсы:** Компромисс между гибкостью и производительностью
**Минусы:** Нет единого стандарта (нужно документировать выбор для каждого домена)

---

### 🅳 Вариант D: Таблица `language` + динамические колонки (миграции автоматически)

Создать таблицу языков и генерировать колонки через Alembic автоматически:

```sql
CREATE TABLE languages (
    code VARCHAR(10) PRIMARY KEY,  -- 'ru', 'en', 'lt'
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0
);
```

**Alembic migration generator** — скрипт, который:
1. Читает активные языки из таблицы `languages`
2. Для каждой таблицы с переводимыми полями генерирует ALTER TABLE ADD COLUMN
3. Обновляет ORM модели

**Плюсы:**
- 🔥 Формальный учёт языков (таблица `languages`)
- 🔥 Автоматизация через Alembic
- 🔥 Нативная типизация колонок (не TEXT всё, а VARCHAR(n))
- 🔥 FOREIGN KEY constraints сохраняются
- 🔥 Производительность как у обычных колонок

**Минусы:**
- ❌ Всё ещё ALTER TABLE при добавлении языка (хоть и автоматизированный)
- ❌ Сложная ORM-генерация (SQLAlchemy модели нужно динамически обновлять)
- ❌ Много колонок в таблицах (для N полей × M языков)
- ❌ Сложно поддерживать: ORM модели не будут статическими

---

## Рекомендация: 🅱 Вариант B (JSONB)

### Почему именно JSONB?

1. **Гибкость** — новый язык = новый ключ в JSON, не нужен ALTER TABLE
2. **Совместимость** — фронтенд уже шлёт `{ ru, en, lt }` как объект; JSONB принимает это нативно
3. **Производительность** — нет JOIN'ов, данные хранятся там же, где и основная запись
4. **PostgreSQL** — JSONB сжатый, с индексацией, зрелый функционал
5. **Миграция данных** — один шаг: добавить JSONB колонку, заполнить из старых `_ru`/`_en`/`_lt`, удалить старые колонки
6. **ORM** — SQLAlchemy работает с JSONB через `Mapped[dict]`, сериализация прозрачная

### Предлагаемый план миграции (поэтапно)

#### Фаза 1: Подготовка (изменение схемы)

Для каждой из 14 таблиц:

```python
# Пример: миграция для services
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

def upgrade():
    # 1. Добавить JSONB колонки
    op.add_column("services", sa.Column("name_translations", JSONB, server_default="{}"))
    op.add_column("services", sa.Column("description_translations", JSONB, server_default="{}"))
    
    # 2. Заполнить из старых колонок
    op.execute("""
        UPDATE services 
        SET name_translations = jsonb_build_object(
            'ru', name_ru, 'en', name_en, 'lt', name_lt
        ),
        description_translations = jsonb_build_object(
            'ru', description_ru, 'en', description_en, 'lt', description_lt
        )
    """)
    
    # 3. Сделать NOT NULL
    op.alter_column("services", "name_translations", nullable=False)
    
    # 4. Удалить старые колонки
    op.drop_column("services", "name_ru")
    op.drop_column("services", "name_en")
    op.drop_column("services", "name_lt")
    op.drop_column("services", "description_ru")
    op.drop_column("services", "description_en")
    op.drop_column("services", "description_lt")
    
    # 5. Добавить GIN индекс для поиска
    op.create_index("ix_services_name_translations", "services", ["name_translations"], postgresql_using="gin")
```

#### Фаза 2: Обновление моделей

```python
"""
backend/app/models/service.py — после рефакторинга
"""
class Service(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "services"
    
    tenant_id: Mapped[uuid.UUID] = ...
    # Было: name_ru, name_en, name_lt, description_ru, description_en, description_lt
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    description_translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
    # Всё остальное без изменений
    cost_price: Mapped[float] = ...
    selling_price: Mapped[float] = ...
    price_unit: Mapped[str] = ...
```

#### Фаза 3: Обновление схем (Pydantic)

```python
"""
backend/app/schemas/common.py — новый, универсальный TranslatedString
"""
from pydantic import BaseModel, model_validator
from typing import Any


class TranslatedString(dict[str, str]):
    """Locale-keyed string. Любой ключ = код языка."""
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v: Any) -> "TranslatedString":
        if isinstance(v, dict):
            return cls({k: str(v) for k, v in v.items()})
        return cls()
```

Или, если оставить Pydantic:

```python
class TranslatedString(BaseModel):
    """Locale-keyed string with dynamic locale support."""
    ru: str = ""
    en: str = ""
    lt: str = ""
    # Динамические локали через extra fields
    model_config = {"extra": "allow"}
```

Удалить хелперы `translated_string_to_columns()` и `columns_to_translated_string()` — они больше не нужны, так как JSONB хранит объект как есть.

#### Фаза 4: Обновление сервисов

Упростить маппинг — теперь не нужно преобразовывать `TranslatedString → _ru/_en/_lt` колонки:

```python
class ServiceService:
    def _to_response(self, model: Service) -> ServiceResponse:
        return ServiceResponse(
            id=model.id,
            name=TranslatedString(**(model.name_translations or {})),
            description=TranslatedString(**(model.description_translations or {})),
            cost_price=model.cost_price,
            selling_price=model.selling_price,
            price_unit=model.price_unit,
        )
    
    def _patch_data_to_columns(self, patch: ServicePatchRequest) -> dict:
        data = {}
        for field_name, value in patch.model_dump(exclude_none=True).items():
            if isinstance(value, TranslatedString):
                data[f"{field_name}_translations"] = dict(value)
            else:
                data[field_name] = value
        return data
```

#### Фаза 5: Добавление нового языка

```python
# Пример: добавление немецкого языка для услуги
await service.patch(service_id, ServicePatchRequest(
    name=TranslatedString({
        "ru": "Название", 
        "en": "Name", 
        "lt": "Pavadinimas", 
        "de": "Name"
    })
))
```

**Никаких ALTER TABLE, никаких миграций. Просто запись в JSONB.**

---

## Сравнение вариантов

| Критерий | 🅰 EAV | 🅱 JSONB | 🅲 Гибрид | 🅳 Dynamic Columns |
|----------|:------:|:--------:|:---------:|:------------------:|
| Добавление языка без ALTER TABLE | ✅ | ✅ | ✅ | ❌ |
| FOREIGN KEY constraints | ❌ | ✅ | ✅ | ✅ |
| Типизация на уровне БД | ❌ | ❌ | ❌ | ✅ |
| Производительность SELECT | ❌ | ✅ | ✅ | ✅ |
| Простота ORM | ❌ | ✅ | ✅ | ❌ |
| Поиск/фильтрация по переводам | ❌(сложно) | ✅(GIN) | ✅(GIN) | ✅(ILIKE) |
| Объём изменений в коде | Большой | Средний | Средний | Большой |
| Миграция данных | Сложная | Простая | Простая | Средняя |
| Единый стандарт | ✅ | ✅ | ❌ | ✅ |

---

## Итоговая рекомендация

**Вариант B (JSONB)** — оптимальный баланс между гибкостью, производительностью и объёмом изменений:

1. Минимальные изменения в ORM (замена 2-6 колонок на 1-3 JSONB)
2. Максимальная гибкость (новый язык = новый ключ в JSON)
3. Простая миграция данных (один UPDATE с `jsonb_build_object`)
4. PostgreSQL GIN индексы для поиска
5. Фронтенд уже работает с `{ ru, en, lt }` объектами — JSONB принимает это нативно
6. После рефакторинга можно удалить хелперы `translated_string_to_columns()`/`columns_to_translated_string()` — маппинг станет тривиальным

### Следующие шаги (если выберешь этот вариант):

1. ✅ Создать Alembic revision для первой таблицы (например, `services`)
2. ✅ Обновить модель в [`backend/app/models/service.py`](backend/app/models/service.py)
3. ✅ Обновить `TranslatedString` в [`backend/app/schemas/common.py`](backend/app/schemas/common.py)
4. ✅ Обновить сервисы и схемы домена
5. ✅ Прогнать тесты
6. ✅ Повторить для остальных 13 таблиц
7. Обновить `create-api-service` skill — убрать упоминания `_ru`/`_en`/`_lt` хелперов
