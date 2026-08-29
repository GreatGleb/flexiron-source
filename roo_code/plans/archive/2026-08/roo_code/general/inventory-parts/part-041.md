# Инвентаризация планов — part-041 (roo_code/plans/warehouse, пачка 5 планов)

Дата: 2026-08-26. Код не изменялся.

---

## 1. roo_code/plans/warehouse/add-batch-card-unit-field.md — СДЕЛАНО

Чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

Требование: readonly-поле «Ед. изм.» в центральной колонке карточки партии,
после `quantityRemaining` и перед `unitPrice`; `unit` в form/load/save/discard композабла.

Доказательство:

```
$ grep -n "unit" frontend_vue/src/composables/useWarehouseBatch.ts
96:    unit: StockUnit            <- в типе form
117:    unit: 'kg',                <- начальное значение
205:        unit: data.unit,       <- load()
283:        unit: updated.unit,    <- save()
313:      unit: batch.value.unit,  <- discard()

$ grep -n "field-unit\|col_unit\|form.unit" frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
726:  <span>{{ t('warehouse.col_unit') }}</span>
727:  <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
745:  :value="resolveUnitLabel(form.unit)"
749:  data-test="field-unit"
```

Порядок в шаблоне проверен чтением `sed -n '700,760p'`: блок `field-remaining`
(строки ~714–723) → блок `field-unit` (724–751) → блок `col_unit_price` (752+).
Именно то размещение, которое требует план.

Отличие от буквы плана, не от смысла: значение выводится через `resolveUnitLabel(form.unit)`,
а не через `t(\`warehouse.unit_${form.unit}\`)`. Функционально то же, подпись единицы.

Осталось: ничего.

---

## 2. roo_code/plans/warehouse/add-batches-filters.md — СДЕЛАНО

Чекбоксов: 0.

Требование: отдельный `batchesFilters`, поле `unit` в `WarehouseFilters`, watcher,
UI из 5 фильтров (поиск, статус, поставщик, диапазон дат, единица) на табе партий,
`getSupplierList()` в suppliersService, поддержка новых параметров в моке, ключи i18n.

Доказательство:

```
$ grep -n "batchesFilters" frontend_vue/src/composables/useWarehouse.ts
86:  const batchesFilters = reactive<WarehouseFilters>({
207:        ...batchesFilters,        <- loadBatches() использует именно его
428:    batchesFilters,               <- watch(batchesFilters, ..., {deep:true}) с reset пагинации
629:    batchesFilters,               <- возвращается из композабла

$ sed -n '/interface WarehouseFilters/,/^}/p' frontend_vue/src/types/warehouse.ts
  ... supplierId?, status?, unit?: string, dateFrom?, dateTo?, sortBy?, sortDir? ...

$ grep -rn "getSupplierList" frontend_vue/src
src/services/suppliersService.ts:97:export async function getSupplierList(): Promise<Array<{ id: string; company: string }>>
src/views/admin/warehouse/WarehousePage.vue:509,515  <- вызывается на странице
src/composables/useWarehouseBatchCreate.ts:6,293

$ sed -n '979,1035p' frontend_vue/src/views/admin/warehouse/WarehousePage.vue
<template v-else-if="activeTab === 'batches'">   <- отдельная ветка таба
  warehouse-batches-search
  warehouse-batches-status-filter   (:options="BATCH_STATUS_OPTIONS")
  warehouse-batches-supplier-filter (:options="supplierOptions")
  warehouse-batches-date-from / warehouse-batches-date-to (DatePicker)
  warehouse-batches-unit-filter     (:options="BATCH_UNIT_OPTIONS")
```

Сквозная поддержка фильтров до данных:

```
$ sed -n '/export async function getBatches/,/^}/p' frontend_vue/src/services/warehouseService.ts
  productId, supplierId, status, unit, dateFrom, dateTo, sortBy, sortDir -> params

$ sed -n '647,665p' frontend_vue/src/services/mocks/index.ts
  /api/warehouse/batches: пробрасывает все те же параметры в mockGetBatches

$ sed -n '491,520p' frontend_vue/src/services/mocks/warehouse.ts
  фильтрация по search, productId, supplierId, status, unit, dateFrom, dateTo
```

i18n: `filter_status_all`, `filter_supplier_all` по 3 локали (warehouse.ts:137/139,
819/821, 1403/1405); `filter_date_from`/`filter_date_to`/`col_supplier` — 9 совпадений
на три локали.

Отличия от буквы плана, не от смысла: даты сделаны компонентом `DatePicker`, а не
`<input type="date">`; ключи названы `filter_date_from`/`filter_date_to`, а не
`col_date_from`/`col_date_to`; вместо computed `supplierFilterOptions` — ref
`supplierOptions`, заполняемый из `getSupplierList()`. Сверх плана: отдельные ветки
фильтров и для offcuts/movements/deficit, кнопка «сохранить вид».

Осталось: ничего.

---

## 3. roo_code/plans/warehouse/add-batches-tab-tooltips.md — ЧАСТИЧНО

Чекбоксов: 0.

Требование: info-hint с подсказкой у всех 9 заголовков колонок таба партий
(кроме `col_actions`) + ключи `_hint` в трёх локалях.

i18n — сделано целиком:

```
$ for k in col_product_hint col_batch_number_hint col_lot_code_hint col_quantity_hint \
          col_remaining_hint col_unit_hint col_unit_price_hint col_received_hint col_status_hint; \
  do echo "$k: $(grep -c "$k:" frontend_vue/src/i18n/admin/warehouse.ts)"; done
col_product_hint: 3      col_batch_number_hint: 3   col_lot_code_hint: 3
col_quantity_hint: 6     col_remaining_hint: 3      col_unit_hint: 3
col_unit_price_hint: 3   col_received_hint: 3       col_status_hint: 3
```

Шаблон — 8 из 9 колонок:

```
$ awk 'NR>=1803 && NR<=2200' frontend_vue/src/views/admin/warehouse/WarehousePage.vue \
    | grep -n "v-tooltip=\"t('warehouse.col_"
col_batch_number_hint, col_lot_code_hint, col_quantity_hint, col_remaining_hint,
col_unit_hint, col_unit_price_hint, col_received_hint, col_status_hint
```

ЧЕГО НЕТ: у первой колонки (`col_product`) подсказки нет. Заголовок остался плоским:

```
$ sed -n '1822,1830p' frontend_vue/src/views/admin/warehouse/WarehousePage.vue
<th>
  <button class="th-sort-btn" @click="toggleBatchesSort('productName')">
    {{ t('warehouse.col_product') }}
    <span class="sort-icon-group">
```

Ни `div.th-content`, ни `span.info-hint`. Ключ `col_product_hint` в локалях есть,
но на этой странице не используется — только в WarehouseDeficitCard.vue:339 и
WarehouseOffcutCard.vue:392:

```
$ grep -rn "col_product_hint" frontend_vue/src/views frontend_vue/src/components
src/views/admin/warehouse/WarehouseDeficitCard.vue:339
src/views/admin/warehouse/WarehouseOffcutCard.vue:392
```

Осталось: обернуть заголовок `col_product` таба партий в `div.th-content` и добавить
`span.info-hint` с `v-tooltip="t('warehouse.col_product_hint')"` — одна колонка из девяти.

---

## 4. roo_code/plans/warehouse/add-batch-mock-files.md — СДЕЛАНО

Чекбоксов: 0.

Требование: массивы `files` у 27 перечисленных партий с указанным количеством файлов,
остальные перечисленные партии — без файлов. Правка только в одном файле мока.

Доказательство (скрипт разбил файл по `id: 'whb-NNN'` и посчитал `id: 'f-` внутри
блока `files: [...]` каждой партии):

```
whb-001 2  whb-002 3  whb-003 2  whb-008 1  whb-012 2  whb-014 1  whb-019 2
whb-027 2  whb-028 1  whb-032 1  whb-037 2  whb-042 1  whb-044 1  whb-048 1
whb-051 1  whb-055 1  whb-058 3  whb-059 2  whb-060 2  whb-061 2  whb-062 2
whb-063 2  whb-066 1  whb-068 2  whb-069 1  whb-070 1  whb-073 1
nonempty where plan says empty: []
total batches: 100
```

Каждое число совпадает с таблицей плана до единицы; ни одна из партий, которым план
предписал остаться без файлов (whb-004…whb-074 по списку), файлов не получила.

Сверх плана: мок вырос с 74 до 100 партий, у части новых (whb-075 и далее) файлы тоже
есть — плана это не касается.

Осталось: ничего.

---

## 5. roo_code/plans/warehouse/add-batch-status-tooltip.md — СДЕЛАНО

Чекбоксов: 0.

Требование: обёртка `batch-status-wrapper` с pill + `info-hint` и `v-tooltip`
по ключу `batch_status_hint_${batch.status}`; 5 ключей подсказок в трёх локалях;
при необходимости — CSS для обёртки.

Доказательство:

```
$ sed -n '409,432p' frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
<span class="batch-status-wrapper">
  <span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]"
        data-test="batch-card-status-pill">{{ t(`warehouse.batch_status_${batch.status}`) }}</span>
  <span v-tooltip="t(`warehouse.batch_status_hint_${batch.status}`)" class="info-hint"
        data-test="batch-card-status-hint"> <svg .../> </span>
</span>

$ grep -n "batch_status_hint" frontend_vue/src/i18n/admin/warehouse.ts
ru  200-204: available, reserved, partial, depleted, converted_to_offcuts
en  882-886: те же пять
lt 1563-1567: те же пять

$ sed -n '555,560p' frontend_vue/src/styles/admin/warehouse_list.css
.batch-card-header-left .batch-status-wrapper { display:inline-flex; align-items:center;
  gap:6px; align-self:flex-start; }
```

Расхождения плана с нынешним кодом (план описывает прошлое, не пробел):

- План требует ключ `batch_status_hint_quarantine`. Статуса `quarantine` в
  `BatchStatus` больше нет (`frontend_vue/src/types/warehouse.ts:21-32`: available,
  in_storage, in_production, sold, scrapped, expensed, returned_to_supplier, partial,
  depleted, reserved, converted_to_offcuts). Пятая подсказка отдана
  `converted_to_offcuts` — это правильная замена, а не пропуск.
- CSS-правило добавлено не в `_entity-card-layout.css`, а в `warehouse_list.css`
  (в плане этот шаг помечен как опциональный).
- `data-test="batch-card-status-wrapper"` на обёртке нет — в плане он был в примере
  разметки, на поведение не влияет, тесты за него не цепляются.

Наблюдение вне объёма плана (не «осталось» по этому плану, но потеряться не должно):
статусов у партии теперь 11, а подсказок 5. У in_storage, in_production, sold,
scrapped, expensed, returned_to_supplier ключа `batch_status_hint_*` нет. Сегодня это
не видно: в моке встречаются только available (88), partial (11), depleted (1) —
`grep "status: '" frontend_vue/src/mocks/warehouse-batches.ts | sort | uniq -c`.

Осталось: по плану — ничего.
