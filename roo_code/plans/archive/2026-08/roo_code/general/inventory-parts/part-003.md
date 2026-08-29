# Инвентаризация планов — часть 003

Каталог: `roo_code/plans/backend`

---

## roo_code/plans/backend/backend-db-schema-alembic-plan.md

**Вердикт: частично**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`) — план описательный, без чек-листа.

### Что план утверждает и требует
Полная схема БД под мульти-тенантность: 11 фаз миграций, ~35 таблиц, Alembic async,
структура `backend/app/models/*.py`, `TranslatedString` → тройки колонок `_ru/_en/_lt`,
`ON DELETE RESTRICT` на всех FK, набор UNIQUE-ограничений. Шапка плана сама помечает
валютный курс отменённым (2026-08-09).

### Доказательства

Миграции — 17 ревизий, все 11 фаз плана присутствуют плюс 6 более поздних:

```
$ ls backend/alembic/versions/
133fae13afbe_phase_5_uploads.py
15f2c7d4e9b0_enlarge_logo_url_to_text.py
25245d4bf874_phase_3_categories_products.py
3a0b5d31bde7_phase_1_tenants_auth_users_sessions.py
4e8c9a3f1b2d_add_secret_link_token_to_users.py
57ba67dda78c_phase_2_settings.py
64f1eca13a01_add_vat_code_to_tenant.py
7bf1730620f0_phase_11_notifications.py
8cf3bfa380dd_phase_12_plans_multi_role.py
a1b2c3d4e5f6_phase_15_product_uom_restructure.py
a8dd7d7ba74b_phase_6_suppliers.py
b2619dfeb90f_phase_10_finance.py
bbd27a3881a5_phase_14_add_currency_uom_fk_to_products.py
d730d0aa32ef_phase_4_services.py
e24a3922ed01_phase_7_config.py
f96e6fb2d5cf_phase_8_bcc.py
fd0ecc1269df_phase_9_warehouse.py
```

Таблицы, создаваемые миграциями (`grep -A1 "op.create_table(" на каждый файл`) — 45 create_table:
uploaded_files; categories, category_fields, products, product_field_values; tenants, users,
sessions; company_info, global_constants, currencies, uoms, uom_conversions, order_statuses;
notifications; plans, tenant_plans, plan_features, tenant_feature_overrides, feature_definitions,
user_roles; suppliers, supplier_addresses, supplier_contacts, supplier_files,
supplier_audit_entries, supplier_price_entries; finance_payments, payment_documents,
document_archive_items; services; field_definitions, section_configs, section_fields,
permission_items, role_permissions, user_permissions; bcc_categories, bcc_events;
warehouse_batches, warehouse_movements, warehouse_offcuts, warehouse_deficits, stock_items,
stock_audit_entries.

Модели (`grep -rn "__tablename__" backend/app --include=*.py` → 45 штук) — тот же список.

Мульти-тенантность: `tenant_id` есть у всех доменных таблиц (проверено скриптом по блокам
классов моделей). Без `tenant_id`: `tenants`, `sessions` (по плану выводится из user),
и вне плана — `plans`, `plan_features`, `feature_definitions`, `user_roles` (фаза 12).
`users.tenant_id` NULLABLE (суперадмин), UNIQUE-индекс
`ix_users_tenant_id_email` на `(tenant_id, email)`.

Фаза 0 выполнена, но по другим путям:
```
backend/pyproject.toml, backend/requirements.txt, backend/alembic.ini   — есть
backend/app/core/config.py   (class Settings)            вместо backend/app/config.py
backend/app/core/database.py (create_async_engine, async_sessionmaker, get_db)
                                                          вместо backend/app/database.py
backend/app/core/base.py     (Base, UUIDMixin, TimestampMixin)
                                                          вместо backend/app/models/base.py
backend/alembic/env.py       (asyncio, target_metadata = Base.metadata)
                                                          вместо backend/app/alembic/env.py
$ ls backend/app/models
ls: cannot access 'app/models': No such file or directory
```
Модели живут в `backend/app/modules/<module>/shared/models.py` (10 файлов) и
`backend/app/core/uploads/models.py` — это результат соседнего плана
`backend-refactor-modular-monolith-plan.md`.

Зависимости из плана в `backend/requirements.txt` все на месте (fastapi, sqlalchemy[asyncio],
alembic, asyncpg, pydantic, pydantic-settings, python-dotenv) плюс uvicorn, python-multipart,
passlib, itsdangerous.

### Чего нет

1. **Таблиц `category_linked_suppliers` и `product_linked_suppliers` нет вовсе** — ни модели,
   ни миграции: `grep -rn "linked_supplier" backend/` → пусто. Плановая ER-диаграмма и фаза 3
   их требуют; в шапке миграции фазы 3 перечислены только categories, category_fields,
   products, product_field_values.
2. **`TranslatedString` хранится JSONB, а не тройками колонок.** План отдельным разделом
   обосновывает «Why not JSONB for TranslatedString?». Реальность обратная:
   `grep -rn "_ru:" backend/app/modules/*/shared/models.py` → 0 совпадений;
   `grep -rln "name_ru" backend/alembic/versions/` → пусто; вместо этого 22 колонки
   `*_translations` типа JSONB (`currencies.name_translations`, `uoms.code_translations`,
   `suppliers.company_translations`, `notifications.title_translations` и т. д.).
   Причина — соседний план `i18n-db-refactoring-plan.md`; миграции переписаны на месте.
3. **`products.price_unit` заменён на FK.** Фазы 14 и 15 добавили `currency_id`,
   `price_quantity`, `purchase_uom_id`, `warehouse_uom_id`, `sale_uom_id` и поля конверсии;
   строкового `price_unit` в модели `Product` нет.
4. **Часть UNIQUE из плана отсутствует:** `products.sku` (план: UNIQUE) — не уникален;
   `uom_conversions UNIQUE(from_uom_id, to_uom_id)` — нет;
   `finance_payments.payment_number` (план: UNIQUE) — `sa.Column("payment_number",
   sa.String(100), nullable=False)`, без unique. Есть, но с добавленным `tenant_id`:
   `ix_currencies_tenant_code`, `uq_field_definitions_tenant_name`, `uq_role_permission`,
   `uq_user_permission`, `ix_product_field_values_product_field`. `sessions.token_hash`
   и `tenants.slug` уникальны как в плане.
5. **`ON DELETE RESTRICT` на всех FK — не выполнено.** В миграциях
   `RESTRICT: 15  CASCADE: 62  SET NULL: 12`.
6. **Композитного индекса `(user_id, is_read)` на notifications нет** — только отдельные
   `index=True` на `user_id`, `is_read`, `created_at`.
7. **Своя же отметка «устарело» не отражена в коде:** шапка плана говорит, что курса нет
   нигде, но `currencies.exchange_rate NUMERIC(12,6) NOT NULL DEFAULT 1` жив и в миграции
   фазы 2, и в модели, и в схемах `settings/features/crud/schemas.py` (`exchangeRate`).
   Из `warehouse_batches` курс убран фазой 15 (`op.drop_column("warehouse_batches",
   "exchange_rate")`).

Применённость миграций к живой БД не проверялась — базы в окружении нет.

### Пункты
Чекбоксов в плане нет (itemsTotal = 0), поэтому пунктовой разбивки не приводится.
