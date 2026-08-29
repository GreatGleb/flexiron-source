# Инвентаризация: roo_code/plans/orders/order-pricing-model.md

**Вердикт: частично**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`; закрытых `- [x]` тоже 0 — план описательный, без списка задач).

## Что это за план

Не список задач, а спецификация бизнес-логики ценообразования заказа: 15 разделов
(строка как главное, три числа и правило между ними, правка итога, заморозка по
состоянию строки, склад/резервы/движения, оплаты и счета, НДС, права, интерфейс).
Раздел 15 — «что это значит для реализации»: перечислены поля строки, раскладки,
резерва, отгрузки, счёта, платежа и требование «расчёт — один модуль с тестами,
один и тот же на фронте и бэке, авторитет — сервер».

## Доказательство

```
$ ls frontend_vue/src/domain/
cutting.spec.ts  cutting.ts  offcutWeight.spec.ts  orderPricing.spec.ts
orderPricing.ts  orderStatus.ts  quantity.ts  servicePricing.spec.ts
servicePricing.ts  weightPerUnitCrossCheck.spec.ts

$ wc -l frontend_vue/src/domain/orderPricing.ts
947 frontend_vue/src/domain/orderPricing.ts

$ grep -n "^export \(function\|const\|type\|interface\)" frontend_vue/src/domain/orderPricing.ts
17: VatMode | 24: CostSource ('stock'|'manual'|'estimate') | 35: LineState ('draft'|'partially_shipped'|'shipped')
170: isPriceLocked | 179: canEditPrice | 196: canEditQuantity | 202: isAllocatable | 211: isCostFrozen
247: calcLine | 275: applyPriceEdit | 285: applyCorrection | 322: applyLineTotalEdit
331: applyDiscountEdit | 350: applyMarginEdit | 366: syncLineState | 378: applyQuantityEdit
397: applyCostChange | 432: applyCostCorrection | 454: refreshCosts | 472: resetLinePrice
487: vatRateFor | 505: rollupOrder | 548: effectiveDiscountPercent | 570: grossToNet
574: netToGross | 584: achievableGross | 614: allocateTotal | 679: allocateGrossTotal
695: AddLineMode ('order_terms'|'computed_price'|'keep_total') | 701: addLineModes
724: applyOrderTerms | 739: splitLine | 807: paidPercent | 813: outstandingAmount
829: paymentState | 849: paymentSummary | 892: computeAvailable | 905: allocateFifo | 945: allocationCost

$ sed -n 640,652p frontend_vue/src/domain/orderPricing.ts
  // Provisional per-line totals, then push the residual onto the largest line.
  ... allocated[largest] = round2(allocated[largest]! + residual)     # §5.4 копейки в крупнейшую строку

$ sed -n 1,602p frontend_vue/src/types/order.ts   (все поля §15 присутствуют)
OrderLineAllocation { batchId, offcutId, quantity, unitCost, currency, source }
OrderItem { unitCost, costSource, manualUnitCost, manualCostReason, allocations,
            marginPercent, discountPercent, manualUnitPrice, namedUnitPrice,
            state, shippedQuantity, returnedQuantity, documentIssued }
Shipment / ShipmentLine / ShipmentHold / ShippableLine / ShipmentShortage /
StatusTransitionPlan / OrderReturn / Invoice (advance|regular|correction,
withdrawsOriginal, coveredServiceIds, reason) / Payment (advance|balance|refund)
Order { defaultMarginPercent, defaultDiscountPercent, vatMode, vatPercent,
        totalCost, totalAmount, totalVat, totalWithVat, actualMarginPercent,
        effectiveDiscountPercent, paidAmount, paidPercent, outstandingAmount,
        shipments, returns, invoices, payments, costTopUp, version }
Полей «редактируемая себестоимость заказа» и «редактируемый итог» нет — как требует §11.1/§15.

$ grep -n "^export" frontend_vue/src/services/mocks/reservations.ts
allReservations, findReservations, reservedOn, reservedForLine, addReservation,
reservedForLineOnBatch, holdOnBatch, releaseFromLine, releaseFromLineOnBatches,
releaseLine, releaseOrder            # §7: резерв — отдельная запись, не поле на партии

$ grep -n "orderPermissions\|FORBIDDEN" frontend_vue/src/services/mocks/orders.ts
1300:  return settings.orderPermissions.seeCost.includes(settings.profile.role)
1740:  const allowed = mockGetSettings().orderPermissions[right]
1741:  if (!allowed.includes(user.role)) throw new Error('FORBIDDEN_' + right.toUpperCase())

$ grep -n -A4 "orderPermissions" frontend_vue/src/services/mocks/settings.ts
37:  orderPermissions: { seeCost: ['owner','admin','accounting'],
                        manualCost: ['owner','admin'], correction: ['owner','admin'] }

$ grep -n "btn_apply_to_all_lines\|field_for_new_lines\|vat_mode_keep_net" frontend_vue/src/i18n/admin/orders.ts
77:  field_for_new_lines: 'Для новых позиций — существующие не меняются'
78:  btn_apply_to_all_lines: 'Применить ко всем позициям'
109: vat_mode_keep_net / 110: vat_mode_keep_gross / 106: vat_mode_change_title

$ grep -n "statusPlan\|line-split-btn\|margin-negative" frontend_vue/src/views/admin/orders/OrderCardPage.vue
2234: :model-value="statusPlan !== null"   2242: statusPlan.shortages …  (модалка §7)
1611: data-test="line-split-btn"           (кнопка «разделить строку» §13)
1600/1722: :class="{ 'margin-negative': lineMargin(item) < 0 }"   (§13 красным)

$ ls backend/app/modules/orders
ls: cannot access 'backend/app/modules/orders': No such file or directory

$ grep -rniE "shipment|invoice|order_line|order_item|\borders\b" backend/app --include=*.py -l
backend/app/modules/finance/shared/models.py       # supplier_invoice_ref, тип документа
backend/app/modules/settings/features/crud/domain.py

$ grep -n "^class" backend/app/modules/finance/shared/models.py
11:class FinancePayment    58:class PaymentDocument    93:class DocumentArchiveItem
# платежи поставщикам, к заказам клиентов не относятся

$ grep -rn "Deficit" frontend_vue/src/services/mocks/orders.ts
263: * deficit report exists for it. …   (только комментарий)
$ grep -rn "mockCreateDeficitItem" frontend_vue/src/services/mocks/*.ts | grep -v spec
index.ts:1100 (роут), warehouse.ts:1472 (реализация)  — из заказа не вызывается
```

## Что сделано

Вся фронтовая часть модели, вместе с мок-сервером, который её же и проверяет:

- §3–§4 — правило «цена вниз → скидка, цена выше расчётной → плановая маржа»,
  🔒 через само наличие `manualUnitPrice` (отдельного флага нет, как требует §15),
  `resetLinePrice` со снятием скидки, переоценка себестоимостью только у
  незафиксированной строки (`isCostFrozen`, `applyCostChange`).
- §5 — правка итога с НДС через `allocateGrossTotal` + `grossToNet`, превью,
  копейки в крупнейшую строку, отказ ниже суммы отгруженного, `achievableGross`
  для недостижимых значений (§14).
- §6 — `LineState` draft/partially_shipped/shipped, `documentIssued`,
  `canEditQuantity`/`canEditPrice`, `applyCorrection`/`applyCostCorrection`,
  `splitLine`, кнопка «разделить строку».
- §7 — резервы отдельной сущностью (`mocks/reservations.ts`), отгрузка как объект
  с количествами и `heldReleased`, `StatusTransitionPlan` + модалка подтверждения
  со списком и с отказом при нехватке, `reserveOnTransition` в настройках статусов,
  услуги в отгрузку не попадают.
- §8 — `Invoice` (advance/regular/correction, `withdrawsOriginal`, `reason`,
  `coveredServiceIds`), `Payment` с `refund` как отрицательной суммой,
  `paidPercent`/`paymentState` считаются, не хранятся.
- §9 — `VatMode`, НДС последним шагом, диалог «сохранить цену без НДС / сохранить итог».
- §10 — `AddLineMode` (order_terms / computed_price / keep_total), `addLineModes`,
  `applyOrderTerms`, `AddLineModeChooser.vue`.
- §11 — `costSource` stock/manual/estimate, ручная себестоимость с причиной,
  строка без себестоимости не получает проценты, `effectiveDiscountPercent`
  считается без таких строк с обеих сторон дроби.
- §12 — три права в `useOrderPermissions.ts` + проверка на мок-сервере (`FORBIDDEN_*`).
- §13 — панель «Финансовый расчёт», подпись «для новых позиций», кнопка
  «применить ко всем позициям», 🔒/«≈»/состояние строки, красная отрицательная маржа.

## Что осталось

1. **Бэкенда заказов нет вообще.** Модуля `backend/app/modules/orders` не существует;
   ни заказов, ни строк, ни отгрузок, ни счетов, ни платежей заказа, ни резервов,
   ни раскладки по партиям в Python-коде нет. Требование §15 «расчёт — один модуль
   с тестами, один и тот же на фронте и бэке; авторитет — сервер» выполнено только
   наполовину: сервер здесь — мок на TypeScript. Сам план это состояние и
   предсказывает («модуля заказов на бэкенде ещё нет»), но требует его создания.
2. **Право «видеть себестоимость» — только видимая часть.** План (§12) сам пишет:
   «Пока сделана только видимая часть; форма настоящей — в контракте для бэкенда».
   Карточка по-прежнему считает цены из себестоимости локально, то есть настоящее
   право (сервер не отдаёт cost/margin и присылает готовые цены) не реализовано.
   Плюс §11.7 внутри плана противоречит §12: «показываем всем, права не подключаем»
   против трёх прав; код следует §12 (`seeCost: owner/admin/accounting`).
3. **Нехватка товара не порождает запись дефицита** (§7, §14). Оценочная
   себестоимость и отказ отгрузить больше, чем есть, — сделаны; сущность
   `WarehouseDeficit` существует, но создаётся только вручную через складской роут
   (`mockCreateDeficitItem`), из заказа не вызывается. В моке это лишь комментарий
   «goes on the buying list».

## Пункты

Чекбоксов в плане нет. Ниже — вердикты по разделам, для полноты:

| Раздел | Вердикт |
|---|---|
| 2 Главное правило — строка | сделано |
| 3 Три числа и правило между ними | сделано |
| 4 Пересчёт при правке строки, 🔒, сброс к расчётной | сделано |
| 5 Правка итога заказа с НДС, превью, копейки, границы | сделано |
| 6 Жизненный цикл, заморозка документом, корректировка, отгрузки | сделано |
| 7 Склад: резервы, движения через отгрузку, модалка статуса | частично — нет записи дефицита при нехватке |
| 8 Оплаты, счета, частичная оплата | сделано (на моке) |
| 9 НДС: режимы, порядок расчёта, вопрос при смене | сделано |
| 10 Добавление и удаление позиций, три режима | сделано |
| 11 Себестоимость — 9 правил | сделано |
| 12 Права доступа | частично — «видеть себестоимость» только в UI |
| 13 Интерфейс | сделано |
| 15 Реализация: поля сущностей | сделано на фронте |
| 15 Реализация: модуль заказов на бэкенде, авторитет — сервер | не начато |
