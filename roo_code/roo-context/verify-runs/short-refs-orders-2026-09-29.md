# Перепись коротких ссылок `roo_code/roo-context/api/orders.md` — 2026-09-29

Короткая ссылка — это `:NNN`, `:N-M` или хвост перечисления через запятую. Файл у неё не назван, а
подразумевается последним путём ЛЕВЕЕ на ТОЙ ЖЕ строке; когда ссылка продолжает перечисление,
начатое строкой выше, файл подразумевается последним путём абзаца выше.

## Что искал

```bash
grep -oP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/orders.md | wc -l   # 347
grep -nP '(?<![\w:.,/-]):\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*(?![\w:])' roo_code/roo-context/api/orders.md | wc -l   # 222
wc -l roo_code/roo-context/api/orders.md   # 1476   (рабочий файл)
git show HEAD:roo_code/roo-context/api/orders.md | wc -l   # 1476   (версия до правки)
```

**Коротких ссылок: 347 во всём документе, они стоят в 222 строках.** Столько же
строк в таблице переписи ниже — по строке на каждое вхождение. Число строк документа правка не
меняет: `git show HEAD` даёт 1476, `wc -l` по рабочему файлу — 1476.

## Ограничители

1. **Строка с двумя и более РАЗНЫМИ путями не трогается вовсе** — контекст на ней неоднозначен.
2. **Диапазон `:N-M` двигается обоими концами или не двигается ни одним.** Перевёрнутых диапазонов нет.
3. **Правка доказывается содержимым.** Из предложения берётся код в бэктиках рядом со ссылкой и
   грепается по подразумеваемому файлу: нашёлся ровно один раз — номер известен; иначе глаза.
4. **Ссылка не трогается, если номер уже верен.**

Порядок вердиктов один и тот же для всех строк таблицы, чтобы причины сходились: два пути на
строке → токена рядом нет → токен-образец (`*`, `?`) → файл не назван → токен не найден →
номер уже верен → токен найден многократно → токен вне диапазона → токен найден не на строке ссылки.

## Что поправлено — 6

| строка документа | файл | было | стало | токен | его строка |
|---|---|---|---|---|---|
| 624 | frontend_vue/src/services/mocks/orders.ts | 2445 | 2460 | `order.services.findIndex((s) => s.id === serviceId)` | 2460 |
| 838 | frontend_vue/src/services/mocks/orders.ts | 3647 | 3662 | `returnable > 0` | 3662 |
| 1301 | frontend_vue/src/services/mocks/orders.ts | 1373 | 1376 | `costTopUp` | 1376 |
| 1334 | frontend_vue/src/services/mocks/index.ts | 574 | 691 | `ship-plan` | 691 |
| 1334 | frontend_vue/src/services/mocks/index.ts | 586 | 703 | `return-plan` | 703 |
| 1335 | frontend_vue/src/services/mocks/index.ts | 606 | 723 | `reservations` | 723 |

## Доказательство поимённо — грепом по целевому файлу

Каждый утверждаемый токен в подразумеваемом файле встречается ровно один раз:

```bash
grep -cF -- "order.services.findIndex((s) => s.id === serviceId)" frontend_vue/src/services/mocks/orders.ts   # 1 — вхождение токена в файле единственное
grep -cF -- "returnable > 0" frontend_vue/src/services/mocks/orders.ts   # 1 — вхождение токена в файле единственное
grep -cF -- "costTopUp" frontend_vue/src/services/mocks/orders.ts   # 1 — вхождение токена в файле единственное
grep -cF -- "ship-plan" frontend_vue/src/services/mocks/index.ts   # 1 — вхождение токена в файле единственное
grep -cF -- "return-plan" frontend_vue/src/services/mocks/index.ts   # 1 — вхождение токена в файле единственное
grep -cF -- "reservations" frontend_vue/src/services/mocks/index.ts   # 1 — вхождение токена в файле единственное
```

Строка с новым номером содержит утверждаемый токен:

```bash
sed -n "2460p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "order.services.findIndex((s) => s.id === serviceId)"   # 1 — токен на новом номере
sed -n "3662p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "returnable > 0"   # 1 — токен на новом номере
sed -n "1376p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "costTopUp"   # 1 — токен на новом номере
sed -n "691p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "ship-plan"   # 1 — токен на новом номере
sed -n "703p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "return-plan"   # 1 — токен на новом номере
sed -n "723p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "reservations"   # 1 — токен на новом номере
```

## Диапазоны — до и после

```bash
git show HEAD:roo_code/roo-context/api/orders.md | grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' | awk -F- '$1>$2'
```
До правки: код возврата 0, вывод (пусто).

```bash
grep -oP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/roo-context/api/orders.md | awk -F- '$1>$2'
```
После правки: код возврата 0, вывод (пусто).

Тот же счёт по всему `roo_code/`:

```bash
git grep -hoP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' HEAD -- roo_code/ | awk -F- '$1>$2' | wc -l
```
До правки: 4.

```bash
grep -rhoP '(?<![\w:.,/-]):\K\d+-\d+(?![\w:])' roo_code/ | awk -F- '$1>$2' | wc -l
```
После правки: 4 — число не изменилось. Все вхождения предсуществующие и к
`orders.md` отношения не имеют: это цитата самого правила из плана и bugs-файла и пример внутри
рабочего скрипта. Перечислять их здесь нечем: они не в области задачи и не ею созданы.

Ни один диапазон `N-M` этой задачей не тронут: правка касалась только одиночных номеров.

## Изменённые строки документа

```bash
git diff -U0 -- roo_code/roo-context/api/orders.md
```
```diff
diff --git a/roo_code/roo-context/api/orders.md b/roo_code/roo-context/api/orders.md
index 84606e5..fb52fdb 100644
--- a/roo_code/roo-context/api/orders.md
+++ b/roo_code/roo-context/api/orders.md
@@ -624 +624 @@ Save-режим: clean-slate, тот же **шаг 3**, ветка `kind === 'se
-`order.services.findIndex((s) => s.id === serviceId)` (`:2445`). Параметр клиента при этом назван
+`order.services.findIndex((s) => s.id === serviceId)` (`:2460`). Параметр клиента при этом назван
@@ -838 +838 @@ alreadyReturned, returnable }` (`types/order.ts:357-365`), считается п
-(`mocks/orders.ts:3638-3651`) и отдаёт только строки с `returnable > 0` (`:3647`). **Услуг здесь
+(`mocks/orders.ts:3638-3651`) и отдаёт только строки с `returnable > 0` (`:3662`). **Услуг здесь
@@ -1301 +1301 @@ Save-режим: quick-action из двух мест — карточка зак
-  (`:1373` → `:2938-2953`).
+  (`:1376` → `:2938-2953`).
@@ -1334,2 +1334,2 @@ Save-режим: quick-action из двух мест — карточка зак
-   (`mocks/index.ts:563`), `ship-plan` (`:574`), `shipments` (`:579`), `return-plan` (`:586`),
-   `returns` (`:591`), `payments` (`:596`), `invoices` (`:601`), `reservations` (`:606`) — и только
+   (`mocks/index.ts:563`), `ship-plan` (`:691`), `shipments` (`:579`), `return-plan` (`:703`),
+   `returns` (`:591`), `payments` (`:596`), `invoices` (`:601`), `reservations` (`:723`) — и только
```
Изменено **шесть** вхождений, все — в строках 624, 838, 1301, 1334, 1335.
Число строк документа правка не меняет: до 1476, после 1476.

## Строки с двумя и более разными путями

```bash
python3 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-3/tmp-short-refs-orders/twopath.py | cut -d" " -f1
```
```text
94
100
107
137
152
175
184
215
251
257
280
311
350
395
400
407
440
446
466
473
478
495
505
530
537
544
561
569
590
605
618
628
647
678
684
689
702
735
743
759
769
796
830
853
862
878
890
898
917
926
959
966
982
989
1012
1018
1032
1037
1057
1066
1087
1093
1095
1114
1119
1120
1125
1134
1149
1154
1295
1372
1373
1374
```

Строк с двумя и более РАЗНЫМИ путями в бэктиках — 74. Короткие ссылки несут только
строки 184 и 1374; обе идут в переписи как «отдано глазам» с причиной «два пути на строке» и в
документе остались дословно прежними. Ни одна изменённая строка (624, 838, 1301, 1334, 1335) в этот
перечень не входит.

## Проверка резолвером — до правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/orders.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```
Код возврата 0. Вывод целиком:

```text
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-3/wt-short-refs-orders/frontend_vue

roo_code/roo-context/api/orders.md: ссылок 564, битых 84, глазами 88, без токена 325
  roo_code/roo-context/api/orders.md:66 → mocks/orders.ts:1955-1958 — нет токена в диапазоне: в 1955-1958 нет ни одного из: «bumpVersion»
  roo_code/roo-context/api/orders.md:70 → services/ordersService.ts:41-43 — нет токена в диапазоне: в 41-43 нет ни одного из: «ifMatchVersion»
  roo_code/roo-context/api/orders.md:81 → mocks/index.ts:255-257 — нет токена в диапазоне: в 255-257 нет ни одного из: «delay(...)»
  roo_code/roo-context/api/orders.md:82 → services/api.ts:128-138 — нет токена в диапазоне: в 128-138 нет ни одного из: «ApiResponse<T>»
  roo_code/roo-context/api/orders.md:124 → composables/useClientCard.ts:179-190 — нет токена в диапазоне: в 179-190 нет ни одного из: «total»
  roo_code/roo-context/api/orders.md:125 → views/admin/clients/ClientsListPage.vue:105-116 — нет токена в диапазоне: в 105-116 нет ни одного из: «total»
  roo_code/roo-context/api/orders.md:138 → mocks/orders.ts:1609-1609 — нет токена в диапазоне: в 1609-1609 нет ни одного из: «mockCreateOrder»
  roo_code/roo-context/api/orders.md:143 → mocks/orders.ts:1641-1641 — нет токена в диапазоне: в 1641-1641 нет ни одного из: «data.currency»
  roo_code/roo-context/api/orders.md:145 → mocks/orders.ts:1633-1633 — нет токена в диапазоне: в 1633-1633 нет ни одного из: «ApiResponse<Order>»
  roo_code/roo-context/api/orders.md:149 → mocks/orders.ts:1616-1616 — нет токена в диапазоне: в 1616-1616 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/roo-context/api/orders.md:176 → mocks/orders.ts:1602-1602 — нет токена в диапазоне: в 1602-1602 нет ни одного из: «mockGetOrder»
  roo_code/roo-context/api/orders.md:216 → mocks/orders.ts:1694-1694 — нет токена в диапазоне: в 1694-1694 нет ни одного из: «mockPatchOrder»
  roo_code/roo-context/api/orders.md:223 → mocks/orders.ts:1712-1722 — нет токена в диапазоне: в 1712-1722 нет ни одного из: «Partial<Order>»
  roo_code/roo-context/api/orders.md:239 → mocks/orders.ts:1714-1714 — нет токена в диапазоне: в 1714-1714 нет ни одного из: «currency»
  roo_code/roo-context/api/orders.md:252 → mocks/orders.ts:2055-2055 — нет токена в диапазоне: в 2055-2055 нет ни одного из: «mockDeleteOrder»
  roo_code/roo-context/api/orders.md:265 → mocks/orders.ts:2073-2073 — нет токена в диапазоне: в 2073-2073 нет ни одного из: «releaseOrder»
  roo_code/roo-context/api/orders.md:270 → composables/useOrderCard.ts:575-575 — нет токена в диапазоне: в 575-575 нет ни одного из: «atVersion()»
  roo_code/roo-context/api/orders.md:281 → mocks/orders.ts:1796-1796 — нет токена в диапазоне: в 1796-1796 нет ни одного из: «mockPatchOrderStatus»
  roo_code/roo-context/api/orders.md:285 → mocks/index.ts:1262-1267 — нет токена в диапазоне: в 1262-1267 нет ни одного из: «ORDER_STATUSES»
  roo_code/roo-context/api/orders.md:288 → mocks/orders.ts:1841-1841 — нет токена в диапазоне: в 1841-1841 нет ни одного из: «ApiResponse<Order>»
  roo_code/roo-context/api/orders.md:303 → composables/useOrderCard.ts:662-662 — нет токена в диапазоне: в 662-662 нет ни одного из: «flushBeforeReload»
  roo_code/roo-context/api/orders.md:312 → mocks/orders.ts:1770-1770 — нет токена в диапазоне: в 1770-1770 нет ни одного из: «mockPlanStatusTransition»
  roo_code/roo-context/api/orders.md:316 → services/ordersService.ts:92-97 — нет токена в диапазоне: в 92-97 нет ни одного из: «'new'»
  roo_code/roo-context/api/orders.md:325 → mocks/orders.ts:1775-1775 — нет токена в диапазоне: в 1775-1775 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:331 → domain/orderStatus.ts:15-31 — нет токена в диапазоне: в 15-31 нет ни одного из: «statusRules»
  roo_code/roo-context/api/orders.md:333 → mocks/settings.ts:620-620 — нет токена в диапазоне: в 620-620 нет ни одного из: «isOrderStatus»
  roo_code/roo-context/api/orders.md:351 → mocks/orders.ts:2082-2082 — нет токена в диапазоне: в 2082-2082 нет ни одного из: «mockAddOrderItem»
  roo_code/roo-context/api/orders.md:358 → mocks/orders.ts:2156-2156 — нет токена в диапазоне: в 2156-2156 нет ни одного из: «refuseStatedCost»
  roo_code/roo-context/api/orders.md:376 → services/ordersService.ts:126-126 — нет токена в диапазоне: в 126-126 нет ни одного из: «unit»
  roo_code/roo-context/api/orders.md:378 → mocks/orders.ts:3045-3045 — нет токена в диапазоне: в 3045-3045 нет ни одного из: «uomIdFromOrderLineUnit»
  roo_code/roo-context/api/orders.md:382 → mocks/orders.ts:2189-2189 — нет токена в диапазоне: в 2189-2189 нет ни одного из: «baseCurrencyOf»
  roo_code/roo-context/api/orders.md:396 → mocks/orders.ts:2220-2220 — нет токена в диапазоне: в 2220-2220 нет ни одного из: «mockUpdateOrderItem»
  roo_code/roo-context/api/orders.md:429 → mocks/orders.ts:2251-2253 — нет токена в диапазоне: в 2251-2253 нет ни одного из: «weightPerUnitKg»
  roo_code/roo-context/api/orders.md:441 → mocks/orders.ts:2349-2349 — нет токена в диапазоне: в 2349-2349 нет ни одного из: «mockDeleteOrderItem»
  roo_code/roo-context/api/orders.md:452 → mocks/orders.ts:2367-2367 — нет токена в диапазоне: в 2367-2367 нет ни одного из: «releaseLine»
  roo_code/roo-context/api/orders.md:467 → mocks/orders.ts:2768-2768 — нет токена в диапазоне: в 2768-2768 нет ни одного из: «mockSplitOrderItem»
  roo_code/roo-context/api/orders.md:478 → mocks/orders.ts:2783-2783 — нет токена в диапазоне: в 2783-2783 нет ни одного из: «INVALID_SPLIT_QUANTITY»
  roo_code/roo-context/api/orders.md:496 → mocks/orders.ts:2614-2614 — нет токена в диапазоне: в 2614-2614 нет ни одного из: «mockCorrectOrderLine»
  roo_code/roo-context/api/orders.md:531 → mocks/orders.ts:2548-2548 — нет токена в диапазоне: в 2548-2548 нет ни одного из: «mockAllocateOrderTotal»
  roo_code/roo-context/api/orders.md:549 → orders-backend-contract.md:199-199 — нет токена в диапазоне: в 199-199 нет ни одного из: «allocateGrossTotal»
  roo_code/roo-context/api/orders.md:562 → mocks/orders.ts:2393-2393 — нет токена в диапазоне: в 2393-2393 нет ни одного из: «mockAddOrderService»
  roo_code/roo-context/api/orders.md:577 → types/order.ts:161-191 — нет токена в диапазоне: в 161-191 нет ни одного из: «currencyId», «uomId»
  roo_code/roo-context/api/orders.md:591 → mocks/orders.ts:2285-2285 — нет токена в диапазоне: в 2285-2285 нет ни одного из: «mockUpdateOrderService»
  roo_code/roo-context/api/orders.md:619 → mocks/orders.ts:2439-2439 — нет токена в диапазоне: в 2439-2439 нет ни одного из: «mockDeleteOrderService»
  roo_code/roo-context/api/orders.md:625 → services/ordersService.ts:184-184 — нет токена в диапазоне: в 184-184 нет ни одного из: «serviceId»
  roo_code/roo-context/api/orders.md:648 → mocks/orders.ts:3845-3845 — нет токена в диапазоне: в 3845-3845 нет ни одного из: «mockReserveOrder»
  roo_code/roo-context/api/orders.md:677 → services/ordersService.ts:373-373 — нет токена в диапазоне: в 373-373 нет ни одного из: «getOrderReservations»
  roo_code/roo-context/api/orders.md:703 → mocks/orders.ts:3240-3240 — нет токена в диапазоне: в 3240-3240 нет ни одного из: «mockPlanOrderShipment»
  roo_code/roo-context/api/orders.md:714 → mocks/orders.ts:3242-3242 — нет токена в диапазоне: в 3242-3242 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:736 → mocks/orders.ts:3260-3260 — нет токена в диапазоне: в 3260-3260 нет ни одного из: «mockCreateShipment»
  roo_code/roo-context/api/orders.md:770 → mocks/orders.ts:2814-2814 — нет токена в диапазоне: в 2814-2814 нет ни одного из: «mockGetShipments»
  roo_code/roo-context/api/orders.md:775 → mocks/orders.ts:2817-2817 — нет токена в диапазоне: в 2817-2817 нет ни одного из: «heldReleased»
  roo_code/roo-context/api/orders.md:779 → mocks/orders.ts:2816-2816 — нет токена в диапазоне: в 2816-2816 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:797 → mocks/orders.ts:3372-3372 — нет токена в диапазоне: в 3372-3372 нет ни одного из: «mockCancelShipment»
  roo_code/roo-context/api/orders.md:801 → services/ordersService.ts:305-310 — нет токена в диапазоне: в 305-310 нет ни одного из: «Idempotency-Key»
  roo_code/roo-context/api/orders.md:805 → mocks/orders.ts:3423-3423 — нет токена в диапазоне: в 3423-3423 нет ни одного из: «ApiResponse<Shipment>»
  roo_code/roo-context/api/orders.md:831 → mocks/orders.ts:3638-3638 — нет токена в диапазоне: в 3638-3638 нет ни одного из: «mockPlanReturn»
  roo_code/roo-context/api/orders.md:841 → mocks/orders.ts:3640-3640 — нет токена в диапазоне: в 3640-3640 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:854 → mocks/orders.ts:3660-3660 — нет токена в диапазоне: в 3660-3660 нет ни одного из: «mockCreateReturn»
  roo_code/roo-context/api/orders.md:891 → mocks/orders.ts:3629-3629 — нет токена в диапазоне: в 3629-3629 нет ни одного из: «mockGetReturns»
  roo_code/roo-context/api/orders.md:896 → mocks/orders.ts:3632-3632 — нет токена в диапазоне: в 3632-3632 нет ни одного из: «condition», «compensated»
  roo_code/roo-context/api/orders.md:900 → mocks/orders.ts:3631-3631 — нет токена в диапазоне: в 3631-3631 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:918 → mocks/orders.ts:4257-4257 — нет токена в диапазоне: в 4257-4257 нет ни одного из: «mockCreateInvoice»
  roo_code/roo-context/api/orders.md:960 → mocks/orders.ts:4026-4026 — нет токена в диапазоне: в 4026-4026 нет ни одного из: «mockGetInvoices»
  roo_code/roo-context/api/orders.md:965 → mocks/orders.ts:4029-4029 — нет токена в диапазоне: в 4029-4029 нет ни одного из: «Order.invoices»
  roo_code/roo-context/api/orders.md:969 → mocks/orders.ts:4028-4028 — нет токена в диапазоне: в 4028-4028 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:983 → mocks/orders.ts:3949-3949 — нет токена в диапазоне: в 3949-3949 нет ни одного из: «mockAddOrderPayment»
  roo_code/roo-context/api/orders.md:997 → mocks/orders.ts:3982-3982 — нет токена в диапазоне: в 3982-3982 нет ни одного из: «invoiceId»
  roo_code/roo-context/api/orders.md:1013 → mocks/orders.ts:3942-3942 — нет токена в диапазоне: в 3942-3942 нет ни одного из: «mockGetOrderPayments»
  roo_code/roo-context/api/orders.md:1021 → mocks/orders.ts:3944-3944 — нет токена в диапазоне: в 3944-3944 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:1033 → mocks/orders.ts:4008-4008 — нет токена в диапазоне: в 4008-4008 нет ни одного из: «mockDeleteOrderPayment»
  roo_code/roo-context/api/orders.md:1058 → mocks/orders.ts:2491-2491 — нет токена в диапазоне: в 2491-2491 нет ни одного из: «mockAddOrderFile»
  roo_code/roo-context/api/orders.md:1075 → mocks/orders.ts:2502-2502 — нет токена в диапазоне: в 2502-2502 нет ни одного из: «ord-file-N»
  roo_code/roo-context/api/orders.md:1078 → mocks/orders.ts:2505-2507 — нет токена в диапазоне: в 2505-2507 нет ни одного из: «size», «mime», «url»
  roo_code/roo-context/api/orders.md:1088 → mocks/orders.ts:2515-2515 — нет токена в диапазоне: в 2515-2515 нет ни одного из: «mockRemoveOrderFile»
  roo_code/roo-context/api/orders.md:1113 → services/ordersService.ts:190-190 — нет токена в диапазоне: в 190-190 нет ни одного из: «deleteOrderAuditEntry»
  roo_code/roo-context/api/orders.md:1118 → services/ordersService.ts:190-196 — нет токена в диапазоне: в 190-196 нет ни одного из: «StockAuditEntry»
  roo_code/roo-context/api/orders.md:1147 → mocks/orders.ts:1636-1636 — нет токена в диапазоне: в 1636-1636 нет ни одного из: «'EUR'»
  roo_code/roo-context/api/orders.md:1162 → mocks/orders.ts:1840-1840 — нет токена в диапазоне: в 1840-1840 нет ни одного из: «notifyOrderStatusChanged»
  roo_code/roo-context/api/orders.md:1200 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «seeCost»
  roo_code/roo-context/api/orders.md:1238 → mocks/orders.ts:1858-1863 — нет токена в диапазоне: в 1858-1863 нет ни одного из: «requireRight»
  roo_code/roo-context/api/orders.md:1256 → services/ordersService.ts:295-295 — нет токена в диапазоне: в 295-295 нет ни одного из: «Idempotency-Key»
  roo_code/roo-context/api/orders.md:1295 → types/order.ts:132-138 — нет токена в диапазоне: в 132-138 нет ни одного из: «projectItem», «state»
  roo_code/roo-context/api/orders.md:1296 → mocks/orders.ts:3323-3323 — нет токена в диапазоне: в 3323-3323 нет ни одного из: «syncLineState»
[ссылки] документов 1 · ссылок 564 · битых 84

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  00:40:24
   Duration  260ms (transform 81ms, setup 0ms, import 96ms, tests 45ms, environment 0ms)
exit=0
```

## Проверка резолвером — после правки

```bash
cd frontend_vue && env CONTRACT_REFS=roo_code/roo-context/api/orders.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```
Код возврата 0. Вывод целиком:

```text
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-3/wt-short-refs-orders/frontend_vue

roo_code/roo-context/api/orders.md: ссылок 564, битых 84, глазами 87, без токена 325
  roo_code/roo-context/api/orders.md:66 → mocks/orders.ts:1955-1958 — нет токена в диапазоне: в 1955-1958 нет ни одного из: «bumpVersion»
  roo_code/roo-context/api/orders.md:70 → services/ordersService.ts:41-43 — нет токена в диапазоне: в 41-43 нет ни одного из: «ifMatchVersion»
  roo_code/roo-context/api/orders.md:81 → mocks/index.ts:255-257 — нет токена в диапазоне: в 255-257 нет ни одного из: «delay(...)»
  roo_code/roo-context/api/orders.md:82 → services/api.ts:128-138 — нет токена в диапазоне: в 128-138 нет ни одного из: «ApiResponse<T>»
  roo_code/roo-context/api/orders.md:124 → composables/useClientCard.ts:179-190 — нет токена в диапазоне: в 179-190 нет ни одного из: «total»
  roo_code/roo-context/api/orders.md:125 → views/admin/clients/ClientsListPage.vue:105-116 — нет токена в диапазоне: в 105-116 нет ни одного из: «total»
  roo_code/roo-context/api/orders.md:138 → mocks/orders.ts:1609-1609 — нет токена в диапазоне: в 1609-1609 нет ни одного из: «mockCreateOrder»
  roo_code/roo-context/api/orders.md:143 → mocks/orders.ts:1641-1641 — нет токена в диапазоне: в 1641-1641 нет ни одного из: «data.currency»
  roo_code/roo-context/api/orders.md:145 → mocks/orders.ts:1633-1633 — нет токена в диапазоне: в 1633-1633 нет ни одного из: «ApiResponse<Order>»
  roo_code/roo-context/api/orders.md:149 → mocks/orders.ts:1616-1616 — нет токена в диапазоне: в 1616-1616 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/roo-context/api/orders.md:176 → mocks/orders.ts:1602-1602 — нет токена в диапазоне: в 1602-1602 нет ни одного из: «mockGetOrder»
  roo_code/roo-context/api/orders.md:216 → mocks/orders.ts:1694-1694 — нет токена в диапазоне: в 1694-1694 нет ни одного из: «mockPatchOrder»
  roo_code/roo-context/api/orders.md:223 → mocks/orders.ts:1712-1722 — нет токена в диапазоне: в 1712-1722 нет ни одного из: «Partial<Order>»
  roo_code/roo-context/api/orders.md:239 → mocks/orders.ts:1714-1714 — нет токена в диапазоне: в 1714-1714 нет ни одного из: «currency»
  roo_code/roo-context/api/orders.md:252 → mocks/orders.ts:2055-2055 — нет токена в диапазоне: в 2055-2055 нет ни одного из: «mockDeleteOrder»
  roo_code/roo-context/api/orders.md:265 → mocks/orders.ts:2073-2073 — нет токена в диапазоне: в 2073-2073 нет ни одного из: «releaseOrder»
  roo_code/roo-context/api/orders.md:270 → composables/useOrderCard.ts:575-575 — нет токена в диапазоне: в 575-575 нет ни одного из: «atVersion()»
  roo_code/roo-context/api/orders.md:281 → mocks/orders.ts:1796-1796 — нет токена в диапазоне: в 1796-1796 нет ни одного из: «mockPatchOrderStatus»
  roo_code/roo-context/api/orders.md:285 → mocks/index.ts:1262-1267 — нет токена в диапазоне: в 1262-1267 нет ни одного из: «ORDER_STATUSES»
  roo_code/roo-context/api/orders.md:288 → mocks/orders.ts:1841-1841 — нет токена в диапазоне: в 1841-1841 нет ни одного из: «ApiResponse<Order>»
  roo_code/roo-context/api/orders.md:303 → composables/useOrderCard.ts:662-662 — нет токена в диапазоне: в 662-662 нет ни одного из: «flushBeforeReload»
  roo_code/roo-context/api/orders.md:312 → mocks/orders.ts:1770-1770 — нет токена в диапазоне: в 1770-1770 нет ни одного из: «mockPlanStatusTransition»
  roo_code/roo-context/api/orders.md:316 → services/ordersService.ts:92-97 — нет токена в диапазоне: в 92-97 нет ни одного из: «'new'»
  roo_code/roo-context/api/orders.md:325 → mocks/orders.ts:1775-1775 — нет токена в диапазоне: в 1775-1775 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:331 → domain/orderStatus.ts:15-31 — нет токена в диапазоне: в 15-31 нет ни одного из: «statusRules»
  roo_code/roo-context/api/orders.md:333 → mocks/settings.ts:620-620 — нет токена в диапазоне: в 620-620 нет ни одного из: «isOrderStatus»
  roo_code/roo-context/api/orders.md:351 → mocks/orders.ts:2082-2082 — нет токена в диапазоне: в 2082-2082 нет ни одного из: «mockAddOrderItem»
  roo_code/roo-context/api/orders.md:358 → mocks/orders.ts:2156-2156 — нет токена в диапазоне: в 2156-2156 нет ни одного из: «refuseStatedCost»
  roo_code/roo-context/api/orders.md:376 → services/ordersService.ts:126-126 — нет токена в диапазоне: в 126-126 нет ни одного из: «unit»
  roo_code/roo-context/api/orders.md:378 → mocks/orders.ts:3045-3045 — нет токена в диапазоне: в 3045-3045 нет ни одного из: «uomIdFromOrderLineUnit»
  roo_code/roo-context/api/orders.md:382 → mocks/orders.ts:2189-2189 — нет токена в диапазоне: в 2189-2189 нет ни одного из: «baseCurrencyOf»
  roo_code/roo-context/api/orders.md:396 → mocks/orders.ts:2220-2220 — нет токена в диапазоне: в 2220-2220 нет ни одного из: «mockUpdateOrderItem»
  roo_code/roo-context/api/orders.md:429 → mocks/orders.ts:2251-2253 — нет токена в диапазоне: в 2251-2253 нет ни одного из: «weightPerUnitKg»
  roo_code/roo-context/api/orders.md:441 → mocks/orders.ts:2349-2349 — нет токена в диапазоне: в 2349-2349 нет ни одного из: «mockDeleteOrderItem»
  roo_code/roo-context/api/orders.md:452 → mocks/orders.ts:2367-2367 — нет токена в диапазоне: в 2367-2367 нет ни одного из: «releaseLine»
  roo_code/roo-context/api/orders.md:467 → mocks/orders.ts:2768-2768 — нет токена в диапазоне: в 2768-2768 нет ни одного из: «mockSplitOrderItem»
  roo_code/roo-context/api/orders.md:478 → mocks/orders.ts:2783-2783 — нет токена в диапазоне: в 2783-2783 нет ни одного из: «INVALID_SPLIT_QUANTITY»
  roo_code/roo-context/api/orders.md:496 → mocks/orders.ts:2614-2614 — нет токена в диапазоне: в 2614-2614 нет ни одного из: «mockCorrectOrderLine»
  roo_code/roo-context/api/orders.md:531 → mocks/orders.ts:2548-2548 — нет токена в диапазоне: в 2548-2548 нет ни одного из: «mockAllocateOrderTotal»
  roo_code/roo-context/api/orders.md:549 → orders-backend-contract.md:199-199 — нет токена в диапазоне: в 199-199 нет ни одного из: «allocateGrossTotal»
  roo_code/roo-context/api/orders.md:562 → mocks/orders.ts:2393-2393 — нет токена в диапазоне: в 2393-2393 нет ни одного из: «mockAddOrderService»
  roo_code/roo-context/api/orders.md:577 → types/order.ts:161-191 — нет токена в диапазоне: в 161-191 нет ни одного из: «currencyId», «uomId»
  roo_code/roo-context/api/orders.md:591 → mocks/orders.ts:2285-2285 — нет токена в диапазоне: в 2285-2285 нет ни одного из: «mockUpdateOrderService»
  roo_code/roo-context/api/orders.md:619 → mocks/orders.ts:2439-2439 — нет токена в диапазоне: в 2439-2439 нет ни одного из: «mockDeleteOrderService»
  roo_code/roo-context/api/orders.md:625 → services/ordersService.ts:184-184 — нет токена в диапазоне: в 184-184 нет ни одного из: «serviceId»
  roo_code/roo-context/api/orders.md:648 → mocks/orders.ts:3845-3845 — нет токена в диапазоне: в 3845-3845 нет ни одного из: «mockReserveOrder»
  roo_code/roo-context/api/orders.md:677 → services/ordersService.ts:373-373 — нет токена в диапазоне: в 373-373 нет ни одного из: «getOrderReservations»
  roo_code/roo-context/api/orders.md:703 → mocks/orders.ts:3240-3240 — нет токена в диапазоне: в 3240-3240 нет ни одного из: «mockPlanOrderShipment»
  roo_code/roo-context/api/orders.md:714 → mocks/orders.ts:3242-3242 — нет токена в диапазоне: в 3242-3242 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:736 → mocks/orders.ts:3260-3260 — нет токена в диапазоне: в 3260-3260 нет ни одного из: «mockCreateShipment»
  roo_code/roo-context/api/orders.md:770 → mocks/orders.ts:2814-2814 — нет токена в диапазоне: в 2814-2814 нет ни одного из: «mockGetShipments»
  roo_code/roo-context/api/orders.md:775 → mocks/orders.ts:2817-2817 — нет токена в диапазоне: в 2817-2817 нет ни одного из: «heldReleased»
  roo_code/roo-context/api/orders.md:779 → mocks/orders.ts:2816-2816 — нет токена в диапазоне: в 2816-2816 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:797 → mocks/orders.ts:3372-3372 — нет токена в диапазоне: в 3372-3372 нет ни одного из: «mockCancelShipment»
  roo_code/roo-context/api/orders.md:801 → services/ordersService.ts:305-310 — нет токена в диапазоне: в 305-310 нет ни одного из: «Idempotency-Key»
  roo_code/roo-context/api/orders.md:805 → mocks/orders.ts:3423-3423 — нет токена в диапазоне: в 3423-3423 нет ни одного из: «ApiResponse<Shipment>»
  roo_code/roo-context/api/orders.md:831 → mocks/orders.ts:3638-3638 — нет токена в диапазоне: в 3638-3638 нет ни одного из: «mockPlanReturn»
  roo_code/roo-context/api/orders.md:841 → mocks/orders.ts:3640-3640 — нет токена в диапазоне: в 3640-3640 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:854 → mocks/orders.ts:3660-3660 — нет токена в диапазоне: в 3660-3660 нет ни одного из: «mockCreateReturn»
  roo_code/roo-context/api/orders.md:891 → mocks/orders.ts:3629-3629 — нет токена в диапазоне: в 3629-3629 нет ни одного из: «mockGetReturns»
  roo_code/roo-context/api/orders.md:896 → mocks/orders.ts:3632-3632 — нет токена в диапазоне: в 3632-3632 нет ни одного из: «condition», «compensated»
  roo_code/roo-context/api/orders.md:900 → mocks/orders.ts:3631-3631 — нет токена в диапазоне: в 3631-3631 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:918 → mocks/orders.ts:4257-4257 — нет токена в диапазоне: в 4257-4257 нет ни одного из: «mockCreateInvoice»
  roo_code/roo-context/api/orders.md:960 → mocks/orders.ts:4026-4026 — нет токена в диапазоне: в 4026-4026 нет ни одного из: «mockGetInvoices»
  roo_code/roo-context/api/orders.md:965 → mocks/orders.ts:4029-4029 — нет токена в диапазоне: в 4029-4029 нет ни одного из: «Order.invoices»
  roo_code/roo-context/api/orders.md:969 → mocks/orders.ts:4028-4028 — нет токена в диапазоне: в 4028-4028 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:983 → mocks/orders.ts:3949-3949 — нет токена в диапазоне: в 3949-3949 нет ни одного из: «mockAddOrderPayment»
  roo_code/roo-context/api/orders.md:997 → mocks/orders.ts:3982-3982 — нет токена в диапазоне: в 3982-3982 нет ни одного из: «invoiceId»
  roo_code/roo-context/api/orders.md:1013 → mocks/orders.ts:3942-3942 — нет токена в диапазоне: в 3942-3942 нет ни одного из: «mockGetOrderPayments»
  roo_code/roo-context/api/orders.md:1021 → mocks/orders.ts:3944-3944 — нет токена в диапазоне: в 3944-3944 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:1033 → mocks/orders.ts:4008-4008 — нет токена в диапазоне: в 4008-4008 нет ни одного из: «mockDeleteOrderPayment»
  roo_code/roo-context/api/orders.md:1058 → mocks/orders.ts:2491-2491 — нет токена в диапазоне: в 2491-2491 нет ни одного из: «mockAddOrderFile»
  roo_code/roo-context/api/orders.md:1075 → mocks/orders.ts:2502-2502 — нет токена в диапазоне: в 2502-2502 нет ни одного из: «ord-file-N»
  roo_code/roo-context/api/orders.md:1078 → mocks/orders.ts:2505-2507 — нет токена в диапазоне: в 2505-2507 нет ни одного из: «size», «mime», «url»
  roo_code/roo-context/api/orders.md:1088 → mocks/orders.ts:2515-2515 — нет токена в диапазоне: в 2515-2515 нет ни одного из: «mockRemoveOrderFile»
  roo_code/roo-context/api/orders.md:1113 → services/ordersService.ts:190-190 — нет токена в диапазоне: в 190-190 нет ни одного из: «deleteOrderAuditEntry»
  roo_code/roo-context/api/orders.md:1118 → services/ordersService.ts:190-196 — нет токена в диапазоне: в 190-196 нет ни одного из: «StockAuditEntry»
  roo_code/roo-context/api/orders.md:1147 → mocks/orders.ts:1636-1636 — нет токена в диапазоне: в 1636-1636 нет ни одного из: «'EUR'»
  roo_code/roo-context/api/orders.md:1162 → mocks/orders.ts:1840-1840 — нет токена в диапазоне: в 1840-1840 нет ни одного из: «notifyOrderStatusChanged»
  roo_code/roo-context/api/orders.md:1200 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «seeCost»
  roo_code/roo-context/api/orders.md:1238 → mocks/orders.ts:1858-1863 — нет токена в диапазоне: в 1858-1863 нет ни одного из: «requireRight»
  roo_code/roo-context/api/orders.md:1256 → services/ordersService.ts:295-295 — нет токена в диапазоне: в 295-295 нет ни одного из: «Idempotency-Key»
  roo_code/roo-context/api/orders.md:1295 → types/order.ts:132-138 — нет токена в диапазоне: в 132-138 нет ни одного из: «projectItem», «state»
  roo_code/roo-context/api/orders.md:1296 → mocks/orders.ts:3323-3323 — нет токена в диапазоне: в 3323-3323 нет ни одного из: «syncLineState»
[ссылки] документов 1 · ссылок 564 · битых 84

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  00:48:06
   Duration  246ms (transform 72ms, setup 0ms, import 86ms, tests 43ms, environment 0ms)
exit=0
```

## Сравнение построчное

Сводка до: `roo_code/roo-context/api/orders.md: ссылок 564, битых 84, глазами 88, без токена 325`. Сводка после: `roo_code/roo-context/api/orders.md: ссылок 564, битых 84, глазами 87, без токена 325`.
Списки битых ссылок построчно совпадают — 84 записи до и 84 после, различий нет:
**ни одной новой записи не появилось, счёт битых не вырос.** Сводка отличается только числом
«глазами»: 88 до и 87 после — одна ссылка перешла из разряда непроверенных в проверенные,
потому что номер стал указывать туда, где утверждаемый токен действительно есть.
## Мутационная проверка

Возврат исправленного номера к прежнему значению печатает `0`: утверждаемого токена на старой
строке нет, то есть предложение документа становится ложным.

```bash
sed -n "2445p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "order.services.findIndex((s) => s.id === serviceId)"   # 0
sed -n "3647p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "returnable > 0"   # 0
sed -n "1373p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "costTopUp"   # 0
sed -n "574p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "ship-plan"   # 0
sed -n "586p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "return-plan"   # 0
sed -n "606p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "reservations"   # 0
```

На новом номере тот же токен найден:

```bash
sed -n "2460p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "order.services.findIndex((s) => s.id === serviceId)"   # 1 (вхождений токена в файле: 1)
sed -n "3662p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "returnable > 0"   # 1 (вхождений токена в файле: 1)
sed -n "1376p" frontend_vue/src/services/mocks/orders.ts | grep -cF -- "costTopUp"   # 1 (вхождений токена в файле: 1)
sed -n "691p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "ship-plan"   # 1 (вхождений токена в файле: 1)
sed -n "703p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "return-plan"   # 1 (вхождений токена в файле: 1)
sed -n "723p" frontend_vue/src/services/mocks/index.ts | grep -cF -- "reservations"   # 1 (вхождений токена в файле: 1)
```

## Перепись — 347 строк, по строке на короткую ссылку

| № | строка документа | подразумеваемый файл | было | стало | утверждаемый токен | строки токена | вердикт | причина |
|---|---|---|---|---|---|---|---|---|
| 1 | 67 | frontend_vue/src/services/mocks/orders.ts | 1938-1941 | — | `assertVersion` | 1709,1817,1948,2075,2115,2121 | отдано глазам | токен найден многократно |
| 2 | 68 | frontend_vue/src/services/mocks/orders.ts | 1940 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 3 | 71 | frontend_vue/src/services/mocks/index.ts | 1428 | — | `ifMatchVersion` | 1602,1610 | отдано глазам | токен найден многократно |
| 4 | 76 | frontend_vue/src/services/ordersService.ts | 352 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 5 | 76 | frontend_vue/src/services/ordersService.ts | 386 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 6 | 77 | frontend_vue/src/services/mocks/index.ts | 1030-1057 | — | `withIdempotency` | 321,1041,1048,1056,1063,1143 | отдано глазам | номер уже верен |
| 7 | 102 | frontend_vue/src/services/mocks/orders.ts | 1508-1511 | — | `status: 'all'` | — | отдано глазам | токен не найден |
| 8 | 103 | frontend_vue/src/services/mocks/orders.ts | 1523 | — | `createdAt.slice(0, 10)` | 1526,1529 | отдано глазам | токен найден многократно |
| 9 | 103 | frontend_vue/src/services/mocks/orders.ts | 1526 | — | `createdAt.slice(0, 10)` | 1526,1529 | отдано глазам | номер уже верен |
| 10 | 103 | frontend_vue/src/services/mocks/orders.ts | 1407-1418 | — | `ORDER_SORT_KEYS` | 1410,1421,1444,1532 | отдано глазам | номер уже верен |
| 11 | 104 | frontend_vue/src/services/mocks/orders.ts | 1541 | — | `orderNumber` | 581,1411,1490,1507,1543,1629 | отдано глазам | токен найден многократно |
| 12 | 108 | frontend_vue/src/services/mocks/orders.ts | 1497 | — | `shippedPercent` | 235,1417,1500 | отдано глазам | токен найден многократно |
| 13 | 109 | frontend_vue/src/services/mocks/orders.ts | 235-240 | — | `shippedPercentOf` | 235,1500 | отдано глазам | номер уже верен |
| 14 | 111 | frontend_vue/src/services/mocks/orders.ts | 1447 | — | `UNKNOWN_SORT_DIRECTION` | 1450,4810 | отдано глазам | токен найден многократно |
| 15 | 112 | frontend_vue/src/services/mocks/orders.ts | 1453 | — | `INVALID_DATE_FILTER` | 1456,4811 | отдано глазам | токен найден многократно |
| 16 | 112 | frontend_vue/src/services/mocks/orders.ts | 1465 | — | `pageSize` | 1460,1466,1556,1557,1558,1564 | отдано глазам | токен найден многократно |
| 17 | 113 | frontend_vue/src/services/mocks/orders.ts | 1437-1469 | — | `validateListRequest` | 1440,1486 | отдано глазам | номер уже верен |
| 18 | 113 | frontend_vue/src/services/mocks/orders.ts | 1484 | — | `validateListRequest` | 1440,1486 | отдано глазам | токен найден многократно |
| 19 | 146 | frontend_vue/src/services/mocks/orders.ts | 1670 | — | `version: 1` | 619,1680 | отдано глазам | токен найден многократно |
| 20 | 146 | frontend_vue/src/services/mocks/orders.ts | 1662 | — | `version: 1` | 619,1680 | отдано глазам | токен найден многократно |
| 21 | 147 | frontend_vue/src/services/mocks/orders.ts | 1660 | — | `version: 1` | 619,1680 | отдано глазам | токен найден многократно |
| 22 | 156 | frontend_vue/src/services/mocks/orders.ts | 1634 | — | — | — | отдано глазам | токена рядом нет |
| 23 | 156 | frontend_vue/src/services/mocks/orders.ts | 1637 | — | — | — | отдано глазам | токена рядом нет |
| 24 | 157 | frontend_vue/src/services/mocks/orders.ts | 1638 | — | — | — | отдано глазам | токена рядом нет |
| 25 | 163 | frontend_vue/src/composables/useOrderCreate.ts | 43 | — | `settings.constants.defaultCurrency` | 43 | отдано глазам | номер уже верен |
| 26 | 184 | frontend_vue/src/services/mocks/orders.ts | 2938-2953 | — | `topUpLadder` | 1376,2953 | отдано глазам | два пути на строке |
| 27 | 192 | frontend_vue/src/services/mocks/orders.ts | 139-168 | — | `_` | 107,139,140,141,142,143 | отдано глазам | номер уже верен |
| 28 | 197 | frontend_vue/src/services/mocks/orders.ts | 1772 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 29 | 197 | frontend_vue/src/services/mocks/orders.ts | 2813 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 30 | 197 | frontend_vue/src/services/mocks/orders.ts | 3239 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 31 | 197 | frontend_vue/src/services/mocks/orders.ts | 3628 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 32 | 197 | frontend_vue/src/services/mocks/orders.ts | 3637 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 33 | 197 | frontend_vue/src/services/mocks/orders.ts | 3941 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 34 | 197 | frontend_vue/src/services/mocks/orders.ts | 4025 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 35 | 201 | frontend_vue/src/services/mocks/orders.ts | 1391-1394 | — | `maySeeCost` | 1387,1394 | отдано глазам | номер уже верен |
| 36 | 222 | frontend_vue/src/composables/useOrderCard.ts | 301-305 | — | `SAVABLE_FIELDS` | 119,303 | отдано глазам | номер уже верен |
| 37 | 231 | frontend_vue/src/services/mocks/orders.ts | 179-226 | — | `recalcOrder` | 179,505,631,634,1286,1738 | отдано глазам | номер уже верен |
| 38 | 233 | frontend_vue/src/services/mocks/orders.ts | 1699 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 39 | 234 | frontend_vue/src/services/mocks/orders.ts | 1700-1707 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 40 | 234 | frontend_vue/src/services/mocks/orders.ts | 1978 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 41 | 235 | frontend_vue/src/services/mocks/orders.ts | 191 | — | `DUPLICATE_LINE_ID` | 191,4774,4844 | отдано глазам | номер уже верен |
| 42 | 235 | frontend_vue/src/services/mocks/orders.ts | 200 | — | `ALLOCATION_EXCEEDS_QUANTITY` | 200,4774,4845 | отдано глазам | номер уже верен |
| 43 | 245 | frontend_vue/src/composables/useOrderCard.ts | 422-427 | — | — | — | отдано глазам | токена рядом нет |
| 44 | 259 | frontend_vue/src/services/mocks/orders.ts | 2064 | — | `ORDER_HAS_SHIPMENT` | 2079,4797 | отдано глазам | токен найден многократно |
| 45 | 260 | frontend_vue/src/services/mocks/orders.ts | 2065 | — | `ORDER_HAS_PAYMENT` | 2080,4798 | отдано глазам | токен найден многократно |
| 46 | 260 | frontend_vue/src/services/mocks/orders.ts | 2060 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 47 | 261 | frontend_vue/src/services/mocks/orders.ts | 2058 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 48 | 262 | frontend_vue/src/services/mocks/orders.ts | 2356 | — | `*_NOT_FOUND` | 4771 | отдано глазам | токен-образец |
| 49 | 262 | frontend_vue/src/services/mocks/orders.ts | 2446 | — | `*_NOT_FOUND` | 4771 | отдано глазам | токен-образец |
| 50 | 262 | frontend_vue/src/services/mocks/orders.ts | 2479 | — | `*_NOT_FOUND` | 4771 | отдано глазам | токен-образец |
| 51 | 262 | frontend_vue/src/services/mocks/orders.ts | 2530 | — | `*_NOT_FOUND` | 4771 | отдано глазам | токен-образец |
| 52 | 266 | frontend_vue/src/services/mocks/orders.ts | 2074 | — | `clearShortages` | 112,1053,2089,3033 | отдано глазам | токен найден многократно |
| 53 | 267 | roo_code/plans/orders/orders-backend-contract.md | 179 | — | `clearShortages` | — | отдано глазам | токен не найден |
| 54 | 291 | frontend_vue/src/services/mocks/orders.ts | 1799-1805 | — | `UNKNOWN_ORDER_STATUS` | 1816,4813 | отдано глазам | токен найден многократно |
| 55 | 291 | frontend_vue/src/services/mocks/orders.ts | 1800 | — | `ORDER_NOT_FOUND` | 252,1604,1610,1708,1782,1810 | отдано глазам | токен найден многократно |
| 56 | 292 | frontend_vue/src/services/mocks/orders.ts | 1807 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 57 | 292 | frontend_vue/src/services/mocks/orders.ts | 1819 | — | `STATUS_BLOCKED_BY_STOCK` | 1829,4807 | отдано глазам | токен найден многократно |
| 58 | 293 | frontend_vue/src/services/mocks/orders.ts | 1820 | — | `STATUS_BLOCKED_BY_STOCK` | 1829,4807 | отдано глазам | токен найден многократно |
| 59 | 296 | frontend_vue/src/services/mocks/orders.ts | 1823 | — | `mockReserveOrder` | 1279,1833,3857 | отдано глазам | токен найден многократно |
| 60 | 296 | frontend_vue/src/services/mocks/orders.ts | 3356 | — | `bumpVersion` | 1739,1836,1962,2214,2289,2348 | отдано глазам | токен найден многократно |
| 61 | 297 | frontend_vue/src/services/mocks/orders.ts | 3928 | — | `bumpVersion` | 1739,1836,1962,2214,2289,2348 | отдано глазам | токен найден многократно |
| 62 | 297 | frontend_vue/src/services/mocks/orders.ts | 1826 | — | `bumpVersion` | 1739,1836,1962,2214,2289,2348 | отдано глазам | токен найден многократно |
| 63 | 322 | — | 1733-1740 | — | `st-<status>` | — | отдано глазам | файл не назван |
| 64 | 322 | — | 1780 | — | `st-<status>` | — | отдано глазам | файл не назван |
| 65 | 323 | — | 1782 | — | `writesOff` | — | отдано глазам | файл не назван |
| 66 | 323 | — | 1789 | — | `writesOff` | — | отдано глазам | файл не назван |
| 67 | 326 | frontend_vue/src/services/mocks/orders.ts | 1806 | — | `isOrderStatus` | 128,1816 | отдано глазам | токен найден многократно |
| 68 | 327 | frontend_vue/src/services/mocks/orders.ts | 1736-1739 | — | `st-<опечатка>` | — | отдано глазам | токен не найден |
| 69 | 342 | frontend_vue/src/composables/useOrderCard.ts | 665 | — | — | — | отдано глазам | токена рядом нет |
| 70 | 359 | frontend_vue/src/services/mocks/orders.ts | 1996-2000 | — | `refuseStatedCost` | 2006,2134,2136 | отдано глазам | токен найден многократно |
| 71 | 359 | frontend_vue/src/services/mocks/orders.ts | 2121 | — | `refuseStatedCost` | 2006,2134,2136 | отдано глазам | токен найден многократно |
| 72 | 366 | frontend_vue/src/services/mocks/orders.ts | 2106 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 73 | 367 | frontend_vue/src/services/mocks/orders.ts | 2109-2114 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 74 | 367 | frontend_vue/src/services/mocks/orders.ts | 2118 | — | `ZERO_QUANTITY` | 2133,2427,4817 | отдано глазам | токен найден многократно |
| 75 | 368 | frontend_vue/src/services/mocks/orders.ts | 1998-1999 | — | `MANUAL_COST_REASON_REQUIRED` | 2009,4815 | отдано глазам | токен найден многократно |
| 76 | 368 | frontend_vue/src/services/mocks/orders.ts | 2128 | — | `CATALOG_PRODUCT_NOT_FOUND` | 2143,4781 | отдано глазам | токен найден многократно |
| 77 | 369 | frontend_vue/src/services/mocks/orders.ts | 2146 | — | `OFFCUTS_WITH_BATCH` | 2161,4818 | отдано глазам | токен найден многократно |
| 78 | 369 | frontend_vue/src/services/mocks/orders.ts | 2151 | — | `OFFCUTS_EXCEED_QUANTITY` | 2166,4819 | отдано глазам | токен найден многократно |
| 79 | 380 | frontend_vue/src/services/mocks/orders.ts | 2129 | — | `CATALOGUE_LANGUAGE = 'en'` | 372 | отдано глазам | токен найден не на строке ссылки |
| 80 | 386 | frontend_vue/src/composables/useOrderCard.ts | 447-449 | — | `discountPercent` | 168,181,448,466,1197,1214 | отдано глазам | номер уже верен |
| 81 | 403 | frontend_vue/src/services/orderLineEdits.ts | 223-257 | — | `deltaToOps` | 224 | отдано глазам | номер уже верен |
| 82 | 413 | frontend_vue/src/services/mocks/orders.ts | 2224 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 83 | 414 | frontend_vue/src/services/mocks/orders.ts | 2226 | — | `ORDER_ITEM_NOT_FOUND` | 2241,2371,2637,2791,3124,3709 | отдано глазам | токен найден многократно |
| 84 | 415 | frontend_vue/src/services/mocks/orders.ts | 2019-2038 | — | `validateLineEdit` | 2029,2244,2310 | отдано глазам | номер уже верен |
| 85 | 415 | frontend_vue/src/services/mocks/orders.ts | 2037 | — | `ALLOCATIONS_NOT_ACCEPTED` | 2047,4816 | отдано глазам | токен найден многократно |
| 86 | 416 | frontend_vue/src/services/mocks/orders.ts | 2237 | — | `requireRight` | 1865,2008,2252,2322,2646,3405 | отдано глазам | токен найден многократно |
| 87 | 416 | frontend_vue/src/services/mocks/orders.ts | 1858 | — | `requireRight` | 1865,2008,2252,2322,2646,3405 | отдано глазам | токен найден многократно |
| 88 | 417 | frontend_vue/src/services/orderLineEdits.ts | 112 | — | `RESET_COST_NOT_SUPPORTED` | 113,319 | отдано глазам | токен найден многократно |
| 89 | 417 | frontend_vue/src/services/orderLineEdits.ts | 114 | — | `COST_FROZEN_BY_SHIPMENT` | 115,310 | отдано глазам | токен найден многократно |
| 90 | 417 | frontend_vue/src/services/orderLineEdits.ts | 119 | — | `NO_STOCK_COST` | 120,320 | отдано глазам | токен найден многократно |
| 91 | 418 | frontend_vue/src/services/orderLineEdits.ts | 159 | — | `QUANTITY_SPLITS_OFFCUT` | 160,397 | отдано глазам | токен найден многократно |
| 92 | 419 | frontend_vue/src/domain/orderPricing.ts | 216 | — | `PRICE_FROZEN_BY_SHIPMENT` | 216 | отдано глазам | номер уже верен |
| 93 | 419 | frontend_vue/src/domain/orderPricing.ts | 379 | — | `LINE_FULLY_SHIPPED` | 379 | отдано глазам | номер уже верен |
| 94 | 420 | frontend_vue/src/domain/orderPricing.ts | 388 | — | `BELOW_SHIPPED_QUANTITY` | 388 | отдано глазам | номер уже верен |
| 95 | 424 | frontend_vue/src/services/mocks/orders.ts | 2865-2890 | — | `topUpAllocation` | 2286,2880 | отдано глазам | номер уже верен |
| 96 | 426 | roo_code/plans/orders/orders-backend-contract.md | 147-155 | — | `topUpAllocation` | — | отдано глазам | токен не найден |
| 97 | 448 | frontend_vue/src/services/mocks/orders.ts | 2356 | — | `ORDER_ITEM_NOT_FOUND` | 2241,2371,2637,2791,3124,3709 | отдано глазам | токен найден многократно |
| 98 | 449 | frontend_vue/src/services/mocks/orders.ts | 2358 | — | `assertDeletable` | 2359,2373,2395,2462 | отдано глазам | токен найден многократно |
| 99 | 449 | frontend_vue/src/services/mocks/orders.ts | 2385 | — | `assertDeletable` | 2359,2373,2395,2462 | отдано глазам | токен найден многократно |
| 100 | 450 | frontend_vue/src/services/mocks/orders.ts | 2354 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 101 | 453 | frontend_vue/src/services/mocks/orders.ts | 2367 | — | `syncShortages` | 2219,2292,2382,3032 | отдано глазам | токен найден многократно |
| 102 | 454 | roo_code/plans/orders/orders-backend-contract.md | 140 | — | `syncShortages` | — | отдано глазам | токен не найден |
| 103 | 458 | frontend_vue/src/composables/useOrderCard.ts | 246-250 | — | `serverLineId` | 252,455,470,479,495,508 | отдано глазам | токен найден многократно |
| 104 | 458 | frontend_vue/src/composables/useOrderCard.ts | 507 | — | `serverLineId` | 252,455,470,479,495,508 | отдано глазам | токен найден многократно |
| 105 | 474 | frontend_vue/src/services/mocks/orders.ts | 2789 | — | `oi-N` | — | отдано глазам | токен не найден |
| 106 | 474 | frontend_vue/src/services/mocks/orders.ts | 2799 | — | `oi-N` | — | отдано глазам | токен не найден |
| 107 | 476 | frontend_vue/src/services/mocks/orders.ts | 2774 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 108 | 477 | frontend_vue/src/services/mocks/orders.ts | 2776 | — | `ORDER_ITEM_NOT_FOUND` | 2241,2371,2637,2791,3124,3709 | отдано глазам | токен найден многократно |
| 109 | 477 | frontend_vue/src/services/mocks/orders.ts | 2777 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 110 | 501 | frontend_vue/src/services/mocks/orders.ts | 2626 | — | `reason` | 655,881,1028,1101,1230,1238 | отдано глазам | токен найден многократно |
| 111 | 507 | frontend_vue/src/services/mocks/orders.ts | 2618 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 112 | 508 | frontend_vue/src/services/mocks/orders.ts | 2622 | — | `ORDER_ITEM_NOT_FOUND` | 2241,2371,2637,2791,3124,3709 | отдано глазам | токен найден многократно |
| 113 | 508 | frontend_vue/src/services/mocks/orders.ts | 2623 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 114 | 509 | frontend_vue/src/services/mocks/orders.ts | 2627 | — | `CORRECTION_REASON_REQUIRED` | 2642,4318,4820 | отдано глазам | токен найден многократно |
| 115 | 509 | frontend_vue/src/services/mocks/orders.ts | 2629 | — | `CORRECTION_NEEDS_CHANGE` | 2644,4821 | отдано глазам | токен найден многократно |
| 116 | 509 | frontend_vue/src/services/mocks/orders.ts | 2631 | — | `FORBIDDEN_CORRECTION` | — | отдано глазам | токен не найден |
| 117 | 509 | frontend_vue/src/services/mocks/orders.ts | 1858 | — | `FORBIDDEN_CORRECTION` | — | отдано глазам | токен не найден |
| 118 | 510 | frontend_vue/src/services/mocks/orders.ts | 2637 | — | `LINE_NOT_FROZEN` | 2652,4801 | отдано глазам | токен найден многократно |
| 119 | 510 | frontend_vue/src/services/mocks/orders.ts | 2686 | — | `INVOICE_ALREADY_CORRECTED` | 2701,4325,4802 | отдано глазам | токен найден многократно |
| 120 | 514 | frontend_vue/src/services/mocks/orders.ts | 2689-2731 | — | `validateLine` | 39,185,2029,2210,2244,2310 | отдано глазам | токен найден многократно |
| 121 | 516 | roo_code/plans/orders/orders-backend-contract.md | 187-193 | — | `validateLine` | — | отдано глазам | токен не найден |
| 122 | 539 | frontend_vue/src/services/mocks/orders.ts | 2540-2543 | — | `requestedGross` | 2567,2598 | отдано глазам | токен найден многократно |
| 123 | 541 | frontend_vue/src/services/mocks/orders.ts | 2558 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 124 | 542 | frontend_vue/src/services/mocks/orders.ts | 2559 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 125 | 542 | frontend_vue/src/services/mocks/orders.ts | 2575 | — | `ALLOCATION_LINE_NOT_FOUND` | 2590,4787 | отдано глазам | токен найден многократно |
| 126 | 567 | frontend_vue/src/services/mocks/orders.ts | 2415 | — | `serviceEntry` | 374,492,2430 | отдано глазам | токен найден многократно |
| 127 | 567 | frontend_vue/src/services/mocks/orders.ts | 378 | — | `serviceEntry` | 374,492,2430 | отдано глазам | токен найден многократно |
| 128 | 571 | frontend_vue/src/services/mocks/orders.ts | 2403 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 129 | 572 | frontend_vue/src/services/mocks/orders.ts | 2404-2408 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 130 | 572 | frontend_vue/src/services/mocks/orders.ts | 2412 | — | `ZERO_QUANTITY` | 2133,2427,4817 | отдано глазам | токен найден многократно |
| 131 | 573 | frontend_vue/src/services/mocks/orders.ts | 376 | — | `CATALOG_SERVICE_NOT_FOUND` | 379,4782 | отдано глазам | токен найден многократно |
| 132 | 574 | frontend_vue/src/services/mocks/orders.ts | 373-375 | — | `ORDER_SERVICE_NOT_FOUND` | 376,2306,2461,4784 | отдано глазам | токен найден многократно |
| 133 | 597 | frontend_vue/src/services/orderLineEdits.ts | 253 | — | `manualUnitCost` | 87,100,123,210,213,242 | отдано глазам | токен найден многократно |
| 134 | 599 | frontend_vue/src/services/orderLineEdits.ts | 80-86 | — | `manualUnitCost` | 87,100,123,210,213,242 | отдано глазам | токен найден многократно |
| 135 | 599 | frontend_vue/src/services/orderLineEdits.ts | 94 | — | `manualUnitCost` | 87,100,123,210,213,242 | отдано глазам | токен найден многократно |
| 136 | 599 | frontend_vue/src/services/orderLineEdits.ts | 96 | — | `manualUnitCost` | 87,100,123,210,213,242 | отдано глазам | токен найден многократно |
| 137 | 600 | frontend_vue/src/services/orderLineEdits.ts | 112 | — | `RESET_COST_NOT_SUPPORTED` | 113,319 | отдано глазам | токен найден многократно |
| 138 | 607 | frontend_vue/src/services/mocks/orders.ts | 2289 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 139 | 608 | frontend_vue/src/services/mocks/orders.ts | 2291 | — | `ORDER_SERVICE_NOT_FOUND` | 376,2306,2461,4784 | отдано глазам | токен найден многократно |
| 140 | 609 | frontend_vue/src/services/mocks/orders.ts | 2294 | — | `validateLineEdit` | 2029,2244,2310 | отдано глазам | токен найден многократно |
| 141 | 609 | frontend_vue/src/services/mocks/orders.ts | 2307 | — | `FORBIDDEN_MANUALCOST` | 2003 | отдано глазам | токен найден не на строке ссылки |
| 142 | 624 | frontend_vue/src/services/mocks/orders.ts | 2445 | 2460 | `order.services.findIndex((s) => s.id === serviceId)` | 2460 | поправлена | — |
| 143 | 630 | frontend_vue/src/services/mocks/orders.ts | 2446 | — | `ORDER_SERVICE_NOT_FOUND` | 376,2306,2461,4784 | отдано глазам | токен найден многократно |
| 144 | 631 | frontend_vue/src/services/mocks/orders.ts | 2447 | — | `assertDeletable` | 2359,2373,2395,2462 | отдано глазам | токен найден многократно |
| 145 | 631 | frontend_vue/src/services/mocks/orders.ts | 2385 | — | `assertDeletable` | 2359,2373,2395,2462 | отдано глазам | токен найден многократно |
| 146 | 631 | frontend_vue/src/services/mocks/orders.ts | 2444 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 147 | 633 | frontend_vue/src/types/order.ts | 158-160 | — | `shippedQuantity` | 118,120,158,179,333 | отдано глазам | номер уже верен |
| 148 | 658 | frontend_vue/src/services/mocks/orders.ts | 3849 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 149 | 660 | frontend_vue/src/services/mocks/orders.ts | 3904 | — | `computeAvailable` | 53,3202,3504,3919 | отдано глазам | токен найден многократно |
| 150 | 663 | frontend_vue/src/services/mocks/orders.ts | 3906 | — | `exceptLine` | 2957,2985,3182,3204,3894 | отдано глазам | токен найден многократно |
| 151 | 668 | frontend_vue/src/services/mocks/orders.ts | 3929 | — | — | — | отдано глазам | токена рядом нет |
| 152 | 686 | frontend_vue/src/services/mocks/reservations.ts | 1-14 | — | `ApiResponse<StockReservation[]>` | — | отдано глазам | токен не найден |
| 153 | 710 | frontend_vue/src/services/mocks/orders.ts | 3251 | — | `ShipmentPlanLine.offerable` | 3250 | отдано глазам | токен найден не на строке ссылки |
| 154 | 711 | frontend_vue/src/services/mocks/orders.ts | 3186-3197 | — | `ShipmentPlanLine.offerable` | 3250 | отдано глазам | токен вне диапазона |
| 155 | 712 | frontend_vue/src/services/mocks/orders.ts | 3226-3235 | — | `wholePieces` | 3148,3151,3152,3177,3267 | отдано глазам | токен найден многократно |
| 156 | 716 | frontend_vue/src/services/mocks/orders.ts | 3241 | — | `unshippedLines` | 1753,1772,1785,1824,3255 | отдано глазам | токен найден многократно |
| 157 | 717 | frontend_vue/src/services/mocks/orders.ts | 1743-1749 | — | `unshippedLines` | 1753,1772,1785,1824,3255 | отдано глазам | токен найден многократно |
| 158 | 720 | frontend_vue/src/services/mocks/orders.ts | 3242-3254 | — | `mockPlanOrderShipment` | 994,1180,3252 | отдано глазам | номер уже верен |
| 159 | 740 | — | 295 | — | ` (` | — | отдано глазам | файл не назван |
| 160 | 741 | — | 289-293 | — | ` (` | — | отдано глазам | файл не назван |
| 161 | 744 | frontend_vue/src/services/mocks/orders.ts | 3305 | — | `ApiResponse<Shipment>` | — | отдано глазам | токен не найден |
| 162 | 745 | frontend_vue/src/services/mocks/orders.ts | 3310 | — | `null` | 165,166,220,337,545,557 | отдано глазам | токен найден многократно |
| 163 | 745 | frontend_vue/src/services/mocks/orders.ts | 3329 | — | `null` | 165,166,220,337,545,557 | отдано глазам | токен найден многократно |
| 164 | 747 | frontend_vue/src/services/mocks/orders.ts | 3271 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 165 | 748 | frontend_vue/src/services/mocks/orders.ts | 3272 | — | `SHIPMENT_HAS_NO_LINES` | 3287,4825 | отдано глазам | токен найден многократно |
| 166 | 748 | frontend_vue/src/services/mocks/orders.ts | 3276 | — | `SHIPMENT_EXCEEDS_STOCK` | 3291,3308,4826 | отдано глазам | токен найден многократно |
| 167 | 748 | frontend_vue/src/services/mocks/orders.ts | 3293 | — | `SHIPMENT_EXCEEDS_STOCK` | 3291,3308,4826 | отдано глазам | токен найден многократно |
| 168 | 749 | frontend_vue/src/services/mocks/orders.ts | 3109 | — | `ORDER_ITEM_NOT_FOUND` | 2241,2371,2637,2791,3124,3709 | отдано глазам | токен найден многократно |
| 169 | 749 | frontend_vue/src/services/mocks/orders.ts | 3115 | — | `DUPLICATE_SHIPMENT_LINE` | 3130,4822 | отдано глазам | токен найден многократно |
| 170 | 750 | frontend_vue/src/services/mocks/orders.ts | 3122 | — | `SHIPMENT_QUANTITY_MUST_BE_POSITIVE` | 3137,4823 | отдано глазам | токен найден многократно |
| 171 | 750 | frontend_vue/src/services/mocks/orders.ts | 3124 | — | `SHIPMENT_EXCEEDS_REMAINING` | 3139,4824 | отдано глазам | токен найден многократно |
| 172 | 756 | frontend_vue/src/services/mocks/orders.ts | 3279-3294 | — | `offcutId` | 473,920,1349,2114,2157,2962 | отдано глазам | токен найден многократно |
| 173 | 756 | frontend_vue/src/services/mocks/orders.ts | 3340 | — | `offcutId` | 473,920,1349,2114,2157,2962 | отдано глазам | токен найден многократно |
| 174 | 757 | roo_code/plans/orders/orders-backend-contract.md | 222-227 | — | `offcutId` | 138,228,414 | отдано глазам | токен найден многократно |
| 175 | 760 | roo_code/plans/orders/orders-backend-contract.md | 225 | — | `releaseFromLineOnBatches` | — | отдано глазам | токен не найден |
| 176 | 806 | frontend_vue/src/services/mocks/orders.ts | 3505 | — | `cancelled: true` | — | отдано глазам | токен не найден |
| 177 | 808 | frontend_vue/src/services/mocks/orders.ts | 3376 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 178 | 809 | frontend_vue/src/services/mocks/orders.ts | 3378 | — | `SHIPMENT_NOT_FOUND` | 3393,4369,4788 | отдано глазам | токен найден многократно |
| 179 | 809 | frontend_vue/src/services/mocks/orders.ts | 3379 | — | `SHIPMENT_ALREADY_CANCELLED` | 3394,4803 | отдано глазам | токен найден многократно |
| 180 | 810 | frontend_vue/src/services/mocks/orders.ts | 3386 | — | `SHIPMENT_ALREADY_INVOICED` | 3401,4375,4804 | отдано глазам | токен найден многократно |
| 181 | 811 | frontend_vue/src/services/mocks/orders.ts | 3390 | — | `FORBIDDEN_CORRECTION` | — | отдано глазам | токен не найден |
| 182 | 811 | frontend_vue/src/services/mocks/orders.ts | 1858 | — | `FORBIDDEN_CORRECTION` | — | отдано глазам | токен не найден |
| 183 | 811 | frontend_vue/src/services/mocks/orders.ts | 3403 | — | `SHIPMENT_BATCH_NOT_FOUND` | 3418,4789 | отдано глазам | токен найден многократно |
| 184 | 814 | frontend_vue/src/services/mocks/orders.ts | 3451-3463 | — | — | — | отдано глазам | токена рядом нет |
| 185 | 820 | frontend_vue/src/services/mocks/orders.ts | 3504 | — | — | — | отдано глазам | токена рядом нет |
| 186 | 838 | frontend_vue/src/services/mocks/orders.ts | 3647 | 3662 | `returnable > 0` | 3662 | поправлена | — |
| 187 | 839 | frontend_vue/src/services/mocks/orders.ts | 3638 | — | `order.items` | 172,180,197,220,236,238 | отдано глазам | токен найден многократно |
| 188 | 858 | — | 352 | — | ` (` | — | отдано глазам | файл не назван |
| 189 | 863 | frontend_vue/src/services/mocks/orders.ts | 3752 | — | `restored` | 3570,3571,3767 | отдано глазам | токен найден многократно |
| 190 | 863 | frontend_vue/src/services/mocks/orders.ts | 3813 | — | `restored` | 3570,3571,3767 | отдано глазам | токен найден многократно |
| 191 | 865 | frontend_vue/src/services/mocks/orders.ts | 3674 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 192 | 866 | frontend_vue/src/services/mocks/orders.ts | 3677 | — | `RETURN_REASON_REQUIRED` | 3692,4827 | отдано глазам | токен найден многократно |
| 193 | 866 | frontend_vue/src/services/mocks/orders.ts | 3678 | — | `RETURN_HAS_NO_LINES` | 3693,4828 | отдано глазам | токен найден многократно |
| 194 | 867 | frontend_vue/src/services/mocks/orders.ts | 3682 | — | `DUPLICATE_RETURN_LINE` | 3697,4829 | отдано глазам | токен найден многократно |
| 195 | 867 | frontend_vue/src/services/mocks/orders.ts | 3686 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 196 | 867 | frontend_vue/src/services/mocks/orders.ts | 3687 | — | `RETURN_QUANTITY_MUST_BE_POSITIVE` | 3702,4830 | отдано глазам | токен найден многократно |
| 197 | 868 | frontend_vue/src/services/mocks/orders.ts | 3694 | — | `ORDER_ITEM_NOT_FOUND` | 2241,2371,2637,2791,3124,3709 | отдано глазам | токен найден многократно |
| 198 | 868 | frontend_vue/src/services/mocks/orders.ts | 3696 | — | `RETURN_EXCEEDS_SHIPPED` | 3711,4831 | отдано глазам | токен найден многократно |
| 199 | 869 | frontend_vue/src/services/mocks/orders.ts | 3704 | — | `RETURN_BATCH_NOT_FOUND` | 3719,3736,4790 | отдано глазам | токен найден многократно |
| 200 | 869 | frontend_vue/src/services/mocks/orders.ts | 3721 | — | `RETURN_BATCH_NOT_FOUND` | 3719,3736,4790 | отдано глазам | токен найден многократно |
| 201 | 869 | frontend_vue/src/services/mocks/orders.ts | 3721 | — | `RETURN_SPLITS_OFFCUT` | 3736,4832 | отдано глазам | токен найден многократно |
| 202 | 874 | frontend_vue/src/services/mocks/orders.ts | 3786-3787 | — | `write-off` | 290,2834,3249,3337,3788,3802 | отдано глазам | токен найден многократно |
| 203 | 876 | roo_code/plans/orders/orders-backend-contract.md | 256 | — | `write-off` | 79,256 | отдано глазам | номер уже верен |
| 204 | 881 | frontend_vue/src/services/mocks/orders.ts | 3807 | — | `mockCreateInvoice` | 762,786,1220,1250,2738,3426 | отдано глазам | токен найден многократно |
| 205 | 923 | frontend_vue/src/services/mocks/orders.ts | 4471 | — | `). **Обе суммы сразу — отказ** (` | — | отдано глазам | токен-образец |
| 206 | 924 | frontend_vue/src/services/mocks/orders.ts | 4448-4465 | — | `). **Обе суммы сразу — отказ** (` | — | отдано глазам | токен-образец |
| 207 | 924 | frontend_vue/src/services/mocks/orders.ts | 4382 | — | `). **Обе суммы сразу — отказ** (` | — | отдано глазам | токен-образец |
| 208 | 928 | frontend_vue/src/services/mocks/orders.ts | 4393 | — | `withdrawsOriginal` | 4350,4352,4408,4434 | отдано глазам | токен найден многократно |
| 209 | 928 | frontend_vue/src/services/mocks/orders.ts | 4337 | — | `withdrawsOriginal` | 4350,4352,4408,4434 | отдано глазам | токен найден многократно |
| 210 | 930 | frontend_vue/src/services/mocks/orders.ts | 4219-4223 | — | `unbilledServices` | 4234,4299,4437 | отдано глазам | токен найден многократно |
| 211 | 932 | frontend_vue/src/services/mocks/orders.ts | 4270 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 212 | 933 | frontend_vue/src/services/mocks/orders.ts | 4292 | — | `INVOICE_NEEDS_SHIPMENT` | 4307,4836 | отдано глазам | токен найден многократно |
| 213 | 933 | frontend_vue/src/services/mocks/orders.ts | 4296 | — | `ADVANCE_HAS_NO_SHIPMENT` | 4311,4837 | отдано глазам | токен найден многократно |
| 214 | 934 | frontend_vue/src/services/mocks/orders.ts | 4300 | — | `CORRECTION_NEEDS_ORIGINAL` | 4315,4838 | отдано глазам | токен найден многократно |
| 215 | 934 | frontend_vue/src/services/mocks/orders.ts | 4303 | — | `CORRECTION_REASON_REQUIRED` | 2642,4318,4820 | отдано глазам | токен найден многократно |
| 216 | 935 | frontend_vue/src/services/mocks/orders.ts | 4305 | — | `ORIGINAL_INVOICE_NOT_FOUND` | 4320,4793 | отдано глазам | токен найден многократно |
| 217 | 935 | frontend_vue/src/services/mocks/orders.ts | 4307 | — | `CANNOT_CORRECT_A_CORRECTION` | 4322,4806 | отдано глазам | токен найден многократно |
| 218 | 936 | frontend_vue/src/services/mocks/orders.ts | 4310 | — | `INVOICE_ALREADY_CORRECTED` | 2701,4325,4802 | отдано глазам | токен найден многократно |
| 219 | 936 | frontend_vue/src/services/mocks/orders.ts | 4328 | — | `CORRECTION_EXCEEDS_ORIGINAL` | 4343,4840 | отдано глазам | токен найден многократно |
| 220 | 937 | frontend_vue/src/services/mocks/orders.ts | 4331 | — | `CORRECTION_NEEDS_KIND` | 4346,4839 | отдано глазам | токен найден многократно |
| 221 | 937 | frontend_vue/src/services/mocks/orders.ts | 4354 | — | `SHIPMENT_NOT_FOUND` | 3393,4369,4788 | отдано глазам | токен найден многократно |
| 222 | 937 | frontend_vue/src/services/mocks/orders.ts | 4356 | — | `SHIPMENT_CANCELLED` | 4371,4805 | отдано глазам | токен найден многократно |
| 223 | 938 | frontend_vue/src/services/mocks/orders.ts | 4360 | — | `SHIPMENT_ALREADY_INVOICED` | 3401,4375,4804 | отдано глазам | токен найден многократно |
| 224 | 938 | frontend_vue/src/services/mocks/orders.ts | 4375 | — | `INVOICE_AMOUNT_REQUIRED` | 4390,4841 | отдано глазам | токен найден многократно |
| 225 | 939 | frontend_vue/src/services/mocks/orders.ts | 4471 | — | `INVOICE_AMOUNT_AMBIGUOUS` | 4486,4842 | отдано глазам | токен найден многократно |
| 226 | 942 | frontend_vue/src/services/mocks/orders.ts | 4286-4291 | — | — | — | отдано глазам | токена рядом нет |
| 227 | 952 | frontend_vue/src/composables/useOrderCard.ts | 1110 | — | — | — | отдано глазам | токена рядом нет |
| 228 | 953 | frontend_vue/src/composables/useOrderCard.ts | 1131 | — | — | — | отдано глазам | токена рядом нет |
| 229 | 987 | frontend_vue/src/services/ordersService.ts | 386 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 230 | 990 | frontend_vue/src/services/mocks/orders.ts | 3972 | — | `refund` | 1030,1269,1275,3594,3981,3987 | отдано глазам | токен найден многократно |
| 231 | 991 | frontend_vue/src/services/mocks/orders.ts | 3967-3971 | — | `refund` | 1030,1269,1275,3594,3981,3987 | отдано глазам | токен найден многократно |
| 232 | 993 | frontend_vue/src/services/mocks/orders.ts | 3960 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 233 | 994 | frontend_vue/src/services/mocks/orders.ts | 3964 | — | `NUMBER_NOT_FINITE` | 1988,4814 | отдано глазам | токен найден многократно |
| 234 | 994 | frontend_vue/src/services/mocks/orders.ts | 3965 | — | `PAYMENT_AMOUNT_REQUIRED` | 3980,4833 | отдано глазам | токен найден многократно |
| 235 | 995 | frontend_vue/src/services/mocks/orders.ts | 3966 | — | `REFUND_MUST_BE_NEGATIVE` | 3981,4834 | отдано глазам | токен найден многократно |
| 236 | 995 | frontend_vue/src/services/mocks/orders.ts | 3979 | — | `REFUND_INVOICE_REQUIRED` | 3994,4835 | отдано глазам | токен найден многократно |
| 237 | 995 | frontend_vue/src/services/mocks/orders.ts | 3983 | — | `PAYMENT_INVOICE_NOT_FOUND` | 3998,4792 | отдано глазам | токен найден многократно |
| 238 | 1000 | frontend_vue/src/services/mocks/orders.ts | 4069-4074 | — | `invoiceId` | 704,757,768,844,861,957 | отдано глазам | токен найден многократно |
| 239 | 1002 | — | 3990 | — | `paidAt` | — | отдано глазам | файл не назван |
| 240 | 1039 | frontend_vue/src/services/mocks/orders.ts | 4015 | — | `PAYMENT_NOT_FOUND` | 4030,4791 | отдано глазам | токен найден многократно |
| 241 | 1040 | frontend_vue/src/services/mocks/orders.ts | 4013 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 242 | 1043 | frontend_vue/src/services/mocks/orders.ts | 3979 | — | — | — | отдано глазам | токена рядом нет |
| 243 | 1068 | frontend_vue/src/composables/useOrderCard.ts | 1621-1631 | — | `OrderFile` | 17,18,521,526 | отдано глазам | токен найден многократно |
| 244 | 1071 | frontend_vue/src/services/mocks/orders.ts | 2497 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 245 | 1073 | frontend_vue/src/services/mocks/orders.ts | 2500 | — | `File N` | — | отдано глазам | токен не найден |
| 246 | 1097 | frontend_vue/src/services/mocks/orders.ts | 2530 | — | `ORDER_FILE_NOT_FOUND` | 2545,4786 | отдано глазам | токен найден многократно |
| 247 | 1098 | frontend_vue/src/services/mocks/orders.ts | 2520 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 248 | 1102 | roo_code/plans/orders/orders-backend-contract.md | 101 | — | — | — | отдано глазам | токена рядом нет |
| 249 | 1105 | frontend_vue/src/composables/useOrderCard.ts | 524-527 | — | `pendingFileRemoves` | 186,262,525,526,528,565 | отдано глазам | номер уже верен |
| 250 | 1122 | frontend_vue/src/services/mocks/orders.ts | 1919-1927 | — | `If-Match` | — | отдано глазам | токен не найден |
| 251 | 1129 | frontend_vue/src/services/mocks/orders.ts | 2479 | — | `ORDER_AUDIT_ENTRY_NOT_FOUND` | 2494,4785 | отдано глазам | токен найден многократно |
| 252 | 1130 | frontend_vue/src/services/mocks/orders.ts | 2477 | — | `ORDER_VERSION_CONFLICT` | 1950,4795 | отдано глазам | токен найден многократно |
| 253 | 1136 | frontend_vue/src/services/auditFeedService.ts | 41 | — | — | — | отдано глазам | токена рядом нет |
| 254 | 1148 | frontend_vue/src/services/mocks/orders.ts | 1634 | — | `'EUR'` | 595,1648 | отдано глазам | токен найден многократно |
| 255 | 1148 | frontend_vue/src/services/mocks/orders.ts | 1637 | — | `'EUR'` | 595,1648 | отдано глазам | токен найден многократно |
| 256 | 1148 | frontend_vue/src/services/mocks/orders.ts | 1638 | — | `'EUR'` | 595,1648 | отдано глазам | токен найден многократно |
| 257 | 1164 | frontend_vue/src/services/mocks/orders.ts | 3929 | — | `notifyWarehouseReady` | 125,3944 | отдано глазам | токен найден многократно |
| 258 | 1165 | frontend_vue/src/services/mocks/orders.ts | 4001 | — | `notifyPaymentReceived` | 124,4016 | отдано глазам | токен найден многократно |
| 259 | 1168 | — | 123-125 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 260 | 1168 | — | 1837 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 261 | 1168 | — | 3929 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 262 | 1168 | — | 4001 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 263 | 1169 | — | 1679 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 264 | 1169 | — | 3356 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 265 | 1169 | — | 3504 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 266 | 1169 | — | 3836 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 267 | 1170 | — | 4444 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 268 | 1170 | — | 2733 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 269 | 1170 | — | 2074 | — | `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` | — | отдано глазам | файл не назван |
| 270 | 1180 | frontend_vue/src/services/mocks/orders.ts | 1879 | — | `au-N` | — | отдано глазам | токен не найден |
| 271 | 1180 | frontend_vue/src/services/mocks/orders.ts | 145-151 | — | `au-N` | — | отдано глазам | токен не найден |
| 272 | 1181 | frontend_vue/src/services/mocks/orders.ts | 1880 | — | `au-N` | — | отдано глазам | токен не найден |
| 273 | 1181 | frontend_vue/src/services/mocks/orders.ts | 1866-1872 | — | `au-N` | — | отдано глазам | токен не найден |
| 274 | 1182 | frontend_vue/src/services/mocks/orders.ts | 1827 | — | `au-N` | — | отдано глазам | токен не найден |
| 275 | 1183 | frontend_vue/src/services/mocks/orders.ts | 1896-1913 | — | `recordInHistory` | 1906,2271,2334,2710,2725,3457 | отдано глазам | номер уже верен |
| 276 | 1183 | frontend_vue/src/services/mocks/orders.ts | 1905 | — | `recordInHistory` | 1906,2271,2334,2710,2725,3457 | отдано глазам | токен найден многократно |
| 277 | 1187 | — | 2256 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 278 | 1188 | — | 2319 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 279 | 1188 | — | 2695 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 280 | 1188 | — | 2710 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 281 | 1189 | — | 3442 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 282 | 1189 | — | 3817 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 283 | 1190 | — | 1827 | — | `grep -n "recordInHistory(" …` | — | отдано глазам | файл не назван |
| 284 | 1193 | — | 1847-1853 | — | `actingUser()` | — | отдано глазам | файл не назван |
| 285 | 1209 | frontend_vue/src/types/order.ts | 496 | — | `notes` | 494 | отдано глазам | токен найден не на строке ссылки |
| 286 | 1231 | frontend_vue/src/services/ordersService.ts | 295 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 287 | 1231 | frontend_vue/src/services/ordersService.ts | 352 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 288 | 1231 | frontend_vue/src/services/ordersService.ts | 386 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 289 | 1239 | frontend_vue/src/services/mocks/orders.ts | 1998 | — | `refuseStatedCost` | 2006,2134,2136 | отдано глазам | токен найден многократно |
| 290 | 1240 | frontend_vue/src/services/mocks/orders.ts | 2237 | — | `PATCH /items/:id` | 870,2313 | отдано глазам | токен найден многократно |
| 291 | 1240 | frontend_vue/src/services/mocks/orders.ts | 2307 | — | `PATCH /services/:id` | — | отдано глазам | токен не найден |
| 292 | 1240 | frontend_vue/src/services/mocks/orders.ts | 2631 | — | `POST /items/:id/correct` | — | отдано глазам | токен не найден |
| 293 | 1241 | frontend_vue/src/services/mocks/orders.ts | 3390 | — | `POST /shipments/:id/cancel` | — | отдано глазам | токен не найден |
| 294 | 1242 | frontend_vue/src/services/mocks/orders.ts | 1847-1853 | — | `POST /shipments/:id/cancel` | — | отдано глазам | токен не найден |
| 295 | 1244 | — | 1384-1386 | — | `seeCost` | — | отдано глазам | файл не назван |
| 296 | 1249 | frontend_vue/src/router/index.ts | 156 | — | `adminOrders` | 151,157,163 | отдано глазам | токен найден многократно |
| 297 | 1249 | frontend_vue/src/router/index.ts | 162 | — | `adminOrders` | 151,157,163 | отдано глазам | токен найден многократно |
| 298 | 1257 | frontend_vue/src/services/ordersService.ts | 352 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 299 | 1257 | frontend_vue/src/services/ordersService.ts | 386 | — | `Idempotency-Key` | 298,317,360,394 | отдано глазам | токен найден многократно |
| 300 | 1258 | frontend_vue/src/services/mocks/index.ts | 1030-1057 | — | `withIdempotency` | 321,1041,1048,1056,1063,1143 | отдано глазам | номер уже верен |
| 301 | 1280 | frontend_vue/src/services/mocks/orders.ts | 1823 | — | — | — | отдано глазам | токена рядом нет |
| 302 | 1280 | frontend_vue/src/services/mocks/orders.ts | 1826 | — | — | — | отдано глазам | токена рядом нет |
| 303 | 1280 | frontend_vue/src/services/mocks/orders.ts | 2723 | — | — | — | отдано глазам | токена рядом нет |
| 304 | 1280 | frontend_vue/src/services/mocks/orders.ts | 2733 | — | — | — | отдано глазам | токена рядом нет |
| 305 | 1281 | frontend_vue/src/services/mocks/orders.ts | 3807 | — | — | — | отдано глазам | токена рядом нет |
| 306 | 1281 | frontend_vue/src/services/mocks/orders.ts | 3836 | — | — | — | отдано глазам | токена рядом нет |
| 307 | 1281 | frontend_vue/src/services/mocks/orders.ts | 3413 | — | — | — | отдано глазам | токена рядом нет |
| 308 | 1281 | frontend_vue/src/services/mocks/orders.ts | 3504 | — | — | — | отдано глазам | токена рядом нет |
| 309 | 1282 | frontend_vue/src/services/mocks/orders.ts | 4424 | — | — | — | отдано глазам | токена рядом нет |
| 310 | 1282 | frontend_vue/src/services/mocks/orders.ts | 4444 | — | — | — | отдано глазам | токена рядом нет |
| 311 | 1291 | frontend_vue/src/services/mocks/orders.ts | 205-215 | — | `recalcOrder` | 179,505,631,634,1286,1738 | отдано глазам | токен найден многократно |
| 312 | 1292 | frontend_vue/src/services/mocks/orders.ts | 185 | — | `recalcOrder` | 179,505,631,634,1286,1738 | отдано глазам | токен найден многократно |
| 313 | 1293 | frontend_vue/src/services/mocks/orders.ts | 220-225 | — | `totalWeight` | 222,506,605,1658,1714,1729 | отдано глазам | номер уже верен |
| 314 | 1298 | frontend_vue/src/services/mocks/orders.ts | 1497 | — | `shippedPercent` | 235,1417,1500 | отдано глазам | токен найден многократно |
| 315 | 1298 | frontend_vue/src/services/mocks/orders.ts | 235-240 | — | `shippedPercent` | 235,1417,1500 | отдано глазам | номер уже верен |
| 316 | 1299 | frontend_vue/src/services/mocks/orders.ts | 1562 | — | `totalPages` | 1462,1565 | отдано глазам | токен найден многократно |
| 317 | 1301 | frontend_vue/src/services/mocks/orders.ts | 1373 | 1376 | `costTopUp` | 1376 | поправлена | — |
| 318 | 1301 | frontend_vue/src/services/mocks/orders.ts | 2938-2953 | — | `costTopUp` | 1376 | отдано глазам | токен вне диапазона |
| 319 | 1304 | frontend_vue/src/services/mocks/orders.ts | 4734-4740 | — | `orderReceivables` | 4725 | отдано глазам | токен вне диапазона |
| 320 | 1310 | frontend_vue/src/services/mocks/orders.ts | 1628 | — | `receivableDueDate(invoice.issuedAt, order.clientPaymentTermsDays)` | 4736 | отдано глазам | токен найден не на строке ссылки |
| 321 | 1328 | frontend_vue/src/types/order.ts | 176 | — | `grep -c "namedUnitPrice" roo_code/plans/orders/orders-backend-contract.md` | — | отдано глазам | токен не найден |
| 322 | 1329 | frontend_vue/src/types/order.ts | 107-113 | — | `manualUnitPrice` | 106,111,174 | отдано глазам | номер уже верен |
| 323 | 1334 | frontend_vue/src/services/mocks/index.ts | 574 | 691 | `ship-plan` | 691 | поправлена | — |
| 324 | 1334 | frontend_vue/src/services/mocks/index.ts | 579 | — | `shipments` | 696,1140,1155,1164 | отдано глазам | токен найден многократно |
| 325 | 1334 | frontend_vue/src/services/mocks/index.ts | 586 | 703 | `return-plan` | 703 | поправлена | — |
| 326 | 1335 | frontend_vue/src/services/mocks/index.ts | 591 | — | `returns` | 406,708,1180,1888 | отдано глазам | токен найден многократно |
| 327 | 1335 | frontend_vue/src/services/mocks/index.ts | 596 | — | `payments` | 713,944,948,1156,1171,1574 | отдано глазам | токен найден многократно |
| 328 | 1335 | frontend_vue/src/services/mocks/index.ts | 601 | — | `invoices` | 650,718,1195 | отдано глазам | токен найден многократно |
| 329 | 1335 | frontend_vue/src/services/mocks/index.ts | 606 | 723 | `reservations` | 723 | поправлена | — |
| 330 | 1336 | frontend_vue/src/services/mocks/index.ts | 611 | — | `reservations` | 723 | отдано глазам | токен найден не на строке ссылки |
| 331 | 1336 | frontend_vue/src/services/mocks/index.ts | 584-585 | — | `reservations` | 723 | отдано глазам | токен вне диапазона |
| 332 | 1344 | frontend_vue/src/services/mocks/orders.ts | 1355-1357 | — | `STORE` | 107,251,337,439,971,986 | отдано глазам | токен найден многократно |
| 333 | 1344 | frontend_vue/src/services/mocks/orders.ts | 1615-1617 | — | `STORE` | 107,251,337,439,971,986 | отдано глазам | токен найден многократно |
| 334 | 1350 | frontend_vue/src/services/mocks/orders.ts | 156-162 | — | `mockCreateShipment` | 1004,1190,1830,3272,3668 | отдано глазам | токен найден многократно |
| 335 | 1350 | frontend_vue/src/services/mocks/orders.ts | 4524 | — | `mockCreateReturn` | 3672,4532,4558 | отдано глазам | токен найден многократно |
| 336 | 1351 | frontend_vue/src/services/mocks/orders.ts | 4515-4523 | — | `mockCreateReturn` | 3672,4532,4558 | отдано глазам | токен найден многократно |
| 337 | 1351 | frontend_vue/src/services/mocks/orders.ts | 4578 | — | `seedQuietly` | 126,4588,4593,4682,4689,4691 | отдано глазам | токен найден многократно |
| 338 | 1351 | frontend_vue/src/services/mocks/orders.ts | 4676 | — | `seedQuietly` | 126,4588,4593,4682,4689,4691 | отдано глазам | токен найден многократно |
| 339 | 1353 | frontend_vue/src/services/mocks/orders.ts | 4527-4531 | — | `ORD-100` | 658,1022,1291,4544,4619 | отдано глазам | токен найден многократно |
| 340 | 1353 | frontend_vue/src/services/mocks/orders.ts | 4613 | — | `ORD-100` | 658,1022,1291,4544,4619 | отдано глазам | токен найден многократно |
| 341 | 1374 | frontend_vue/src/services/mocks/orders.ts | 4360 | — | `SHIPMENT_ALREADY_INVOICED` | 3401,4375,4804 | отдано глазам | два пути на строке |
| 342 | 1393 | frontend_vue/src/services/mocks/orders.ts | 1634 | — | `'EUR'` | 595,1648 | отдано глазам | токен найден многократно |
| 343 | 1393 | frontend_vue/src/services/mocks/orders.ts | 1637 | — | `'EUR'` | 595,1648 | отдано глазам | токен найден многократно |
| 344 | 1393 | frontend_vue/src/services/mocks/orders.ts | 1638 | — | `'EUR'` | 595,1648 | отдано глазам | токен найден многократно |
| 345 | 1402 | frontend_vue/src/services/mocks/orders.ts | 3504 | — | — | — | отдано глазам | токена рядом нет |
| 346 | 1402 | frontend_vue/src/services/mocks/orders.ts | 3836 | — | — | — | отдано глазам | токена рядом нет |
| 347 | 1402 | frontend_vue/src/services/mocks/orders.ts | 4444 | — | — | — | отдано глазам | токена рядом нет |

**Итого: 347 строк.** Вердикты: отдано глазам — 341, поправлена — 6.
Сумма вердиктов 6 + 341 = 347 сходится с длиной таблицы 347.

Причины у «отдано глазам»: токен найден многократно — 211 · номер уже верен — 28 · токен не найден — 28 · файл не назван — 28 · токена рядом нет — 27 · токен-образец — 7 · токен найден не на строке ссылки — 6 · токен вне диапазона — 4 · два пути на строке — 2.
Сумма причин 341 сходится с числом строк «отдано глазам» 341.

## Границы этой переписи

- Разбирались только короткие ссылки; полные (`путь:строка`) этой задачей не трогаются.
- Искусственная нагрузка не создавалась, процессы по имени не гасились.
- Новые ссылки с номерами строк не вводились: место в коде называется токеном в бэктиках.
