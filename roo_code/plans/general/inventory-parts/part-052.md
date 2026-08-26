# Инвентаризация планов — часть 052

Каталог: `roo_code/plans/warehouse` (фазы 3 и 4 карточки/создания партии).
Код не менялся. Общая проверка типов: `cd frontend_vue && npm run typecheck` → чисто (нет вывода после
строки `> vue-tsc --noEmit`), она закрывает во всех планах пункт «Component compiles without TypeScript errors».

Сквозной вывод пачки: **фаза 3 сделана, фаза 4 сделана иначе** — вместо трёх модалок
(`CreateBatchModal.vue`, `CreateOffcutModal.vue`) проект пошёл в отдельные страницы
(`WarehouseBatchCreatePage.vue`, `WarehouseCuttingPage.vue`) с собственными композаблами и своими
`data-test`. Выжила только `CreateMovementModal.vue`, и та в другой роли — она живёт на карточке
партии и получает партию пропом, а не выбирает её из списка.

---

## 1. `roo_code/plans/warehouse/phase3-subtask1-useWarehouseBatch.md` — сделано

Незакрытых чекбоксов: 8.

Доказательство:
```
$ ls -la frontend_vue/src/composables/useWarehouseBatch.ts
-rw-rw-r-- 1 greatgleb greatgleb 15049 Aug 26 15:30 frontend_vue/src/composables/useWarehouseBatch.ts
```
В файле: `useDirtyCheck` (стр. 130 `const dirty = useDirtyCheck(form)`), `useToast`, `useTranslatedField`,
`load()` c `Promise.all([loadMovements(), loadOffcuts(), loadAudit(), loadBatchAggregates(), loadBatchActiveSales()])`,
`save()` через `patchBatch(id, delta)`, `discard()`, `remove()` с `router.push({ name: 'admin-warehouse', params: { tab: 'batches' } })`,
`tf` в возвращаемом объекте. Типы явные (`Ref<WarehouseBatch | null>` через `ref<WarehouseBatch | null>(null)` и т.д.).

Отклонение от текста плана (не в критериях приёмки, работы не требует): форма развилась —
`location` разобран на `locationRack/locationRow/locationCell/locationNotes` (парсер `parseLocation`,
сборка `composeLocation`), `unitPrice` теперь `number | null`, добавлены `unit`, `marginPercent`,
`currency`, файлы (`onFilesUploaded`, `removeFile`), аудит, агрегаты, активные продажи,
`createBatchMovement`, `deleteBlockedByOrder`. Это надмножество плана.

| Пункт | Вердикт |
|---|---|
| Composable is created at useWarehouseBatch.ts | сделано |
| Follows the same pattern as useServiceCard.ts | сделано |
| Uses `useDirtyCheck` | сделано |
| Uses `useToast` | сделано |
| Loads batch, related movements, related offcuts | сделано |
| Provides save/discard/remove | сделано |
| Exposes tf() | сделано |
| All state refs and methods properly typed | сделано |

---

## 2. `roo_code/plans/warehouse/phase3-subtask2-WarehouseBatchCard.md` — частично

Незакрытых чекбоксов: 12.

Доказательство:
```
$ wc -l frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
1629
$ grep -n "useWarehouseBatch" .../WarehouseBatchCard.vue
7:import { useWarehouseBatch } from '@/composables/useWarehouseBatch'
114:} = useWarehouseBatch(id)
$ grep -n "isEditing" .../WarehouseBatchCard.vue      → ничего
$ grep -c 'v-model="form\.' .../WarehouseBatchCard.vue → 9
```
data-test из плана (10 имён): есть `batch-card-delete-btn`, `batch-card-save-btn`,
`batch-card-discard-btn`, `batch-card-movements-section`, `batch-card-offcuts-section`,
`batch-card-files-section`, `batch-card-delete-modal`; **нет** `batch-card-edit-btn`,
`batch-card-form`, `batch-card-audit-section` (аудит помечен `batch-card-audit`).

CSS-классы из плана — ни одного:
```
$ for c in batch-card-edit-form batch-card-form-row batch-card-mini-table batch-card-audit batch-card-files batch-card-mode-toggle; do grep -rn "\.$c\b" src/styles/ | wc -l; done
0 0 0 0 0 0
```
Карточка использует общие классы (`main-card-content`, `GlassPanel`, `data-table`, `audit-panel-wide`),
а `.page-batch-card` и `.batch-card-header` в стилях есть (по 7 совпадений).

i18n: 10 из 11 ключей плана есть во всех трёх локалях, `files_coming_soon` — 0 совпадений
(и не нужен: загрузка файлов реально работает через `DropZone`/`FileItem`).

Аудит: `createdAt`/`updatedAt` в шаблоне не выводятся (`grep -n "createdAt\|updatedAt"` → ничего),
вместо них полноценный журнал (`auditLog`, таблица `batch-card-audit-table`, удаление записи).

Что осталось: ничего содержательного. Расхождения — сознательная эволюция (нет режима
view/edit, поля редактируются на месте; файлы реальные, а не заглушка; аудит вместо двух
таймстампов). Пункты про `batch-card-*` CSS и два-три `data-test` формально не выполнены, но
переписывать под план сейчас значило бы откатывать более сильную реализацию.

| Пункт | Вердикт |
|---|---|
| Uses `useWarehouseBatch` instead of inline logic | сделано (стр. 7, 114) |
| View mode displays all info sections | сделано (левая/центральная/правая панели, локация, приход) |
| Edit mode with inputs + Save/Discard | частично — редактирование inline, режима нет, `batch-card-form`/`batch-card-edit-btn` отсутствуют; Save/Discard есть |
| Delete button with confirmation modal | сделано (`batch-card-delete-btn`, `batch-card-delete-modal`, плюс модалка «связано с заказом») |
| Movements section mini-table | сделано (`batch-card-movements-table`, класс `data-table`, не `batch-card-mini-table`) |
| Offcuts section mini-table | сделано (`batch-card-offcuts-table`) |
| Files section placeholder | сделано сверх плана — реальная загрузка (`DropZone`, `FileItem`), заглушки нет |
| Audit section shows created/updated | частично — раздел есть, но таймстампов нет; вместо них журнал аудита |
| All new i18n keys for ru/en/lt | частично — 10/11, нет `files_coming_soon` |
| All new CSS classes added | не начато — ни одного из шести классов, взяты общие |
| All data-test attributes added | частично — 7/10 |
| Compiles without TypeScript errors | сделано (`npm run typecheck` чисто) |

---

## 3. `roo_code/plans/warehouse/phase3-subtask3-route.md` — сделано

Незакрытых чекбоксов: 4. План — проверочный, изменений не требует.

Доказательство:
```
$ grep -n -A5 "warehouse/batches/:id" frontend_vue/src/router/index.ts
261:        path: 'warehouse/batches/:id',
262-        name: 'admin-warehouse-batch',
263-        component: () => import('@/views/admin/warehouse/WarehouseBatchCard.vue'),
264-        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
265-      },
$ grep -c "warehouse/batches/:id" frontend_vue/src/router/index.ts
1
```
Единственное расхождение с планом — номер строки (план говорит 184-189, фактически 261-265).

| Пункт | Вердикт |
|---|---|
| Route exists and properly configured | сделано |
| Name `admin-warehouse-batch` | сделано |
| Feature flag `adminWarehouse` | сделано |
| Component lazy-loaded | сделано (`() => import(...)`) |

---

## 4. `roo_code/plans/warehouse/phase4-subtask1-CreateBatchModal.md` — частично

Незакрытых чекбоксов: 8.

Доказательство:
```
$ find frontend_vue/src -name "CreateBatchModal*"
(пусто)
$ wc -l src/views/admin/warehouse/WarehouseBatchCreatePage.vue src/composables/useWarehouseBatchCreate.ts
  939 src/views/admin/warehouse/WarehouseBatchCreatePage.vue
  432 src/composables/useWarehouseBatchCreate.ts
$ grep -n -B2 -A4 "WarehouseBatchCreatePage" src/router/index.ts
279:        path: 'warehouse/batches/new',
280:        name: 'admin-warehouse-batch-create',
281:        component: () => import('@/views/admin/warehouse/WarehouseBatchCreatePage.vue'),
$ grep -rn "admin-warehouse-batch-create" src/views/admin/warehouse/WarehousePage.vue
848:          @click="router.push({ name: 'admin-warehouse-batch-create' })"
```
Функциональность вся на месте, но страницей: валидация `useWarehouseBatchCreate.ts:306-320`
(`productId`, `batchNumber`, `lotCode`, `quantity`, `unit`, `unitPrice`, `receivedAt` — ровно
список плана), `isFormValid` (332), `totalCost` (185-187, `quantity × effectiveUnitPrice`),
`createBatch(payload)` + `toast.success('warehouse.toast_batch_created')` (385-386),
`toast.error('warehouse.toast_error_save')` (389). Поля: выбор товара таблицей с радио,
поставщик, номер партии, лот, количество, ед., цена, приход, срок, локация (rack/row/cell/notes),
сертификат, заметки, файлы.

Чего нет: самого файла модалки, пропа `show`, эмитов `close`/`created`, сброса по открытию
(страница монтируется заново), всех `data-test` из плана — вместо них `batch-create-*`/`field-*`.

| Пункт | Вердикт |
|---|---|
| Modal created at CreateBatchModal.vue | не начато — файла нет, реализовано страницей `WarehouseBatchCreatePage.vue` |
| All form fields with validation | сделано (на странице; `useWarehouseBatchCreate.ts:306`) |
| Total cost auto-calculated | сделано (`useWarehouseBatchCreate.ts:185`) |
| On success: toast, emit `created`, close modal | частично — тост есть, вместо emit/close возврат `batch.id` и навигация |
| On error: toast error, keep modal open | частично — тост есть, модалки нет |
| Form resets when modal opens | непонятно — у страницы нет пропа `show`, сброс обеспечен монтированием |
| All data-test attributes added | частично — имена другие (`batch-create-*`), ни одного `create-batch-*` |
| Compiles without TypeScript errors | сделано |

---

## 5. `roo_code/plans/warehouse/phase4-subtask2-CreateMovementModal.md` — частично

Незакрытых чекбоксов: 10.

Доказательство:
```
$ wc -l frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
852
$ grep -c "^\s*<ключ>:" src/i18n/admin/warehouse.ts  (по 9 новым ключам)
field_movement_type 3, field_source_batch 3, field_movement_quantity 3, field_reference_type 3,
field_reference_id 3, field_performed_by 3, field_moved_at 3, field_from_location 3, field_to_location 3
$ data-test плана: 12 из 14 есть; НЕТ create-movement-batch-select, create-movement-price-input
```
Ключевые места: `validate()` 247-276 и `isFormValid` 278-299 (в т.ч. `quantity > props.batch.quantityRemaining`
для `expense`/`write-off`, стр. 266-273), `resetForm()` 438 + `watch(props.show → resetForm())` 454-458,
`toast.success('warehouse.toast_movement_created')` 526 → `emit('created')` 527 → `emit('close')` 528,
`toast.error('warehouse.toast_error_save')` 530 (модалка остаётся), `showTransferLocations` 340.

Главное расхождение: партия приходит пропом (`batch?: WarehouseBatch | null`, стр. 39) — модалка
живёт на карточке партии (`WarehouseBatchCard.vue`, кнопка `batch-card-add-movement-btn`), выбора
партии из списка нет, `getBatches` не вызывается, поля `unitPrice` нет. Зато добавлено то, чего в
плане не было: карточки агрегатов по типам движения, привязка к активным продажам, режим коррекции.
Шапка файла прямо документирует, что «DEPRECATED» здесь была ложной меткой.

| Пункт | Вердикт |
|---|---|
| Modal created at CreateMovementModal.vue | сделано |
| All form fields with conditional visibility | частично — условная видимость есть, но нет `batchId`-селектора и `unitPrice` |
| Batch selector shows batches with remaining qty | не начато — партия передаётся пропом, селектора нет |
| Quantity validation against batch remaining | сделано (стр. 266-273, 292-298) |
| On success: toast, emit `created`, close | сделано (526-528) |
| On error: toast, keep open | сделано (530) |
| Form resets when modal opens | сделано (438, 454-458) |
| All data-test attributes added | частично — 12/14 |
| New i18n keys for 3 locales | сделано — все 9 ключей ×3 локали |
| Compiles without TypeScript errors | сделано |

---

## 6. `roo_code/plans/warehouse/phase4-subtask3-CreateOffcutModal.md` — частично

Незакрытых чекбоксов: 10.

Доказательство:
```
$ find frontend_vue/src -name "CreateOffcutModal*"
(пусто)
$ wc -l src/views/admin/warehouse/WarehouseCuttingPage.vue src/composables/useWarehouseCutting.ts
  528 src/views/admin/warehouse/WarehouseCuttingPage.vue
  267 src/composables/useWarehouseCutting.ts
$ grep -n "executeCutting\|quantityRemaining\|toast_cutting_executed" src/composables/useWarehouseCutting.ts
3: import { getBatch, getBatches, executeCutting } ...
168:  return roundQuantity(batch.value.quantityRemaining - consumption.value.consumed)
181:  if (result.consumed > batch.value.quantityRemaining) {
223:  await executeCutting({ ... sourceQuantity: total.consumed, kerfMm: ..., wasteQuantity: ... })
231:  toast.success(t('warehouse.toast_cutting_executed'))
$ data-test страницы: warehouse-cutting-* (38 имён), ни одного `cutting-*`/`create-offcut-modal` из плана
```
Ширина обрезка вводится всегда — условной видимости по типу нет:
`WarehouseCuttingPage.vue:294-310` — `<td><input v-model.number="row.widthMm" ... data-test="warehouse-cutting-row-width"></td>`
без `v-if`, рядом с селектом типа (289-292).

Что осталось: модалки как таковой нет и, судя по маршруту `warehouse/cutting` и странице, не
планируется; из содержательного не хватает только условных полей по типу обрезка.

| Пункт | Вердикт |
|---|---|
| Modal created at CreateOffcutModal.vue | не начато — файла нет, резка реализована страницей `WarehouseCuttingPage.vue` |
| Source batch selector with remaining quantity | сделано (`warehouse-cutting-batch-search`/`-batches-table`/`-remaining`, `getBatches`) |
| Dynamic offcut list with add/remove | сделано (`warehouse-cutting-add-row`, `-row-remove`, `rows`) |
| Conditional fields based on offcut type | не начато — ширина показана всегда (стр. 302-310) |
| Quantity validation against batch remaining | сделано (`useWarehouseCutting.ts:181-186`) |
| On success: toast, emit `created`, close modal | частично — тост есть (231), вместо emit/close навигация со страницы |
| On error: toast error, keep modal open | частично — тост есть, модалки нет |
| Form resets when modal opens | непонятно — у страницы нет пропа `show` |
| All data-test attributes added | частично — имена другие (`warehouse-cutting-*`) |
| Compiles without TypeScript errors | сделано |
