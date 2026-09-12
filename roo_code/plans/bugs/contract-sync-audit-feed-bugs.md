# Bugs — contract-sync / домен audit-feed

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4, К6. Аудит: [`roo_code/plans/api/audit/audit-feed.md`](../api/audit/audit-feed.md).
Область: `frontend_vue/src/services/auditFeedService.ts`,
`frontend_vue/src/services/mocks/auditFeed.ts`, `frontend_vue/src/services/mocks/auditClock.ts`,
ветки audit-feed в `frontend_vue/src/services/mocks/index.ts`,
`frontend_vue/src/composables/useAuditFeed.ts`, `frontend_vue/src/types/audit.ts`,
`frontend_vue/src/views/admin/settings/LogsSettings.vue`.
Модуля `audit-feed` на бэкенде нет (`ls backend/app/modules/`, `grep -rn "audit-feed" backend/`
— пусто), поэтому источник истины домена — мок и клиент.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — право `seeCost` обходится через общую ленту: записи истории с ценой видны тому, кому цена закрыта

**File:** `frontend_vue/src/services/mocks/auditFeed.ts:43-60`, `frontend_vue/src/types/audit.ts:63-74`, `frontend_vue/src/services/mocks/orders.ts:4683-4690`
**Severity:** High — то же право, обойдённое другой дорогой: карточка заказа его соблюдает, а лента отдаёт те же записи целиком.
**Источник:** К6 (обязанности сервера: права), К4 (форма ответа теряет поле)

### Problem

Запись истории заказа сама говорит, выдаёт ли она себестоимость: `sensitive: 'cost' | null`
(`frontend_vue/src/types/order.ts:591-606`), и поле объявлено обязательным именно для того,
чтобы «узнавать себестоимость по словам» не стало правилом (`frontend_vue/src/types/order.ts:600-604`).

Мок заказа это право применяет **на сервере**, а не занавеской:

```ts
if (!maySeeCost()) {
  copy.auditLog = copy.auditLog.filter((entry) => entry.sensitive !== 'cost')
}
```

(`frontend_vue/src/services/mocks/orders.ts:1384-1386`, право — `:1391-1394`; карточка вешает
вторую, признанную вторичной, занавеску — `frontend_vue/src/views/admin/orders/OrderCardPage.vue:311-313`.)

Общая лента идёт мимо этой функции. `orderAuditSources()` отдаёт `o.auditLog` из хранилища как
есть (`frontend_vue/src/services/mocks/orders.ts:4683-4690`), `toRows` собирает строку из девяти
полей и `sensitive` среди них нет (`frontend_vue/src/services/mocks/auditFeed.ts:47-60`), а
`AuditFeedRow` такого поля не объявляет вовсе (`frontend_vue/src/types/audit.ts:63-74`). То есть:

- `GET /api/audit-feed` отдаёт записи «Себестоимость: 100,00 → 130,00» пользователю, которому
  `seeCost` не разрешён, — фильтра по праву в ветке мока нет ни строки
  (`frontend_vue/src/services/mocks/index.ts:394-409`);
- клиент **не смог бы** их скрыть даже при желании: признака в строке нет, а по трём переводам
  `property` его не опознать — ровно то, о чём предупреждает комментарий типа
  (`frontend_vue/src/types/order.ts:600-602`).

Почему не видно в демо: профиль по умолчанию — `owner` (`frontend_vue/src/services/mocks/settings.ts:353`),
а `seeCost` разрешён `owner`, `admin`, `accounting` (`frontend_vue/src/services/mocks/settings.ts:62-66`). Достаточно профиля с ролью
`manager` или `warehouse` (`frontend_vue/src/services/mocks/settings.ts:190`, `:195`), чтобы
карточка заказа скрыла запись, а страница «Настройки → Логи» показала её же.

### Fix

TBD — правка затрагивает и форму ответа, и место проверки, а форма ответа принадлежит контракту.
Развилка, которую обязан снять владелец: сервер **вырезает** такие записи из ленты (тогда `total`
и пагинация считаются после вырезания, и признак в ответе не нужен) или **отдаёт признак**
`sensitive` в строке ленты, а скрывает клиент (тогда это занавеска, и §5 контракта заказов её
запрещает). Строка вынесена в
[`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md).

### Future rule

Право, которое применяется на выходе одного эндпоинта, обязано применяться на выходе **всех**,
кто отдаёт те же строки. У ленты аудита девять источников, и правило «источник отдаёт тот самый
массив, что читает карточка» (`frontend_vue/src/services/mocks/auditFeed.ts:15-31`) — именно то,
что делает такой обход неизбежным: массив канонический, а фильтр права стоял в обёртке над ним.

---

## БАГ-02 — `switch` без `default`: неизвестный `entityType` отвечает «удалено» и не удаляет ничего

**File:** `frontend_vue/src/services/auditFeedService.ts:57-77`, `frontend_vue/src/composables/useAuditFeed.ts:93-108`
**Severity:** Medium — человек видит «Запись аудита удалена», запись остаётся; расхождение живёт до следующей перезагрузки страницы.
**Источник:** К4 (значение поля приходит от сервера, а обрабатывается как замкнутое множество)

### Problem

Маршрутизатор удаления перечисляет девять видов и не имеет ветки по умолчанию:

```ts
export async function deleteAuditFeedEntry(row: AuditFeedRow): Promise<void> {
  switch (row.entityType) {
    case 'product': …
    case 'deficit': …
  }
}
```

(`frontend_vue/src/services/auditFeedService.ts:57-77`.) Функция `async`, поэтому при
несовпадении она возвращает `undefined` — то есть **успешно завершается**. Дальше в композабле
успех означает три вещи: строка убирается из списка, `total` уменьшается, показывается тост
успеха (`frontend_vue/src/composables/useAuditFeed.ts:96-100`).

`entityType` — не локальный литерал, а поле ответа сервера (`frontend_vue/src/types/audit.ts:64`,
заполняется из источника — `frontend_vue/src/services/mocks/auditFeed.ts:48`). Типизация union
защищает от ошибки в своём коде и ничего не обещает про то, что пришло по сети: десятый вид
сущности на сервере (перечень объявлен замкнутым во фронте, `frontend_vue/src/types/audit.ts:4`,
но на сервере такого ограничения нет — таблиц журнала на схеме две, а видов девять) даёт молчаливый
ложный успех. Строка вернётся на экран после `load()` — но `load()` идёт **после** тоста
(`frontend_vue/src/composables/useAuditFeed.ts:99-100`), и человек увидит «удалено», а затем
запись на месте.

Тот же неизвестный вид, попав в строку ленты, ломает и ссылку: `AUDIT_ENTITY_ROUTES[entityType]`
даст `undefined` в `router-link` (`frontend_vue/src/views/admin/settings/LogsSettings.vue:206-210`).

### Fix

Добавить ветку по умолчанию, которая **бросает**, а не возвращает: неизвестный вид — это ошибка
данных, и она обязана дойти до `catch` в `removeEntry`
(`frontend_vue/src/composables/useAuditFeed.ts:102-104`), где уже есть тост отказа. Ветка
`default` с `throw` в `switch` по union заодно перестанет компилироваться, если к девяти видам
добавят десятый и забудут про этот файл.

### Future rule

`switch` по значению, пришедшему от сервера, без `default` — это `if` без `else`, выдающий
молчание за успех. Ветка по умолчанию обязательна там, где отсутствие ветки означает «ничего не
сделал», а вызывающий читает это как «сделал».

---

## БАГ-03 — фильтр по датам режет UTC-день, а таблица печатает местный

**File:** `frontend_vue/src/services/mocks/auditFeed.ts:39-41`, `frontend_vue/src/views/admin/settings/LogsSettings.vue:96-106`
**Severity:** Medium — запись, показанная в таблице сегодняшним числом, не попадает в выборку «сегодня»; при этом фильтр выглядит работающим.
**Источник:** К6 (настройки, которых мок не отслеживает: часовой пояс)

### Problem

День записи для фильтра берётся первыми десятью символами штампа:

```ts
function auditDay(timestamp: string): string {
  return timestamp.slice(0, 10)
}
```

(`frontend_vue/src/services/mocks/auditFeed.ts:39-41`, применение — `:74-75`.)

В логах живут два формата штампа, и это записано в самом коде: `2026-04-23 13:17` (местное время
без пояса) и полный ISO с `Z` (`frontend_vue/src/services/mocks/auditClock.ts:26-29`; сиды —
`frontend_vue/src/mocks/warehouse-stock.ts:26`, `frontend_vue/src/services/mocks/clients.ts:49`).
Записи, созданные во время работы, пишутся строго в UTC:
`timestamp: new Date().toISOString()` (`frontend_vue/src/services/mocks/orders.ts:1880`).

Таблица при этом печатает **местное** время: `parsed.toLocaleString(...)` без указания зоны
(`frontend_vue/src/views/admin/settings/LogsSettings.vue:96-106`), и для ISO-штампа с `Z`
`Date` переводит его в зону браузера.

Отсюда расхождение на границе суток. Пользователь в зоне UTC+3 меняет статус заказа в 23:30
местного времени — запись получает штамп `…T20:30:00Z` (`frontend_vue/src/services/mocks/orders.ts:1880`),
таблица показывает её сегодняшним числом, а фильтр «от сегодня» её не находит: `slice(0, 10)`
даёт сегодняшнюю UTC-дату только до 21:00 местного времени. Правило общее: смещение зоны на N
часов делает неверными последние N часов суток при положительном смещении и первые |N| — при
отрицательном. Засеянные логи ломаются в отрицательную сторону начиная с UTC−9, потому что самый
ранний ISO-штамп в них — 08:00Z: `grep -rho "timestamp: '[^']*T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]Z'" frontend_vue/src | sed "s/.*T/T/" | sort | head -1`
→ `T08:00:00Z`.

Пояса арендатора в проекте нет: `grep -ci "timezone" frontend_vue/src/types/settings.ts` → 0.

### Fix

**Разблокировано — П62.** [`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md), строка 1928:

> **решено 2026-09-10:** граница дня у `dateFrom`/`dateTo` режется **по часовому поясу компании**
> (П62); срока жизни у записи истории нет — не удаляем, хранение станет предметом тарифа (П61);
> `pageSize` сверху ограничивает код, а не сервер (П20); перечень видов сущности тарифом не
> сужается — их десять по составу (П42)

Работа по коду та же, что была названа: считать день тем же способом, каким его печатает таблица,
и одной функцией на оба места — но зона теперь названа, это часовой пояс компании, а не браузера
и не UTC.

### Future rule

Фильтр по дате и печать даты обязаны выводить день **одним** способом. Два способа расходятся
ровно на границе суток — там, где это заметит только тот, кто работает вечером.

---

## БАГ-04 — зажатая сервером страница вызывает второй одинаковый запрос

**File:** `frontend_vue/src/composables/useAuditFeed.ts:66-68`, `:124`
**Severity:** Low — лишний сетевой запрос и лишняя перерисовка; данных не портит.
**Источник:** К4 (клиент принимает поле ответа в тот же `ref`, за которым сам же следит)

### Problem

`load()` присваивает пришедший номер страницы в тот самый `ref`, на который повешен наблюдатель:

```ts
total.value = result.total
page.value = result.page
```

(`frontend_vue/src/composables/useAuditFeed.ts:67-68`), при `watch(page, load)` на `:124`.

Сервер номер страницы **зажимает** в границы: `page = Math.min(Math.max(1, pagination.page), totalPages)`
(`frontend_vue/src/services/mocks/auditFeed.ts:98`). Значит любой запрос страницы вне диапазона —
удалили последнюю строку последней страницы, сузили фильтр, пришли по ссылке с `page=99` —
возвращает другой номер, присваивание меняет `page`, наблюдатель зовёт `load()` второй раз.
Второй ответ уже совпадает с состоянием, и цикл останавливается на двух запросах, а не уходит в
бесконечность.

Заметнее всего это на удалении последней записи страницы: `removeEntry` уже вызывает `load()`
сам (`frontend_vue/src/composables/useAuditFeed.ts:100`), и вместе с наблюдателем выходит три
запроса на одно нажатие.

### Fix

Не присваивать `page.value` из ответа, а сравнивать: присваивать только при фактическом
расхождении и с флагом «это ответ сервера, а не действие человека», чтобы наблюдатель не считал
это новым намерением. Общий композабл `usePagination` такого флага не имеет
(`frontend_vue/src/composables/usePagination.ts:40-54`) — правка либо локальная здесь, либо в
нём, и тогда её увидят все страницы со списками.

### Future rule

Присваивание в `ref`, за которым следит `watch`, внутри функции, которую этот же `watch` и
вызывает, — это скрытая рекурсия. Она безопасна, пока сервер возвращает то же значение, и
перестаёт быть безопасной в тот день, когда он начинает поправлять запрос.

---

## БАГ-05 — упавший список авторов выглядит как «авторов нет»

**File:** `frontend_vue/src/composables/useAuditFeed.ts:77-83`
**Severity:** Low — фильтр по пользователю молча становится пустым; человек считает, что записей от людей нет.
**Источник:** К3 (ошибка не доходит до человека ни кодом, ни текстом)

### Problem

```ts
async function loadUsers() {
  try {
    users.value = await getAuditFeedUsers()
  } catch {
    users.value = []
  }
}
```

(`frontend_vue/src/composables/useAuditFeed.ts:77-83`.) Отказ `GET /api/audit-feed/users` —
истёкший токен, 500, обрыв сети — не пишется ни в `error`, ни в тост, ни в консоль. Селект
«Пользователь» остаётся с единственным пунктом «Все пользователи»
(`frontend_vue/src/views/admin/settings/LogsSettings.vue:63-66`), то есть выглядит нормально
работающим и пустым. Лента при этом грузится: у неё свой вызов и свой `error`
(`frontend_vue/src/composables/useAuditFeed.ts:58-75`), так что противоречия на экране не
возникает — записи с именами авторов есть, а фильтровать по ним нельзя.

### Fix

Различать «список пуст» и «список не пришёл»: сохранить причину и показать её в самом селекте
или тостом. Блокировать страницу не нужно — фильтр не обязателен для работы.

### Future rule

`catch` с присваиванием пустого значения превращает отказ в законный ответ. Пустой список от
сервера и упавший запрос — разные факты; UI, который их не различает, врёт молча.

---

## БАГ-06 — `pageSize` и `totalPages` из ответа не читает никто, страница считает их сама

**File:** `frontend_vue/src/composables/useAuditFeed.ts:66-68`, `frontend_vue/src/composables/usePagination.ts:8`
**Severity:** Low — сегодня числа совпадают; расходятся в тот день, когда сервер поправит `pageSize`.
**Источник:** К4 (поля ответа без потребителя), К6 (производные значения)

### Problem

Ответ несёт пять полей — `items`, `total`, `page`, `pageSize`, `totalPages`
(`frontend_vue/src/types/audit.ts:104-110`, сборка — `frontend_vue/src/services/mocks/auditFeed.ts:101-107`).
Композабл читает три (`frontend_vue/src/composables/useAuditFeed.ts:66-68`), а число страниц
считает у себя из своего же `pageSize`:

```ts
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
```

(`frontend_vue/src/composables/usePagination.ts:8`, показ — `frontend_vue/src/views/admin/settings/LogsSettings.vue:252`.)

Пока сервер отдаёт `pageSize` в точности тот, что попросили, оба ответа совпадают. Мок его уже
правит — снизу: `Math.max(1, pagination.pageSize)` (`frontend_vue/src/services/mocks/auditFeed.ts:96`),
а верхней границы у него нет вовсе, при том что спека зовёт мок с `pageSize: 10_000`
(`frontend_vue/src/services/mocks/auditFeed.spec.ts:16`). В день, когда сервер ограничит размер
страницы сверху — а ограничить обязан, — страница будет листать по своему числу страниц и
показывать неверный диапазон «показано с — по»
(`frontend_vue/src/composables/usePagination.ts:12-13`).

### Fix

Считать `totalPages` ответом сервера, а не своим вычислением: принимать `pageSize` и `totalPages`
из ответа так же, как уже принимаются `total` и `page`. Правка касается общего композабла
(`frontend_vue/src/composables/usePagination.ts:8`), поэтому её объём — весь список страниц со
серверной пагинацией, а не одна лента; в аудите это записано как пробел контракта, а не как
локальная правка.

### Future rule

Одно число, посчитанное на двух сторонах, — это два числа. Если сервер его прислал, клиент обязан
его читать, иначе первый же предел на стороне сервера разъедет их молча.

---

## Сводка

| БАГ-NN | Тип | Файл | Суть |
|---|---|---|---|
| БАГ-01 | Права | `mocks/auditFeed.ts:43-60`, `types/audit.ts:63-74` | право `seeCost` обходится через ленту: записи `sensitive: 'cost'` попадают в неё целиком |
| БАГ-02 | Корректность | `services/auditFeedService.ts:57-77` | `switch` без `default` — неизвестный `entityType` тихо «успешно удалён» |
| БАГ-03 | Корректность | `mocks/auditFeed.ts:39-41` | фильтр по датам режет UTC-день, а таблица печатает местный |
| БАГ-04 | Реактивность | `composables/useAuditFeed.ts:66-68`, `:124` | зажатая сервером страница вызывает второй одинаковый запрос |
| БАГ-05 | UX ошибок | `composables/useAuditFeed.ts:77-83` | упавший список авторов выглядит как «авторов нет» |
| БАГ-06 | Контракт | `composables/useAuditFeed.ts:66-68`, `composables/usePagination.ts:8` | `pageSize` и `totalPages` из ответа не читает никто |
