# Orders

Заказ клиента: строки, услуги, склад, отгрузки, возвраты, счета, платежи, файлы и история.
**Тридцать три эндпоинта** — второй по величине домен проекта после `warehouse` (37) и первый по
сложности: половина эндпоинтов пишет, и каждая запись двигает либо склад, либо документы, либо
деньги.

Общие соглашения — [`00-conventions.md`](00-conventions.md), и здесь они не повторяются. Конверт
ответа и разбор ошибки — §1; коды ядра — §2; `PATCH` против `PUT` — §3; мультиарендность — §4;
заголовки — §5; права — §6; аудит-лог — §9; уведомления — §10; идемпотентность — §11;
`TranslatedString` — §12; пагинация и сортировка — §13; даты, деньги и валюта — §14; clean-slate
против quick-action — §15; файлы — §16; производные значения — §17; чем мок отличается от
обязанностей сервера — §18; непрозрачность `id` — §19.

Аудит, из которого написан файл:
[`roo_code/plans/api/audit/orders.md`](../../plans/api/audit/orders.md).
Находки про код: [`contract-sync-orders-bugs.md`](../../plans/bugs/contract-sync-orders-bugs.md).

## Где у этого домена уже лежит контракт, и почему он остаётся на месте

У `orders` есть **свой** документ, написанный раньше этого сведения:
[`roo_code/plans/orders/orders-backend-contract.md`](../../plans/orders/orders-backend-contract.md),
498 строк, восемь разделов. Ниже он называется **контрактом домена** и цитируется как `§N`.

Он не поглощён и не переписан сюда, и на то две причины.

1. **Его §6 читает машина.** `frontend_vue/src/services/mocks/order-audit-contract-conformance.spec.ts:43-48`
   открывает файл через `readFileSync`, режет по заголовку `## 6. Коды ошибок` и сверяет три
   множества: коды, которые мок действительно бросает, коды, названные в §6, и коды, у которых
   есть сообщение человеку (`orderLineEdits.ts`, таблица `ERROR_KEYS`). Перенести каталог сюда
   значит либо сломать спеку, либо завести **второй экземпляр** каталога — а расхождение двух
   экземпляров одного правила и есть тот дефект, который она ловит.
2. **Он объясняет, а не только перечисляет.** §7 (деньги и округление), §7.1 (валюта как подпись,
   а не множитель), §7.2 (средние цены товара) — это рассуждения, у которых нет места в разделе
   эндпоинта.

Поэтому **каталог кодов ошибок домена — §6 контракта домена**, и ниже он не дублируется: у
каждого эндпоинта перечислены его коды с `файл:строка` броска, а смысл и статус кода — там.
Разделение обязанностей: этот файл отвечает на вопрос «какие эндпоинты и какие у них формы»,
контракт домена — на вопрос «по каким правилам считаются деньги и что означает каждый код».

**Контракт домена сам объявляет мок старшим** (`roo_code/plans/orders/orders-backend-contract.md:5`:
«Если что-то здесь расходится с моком — прав мок»), поэтому там, где он разошёлся с кодом, ниже
стоит расхождение, а не пересказ. Таких мест **три**, и все три названы в «Чего в домене нет».

## Источник истины — мок и клиент

**Модуля бэкенда у домена нет.** `ls backend/app/modules/` даёт десять модулей — `auth`, `bcc`,
`billing`, `finance`, `notifications`, `products`, `services`, `settings`, `suppliers`,
`warehouse`, — среди них `orders` отсутствует. Таблицы заказа, строки заказа, отгрузки, счёта и
платежа на схеме нет ни одной. Значит по всем тридцати трём эндпоинтам источник истины — второй
уровень старшинства, мок плюс клиент.

**В прежнем монолите раздела у домена нет ни одного.**
`grep -c "^### .*api/orders" roo_code/roo-context/03-api-contract.md` → `0`; путь встречается там
шесть раз, и все шесть — проза внутри чужих разделов. Поэтому «Чего в домене нет» ниже фиксирует
расхождения с **контрактом домена**, а не с монолитом: утверждений монолита о заказе не
существует.

**Метка `Статус: спроектировано` домену не подходит:** все тридцать три эндпоинта зовёт живой
клиент.

## Три сквозных механизма — здесь один раз, дальше по ссылке

**Версия заказа.** У заказа есть `version` (`types/order.ts:547`); сервер поднимает её на каждой
принятой записи (`bumpVersion`, `mocks/orders.ts:1952-1955`), клиент возвращает ту, которую видел,
и отставшая отклоняется **без единой записи** (`assertVersion`, `:1938-1941`;
`ORDER_VERSION_CONFLICT`, `:1940`). У запроса с телом версия едет **полем** `version`
(`withVersion`, `composables/useOrderCard.ts:227-229`), у `DELETE` — **заголовком** `If-Match`
(`services/ordersService.ts:41-43`), который мок разбирает (`ifMatchVersion`,
`mocks/index.ts:1420-1425`, применение `:1428`). `undefined` означает «клиент версии не читал» и
проверку **не включает** (`mocks/orders.ts:1939`). Ниже это не повторяется: где написано «версия —
полем» или «версия — `If-Match`», имеется в виду ровно этот механизм.

**Идемпотентность.** `Idempotency-Key` шлют **три** POST — отгрузка, платёж, возврат
(`services/ordersService.ts:295`, `:352`, `:386`); мок кеширует ответ по ключу (`withIdempotency`,
`mocks/index.ts:261-269`, применение `:1030-1057`). Остальные тридцать заголовка не шлют:
`grep -c "Idempotency" frontend_vue/src/services/ordersService.ts` → `4` (импорт плюс три вызова).
Одно исключение — отмена отгрузки — обсуждается в её разделе.

**Конверт.** Мок отдаёт голое значение (`delay(...)`, `mocks/index.ts:255-257`), живой клиент
разворачивает `ApiResponse<T>` (`services/api.ts:128-138`). Формы ответа ниже записаны так, как их
обязан прислать сервер, — **в конверте**.

---

## Заказ

### GET /api/orders

Список заказов. Единственный эндпоинт домена, у которого есть проверка запроса **до** чтения
первой строки.

Реализация: `services/ordersService.ts:57` (`getOrders`) · мок `mocks/index.ts:545` →
`mocks/orders.ts:1471` (`mockGetOrders`)
Бэкенд: **не реализован**.

**Запрос — девять query-параметров:** `search`, `status`, `clientId`, `dateFrom`, `dateTo`,
`sortBy`, `sortDir` из `OrderFilters` (`types/order.ts:618-626`) плюс `page`, `pageSize`
(`services/ordersService.ts:61-65`); разбор — `mocks/index.ts:546-559`. Поиск идёт по номеру
заказа и имени клиента (`mocks/orders.ts:1504`); `status: 'all'` означает «без фильтра»
(`:1508-1511`); обе границы дат — **дни включительно**, сравниваются срезом `createdAt.slice(0, 10)`
(`:1523`, `:1526`). Допустимых ключей сортировки восемь (`ORDER_SORT_KEYS`, `:1407-1418`), и
`orderNumber` сортируется **числом, а не строкой** (`:1541` → `services/documentNumbers.ts`).

**Ответ** — `ApiResponse<PaginatedResponse<OrderListItem>>` (`types/api.ts:8-14`,
`types/order.ts:17-38`). `totalPages` производный (`mocks/orders.ts:1562`), `shippedPercent`
считается при чтении и **в деньгах**, а не в количествах (`:1497` → `shippedPercentOf`,
`:235-240`) — количества разных единиц не складываются.

Ошибки: `UNKNOWN_SORT_KEY` (`mocks/orders.ts:1444`), `UNKNOWN_SORT_DIRECTION` (`:1447`),
`INVALID_DATE_FILTER` (`:1453`), `INVALID_PAGE` — и для `page`, и для `pageSize` (`:1465`). Все
четыре в `validateListRequest` (`:1437-1469`, вызов `:1484`).

**Фильтр `status` — единственный из семи, который не проверяется.** Остальные шесть отвергаются
на входе, а неизвестный статус просто отфильтровывает всё (`mocks/orders.ts:1508-1511`) и
отвечает пустым списком — ровно то, что §4.1 контракта домена запрещает для остальных
параметров (`orders-backend-contract.md:126`). Тип это допускает: `status: string`, а не
перечисление (`types/order.ts:620`). **Сервер обязан отвергать неизвестный статус**
`VALIDATION_ERROR`, иначе опечатка в фильтре неотличима от «заказов нет».

Save-режим: только чтение, четыре вызывающих — список заказов (`composables/useOrders.ts:33`),
дашборд CRM (`composables/useSalesCrmDashboard.ts:32`, пять свежих), карточка клиента
(`composables/useClientCard.ts:179-190`, страницами до `total`), список клиентов
(`views/admin/clients/ClientsListPage.vue:105-116`, `pageSize: 1` ради одного `total`).

**Без явного `sortBy` список сортируется по `createdAt` вниз** (`mocks/orders.ts:1548-1549`) — это
умолчание, а не порядок хранилища; у соседнего домена то же место отдаёт сырой порядок, и два
списка, ведущих себя по-разному без параметра, — два разных API.

---

### POST /api/orders

Создание пустого заказа. Единственная мутация домена **без** версии: заказа ещё нет.

Реализация: `services/ordersService.ts:72` (`createOrder`) · мок `mocks/index.ts:976` →
`mocks/orders.ts:1606` (`mockCreateOrder`)
Бэкенд: **не реализован**.

**Запрос** — `{ clientId, documentType, currency? }` (`services/ordersService.ts:72-77`). Ветка
мока типизирует тело только двумя первыми полями (`mocks/index.ts:978`), но до реализации третье
доезжает: она читает `data.currency` (`mocks/orders.ts:1638`).

**Ответ** — `ApiResponse<Order>`: пустой заказ со `status: 'new'` (`mocks/orders.ts:1630`),
`version: 1` (`:1670`) и одной записью истории «Заказ создан» (`:1662`), автор которой —
переводимая строка «Система», а не пользователь (`:1660`).

Ошибки: `CLIENT_NOT_FOUND` (`mocks/orders.ts:1613`).

**Реквизиты клиента замораживаются снимком.** Имя, код НДС, адрес и условия оплаты копируются из
карточки клиента в заказ (`mocks/orders.ts:1625-1628`, причина — `types/order.ts:447-455`):
документ обязан помнить, кому он был выставлен, а не показывать сегодняшние реквизиты.

**Три умолчания из четырёх взяты литералами, и это находка, а не решение.** Маржа приходит из
настроек арендатора (`mocks/orders.ts:1633`), а скидка (`:1634`), ставка НДС (`:1637`) и валюта
(`:1638`) стоят литералами `0`, `21` и `'EUR'` — при том что настройки владеют всеми тремя
(`defaultDiscountPercent`, `vatRate`, `defaultCurrency`, `types/settings.ts:15-18`, сид
`mocks/settings.ts:53-56`), а функция «взять базовую валюту» в домене уже есть и здесь не зовётся
(`baseCurrencyOf`, `services/orderLines.ts:153-161`). Цена расхождения измерима на месте: страница
создания считает превью итога по `settings.constants.vatRate`
(`composables/useOrderCreate.ts:364`) и подставляет `settings.constants.defaultCurrency` в форму
(`:43`), а сервер запишет `21` и `'EUR'`. **Сервер обязан брать все четыре из настроек арендатора.**

Save-режим: quick-action страницы создания — один POST, затем `PATCH` заметок, затем по запросу на
строку, услугу и файл, и в конце `GET /orders/:id`
(`composables/useOrderCreate.ts:419-477`).

---

### GET /api/orders/:id

Карточка заказа целиком.

Реализация: `services/ordersService.ts:68` (`getOrder`) · мок `mocks/index.ts:611` →
`mocks/orders.ts:1599` (`mockGetOrder`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути, параметров нет.

**Ответ** — `ApiResponse<Order>` (`types/order.ts:440-548`): со строками, услугами, отгрузками,
возвратами, счетами, платежами, файлами и историей внутри. Плюс **`costTopUp`** — лестница «что
полка даст каждой товарной строке следующим», собираемая при каждом чтении и никогда не хранимая
(`mocks/orders.ts:1373` → `topUpLadder`, `:2938-2953`; тип и причина — `types/order.ts:501-529`).
Ключ — id строки, и держать её **на самой строке нельзя**: строку сравнивают полем к полю между
локально применённой правкой и сохранённой, а величина, зависящая от полки, развела бы их по
причине, к правке не относящейся. Отсутствующая запись означает «от склада ответа нет», и клиент
тогда себестоимость не трогает.

**Ответ никогда не содержит внутренней бухгалтерии сервера.** `publicOrder` вырезает все поля,
начинающиеся с `_` (`mocks/orders.ts:1369-1372`) — семь счётчиков и три поля подготовки сценариев
(`:139-168`). Это не деталь мока: схема, снятая с такого ответа без вырезания, получила бы
колонки `_nextLineSeq` и `_pendingShipments`.

Ошибки: **ни одной.** `mockGetOrder` отдаёт `undefined` на неизвестный id
(`mocks/orders.ts:1599-1602`), тогда как остальные девять чтений домена бросают `ORDER_NOT_FOUND`
(`:1772`, `:2813`, `:3239`, `:3628`, `:3637`, `:3941`, `:4025`). **Сервер обязан отвечать
`ORDER_NOT_FOUND`** — БАГ-01.

**По праву `seeCost` этот ответ режет ровно одно:** записи истории с `sensitive: 'cost'`
(`mocks/orders.ts:1384-1386`, право — `maySeeCost`, `:1391-1394`). `unitCost`, `costSource`,
`allocations` и `marginPercent` отдаются всем, и §5 контракта домена называет это занавеской, а не
правом, и объясняет, почему вторую половину пока нельзя включить
(`orders-backend-contract.md:389-396`).

Save-режим: только чтение; перечитывается после каждой quick-action карточки
(`composables/useOrderCard.ts:381`).

---

### PATCH /api/orders/:id

Правка полей заказа. Merge-patch по белому списку.

Реализация: `services/ordersService.ts:80` (`patchOrder`) · мок `mocks/index.ts:1290` →
`mocks/orders.ts:1691` (`mockPatchOrder`)
Бэкенд: **не реализован**.

**Запрос** — только поля, которыми владеет админ, плюс `version`. Клиент шлёт **восемь**:
`notes`, `documentType`, `currency`, `vatMode`, `vatPercent`, `defaultMarginPercent`,
`defaultDiscountPercent`, `totalWeight` (`SAVABLE_FIELDS`, `composables/useOrderCard.ts:118-128`,
сборка тела `:301-305`). Мок принимает те же восемь по белому списку
(`mocks/orders.ts:1709-1719`). Подпись клиента при этом `Partial<Order>`
(`services/ordersService.ts:80`) — типом разрешено прислать что угодно из заказа, поэтому
**белый список на сервере обязателен**: всё лишнее отбрасывается молча, а не записывается.

`clientPaymentTermsDays` этот эндпоинт **не принимает** — снимок условий клиента заморожен при
создании. Сегодня правило держится отсутствием строки в белом списке, а не проверкой.

**Ответ** — `ApiResponse<Order>` целиком, включая пересчитанные производные
(`mocks/orders.ts:1728-1730`, пересчёт — `recalcOrder`, `:179-226`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:1698`), `ORDER_VERSION_CONFLICT` (`:1699`),
`NUMBER_NOT_FINITE` по шести числовым полям (`:1700-1707` → `:1978`), плюс инварианты пересчёта —
`INVALID_LINE`, `DUPLICATE_LINE_ID` (`:191`), `ALLOCATION_EXCEEDS_QUANTITY` (`:200`),
`INVALID_VAT_RATE`. Последние §6 контракта домена помечает **внутренними**: наружу выставлять
нельзя (`orders-backend-contract.md:432`).

**Смена `currency` числа не пересчитывает** (`mocks/orders.ts:1711`). Это решение, а не упущение —
§7.1 контракта домена: валюта в проекте это подпись к числу, а не множитель, курса нет нигде.
Ни кода ошибки, ни предупреждения смену не сопровождает.

Save-режим: clean-slate, **шаг 1** сохранения карточки — поля уходят первыми, потому что правки
строк ниже читаются против умолчаний заказа (`composables/useOrderCard.ts:298-311`, порядок
объяснён `:422-427`).

---

### DELETE /api/orders/:id

Реализация: `services/ordersService.ts:112` (`deleteOrder`) · мок `mocks/index.ts:1577` →
`mocks/orders.ts:2052` (`mockDeleteOrder`)
Бэкенд: **не реализован**.

**Запрос** — тела нет; версия — заголовком `If-Match` (`services/ordersService.ts:112-113`).

**Ответ** — `ApiResponse<void>` (`services/ordersService.ts:112`, мок `mocks/index.ts:1580`).

Ошибки: `ORDER_HAS_INVOICE` (`mocks/orders.ts:2062`), `ORDER_HAS_SHIPMENT` (`:2064`),
`ORDER_HAS_PAYMENT` (`:2065`), `ORDER_VERSION_CONFLICT` (`:2060`). `ORDER_NOT_FOUND`
**не бросается**: неизвестный id — молчаливый выход (`:2058`), тогда как соседние удаления домена
бросают `*_NOT_FOUND` (`:2356`, `:2446`, `:2479`, `:2530`). **Сервер обязан отвечать
`ORDER_NOT_FOUND`** — БАГ-02.

**Удаление уносит за собой два чужих следа:** резервы (`releaseOrder`, `mocks/orders.ts:2070`) и
записи дефицита (`clearShortages`, `:2074`). В таблице §4.1 контракта домена этих эффектов нет
(`orders-backend-contract.md:117`), они названы только прозой §4.2 (`:179`).

Save-режим: quick-action, два вызывающих — список (`composables/useOrders.ts:46`, **без версии**)
и карточка (`composables/useOrderCard.ts:575`, `atVersion()`). Удаление из списка версии не шлёт,
при том что §3 требует её «на каждой мутации» (`orders-backend-contract.md:97`) — БАГ-03.

---

### PATCH /api/orders/:id/status

Смена статуса. Записывающая половина двухшаговой операции: сначала читается план (`GET
/status-plan`), потом пишется статус.

Реализация: `services/ordersService.ts:99` (`patchOrderStatus`) · мок `mocks/index.ts:1259` →
`mocks/orders.ts:1793` (`mockPatchOrderStatus`)
Бэкенд: **не реализован**.

**Запрос** — `{ status, version }` (`services/ordersService.ts:99-105`, разбор
`mocks/index.ts:1260-1265`). Допустимых значений пятнадцать (`ORDER_STATUSES`,
`domain/orderStatus.ts:15-31`).

**Ответ** — `ApiResponse<Order>` целиком (`mocks/orders.ts:1838`).

Ошибки: `UNKNOWN_ORDER_STATUS` — **до** проверки версии, потому что нераспознанный статус не
стоит арбитража (`mocks/orders.ts:1806`, объяснение `:1799-1805`), `ORDER_NOT_FOUND` (`:1800`),
`ORDER_VERSION_CONFLICT` (`:1807`), `STATUS_BLOCKED_BY_STOCK` (`:1819`), плюс всё, что может
бросить вложенная отгрузка (`:1820`).

**Эта мутация поднимает версию больше одного раза.** `mockCreateShipment`
(`mocks/orders.ts:1820`) и `mockReserveOrder` (`:1823`) сами зовут `bumpVersion` (`:3356`,
`:3928`), и следом шагает сам статус (`:1826`) — §3 «одна принятая запись — один шаг»
(`orders-backend-contract.md:101`) здесь нарушено на два-три шага. Карточку это не ломает только
потому, что она перечитывает заказ целиком (`composables/useOrderCard.ts:667`). **Сервер обязан
сделать всю смену статуса одной транзакцией с одним шагом версии** — БАГ-06.

Save-режим: quick-action, двухшаговый; перед вызовом карточка обязана сбросить несохранённое
(`flushBeforeReload`, `composables/useOrderCard.ts:662`).

---

### GET /api/orders/:id/status-plan

Что смена статуса сделает со складом — до того, как её примут.

Реализация: `services/ordersService.ts:92` (`planOrderStatus`) · мок `mocks/index.ts:563` →
`mocks/orders.ts:1767` (`mockPlanStatusTransition`)
Бэкенд: **не реализован**.

**Запрос** — сегмент пути плюс обязательный query-параметр `status`
(`services/ordersService.ts:92-97`); мок подставляет `'new'`, если параметр не пришёл
(`mocks/index.ts:566-569`).

**Ответ** — `ApiResponse<StatusTransitionPlan>`: `{ status, reserves, writesOff, lines[],
shortages[] }` (`types/order.ts:278-285`, сборка — `mocks/orders.ts:1778-1790`).
`reserves`/`writesOff` берутся из справочника статусов домена `settings` по соглашению об имени
`st-<status>` (`:1733-1740`, применение `:1780`); `writesOff` дополнительно гасится, когда
отгружать нечего (`:1782`); недостача едет полем ответа (`:1789`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:1772`). **Неизвестный статус здесь не отвергается:**
`isOrderStatus` проверяется только на записи (`:1806`), а план по несуществующему `st-<опечатка>`
вернёт «не резервирует, не списывает» (`:1736-1739`). Сервер обязан отвергать его и здесь.

**Мост между перечислением статусов и справочником держится на имени и на входе не проверяется.**
Настройки хранят пятнадцать записей `st-<имя>` (`mocks/settings.ts:208-346`), фронт хранит те же
пятнадцать имён константой (`domain/orderStatus.ts:15-31`), а `statusRules` соединяет их
конкатенацией `` `st-${status}` `` (`mocks/orders.ts:1735`). Статус, заведённый через настройки,
получает id `st-<N>` (`mocks/settings.ts:544`) — такого имени в перечислении нет, `isOrderStatus`
его отвергнет, а `statusRules` не найдёт никогда.

**Под моком весь этот путь мёртв:** `grep -c "reserveOnTransition: true" frontend_vue/src/services/mocks/settings.ts`
→ `0`, `writeOffOnTransition: true` → `0` при пятнадцати записях, то есть ни один статус не
резервирует и не списывает, и §4.5 «смена статуса — это рабочий процесс отгрузки»
(`orders-backend-contract.md:234`) под моком не проверяется ничем — БАГ-05.

Save-режим: только чтение, но читается **перед** записью
(`composables/useOrderCard.ts:607`, применение `:665`).

---

## Строки заказа

### POST /api/orders/:id/items

Реализация: `services/ordersService.ts:121` (`addOrderItem`) · мок `mocks/index.ts:1075` →
`mocks/orders.ts:2079` (`mockAddOrderItem`)
Бэкенд: **не реализован**.

**Запрос** — `{ productId, quantity, unit, unitPrice, marginPercent?, discountPercent?, batchId?,
offcutIds?, version? }` (`services/ordersService.ts:121-141`).

**Себестоимости в теле нет и быть не может:** её читает сервер со склада (`coverFromStock`,
`mocks/orders.ts:2153`), а присланная отвергается вместе с проверкой права (`refuseStatedCost`,
`:1996-2000`, вызов `:2121`). `offcutIds` — **единственный** способ назвать обрезок: в
автоматический FIFO куски не попадают (`services/ordersService.ts:131-136`, разбор
`mocks/orders.ts:2142`).

**Ответ** — `ApiResponse<OrderItem>`: строка целиком с раскладкой по партиям
(`mocks/orders.ts:2205`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2105`), `ORDER_VERSION_CONFLICT` (`:2106`),
`NUMBER_NOT_FINITE` (`:2109-2114`), `ZERO_QUANTITY` (`:2118`), `FORBIDDEN_MANUALCOST` и
`MANUAL_COST_REASON_REQUIRED` (`:1998-1999`), `CATALOG_PRODUCT_NOT_FOUND` (`:2128`),
`OFFCUTS_WITH_BATCH` (`:2146`), `OFFCUTS_EXCEED_QUANTITY` (`:2151`), плюс **четыре кода чужого
домена**, которые бросает разбор выбранных кусков: `OFFCUT_NOT_FOUND`,
`OFFCUT_PRODUCT_MISMATCH`, `OFFCUT_NOT_AVAILABLE`, `OFFCUT_SIZE_NOT_EXPRESSIBLE`
(`mocks/warehouse.ts:1088-1095`).

Три правила формы, каждое — задание серверу:

- **`unit` приходит строкой и на входе не проверяется ничем** (`services/ordersService.ts:126`);
  обратное преобразование в id справочника делается только при записи дефицита
  (`uomIdFromOrderLineUnit`, `mocks/orders.ts:3042`). Сервер обязан проверять его по справочнику;
- **имя товара — снимок на языке каталога, а не читателя** (`CATALOGUE_LANGUAGE = 'en'`,
  `mocks/orders.ts:369`, применение `:2129`): документ обязан читаться одинаково у всех;
- **`receivedCurrency` строки — базовая валюта арендатора, а не валюта товара**
  (`mocks/orders.ts:2186` → `baseCurrencyOf`), §7.1 контракта домена.

Save-режим: clean-slate, **шаг 2** — новые строки уходят раньше своих правок, чтобы правке было на
что лечь (`composables/useOrderCard.ts:437-457`); `discountPercent` шлётся **явно**, иначе сервер
подставил бы своё умолчание и строка изменилась бы под админом (`:447-449`). Второй вызывающий —
создание заказа (`composables/useOrderCreate.ts:440-451`).

---

### PATCH /api/orders/:id/items/:id

Правка одной строки. **Одна правка за раз**, и порядок правок решает результат.

Реализация: `services/ordersService.ts:152` (`updateOrderItem`) · мок `mocks/index.ts:1279` →
`mocks/orders.ts:2217` (`mockUpdateOrderItem`)
Бэкенд: **не реализован**.

**Запрос** — `LineEditPayload` = `LineEditDelta & LineEditEnvelope` (`services/ordersService.ts:32`,
`services/orderLineEdits.ts:60-63`, `types/order.ts:557-574`). Карточка шлёт по запросу на правку в
том порядке, в каком их сделал человек (`composables/useOrderCard.ts:476-491`). Тело строится
только через `lineEditDelta` (`services/orderLineEdits.ts:193-214`), обратный разбор — `deltaToOps`
(`:223-257`) в фиксированном порядке «количество → сброс цены → наценка → скидка → ручная цена →
сумма строки → себестоимость».

**`resetPrice` обязан нести `defaultDiscountPercent`** — число момента нажатия, а не момента
чтения (`types/order.ts:557-571`, отправка `composables/useOrderCard.ts:486`, применение
`mocks/orders.ts:2014-2015`).

**Ответ** — `ApiResponse<OrderItem>`: строка целиком (`types/order.ts:83-154`;
`mocks/orders.ts:2278`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2223`), `ORDER_VERSION_CONFLICT` (`:2224`),
`ORDER_ITEM_NOT_FOUND` (`:2226`), `NUMBER_NOT_FINITE` по девяти полям (`validateLineEdit`,
`:2019-2038`), `ALLOCATIONS_NOT_ACCEPTED` (`:2037`), `FORBIDDEN_MANUALCOST` (`requireRight`,
`:2237` → `:1858`), `MANUAL_COST_REASON_REQUIRED` (`services/orderLineEdits.ts:97`),
`RESET_COST_NOT_SUPPORTED` (`:112`), `COST_FROZEN_BY_SHIPMENT` (`:114`), `NO_STOCK_COST` (`:119`),
`QUANTITY_SPLITS_OFFCUT` (`:159`), плюс отказы арифметики из `domain/orderPricing.ts` —
`PRICE_FROZEN_BY_SHIPMENT` (`:216`), `LINE_FULLY_SHIPPED` (`:379`), `BELOW_SHIPPED_QUANTITY`
(`:388`), `DISCOUNT_OUT_OF_RANGE`, `MARGIN_OUT_OF_RANGE`, `NEGATIVE_PRICE`, `NEGATIVE_COST`,
`NEGATIVE_QUANTITY`, `ZERO_QUANTITY`, `NO_COST_TO_MARK_UP`.

**Правка перечитывает себестоимость и переносит разницу в наценку, а не в цену**
(`topUpAllocation`, `mocks/orders.ts:2271` → `:2865-2890`): цена, названная человеком, не должна
меняться от того, что полка отдала другое. §4.2 контракта домена описывает это прозой
(`orders-backend-contract.md:167`), в таблице форм правки (`:147-155`) такого эффекта нет.

**Три непрайсинговых поля принимаются тем же телом** — `productName`, `unit`, `weightPerUnitKg`
(`mocks/orders.ts:2248-2250`), и в таблице §4.2 не названы вовсе; `weightPerUnitKg` при этом на
бэкенде не существует нигде (`grep -rn "weight_per" backend/` — пусто).

Save-режим: clean-slate, **шаг 3** (`composables/useOrderCard.ts:476-491`); та же функция
`applyLineEdit` применяет правку локально до сохранения (`services/orderLineEdits.ts:132-181`),
поэтому «что видел» и «что сохранилось» не могут разойтись.

---

### DELETE /api/orders/:id/items/:id

Реализация: `services/ordersService.ts:160` (`deleteOrderItem`) · мок `mocks/index.ts:1547` →
`mocks/orders.ts:2346` (`mockDeleteOrderItem`)
Бэкенд: **не реализован**.

**Запрос** — тела нет; версия — `If-Match`.

**Ответ** — `ApiResponse<void>` (`services/ordersService.ts:164`; мок `mocks/index.ts:1554`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2353`), `ORDER_ITEM_NOT_FOUND` (`:2356`),
`LINE_HAS_SHIPMENT` / `LINE_ON_INVOICE` (`assertDeletable`, `:2358` → `:2385`),
`ORDER_VERSION_CONFLICT` (`:2354`).

**Удаление снимает резерв** (`releaseLine`, `mocks/orders.ts:2364`) **и пересобирает дефицит**
(`syncShortages`, `:2367`) — §4.2 контракта домена называет оба эффекта прозой
(`orders-backend-contract.md:179`), а в таблице эндпоинтов (`:140`) их нет.

Save-режим: clean-slate, **шаг 4**, последний из правок строк
(`composables/useOrderCard.ts:505-509`); адресуется через `serverLineId`, потому что строку мог
создать предыдущий сорвавшийся Save (`:246-250`, `:507`).

---

### POST /api/orders/:id/items/:id/split

Отрезать от строки уехавшее количество.

Реализация: `services/ordersService.ts:243` (`splitOrderItem`) · мок `mocks/index.ts:988` →
`mocks/orders.ts:2765` (`mockSplitOrderItem`)
Бэкенд: **не реализован**.

**Запрос** — `{ shippedQuantity, version }` (`services/ordersService.ts:243-249`).

**Ответ** — `ApiResponse<{ shipped: OrderItem; remainder: OrderItem }>`
(`services/ordersService.ts:248`; `mocks/orders.ts:2806`). Остаток получает новый id `oi-N` из
счётчика заказа (`:2789`), а нумерация строк пересобирается по позициям (`:2799`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2773`), `ORDER_VERSION_CONFLICT` (`:2774`),
`ORDER_ITEM_NOT_FOUND` (`:2776`), `NUMBER_NOT_FINITE` (`:2777`), плюс `SPLIT_MUST_MATCH_SHIPPED` и
`INVALID_SPLIT_QUANTITY` из арифметики (`domain/orderPricing.ts`, вызов `mocks/orders.ts:2780`).

**Разделение не спрашивает про неделимый кусок**, в отличие от правки количества
(`QUANTITY_SPLITS_OFFCUT`, `services/orderLineEdits.ts:160`): `splitAllocations` режет разбивку по
количеству (`mocks/orders.ts:2782`). §6 контракта домена сам называет четыре места, где
неделимость обязана стоять, — добавление, правка количества, отгрузка, возврат
(`orders-backend-contract.md:414`), — а разделение среди них не названо — БАГ-08.

Save-режим: quick-action, вызывается ровно с `line.shippedQuantity`
(`composables/useOrderCard.ts:1568`).

---

### POST /api/orders/:id/items/:id/correct

Корректировка замороженной строки — цены или себестоимости, с обязательной причиной.

Реализация: `services/ordersService.ts:260` (`correctOrderLine`) · мок `mocks/index.ts:1001` →
`mocks/orders.ts:2611` (`mockCorrectOrderLine`)
Бэкенд: **не реализован**.

**Запрос** — `{ unitPrice?, unitCost?, reason, version? }`. `reason` обязателен и проверяется
**до** права, чтобы пользователь без права всё равно узнал, что ещё не так
(`mocks/orders.ts:2627`, объяснение `:2626`).

**Ответ** — `ApiResponse<OrderItem | OrderService>`: путь называет `items`, но корректируется и
услуга — сегмент ищется сначала среди строк, затем среди услуг
(`services/ordersService.ts:264`, `mocks/orders.ts:2619-2622`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2617`), `ORDER_VERSION_CONFLICT` (`:2618`),
`ORDER_ITEM_NOT_FOUND` (`:2622`), `NUMBER_NOT_FINITE` (`:2623`), `CORRECTION_REASON_REQUIRED`
(`:2627`), `CORRECTION_NEEDS_CHANGE` (`:2629`), `FORBIDDEN_CORRECTION` (`:2631` → `:1858`),
`LINE_NOT_FROZEN` (`:2637`), `INVOICE_ALREADY_CORRECTED` (`:2686`).

**Операция целиком планируется до первой записи** — себестоимость, цена, проверка `validateLine`,
перечень затронутых документов и проверка «этот документ уже корректировали»
(`mocks/orders.ts:2648-2687`), и лишь потом пишет (`:2689-2731`). §4.2.1 контракта домена
требование формулирует и называет цену его нарушения (`orders-backend-contract.md:195`), но в семи
шагах самого §4.2.1 (`:187-193`) порядок «сначала весь план» не выражен.

**Каждая выпускаемая корректировка — отдельный вызов** `mockCreateInvoice`
(`mocks/orders.ts:2723`), то есть отдельный шаг версии — БАГ-06.

Save-режим: quick-action; перед вызовом сбрасывается всё несохранённое, после — полное
перечитывание и обновление панели отгрузок (`composables/useOrderCard.ts:1598-1602`).

---

### POST /api/orders/:id/allocate-total

Разложить заданный итог по строкам.

Реализация: `services/ordersService.ts:229` (`allocateOrderTotal`) · мок `mocks/index.ts:982` →
`mocks/orders.ts:2545` (`mockAllocateOrderTotal`)
Бэкенд: **не реализован**.

**Запрос** — `{ targetGross, version }`.

**Ответ** — `ApiResponse<{ order, requestedGross, achievedGross, rows[] }>`
(`services/ordersService.ts:233-238`, сборка `mocks/orders.ts:2581-2586`). **`achievedGross`
отличается от `requestedGross`**, потому что из-за центового округления НДС не любой итог
достижим, и сервер отвечает тем, что получилось (`:2540-2543`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2557`), `ORDER_VERSION_CONFLICT` (`:2558`),
`NUMBER_NOT_FINITE` (`:2559`), `ALLOCATION_LINE_NOT_FOUND` (`:2575`), плюс из арифметики —
`BELOW_FROZEN_MINIMUM`, `NO_EDITABLE_LINES`, `ZERO_BASE_TOTAL`, `NEGATIVE_TARGET`
(`domain/orderPricing.ts`, вызов `mocks/orders.ts:2561-2566`). **Первые два фронт разбирает
подстрокой** в превью итога, то есть сервер обязан вернуть ровно эти строки
(`orders-backend-contract.md:434`).

**Раскладка трогает только строки, которые ещё можно править** — отгруженные не двигаются
(`orders-backend-contract.md:199`); правило живёт в `allocateGrossTotal` доменного слоя, а в самом
эндпоинте проверки «есть ли что раскладывать» нет ни одной (`mocks/orders.ts:2555-2578`).

Save-режим: quick-action; перед записью — превью тем же расчётом, затем запись и полное
перечитывание (`composables/useOrderCard.ts:1716-1718`).

---

## Услуги заказа

### POST /api/orders/:id/services

Реализация: `services/ordersService.ts:168` (`addOrderService`) · мок `mocks/index.ts:1085` →
`mocks/orders.ts:2390` (`mockAddOrderService`)
Бэкенд: **не реализован**.

**Запрос** — `{ serviceId, quantity, price?, discountPercent?, version? }`. **Себестоимость и имя
берутся из каталога услуг, а не от клиента** (`serviceEntry`, `mocks/orders.ts:371-382`, вызов
`:2415`), имя — на языке каталога (`:378`).

**Ответ** — `ApiResponse<OrderService>` (`types/order.ts:161-191`; `mocks/orders.ts:2431`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2402`), `ORDER_VERSION_CONFLICT` (`:2403`),
`NUMBER_NOT_FINITE` (`:2404-2408`), `ZERO_QUANTITY` (`:2412`), `CATALOG_SERVICE_NOT_FOUND`
(`:376`) — имя кода выбрано так, чтобы **не быть подстрокой** `ORDER_SERVICE_NOT_FOUND`
(`:373-375`).

**Услуга рождается без `unit` и без валюты** — их у строки услуги нет вовсе
(`types/order.ts:161-191`), тогда как каталог хранит и то, и другое (`currencyId`, `uomId`). То
есть подпись цены услуги в заказе не воспроизводима, и §4.2 контракта домена этого не оговаривает.

Save-режим: clean-slate, **шаг 2**, сразу после товарных строк
(`composables/useOrderCard.ts:457-472`); второй вызывающий — создание заказа
(`composables/useOrderCreate.ts:458-465`).

---

### PATCH /api/orders/:id/services/:id

Тот же `LineEditPayload`, что у товарной строки, **с тремя отличиями** — и все три правила домена.

Реализация: `services/ordersService.ts:216` (`updateOrderService`) · мок `mocks/index.ts:1268` →
`mocks/orders.ts:2282` (`mockUpdateOrderService`)
Бэкенд: **не реализован**.

**Запрос** — `LineEditPayload`, но:

1. себестоимость приходит полем **`unitCost`**, а не `manualUnitCost`
   (`services/orderLineEdits.ts:207-210`, разбор `:253`);
2. **причина не требуется**: перекрывать нечего, складской себестоимости у услуги нет
   (`:80-86`, реализация `:94`, где ветка услуги выходит до проверки причины `:96`);
3. **`resetCost` для услуги запрещён вовсе** — `RESET_COST_NOT_SUPPORTED` (`:112`).

§4.2 контракта домена сводит услуги к строке «то же для услуг»
(`orders-backend-contract.md:143`); три отличия там не названы ни строкой.

**Ответ** — `ApiResponse<OrderService>` (`types/order.ts:161-191`; `mocks/orders.ts:2334`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2288`), `ORDER_VERSION_CONFLICT` (`:2289`),
`ORDER_SERVICE_NOT_FOUND` (`:2291`), `NUMBER_NOT_FINITE` и `ALLOCATIONS_NOT_ACCEPTED`
(`validateLineEdit`, `:2294`), `FORBIDDEN_MANUALCOST` (`:2307`), плюс те же отказы арифметики.

Save-режим: clean-slate, тот же **шаг 3**, ветка `kind === 'service'`
(`composables/useOrderCard.ts:487-488`).

---

### DELETE /api/orders/:id/services/:id

Реализация: `services/ordersService.ts:182` (`deleteOrderService`) · мок `mocks/index.ts:1567` →
`mocks/orders.ts:2436` (`mockDeleteOrderService`)
Бэкенд: **не реализован**.

**Запрос** — тела нет; версия — `If-Match`. **Второй сегмент — id строки услуги** (`os-N`,
выдаётся при добавлении, `mocks/orders.ts:2418`), а не id услуги в каталоге: мок ищет
`order.services.findIndex((s) => s.id === serviceId)` (`:2445`). Параметр клиента при этом назван
`serviceId` (`services/ordersService.ts:184`), а §4.2 контракта домена пишет тот же сегмент как
`:lineId` (`orders-backend-contract.md:143`) — **два имени одного сегмента**.

**Ответ** — `ApiResponse<void>` (`services/ordersService.ts:186`; мок `mocks/index.ts:1574`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2443`), `ORDER_SERVICE_NOT_FOUND` (`:2446`),
`LINE_ON_INVOICE` (`assertDeletable`, `:2447` → `:2385`), `ORDER_VERSION_CONFLICT` (`:2444`).
Второй код `assertDeletable`, `LINE_HAS_SHIPMENT`, здесь **недостижим по построению**: у услуги
`shippedQuantity` всегда `0` (`types/order.ts:179`, причина — `:158-160`), а ветку выбирает
именно он (`mocks/orders.ts:2385`).

Save-режим: clean-slate, `pendingServiceDeletions`, **шаг 4**
(`composables/useOrderCard.ts:511-515`).

---

## Склад: резерв и планы

### POST /api/orders/:id/reserve

Зарезервировать весь неотгруженный остаток.

Реализация: `services/ordersService.ts:356` (`reserveOrderStock`) · мок `mocks/index.ts:1059` →
`mocks/orders.ts:3842` (`mockReserveOrder`)
Бэкенд: **не реализован**.

**Запрос** — `{ version }` и больше ничего.

**Ответ** — `ApiResponse<StockReservation[]>`: **только вновь созданные** удержания
(`mocks/orders.ts:3930`), а не все резервы заказа. Повторный вызов на полностью зарезервированном
заказе вернёт пустой массив, и карточка именно так различает два случая в тосте
(`composables/useOrderCard.ts:900-902`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3848`), `ORDER_VERSION_CONFLICT` (`:3849`).
**Нехватка отказом не является:** держится только то, что действительно свободно
(`computeAvailable`, `:3904`), остальное молча не держится.

**Удержание ставится по строке, а не по заказу**, и своё же удержание из доступного вычитается
через `exceptLine` (`mocks/orders.ts:3881-3883`, `:3906`; механизм —
`mocks/reservations.ts:47-60`) — иначе заказ конкурировал бы сам с собой. §4.4 контракта домена
это называет (`orders-backend-contract.md:209`), а формы ответа не описывает вовсе.

**Резерв рождает уведомление «склад готов», и только на переходе** (`mocks/orders.ts:3855`,
`:3929`) — обязанность, которой в контракте домена нет ни строки.

Save-режим: quick-action со сбросом несохранённого перед вызовом
(`composables/useOrderCard.ts:897-899`).

---

### GET /api/orders/:id/reservations

Реализация: `services/ordersService.ts:363` (`getOrderReservations`) · мок
`mocks/index.ts:606` → `mocks/orders.ts:246` (`mockGetReservations`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.

**Ответ** — `ApiResponse<StockReservation[]>`, и тип **складской, а не заказный**
(`types/warehouse.ts:625-634`, импорт — `services/ordersService.ts:44`). Хранилище резервов лежит
третьим модулем, до которого дотягиваются обе стороны (`mocks/reservations.ts:1-18`, причина —
`:1-14`).

Ошибки: **ни одной** — ветка мока зовёт `mockGetReservations({ orderId })`
(`mocks/index.ts:608`), а тот просто фильтрует хранилище (`mocks/reservations.ts:24-34`):
неизвестный заказ отвечает пустым массивом, а не `ORDER_NOT_FOUND`. **Сервер обязан отвечать
отказом.**

Save-режим: только чтение. **Вызывающего в интерфейсе нет:**
`grep -rn "getOrderReservations" frontend_vue/src` даёт объявление и четыре спеки.

---

### GET /api/orders/:id/ship-plan

Что можно отгрузить прямо сейчас.

Реализация: `services/ordersService.ts:269` (`planOrderShipment`) · мок `mocks/index.ts:574` →
`mocks/orders.ts:3237` (`mockPlanOrderShipment`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.

**Ответ** — `ApiResponse<ShippableLine[]>`: `{ lineId, productName, unit, remaining, shippable,
wholePieces }` (`types/order.ts:240-260`). **`shippable` берётся у самого планировщика**
(`ShipmentPlanLine.offerable`, `mocks/orders.ts:3212`, чтение `:3251`), а не вычитанием недостачи
из остатка, — причина названа в коде (`:3186-3197`). `wholePieces` — запретные отрезки количества,
занятые неделимыми кусками (`:3226-3235` → `wholePieceRanges` из `services/orderLines.ts`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3239`). Отказы самого планировщика
(`DUPLICATE_SHIPMENT_LINE`, `SHIPMENT_EXCEEDS_REMAINING`, `SHIPMENT_QUANTITY_MUST_BE_POSITIVE`)
здесь недостижимы: план строится по `unshippedLines` (`:3241`), а те по построению уникальны и
положительны (`:1743-1749`).

**Недостача сюда не попадает.** `planShipment` возвращает `shortages` (`mocks/orders.ts:3216`), а
`mockPlanOrderShipment` их отбрасывает (`:3242-3254`) — диалог видит только урезанное
`shippable`. §4.4 контракта домена перечисляет три поля ответа
(`orders-backend-contract.md:205`) и о недостаче в плане не говорит, хотя у смены статуса она в
плане **есть** (`types/order.ts:284`). Два плана одного склада, отвечающих по-разному.

Save-режим: только чтение, вместе с заказом (`composables/useOrderCard.ts:713`).

---

## Отгрузки

### POST /api/orders/:id/shipments

**Единственное, что двигает склад.**

Реализация: `services/ordersService.ts:277` (`createOrderShipment`) · мок `mocks/index.ts:1034` →
`mocks/orders.ts:3257` (`mockCreateShipment`)
Бэкенд: **не реализован**.

**Запрос** — `{ lines: [{ lineId, quantity }], carrier?, vehicle?, waybillNumber?, shippedAt?,
version? }` (`services/ordersService.ts:277-296`), с обязательным `Idempotency-Key` (`:295`,
причина — `:289-293`).

**Ответ** — `ApiResponse<Shipment>` (`types/order.ts:287-298`; `mocks/orders.ts:3357`). Номер
накладной сервер выдаёт сам, если клиент не назвал (`:3305`); `heldReleased` на строке — `null`
при создании и заполняется тем, что реально снято (`:3310`, `:3329`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3270`), `ORDER_VERSION_CONFLICT` (`:3271`),
`SHIPMENT_HAS_NO_LINES` (`:3272`), `SHIPMENT_EXCEEDS_STOCK` (`:3276`, `:3293`), плюс отказы
планировщика: `ORDER_ITEM_NOT_FOUND` (`:3109`), `DUPLICATE_SHIPMENT_LINE` (`:3115`),
`SHIPMENT_QUANTITY_MUST_BE_POSITIVE` (`:3122`), `SHIPMENT_EXCEEDS_REMAINING` (`:3124`).

Две обязанности, которые контракт домена называет не полностью:

- **движение пишется одно на партию** (`mocks/orders.ts:3338-3351`), а движение по куску — против
  его **родительской партии** с заполненным `offcutId`, и металл партии второй раз не уходит
  (`:3279-3294`, `:3340`). §4.5 это описывает (`orders-backend-contract.md:228`), но в списке
  шагов (`:222-227`) случая с куском нет;
- **снятие удержания идёт с тех же партий, что и списание** (`releaseFromLineOnBatches`,
  `mocks/orders.ts:3327`) — правило §2 (`orders-backend-contract.md:67`), а в перечне
  обязанностей §4.5 названо только «запомнить, сколько сняли» (`:225`).

Save-режим: quick-action со сбросом несохранённого перед вызовом — строки, на которые ссылается
отгрузка, обязаны уже существовать на сервере (`composables/useOrderCard.ts:726-733`).

---

### GET /api/orders/:id/shipments

Реализация: `services/ordersService.ts:273` (`getOrderShipments`) · мок `mocks/index.ts:579` →
`mocks/orders.ts:2811` (`mockGetShipments`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.
**Ответ** — `ApiResponse<Shipment[]>` (`types/order.ts:287-298`), глубокая копия
(`mocks/orders.ts:2814`). На строке отгрузки — `heldReleased`, присутствующий **всегда**, со
значением `null`, когда снимать было нечего (`types/order.ts:208-226`, реализация
`mocks/orders.ts:3310`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2813`).

`Order.shipments` едет и внутри заказа (`types/order.ts:489`), то есть панель могла бы читать
оттуда, как читает счета и платежи; §4.5 контракта домена причины отдельного GET не называет
(`orders-backend-contract.md:215`).

Save-режим: только чтение, отдельная панель со своим флагом загрузки
(`composables/useOrderCard.ts:696`), перечитывается после отгрузки, отмены, корректировки и смены
статуса.

---

### POST /api/orders/:id/shipments/:id/cancel

Отгрузка **никогда не удаляется**: отмена делается обратными движениями `return`
(`mocks/orders.ts:3429-3439`).

Реализация: `services/ordersService.ts:305` (`cancelOrderShipment`) · мок `mocks/index.ts:1012` →
`mocks/orders.ts:3369` (`mockCancelShipment`)
Бэкенд: **не реализован**.

**Запрос** — `{ correctionReason?, version? }`, тело со значением по умолчанию `{}`
(`services/ordersService.ts:305-310`). **`Idempotency-Key` здесь не шлётся**, в отличие от трёх
соседних POST, — хотя операция двигает склад и выпускает документы, ровно те две причины, по
которым §3 требует ключ у отгрузки и возврата (`orders-backend-contract.md:93`) — БАГ-09.

**Ответ** — `ApiResponse<Shipment>`: отгрузка с `cancelled: true` (`mocks/orders.ts:3420`,
`:3505`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3375`), `ORDER_VERSION_CONFLICT` (`:3376`),
`SHIPMENT_NOT_FOUND` (`:3378`), `SHIPMENT_ALREADY_CANCELLED` (`:3379`),
`SHIPMENT_ALREADY_INVOICED` — когда документ у клиента есть, а причина не названа (`:3386`),
`FORBIDDEN_CORRECTION` (`:3390` → `:1858`), `SHIPMENT_BATCH_NOT_FOUND` (`:3403`).

**Отмена возвращает удержание — но только в пределах того, что сейчас реально свободно**
(`mocks/orders.ts:3465-3502`), и разница с возвратом товара названа прямо (`:3451-3463`): отмена
означает «товар не уезжал», а возврат — «уехал и приехал назад». §4.5 сводит это к полуфразе
(`orders-backend-contract.md:230`).

**Отмена выпускает корректирующий счёт по каждому живому документу отгрузки**
(`mocks/orders.ts:3413`), то есть поднимает версию столько раз, сколько документов, плюс свой шаг
(`:3504`) — БАГ-06.

Save-режим: quick-action со сбросом несохранённого (`composables/useOrderCard.ts:749-760`).

---

## Возвраты

### GET /api/orders/:id/return-plan

Реализация: `services/ordersService.ts:320` (`planOrderReturn`) · мок `mocks/index.ts:586` →
`mocks/orders.ts:3635` (`mockPlanReturn`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.

**Ответ** — `ApiResponse<ReturnableLine[]>`: `{ lineId, productName, unit, shipped,
alreadyReturned, returnable }` (`types/order.ts:357-365`), считается при чтении
(`mocks/orders.ts:3635-3648`) и отдаёт только строки с `returnable > 0` (`:3647`). **Услуг здесь
не бывает по построению:** они не отгружаются, и выборка идёт по `order.items` (`:3638`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3637`).

§4.5.1 контракта домена описывает ответ **тремя** полями (`orders-backend-contract.md:245`), а тип
несёт **пять**: там нет `productName` и `unit` (`types/order.ts:357-365`).

Save-режим: только чтение; карточка перечитывает его после каждой записи, меняющей отгруженное
(`composables/useOrderCard.ts:791`).

---

### POST /api/orders/:id/returns

Реализация: `services/ordersService.ts:333` (`createOrderReturn`) · мок `mocks/index.ts:1050` →
`mocks/orders.ts:3657` (`mockCreateReturn`)
Бэкенд: **не реализован**.

**Запрос** — `{ lines: [{ lineId, quantity, condition, compensated }], reason, returnedAt?,
version? }` (`services/ordersService.ts:333-353`), с обязательным `Idempotency-Key` (`:352`).
**Две оси строки независимы:** состояние товара и возврат денег — разные вопросы
(`types/order.ts:302-316`).

**Ответ** — `ApiResponse<OrderReturn>` (`types/order.ts:338-352`; `mocks/orders.ts:3837`), с
`restored` на каждой строке и с идентификаторами выпущенных корректировок (`:3752`, `:3813`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3673`), `ORDER_VERSION_CONFLICT` (`:3674`),
`RETURN_REASON_REQUIRED` (`:3677`), `RETURN_HAS_NO_LINES` (`:3678`), `DUPLICATE_RETURN_LINE`
(`:3682`), `NUMBER_NOT_FINITE` (`:3686`), `RETURN_QUANTITY_MUST_BE_POSITIVE` (`:3687`),
`ORDER_ITEM_NOT_FOUND` (`:3694`), `RETURN_EXCEEDS_SHIPPED` (`:3696`), `RETURN_BATCH_NOT_FOUND`
(`:3704`, `:3721`), `RETURN_SPLITS_OFFCUT` (`:3721`).

Четыре правила, каждое — обязанность сервера:

1. **бракованная строка пишет два движения** — `return`, затем `write-off`
   (`mocks/orders.ts:3774`, `:3786-3787`): металл вернулся на склад и тут же списан, иначе
   история склада теряет факт возврата. Правило §2 (`orders-backend-contract.md:79`), а в шагах
   §4.5.1 названо одной фразой (`:256`);
2. **`shippedQuantity` не уменьшается** — растёт отдельное `returnedQuantity`
   (`mocks/orders.ts:3802`, причина — `types/order.ts:119-125`): «сколько уехало» и «сколько
   вернулось» — разные факты, и вычитание одного из другого стёрло бы оба;
3. **удержание назад не ставится**, в отличие от отмены отгрузки (`mocks/orders.ts:3832-3834`);
4. **каждая корректировка — отдельный `mockCreateInvoice`** (`:3807`), то есть отдельный шаг
   версии — БАГ-06.

Save-режим: quick-action (`composables/useOrderCard.ts:814`).

---

### GET /api/orders/:id/returns

Реализация: `services/ordersService.ts:315` (`getOrderReturns`) · мок `mocks/index.ts:591` →
`mocks/orders.ts:3626` (`mockGetReturns`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.
**Ответ** — `ApiResponse<OrderReturn[]>` (`types/order.ts:338-352`), глубокая копия
(`mocks/orders.ts:3629`). На строке возврата — две независимые оси (`condition`, `compensated`) и
`restored`, присутствующий **всегда**, со значением `null`, когда никуда не легло
(`types/order.ts:311-327`, реализация `mocks/orders.ts:3752`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3628`).

`Order.returns` уже везёт то же самое внутри карточки (`types/order.ts:490`) — третий
эндпоинт-дубль после `payments` и `invoices`.

Save-режим: только чтение; карточка держит собственный список
(`composables/useOrderCard.ts:783`).

---

## Счета и платежи

### POST /api/orders/:id/invoices

Самый сложный эндпоинт домена: шестнадцать кодов отказа, из них четырнадцать не встречаются
больше нигде.

Реализация: `services/ordersService.ts:402` (`createOrderInvoice`) · мок `mocks/index.ts:1065` →
`mocks/orders.ts:4254` (`mockCreateInvoice`)
Бэкенд: **не реализован**.

**Запрос** — `{ kind?, shipmentId?, correctsInvoiceId?, amountNet? | amountGross?, reason?,
version? }` (`services/ordersService.ts:402-416`). **Обе суммы сразу — отказ** (`statedAmounts`,
`mocks/orders.ts:4466-4489`, проверка `:4471`); заявленный брутто побеждает вычисленный, чтобы
документ назвал ровно набранную сумму (`:4448-4465`, применение `:4382`).

**Ответ** — `ApiResponse<Invoice>` (`types/order.ts:371-415`; `mocks/orders.ts:4445`).
**`withdrawsOriginal` ставит сервер**: зеркальная сумма отзывает документ, названная только
поправляет (`:4393`, вычисление — `:4337`, смысл — `types/order.ts:380-390`).
**`coveredServiceIds` решается один раз при выпуске** и едет с документом
(`mocks/orders.ts:4395`, отбор — `unbilledServices`, `:4219-4223`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:4269`), `ORDER_VERSION_CONFLICT` (`:4270`),
`INVOICE_NEEDS_SHIPMENT` (`:4292`), `ADVANCE_HAS_NO_SHIPMENT` (`:4296`),
`CORRECTION_NEEDS_ORIGINAL` (`:4300`), `CORRECTION_REASON_REQUIRED` (`:4303`),
`ORIGINAL_INVOICE_NOT_FOUND` (`:4305`), `CANNOT_CORRECT_A_CORRECTION` (`:4307`),
`INVOICE_ALREADY_CORRECTED` (`:4310`), `CORRECTION_EXCEEDS_ORIGINAL` (`:4328`),
`CORRECTION_NEEDS_KIND` (`:4331`), `SHIPMENT_NOT_FOUND` (`:4354`), `SHIPMENT_CANCELLED` (`:4356`),
`SHIPMENT_ALREADY_INVOICED` (`:4360`), `INVOICE_AMOUNT_REQUIRED` (`:4375`),
`INVOICE_AMOUNT_AMBIGUOUS` (`:4471`).

**Счёт без отгрузки законен ровно в одном случае** — когда несёт только невыставленные услуги
(`mocks/orders.ts:4292`, причина `:4286-4291`); это единственное место, где
`INVOICE_NEEDS_SHIPMENT` не срабатывает. Правило названо в §4.6
(`orders-backend-contract.md:283`) и в таблице форм запроса не отражено.

**Выпуск корректировки, отзывающей документ с услугами, сам создаёт ещё один счёт**
(`mocks/orders.ts:4424`) — рекурсивный вызов, поднимающий версию второй раз. §4.6 описывает
следствие прозой (`orders-backend-contract.md:281-283`), но что это **отдельная запись с отдельным
шагом версии**, не сказано — БАГ-06.

Save-режим: quick-action, три разных вызова — счёт по отгрузке
(`composables/useOrderCard.ts:1060`), счёт только за услуги без отгрузки (`:1110`) и авансовый
(`:1131`).

---

### GET /api/orders/:id/invoices

Реализация: `services/ordersService.ts:398` (`getOrderInvoices`) · мок `mocks/index.ts:601` →
`mocks/orders.ts:4023` (`mockGetInvoices`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.
**Ответ** — `ApiResponse<Invoice[]>` (`types/order.ts:371-415`), глубокая копия
(`mocks/orders.ts:4026`). Те же счета уже приходят внутри `Order.invoices`
(`types/order.ts:491`), и карточка читает именно их (`composables/useOrderCard.ts:915`), а не этот
эндпоинт.

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:4025`).

**Вызывающего в интерфейсе нет:** `grep -rn "getOrderInvoices" frontend_vue/src` даёт объявление и
спеку — экрана, который его зовёт, нет ни одного. §4.6 перечисляет `GET/POST /invoices` одной
строкой (`orders-backend-contract.md:270`) и не говорит, зачем нужен отдельный GET, если список
едет в заказе.

Save-режим: только чтение.

---

### POST /api/orders/:id/payments

Реализация: `services/ordersService.ts:371` (`addOrderPayment`) · мок `mocks/index.ts:1041` →
`mocks/orders.ts:3946` (`mockAddOrderPayment`)
Бэкенд: **не реализован**.

**Запрос** — `{ amount, purpose?, paidAt?, invoiceId?, note?, version? }`
(`services/ordersService.ts:371-387`), с обязательным `Idempotency-Key` (`:386`).

**Ответ** — `ApiResponse<Payment>` (`types/order.ts:419-428`; `mocks/orders.ts:4002`).
**`purpose` выводится из знака суммы**, а не берётся из ярлыка: минус всегда `refund` (`:3972`,
причина `:3967-3971`) — иначе ярлык и знак могли бы разойтись, и деньги пошли бы не в ту сторону.

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3959`), `ORDER_VERSION_CONFLICT` (`:3960`),
`NUMBER_NOT_FINITE` (`:3964`), `PAYMENT_AMOUNT_REQUIRED` (`:3965`), `REFUND_MUST_BE_NEGATIVE`
(`:3966`), `REFUND_INVOICE_REQUIRED` (`:3979`), `PAYMENT_INVOICE_NOT_FOUND` (`:3983`).

**У пришедших денег `invoiceId` необязателен, у возврата обязателен** (`mocks/orders.ts:3979`) —
правило §4.6 (`orders-backend-contract.md:294`). Но проверка «названный документ принадлежит этому
заказу» **шире, чем сказано**: она принимает и корректировку (`mocks/orders.ts:3982`), тогда как
сводка счетов клиента корректировку без исходного документа в привязку не берёт (`:4069-4074`).

**`paidAt` принимается от клиента без проверки формата** (`:3990`), при том что §3 требует
однородного ISO-8601 (`orders-backend-contract.md:103`).

Save-режим: quick-action, с полным перечитыванием после
(`composables/useOrderCard.ts:1015`).

---

### GET /api/orders/:id/payments

Реализация: `services/ordersService.ts:367` (`getOrderPayments`) · мок `mocks/index.ts:596` →
`mocks/orders.ts:3939` (`mockGetOrderPayments`)
Бэкенд: **не реализован**.

**Запрос** — только сегмент пути.
**Ответ** — `ApiResponse<Payment[]>` (`types/order.ts:419-428`), глубокая копия
(`mocks/orders.ts:3942`). Дубль того, что уже лежит в `Order.payments` (`types/order.ts:492`);
карточка считает оплату по нему (`composables/useOrderCard.ts:914`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:3941`).

**Вызывающего в интерфейсе нет:** `grep -rn "getOrderPayments" frontend_vue/src` даёт объявление и
спеку.

Save-режим: только чтение.

---

### DELETE /api/orders/:id/payments/:id

Реализация: `services/ordersService.ts:390` (`deleteOrderPayment`) · мок `mocks/index.ts:1557` →
`mocks/orders.ts:4005` (`mockDeleteOrderPayment`)
Бэкенд: **не реализован**.

**Запрос** — тела нет; версия — `If-Match`.
**Ответ** — `ApiResponse<void>` (`services/ordersService.ts:394`; мок `mocks/index.ts:1564`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:4012`), `PAYMENT_NOT_FOUND` (`:4015`),
`ORDER_VERSION_CONFLICT` (`:4013`).

**Ни одной проверки связности здесь нет** (`mocks/orders.ts:4005-4020`): платёж удаляется и тогда,
когда он назвал счёт, и тогда, когда это возврат, обязанный назвать документ (`:3979`). При этом
удаление платежа — **единственный законный путь назад** для отказа `ORDER_HAS_PAYMENT`
(`orders-backend-contract.md:130`). Что делать с уже выпущенной корректировкой, оплаченной этим
платежом, не сказано ни в моке, ни в контракте домена — см. «Что осталось нерешённым», вопрос сверх шести
строк владельца.

Save-режим: quick-action (`composables/useOrderCard.ts:1032`).

---

## Файлы и история

### POST /api/orders/:id/files

Реализация: `services/ordersService.ts:198` (`addOrderFile`) · мок `mocks/index.ts:1095` →
`mocks/orders.ts:2488` (`mockAddOrderFile`)
Бэкенд: **не реализован**.

**Запрос** — `{ fileId, version }` (`services/ordersService.ts:198-203`); `fileId` выдаёт загрузка
домена `uploads` (§16 соглашений), и ветка мока достаёт по нему исходное имя из реестра загрузок
(`mocks/index.ts:1097-1098`).

**Ответ расходится с объявлением.** Клиент объявляет `Promise<void>`
(`services/ordersService.ts:202`), мок возвращает `OrderFile` целиком (`mocks/orders.ts:2509`,
тип — `types/order.ts:608-616`), а карточка ответ выбрасывает
(`composables/useOrderCard.ts:520`) и рисует строку из своих данных (`:1621-1631`). **Серверу
следует отдавать запись:** без неё клиент не может узнать ни размера, ни ссылки.

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2496`), `ORDER_VERSION_CONFLICT` (`:2497`).
**Несуществующий `fileId` не отвергается**: имя оказывается `undefined` и подменяется заглушкой
`File N` (`:2500`). Сервер обязан отвечать отказом.

Два наблюдения о форме: `id` файла в заказе (`ord-file-N`, `mocks/orders.ts:2499`) — счётчик
**модуля**, а не заказа, в отличие от строк (`oi-N`) и документов (`ORD-100-INV-1`), и §2
контракта домена, где области уникальности перечислены (`orders-backend-contract.md:50`), файлов
не упоминает; поля `size`, `mime`, `url` мок заполняет заглушками (`mocks/orders.ts:2502-2504`) —
их обязан заполнить сервер из реестра загрузок.

Save-режим: clean-slate, `pendingFileAdds`, **шаг 5** (`composables/useOrderCard.ts:519-522`).

---

### DELETE /api/orders/:id/files/:id

Реализация: `services/ordersService.ts:206` (`removeOrderFile`) · мок `mocks/index.ts:1596` →
`mocks/orders.ts:2512` (`mockRemoveOrderFile`)
Бэкенд: **не реализован**.

**Запрос** — тела нет; версия — `If-Match`. **Второй сегмент — `fileId` загрузки**, а не
`OrderFile.id`: клиент шлёт `fileId` (`services/ordersService.ts:206-211`, источник значения —
`composables/useOrderCard.ts:1638`), мок ищет по `f.fileId` (`mocks/orders.ts:2521`).

**Ответ** — `ApiResponse<void>` (`services/ordersService.ts:210`; мок `mocks/index.ts:1603`).

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2519`), `ORDER_FILE_NOT_FOUND` (`:2530`),
`ORDER_VERSION_CONFLICT` (`:2520`).

В таблице эндпоинтов §4.1 контракта домена файлов нет вовсе
(`orders-backend-contract.md:111-118`); оба файловых эндпоинта названы там только прозой §3
(`:101`), а форму `OrderFile` (`types/order.ts:608-616`) контракт не описывает нигде.

Save-режим: clean-slate — снятие копится в `pendingFileRemoves`
(`composables/useOrderCard.ts:185`) и уходит **шагом 5** (`:524-527`).

---

### DELETE /api/orders/:id/audit/:id

Удаление записи истории. Второй вызывающий у него — общая лента аудита.

Реализация: `services/ordersService.ts:190` (`deleteOrderAuditEntry`) · мок
`mocks/index.ts:1586` → `mocks/orders.ts:2469` (`mockDeleteOrderAuditEntry`)
Бэкенд: **не реализован**.

**Запрос** — тела нет; **второй сегмент — `id` записи, а не её позиция**
(`services/ordersService.ts:190-196`; `id` живёт на `StockAuditEntry`,
`types/warehouse.ts:526-534`, и наследуется `OrderAuditEntry`, `types/order.ts:591`). Версия —
`If-Match` (`ordersService.ts:195`), но лента её **не шлёт** (`services/auditFeedService.ts:62`), и
мок проверку в этом случае пропускает намеренно (`mocks/orders.ts:1938-1941`): тот, кто заказа не
читал, версии заявить не может (`:1919-1927`). **Удаление из ленты от проверки версии
освобождено** — это правило, а не упущение.

**Ответ** — `ApiResponse<void>` (`services/ordersService.ts:194`; мок `mocks/index.ts:1593`).
Таблица §4.1 контракта домена называет здесь `Order` (`orders-backend-contract.md:118`) — это
расхождение, см. «Чего в домене нет».

Ошибки: `ORDER_NOT_FOUND` (`mocks/orders.ts:2476`), `ORDER_AUDIT_ENTRY_NOT_FOUND` (`:2479`),
`ORDER_VERSION_CONFLICT` (`:2477`).

Save-режим: quick-action из двух мест — карточка заказа
(`composables/useOrderCard.ts:341`) и общая лента аудита, маршрутизирующая удаление в эндпоинт
своей сущности (`services/auditFeedService.ts:62`; правило — [`audit-feed.md`](audit-feed.md),
правило домена 5). Лента свои **чтения** подписывает заголовками
(`services/auditFeedService.ts:20`, `:41`), а это удаление уходит без них.

---

## Обязанности сервера

Девять граф аудита. Сквозные правила — в соглашениях; ниже только наблюдения по коду домена и то,
чего во фронтенде не видно.

**Значения по умолчанию и их владелец.** **Из четырёх финансовых величин настроек заказ читает
одну.** Маржа приходит из справочника арендатора (`mockGetSettings().constants.defaultMargin`,
`mocks/orders.ts:1633`), а скидка, ставка НДС и валюта стоят литералами `0`, `21` и `'EUR'`
(`:1634`, `:1637`, `:1638`) — при том что настройки владеют всеми тремя
(`types/settings.ts:15-18`, сид `mocks/settings.ts:53-56`). Разобрано в `POST /api/orders`; сервер
обязан брать все четыре из настроек. `vatMode` выводится из `documentType` **дважды** — на сервере
(`mocks/orders.ts:1636`) и вторым экземпляром в форме создания
(`composables/useOrderCreate.ts:358-359`). Базовая валюта себестоимости строки берётся правильно,
через одну функцию (`baseCurrencyOf`, `services/orderLines.ts:153-161`, применение
`mocks/orders.ts:2186`). Прочие константы: статус нового заказа `'new'` (`mocks/orders.ts:1630`);
размер страницы `25` — дважды, дефолтом `usePagination()` (`composables/usePagination.ts:3`) и
дефолтом ветки мока (`mocks/index.ts:557`); перечень размеров `10/25/50/100` — константа
компонента (`views/admin/orders/OrdersListPage.vue:61-66`), справочника под него нет; глубина
дашборда — `pageSize: 5` (`composables/useSalesCrmDashboard.ts:42`). Кому принадлежат размер
страницы и почему три умолчания заказа — литералы, не решено: **строка владельца 1**.

**События и уведомления.** **Домен рождает три события, и все три — на переходе, а не на записи.**
`notifyOrderStatusChanged` только когда статус действительно сменился (`mocks/orders.ts:1837`),
`notifyWarehouseReady` только когда заказ стал полностью зарезервирован, а до этого не был
(`:3929`), `notifyPaymentReceived` только для положительной суммы — возврат денег не «поступление
оплаты» (`:4001`). Все три доказаны спекой (`mocks/notification-triggers.spec.ts`).

Замер: `grep -c "notify" frontend_vue/src/services/mocks/orders.ts` → `6`, из них три импорта
(`:123-125`) и три вызова (`:1837`, `:3929`, `:4001`). **Ничего не рождают** создание заказа
(`:1679`), добавление и правка строки, отгрузка (`:3356`), её отмена (`:3504`), возврат (`:3836`),
выпуск счёта (`:4444`), корректировка строки (`:2733`) и удаление заказа (`:2074`). Обязан ли
сервер сообщать о выпуске документа, об отмене отгрузки и о возврате — **строка владельца 2**.

**Запись в аудит-лог.** **Этот домен — единственный из девяти, который свой журнал пишет.** У
соседей лог засеян и не пополняется (см. аудиты `warehouse`, `products`, `clients`).

Устройство — два уровня, и это важно для схемы:

- **нижний писатель один** — `appendHistory` (`mocks/orders.ts:1874-1893`). Он же выдаёт записи
  две вещи, которые она обязана иметь: собственный `id` вида `au-N` из счётчика **когда-либо
  написанных**, а не из длины списка (`:1879`, причина — `:145-151`), и полный ISO-8601 в отметке
  времени (`:1880`, причина — `:1866-1872`);
- у него **два вызывающих**: смена статуса напрямую (`:1827`) и обёртка `recordInHistory`
  (`:1896-1913`, вызов `:1905`), которая добавляет автора и признак `sensitive`.
  Замер: `grep -n "appendHistory(" frontend_vue/src/services/mocks/orders.ts` → `1827`, `1874`
  (определение), `1905`.

**Пишущих операций семь**, и это `grep -n "recordInHistory(" …` → шесть вызовов (`:2256` ручная
себестоимость товара, `:2319` она же у услуги, `:2695` корректировка себестоимости, `:2710`
корректировка цены, `:3442` корректировка отгрузки, `:3817` возврат) плюс смена статуса напрямую
(`:1827`).

Автор — `actingUser()` из профиля настроек, то есть **отображаемое имя, а не id пользователя**
(`:1847-1853`). У настоящего сервера это была бы сессия, а в записи обязана остаться пара «ссылка
на пользователя плюс замороженное имя» — так это уже сделано на схеме у соседа
(`backend/app/modules/warehouse/shared/models.py:246-252`), и лента аудита строит по замороженной
половине и подпись, и ключ фильтра (см. [`audit-feed.md`](audit-feed.md), графа «Запись в
аудит-лог»).

Признак `sensitive: 'cost' | null` ставится записи при создании (`types/order.ts:591-606`) и
режется на чтении по праву `seeCost` (`mocks/orders.ts:1384-1386`) — **единственное место домена,
где право применяется к содержимому ответа**.

Полный перечень того, что обязано попадать в историю, и чем должен быть автор записи, — **строка
владельца 3**.

**Кастомные поля.** **У заказа их нет ни в каком виде.**
`grep -c "fieldValues\|FieldDefinition\|fieldId" frontend_vue/src/types/order.ts frontend_vue/src/services/mocks/orders.ts frontend_vue/src/services/ordersService.ts`
→ `0` у всех трёх. Библиотека определений домена `config` к заказу не привязана. Ближайшее к
«произвольным данным» — свободный `notes` (`types/order.ts:494`) и файлы (`:496`). Домен обходится
фиксированной схемой, как и `clients`. Жизненный цикл определений — сквозная обязанность, и она
принадлежит `config`, а не сюда.

**Настройки, которых мок не отслеживает.** Четыре:

1. **Справочник статусов принадлежит настройкам, а перечисление — фронту, и мост держится на
   имени.** Разобрано в `GET /api/orders/:id/status-plan`. Сервер обязан либо проверять
   существование `st-<status>` на входе, либо хранить статус ссылкой на справочник, а не строкой;
2. **оба флага перехода в сиде выключены у всех пятнадцати статусов** —
   `grep -c "reserveOnTransition: true" frontend_vue/src/services/mocks/settings.ts` → `0`,
   `writeOffOnTransition: true` → `0` (`mocks/settings.ts:208-346`): под моками смена статуса склад
   не двигает никогда, и весь путь §4.5 контракта домена ничем не проверяется — БАГ-05;
3. **права заказа живут в чужом домене** — `orderPermissions` в настройках
   (`mocks/settings.ts:62-66`), а не в матрице прав `config`:
   `grep -ci "seeCost\|manualCost\|correction" frontend_vue/src/services/mocks/config.ts` → `0`;
4. **округление и точность денег** заданы кодом домена (§7 контракта домена), а не настройкой:
   справочника под них нет ни в настройках, ни на схеме.

**Мультиарендность.** **Не выражена нигде.**
`grep -ci "tenant" frontend_vue/src/types/order.ts frontend_vue/src/services/mocks/orders.ts frontend_vue/src/services/ordersService.ts`
→ `0` у всех трёх; ни `tenantId` в форме, ни заголовка в клиенте — единственные заголовки домена
это `If-Match` (`services/ordersService.ts:42`) и `Idempotency-Key` (`:295`, `:352`, `:386`).
Хранилище мока — один плоский `STORE` на процесс (`mocks/orders.ts:968`). На бэкенде модуля нет,
таблицы нет, `tenant_id` объявлен у моделей десяти других модулей — но не здесь. То есть чем
ограничивается выборка заказа, не задано **ни таблицей, ни колонкой, ни параметром**. **Строка
владельца 4.**

**Права — в какой функции проверяются.** **Два write-права из трёх проверяются в той же функции,
что пишет, и это единственный домен, где так.** `requireRight` (`mocks/orders.ts:1855-1860`)
зовётся из пяти мест: `POST /items` через `refuseStatedCost` (`:1998`), `PATCH /items/:id`
(`:2237`), `PATCH /services/:id` (`:2307`), `POST /items/:id/correct` (`:2631`) и
`POST /shipments/:id/cancel` — когда документ у клиента есть (`:3390`). Роль берётся из профиля
настроек (`:1847-1853`), у настоящего сервера это была бы сессия.

**Третье право, `seeCost`, применяется только к истории заказа** (`:1384-1386`): `unitCost`,
`costSource`, `allocations` и `marginPercent` отдаются всем, и §5 контракта домена называет это
занавеской, а не правом, и объясняет, почему вторую половину пока нельзя включить
(`orders-backend-contract.md:389-396`).

Три маршрута домена закрыты фича-флагом `adminOrders` (`router/index.ts:150`, `:156`, `:162`;
флаг — `config/featureFlags.ts:23`), а это признак **тарифа, а не роли** (§6 соглашений). На
бэкенде общая `check_permission` возвращает `True` безусловно
(`backend/app/modules/auth/internal_api/interface.py:27-38`). **Строка владельца 5.**

**Транзакционность и идемпотентность.**

`Idempotency-Key` шлют **три** POST — отгрузка, платёж, возврат (`services/ordersService.ts:295`,
`:352`, `:386`); мок кеширует ответ по ключу (`withIdempotency`, `mocks/index.ts:261-269`,
применение `:1030-1057`). **У кеша нет ни срока, ни привязки к пути** — это `Map` на процесс
(`mocks/index.ts:260`), то есть один и тот же ключ, посланный на отгрузку и на платёж, вернул бы
первый ответ на оба. §3 контракта домена требует только «сервер запоминает ключ вместе с ответом»
(`orders-backend-contract.md:93`) и области действия ключа не задаёт: **сервер обязан привязывать
ключ к паре «путь + заказ» и держать его ограниченное время**.

**Отмена отгрузки ключа не шлёт**, хотя двигает склад и выпускает документы — БАГ-09.

**Одно нажатие Save рассыпается на `1 + N + M + K + L` последовательных запросов**
(`composables/useOrderCard.ts:418-533`), и падение в середине оставляет первую половину
применённой. **Решено 2026-09-09 (П43, П46):** заказ атомарен — Save применяется целиком либо не
применяется вовсе, значит изменение уходит одним запросом; ключ идемпотентности живёт сутки, и
«тем же самым» считается пара «ключ + операция». См. пункт 6 раздела «Пробелы аудита»,
[§15](00-conventions.md) и [§11](00-conventions.md).

**Версию спрашивают 22 мутации из 23.** Замер:
`grep -c "assertVersion(order" frontend_vue/src/services/mocks/orders.ts` → `23`, из них одна —
само определение (`mocks/orders.ts:1938`); не спрашивает только создание заказа, у которого версии
ещё нет. §3 контракта домена говорит «все двадцать» (`orders-backend-contract.md:97`) — число
устарело.

**Правило «одна принятая запись — один шаг версии» нарушено в пяти местах:** смена статуса
(`mocks/orders.ts:1820`, `:1823`, `:1826`), корректировка строки (`:2723`, `:2733`), возврат
(`:3807`, `:3836`), отмена отгрузки (`:3413`, `:3504`) и выпуск корректировки, отзывающей документ
с услугами (`:4424`, `:4444`). Каждое из пяти — операция, которая внутри себя зовёт другую
мутацию, и та поднимает версию сама. **Серверу это чинится транзакцией:** вся операция — один шаг,
как и требует §3 (`orders-backend-contract.md:101`) — БАГ-06.

**Производные значения (считать, не хранить).** Девять на заказе, четыре на строке, три в списке и
одно отдельно.

- **на заказе** — `totalCost`, `totalAmount`, `totalVat`, `totalWithVat`, `actualMarginPercent`,
  `effectiveDiscountPercent`, `paidAmount`, `paidPercent`, `outstandingAmount`: один `recalcOrder`
  (`mocks/orders.ts:179-226`, присвоения `:205-215`), и он же валидирует каждую строку до записи
  (`:185`). **Исключение — `totalWeight`:** он вводится руками, пока ни у одного товара нет веса
  (`:220-225`, тип — `types/order.ts:483-487`);
- **на строке** — `unitPrice`, `totalPrice` и `discount` как проекция для старых частей интерфейса
  (`types/order.ts:132-138`, сборка `projectItem` из `services/orderLines.ts`), и `state`,
  выводимое из количеств, а не ставимое руками (`syncLineState`, `mocks/orders.ts:3320`);
- **в списке** — `itemCount` (`mocks/orders.ts:1494`), `shippedPercent` — доля, посчитанная **в
  деньгах**, потому что количества разных единиц не складываются (`:1497` → `:235-240`), и
  `totalPages` (`:1562`);
- **отдельно** — `costTopUp`, лестница ответа склада, собираемая при каждом чтении карточки
  (`:1373` → `:2938-2953`).

**Переплата не зажимается нулём:** `orderReceivables` отдаёт отрицательный остаток как есть
(`mocks/orders.ts:4741`), и причина с датой решения владельца записана рядом (`:4734-4740`).
Карточка разбирает такой остаток в состояние «переплачено», то есть три места согласованы
намеренно.

**Срок оплаты счёта выводится из снимка условий клиента, а не из карточки клиента:**
`receivableDueDate(invoice.issuedAt, order.clientPaymentTermsDays)` (`mocks/orders.ts:4721`);
снимок делается при создании заказа (`:1628`).

---

## Правила домена

Правила, которых **нет** в контракте домена или которые в нём расходятся с кодом. То, что там
описано верно, здесь не повторяется — деньги и округление §7, валюта §7.1, средние цены товара
§7.2 читаются там.

1. **`costTopUp` — поле ответа, которого контракт домена не знает.**
   `grep -c "costTopUp" roo_code/plans/orders/orders-backend-contract.md` → `0`. Между тем это
   обязательная часть `GET /api/orders/:id`; почему её нельзя держать на самой строке — разобрано
   в разделе этого эндпоинта.
2. **`namedUnitPrice` — тоже поле, которого контракт домена не знает.**
   `grep -c "namedUnitPrice" roo_code/plans/orders/orders-backend-contract.md` → `0`, при том что
   §7 описывает саму развилку прозой (`orders-backend-contract.md:444`): «цена хранится» и «цена
   зафиксирована» — разные утверждения, и строка делает ровно одно из двух. Поле есть и у товарной
   строки (`types/order.ts:114`), и у услуги (`:176`), и **никогда не ставится вместе с**
   `manualUnitPrice` (`:107-113`). Без него схема получит одну колонку под два разных смысла.
3. **Ответ никогда не содержит внутренней бухгалтерии сервера** — `publicOrder` вырезает все поля
   на `_` (`mocks/orders.ts:1369-1372`). Разобрано в `GET /api/orders/:id`.
4. **Порядок веток разбора — часть контракта, и в моке он зафиксирован комментарием.** Восемь
   вложенных GET-путей разбираются **раньше** голого `/api/orders/:id`: `status-plan`
   (`mocks/index.ts:563`), `ship-plan` (`:574`), `shipments` (`:579`), `return-plan` (`:586`),
   `returns` (`:591`), `payments` (`:596`), `invoices` (`:601`), `reservations` (`:606`) — и только
   потом карточка (`:611`); причина названа прямо (`:584-585`). У сервера с маршрутом
   `/{order_id}` порядок был бы обратным, и `/api/orders/ship-plan` уехал бы в карточку с
   `order_id = "ship-plan"`.
5. **Без явного `sortBy` список сортируется по `createdAt` вниз** (`mocks/orders.ts:1548-1549`) —
   это умолчание, а не порядок хранилища. У соседнего домена то же место отдаёт сырой порядок,
   поэтому назвать это здесь необходимо: два списка, ведущих себя по-разному без параметра, — два
   разных API.
6. **`STORE` — один плоский массив на процесс, и id выдаётся отдельным счётчиком, а не по длине
   массива** (`mocks/orders.ts:968`, счётчик — `:1355-1357`, причина `:1615-1617`): иначе номер
   повторился бы после удаления, а из него собираются номера накладных и счетов. У двух соседей
   тот же дефект не закрыт — здесь закрыт.
7. **Демо-хранилище держится тех же правил, что приложение, и это выражено кодом.** Отгрузки
   сценариев создаются настоящим `mockCreateShipment` (`mocks/orders.ts:982-1039`), а не объектом,
   положенным в заказ, — иначе демо утверждало бы, что товар уехал, пока он лежит на полке
   (причина — `:156-162`); показательный возврат — настоящим `mockCreateReturn` (`:4524`, причина
   `:4515-4523`); сборка сида глушит уведомления через `seedQuietly` (`:4578`, `:4676`). Заказ-
   витрина `ORD-100` и сценарные заказы **зарезервированы**: на них ничего не досеивается, потому
   что их состояние пришпилено тестами (`:4527-4531`, `:4613`). **Серверу ничего из этого делать
   не нужно** — правило записано, чтобы его не перенесли в контракт по ошибке.
8. **Ключ идемпотентности живёт в `Map` на процесс, без срока и без привязки к пути**
   (`mocks/index.ts:260-269`) — разобрано в графе «Транзакционность».

---

## Чего в домене нет

У этого домена особый случай: **прежний монолит о заказе не говорит ничего**
(`grep -c "^### .*api/orders" roo_code/roo-context/03-api-contract.md` → `0`), поэтому вычёркивать
из него нечего. Вместо этого ниже — **три места, где контракт домена разошёлся с кодом**. Он сам
объявляет мок старшим (`orders-backend-contract.md:5`), значит это его правки, а не находки про
код.

| было в контракте домена | чем опровергнуто |
|---|---|
| §3: версию спрашивают «все **двадцать**» мутаций (`orders-backend-contract.md:97`) | мутаций, спрашивающих версию, **двадцать две**: `grep -c "assertVersion(order" frontend_vue/src/services/mocks/orders.ts` → `23` минус определение (`mocks/orders.ts:1938`). Не спрашивает только `POST /api/orders`, у которого версии ещё нет |
| §4.1: у `DELETE /api/orders/:id/audit/:id` ответ **`Order`** (`orders-backend-contract.md:118`) | и клиент, и мок дают `void` (`services/ordersService.ts:194`, `mocks/index.ts:1593`). Возвращать заказ целиком после удаления строки истории не нужно: карточка перечитывает его сама |
| §6: `SHIPMENT_ALREADY_INVOICED` отнесён к разделу склада (`orders-backend-contract.md:416`) | код принадлежит **двум** операциям: его бросает и отмена отгрузки (`mocks/orders.ts:3386`), и выпуск счёта (`:4360`) |

Плюс **два поля ответа, которых контракт домена не знает вовсе** — `costTopUp` и
`namedUnitPrice`; оба разобраны в «Правилах домена», пп. 1-2. Это не расхождение, а пробел: без
них схема получит либо недостающую производную, либо одну колонку под два смысла.

---

## Что осталось нерешённым

Шесть строк, все — решения владельца, стоящие в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), и совпадающие с ними
один к одному.

1. **решено 2026-09-07** — ставка НДС, скидка и валюта нового заказа берутся **из настроек в
   момент создания**, и дальше заказ хранит своё значение: смена умолчания старых заказов не
   переписывает (П19, [§14](00-conventions.md)). Размер страницы списка принадлежит коду, сервер его не
   назначает (П20, [§13](00-conventions.md)).
   Сегодня из четырёх констант одного литерала объекта настройку читает **одна**: маржа
   (`mocks/orders.ts:1633`) против литералов `0`, `21`, `'EUR'` (`:1634`, `:1637`, `:1638`) при
   том, что `GlobalConstants` владеет всеми четырьмя (`types/settings.ts:14-19`). Превью страницы
   создания при этом считает по `settings.constants.vatRate` (`useOrderCreate.ts:364`), то есть
   список и превью уже расходятся между собой. Это работа по коду, не открытый вопрос.
2. **Решено 2026-09-09 (П51): все три названы нужными типами** — заказ отгружен, счёт выставлен,
   возврат товара; корректировка выданного документа в перечень не вошла и уведомления не рождает
   ([§10.1](00-conventions.md)). Прежняя формулировка строки: обязан ли сервер сообщать об
   отгрузке, о выставленном счёте, о возврате товара и
   о корректировке выданного документа. Сегодня событий три, и все три на переходе; отгрузка
   (`mocks/orders.ts:3356`), её отмена (`:3504`), возврат (`:3836`) и выпуск счёта (`:4444`) не
   рождают ничего.
3. **осталось** — полный перечень того, что обязано попадать в историю заказа, и чем должен быть
   автор записи: именем или id пользователя. Сегодня автор — отображаемое имя из профиля настроек
   (`mocks/orders.ts:1847-1853`), а на схеме у соседа стоит пара «ссылка плюс замороженное имя»
   (`backend/app/modules/warehouse/shared/models.py:246-252`).
4. **снято 2026-09-10 (§4)** — тем же, чем во всех доменах: сервер узнаёт арендатора из токена и
   фильтрует по нему каждый запрос. Особенность домена в том, что таблицы заказа на бэкенде нет
   вовсе, и она обязана нести `tenant_id` с рождения — как все десять существующих модулей.
5. **решено 2026-09-07 (П5)** — в карточке заказа занавеска **остаётся**, и это осознанное
   решение, а не недоделка ([§6.7](00-conventions.md)). Причина техническая: базовая цена строки считается из
   себестоимости (`domain/orderPricing.ts:158`), поэтому сервер, переставший слать `unitCost`,
   обязан слать взамен посчитанную цену, а карточка — перестать считать её сама; эти две правки
   согласованы между собой и сегодня не делаются. Вырезание назначено истории и аналитике, не
   карточке. Сегодня право режет только записи истории с `sensitive: 'cost'`, а `unitCost`,
   `costSource`, `allocations` и `marginPercent` отдаются всем.
6. **Решено 2026-09-09 (П43, П46)** — заказ назван атомарным поимённо: **Save применяется целиком
   либо не применяется вовсе**. Сегодня одно нажатие рассыпается на `1 + N + M + K + L`
   последовательных запросов (`composables/useOrderCard.ts:418-533`), и падение в середине
   оставляет первую половину применённой — под П43 это меняется: изменение уходит одним запросом
   и применяется одной транзакцией. Область действия ключа идемпотентности задана там же: ключ
   живёт **сутки**, а «тем же самым» считается пара **«ключ + операция»** — один ключ на отгрузке
   и на платеже это два разных случая, а не один. Сегодня ключ лежит в `Map` на процесс, без срока
   и без привязки к пути (`mocks/index.ts:260-269`). См. [§15](00-conventions.md),
   [§11](00-conventions.md).

**Сверх этих шести — один вопрос, поднятый самим сведением и в файл решений ещё не занесённый:**
что делать с уже выпущенной корректировкой, оплаченной платежом, который удаляют.
`DELETE /api/orders/:id/payments/:id` не проверяет связность ни с чем
(`mocks/orders.ts:4005-4020`), при том что удаление платежа — единственный законный путь назад для
отказа `ORDER_HAS_PAYMENT`.
