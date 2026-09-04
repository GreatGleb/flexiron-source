# Bugs — contract-sync / домен sales-crm

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4, К6. Аудит: [`roo_code/plans/api/audit/sales-crm.md`](../api/audit/sales-crm.md).
Область: `frontend_vue/src/services/ordersService.ts:53-55` (клиент домена),
ветка sales-crm в `frontend_vue/src/services/mocks/index.ts:538-542`,
`mockGetSalesCrmStats` в `frontend_vue/src/services/mocks/orders.ts:1577-1595`,
`SalesCrmStats` в `frontend_vue/src/types/order.ts:44-57`,
`frontend_vue/src/composables/useSalesCrmDashboard.ts`,
`frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue`,
`frontend_vue/src/services/mocks/orders.spec.ts:2972-3017`,
`frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

**Домен своего слоя не имеет** — весь он живёт в файлах заказов, поэтому у каждой находки ниже
явно указано, какой из двух домен ей владеет. Находки про заказ как таковой лежат в
[`contract-sync-orders-bugs.md`](contract-sync-orders-bugs.md) и здесь не повторяются: в частности
`clientId: null` и `sortBy: null`, уезжающие в query литералом `"null"` из этого же дашборда, —
это БАГ-04 того файла ([`contract-sync-orders-bugs.md`](contract-sync-orders-bugs.md), строка
110), и второй записи не получают.

---

## БАГ-01 — `salesMtd` считает заказанное, включая возвращённое, тогда как то же правило в том же файле считает отгруженное минус возвращённое

**File:** `frontend_vue/src/services/mocks/orders.ts:1585-1587` против
`frontend_vue/src/services/mocks/orders.ts:1312-1324`
**Severity:** High — месячный оборот компании завышен на всё, что клиент вернул, и завышение не
исчезает никогда: возврат не двигает ни статус, ни сумму заказа.
**Источник:** К4 (формы и смысл полей), К6 (производные значения)

### Problem

Сводка складывает сумму заказа целиком:

```ts
const salesMtd = STORE.filter(
  (o) => countsAsSale(o.status) && new Date(o.createdAt) >= monthStart,
).reduce((sum, o) => round2(sum + o.totalAmount), 0)   // orders.ts:1585-1587
```

Двумя с половиной сотнями строк выше, в **том же файле**, под **тем же** предикатом
`countsAsSale`, выручка по товару считается иначе — по тому, что уехало, минус то, что вернулось,
и нетто пересчитывается под это количество:

```ts
if (!countsAsSale(order.status)) continue
for (const item of order.items) {
  const sold = round2(item.shippedQuantity - item.returnedQuantity)
  if (sold <= 0) continue
  net = round2(net + calcLine({ ...toPricingLine(item), quantity: sold }).lineNet)
}                                                       // orders.ts:1312-1324
```

и причина записана там же прямым текстом: «Goods returned were not sold, and leaving them in names
an average price for something nobody ended up buying (§7.2)»
(`frontend_vue/src/services/mocks/orders.ts:1307-1310`).

Расхождение не гипотетическое, потому что **возврат ничего из того, что читает `salesMtd`, не
меняет**:

- статус остаётся тем, что был: `mockCreateReturn` его не присваивает, и `returned` достижим
  только явным `PATCH /status` (`frontend_vue/src/services/mocks/orders.ts:3795-3836`);
- `totalAmount` остаётся тем, что был: возврат только увеличивает счётчик
  (`item.returnedQuantity = round2(item.returnedQuantity + request.quantity)`,
  `frontend_vue/src/services/mocks/orders.ts:3802`, с комментарием «Counted beside what shipped,
  never subtracted from it», `:3800-3801`), а в расчёт суммы уходит **заказанное** количество
  (`toPricingLine` отдаёт `line.quantity`, `frontend_vue/src/services/orderLines.ts:40`;
  `recalcOrder` пишет `order.totalAmount = totals.totalNet`,
  `frontend_vue/src/services/mocks/orders.ts:206`).

То есть заказ на 10 000, из которого клиент вернул девять десятых и получил корректировочные
счета (`mockCreateInvoice(..., kind: 'correction')`,
`frontend_vue/src/services/mocks/orders.ts:3806-3812`), даёт в `salesMtd` те же 10 000. Третье
определение той же выручки — по выставленным и закрытым документам — живёт в
`frontend_vue/src/domain/receivable.ts` (`invoiceBalances`), и с первыми двумя тоже не совпадает.

### Fix

TBD — это выбор из трёх определений выручки, а не опечатка, и его делает владелец: строка
вынесена в [`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md). Код
менять до решения нельзя: любая из трёх версий поменяет число на дашборде.

### Future rule

Одна величина — одно правило и одно место. Предикат `countsAsSale` вынесен в
`frontend_vue/src/domain/orderStatus.ts:121-123` именно затем, чтобы «что считается продажей» не
разъезжалось, — но он отвечает только на вопрос «какой заказ», а не «какая его часть». Второй
вопрос остался в двух местах и разъехался.

---

## БАГ-02 — KPI подписан знаком `€` константой, валюты в ответе нет, а заказы разных валют складываются в одно число

**File:** `frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue:43-45`, `:149`;
`frontend_vue/src/types/order.ts:48-57`; `frontend_vue/src/services/mocks/orders.ts:1585-1587`
**Severity:** High — число на дашборде подписано валютой, которой у него нет, и при нескольких
валютах в хранилище подпись прямо неверна.
**Источник:** К4, К6 (значения по умолчанию и их владелец)

### Problem

Страница форматирует оборот своим форматтером с вшитым знаком:

```ts
function formatCurrency(value: number): string {
  return `€ ${value.toFixed(2)}`        // SalesCrmPage.vue:43-45
}
```

и печатает его как есть: `{{ formatCurrency(totalSalesMtd) }}`
(`frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue:149`).

Три вещи делают это неверным, и все три проверяются:

1. **В ответе валюты нет.** У `SalesCrmStats` четыре числовых поля и ни одного поля валюты
   (`frontend_vue/src/types/order.ts:48-57`), тогда как у строки списка она есть
   (`OrderListItem.currency`, `frontend_vue/src/types/order.ts:31`) и у заказа тоже
   (`Order.currency`, `frontend_vue/src/types/order.ts:468`).
2. **Мок складывает валюты не глядя.** `reduce((sum, o) => round2(sum + o.totalAmount), 0)`
   (`frontend_vue/src/services/mocks/orders.ts:1587`) — ни группировки, ни фильтра по
   `o.currency`. Валюта заказа берётся у настроек при создании
   (`data.currency ?? 'EUR'`, `frontend_vue/src/services/mocks/orders.ts:1638`; форма подставляет
   `settings.constants.defaultCurrency`, `frontend_vue/src/composables/useOrderCreate.ts:43`), а
   справочник настроек содержит не одну запись (`EUR`, `USD`, `GBP`, …,
   `frontend_vue/src/services/mocks/settings.ts:68-85`). Курса в проекте нет нигде, то есть
   сложить их и нельзя — валюта у суммы это подпись, а не множитель.
3. **Та же страница восемью десятками строк ниже делает правильно.** Строка таблицы печатает
   `{{ order.currency }} {{ money(order.totalWithVat) }}`
   (`frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue:216`), где `money` — это
   `formatCents` из доменного модуля (импорт `:8`). То есть на одном экране два форматтера денег:
   доменный для строк и локальный `formatCurrency` для KPI, причём второй дублирует
   `round2(value).toFixed(2)` из первого (`frontend_vue/src/domain/orderPricing.ts:131-133`).

### Fix

Убрать `formatCurrency` и печатать KPI тем же `money()`; знак валюты — из ответа. Какое поле
сервер обязан присылать (одна валюта сводки, или разбивка по валютам, при отсутствии курсов) —
решение владельца, строка вынесена в
[`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md).

### Future rule

Форматтер денег в проекте один — `formatCents`/`round2` в `frontend_vue/src/domain/orderPricing.ts`.
Локальная функция с тем же смыслом рядом с ним — признак, что знак валюты собираются вшить.

---

## БАГ-03 — `pendingOrders` — единственное из четырёх чисел, посчитанное перечислением статусов

**File:** `frontend_vue/src/services/mocks/orders.ts:1591`
**Severity:** Medium — статус, добавленный через настройки, автоматически попадёт в два числа из
трёх статусных и не попадёт в это никогда.
**Источник:** К6 (производные значения)

### Problem

```ts
activeOrders: STORE.filter((o) => isActive(o.status)).length,                       // :1590
pendingOrders: STORE.filter((o) => o.status === 'new' || o.status === 'confirmed').length,  // :1591
```

Два соседних числа читают предикаты доменного модуля — `isActive`
(`frontend_vue/src/domain/orderStatus.ts:103-105`) и `countsAsSale` (`:121-123`), — и оба этих
предиката снабжены объяснением, почему список статусов неверен по построению: «a list goes stale
on the next status somebody adds, and it went stale exactly that way once already (contract §4.7)»
(`frontend_vue/src/domain/orderStatus.ts:99-101`) и «Stated as an exclusion rather than the old
list of `confirmed | shipped | delivered`, which quietly left out `paid`» (`:117-119`).

`pendingOrders` — тот самый список, от которого домен отказался. Функции `isPending` в модуле нет
(`grep -c "isPending" frontend_vue/src/domain/orderStatus.ts` → `0`), поэтому правило существует в
двух экземплярах: выражением в моке (`frontend_vue/src/services/mocks/orders.ts:1591`) и фразой в комментарии типа — «Waiting on somebody:
new or confirmed» (`frontend_vue/src/types/order.ts:51-52`).

Последствие измеримо на существующем механизме: статусы принадлежат настройкам — пятнадцать
записей `st-<имя>` в сиде (`frontend_vue/src/services/mocks/settings.ts:208-346`), новый заводится
с id `st-<N>` (`:544`). Такой статус будет «не терминальным», то есть попадёт в `activeOrders`, и
«не new, не отмена, не returned», то есть попадёт в `salesMtd`, — а в `pendingOrders` не попадёт
ни при каких условиях.

### Fix

Предикат `isPendingOrder(status)` в `frontend_vue/src/domain/orderStatus.ts`, рядом с двумя
существующими, и вызов его из мока. Формулировка (какие статусы «ждут кого-то» и почему) —
решение владельца, строка вынесена в
[`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md).

### Future rule

`frontend_vue/src/domain/orderStatus.ts` — единственное место, где перечисляются статусы. Условие
`o.status === '...' || o.status === '...'` вне этого файла — уже дефект, независимо от того, верен
ли список сегодня.

---

## БАГ-04 — дата клиента без времени разбирается как UTC и сравнивается с местной полуночью

**File:** `frontend_vue/src/services/mocks/orders.ts:1593` (сравнение),
`frontend_vue/src/services/mocks/clients.ts:1085` (формат даты),
`frontend_vue/src/services/mocks/demoClock.ts:55-61` (тот же формат у сида)
**Severity:** Medium — клиент, зарегистрированный первого числа, не попадает в счёт «новых за
месяц» в любом поясе западнее UTC; заказ той же даты попадает.
**Источник:** К4 (формы: тип и точность поля)

### Problem

Порог считается местной полуночью первого числа:

```ts
const monthStart = new Date()
monthStart.setDate(1)
monthStart.setHours(0, 0, 0, 0)      // orders.ts:1578-1580
```

С ним сравниваются **две даты разной точности**:

- заказ несёт полный инстант — `orderDate.toISOString()`
  (`frontend_vue/src/services/mocks/orders.ts:513`), при создании то же
  (`new Date().toISOString()`, `:1668`);
- клиент несёт день без времени — `new Date().toISOString().slice(0, 10)`
  (`frontend_vue/src/services/mocks/clients.ts:1085`), сид тот же формат
  (`createdAt: '2025-01-10'`, `frontend_vue/src/services/mocks/clients.ts:22`), сдвиг демо-часов
  тоже отдаёт `YYYY-MM-DD` (`frontend_vue/src/services/mocks/demoClock.ts:55-61`).

`new Date('2026-09-01')` по спецификации — **UTC**-полночь, а `monthStart` — местная. В поясе
`UTC-5` порог равен `2026-09-01T05:00Z`, и клиент с датой `2026-09-01` (то есть
`2026-09-01T00:00Z`) оказывается **раньше** порога и в счёт не попадает.

Что делает находку доказанной, а не теоретической: **сам проект уже знает эту ловушку и обходит
её в другом файле**. `shiftDemoDay` разбирает ту же строку с явным местным временем —
`new Date(day + 'T00:00:00')` (`frontend_vue/src/services/mocks/demoClock.ts:56`), — а сводка
разбирает её голым `new Date(c.createdAt)` (`frontend_vue/src/services/mocks/orders.ts:1593`).

Пояса арендатора при этом нет нигде: `grep -ci "timezone" frontend_vue/src/types/settings.ts` →
`0`; на бэкенде единственное совпадение — свойство колонки `DateTime(timezone=True)`
(`backend/app/modules/settings/shared/models.py:57`). Тот же пробел у соседа —
`00-решения-владельца.md`, строка `audit-feed · Настройки, которых мок не отслеживает`.

### Fix

Разбирать день так же, как это делает `demoClock` — с явным `'T00:00:00'`, — либо сравнивать
строками (`c.createdAt >= monthStartDay`), как это уже делает фильтр списка заказов
(`o.createdAt.slice(0, 10) >= filters.dateFrom`,
`frontend_vue/src/services/mocks/orders.ts:1523`). Выбор пояса, в котором сервер режет месяц, —
решение владельца.

### Future rule
`YYYY-MM-DD` и ISO-инстант — два разных типа, и `new Date()` разбирает их в двух разных поясах.
Сравнение даты без времени с `Date`, полученным из `setHours`, — всегда дефект: либо оба конца
строки, либо оба конца инстанты.

---

## БАГ-05 — юнит-спека сводит `activeOrders` руками по более слабому предикату и зелена только из-за сида

**File:** `frontend_vue/src/services/mocks/orders.spec.ts:2989-2998`
**Severity:** Medium — тест утверждает не то правило, что код, и не заметит возврата к правилу,
от которого домен отказался.
**Источник:** К3/К4 (доказательная база правила)

### Problem

```ts
it('agrees with counting the orders by hand', () => {
  const stats = mockGetSalesCrmStats()
  const orders = allOrders()
  expect(stats.activeOrders).toBe(
    orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length,
  )                                                    // orders.spec.ts:2992-2994
```

Код считает иначе: `isActive` — это «не `delivered` и не терминальный»
(`frontend_vue/src/domain/orderStatus.ts:103-105`), а терминальных шесть — `completed`,
`returned` и четыре вида отмены (`isTerminal` `:92-94`, `isCancellation` `:82-89`). То есть
предикат спеки шире предиката кода на пять статусов: `completed`, `returned`, `rejected`,
`cancelled_by_customer`, `refused`.

Спека зелёная только потому, что ни один из этих пяти в хранилище не встречается:
`generateOrders` раздаёт восемь статусов и среди них нет ни одного из пяти
(`frontend_vue/src/services/mocks/orders.ts:390-399`), а единственная функция, которая статус
пересчитывает, умеет вернуть лишь `cancelled | paid | confirmed | new | shipped | delivered`
(`statusFromFacts`, `frontend_vue/src/services/mocks/orders.ts:713-725`).

Инверсия, доказывающая, что проверка не работает: заведи в сиде один заказ в `completed` — и два
предиката разойдутся, причём покраснеет спека, а не код.

### Fix

Сводить руками через предикат домена (`isActive`), а не через список: тогда тест проверяет
«сводка считает по правилу домена», а не «сводка считает по списку, который я тут написал». Ещё
лучше — отдельным тестом на сам предикат, по всем пятнадцати статусам из `ORDER_STATUSES`
(`frontend_vue/src/domain/orderStatus.ts:15-31`).

### Future rule

Тест, который переписывает правило продакшена своими словами, проверяет свою версию правила.
Правило берётся из того же модуля, что и код, — или проверяется по полному перечню значений, а не
по тем, что попали в сид.

---

## БАГ-06 — спека `salesMtd` и `newClientsThisMonth` дословно повторяет выражение продакшена, а e2e утверждает два числа из четырёх

**File:** `frontend_vue/src/services/mocks/orders.spec.ts:3000-3016`,
`frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts:43-46`
**Severity:** Medium — два из четырёх чисел домена не проверены ничем, что сломалось бы от
неверного правила.
**Источник:** К3/К4

### Problem

Ожидание в спеке собрано тем же выражением, что и проверяемый код, символ в символ:

```ts
const expectedSales = allOrders()
  .filter((o) => countsAsSale(o.status) && new Date(o.createdAt) >= monthStart)
  .reduce((sum, o) => round2(sum + o.totalAmount), 0)     // orders.spec.ts:3010-3011
expect(stats.salesMtd).toBe(expectedSales)
expect(stats.newClientsThisMonth).toBe(
  mockGetClients().filter((c) => new Date(c.createdAt) >= monthStart).length,
)                                                          // :3013-3015
```

против продакшена:

```ts
const salesMtd = STORE.filter(
  (o) => countsAsSale(o.status) && new Date(o.createdAt) >= monthStart,
).reduce((sum, o) => round2(sum + o.totalAmount), 0)       // orders.ts:1585-1587
newClientsThisMonth: mockGetClients().filter((c) => new Date(c.createdAt) >= monthStart).length,
                                                            // orders.ts:1593
```

Такой тест доказывает только то, что `STORE` и `allOrders()` — одно и то же множество. Оба дефекта,
записанные выше как БАГ-01 (заказанное вместо отгруженного) и БАГ-04 (разбор даты без времени как
UTC), присутствуют в спеке ровно в том же виде, поэтому она их не видит **по построению**.

E2E прикрывает только другую половину: он утверждает `active-orders` и `pending-orders`
(`frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts:43-46`), а `salesMtd` и
`newClientsThisMonth` не читает вовсе — единственный созданный им заказ пуст, то есть оборот и не
должен двигаться.

### Fix

Проверять смысл, а не выражение: заказ с известной суммой, созданный внутри теста, обязан
увеличить `salesMtd` на эту сумму; возврат по нему — уменьшить (после решения по БАГ-01); клиент,
созданный внутри теста, обязан увеличить `newClientsThisMonth` на единицу. Плюс клиент с датой
первого числа месяца — граничный случай БАГ-04.

### Future rule

Ожидание, скопированное из реализации, — не проверка. Ожидание строится из входа теста
(«положил заказ на 500 → жду +500»), а не из того же кода, который проверяется. Правило уже записано в проекте после разбора
страницы создания заказа: зелёный прогон не доказывает поведение, если ожидание построено из
того же выражения.

---

## БАГ-07 — текст ошибки печатается сырым, и отказ любого из трёх чтений обнуляет дашборд целиком

**File:** `frontend_vue/src/composables/useSalesCrmDashboard.ts:30-52`, `:63-64`;
`frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue:105-108`
**Severity:** Low — на экране появляется `UNKNOWN_SORT_KEY` вместо фразы, и вместо трёх панелей
из четырёх остаётся одна строка.
**Источник:** К3 (коды ошибок доходят до человекочитаемого сообщения)

### Problem

```ts
const [stats, ordersResult, clientsResult] = await Promise.all([
  getSalesCrmStats(), getOrders(...), getClients(...),
])                                          // useSalesCrmDashboard.ts:30-52
} catch (e) {
  error.value = e instanceof Error ? e.message : String(e)   // :63-64
}
```

и это значение печатается как есть, вместо всего содержимого страницы:

```html
<div v-else-if="error" class="error-state" data-test="sales-crm-error">
  <p>{{ error }}</p>                        <!-- SalesCrmPage.vue:105-108 -->
```

Две части. Первая: сам домен не бросает ничего (`mockGetSalesCrmStats` без единого `throw`,
`frontend_vue/src/services/mocks/orders.ts:1577-1595`), но в это поле попадает код **чужого**
домена — список заказов умеет отказать четырьмя (`UNKNOWN_SORT_KEY`,
`UNKNOWN_SORT_DIRECTION`, `INVALID_DATE_FILTER`, `INVALID_PAGE` —
`frontend_vue/src/services/mocks/orders.ts:1444`, `:1447`, `:1453`, `:1465`). Таблица перевода
кодов в фразы в проекте есть и в соседних файлах вызывается с объяснением, зачем
(`frontend_vue/src/composables/useOrderCard.ts:409-412`, таблица `ERROR_KEYS` в
`frontend_vue/src/services/orderLineEdits.ts`); этот композабл её не зовёт. Тот же дефект у списка
заказов — БАГ-11 в [`contract-sync-orders-bugs.md`](contract-sync-orders-bugs.md) (строка 336 того файла);
здесь это другое место и другой файл, поэтому запись своя.

Вторая: `Promise.all` отвергается первым же отказом, поэтому упавший список клиентов уносит с
собой и сводку, и список заказов, которые ответили успешно. Четыре KPI, которые считаются
отдельным запросом именно затем, чтобы не зависеть от страницы списка
(`frontend_vue/src/types/order.ts:44-47`), при отказе этого списка всё равно не показываются.

### Fix

`Promise.allSettled` вместо `Promise.all` — каждая панель показывает либо свои данные, либо свою
ошибку; и `lineEditErrorKey(e, ...)` вместо `e.message`, как в карточке заказа.

### Future rule

`Promise.all` в загрузчике страницы связывает независимые панели в одну судьбу. Если панели
показываются по отдельности — читать их надо тоже по отдельности.

---

## Сводка

| | Тип | Файл | Суть |
|---|---|---|---|
| | Contract | `mocks/orders.ts` | БАГ-01: `salesMtd` считает заказанное, включая возвращённое; тот же файл двумя сотнями строк выше считает отгруженное минус возвращённое |
| | Contract | `SalesCrmPage.vue` | БАГ-02: `€` вшит в форматтер KPI, валюты в ответе нет, заказы разных валют складываются |
| | Contract | `mocks/orders.ts` | БАГ-03: `pendingOrders` — единственное из четырёх чисел, посчитанное списком статусов |
| | Contract | `mocks/orders.ts` | БАГ-04: дата клиента без времени разбирается как UTC и сравнивается с местной полуночью |
| | Test | `mocks/orders.spec.ts` | БАГ-05: спека сводит `activeOrders` по более слабому предикату — зелена из-за состава сида |
| | Test | `mocks/orders.spec.ts` | БАГ-06: ожидание `salesMtd` и `newClientsThisMonth` дословно повторяет выражение продакшена |
| | Contract | `useSalesCrmDashboard.ts` | БАГ-07: сырой текст ошибки, и `Promise.all` обнуляет дашборд при отказе любого из трёх чтений |
