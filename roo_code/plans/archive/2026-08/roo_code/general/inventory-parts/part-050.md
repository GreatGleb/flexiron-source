# Инвентаризация планов — часть 050

Пачка: `roo_code/plans/warehouse` (4 плана). Код не менялся.

---

## 1. `roo_code/plans/warehouse/implement-batch-card-write-off.md`

**Вердикт: частично**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

### Доказательство

```
$ grep -n "write_off_title\|write_off_btn\|write_off_quantity\|write_off_reason\|write_off_available\|write_off_confirm\|toast_write_off_success\|write_off_quantity_exceeds" frontend_vue/src/i18n/admin/warehouse.ts
(пусто)

$ grep -n "writeOff\|writeOffSaving" frontend_vue/src/composables/useWarehouseBatch.ts
(пусто)

$ grep -n "writeOff\|WriteOff\|write-off\|write_off" frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
177:  'write-off': 'trash-2',
191:  'write-off': 'batch_summary_scrapped',
205:  'write-off': 'agg-card-scrapped',
278:  movement_type_: ['receipt', 'expense', 'transfer', 'write_off', 'return', 'inbound', 'outbound'],
```

Ни одного из трёх изменений, которые план требует, в коде нет: нет i18n-ключей
`write_off_*`, нет метода `writeOff()`/`writeOffSaving` в композабле, нет
отдельной модалки списания и кнопки «Списать» в шапке секции движений.

Но цель плана — списать товар из карточки партии — достигнута другим,
более общим механизмом: универсальной модалкой создания движения.

```
$ grep -n "CreateMovementModal\|showMovementModal\|openMovementModal" frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
18:import CreateMovementModal from './CreateMovementModal.vue'
326:const showMovementModal = ref(false)
328:function openMovementModal() {
329:  showMovementModal.value = true
334:  showMovementModal.value = false
464:              @click="openMovementModal"
1532:      <CreateMovementModal
1533:        :show="showMovementModal"
1538:        @close="showMovementModal = false"
1539:        @created="onMovementCreated"
```

Кнопка стоит не в шапке секции движений, а в шапке страницы
(`data-test="batch-card-add-movement-btn"`, `t('warehouse.btn_add_movement')`,
строки 459–468). `write-off` есть среди типов движения этой модалки
(`ALL_MOVEMENT_TYPE_OPTIONS`, `CreateMovementModal.vue:372-376`), а
`onMovementCreated()` (строки 333–346) перечитывает партию и вызывает
`loadMovements()`, `loadBatchAggregates()`, `loadBatchActiveSales()` — то есть
шаг «после списания → обновить движения и данные партии» из плана закрыт.

### Что осталось / чего нет

- Отдельной кнопки «Списать» в шапке секции движений — нет.
- Отдельной модалки списания (количество / причина / дата) — нет.
- `writeOff()` и `writeOffSaving` в `useWarehouseBatch.ts` — нет.
- i18n-ключей `write_off_title`, `write_off_btn`, `write_off_quantity`,
  `write_off_reason`, `write_off_reason_placeholder`, `write_off_available`,
  `write_off_confirm`, `toast_write_off_success`, `write_off_quantity_exceeds` — нет.
- Правила видимости кнопки по статусу `available`/`partial` — неприменимы:
  предпосылка плана про статусы устарела. Статус партии теперь выводится из
  агрегатов (`computeBatchStatus`, `frontend_vue/src/services/mocks/warehouse.ts:257`),
  а карта `AGGREGATE_TO_STATUS` (там же, 245–255) даёт `scrapped`, `expensed`,
  `sold`, `in_storage`, `in_production`, `returned_to_supplier`,
  `converted_to_offcuts` — модели «partial/depleted» из плана в этом виде нет.

Итог: способ списания в карточке партии есть и работает, но реализован не тем
способом, который описывает план; сам план описывает уже вытесненную модель.

---

## 2. `roo_code/plans/warehouse/movement-modal-form-fields-restructure.md`

**Вердикт: сделано**

Незакрытых чекбоксов: 0.

### Доказательство

```
$ grep -n "movementDirection\|selectedAggregateAfter\|totalInStockAfter\|totalQuantityAfter\|field_selected_after\|field_readonly_hint\|field_new_movement_quantity\|field_total_quantity\|field_selected_quantity\|create-movement-total-stock-after\|create-movement-selected-after" frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
168:const movementDirection = computed<'incoming' | 'outgoing' | 'correction' | 'none'>(() => {
184:const selectedAggregateAfter = computed(() => {
188:  const dir = movementDirection.value
210:const totalInStockAfter = computed(() => {
219:  const dir = movementDirection.value
683:          <label class="field-label">{{ t('warehouse.field_selected_quantity') }}</label>
688:          <p class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
695:              >{{ t('warehouse.field_new_movement_quantity') }}
714:            {{ t('warehouse.field_selected_after') }}
724:            data-test="create-movement-selected-after"
728:            :value="selectedAggregateAfter"
732:            data-test="create-movement-selected-after"
736:            {{ t('warehouse.field_readonly_hint') }}
742:          <label class="field-label">{{ t('warehouse.field_total_quantity') }}</label>
744:            :value="totalInStockAfter"
748:            data-test="create-movement-total-stock-after"
750:          <p class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
```

`totalQuantityAfter` (старый computed) в файле отсутствует — п.4 плана выполнен.

```
$ grep -n "field_selected_after\|field_readonly_hint\|field_new_movement_quantity\|field_total_quantity\|field_selected_quantity" frontend_vue/src/i18n/admin/warehouse.ts
438:      field_selected_quantity: 'Количество в выбранных',
439:      field_new_movement_quantity: 'Количество товаров в новом движении',
440:      field_selected_after: 'Итоговое количество в выбранных',
441:      field_total_quantity: 'Итоговое количество товаров в наличии',
442:      field_readonly_hint: 'Рассчитывается автоматически',
1116:      field_selected_quantity: 'Selected quantity',
1117:      field_new_movement_quantity: 'Quantity of goods in new movement',
1118:      field_selected_after: 'Total in selected',
1119:      field_total_quantity: 'Total quantity of goods in stock',
1120:      field_readonly_hint: 'Calculated automatically',
1794:      field_selected_quantity: 'Pasirinktų kiekis',
1795:      field_new_movement_quantity: 'Prekių kiekis naujame judėjime',
1796:      field_selected_after: 'Galutinis pasirinktuose',
1797:      field_total_quantity: 'Galutinis prekių kiekis sandėlyje',
1798:      field_readonly_hint: 'Skaičiuojama automatiškai',

$ grep -rn "field-readonly-hint" frontend_vue/src/styles/
frontend_vue/src/styles/admin/components/_forms.css:37:.modal-body .field-readonly-hint {
```

Разметка (строки 680–751) совпадает с «Template Structure (After Changes)» плана:
поле «в выбранных» read-only с подсказкой, «Количество товаров в новом движении»
скрыто при коррекции, «Итоговое количество в выбранных» редактируемо только при
коррекции, «Итоговое количество товаров в наличии» всегда read-only с подсказкой.

Отличия — уточнения сверх плана, не противоречащие ему: `return` считается
`incoming` для склада, но уменьшает выбранный агрегат (строки 190–192); база для
`totalInStockAfter` — агрегат `receipt`, а не `batch.quantity` (строки 210–219);
коррекция меняет общий остаток только при коррекции агрегата `receipt`.

---

## 3. `roo_code/plans/warehouse/movements-default-sort-desc.md`

**Вердикт: сделано**

Незакрытых чекбоксов: 0.

### Доказательство

```
$ sed -n '158,162p' frontend_vue/src/composables/useWarehouse.ts
  // Movements-specific sort state — default: newest first by date
  const movementsSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
    sortBy: 'movedAt',
    sortDir: 'desc',
  })

$ sed -n '960,974p' frontend_vue/src/services/mocks/warehouse.ts   (внутри mockGetMovements)
  const sortBy = filters.sortBy || 'movedAt'
  const sortDir = filters.sortDir || 'desc'
  ...
    if (sortBy === 'movedAt') cmp = a.movedAt.localeCompare(b.movedAt)
    ...
    return sortDir === 'desc' ? -cmp : cmp

$ sed -n '355,358p' frontend_vue/src/composables/useWarehouseBatch.ts
      const response = await getMovements(
        { search: '', batchNumber: batch.value.batchNumber, sortBy: 'movedAt', sortDir: 'desc' },
        { page: 1, pageSize: 50 },
      )

$ grep -n "movementsSort.sortBy === 'movedAt'" frontend_vue/src/views/admin/warehouse/WarehousePage.vue
2896:                            movementsSort.sortBy === 'movedAt' && movementsSort.sortDir === 'asc',
2906:                            movementsSort.sortBy === 'movedAt' && movementsSort.sortDir === 'desc',
```

Все три правки плана есть; пункт 3 (WarehousePage.vue) правок не требовал, и
привязка активного значка сортировки на месте. `toggleMovementsSort`
(`useWarehouse.ts:519-525`) флипает `sortDir` при повторном клике по той же
колонке — поведение, которое план и описывал.

---

## 4. `roo_code/plans/warehouse/movement-type-restrictions.md`

**Вердикт: сделано**

Незакрытых чекбоксов: 0.

### Доказательство

```
$ grep -n "MOVEMENT_TYPE_OPTIONS\|availableMovementTypes\|transfer" frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
354:/** All possible movement types (except 'transfer' — not available in this modal) */
355:const ALL_MOVEMENT_TYPE_OPTIONS: SelectOption[] = [
409:const availableMovementTypes = computed(() => {
415:    return ALL_MOVEMENT_TYPE_OPTIONS.filter((o) => o.value === 'receipt')
420:    return ALL_MOVEMENT_TYPE_OPTIONS.filter((o) => o.value !== 'return' && o.value !== 'receipt')
424:  return ALL_MOVEMENT_TYPE_OPTIONS.filter((o) => o.value === 'return' || o.value === 'correction')
466:  if (type.value && !availableMovementTypes.value.some((o) => o.value === type.value)) {
671:            :options="availableMovementTypes"
```

- `transfer` в списке опций отсутствует (`ALL_MOVEMENT_TYPE_OPTIONS`, строки
  355–396: receipt, sale, production, expense, write-off, storage, return,
  return-to-supplier, correction) — п.1 выполнен.
- `availableMovementTypes` фильтрует по выбранному агрегату по правилам плана
  (ничего не выбрано → только `receipt`; выбран `receipt` → всё кроме `return`
  и `receipt`; иначе → только `return` и `correction`) — п.2 выполнен.
- Вотчер сбрасывает невалидный `type` (строки 465–468) — п.3 выполнен, причём
  расширенно: следит и за `selectedSaleId`, не только за `selectedAggregateType`.
- Шаблон использует `:options="availableMovementTypes"` (строка 671) — п.4 выполнен.

Остаточный след, не противоречащий плану: `showTransferLocations`
(строка 340, `type.value === 'transfer'`) и ветка «Transfer locations»
в шаблоне (строка 774) остались, но `transfer` выбрать нельзя, так что
эти ветки недостижимы из этой модалки.
