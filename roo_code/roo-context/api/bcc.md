# BCC Request Tool

Запрос цен у поставщиков: одно письмо, все адреса в BCC, и лента событий, из которой выводится
состояние каждой пары «запрос × поставщик × товар». Семь эндпоинтов, все в пространстве
`/api/bcc`.

**Общие соглашения — [`00-conventions.md`](00-conventions.md), и здесь они не повторяются.**
Конверт ответа и разбор ошибки — §1; каталог кодов ядра и правило «отказ несёт код, а не текст» —
§2; мультиарендность и «арендатор берётся из токена» — §4; заголовки и четыре реализации «где
лежит токен» — §5; матрица прав и заглушка `check_permission` — §6; фича-флаги как тариф, а не
право — §7; аудит-лог девяти сущностей — §9; правило «событие — это переход» — §10;
`Idempotency-Key` и оптимистичная блокировка — §11; `TranslatedString` и три помощника — §12;
`PaginatedResponse` и правила списков — §13; деньги, единицы, валюта и владение справочниками — §14;
clean-slate против quick-action — §15; файлы и общий `POST /api/uploads` — §16; производные
значения — §17; чем мок отличается от обязанностей сервера — §18; непрозрачность `id` — §19.
Ниже — только то, что живёт в этом домене.

**Источник истины — мок и клиент: серверной реализации нет ни у одного из семи эндпоинтов.**
Роутов у модуля `bcc` ноль (`grep -rn "@router\." backend/app/modules/bcc --include=*.py` — ни
одного попадания), `internal_api/interface.py` и `shared/dependencies.py` — по одной строке
докстроки (`backend/app/modules/bcc/internal_api/interface.py:1`,
`backend/app/modules/bcc/shared/dependencies.py:1`). Поэтому у каждого раздела ниже строка
`Бэкенд:` читается «не реализован», и форма запроса и ответа снята с клиента и мока.

**Но «не реализован» здесь значит не то же, что у соседей: доменный слайс написан и не
подключён.** `backend/app/modules/bcc/features/send_request/domain.py` содержит правило отправки
целиком — `build_bcc_envelope` (`:78-107`), `send_bcc_request` (`:110-125`), `is_mail_configured`
(`:58-65`) и два исключения (`:23-31`, `:34-38`); транспорт —
`backend/app/modules/bcc/features/send_request/transport.py` (`smtp_transport` `:20-43`,
`send_via_smtp` `:46-54`); тест — `backend/tests/modules/bcc/test_send_request.py`
(три класса, `:76`, `:105`, `:142`). Вызывающих в `backend/app` у слайса **ноль**:
`grep -rn "send_bcc_request\|send_via_smtp\|build_bcc_envelope\|MailServerConfig(" backend --include=*.py`
даёт только объявления и строки самого теста. Это единственный модуль проекта, где доменный слой
написан раньше эндпоинта. Следствие для контракта: старшинство «бэкенд» по К5 не наступило ни у
одного эндпоинта, но **по правилу отправки и по схеме хранения бэкенд уже старше фронта**, и оба
расхождения ниже описаны по нему, а не по моку.

**Таблицы существуют обе, и они per-tenant:** `bcc_categories`
(`backend/app/modules/bcc/shared/models.py:11-41`, имя таблицы `:14`) и `bcc_events` (`:43-89`,
имя `:46`); миграция — `backend/alembic/versions/f96e6fb2d5cf_phase_8_bcc.py:24-52`.

Потребители: [`services/bccService.ts`](../../../frontend_vue/src/services/bccService.ts) — все
семь вызовов (`:7`, `:11`, `:21`, `:35`, `:57`, `:73`, `:77`);
[`composables/useBccRequest.ts`](../../../frontend_vue/src/composables/useBccRequest.ts) —
`loadCategories` `:92`, `loadHistory` `:104`, `refreshRecipients` `:113`, `send` `:126`, `log`
`:153`; [`views/admin/suppliers/BccRequestPage.vue`](../../../frontend_vue/src/views/admin/suppliers/BccRequestPage.vue)
— единственный экран, `acceptBccResponse` и `markBccNoResponse` он зовёт сам (`:355`, `:369`).
Реестра «клиент написан, UI нет» у домена нет: у всех семи есть экран. Обратный случай один и
описан в разделе `GET /api/bcc/history`: параметры пагинации клиент шлёт всегда, а листалки в
интерфейсе нет.

Динамический сегмент в домене один — `:eventId` у двух `POST` на события. Он непрозрачный
идентификатор строки ленты (§19 соглашений), перечислимого набора значений у него нет, поэтому
внутри разделов список значений отсутствовать и должен; в заголовки он не развёрнут.

Метки `**Статус:** спроектировано` в этом файле нет ни одной, и это проверяемое утверждение, а не
недосмотр: у всех семи эндпоинтов код есть хотя бы на одной стороне провода — вызов клиента у семи
из семи, ветка мока у семи из семи. Метка означала бы отсутствие кода вообще, а не отсутствие
серверной части (шаг 3 [скила](../../skills/api-contract.md)).

---

## Каталог кодов ошибок домена

| код | статус | эндпоинт | где объявлен | знает ли фронт |
|---|---|---|---|---|
| `MAIL_NOT_CONFIGURED` | 422 | `POST /api/bcc/send` | `backend/app/modules/bcc/features/send_request/domain.py:23-31`; мок — `services/mocks/bcc.ts:317` | да, но до человека не доносит (БАГ-08) |
| `NO_RECIPIENTS` | 422 | `POST /api/bcc/send` | `backend/app/modules/bcc/features/send_request/domain.py:34-38` | **нет**: `grep -rn "NO_RECIPIENTS" frontend_vue/src` → 0 |

Каталог из двух кодов, и оба принадлежат отправке. Ни один не является подстрокой другого
(правило §2 соглашений; проверка попарная: `MAIL_NOT_CONFIGURED` не входит в `NO_RECIPIENTS` и
наоборот). `MAIL_NOT_CONFIGURED` — код **кросс-доменный**: тем же кодом отказывает проверка почты
в настройках (`services/mocks/settings.ts:621`), и условие у обоих общее — `isMailConfigured`
(`src/types/settings.ts:167-171`, мок-обёртка `services/mocks/settings.ts:611-613`).

**Остальные пять эндпоинтов не бросают ничего, и у двух из них это хуже нуля.**
`mockGetBccCategories` (`services/mocks/bcc.ts:225-227`), `mockGetBccRecipients` (`:229-246`),
`mockGetBccHistory` (`:248-267`) и `mockLogBccRequest` (`:337-343`) не содержат ни одного `throw`.
`mockAcceptResponse` и `mockMarkNoResponse` на неизвестном `eventId` возвращают `null`
(`:349-350`, `:373-374`), ветки мока отдают этот `null` как значение типа `BccRequest`
(`services/mocks/index.ts:925-932`, `:933-937`), и страница кладёт его в ленту без проверки
(`views/admin/suppliers/BccRequestPage.vue:359`, `:370`) — БАГ-04. Кода под этот случай в домене
нет нигде: `grep -rn "EVENT_NOT_FOUND" frontend_vue/src backend` → 0, а из идентификаторов вида
`BCC_*` в проекте есть только имена констант — `MOCK_BCC_CATEGORIES`, `MOCK_BCC_HISTORY`
(`services/mocks/bcc.ts:7`, `:140`) и `BCC_LOG_STATUS_PILL`
(`views/admin/suppliers/SupplierCardPage.vue:35`), ни одного кода ошибки. `NOT_FOUND` ядра
(`backend/app/core/exceptions.py:13-20`) на этих путях не бросается — роутов нет. Какой код здесь
верен, контракт не назначает; факт в том, что промах сегодня неотличим от успеха.

**Ни один код домена до человека в BCC-инструменте не доходит.** Отправка ловит любую ошибку
общим тостом `msg.status_error` (`BccRequestPage.vue:304-306`), приём цены — тем же (`:362-363`),
отметка молчания — тем же (`:371-372`), а композабл кладёт в `error` текст исключения, а не код
(`composables/useBccRequest.ts:145-148`, `:97-99`, `:119-121`); `grep -c "ApiRequestError"` по
`bccService.ts` и `useBccRequest.ts` → 0 в обоих. Против настоящего сервера код лежит в
`ApiRequestError.code` (§2 соглашений), то есть эти ветки на сервере не сработают — БАГ-08.
История ошибку **глотает молча**: `catch { /* history is optional — silent fail */ }`
(`useBccRequest.ts:108-110`), то есть сорванная загрузка выглядит как пустая лента.

---

### GET /api/bcc/categories

Каталог позиций, из которых собирается запрос. Чтение, один раз на монтировании страницы.
Save-режим: не применим — данные только читаются.

Запрос: пусто. Ни query, ни тела, ни заголовков — `apiGet` вызван одним аргументом
(`services/bccService.ts:6-8`), а `options?.headers` — единственный источник заголовков у GET
(`services/api.ts:144-158`). Ветка мока разбирает путь без параметров
(`services/mocks/index.ts:353`).

Ответ: **голый массив** `BccCategory[]`, не `PaginatedResponse`:

```ts
interface BccCategory {
  id: string
  name: TranslatedString
  productCount: number
  children?: BccCategory[]
}
```

`types/bcc.ts:3-8`. На проводе это `ApiResponse<BccCategory[]>` — конверт снимает общий `unwrap`
(§1 соглашений). Дерево **ровно двухуровневое**: мок отдаёт пять корней с `children` и листья без
`children` (`services/mocks/bcc.ts:7-118`), и `productCount` заполнен только у корней
(`:11`, `:38`, `:55`, `:77`, `:99` — значения 4, 2, 3, 3, 3), у всех пятнадцати листьев он `0`.
Пагинации, фильтра и поиска у эндпоинта нет: фильтр, поиск и листалка таблицы товаров считаются на
клиенте из уже загруженного дерева (`BccRequestPage.vue:105-140`, размер страницы `:97`).

**Листья этого дерева фронт считает товарами, а схема — категориями, и это главное, чего старый
контракт не сказал.** `productOptions` берёт `cat.children` и кладёт их `id` в `productIds`
запроса (`BccRequestPage.vue:77-86`, `:397-410`), тогда как таблица называется `bcc_categories` и
`parent_id` ссылается на неё же (`backend/app/modules/bcc/shared/models.py:23-28`), а
`bcc_events.product_id` — FK на **`products.id`** (`:63-67`). Идентификаторы листьев (`sheet-2mm`,
`beam-i20`, `pipe-100`, …) в проекте больше не встречаются нигде: `grep -rn "sheet-2mm"
frontend_vue/src` даёт только `services/mocks/bcc.ts` и `services/mocks/bcc-envelope.spec.ts:32,77`;
товары мока — `prod-001`… (`services/mocks/products.ts:31`), категории — `cat-1`…
(`services/mocks/categories.ts:11`). Пока не решено, чем является это дерево, сервер не сможет ни
принять `productIds` клиента, ни отдать своё дерево — БАГ-06, [решение
владельца](../../plans/api/audit/00-решения-владельца.md) (раздел «bcc», строка «Пробел
контракта»).

**Переводимость имени у категории на схеме есть, в отличие от события.** `name_translations` —
`JSONB` (`backend/app/modules/bcc/shared/models.py:22`), то есть три локали хранятся как объект и
общее правило §12 соглашений соблюдено. `product_count` при этом на схеме **хранимая** колонка с
дефолтом `0` (`:29-31`), а во фронте — производное число; выводится оно из каталога товаров или
обновляется событием, не сказано нигде (см. «Обязанности сервера», графа 9).

Ошибки: ни одного кода (каталог выше).

Бэкенд: **не реализован** — роутов у модуля ноль; ограничение схемы — `backend/app/modules/bcc/shared/models.py:11-41`
Реализация: `services/bccService.ts:6-8` (`getBccCategories`) · потребитель
`composables/useBccRequest.ts:92-102` (`loadCategories`), вызов `BccRequestPage.vue:523` ·
мок `services/mocks/index.ts:353` → `services/mocks/bcc.ts:225-227` (отдаёт **ссылку** на
константу, а не копию — `:226`; §18 соглашений)

---

### GET /api/bcc/recipients

Список поставщиков-получателей с подсказкой авто-отметки. Чтение; кроме монтирования вызывается
на каждое переключение чекбокса товара. Save-режим: не применим.

Запрос: один query-ключ `products` — **CSV-строка** идентификаторов, а не повторяющийся параметр:

```ts
apiGet<BccRecipient[]>('/api/bcc/recipients', { products: productIds.join(',') })
```

`services/bccService.ts:10-12`. Пустой выбор превращается в пустую строку, и мок читает её как
«ничего не выбрано»: `params?.products ? params.products.split(',') : []`
(`services/mocks/index.ts:355`) — то есть общее правило «пустая строка фильтра доезжает до сервера
буквально» (§13 соглашений) действует и здесь. Заголовков нет.

Ответ: голый массив `BccRecipient[]`:

```ts
interface BccRecipient {
  id: string
  company: TranslatedString
  email: string
  contactPerson: TranslatedString
  selected: boolean
}
```

`types/bcc.ts:10-16`. **Список всегда полный и непагинированный**: мок отображает весь
`MOCK_SUPPLIERS` и никого не отсекает (`services/mocks/bcc.ts:239-245`), причина записана в коде
(`:230-233` — «matches float to the top without hiding anyone»). Страница режет его сама по 5
(`BccRequestPage.vue:194`) и поднимает отмеченных наверх, не скрывая остальных (`:204-213`). Для
сервера это значит, что `products` — параметр **подсказки**, а не фильтра, и пустой ответ по нему
невозможен.

**`selected` — подсказка, и она выводится по имени категории строкой, а не по идентификатору
товара.** Флаг истинен, когда хотя бы одна категория поставщика покрывает хотя бы один выбранный
товар (`services/mocks/bcc.ts:234-244`), причём сопоставление идёт через захардкоженную карту
`PRODUCT_CATEGORY` из пятнадцати пар (`:122-138`) и свободные строки `supplier.categories`
(`:244`). Связи «поставщик ↔ товар» в коде нет ни в каком виде — сопоставляются категории, и не
идентификаторами.

**`id` получателя — это `id` поставщика домена `suppliers`** (`services/mocks/bcc.ts:240`), своего
хранилища у получателя нет и таблицы под него в `models.py` тоже. Отсюда домен наследует чужое
расхождение пространств идентификаторов: сиды ленты несут `sup-001`
(`services/mocks/bcc.ts:146`), а строки, собранные из этого ответа, — `'1'`…`'6'`
(`services/mocks/bcc.ts:240`), и переход из ленты ведёт в карточку, которой нет — БАГ-05.

Ошибки: ни одного кода.

Бэкенд: **не реализован** — роутов ноль; таблицы получателя у домена нет вовсе, это проекция
`suppliers`
Реализация: `services/bccService.ts:10-12` (`getBccRecipients`) · потребитель
`composables/useBccRequest.ts:113-122` (`refreshRecipients`), триггеры — `BccRequestPage.vue:526` и
`watch(selectedProductIds, refreshRecipients, { deep: true })` (`useBccRequest.ts:124`, дебаунса
нет) · мок `services/mocks/index.ts:354-357` → `services/mocks/bcc.ts:229-246`

**Замок на получателях объявлен и никем не взводится.** `recipientsLocked` предусмотрен под
сценарий «получатель задан снаружи» (`useBccRequest.ts:88-90`, проверка `:114`), но
`grep -rn "recipientsLocked" frontend_vue/src` даёт только объявление, проверку и экспорт
(`:187`). Ответ страница не берёт напрямую: она пересобирает свой `selectedRecipientIds` из флага
`selected` на каждой перезагрузке списка (`BccRequestPage.vue:463-470`).

---

### GET /api/bcc/history

Лента событий домена. Чтение, один раз на монтировании. Save-режим: не применим — дальше массив
правит только клиент.

Запрос: два query-ключа, и клиент шлёт **оба всегда**, сериализованные через `String()` с
дефолтами `1` и `25` (`services/bccService.ts:17-21`). Ни фильтров, ни сортировки, ни поиска:
третьего ключа в объекте нет. Заголовков нет ни одного (БАГ-09). Единственный вызывающий передаёт
литералы `{ page: 1, pageSize: 25 }` (`composables/useBccRequest.ts:106`), то есть дефолты клиента
недостижимы; мок читает те же два ключа со своими дефолтами (`services/mocks/index.ts:358-361`).

Ответ: `PaginatedResponse<BccRequest>` (конверт — §13 соглашений), элемент:

```ts
type BccEventStatus = 'sent' | 'responded' | 'no_response'

interface BccRequest {
  id: string
  requestId: string
  date: string              // YYYY-MM-DD
  supplierId: string
  supplierName: TranslatedString
  productId: string
  productName: TranslatedString
  source: TranslatedString  // 'BCC Tool' | 'Email' | 'Phone' | 'Messenger' | 'Other'
  status: BccEventStatus
  price?: number
  unit?: string
}
```

`types/bcc.ts:18-34`. Это event-sourcing-строка, и тип объявляет это прямо — «one product × one
supplier. Grouped by requestId» (`:20`). Конверт собирает `mockGetBccHistory`
(`services/mocks/bcc.ts:248-267`): `total` — длина всей ленты, фильтров у эндпоинта нет (`:258`),
`totalPages` считается при чтении (`:265`).

**Пагинации в интерфейсе нет.** Таблица рисует всё, что пришло — `v-for="evt in history"`
(`BccRequestPage.vue:840`), а второго вызывающего у `getBccHistory` не существует
(`grep -rn "getBccHistory" frontend_vue/src` → объявление `services/bccService.ts:14`, импорт и
единственный вызов `useBccRequest.ts:6`, `:106`). То есть параметры страницы клиент шлёт, но
листать не умеет: «смена `page`/`pageSize`» как триггер второго запроса — то, чего в коде нет.

**Сортировки при чтении нет вовсе, и порядок — это порядок массива.** Мок не сортирует ничего
(`services/mocks/bcc.ts:248-267`); с 2026-09-07 он отдаёт **копию** через `structuredClone`
(`:264`), а не срез ссылок на свои же объекты. Порядок держится тем, что новая строка кладётся в
начало (`:415`, `:491`, `:513`) поверх сида, уложенного
по убыванию даты (`:145`, `:179`, `:204`). Поля времени точнее суток у строки нет вовсе (`date` —
`YYYY-MM-DD`, `types/bcc.ts:24`), поэтому события одного дня не упорядочены ничем. На схеме время
есть: `created_at` — `DateTime(timezone=True)` с индексом и `server_default=func.now()`
(`backend/app/modules/bcc/shared/models.py:84-89`), и сервер обязан упорядочивать по нему, а не по
порядку выборки.

**«Текущее состояние пары» — производное от порядка, и считает его сегодня клиент.**
`isLatestEvent` берёт первое совпадение ключа `requestId::supplierId::productId` в массиве
(`BccRequestPage.vue:492-496`) — это работает только потому, что новая строка всегда впереди.
Серверу то же самое надо считать по `created_at` (§17 соглашений про производные).

Отправка и логирование ленту больше не правят с клиента: строки завёл сервер, и страница их
**перечитывает** (`BccRequestPage.vue`, `await loadHistory()` в `sendRequest` и `logRequest`) —
БАГ-01 закрыт 2026-09-07, вместе с ним ушёл и импорт мока в `src/views`. Клиент по-прежнему
правит массив в двух местах: после приёма ответа и отметки молчания он делает `history.unshift`
полученной строки — там сервер её возвращает в ответе.

Ошибки: ни одного кода; клиент ошибку глотает молча (каталог выше).

Бэкенд: **не реализован** — роутов ноль; схема строки — `backend/app/modules/bcc/shared/models.py:43-89`,
и она расходится с типом фронта по пяти полям («Правила домена», п. 6)
Реализация: `services/bccService.ts:14-22` (`getBccHistory`) · потребитель
`composables/useBccRequest.ts:104-111` (`loadHistory`), вызов `BccRequestPage.vue:524` · мок
`services/mocks/index.ts:358-362` → `services/mocks/bcc.ts:248-267`, сид `:140-223`

---

### POST /api/bcc/send

Отправка запроса цен. Quick-action: уходит сразу по кнопке Send, save bar не участвует
(§15 соглашений).

Запрос — плоское тело плюс один заголовок:

```ts
{
  productIds: string[]
  recipientIds: string[]
  subject: TranslatedString
  body: TranslatedString
  fileIds?: string[]
}
// Headers: Idempotency-Key: <uuid>
```

`services/bccService.ts:25-46`. `subject` и `body` клиент **нормализует** в `TranslatedString`
текущей локали (`:39-40`), хотя собирает их на всех трёх языках сразу
(`src/domain/bccEmail.ts:82-88`, `:96-108`) — две локали письма на провод не попадают
(«Правила домена», п. 12). `fileIds` — идентификаторы, уже загруженные общим аплоадом
(§16 соглашений): страница кладёт `u.fileId` из ответа `DropZone`
(`BccRequestPage.vue:309-318`, `components/admin/ui/DropZone.vue:4`), композабл собирает их из
вложений шаблона (`composables/useBccRequest.ts:131`). Ключ идемпотентности генерируется на каждый
вызов (`services/bccService.ts:43` → `services/api.ts:239-245`), «сервер» мока его чтит и
возвращает закэшированный результат (`services/mocks/index.ts:262-269`, применение `:910-916`).

Ответ: `{ requestId: string }` и больше ничего (`services/bccService.ts:34`). **Строки истории
ответ не несёт, но сервер их создаёт** — с 2026-09-07, когда закрылся БАГ-01:
`mockSendBccRequest` пишет конверт в журнал и следом заводит строки события
(`services/mocks/bcc.ts:453` → `createEventRows`, `:389-417`), одну на пару «получатель ×
позиция». Гейт `MAIL_NOT_CONFIGURED` стоит **выше** создания строк (`:433`), поэтому отказ не
оставляет ни письма, ни строк — проверено спекой
(`services/mocks/bcc-history-rows.spec.ts`, «отказ по ненастроенной почте не оставляет ни письма,
ни строк»).

`requestId` и `id` каждой строки присваивает сервер монотонными счётчиками
(`services/mocks/bcc.ts:355-364`, начальное значение снимается с сидов через `maxSeq`, `:346-353`
— тот же приём, что `nextSeq` в `mocks/orders.ts:1353-1357`). Клиент их больше не считает: после
успешной отправки страница **перечитывает ленту** (`BccRequestPage.vue`, `await loadHistory()` в
`sendRequest`), а `nextRequestId`/`createEventRows` из неё удалены — это и было БАГ-02 в
клиентской половине. Формат поля на схеме — `String(50)`
(`backend/app/modules/bcc/shared/models.py:54-56`), то есть ограничения на вид номера нет, и
сервер выдаёт `req-NNN` — тот же вид, что у сидов.

> **Возвращать ли строки в ответе — по-прежнему строка владельца** (см. «Чего в домене нет»).
> Здесь сознательно ничего не решено: `createEventRows` массив строк собирает и возвращает
> внутри мока, но наружу уходит только `requestId`, а клиент берёт строки перечитыванием. Так
> закрыт БАГ-01 (строки создаёт сервер) без того, чтобы задним числом выбрать за владельца форму
> ответа.

**Главное правило домена — одно письмо, все адреса в BCC — и здесь источник истины бэкенд.**
`build_bcc_envelope` кладёт получателей только в `Bcc`, а в `To` — самого отправителя
(`backend/app/modules/bcc/features/send_request/domain.py:101-107`), снимает дубли с сохранением
порядка (`:97`), отвергает пустой список кодом `NO_RECIPIENTS` (`:98-99`) и ненастроенную почту —
`MAIL_NOT_CONFIGURED` (`:92-93`); `send_bcc_request` делает **ровно один** `send_message`
(`:123-124`). Мок повторяет то же со своей стороны (`services/mocks/bcc.ts:435-448`), но **слабее
на два правила**: дубли не снимает и пустой список не отвергает (`:435-437`) — оба пути ошибки под
моками не воспроизводятся, и первый из них не «ошибка интерфейса», а двойное письмо живому
поставщику.

Отправитель и параметры сервера берутся из настроек, своей копии у BCC нет: `mailFrom` собирается
из `settings.mail` (`composables/useBccRequest.ts:64-72`), мок берёт те же поля через `mockGetMail()`
(`services/mocks/bcc.ts:318`, конверт `:324-325`), бэкенд объявляет ту же форму своим
`MailServerConfig` (`backend/app/modules/bcc/features/send_request/domain.py:41-55`). Кнопка гаснет,
пока почта не настроена или идёт отправка (`BccRequestPage.vue:588`), где `mailReady =
isMailConfigured(settings.mail)` (`useBccRequest.ts:79`) — гейт смотрит на состояние сервера.
Перед отправкой страница проверяет непустоту наборов (`BccRequestPage.vue:415-425`) и непустую
тему в текущей локали (`BccRequestPage.vue:266-269`), потом переносит `selectedRecipientIds` в
флаги `recipients[].selected` (`BccRequestPage.vue:271-274`), а обратно их сводит
`watch(recipients, …)` (`BccRequestPage.vue:463-470`), потому что композабл собирает
адресатов именно из них (`useBccRequest.ts:130`).

Побочный эффект мока, которого нет у `log`: конверт письма пишется в журнал `MOCK_SENT_EMAILS`
(`services/mocks/bcc.ts:291-292`, запись `:323-332`), и именно он делает правило проверяемым —
`services/mocks/bcc-envelope.spec.ts`, пять проверок (`:40`, `:48`, `:58`, `:68`, `:75`).

**Вложения нигде не разрешаются в файлы.** Мок кладёт `fileIds` в конверт как есть
(`services/mocks/bcc.ts:330`) и в реестр загруженных файлов (`services/mocks/index.ts:281`) не
заглядывает; колонка под них на схеме есть — `attachment_file_ids: JSON`
(`backend/app/modules/bcc/shared/models.py:78`).

Ошибки: `MAIL_NOT_CONFIGURED` (мок и бэкенд) · `NO_RECIPIENTS` (только бэкенд, фронт кода не
знает). Ни один до человека не доходит — БАГ-08.

Бэкенд: **не реализован** как HTTP-эндпоинт (роутов ноль), но доменное правило написано —
`backend/app/modules/bcc/features/send_request/domain.py:78-125`, транспорт
`backend/app/modules/bcc/features/send_request/transport.py:20-54`, тест
`backend/tests/modules/bcc/test_send_request.py`; вызывающих у слайса ноль
Реализация: `services/bccService.ts:25-46` (`sendBccRequest`) · потребитель
`composables/useBccRequest.ts:126-151` (`send`), кнопка `BccRequestPage.vue:586-590` → `sendRequest`
`:277-307` · мок `services/mocks/index.ts:910-916` → `services/mocks/bcc.ts:426-455`

---

### POST /api/bcc/log

Учёт внесистемных переговоров: письмо **не** отправляется, в ленте появляются те же строки, что и
после отправки. Quick-action по split-кнопке «Log: `<source>`».

Запрос — плоское тело плюс тот же заголовок:

```ts
{
  productIds: string[]
  recipientIds: string[]
  source: TranslatedString
}
// Headers: Idempotency-Key: <uuid>
```

`services/bccService.ts:49-67`. **Вложений тело не несёт** — `fileIds` есть только у `send`.
`source` клиент нормализует в `TranslatedString` текущей локали (`:61`), то есть на проводе всегда
объект, никогда строка; значение приходит из константы страницы `SOURCE_OPTIONS`
(`BccRequestPage.vue`, дефолт `'Email'`). На схеме `source` —
свободный `String(50)` NOT NULL без `CHECK` (`backend/app/modules/bcc/shared/models.py:71-73`), то
есть одно значение, а не три локали: это часть систематического расхождения §12 соглашений.

**Каталог подписей источника принадлежит серверу** — с 2026-09-07. `SOURCE_LABELS`
(`services/mocks/bcc.ts:317-323`) держит все пять значений на всех трёх языках, а сопоставляет с
ним пришедшее `resolveSource` (`:325-344`) — по любой из локалей, потому что на проводе заполнена
ровно одна. Без этого строка ленты отрисовалась бы пустой в двух локалях из трёх (питфолл #38);
источник вне каталога сохраняется как пришёл, но во всех трёх полях, а не в одном. Раньше этот
каталог лежал константой страницы (`SOURCE_TRANSLATIONS`) и работал только потому, что строки
сочиняла та же страница; из страницы он удалён.

Ответ: `{ requestId: string }` (`services/bccService.ts:56`). `mockLogBccRequest` больше не
игнорирует payload: он заводит те же N × M строк тем же `createEventRows`, отличая логирование от
отправки только значением `source` (`services/mocks/bcc.ts:463-470`). Возвращённый `requestId`
клиент по-прежнему не использует — но не потому, что считает свой, а потому что перечитывает ленту
(`BccRequestPage.vue`, `await loadHistory()` в `logRequest`).

**Отправка и логирование создают строки одинаково, и это буквально одна функция** —
`createEventRows` (`services/mocks/bcc.ts:389-417`), вызываемая обоими путями (`:453`, `:468`).
Она же кладёт `status: 'sent'` (`:411`) — и в логированной строке тоже. После успеха страница
показывает тост и сбрасывает выбор товаров, сохраняя преднастроенного получателя.

Валидация целиком клиентская и возвращает тосты, а не коды: непустые наборы товаров и получателей
(`BccRequestPage.vue:415-425`), любая ошибка — общий `msg.status_error` (`:451-453`).

Ошибки: ни одного кода.

Бэкенд: **не реализован** — роутов ноль; схема строки события — `backend/app/modules/bcc/shared/models.py:43-89`
Реализация: `services/bccService.ts:49-67` (`logBccRequest`) · потребители
`composables/useBccRequest.ts:153-168` (`log`) и `BccRequestPage.vue:427-454` (`logRequest`, зовёт
сервис напрямую — `:430`), кнопка `:554-584` → `onLogClick` `:456-459`, выбор источника
`onLogSourcePick` `:461-465` · мок `services/mocks/index.ts:917-923` →
`services/mocks/bcc.ts:463-470`

---

### POST /api/bcc/events/:eventId/response

Поставщик ответил ценой. Event-sourcing: создаётся **новая** строка, исходная остаётся как след.
Quick-action в модалке — открывается кнопкой «принять» у строки `sent` и кнопкой «править» у
строки `responded`.

`:eventId` — `id` строки ленты (`types/bcc.ts:22`), непрозрачный идентификатор; перечислимого
набора значений у сегмента нет.

Запрос:

```ts
{ price: number; unit: string }
```

`services/bccService.ts:69-74`. Заголовков нет ни одного: **`Idempotency-Key` не шлётся**, хотя
вызов создаёт новую строку (`:73` против `:43` и `:64` у `send`/`log`) — БАГ-03, то есть два клика
дают две записи. `price` клиент приводит `Number()` и проверяет только на `NaN`
(`BccRequestPage.vue:349`); ноль и отрицательное не отсекает никто, а на схеме это
`Numeric(12, 2)` nullable (`backend/app/modules/bcc/shared/models.py:74`) — точность цены на
сервере два знака, а клиент шлёт любое `Number`. `unit` приходит из константы страницы
`UNIT_OPTIONS = ['kg', 'm', 'piece', 'ton']` (`BccRequestPage.vue:333`, дефолт `'kg'` `:331`,
`:340`, подстановка в модалке `:1049`) — это **не** идентификаторы справочника единиц, которым
владеют настройки (`AppSettings.uoms`, `types/settings.ts:240`; сид `uom-t`, `uom-kg`, … —
`services/mocks/settings.ts:89-101`), и из которого строит свой список склад
(`views/admin/warehouse/WarehousePage.vue:423-437`) — БАГ-07, нарушение правила §14 соглашений
«справочник принадлежит серверу».

Ответ: `BccRequest` — новая строка со `status: 'responded'`, `price` и `unit` из тела. Остальные
шесть полей копируются у исходного события, `id` — `evt-${Date.now()}`, `date` — сегодняшняя
(`services/mocks/bcc.ts:345-370`, поля `:351-363`). Мок кладёт строку в ленту сам (`:364`),
возвращает её же, и страница кладёт её в свою копию ещё раз (`BccRequestPage.vue:359`).
На неизвестном `eventId` возвращается `null`, и он доезжает до ленты — БАГ-04 (каталог кодов
выше).

**Валюты у цены нет ни во фронте, ни на схеме.** Поля валюты нет ни в `BccRequest`
(`types/bcc.ts:21-34`), ни в `bcc_events` (`backend/app/modules/bcc/shared/models.py:74-75` —
только `price` и `unit`), при том что у поставщика валюта своя. Конвертации в проекте нет нигде
(§14 соглашений), значит принятая цена — сумма без валюты; в какой она хранится, не сказано ни
одной стороной — [решение владельца](../../plans/api/audit/00-решения-владельца.md), строка
«Форма ответа».

**Единственное уведомление домена рождается здесь, и оно не защищено условием перехода.**
`mockAcceptResponse` зовёт `notifySupplierResponse` безусловно (`services/mocks/bcc.ts:495` →
`services/mocks/notifications.ts:657-670`), поэтому «править ответ» у уже отвеченной строки (та же
`savePrice` — `BccRequestPage.vue:331`, — вызванная из кнопки правки `:937-943`) рождает второе уведомление о том же ответе —
БАГ-10, единственное нарушение правила §10 соглашений во всём проекте.

Ошибки: ни одного кода (каталог выше). Обещанного прежним контрактом 422 на `price <= 0` нет ни во
фронте, ни в моке.

Бэкенд: **не реализован** — роутов ноль; схема строки — `backend/app/modules/bcc/shared/models.py:43-89`
Реализация: `services/bccService.ts:69-74` (`acceptBccResponse`) · потребитель
`BccRequestPage.vue:348-365` (`savePrice`), открытие модалки `:335-342` из кнопок `:931` и `:991` ·
мок `services/mocks/index.ts:925-932` → `services/mocks/bcc.ts:345-370`

---

### POST /api/bcc/events/:eventId/no-response

Поставщик не ответил. Event-sourcing: создаётся **новая** строка со `status: 'no_response'`,
исходная не меняется. Quick-action по крестику в строке `sent`.

`:eventId` — тот же непрозрачный `id` строки ленты, что и у `.../response`.

Запрос: путь плюс **пустой объект телом** — `apiPost<BccRequest>(…, {})`
(`services/bccService.ts:76-78`). Тело сериализуется всегда (`services/api.ts:175`), то есть на
провод уходит `{}` с `Content-Type: application/json` (`:174`); ветка мока тело не читает вовсе
(`services/mocks/index.ts:933-937`). Заголовков нет: **`Idempotency-Key` не шлётся**, хотя вызов
создаёт строку — БАГ-03. Операция **не идемпотентна**: два клика — две строки.

Ответ: `BccRequest` — новая строка. Копируются `requestId`, `supplierId`, `supplierName`,
`productId`, `productName` и `source`; `id` — `evt-${Date.now()}`, `date` — сегодняшняя, `price` и
`unit` отсутствуют (`services/mocks/bcc.ts:499-515`, поля `:502-512`). Мок кладёт её в начало
ленты сам (`:513`), страница — ещё раз в свою копию (`BccRequestPage.vue:350-353`). На неизвестном
`eventId` — `null` в ленте (БАГ-04).

**Новая строка наследует `source` исходной** (`services/mocks/bcc.ts:510`), то есть «не ответил на
телефонный запрос» останется с источником `Телефон` — это следствие копирования, а не отдельное
правило.

**Уведомления это событие не рождает, и так задумано.** Причина записана в коде рядом с обратным
случаем: «a feed that reports silence as news would fill up with things that did not happen»
(`services/mocks/bcc.ts:492-494`). Отсутствие эмиттера здесь — решение, а не пропуск.

**Кто и когда отмечает молчание — только человек.** Автоматического срока «поставщик не ответил за
N дней» в проекте нет: `grep -rn "no_response" frontend_vue/src | grep -v spec` даёт двенадцать
строк, и все они — объявление статуса (`types/bcc.ts:18`), ключи перевода пилюли
(`src/i18n/admin/bcc.ts:37`, `:41`, `:101`, `:105`, `:165`, `:169`), сид и запись мока
(`services/mocks/bcc.ts:198`, `:384`) и три места страницы (`BccRequestPage.vue:477`, `:483`,
`:966`). Ни одного таймера и ни одного планового задания.

Ошибки: ни одного кода (каталог выше).

Бэкенд: **не реализован** — роутов ноль; на схеме `status` и `source` — `String(50)` без enum
(`backend/app/modules/bcc/shared/models.py:68-73`)
Реализация: `services/bccService.ts:76-78` (`markBccNoResponse`) · потребитель
`BccRequestPage.vue:367-374` (`markNoResponse`), кнопка `:949` · мок
`services/mocks/index.ts:933-937` → `services/mocks/bcc.ts:372-388`

---

## Обязанности сервера

Девять граф аудита ([`plans/api/audit/bcc.md`](../../plans/api/audit/bcc.md), раздел «Обязанности
сервера») — то, чего во фронтенде не видно и что линзы согласованности не ловят по построению.
Ответ «нигде» контракт не назначает: он идёт строкой в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
«bcc — аудит 2026-09-04».

**1. Значения по умолчанию и их владелец — владельцу принадлежит ровно одно, и домен его только
читает.**

| значение | где задано | кому принадлежит |
|---|---|---|
| почтовый сервер: отправитель, хост, шифрование, признак готовности | `composables/useBccRequest.ts:64-72`, `:79`; мок `services/mocks/bcc.ts:318`; бэкенд `backend/app/modules/bcc/features/send_request/domain.py:41-65` | **настройкам арендатора**; своей копии у BCC нет (`useBccRequest.ts:64-67`) |
| единицы цены | `views/admin/suppliers/BccRequestPage.vue:333`, дефолт `:331` | константа страницы мимо `AppSettings.uoms` (`types/settings.ts:240`) — БАГ-07, **нигде** |
| источники запроса (`source`) | `BccRequestPage.vue:377`, переводы `:381-387` | константа страницы; на схеме свободный `String(50)` (`backend/app/modules/bcc/shared/models.py:71-73`) — **нигде** |
| текст письма (фразы на три локали) | `src/domain/bccEmail.ts:34-56` | **фронту, и это осознанно**: сервер получает готовый текст и своей константы с названием компании не держит (причина — `src/domain/bccEmail.ts:10-12`) |
| размеры страниц: товары 10, получатели 5, лента 25 | `BccRequestPage.vue:97`, `:194`; `composables/useBccRequest.ts:106` | константы; справочника под них нет ни в настройках, ни на схеме (§13 соглашений) |

Валюта, НДС и маржа домену не принадлежат — ими владеет `settings` (§14 соглашений). Кому
принадлежат перечень единиц и перечень источников — строка владельцу.

**2. События и уведомления — ровно одно уведомление и ровно одна точка.**
`notifySupplierResponse` вызывается из `mockAcceptResponse` (`services/mocks/bcc.ts:495` →
`services/mocks/notifications.ts:657-670`) — один из семи эмиттеров проекта (§10 соглашений).
`grep -n "notify" frontend_vue/src/services/mocks/bcc.ts` даёт две строки: импорт (`:4`) и этот
единственный вызов. Отправка и логирование не рождают ничего; отсутствие уведомления у
`no-response` — решение с записанной причиной (`services/mocks/bcc.ts:492-494`). **Расхождение с
общим правилом здесь и есть находка:** остальные шесть триггеров защищены условием перехода и
проверены спекой (`services/mocks/notification-triggers.spec.ts:111-119`, `:181-200`, `:232-234`,
`:257-266`), а этот зовётся безусловно — БАГ-10. Уведомление ведёт на карточку поставщика по
`entityId: supplier.id` (`services/mocks/notifications.ts:667-669`), а `id` берётся из строки
события (`services/mocks/bcc.ts:495`), то есть попадает в чужое пространство идентификаторов —
БАГ-05. Кому адресовано уведомление и рождает ли отправка событие — строка владельцу.

**3. Запись в аудит-лог — своего журнала у домена нет.**
`grep -c "auditLog" frontend_vue/src/services/mocks/bcc.ts` → 0: ни отправка, ни логирование, ни
приём цены, ни отметка молчания следа не оставляют. Среди девяти сущностей ленты аудита
(§9 соглашений) BCC не значится — `services/mocks/index.ts:392-393`. Формально лента событий
домена **и есть** его журнал, тип объявляет это прямо (`types/bcc.ts:20`), но автора у записи нет:
у `BccRequest` нет ни поля пользователя, ни времени точнее суток (`types/bcc.ts:21-34`). На схеме
автор предусмотрен — `sender_user_id` с `ondelete="SET NULL"`
(`backend/app/modules/bcc/shared/models.py:79-83`, миграция
`backend/alembic/versions/f96e6fb2d5cf_phase_8_bcc.py:50`) плюс `created_at` с индексом
(`models.py:84-89`), — но заполнять их некому: вызывающих у слайса ноль, а мок про пользователя не
знает вовсе (`grep -in "tenant\|userId\|user_id" frontend_vue/src/services/mocks/bcc.ts` — пусто).
Кто автор приёма цены и остаётся ли след у отправки — строка владельцу.

**4. Кастомные поля — домену не принадлежат и в нём отсутствуют.**
`grep -rn "fieldValues\|FieldDefinition\|customField" frontend_vue/src/types/bcc.ts
frontend_vue/src/services/mocks/bcc.ts backend/app/modules/bcc` → 0 попаданий; обе таблицы состоят
из фиксированных колонок и ни одной ссылки на библиотеку определений
(`backend/app/modules/bcc/shared/models.py:11-89`). Общий механизм — §8 соглашений. Единственная
точка соприкосновения **чужая**: поле карточки поставщика `f-last-bcc` «Дата последнего BCC»
(`services/mocks/config.ts:92-94`, размещение `:162`) — определение живёт в `config`, значение у
поставщика, а BCC его не обновляет (`grep -c "lastBccDate" frontend_vue/src/services/mocks/bcc.ts`
→ 0).

**5. Настройки, которых мок не отслеживает — пять.** (1) **Почта**: мок читает хост, отправителя
и признак готовности (`services/mocks/bcc.ts:317-318`) и на ненастроенном сервере отказывает —
доказано спекой (`services/mocks/bcc-envelope.spec.ts:68-73`); чего он не делает — не снимает
дубли адресов и не отвергает пустой список, тогда как сервер делает и то, и другое
(`backend/app/modules/bcc/features/send_request/domain.py:95-99`, тесты
`backend/tests/modules/bcc/test_send_request.py:93-103`, `:161-165`). (2) **Вложения**: `fileIds`
уходят в конверт как есть (`services/mocks/bcc.ts:330`) и в реестр загруженных файлов
(`services/mocks/index.ts:281`) не разрешаются; колонка на схеме есть
(`backend/app/modules/bcc/shared/models.py:78`). (3) **Срок жизни ленты**: удаления в домене нет
ни в каком виде — `DELETE` среди семи путей отсутствует,
`grep -n "^export function" frontend_vue/src/services/mocks/bcc.ts` даёт восемь имён
(`services/mocks/bcc.ts:225`, `:229`, `:248`, `:295`, `:310`, `:337`, `:345`, `:372`) без единого
`delete`. (4) **Обратная связь с поставщиком**: ни `lastBccDate`, ни `priceHistory` карточки домен
не трогает (оба грепа по `services/mocks/bcc.ts` → 0). (5) **Каталог товаров**: дерево — константа
мока (`services/mocks/bcc.ts:7-118`), связанная с товарами только картой имён категорий
(`:122-138`); ни `products`, ни `categories` в моке домена не импортируются — строк импорта пять и это весь
список: два типовых, `suppliers`, `notifications`, `settings` (`:1-5`). Первая — находка про мок; остальные четыре — строки владельцу.

**6. Мультиарендность — во фронте не выражена никак, на схеме выражена дважды.**
`grep -in "tenant\|userId\|user_id" frontend_vue/src/services/mocks/bcc.ts` пусто, а
`services/bccService.ts` (78 строк) ставит заголовки только у двух вызовов из семи —
`Idempotency-Key` у `send` (`:43`) и у `log` (`:64`); остальные пять идут без `options` вовсе
(`:7`, `:11`, `:21`, `:73`, `:77`), то есть без единого заголовка (`options?.headers` — их
единственный источник, `services/api.ts:144-158`, `:163-175`) — БАГ-09. На сервере правило
выражено на обеих таблицах: `bcc_categories.tenant_id` — FK на `tenants.id`, `ondelete="CASCADE"`,
`nullable=False, index=True` (`backend/app/modules/bcc/shared/models.py:16-21`) и
`bcc_events.tenant_id` теми же условиями (`:48-53`); миграция
`backend/alembic/versions/f96e6fb2d5cf_phase_8_bcc.py:28`, `:39`. Плюс адресность автора —
`sender_user_id` (`models.py:79-83`). Как сервер узнаёт арендатора — общее правило §4 соглашений
(из токена, и только из него); что домен для этого не шлёт ничего — строка владельцу.

**7. Права — нигде на уровне действия.** Доступ гейтится только фича-флагами, и их два: страница
целиком — `meta.featureFlag: 'bccRequest'` на роуте (`src/router/index.ts:199-202`), панель
истории — `useFeatureFlag('bccHistory')` (`BccRequestPage.vue:34`, применение `:869`). Оба
объявлены `true` константой (`src/config/featureFlags.ts:18`, `:34`) и типизированы
(`src/types/features.ts:15`, `:30`); на бэкенде оба заведены записями каталога фич — `bccRequest`
уровня `page`, `bccHistory` уровня `section`
(`backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py:63-65`, `:101-103`). **То есть
это тариф, а не право** (§7 соглашений). В матрице прав BCC-инструмента нет:
`grep -in "bcc" frontend_vue/src/services/mocks/config.ts frontend_vue/src/types/config.ts` даёт
три попадания, и все три — про поле карточки поставщика `f-last-bcc`
(`services/mocks/config.ts:92-94`, `:162`). Функции, которая проверяет право отправить письмо от
лица компании или принять цену поставщика, нет ни одной — ни во фронте, ни в моке, ни на сервере.
Строка владельцу.

**8. Транзакционность и идемпотентность — разделено пополам, и обе половины неполны.**
`Idempotency-Key` шлют два вызова из семи (`services/bccService.ts:43`, `:64`), генератор общий
(`services/api.ts:239-245`), мок ключ чтит (`services/mocks/index.ts:262-269`). Не шлют его
`POST /api/bcc/events/:eventId/response` (`services/bccService.ts:73`) и `.../no-response` (`:77`)
— при том, что каждый создаёт новую строку (`services/mocks/bcc.ts:491`, `:513`) — БАГ-03.
Оптимистичной блокировки нет: `grep -c "If-Match\|version" frontend_vue/src/services/bccService.ts`
→ 0 (общее правило — §11 соглашений). **Атомарность письма гарантирована и доказана с обеих
сторон:** один `send_message` на отправку
(`backend/app/modules/bcc/features/send_request/domain.py:123-124`, тест «a loop would leave
len(SUPPLIERS) messages here» — `backend/tests/modules/bcc/test_send_request.py:81-85`), один
конверт в журнале мока (`services/mocks/bcc.ts:439`, спека
`services/mocks/bcc-envelope.spec.ts:40-46`). **Оба следа отправки теперь оставляет одно место:**
`mockSendBccRequest` пишет конверт и следом заводит N × M строк
(`services/mocks/bcc.ts:426-455`), а гейт `MAIL_NOT_CONFIGURED` стоит выше обоих (`:433`), так что
отказ не оставляет ни письма, ни строк — это проверено спекой
(`services/mocks/bcc-history-rows.spec.ts`). До 2026-09-07 второй след жил **в браузере**, и это
был БАГ-01. Что делать, если письмо ушло, а строки не записались, — **решено 2026-09-09 (П48)**:
порядок обратный сегодняшнему — **сначала записываются строки, потом уходит письмо**. Упавшая
отправка оставляет запись, помеченную неотправленной, и её можно повторить; обратный порядок хуже,
потому что письмо не вернёшь. Мок сегодня делает обе записи подряд, без общей границы, и откатить
первую при падении второй ему нечем.

**9. Производные значения — пять.** (1) `totalPages` — считается при чтении
(`services/mocks/bcc.ts:265`), колонки под него нет. (2) `total` — длина всей ленты, фильтров у
эндпоинта нет (`:258`). (3) **«Текущее состояние пары (запрос, поставщик, товар)» — производное от
порядка событий**, и считает его сегодня клиент (`BccRequestPage.vue:492-496`); сервер обязан
считать то же по `created_at` (`backend/app/modules/bcc/shared/models.py:84-89`), и у него для
этого есть индекс, а у клиента нет даже времени точнее суток (`types/bcc.ts:24`).
(4) `requestId` — **выводимое значение, и с 2026-09-07 его выводит один сервер**: монотонный
счётчик, начальное значение снято с сидов (`services/mocks/bcc.ts:355-364`, `maxSeq` `:346-353`).
Клиентский `max(req-NNN) + 1` из страницы удалён вместе с `createEventRows` — это была клиентская
половина БАГ-02. (5) `productCount` категории — на схеме
**хранимая** колонка с дефолтом `0` (`backend/app/modules/bcc/shared/models.py:29-31`), в моке
константа у корней и ноль у листьев (`services/mocks/bcc.ts:11` против `:16`); выводится она из
каталога товаров или обновляется событием — часть строки владельцу про природу дерева.

---

## Правила домена

То, что живёт только в этом домене и не выводится из формы ни одного эндпоинта.

1. **Одно письмо, все адреса в BCC — и это единственное правило проекта, реализованное на бэкенде
   раньше эндпоинта.** `build_bcc_envelope` кладёт получателей только в `Bcc`, в `To` — самого
   отправителя (`backend/app/modules/bcc/features/send_request/domain.py:101-107`), и причина
   названа в докстроке дословно: снаружи рассылка циклом выглядит идентично, поэтому гарантия
   выражена кодом с тестом, а не фразой в ревью (`:1-12`). Проверок три класса: одна отправка на
   многих (`backend/tests/modules/bcc/test_send_request.py:77-85`), ни одного адреса в видимых
   заголовках (`:106-113`) и — главное — в передаваемых байтах нет ни списка получателей, ни
   заголовка `Bcc` (`:115-133`, на настоящем `smtplib.SMTP` с отобранным сокетом, `:56-73`). Мок
   повторяет то же (`services/mocks/bcc.ts:319-332`, спека
   `services/mocks/bcc-envelope.spec.ts:39-56`).
2. **Отказ вместо тихого успеха.** Ненастроенная почта отвергает отправку и на сервере
   (`backend/app/modules/bcc/features/send_request/domain.py:92-93`, тест по каждому из трёх
   обязательных полей — `backend/tests/modules/bcc/test_send_request.py:143-153`), и в моке
   (`services/mocks/bcc.ts:317`, спека `services/mocks/bcc-envelope.spec.ts:68-73`). Условие —
   общий `isMailConfigured`, сужённый до трёх полей нарочно; бэкенд повторяет его теми же тремя
   (`domain.py:58-65`) и явно разрешает пустые логин и имя отправителя
   (`test_send_request.py:155-159`).
3. **Сервер сильнее мока на два правила отправки.** Дубли адресов снимаются с сохранением порядка
   — «тот же поставщик дважды получил бы запрос дважды из одной отправки»
   (`backend/app/modules/bcc/features/send_request/domain.py:95-97`, тест
   `backend/tests/modules/bcc/test_send_request.py:93-103`); пустой список отвергается кодом
   `NO_RECIPIENTS` (`domain.py:98-99`, объявление `:34-38`, тест `test_send_request.py:161-165`).
   Мок не делает ни того, ни другого (`services/mocks/bcc.ts:435-437`), а кода `NO_RECIPIENTS`
   фронт не знает вовсе. Значит два пути ошибки под моками не воспроизводятся — и первый из них не
   «ошибка интерфейса», а двойное письмо живому поставщику.
4. **Отправка не бывает частичной: конверт один, поэтому «ушло половине» невозможно по
   построению.** Транспорт открывает **одну** SMTP-сессию на отправку и закрывает её в `finally`
   (`backend/app/modules/bcc/features/send_request/transport.py:20-43`), а `send_message` без
   `to_addrs` — именно то, что превращает `Bcc` в конвертных получателей, не вынося заголовок на
   провод (`:46-54`, комментарий `:48-51`). Неизвестное значение `encryption` трактуется как
   `none`, а не роняет отправку, и причина названа (`:24-27`).
5. **Событие — строка, а не состояние: ни одна запись ленты никогда не правится.** «Ответ пришёл»
   и «не ответил» создают **новые** строки, копируя у исходной шесть полей и получая свои `id` и
   `date` (`services/mocks/bcc.ts:351-363`, `:375-385`). Исходная остаётся как след. Следствие для
   сервера: `UPDATE` по `bcc_events` не нужен ни одному сценарию домена, а «текущее состояние» —
   это выборка последней строки по ключу `(request_id, supplier_id, product_id)`.
6. **Тип фронта и схема таблицы расходятся по пяти полям, и схема старше — она уже в БД**
   (миграция `backend/alembic/versions/f96e6fb2d5cf_phase_8_bcc.py`):
   - `id`: фронт — строка вида `evt-001` / `evt-${Date.now()}` (`types/bcc.ts:22`, значения
     `services/mocks/bcc.ts:143`, `:352`), схема — `UUID` из `UUIDMixin`
     (`backend/app/modules/bcc/shared/models.py:43`, миграция `:38`);
   - `date`: фронт — строка `YYYY-MM-DD` (`types/bcc.ts:24`, `services/mocks/bcc.ts:354`), схема —
     `created_at: DateTime(timezone=True)` с индексом (`models.py:84-89`); колонки `date` на схеме
     нет вовсе;
   - `supplierName` и `productName`: фронт хранит подписи прямо в строке события, обе
     `TranslatedString` (`types/bcc.ts:26`, `:28`), схема — только внешние ключи `supplier_id` и
     `product_id` (`models.py:57-67`), то есть **сервер обязан подмешивать имена при чтении, а не
     хранить их** (в отличие от осознанных снимков §17 соглашений);
   - `source`: фронт — `TranslatedString` (`types/bcc.ts:30`, нормализация
     `services/bccService.ts:61`), схема — `String(50)` NOT NULL (`models.py:71-73`);
   - `subject`, `body`, `attachment_file_ids`, `sender_user_id`: четыре колонки схемы
     (`models.py:76-83`), которых нет ни в типе, ни в моке — содержимое письма сервер хранит, а
     фронт после отправки не видит никогда.
7. **Идентификатор «товара» BCC не существует больше нигде, а схема ссылается на `products.id`.**
   Листья дерева — `sheet-2mm`, `beam-i20`, `pipe-100` и ещё двенадцать
   (`services/mocks/bcc.ts:7-118`, карта категорий `:122-138`), и встречаются они только в моке
   домена и его спеке (`services/mocks/bcc-envelope.spec.ts:32`, `:77`); товары мока — `prod-001`…
   (`services/mocks/products.ts:31`), категории — `cat-1`… (`services/mocks/categories.ts:11`). При
   этом `bcc_events.product_id` — FK на `products.id` с `ondelete="SET NULL"`
   (`backend/app/modules/bcc/shared/models.py:63-67`). Пока не решено, что такое `bcc_categories`,
   серверная реализация не сможет ни принять `productIds`, ни отдать своё дерево — БАГ-06.
8. **Подпись письма собирается из настроек, а не из константы, и это следствие реального
   инцидента.** Тема — название компании и дата (`src/domain/bccEmail.ts:82-88`), тело —
   приветствие, список позиций и подпись менеджера (`:96-108`); источник полей —
   `AppSettings.company` и `AppSettings.profile` (`composables/useBccRequest.ts:43-49`). Причина
   записана в коде: до 2026-08-28 на их месте стояла константа с именем постороннего юрлица, и
   письмо уходило живому поставщику от лица чужой компании (`src/domain/bccEmail.ts:10-12`).
   Закреплено e2e — тема обязана называть **нашу** компанию и не содержать прежнего имени
   (`frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts:321-329`), тело — подписываться
   текущим менеджером (`:331-336`). Пустые поля выпадают вместе с «С уважением,», чтобы не
   оставлять висящее прощание (`src/domain/bccEmail.ts:94-104`).
9. **Дата в теме и дата в ленте — один формат и одна функция.** `formatBccDate` живёт в доменном
   слое (`src/domain/bccEmail.ts:64-69`) и импортируется страницей под своим именем
   (`BccRequestPage.vue:26`), чтобы у инструмента не завелось двух форматов даты (причина —
   `src/domain/bccEmail.ts:58-63`). На проводе дата события при этом ISO (`types/bcc.ts:24`), а
   `dd.mm.yyyy` — только для показа (§14 соглашений).
10. **Список получателей не сокращается никогда — совпадение по категории лишь всплывает наверх.**
    Мок возвращает всех и помечает флагом `selected` тех, чьи категории покрывают выбранные товары
    (`services/mocks/bcc.ts:229-246`, причина `:230-233`); страница сортирует отмеченных вверх, не
    пряча остальных (`BccRequestPage.vue:203-212`). Для сервера `products` — параметр подсказки, а
    не фильтра, и пустой ответ по нему невозможен.
11. **Ленту мок отдаёт копией, каталог — ещё ссылкой.** `mockGetBccHistory` с 2026-09-07 обёрнут
    в `structuredClone` (`services/mocks/bcc.ts:264`), как у соседа
    (`services/mocks/notifications.ts:424`), и мутация полученной строки «сервер» больше не меняет
    — проверено спекой (`services/mocks/bcc-history-rows.spec.ts`, «лента отдаёт копию, а не
    ссылки в свой стор»). `mockGetBccCategories` по-прежнему возвращает сам массив
    (`services/mocks/bcc.ts:226`) — это остаток того же класса, §18 соглашений.
12. **Тема и тело собираются на трёх языках, а уходит один.** `buildBccSubject` и `buildBccBody`
    строят `TranslatedString` целиком (`src/domain/bccEmail.ts:82-88`, `:96-108`), пересборка — на
    `watchEffect`, а не `watch(..., { deep: true })`, и причина названа питфоллами #36/#37
    (`composables/useBccRequest.ts:51-62`). Но на провод клиент кладёт `toTranslatedString(tf(...),
    locale)` — текущую локаль в объекте с одной заполненной ветвью (`services/bccService.ts:39-40`,
    вход `composables/useBccRequest.ts:136-137`). Две другие локали письма браузер не покидают, а
    колонок под них на схеме и нет: `subject`/`body` — `Text`
    (`backend/app/modules/bcc/shared/models.py:76-77`).

---

## Чего в домене нет

Ничего не вычеркнуто молча: строка на каждое описание, снятое из прежнего текста контракта
([`03-api-contract.md:534-620`](../03-api-contract.md)), с доказательством отсутствия.

| было описано | чем доказано отсутствие |
|---|---|
| «полный каталог — кешируется (ETag)» (`03-api-contract.md:543`) | `grep -rn "ETag\|If-None-Match" frontend_vue/src/services/api.ts frontend_vue/src/services/bccService.ts` пусто; условных запросов в клиенте нет ни одного |
| «видимость товара фильтруется по товарным правам» (`03-api-contract.md:543`) | прав в домене нет ни одного: гейтов только два и оба тарифные (`src/router/index.ts:199-202`, `BccRequestPage.vue:34`), в матрице прав BCC не значится («Обязанности сервера», графа 7) |
| `"name": "Sheets"` строкой в примере каталога (`03-api-contract.md:541`) | в типе это `TranslatedString` (`types/bcc.ts:5`), мок отдаёт объект трёх локалей (`services/mocks/bcc.ts:10`); на схеме — `name_translations: JSONB` (`backend/app/modules/bcc/shared/models.py:22`) |
| `selected: true` «для тех, у кого **в профиле** есть хотя бы один из запрошенных товаров» (`03-api-contract.md:549`) | связи «поставщик ↔ товар» в коде нет: сопоставляются категории, и не идентификаторами, а совпадением строк (`services/mocks/bcc.ts:236-244`, карта `:122-138`) |
| `company` и `contactPerson` строками в примере получателя (`03-api-contract.md:551`) | в типе оба `TranslatedString` (`types/bcc.ts:12`, `:14`) |
| «`onMounted` → `loadHistory`, **смена `page`/`pageSize`**» (`03-api-contract.md:557`) | второго вызова нет: `grep -rn "getBccHistory" frontend_vue/src` даёт объявление (`services/bccService.ts:14`), импорт и один вызов (`composables/useBccRequest.ts:6`, `:106`); листалки у ленты в разметке нет — `v-for="evt in history"` (`BccRequestPage.vue:890`) |
| `supplierName`, `productName`, `source` строками в примере строки ленты (`03-api-contract.md:561`) | все три `TranslatedString` (`types/bcc.ts:26`, `:28`, `:30`) |
| «сортировка DESC по создания» (`03-api-contract.md:563`) | сервером не выражена: мок не сортирует ничего (`services/mocks/bcc.ts:248-267`), порядок держится `unshift`-ами (`:415`, `:491`, `:513`), а поля времени точнее суток у строки нет (`types/bcc.ts:24`) — события одного дня не упорядочены ничем |
| «пагинация обязательна — tenant за год может набрать 50k+ event-rows» (`03-api-contract.md:563`) | пагинация в форме запроса есть, а срока жизни строки и удаления в домене нет: `DELETE` среди семи путей отсутствует, `grep -n "^export function" frontend_vue/src/services/mocks/bcc.ts` даёт восемь имён без единого `delete`. Строка владельцу |
| вложенное тело `send`: `template: { subject, body, attachments: { fileIds } }` (`03-api-contract.md:572-577`) | клиент шлёт плоское, `fileIds` на верхнем уровне типа payload (`services/bccService.ts:31`, сборка тела `:35-45`) |
| `subject`/`body` строками у `send` (`03-api-contract.md:575-576`) | на проводе `TranslatedString` — `toTranslatedString(...)` в обоих полях (`services/bccService.ts:39-40`) |
| «Одновременно создаётся N × M row'ов в history со `status: 'sent'`, `source: 'BCC Tool'`» как обязанность сервера (`03-api-contract.md:585`) | **верно с 2026-09-07**: `mockSendBccRequest` заводит их сам (`services/mocks/bcc.ts:453` → `createEventRows` `:389-417`), `status: 'sent'` — `:411`, подпись `'BCC Tool'` — из серверного каталога `SOURCE_LABELS` (`:317-323`). Раньше строки сочинял браузер — БАГ-01, закрыт |
| `requestId` формата `req-###` (`03-api-contract.md:581`) | формат один и присваивает его сервер: `req-NNN` монотонным счётчиком (`services/mocks/bcc.ts:355-364`). Клиентский счёт удалён. Схема ограничений по-прежнему не ставит — `String(50)` (`backend/app/modules/bcc/shared/models.py:54-56`); `evt-${Date.now()}` у приёма ответа и отметки молчания (`services/mocks/bcc.ts:479`, `:503`) остался — это уже про `id` строки, а не про `requestId` |
| `attachments?: { fileIds: string[] }` в теле `log` (`03-api-contract.md:597`) | клиент вложений при логировании не шлёт вовсе: тело — три поля (`services/bccService.ts:49-67`) |
| `source` как строковый union из пяти значений у `log` (`03-api-contract.md:596`) | на проводе `TranslatedString` (`services/bccService.ts:61`); union живёт константой страницы (`BccRequestPage.vue:377`) |
| ответ `log` = `{ requestId: string; events: BccRequest[] }`, «массив созданных строк, чтобы клиент сразу подложил в `history`» (`03-api-contract.md:600`) | ответ несёт только `requestId` (`services/bccService.ts:56`); строки создаёт сервер, но наружу их не отдаёт — клиент берёт их перечитыванием ленты. **Возвращать ли массив — по-прежнему строка владельцу**, и она сознательно не решена правкой БАГ-01 |
| «`{ price: number; unit: 'kg'\|'m` …» — перечисление единиц, оборванное и склеенное со следующим пунктом (`03-api-contract.md:606`) | допустимого набора старый текст не называет вовсе; в коде это константа страницы из четырёх строк (`BccRequestPage.vue:333`) мимо справочника `AppSettings.uoms` (`types/settings.ts:240`) — БАГ-07 |
| «422, если `price <= 0`» (`03-api-contract.md:607`) | не реализовано нигде: `mockAcceptResponse` цену не проверяет (`services/mocks/bcc.ts:472-497`), клиент проверяет только `NaN` (`BccRequestPage.vue:349`); `VALIDATION_ERROR` ядро объявляет (`backend/app/core/exceptions.py:23-27`), домен его не бросает — роутов нет |
| «Также обновляет `priceHistory` карточки соответствующего супплайера» (`03-api-contract.md:607`) | `grep -c "priceHistory" frontend_vue/src/services/mocks/bcc.ts` → 0, `grep -c "lastBccDate"` там же → 0; на бэкенде оба поля поставщика — хранимые колонки (`backend/app/modules/suppliers/shared/models.py:58-61`). Строка владельцу |
| «permission `delete` на аудит», «сервер удаляет запись напрямую» и прочие правила соседних разделов, попавшие в BCC по смежности | у BCC своего журнала нет вовсе (`grep -c "auditLog" frontend_vue/src/services/mocks/bcc.ts` → 0) и `DELETE` в домене нет ни одного — правила девяти логов живут в §9 соглашений |
| общие правила: конверт ответа, коды ядра, мультиарендность, `TranslatedString`, конверт пагинации, идемпотентность, файлы, форма `id` | перенесены в [`00-conventions.md`](00-conventions.md) (§1, §2, §4, §12, §13, §11, §16, §19) — правило двух и более доменов в доменном файле не дублируется |
| «Секция "Add manual entry" не используется — её заменил `POST /api/bcc/log`»; «отдельного `POST /api/bcc/attachments` нет» (`03-api-contract.md:616`) | **верно и подтверждено**: `grep -rn "api/bcc" frontend_vue/src --include=*.ts --include=*.vue | grep -v spec` даёт двенадцать строк на семь различных путей (семь вызовов клиента плюс пять ветвей мока), и ни одного `attachments` — `grep -rn "api/bcc/attachments" frontend_vue/src backend` → 0; вложения уходят общим `POST /api/uploads` (§16 соглашений) |

---

## Пробелы аудита — состояние

Каждый пробел из [аудита](../../plans/api/audit/bcc.md) закрыт выше или помечен «осталось».
«Осталось» значит одно: ответа нет ни в коде фронта, ни на сервере, и назначать его контракт не
вправе — строка стоит в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
«bcc — аудит 2026-09-04» (одиннадцать строк).

| пробел аудита | где закрыт |
|---|---|
| каталог: пример со строковым `name` при `TranslatedString` в типе | «Чего в домене нет», строка 3; раздел `GET /api/bcc/categories`, форма ответа |
| каталог: «кешируется (ETag)» кодом не поддержано | «Чего в домене нет», строка 1 |
| каталог: «видимость по товарным правам» — прав в домене нет | «Чего в домене нет», строка 2; «Обязанности сервера», графа 7 |
| каталог: листья дерева фронт считает товарами, а схема — категориями | раздел `GET /api/bcc/categories`, абзац о листьях; «Правила домена», п. 7 |
| получатели: `selected` выводится по имени категории, а не по товару из профиля | «Чего в домене нет», строка 4; раздел `GET /api/bcc/recipients`, абзац о `selected` |
| получатели: пример со строковыми `company`/`contactPerson` | «Чего в домене нет», строка 5 |
| получатели: ответ непагинирован, страница режет его сама по 5 | раздел `GET /api/bcc/recipients`, форма ответа; «Правила домена», п. 10 |
| получатели: `id` получателя — это `id` поставщика, с его расхождением пространств | раздел `GET /api/bcc/recipients`, абзац об `id` (БАГ-05) |
| история: «смена `page`/`pageSize`» как второй триггер | «Чего в домене нет», строка 6; раздел `GET /api/bcc/history`, абзац «Пагинации в интерфейсе нет» |
| история: пример со строковыми `supplierName`/`productName`/`source` | «Чего в домене нет», строка 7 |
| история: «сортировка DESC» сервером не выражена, времени точнее суток нет | «Чего в домене нет», строка 8; раздел `GET /api/bcc/history`, абзац о порядке |
| история: «текущее состояние пары» — производное от порядка, считает клиент | раздел `GET /api/bcc/history`, абзац об `isLatestEvent`; «Обязанности сервера», графа 9 (3) |
| отправка: вложенное тело `template: { … }` против плоского | «Чего в домене нет», строка 10 |
| отправка: `subject`/`body` строками против `TranslatedString` | «Чего в домене нет», строка 11; «Правила домена», п. 12 |
| отправка: «сервер создаёт N × M строк» — **создаёт с 2026-09-07** | «Чего в домене нет», строка 12; раздел `POST /api/bcc/send`, форма ответа |
| отправка: `requestId` в трёх форматах | «Чего в домене нет», строка 13; «Обязанности сервера», графа 9 (4) |
| отправка: вложения нигде не разрешаются в файлы | раздел `POST /api/bcc/send`, абзац о вложениях; «Обязанности сервера», графа 5 (2) |
| логирование: `attachments` в теле, которого клиент не шлёт | «Чего в домене нет», строка 14 |
| логирование: `source` union против `TranslatedString` на проводе | «Чего в домене нет», строка 15 |
| логирование: ответ обещал массив событий | «Чего в домене нет», строка 16 |
| логирование: отправка и логирование создают строки одинаково — одной функцией мока | раздел `POST /api/bcc/log`, абзац о `createEventRows` |
| приём ответа: строка старого контракта порвана, набор единиц не назван | «Чего в домене нет», строка 17 |
| приём ответа: «422 при `price <= 0`» не реализовано | «Чего в домене нет», строка 18; раздел `POST /api/bcc/events/:eventId/response`, ошибки |
| приём ответа: `priceHistory` карточки поставщика не обновляется | «Чего в домене нет», строка 19 |
| приём ответа: рождает единственное уведомление домена, и правка рождает второе | раздел `POST /api/bcc/events/:eventId/response`, абзац об уведомлении; «Обязанности сервера», графа 2 (БАГ-10) |
| отметка молчания: кто и когда отмечает — только человек, автоматики нет | раздел `POST /api/bcc/events/:eventId/no-response`, абзац «Кто и когда отмечает молчание» |
| отметка молчания: операция не идемпотентна, ключ не шлётся | тот же раздел, форма запроса; «Обязанности сервера», графа 8 (БАГ-03) |
| отметка молчания: уведомления не рождает, и так задумано | тот же раздел, абзац об уведомлениях |
| отметка молчания: новая строка наследует `source` исходной | тот же раздел, абзац о наследовании |
| правила домена 1–12 аудита | раздел «Правила домена», пункты 1–12 один к одному |
| девять граф «Обязанностей сервера» | раздел «Обязанности сервера», графы 1–9 |
| **решено 2026-09-09 (П48)** · сначала запись, потом отправка: упавшее письмо оставляет запись помеченной неотправленной и повторяемой | графа 8; правило домена 4 |
| **осталось** · чем является дерево `bcc_categories` — своим каталогом или проекцией `products`/`categories`, и кто пересчитывает `product_count` | раздел `GET /api/bcc/categories`; графа 9 (5); решение владельца (БАГ-06) |
| **решено 2026-09-07 частично** · единицы цены принадлежат справочнику настроек `AppSettings.uoms` (`types/settings.ts:240`), константа страницы `UNIT_OPTIONS` (`BccRequestPage.vue:333`) — дефект (П19). **Осталось:** попадает ли перечень источников запроса на страницу настроек или остаётся закрытым списком в коде | графа 1; [§14](00-conventions.md) |
| **осталось** · как сервер узнаёт арендатора и автора, если клиент домена не шлёт ни одного заголовка | графа 6; решение владельца (БАГ-09) |
| **решено 2026-09-08 (П36)** · да — обе операции меняют состояние, значит пишутся. Автор берётся из сессии; на схеме под него уже есть `sender_user_id`, и заполнять её сегодня некому только потому, что у слайса отправки нет вызывающих | графа 3; [§9](00-conventions.md) |
| **решено 2026-09-07 (П9, П15)** · и отправка письма от лица компании, и приём цены — обычные права, раздаются по обязанностям роли, а не сквозным «да/нет». Ложатся на CRUD: отправка письма — `create` (самостоятельная вещь), приём цены — `edit` (обновляет сущность); отдельного именованного права ни у той, ни у другой не заводится | графа 7; [§6.2](00-conventions.md), [§6.6](00-conventions.md) |
| **решено 2026-09-09 (П51)** · сама отправка запроса уведомления не рождает — в перечень нужных типов не вошла; ответ поставщика свой тип уже имеет, а его адресация и защита от повтора сняты §10 (нарушение — БАГ-10, правка принятого ответа шлёт второе) | графа 2; [§10.1](00-conventions.md) |
| **решено 2026-09-10 (П61)** · срока жизни нет — история BCC не удаляется вовсе; хранение позже станет предметом тарифа, и назначать срок сейчас значило бы записать то, что тариф отменит | графа 5 (3); [§25](00-conventions.md) |
| **решено 2026-09-11 (П68, П72)** · `lastBccDate` колонкой не хранится вовсе и выводится при чтении из журнала; `priceHistory` — наоборот, хранится и обновляется событием, и **приём ответа BCC одно из событий, обязанных её двигать** | графа 5 (4); [§17](00-conventions.md), [§17.1](00-conventions.md) |
| **решено 2026-09-09 наполовину (П48)** · **возвращают**: созданные строки приходят прямо в ответе — на один запрос меньше, и лента обновляется без перечитывания. **Осталось:** в какой валюте хранится цена | «Чего в домене нет», строка 16; раздел `POST /api/bcc/events/:eventId/response`, абзац о валюте |
| **снято 2026-09-09** · не решение, а работа: доменное правило, транспорт и тест написаны, вызывать их некому — подключение к HTTP это задача реализации, а не вопрос контракта | шапка файла, абзац о доменном слайсе |

Находки про код домена —
[`contract-sync-bcc-bugs.md`](../../plans/bugs/contract-sync-bcc-bugs.md), БАГ-01…БАГ-11. Сведением
контракта код тронут не был; **БАГ-01 починен отдельной задачей 2026-09-07**, и разделы выше
описывают состояние после починки. Остальные десять находок открыты.
