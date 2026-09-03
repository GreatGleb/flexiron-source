# Инвентаризация планов — часть 047

Пачка: `roo_code/plans/warehouse` (6 планов). Код не менялся.

---

## 1. roo_code/plans/warehouse/fix-export-functionality.md — **частично**

itemsTotal: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0)

### Что есть

Вся обвязка на месте, шаг за шагом по «Implementation Order»:

```
$ grep -rn "exportWarehouseData" frontend_vue/src/
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:21:import { exportWarehouseData } from '@/services/warehouseService'
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:322:    const csv = await exportWarehouseData(activeTab.value, filters, locale.value)
frontend_vue/src/services/warehouseService.ts:250:export async function exportWarehouseData(

$ grep -rn "mockExportWarehouseCsv" frontend_vue/src/
frontend_vue/src/services/mocks/warehouse.ts:1589:export async function mockExportWarehouseCsv(_tab: string): Promise<string> {
frontend_vue/src/services/mocks/index.ts:43:  mockExportWarehouseCsv,
frontend_vue/src/services/mocks/index.ts:800:    return delay(mockExportWarehouseCsv(exportMatch[1] as string) as T)

$ grep -rn "export_error" frontend_vue/src/i18n/admin/warehouse.ts
576:      export_error: 'Ошибка экспорта',
1256:      export_error: 'Export error',
1933:      export_error: 'Eksporto klaida',

$ grep -n "exportCurrentTab\|escapeCsvField" frontend_vue/src/views/admin/warehouse/WarehousePage.vue
292:async function exportCurrentTab() {
826:          @click="exportCurrentTab"
```

- `warehouseService.ts:250-311` — функция `exportWarehouseData(tab, filters, locale?)` совпадает с планом
  пункт в пункт (все пять наборов параметров по табам), плюс сверх плана параметр `_locale`;
  завершается `return apiGet<string>('/api/warehouse/export/${tab}', params)`.
- `mocks/index.ts:795-801` — роут-матчер `^\/api\/warehouse\/export\/(stock|batches|offcuts|movements|deficit)$`
  ровно как в плане.
- `WarehousePage.vue:292-334` — `exportCurrentTab()` переписан на сервис: switch по табу → имя файла →
  `await exportWarehouseData(...)` → `Blob` → `a.download` → `catch { toast.error(t('warehouse.export_error')) }`.
  Старый локальный `escapeCsvField` из компонента удалён (grep выше: имени в файле нет).
- i18n-ключ `export_error` есть во всех трёх локалях.

### Чего нет

Главного — генерации CSV в моке. Мок это заглушка:

```
$ sed -n '1587,1591p' frontend_vue/src/services/mocks/warehouse.ts
// ─── Export ─────────────────────────────────────────────────────────────────

export async function mockExportWarehouseCsv(_tab: string): Promise<string> {
  return 'mock-csv-data'
}

$ grep -rn "uFEFF\|escapeCsv\|csv" frontend_vue/src/services/mocks/warehouse.ts
frontend_vue/src/services/mocks/warehouse.ts:1590:  return 'mock-csv-data'
```

- Требование 2 плана («мок генерирует настоящий CSV из in-memory сторов») не выполнено:
  ни BOM, ни заголовков, ни строк, ни `escapeCsvField`, ни одной ветки switch по табам.
- Требования 4 и 5 (все данные под фильтры, все 5 табов) в мок-режиме тоже не выполнены:
  подпись `(_tab: string)` игнорирует и таб, и `params` — фильтры, которые сервис аккуратно
  собирает, до мока доходят и выбрасываются.
- Шаг 7 плана («Verify all 5 tabs export correctly in mock mode») недоказуем: в `frontend_vue/tests`
  и `frontend_vue/src` нет ни одного теста, упоминающего экспорт склада или `mock-csv-data`
  (`grep -rn "mock-csv-data" frontend_vue/src frontend_vue/tests` → только сама заглушка).
- Замечание в сторону: реальный серверный путь идёт через `apiGet` (`api.ts:144-161`) с общим
  `unwrap<T>`, то есть текст ответа как текст там не разбирается — план обещал «handle the response
  as text», этого нет. Бэкендового эндпоинта экспорта тоже нет.

filesMentioned: frontend_vue/src/services/warehouseService.ts, frontend_vue/src/services/mocks/warehouse.ts,
frontend_vue/src/services/mocks/index.ts, frontend_vue/src/views/admin/warehouse/WarehousePage.vue,
frontend_vue/src/i18n/admin/warehouse.ts, frontend_vue/src/services/mocks/suppliers.ts

---

## 2. roo_code/plans/warehouse/fix-inline-action-button-styles.md — **сделано** (2 пункта чек-листа — визуальные, непроверяемые)

itemsTotal: 8

### Доказательство

```
$ grep -rn "inline-action-btn" frontend_vue/src/
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2786:  class="inline-action-btn inline-action-btn--used"
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2795:  class="inline-action-btn inline-action-btn--scrap"
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:3736:  class="inline-action-btn inline-action-btn--used"
frontend_vue/src/views/admin/warehouse/WarehousePage.vue:3747:  class="inline-action-btn inline-action-btn--used"
frontend_vue/src/styles/admin/warehouse_list.css:469:.inline-action-btn {
frontend_vue/src/styles/admin/warehouse_list.css:487:.inline-action-btn:hover {
frontend_vue/src/styles/admin/warehouse_list.css:493:.inline-action-btn svg {
frontend_vue/src/styles/admin/warehouse_list.css:499:.inline-action-btn--used {
frontend_vue/src/styles/admin/warehouse_list.css:505:.inline-action-btn--used:hover {
frontend_vue/src/styles/admin/warehouse_list.css:512:.inline-action-btn--scrap {
frontend_vue/src/styles/admin/warehouse_list.css:518:.inline-action-btn--scrap:hover {
```

`sed -n '460,525p' frontend_vue/src/styles/admin/warehouse_list.css` — блок стоит сразу после
`.row-actions` (строка 457), как и требовал план, и совпадает с предложенным CSS дословно:
базовый класс (`inline-flex`, `gap: 6px`, `padding: 6px 12px`, `font-size: 12px`, `font-weight: 500`,
`border-radius: 6px`, `transition: all 0.2s ease`), `:hover`, `svg { flex-shrink: 0; display: block }`,
`--used` (`#52c41a` / `rgba(82,196,26,0.08)`, hover `#73d13d`), `--scrap`
(`#fadb14` / `rgba(250,173,20,0.08)`, hover `#ffe58f`).

Разметка: обрезки — «использован» (`--used`, иконка `check`) и «в утиль» (`--scrap`, иконка `trash`),
`WarehousePage.vue:2784-2802`; дефицит — «в работе» (`--used`, иконка `play`) и «решён» (`--used`,
иконка `check`), `WarehousePage.vue:3733-3751`. Оба дефицитных используют зелёный `--used` — то,
что план и просил проверить. Дублей определения класса в других таблицах стилей нет (grep выше).

### Пункты чек-листа

1. Offcuts «использован» зелёный — сделано (`--used` на строке 2786 + правило 499).
2. Offcuts «в утиль» оранжевый/warning — сделано (`--scrap` на 2795 + правило 512).
3. Deficit «в работе» зелёный — сделано (`--used` на 3736).
4. Deficit «решён» зелёный — сделано (`--used` на 3747).
5. Hover-состояния — сделано (правила 487, 505, 518).
6. Кнопки влезают в строку таблицы — непонятно: браузерная проверка, кодом не доказывается
   (косвенно: `padding 6px 12px`, `font-size 12px`, `white-space: nowrap`, `line-height: 1`).
7. Выравнивание SVG внутри кнопок — сделано (`align-items: center`, `gap: 6px`,
   `.inline-action-btn svg { flex-shrink: 0; display: block }`).
8. Существующие стили не сломаны — непонятно: визуальная регрессия; кодом видно лишь, что
   имя класса нигде больше не определено и не переопределяется.

filesMentioned: frontend_vue/src/views/admin/warehouse/WarehousePage.vue,
frontend_vue/src/styles/admin/components/_buttons.css,
frontend_vue/src/styles/admin/components/_action-icons.css,
frontend_vue/src/styles/admin/warehouse_list.css

---

## 3. roo_code/plans/warehouse/fix-mockCreateOffcut-batch-qty-and-movement.md — **сделано**

itemsTotal: 0

### Доказательство

`frontend_vue/src/services/mocks/warehouse.ts:828-885` (`sed` вокруг
`grep -n "export async function mockCreateOffcut"` → 828):

```ts
export async function mockCreateOffcut(data: OffcutCreatePayload): Promise<WarehouseOffcut> {
  const batch = batchStore.find((b) => b.id === data.batchId)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  ...
  const offcut: WarehouseOffcut = { id, batchId: data.batchId, batchNumber, ... }
  offcutStore.push(offcut)

  // Движение — единственный владелец количества партии: оно и списывает.
  await mockCreateMovement({
    type: 'offcut', batchId: data.batchId, offcutId: id,
    quantity: material.material, movedAt: now,
    notes: `Offcut created from batch ${batchNumber}`,
  })
  return offcut
}
```

Все три претензии плана закрыты:
1. количество партии уменьшается — но не вторым вычитанием в этой функции, а через `mockCreateMovement`
   (`writeMovement`), единственного владельца количества; комментарий над функцией (строки ~1250-1260
   и шапка перед 828) прямо описывает, что дублирующее вычитание здесь было и его убрали, потому что
   обрезок в 3 забирал с партии 6. Эффект плана достигнут более строгим способом, чем предложенный код.
2. движение создаётся;
3. поля `batchId: data.batchId` и `batchNumber` (из найденной партии) на месте — `sourceBatchId`/
   `sourceBatchNumber` в файле не встречаются.

Сверх плана: проверки `BATCH_NOT_FOUND`, `resolveOffcutMaterial` и `INSUFFICIENT_QUANTITY` вместо
молчаливого `Math.max(0, …)`.

filesMentioned: frontend_vue/src/services/mocks/warehouse.ts

---

## 4. roo_code/plans/warehouse/fix-movement-card-mock.md — **сделано**

itemsTotal: 0

### Доказательство

```
$ grep -rn "mockGetMovement\b" frontend_vue/src/services/mocks/*.ts
frontend_vue/src/services/mocks/index.ts:23:  mockGetMovement,
frontend_vue/src/services/mocks/index.ts:735:    return delay(mockGetMovement(movementCardMatch[1] as string) as T)
frontend_vue/src/services/mocks/warehouse.ts:1165:export async function mockGetMovement(id: string): Promise<WarehouseMovement> {
frontend_vue/src/services/mocks/warehouse-transfer-location.spec.ts:10, 286 (используется в тесте)

$ grep -rn "movementCardMatch\|warehouse/movements" frontend_vue/src/services/mocks/index.ts
733:  const movementCardMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
734:  if (movementCardMatch) {
735:    return delay(mockGetMovement(movementCardMatch[1] as string) as T)
738:  if (path === '/api/warehouse/movements') {
```

Функция есть, импорт есть, матчер карточки стоит до обработчика списка (733 < 738) — как и требовал
план. Дополнительно поведение покрыто юнит-тестом
`frontend_vue/src/services/mocks/warehouse-transfer-location.spec.ts:286`.

filesMentioned: frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue,
frontend_vue/src/composables/useWarehouseMovementCard.ts,
frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/services/mocks/index.ts

---

## 5. roo_code/plans/warehouse/fix-movement-modal-correction-behavior.md — **сделано** (реализовано на выросшей форме, не на той, что описана в плане)

itemsTotal: 0

### Доказательство

`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`:

```
159:const isCorrection = computed(() => type.value === 'correction')

184:const selectedAggregateAfter = computed(() => {
189:  if (dir === 'correction') return quantity.value || 0
...
247:function validate(): boolean {
251:  if (isCorrection.value) {
252:    if (quantity.value < 0) e.quantity = t('validation.min', { min: 0 })
254:    else if (quantity.value === selectedAggregateQuantity.value) e.quantity = t('warehouse.correction_no_change')
256:  } else { ...  > 0, лимит агрегата, лимит quantityRemaining ... }

278:const isFormValid = computed(() => {
281:  if (isCorrection.value) { if (quantity.value < 0) return false; if (quantity.value === selectedAggregateQuantity.value) return false }
285:  else { ... }

313:  if (isCorrection.value) return null      // quantityError глушится в режиме корректировки

692:<template v-if="!isCorrection">          // поле «количество в новом движении» спрятано
715:  <span v-if="isCorrection" class="required">*</span>
718:  <input v-if="isCorrection" v-model.number="quantity" ... data-test="create-movement-selected-after" />
727:  <input v-else :value="selectedAggregateAfter" readonly ... />
735:<p v-if="!isCorrection" class="field-readonly-hint">
```

Оба требования плана выполнены: в корректировке поле «Количество в новом движении» скрыто, а поле
итога становится редактируемым и пишет прямо в `quantity`. Валидация и `isFormValid` разведены по
ветке `isCorrection` (сверх плана — ещё запрет «корректировка без изменения»,
`warehouse.correction_no_change`).

Расхождение с буквой плана, не с сутью: имени `totalQuantityAfter` в файле нет — форма с тех пор
переросла план. Редактируемое в корректировке поле — `field_selected_after` (`selectedAggregateAfter`),
а `field_total_quantity` (`totalInStockAfter`, строка ~740) остался всегда read-only. Ложной дыры это
не создаёт: `correction` доступен в списке типов только когда выбран агрегат или продажа
(`availableMovementTypes`, 409-425: без выбора доступен лишь `receipt`), а блок редактируемого поля
показывается ровно при `(selectedAggregateType || selectedSaleId) && type`. Плюс `watch(type)`
(486-492) при входе в корректировку подставляет текущее количество агрегата.

filesMentioned: frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue

---

## 6. roo_code/plans/warehouse/fix-movement-modal-default-type-placeholder.md — **сделано**

itemsTotal: 0

### Доказательство

```
$ grep -n "const type = ref\|type.value = " frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
54:const type = ref<MovementType | ''>('')
439:  type.value = ''            // resetForm()
467:    type.value = ''          // сброс, если выбранный тип стал недоступен

$ grep -rn "movement_modal_type_placeholder" frontend_vue/src
frontend_vue/src/i18n/admin/warehouse.ts:304:  movement_modal_type_placeholder: 'Выберите тип операции',
frontend_vue/src/i18n/admin/warehouse.ts:983:  movement_modal_type_placeholder: 'Select operation type',
frontend_vue/src/i18n/admin/warehouse.ts:1664:  movement_modal_type_placeholder: 'Pasirinkite operacijos tipą',
frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:672:  :placeholder="t('warehouse.movement_modal_type_placeholder')"
```

Обе строчки, которые требовал план, изменены: дефолт `type` — пустая строка (тип расширен до
`MovementType | ''`, иначе TS не пропустил бы), `resetForm()` сбрасывает в `''`. Остальные пункты
плана были «no change needed» и таковыми и остались: `validate()` (249: `if (!type.value) e.type = …`),
`isFormValid` (279: `if (!type.value || !movedAt.value) return false`), эффект типа показывается
только при `type` (676: `v-if="type && selectedMovementEffect"`), в списке опций пустого значения нет
(`availableMovementTypes`, 409-425).

filesMentioned: frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue,
frontend_vue/src/components/admin/ui/CustomSelect.vue,
frontend_vue/src/styles/admin/components/_custom-select.css
