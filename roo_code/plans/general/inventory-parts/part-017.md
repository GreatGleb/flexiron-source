# Инвентаризация планов — часть 017

## roo_code/plans/orders/3.1-orders-plan.md

**Вердикт: частично** (по существу выполнен; два пункта не сделаны буквально и никогда не будут — см. «Что осталось»)

Незакрытых чекбоксов: **33** (8 в «Pitfalls checklist» из Prompt 15 + 25 в «Final Checklist»).

План сам объявляет себя историческим: домен переписала работа по переоценке заказов
(`order-pricing-frontend-plan.md`, `orders-backend-contract.md`), и типы/статусы в коде
намеренно отличаются от того, что в плане. Проверял не «совпадает ли форма типа с планом»,
а «существует ли и работает ли то, что план требовал создать».

### Доказательство

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/orders/3.1-orders-plan.md
33

$ ls -la frontend_vue/src/views/admin/orders/
AddLineModeChooser.vue        2865
AddOrderItemsModal.vue       33268
AddOrderServicesModal.vue    21302
OrderCardPage.vue           113766
OrderCreatePage.vue          21419
OrdersListPage.vue           18005

$ ls -la frontend_vue/src/types/order.ts            → 23373 байт
$ ls -la frontend_vue/src/services/mocks/orders.ts  → 168276 байт (+ orders.spec.ts 137746)
$ ls -la frontend_vue/src/services/ordersService.ts → 13493 байт
$ ls -la frontend_vue/src/i18n/admin/orders.ts      → 85502 байт
$ ls frontend_vue/src/composables/ | grep -i order
useOrderCard.ts  useOrderCreate.ts  useOrderPermissions.ts  useOrders.ts (+ 6 spec-файлов)
$ ls frontend_vue/src/styles/admin/ | grep -i order
orders_card.css  orders_create.css  orders_list.css
$ ls frontend_vue/tests/e2e/admin/orders/
orders.spec.ts   (2137 строк, 117 вхождений `test(`)

$ grep -n "orders" frontend_vue/src/router/index.ts
147: path: 'orders'          148: name: 'admin-orders'
153: path: 'orders/new'      155: OrderCreatePage.vue   (name: admin-order-create)
159: path: 'orders/:id'      161: OrderCardPage.vue     (name: admin-order-card)
все три с meta.featureFlag = 'adminOrders'

$ grep -n "adminOrders\|orderKanbanView\|orderDocumentGen\|orderCuttingTool" \
    src/config/featureFlags.ts src/types/features.ts tests/e2e/helpers/flags.ts
featureFlags.ts:23 adminOrders: true      :58 orderKanbanView: false
              :59 orderDocumentGen: true  :60 orderCuttingTool: false
features.ts:20 adminOrders  :54 orderKanbanView  :55 orderDocumentGen  :56 orderCuttingTool
flags.ts:31 adminOrders: true  :77 orderKanbanView: true  :78 orderCuttingTool: true  :79 orderDocumentGen: true

$ npm run typecheck   → vue-tsc --noEmit, ни одной ошибки
$ npm run lint        → eslint --max-warnings=0, ни одной ошибки

$ grep -n "TOTAL_ORDERS" src/services/mocks/orders.ts
363: const TOTAL_ORDERS = 100        (STORE: StoreOrder[] = generateOrders(), строка 916)

$ awk '/^  ru: \{/,/^  \},/' src/i18n/admin/orders.ts | grep -cE "^      [a-z_0-9]+:"  → 423
   то же для en → 423, для lt → 423
$ grep -n "adminOrders" src/i18n/admin/index.ts
12: import { adminOrders } from './orders'      65:  adminOrders,

$ grep -n "admin-orders\|side.orders\|layout.orders" src/components/admin/AdminSidebar.vue
35:    route.path.startsWith('/admin/orders'),      ← только подсветка пункта «Продажи и CRM»
   (отдельной ссылки на заказы в сайдбаре нет)
$ grep -n "orders" src/i18n/admin/layout.ts
89:  internal_search: 'Поиск заказов, клиентов...'  ← ключа side.orders нет

$ grep -n "admin-order" src/views/public/ScreensPage.vue
166: { id: '3.2', routeName: 'admin-orders' }        167: { id: '3.2n', 'admin-order-create' }
170: routeName: 'admin-order-card'
   (нумерация 3.2, а не 3.1 — в файле стоит комментарий, что 3.1 занято клиентами)

$ ls toDo/admin-api-contract.md        → No such file or directory
$ grep -n "^## Orders" toDo/archive-admin-api-contract.md   → 332: ## Orders (3.1)
   живой контракт домена: roo_code/plans/orders/orders-backend-contract.md
```

Маршруты мока (`src/services/mocks/index.ts`): GET `/api/orders` и `/api/orders/translated` (534),
`/api/orders/:id` (600); POST `/api/orders` (954), `/items` (1053), `/services` (1063);
PATCH `/:id/status` (1236), `/:id/services/:id` (1245), `/:id/items/:lineId` (1256), `/:id` (1267);
DELETE `/:id/items/:lineId` (1519), `/:id/services/:id` (1539), `/:id` (1549).
Плюс десятки маршрутов, которых в плане нет (shipments, returns, payments, invoices, reserve,
allocate-total, split, correct, files, audit). Не зарегистрирован только `/api/orders/:id/translated`:
регэксп `^\/api\/orders\/([^/]+)$` его не поймает.

Питфоллы: `<!--` внутри `<template>` — 0 во всех трёх страницах; клон в моке — `clone()` =
`JSON.parse(JSON.stringify())` (строка 1266) через `publicOrder()` (1275); `orders.btn_discard`
в модале списка (OrdersListPage:475) против `orders.btn_discard_changes` в сейв-баре карточки
(OrderCardPage:1078); `initialized` в useOrders (27, 30, 36); пустое состояние
`!loading && items.length === 0` (OrdersListPage:194); `@click.stop` на удалении в строке (435).

### Что осталось

1. **Ссылки «Заказы» в сайдбаре нет** и ключа `side.orders` в `layout.ts` нет. Заказы попадают
   под пункт «Продажи и CRM»: `isSalesCrmActive` подсвечивается на `/admin/orders`. То есть
   решение принято сознательно (vue-rules #21 — «Sidebar: only section entry points»), но два
   чекбокса плана буквально не закрыты.
2. **Контракт живёт не там**, куда план велел писать: `toDo/admin-api-contract.md` удалён,
   секция `## Orders (3.1)` осталась в `toDo/archive-admin-api-contract.md:332`, а действующий
   контракт домена — `roo_code/plans/orders/orders-backend-contract.md`.
3. **`/api/orders/:id/translated`** в моке не зарегистрирован (list-вариант — да).
4. **Питфолл #19** («фильтры внутри той же GlassPanel, что таблица») не выполнен буквально:
   фильтры лежат в отдельной панели `.filters-bar` перед GlassPanel — так же, как в
   `ClientsListPage.vue:232`. Общий паттерн приложения разошёлся с текстом скила.
5. **Формы типов и статусы** разошлись с планом, как и написано в шапке плана: `OrderStatus`
   живёт в `src/domain/orderStatus.ts` (15 значений, `new` вместо `draft`, плюс `paid`,
   `completed`, три возвратных и три отказных); `OrderItem` несёт `marginPercent`,
   `manualUnitPrice`, `namedUnitPrice`, `costSource`, `allocations`, `state` (поля `discount`,
   `totalPrice` остались как проекции); `OrderService` вместо `margin` отдаёт `marginAmount`.
6. **Браузерный golden path** не проверял — нужен браузер. Косвенно закрыт e2e-набором
   `tests/e2e/admin/orders/orders.spec.ts` (117 тестов), но я его не запускал.

### Пункты плана

#### Pitfalls checklist (Prompt 15)

| # | Пункт | Вердикт | Доказательство |
|---|---|---|---|
| 1 | #9: no comments inside `<template>` | сделано | `awk '/<template>/,/<\/template>/' … \| grep -c "<!--"` → 0 для всех трёх страниц |
| 2 | #10: route names verified | сделано | router/index.ts:148,154,160 — admin-orders / admin-order-create / admin-order-card |
| 3 | #13: mock returns structuredClone | сделано | mocks/orders.ts:1266 `clone()` = JSON.parse(JSON.stringify), 1275 `publicOrder()`; mockGetOrders → `clone(items)` |
| 4 | #18: save bar btn_discard_changes, modals btn_discard | сделано | OrderCardPage.vue:1078 vs OrdersListPage.vue:475 |
| 5 | #19: filters inside GlassPanel | частично | OrdersListPage.vue:150 `.filters-bar` до GlassPanel (187) — как в ClientsListPage.vue:232 |
| 6 | #20: initialized flag in composable | сделано | useOrders.ts:27,30,36 |
| 7 | #30: empty state `!loading && items.length === 0` | сделано | OrdersListPage.vue:194 |
| 8 | #31: delete button `@click.stop` | сделано | OrdersListPage.vue:417,435 |

#### Final Checklist

| # | Пункт | Вердикт | Доказательство |
|---|---|---|---|
| 1 | toDo/admin-api-contract.md — Orders section | частично | файла нет; секция в toDo/archive-admin-api-contract.md:332 |
| 2 | src/types/order.ts | сделано | 23373 байта, 28 экспортов; формы разошлись с планом осознанно |
| 3 | mocks/orders.ts — 8+ orders | сделано | TOTAL_ORDERS = 100 (orders.ts:363) |
| 4 | mocks/index.ts — все маршруты | частично | 12 из 13 есть; `/api/orders/:id/translated` нет |
| 5 | src/services/ordersService.ts | сделано | все 11 функций плана + 26 сверх него |
| 6 | useOrders.ts — initialized + delete | сделано | :27 initialized, :44 handleDelete |
| 7 | useOrderCard.ts — clean-slate + quick-action | сделано | :262 useDirtyCheck, save/discard/handleChangeStatus и далее |
| 8 | useOrderCreate.ts — форма с поиском клиента | сделано | :119 loadClients с серверным search, :165 selectClient |
| 9 | i18n/admin/orders.ts — RU/EN/LT | сделано | 423/423/423 ключа, зарегистрирован в index.ts:12,65 |
| 10 | OrdersListPage.vue | сделано | 18005 байт: фильтры, таблица, модал удаления |
| 11 | OrderCreatePage.vue | сделано | 21419 байт — сильно шире плана (позиции, услуги, файлы) |
| 12 | OrderCardPage.vue | сделано | 113766 байт |
| 13 | styles/admin/orders_list.css | сделано | 493 строки |
| 14 | styles/admin/orders_card.css | сделано | 394 строки |
| 15 | styles/admin/orders_create.css | сделано | 163 строки |
| 16 | router — 3 маршрута | сделано | router/index.ts:146-163 |
| 17 | featureFlags.ts | сделано | :23,58,59,60 — все четыре флага |
| 18 | types/features.ts | сделано | :20,54,55,56 |
| 19 | AdminSidebar.vue — ссылка на заказы | не начато | ссылки нет; только `isSalesCrmActive` на `/admin/orders` (:35) |
| 20 | i18n/admin/layout.ts — ключ сайдбара | не начато | `side.orders` отсутствует |
| 21 | ScreensPage.vue — страницы заказов | сделано | :166,167,170 (под номерами 3.2/3.2n/3.2c) |
| 22 | tests/e2e/helpers/flags.ts | сделано | :31,77,78,79 |
| 23 | typecheck: 0 errors | сделано | `npm run typecheck` — чисто |
| 24 | lint: 0 errors | сделано | `npm run lint` — чисто |
| 25 | browser golden path | непонятно | без браузера не проверяется; e2e orders.spec.ts (117 тестов) не запускал |
