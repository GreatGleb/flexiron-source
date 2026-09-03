# Инвентаризация планов — часть 006

Каталог: `roo_code/plans/bugs` (пачка из одного плана).

---

## `roo_code/plans/bugs/3.1-orders-card-bugs.md`

**Вердикт: сделано**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`; закрытых `- [x]` тоже 0 —
план оформлен не чекбоксами, а 23 записями багов БАГ-01…БАГ-23, каждая помечена `✅`
в заголовке и в сводной таблице).

Проверены все 23 записи по коду. Ни одна не оказалась описанием прошлого: у каждой
находится реализованная починка, у большинства — с комментарием в коде, повторяющим
формулировку плана.

### Доказательство по каждой находке

**БАГ-01** — `:deep()` в нескоуплённом `<style>`.
```
$ grep -rn "inline-group\|inline-short" src/ | head -20
src/styles/admin/components/_forms.css:786:.inline-group {
src/styles/admin/components/_forms.css:792:.inline-short {
src/views/admin/orders/OrderCardPage.vue:3043:/* `.inline-group` / `.inline-short` used to live here behind `:deep()`. This
```
Правила перенесены в `_forms.css` без `:deep()`, ровно как предписывал Fix; на месте
старых правил в SFC остался комментарий.

**БАГ-02** — шесть необъявленных классов. Все шесть объявлены в `orders_card.css`:
```
$ for c in allocate-warning cell-static correct-line-name correct-effect correct-effect-note shipment-line; do grep -rn "^\.$c\|\.$c {" src/styles/; done
orders_card.css:310:.page-order-card .allocate-warning,
orders_card.css:311:.modal-overlay .allocate-warning {
orders_card.css:324:.cell-static {
orders_card.css:334:.shipment-line {
orders_card.css:339:.correct-line-name {
orders_card.css:345:.correct-effect {
orders_card.css:359:.correct-effect-note {
```

**БАГ-03** — 28 HTML-комментариев в `<template>`. Осталось 0:
```
$ python3 -c "…re.findall(r'<!--', template)…"
src/views/admin/orders/OrderCardPage.vue comments in template: 0
```

**БАГ-04** — нормализатор NaN. `useOrderCard.ts:283-286`:
```
283:      if (Number.isNaN(val.vatPercent)) val.vatPercent = 0
284:      if (Number.isNaN(val.defaultMarginPercent)) val.defaultMarginPercent = 0
285:      if (Number.isNaN(val.defaultDiscountPercent)) val.defaultDiscountPercent = 0
286:      if (Number.isNaN(val.totalWeight)) val.totalWeight = 0
```
Все четыре поля из плана покрыты.

**БАГ-05** — три незащищённых действия. Появился общий хелпер
`flushBeforeReload()` (`useOrderCard.ts:631-645`): `hasPendingChanges` →
`orders.error_save_lines_first` → `await saveFormFields()` → отказ при исключении.
Вызван первой строкой в `applyStatusChange` (`:648`), `cancelShipment` (`:737`),
`reserveStock` (`:882`).

**БАГ-06** — скелет на каждой перезагрузке.
```
$ grep -n "cardLoading" src/views/admin/orders/OrderCardPage.vue
198:const cardLoading = computed(() => (loading.value && !order.value) || !rightsReady.value)
```
Точно формула из Fix, с `rightsReady` вне скобок.

**БАГ-07** — отменённая раскладка. `OrderCardPage.vue:237` `function onCancelAllocation()`,
повешен и на `@update:model-value` (`:2124`), и на кнопку «Отмена» (`:2167`) — оба места
из Fix.

**БАГ-08** — себестоимость в истории без права `seeCost`. Все три слоя Fix на месте:
`types/order.ts:581` — `sensitive: 'cost' | null`; `recordInHistory` (`mocks/orders.ts:1786`)
принимает параметр с комментарием «the card hides those without `seeCost`»;
`OrderCardPage.vue:308-309` — `visibleAuditLog` фильтрует `sensitive !== 'cost'`, и таблица
истории рендерит `visibleAuditLog` (`:2065`, `:2079`), а не `auditLog`.

**БАГ-09** — `quantity: 0`. `orderPricing.ts` в `applyQuantityEdit`:
`if (quantity === 0) throw new Error('ZERO_QUANTITY')`, ровно перед проверкой
`BELOW_SHIPPED_QUANTITY`.

**БАГ-10** — себестоимость услуги в обход `manualCost`. `mocks/orders.ts:2168`:
`const actor = delta.unitCost !== undefined ? requireRight('manualCost') : null`,
и `:2179-2180` — запись в историю при изменении `unitCost`. Оба пункта Fix.

**БАГ-11** — счёт за услуги. `useOrderCard.ts:1088` `issueServicesInvoice()` с защитой
`hasPendingChanges || isDirty` и `createOrderInvoice(id, withVersion({ kind: 'regular' }))`;
кнопка `OrderCardPage.vue:1968-1973` под `v-if="unbilledServices.length > 0"`;
ключ `btn_invoice_services` в трёх языках (`i18n/admin/orders.ts:252,731,1208`).

**БАГ-12** — `:order-id` модалам. `grep -n "order-id" src/views/admin/orders/OrderCardPage.vue`
→ пусто.

**БАГ-13** — пять запросов на открытии. `loadAudit` / `auditLoading` больше нет,
вместо них `readAudit()` (`useOrderCard.ts:325`), вызванный из `load()` (`:405`);
единственный `getOrder(id)` — в `load()` (`:379`); `loadShipPlan()` вызывается из `load()`
(`:400`) и не из `loadShipments`. `onMounted` страницы (`:970-974`) зовёт `load`,
`loadCurrencies`, `loadShipments` — с комментарием «Not `loadShipPlan` as well».

**БАГ-14** — сырой `String(e)`. `useOrderCard.ts:410`:
`error.value = lineEditErrorKey(e, 'orders.toast_error_load')`.

**БАГ-15** — обвязка секции документов.
```
$ grep -rn "handleGenerateDocument\|order-doc-row\|btn_generate_cmr\|btn_generate_kpo\|toast_document_generated" src/
(пусто)
```

**БАГ-16** — список валют не закрывался. Починено сильнее, чем предписывал Fix: рукописный
`onDocClickCloseCurrency` / `currencyOpen` удалён целиком (grep по обоим — ноль), поле
использует общий `SuffixSelect` (`OrderCardPage.vue:1282`), который спрашивает про *своё*
поле: `SuffixSelect.vue:55-56` — `triggerRef.value?.closest('.input-with-suffix')` плюс
`field.contains(e.target)`. Эффект тот же, что у `closest('.custom-select-wrap')`.

**БАГ-17** — инлайновые `style`. В `<template>` их 0 (скрипт по секции template);
новые классы на месте: `orders_card.css:368 .doc-gen-actions.in-header`,
`:372 .order-file-list`, `:376 .audit-loading`, `:380 .audit-actions-col`,
`:392 .page-order-card .glass-input.value-negative`.

**БАГ-18** — `toHaveCount(0)` на модале. `tests/e2e/admin/orders/orders.spec.ts:1878`:
`await expect(page.locator('[data-test="correct-modal"]')).toBeHidden()`.
Оставшийся `toHaveCount(0)` в файле — `:264`, на `order-create-leave-modal`, это другой
модал (не `AppModal`-overlay карточки).

**БАГ-19** — overlay перехватывает клики. `_modal.css`: `pointer-events: none` на
`.modal-overlay` и `pointer-events: auto` на `.modal-overlay.active`, с комментарием,
пересказывающим находку.

**БАГ-20** — семь мёртвых ключей. Ни одного из семи в `i18n/admin/orders.ts`:
```
$ for k in col_actions back col_margin field_files delete_audit_warning toast_item_added toast_item_removed; do grep -c "^\s*$k:" src/i18n/admin/orders.ts; done
0 0 0 0 0 0 0
```

**БАГ-21** — версия на мутациях. `assertVersion(` встречается 23 раза, `bumpVersion(` — 22.
Проверены все 21 функция из таблицы плана (включая `mockDeleteOrder`) — у каждой
`assertVersion` в теле. `mockRemoveOrderFile` (`:2373-2394`): `assertVersion` сразу после
поиска заказа, `if (idx === -1) throw new Error('ORDER_FILE_NOT_FOUND')`, `bumpVersion(order)`
вынесен из ветки — побочная находка плана закрыта. Транспорт: `ordersService.ts:41-42`
хелпер `ifMatch()`, `If-Match` на восьми `DELETE`, `version` в телах POST/PATCH.

**БАГ-22** — маршрут фаззера. `order-audit-fuzz-server.spec.ts`: `stockedProducts()`
возвращает `[...ids].filter(…).sort()` с комментарием про порядок вставки `Set`;
порог `expect(ops, context).toBeGreaterThan(10000)` (`:531`) не понижен.

**БАГ-23** — витринный `ORD-100`. `mocks/orders.ts:986` `function buildShowcaseOrder()`,
вызвана на `:4131`; собирает заказ вызовами эндпоинтов (в теле — `mockAddOrderItem` ×2,
`mockUpdateOrderItem` ×3, `mockAddOrderService`, `mockPlanOrderShipment`, `mockCreateShipment`,
`mockCancelShipment`, `mockCorrectOrderLine`, `mockCreateInvoice` ×2, `mockAddOrderPayment`,
`mockReserveOrder`, `mockAddOrderFile` ×2). `SHOWCASE_ORDER_ID = 'ORD-100'` (`:1221`),
имя в списке сценариев (`:632-633`, `:4089`). Поправка про вес соблюдена: `totalWeight`
в витрине не проставляется, а `recalc` (`:198-203`) берёт вес только со строк, у которых
он есть, с комментарием «No product has a weight yet».

### Что осталось

Ничего. Все 23 находки реализованы, включая обе «поправки по ходу работы» (БАГ-04 про
severity и тест, БАГ-23 про вес) и побочную находку БАГ-21 про `bumpVersion` внутри `if`.
Единственное расхождение с буквой плана — БАГ-16: вместо `closest('.custom-select-wrap')`
рукописный виджет заменён общим `SuffixSelect`, который решает ту же задачу правильнее.

### Пункты

Чекбоксов в плане нет; вердикт по 23 записям багов — все «сделано».
