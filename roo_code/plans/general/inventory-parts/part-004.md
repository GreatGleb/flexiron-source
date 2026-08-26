# Инвентаризация планов — часть 004

Каталог: `roo_code/plans/backend` (2 плана, чекбоксов 0 в обоих).
Код не изменялся.

---

## 1. `roo_code/plans/backend/backend-refactor-modular-monolith-plan.md`

**Вердикт: сделано**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0). Пункты плана —
нумерованный список 1–25 в разделе 5, проверены как целое.

### Доказательство

```
$ ls backend/app/
core
__init__.py
main.py
modules
```
Старых `app/models/` и `app/schemas/` нет — пункты 14 и строки «DELETE» из карты
миграции выполнены.

```
$ find backend/app -type f -name "*.py" | sort
app/core/base.py
app/core/config.py
app/core/database.py
app/core/exceptions.py
app/core/__init__.py
app/core/middleware/cors.py
app/core/middleware/__init__.py
app/core/schemas.py
app/core/uploads/action.py
app/core/uploads/__init__.py
app/core/uploads/models.py
app/core/uploads/service.py
app/main.py
app/modules/{auth,bcc,billing,finance,notifications,products,services,settings,suppliers,warehouse}/
  ... internal_api/interface.py, shared/models.py, shared/dependencies.py, features/
```
Целевое дерево из раздела 2 присутствует полностью: все 10 модулей, у каждого
`internal_api/interface.py`, `shared/models.py`, `shared/dependencies.py`,
`features/`; `core/` содержит config, database, base, schemas, exceptions,
middleware/cors, uploads.

Модели разложены ровно по карте раздела 8:
```
app/core/uploads/models.py:            UploadedFile
app/modules/auth/shared/models.py:     Tenant, User, UserRole, Session,
                                       PermissionItem, RolePermission, UserPermission
app/modules/products/shared/models.py: Category, CategoryField, Product, ProductFieldValue
app/modules/suppliers/shared/models.py: Supplier, SupplierAddress, SupplierContact,
                                       SupplierFile, SupplierAuditEntry, SupplierPriceEntry,
                                       FieldDefinition, SectionConfig, SectionField
app/modules/warehouse/shared/models.py: WarehouseBatch, WarehouseMovement, WarehouseOffcut,
                                       WarehouseDeficit, StockItem, StockAuditEntry
app/modules/billing/shared/models.py:  Plan, TenantPlan, PlanFeature,
                                       TenantFeatureOverride, FeatureDefinition
app/modules/finance/shared/models.py:  FinancePayment, PaymentDocument, DocumentArchiveItem
app/modules/bcc/shared/models.py:      BccCategory, BccEvent
app/modules/settings/shared/models.py: CompanyInfo, GlobalConstants, Currency, Uom,
                                       UomConversion, OrderStatusSetting
app/modules/services/shared/models.py: Service
app/modules/notifications/shared/models.py: Notification
```
То есть выполнены пункты 11–13: `category.py` слит в products, `config.py` разбит
(field config → suppliers, permissions → auth), `upload.py` ушёл в `core/uploads/`.

Alembic (пункты 15–17):
```
$ grep -n "Base\|settings\|_alembic_imports" backend/alembic/env.py
23:from app.core.base import Base  # noqa: E402
24:import _alembic_imports  # noqa: F401, E402
26:target_metadata = Base.metadata
29:from app.core.config import settings  # noqa: E402
```
`backend/alembic/_alembic_imports.py` существует и импортирует все модели всех
модулей плюс `core.uploads` — коллектор метаданных из пункта 16 на месте.
Замечание: план писал путь как `app/alembic/env.py`, фактически alembic лежит в
`backend/alembic/` — расхождение в записи пути в плане, не в коде. 17 миграций.

Демо-слайсы и финал (пункты 18–23):
```
app/modules/products/features/get_product_detail/{action,domain,repository,schemas}.py
app/modules/products/features/create_product/{action,domain,repository,schemas}.py
app/modules/auth/features/me/{action,domain,repository,schemas}.py
app/modules/products/internal_api/interface.py  — 72 строки, реэкспорт
                                                  get_product_by_id / get_category_by_id
app/modules/auth/internal_api/interface.py      — 38 строк, реэкспорт get_user_by_id
```
`app/main.py` импортирует и подключает роутеры products (2), auth (me, login,
register, magic_link), settings (profile, crud), uploads — пункт 23 выполнен
и перевыполнен (в проде появились слайсы, которых план не требовал).

### Что не проверено
Пункт 24 (`python -c "from app.main import app"`) выполнить не удалось: в среде нет
установленного fastapi —
```
$ python3 -c "from app.main import app"
ModuleNotFoundError: No module named 'fastapi'
```
Структурно цепочка импортов согласована (все пути `app.core.*` / `app.modules.*`
существуют), но рантайм-проверка не запускалась.

Мелочь, не расхождение с планом: в `features/{login,me,register,create_product,
get_product_detail}` нет `__init__.py` — план их и не перечислял.

### filesMentioned
Пути из плана (как написаны): backend/app/models, backend/app/models/auth.py,
backend/app/models/billing.py, backend/app/models/product.py,
backend/app/models/category.py, backend/app/models/warehouse.py,
backend/app/models/supplier.py, backend/app/models/finance.py,
backend/app/models/bcc.py, backend/app/models/settings.py,
backend/app/models/config.py, backend/app/models/service.py,
backend/app/models/upload.py, backend/app/models/notification.py,
backend/app/models/base.py, backend/app/config.py, backend/app/database.py,
backend/app/main.py, backend/app/alembic/env.py, backend/app/schemas/common.py,
backend/app/core/base.py, backend/app/core/, backend/app/core/config.py,
backend/app/core/database.py, backend/app/core/schemas.py,
backend/app/core/exceptions.py, backend/app/core/middleware/,
backend/app/core/uploads/, backend/app/modules/, backend/app/_alembic_imports.py

---

## 2. `roo_code/plans/backend/i18n-db-refactoring-plan.md`

**Вердикт: частично**

Незакрытых чекбоксов: 0 (`grep -c` → 0; в плане только «✅»-строки следующих шагов,
не чекбоксы). Пунктов для построчного вердикта нет.

### Что есть

Рекомендованный вариант B (JSONB) внедрён во всех 14 таблицах из таблицы плана,
старых колонок `_ru`/`_en`/`_lt` не осталось нигде:
```
$ grep -rnE "(name|description|company|title|message|property|user_name|code|contact_person|status_reason)_(ru|en|lt)\b" backend/app backend/alembic
   (пусто)
$ grep -rn "_translations" backend/app/modules/*/shared/models.py
suppliers: company_translations, contact_person_translations, status_reason_translations,
           SupplierContact.name_translations, SupplierFile.name_translations,
           SupplierAuditEntry.user_name_translations, .property_translations,
           SectionConfig.name_translations
auth:      PermissionItem.name_translations
settings:  Currency.name_translations, Uom.code_translations, Uom.name_translations,
           OrderStatusSetting.name_translations
billing:   FeatureDefinition.name_translations, .description_translations
notifications: title_translations, message_translations
warehouse: StockAuditEntry.user_name_translations, .property_translations
services:  name_translations, description_translations
bcc:       BccCategory.name_translations
```
Все — `mapped_column(JSONB, ... server_default="{}")`, как в фазе 2 плана.

Фаза 3 — `TranslatedString` переведён на динамические локали (второй вариант из плана,
«если оставить Pydantic»):
```
$ cat backend/app/core/schemas.py
class TranslatedString(BaseModel):
    """Locale-keyed string. Any key = language code (ru, en, lt, de, fr, etc.)."""
    ru: str = ""
    en: str = ""
    lt: str = ""
    # Allow dynamic locale keys beyond the three defaults
    model_config = {"extra": "allow"}
```
Хелперы `translated_string_to_columns()` / `columns_to_translated_string()` удалены:
```
$ grep -rn "translated_string_to_columns\|columns_to_translated_string" backend/app
   (пусто)
```
Фаза 4 — маппинг тривиальный, чтение JSONB по ключам локали работает:
`backend/app/modules/settings/features/crud/repository.py:156-164` фильтрует
`UomModel.code_translations["en"].as_string()` и т.п.

Последний шаг плана («обновить `create-api-service` skill — убрать упоминания
`_ru`/`_en`/`_lt` хелперов») закрыт: файла `create-api-service.md` в
`roo_code/skills/` нет, его заменил `create-api-feature.md`, где `_ru` упомянут
единственный раз как запрет — `create-api-feature.md:93: ❌ NOT name_ru, name_en,
name_lt (three separate columns)`.

### Чего нет

GIN-индексы на JSONB-колонках (шаг 5 фазы 1 плана,
`op.create_index(..., postgresql_using="gin")`) не созданы ни в одной миграции:
```
$ grep -rniE "using gin|gin\b" backend/alembic/versions backend/app | grep -v engine/begin/login/origin/margin/plugin
   (пусто)
$ grep -rn "postgresql_using" backend/alembic/versions
   (пусто)
```
То есть «поиск/фильтрация по переводам через GIN» — заявленный плюс варианта B —
в схеме не реализован; фильтр по локали в settings/crud идёт без индекса.

Отдельно: пошаговая миграция данных из фазы 1 (add JSONB → backfill
`jsonb_build_object` → drop `_ru`/`_en`/`_lt`) в репозитории отсутствует, потому
что она стала не нужна — таблицы создаются с JSONB сразу (в миграциях нет ни
одной колонки `_ru`). Это не долг, а другой путь к тому же состоянию; но и
доказательства прогона тестов после рефакторинга (шаг 5 «следующих шагов») нет —
backend-тестов в репозитории не найдено.

### filesMentioned
Пути из плана (как написаны): backend/app/models/service.py,
backend/app/models/supplier.py, backend/app/models/bcc.py,
backend/app/models/config.py, backend/app/models/settings.py,
backend/app/models/billing.py, backend/app/models/notification.py,
backend/app/models/warehouse.py, backend/app/schemas/common.py,
roo_code/skills/create-api-service.md
