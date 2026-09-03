# Инвентаризация планов — часть 040 (roo_code/plans/warehouse, 5 планов)

Код не менялся. Незакрытых чекбоксов ни в одном плане нет (все `grep -c "^[[:space:]]*- \[ \]"` = 0).

---

## 1. roo_code/plans/warehouse/add-action-buttons-to-warehouse-tabs.md — **частично**

### Доказательство
```
$ grep -n "warehouse-toolbar\|exportCurrentTab\|btn_new_batch\|btn_new_offcut\|btn_new_movement\|btn_add_deficit\|btn_page_config\|tooltip_page_config_coming_soon\|btn_new_stock" -r src
src/i18n/admin/warehouse.ts:18:      btn_new_batch: 'Новая партия',
src/i18n/admin/warehouse.ts:19:      btn_new_offcut: 'Новый обрезок',
src/i18n/admin/warehouse.ts:20:      btn_new_movement: 'Новое движение',
src/i18n/admin/warehouse.ts:21:      btn_page_config: 'Настройки страницы',
src/i18n/admin/warehouse.ts:22:      tooltip_page_config_coming_soon: 'Настройки страницы в разработке',
src/i18n/admin/warehouse.ts:700-704  (en: btn_new_batch/offcut/movement, btn_page_config, tooltip_page_config_coming_soon)
src/i18n/admin/warehouse.ts:1381-1385 (lt: то же)
src/views/admin/warehouse/WarehousePage.vue:292:async function exportCurrentTab() {
src/views/admin/warehouse/WarehousePage.vue:809:    <div class="suppliers-header" data-test="warehouse-toolbar">
src/views/admin/warehouse/WarehousePage.vue:826:          @click="exportCurrentTab"
src/views/admin/warehouse/WarehousePage.vue:851:          <span>{{ t('warehouse.btn_new_batch') }}</span>
src/views/admin/warehouse/WarehousePage.vue:862:          <span>{{ t('warehouse.btn_new_offcut') }}</span>
src/views/admin/warehouse/WarehousePage.vue:884/890/893  (page-config stub + tooltip)
```
Тулбар стоит ровно между `.warehouse-tabs` (WarehousePage.vue:282-294) и `.filters-bar` (WarehousePage.vue:896) — sed -n '780,910p'.
Экспорт покрывает все пять вкладок (`exportCurrentTab`, switch по stock/batches/offcuts/movements/deficit, WarehousePage.vue:292-333, вызывает `exportWarehouseData`).
Кнопки в тулбаре: карта склада (флаг), Экспорт (все вкладки), Новая партия (batches → route admin-warehouse-batch-create), Новый обрезок (offcuts → admin-warehouse-offcut-create), Резка (offcuts → admin-warehouse-cutting), Настройки страницы (заглушка, tooltip + disabled по `pageConfigForActiveTab`).
Шаг 5 плана (убрать «Резку» из фильтр-бара) выполнен: `btn_cut` в WarehousePage.vue остался только в тулбаре (878) и в пустом состоянии вкладки (2317), в `.filters-bar` его нет.

### Чего нет
- Кнопки «New Stock Item» на вкладке stock — нет ни кнопки, ни ключа `btn_new_stock` (grep пуст).
- Кнопки «Add to Deficit» на вкладке deficit — нет ни кнопки, ни ключа `btn_add_deficit` (grep пуст); мок `mockCreateDeficitItem` есть (src/services/mocks/warehouse.ts:1472), UI-входа нет.
- Кнопки «New Movement» на вкладке movements — ключ `btn_new_movement` в i18n есть, но в шаблоне не используется; создание движения снято с UI осознанно: `WarehousePage.vue:30 // DEPRECATED: import CreateMovementModal ... (movement creation removed from UI)`, `:104 // DEPRECATED: showCreateMovementModal (removed from UI)`.
- Класс `.warehouse-toolbar` не создавался — переиспользован `suppliers-header` (это дух плана, но не буква шага 4).

---

## 2. roo_code/plans/warehouse/add-batch-auditlog-mock-data.md — **сделано** (с одним отклонением по типу)

### Доказательство
```
$ grep -n "auditLog" src/types/warehouse.ts
122:  auditLog?: StockAuditEntry[]      # внутри interface WarehouseBatch (66-138)
...
$ grep -c "auditLog:" src/mocks/warehouse-batches.ts
12
# партии с историей: whb-001, 076, 005, 011, 014, 019, 025, 032, 045, 058, 077, 091
$ grep -n "mockGetBatchAudit" -A8 src/services/mocks/warehouse.ts
1608:export async function mockGetBatchAudit(batchId: string): Promise<StockAuditEntry[]> {
1609-  const batch = batchStore.find((b) => b.id === batchId)
1614-  return batch?.auditLog ? structuredClone(batch.auditLog) : []
# mockCreateBatch (611-...): в объекте batch есть `auditLog: [],` (строка 715)
$ grep -n "auditLog" src/views/admin/warehouse/WarehouseBatchCard.vue
100:  auditLog,   1478: v-for="a in auditLog"   1524: пустое состояние
```
Все четыре требуемых изменения на месте, 12 партий с историей (как и просил план), карточка партии историю рендерит.

### Отклонение
Поле в типе объявлено необязательным — `auditLog?: StockAuditEntry[]` с комментарием «empty for most batches», план требовал обязательное `auditLog: StockAuditEntry[]`. Набор ID партий частично другой (whb-076/005/014/045 вместо whb-003/006/015/044) — количество и смысл совпадают.

---

## 3. roo_code/plans/warehouse/add-batch-card-currency-selector.md — **частично**

### Доказательство
```
$ grep -n "currency" src/types/warehouse.ts
101:  /** Currency of `unitPrice` — the base currency, and nothing else (§7.1). */
102:  currency: string          # WarehouseBatch
150:  currency: string          # BatchListItem
173:  currency?: string         # BatchCreatePayload
195:  currency?: string         # BatchPatchPayload
$ grep -n "currency" src/composables/useWarehouseBatch.ts
105:    currency: string        # form
120:    currency: 'EUR',
208:        currency: data.currency,     # load()
286:        currency: updated.currency,  # save()
316:      currency: batch.value.currency, # discard()
$ grep -c "currency: 'EUR'" src/mocks/warehouse-batches.ts   -> 100
$ grep -c "^    id: 'whb-" src/mocks/warehouse-batches.ts    -> 100
# карточка: WarehouseBatchCard.vue:774-790 — input-with-suffix custom-select-wrap + <SuffixSelect v-model="form.currency" :options="CURRENCY_OPTIONS">
# totalCost: :813 :value="money(batch.totalCost, resolveCurrencyLabel(form.currency))" — жёсткого «€» нет
# патч: src/services/mocks/warehouse.ts:727 mockPatchBatch, :735 if (delta.currency != null && delta.currency !== BASE_CURRENCY) -> throw
```

### Чего нет / отклонение
Список валют не многовариантный. `WarehouseBatchCard.vue:235-243`:
```
const CURRENCY_OPTIONS = computed<string[]>(() => {
  const currencies = settings.currencies ?? []
  const base = currencies.find((c) => c.isDefault)
  return [base?.code ?? settings.constants.defaultCurrency]
})
```
То есть в селекторе всегда ровно одна опция — базовая валюта; выбор USD/GBP/PLN, которого требовал план, отклонён осознанно (комментарий там же: конвертации в системе нет, §7.1, `mockPatchBatch` и `mockCreateBatch` бросают `BATCH_CURRENCY_NOT_BASE`). Всё остальное из плана — поля типов, 100/100 моков, composable, вёрстка, динамическая подпись totalCost — сделано.

---

## 4. roo_code/plans/warehouse/add-batch-card-field-hints.md — **сделано**

### Доказательство
```
$ grep -n 'data-test="field-' src/views/admin/warehouse/WarehouseBatchCard.vue   (+ grep -n readonly)
616 field-supplier      readonly:615 -> field-hint:618
720 field-remaining     readonly:718 -> field-hint:722
817 field-total-cost    readonly:816 -> field-hint:819
955 field-received-at   readonly:954 -> field-hint:957
984 field-expires-at    readonly:983 -> field-hint:986
653 field-product-name  readonly:652 -> field-hint:656 (field_product_hint — по плану у него подсказка уже была)
```
Все пять полей из плана получили `<span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>`. Больше того, подсказки стоят и у остальных readonly-полей карточки (field-quantity, field-unit, field-selling-price, field-total-selling-value, весь блок purchase audit 1215-1272) — план перевыполнен, лишнего не требуется.

---

## 5. roo_code/plans/warehouse/add-batch-card-offcut-link.md — **сделано**

### Доказательство
```
$ grep -n "create_offcut_for_batch" -r src
src/i18n/admin/warehouse.ts:627 (ru) :1307 (en) :1984 (lt)
src/views/admin/warehouse/WarehouseBatchCard.vue:1335

# WarehouseBatchCard.vue:1330-1361 — GlassPanel без :title, #header слот:
#   <span class="panel-title">{{ t('warehouse.section_batch_offcuts') }}</span>
#   <router-link data-test="batch-card-create-offcut-link" v-tooltip="create_offcut_for_batch"
#     :to="{ name: 'admin-warehouse-offcut-create', query: { batchId: batch.id, productId: batch.productId } }"
#     class="btn btn-sm btn-secondary" style="margin-left: auto">
#   (+ рядом появилась ссылка на резку, data-test="batch-card-cutting-link")

$ grep -n "route.query\|useRoute\|useRouter\|preselected" src/composables/useWarehouseOffcutCreate.ts
2: import { useRoute, useRouter } from 'vue-router'
33/34: route/router
67/68: preselectedBatchId / preselectedProductId
70-75: чтение route.query.batchId / route.query.productId
140-148: watch(products, ..., { once: true }) -> selectedProductId
151-159: watch(batches) -> selectedBatchId, сброс preselectedBatchId
162-167: watch(selectedBatchId) -> if (oldVal && newVal !== oldVal) router.replace({ query: {} })
```
Реализация совпадает с планом построчно, включая условие `oldVal && newVal !== oldVal`. Единственное расхождение — класс кнопки `btn-secondary` вместо `btn-primary`: primary отдан соседней кнопке «Резка».
