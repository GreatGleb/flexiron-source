# Инвентаризация: часть 019

## roo_code/plans/orders/3.3-order-returns-plan.md

**Вердикт: частично** (ядро плана реализовано целиком; не хватает нескольких хвостовых требований Prompt 7/9/15)

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`), пункты плана — промпты Prompt 0–15, проверялись по содержанию.

### Что есть (доказательства)

Единый источник статусов — `src/domain/orderStatus.ts` существует, 15 значений в `ORDER_STATUSES` в порядке плана, `ORDER_STATUS_PILL` на 15 статусов, предикаты `isOrderStatus`, `isCancellation`, `isTerminal`, `isActive`, `countsAsSale`:

```
$ grep -n "export function" src/domain/orderStatus.ts
70:export function isOrderStatus(value: string): value is OrderStatus {
82:export function isCancellation(status: OrderStatus): boolean {
92:export function isTerminal(status: OrderStatus): boolean {
103:export function isActive(status: OrderStatus): boolean {
121:export function countsAsSale(status: OrderStatus): boolean {
```

Одна схема пилюль, локальных карт нет, руками написанных списков нет:

```
$ grep -rn "ORDER_STATUS_PILL = " src/        → (пусто, кроме объявления в domain — см. ниже)
$ grep -rn "orders.status_new" src/           → (пусто)
$ ls -la src/styles/admin/components/_order-status-pill.css
-rw-rw-r-- 1 greatgleb greatgleb 3853 Aug 12 14:43 ...   (.order-status-pill, --lg, 15 модификаторов)
$ grep -n "status-pill" src/styles/admin/orders_list.css
350:/* Status pill colours moved to components/_order-status-pill.css — one scheme
$ grep -rn "domain/orderStatus" src/views src/composables src/services
src/views/admin/sales-crm/SalesCrmPage.vue:9
src/views/admin/orders/OrdersListPage.vue:15
src/views/admin/orders/OrderCardPage.vue:41
src/views/admin/clients/ClientCardPage.vue:16
src/services/mocks/orders.ts:107  (countsAsSale, isActive, isOrderStatus)
$ grep -n "order-status-pill" tests/e2e/admin/clients/clients.spec.ts
609:    await expect(firstRow.locator('.order-status-pill')).toBeVisible()
```

Типы: `ReturnCondition` (order.ts:295), `OrderReturnLine` с `restored: ShipmentHold[] | null` (297–313), `OrderReturn` с `correctionInvoiceIds` (324), `ReturnableLine` (343), `OrderItem.returnedQuantity` (125), `Order.returns` (466).

Мок настроек: семь новых статусов `st-completed`, `st-return_requested`, `st-return_processing`, `st-returned`, `st-rejected`, `st-cancelled_by_customer`, `st-refused` (settings.ts:248–313).

Мок возвратов: `mockCreateReturn` (orders.ts:3391), `mockPlanReturn`, `mockGetReturns`; `_nextReturnSeq` (тип 120, инициализация 597 и 1579, инкремент 3487); все восемь кодов бросаются (3411, 3412, 3416, 3421, 3430, 3437, 3444, 1693 `UNKNOWN_ORDER_STATUS` до `assertVersion`, 3918 `CORRECTION_EXCEEDS_ORIGINAL`); демо-возврат создаётся через настоящий эндпоинт (`mockCreateReturn(candidate.id, …)` на 4103); `registerProductSalesLookup` фильтрует `countsAsSale` и вычитает `item.returnedQuantity` (1244–1256); `mockGetSalesCrmStats` — `countsAsSale` (1493) и `isActive` (1497); `publicOrder` вырезает только `_`-ключи, значит `returns`/`returnedQuantity` уходят наружу.

Роуты мока: GET `return-plan` (index.ts:575), GET `returns` (580), POST `returns` через `withIdempotency` (1028).

Сервис: `getOrderReturns` (ordersService.ts:309), `planOrderReturn` (314), `createOrderReturn` (327); восемь кодов в таблице `orderLineEdits.ts:362–369`.

Composable: `returns`/`returnableLines`/`returnsLoading` (useOrderCard.ts:764–765), `loadReturns` (767), `loadReturnPlan` (775), `createReturn` (783, с `returnsLoading` guard и `flushBeforeReload`), `load()` зовёт оба (403–404), производные `returnedByLine` (815), `returnedGross` (830), `netAmount` (844), `returnState` (852), `refundState` (870), всё экспортировано (1923–1930).

i18n: все ключи статусов, панели/модалки, финблока и ошибок присутствуют в трёх языках (по `grep -c "^\s*<key>:"` = 3 на каждый из 34 проверенных).

Карточка: `isReturnsOn` (184), панель `data-test="order-returns"` (1840) с кнопкой (1859) и строками (1881), модалка (2387) со строками/полями (2403–2447), футер (2454, 2462–2463), бейдж в шапке (1058–1061), пометка строки (1520–1521), `field-returned-amount`/`field-net-amount` (1343, 1357), пилюля возврата денег (1902). CSS `.is-returned`, `.is-returned-fully`, `.line-returned-pill` в `orders_card.css:130–142`.

Флаг в трёх файлах: `types/features.ts:61`, `config/featureFlags.ts:70`, `tests/e2e/helpers/flags.ts:51`.

Контракт: §2 «Возврат» (69), §4.5 `UNKNOWN_ORDER_STATUS` (230) и список 15 статусов (232), §4.5.1 «Возвраты» с девятью шагами (234+), §4.6 правило по `outstandingNetOf` (271), §4.7 `activeOrders`/`salesMtd` (289, 291), §7.2 `avgSalePrice` (415), §6 — все восемь кодов (341–347), «TBD» нет.

Проверки:

```
$ npm run typecheck   → exit=0, вывод пуст
$ npm run lint        → без ошибок
$ npm run test:audit -- src/services/mocks/order-audit-returns.spec.ts
  Test Files 1 passed (1) | Tests 18 passed (18)
$ npm run test:audit -- src/services/mocks/order-audit-contract-conformance.spec.ts
  Test Files 1 passed (1) | Tests 7 passed (7)
```

### Чего нет

1. i18n-ключа `line_returned_partial` нет вовсе (`grep -c "^\s*line_returned_partial:"` → 0).
2. Ключ ошибки назван `orders.error_return_quantity_positive`, план требовал `error_return_quantity_must_be_positive` (orderLineEdits.ts:364; `error_return_quantity_must_be_positive` в i18n = 0).
3. Write-back в контракт из Prompt 7 не сделан: `grep -n "getOrderReturns\|planOrderReturn\|createOrderReturn" orders-backend-contract.md` → пусто, строки «Реализация: …» в §4.5.1 нет.
4. Prompt 15, три пункта из десяти отсутствуют в `tests/e2e/admin/orders/orders.spec.ts` (блок `Order Card › returns` — 7 тестов, строки 1442–1567):
   - закрытие модалки кликом по оверлею (проверяется только Escape);
   - переключение RU/EN/LT на карточке с возвратом;
   - посекционный снимок панели возвратов — `grep -n "toHaveScreenshot" tests/e2e/admin/orders/orders.spec.ts` → пусто, каталога `orders.spec.ts-snapshots` нет.
5. Спек возврата лежит как `src/services/mocks/order-audit-returns.spec.ts`, а не `orders-returns.spec.ts` — это соответствует тексту Prompt 14 (имя `order-audit-*`), но расходится с путём в том же пункте; расхождение внутри плана, не дефект кода.

### Пункты плана

Чекбоксов в плане нет (itemsTotal = 0); Prompt 0–14 выполнены, Prompt 15 — частично (см. пункт 4).
