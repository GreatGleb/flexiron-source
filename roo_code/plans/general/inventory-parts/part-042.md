# Инвентаризация планов — часть 042

Пачка: `roo_code/plans/warehouse` (5 планов, чекбоксов ни в одном нет).
Код не менялся.

---

## 1. roo_code/plans/warehouse/add-deficit-tab-sorting.md — **частично**

Чекбоксов: 0.

**Что есть.** `useWarehouse.ts` и `WarehousePage.vue` сделаны целиком:

```
$ grep -n "deficitSort\|toggleDeficitSort" -r frontend_vue/src/
src/composables/useWarehouse.ts:165:  const deficitSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
src/composables/useWarehouse.ts:277:        sortBy: deficitSort.sortBy ?? undefined,
src/composables/useWarehouse.ts:278:        sortDir: deficitSort.sortDir,
src/composables/useWarehouse.ts:539:  function toggleDeficitSort(col: string) {
src/composables/useWarehouse.ts:550:    deficitSort,          (watch deep, deficitPagination.reset(), loadDeficit())
src/composables/useWarehouse.ts:637:    deficitSort,
src/composables/useWarehouse.ts:664:    toggleDeficitSort,
src/views/admin/warehouse/WarehousePage.vue:102-103: деструктуризация deficitSort/toggleDeficitSort
src/views/admin/warehouse/WarehousePage.vue: th-sort-btn на productName(3381), currentStock(3408),
  minRequired(3453), deficitAmount(3498), unit(3544), priority(3587), status(3632) — все 7 колонок
```

`loadDeficit()` (useWarehouse.ts:271-279) собирает `deficitFiltersForApi` с `sortBy`/`sortDir` —
как в плане (только имя переменной другое, и база — `deficitFilters`, а не общие `filters`).

**Чего нет.** Мок не умеет два из семи ключей. `frontend_vue/src/services/mocks/warehouse.ts:1374-1388`:

```ts
  const sortBy = filters.sortBy || 'deficitAmount'
  const sortDir = filters.sortDir || 'desc'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'currentStock') cmp = a.currentStock - b.currentStock
    else if (sortBy === 'minRequired') cmp = a.minRequired - b.minRequired
    else if (sortBy === 'deficitAmount') cmp = a.deficitAmount - b.deficitAmount
    else if (sortBy === 'priority') {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
      cmp = (order[a.priority] ?? 0) - (order[b.priority] ?? 0)
    }
    return sortDir === 'desc' ? -cmp : cmp
  })
```

Нет ветвей `unit` и `status` — а кнопки сортировки по этим колонкам в таблице стоят
(WarehousePage.vue:3544, 3632). Нажатие даёт запрос и порядок, не зависящий от колонки.

**Осталось:** добавить в `mockGetDeficitList` сравнение по `unit` и по `status`.

---

## 2. roo_code/plans/warehouse/add-movements-filters.md — **частично**

Чекбоксов: 0.

**Что есть.**

- `useWarehouse.ts:112-122` — `movementFilters` reactive ровно с полями из плана
  (search, type, unit, categoryIds, batchNumber, dateFrom, dateTo, sortBy, sortDir).
- `useWarehouse.ts:252-257` — `loadMovements()` собирает `movementFiltersForApi` из
  `movementFilters` + `movementsSort`.
- `useWarehouse.ts:449-457` — deep-watcher `movementFilters` → `suppressPageWatch`,
  `movementsPagination.reset()`, `loadMovements()`.
- `useWarehouse.ts:631` — экспорт `movementFilters`.
- `warehouseService.ts:169-172` — `params.unit`, `params.categoryIds` (join ','), `params.batchNumber`.
- `mocks/index.ts:747-749` — `unit`, `categoryIds`, `batchNumber` проброшены в `mockGetMovements`.
- `mocks/warehouse.ts:950-954` — фильтры `unit` и `batchNumber` (подстрокой) есть.
- `WarehousePage.vue` — весь UI-блок: `MOVEMENT_PREFS_KEY`(224), `saveMovementsView()`(265-276),
  `MOVEMENT_UNIT_OPTIONS`(433), `MOVEMENT_TYPE_OPTIONS`(475), фильтры search/type/dateFrom/dateTo/
  unit/category/batch и кнопка Save View (1140-1203).

**Чего нет.** Фильтр по категории в моке — мёртвый. `mockGetMovements` объявляет
`categoryIds?: string` (mocks/warehouse.ts:926), но в теле функции (937-978) не использует его:

```
$ grep -n "categoryIds" frontend_vue/src/services/mocks/warehouse.ts
407:    categoryIds?: string      # mockGetBatches — signature
430:  if (filters.categoryIds) {  # mockGetBatches — используется
766:    categoryIds?: string      # mockGetOffcuts — signature
787:  if (filters.categoryIds) {  # mockGetOffcuts — используется
926:    categoryIds?: string      # mockGetMovements — signature, использования НЕТ
1341:    categoryIds?: string      # mockGetDeficitList
```

`PRODUCTS_STORE` при этом уже импортирован (mocks/warehouse.ts:38), так что не хватает
именно ветки фильтрации (пункт 7 плана). Итог: MultiSelect категорий в фильтрах Движений
виден и меняет URL-параметр, но выборку не сужает.

**Осталось:** в `mockGetMovements` отфильтровать по `productId` товаров выбранных категорий.

---

## 3. roo_code/plans/warehouse/add-movement-type-hints-in-dropdown.md — **сделано**

Чекбоксов: 0.

```
$ sed -n '6,10p' frontend_vue/src/components/admin/ui/CustomSelect.vue
export interface SelectOption {
  value: string
  label?: string
  hint?: string
}

$ grep -n "option-hint\|option-label\|option-content" frontend_vue/src/components/admin/ui/CustomSelect.vue
83:          <div class="option-content">
84:            <span class="option-label">{{ opt.label ?? opt.value }}</span>
85:            <span v-if="opt.hint" class="option-hint">{{ opt.hint }}</span>

$ grep -n "option-hint\|option-label\|option-content\|max-height" frontend_vue/src/styles/admin/components/_custom-select.css
35:  max-height: 350px;         # план требовал поднять 250 → 350
66:.custom-select-option .option-content {
71:.custom-select-option .option-label {
75:.custom-select-option .option-hint {
```

`CreateMovementModal.vue:355-396` — `ALL_MOVEMENT_TYPE_OPTIONS`, у ВСЕХ девяти вариантов
(receipt, sale, production, expense, write-off, storage, return, return-to-supplier, correction)
проставлен `hint: t('warehouse.movement_type_hint_*')`. Набор типов с момента написания плана
разросся с четырёх до девяти, но правило «у каждого типа хинт» выполнено полностью.

**Осталось:** ничего.

---

## 4. roo_code/plans/warehouse/add-offcut-batch-status.md — **сделано**

Чекбоксов: 0. Все шесть файлов плана на месте.

```
$ grep -rn "converted_to_offcuts" frontend_vue/src/
src/types/warehouse.ts:32:  | 'converted_to_offcuts'                       # (1) union BatchStatus
src/i18n/admin/warehouse.ts:157,198,204   # ru: status_/batch_status_/batch_status_hint_
src/i18n/admin/warehouse.ts:839,880,886   # en
src/i18n/admin/warehouse.ts:1520,1561,1567 # lt
src/views/admin/warehouse/WarehouseBatchCard.vue:157:  converted_to_offcuts: 'pill-offcut'   # (4)
src/views/admin/warehouse/WarehousePage.vue:450: BATCH_STATUS_OPTIONS entry                # (5)
src/views/admin/warehouse/WarehousePage.vue:554:  converted_to_offcuts: 'pill-offcut'       # (5)
src/services/mocks/warehouse.ts:254:  offcut: 'converted_to_offcuts',                     # (6) AGGREGATE_TO_STATUS
src/views/admin/warehouse/WarehouseOffcutCreatePage.vue:36 — сверх плана, тот же маппинг

$ sed -n '60,64p' frontend_vue/src/styles/admin/components/_status-pills.css
.pill-offcut {
  background: rgba(140, 140, 140, 0.2);
  border: 1px solid rgba(140, 140, 140, 0.3);
  color: #8c8c8c;
}
```

**Осталось:** ничего.

---

## 5. roo_code/plans/warehouse/add-offcut-card-movements-section.md — **сделано**

Чекбоксов: 0.

```
$ grep -n "referenceId\|offcutId" frontend_vue/src/services/warehouseService.ts   # getMovements 158-180
173:  if (filters.referenceId) params.referenceId = filters.referenceId
174:  if (filters.offcutId) params.offcutId = filters.offcutId

$ sed -n '955,956p' frontend_vue/src/services/mocks/warehouse.ts
  if (filters.referenceId) filtered = filtered.filter((m) => m.referenceId === filters.referenceId)
  if (filters.offcutId) filtered = filtered.filter((m) => m.offcutId === filters.offcutId)

$ grep -n "movements" frontend_vue/src/composables/useWarehouseOffcutCard.ts
161:  const movements = ref<MovementListItem[]>([])
162:  const movementsLoading = ref(false)
164:  async function loadMovements() { ... getMovements({ search: '', offcutId: offcut.value.id,
      sortBy: 'movedAt', sortDir: 'desc' }, { page: 1, pageSize: 50 }) }
215:      await loadMovements()      # внутри load(), после установки offcut.value
348:      await loadMovements()      # перезагрузка после сохранения статуса/локации
412-413:    movements, movementsLoading    # экспорт

$ grep -n "section_offcut_movements" frontend_vue/src/i18n/admin/warehouse.ts
378:  'Движения по обрезку'   1056:  'Offcut movements'   1735:  'Atraižos judėjimai'
```

`WarehouseOffcutCard.vue:57` деструктурирует `movements`/`movementsLoading`; секция
`GlassPanel` c `data-test="offcut-card-movements-section"` стоит на 866-914 — после блока
Location, перед Files/Audit, с колонками Date/Type/Quantity/Reference, ссылкой на
`admin-warehouse-movement` и пустым состоянием `warehouse.empty_movements`. Разметка совпадает
с планом дословно, кроме фолбэка у юнита (`t('warehouse.unit_'+unit, movement.unit)`).

Одно отличие от буквы плана: выборка идёт по выделенному полю `offcutId`, а не по
`referenceId`. Фильтр `referenceId`, которого план требовал, тоже добавлен и в сервис, и в мок —
так что требование выполнено, а связь обрезка с движением сделана строже, чем предлагалось.

**Осталось:** ничего.
