# Инвентаризация планов — часть 055 (roo_code/plans/warehouse, 3 плана)

Код не менялся. Все проверки — чтение и grep из `frontend_vue/`.

---

## 1. roo_code/plans/warehouse/update-offcut-statuses-to-match-batches.md

**Вердикт: частично** (чекбоксов: 10)

### Что уже сделано

Тип расширен до 8 статусов:

```
$ grep -n -A 12 "export type OffcutStatus" src/types/warehouse.ts
35:export type OffcutStatus =
36-  | 'available'
37-  | 'reserved'
38-  | 'in_production'
39-  | 'sold'
40-  | 'scrapped'
41-  | 'expensed'
42-  | 'returned_to_supplier'
43-  | 'in_storage'
```

i18n — все 8 ключей `offcut_status_*` и 8 `offcut_status_hint_*` в ru (207–223), en (889–905), lt (1569–1585). Старых `offcut_status_used`/`_scrap`/`_damaged` нет.

WarehousePage.vue: `OFFCUT_STATUS_OPTIONS` (455–465) — 8 статусов + «все»; `OFFCUT_STATUS_PILL` (557–566) — ровно те классы, что в плане; вызовы `updateOffcutStatus(..., 'in_production')` (2788) и `'scrapped'` (2797).

`offcut_status_:` в AUDIT_ENUM_MAP обновлён во всех 5 файлах — WarehouseMovementCard.vue:60, WarehouseDeficitCard.vue:123, WarehouseStockCard.vue:132, WarehouseBatchCard.vue:268, WarehouseOffcutCard.vue:138 — везде идентичный массив из 8 новых кодов.

WarehouseOffcutCard.vue:22–31 — `OFFCUT_STATUSES` из 8 значений, отдаётся в `statusOptions` для CustomSelect.

Моки: `grep "status: '" src/mocks/warehouse-offcuts.ts | sort | uniq -c` → 8 available, 1 expensed, 1 in_storage, 1 reserved, 1 scrapped, 1 sold. Ни `used`, ни `scrap`. (План описывает записи who-019/who-028 — их в файле нет вообще, всего 13 записей who-001…who-013; описание «текущего состояния» в плане устарело.)

CSS: pill-success/warning/danger/info/mint/expensed/returned есть в `src/styles/admin/components/_status-pills.css` (9–57). `pill-consumed` тоже существует, но в другом файле — `src/styles/admin/warehouse_list.css:635`; он относится к `depleted` у партий, к обрезкам не применяется.

Машинная приёмка:

```
$ npx vue-tsc --noEmit   → пустой вывод, 0 ошибок
$ npm run lint           → пустой вывод, 0 ошибок
```

### Что осталось

1. Легаси-коды `'used'` и `'scrap'` живы в массиве `status_:` того же AUDIT_ENUM_MAP во всех 5 карточках:

```
$ grep -rn "'scrap'\|'used'" src/
src/views/admin/warehouse/WarehouseStockCard.vue:160,161
src/views/admin/warehouse/WarehouseBatchCard.vue:296,297
src/views/admin/warehouse/WarehouseMovementCard.vue:88,89
src/views/admin/warehouse/WarehouseDeficitCard.vue:151,152
src/views/admin/warehouse/WarehouseOffcutCard.vue:166,167
```

Ключей `status_used` / `status_scrap` в i18n нет (`grep "status_used\|status_scrap:"` — пусто), то есть `translateAuditValue` для них вернёт код как есть.

2. Кнопки быстрых действий в WarehousePage.vue (2783–2801): статус пишется новый, но подпись и `data-test` остались старыми — `v-tooltip="t('warehouse.btn_mark_used')"`, `data-test="offcut-mark-used-btn"`, текст `btn_mark_used` = «Использован» (ru), «Mark Used» (en). Раздел 3.3.3 плана прямо требовал переименовать текст и data-test (`btn_mark_used` → `btn_mark_in_production`). E2E ссылается на старые id: `tests/e2e/admin/warehouse/warehouse.spec.ts:142,143,148,149`.

### Пункты плана

| Пункт | Вердикт | Доказательство |
|---|---|---|
| `npx vue-tsc --noEmit` — 0 errors | сделано | пустой вывод |
| `npm run lint` — 0 errors | сделано | пустой вывод |
| Offcut filter dropdown показывает все 8 статусов | сделано | WarehousePage.vue:455-465 |
| Карточка обрезка позволяет выбрать все 8 статусов через CustomSelect | сделано | WarehouseOffcutCard.vue:22-38 |
| Offcut pill цвета корректно отображаются | сделано | OFFCUT_STATUS_PILL 557-566 + _status-pills.css 9-57; подписи через `status_*`, все 8 ключей есть (i18n 147-157) |
| Старый статус `used` больше нигде не используется | частично | нет в OffcutStatus/i18n/моках, но остался в `status_:` AUDIT_ENUM_MAP ×5 файлов и в ключе `btn_mark_used` |
| Старый статус `scrap` больше нигде не используется | частично | то же: `status_:` ×5 файлов, `btn_mark_scrap`, `data-test="offcut-mark-scrap-btn"` |
| AUDIT_ENUM_MAP во всех 5 файлах обновлён | сделано | `offcut_status_:` = 8 новых кодов во всех 5 |
| Mock данные обрезков имеют корректные новые статусы | сделано | uniq -c по warehouse-offcuts.ts: только новые коды |
| Кнопки «Использован» → «В производстве» и «В утиль» работают | частично | клик ставит in_production/scrapped, но подписи и data-test не переименованы |

filesMentioned: frontend_vue/src/types/warehouse.ts, frontend_vue/src/i18n/admin/warehouse.ts, frontend_vue/src/views/admin/warehouse/WarehousePage.vue, frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue, frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue, frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue, frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue, frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue, frontend_vue/src/mocks/warehouse-offcuts.ts, frontend_vue/src/composables/useWarehouseOffcutCard.ts, frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/styles/admin/components/_status-pills.css

---

## 2. roo_code/plans/warehouse/verify-batch-card-api-readiness.md

**Вердикт: частично** (чекбоксов: 0; в плане Todo-лист из 4 шагов)

### Что подтвердилось

Сервисный слой на месте, эндпоинты те, что в плане:

```
$ grep -n "export async function (getBatch|patchBatch|deleteBatch|getBatchAggregates|getBatchActiveSales|getBatchAudit|deleteBatchAuditEntry|getMovements|getOffcuts|createMovement)" src/services/warehouseService.ts
101 getBatch, 109 patchBatch, 113 deleteBatch, 119 getOffcuts, 158 getMovements,
182 createMovement, 192 getBatchAggregates, 196 getBatchActiveSales,
326 getBatchAudit, 330 deleteBatchAuditEntry
```
Пути — `/api/warehouse/batches/:id`, `/aggregates`, `/active-sales`, `/audit`, `/audit/:entryId`, `/api/warehouse/movements`, `/api/warehouse/offcuts` (строки 98–351).

Изоляция моков подтверждена: `grep -rn "mocks/" WarehouseBatchCard.vue useWarehouseBatch.ts CreateMovementModal.vue` → ни одного вхождения.

Мелкая неточность плана: `deleteBatchAuditEntry` принимает `(batchId, entryId)`, а не `(batchId)`.

Шаг 1 Todo-листа («документировать warehouse API контракт») УЖЕ ВЫПОЛНЕН — план утверждает обратное:

```
$ grep -in "warehouse" roo_code/roo-context/03-api-contract.md
749:## 2026-06-01 — Added Warehouse (Batches / Movements / Offcuts) section
1267:# Warehouse — Batches (2.0)
```
Секция содержит типы, коды ошибок, Save UX и разбор всех эндпоинтов карточки партии.

### Что осталось

Бэкенда нет вовсе — шаги 2, 3, 4 не начаты:

```
$ ls backend/app/modules/warehouse/features
__init__.py            # ни одного слайса
$ grep -n "include_router" backend/app/main.py
products ×2, auth ×4, settings ×2, uploads — warehouse отсутствует
```
Бизнес-логика (агрегаты, active-sales, пересчёт остатков, computeBatchStatus) по-прежнему только в `src/services/mocks/warehouse.ts`. Переключение `VITE_USE_MOCKS=false` и тест по нему невозможны.

filesMentioned: frontend_vue/src/services/warehouseService.ts, frontend_vue/src/composables/useWarehouseBatch.ts, frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/services/mocks/index.ts

---

## 3. roo_code/plans/warehouse/verify-warehouse-server-side-filtering.md

**Вердикт: сделано** (чекбоксов: 0)

Баг, который план объявляет исправленным, действительно исправлен — `loadOffcuts` встраивает сортировку:

```
$ grep -n -A 12 "async function loadOffcuts" src/composables/useWarehouse.ts
225:  async function loadOffcuts() {
229-      const offcutFiltersForApi: WarehouseFilters = {
230-        ...offcutFilters,
231-        sortBy: offcutsSort.sortBy ?? undefined,
232-        sortDir: offcutsSort.sortDir,
233-      }
234-      const res = await getOffcuts(offcutFiltersForApi, { page, pageSize })
```

Тот же паттерн у остальных: batches 208–209, movements 252–255, deficit 275–278. Stock идёт через `stockFilters` целиком (loadStock:188), а `toggleStockSort` (470–477) пишет `sortBy/sortDir` прямо в `stockFilters` — как и описано в разделе консистентности.

Пагинация и фильтры — параметры запроса: у всех пяти `load*` передаются `{ page, pageSize }`, watch'и на пагинацию есть для всех вкладок (560, 568, 576, 584, 592) плюс watch'и на фильтры/сортировки (396–549).

Временные `console.log` из моков убраны:

```
$ grep -rn "console.log" src/services/mocks/index.ts src/services/mocks/warehouse.ts
(пусто)
```

filesMentioned: frontend_vue/src/composables/useWarehouse.ts, frontend_vue/src/services/warehouseService.ts, frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/services/mocks/index.ts
