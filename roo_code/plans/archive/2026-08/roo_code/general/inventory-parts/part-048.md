# Инвентаризация: roo_code/plans/warehouse (часть 048)

Проверено 2026-08-26. Код не менялся.

---

## 1. roo_code/plans/warehouse/fix-movement-modal-show-unit-in-selected-qty.md — **сделано**

Чекбоксов: 0.

Доказательство:
```
$ grep -rn "batchUnitLabel|selected-qty-display|create-movement-selected-qty|field_selected_quantity" frontend_vue/src/
src/i18n/admin/warehouse.ts:438:      field_selected_quantity: 'Количество в выбранных',
src/i18n/admin/warehouse.ts:1116:      field_selected_quantity: 'Selected quantity',
src/i18n/admin/warehouse.ts:1794:      field_selected_quantity: 'Pasirinktų kiekis',
src/views/admin/warehouse/CreateMovementModal.vue:238:const batchUnitLabel = computed(() => {
src/views/admin/warehouse/CreateMovementModal.vue:684:          <div class="selected-qty-display" data-test="create-movement-selected-qty">
src/styles/admin/components/_forms.css:714:.selected-qty-display {
src/styles/admin/components/_forms.css:728:.selected-qty-display .selected-qty-value {
src/styles/admin/components/_forms.css:732:.selected-qty-display .qty-unit {
```
CreateMovementModal.vue:237-241 — `batchUnitLabel` = `t('warehouse.unit_${props.batch.unit}', props.batch.unit)`;
683-688 — label + `.selected-qty-display` с `.selected-qty-value` и `.qty-unit`, input заменён.
_forms.css:713-735 — стили ровно из плана (flex, gap 4px, padding 8px 12px, min-height 38px) плюс
добавленное правило `.selected-qty-value`.

Отклонения от буквы плана, не от смысла: переменная в шаблоне называется `selectedAggregateQuantity`
(в плане `selectedMovementsQuantity`), число завёрнуто в `<span class="selected-qty-value">`,
блок показывается по `v-if="selectedAggregateType || selectedSaleId"`.

---

## 2. roo_code/plans/warehouse/fix-offcut-card-i18n-keys.md — **сделано**

Чекбоксов: 0.

Доказательство (все 13 ключей есть трижды — ru/en/lt):
```
$ for k in col_offcut_type col_width col_thickness no_audit_entries audit_col_date audit_col_user \
    audit_col_property audit_col_old_value audit_col_new_value btn_delete_audit_entry \
    delete_audit_entry_title confirm_delete_audit_entry; do grep -c "^ *$k:" src/i18n/admin/warehouse.ts; done
3 3 3 3 3 3 3 3 3 3 3 3
$ grep -n "^ *loading:" src/i18n/admin/warehouse.ts
453:      loading: 'Загрузка...',
1131:      loading: 'Loading...',
1809:      loading: 'Įkeliama...',
$ grep -rn "tooltip.view_details" src/views/admin/warehouse/
(пусто)
$ grep -n "open_offcut_card" src/views/admin/warehouse/WarehousePage.vue
2775:                      v-tooltip="t('warehouse.open_offcut_card')"
```
`tooltip.view_details` остался только в suppliers/products/categories — в складской таблице обрезков
подсказка уже `warehouse.open_offcut_card`, как требовал план.

Примечание: третий пункт плана (`CreateOffcutModal.vue`, `col_width`) проверить по указанному пути
нельзя — файла нет, `find src -name "*Offcut*"` даёт `WarehouseOffcutCreatePage.vue`. Ключ
`col_width` там используется и в i18n присутствует, так что требование закрыто в новом месте.

---

## 3. roo_code/plans/warehouse/fix-offcut-movement-deficit-not-found.md — **частично**

Чекбоксов: 0.

Что сделано — Шаг 2 целиком, во всех трёх композаблах: `loadAudit()` нет, импортов
`getOffcutAudit`/`getMovementAudit`/`getDeficitAudit` нет, аудит читается из основного ответа.
```
$ grep -n "loadAudit|getOffcutAudit|getMovementAudit|getDeficitAudit|auditLog.value" \
    src/composables/useWarehouse{Offcut,Movement,Deficit}Card.ts
useWarehouseOffcutCard.ts:187:      auditLog.value = auditLog.value.filter(...)
useWarehouseOffcutCard.ts:214:      auditLog.value = data.auditLog
useWarehouseMovementCard.ts:24:  ... :37:      auditLog.value = data.auditLog
useWarehouseDeficitCard.ts:53: ... :72:      auditLog.value = data.auditLog
```

Чего нет — Шаг 1 для обрезков и дефицита:
```
$ sed -n '808,812p' src/services/mocks/warehouse.ts
export async function mockGetOffcut(id: string): Promise<WarehouseOffcut> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  return { ...offcut }
}
$ sed -n '1394,1398p' src/services/mocks/warehouse.ts
export async function mockGetDeficitItem(id: string): Promise<WarehouseDeficit> {
  const deficit = deficitStore.find((d) => d.id === id)
  if (!deficit) throw new Error('DEFICIT_NOT_FOUND')
  return { ...deficit }
}
$ sed -n '1165,1170p' src/services/mocks/warehouse.ts
export async function mockGetMovement(id: string): Promise<WarehouseMovement> {
  ...
  const audit = preExistingMovementIds.has(id) ? [...getOrCreateMovementAudit(id)] : []
  return { ...movement, auditLog: audit }
}
$ grep -rn "getOrCreateOffcutAudit|getOrCreateDeficitAudit" src/services/mocks/warehouse.ts
(пусто)
```
То есть только движение подмешивает аудит (и то условно, по `preExistingMovementIds`).
Хелперов `getOrCreateOffcutAudit`/`getOrCreateDeficitAudit`, которые план предписывает вызвать,
в проекте нет вовсе. Аудит обрезков и дефицита живёт прямо в записях сидов
(`src/mocks/warehouse-offcuts.ts` — 13 записей, аудит непустой у одной;
`src/mocks/warehouse-deficit.ts` — аналогично; сдвиг дат в `warehouse.ts:213,215`),
поэтому `data.auditLog` не пустой и NOT_FOUND от лишнего запроса действительно ушёл —
цель плана достигнута другим способом, буква Шага 1 не выполнена.

---

## 4. roo_code/plans/warehouse/fix-offcuts-action-buttons.md — **сделано**

Чекбоксов: 11.

Доказательство:
```
$ grep -n "OffcutPatchPayload" src/types/warehouse.ts
280:export interface OffcutPatchPayload {   (status/notes/location + weightKg)
$ grep -n "export async function patchOffcut" -A2 src/services/warehouseService.ts
148:export async function patchOffcut(id, data: OffcutPatchPayload): Promise<WarehouseOffcut> {
149:  return apiPatch<WarehouseOffcut>(`/api/warehouse/offcuts/${id}`, data)
$ grep -n "mockPatchOffcut" src/services/mocks/warehouse.ts src/services/mocks/index.ts
warehouse.ts:881:export async function mockPatchOffcut(
index.ts:20:  mockPatchOffcut,
index.ts:1308:      mockPatchOffcut(
$ grep -n "offcutPatchMatch" src/services/mocks/index.ts
1305:  const offcutPatchMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
$ grep -n "patchOffcut as patchOffcutApi|OffcutStatus" src/composables/useWarehouse.ts
13:  patchOffcut as patchOffcutApi,
29:  OffcutStatus,
352:      await patchOffcutApi(id, { status: status as OffcutStatus })
```
`updateOffcutStatus` (useWarehouse.ts:350-371) вызывает `patchOffcutApi`, `patchDeficitItemApi`
там больше нет; успех — `toast.success(t('warehouse.toast_offcut_saved'))` + `loadOffcuts()`,
ошибка — `toast.error(t('warehouse.toast_error'))`. Сверх плана: после патча создаётся движение
в отдельном try/catch, чтобы его падение не ломало смену статуса.

Пункты чек-листа:
1. `OffcutPatchPayload` в types — **сделано** (types/warehouse.ts:280).
2. `patchOffcut` в warehouseService — **сделано** (:148).
3. `mockPatchOffcut` в mocks/warehouse — **сделано** (:881, через `Object.assign`, не по полям).
4. импорт `mockPatchOffcut` в mocks/index — **сделано** (:20).
5. PATCH-роут `/api/warehouse/offcuts/:id` — **сделано** (index.ts:1305-1311).
6. `patchOffcutApi` импортирован в useWarehouse — **сделано** (:13).
7. `updateOffcutStatus` зовёт `patchOffcutApi` — **сделано** (:352).
8. `OffcutStatus` импортирован в useWarehouse — **сделано** (:29).
9. «Использован» ставит статус и даёт success-тост — **сделано**, но статус `in_production`,
   не `'used'`: WarehousePage.vue:2788 `updateOffcutStatus(offcut.id, 'in_production', offcut)`.
   Имена статусов в плане устарели.
10. «В утиль» — **сделано**, статус `scrapped` (WarehousePage.vue:2797), не `'scrap'`.
11. Ошибка даёт error-тост без падения — **сделано** (useWarehouse.ts:368-370).

---

## 5. roo_code/plans/warehouse/fix-offcuts-type-column.md — **частично**

Чекбоксов: 10.

Что есть — все шесть файловых правок плана:
```
$ grep -rn "offcut-type-badge" src/styles/ src/views/
src/styles/admin/warehouse_list.css:1076:.offcut-type-badge {
src/styles/admin/warehouse_list.css:1085:.offcut-type-badge--sheet {
src/styles/admin/warehouse_list.css:1089:.offcut-type-badge--linear {
src/views/admin/warehouse/WarehousePage.vue:2735:                    class="offcut-type-badge"
$ grep -rn "col_offcut_type_hint" src/i18n/admin/warehouse.ts
61 / 743 / 1437  — ru/en/lt, текст ровно из плана
$ sed -n '2334,2723p' src/views/admin/warehouse/WarehousePage.vue | grep -n "toggleOffcutsSort|th-actions"
productName, offcutType, batchNumber, lengthMm, weightKg, quantity, unit, location, status, th-actions
```
Колонка «Тип» стоит второй, с подсказкой и иконками сортировки; ячейка товара чистая
(2726-2732 — только `router-link`), бейдж в своей `<td>` (2733-2741) с `v-else` «—»;
CSS 1075-1092 совпадает с планом до значения.
(Прим.: утверждение плана «у `.offcut-type-badge` нет ни одного CSS-правила» устарело — правила есть.)

Чего нет — сортировка по типу не работает на данных:
```
$ sed -n '797,804p' src/services/mocks/warehouse.ts
  const sortBy = filters.sortBy || 'createdAt'
  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt)
    else if (sortBy === 'productName') cmp = a.productName.en.localeCompare(b.productName.en)
    else if (sortBy === 'quantity') cmp = a.quantity - b.quantity
    return sortDir === 'desc' ? -cmp : cmp
  })
```
`useWarehouse.loadOffcuts` (:229-236) отправляет `sortBy` в API, мок ветки `offcutType` не имеет —
`cmp` остаётся 0, порядок не меняется. Кнопка переключается и иконки подсвечиваются, а строки нет.
Тот же пробел у batchNumber/lengthMm/weightKg/unit/location/status, так что это общий долг мока,
а не только колонки типа.

Пункты чек-листа:
1. Ячейка товара чистая — **сделано** (WarehousePage.vue:2726-2732).
2. Новая колонка «Тип» между Product и Batch — **сделано** (thead:2364-2408).
3. Бейдж в колонке типа — **сделано** (2733-2741, `warehouse.offcut_type_${...}`).
4. Бейдж стилизован — **сделано** (warehouse_list.css:1076-1092).
5. Сортировка по `offcutType` работает — **частично**: UI-переключение и иконки есть,
   мок по `offcutType` не сортирует (mocks/warehouse.ts:798-804).
6. Тултип по `col_offcut_type_hint` — **сделано** (2367, ключ в трёх локалях).
7. Ключи `col_type`, `col_offcut_type_hint`, `offcut_type_sheet`, `offcut_type_linear` во всех
   локалях — **сделано** (`grep -c` даёт 3 для каждого).
8. `offcutType` пустой → «—» — **сделано** (`<span v-else class="text-muted">&mdash;</span>`, 2740).
9. Прочие колонки не тронуты — **сделано** (порядок thead выше совпадает с таблицей плана).
10. Ширины/адаптив не поломаны — **непонятно**: машинной проверкой не устанавливается,
    нужен визуальный прогон.

---

## 6. roo_code/plans/warehouse/fix-stock-card-header-title.md — **сделано**

Чекбоксов: 0.

Доказательство:
```
$ grep -rn "stock_card_title" src/
src/i18n/admin/warehouse.ts:587:      stock_card_title: 'Остаток {id} — {productName}',
src/i18n/admin/warehouse.ts:1267:      stock_card_title: 'Stock {id} — {productName}',
src/i18n/admin/warehouse.ts:1944:      stock_card_title: 'Likutis {id} — {productName}',
src/views/admin/warehouse/WarehouseStockCard.vue:113:  (pageTitle)
src/views/admin/warehouse/WarehouseStockCard.vue:244:  (breadcrumb)
src/views/admin/warehouse/WarehouseStockCard.vue:254:  (h1)
```
`pageTitle` (111-115) — `t('warehouse.stock_card_title', { id: productId, productName: tf(...) })`,
иначе `warehouse.header_title`; `useHead` (117-120) даёт `Flexiron — ${pageTitle}`;
`<h1 class="page-title">` (252-255) и последняя крошка (244-247) — тот же ключ.
Строк `t('warehouse.tab_stock') — {{ tf(item.productName) }}` в `<h1>` больше нет.
