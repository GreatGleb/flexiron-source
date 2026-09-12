# Bugs — contract-sync / домен bcc

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К6. Аудит: [`roo_code/plans/api/audit/bcc.md`](../api/audit/bcc.md).
Область: `frontend_vue/src/services/bccService.ts`, `frontend_vue/src/services/mocks/bcc.ts`,
ветки bcc в `frontend_vue/src/services/mocks/index.ts`,
`frontend_vue/src/composables/useBccRequest.ts`, `frontend_vue/src/domain/bccEmail.ts`,
`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`,
`backend/app/modules/bcc/`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## ✅ БАГ-01 — продакшн-страница импортирует мок-стор и пишет в него

**File:** `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:19,293,440`
**Severity:** Critical — против настоящего сервера строки истории BCC не будет создавать никто, а мок-данные останутся в продакшн-бандле.
**Источник:** К2 (мок ↔ контракт ↔ код), К6 (транзакционность)

### Problem

Страница админки импортирует мок напрямую:

```ts
import { MOCK_BCC_HISTORY } from '@/services/mocks/bcc'   // :19
```

и дописывает в него результат своих действий:

```ts
MOCK_BCC_HISTORY.unshift(...rows)   // :293 после отправки
MOCK_BCC_HISTORY.unshift(...rows)   // :440 после логирования
```

Это единственная **не-спека** проекта, которая так делает: `grep -rln "from '@/services/mocks/"
frontend_vue/src/views frontend_vue/src/composables frontend_vue/src/components` даёт пять
файлов, и четыре из них — спеки (`composables/order-audit-pass-four-repro.spec.ts`,
`order-audit-concurrency.spec.ts`, `useOrderCard.review.spec.ts`,
`order-audit-fuzz-card.spec.ts`); пятый — `BccRequestPage.vue`.

Работает это потому, что мок отдаёт **ссылку на свою константу**, а не копию:
`mockGetBccHistory` возвращает `MOCK_BCC_HISTORY.slice(...)` того же массива
(`frontend_vue/src/services/mocks/bcc.ts:261`), в отличие от соседнего домена, где на этом
месте стоит `structuredClone` (`frontend_vue/src/services/mocks/notifications.ts:424`).

Вторая половина той же дыры: «сервер» строк не создаёт вовсе — ни `mockSendBccRequest`
(`mocks/bcc.ts:310-335`), ни `mockLogBccRequest` (`:337-343`) не трогают ленту (см. БАГ-11).
То есть N × M строк, которые старый контракт возлагает на сервер
(`roo_code/roo-context/03-api-contract.md:585`), сегодня существуют только в браузере
отправителя. Против настоящего бэкенда: письмо уйдёт, а история останется пустой у всех,
включая самого отправителя после перезагрузки.

### Expected

Строки события создаёт сервер в той же транзакции, что и отправку; клиент их только читает
(или получает в ответе — см. БАГ-11). Импорта мока в `src/views` быть не должно.

### Сделано 2026-09-07 (подтверждено не-автором)

Строки завёл «сервер», страница их перечитывает. Импорта мока в `src/views` больше нет:
`grep -rln "from '@/services/mocks/" frontend_vue/src/views frontend_vue/src/composables
frontend_vue/src/components` даёт **четыре** файла, и все четыре — спеки. Раньше их было пять.

**В моке** (`frontend_vue/src/services/mocks/bcc.ts`):

- `createEventRows(productIds, recipientIds, source)` (`:389-417`) кладёт по строке на пару
  «получатель × позиция» и делает `MOCK_BCC_HISTORY.unshift`;
- `mockSendBccRequest` зовёт её после записи конверта (`:453`), `mockLogBccRequest` — вместо
  прежних трёх строк, которые игнорировали payload целиком (`:468`). Тем самым закрыта и первая
  половина БАГ-11 — «обе ветки создают строки»; **вторая половина (возвращать ли их в ответе)
  сознательно не тронута**: контракт помечает форму ответа как решение владельца, и выбирать
  за него задним числом не нужно. Наружу по-прежнему уходит только `{ requestId }`;
- гейт `MAIL_NOT_CONFIGURED` оставлен **выше** создания строк (`:433`), поэтому отказ не
  оставляет ни письма, ни строк;
- `requestId` и `id` присваивает сервер монотонными счётчиками (`:355-364`), начальное значение
  снято с сидов через `maxSeq` (`:346-353`) — приём из `mocks/orders.ts:1353-1357`, а не вторая
  копия последнего номера сида рядом с сидами. Это же закрывает клиентскую половину БАГ-02;
- каталог подписей источника переехал со страницы на сервер — `SOURCE_LABELS` (`:317-323`) плюс
  `resolveSource` (`:325-344`), сопоставляющий по любой локали. Без него строка ленты была бы
  пустой в двух локалях из трёх: на проводе `source` заполнен ровно в одной (питфолл #38);
- `mockGetBccHistory` отдаёт `structuredClone` (`:264`), а не срез ссылок в свой стор — это была
  вторая половина дыры, названная в разделе Problem.

**На странице** (`BccRequestPage.vue`): удалены импорт `MOCK_BCC_HISTORY`, `createEventRows`,
`nextRequestId`, `todayIso` и `SOURCE_TRANSLATIONS`; `sendRequest` и `logRequest` после успеха
делают `await loadHistory()`. В `useBccRequest.send` заменён комментарий, который прямо
предписывал прежнее поведение («callers manage history locally… a reload would wipe those
events»).

**Проверено:**

| Проверка | Результат |
|---|---|
| `npm run verify` | typecheck · lint · dupes (6.77 % при пороге 10) · format · unit — exit 0, 40 файлов, 802 теста |
| новая спека `mocks/bcc-history-rows.spec.ts` | 8 тестов |
| инверсия: сервер не создаёт строк | 4 теста краснеют |
| инверсия: лента снова отдаёт ссылки | 1 краснеет |
| инверсия: `source` кладётся в одной локали | 2 краснеют |
| инверсия: гейт почты опускается ниже создания строк | 2 краснеют |
| e2e уровня 1 (suppliers + smoke + feature-flags) | 269 passed, exit 0 — включая «full send → new history rows» и «picking Phone logs rows with source=Phone» |

Первый прогон `npm run verify` был **красным** — prettier на новом коде мока; поймал именно тот
шаг гейта, который для этого и стоит (питфолл #67).

Контракт (`roo_code/roo-context/api/bcc.md`) переписан по факту: разделы `send`, `log`, графы 8 и
9, правило 11, таблица «Чего в домене нет» и чек-лист аудита. Заодно поправлены ссылки
`файл:строка`, съехавшие от правки: битых было 24 (замер на коде HEAD), стало 22.

**Подтверждение (не автор правки, 2026-09-07).** Инверсии переделаны заново, своими руками, а не
приняты по отчёту — каждая вносилась в `mocks/bcc.ts` и снималась сверкой с копией файла:

| Что сломано | Покраснело |
|---|---|
| `MOCK_BCC_HISTORY.unshift(...events)` убран | 5 тестов (отчёт называл 4) |
| лента снова отдаёт срез ссылок вместо `structuredClone` | 1 |
| `resolveSource` возвращает пришедшее как есть, в одной локали | 3 тестa (отчёт называл 2) |
| гейт `MAIL_NOT_CONFIGURED` опущен ниже создания строк | 2 |

Первая попытка инверсии не доказывала ничего: `--reporter=basic` такого репортёра нет, и прогон
падал на старте, а не на проверяемом поведении — питфолл #71 в чистом виде. Пересчитано без флага.

Своими прогонами также: `npm run verify` — exit 0, 802 теста; e2e уровня 1 (`admin/suppliers`,
`smoke`, `feature-flags`) — 269 passed, exit 0, строк `failed`/`flaky` в выводе нет; предпосылка
спеки про одну локаль проверена по коду — `bccService.logBccRequest` действительно шлёт
`toTranslatedString(payload.source, locale)` (`services/bccService.ts:61`), то есть питфолл #38
здесь настоящий, а не выдуманный ради теста. Импорта мока в `src/views` нет: греп даёт четыре
файла, все спеки.

Поправлено при подтверждении: ссылки `файл:строка` в этом разделе и в `api/bcc.md` разъехались на
три строки (`createEventRows`, счётчики, `maxSeq`, `resolveSource`, гейт, оба вызова), а в двух
местах контракт называл разные номера для одного и того же `unshift`. Пересчитано по файлу.

---

## БАГ-02 — `requestId`, который вернул сервер, выбрасывается

**File:** `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:264-275,290,430`
**Severity:** High — два клиента, отправившие запрос одновременно, получат один и тот же номер `req-NNN`, и события двух разных запросов сольются в один.
**Источник:** К4 (формы ответа), К6 (производные значения)

### Problem

Оба мутирующих вызова возвращают `{ requestId }` — и оба ответа игнорируются:

```ts
await send()                    // :290 — результат не присваивается
await logBccRequest({...})      // :430 — результат не присваивается
```

Номер вместо этого считается на клиенте по **загруженной странице** истории:

```ts
function nextRequestId(): string {          // :264-275
  let max = 0
  for (const evt of history.value) { … }    // только то, что пришло: page 1, pageSize 25
  return `req-${String(max + 1).padStart(3, '0')}`
}
```

Лента при этом грузится ровно одной страницей на 25 записей
(`frontend_vue/src/composables/useBccRequest.ts:106`), то есть `max` считается по срезу, а не
по всей истории. Клиенты друг о друге не знают вовсе.

Форматов у одного поля в итоге три: `req-${Date.now()}` у мока (`mocks/bcc.ts:334`, `:342`),
`req-NNN` у клиента (`BccRequestPage.vue:274`) и `req-###` в старом контракте
(`roo_code/roo-context/03-api-contract.md:581`), при том что колонка — `String(50)`
(`backend/app/modules/bcc/shared/models.py:54-56`).

### Expected

`requestId` присваивает сервер и возвращает в ответе; клиент использует полученный.

---

## БАГ-03 — `response` и `no-response` создают строки без `Idempotency-Key`

**File:** `frontend_vue/src/services/bccService.ts:73,77`
**Severity:** Medium — двойной клик по «принять ответ» или по крестику создаёт две записи события; отменить их нечем, `DELETE` в домене нет.
**Источник:** К6 (транзакционность и идемпотентность)

### Problem

Два вызова домена ключ шлют, два — нет, при том что записи создают все четыре:

```ts
apiPost('/api/bcc/send', {...}, { headers: { 'Idempotency-Key': newIdempotencyKey() } })  // :43
apiPost('/api/bcc/log',  {...}, { headers: { 'Idempotency-Key': newIdempotencyKey() } })  // :64
apiPost<BccRequest>(`/api/bcc/events/${eventId}/response`, payload)                        // :73
apiPost<BccRequest>(`/api/bcc/events/${eventId}/no-response`, {})                          // :77
```

Каждый из двух последних кладёт новую строку в ленту (`mocks/bcc.ts:364`, `:386`), и природа
домена — event-sourcing (`frontend_vue/src/types/bcc.ts:20`) — означает, что повтор не
«перезапишет то же самое», а добавит второе событие. Механизм в проекте есть и работает:
`withIdempotency` кэширует результат по ключу (`mocks/index.ts:262-269`, применение `:912`,
`:919`), генератор — `newIdempotencyKey` (`frontend_vue/src/services/api.ts:240-245`).

### Expected

Ключ идемпотентности шлют все четыре мутации домена.

---

## БАГ-04 — мок возвращает `null` на неизвестный `eventId`, и клиент кладёт `null` в ленту

**File:** `frontend_vue/src/services/mocks/bcc.ts:350,374`, `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:359,370`
**Severity:** High — промах неотличим от успеха, а в реактивный массив попадает `null`, на котором падает отрисовка строки.
**Источник:** К3 (коды ошибок)

### Problem

```ts
export function mockAcceptResponse(eventId, payload): BccRequest | null {
  const src = MOCK_BCC_HISTORY.find((e) => e.id === eventId)
  if (!src) return null                       // :349-350
```

Ветка мока отдаёт это значение как `T` без всякой проверки
(`frontend_vue/src/services/mocks/index.ts:925-932` и `:933-937`), а клиент типизирован на
`BccRequest` (`frontend_vue/src/services/bccService.ts:72`, `:76`) и кладёт результат в ленту:

```ts
const evt = await acceptBccResponse(...); history.value.unshift(evt)   // :355-359
const newEvt = await markBccNoResponse(evt.id); history.value.unshift(newEvt)  // :369-370
```

Кода ошибки под этот случай нет нигде: `grep -rn "EVENT_NOT_FOUND" frontend_vue/src backend`
— пусто, `NOT_FOUND` ядра (`backend/app/core/exceptions.py:13-20`) на этих путях не бросается
(роутов нет). Тот же класс дефекта сосед описал у отметки уведомления прочитанным (аудит
notifications, БАГ-04).

### Expected

Неизвестный `eventId` — ошибка с кодом; клиент её показывает и в ленту ничего не кладёт.

---

## БАГ-05 — в одной ленте два пространства id поставщика

**File:** `frontend_vue/src/services/mocks/bcc.ts:146,240`
**Severity:** Medium — переход из строки истории и из уведомления «поставщик ответил» ведёт в карточку, которой нет.
**Источник:** К2, продолжение находки БАГ-02 аудита suppliers

### Problem

Сиды ленты несут `supplierId: 'sup-001'` … `'sup-004'` (`mocks/bcc.ts:146,157,168,180,193,205,216`),
а новые строки получают id из `mockGetBccRecipients`, который отдаёт `s.id` из
`MOCK_SUPPLIERS` как есть (`mocks/bcc.ts:240`), то есть `'1'` … `'6'`
(`frontend_vue/src/services/mocks/suppliers.ts:9,29,49,69,89,109`).

`mockGetSupplier` ищет по точному совпадению (`mocks/suppliers.ts:306`), поэтому `'sup-001'`
не найдётся. Дальше это уходит в уведомление: `mockAcceptResponse` передаёт `next.supplierId`
эмиттеру (`mocks/bcc.ts:368`), тот кладёт его в `entityId` вместе с
`entityRouteName: 'admin-supplier-card'` (`frontend_vue/src/services/mocks/notifications.ts:667-669`).

Аудит suppliers описал ту же дыру со стороны справочника `/api/suppliers/list`, который
изготавливает третью форму `sup-NNN` (см. `roo_code/plans/api/audit/suppliers.md`, БАГ-02).
Здесь добавляется то, чего там не было: **обе формы лежат в одной таблице одновременно**.

### Expected

Одно пространство идентификаторов поставщика на весь проект; какое — решение владельца
(строка уже стоит в `00-решения-владельца.md` от домена suppliers).

### Решение владельца

**Разблокировано.** Вопрос общий с `suppliers/БАГ-02` и закрыт его строкой —
[`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md), строка 1599:

> **снято 2026-09-10 (§19):** канонична форма схемы — UUID; читаемые префиксы мока и числовые
> строки справочника это два пространства id в одном домене, известный класс дефекта, названный
> в §19

Номера П у этого вердикта нет: он вынесен по §19 «Форма идентификатора» общих соглашений
([`00-conventions.md`](../../roo-context/api/00-conventions.md)) — там же два пространства id поставщика (`sup-001` против `'1'…'6'`)
названы поимённо.

Работа по коду: сиды ленты BCC (`mocks/bcc.ts:146,157,168,180,193,205,216`), `MOCK_SUPPLIERS`
(`mocks/suppliers.ts:9,29,49,69,89,109`) и `/api/suppliers/list` приводятся к одной форме одним
движением — порознь чинить нельзя, выпадашки склада согласованы с сидом партий.

---

## БАГ-06 — идентификаторы «товаров» BCC не существуют ни в одном другом домене

**File:** `frontend_vue/src/services/mocks/bcc.ts:7-118`, `backend/app/modules/bcc/shared/models.py:63-67`
**Severity:** High — `productIds`, которые клиент шлёт в `send`/`log`, сервер обязан положить в колонку с FK на `products.id`, и ни один из них там не найдётся.
**Источник:** К4 (формы запроса), К5 (источник истины)

### Problem

Дерево каталога BCC — константа мока: пять корней и пятнадцать листьев с id `sheet-2mm`,
`lintel-100`, `beam-i20`, `pipe-100`, `rebar-12` и т. д. (`mocks/bcc.ts:7-118`). Страница
считает листья товарами и шлёт их id как `productIds`
(`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:77-86`, `:397-410`).

Этих идентификаторов больше нет нигде: `grep -rn "sheet-2mm" frontend_vue/src` даёт
`mocks/bcc.ts` и `mocks/bcc-envelope.spec.ts:32,77`. Товары мока — `prod-001`…
(`frontend_vue/src/services/mocks/products.ts:31`), категории — `cat-1`…
(`frontend_vue/src/services/mocks/categories.ts:11`).

Схема при этом однозначна:

```python
product_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("products.id", ondelete="SET NULL"),   # models.py:63-67
```

а таблица каталога — своя и рекурсивная, `bcc_categories.parent_id → bcc_categories.id`
(`models.py:23-28`), с колонкой `product_count` (`:29-31`), у листьев мока всегда нулевой.

### Expected

Либо каталог BCC — проекция домена `products`, и тогда листья несут `products.id`; либо это
своя сущность, и тогда `bcc_events` ссылается на неё, а не на товары. Решение владельца —
строка вынесена.

### Решение владельца

**Разблокировано — П75.** [`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md), строка 1840:

> **решено 2026-09-11:** проекцией общего каталога — своей таблицы у дерева нет, инструмент читает
> те же категории и те же товары, а `product_count` считается при чтении → П75

Работа по коду: константа дерева (`mocks/bcc.ts:7-118`) заменяется проекцией `categories` +
`products`, листья несут `products.id` (`prod-001`…), таблица `bcc_categories`
(`backend/app/modules/bcc/shared/models.py:23-31`) с колонкой `product_count` уходит со схемы.

---

## БАГ-07 — единицы цены BCC заданы константой мимо справочника единиц

**File:** `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:333`
**Severity:** Medium — цена поставщика записывается в единицах, которых нет в справочнике арендатора, и сопоставить её с ценой склада или заказа нечем.
**Источник:** К6 (значения по умолчанию и их владелец)

### Problem

```ts
const UNIT_OPTIONS = ['kg', 'm', 'piece', 'ton']   // :333
```

Дефолт — `'kg'` (`:331`, `:340`), значение уходит в теле `POST /api/bcc/events/:id/response`
(`frontend_vue/src/services/bccService.ts:69-74`) и ложится в колонку `unit: String(20)`
(`backend/app/modules/bcc/shared/models.py:75`).

Единицами владеет домен `settings`: `AppSettings.uoms` (`frontend_vue/src/types/settings.ts:240`),
сид — `uom-t`, `uom-kg`, … (`frontend_vue/src/services/mocks/settings.ts:89-101`), подпись
собирается единственной функцией `uomCode` (`frontend_vue/src/domain/uom.ts:27-32`). Склад свой
список строит именно из справочника (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:423-437`,
потребители `:440-444`).

Совпадений нет ни одного: `'ton'` против `'uom-t'`, `'piece'` против `'uom-pcs'`.

Это тот же класс, что БАГ-01 и БАГ-05 домена suppliers (валюты и условия оплаты константой в
`SupplierFormSections.vue`) — см. `roo_code/plans/api/audit/suppliers.md`.

### Expected

Список единиц строится из `settings.uoms`, значение хранится ссылкой на справочник.

---

## БАГ-08 — `MAIL_NOT_CONFIGURED` в BCC-инструменте до человека не доходит

**File:** `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:304-306`
**Severity:** Medium — отказ по ненастроенной почте выглядит как «что-то пошло не так», и пользователь не узнает, что чинить надо в настройках.
**Источник:** К3 (коды ошибок)

### Problem

```ts
} catch {
  showToast(t('msg.status_error'), 'error')   // :304-306
}
```

Ни код, ни текст исключения не разбираются: композабл кладёт `e.message` в `error`
(`frontend_vue/src/composables/useBccRequest.ts:145-148`), а страница это поле в обработчике
отправки не читает. Мок бросает именно код (`frontend_vue/src/services/mocks/bcc.ts:317`),
бэкенд объявляет его же плюс второй, `NO_RECIPIENTS`
(`backend/app/modules/bcc/features/send_request/domain.py:23-31`, `:34-38`); второго фронт не
знает вовсе — `grep -rn "NO_RECIPIENTS" frontend_vue/src` → 0.

Кнопка обычно закрыта гейтом `mailReady` (`:588`), но гейт смотрит на состояние, пришедшее с
сервера (`useBccRequest.ts:79`), и расходится с ним ровно в тот момент, когда почту сломали в
соседней вкладке.

Соседняя страница код читает — но из `e.message`, а не из `ApiRequestError.code`
(`frontend_vue/src/views/admin/settings/MailSettings.vue:79-84`); это отдельная находка домена
settings (аудит settings, находка 19), и против настоящего сервера она не сработает. Правильного
разбора кода в проекте на сегодня нет ни одного.

### Expected

Обработчик читает `ApiRequestError.code` (`frontend_vue/src/services/api.ts:118-124`) и
показывает отдельное сообщение для `MAIL_NOT_CONFIGURED` и `NO_RECIPIENTS`.

---

## БАГ-09 — пять вызовов из семи идут без единого заголовка

**File:** `frontend_vue/src/services/bccService.ts:7,11,21,73,77`
**Severity:** High — обе таблицы домена требуют `tenant_id`, у события есть ещё и автор, а сервер не получит ни того, ни другого.
**Источник:** К6 (мультиарендность), К4 (формы запроса)

### Problem

Заголовки в домене шлют только два вызова, и только `Idempotency-Key` (`:43`, `:64`).
Остальные пять вызываются без третьего аргумента:

```ts
apiGet<BccCategory[]>('/api/bcc/categories')                                   // :7
apiGet<BccRecipient[]>('/api/bcc/recipients', { products: … })                 // :11
apiGet<PaginatedResponse<BccRequest>>('/api/bcc/history', params)              // :21
apiPost<BccRequest>(`/api/bcc/events/${eventId}/response`, payload)            // :73
apiPost<BccRequest>(`/api/bcc/events/${eventId}/no-response`, {})              // :77
```

`options?.headers` — единственный источник заголовков у `apiGet` и `apiPost`
(`frontend_vue/src/services/api.ts:144-158`, `:163-175`).

Схема требует арендатора на обеих таблицах: `bcc_categories.tenant_id` и `bcc_events.tenant_id`
— оба `ForeignKey("tenants.id", ondelete="CASCADE")`, `nullable=False, index=True`
(`backend/app/modules/bcc/shared/models.py:16-21`, `:48-53`), плюс `sender_user_id` у события
(`:79-83`). Соседи с живым бэкендом шлют `Authorization: Bearer` + `X-CSRF-Token`
(`frontend_vue/src/services/settingsService.ts:18,27`,
`frontend_vue/src/services/auditFeedService.ts:20,41`), и сервер достаёт из токена `user_id`
(`backend/app/modules/settings/features/crud/action.py:97-128`).

Тот же дефект сосед завёл у уведомлений (аудит notifications, БАГ-01) — здесь он шире: пять
вызовов вместо четырёх, и один из них создаёт запись с автором.

### Expected

Все семь вызовов домена шлют заголовки авторизации.

---

## БАГ-10 — правка уже принятого ответа рождает второе уведомление о том же ответе

**File:** `frontend_vue/src/services/mocks/bcc.ts:368`
**Severity:** Low — лента уведомлений заполняется повторами события, которое произошло один раз.
**Источник:** К6 (события и уведомления)

### Problem

```ts
MOCK_BCC_HISTORY.unshift(next)
notifySupplierResponse({ id: next.supplierId, name: next.supplierName })   // :368
```

Условия «это переход, а не повтор» здесь нет. Остальные шесть триггеров проекта им защищены и
проверены спекой — `if (oldStatus !== status)` у заказа, `if (!wasReady && …)` у склада,
`if (!wasOverdue && …)` у финансов (`frontend_vue/src/services/mocks/notification-triggers.spec.ts:111-119,181-200,232-234,257-266`);
правило сформулировано в коде домена уведомлений дословно
(`frontend_vue/src/services/mocks/notifications.ts:470-473`) и описано соседом (аудит
notifications, «Правила домена», п. 4).

Достижимо это не редким гонком, а обычной кнопкой: у строки со статусом `responded` в таблице
истории стоит «править» (`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:991`), и она
открывает ту же модалку (`:335-342`), сохранение которой идёт тем же `savePrice` (`:348-365`).
Каждое исправление цены — ещё одно «поставщик ответил».

### Expected

Уведомление рождается на переходе `sent → responded`, а не на каждой записи со статусом
`responded`.

---

## БАГ-11 — `mockSendBccRequest` и `mockLogBccRequest` не создают ни одной строки события

**File:** `frontend_vue/src/services/mocks/bcc.ts:310-335,337-343`
**Severity:** High — reference implementation не делает того, ради чего эндпоинт существует, и бэкенд будет написан по ней.
**Источник:** К2 (мок ↔ контракт ↔ код), К4 (формы ответа)

### Problem

`mockLogBccRequest` игнорирует весь payload — это видно по имени параметра:

```ts
export function mockLogBccRequest(_payload: {...}): { requestId: string } {
  return { requestId: `req-${Date.now()}` }     // :337-343
}
```

`mockSendBccRequest` кладёт конверт в журнал писем (`:323-332`) и тоже возвращает только
`requestId` (`:334`); `MOCK_BCC_HISTORY` он не трогает.

Старый контракт обязанность формулирует прямо для обоих: «Одновременно создаётся N × M row'ов
в history со `status: 'sent'`, `source: 'BCC Tool'`» (`roo_code/roo-context/03-api-contract.md:585`)
и «`{ requestId: string; events: BccRequest[] }` — массив созданных строк, чтобы клиент сразу
подложил в `history`» (`:600`). Схема под это готова: `bcc_events` со `status`, `source`,
`subject`, `body`, `attachment_file_ids` (`backend/app/modules/bcc/shared/models.py:68-78`).

Пустота компенсируется на стороне страницы (`createEventRows`,
`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:390-413`) — то есть БАГ-01 и есть
следствие этого.

### Expected

Обе ветки создают строки события и возвращают их в ответе; клиент их только принимает.

### Состояние на 2026-09-07 — закрыта первая половина

Строки создают обе ветки: `mockSendBccRequest` и `mockLogBccRequest` зовут один
`createEventRows` (`frontend_vue/src/services/mocks/bcc.ts:389-417`, вызовы `:453` и `:468`). То
есть цитата старого контракта «одновременно создаётся N × M row'ов» стала правдой, а абзац выше
про «пустоту, компенсируемую страницей» описывает состояние ДО 2026-09-07: `createEventRows` из
`BccRequestPage.vue` удалён вместе с импортом мок-стора (БАГ-01).

**Открыта вторая половина: возвращать ли строки в ответе.** Наружу уходит только
`{ requestId }`; форма ответа помечена контрактом как решение владельца, и правка БАГ-01 её
сознательно не выбирала. Клиент сегодня берёт строки перечитыванием ленты.

---

## БАГ-12 — логирование запроса вызывают двумя путями, и второй никто не зовёт

**File:** `frontend_vue/src/composables/useBccRequest.ts:153-168`, `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue` (импорт `logBccRequest`, вызов в `logRequest`)
**Severity:** Low — работает один путь из двух, но правило «кто такие выбранные получатели» записано в обоих местах по-разному, и следующая правка попадёт не в тот.
**Источник:** Л5 (один источник правила), найдено при починке БАГ-01

### Problem

Композабл экспортирует `log(source)` (`useBccRequest.ts:153-168`), который сам собирает
получателей из флага: `recipients.value.filter((r) => r.selected)` (`:158`). Страница его **не
берёт** — в деструктуризации `useBccRequest()` `log` отсутствует, — а импортирует
`logBccRequest` из сервиса напрямую и передаёт `selectedRecipientIds.value`.

То есть у одного действия два вызывающих пути и два разных ответа на вопрос «кто получатели»:
флаг `selected` у композабла против массива `selectedRecipientIds` у страницы. Сегодня они
совпадают, потому что `watch(recipients, …)` сводит одно к другому
(`BccRequestPage.vue:463-470`), а `sendRequest` перед отправкой синхронизирует обратно (`:271-274`).
Совпадают — но выведены по-разному, и это ровно тот класс, что был корнем трёх аудитов подряд.

Композабловский `log` при этом не вызывает никто:
`grep -rn "\.log(\|log," frontend_vue/src --include=*.vue` по этому домену пусто, то есть
вторая реализация ещё и мёртвая — её увидел бы `npm run deadcode`, если бы экспорт не уходил
в объект возврата композабла.

### Fix

TBD — выбрать один путь. Либо страница берёт `log` из композабла (тогда надо решить, что она
синхронизирует флаги перед вызовом, как это делает `sendRequest`), либо `log` из композабла
удаляется, а страница остаётся с прямым вызовом сервиса. Второе меньше по объёму, но тогда
`send` и `log` живут на разных уровнях, а это своя асимметрия.

### Future rule

Композабл, экспортирующий действие, которое страница делает в обход него, — машинно ловимый
класс: экспорт есть, вызывающих нет. `knip` его не видит именно потому, что экспорт уходит в
объект возврата, а объект используется. Проверка: для каждого поля в `return {}` композабла
грепнуть имя по представлениям; поле без вызывающего — либо мёртвое, либо обойдённое.

