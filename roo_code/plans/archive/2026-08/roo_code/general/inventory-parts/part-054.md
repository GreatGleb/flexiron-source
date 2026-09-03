# Инвентаризация планов — часть 054: roo_code/plans/warehouse (5 планов)

Код НЕ менялся. Проверка — grep/чтение по frontend_vue/src.

---

## 1. roo_code/plans/warehouse/remove-stock-deletion.md — **сделано**

Чекбоксов: 0.

План требует убрать удаление остатка (кнопка, `confirmDeleteStock`, ветка `'stock'` в
`handleDelete`, `deleteStock` в composable, `deleteStockItem` в сервисе, `mockDeleteStockItem`,
роут мока, ключ `toast_stock_deleted`), не трогая удаление партий/обрезков/движений/дефицита.

Доказательство:

```
$ grep -rn "deleteStock\|stock-delete-btn\|confirmDeleteStock\|mockDeleteStockItem\|deleteStockItem\|toast_stock_deleted" src/ tests/
src/services/auditFeedService.ts:7:  deleteStockAuditEntry,
src/services/auditFeedService.ts:68:      return deleteStockAuditEntry(row.entityId, row.entryId)
src/services/warehouseService.ts:320:export async function deleteStockAuditEntry(productId: string, entryId: string): Promise<void> {
src/composables/useWarehouseStockCard.ts:8:  deleteStockAuditEntry,
src/composables/useWarehouseStockCard.ts:182:      await deleteStockAuditEntry(productId, entryId)
```

Совпадения — только `deleteStockAuditEntry` (удаление записи аудита), которое план прямо
относит к «не трогать». Ни `deleteStock`, ни `stock-delete-btn`, ни `mockDeleteStockItem`,
ни `toast_stock_deleted` в проекте нет.

Удаление прочих сущностей на месте:

```
$ grep -n "handleDelete" -A 8 src/views/admin/warehouse/WarehousePage.vue
614:async function handleDelete() {
615-  if (!deletingItem.value) return
616-  const { id, type } = deletingItem.value
617-  if (type === 'batch') await deleteBatch(id)
618-  else if (type === 'offcut') await deleteOffcut(id)
619-  else if (type === 'deficit') await deleteDeficit(id)
```

Осталось: ничего.

---

## 2. roo_code/plans/warehouse/safe-cascade-deletion.md — **частично**

Чекбоксов: 0. Шагов 11.

### Что есть

Шаг 1 — `orderId` в четырёх интерфейсах:

```
$ grep -n "orderId" src/types/warehouse.ts
115:  orderId: string | null      (WarehouseBatch, интерфейс со строки 66)
154:  orderId: string | null      (BatchListItem, строка 139)
237:  orderId: string | null      (WarehouseOffcut, строка 206)
260:  orderId: string | null      (OffcutListItem, строка 244)
```

Шаг 2 — привязки в мок-данных:

```
$ grep -n "orderId: '" src/mocks/warehouse-batches.ts src/mocks/warehouse-offcuts.ts
src/mocks/warehouse-offcuts.ts:28:    orderId: 'ord-001',
src/mocks/warehouse-offcuts.ts:90:    orderId: 'ord-010',
src/mocks/warehouse-offcuts.ts:231:    orderId: 'ord-015',
src/mocks/warehouse-batches.ts:40:    orderId: 'ord-001',
src/mocks/warehouse-batches.ts:257:    orderId: 'ord-001',
```

Шаги 4/5 в части проверки заказа — есть:

```
$ sed -n '750,755p;891,896p' src/services/mocks/warehouse.ts
export async function mockDeleteBatch(id: string): Promise<void> {
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  if (batch.orderId) throw new Error('BATCH_LINKED_TO_ORDER')
  batchStore.splice(batchStore.indexOf(batch), 1)
}
export async function mockDeleteOffcut(id: string): Promise<void> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  if (offcut.orderId) throw new Error('OFFCUT_LINKED_TO_ORDER')
  offcutStore.splice(offcutStore.indexOf(offcut), 1)
}
```

Шаг 8 — флаги в composables:

```
$ grep -rn "deleteBlockedByOrder\|LINKED_TO_ORDER" src/composables/
useWarehouseBatch.ts:90:  const deleteBlockedByOrder = ref(false)
useWarehouseBatch.ts:341:      if (err?.code === 'BATCH_LINKED_TO_ORDER' || err?.message === 'BATCH_LINKED_TO_ORDER') {
useWarehouseBatch.ts:342:        deleteBlockedByOrder.value = true
useWarehouseBatch.ts:471:    deleteBlockedByOrder,
useWarehouseOffcutCard.ts:96:  const deleteBlockedByOrder = ref(false)
useWarehouseOffcutCard.ts:384:      if (e instanceof Error && e.message === 'OFFCUT_LINKED_TO_ORDER') {
useWarehouseOffcutCard.ts:385:        deleteBlockedByOrder.value = true
useWarehouseOffcutCard.ts:409:    deleteBlockedByOrder,
```

Шаг 9 — модалки: у обеих карточек и «заблокировано заказом», и каскадные предупреждения
(`WarehouseBatchCard.vue:1543-1597` — `cascade-warnings` с `delete_batch_cascade_offcuts` /
`delete_batch_cascade_movements` и отдельная модалка `batch-card-delete-blocked-modal`;
`WarehouseOffcutCard.vue:1011-1060` — то же с `delete_offcut_cascade_warning`).

Шаг 10 — ключи есть, но под другими именами (18 совпадений на 6 ключей × 3 локали):
`delete_batch_cascade_offcuts`, `delete_batch_cascade_movements`,
`delete_offcut_cascade_warning`, `delete_blocked_by_order_title`,
`delete_blocked_by_order_message`, `delete_blocked_ok` (i18n/admin/warehouse.ts:432, 1110, 1788).
Имён из плана (`delete_blocked_by_order_batch`, `delete_cascade_offcuts`, `btn_ok`, …) нет:
`grep` по ним даёт 0.

Шаг 11 — CSS есть: `src/styles/admin/warehouse_list.css:1095 .cascade-warnings`,
`:1106 .cascade-warning`, `:1112 .cascade-warning::before`.

### Чего нет

- **Шаг 4, каскад**: `mockDeleteBatch` удаляет только саму партию. Ни фильтрации
  `offcutStore` по `batchId`, ни фильтрации `movementStore`, ни проверки
  `OFFCUT_LINKED_TO_ORDER` у связанных обрезков перед удалением партии. Обрезки и
  движения остаются сиротами — а модалка при этом обещает «будет удалено N обрезков».
- **Шаг 5, восстановление партии**: `mockDeleteOffcut` не возвращает материал партии и не
  удаляет движение типа `offcut`, которым создание обрезка списало количество
  (`mockCreateOffcut` пишет движение, `syncBatchQuantities` считает остаток по журналу —
  `src/services/mocks/warehouse.ts:305-338, 868+`). Способ из плана (`quantityRemaining +=`)
  устарел, но сама операция не выполнена ни в каком виде.
- **Шаг 6, `recalculateStockForProduct`**: `grep -rn "recalculateStockForProduct" src/` — 0
  совпадений. Здесь цель достигнута другим путём: остаток выводится при чтении
  (`projectStockRow`, `src/services/mocks/warehouse.ts:372-402`), поэтому отдельный
  пересчёт не нужен — этот шаг снят самой архитектурой, а не забыт.

---

## 3. roo_code/plans/warehouse/stock-card-restructure-plan.md — **сделано**

Чекбоксов: 0.

План требует: убрать одиночный `GlassPanel` вокруг всей сетки, убрать
`.stock-card-content`, добавить `.main-card-content`, положить `GlassPanel` внутрь каждой
из трёх колонок с `:loading` + `:skeleton-rows`, вынести error/not-found до сетки, снести
scoped-переопределения (`pos-static !important`, `.glass-panel { position: static }`,
`overflow: visible`, `.info-hint { z-index: 1002/1003 }`, медиа-запрос 400px), оставить три
структурных правила.

Доказательство:

```
$ grep -n "GlassPanel\|main-card-content\|stock-card-content\|entity-col-" src/views/admin/warehouse/WarehouseStockCard.vue
341:      <div v-if="item || loading" class="main-card-content">
342:        <div class="entity-card-grid">
343:          <div class="entity-col-left">
344:            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-left-panel">
431:          <div class="entity-col-center">
432:            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-center-panel">
554:          <div class="entity-col-right">
555:            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-right-panel">
634:          <GlassPanel :title="t('warehouse.section_stock_audit')">
```

`.stock-card-content` в файле нет. Scoped-блок (строки 724-763) содержит ровно
`.page-stock-card`, `.stock-card-header`, `.stock-card-header-row`, `.page-title` и два
медиа-запроса по ширине шапки — ни одного из перечисленных к сносу переопределений
(`grep -n "info-hint\|pos-static\|glass-panel" ` внутри `<style>` — пусто; `info-hint`
встречается только в шаблоне как `v-tooltip ... class="info-hint"`).

Error/not-found вынесен до `.main-card-content` (строки 206-227, `template v-if="error"` с
`.entity-not-found`). Отклонение от буквы плана: он не обёрнут в `GlassPanel` — ровно как в
эталоне `ProductCardPage.vue:256-266`, на который план и велит равняться. Считаю
соответствием.

Осталось: ничего.

---

## 4. roo_code/plans/warehouse/stock-remainder-card-fix-plan.md — **частично**

Чекбоксов: 0.

Что есть:
- `useHead` — импорт `src/views/admin/warehouse/WarehouseStockCard.vue:5`, вызов на строках
  110-113 с форматом `Flexiron — ${pageTitle}`.
- `entity-not-found` вместо кастомного `.empty-state` — строка 217, с `h2` + `p`
  (`grep -n "empty-state" ` — 0).
- CSS-переменные: `grep -n "bg-secondary\|text-muted\|text-dim\|color-surface"` по файлу даёт
  одну строку 335 — это класс `text-muted` в шаблоне, не переменная. Несуществующих
  `--bg-secondary` / `--text-muted` в стилях нет.
- `goBack` в composable: `grep -n "goBack\|router" src/composables/useWarehouseStockCard.ts`
  — 0 совпадений, функция отсутствует.
- `btn btn-ghost` в карточке отсутствует: `grep -n "btn-ghost" ` — 0.

Чего нет (и почему вердикт не «сделано»):
- Кнопки «Назад» в карточке нет вообще. Пункты плана «class → `btn btn-secondary`» и
  «action → `$router.back()`» не выполнены и выполнить их некуда: возврат на вкладку
  остатков идёт через Breadcrumb (строки 233-248) и через `btn btn-primary`
  «back_to_list» в состоянии not-found (строка 222). Единственные `btn btn-secondary` в
  файле — «Отменить изменения» (271) и отмена в модалке (705).

То есть требование «как в эталонной карточке» закрыто иначе, чем предписано; решение это
осознанное или потерянное — по коду не отличить, поэтому «частично».

---

## 5. roo_code/plans/warehouse/stock-remainder-card-plan.md — **частично**

Чекбоксов: 9 (`grep -c "^[[:space:]]*- \[ \]"` → 9). Основа сделана: страница, роут,
composable, сервис и мок существуют и связаны.

Общие доказательства:

```
$ grep -n "admin-warehouse-stock-card" -B 2 -A 3 src/router/index.ts
255:        path: 'warehouse/stock/:id',
256:        name: 'admin-warehouse-stock-card',
257:        component: () => import('@/views/admin/warehouse/WarehouseStockCard.vue'),
258:        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },

$ grep -n "admin-warehouse-stock-card" src/views/admin/warehouse/WarehousePage.vue
1381:  :to="{ name: 'admin-warehouse-stock-card', params: { id: item.productId } }"
1760:  name: 'admin-warehouse-stock-card',

$ grep -n "getStockItem" src/services/warehouseService.ts src/composables/useWarehouseStockCard.ts
warehouseService.ts:52:export async function getStockItem(productId: string): Promise<StockOverviewItem>
useWarehouseStockCard.ts:124:      const data = await getStockItem(productId)

$ sed -n '638,644p' src/services/mocks/index.ts
  const stockCardMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)$/)
  if (stockCardMatch) { ... return delay(mockGetStockItem(stockCardMatch[1] as string) as T) }

$ ls -la src/composables/useWarehouseStockCard.ts src/views/admin/warehouse/WarehouseStockCard.vue
6165  src/composables/useWarehouseStockCard.ts
27670 src/views/admin/warehouse/WarehouseStockCard.vue
```

Пункты приёмки:

1. `- [ ] Клик «Open Card» ведёт на /admin/warehouse/stock/:productId` — **сделано**.
   `WarehousePage.vue:1381` + роут `warehouse/stock/:id` (параметр назван `id`, а не
   `productId`; URL тот же).
2. `- [ ] Карточка показывает имя, количества, единицу, цену, стоимость, min stock, дефицит`
   — **сделано**. В карточке `col_product`, `col_category`, `col_unit`, `col_avg_price`,
   `col_min_stock`, `col_total_qty`, `col_reserved`, `col_available`, `col_batches`,
   `col_total_value` (строки 344-628) и `stock-card-deficit-badge` (строка 264).
3. `- [ ] Breadcrumb: Warehouse → Product Name` — **сделано**. Строки 233-248:
   header_title → tab_stock → `stock_card_title` с именем товара.
4. `- [ ] Error state с кнопкой retry` — **частично**. Состояние ошибки есть
   (`data-test="stock-card-error"`, строка 217), но кнопка в нём — возврат к списку
   (`common.back_to_list`), повторной загрузки (`retry`/`load`) в шаблоне нет:
   `grep -n "retry" ` по файлу — 0.
5. `- [ ] Loading skeleton` — **сделано**. Три `GlassPanel :loading="loading"
   :skeleton-rows="4"` (344, 432, 555).
6. `- [ ] Кнопка «Назад» возвращает на вкладку остатков` — **частично**. Отдельной кнопки
   нет (см. план 4); возврат — через Breadcrumb и через `back_to_list` в not-found.
7. `- [ ] Роут защищён фичефлагом adminWarehouse` — **сделано**. `router/index.ts:258`.
8. `- [ ] Все ключи i18n для ru/en/lt` — **частично**. Из шести ключей плана есть только
   `stock_card_title` (строки 587 / 1267 / 1944 — три локали). `stock_card_section_details`,
   `_batches`, `_movements`, `_offcuts`, `stock_card_btn_back` — 0 совпадений: этих секций
   на странице нет, вместо них `section_stock_audit` (тоже 3 локали).
9. `- [ ] Мок работает для разработки` — **сделано**. `mocks/index.ts:638-644` →
   `mockGetStockItem` (`mocks/warehouse.ts:471`); плюс отдельные роуты
   `.../stock/:id/cost` и `.../stock/:id/audit`.

Шаг 7 плана (CSS в `warehouse_list.css`) выполнен частично по-другому: в
`src/styles/admin/warehouse_list.css` есть только `.page-stock-card .pill*`
(строки 598-697), остальная вёрстка карточки — scoped-стили и
`_entity-card-layout.css` / `_audit-log.css`.
