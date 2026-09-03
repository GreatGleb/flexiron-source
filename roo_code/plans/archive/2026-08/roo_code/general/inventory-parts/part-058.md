# Инвентаризация: roo_code/plans/warehouse (часть 058)

## 1. roo_code/plans/warehouse/warehouse-phase2-bugs.md — **сделано**

Баг-репорт на 40 пунктов (без чекбоксов, `grep -c "^[[:space:]]*- \[ \]"` = 0).
Проверены все пункты: каждый описанный дефект в текущем коде отсутствует.

### Доказательства

Баг 1 (`st.of`):
```
$ grep -rn "st\.of" frontend_vue/src/views/admin/warehouse/
(пусто)
$ grep -rn "warehouse.of'" src/views/admin/warehouse/WarehousePage.vue
1790:          :of-label="t('warehouse.of')"
2279 / 2829 / 3333 / 3781 — то же
```

Баг 2 (префиксы status/type/priority) — выбран вариант (a), ключи с префиксами есть по трём локалям:
```
$ for k in batch_status_available offcut_status_available movement_type_receipt \
    deficit_priority_critical deficit_status_open ...; do grep -c "^\s*$k:" src/i18n/admin/warehouse.ts; done
batch_status_available = 3
offcut_status_available = 3
movement_type_receipt = 3
deficit_priority_critical = 3
deficit_status_open = 3
batch_status_in_storage = 3
batch_status_in_production = 3
batch_status_sold = 3
offcut_status_sold = 3
movement_type_write_off = 3
```

Баги 3–7 (`*_empty`) — закрыты вариантом (b): шаблоны используют `empty_*`, а ключей `*_empty` в коде нет вовсе:
```
$ grep -rn "stock_empty\|batches_empty\|offcuts_empty\|movements_empty\|deficit_empty" src/
(пусто)
$ grep -rn "warehouse.empty_" src/views | head
WarehousePage.vue:1326  t('warehouse.empty_stock')
WarehousePage.vue:1817  t('warehouse.empty_batches')
WarehousePage.vue:2309  t('warehouse.empty_offcuts')
WarehousePage.vue:2860  t('warehouse.empty_movements')
WarehouseBatchCard.vue:1325/1429 — empty_movements / empty_offcuts
```

Баги 8–17 (колоночные ключи) — все добавлены по трём локалям:
```
col_search = 3, col_batch_number = 3, col_avg_price = 3, col_total_value = 3,
col_min_stock = 3, col_current_stock = 3, col_min_required = 3,
col_deficit_amount = 3, col_unit_price = 3, col_received = 3, col_total_cost = 3
```

Баги 18–20, 25, 28 (`col_expires`, `col_certificate`, `batch_section_general`, `batch_section_notes`) — ключей нет, но и обращений к ним нет:
```
$ grep -rn "col_expires\|col_certificate\|batch_section_general\|batch_section_notes" src/
(пусто)
$ grep -c "^\s*batch_section_quantities:" src/i18n/admin/warehouse.ts → 3
$ grep -c "^\s*batch_section_dates:" src/i18n/admin/warehouse.ts → 3
```

Баги 21, 22 — в самом плане помечены «this is OK»; `col_supplier` = 3, `col_location` = 3.

Баги 23, 24: `delete_title` = 3, `delete_confirm` = 3.

Баг 29 (интерполяция `batchNumber`) — параметр передаётся во всех трёх вызовах:
```
$ grep -rn "batch_card_title" src/views/
WarehouseBatchCard.vue:120  t('warehouse.batch_card_title', { batchNumber: batch.value.batchNumber })
WarehouseBatchCard.vue:389  t('warehouse.batch_card_title', { batchNumber: batch.batchNumber })
WarehouseBatchCard.vue:398  t('warehouse.batch_card_title', { batchNumber: batch.batchNumber })
```

Баг 30 (общий `initialized`) — исправлен вариантом (b), пофлаговые флаги на вкладку:
```
src/composables/useWarehouse.ts:177  // Per-tab initialized flags
178-182  stockInitialized / batchesInitialized / offcutsInitialized /
         movementsInitialized / deficitInitialized = ref(false)
```

Баг 31 (общие фильтры) — фильтры разделены по вкладкам:
`stockFilters`, `batchesFilters`, `offcutFilters`, `movementFilters`, `deficitFilters` —
у каждого свой `watch` (useWarehouse.ts:396…552), внутри свой `*Pagination.reset()`.

Баг 32 (`skipNextPageWatch`) — флаг переименован в `suppressPageWatch`, ставится ДО `reset()`
(useWarehouse.ts:394, 408, 419…552), сбрасывается в пофлаговых watcher-ах пагинации (561…594).
Двойной загрузки при page===1 нет: `reset()` не меняет значение, watcher не срабатывает.

Баг 33 (пагинация Stock) — своя пагинация на каждую вкладку:
```
src/composables/useWarehouse.ts:171-175
  stockPagination / batchesPagination / offcutsPagination /
  movementsPagination / deficitPagination = usePagination(25)
```

Баг 34 (нет роута карточки обрезка) — роут есть:
```
src/router/index.ts:273  path: 'warehouse/offcuts/:id'
                    274  name: 'admin-warehouse-offcut'
                    275  component: WarehouseOffcutCard.vue
```

Баг 36 (`.pill-mint`):
```
$ grep -rn "pill-mint" src/ | grep css
src/styles/admin/main.css:1240:.pill-mint {
```

Баг 37 (`.btn-danger-ghost`):
```
src/styles/admin/warehouse_list.css:1009:.btn-danger-ghost {
src/styles/admin/warehouse_list.css:1014:.btn-danger-ghost:hover {
```

Баги 35, 38, 39, 40 — в плане отмечены как OK (флаги, моки, импорты, покрытие пилюль).

### Что осталось
Ничего. Отдельно отмечено: ключи `col_expires`, `col_certificate`, `batch_section_general`,
`batch_section_notes` в i18n не появились — но и ссылок на них в коде нет, так что дефект
(несовпадение шаблона и переводов) закрыт со стороны шаблона.

Файлы кода, упомянутые в плане:
`../frontend_vue/src/views/admin/warehouse/WarehousePage.vue`,
`../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`,
`../frontend_vue/src/i18n/admin/warehouse.ts`,
`../frontend_vue/src/composables/useWarehouse.ts`,
`../frontend_vue/src/router/index.ts`,
`../frontend_vue/src/types/features.ts`,
`../frontend_vue/src/types/warehouse.ts`,
`../frontend_vue/src/styles/admin/warehouse_list.css`,
`../frontend_vue/src/mocks/warehouse.ts`,
`../frontend_vue/src/services/mocks/warehouse.ts`,
`../frontend_vue/src/services/mocks/index.ts`,
`frontend_vue/src/services/warehouseService.ts`

---

## 2. roo_code/plans/warehouse/warehouse-phase3-execution-plan.md — **частично**

Это не план реализации, а инструкция «как вести новый чат» по фазам 3–6 плюс список
того, что на момент написания не сделано. Незакрытых чекбоксов: 2 — но оба лежат
внутри шаблона промпта (`- [ ] пункт 1`, `- [ ] пункт 2`), это заглушки формата, а не
требования.

### Что есть

Фаза 3 (все три сабтаска) — сделана:
```
$ ls frontend_vue/src/composables/useWarehouseBatch.ts
      frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
оба есть
$ sed -n 261,265p frontend_vue/src/router/index.ts
        path: 'warehouse/batches/:id'
        name: 'admin-warehouse-batch'
        component: WarehouseBatchCard.vue
```

Фаза 4 — сделана частично и в другой форме:
`CreateMovementModal.vue` есть (`src/views/admin/warehouse/CreateMovementModal.vue`,
подключён в WarehouseBatchCard.vue:18, 1532), а вместо `CreateBatchModal.vue` и
`CreateOffcutModal.vue` появились отдельные страницы:
```
src/views/admin/warehouse/WarehouseBatchCreatePage.vue   (роут warehouse/batches/new)
src/views/admin/warehouse/WarehouseOffcutCreatePage.vue  (роут warehouse/offcuts/new)
```
Файла `useWarehouseMovement.ts` нет; вместо него `useWarehouseMovementCard.ts`.
Создание движения из UI списка снято намеренно:
`useWarehouse.ts:43 // DEPRECATED: showCreateMovementModal — movement creation removed from UI`.

Фаза 5 — сделана в другой форме: отдельных `useWarehouseOffcuts.ts` / `useWarehouseDeficit.ts`
нет, обрезки и дефицит живут вкладками внутри `useWarehouse.ts` (свои фильтры, сортировка,
пагинация), плюс карточки `useWarehouseOffcutCard.ts`, `useWarehouseDeficitCard.ts`.

Фаза 6 — сделана:
```
$ wc -l frontend_vue/tests/e2e/mocks/warehouse.ts   (моки перехвата есть)
$ wc -l frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts → 460
$ grep -c "test(" ... → 46
```

### Чего нет
Файлов ровно с теми именами, что назвал план: `CreateBatchModal.vue`, `CreateOffcutModal.vue`,
`useWarehouseMovement.ts`, `useWarehouseOffcuts.ts`, `useWarehouseDeficit.ts`. Работа сделана,
но по другой структуре (страницы вместо модалок, единый composable вместо двух).
Сам список «что НЕ сделано» в плане устарел целиком.

### Пункты
- `- [ ] пункт 1` — **непонятно** (заглушка шаблона промпта, не требование)
- `- [ ] пункт 2` — **непонятно** (то же)

Файлы кода, упомянутые в плане:
`types/warehouse.ts`, `services/warehouseService.ts`, `services/mocks/warehouse.ts`,
`i18n/admin/warehouse.ts`, `useWarehouse.ts`, `WarehousePage.vue`, `WarehouseBatchCard.vue`,
`useWarehouseBatch.ts`, `useWarehouseMovement.ts`, `useWarehouseOffcuts.ts`,
`useWarehouseDeficit.ts`, `CreateBatchModal.vue`, `CreateMovementModal.vue`,
`CreateOffcutModal.vue`, `composables/usePagination.ts`, `composables/useDirtyCheck.ts`,
`composables/useToast.ts`, `components/admin/ui/CustomSelect.vue`,
`components/admin/ui/DatePicker.vue`, `components/admin/ui/SearchInput.vue`,
`components/admin/ui/MultiSelect.vue`, `components/admin/ui/AppModal.vue`,
`components/admin/GlassPanel.vue`, `components/admin/SvgIcon.vue`,
`styles/admin/warehouse_list.css`, `router/index.ts`, `warehouse.spec.ts`
