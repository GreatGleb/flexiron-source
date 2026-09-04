# Bugs — contract-sync / домен orders

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К6. Аудит: [`roo_code/plans/api/audit/orders.md`](../api/audit/orders.md).
Контракт домена, читаемый как гипотеза:
[`roo_code/plans/orders/orders-backend-contract.md`](../orders/orders-backend-contract.md).
Область: `frontend_vue/src/services/ordersService.ts`,
`frontend_vue/src/services/mocks/orders.ts`, `frontend_vue/src/services/mocks/reservations.ts`,
ветки orders в `frontend_vue/src/services/mocks/index.ts`,
`frontend_vue/src/services/orderLineEdits.ts`, `frontend_vue/src/services/orderLines.ts`,
`frontend_vue/src/composables/useOrderCard.ts`, `frontend_vue/src/composables/useOrders.ts`,
`frontend_vue/src/composables/useOrderCreate.ts`, `frontend_vue/src/types/order.ts`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — `GET /api/orders/:id` на неизвестный заказ отвечает `undefined`, и карточка падает

**File:** `frontend_vue/src/services/mocks/orders.ts:1599-1602`
**Severity:** High — открытие заказа по устаревшей ссылке даёт не «заказ не найден», а необъяснимую ошибку загрузки.
**Источник:** К3 (коды ошибок), К5 (источник истины)

### Problem

`mockGetOrder` — единственное чтение домена без отказа:

```ts
export function mockGetOrder(id: string): Order | undefined {
  const order = STORE.find((o) => o.id === id)
  return order ? publicOrder(order) : undefined
}
```

Семь остальных чтений бросают `ORDER_NOT_FOUND`: `mocks/orders.ts:1772` (status-plan), `:2813`
(shipments), `:3239` (ship-plan), `:3628` (returns), `:3637` (return-plan), `:3941` (payments),
`:4025` (invoices). Клиент при этом объявляет `Promise<Order>` без `undefined`
(`frontend_vue/src/services/ordersService.ts:68`), и карточка сразу разыменовывает ответ:

```ts
order.value = await getOrder(id)                       // useOrderCard.ts:381
orderVersion.value = order.value.version ?? null       // :384
```

То есть вместо кода домена приходит `TypeError`, а он попадает в `lineEditErrorKey`,
не совпадает ни с одним кодом каталога и превращается в общий `orders.toast_error_load`
(`frontend_vue/src/composables/useOrderCard.ts:412`).

### Expected

Неизвестный заказ — `ORDER_NOT_FOUND`, как у семи соседних чтений.

---

## БАГ-02 — `DELETE /api/orders/:id` на неизвестный id отвечает успехом

**File:** `frontend_vue/src/services/mocks/orders.ts:2057-2058`
**Severity:** Medium — удаление, ничего не удалившее, неотличимо от удаления состоявшегося.
**Источник:** К3, К5

### Problem

```ts
const idx = STORE.findIndex((o) => o.id === id)
if (idx === -1) return
```

Четыре соседних удаления того же домена этот путь закрыли и объяснили, почему: строка
(`mocks/orders.ts:2356`), услуга (`:2446`), запись истории (`:2479`) и файл (`:2530`) бросают
`*_NOT_FOUND`, а у файла причина расписана прямо — молчаливый успех выводил карточку из фазы
версии (`:2522-2529`). Здесь тот же путь остался открытым, причём **до** проверки версии
(`:2060`): устаревший запрос по уже удалённому заказу получит «готово» вместо конфликта.

### Expected

`ORDER_NOT_FOUND`.

---

## БАГ-03 — удаление заказа из списка не шлёт версию

**File:** `frontend_vue/src/composables/useOrders.ts:46`
**Severity:** Medium — заказ, изменённый в другой вкладке, удаляется без единой проверки.
**Источник:** К4 (формы запроса)

### Problem

```ts
await deleteOrder(id)
```

Клиент умеет принять версию и положить её в `If-Match`
(`frontend_vue/src/services/ordersService.ts:112-113`), и карточка так и делает
(`frontend_vue/src/composables/useOrderCard.ts:575` — `atVersion()`). Список версии не читает
вовсе: `useOrders.ts` берёт из `getOrders` только `OrderListItem`
(`frontend_vue/src/composables/useOrders.ts:33-35`), а в `OrderListItem` поля `version` нет
(`frontend_vue/src/types/order.ts:17-38`). §3 контракта домена требует версию на каждой мутации
(`roo_code/plans/orders/orders-backend-contract.md:97`), и удаление — сильнейшая из них.

### Expected

Либо список получает версию в `OrderListItem` и шлёт её, либо правило §3 явно допускает
удаление без предусловия — и тогда это записано в контракте.

---

## БАГ-04 — `clientId: null` и `sortBy: null` уезжают в query литералом `"null"`

**File:** `frontend_vue/src/services/ordersService.ts:61-65`, `frontend_vue/src/services/api.ts:154-155`
**Severity:** Medium — против настоящего сервера фильтр по клиенту и сортировка получат строку `"null"`.
**Источник:** К4

### Problem

`getOrders` раскладывает фильтры в query как есть:

```ts
return apiGet('/api/orders', {
  ...filters,
  page: String(pagination.page),
  pageSize: String(pagination.pageSize),
} as Record<string, string>)
```

а `apiGet` кладёт каждое значение через `searchParams.set` (`frontend_vue/src/services/api.ts:155`),
который приводит `null` к строке `"null"`. Два поля `OrderFilters` объявлены nullable —
`clientId: string | null` и `sortBy: string | null`
(`frontend_vue/src/types/order.ts:621`, `:624`), — и живые вызывающие с `null` есть:
`frontend_vue/src/composables/useSalesCrmDashboard.ts:36` (`clientId: null`) и
`frontend_vue/src/views/admin/clients/ClientsListPage.vue:112` (`sortBy: null`). Под моками это
не проявляется: ветка читает `params?.clientId ?? null` из уже разобранного объекта
(`frontend_vue/src/services/mocks/index.ts:549`). Тот же дефект у соседа записан отдельной
находкой — см. `roo_code/plans/bugs/contract-sync-clients-bugs.md`, `БАГ-04`.

### Expected

Пустое значение не попадает в query вовсе.

---

## БАГ-05 — ни один статус в настройках не резервирует и не списывает, и весь путь §4.5 мёртв

**File:** `frontend_vue/src/services/mocks/settings.ts:208-346`
**Severity:** High — «смена статуса — это рабочий процесс отгрузки» под моками не воспроизводится ни разу, то есть главный сценарий домена не проверен ничем.
**Источник:** К6 (обязанности), К2 (мок ↔ контракт)

### Problem

Все пятнадцать засеянных статусов несут оба флага выключенными:

```
grep -c "reserveOnTransition: true"  frontend_vue/src/services/mocks/settings.ts  → 0
grep -c "writeOffOnTransition: true" frontend_vue/src/services/mocks/settings.ts  → 0
grep -c "reserveOnTransition: false" frontend_vue/src/services/mocks/settings.ts  → 15
```

`statusRules` читает их по имени `st-<status>` (`frontend_vue/src/services/mocks/orders.ts:1735-1739`),
поэтому `mockPatchOrderStatus` никогда не заходит ни в ветку списания
(`:1813-1822`), ни в ветку резерва (`:1823`), а `mockPlanStatusTransition` всегда отвечает
`reserves: false, writesOff: false` (`:1780`, `:1782`). Между тем §4.5 контракта домена называет
этот путь основным для обычного заказа (`roo_code/plans/orders/orders-backend-contract.md:234`),
а `STATUS_BLOCKED_BY_STOCK` (`mocks/orders.ts:1819`) недостижим.

Рядом — вторая половина того же: статус, заведённый через настройки, получает id `st-<N>`
(`frontend_vue/src/services/mocks/settings.ts:544`), которого нет в перечислении
(`frontend_vue/src/domain/orderStatus.ts:15-31`), — то есть соглашение об имени `st-*` не
проверяется ни на одном входе.

### Expected

Хотя бы один статус в сиде резервирует и хотя бы один списывает, иначе ветка не покрыта.

---

## БАГ-06 — пять мутаций поднимают версию заказа больше одного раза

**File:** `frontend_vue/src/services/mocks/orders.ts:1820-1826`
**Severity:** Medium — клиент, считающий шаги версии сам, получает конфликт, которого не было.
**Источник:** К5, К6 (транзакционность)

### Problem

§3 контракта домена формулирует правило дословно: «Одна принятая запись — один шаг, и ни шага на
отказ» (`roo_code/plans/orders/orders-backend-contract.md:101`), и `bumpVersion` снабжён
комментарием «called exactly once at the end of each endpoint»
(`frontend_vue/src/services/mocks/orders.ts:1945-1955`). Фактически пять операций шагают
многократно, потому что зовут другие эндпоинты внутри себя:

| операция | вложенные шаги | свой шаг |
|---|---|---|
| `PATCH /status` | `mockCreateShipment` (`mocks/orders.ts:1820` → `:3356`), `mockReserveOrder` (`:1823` → `:3928`) | `:1826` |
| `POST /items/:id/correct` | `mockCreateInvoice` на каждый документ (`:2723` → `:4444`) | `:2733` |
| `POST /returns` | `mockCreateInvoice` на каждую корректировку (`:3807` → `:4444`) | `:3836` |
| `POST /shipments/:id/cancel` | `mockCreateInvoice` на каждый живой счёт (`:3413` → `:4444`) | `:3504` |
| `POST /invoices` (отзыв счёта с услугами) | рекурсивный `mockCreateInvoice` (`:4424`) | `:4444` |

Карточку это не ломает только потому, что после каждой такой quick-action она перечитывает заказ
целиком (`frontend_vue/src/composables/useOrderCard.ts:667`, `:732`, `:759`, `:815`, `:1599`) и
берёт версию из ответа (`:384`). Но `serverWrote()` шагает ровно на единицу (`:242-244`), и любой
клиент, который вместо перечитывания считает шаги — как это делает `save()` (`:437-533`), — после
такой операции окажется на несколько версий позади.

### Expected

Одна принятая мутация — один шаг версии, каким бы числом внутренних записей она ни выполнялась.

---

## БАГ-07 — три из четырёх умолчаний нового заказа стоят литералами, хотя настройки ими владеют

**File:** `frontend_vue/src/services/mocks/orders.ts:1634-1638`
**Severity:** High — превью итога на странице создания считается по настройкам арендатора, а сохраняется заказ с НДС 21 и валютой EUR.
**Источник:** К6 (значения по умолчанию)

### Problem

```ts
defaultMarginPercent: mockGetSettings().constants.defaultMargin,   // :1633 — читает настройки
defaultDiscountPercent: 0,                                         // :1634 — литерал
vatMode: data.documentType === 'export' ? 'export_zero' : 'standard',
vatPercent: 21,                                                    // :1637 — литерал
currency: data.currency ?? 'EUR',                                  // :1638 — литерал
```

Настройки владеют всеми четырьмя величинами: `vatRate`, `defaultMargin`, `defaultCurrency`,
`defaultDiscountPercent` (`frontend_vue/src/types/settings.ts:15-18`, сид
`frontend_vue/src/services/mocks/settings.ts:53-56`). Расхождение измеримо на месте: страница
создания считает превью итога по `settings.constants.vatRate`
(`frontend_vue/src/composables/useOrderCreate.ts:364`), а сервер запишет 21 — при ставке
арендатора, отличной от 21, показанный и сохранённый итог разойдутся. И валюта: форма
подставляет `settings.constants.defaultCurrency` (`:43`), но если поле уедет пустым, сервер
подставит `'EUR'`, тогда как функция «взять базовую валюту арендатора» в проекте уже есть и
здесь не вызывается (`baseCurrencyOf`, `frontend_vue/src/services/orderLines.ts:153-161`; в этом
же файле она используется для подписи себестоимости — `mocks/orders.ts:2186`).

### Expected

Все четыре умолчания читаются из настроек арендатора одной функцией, как маржа.

---

## БАГ-08 — разделение строки не спрашивает про неделимый кусок

**File:** `frontend_vue/src/services/mocks/orders.ts:2782`
**Severity:** Medium — разделение может оставить в заказе половину обрезка, которой на полке нет.
**Источник:** К6, К3

### Problem

```ts
const allocations = splitAllocations(item.allocations, shippedQuantity)
```

`splitAllocations` режет разбивку по количеству и об обрезках ничего не знает. У правки
количества этот путь закрыт отказом `QUANTITY_SPLITS_OFFCUT`
(`frontend_vue/src/services/orderLineEdits.ts:157-160`), и причина расписана там же
(`:145-156`): усечённая аллокация выглядит целым куском для всего, что читает её дальше.
§6 контракта домена сам перечисляет четыре места, где неделимость обязана стоять — добавление,
правка количества, отгрузка, возврат (`roo_code/plans/orders/orders-backend-contract.md:414`), —
и разделения среди них нет, при том что оно тоже меняет количество строки.

### Expected

Либо `POST /items/:lineId/split` отвергает разрез внутри куска тем же кодом, либо §6 объясняет,
почему пятое место не нужно.

---

## БАГ-09 — отмена отгрузки не шлёт `Idempotency-Key`

**File:** `frontend_vue/src/services/ordersService.ts:305-311`
**Severity:** Medium — повтор запроса выпустит второй корректирующий счёт и второй набор обратных движений.
**Источник:** К4, К6 (идемпотентность)

### Problem

Три POST домена ключ шлют, и §3 объясняет, почему: повтор не должен ни отправить вторую машину,
ни зачесть деньги дважды (`roo_code/plans/orders/orders-backend-contract.md:93`).

```ts
apiPost(`/api/orders/${orderId}/shipments`, data, { headers: { 'Idempotency-Key': … } })  // :294-296
apiPost(`/api/orders/${orderId}/returns`,  data, { headers: { 'Idempotency-Key': … } })   // :351-353
apiPost(`/api/orders/${orderId}/payments`, data, { headers: { 'Idempotency-Key': … } })   // :385-387
apiPost(`/api/orders/${orderId}/shipments/${shipmentId}/cancel`, data)                    // :310 — без ключа
```

Отмена делает ровно то же, чем обоснован ключ у первых двух: пишет обратные движения по складу
(`frontend_vue/src/services/mocks/orders.ts:3429-3439`) и выпускает корректирующий счёт по каждому
живому документу (`:3413`). Единственная защита сегодня — флаг занятости в карточке
(`frontend_vue/src/composables/useOrderCard.ts:750`), то есть ровно то, что тот же §3 называет
«не защита». Повтор от второго `SHIPMENT_ALREADY_CANCELLED` (`mocks/orders.ts:3379`) спасает
только при том условии, что первый запрос дошёл; при таймауте после записи клиент получит отказ
на операцию, которая удалась.

### Expected

`Idempotency-Key` на отмене отгрузки, как у трёх соседних POST.

---

## БАГ-10 — `POST /api/orders/:id/files` объявлен `void`, возвращает запись, и не проверяет `fileId`

**File:** `frontend_vue/src/services/ordersService.ts:198-204`, `frontend_vue/src/services/mocks/orders.ts:2488-2510`
**Severity:** Low — форма ответа в клиенте не совпадает с реализацией, а неизвестная загрузка становится файлом с именем-заглушкой.
**Источник:** К4, К3

### Problem

Клиент объявляет `Promise<void>` (`frontend_vue/src/services/ordersService.ts:202`), мок
возвращает `OrderFile` целиком (`frontend_vue/src/services/mocks/orders.ts:2509`). Карточка
ответ выбрасывает (`frontend_vue/src/composables/useOrderCard.ts:520`) и рисует строку из
своих данных (`:1621-1631`), поэтому расхождение не видно — до первого потребителя, которому
запись понадобится.

Вторая половина: `fileId` не проверяется ничем. Ветка мока достаёт имя из реестра загрузок
(`frontend_vue/src/services/mocks/index.ts:1098`), а `mockAddOrderFile` подставляет заглушку,
если имени нет:

```ts
name: originalName ?? `File ${fileSeq - 1}`,   // :2500
```

Плюс `url`, `size` и `mime` заполняются заглушками (`frontend_vue/src/services/mocks/orders.ts:2502-2504`), то есть заказ получает
файл, за которым ничего не стоит. Парный `DELETE` при этом на неизвестный id отказывает
(`frontend_vue/src/services/mocks/orders.ts:2530`) — две половины одной операции ведут себя по-разному.

### Expected

Одна форма ответа в клиенте и на сервере; неизвестный `fileId` — отказ.

---

## БАГ-11 — ошибка загрузки списка заказов доходит до человека как текст исключения

**File:** `frontend_vue/src/composables/useOrders.ts:38`, `frontend_vue/src/views/admin/orders/OrdersListPage.vue:190`
**Severity:** Low — на экране появляется `Error: UNKNOWN_SORT_KEY: totalCost` вместо фразы.
**Источник:** К3

### Problem

```ts
} catch (e) {
  error.value = String(e)      // useOrders.ts:38
}
```

и это значение печатается как есть:

```html
<p>{{ error }}</p>             <!-- OrdersListPage.vue:190 -->
```

Таблица, превращающая коды домена в человеческие фразы, лежит рядом и в этом же файле уже
используется — удаление зовёт `lineEditErrorKey` (`frontend_vue/src/composables/useOrders.ts:53`,
таблица — `frontend_vue/src/services/orderLineEdits.ts`, `ERROR_KEYS`). Карточка тоже её зовёт
и объясняет почему: «a key, not the exception's own words»
(`frontend_vue/src/composables/useOrderCard.ts:409-412`). Список — единственное место домена,
где этого не сделали, и именно он умеет получить четыре отказа разбора параметров
(`UNKNOWN_SORT_KEY`, `UNKNOWN_SORT_DIRECTION`, `INVALID_DATE_FILTER`, `INVALID_PAGE` —
`frontend_vue/src/services/mocks/orders.ts:1444`, `:1447`, `:1453`, `:1465`).

### Expected

`lineEditErrorKey(e, 'orders.toast_error_load')`, как в карточке.
