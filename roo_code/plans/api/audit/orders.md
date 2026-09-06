# Аудит контракта — orders

Эндпоинтов в коде: **33**. Реализовано бэкендом: **0**.

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-orders-bugs.md`.

**Модуля бэкенда у домена нет.** `ls backend/app/modules/` даёт десять модулей — `auth`, `bcc`,
`billing`, `finance`, `notifications`, `products`, `services`, `settings`, `suppliers`,
`warehouse`, — среди них `orders` отсутствует. `grep -rln -i "order" backend/app --include=*.py`
находит десять файлов, и ни один не про заказ клиента: `settings` — справочник статусов заказа
(`backend/app/modules/settings/shared/models.py`, `features/crud/*`), `products`/`warehouse`/
`suppliers`/`finance`/`bcc` — колонки `sort_order`, `purchase_order_id` и `order_by`. Таблицы
заказа, строки заказа, отгрузки, счёта и платежа на схеме нет ни одной. Поэтому по всем
тридцати трём эндпоинтам источник истины — **мок + клиент**, второй уровень старшинства.

**В старом монолите `03-api-contract.md` раздела у домена нет ни одного.**
`grep -c "^### .*api/orders" roo_code/roo-context/03-api-contract.md` → `0`; путь `api/orders`
встречается там шесть раз и все шесть — проза внутри чужих разделов
(`roo_code/roo-context/03-api-contract.md:1680`, `:1686`, `:1691`, `:1712`, `:1912`, `:1981`),
причём последняя — внутри диапазона `finance`. То же говорит замер плана
(`roo_code/plans/api/contract-sync-plan.md:192`: `| orders | 33 | **нет ни строки**; живёт
отдельным файлом plans/orders/orders-backend-contract.md |`). Значит графа «Пробел контракта»
ниже фиксирует пробелы **в коде**, а не неверные утверждения монолита: утверждений там нет.

**Зато у домена есть свой контракт — и он тоже гипотеза.**
[`roo_code/plans/orders/orders-backend-contract.md`](../../orders/orders-backend-contract.md),
498 строк, восемь разделов; ниже он называется «контракт домена» и цитируется как `§N`. Он
написан по моку и сам объявляет мок старшим (`roo_code/plans/orders/orders-backend-contract.md:5`:
«Если что-то здесь расходится с моком — прав мок»), поэтому каждое его утверждение здесь либо
подтверждено кодом, либо стоит в графе «Пробел контракта». Одно его утверждение проверяется
машинно: `frontend_vue/src/services/mocks/order-audit-contract-conformance.spec.ts:44-46`
читает §6 через `readFileSync` и сверяет три множества кодов (брошенные моком, названные в §6,
имеющие сообщение человеку).

**Конверт.** Мок отдаёт голое значение (`delay(...)`,
`frontend_vue/src/services/mocks/index.ts:255-257`), а живой клиент разворачивает конверт
`ApiResponse<T>` (`frontend_vue/src/services/api.ts:128-138`,
`frontend_vue/src/types/api.ts:1-6`). Формы ответа ниже записаны так, как их обязан прислать
сервер, — в конверте. Правило то же, что у соседа: см. аудит clients, врезка «Конверт».

**Версия заказа — сквозной механизм, а не поле одного эндпоинта.** У заказа есть `version`
(`frontend_vue/src/types/order.ts:547`), сервер поднимает её на каждой принятой записи
(`bumpVersion`, `frontend_vue/src/services/mocks/orders.ts:1952-1955`), клиент возвращает ту,
которую видел, и отставшая отклоняется без единой записи (`assertVersion`, `:1938-1941`;
`ORDER_VERSION_CONFLICT`, `:1940`). У запроса с телом версия едет полем (`withVersion`,
`frontend_vue/src/composables/useOrderCard.ts:227-229`), у `DELETE` — заголовком `If-Match`
(`frontend_vue/src/services/ordersService.ts:41-43`), который мок разбирает
(`ifMatchVersion`, `frontend_vue/src/services/mocks/index.ts:1420-1425`, применение `:1428`).
`undefined` означает «клиент версии не читал» и проверку **не включает** (`frontend_vue/src/services/mocks/orders.ts:1939`). Ниже это
не повторяется в каждой графе: где написано «версия — полем `version`» или «версия — `If-Match`»,
имеется в виду ровно этот механизм.

**Идемпотентность есть ровно у трёх POST** — отгрузка, платёж, возврат
(`frontend_vue/src/services/ordersService.ts:294-296`, `:385-387`, `:351-353`), и мок их кеширует
по ключу (`withIdempotency`, `frontend_vue/src/services/mocks/index.ts:261-269`, применение
`:1030-1057`). Остальные тридцать заголовка не шлют:
`grep -c "Idempotency" frontend_vue/src/services/ordersService.ts` → `4` (импорт + три вызова).

## Эндпоинты

### DELETE /api/orders/:id
- Вызывающий: `src/services/ordersService.ts:113`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1577`
- Форма запроса: тела нет; версия — заголовком `If-Match` (`src/services/ordersService.ts:112-113`, сборка заголовка — `ifMatch`, `:41-43`).
- Форма ответа: `ApiResponse<void>` — клиент объявляет `Promise<void>` (`src/services/ordersService.ts:112`), мок отдаёт `undefined` (`mocks/index.ts:1580`).
- Коды ошибок: `ORDER_HAS_INVOICE` (`mocks/orders.ts:2062`), `ORDER_HAS_SHIPMENT` (`:2064`), `ORDER_HAS_PAYMENT` (`:2065`), `ORDER_VERSION_CONFLICT` (`assertVersion`, `:2060`). `ORDER_NOT_FOUND` **не бросается**: неизвестный id — молчаливый выход (`:2058`).
- Save-режим: quick-action, два вызывающих — список (`src/composables/useOrders.ts:46`, **без версии**) и карточка (`src/composables/useOrderCard.ts:575`, `atVersion()`).
- Пробел контракта: (1) удаление уносит за собой резервы (`releaseOrder`, `mocks/orders.ts:2070`) и записи дефицита (`clearShortages`, `:2074`) — этих эффектов нет в таблице §4.1 контракта домена (`roo_code/plans/orders/orders-backend-contract.md:117`), они названы только прозой §4.2 (`:179`); (2) неизвестный id отвечает успехом, тогда как соседние удаления домена бросают `*_NOT_FOUND` (`mocks/orders.ts:2356`, `:2446`, `:2479`, `:2530`) → находка 2; (3) удаление из списка версии не шлёт (`useOrders.ts:46`), при том что §3 требует её «на каждой мутации» (`orders-backend-contract.md:97`) → находка 3.
- Источник истины: мок + клиент (модуля бэкенда нет).

### DELETE /api/orders/:id/audit/:id
- Вызывающий: `src/services/ordersService.ts:195`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1586`
- Форма запроса: тела нет; второй сегмент — **`id` записи**, а не её позиция (`src/services/ordersService.ts:190-196`; `id` живёт на `StockAuditEntry`, `src/types/warehouse.ts:526-534`, и наследуется `OrderAuditEntry`, `src/types/order.ts:591`); версия — `If-Match` (`ordersService.ts:195`).
- Форма ответа: `ApiResponse<void>` (`src/services/ordersService.ts:194`; мок `mocks/index.ts:1593`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2476`), `ORDER_AUDIT_ENTRY_NOT_FOUND` (`:2479`), `ORDER_VERSION_CONFLICT` (`assertVersion`, `:2477`).
- Save-режим: quick-action из двух мест — карточка заказа (`src/composables/useOrderCard.ts:341`) и общая лента аудита, маршрутизирующая удаление в эндпоинт своей сущности (`src/services/auditFeedService.ts:62`). Правило маршрутизации не переизобретается: см. аудит clients, «Правила домена…», п. 11.
- Пробел контракта: (1) объявленный ответ расходится с реализацией — таблица §4.1 контракта домена называет `Order` (`roo_code/plans/orders/orders-backend-contract.md:118`), клиент и мок дают `void`; (2) лента аудита свои **чтения** подписывает заголовками (`src/services/auditFeedService.ts:20`, `:41`), а это удаление уходит без них (`:62` → `ordersService.ts:195`) — тот же разрыв, что у соседа (см. аудит products, находка 2).
- Источник истины: мок + клиент.

### DELETE /api/orders/:id/files/:id
- Вызывающий: `src/services/ordersService.ts:211`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1596`
- Форма запроса: тела нет; второй сегмент — **`fileId` загрузки**, а не `OrderFile.id`: клиент шлёт `fileId` (`src/services/ordersService.ts:206-211`, источник значения — `src/composables/useOrderCard.ts:1638`), мок ищет по `f.fileId` (`mocks/orders.ts:2521`); версия — `If-Match`.
- Форма ответа: `ApiResponse<void>` (`src/services/ordersService.ts:210`; мок `mocks/index.ts:1603`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2519`), `ORDER_FILE_NOT_FOUND` (`:2530`), `ORDER_VERSION_CONFLICT` (`assertVersion`, `:2520`).
- Save-режим: clean-slate — снятие копится в `pendingFileRemoves` (`src/composables/useOrderCard.ts:185`, наполнение `:1638`) и уходит шагом 5 сохранения (`:524-527`).
- Пробел контракта: в таблице эндпоинтов §4.1 контракта домена файлов нет вовсе (`roo_code/plans/orders/orders-backend-contract.md:111-118`); оба файловых эндпоинта названы там только прозой §3 про шаг версии (`:101`), а форму `OrderFile` (`src/types/order.ts:608-616`) контракт не описывает нигде.
- Источник истины: мок + клиент.

### DELETE /api/orders/:id/items/:id
- Вызывающий: `src/services/ordersService.ts:165`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1547`
- Форма запроса: тела нет; версия — `If-Match` (`src/services/ordersService.ts:160-165`).
- Форма ответа: `ApiResponse<void>` (`src/services/ordersService.ts:164`; мок `mocks/index.ts:1554`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2353`), `ORDER_ITEM_NOT_FOUND` (`:2356`), `LINE_HAS_SHIPMENT` / `LINE_ON_INVOICE` (`assertDeletable`, `:2358` → `:2385`), `ORDER_VERSION_CONFLICT` (`:2354`).
- Save-режим: clean-slate — копится в `pendingItemDeletions` и уходит шагом 4, последним из правок строк (`src/composables/useOrderCard.ts:505-509`); адресуется через `serverLineId`, потому что строку мог создать предыдущий сорвавшийся Save (`:246-250`, `:507`).
- Пробел контракта: удаление снимает резерв (`releaseLine`, `mocks/orders.ts:2364`) и пересобирает дефицит (`syncShortages`, `:2367`) — §4.2 контракта домена называет оба эффекта прозой (`roo_code/plans/orders/orders-backend-contract.md:179`), а в таблице эндпоинтов (`:140`) их нет.
- Источник истины: мок + клиент.

### DELETE /api/orders/:id/payments/:id
- Вызывающий: `src/services/ordersService.ts:395`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1557`
- Форма запроса: тела нет; версия — `If-Match` (`src/services/ordersService.ts:390-395`).
- Форма ответа: `ApiResponse<void>` (`src/services/ordersService.ts:394`; мок `mocks/index.ts:1564`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:4012`), `PAYMENT_NOT_FOUND` (`:4015`), `ORDER_VERSION_CONFLICT` (`:4013`).
- Save-режим: quick-action из карточки (`src/composables/useOrderCard.ts:1032`).
- Пробел контракта: удаление платежа — единственный законный путь назад для отказа `ORDER_HAS_PAYMENT` (`roo_code/plans/orders/orders-backend-contract.md:130`), но ни одной проверки связности здесь нет (`mocks/orders.ts:4005-4020`): платёж удаляется и тогда, когда он назвал счёт, и тогда, когда это возврат, обязанный назвать документ (`:3979`). Что делать с уже выпущенной корректировкой, оплаченной этим платежом, не сказано ни в моке, ни в контракте.
- Источник истины: мок + клиент.

### DELETE /api/orders/:id/services/:id
- Вызывающий: `src/services/ordersService.ts:187`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1567`
- Форма запроса: тела нет; второй сегмент — id **строки услуги** (`os-N`, выдаётся при добавлении, `mocks/orders.ts:2418`), а не id услуги в каталоге: мок ищет `order.services.findIndex((s) => s.id === serviceId)` (`:2445`). Версия — `If-Match` (`src/services/ordersService.ts:182-187`).
- Форма ответа: `ApiResponse<void>` (`src/services/ordersService.ts:186`; мок `mocks/index.ts:1574`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2443`), `ORDER_SERVICE_NOT_FOUND` (`:2446`), `LINE_ON_INVOICE` (`assertDeletable`, `:2447` → `:2385`), `ORDER_VERSION_CONFLICT` (`:2444`).
- Save-режим: clean-slate — `pendingServiceDeletions`, шаг 4 сохранения (`src/composables/useOrderCard.ts:511-515`).
- Пробел контракта: параметр клиента назван `serviceId` (`src/services/ordersService.ts:184`), а значение — id строки; §4.2 контракта домена пишет тот же сегмент как `:lineId` (`roo_code/plans/orders/orders-backend-contract.md:143`) — два имени одного сегмента. Второй код `assertDeletable`, `LINE_HAS_SHIPMENT`, здесь недостижим по построению: у услуги `shippedQuantity` всегда 0 (`src/types/order.ts:179`, причина — `:158-160`), а ветку выбирает именно он (`mocks/orders.ts:2385`).
- Источник истины: мок + клиент.

### GET /api/orders
- Вызывающий: `src/services/ordersService.ts:61`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:545`
- Форма запроса: query, девять параметров — `search`, `status`, `clientId`, `dateFrom`, `dateTo`, `sortBy`, `sortDir` из `OrderFilters` (`src/types/order.ts:618-626`) плюс `page`, `pageSize` (`src/services/ordersService.ts:61-65`). Разбор — `mocks/index.ts:546-559`. Поиск идёт по номеру заказа и имени клиента (`mocks/orders.ts:1504`), `status: 'all'` означает «без фильтра» (`:1508-1511`), обе границы дат — **дни включительно**, сравниваются срезом `createdAt.slice(0, 10)` (`:1523`, `:1526`).
- Форма ответа: `ApiResponse<PaginatedResponse<OrderListItem>>` (`src/services/ordersService.ts:57-60`, типы — `src/types/api.ts:8-14`, `src/types/order.ts:17-38`). `totalPages` производный (`mocks/orders.ts:1562`), `shippedPercent` считается при чтении и в деньгах, а не в количествах (`:1497` → `shippedPercentOf`, `:235-240`).
- Коды ошибок: `UNKNOWN_SORT_KEY` (`mocks/orders.ts:1444`), `UNKNOWN_SORT_DIRECTION` (`:1447`), `INVALID_DATE_FILTER` (`:1453`), `INVALID_PAGE` — и для `page`, и для `pageSize` (`:1465`). Все четыре проверяются до чтения первой строки (`validateListRequest`, `:1437-1469`, вызов `:1484`). Допустимых ключей сортировки восемь (`ORDER_SORT_KEYS`, `:1407-1418`); `orderNumber` сортируется числом, а не строкой (`:1541` → `src/services/documentNumbers.ts`).
- Save-режим: только чтение. Четыре вызывающих: список заказов (`src/composables/useOrders.ts:33`), дашборд CRM (`src/composables/useSalesCrmDashboard.ts:32`, пять свежих), карточка клиента (`src/composables/useClientCard.ts:179-190`, страницами до `total`, `:192`), список клиентов (`src/views/admin/clients/ClientsListPage.vue:105-116`, `pageSize: 1` ради `total`).
- Пробел контракта: (1) `clientId` и `sortBy` объявлены `string | null` (`src/types/order.ts:621`, `:624`) и уезжают в query литералом `"null"`, потому что `apiGet` кладёт значения через `searchParams.set` (`src/services/api.ts:154-155`); живые вызывающие с `null` есть — `src/composables/useSalesCrmDashboard.ts:36` и `src/views/admin/clients/ClientsListPage.vue:112` — тот же дефект, что у соседа (см. аудит clients, `БАГ-04`) → находка 4; (2) у пути есть мёртвый алиас `/api/orders/translated` (`mocks/index.ts:545`), вызывающего у него нет ни одного (`grep -rn "orders/translated" frontend_vue/src` даёт только эту строку) — одна из пяти «сирот» замера К2 (`roo_code/plans/api/contract-sync-plan.md:260`); (3) фильтр `status` — единственный из семи, который **не проверяется**: `sortBy`, `sortDir`, `dateFrom`, `dateTo`, `page`, `pageSize` отвергаются на входе (`mocks/orders.ts:1437-1469`), а неизвестный статус просто отфильтровывает всё (`:1508-1511`) и отвечает пустым списком — ровно то, что §4.1 контракта домена запрещает для остальных параметров (`roo_code/plans/orders/orders-backend-contract.md:126`). Тип это допускает: `status: string`, а не перечисление (`src/types/order.ts:620`).
- Источник истины: мок + клиент.

### GET /api/orders/:id
- Вызывающий: `src/services/ordersService.ts:69`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:611`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:68-70`), параметров нет.
- Форма ответа: `ApiResponse<Order>` (`src/types/order.ts:440-548`) — со строками, услугами, отгрузками, возвратами, счетами, платежами, файлами и историей внутри. Плюс `costTopUp` — лестница «что полка даст строке следующим», собираемая при каждом чтении и никогда не хранимая (`mocks/orders.ts:1373` → `topUpLadder`, `:2938-2953`; объяснение — `src/types/order.ts:501-529`).
- Коды ошибок: **ни одного**. `mockGetOrder` отдаёт `undefined` на неизвестный id (`mocks/orders.ts:1599-1602`), тогда как остальные девять чтений домена бросают `ORDER_NOT_FOUND` (`:1772`, `:2813`, `:3239`, `:3628`, `:3637`, `:3941`, `:4025`) → находка 1.
- Save-режим: только чтение; перечитывается после каждой quick-action карточки (`src/composables/useOrderCard.ts:381`, вызовы `load()` — `:667`, `:732`, `:1598` и далее).
- Пробел контракта: (1) отсутствие `ORDER_NOT_FOUND` — см. выше; (2) единственное, что этот ответ уже режет по праву `seeCost`, — записи истории с `sensitive: 'cost'` (`mocks/orders.ts:1384-1386`, право — `maySeeCost`, `:1391-1394`); `unitCost`, `costSource`, `allocations` и `marginPercent` отдаются всем, и §5 контракта домена называет это занавеской, а не правом (`roo_code/plans/orders/orders-backend-contract.md:389-396`).
- Источник истины: мок + клиент.

### GET /api/orders/:id/invoices
- Вызывающий: `src/services/ordersService.ts:399`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:601`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:398-400`).
- Форма ответа: `ApiResponse<Invoice[]>` (`src/types/order.ts:371-415`), глубокая копия (`mocks/orders.ts:4026`). Те же счета уже приходят внутри `Order.invoices` (`src/types/order.ts:491`), и карточка читает именно их (`src/composables/useOrderCard.ts:915`), а не этот эндпоинт.
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:4025`).
- Save-режим: только чтение. **Вызывающего в интерфейсе нет**: `grep -rn "getOrderInvoices" frontend_vue/src` даёт объявление (`src/services/ordersService.ts:398`) и спеку (`src/services/ordersService.spec.ts`) — экрана, который его зовёт, нет ни одного.
- Пробел контракта: клиент написан, потребителя нет — тот же класс, что у пяти эндпоинтов соседа (см. аудит warehouse, «Правила домена…», п. 19). §4.6 контракта домена перечисляет `GET/POST /invoices` одной строкой (`roo_code/plans/orders/orders-backend-contract.md:270`) и не говорит, зачем нужен отдельный GET, если список едет в заказе.
- Источник истины: мок + клиент.

### GET /api/orders/:id/payments
- Вызывающий: `src/services/ordersService.ts:368`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:596`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:367-369`).
- Форма ответа: `ApiResponse<Payment[]>` (`src/types/order.ts:419-428`), глубокая копия (`mocks/orders.ts:3942`). Дубль того, что уже лежит в `Order.payments` (`src/types/order.ts:492`); карточка считает оплату по нему (`src/composables/useOrderCard.ts:914`, свод — `:917`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3941`).
- Save-режим: только чтение. Вызывающего в интерфейсе нет: `grep -rn "getOrderPayments" frontend_vue/src` даёт объявление и спеку.
- Пробел контракта: тот же, что у `GET /invoices` — клиент есть, экрана нет; в §4.6 контракта домена оба перечислены строкой `GET/POST` (`roo_code/plans/orders/orders-backend-contract.md:268`).
- Источник истины: мок + клиент.

### GET /api/orders/:id/reservations
- Вызывающий: `src/services/ordersService.ts:364`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:606`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:363-365`).
- Форма ответа: `ApiResponse<StockReservation[]>` — тип **складской**, а не заказный (`src/types/warehouse.ts:625-634`, импорт — `src/services/ordersService.ts:44`). Хранилище резервов лежит третьим модулем, до которого дотягиваются обе стороны (`src/services/mocks/reservations.ts:1-18`, причина — `:1-14`).
- Коды ошибок: **ни одного** — ветка мока зовёт `mockGetReservations({ orderId })` (`mocks/index.ts:608`), а тот просто фильтрует хранилище (`mocks/orders.ts:246-252` → `findReservations`, `mocks/reservations.ts:24-34`): неизвестный заказ отвечает пустым массивом, а не `ORDER_NOT_FOUND`.
- Save-режим: только чтение. Вызывающего в интерфейсе нет: `grep -rn "getOrderReservations" frontend_vue/src` даёт объявление (`src/services/ordersService.ts:363`) и четыре спеки.
- Пробел контракта: (1) пустой массив вместо отказа — тот же класс, что у соседа (см. аудит warehouse, находка 6); (2) §4.4 контракта домена называет эндпоинт «резервы заказа» (`roo_code/plans/orders/orders-backend-contract.md:207`) и не говорит, что резерв ограничивается **по строке**, а не по заказу, — это сказано абзацем ниже (`:209`) и реализовано `exceptLine` (`mocks/reservations.ts:47-60`).
- Источник истины: мок + клиент.

### GET /api/orders/:id/return-plan
- Вызывающий: `src/services/ordersService.ts:321`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:586`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:320-322`).
- Форма ответа: `ApiResponse<ReturnableLine[]>` — `{ lineId, productName, unit, shipped, alreadyReturned, returnable }` (`src/types/order.ts:357-365`), считается при чтении (`mocks/orders.ts:3635-3648`) и отдаёт только строки с `returnable > 0` (`:3647`). Услуг здесь не бывает по построению: они не отгружаются, и выборка идёт по `order.items` (`:3638`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3637`).
- Save-режим: только чтение; карточка перечитывает его после каждой записи, меняющей отгруженное (`src/composables/useOrderCard.ts:791`, вызов из `load()` — `:406`).
- Пробел контракта: §4.5.1 контракта домена описывает ответ тремя полями — `shipped`, `alreadyReturned`, `returnable` (`roo_code/plans/orders/orders-backend-contract.md:245`), а тип несёт пять: там нет `productName` и `unit` (`src/types/order.ts:357-365`).
- Источник истины: мок + клиент.

### GET /api/orders/:id/returns
- Вызывающий: `src/services/ordersService.ts:316`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:591`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:315-317`).
- Форма ответа: `ApiResponse<OrderReturn[]>` (`src/types/order.ts:338-352`), глубокая копия (`mocks/orders.ts:3629`). На строке возврата — две независимые оси (`condition`, `compensated`) и `restored`, присутствующий **всегда**, со значением `null`, когда никуда не легло (`src/types/order.ts:311-327`, реализация `mocks/orders.ts:3752`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3628`).
- Save-режим: только чтение; карточка держит собственный список (`src/composables/useOrderCard.ts:783`) и перечитывает его из `load()` (`:405`).
- Пробел контракта: `Order.returns` уже везёт то же самое внутри карточки (`src/types/order.ts:490`), то есть третий эндпоинт-дубль после `payments` и `invoices`; §4.5.1 таблицы контракта домена (`roo_code/plans/orders/orders-backend-contract.md:244`) этого не оговаривает.
- Источник истины: мок + клиент.

### GET /api/orders/:id/ship-plan
- Вызывающий: `src/services/ordersService.ts:270`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:574`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:269-271`).
- Форма ответа: `ApiResponse<ShippableLine[]>` — `{ lineId, productName, unit, remaining, shippable, wholePieces }` (`src/types/order.ts:240-260`). `shippable` берётся у самого планировщика (`ShipmentPlanLine.offerable`, `mocks/orders.ts:3212`, чтение `:3251`), а не вычитанием недостачи из остатка, — причина названа в коде (`:3186-3197`). `wholePieces` — запретные отрезки количества, занятые неделимыми кусками (`:3226-3235` → `wholePieceRanges` из `src/services/orderLines.ts`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3239`). Отказы самого планировщика (`DUPLICATE_SHIPMENT_LINE`, `SHIPMENT_EXCEEDS_REMAINING`, `SHIPMENT_QUANTITY_MUST_BE_POSITIVE`) здесь недостижимы: план строится по `unshippedLines` (`:3241`), а те по построению уникальны и положительны (`:1743-1749`).
- Save-режим: только чтение; читается вместе с заказом (`src/composables/useOrderCard.ts:713`, вызов из `load()` — `:402`).
- Пробел контракта: **недостача сюда не попадает**. `planShipment` возвращает `shortages` (`mocks/orders.ts:3216`), а `mockPlanOrderShipment` их отбрасывает (`:3242-3254`) — диалог видит только урезанное `shippable`. §4.4 контракта домена перечисляет три поля ответа (`roo_code/plans/orders/orders-backend-contract.md:205`) и о недостаче в плане не говорит, хотя у смены статуса она в плане есть (`src/types/order.ts:284`).
- Источник истины: мок + клиент.

### GET /api/orders/:id/shipments
- Вызывающий: `src/services/ordersService.ts:274`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:579`
- Форма запроса: только сегмент пути (`src/services/ordersService.ts:273-275`).
- Форма ответа: `ApiResponse<Shipment[]>` (`src/types/order.ts:287-298`), глубокая копия (`mocks/orders.ts:2814`). На строке отгрузки — `heldReleased`, присутствующий **всегда**, со значением `null`, когда снимать было нечего (`src/types/order.ts:208-226`, реализация `mocks/orders.ts:3310`, снятие — `:3329`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2813`).
- Save-режим: только чтение; отдельная панель карточки со своим флагом загрузки (`src/composables/useOrderCard.ts:696`), перечитывается после отгрузки, отмены, корректировки и смены статуса (`:733`, `:760`, `:1602`, `:671`).
- Пробел контракта: `Order.shipments` едет и внутри заказа (`src/types/order.ts:489`), то есть панель могла бы читать оттуда, как читает счета и платежи; §4.5 контракта домена (`roo_code/plans/orders/orders-backend-contract.md:215`) причины отдельного GET не называет.
- Источник истины: мок + клиент.

### GET /api/orders/:id/status-plan
- Вызывающий: `src/services/ordersService.ts:96`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:563`
- Форма запроса: сегмент пути плюс обязательный query-параметр `status` (`src/services/ordersService.ts:92-97`); мок подставляет `'new'`, если параметр не пришёл (`mocks/index.ts:566-569`).
- Форма ответа: `ApiResponse<StatusTransitionPlan>` — `{ status, reserves, writesOff, lines[], shortages[] }` (`src/types/order.ts:278-285`; сборка — `mocks/orders.ts:1778-1790`). `reserves`/`writesOff` берутся из справочника статусов домена `settings` по соглашению об имени `st-<status>` (`:1733-1740`, применение `:1780`); `writesOff` дополнительно гасится, когда отгружать нечего (`:1782`); недостача едет полем ответа (`:1789`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:1772`). Неизвестный статус здесь **не отвергается**: `isOrderStatus` проверяется только на записи (`:1806`), а план по несуществующему `st-<опечатка>` вернёт «не резервирует, не списывает» (`:1736-1739`).
- Save-режим: только чтение, но читается **перед** записью: карточка сначала показывает план и лишь потом меняет статус (`src/composables/useOrderCard.ts:607`, применение — `:665`).
- Пробел контракта: (1) в засеянных настройках **ни один из пятнадцати статусов не резервирует и не списывает** — `grep -c "reserveOnTransition: true" frontend_vue/src/services/mocks/settings.ts` → `0`, `writeOffOnTransition: true` → `0` при пятнадцати записях (`src/services/mocks/settings.ts:208-347`), то есть весь путь §4.5 «смена статуса — это рабочий процесс отгрузки» (`roo_code/plans/orders/orders-backend-contract.md:234`) под моком мёртв → находка 5; (2) мост между перечислением статусов и справочником держится на имени `st-*` и на входе не проверяется — новый статус, заведённый через настройки, получает id `st-<N>` (`src/services/mocks/settings.ts:544`), которого `statusRules` не найдёт никогда.
- Источник истины: мок + клиент.

### PATCH /api/orders/:id
- Вызывающий: `src/services/ordersService.ts:81`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1290`
- Форма запроса: merge-patch, только поля, которыми владеет админ, плюс `version`. Клиент шлёт восемь: `notes`, `documentType`, `currency`, `vatMode`, `vatPercent`, `defaultMarginPercent`, `defaultDiscountPercent`, `totalWeight` (`SAVABLE_FIELDS`, `src/composables/useOrderCard.ts:118-128`, сборка тела `:301-305`). Мок принимает те же восемь по белому списку (`mocks/orders.ts:1709-1719`) плюс два легаси-алиаса `marginPercent` и `orderDiscount` (`:1695`, `:1721-1722`). Подпись клиента при этом `Partial<Order>` (`src/services/ordersService.ts:80`) — то есть типом разрешено прислать что угодно из заказа, а сервер обязан всё лишнее отбросить.
- Форма ответа: `ApiResponse<Order>` целиком, включая пересчитанные производные (`mocks/orders.ts:1728-1730`, пересчёт — `recalcOrder`, `:179-226`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:1698`), `ORDER_VERSION_CONFLICT` (`:1699`), `NUMBER_NOT_FINITE` по шести числовым полям (`:1700-1707` → `:1978`), плюс инварианты пересчёта `INVALID_LINE`, `DUPLICATE_LINE_ID` (`:191`), `ALLOCATION_EXCEEDS_QUANTITY` (`:200`), `INVALID_VAT_RATE` — их §6 контракта домена помечает внутренними, наружу выставлять нельзя (`roo_code/plans/orders/orders-backend-contract.md:432`).
- Save-режим: clean-slate, шаг 1 сохранения карточки — поля уходят **первыми**, потому что правки строк ниже читаются против умолчаний заказа (`src/composables/useOrderCard.ts:298-311`, порядок объяснён `:422-427`).
- Пробел контракта: (1) два легаси-алиаса тела не шлёт больше никто — `grep -rn "orderDiscount" frontend_vue/src` даёт только сам мок (`mocks/orders.ts:1695`, `:1706`, `:1722`); (2) `clientPaymentTermsDays` этот эндпоинт не принимает, и §4.1 контракта домена это оговаривает (`orders-backend-contract.md:120`), но белый список мока и без того его не содержит — то есть правило держится отсутствием строки, а не проверкой; (3) `currency` меняется свободно (`mocks/orders.ts:1711`) и **числа при этом не пересчитываются** — это решение (§7.1, `orders-backend-contract.md:459`), но ни один код ошибки и ни одно предупреждение его не сопровождают.
- Источник истины: мок + клиент.

### PATCH /api/orders/:id/items/:id
- Вызывающий: `src/services/ordersService.ts:157`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1279`
- Форма запроса: `LineEditPayload` = `LineEditDelta & LineEditEnvelope` (`src/services/ordersService.ts:32`, `src/services/orderLineEdits.ts:60-63`, `src/types/order.ts:557-574`). **Одна правка за раз**, и порядок правок решает результат — карточка шлёт по запросу на правку в том порядке, в каком их сделал человек (`src/composables/useOrderCard.ts:476-491`). Тело строится только через `lineEditDelta` (`src/services/orderLineEdits.ts:193-214`), обратный разбор — `deltaToOps` (`:223-257`) в фиксированном порядке «количество → сброс цены → наценка → скидка → ручная цена → сумма строки → себестоимость». `resetPrice` обязан нести `defaultDiscountPercent` — число момента нажатия, а не момента чтения (`src/types/order.ts:557-571`, отправка `src/composables/useOrderCard.ts:486`, применение `mocks/orders.ts:2014-2015`).
- Форма ответа: `ApiResponse<OrderItem>` — строка целиком (`src/types/order.ts:83-154`; `mocks/orders.ts:2278`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2223`), `ORDER_VERSION_CONFLICT` (`:2224`), `ORDER_ITEM_NOT_FOUND` (`:2226`), `NUMBER_NOT_FINITE` по девяти полям (`validateLineEdit`, `:2019-2038`), `ALLOCATIONS_NOT_ACCEPTED` (`:2037`), `FORBIDDEN_MANUALCOST` (`requireRight`, `:2237` → `:1858`), `MANUAL_COST_REASON_REQUIRED` (`src/services/orderLineEdits.ts:96`), `RESET_COST_NOT_SUPPORTED` (`:112`), `COST_FROZEN_BY_SHIPMENT` (`:114`), `NO_STOCK_COST` (`:119`), `QUANTITY_SPLITS_OFFCUT` (`:159`) плюс отказы арифметики из `domain/orderPricing.ts` — `PRICE_FROZEN_BY_SHIPMENT` (`src/domain/orderPricing.ts:216`), `LINE_FULLY_SHIPPED` (`:379`), `BELOW_SHIPPED_QUANTITY` (`:388`), а также `DISCOUNT_OUT_OF_RANGE`, `MARGIN_OUT_OF_RANGE`, `NEGATIVE_PRICE`, `NEGATIVE_COST`, `NEGATIVE_QUANTITY`, `ZERO_QUANTITY`, `NO_COST_TO_MARK_UP` из того же файла.
- Save-режим: clean-slate, шаг 3 сохранения (`src/composables/useOrderCard.ts:476-491`); та же функция `applyLineEdit` применяет правку локально до сохранения (`src/services/orderLineEdits.ts:132-181`), поэтому «что видел» и «что сохранилось» не могут разойтись.
- Пробел контракта: (1) правка **перечитывает себестоимость** и переносит разницу в наценку, а не в цену (`topUpAllocation`, `mocks/orders.ts:2271` → `:2865-2890`) — §4.2 контракта домена описывает это прозой (`roo_code/plans/orders/orders-backend-contract.md:167`), а в таблице форм правки (`:147-155`) такого эффекта нет; (2) три непрайсинговых поля — `productName`, `unit`, `weightPerUnitKg` — принимаются тем же телом (`mocks/orders.ts:2248-2250`) и в таблице §4.2 не названы вовсе; `weightPerUnitKg` при этом на бэкенде не существует нигде (`grep -rn "weight_per" backend/` — пусто), см. аудит products, «Правила домена…», п. 15.
- Источник истины: мок + клиент.

### PATCH /api/orders/:id/services/:id
- Вызывающий: `src/services/ordersService.ts:221`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1268`
- Форма запроса: тот же `LineEditPayload`, но с двумя отличиями, и оба — правила домена: себестоимость услуги приходит полем `unitCost`, а не `manualUnitCost` (`src/services/orderLineEdits.ts:207-210`, разбор `:253`), и **причина не требуется**, потому что перекрывать нечего — складской себестоимости у услуги нет (`:80-86`, реализация `:94`, где ветка услуги выходит до проверки причины `:96`).
- Форма ответа: `ApiResponse<OrderService>` — строка целиком (`src/types/order.ts:161-191`; `mocks/orders.ts:2334`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2288`), `ORDER_VERSION_CONFLICT` (`:2289`), `ORDER_SERVICE_NOT_FOUND` (`:2291`), `NUMBER_NOT_FINITE` и `ALLOCATIONS_NOT_ACCEPTED` (`validateLineEdit`, `:2294`), `FORBIDDEN_MANUALCOST` (`:2307`), плюс те же отказы арифметики.
- Save-режим: clean-slate, тот же шаг 3, ветка `kind === 'service'` (`src/composables/useOrderCard.ts:487-488`).
- Пробел контракта: §4.2 контракта домена сводит услуги к строке «то же для услуг» (`roo_code/plans/orders/orders-backend-contract.md:143`), тогда как форма тела у них другая (`unitCost` вместо `manualUnitCost`), обязательность причины другая, а `resetCost` для услуги запрещён вовсе (`RESET_COST_NOT_SUPPORTED`, `src/services/orderLineEdits.ts:112`). Три отличия, не названные ни строкой.
- Источник истины: мок + клиент.

### PATCH /api/orders/:id/status
- Вызывающий: `src/services/ordersService.ts:104`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1259`
- Форма запроса: `{ status, version }` (`src/services/ordersService.ts:99-105`, разбор `mocks/index.ts:1260-1265`). Допустимых значений пятнадцать (`ORDER_STATUSES`, `src/domain/orderStatus.ts:15-31`).
- Форма ответа: `ApiResponse<Order>` целиком (`mocks/orders.ts:1838`).
- Коды ошибок: `UNKNOWN_ORDER_STATUS` — **до** проверки версии, потому что нераспознанный статус не стоит арбитража (`mocks/orders.ts:1806`, объяснение `:1799-1805`), `ORDER_NOT_FOUND` (`:1800`), `ORDER_VERSION_CONFLICT` (`:1807`), `STATUS_BLOCKED_BY_STOCK` (`:1819`), плюс всё, что может бросить вложенная отгрузка (`:1820`).
- Save-режим: quick-action, но двухшаговый: сначала `GET /status-plan` показывает, что смена сделает со складом, и лишь потом запись (`src/composables/useOrderCard.ts:607`, применение `:665`); перед этим карточка обязана сбросить несохранённое (`flushBeforeReload`, `:662`).
- Пробел контракта: **эта мутация поднимает версию больше одного раза**. `mockCreateShipment` (`mocks/orders.ts:1820`) и `mockReserveOrder` (`:1823`) сами зовут `bumpVersion` (`:3356`, `:3928`), а следом шагает и сам статус (`:1826`), — то есть §3 «одна принятая запись — один шаг» (`roo_code/plans/orders/orders-backend-contract.md:101`) здесь нарушено на два-три шага → находка 6. Карточку это не ломает только потому, что она перечитывает заказ целиком (`src/composables/useOrderCard.ts:667`).
- Источник истины: мок + клиент.

### POST /api/orders
- Вызывающий: `src/services/ordersService.ts:77`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:976`
- Форма запроса: `{ clientId, documentType, currency? }` (`src/services/ordersService.ts:72-77`). Ветка мока типизирует тело только `clientId` и `documentType` (`mocks/index.ts:978`) — третьего поля в касте нет, но до реализации оно доезжает: она читает `data.currency` (`mocks/orders.ts:1638`). Версии здесь нет и быть не может: заказа ещё нет.
- Форма ответа: `ApiResponse<Order>` — пустой заказ со `status: 'new'` (`mocks/orders.ts:1630`), `version: 1` (`:1670`) и одной записью истории «Заказ создан» (`:1662`), автор которой — переводимая строка «Система», а не пользователь (`:1660`).
- Коды ошибок: `CLIENT_NOT_FOUND` (`mocks/orders.ts:1613`).
- Save-режим: quick-action страницы создания — один POST, затем `PATCH` заметок, затем по запросу на строку, услугу и файл, и в конце `GET /orders/:id` (`src/composables/useOrderCreate.ts:419-477`).
- Пробел контракта: **реквизиты клиента и три из четырёх умолчаний берутся по-разному, и это не описано.** Имя, код НДС, адрес и условия оплаты копируются снимком из карточки клиента (`mocks/orders.ts:1625-1628`, причина — `src/types/order.ts:447-455`), маржа приходит из настроек арендатора (`mocks/orders.ts:1633`), а скидка (`:1634`), ставка НДС (`:1637`) и валюта (`:1638`) стоят **литералами** `0`, `21` и `'EUR'` — при том что настройки владеют всеми тремя (`defaultDiscountPercent`, `vatRate`, `defaultCurrency`, `src/types/settings.ts:15-18`, сид `src/services/mocks/settings.ts:53-56`), а функция «взять базовую валюту» в домене уже есть и здесь не зовётся (`baseCurrencyOf`, `src/services/orderLines.ts:153-161`) → находка 7. §4.1 контракта домена описывает только снимок реквизитов (`roo_code/plans/orders/orders-backend-contract.md:120`) и об умолчаниях молчит.
- Источник истины: мок + клиент.

### POST /api/orders/:id/allocate-total
- Вызывающий: `src/services/ordersService.ts:239`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:982`
- Форма запроса: `{ targetGross, version }` (`src/services/ordersService.ts:229-239`, разбор `mocks/index.ts:984`).
- Форма ответа: `ApiResponse<{ order, requestedGross, achievedGross, rows[] }>` (`src/services/ordersService.ts:233-238`, сборка `mocks/orders.ts:2581-2586`). `achievedGross` отличается от `requestedGross`, потому что из-за центового округления НДС не любой итог достижим, и сервер отвечает тем, что получилось (`:2540-2543`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2557`), `ORDER_VERSION_CONFLICT` (`:2558`), `NUMBER_NOT_FINITE` (`:2559`), `ALLOCATION_LINE_NOT_FOUND` (`:2575`), плюс из арифметики — `BELOW_FROZEN_MINIMUM`, `NO_EDITABLE_LINES`, `ZERO_BASE_TOTAL`, `NEGATIVE_TARGET` (`src/domain/orderPricing.ts`, вызов `mocks/orders.ts:2561-2566`). Первые два фронт разбирает **подстрокой** в превью итога, то есть сервер обязан вернуть ровно эти строки (`roo_code/plans/orders/orders-backend-contract.md:434`).
- Save-режим: quick-action карточки; перед записью — превью тем же расчётом, затем запись и полное перечитывание (`src/composables/useOrderCard.ts:1716-1718`).
- Пробел контракта: раскладка трогает только строки, которые ещё можно править, — отгруженные не двигаются (`roo_code/plans/orders/orders-backend-contract.md:199`), и это правило живёт в `allocateGrossTotal` домена, а не в эндпоинте; в самом моке заказа проверки «есть ли что раскладывать» нет ни одной (`mocks/orders.ts:2555-2578`).
- Источник истины: мок + клиент.

### POST /api/orders/:id/files
- Вызывающий: `src/services/ordersService.ts:203`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1095`
- Форма запроса: `{ fileId, version }` (`src/services/ordersService.ts:198-203`); `fileId` выдаёт загрузка домена `uploads`, и ветка мока достаёт по нему исходное имя из реестра загрузок (`mocks/index.ts:1097-1098`).
- Форма ответа: **расходится**. Клиент объявляет `Promise<void>` (`src/services/ordersService.ts:202`), мок возвращает `OrderFile` целиком (`mocks/orders.ts:2509`, тип — `src/types/order.ts:608-616`). Карточка ответ выбрасывает (`src/composables/useOrderCard.ts:520`) и рисует строку из своих данных (`:1621-1631`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2496`), `ORDER_VERSION_CONFLICT` (`:2497`). Несуществующий `fileId` **не отвергается**: имя просто оказывается `undefined` и подменяется заглушкой `File N` (`:2500`).
- Save-режим: clean-slate — `pendingFileAdds`, шаг 5 сохранения (`src/composables/useOrderCard.ts:519-522`).
- Пробел контракта: (1) объявленный `void` против возвращаемой записи; (2) `id` файла в заказе (`ord-file-N`, `mocks/orders.ts:2499`) — счётчик **модуля**, а не заказа, в отличие от строк (`oi-N`) и документов (`ORD-100-INV-1`), и §2 контракта домена, где области уникальности перечислены (`roo_code/plans/orders/orders-backend-contract.md:50`), файлов не упоминает; (3) поля `size`, `mime`, `url` мок заполняет заглушками (`mocks/orders.ts:2502-2504`).
- Источник истины: мок + клиент.

### POST /api/orders/:id/invoices
- Вызывающий: `src/services/ordersService.ts:416`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1065`
- Форма запроса: `{ kind?, shipmentId?, correctsInvoiceId?, amountNet? | amountGross?, reason?, version? }` (`src/services/ordersService.ts:402-416`). Обе суммы сразу — отказ (`statedAmounts`, `mocks/orders.ts:4466-4489`, проверка `:4471`); заявленный брутто побеждает вычисленный, чтобы документ назвал ровно набранную сумму (`:4448-4465`, применение `:4382`).
- Форма ответа: `ApiResponse<Invoice>` (`src/types/order.ts:371-415`; `mocks/orders.ts:4445`). `withdrawsOriginal` ставит **сервер** — зеркальная сумма отзывает документ, названная только поправляет (`:4393`, вычисление — `:4337`, смысл — `src/types/order.ts:380-390`); `coveredServiceIds` решается один раз при выпуске и едет с документом (`mocks/orders.ts:4395`, отбор — `unbilledServices`, `:4219-4223`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:4269`), `ORDER_VERSION_CONFLICT` (`:4270`), `INVOICE_NEEDS_SHIPMENT` (`:4292`), `ADVANCE_HAS_NO_SHIPMENT` (`:4296`), `CORRECTION_NEEDS_ORIGINAL` (`:4300`), `CORRECTION_REASON_REQUIRED` (`:4303`), `ORIGINAL_INVOICE_NOT_FOUND` (`:4305`), `CANNOT_CORRECT_A_CORRECTION` (`:4307`), `INVOICE_ALREADY_CORRECTED` (`:4310`), `CORRECTION_EXCEEDS_ORIGINAL` (`:4328`), `CORRECTION_NEEDS_KIND` (`:4331`), `SHIPMENT_NOT_FOUND` (`:4354`), `SHIPMENT_CANCELLED` (`:4356`), `SHIPMENT_ALREADY_INVOICED` (`:4360`), `INVOICE_AMOUNT_REQUIRED` (`:4375`), `INVOICE_AMOUNT_AMBIGUOUS` (`:4471`).
- Save-режим: quick-action карточки, три разных вызова — счёт по отгрузке (`src/composables/useOrderCard.ts:1060`), счёт только за услуги без отгрузки (`:1110`) и авансовый (`:1131`).
- Пробел контракта: (1) выпуск корректировки, отзывающей документ с услугами, **сам создаёт ещё один счёт** (`mocks/orders.ts:4424`) — рекурсивный вызов, поднимающий версию второй раз; §4.6 контракта домена описывает следствие прозой (`roo_code/plans/orders/orders-backend-contract.md:281-283`), но что это отдельная запись с отдельным шагом версии, не сказано → находка 6; (2) обычный счёт **без отгрузки** законен, когда несёт только невыставленные услуги (`mocks/orders.ts:4292`, причина `:4286-4291`), и это единственное место, где `INVOICE_NEEDS_SHIPMENT` не срабатывает, — правило названо в §4.6 (`orders-backend-contract.md:283`) и в таблице форм запроса не отражено.
- Источник истины: мок + клиент.

### POST /api/orders/:id/items
- Вызывающий: `src/services/ordersService.ts:141`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1075`
- Форма запроса: `{ productId, quantity, unit, unitPrice, marginPercent?, discountPercent?, batchId?, offcutIds?, version? }` (`src/services/ordersService.ts:121-141`). **Себестоимости в теле нет и быть не может**: её читает сервер со склада (`coverFromStock`, `mocks/orders.ts:2153`), а присланная отвергается вместе с проверкой права (`refuseStatedCost`, `:1996-2000`, вызов `:2121`). `offcutIds` — единственный способ назвать обрезок: в автоматический FIFO куски не попадают (`src/services/ordersService.ts:131-136`, разбор `mocks/orders.ts:2142`).
- Форма ответа: `ApiResponse<OrderItem>` — строка целиком с раскладкой по партиям (`mocks/orders.ts:2205`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2105`), `ORDER_VERSION_CONFLICT` (`:2106`), `NUMBER_NOT_FINITE` (`:2109-2114`), `ZERO_QUANTITY` (`:2118`), `FORBIDDEN_MANUALCOST` и `MANUAL_COST_REASON_REQUIRED` (`:1998-1999`), `CATALOG_PRODUCT_NOT_FOUND` (`:2128`), `OFFCUTS_WITH_BATCH` (`:2146`), `OFFCUTS_EXCEED_QUANTITY` (`:2151`), плюс четыре кода **чужого домена**, которые бросает разбор выбранных кусков: `OFFCUT_NOT_FOUND`, `OFFCUT_PRODUCT_MISMATCH`, `OFFCUT_NOT_AVAILABLE`, `OFFCUT_SIZE_NOT_EXPRESSIBLE` (`src/services/mocks/warehouse.ts:1088-1095`, вход — `mockOffcutAllocations`).
- Save-режим: clean-slate, шаг 2 сохранения — новые строки уходят раньше своих правок, чтобы правке было на что лечь (`src/composables/useOrderCard.ts:437-457`); `discountPercent` шлётся явно, иначе сервер подставил бы своё умолчание и строка изменилась бы под админом (`:447-449`). Второй вызывающий — создание заказа (`src/composables/useOrderCreate.ts:440-451`).
- Пробел контракта: (1) `unit` приходит от клиента строкой (`src/services/ordersService.ts:126`) и на входе не проверяется ничем — обратное преобразование в id справочника делается только при записи дефицита (`uomIdFromOrderLineUnit`, `mocks/orders.ts:3042`); (2) имя товара — снимок на языке каталога, а не читателя (`CATALOGUE_LANGUAGE = 'en'`, `mocks/orders.ts:369`, применение `:2129`), правило названо в §4.2 (`roo_code/plans/orders/orders-backend-contract.md:169`) и повторяется у соседа (см. аудит services, «Правила домена…», п. 5); (3) `receivedCurrency` строки — **базовая валюта арендатора**, а не валюта товара (`mocks/orders.ts:2186` → `baseCurrencyOf`), правило §7.1 (`orders-backend-contract.md:475`).
- Источник истины: мок + клиент.

### POST /api/orders/:id/items/:id/correct
- Вызывающий: `src/services/ordersService.ts:265`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1001`
- Форма запроса: `{ unitPrice?, unitCost?, reason, version? }` (`src/services/ordersService.ts:260-265`); `reason` обязателен и проверяется **до** права, чтобы пользователь без права всё равно узнал, что ещё не так (`mocks/orders.ts:2627`, объяснение `:2626`).
- Форма ответа: `ApiResponse<OrderItem | OrderService>` — путь называет `items`, но корректируется и услуга: сегмент ищется сначала среди строк, затем среди услуг (`src/services/ordersService.ts:264`, `mocks/orders.ts:2619-2622`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2617`), `ORDER_VERSION_CONFLICT` (`:2618`), `ORDER_ITEM_NOT_FOUND` (`:2622`), `NUMBER_NOT_FINITE` (`:2623`), `CORRECTION_REASON_REQUIRED` (`:2627`), `CORRECTION_NEEDS_CHANGE` (`:2629`), `FORBIDDEN_CORRECTION` (`:2631` → `:1858`), `LINE_NOT_FROZEN` (`:2637`), `INVOICE_ALREADY_CORRECTED` (`:2686`).
- Save-режим: quick-action карточки; перед вызовом сбрасывается всё несохранённое, после — полное перечитывание и обновление панели отгрузок (`src/composables/useOrderCard.ts:1598-1602`).
- Пробел контракта: (1) операция целиком планируется до первой записи — себестоимость, цена, проверка `validateLine`, перечень затронутых документов и проверка «этот документ уже корректировали» (`mocks/orders.ts:2648-2687`), и лишь потом пишет (`:2689-2731`); §4.2.1 контракта домена это требование формулирует и называет цену его нарушения (`roo_code/plans/orders/orders-backend-contract.md:195`), но в семи шагах самого §4.2.1 (`:187-193`) порядок «сначала весь план» не выражен; (2) каждая выпускаемая корректировка — отдельный вызов `mockCreateInvoice` (`mocks/orders.ts:2723`), то есть отдельный шаг версии → находка 6.
- Источник истины: мок + клиент.

### POST /api/orders/:id/items/:id/split
- Вызывающий: `src/services/ordersService.ts:249`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:988`
- Форма запроса: `{ shippedQuantity, version }` (`src/services/ordersService.ts:243-249`, разбор `mocks/index.ts:990`).
- Форма ответа: `ApiResponse<{ shipped: OrderItem; remainder: OrderItem }>` (`src/services/ordersService.ts:248`; `mocks/orders.ts:2806`). Остаток получает новый id `oi-N` из счётчика заказа (`:2789`), а нумерация строк пересобирается по позициям (`:2799`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2773`), `ORDER_VERSION_CONFLICT` (`:2774`), `ORDER_ITEM_NOT_FOUND` (`:2776`), `NUMBER_NOT_FINITE` (`:2777`), плюс `SPLIT_MUST_MATCH_SHIPPED` и `INVALID_SPLIT_QUANTITY` из арифметики (`src/domain/orderPricing.ts`, вызов `mocks/orders.ts:2780`).
- Save-режим: quick-action карточки — вызывается ровно с `line.shippedQuantity`, то есть «отрезать уехавшее» (`src/composables/useOrderCard.ts:1568`).
- Пробел контракта: разделение **не спрашивает про неделимый кусок**, в отличие от правки количества (`QUANTITY_SPLITS_OFFCUT`, `src/services/orderLineEdits.ts:159`): `splitAllocations` режет разбивку по количеству (`mocks/orders.ts:2782`), и §6 контракта домена сам называет четыре места, где неделимость обязана стоять, — добавление, правка количества, отгрузка, возврат (`roo_code/plans/orders/orders-backend-contract.md:414`), — а разделение среди них не названо → находка 8.
- Источник истины: мок + клиент.

### POST /api/orders/:id/payments
- Вызывающий: `src/services/ordersService.ts:385`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1041`
- Форма запроса: `{ amount, purpose?, paidAt?, invoiceId?, note?, version? }` (`src/services/ordersService.ts:371-387`), с обязательным `Idempotency-Key` (`:386`).
- Форма ответа: `ApiResponse<Payment>` (`src/types/order.ts:419-428`; `mocks/orders.ts:4002`). `purpose` **выводится из знака суммы**, а не берётся из ярлыка: минус всегда `refund` (`:3972`, причина `:3967-3971`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3959`), `ORDER_VERSION_CONFLICT` (`:3960`), `NUMBER_NOT_FINITE` (`:3964`), `PAYMENT_AMOUNT_REQUIRED` (`:3965`), `REFUND_MUST_BE_NEGATIVE` (`:3966`), `REFUND_INVOICE_REQUIRED` (`:3979`), `PAYMENT_INVOICE_NOT_FOUND` (`:3983`).
- Save-режим: quick-action карточки (`src/composables/useOrderCard.ts:1015`), с полным перечитыванием после.
- Пробел контракта: (1) у **пришедших** денег `invoiceId` необязателен, у возврата обязателен (`mocks/orders.ts:3979`) — правило есть в §4.6 (`roo_code/plans/orders/orders-backend-contract.md:294`), но проверка «названный документ принадлежит этому заказу» шире, чем сказано: она принимает и корректировку (`mocks/orders.ts:3982`), тогда как сводка счетов клиента корректировку без исходного документа в привязку **не** берёт (`:4069-4074`); (2) `paidAt` принимается от клиента без проверки формата (`:3990`), при том что §3 требует однородного ISO-8601 (`orders-backend-contract.md:103`).
- Источник истины: мок + клиент.

### POST /api/orders/:id/reserve
- Вызывающий: `src/services/ordersService.ts:360`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1059`
- Форма запроса: `{ version }` и больше ничего (`src/services/ordersService.ts:356-360`, разбор `mocks/index.ts:1061`) — «зарезервировать весь неотгруженный остаток».
- Форма ответа: `ApiResponse<StockReservation[]>` — **только вновь созданные** удержания (`mocks/orders.ts:3930`), а не все резервы заказа; повторный вызов на полностью зарезервированном заказе вернёт пустой массив, и карточка именно так и различает два случая в тосте (`src/composables/useOrderCard.ts:900-902`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3848`), `ORDER_VERSION_CONFLICT` (`:3849`). Нехватка отказом **не является**: держится только то, что действительно свободно (`computeAvailable`, `:3904`), остальное молча не держится.
- Save-режим: quick-action карточки со сбросом несохранённого перед вызовом (`src/composables/useOrderCard.ts:897-899`).
- Пробел контракта: (1) удержание ставится **по строке**, а не по заказу, и своё же удержание из доступного вычитается через `exceptLine` (`mocks/orders.ts:3881-3883`, `:3906`; механизм — `src/services/mocks/reservations.ts:47-60`) — §4.4 контракта домена это называет (`roo_code/plans/orders/orders-backend-contract.md:209`), а формы ответа не описывает вовсе; (2) резерв рождает уведомление «склад готов», и только на переходе (`mocks/orders.ts:3855`, `:3929`) — обязанность, которой в контракте домена нет ни строки.
- Источник истины: мок + клиент.

### POST /api/orders/:id/returns
- Вызывающий: `src/services/ordersService.ts:351`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1050`
- Форма запроса: `{ lines: [{ lineId, quantity, condition, compensated }], reason, returnedAt?, version? }` (`src/services/ordersService.ts:333-353`), с обязательным `Idempotency-Key` (`:352`). Две оси строки независимы: состояние товара и возврат денег — разные вопросы (`src/types/order.ts:302-316`).
- Форма ответа: `ApiResponse<OrderReturn>` (`src/types/order.ts:338-352`; `mocks/orders.ts:3837`), с `restored` на каждой строке и с идентификаторами выпущенных корректировок (`:3752`, `:3813`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3673`), `ORDER_VERSION_CONFLICT` (`:3674`), `RETURN_REASON_REQUIRED` (`:3677`), `RETURN_HAS_NO_LINES` (`:3678`), `DUPLICATE_RETURN_LINE` (`:3682`), `NUMBER_NOT_FINITE` (`:3686`), `RETURN_QUANTITY_MUST_BE_POSITIVE` (`:3687`), `ORDER_ITEM_NOT_FOUND` (`:3694`), `RETURN_EXCEEDS_SHIPPED` (`:3696`), `RETURN_BATCH_NOT_FOUND` (`:3704`, `:3721`), `RETURN_SPLITS_OFFCUT` (`:3721`).
- Save-режим: quick-action карточки (`src/composables/useOrderCard.ts:814`).
- Пробел контракта: (1) возврат пишет **два** движения на бракованную строку — `return`, затем `write-off` (`mocks/orders.ts:3774`, `:3786-3787`), и это правило §2 контракта домена (`roo_code/plans/orders/orders-backend-contract.md:79`), а в шагах §4.5.1 оно названо одной фразой (`:256`); (2) `shippedQuantity` **не уменьшается**, растёт отдельное `returnedQuantity` (`mocks/orders.ts:3802`, причина — `src/types/order.ts:119-125`); (3) удержание назад **не ставится**, в отличие от отмены отгрузки (`mocks/orders.ts:3832-3834`); (4) каждая корректировка — отдельный `mockCreateInvoice` (`:3807`), то есть отдельный шаг версии → находка 6.
- Источник истины: мок + клиент.

### POST /api/orders/:id/services
- Вызывающий: `src/services/ordersService.ts:179`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1085`
- Форма запроса: `{ serviceId, quantity, price?, discountPercent?, version? }` (`src/services/ordersService.ts:168-179`). Себестоимость и имя берутся **из каталога услуг**, а не от клиента (`serviceEntry`, `mocks/orders.ts:371-382`, вызов `:2415`), имя — на языке каталога (`:378`).
- Форма ответа: `ApiResponse<OrderService>` (`src/types/order.ts:161-191`; `mocks/orders.ts:2431`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:2402`), `ORDER_VERSION_CONFLICT` (`:2403`), `NUMBER_NOT_FINITE` (`:2404-2408`), `ZERO_QUANTITY` (`:2412`), `CATALOG_SERVICE_NOT_FOUND` (`:376`) — имя кода выбрано так, чтобы не быть подстрокой `ORDER_SERVICE_NOT_FOUND` (`:373-375`), см. аудит services, «Правила домена…», п. 8.
- Save-режим: clean-slate, шаг 2 сохранения, сразу после товарных строк (`src/composables/useOrderCard.ts:457-472`); второй вызывающий — создание заказа (`src/composables/useOrderCreate.ts:458-465`).
- Пробел контракта: услуга рождается без `unit` и без валюты — их у строки услуги нет вовсе (`src/types/order.ts:161-191`), тогда как каталог хранит и то, и другое (`currencyId`, `uomId`; см. аудит services, графа «Значения по умолчанию»). То есть подпись цены услуги в заказе не воспроизводима, и §4.2 контракта домена этого не оговаривает.
- Источник истины: мок + клиент.

### POST /api/orders/:id/shipments
- Вызывающий: `src/services/ordersService.ts:294`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1034`
- Форма запроса: `{ lines: [{ lineId, quantity }], carrier?, vehicle?, waybillNumber?, shippedAt?, version? }` (`src/services/ordersService.ts:277-296`), с обязательным `Idempotency-Key` (`:295`, причина — `:289-293`).
- Форма ответа: `ApiResponse<Shipment>` (`src/types/order.ts:287-298`; `mocks/orders.ts:3357`). Номер накладной сервер выдаёт сам, если клиент не назвал (`:3305`); `heldReleased` на строке — `null` при создании и заполняется тем, что реально снято (`:3310`, `:3329`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3270`), `ORDER_VERSION_CONFLICT` (`:3271`), `SHIPMENT_HAS_NO_LINES` (`:3272`), `SHIPMENT_EXCEEDS_STOCK` (`:3276`, `:3293`), плюс отказы планировщика: `ORDER_ITEM_NOT_FOUND` (`:3109`), `DUPLICATE_SHIPMENT_LINE` (`:3115`), `SHIPMENT_QUANTITY_MUST_BE_POSITIVE` (`:3122`), `SHIPMENT_EXCEEDS_REMAINING` (`:3124`).
- Save-режим: quick-action карточки, со сбросом несохранённого перед вызовом — строки, на которые ссылается отгрузка, обязаны уже существовать на сервере (`src/composables/useOrderCard.ts:726-733`).
- Пробел контракта: (1) **отгрузка — единственное, что двигает склад**, и делает это одним движением `sale` на партию (`mocks/orders.ts:3338-3351`); движение по куску пишется против его родительской партии с заполненным `offcutId`, и металл партии второй раз не уходит (`:3279-3294`, `:3340`) — §4.5 это описывает (`roo_code/plans/orders/orders-backend-contract.md:228`), но в списке шагов (`:222-227`) случая с куском нет; (2) снятие удержания идёт с **тех же** партий, что и списание (`releaseFromLineOnBatches`, `mocks/orders.ts:3327`), — правило §2 (`orders-backend-contract.md:67`), и в перечне обязанностей §4.5 названо только «запомнить, сколько сняли» (`:225`).
- Источник истины: мок + клиент.

### POST /api/orders/:id/shipments/:id/cancel
- Вызывающий: `src/services/ordersService.ts:310`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1012`
- Форма запроса: `{ correctionReason?, version? }`, тело со значением по умолчанию `{}` (`src/services/ordersService.ts:305-310`). `Idempotency-Key` здесь **не шлётся**, в отличие от трёх соседних POST.
- Форма ответа: `ApiResponse<Shipment>` — отгрузка с `cancelled: true` (`mocks/orders.ts:3420`, `:3505`). Отгрузка никогда не удаляется: возврат делается обратными движениями `return` (`:3429-3439`).
- Коды ошибок: `ORDER_NOT_FOUND` (`mocks/orders.ts:3375`), `ORDER_VERSION_CONFLICT` (`:3376`), `SHIPMENT_NOT_FOUND` (`:3378`), `SHIPMENT_ALREADY_CANCELLED` (`:3379`), `SHIPMENT_ALREADY_INVOICED` — когда документ у клиента есть, а причина не названа (`:3386`), `FORBIDDEN_CORRECTION` (`:3390` → `:1858`), `SHIPMENT_BATCH_NOT_FOUND` (`:3403`).
- Save-режим: quick-action карточки со сбросом несохранённого (`src/composables/useOrderCard.ts:749-760`).
- Пробел контракта: (1) отмена **возвращает удержание** — но только в пределах того, что сейчас реально свободно (`mocks/orders.ts:3465-3502`), и разница с возвратом товара названа прямо (`:3451-3463`); §4.5 сводит это к полуфразе «возврат удержания в пределах того, что реально свободно» (`roo_code/plans/orders/orders-backend-contract.md:230`); (2) отмена выпускает корректирующий счёт по каждому живому документу отгрузки (`mocks/orders.ts:3413`), то есть поднимает версию столько раз, сколько документов, плюс свой шаг (`:3504`) → находка 6; (3) `Idempotency-Key` не шлётся, хотя операция двигает склад и выпускает документы — ровно те две причины, по которым §3 требует ключ у отгрузки и возврата (`orders-backend-contract.md:93`) → находка 9.
- Источник истины: мок + клиент.

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец: **из четырёх финансовых величин настроек заказ читает одну.** Маржа приходит из справочника арендатора — `mockGetSettings().constants.defaultMargin` (`mocks/orders.ts:1633`), а скидка, ставка НДС и валюта стоят **литералами** `0`, `21` и `'EUR'` (`:1634`, `:1637`, `:1638`), хотя настройки владеют всеми тремя: `defaultDiscountPercent`, `vatRate`, `defaultCurrency` (`src/types/settings.ts:15-18`, сид `src/services/mocks/settings.ts:53-56`; тот же перечень со стороны настроек — см. аудит settings, графа «Значения по умолчанию»). Цена расхождения измерима на месте: страница создания считает превью итога по `settings.constants.vatRate` (`src/composables/useOrderCreate.ts:364`) и подставляет `settings.constants.defaultCurrency` в форму (`:43`), а сервер запишет 21 и `'EUR'` → находка 7. `vatMode` выводится из `documentType` дважды — на сервере (`mocks/orders.ts:1636`) и вторым экземпляром в форме создания (`src/composables/useOrderCreate.ts:358-359`). Базовая валюта себестоимости строки берётся правильно, через одну функцию (`baseCurrencyOf`, `src/services/orderLines.ts:153-161`, применение `mocks/orders.ts:2186`). Прочие константы: статус нового заказа `'new'` (`mocks/orders.ts:1630`); размер страницы `25` — дважды, дефолтом `usePagination()` (`src/composables/usePagination.ts:3`) и дефолтом ветки мока (`src/services/mocks/index.ts:557`); перечень размеров `10/25/50/100` — константа в компоненте (`src/views/admin/orders/OrdersListPage.vue:61-66`), справочника под него нет; глубина дашборда — `pageSize: 5` (`src/composables/useSalesCrmDashboard.ts:42`). Кому принадлежат размер страницы и почему три из четырёх умолчаний заказа — литералы, — **нигде**, вынесено в `00-решения-владельца.md`.
- События и уведомления: **домен рождает три события из семи, и все три — на переходе, а не на записи.** `notifyOrderStatusChanged` только когда статус действительно сменился (`mocks/orders.ts:1837`, условие там же), `notifyWarehouseReady` только когда заказ стал полностью зарезервирован, а до этого не был (`:3855`, `:3929`), `notifyPaymentReceived` только для положительной суммы — возврат денег не «поступление оплаты» (`:4001`). Все три доказаны спекой (`src/services/mocks/notification-triggers.spec.ts`), и правило «событие — это переход, а не момент» выведено соседом: см. аудит notifications, «Правила домена…», п. 4 и п. 5. Ничего не рождают: создание заказа (`:1679`), добавление и правка строки, отгрузка (`:3356`), её отмена (`:3504`), возврат (`:3836`), выпуск счёта (`:4444`), корректировка строки (`:2733`), удаление заказа (`:2074`) — `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` → `6`, из них три импорта (`:123-125`) и три вызова. Обязан ли сервер сообщать об отгрузке, о выставленном счёте, о возврате и о корректировке выданного документа — **нигде**, вынесено в `00-решения-владельца.md`.
- Запись в аудит-лог: **этот домен — единственный из девяти, который свой журнал ПИШЕТ.** У соседей лог засеян и не пополняется (см. аудит warehouse, графа «Запись в аудит-лог»: пять журналов и ни одного `push`; аудит products, там же; аудит clients, там же). Здесь единственный путь записи — `appendHistory` (`mocks/orders.ts:1874-1893`), и он же выдаёт записи две вещи, которые она обязана иметь: собственный `id` вида `au-N` из счётчика когда-либо написанных, а не из длины списка (`:1879`, причина — `:145-151`), и полный ISO-8601 в отметке времени (`:1880`, причина — `:1866-1872`). Пишущих операций **семь**, и идут они двумя путями: смена статуса зовёт `appendHistory` напрямую (`:1827`), остальные шесть — через обёртку `recordInHistory` (`:1896-1913`, вызов `:1905`), которая добавляет автора и признак `sensitive`: ручная себестоимость товара (`:2256`) и услуги (`:2319`), корректировка себестоимости (`:2695`) и цены (`:2710`), корректировка отгрузки (`:3442`), возврат (`:3817`). Замер: `grep -n "appendHistory(" …` → `1827`, `1874` (определение), `1905`; `grep -c "recordInHistory(" …` → `7` вместе с определением на `:1896`. Автор — `actingUser()` из профиля настроек, то есть **отображаемое имя, а не id пользователя** (`:1847-1853`). Признак `sensitive: 'cost' | null` присутствует **всегда** (`:1884`, тип — `src/types/order.ts:591-606`), и записи с `'cost'` не отдаются роли без права `seeCost` (`mocks/orders.ts:1384-1386`). **Не пишутся**: создание и удаление заказа, добавление и удаление строки, отгрузка, выпуск счёта, платёж, резерв, файлы. Полный перечень того, что обязано попадать в историю, и чем должен быть автор записи — **нигде**, вынесено в `00-решения-владельца.md`.
- Кастомные поля: **у заказа их нет ни в каком виде.** `grep -c "fieldValues\|FieldDefinition\|fieldId" frontend_vue/src/types/order.ts frontend_vue/src/services/mocks/orders.ts frontend_vue/src/services/ordersService.ts` → `0` у всех трёх. Библиотека определений домена `config` к заказу не привязана: 18 попаданий `order` в `frontend_vue/src/services/mocks/config.ts` — это поля сортировки `order: 0…4` секций карточки поставщика (`:118`, `:132`, `:144`, `:156`, `:168`, `:314`) и ни одно не про заказ. Ближайшее к «произвольным данным» — свободный `notes` (`src/types/order.ts:494`) и файлы (`:496`). Наблюдение: домен обходится фиксированной схемой, как и `clients` (см. аудит clients, графа «Кастомные поля»).
- Настройки, которых мок не отслеживает: четыре, каждая — прямое наблюдение. (1) **Справочник статусов заказа принадлежит настройкам, а перечисление — фронту, и мост между ними держится на имени.** Настройки хранят пятнадцать записей `st-<имя>` (`src/services/mocks/settings.ts:208-346`, `grep -c "id: 'st-"` → 15), фронт хранит те же пятнадцать имён константой (`src/domain/orderStatus.ts:15-31`), а `statusRules` соединяет их конкатенацией `st-${status}` (`mocks/orders.ts:1735`). Статус, заведённый через настройки, получает id `st-<N>` (`src/services/mocks/settings.ts:544`) — такого имени в перечислении нет, `isOrderStatus` его отвергнет (`mocks/orders.ts:1806`), а `statusRules` не найдёт. (2) **Оба флага перехода в сиде выключены у всех пятнадцати**: `grep -c "reserveOnTransition: true"` → `0`, `writeOffOnTransition: true` → `0` при пятнадцати `false` (`src/services/mocks/settings.ts:208-346`) — то есть под моками смена статуса склад не двигает никогда → находка 5. (3) **Права заказа живут в чужом домене**: их отдаёт `GET /api/settings/order-permissions` (`src/services/mocks/settings.ts:440-442`, сид `:62-66`), а применяют `useOrderPermissions` во фронте (`src/composables/useOrderPermissions.ts:28-30`) и `requireRight`/`maySeeCost` на «сервере» (`mocks/orders.ts:1855-1860`, `:1391-1394`). Это ровно тот сквозной случай, который скил велит собирать одной серийной задачей (`roo_code/skills/api-contract.md:250-258`). (4) **Единица строки заказа — строка, а не ссылка на справочник**: `unit: string` (`src/types/order.ts:89`), и обратное преобразование в id справочника делается ровно в одном месте, при записи дефицита (`uomIdFromOrderLineUnit`, `mocks/orders.ts:3042`). Плюс `vatPercent` хранится на заказе (`src/types/order.ts:467`) и после создания за настройками не следует.
- Мультиарендность: **не выражена нигде.** Во фронте: `grep -ci "tenant" frontend_vue/src/types/order.ts frontend_vue/src/services/mocks/orders.ts frontend_vue/src/services/ordersService.ts` → `0` у всех трёх; ни `tenantId` в форме, ни заголовка в клиенте (`src/services/ordersService.ts` — единственные заголовки это `If-Match` `:42` и `Idempotency-Key` `:295`, `:352`, `:386`). Хранилище мока — один плоский `STORE` на процесс (`mocks/orders.ts:968`). На бэкенде: модуля нет, таблицы заказа нет, `tenant_id` объявлен у моделей десяти других модулей — но не здесь. То есть чем ограничивается выборка заказа, не задано **ни таблицей, ни колонкой, ни параметром**. Вынесено в `00-решения-владельца.md`.
- Права — в какой функции проверяются: **два write-права из трёх проверяются в той же функции, что пишет, и это единственный домен, где так.** `requireRight` (`mocks/orders.ts:1855-1860`) зовётся из пяти мест: `PATCH /items/:id` (`:2237`), `PATCH /services/:id` (`:2307`), `POST /items` через `refuseStatedCost` (`:1998`), `POST /items/:id/correct` (`:2631`), `POST /shipments/:id/cancel` — когда документ у клиента есть (`:3390`). Роль берётся из профиля настроек (`:1847-1853`), у настоящего сервера это была бы сессия. **Третье право, `seeCost`, применяется только к истории заказа** (`:1384-1386`): `unitCost`, `costSource`, `allocations` и `marginPercent` отдаются всем, и §5 контракта домена называет это занавеской, а не правом, и объясняет, почему вторую половину пока нельзя включить (`roo_code/plans/orders/orders-backend-contract.md:389-396`). Во фронте три маршрута домена закрыты фича-флагом `adminOrders` (`src/router/index.ts:150`, `:156`, `:162`; флаг — `src/config/featureFlags.ts:23`), а это признак тарифа, не роли. В матрице прав домена `config` заказов нет ни строкой (`grep -n "order" frontend_vue/src/services/mocks/config.ts` — восемнадцать попаданий, все `order: N` сортировки секций поставщика). Когда сервер начнёт вырезать себестоимость и что фронт обязан делать в этом режиме — **нигде**, вынесено в `00-решения-владельца.md`.
- Транзакционность и идемпотентность: `Idempotency-Key` шлют три POST — отгрузка, платёж, возврат (`src/services/ordersService.ts:295`, `:352`, `:386`), и мок кеширует ответ по ключу (`withIdempotency`, `src/services/mocks/index.ts:261-269`, применение `:1030-1057`); у кеша нет ни срока, ни привязки к пути — `Map` на процесс (`:260`). **Отмена отгрузки ключа не шлёт**, хотя двигает склад и выпускает документы → находка 9. Версия спрашивается 22 мутациями из 23 (`grep -c "assertVersion(order" frontend_vue/src/services/mocks/orders.ts` → 23, из них одна — определение `mocks/orders.ts:1938`; не спрашивает только создание заказа, у которого версии ещё нет), при том что §3 контракта домена говорит «все двадцать» (`roo_code/plans/orders/orders-backend-contract.md:97`). **Правило «одна принятая запись — один шаг» (`:101`) нарушено в пяти местах**: смена статуса (`mocks/orders.ts:1820`, `:1823`, `:1826`), корректировка строки (`:2723`, `:2733`), возврат (`:3807`, `:3836`), отмена отгрузки (`:3413`, `:3504`) и выпуск корректировки, отзывающей документ с услугами (`:4424`, `:4444`) → находка 6. «Сначала проверить всё, потом писать» реализовано в трёх операциях, которые двигают склад и документы: `planShipment` (`:3099-3218`), план возврата (`:3690-3733`), план корректировки (`:2648-2687`). **Между запросами транзакции нет ни одной**: одно нажатие Save карточки рассыпается на `1 + N + M + K + L` последовательных запросов (`src/composables/useOrderCard.ts:418-533`), и падение в середине оставляет первую половину применённой — очередь при этом намеренно не опустошается, чтобы повтор не создал строку второй раз (`:430-434`). Что обязано быть атомарным — вынесено в `00-решения-владельца.md`.
- Производные значения (считать, не хранить): **девять на заказе, три на строке, три в списке и три отдельно, и все считаются при записи или при чтении.** На заказе — `totalCost`, `totalAmount`, `totalVat`, `totalWithVat`, `actualMarginPercent`, `effectiveDiscountPercent`, `paidAmount`, `paidPercent`, `outstandingAmount`: один `recalcOrder` (`mocks/orders.ts:179-226`, присвоения `:205-215`), и он же валидирует каждую строку до записи (`:185`). Исключение — `totalWeight`: он вводится руками, пока ни у одного товара нет веса (`:220-225`, тип — `src/types/order.ts:483-487`). На строке — `unitPrice`, `totalPrice`, `discount` как проекция для старых частей интерфейса (`src/types/order.ts:132-138`, сборка `projectItem` из `src/services/orderLines.ts`), и `state`, выводимое из количеств, а не ставимое руками (`syncLineState`, `mocks/orders.ts:3320`). В списке — `itemCount` (`:1494`), `shippedPercent` — доля, посчитанная **в деньгах**, потому что количества разных единиц не складываются (`:1497` → `:235-240`), и `totalPages` (`:1562`). Отдельно: `costTopUp` — лестница «что полка даст следующим», собирается при каждом чтении заказа и никогда не хранится (`:1373` → `:2938-2953`, причина — `src/types/order.ts:501-529`); `documentIssued` — производное от **живых** счетов, а не флаг, потому что строка может быть в двух документах (`refreshDocumentFreeze`, `mocks/orders.ts:4492-4522`); `purpose` платежа выводится из знака суммы (`:3972`); `withdrawsOriginal` счёта выводится из того, названа ли сумма (`:4337`). Наконец, две сводки для чужих доменов считаются целиком и одним запросом: счета клиента (`mockGetClientInvoiceSummary`, `:4055-4124`) и реестр входящих (`orderReceivables`, `:4710-4752`), причём арифметика «сколько выставлено и сколько пришло» вынесена в домен и не дублируется (`invoiceBalances`, `src/domain/receivable.ts`, комментарий `mocks/orders.ts:4700-4707`). Обратное направление тоже есть: заказ **регистрирует** себя у каталога товаров, чтобы тот считал среднюю цену продажи (`registerProductSalesLookup`, `:1311`), — правило, уже описанное соседом (см. аудит products, графа «Производные значения», п. 2).

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет. У этого домена контракт уже написан
([`orders-backend-contract.md`](../../orders/orders-backend-contract.md)), поэтому ниже —
только то, чего в нём **нет ни строкой**, и то, где он расходится с кодом.

1. **`costTopUp` — поле ответа, которого контракт не знает.** `grep -c "costTopUp" roo_code/plans/orders/orders-backend-contract.md` → `0`. Между тем это обязательная часть `GET /api/orders/:id`: лестница «что полка даст каждой товарной строке следующим», собираемая при каждом чтении и никогда не хранимая (`mocks/orders.ts:1373` → `topUpLadder`, `:2938-2953`; тип и причина — `src/types/order.ts:501-529`). Ключ — id строки, и держать её на самой строке нельзя: строку сравнивают полем к полю между локально применённой правкой и сохранённой, а величина, зависящая от полки, развела бы их по причине, к правке не относящейся (`src/types/order.ts:521-527`). Отсутствующая запись означает «от склада ответа нет», и клиент тогда себестоимость не трогает (`:525-527`).
2. **`namedUnitPrice` — тоже поле, которого контракт не знает.** `grep -c "namedUnitPrice" roo_code/plans/orders/orders-backend-contract.md` → `0`, при том что §7 описывает саму развилку прозой (`roo_code/plans/orders/orders-backend-contract.md:444`): «цена хранится» и «цена зафиксирована» — разные утверждения, и строка делает ровно одно из двух. Поле есть и у товарной строки (`src/types/order.ts:114`), и у услуги (`:176`), и никогда не ставится вместе с `manualUnitPrice` (`:107-113`). Без него в схеме бэкенд получит одну колонку под два разных смысла.
3. **Ответ никогда не содержит внутренней бухгалтерии сервера.** `publicOrder` вырезает все поля, начинающиеся с `_` (`mocks/orders.ts:1369-1372`) — семь счётчиков и три поля подготовки сценариев (`:139-168`). Это не деталь мока: схема, снятая с такого ответа, иначе получила бы колонки `_nextLineSeq` и `_pendingShipments`.
4. **Порядок веток разбора — часть контракта, и в моке он зафиксирован комментарием.** Восемь вложенных GET-путей разбираются **раньше** голого `/api/orders/:id`: `status-plan` (`src/services/mocks/index.ts:563`), `ship-plan` (`:574`), `shipments` (`:579`), `return-plan` (`:586`), `returns` (`:591`), `payments` (`:596`), `invoices` (`:601`), `reservations` (`:606`) — и только потом карточка (`:611`); причина названа прямо (`:584-585`). У сервера с одним маршрутом `/{order_id}` порядок был бы обратным — тот же класс, что у соседа (см. аудит products, «Правила домена…», п. 18).
5. **Без явного `sortBy` список сортируется по `createdAt` вниз — это умолчание, а не порядок хранилища.** `mocks/orders.ts:1548-1549`. У соседнего домена то же место сделано иначе и отдаёт сырой порядок (см. аудит products, «Правила домена…», п. 7), поэтому назвать это здесь необходимо: два списка, ведущих себя по-разному без параметра, — два разных API.
6. **Демо-хранилище держится тех же правил, что приложение, и это выражено кодом, а не договорённостью.** Отгрузки сценариев создаются настоящим `mockCreateShipment` (`mocks/orders.ts:982-1039`), а не объектом, положенным в заказ, — иначе демо утверждало бы, что товар уехал, пока он лежит на полке (причина — `:156-162`); показательный возврат — настоящим `mockCreateReturn` (`:4524`, причина `:4515-4523`); сборка сида глушит уведомления через `seedQuietly` (`:4578`, `:4676`) — правило соседа, см. аудит notifications, «Правила домена…», п. 9. И отдельно: заказ-витрина `ORD-100` и сценарные заказы **зарезервированы** — на них ничего не досеивается, потому что их состояние пришпилено тестами (`:4527-4531`, `:4613`).
7. **Переплата не зажимается нулём.** `orderReceivables` отдаёт отрицательный остаток как есть (`mocks/orders.ts:4741`), и причина с датой решения владельца записана рядом (`:4734-4740`). Карточка заказа разбирает такой остаток в состояние «переплачено», то есть три места согласованы намеренно.
8. **Срок оплаты счёта выводится из снимка условий клиента, а не из карточки клиента.** `receivableDueDate(invoice.issuedAt, order.clientPaymentTermsDays)` (`mocks/orders.ts:4721`); снимок делается при создании заказа (`:1628`), и правило «реквизиты, попавшие в заказ, замораживаются» уже выведено соседом — см. аудит clients, «Правила домена…», п. 6.
9. **Ключ идемпотентности живёт в `Map` на процесс, без срока и без привязки к пути.** `src/services/mocks/index.ts:260-269`. То есть один и тот же ключ, посланный на отгрузку и на платёж, вернул бы первый ответ на оба; контракт §3 требует только «сервер запоминает ключ вместе с ответом» (`roo_code/plans/orders/orders-backend-contract.md:93`) и области действия ключа не задаёт.
10. **`STORE` — один плоский массив на процесс, и порядок в нём значим.** `mocks/orders.ts:968`; id выдаётся отдельным счётчиком, а не по длине массива, — иначе номер повторился бы после удаления, а из него собираются номера накладных и счетов (`:1355-1357`, причина `:1615-1617`). Тот же дефект у двух соседей не закрыт (см. аудит products, «Правила домена…», п. 3, и аудит warehouse, п. 14) — здесь он закрыт.
11. **Три числа контракта разошлись с кодом.** §3 говорит «спрашивают все двадцать» мутаций (`roo_code/plans/orders/orders-backend-contract.md:97`) — вызовов `assertVersion` двадцать два (`grep -c "assertVersion(order" frontend_vue/src/services/mocks/orders.ts` → 23, минус определение `mocks/orders.ts:1938`); §4.1 обещает у удаления записи истории ответ `Order` (`roo_code/plans/orders/orders-backend-contract.md:118`) — клиент и мок дают `void` (`src/services/ordersService.ts:194`); §6 перечисляет `SHIPMENT_ALREADY_INVOICED` в разделе склада (`roo_code/plans/orders/orders-backend-contract.md:416`), а мок бросает его и из выпуска счёта (`mocks/orders.ts:4360`), то есть код принадлежит двум операциям.

## Находки про код → contract-sync-orders-bugs.md

Одиннадцать находок, все записаны в
[`../../bugs/contract-sync-orders-bugs.md`](../../bugs/contract-sync-orders-bugs.md).
Код не тронут: `git status` по `frontend_vue/src` и `backend/` чист.

| № | Файл | Суть |
|---|---|---|
| БАГ-01 | `src/services/mocks/orders.ts:1599-1602` | `GET /orders/:id` на неизвестный заказ отдаёт `undefined`, и карточка падает на `order.value.version` |
| БАГ-02 | `src/services/mocks/orders.ts:2057-2058` | `DELETE /orders/:id` на неизвестный id отвечает успехом — до проверки версии |
| БАГ-03 | `src/composables/useOrders.ts:46` | удаление заказа из списка не шлёт версию; в `OrderListItem` её и нет |
| БАГ-04 | `src/services/ordersService.ts:61-65`, `src/services/api.ts:154-155` | `clientId: null` и `sortBy: null` уезжают в query литералом `"null"` |
| БАГ-05 | `src/services/mocks/settings.ts:208-346` | ни один из пятнадцати статусов не резервирует и не списывает — путь §4.5 под моками мёртв |
| БАГ-06 | `src/services/mocks/orders.ts:1820-1826` | пять мутаций поднимают версию больше одного раза при правиле «один шаг» |
| БАГ-07 | `src/services/mocks/orders.ts:1634-1638` | скидка, НДС и валюта нового заказа — литералы, хотя настройки ими владеют |
| БАГ-08 | `src/services/mocks/orders.ts:2782` | разделение строки не спрашивает про неделимый кусок |
| БАГ-09 | `src/services/ordersService.ts:305-311` | отмена отгрузки не шлёт `Idempotency-Key`, хотя двигает склад и выпускает документы |
| БАГ-10 | `src/services/ordersService.ts:198-204` | `POST /files` объявлен `void`, возвращает `OrderFile`, и не проверяет `fileId` |
| БАГ-11 | `src/composables/useOrders.ts:38` | ошибка загрузки списка печатается как текст исключения |

## Строки, вынесенные владельцу

Шесть, все дописаны в конец
[`00-решения-владельца.md`](00-решения-владельца.md): значения по умолчанию, события и
уведомления, запись в аудит-лог, мультиарендность, права (`seeCost`), транзакционность.
