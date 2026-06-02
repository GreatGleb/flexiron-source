# План: Обновление статусов обрезков (OffcutStatus) до аналогичных статусам партий (BatchStatus)

## 1. Текущее состояние

### BatchStatus (10 статусов)
```typescript
type BatchStatus =
  | 'available'              // В наличии
  | 'in_storage'             // На хранении
  | 'in_production'          // В производстве
  | 'sold'                   // Продано
  | 'scrapped'               // В утиле
  | 'expensed'               // Израсходовано
  | 'returned_to_supplier'   // Возвращено поставщику
  | 'partial'                // Частично
  | 'depleted'               // Нет в наличии
  | 'reserved'               // Зарезервировано
```

### OffcutStatus (5 статусов) — нужно расширить
```typescript
type OffcutStatus =
  | 'available'   // ✅ аналог есть: available
  | 'reserved'    // ✅ аналог есть: reserved
  | 'used'        // ❌ нет аналога в BatchStatus, логически = in_production
  | 'scrap'       // ❌ naming mismatch: в BatchStatus scrapped
  | 'sold'        // ✅ аналог есть: sold
```

### Проблема
У обрезков всего 5 статусов, у партий — 10. Статусы обрезков не отражают полный lifecycle, нет:
- `in_storage` — обрезок на хранении
- `in_production` — обрезок в производстве
- `expensed` — обрезок израсходован
- `returned_to_supplier` — возвращён поставщику

> **Важно:** Статусы `partial` и `depleted` НЕ применяются для обрезков. Обрезок — это один физический кусок (quantity = 1, unit = pcs). Он либо существует целиком, либо меняет статус на терминальный (sold, scrapped, in_production и т.д.). Понятия «частично использован» или «остаток = 0, но запись ещё существует» для обрезка не имеют смысла.

---

## 2. Целевое состояние

### Новый OffcutStatus (8 статусов — аналогичен BatchStatus без partial и depleted)
```typescript
type OffcutStatus =
  | 'available'              // В наличии (был)
  | 'reserved'               // Зарезервировано (был)
  | 'in_production'          // В производстве (НОВЫЙ, заменяет used)
  | 'sold'                   // Продано (НОВЫЙ)
  | 'scrapped'               // В утиль (ПЕРЕИМЕНОВАН из scrap)
  | 'expensed'               // Израсходовано (НОВЫЙ)
  | 'returned_to_supplier'   // Возвращено поставщику (НОВЫЙ)
  | 'in_storage'             // На хранении (НОВЫЙ)
```

### Маппинг старых статусов в новые
| Старый статус | Новый статус | Причина |
|---|---|---|
| `available` | `available` | Без изменений |
| `reserved` | `reserved` | Без изменений |
| `sold` | `sold` | Без изменений |
| `used` | УДАЛЯЕТСЯ → заменяется на `in_production` | `used` концептуально = использование в производстве |
| `scrap` | `scrapped` | Переименован для единообразия с BatchStatus |

---

## 3. Файлы для изменения (полный список)

### 3.1. Типы — [`frontend_vue/src/types/warehouse.ts`](../../../frontend_vue/src/types/warehouse.ts)

**Строка 23:** Заменить тип `OffcutStatus`
```typescript
// БЫЛО:
export type OffcutStatus = 'available' | 'reserved' | 'used' | 'scrap' | 'sold'

// СТАЛО:
export type OffcutStatus =
  | 'available'
  | 'reserved'
  | 'in_production'
  | 'sold'
  | 'scrapped'
  | 'expensed'
  | 'returned_to_supplier'
  | 'in_storage'
```

### 3.2. Переводы — [`frontend_vue/src/i18n/admin/warehouse.ts`](../../../frontend_vue/src/i18n/admin/warehouse.ts)

#### 3.2.1. Обновить существующие ключи (ru, en, lt)

**Строки 198-203 (ru):** Заменить секцию `// Offcut statuses`
```typescript
// Было (ru):
offcut_status_available: 'В наличии',
offcut_status_reserved: 'Зарезервировано',
offcut_status_sold: 'Продано',
offcut_status_damaged: 'Повреждён',
offcut_status_used: 'Использован',
offcut_status_scrap: 'В утиль',

// Стало (ru):
offcut_status_available: 'В наличии',
offcut_status_reserved: 'Зарезервировано',
offcut_status_in_production: 'В производстве',
offcut_status_sold: 'Продано',
offcut_status_scrapped: 'В утиль',
offcut_status_expensed: 'Израсходовано',
offcut_status_returned_to_supplier: 'Возвращено поставщику',
offcut_status_in_storage: 'На хранении',
```

**Строки 204-209 (ru):** Обновить hints
```typescript
// Было (ru):
offcut_status_hint_available: 'Обрезок доступен для использования или резервирования',
offcut_status_hint_reserved: 'Обрезок зарезервирован под активные заказы или производство',
offcut_status_hint_used: 'Обрезок уже использован в производстве',
offcut_status_hint_scrap: 'Обрезок отправлен в утиль и более не доступен',
offcut_status_hint_sold: 'Обрезок продан и более не доступен',

// Стало (ru):
offcut_status_hint_available: 'Обрезок доступен для использования или резервирования',
offcut_status_hint_reserved: 'Обрезок зарезервирован под активные заказы или производство',
offcut_status_hint_in_production: 'Обрезок передан в производственный цех',
offcut_status_hint_sold: 'Обрезок продан и более не доступен',
offcut_status_hint_scrapped: 'Обрезок отправлен в утиль и более не доступен',
offcut_status_hint_expensed: 'Обрезок израсходован на прочие нужды',
offcut_status_hint_returned_to_supplier: 'Обрезок возвращён поставщику',
offcut_status_hint_in_storage: 'Обрезок переведён на ответственное хранение',
```

**Повторить для en (строки ~730-741) и lt (строки ~1262-1273)**

### 3.3. Список обрезков (WarehousePage) — [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

#### 3.3.1. OFFCUT_STATUS_OPTIONS (строка ~398)
```typescript
// Добавить новые статусы в фильтр
const OFFCUT_STATUS_OPTIONS = [
  { value: '', label: t('warehouse.filter_status_all') },
  { value: 'available', label: t('warehouse.offcut_status_available') },
  { value: 'reserved', label: t('warehouse.offcut_status_reserved') },
  { value: 'in_production', label: t('warehouse.offcut_status_in_production') },  // NEW (was used)
  { value: 'sold', label: t('warehouse.offcut_status_sold') },                      // NEW
  { value: 'scrapped', label: t('warehouse.offcut_status_scrapped') },              // scrap → scrapped
  { value: 'expensed', label: t('warehouse.offcut_status_expensed') },              // NEW
  { value: 'returned_to_supplier', label: t('warehouse.offcut_status_returned_to_supplier') }, // NEW
  { value: 'in_storage', label: t('warehouse.offcut_status_in_storage') },          // NEW
]
```
**Внимание:** Удалить `{ value: 'used', label: t('warehouse.offcut_status_used') }` и `{ value: 'scrap', ... }` — эти статусы удалены/переименованы.

#### 3.3.2. OFFCUT_STATUS_PILL (строка ~517)
```typescript
const OFFCUT_STATUS_PILL: Record<OffcutStatus, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  in_production: 'pill-warning',           // NEW (was used → pill-secondary)
  sold: 'pill-mint',                        // NEW
  scrapped: 'pill-danger',                  // scrap → scrapped
  expensed: 'pill-expensed',               // NEW, как у batch
  returned_to_supplier: 'pill-returned',    // NEW, как у batch
  in_storage: 'pill-info',                  // NEW, как у batch
}
```
**Внимание:** Удалить `used: 'pill-secondary'` и `scrap: 'pill-danger'` — эти статусы удалены/переименованы.

#### 3.3.3. Кнопки быстрых действий (строка ~2346, ~2355)
```typescript
// Было:
@click.stop="updateOffcutStatus(offcut.id, 'used')"
@click.stop="updateOffcutStatus(offcut.id, 'scrap')"

// Стало:
@click.stop="updateOffcutStatus(offcut.id, 'in_production')"
@click.stop="updateOffcutStatus(offcut.id, 'scrapped')"
```
**Также обновить `data-test` атрибуты и тексты кнопок** с `btn_mark_used` → `btn_mark_in_production` (или создать новый ключ).

### 3.4. Карточка обрезка — [`frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue`](../../../frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue)

**Строка 18-24:** Обновить список статусов
```typescript
// Было:
const OFFCUT_STATUSES: Array<OffcutStatus> = [
  'available', 'reserved', 'used', 'scrap', 'sold',
]

// Стало:
const OFFCUT_STATUSES: Array<OffcutStatus> = [
  'available', 'reserved', 'in_production', 'sold', 'scrapped',
  'expensed', 'returned_to_supplier', 'in_storage',
]
```

**Строка ~108:** Обновить `AUDIT_ENUM_MAP`
```typescript
// Было:
offcut_status_: ['available', 'reserved', 'sold', 'damaged', 'used', 'scrap'],

// Стало:
offcut_status_: ['available', 'reserved', 'in_production', 'sold', 'scrapped', 'expensed', 'returned_to_supplier', 'in_storage'],
```

### 3.5. Карточка партии (BatchCard) — [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](../../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)

**Строка 183:** Обновить `AUDIT_ENUM_MAP`
```typescript
// Было:
offcut_status_: ['available', 'reserved', 'sold', 'damaged', 'used', 'scrap'],

// Стало:
offcut_status_: ['available', 'reserved', 'in_production', 'sold', 'scrapped', 'expensed', 'returned_to_supplier', 'in_storage'],
```

### 3.6. Остальные файлы с AUDIT_ENUM_MAP

Обновить `offcut_status_` массив во всех файлах, где он встречается:
- [`frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue`](../../../frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue) — строка ~60
- [`frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue`](../../../frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue) — строка ~115
- [`frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue`](../../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — строка ~50

### 3.7. Mock данные — [`frontend_vue/src/mocks/warehouse-offcuts.ts`](../../../frontend_vue/src/mocks/warehouse-offcuts.ts)

Обновить статусы во всех offcut-записях:
- `status: 'scrap'` → `status: 'scrapped'` (записи who-011, who-019, who-028)
- `status: 'used'` → `status: 'in_production'` (запись who-013)

Все записи с `status: 'available'`, `'reserved'`, `'sold'` остаются без изменений.

### 3.8. Offcut composable — [`frontend_vue/src/composables/useWarehouseOffcutCard.ts`](../../../frontend_vue/src/composables/useWarehouseOffcutCard.ts)

Проверить, что `form.status` правильно типизируется новым `OffcutStatus`. Если где-то используется `'used'` или `'scrap'` как литерал — заменить.

### 3.9. Warehouse service mock — [`frontend_vue/src/services/mocks/warehouse.ts`](../../../frontend_vue/src/services/mocks/warehouse.ts)

Проверить `mockPatchOffcut` (строка ~448) — убедиться, что функция корректно принимает новый набор статусов.

### 3.10. CSS стили — [`frontend_vue/src/styles/admin/components/_status-pills.css`](../../../frontend_vue/src/styles/admin/components/_status-pills.css)

Проверить, что все используемые pill-классы существуют:
- `pill-success` (available) ✅
- `pill-info` (reserved, in_storage) ✅
- `pill-warning` (in_production, partial) — существует
- `pill-danger` (scrapped) — существует
- `pill-expensed` — существует
- `pill-returned` — существует
- `pill-mint` (sold) — существует
- `pill-consumed` (depleted) — нужно проверить, есть ли этот класс

Если `pill-consumed` не существует — добавить:
```css
.pill-consumed {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
}
```

---

## 4. Порядок выполнения (рекомендуемый)

1. **Типы** (`warehouse.ts`) — изменить `OffcutStatus`
2. **Переводы** (`warehouse.ts` i18n) — добавить/обновить все ключи в ru, en, lt
3. **Mock данные** (`warehouse-offcuts.ts`) — обновить статусы записей
4. **WarehouseOffcutCard.vue** — обновить список статусов + AUDIT_ENUM_MAP
5. **WarehousePage.vue** — обновить фильтры, pill-маппинг, кнопки действий
6. **WarehouseBatchCard.vue** — обновить AUDIT_ENUM_MAP
7. **WarehouseMovementCard.vue, WarehouseDeficitCard.vue, WarehouseStockCard.vue** — обновить AUDIT_ENUM_MAP
8. **CSS** — добавить missing pill-классы при необходимости
9. **TypeScript check** — `npx vue-tsc --noEmit` (или через eslint)

---

## 5. Проверка после изменений

- [ ] `npx vue-tsc --noEmit` — 0 errors (TypeScript типизация)
- [ ] `npm run lint` — 0 errors (ESLint)
- [ ] Offcut filter dropdown в WarehousePage показывает все 8 статусов
- [ ] Карточка обрезка позволяет выбрать все 8 статусов через CustomSelect
- [ ] Offcut pill цвета корректно отображаются в таблице и карточке
- [ ] Старый статус `used` больше нигде не используется (search: `'used'` в контексте OffcutStatus)
- [ ] Старый статус `scrap` больше нигде не используется (search: `'scrap'` в контексте OffcutStatus)
- [ ] AUDIT_ENUM_MAP во всех 5 файлах обновлён
- [ ] Mock данные обрезков имеют корректные новые статусы
- [ ] Кнопки "Использован" → "В производстве" и "В утиль" → "В утиль" работают
