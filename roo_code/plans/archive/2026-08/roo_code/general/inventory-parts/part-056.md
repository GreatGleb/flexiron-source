# Инвентаризация планов — часть 056

Каталог: `roo_code/plans/warehouse` (2 плана)

---

## 1. roo_code/plans/warehouse/warehouse-expandable-rows-plan.md

**Вердикт: не начато**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0). Порядок реализации в плане — нумерованный список из 11 шагов, чекбоксов нет.

### Что план требует
- Фаза 1: типы `StockBatchItem`, `OffcutChildItem`; поля `batches?`, `offcutCount`, `offcuts?`, `parentBatch?` в `StockOverviewItem` / `BatchListItem` / `OffcutListItem`
- Фаза 2: новый компонент `src/components/admin/ExpandableTable.vue` + CSS-блок expandable rows в `warehouse_list.css`
- Фазы 3–5: замена таблиц Stock / Batches / Offcuts в `WarehousePage.vue` на `ExpandableTable`
- Фаза 6: nested-данные в моках

### Доказательство
```
$ ls src/components/admin/ | grep -i expand
(пусто)

$ grep -rn "ExpandableTable\|expand-toggle\|expandedRows\|childrenField" src/
(пусто)

$ grep -n "StockBatchItem\|OffcutChildItem\|offcutCount\|parentBatch\|batches?:\|offcuts?:" src/types/warehouse.ts
(пусто)

$ grep -n "expand\|child-row\|child-table" src/styles/admin/warehouse_list.css
704:/* ─── Batch card notes textarea — auto-expanding with constrained max-height ─ */

$ grep -rni "expand" src/views/admin/warehouse/WarehousePage.vue
(пусто)

$ grep -rn "toggleExpand\|isExpanded\|expanded" src/components/admin/ src/views/admin/warehouse/
(пусто)

$ grep -n "batchCount" src/types/warehouse.ts
528:  batchCount: number
```

### Что осталось
Всё. В коде нет ни компонента, ни состояния expand, ни новых типов, ни CSS-правил из плана. Единственное утверждение плана, которое подтвердилось, — «`batchCount` уже есть» (`src/types/warehouse.ts:528`); это существующее поле, а не результат работы по плану. Правило `.notes-textarea`-стиля на строке 704 CSS относится к автовысоте textarea, а не к раскрывающимся строкам.

### Файлы, упомянутые планом
`types/warehouse.ts`, `frontend_vue/src/types/warehouse.ts`, `src/components/admin/ExpandableTable.vue`, `frontend_vue/src/components/admin/ExpandableTable.vue`, `frontend_vue/src/styles/admin/warehouse_list.css`, `frontend_vue/src/views/admin/warehouse/WarehousePage.vue`, `useWarehouse.ts`, `frontend_vue/src/composables/usePagination.ts`, `frontend_vue/src/components/admin/SvgIcon.vue`, `frontend_vue/src/components/admin/GlassPanel.vue`

---

## 2. roo_code/plans/warehouse/warehouse-full-inventory.md

**Вердикт: частично**

Незакрытых чекбоксов: 0 (`grep -c` → 0). Это не план работ, а описательная инвентаризация секции «Склад»: таблицы маршрутов, вкладок, модалок, композаблов, функций сервиса, типов и моков. Требований нет — сопоставляется только правдивость описания. Часть описания устарела.

### Совпадает с кодом
```
$ grep -n "warehouse" src/router/index.ts
315:        path: 'warehouse/:tab(stock|batches|offcuts|movements|deficit)?'
316:        name: 'admin-warehouse'      → WarehousePage.vue
261:        path: 'warehouse/batches/:id'
262:        name: 'admin-warehouse-batch' → WarehouseBatchCard.vue

$ grep -n "icon: '" src/views/admin/warehouse/WarehousePage.vue
163:  { key: 'stock',     icon: 'pie-chart' }
164:  { key: 'batches',   icon: 'package' }
165:  { key: 'offcuts',   icon: 'scissors' }
166:  { key: 'movements', icon: 'refresh-cw' }
167:  { key: 'deficit',   icon: 'alert-triangle' }
```
Все 5 вкладок с теми же ключами и иконками — как в плане. Сервис содержит `getStockOverview`, `getBatches`, `getBatch`, `createBatch`, `patchBatch`, `deleteBatch`, `getOffcuts`, `getOffcut`, `createOffcut`, `deleteOffcut`, `getMovements`, `createMovement`, `executeCutting`, `getDeficitList`, `getDeficitItem`, `createDeficitItem`, `patchDeficitItem`, `deleteDeficitItem`. Все перечисленные типы и энумы присутствуют в `src/types/warehouse.ts`. Моки есть: `grep -c "^export .*function mock" src/services/mocks/warehouse.ts` → 39.

`useWarehouse.ts` содержит `loadStock/loadBatches/loadOffcuts/loadMovements/loadDeficit` (строки 184–271), `deleteBatch/deleteOffcut/deleteDeficit` (306/316/326), `updateOffcutStatus` (350), `updateDeficitPriority` (373), все пять `toggle*Sort` (470–539). `useWarehouseBatch.ts` содержит `load/save/discard/remove/loadMovements/loadOffcuts` (194/236/306/331/351/424).

### Не совпадает (описание устарело)
```
$ find src -name "Create*Modal.vue"
src/views/admin/warehouse/CreateMovementModal.vue
```
- `CreateBatchModal.vue` и `CreateOffcutModal.vue` не существуют — их заменили страницы `WarehouseBatchCreatePage.vue` и `WarehouseOffcutCreatePage.vue`.
- Композаблы `useWarehouseMovement.ts`, `useWarehouseOffcuts.ts`, `useWarehouseDeficit.ts` не существуют. Фактический набор: `useWarehouseBatch.ts`, `useWarehouseBatchCreate.ts`, `useWarehouseCutting.ts`, `useWarehouseDeficitCard.ts`, `useWarehouseMap.ts`, `useWarehouseMovementCard.ts`, `useWarehouseOffcutCard.ts`, `useWarehouseOffcutCreate.ts`, `useWarehouseStockCard.ts`, `useWarehouse.ts`.
- В сервисе нет `deleteStockItem()` (`DELETE /api/warehouse/stock/:productId`) — вместо него `patchStockItem()`; удаление остатка было убрано осознанно.
- В сервисе нет `deleteMovement()` (`DELETE /api/warehouse/movements/:id`); `grep "deleteMovement" src/services/warehouseService.ts` находит только `deleteMovementAuditEntry`.
- В `useWarehouse.ts` нет `deleteMovement()` и `deleteStock()`, заявленных планом.
- Список маршрутов неполон: в роутере ещё `warehouse/stock/:id`, `warehouse/offcuts/new`, `warehouse/offcuts/:id`, `warehouse/batches/new`, `warehouse/movements/:id`, `warehouse/cutting`, `warehouse/map`, `warehouse/deficit/:id`.
- В сервисе есть целый пласт, не отражённый в инвентаре: `getBatchCostBreakdown`, `patchOffcut`, `getMovement`, `getBatchAggregates`, `getBatchActiveSales`, `exportWarehouseData`, шесть пар `get*Audit`/`delete*AuditEntry`. Типы `StockAuditEntry`, `BatchStatusAggregate`, `BatchActiveSale`, `StockPatchPayload`, `StockReservation`, `OffcutPatchPayload`, `WarehouseBatchFile` в инвентаре тоже не упомянуты.

### Что осталось
Как документа-описания — устарел примерно на треть содержимого. Работы по нему не требуется; при использовании как справочника его нужно переписать по текущему коду.

### Файлы, упомянутые планом
`WarehousePage.vue`, `WarehouseBatchCard.vue`, `CreateBatchModal.vue`, `CreateMovementModal.vue`, `CreateOffcutModal.vue`, `useWarehouse.ts`, `useWarehouseBatch.ts`, `useWarehouseMovement.ts`, `useWarehouseOffcuts.ts`, `useWarehouseDeficit.ts`, `warehouseService.ts`, `types/warehouse.ts`, `services/mocks/warehouse.ts`
