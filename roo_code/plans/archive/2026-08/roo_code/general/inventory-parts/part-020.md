# Инвентаризация: roo_code/plans/orders/currency-fix-and-fifo-plan.md

**Вердикт: частично**

Незакрытых чекбоксов в плане: 5 (все — Phase C, бэкенд).

## Что план утверждает и требует

Три фазы. Phase A — справочные поля средней себестоимости/цены на карточке товара
и FIFO-себестоимость строк заказа. Phase B — вычистить захардкоженные `'EUR'`,
снимок валюты у связанного поставщика, предзаполнение валюты партии, валюта на
складском движении, `receivedCurrency` + `exchangeRate` на строке заказа.
Phase C — пять пунктов бэкенда (чекбоксы).

Шапка плана сама помечена устаревшей в части курса (2026-08-09): конвертации нет,
курса нет ни на заказе, ни на строке, ни на партии. То есть часть Phase B (`exchangeRate`,
смена валюты движения «для конвертации») отменена владельцем, а не забыта.

## Доказательства

### Phase A — сделано

```
$ grep -n "avgCostPrice|avgSalePrice" src/types/product.ts
35:  avgCostPrice: number | null
37:  avgSalePrice?: number | null
60:  avgCostPrice: number | null
61:  avgSalePrice: number | null

$ grep -n "avgCostPrice" src/services/mocks/products.ts | tail
13987:export function avgCostPriceFor(productId: string): number | null {
14004:export function avgSalePriceFor(productId: string): number | null {
14019:  Object.defineProperty(product, 'avgCostPrice', {
14020:    get: () => avgCostPriceFor(product.id),
14025:  Object.defineProperty(product, 'avgSalePrice', {
14026:    get: () => avgSalePriceFor(product.id),

$ grep -n "field_avg" src/views/admin/products/ProductCardPage.vue
397:              <InputGroup :label="t('products.field_avg_cost_price')">
411:              <InputGroup :label="t('products.field_avg_sale_price')">

$ grep -rn "field_avg_cost_price" src/i18n/
src/i18n/admin/products.ts:35:      field_avg_cost_price: 'Средняя себестоимость',
src/i18n/admin/products.ts:302:      field_avg_cost_price: 'Avg cost price',
src/i18n/admin/products.ts:570:      field_avg_cost_price: 'Vidutinė savikaina',

$ grep -n "mockCalculateFifoCost" src/services/mocks/warehouse.ts
1571:export function mockCalculateFifoCost(

$ grep -rn "getBatchCostBreakdown" src/ | head
src/services/warehouseService.ts:70:export async function getBatchCostBreakdown(
src/views/admin/orders/AddOrderItemsModal.vue:396:    const cost = await getBatchCostBreakdown(productId, quantity)
src/composables/useOrderCard.ts:1161:        getBatchCostBreakdown(item.productId, item.quantity ?? 1)

$ grep -n "recalcFifoCost" src/views/admin/orders/AddOrderItemsModal.vue
230:    await recalcFifoCost(id, saleQty)
394:async function recalcFifoCost(productId: string, quantity: number) {
419:        recalcFifoCost(id, qty)

$ grep -n "stockCostFor" src/composables/useOrderCreate.ts
220:      const { unitCost, costSource } = stockCostFor(item.unitCost ?? null, item.hasShortage)
```

Отличие от буквы плана: A2 требовал «populate avgCostPrice from mock batches» —
в моке поля в сидах `null`, а значения выводятся геттерами `avgCostPriceFor`/
`avgSalePriceFor` (комментарий в файле объясняет: числа в сидах всё равно
перезаписывались на загрузке). Требование выполнено лучше, чем записано.
A6 требовал «pass cost as unitPrice» — сейчас себестоимость сознательно не
становится ценой (комментарий на строке 398), это позднейшее решение по
`order-pricing-model.md`, а не пробел.

### Phase B — сделано, кроме UI движения

```
$ grep -rn "'EUR'" src/composables/useOrderCard.ts src/composables/useWarehouseBatchCreate.ts \
    src/composables/useSupplierCreate.ts src/views/admin/orders/AddOrderItemsModal.vue
(пусто)

$ grep -n "vatRate" src/composables/useOrderCard.ts
147:    vatPercent: settings.constants.vatRate,

$ grep -n "LinkedSupplier" -A 7 src/types/product.ts
23:  currency: string | null // snapshot of supplier's currency at time of linking

$ grep -n "currency" src/views/admin/products/ProductCardPage.vue
215:    currency: s.currency ?? null,
645:                      <th>{{ t('products.field_currency') }}</th>
657:                      <td>{{ s.price != null ? `${s.price} ${s.currency ?? ''}` : '—' }}</td>

$ grep -n "receivedCurrencyId" src/composables/useWarehouseBatchCreate.ts
209:  /** Pre-fill receivedCurrencyId from linked supplier's currency when supplier changes */
214:      ... form.receivedCurrencyId = null / cur.id  (резолв кода в UUID из settings.currencies)

$ grep -n "currency" src/types/warehouse.ts   (WarehouseMovement / MovementListItem)
334:  /** Currency copied from batch.currency at creation */
335:  currency: string
353:  currency: string

$ grep -n "currency" src/services/mocks/warehouse.ts
916:    currency: m.currency,
1035:    currency: batch.currency,

$ grep -n "currency" src/views/admin/warehouse/CreateMovementModal.vue
(пусто)
$ grep -n "currency" src/views/admin/warehouse/WarehouseMovementCard.vue
(пусто)
```

B5 наполовину: тип и мок валюту носят и копируют её из партии, а ни список
движений, ни карточка движения, ни модалка создания её не показывают. Третий
подпункт B5 («для продажи разрешить менять валюту — для конвертации») отменён
шапкой плана.

B6–B7: полей `receivedCurrency`/`exchangeRate` на `OrderItem` нет.

```
$ grep -n "interface OrderItem" -A 45 src/types/order.ts | grep -c "receivedCurrency|exchangeRate"
0
$ grep -n "interface OrderLineAllocation" -A 8 src/types/order.ts
71:  /** Batch currency the cost came from — a label on the number, not a factor. */
72:  currency: string
$ grep -n "receivedCurrency" src/services/orderLines.ts
247:  receivedCurrency: string
302:    receivedCurrency: seed.receivedCurrency,
```

Валюта источника живёт на аллокации и в сиде строки, а не полем на `OrderItem`;
`exchangeRate` отменён решением владельца. Считаю решённым иначе, а не пропущенным.

### Phase C — не начато (все 5 чекбоксов)

```
$ ls backend/app/modules/
auth  bcc  billing  finance  notifications  products  services  settings  suppliers  warehouse
   → модуля orders нет вовсе, значит ни Order.currency_id, ни OrderItem.currency_id/exchange_rate

$ grep -n "class WarehouseMovement" -A 40 backend/app/modules/warehouse/shared/models.py | grep currency
(пусто)

$ sed -n '204,235p' backend/app/modules/suppliers/shared/models.py   (SupplierPriceEntry)
    price / unit / entry_date / notes — колонки currency нет
(у самого Supplier currency есть: suppliers/shared/models.py:50 — но это не связь товар-поставщик)

$ grep -rn "calculate-cost|calculate_cost" backend/ frontend_vue/src/
(пусто)
$ find backend/app/modules/warehouse -type d
backend/app/modules/warehouse{,/shared,/internal_api,/features}   → features пуст
```

## Что осталось

1. Все пять пунктов Phase C — бэкенда заказов не существует, колонки валюты у
   складского движения и у связи товар-поставщик нет, эндпоинта FIFO-расчёта нет.
2. Хвост B5: показать валюту движения в списке движений и в карточке движения
   (в типе и моке она уже есть). Подпункт про смену валюты у продажи — отменён.

## Пункты (чекбоксы плана)

| Пункт | Вердикт |
|---|---|
| Backend Order model — add `currency_id` | не начато — модуля `orders` в backend/app/modules нет |
| Backend OrderItem — add `currency_id`, `exchange_rate` | не начато — там же; `exchange_rate` вообще отменён шапкой плана |
| Backend WarehouseMovement — add `currency` column | не начато — в модели колонки нет |
| Backend LinkedSupplier — add `currency` column (или через PriceEntry) | не начато — у `SupplierPriceEntry` колонки currency нет |
| API endpoint `POST /api/warehouse/stock/{productId}/calculate-cost` | не начато — grep по backend/ и frontend пуст, warehouse/features пуст |
