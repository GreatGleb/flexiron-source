# Инвентаризация планов — часть 025

## roo_code/plans/plans-multi-role-migration-plan.md

**Вердикт: частично**

Незакрытых чекбоксов: 3 (все — Step 3 «Verification»).

### Что есть

Все ORM-модели плана существуют, но НЕ по путям, указанным в плане
(`backend/app/models/billing.py`, `backend/app/models/auth.py` — такого каталога вообще нет,
`ls backend/app/models/` → `No such file or directory`). Код переехал в модульную раскладку:

```
$ grep -rn "class Plan\b\|class TenantPlan\|class PlanFeature\|class TenantFeatureOverride\|class FeatureDefinition\|class UserRole" backend/ --include=*.py
backend/app/modules/auth/shared/models.py:87:class UserRole(UUIDMixin, Base):
backend/app/modules/billing/shared/models.py:11:class Plan(UUIDMixin, TimestampMixin, Base):
backend/app/modules/billing/shared/models.py:37:class TenantPlan(UUIDMixin, Base):
backend/app/modules/billing/shared/models.py:75:class PlanFeature(UUIDMixin, Base):
backend/app/modules/billing/shared/models.py:108:class TenantFeatureOverride(UUIDMixin, TimestampMixin, Base):
backend/app/modules/billing/shared/models.py:137:class FeatureDefinition(UUIDMixin, TimestampMixin, Base):
```

`User.roles` relationship есть — `backend/app/modules/auth/shared/models.py:78-80`
(`roles: Mapped[list["UserRole"]] = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")`),
`UserRole` с `UniqueConstraint("user_id","role_name", name="uq_user_role")` — строки 87–110.

Экспорты: `backend/app/models/__init__.py` из плана не существует; его роль исполняет
`backend/alembic/_alembic_imports.py`, где импортированы и `UserRole` (из auth), и все пять
billing-моделей.

Миграция есть, но по пути `backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py`
(в плане — `backend/app/alembic/versions/...`, такого каталога нет):

```
$ grep -n "^revision\|^down_revision" backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py
18:revision: str = "8cf3bfa380dd"
19:down_revision: Union[str, Sequence[str], None] = "7bf1730620f0"

$ grep -c "op.create_table(" ...8cf3bfa380dd...py
6
таблицы: plans, tenant_plans, plan_features, tenant_feature_overrides, feature_definitions, user_roles
downgrade(): drop_table x6 (user_roles, feature_definitions, tenant_feature_overrides, plan_features, tenant_plans, plans)

$ python3 -c "import ast;ast.parse(open(...).read());print('AST OK')"
AST OK
```

Ревизия встроена в цепочку: `64f1eca13a01_add_vat_code_to_tenant.py` имеет
`down_revision = '8cf3bfa380dd'`. Parent `7bf1730620f0` (phase_11_notifications) — совпадает с планом.

Data migration: `op.bulk_insert` в `feature_definitions` из списка `FEATURE_FLAGS`,
в нём ровно 46 ключей (подсчёт разбором блока `FEATURE_FLAGS = [...]`), и список совпадает
с перечнем 46 флагов в плане.

### Чего нет

1. **Step 3 не выполнен и выполнен быть не может в текущем окружении.** База `flexiron`
   вообще отсутствует:
```
$ docker exec orderflow_postgres psql -U postgres -l
 Name      | ... : postgres, template0, template1  (3 rows)
```
   DATABASE_URL в `backend/.env` указывает на `.../flexiron` — такой БД нет, значит
   `alembic upgrade head` никогда не применялся, `alembic_version` не существует,
   и 46 записей в `feature_definitions` проверить негде.
2. Питон-зависимости не установлены — import-check из Step 1/Step 3 сейчас не проходит:
```
$ python3 -c "import sqlalchemy" → ModuleNotFoundError: No module named 'sqlalchemy'
```
   (в `backend/` нет venv; отмеченный в плане `[x] Import check` ничем в репозитории не подтверждён).
3. **Расхождение схемы с текстом плана.** План описывает `FeatureDefinition` как
   `key, name_ru/en/lt, description_ru/en/lt, level, is_system`. В коде и в миграции —
   JSONB-поля `name_translations` / `description_translations`
   (`backend/app/modules/billing/shared/models.py:145-146`). Переводы на RU/EN/LT на месте,
   но форма колонок другая, чем в плане.
4. **Реестр отстал от фронтенда.** Миграция сеет 46 ключей, а
   `frontend_vue/src/config/featureFlags.ts` содержит 52: лишние в коде и отсутствующие в
   `feature_definitions` — `orderInvoicesPayments`, `orderReturns`, `orderShipments`,
   `settingsAuditLog`, `warehouseCutting`, `warehouseMap`. Плану это не противоречит
   (на момент написания было 46), но «единственный источник истины» уже неполон.
5. Побочно замечено: у alembic две головы — `15f2c7d4e9b0` и `a1b2c3d4e5f6`, обе с
   `down_revision = 'bbd27a3881a5'`. `alembic upgrade head` из Step 3 на такой цепочке
   упадёт с «Multiple heads». К этому плану отношения не имеет, но блокирует его Step 3.
6. API-эндпоинтов из раздела «future» нет: `backend/app/modules/billing/features/` содержит
   только `__init__.py`. План их в эту фазу и не включал.

### Пункты (незакрытые чекбоксы)

| Пункт | Вердикт | Доказательство |
|---|---|---|
| `cd backend && alembic upgrade head` — применить миграцию к БД | не начато | `docker exec orderflow_postgres psql -U postgres -l` → только postgres/template0/template1; БД `flexiron` нет, `alembic_version` негде быть |
| `cd backend && python -c "from app.models.billing import *; from app.models.auth import UserRole; print('OK')"` | не начато | путь `app.models` не существует (`ls backend/app/models/` → No such file or directory); плюс `python3 -c "import sqlalchemy"` → ModuleNotFoundError. Команда в этой формулировке невыполнима; актуальные пути — `app.modules.billing.shared.models`, `app.modules.auth.shared.models` |
| Проверить, что `feature_definitions` содержит 46 записей | частично | в миграции 46 ключей (разбор блока `FEATURE_FLAGS`, список совпал с планом), но в БД проверить нельзя — таблицы нет, БД нет |

### filesMentioned (как в плане)

- backend/app/models/billing.py
- backend/app/models/auth.py
- backend/app/models/__init__.py
- backend/app/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py
- frontend_vue/src/config/featureFlags.ts
