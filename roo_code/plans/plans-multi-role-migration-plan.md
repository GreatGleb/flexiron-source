# Plan: Plans & Multi-Role Migration — Phase 12

**Domain:** Auth / Billing (authorization system)
**Skill:** [`create-api-service.md`](roo_code/skills/create-api-service.md) (ADR-Auth section)
**Migration revision:** [`8cf3bfa380dd`](backend/app/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py)

---

## TZ (Summary)

Создание недостающих моделей БД для системы авторизации Flexiron: тарифные планы (Plan), связь компания→план (TenantPlan), feature flags в составе плана (PlanFeature), переопределение фич компанией (TenantFeatureOverride), справочник всех feature keys (FeatureDefinition), и many-to-many роли пользователей (UserRole).

Алгоритм проверки прав — **explicit deny wins**:
1. UserPermission override (высший приоритет)
2. Любая роль: explicit DENY → DENY
3. Любая роль: explicit ALLOW → ALLOW
4. TenantFeatureOverride → PlanFeature → Default DENY

### Что создаётся

| Модель | Файл | Описание |
|--------|------|----------|
| [`Plan`](backend/app/models/billing.py:12) | `billing.py` | Тарифный план (name, slug, description, is_active) |
| [`TenantPlan`](backend/app/models/billing.py:42) | `billing.py` | M2M компания→план (tenant_id, plan_id, is_active, assigned_at) |
| [`PlanFeature`](backend/app/models/billing.py:73) | `billing.py` | Feature flag внутри плана (plan_id, feature_key, is_allowed, is_denied) |
| [`TenantFeatureOverride`](backend/app/models/billing.py:109) | `billing.py` | Компания переопределяет план (tenant_id, feature_key, is_allowed, is_denied) |
| [`FeatureDefinition`](backend/app/models/billing.py:138) | `billing.py` | Справочник всех feature keys (key, name_ru/en/lt, description_ru/en/lt, level, is_system) |
| [`UserRole`](backend/app/models/auth.py:108) | `auth.py` | M2M пользователь→роль (user_id, role_name) |

### Что изменяется

| Файл | Изменение |
|------|-----------|
| [`auth.py`](backend/app/models/auth.py) | Добавлен `UserRole`, в `User` добавлен `roles: Mapped[list[UserRole]]` relationship |
| [`__init__.py`](backend/app/models/__init__.py) | Добавлены импорты `UserRole` и всех billing моделей |

### Feature Definition data migration

В миграции `8cf3bfa380dd` выполняется `op.bulk_insert()` в таблицу `feature_definitions` — **46 записей** всех флагов из [`featureFlags.ts`](frontend_vue/src/config/featureFlags.ts) с переводами на RU/EN/LT.

---

## API Endpoints (future, не в этой фазе)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/plans` | Список тарифных планов (все активные) |
| GET | `/api/plans/:id` | Детали плана + его фичи |
| POST | `/api/plans` | Создать план (admin) |
| PATCH | `/api/plans/:id` | Обновить план |
| DELETE | `/api/plans/:id` | Удалить план |
| GET | `/api/tenants/:id/plans` | Планы компании |
| PUT | `/api/tenants/:id/plans` | Назначить планы компании (bulk replace) |
| GET | `/api/tenants/:id/feature-overrides` | Переопределения фич компании |
| PUT | `/api/tenants/:id/feature-overrides` | Обновить переопределения (bulk replace) |
| GET | `/api/feature-definitions` | Все feature keys (для админки) |
| GET | `/api/users/:id/roles` | Роли пользователя |
| PUT | `/api/users/:id/roles` | Назначить роли (bulk replace) |

---

## Key Types (Python/SQLAlchemy)

### Plan
```python
class Plan(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "plans"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # relationships: tenant_links, features
```

### UserRole
```python
class UserRole(UUIDMixin, Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)
    # UniqueConstraint(user_id, role_name)
```

---

## Implementation Steps

### Step 1: ORM Models ✅
- [x] [`billing.py`](backend/app/models/billing.py) — все 5 моделей
- [x] [`auth.py`](backend/app/models/auth.py) — `UserRole` + `User.roles` relationship
- [x] [`__init__.py`](backend/app/models/__init__.py) — все новые экспорты
- [x] **Import check:** `python -c "from app.models import *"` — ✅ OK

### Step 2: Alembic Migration ✅
- [x] Создана ревизия: [`8cf3bfa380dd`](backend/app/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py)
- [x] `upgrade()` — создаёт 6 таблиц + data migration (46 feature definitions)
- [x] `downgrade()` — удаляет все 6 таблиц
- [x] Parent revision: `7bf1730620f0` (phase_11_notifications)
- [x] Syntax check: `ast.parse(migration_file)` — ✅ OK

### Step 3: Verification
- [ ] `cd backend && alembic upgrade head` — применить миграцию к БД
- [ ] `cd backend && python -c "from app.models.billing import *; from app.models.auth import UserRole; print('OK')"`
- [ ] Проверить, что `feature_definitions` содержит 46 записей

### Step 4: Plan Document
- [x] [`roo_code/plans/plans-multi-role-migration-plan.md`](roo_code/plans/plans-multi-role-migration-plan.md)

---

## Feature Flag List (46 flags)

Страница-уровень (`level='page'`): `adminDashboard`, `adminWarehouse`, `adminSales`, `adminSupply`, `adminStaff`, `adminLogistics`, `adminPlReport`, `adminDeficit`, `suppliersList`, `supplierCard`, `supplierCreate`, `supplierCardConfig`, `bccRequest`, `adminCategories`, `adminProducts`, `adminServices`, `adminClients`, `adminOrders`, `adminSalesCrm`, `adminSettings`, `notificationsPage`, `adminFinance`, `financeIncoming`, `financeOutgoing`, `financeDocumentArchive`

Секция-уровень (`level='section'`): `dashboardAlerts`, `dashboardCharts`, `supplierKanbanView`, `supplierExport`, `bccHistory`, `permissionsEditor`, `categoryFieldReorder`, `categorySupplierLinks`, `productSupplierLinks`, `warehouseOffcuts`, `warehouseDeficit`, `warehouseQrPrint`, `warehouseStockPageConfig`, `warehouseBatchesPageConfig`, `warehouseOffcutsPageConfig`, `warehouseMovementsPageConfig`, `warehouseDeficitPageConfig`, `orderKanbanView`, `orderDocumentGen`, `orderCuttingTool`, `warehouseOffcutCreate`

---

## Dependency Graph

```
tenant_feature_overrides ──→ tenants
          ↑
    (tenant override wins)
          │
plan_features ──→ plans ←── tenant_plans ──→ tenants
     │                  ↑
     │            (M2M junction)
     └── feature_definitions (registry, no FK)
     
user_roles ──→ users
     ↑
(multi-role M2M)
```

---

## Permission Resolution Order

```
UserPermission.check(user_id, item_id, action)
  │
  ├─ 1. UserPermission exists? → return can_X (override)
  ├─ 2. For EACH role in user.roles:
  │     ├─ RolePermission.can_X == False → DENY (immediate)
  │     └─ RolePermission.can_X == True → remember ALLOW
  ├─ 3. Any role ALLOWed? → return True
  ├─ 4. TenantFeatureOverride? → return is_allowed (not is_denied)
  ├─ 5. Any PlanFeature for tenant's plans?
  │     ├─ is_denied == True → DENY (deny wins between plans)
  │     └─ is_allowed == True → remember ALLOW
  └─ 6. Default: False (DENY)
```
