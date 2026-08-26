# Инвентаризация планов — часть 021

Каталог: `roo_code/plans/orders`

## roo_code/plans/orders/order-pricing-frontend-plan.md

**Вердикт: сделано**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`). Пункты по чекбоксам не расписываются — их нет; проверка шла по этапам 0–9 и по разделу «Готово, когда» каждого этапа.

### Что план утверждает

План сам объявляет «Сделаны все этапы, 0–9» и описывает состояние на момент записи: 316 юнит-тестов, e2e по заказам 99/99, полный набор 852/852. Такому утверждению по условию задачи не верится — проверялось в коде поэтапно.

### Доказательство

Файлы, названные планом как результат, существуют:

```
$ ls src/domain/ src/services/orderLine*.ts src/services/mocks/reservations.ts src/composables/useOrderCard.ts src/views/admin/orders/
src/composables/useOrderCard.ts
src/services/mocks/reservations.ts
src/services/orderLineEdits.spec.ts
src/services/orderLineEdits.ts
src/services/orderLines.spec.ts
src/services/orderLines.ts

src/domain/:
cutting.spec.ts
cutting.ts
offcutWeight.spec.ts
orderPricing.spec.ts
orderPricing.ts
orderStatus.ts
quantity.ts
servicePricing.spec.ts
servicePricing.ts
weightPerUnitCrossCheck.spec.ts

src/views/admin/orders/:
AddLineModeChooser.vue
AddOrderItemsModal.vue
AddOrderServicesModal.vue
OrderCardPage.vue
OrderCreatePage.vue
OrdersListPage.vue
```

Этап 0 — флаги: `orderPricingV2` удалён (в `src/` и `tests/` ни одного использования, кроме комментария `tests/e2e/admin/orders/orders.spec.ts:1090` о том, что поля когда-то были под ним), `orderShipments: true` и `orderInvoicesPayments: true` в `src/config/featureFlags.ts:65-66` — ровно то, что описывает этап 9.

Этап 1 — ядро. `grep -n "^export function " src/domain/orderPricing.ts` даёт весь список из плана и добавленные по ходу: `calcLine`, `applyPriceEdit`, `applyCostChange`, `allocateTotal`, `allocateGrossTotal`, `rollupOrder`, `splitLine`, `paidPercent`, `allocateFifo`, `allocationCost`, `applyDiscountEdit`, `applyMarginEdit`, `applyQuantityEdit`, `resetLinePrice`, `applyCorrection`, `applyCostCorrection`, `refreshCosts`, `syncLineState`, `validateLine`, `achievableGross`, `addLineModes`, `applyOrderTerms`, `canEditPrice`, `canEditQuantity`, `isAllocatable`, `isCostFrozen`, `computeAvailable`, `outstandingAmount`, `formatCents`, `round2`, `round4`, `roundStored`, `grossToNet`, `netToGross`, `paymentState`, `paymentSummary`. Единственные расхождения с текстом плана — `effectiveDiscount` называется `effectiveDiscountPercent`, а `convertCost` отсутствует; последнее прямо отменено шапкой плана («автоматической конвертации нет ни на каком уровне»), поэтому это не пробел, а исполненная отмена.

Этап 2 — типы. `src/types/order.ts`: `OrderLineAllocation` (65), `Shipment` (273), `Invoice` (357), `Payment` (405), у строки `costSource` (94), `manualCostReason` (97), `allocations` (99), `shippedQuantity` (118), `documentIssued` (127), `weightPerUnitKg` (130); у услуги `marginAmount` (188) — переименование выполнено; у заказа `defaultMarginPercent` / `defaultDiscountPercent` / `vatMode` (439-441). `StockReservation` — `src/types/warehouse.ts:570`.

Этап 3 — панель и белый список. `src/composables/useOrderCard.ts:117-128`:

```
/** Fields the admin owns. Everything else about an order is derived. */
const SAVABLE_FIELDS = [
  'notes', 'documentType', 'currency', 'vatMode', 'vatPercent',
  'defaultMarginPercent', 'defaultDiscountPercent', 'totalWeight',
] as const satisfies ReadonlyArray<keyof OrderFormFields>
```

`costPrice` в форме отсутствует, итоги считаются `rollupOrder` (357, 362). Красный тест переписан: `tests/e2e/admin/orders/orders.spec.ts:459` `center column financial fields render` проверяет 11 существующих полей, а рядом (473) тест «the panel shows the money the order actually comes to» проверяет НДС от суммы без НДС и маржу как остаток после себестоимости — соотношениями, а не тремя фиксированными числами. `useOrderCreate.ts` больше не содержит ни `0.7`, ни `0.21` (grep пуст) и импортирует `rollupOrder` из `@/domain/orderPricing` (26).

Этап 4/5 — таблица и режимы. `data-test="line-reset-price"` (OrderCardPage.vue:1560, 1711), `line-split-btn` (1611), `splitItemLine` в композабле (140), `AddLineModeChooser.vue` на месте, `pendingLineEdits` — список операций в порядке правок (useOrderCard.ts:197, 1530), уходит по одной (471-485).

Этап 6 — резервы и отгрузки. Стор резервов вынесен: `src/services/mocks/reservations.ts` экспортирует `holdOnBatch`, `releaseFromLine`, `releaseFromLineOnBatches`, `releaseLine`, `releaseOrder`, `reservedOn`, `reservedForLine`, `reservedForLineOnBatch`. `mockFifoAllocation` вызывается генератором и при добавлении строки (orders.ts:424, 851), `mockCreateShipment` / `mockCancelShipment` разведены через роутер (mocks/index.ts:993-1015). Панель отгрузок — `data-test="order-shipments"` (OrderCardPage.vue:1754) под `isShipmentsOn`.

Этап 7 — деньги. `data-test="order-payments"` (1896) и `order-invoices"` (1962) под `isMoneyOn`; модалки `payment-modal`, `advance-invoice-modal`, `cancel-shipment-modal`, `correction-modal` на месте. Осознанное ограничение этапа 7 («заказ с выставленным счётом всё ещё удаляется») **закрыто позже**: `src/services/mocks/orders.ts:1945` — `throw new Error('ORDER_HAS_INVOICE')` в `mockDeleteOrder`.

Этап 8 — права. `src/composables/useOrderPermissions.ts` существует, `AppSettings.orderPermissions` (`src/types/settings.ts:152`), сеяные значения и эндпоинт в `src/services/mocks/settings.ts:37, 399`, отказы сервера кодами `FORBIDDEN_MANUALCOST` / `FORBIDDEN_CORRECTION` (`src/services/orderLineEdits.ts:322-323`, `mocks/orders.spec.ts:2347, 2422`).

Этап 9 — уборка. Колонки списка заказов есть: `OrdersListPage.vue:406` `{{ money(item.paidPercent) }}%` и `:408` `data-test="orders-row-shipped"`, ключи `orders.col_paid_percent` / `col_shipped_percent` на всех трёх языках (`src/i18n/admin/orders.ts:13-14, 493-494, 972-973`). Раздел 2 в `pricing-section-rework-plan.md` помечен устаревшим (строки 4 и 177: «**устарели** и заменены переработкой ценообразования заказа»).

Прогоны:

```
$ npm run test:unit
 Test Files  20 passed (20)
      Tests  543 passed (543)

$ npx playwright test tests/e2e/admin/orders/orders.spec.ts --reporter=line
  115 passed (2.4m)

$ npm run typecheck
> vue-tsc --noEmit          (без вывода — чисто)
```

Цифры выше тех, что план записал (316 юнит, 99 e2e) — набор с тех пор рос; ни одного падения.

### Что осталось

Ничего из плана. Явно вынесенное **за** его границы и потому не в счёт: вес единицы товара как поле каталога (план сам пишет «отдельная задача вне этого плана»; `weightPerUnitKg` заложен и заполняется отдельным механизмом — в `src/domain/` появились `offcutWeight.ts` и `weightPerUnitCrossCheck.ts`), настоящая серверная фильтрация полей под `seeCost` (описана как отдельная работа в `orders-backend-contract.md`, раздел 5), канбан и подтверждение для статусов, не двигающих склад, бэкенд заказов, PDF, бухгалтерия.

### Пункты

Чекбоксов в плане нет. По этапам: 0 ✅, 1 ✅, 2 ✅, 3 ✅, 4 ✅, 5 ✅, 6 ✅, 7 ✅, 8 ✅, 9 ✅ — каждый проверен в коде, ссылки выше.
