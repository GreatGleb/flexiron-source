# Инвентаризация планов — часть 046

Каталог: `roo_code/plans/warehouse` (4 плана, чекбоксов ни в одном — itemsTotal = 0)

---

## 1. roo_code/plans/warehouse/fix-batch-card-movements-table-styling.md — **сделано**

Требование: заменить `batch-card-mini-table` на `<div class="table-responsive"><table class="data-table">`
в таблицах движений и обрезков карточки партии; CSS не менять.

Доказательство:
```
$ grep -rn "batch-card-mini-table" src/ tests/
(пусто)

$ grep -n "batch-card-movements-table\|batch-card-offcuts-table\|table-responsive\|data-table" \
    src/views/admin/warehouse/WarehouseBatchCard.vue
1286:          <div v-else-if="movements.length" class="table-responsive">
1287:            <table class="data-table" data-test="batch-card-movements-table">
1366:          <div v-else-if="offcuts.length" class="table-responsive">
1367:            <table class="data-table" data-test="batch-card-offcuts-table">
1464:            <div v-else class="table-responsive">
```
Класса `batch-card-mini-table` в проекте больше нет ни в одном файле; обе таблицы обёрнуты
в `.table-responsive` и используют `.data-table`. Остатков нет.

Файлы, упомянутые в плане:
- frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
- frontend_vue/src/styles/erp-base.css
- frontend_vue/src/styles/admin/components/_tables.css

---

## 2. roo_code/plans/warehouse/fix-batch-card-notes-textarea.md — **сделано**

Требование: убрать инлайновый `style="min-height: 60px; resize: none;"` у textarea заметок,
добавить класс `batch-notes-input` и правило CSS в `warehouse_list.css`
(`resize: vertical; min-height: 80px; max-height: 300px; line-height: 1.5`).

Доказательство:
```
$ grep -n "field-notes" -B5 src/views/admin/warehouse/WarehouseBatchCard.vue
1071-                  <AutoResizeTextarea
1072-                    v-model="form.notes"
1073-                    class="glass-input batch-notes-input"
1074:                    data-test="field-notes"
1075-                  />

$ sed -n '704,710p' src/styles/admin/warehouse_list.css
/* ─── Batch card notes textarea — auto-expanding with constrained max-height ─ */
textarea.batch-notes-input {
  resize: vertical;
  min-height: 80px;
  max-height: 300px;
  line-height: 1.5;
}
```
Инлайновых стилей нет; правило CSS совпадает с планом дословно. Реализация пошла дальше плана:
вместо `<textarea>` используется общий компонент `AutoResizeTextarea` (тот же класс применён ещё
в 6 карточках склада — WarehouseOffcutCreatePage, WarehouseMovementCard, WarehouseDeficitCard,
WarehouseBatchCreatePage, CreateMovementModal, WarehouseOffcutCard). Требования плана это не
нарушает, авторасширение обеспечено компонентом.

Файлы, упомянутые в плане:
- frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
- frontend_vue/src/styles/admin/warehouse_list.css
- frontend_vue/src/components/admin/ui/EmailTemplate.vue
- frontend_vue/src/styles/admin/components/_email-template.css
- frontend_vue/src/styles/admin/components/_forms.css

---

## 3. roo_code/plans/warehouse/fix-batch-count-inconsistency.md — **сделано** (с расхождением в цифрах)

Требование: добавить две партии для `prod-003` в `warehouse-batches.ts` (ID `whb-075`, `whb-076`,
`INV-2025-012`/`INV-2025-013`, `LOT-2025-012`/`LOT-2025-013`, поставщики sup-001/sup-003,
статусы available/partial, с файлом счёта), чтобы `batchCount: 2` в stock-обзоре совпал с
реальным числом партий и таб партий не был пустым.

Доказательство:
```
$ grep -c "productId: 'prod-003'" src/mocks/warehouse-batches.ts
2

$ grep -n "whb-075\|whb-076\|INV-2025-012\|INV-2025-013" src/mocks/warehouse-batches.ts
124:    id: 'whb-075',
129:    batchNumber: 'INV-2025-012',
162:    id: 'whb-076',
167:    batchNumber: 'INV-2025-013',

$ sed -n '86,90p' src/mocks/warehouse-stock.ts
    totalQuantity: 80,
    reservedQuantity: 10,
    availableQuantity: 70,
    unit: 'pcs',
    batchCount: 2,
```
Партии `whb-075` (sup-001, status available, lotCode LOT-2025-012, файл f-inv-012) и `whb-076`
(sup-003, status partial, lotCode LOT-2025-013, файл f-inv-013) существуют — тот самый набор
идентификаторов, что предписан планом. Баг «партий не найдено» закрыт: фильтр по
`productId=prod-003` даёт 2 записи.

Расхождение с буквой плана (не пробел в работе, а следствие более позднего редизайна):
- В плане партии описаны как «Aluminum sheet 3mm», 50 pcs и 40/30 pcs, unitPrice 52/58.
  В коде это «Стальная труба 60x4» / Steel Pipe 60x4, 10 т и 8/6 т, unitPrice 1000/950 —
  партии переделаны под демо трёх единиц измерения (warehouseUoM=t, saleUoM=kg, factor 1000).
- Из-за этого остался новый рассинхрон, планом не покрытый: в `warehouse-stock.ts` prod-003
  всё ещё «Лист алюминиевый 3мм», `unit: 'pcs'`, totalQuantity 80 / availableQuantity 70,
  тогда как партии дают 16 т. Это не пункт плана — фиксирую как наблюдение.

Файлы, упомянутые в плане:
- frontend_vue/src/mocks/warehouse-stock.ts
- frontend_vue/src/mocks/warehouse-batches.ts
- frontend_vue/src/services/mocks/warehouse.ts
- frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue

---

## 4. roo_code/plans/warehouse/fix-entity-card-links-plan.md — **сделано**

Требование (6 фаз): `getMovement()` в сервисе; 3 card-композабла; 3 страницы карточек;
3 маршрута; 6 router-link в WarehousePage перевести с `admin-product-card` на свои карточки;
ключи i18n для трёх карточек в ru/en/lt.

Доказательство:
```
$ ls -la src/composables/useWarehouse{Offcut,Movement,Deficit}Card.ts
-rw-rw-r-- 3390  src/composables/useWarehouseDeficitCard.ts
-rw-rw-r-- 1480  src/composables/useWarehouseMovementCard.ts
-rw-rw-r-- 14127 src/composables/useWarehouseOffcutCard.ts

$ ls -la src/views/admin/warehouse/Warehouse{Offcut,Movement,Deficit}Card.vue
-rw-rw-r-- 29139 WarehouseDeficitCard.vue
-rw-rw-r-- 30571 WarehouseMovementCard.vue
-rw-rw-r-- 42609 WarehouseOffcutCard.vue

$ grep -n "export async function getMovement(" src/services/warehouseService.ts
186:export async function getMovement(id: string): Promise<WarehouseMovement> {

$ grep -n "admin-warehouse-offcut\|admin-warehouse-movement\|admin-warehouse-deficit" src/router/index.ts
268:        name: 'admin-warehouse-offcut-create',
274:        name: 'admin-warehouse-offcut',
286:        name: 'admin-warehouse-movement',
304:        name: 'admin-warehouse-deficit',

$ grep -n "admin-warehouse-offcut\|admin-warehouse-movement\|admin-warehouse-deficit\|admin-product-card" \
    src/views/admin/warehouse/WarehousePage.vue
859:  @click="router.push({ name: 'admin-warehouse-offcut-create' })"
2726:  :to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"
2776:  :to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"
3275:  :to="{ name: 'admin-warehouse-movement', params: { id: mov.id } }"
3308:  :to="{ name: 'admin-warehouse-movement', params: { id: mov.id } }"
3686:  :to="{ name: 'admin-warehouse-deficit', params: { id: item.id } }"
3726:  :to="{ name: 'admin-warehouse-deficit', params: { id: item.id } }"
```
Все шесть ссылок (имя товара + кнопка «открыть») в табах обрезков, движений и дефицита ведут
на собственные карточки по `id` сущности; ссылок на `admin-product-card` в WarehousePage.vue
не осталось вовсе.

i18n: ключи карточек присутствуют во всех трёх локалях — ru 464-492, en 1142-1171, lt 1820-1848
(`offcut_card_title`, `movement_card_title`, `deficit_card_title`, `field_dimensions`,
`btn_edit_offcut`, `btn_delete_offcut`, `confirm_delete_offcut`, `btn_edit_deficit`,
`btn_delete_deficit`, `confirm_delete_deficit` и т. д.). Формулировки отличаются от черновика
плана (например `offcut_card_title: 'Обрезок {id} — {productName}'` вместо `'Обрезок #{id}'`) —
это подписи, а не пробел в реализации.

Файлы, упомянутые в плане:
- frontend_vue/src/views/admin/warehouse/WarehousePage.vue
- frontend_vue/src/services/warehouseService.ts
- frontend_vue/src/composables/useWarehouseMovement.ts
- frontend_vue/src/composables/useWarehouseDeficit.ts
- frontend_vue/src/composables/useWarehouseOffcuts.ts
- frontend_vue/src/composables/useWarehouseBatch.ts
- frontend_vue/src/composables/useWarehouseOffcutCard.ts
- frontend_vue/src/composables/useWarehouseMovementCard.ts
- frontend_vue/src/composables/useWarehouseDeficitCard.ts
- frontend_vue/src/types/warehouse.ts
- frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue
- frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue
- frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue
- frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue
- frontend_vue/src/router/index.ts
- frontend_vue/src/i18n/admin/warehouse.ts

---

## Итог пачки

Все четыре плана реализованы. Остаточной работы по их тексту нет.
Единственное наблюдение вне планов: prod-003 описан по-разному в `warehouse-stock.ts`
(алюминиевый лист, pcs, 80/70) и в `warehouse-batches.ts` (стальная труба, тонны, 10+6).
