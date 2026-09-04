# Bugs — contract-sync / домен clients

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4. Аудит: [`roo_code/plans/api/audit/clients.md`](../api/audit/clients.md).
Область: `frontend_vue/src/services/clientsService.ts`,
`frontend_vue/src/services/mocks/clients.ts`, ветки clients в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useClients.ts`,
`frontend_vue/src/composables/useClientCard.ts`,
`frontend_vue/src/views/admin/clients/ClientCreatePage.vue`,
`frontend_vue/src/services/api.ts`.
Модуля `clients` на бэкенде нет (`ls backend/app/modules/`), поэтому источник истины домена —
мок и клиент.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — взаимодействия различаются по JSON-содержимому, поэтому одинаковые записи теряются молча

**File:** `frontend_vue/src/composables/useClientCard.ts:281-299`
**Severity:** High — правка карточки молча не доезжает до сервера, а тост говорит «сохранено»; расхождение видно только после перезагрузки страницы.
**Источник:** К4 (формы запроса: у сущности нет идентификатора)

### Problem

`InteractionHistoryEntry` не имеет `id` — пять полей, и `id` среди них нет
(`frontend_vue/src/types/client.ts:6-13`). Поэтому `save()` вычисляет, что удалить и что
добавить, сравнением сериализованных объектов:

```ts
const foundInCurrent = current.some((c) => JSON.stringify(c) === JSON.stringify(prev[i]))
…
const entriesToAdd = current.filter((c) => !prev.some((p) => JSON.stringify(p) === JSON.stringify(c)))
```

(`frontend_vue/src/composables/useClientCard.ts:284`, `:292-294`.)

Совпадение по содержимому — не редкость, а нормальный случай: всё в `frontend_vue/src/composables/useClientCard.ts`
— автор всегда литерал `'Current User'` (`frontend_vue/src/composables/useClientCard.ts:246`), дата по умолчанию сегодняшняя (`:121`, `:130`),
тип по умолчанию `'note'` (`:129`), `rejectionReason` всегда `null` (`:247`). Значит два одинаковых коротких
замечания в один день неразличимы, и ломается это в обе стороны:

- **удаление теряется.** История была `[A, A]`, пользователь удалил одну запись, стало `[A]`.
  Для обоих `i` в `prev` находится совпадение в `current`, `indicesToDelete` остаётся пустым —
  ни одного `DELETE` не уходит (`frontend_vue/src/composables/useClientCard.ts:283-288`, `:297-299`). Снимок при этом перезаписывается на
  `[A]` (`:308-311`), тост «сохранено» показывается (`:313`), а на сервере по-прежнему две
  записи.
- **добавление теряется.** Пользователь добавил запись, совпадающую с уже существующей:
  `entriesToAdd` её отфильтрует (`frontend_vue/src/composables/useClientCard.ts:292-294`), `POST` не уйдёт, но локально она уже лежит в
  состоянии (`:253`) и попадёт в новый снимок.

Мок этому не мешает: `mockAddClientInteraction` просто пушит запись (
`frontend_vue/src/services/mocks/clients.ts:1155`), а `mockDeleteClientInteraction` режет
массив по индексу (`:1169`) — дубли для него законны.

### Fix

TBD — правильное лечение это идентификатор у записи взаимодействия (и адресация
`DELETE /api/clients/:id/interactions/:entryId` по нему вместо индекса), а это изменение
контракта, а не правка функции. Решение — за владельцем, строка вынесена в
[`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md).

### Future rule

Сравнение сущностей по сериализованному содержимому вместо идентификатора — это тихая потеря
данных всякий раз, когда содержимое законно повторяется. Список, который правится по одной
строке, обязан иметь ключ строки.

---

## БАГ-02 — код ошибки удаления читается из текста исключения, а настоящий API кладёт его в `code`

**File:** `frontend_vue/src/composables/useClients.ts:68-75`
**Severity:** High — против настоящего бэкенда единственное осмысленное сообщение домена пропадёт: «Нельзя удалить: у клиента есть заказы» превратится в общий «Ошибка при удалении клиента».
**Источник:** К3 (каждый код доходит до человекочитаемого сообщения)

### Problem

```ts
const msg = String(e)
if (msg.includes('CONFLICT')) {
  toast.error(t('clients.toast_error_delete_conflict'))
} else {
  toast.error(t('clients.toast_error_delete'))
}
```

Под моками это работает случайно: `mockDeleteClient` бросает голый
`new Error('CONFLICT: client has orders')`
(`frontend_vue/src/services/mocks/clients.ts:1133`), то есть кладёт код прямо в текст, и ветка
мока его никак не перепаковывает (`frontend_vue/src/services/mocks/index.ts:1522-1526`).

Настоящий клиент так не делает: `unwrap()` собирает `ApiRequestError`, у которого `message` —
человеческий текст сервера, а машинный код лежит отдельным полем `code`
(`frontend_vue/src/services/api.ts:117-124`, `:71-79`; тип —
`frontend_vue/src/types/api.ts:25-47`). `String(err)` у него даёт `"ApiRequestError: "` плюс
серверное сообщение (`name` выставляется на `frontend_vue/src/types/api.ts:42`), и подстроки
`CONFLICT` там нет, если сервер сам её не написал в тексте.

Ключ `clients.toast_error_delete_conflict` при этом существует на всех трёх языках
(`frontend_vue/src/i18n/admin/clients.ts:57`, `:186`, `:316`) — то есть перевод есть, а показан
он не будет.

Тот же класс уже записан по домену categories (`contract-sync-categories-bugs.md`, БАГ-01) в
другом файле — здесь второе место с той же ошибкой, не дубль записи.

### Fix

Читать код из поля, а не из текста: `e instanceof ApiRequestError && e.code === 'CONFLICT'`,
с откатом на разбор сообщения ради мока — либо привести ветку мока к тому же конверту, что и
у настоящего API.

### Future rule

`String(e).includes('CODE')` — проверка, зелёная только под моками. Машинный код ошибки читается
из поля, в которое его кладёт `unwrap()`.

---

## БАГ-03 — при создании клиента дубль кода компании неотличим от отказа валидации

**File:** `frontend_vue/src/views/admin/clients/ClientCreatePage.vue:136-141`
**Severity:** Medium — пользователь видит «Ошибка при создании клиента» и не узнаёт, что клиент с таким кодом компании уже заведён; поля формы при этом валидны, и повторный клик даст ту же ошибку.
**Источник:** К3 (каждый код доходит до человекочитаемого сообщения)

### Problem

`handleSave` глушит любую ошибку одним `catch` без разбора:

```ts
} catch {
  toast.error(t('clients.toast_error_create'))
}
```

Мок при этом различает пять случаев: четыре `VALIDATION_ERROR` — пустое `name`
(`frontend_vue/src/services/mocks/clients.ts:1057`), пустое `companyCode` (`:1060`), пустое
`email` (`:1063`), негодные условия оплаты (`:1066-1068`) — и `CONFLICT: companyCode already
exists` (`:1073`). Первые четыре форма и так отсекает до запроса
(`ClientCreatePage.vue:93-115`), то есть до сервера доходит ровно тот случай, который экран
объяснить не может: занятый код компании.

Ключа под это сообщение в словаре нет: у домена есть `toast_error_delete_conflict`, но нет
парного «код компании уже занят» — среди семи ключей `toast_*`
(`frontend_vue/src/i18n/admin/clients.ts:51-57`) такого нет.

Разметку поля клиент уже умеет делать: `inferFieldFromMessage` отдаёт `vat_code` по подстроке
`company code` при коде `VALIDATION_ERROR` (`frontend_vue/src/services/api.ts:88-89`), — но
`handleSave` не смотрит ни на `fieldErrors`, ни на `code`.

### Fix

Разобрать ошибку по `code` (`CONFLICT` → отдельное сообщение и подсветка поля
`companyCode`), добавить ключ в `i18n/admin/clients.ts` на трёх языках.

### Future rule

Если сервер различает случаи отказа, а экран показывает один текст, различение сервера бесполезно.
Каждый код, который может дойти до пользователя, обязан иметь свой текст.

---

## БАГ-04 — `status: null` и `sortBy: null` уезжают в query-строку литералом `"null"`

**File:** `frontend_vue/src/services/clientsService.ts:6-9`, `frontend_vue/src/services/api.ts:154-155`
**Severity:** Medium — против настоящего бэкенда список клиентов на первом же открытии придёт отфильтрованным по несуществующему статусу `"null"` либо с ошибкой валидации параметра; под моками не проявляется никак.
**Источник:** К4 (формы запроса)

### Problem

`getClients` принимает `ClientFilters & { page?, pageSize? }`, где `status` и `sortBy` объявлены
как `T | null` (`frontend_vue/src/types/client.ts:51-58`), а затем приводит объект к
`Record<string, string>` приведением через `unknown`:

```ts
return apiGet('/api/clients', (filters ?? {}) as unknown as Record<string, string>)
```

(`frontend_vue/src/services/clientsService.ts:9`.) Приведение — единственное, что делает этот код
компилируемым: настоящий тип значений не `string`.

`apiGet` кладёт в query всё подряд, без отсева пустых:

```ts
Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
```

(`frontend_vue/src/services/api.ts:154-155`.) `URLSearchParams.set` приводит значение строкой,
и `null` становится `"null"`, а не отсутствующим параметром.

Начальное состояние фильтров именно такое: `{ search: '', status: null, sortBy: null, sortDir:
'asc' }` (`frontend_vue/src/composables/useClients.ts:17`), и оно уходит в запрос как есть
(`:27-31`). Так же поступают ещё два вызывающих: выбор клиента в создании заказа шлёт
`status: null` намеренно (`frontend_vue/src/composables/useOrderCreate.ts:127-136`) и дашборд
CRM (`frontend_vue/src/composables/useSalesCrmDashboard.ts:44-51`).

Мок это полностью скрывает, потому что получает объект, а не строку, и коалесцирует:
`const status = params?.status ?? ''` (`frontend_vue/src/services/mocks/index.ts:475-476`) —
`null` превращается в `''`, ветка фильтрации не срабатывает (`:488-490`), и под моками поведение
правильное.

### Fix

Отсеивать `null`/`undefined`/`''` при сборке query — в `apiGet` (тогда чинится сразу для всех
доменов) либо в `clientsService.getClients`. Заодно снять приведение
`as unknown as Record<string, string>`, которое это и прятало.

### Future rule

Приведение через `unknown` к `Record<string, string>` — не типизация, а глушение проверки: там,
где оно стоит, значения гарантированно не строки. Параметр со значением `null` в query не
отправляется, а не отправляется словом «null».

---

## БАГ-05 — список клиентов везёт лог аудита и историю взаимодействий каждой строки

**File:** `frontend_vue/src/services/mocks/clients.ts:1046-1048`, `frontend_vue/src/services/mocks/index.ts:478-515`
**Severity:** Medium — форма ответа списка, с которой будет писаться бэкенд, включает две коллекции, не нужные ни одному из трёх экранов; на реальных объёмах это страница списка размером с выгрузку истории.
**Источник:** К4 (формы запроса и ответа)

### Problem

`mockGetClients()` отдаёт хранилище целиком:

```ts
export function mockGetClients(): Client[] {
  return structuredClone(STORE)
}
```

(`frontend_vue/src/services/mocks/clients.ts:1046-1048`.) Ветка списка фильтрует, сортирует и
режет страницу, но ничего из объекта не выкидывает (`frontend_vue/src/services/mocks/index.ts:478-508`),
поэтому в `items` уезжают и `auditLog`, и `interactionHistory` (`frontend_vue/src/types/client.ts:44-48`).
В посеве это не мелочь: логи есть у десяти клиентов
(`frontend_vue/src/services/mocks/clients.ts:47`, `:87`, `:119`, `:181`, `:241`, `:303`, `:357`,
`:501`, `:647`, `:933`), у первого клиента ещё и три взаимодействия (`:24-46`).

Читателей у этих полей в списке нет ни одного: страница списка берёт только поля карточки-строки
(`frontend_vue/src/composables/useClients.ts:32`), выбор клиента в заказе — тоже
(`frontend_vue/src/composables/useOrderCreate.ts:137`), дашборд CRM просит пять строк
(`frontend_vue/src/composables/useSalesCrmDashboard.ts:44-51`). Сама карточка читает лог
отдельным запросом `GET /api/clients/:id/audit` (`frontend_vue/src/composables/useClientCard.ts:217-226`),
а не из объекта клиента.

Отдельно: `structuredClone(STORE)` целиком выполняется на **каждый** запрос списка, то есть на
каждое нажатие клавиши в поиске (`frontend_vue/src/composables/useClients.ts:44-52`).

### Fix

Список обязан отдавать строку списка, а не сущность целиком: либо отдельный тип
`ClientListItem`, либо явное вычёркивание `auditLog` и `interactionHistory` в ветке списка.
Решение о форме — контрактное; зафиксировано в аудите, графа «Форма ответа»
`GET /api/clients`.

### Future rule

Мок — reference implementation, и форма его ответа станет формой ответа сервера. «Вернуть объект
целиком, потому что он под рукой» переносится на бэкенд вместе со всем, что в объекте лежит.

---

## БАГ-06 — PATCH клиента применяет тело без белого списка полей

**File:** `frontend_vue/src/services/mocks/clients.ts:1104`
**Severity:** Low — из текущего UI не воспроизводится (форма не меняет `id` и `createdAt`), но это форма поведения, с которой будет писаться сервер.
**Источник:** К4 (формы запроса)

### Problem

```ts
Object.assign(STORE[idx]!, delta)
```

`delta` — это `Partial<Client>`, и приходит он из `dirty.diff()`, который возвращает **любой**
верхнеуровневый ключ, чей JSON разошёлся со снимком
(`frontend_vue/src/composables/useDirtyCheck.ts:71-75`). Из тела вычёркивается ровно один ключ —
`interactionHistory` (`frontend_vue/src/composables/useClientCard.ts:271-272`); `id`, `createdAt`
и `auditLog` не вычёркиваются ничем, и мок примет их без возражений.

Проверяется в теле тоже ровно одно поле — `paymentTermsDays`
(`frontend_vue/src/services/mocks/clients.ts:1099-1103`). Ни `email`, ни `companyCode` на правке
не валидируются, хотя на создании валидируются оба (`:1059-1073`), — то есть уникальность
`companyCode`, которую `mockCreateClient` защищает (`:1071-1073`), через PATCH обходится
беспрепятственно.

### Fix

Белый список правимых полей в `mockPatchClient` (одиннадцать полей `ClientFormData`,
`frontend_vue/src/types/client.ts:60-73`) и та же проверка уникальности `companyCode`, что на
создании.

### Future rule

Серверные поля (`id`, `createdAt`, генерируемый лог) в merge-patch не принимаются. Правило,
которое стоит на создании и не стоит на правке, — это правило, которого нет.

---

## БАГ-07 — `rejectionReason` клиента отправляется при создании и не читается и не правится нигде

**File:** `frontend_vue/src/views/admin/clients/ClientCreatePage.vue:44`
**Severity:** Low — поле попадает в контракт как часть тела `POST /api/clients` и в ответ `GET /api/clients/:id`, не имея ни одного потребителя.
**Источник:** К4 (формы запроса и ответа)

### Problem

`Client.rejectionReason?: string | null` объявлено (`frontend_vue/src/types/client.ts:42-43`) и
входит в `ClientFormData` (`:72`). Форма создания шлёт его пустой строкой при типе
`string | null` (`ClientCreatePage.vue:44`), но поля для него в форме нет, и карточка клиента его
не показывает и не правит:
`grep -rn "rejectionReason" frontend_vue/src --include=*.ts --include=*.vue | grep -v '\.spec\.'`
даёт двенадцать строк, из них по клиенту — только объявления типа, эта строка формы, всегда
`null` у взаимодействия (`frontend_vue/src/composables/useClientCard.ts:247`) и посев мока
(`frontend_vue/src/services/mocks/clients.ts:141` — единственное непустое значение на весь посев).
`ClientCardPage.vue` не упоминает его ни разу.

То есть значение можно задать один раз при создании — и то не из интерфейса, — а прочитать и
изменить нельзя ничем.

### Fix

TBD — либо поле убирается из `ClientFormData`, либо у него появляется место в карточке. Что из
двух, зависит от того, задумано ли отклонение клиента как процесс; строка вынесена в
[`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md).

### Future rule

Поле, у которого нет ни одного читателя и ни одного редактора, — не поле модели, а след
незаконченного замысла; в контракт оно попадает вместе со всеми, кто потом будет гадать, чем его
заполнять.

---

## Сводка

| | Тип | Файл | Суть |
|---|---|---|---|
| | Runtime | `useClientCard.ts` | БАГ-01: взаимодействия различаются по JSON-содержимому — одинаковые записи теряются молча |
| | Contract | `useClients.ts` | БАГ-02: код ошибки удаления читается из текста исключения, у API он в `code` |
| | i18n | `ClientCreatePage.vue` | БАГ-03: дубль кода компании неотличим от отказа валидации, ключа под него нет |
| | Contract | `clientsService.ts` | БАГ-04: `status: null` и `sortBy: null` уезжают в query литералом `"null"` |
| | Contract | `mocks/clients.ts` | БАГ-05: список клиентов везёт `auditLog` и `interactionHistory` каждой строки |
| | Contract | `mocks/clients.ts` | БАГ-06: PATCH без белого списка полей и без проверок, стоящих на создании |
| | Contract | `ClientCreatePage.vue` | БАГ-07: `rejectionReason` пишется при создании и не читается нигде |
