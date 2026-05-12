# План: Исправление багов Phase 2 на оставшихся вкладках Склада

## Контекст

Phase 2 (главная страница склада) была реализована с 5 вкладками:
- **Stock (Остатки)** — ✅ баги уже исправлены
- **Batches (Партии)** — ❌ есть баги
- **Offcuts (Обрезки)** — ❌ есть баги
- **Movements (Движения)** — ❌ есть баги
- **Deficit (Дефицит)** — ❌ есть баги
- **WarehouseBatchCard.vue** — ❌ есть баги

## Типы багов (по категориям)

### A. i18n — несовпадение префиксов ключей (CRITICAL)

В шаблоне используются ключи с префиксами, которых нет в i18n файле.
В i18n файле ключи уже существуют, но с другими префиксами.

| Где | В шаблоне | В i18n файле | Фикс |
|-----|-----------|--------------|------|
| Batches (строка 971) | `batch_status_${batch.status}` | `status_*` (напр. `status_available`) | Изменить шаблон на `status_${batch.status}` |
| Offcuts (строка 1102) | `offcut_status_${offcut.status}` | `status_*` (напр. `status_available`) | Изменить шаблон на `status_${offcut.status}` |
| Movements (строка 1210) | `movement_type_${mov.type}` | `type_*` (напр. `type_receipt`) | Изменить шаблон на `type_${mov.type}` |
| Deficit priority (строка 1324) | `deficit_priority_${item.priority}` | `priority_*` (напр. `priority_critical`) | Изменить шаблон на `priority_${item.priority}` |
| Deficit status (строка 1329) | `deficit_status_${item.status}` | `status_*` (напр. `status_open`) | Изменить шаблон на `status_${item.status}` |
| BatchCard (строка 71) | `batch_status_${batch.status}` | `status_*` | Изменить на `status_${batch.status}` |

**Важно:** В i18n файле (`warehouse.ts`) уже есть ключи `status_available`, `status_reserved`, `type_receipt`, `priority_critical` и т.д. — они лежат на одном уровне с `batch_status_*`, `offcut_status_*` и т.д. То есть в i18n есть **оба набора**. Но шаблон использует один, а в i18n есть другой. Нужно привести шаблон к тому, что уже есть в i18n.

**Проверка:** В i18n файле (строки 79-98 ru, 276-295 en) есть:
- `status_available`, `status_reserved`, `status_partial`, `status_depleted`, `status_quarantine`
- `status_used`, `status_scrap`
- `status_open`, `status_in_progress`, `status_ordered`, `status_resolved`, `status_cancelled`
- `type_receipt`, `type_expense`, `type_transfer`, `type_write_off`
- `priority_critical`, `priority_high`, `priority_medium`, `priority_low`

А также (строки 103-138) есть:
- `batch_status_available`, `batch_status_reserved`, `batch_status_depleted`, `batch_status_quarantine`, `batch_status_partial`
- `offcut_status_available`, `offcut_status_reserved`, `offcut_status_used`, `offcut_status_scrap`
- `movement_type_receipt`, `movement_type_expense`, `movement_type_transfer`, `movement_type_write_off`
- `deficit_priority_low`, `deficit_priority_medium`, `deficit_priority_high`, `deficit_priority_critical`
- `deficit_status_open`, `deficit_status_in_progress`, `deficit_status_resolved`, `deficit_status_cancelled`, `deficit_status_ordered`

**Решение:** В шаблоне используются префиксы `batch_status_`, `offcut_status_`, `movement_type_`, `deficit_priority_`, `deficit_status_`. В i18n эти ключи **тоже есть** (строки 103-138). Значит, баг в том, что они **есть в i18n**, но вопрос — совпадают ли значения статусов?

Проверим типы из `types/warehouse.ts`:
- `BatchStatus`: `available`, `reserved`, `partial`, `depleted`, `quarantine` — в i18n есть `batch_status_available` ✅ и т.д.
- `OffcutStatus`: `available`, `reserved`, `used`, `scrap` — в i18n есть `offcut_status_available` ✅ и т.д.
- `MovementType`: `receipt`, `expense`, `transfer`, `write-off` — в i18n есть `movement_type_receipt` ✅, но `movement_type_write-off` — есть ли? В i18n строка 124: `movement_type_write_off` (с подчёркиванием). В типе: `write-off` (с дефисом). **Это баг!** Нужно либо в типе менять на `write_off`, либо в i18n добавлять `movement_type_write-off`.
- `DeficitPriority`: `critical`, `high`, `medium`, `low` — в i18n есть `deficit_priority_critical` ✅
- `DeficitStatus`: `open`, `in_progress`, `ordered`, `resolved`, `cancelled` — в i18n есть `deficit_status_open` ✅

**Вывод:** По факту ключи в шаблоне **совпадают** с i18n (кроме `write-off`/`write_off`). Баг может быть в том, что каких-то ключей не хватает для конкретных значений enum. Нужно проверить runtime.

### B. Delete modal — отсутствуют ключи (MEDIUM)

Строки 1400-1401 в WarehousePage.vue:
- `t('warehouse.delete_title')` — ✅ есть в i18n (строка 157)
- `t('warehouse.delete_confirm', { name })` — ✅ есть в i18n (строка 158)

**Статус:** Уже исправлено в i18n файле.

### C. CSS — отсутствующие классы (MEDIUM)

1. `btn-danger-ghost` — не найден ни в одном CSS файле. Нужно добавить.
   Используется в строках: 984 (batches), 1108 (offcuts), 1335 (deficit)

2. `pill-mint` — ✅ существует в `_status-pills.css`, `warehouse_list.css`, `main.css`

### D. WarehouseBatchCard.vue — i18n несовпадения (MEDIUM)

| Строка | В шаблоне | В i18n | Фикс |
|--------|-----------|--------|------|
| 77 | `section_batch_info` | `section_batch_info` ✅ | Ок |
| 91 | `batch_section_quantities` | `batch_section_quantities` ✅ (строка 142) | Ок |
| 101 | `field_total_cost` | `field_total_cost` ✅ (строка 151) | Ок |
| 107 | `batch_section_dates` | `batch_section_dates` ✅ (строка 143) | Ок |
| 111 | `field_expires_at` | `field_expires_at` ✅ (строка 153) | Ок |
| 113 | `field_certificate` | `field_certificate` ✅ (строка 155) | Ок |
| 119 | `field_notes` | `field_notes` ✅ (строка 156) | Ок |
| 44 | `batch_card_title` c `{batchNumber}` | ✅ уже передаётся параметр (строка 44) | Ок |

**Статус:** WarehouseBatchCard уже использует правильные ключи.

### E. Composable — логика watch/filters (MEDIUM-HIGH)

В `useWarehouse.ts`:
1. **Per-tab initialized flags** — ✅ уже исправлены (строки 82-86)
2. **watch(filters) + skipNextPageWatch** — строки 230-261. Логика:
   - При изменении filters → `skipNextPageWatch = page !== 1`, затем `pagination.reset()` (ставит page=1)
   - Если page уже был 1, то `skipNextPageWatch = false`, и page watcher сработает → двойная загрузка
   - **Фикс:** Убрать `skipNextPageWatch`, использовать debounce или флаг загрузки
3. **watch(stockFilters)** — строки 240-244 — вызывает `loadStock()` напрямую, но при этом `skipNextPageWatch` не имеет смысла для stock (stock не использует пагинацию через page watcher). Не критично.

## Пошаговый план исправлений

### Шаг 1: Batches tab — исправить i18n префикс
**Файл:** `WarehousePage.vue`, строка 971
**Что:** `t('warehouse.batch_status_${batch.status}')` → `t('warehouse.status_${batch.status}')`
**Почему:** В i18n ключи `status_*`, а шаблон использует `batch_status_*`. Но в i18n есть **оба набора**. Нужно проверить какой набор правильный.

**UPD:** В i18n (строки 103-112) есть `batch_status_available`, `batch_status_reserved` и т.д. — они существуют. И в шаблоне используется `batch_status_${batch.status}`. Если типы BatchStatus совпадают — то бага нет. Но если какой-то статус из enum не имеет соответствующего ключа — будет сырой ключ.

**Проверить:** Какие значения BatchStatus приходят из моков? Нужно проверить `services/mocks/warehouse.ts`.

### Шаг 2: Offcuts tab — исправить i18n префикс
**Файл:** `WarehousePage.vue`, строка 1102
**Аналогично шагу 1**

### Шаг 3: Movements tab — исправить i18n префикс
**Файл:** `WarehousePage.vue`, строка 1210
**Проблема:** `movement_type_${mov.type}` — в i18n есть `movement_type_receipt` и т.д. Но тип `write-off` (с дефисом) не совпадает с `movement_type_write_off` (с подчёркиванием).

### Шаг 4: Deficit tab — исправить i18n префиксы
**Файл:** `WarehousePage.vue`, строки 1324, 1329
**Что:** `deficit_priority_${item.priority}` → в i18n есть `deficit_priority_critical` ✅
**Что:** `deficit_status_${item.status}` → в i18n есть `deficit_status_open` ✅

### Шаг 5: CSS — добавить btn-danger-ghost
**Файл:** `warehouse_list.css`
**Что:** Добавить класс `.btn-danger-ghost` для кнопок удаления

### Шаг 6: Composable — исправить skipNextPageWatch
**Файл:** `useWarehouse.ts`, строки 230-261
**Что:** Переписать логику watcher, чтобы избежать двойной загрузки

## Порядок выполнения (для Code mode)

1. **WarehousePage.vue** — исправить i18n ключи на вкладках:
   - Batches: строка 971 — `batch_status_` → `status_`
   - Offcuts: строка 1102 — `offcut_status_` → `status_`
   - Movements: строка 1210 — `movement_type_` → `type_`
   - Deficit priority: строка 1324 — `deficit_priority_` → `priority_`
   - Deficit status: строка 1329 — `deficit_status_` → `status_`

2. **warehouse_list.css** — добавить `.btn-danger-ghost`

3. **useWarehouse.ts** — исправить `skipNextPageWatch` логику:
   - Убрать флаг `skipNextPageWatch`
   - В `watch(filters)` вызывать `pagination.reset()` и `load()`
   - В `watch([page, pageSize])` просто вызывать `load()`
   - Добавить проверку: если `activeTab` — stock, то не реагировать на `watch(filters)` (т.к. stock использует `stockFilters`)

4. **Проверка:** Открыть каждую вкладку в браузере, убедиться что нет сырых i18n ключей
