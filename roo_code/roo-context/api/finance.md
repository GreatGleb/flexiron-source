# Finance

Деньги и документы: реестр счетов к получению, счета поставщиков и архив документов. Домен из
**пяти** эндпоинтов — четыре чтения и один `PATCH`, — и ни один из пяти не реализован сервером.

Общие соглашения — [`00-conventions.md`](00-conventions.md) в этом каталоге. Конверт ответа (§1),
каталог кодов ядра и правила кодов (§2), `PATCH` против `PUT` (§3), мультиарендность (§4),
заголовки (§5), права (§6), тарифные флаги (§7), аудит-лог (§9), уведомления как переход (§10),
идемпотентность и версии (§11), пагинация (§13), деньги и валюта (§14), clean-slate (§15), файлы
(§16), производные значения (§17), чем мок отличается от сервера (§18) и форма `id` (§19) —
**там, и здесь не повторяются**. Ниже только то, что принадлежит домену.

Аудит, из которого написан файл: [`plans/api/audit/finance.md`](../../plans/api/audit/finance.md).
Находки про код: [`contract-sync-finance-bugs.md`](../../plans/bugs/contract-sync-finance-bugs.md),
БАГ-01…БАГ-12 (последняя найдена при написании этого файла, инверсией линзы К3). Код этой
работой не тронут.

**Источник истины домена — мок и клиент, по всем пяти эндпоинтам.** Модуль `finance` в
`backend/app/modules/` существует, но роутов у него **ноль**
(`grep -rn "@router\." backend/app/modules/finance --include=*.py` — пусто; каталога
`features/<фича>` нет вовсе), поэтому старшинство «бэкенд» из
[скила](../../skills/api-contract.md) не наступило ни разу, и формы ниже сняты с
`services/financeService.ts`, `mocks/finance.ts` и `types/finance.ts`.

**Схема хранения при этом зафиксирована, и щедро** — три таблицы в
`backend/app/modules/finance/shared/models.py`: `finance_payments`
(`finance/shared/models.py:11-55`), `payment_documents` (`:58-90`), `document_archive_items`
(`:93-128`); миграция `backend/alembic/versions/b2619dfeb90f_phase_10_finance.py:24-76`. Она учтена
как **ограничение**, а не как источник формы, и расходится с фронтом в шести местах — «Правила
домена», п. 1. Четвёртой таблицы там нет намеренно: реестр входящих — представление, а не
сущность, и хранения под него не существует ни во фронте, ни на схеме
(`grep -rn "receivable" backend/app --include=*.py -i` — пусто).

**Метка `Статус: спроектировано` домену не подходит ни в одном разделе:** клиент и мок есть у всех
пяти эндпоинтов, то есть код существует — отсутствует только серверная часть. Разницу несёт строка
`Бэкенд:`, и у всех пяти разделов она читается «не реализован».

---

## Каталог кодов ошибок домена

Правила кодов — §2 соглашений. У домена **один** собственный код:

| код | статус | где брошен | когда |
|---|---|---|---|
| `PAYMENT_NOT_FOUND` | 404 | `mocks/finance.ts:428`, `:475` | `id` в пути не найден — чтение и правка карточки платежа |

Четыре факта об этом каталоге, каждый проверен грепом:

- **Внутри домена сравнивать не с чем, а с каталогом ядра требование §2 нарушено.** Своих кодов
  один, коллизии внутри домена невозможны; но ядровый `NOT_FOUND`
  (`backend/app/core/exceptions.py:13-20`) — **подстрока** `PAYMENT_NOT_FOUND`, а §2 требует, чтобы
  ни один код не был подстрокой другого. Сегодня это не проявляется: роутов у модуля нет, то есть
  ядро на этих путях ничего не бросает, и финансовых кодов нет ни в одной подстрочной таблице.
  Место, где подстрочность реальна, знает об опасности и упорядочено под неё — таблица заказов
  ставит содержащийся код после содержащего, и комментарий записан прямо в коде
  (`services/orderLineEdits.ts:322-324`, пара — `:326-327`). Наблюдение записано находкой БАГ-12;
  какой из двух кодов уступает — решать не контракту.
- **Тёзка в домене заказов до человека доведён, здесь — нет.** Тот же литерал бросает мок заказов
  (`mocks/orders.ts:4015`) и там получает сообщение таблицей
  (`services/orderLineEdits.ts:326` — `'orders.error_payment_not_found'`); в финансах эта таблица
  не используется вовсе (`grep -rn "orderLineEdits" frontend_vue/src/views/admin/finance/` —
  пусто).
- **До человека код не доходит.** Все четыре страницы домена сводят любую ошибку к булеву флагу и
  печатают общий текст (`views/admin/finance/IncomingPaymentsPage.vue:62-64`,
  `views/admin/finance/OutgoingPaymentsPage.vue:55-57`,
  `views/admin/finance/DocumentArchivePage.vue:68-70`,
  `views/admin/finance/OutgoingPaymentCardPage.vue:64-66`); разбора `ApiRequestError.code`
  (`types/api.ts:25-47`) в домене нет ни одного места. Находка — БАГ-06.
- **Под моками это даже не `ApiRequestError`.** Мок вызывается до `unwrap()` и бросает голый
  `Error('PAYMENT_NOT_FOUND')` (`services/api.ts:149-152`), то есть код лежит в `message`, а
  против настоящего сервера будет лежать в `code` — общий класс §2 соглашений.

Кодов ядра (`NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT` —
`backend/app/core/exceptions.py:13-48`) домен **не бросает ни разу**: бросать их негде, роутов у
модуля нет. Два кода прежнего контракта — `DOCUMENT_NOT_FOUND` и `VALIDATION_ERROR` — в коде
отсутствуют; см. «Чего в домене нет».

---

## Модель: у одной суммы один владелец

Правило, из которого выведена вся раскладка домена, и записано оно в трёх местах кода — в моке
(`mocks/finance.ts:12-24`), в типах (`types/finance.ts:52-58`, `:83-98`) и в доменном слое
(`domain/receivable.ts:4-13`):

- **Входящие — представление над счетами заказов.** Своего хранилища нет: строка реестра это счёт
  (`Order.invoices[]`), срок выводится из условий оплаты клиента, поступления — из платежей
  заказа, статус вычисляется.
- **Исходящие — самостоятельные записи с ручным вводом.** Заказа поставщику в системе не
  существует, выводить их не из чего, поэтому у них хранится и статус, и `dueDate`
  (`mocks/finance.ts:129-137`).

Отсюда **два эндпоинта вместо одного с фильтром направления** — сказано прямо и в клиенте
(`services/financeService.ts:11-15`), и в ветке мока (`mocks/index.ts:820-822`); отсюда же из
`FinanceListFilters` убрано направление (`types/finance.ts:52-62`). Для сервера это значит, что
`GET /api/finance/payments` не должен уметь отдавать входящие, а `GET /api/finance/receivables` —
читать таблицу платежей.

---

### GET /api/finance/receivables

Реестр «Входящие» — страница `IncomingPaymentsPage`. Отдаёт **счета заказов**: своего хранилища у
строки нет, ни одно из её четырнадцати полей нигде не лежит (см. «Обязанности сервера», графа о
производных значениях).

Save-режим — **чтение**, и мутаций у реестра нет и быть не может: деньги регистрируются в карточке
заказа, документы выставляются там же, а ссылка строки ведёт в заказ
(`views/admin/finance/IncomingPaymentsPage.vue:183-189`, `:203-210`); карточки у строки нет
намеренно, и причина записана в самом файле (`:17-24`).

Запрос — четыре query-строки, и клиент шлёт **все четыре всегда**, включая пустой поиск и
`status=all` (`services/financeService.ts:16-25`):

```
?search=&status=all&page=1&pageSize=25
```

- `search` — подстрочный поиск, регистронезависимый, по **трём** полям: `invoiceNumber`,
  `clientName`, `orderNumber` (`mocks/finance.ts:88-96`);
- `status` — `pending | overdue | completed | all`. Во фронте типизирован как `string`
  (`types/finance.ts:59-62`), поэтому недопустимое значение отсекается не типом, а пустым
  результатом фильтра (`mocks/finance.ts:97-99`). Значений здесь **на одно меньше**, чем у
  исходящих, и причина названа в коде: отменённого счёта в модели заказа не существует, а
  отозванный корректировкой в реестр не попадает вовсе
  (`views/admin/finance/IncomingPaymentsPage.vue:40-47`, тип `ReceivableStatus` —
  `types/finance.ts:83-90`);
- `page`, `pageSize` — строками; дефолты держит страница (`views/admin/finance/IncomingPaymentsPage.vue:49` — `usePagination(25)`), мок
  повторяет их своим разборщиком (`mocks/index.ts:284-291`). Пустая строка как «без фильтра» —
  §13 соглашений.

Заголовков клиент не шлёт **ни одного**: `apiGet` вызван двумя аргументами
(`services/financeService.ts:20`), а `options?.headers` — единственный источник заголовков у GET
(`services/api.ts:144-158`). Как сервер тогда узнаёт арендатора — графа о мультиарендности; находка
— БАГ-01.

Ответ — `PaginatedResponse<Receivable>` в конверте `ApiResponse` (§1, §13 соглашений).
`Receivable` — **четырнадцать** полей (`types/finance.ts:99-123`):

```ts
{ id; invoiceNumber; issuedAt; dueDate; orderId; orderNumber; clientId; clientName;
  currency; amount; paidAmount; outstandingAmount; paidAt: string | null; status: ReceivableStatus }
```

`id` строки — это **id счёта заказа**, своего у неё нет (`types/finance.ts:100-101`, присвоение
`mocks/orders.ts:4724`, формат `${order.id}-INV-<seq>` — `mocks/orders.ts:4384`).

**Сортировка по умолчанию — `dueDate ASC`**, и это единственный список домена, который сортируется
вообще; причина записана рядом: реестр читают, чтобы узнать, чем заняться сегодня
(`mocks/finance.ts:101-102`). Требование §13 соглашений «контракт обязан назвать умолчание по
каждому списку» выполнено здесь и нарушено кодом у двух других списков — «Правила домена», п. 12.

Отбор строк — **только по наличию невыведенного счёта**, без фильтра по статусу заказа и без
клиента: `orderReceivables()` идёт по всем заказам, пропуская отозванные корректировкой
(`mocks/orders.ts:4712`, `:4719`). Для сервера это значит: реестр не ограничен ни статусом заказа,
ни его возрастом — единственное ограничение обязательно и не выражено во фронте вовсе (арендатор,
§4 соглашений).

Ошибки: **ни одной.** `mockGetReceivables` не бросает (`mocks/finance.ts:83-105`),
`orderReceivables()` тоже (`mocks/orders.ts:4710-4752`).

**Это чтение пишет.** Сборка реестра рождает уведомление о просрочке на каждую строку со статусом
`overdue`, которой ещё не уведомляли (`mocks/finance.ts:65-81`, вызов `:86`), и делает это **до**
фильтров и пагинации, то есть по всем строкам, а не по отданной странице (`:88-99`). Событие
одно — `notifyPaymentOverdue` (`mocks/notifications.ts:684`); правило «событие это переход» — §10
соглашений. Память о том, кого уже уведомили, живёт в `Set` на процесс
(`mocks/finance.ts:63`), потому что своего будильника у системы нет и единственный момент, когда
просрочка становится известной, — чтение (`:55-62`). Находка — БАГ-10; чем сервер отличит первое
обнаружение от повтора после перезапуска — графа «События и уведомления».

Реализация: `services/financeService.ts:16-25` — `getReceivables` · мок `mocks/index.ts:823-825` →
`mocks/finance.ts:83-105` — `mockGetReceivables`; сборка строк — `mocks/orders.ts:4710-4752` —
`orderReceivables`, арифметика — `domain/receivable.ts:133-189` — `invoiceBalances`; доказано
`domain/receivable.spec.ts` и `mocks/finance-receivables.spec.ts`

Бэкенд: **не реализован** — роутов у модуля `finance` ноль, и таблицы под строку реестра нет ни
одной (`grep -rn "receivable" backend/app --include=*.py -i` — пусто).

---

### GET /api/finance/payments

Список счетов поставщиков — страница `OutgoingPaymentsPage`. **Только исходящие**: входящие сюда не
попадают по построению модели (см. «Модель» выше).

Save-режим — **чтение**. Строка ведёт в карточку платежа
(`views/admin/finance/OutgoingPaymentsPage.vue:89-91`, роут `router/index.ts:335-338`).

Запрос — те же четыре query-строки и тем же типом `FinanceListFilters`
(`services/financeService.ts:29-38`, тип `types/finance.ts:59-62`), и клиент шлёт все четыре
всегда:

```
?search=&status=all&page=1&pageSize=25
```

- `search` — подстрочный поиск по **трём** полям: `paymentNumber`, `counterpartyName`,
  `supplierInvoiceRef` (последнее — nullable, и проверка на `null` в фильтре стоит:
  `mocks/finance.ts:388-396`);
- `status` — `pending | completed | overdue | cancelled | all`, четыре значения `PaymentStatus`
  (`types/finance.ts:3`) плюс `all` (`views/admin/finance/OutgoingPaymentsPage.vue:34-40`). Значение
  `cancelled` **недостижимо**: его не носит ни один сид и не ставит ни одна операция — «Правила
  домена», п. 9, БАГ-09;
- `page`, `pageSize` — как у реестра, общий разборщик мока (`mocks/index.ts:284-291`).

Заголовков нет (`services/financeService.ts:33`) — БАГ-01.

Ответ — `PaginatedResponse<FinancePaymentListItem>`. Элемент — проекция карточки на **двенадцать**
полей (`types/finance.ts:37-50`, построение `mocks/finance.ts:404-417`):

```ts
{ id; paymentNumber; direction; status; amount; currency; counterpartyName;
  orderNumber: string | null; supplierInvoiceRef: string | null; dueDate; paidAt: string | null;
  documentCount: number }
```

Из карточки выброшены восемь полей — `counterpartyId`, `counterpartyVatCode`, `orderId`,
`description`, `documents`, `notes`, `createdAt`, `updatedAt`, — а `documentCount` **добавлен** и
считается как `documents.length` (`mocks/finance.ts:416`). На схеме это же число лежит **хранимой
колонкой** `document_count` со `server_default="0"` (`finance/shared/models.py:49-51`) — расхождение
класса §17 соглашений, графа о производных значениях.

`direction` у всех строк один: сид состоит из пяти `'outgoing'`
(`grep -c "direction: 'outgoing'" frontend_vue/src/services/mocks/finance.ts` → `5`), входящей
записи среди них нет ни одной. Единственное `'incoming'` в файле — не строка платежа, а поле
события: `notifyPaymentOverdue` шлёт им уведомление о просроченной дебиторке
(`mocks/finance.ts:72`, внутри `receivables()`), то есть `grep -c "direction: 'incoming'"` по
файлу даёт `1`, и эта единица — про событие из графы 2 «Обязанностей сервера», а не про сид.

**Сортировки нет.** `mockGetPayments` не сортирует вовсе — ни одного `sort` на всю функцию
(`mocks/finance.ts:374-419`, `grep -c sort` по диапазону → 0), порядок
ответа = порядок объявления сида, и он не по сроку: `-21`, `-9`, `+12`, `+26`, `-35` дня. Прежний
контракт обещал `dueDate ASC` — обещание снято, см. «Чего в домене нет»; находка — БАГ-05.

Ошибки: **ни одной** (`mocks/finance.ts:374-419`).

Ни `POST`, ни `DELETE` у этого ресурса **нет**: счёт поставщика нельзя ни создать, ни удалить —
пять записей засеяны руками, и в файле мока всего пять экспортированных функций
(`grep -c "^export function" frontend_vue/src/services/mocks/finance.ts` → 5). Кто и по какому
событию создаёт запись и меняет её статус — графа «Настройки, которых мок не отслеживает».

Реализация: `services/financeService.ts:29-38` — `getPayments` · мок `mocks/index.ts:827-829` →
`mocks/finance.ts:374-419` — `mockGetPayments`

Бэкенд: **не реализован** — таблица `finance_payments` есть (`finance/shared/models.py:11-55`),
роута нет.

---

### GET /api/finance/payments/:id

Карточка счёта поставщика — `OutgoingPaymentCardPage`. Эндпоинт обслуживает **только исходящие**:
`direction` всегда `outgoing`, `orderId` и `orderNumber` всегда `null`, `supplierInvoiceRef`
заполнен — подтверждено всеми пятью сидами (`mocks/finance.ts:149-150`, `:173-174`, `:194-195`,
`:215-216`, `:236-237`).

Запрос — **только путь**. Ни query, ни тела, ни заголовков: `apiGet` вызван одним аргументом
(`services/financeService.ts:41-43`). `id` подставляется без `encodeURIComponent` — это соглашение
проекта, а не свойство домена (`grep -rn "encodeURIComponent" frontend_vue/src/services/*.ts` —
пусто). Форма `id` — §19 соглашений.

Ответ — `FinancePayment` целиком, **девятнадцать** полей (`types/finance.ts:15-35`):

```ts
{ id; paymentNumber; direction; status; amount; currency; counterpartyId; counterpartyName;
  counterpartyVatCode; orderId: string | null; orderNumber: string | null;
  supplierInvoiceRef: string | null; description: string | null; dueDate; paidAt: string | null;
  documents: PaymentDocument[]; notes: string | null; createdAt; updatedAt }
```

`PaymentDocument` — семь полей: `id`, `name`, `fileId`, `url`, `size`, `mime`, `uploadedAt`
(`types/finance.ts:5-13`).

`counterpartyName` и `counterpartyVatCode` — **снимок реквизитов в записи**, а не ссылка на
карточку поставщика (`types/finance.ts:23-24`, схема `finance/shared/models.py:36-37`); то же
правило заморозки, что у заказа (§17 соглашений). При этом `counterpartyId` в моке **ни на что не
разрешается** — `sup-001…sup-005` (`mocks/finance.ts:109-115`) против id `'1'…'6'` в сторе
поставщиков: два пространства id в одном домене, §19 соглашений, находка БАГ-03.

Версии у записи нет: ни `version`, ни `etag` во фронте, ни колонки на схеме
(`finance/shared/models.py:11-55`), `If-Match` не шлётся — поведение last-write-wins, §11
соглашений.

Save-режим — **чтение и вход в clean-slate карточку** (§15 соглашений). Ответ раскладывается на два
места: сам `payment` и черновик заметки `notesDraft`
(`views/admin/finance/OutgoingPaymentCardPage.vue:60-62`), из чего и считается `isDirty` (`:40-51`).
Тот же `load()` — путь откáта: при ошибке Save он вызывается из `catch` (`:83-85`), то есть
несохранённое теряется целиком — «Правила домена», п. 17.

Ошибки: `PAYMENT_NOT_FOUND` — 404, когда записи с таким `id` нет (`mocks/finance.ts:427-428`).

Реализация: `services/financeService.ts:41-43` — `getPayment` · мок `mocks/index.ts:831-834` →
`mocks/finance.ts:426-430` — `mockGetPayment` (отдаёт **копию**, а не запись стора, и причина
записана рядом — `:421-425`)

Бэкенд: **не реализован** — таблицы `finance_payments` и `payment_documents` есть
(`finance/shared/models.py:11-90`), роута нет.

---

### PATCH /api/finance/payments/:id

Правка карточки счёта поставщика по кнопке Save. Тело — дельта, ответ — запись целиком (§3
соглашений).

Save-режим — **clean-slate, один запрос на нажатие**. Правки живут в состоянии карточки:
`notesDraft` (`views/admin/finance/OutgoingPaymentCardPage.vue:26`, `:62`) и
`payment.value.documents`, который меняется на месте — удаление `splice` (`:90-95`), добавление
`push` после аплоада (`:97-111`). `isDirty` сравнивает заметку и **отсортированные** списки
`fileId` (`:40-51`), Save уходит одним PATCH и раскладывает ответ обратно (`:72-88`).

**Аплоад при этом идёт до Save и отдельным запросом:** `DropZone` → `POST /api/uploads`
(`services/uploadsService.ts:13-17`), то есть файл уже лежит на сервере, когда Save ещё не нажат, и
остаётся там, если Save не нажали никогда. Общий механизм — §16 соглашений; кто убирает
неприкреплённый файл — графа о транзакционности.

Запрос — тело:

```ts
{ notes?: string | null; fileIds?: string[] }
```

Карточка шлёт ровно эти два ключа: `{ notes: notesDraft || null, fileIds: documents.map(d => d.fileId) }`
(`views/admin/finance/OutgoingPaymentCardPage.vue:77-80`). **Но подпись клиента шире тела:**
`Partial<FinancePayment> & { fileIds?: string[] }` (`services/financeService.ts:45-50`), и мок
применяет что дали — `{ ...current, ...data }` без белого списка и без валидации
(`mocks/finance.ts:522`). Прежний контракт называл `notes` единственным редактируемым полем; это
неверно, см. «Чего в домене нет», и находка БАГ-02. **Требование к серверу:** белый список полей —
его обязанность, а не свойство клиента; `status`, `amount` и `paymentNumber` правке снаружи не
подлежат.

`fileIds` — **replace-семантика**, и разбирает её сервер, а не клиент (§15 соглашений): клиент шлёт
полный актуальный массив, «сервер» оставляет документы, чей `fileId` пришёл, создаёт заготовки на
новые и молча забывает остальные (`mocks/finance.ts:491-519`). Метаданные новых документов берутся
из реестра аплоадов, а не выдумываются на месте (резолвер прокидывается ветвью —
`mocks/index.ts:1405`, причина — `mocks/finance.ts:463-468`); неизвестный `fileId` **не ошибка** —
заготовка создаётся с именем, равным самому id, и нулевым размером (`:505-508`).

Заголовков нет ни одного: `apiPatch` вызван двумя аргументами (`services/financeService.ts:49`),
источник заголовков у PATCH — только `options?.headers` (`services/api.ts:194-209`). Ни `If-Match`,
ни `Idempotency-Key` (`grep -c "Idempotency\|If-Match" frontend_vue/src/services/financeService.ts`
→ 0) — §11 соглашений, графа о транзакционности.

Ответ — `FinancePayment` целиком, с пересчитанными `documents` и новым `updatedAt`
(`mocks/finance.ts:513-519`, `:522`). `updatedAt` ставит сервер и только он (§14 соглашений); на
схеме это колонки `created_at`/`updated_at` со `server_default=sa.text("now()")`
(`b2619dfeb90f_phase_10_finance.py:44-45`), заведённые `TimestampMixin`
(`finance/shared/models.py:11`).

**Смена статуса на `overdue` рождает уведомление, и защищено это переходом, а не моментом:** оба
выхода функции проходят через один `commit`, который и проверяет `!wasOverdue`
(`mocks/finance.ts:483-488`). Правка заметки или документов без смены статуса события не рождает
(`:522` через тот же `commit`). Правило — §10 соглашений.

Ошибки: `PAYMENT_NOT_FOUND` — 404 (`mocks/finance.ts:474-475`). `VALIDATION_ERROR` домен не
бросает ни разу — тела он не проверяет вовсе (БАГ-02).

Атомарность: внутри PATCH полная — обе ветви заканчиваются одним присваиванием через `commit`
(`mocks/finance.ts:484-488`). Атомарности **между** аплоадом и Save нет никакой.

Реализация: `services/financeService.ts:45-50` — `patchPayment` · мок `mocks/index.ts:1399-1408` →
`mocks/finance.ts:469-524` — `mockPatchPayment`

Бэкенд: **не реализован** — роута нет; на схеме под правку есть `finance_payments.notes`
(`finance/shared/models.py:48`) и таблица `payment_documents` (`:58-90`).

---

### GET /api/finance/archive

Архив документов — страница `DocumentArchivePage`, чтение без мутаций. Мутаций у архива нет ни
одной: ни `POST`, ни `PATCH`, ни `DELETE` в домене не существует.

Save-режим — **чтение**. Триггеров пять, и пятый даёт лишний запрос: `onMounted`
(`views/admin/finance/DocumentArchivePage.vue:119`), поиск с дебаунсом 300 мс и сбросом на первую
страницу (`:77-83`), смена фильтров (`:85-88`), смена страницы или её размера (`:91-93`) — и сеттер
размера страницы, который **сам** зовёт `load()` после `reset()` (`:110-117`). То же у двух других
списков — «Правила домена», п. 18.

**Скачивание идёт мимо API:** `<a :href="doc.url" download>` (`:203-207`), то есть `url` обязан
быть ссылкой, которую браузер откроет сам. Ни один эндпоинт домена файл не отдаёт.

Запрос — **пять** query-строк, все всегда (`services/financeService.ts:52-63`, числа через
`String()` — `:61-62`):

```
?search=&type=all&relatedEntityType=all&page=1&pageSize=25
```

- `search` — подстрочный поиск по **двум** полям: `name` и `relatedEntityNumber`
  (`mocks/finance.ts:447-452`);
- `type` — `invoice | facture | waybill | cmr | other | all` (`types/finance.ts:64`, перечень для
  фильтра — третья копия того же списка, `views/admin/finance/DocumentArchivePage.vue:24-31`);
- `relatedEntityType` — `order | payment | supplier | client | all`
  (`types/finance.ts:74`, фильтр `views/admin/finance/DocumentArchivePage.vue:34-40`);
- `page`, `pageSize` — строками. Эта ветка мока разбирает параметры **своим** кодом: пять
  `params?.<ключ> ?? …` прямо в ветке (`mocks/index.ts:836-843`), и общего `parseFinanceListParams`
  в этих строках нет (`grep -c parseFinanceListParams` по диапазону → 0, против 2 у веток списков,
  `mocks/index.ts:823-829`). Дефолты те же, но экземпляров разбора два.

Заголовков нет (`services/financeService.ts:63`) — БАГ-01.

Ответ — `PaginatedResponse<FinanceDocumentArchiveItem>`. Элемент — **двенадцать** полей
(`types/finance.ts:66-79`):

```ts
{ id; name; type: ArchiveDocumentType; fileId; url; size; mime;
  relatedEntityType: 'order' | 'payment' | 'supplier' | 'client'; relatedEntityId;
  relatedEntityNumber; uploadedAt; uploadedBy: string }
```

Мок отдаёт `clone(filtered)` (`mocks/finance.ts:460`, реализация `:34-36`), то есть мутация ответа
стор не трогает — «Правила домена», п. 8.

Три поля требуют отдельного слова, и все три — расхождения, а не свойства:

- `uploadedBy` — **отображаемое имя**, а не ссылка на пользователя (сиды `mocks/finance.ts:265`,
  схема `finance/shared/models.py:125` — `String(255)`); тот же класс, что автор записи аудита (§9
  соглашений). Кодом оно не проставляется ни разу: документ, добавленный через PATCH, автора не
  получает вовсе (`mocks/finance.ts:500-511`);
- `relatedEntityType`/`relatedEntityId`/`relatedEntityNumber` — **связь без ссылки**:
  `related_entity_id` это свободная строка без FK (`finance/shared/models.py:119-121`), и во фронте
  три поля обязательны, а на схеме все три `nullable=True` (`:116-124`);
- `url` существует в **трёх** несовпадающих формах: `#uploaded/<fileId>` у сидов
  (`mocks/finance.ts:122`), data-URL у настоящего аплоада мока (`mocks/index.ts:1672`) и
  `String(500)` на схеме (`finance/shared/models.py:115`). Под моками ссылка `download` мертва.
  Прежний контракт обещал `/uploads/<fileId>/preview` — обещание снято, см. «Чего в домене нет».

**Сортировки нет.** `mockGetArchive` не сортирует вовсе (`mocks/finance.ts:432-461`, `grep -c sort`
по диапазону → 0), порядок
ответа = порядок объявления сида. Прежний контракт обещал `uploadedAt DESC` — снято; БАГ-05.

Ошибки: **ни одной** (`mocks/finance.ts:432-461`).

**Кто наполняет архив — не сказано ни в коде, ни здесь.** Восемь записей заданы руками
(`mocks/finance.ts:257-370`), файл сам называет это отложенным решением (`:251-256`), путей записи
нет ни одного, и две записи повторяют документы платежа `pay-out-1` по имени, но с другими `fileId`
(`:314-341` против `:155-158`) — БАГ-04. Графа «Производные значения» и решение владельца.

Реализация: `services/financeService.ts:52-63` — `getArchive` · мок `mocks/index.ts:836-843` →
`mocks/finance.ts:432-461` — `mockGetArchive`

Бэкенд: **не реализован** — таблица `document_archive_items` есть
(`finance/shared/models.py:93-128`), роута нет.

---

## Обязанности сервера

Девять граф аудита — то, чего во фронтенде не видно и что линзы «код ↔ контракт» не поймают по
построению: вызова нет, сравнивать не с чем. Сквозные правила — в
[`00-conventions.md`](00-conventions.md); ниже только наблюдения по коду домена. Ответ «нигде» —
не решение контракта, а строка в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
«finance — аудит 2026-09-04» (`00-решения-владельца.md:320-332`).

**1. Значения по умолчанию и их владелец.** **Ни одно значение домена не берётся из настроек
арендатора.** Валюта — литерал `'EUR'` у всех пяти сидов (`mocks/finance.ts:145`, `:169`, `:190`,
`:211`, `:232`) и `server_default="EUR"` на схеме (`finance/shared/models.py:32-34`, миграция
`b2619dfeb90f_phase_10_finance.py:32`), тогда как валютой владеют настройки —
`constants.defaultCurrency` (`mocks/settings.ts:52-57`, тип `types/settings.ts:14-19`); общий класс
дублирования справочников — §14 соглашений. Статус нового платежа — `'pending'` на схеме
(`finance/shared/models.py:28-30`), во фронте создания нет вовсе. Размер страницы `25` —
**шесть экземпляров**: три `usePagination(25)`
(`views/admin/finance/IncomingPaymentsPage.vue:49`, `views/admin/finance/OutgoingPaymentsPage.vue:42`,
`views/admin/finance/DocumentArchivePage.vue:51`) плюс дефолт общего разборщика
(`mocks/index.ts:289`), дефолт ветки архива (`mocks/index.ts:841`) и дефолт `paginate`
(`mocks/finance.ts:104`, `:401`, `:460`); седьмой — дефолт композабла
(`composables/usePagination.ts:3`). Перечень размеров — `25/50/100` константой в каждой из трёх
страниц (`views/admin/finance/IncomingPaymentsPage.vue:94-98`,
`views/admin/finance/OutgoingPaymentsPage.vue:93-97`,
`views/admin/finance/DocumentArchivePage.vue:104-108`), то есть **на одно значение короче**, чем у
заказов и склада (`views/admin/orders/OrdersListPage.vue:61-66` — `10/25/50/100`). Дебаунс поиска
`300` — три экземпляра (`views/admin/finance/IncomingPaymentsPage.vue:76`,
`views/admin/finance/OutgoingPaymentsPage.vue:69`, `views/admin/finance/DocumentArchivePage.vue:82`).
Карта статуса в пилюлю — тоже три, и они **не совпадают**: без `cancelled`
(`views/admin/finance/IncomingPaymentsPage.vue:88-92`) и с ним
(`views/admin/finance/OutgoingPaymentsPage.vue:82-87`,
`views/admin/finance/OutgoingPaymentCardPage.vue:33-38`), при том что у статусов заказа единый
источник заведён отдельным модулем. Кому принадлежат валюта платежа, размер страницы и перечень
размеров — **нигде**, решение владельца (`00-решения-владельца.md:325`).

**2. События и уведомления.** **Домен рождает одно событие из семи и вызывает его дважды.**
Эмиттер — `notifyPaymentOverdue` (`mocks/notifications.ts:684`), точки вызова две: сборка реестра
входящих на каждую новую просроченную строку (`mocks/finance.ts:65-81`) и PATCH платежа, когда
статус перешёл в `overdue` и до этого им не был (`mocks/finance.ts:483-486`). Второй случай —
честный переход; оба выхода функции проходят через один `commit`, чтобы правило не пришлось
записать дважды (`:484-488`). Первый — переход только по памяти процесса
(`Set overdueNotified`, `mocks/finance.ts:63`), потому что будильника у системы нет и просрочка
становится известной в момент чтения (`:55-62`; то же со стороны уведомлений —
`mocks/notifications.ts:676-678`). Доказано спекой чужого домена: «тот же счёт, прочитанный второй
раз, ничего не пишет» (`mocks/notification-triggers.spec.ts:257-266`) и «счёт поставщика без заказа
ведёт к поставщику, а не в пустую карточку» (`:348-360`). **Ничего не рождают:** правка заметки и
документов без смены статуса (`mocks/finance.ts:522` через тот же `commit`), чтение списка платежей,
чтение архива. Закрытие счёта клиента деньгами уведомляет **домен заказов**, а не финансы
(`mocks/orders.ts:4001`). Обязан ли сервер сообщать о закрытии счёта клиента и о смене статуса
исходящего помимо просрочки, и чем он после перезапуска отличит первое обнаружение просрочки от
повтора — **нигде** (`00-решения-владельца.md:326`; тот же вопрос поперёк доменов — §10
соглашений).

**3. Запись в аудит-лог.** **Нигде.**
`grep -c "auditLog" frontend_vue/src/services/mocks/finance.ts` → 0: ни правка заметки, ни
добавление документа, ни его удаление следа не оставляют. Среди девяти журналов ленты (§9
соглашений) финансов нет — они лежат на сущностях, и домен там не значится
(`mocks/index.ts:392-393`). На схеме автора нет ни у одной из трёх таблиц: у `finance_payments`
только `created_at`/`updated_at` (`b2619dfeb90f_phase_10_finance.py:44-45`), у `payment_documents`
и `document_archive_items` нет и того — только явный `uploaded_at`
(`finance/shared/models.py:84-86`, `:126-127`). Единственный след человека — `uploadedBy` строкой
отображаемого имени (`finance/shared/models.py:125`), и код не проставляет её ни разу
(`grep -c "uploadedBy" frontend_vue/src/services/mocks/index.ts` → 0), то есть документ,
добавленный через PATCH, автора не получает вовсе (`mocks/finance.ts:500-511`). Здесь домен хуже
соседей: у них журнал хотя бы засеян, здесь его нет и в засеянном виде. Что обязано попадать в
журнал платежа и чем должен быть автор записи — **нигде** (`00-решения-владельца.md:327`).

**4. Кастомные поля.** **У домена их нет ни в каком виде.**
`grep -c "fieldValues\|FieldDefinition\|fieldId" frontend_vue/src/types/finance.ts frontend_vue/src/services/mocks/finance.ts frontend_vue/src/services/financeService.ts`
→ 0 у всех трёх; на схеме ни одной ссылки на определения полей
(`finance/shared/models.py:11-128`). Библиотека `/api/config/fields` к финансам не привязана
ничем: единственное попадание слова «finance» в моке конфигурации — почтовый адрес роли
`Accounting` (`mocks/config.ts:183`). Ближайшее к «произвольным данным» — свободные `description` и
`notes` (`types/finance.ts:28`, `:32`; на схеме оба `Text` — `finance/shared/models.py:41`, `:48`) и
прикреплённые документы. Домен обходится фиксированной схемой; общая дыра жизненного цикла
определений — §8 соглашений, и финансов она не касается.

**5. Настройки, которых мок не отслеживает.** Четыре, и все четыре — **нигде**
(`00-решения-владельца.md:328`):

- **валюта.** Своя у каждой записи (`types/finance.ts:21`, `finance/shared/models.py:32-34`),
  справочник арендатора на неё не влияет, курса нет нигде (§14 соглашений) — сложить две суммы в
  разных валютах домен не умеет и итогов по списку не показывает;
- **справочник статусов платежа.** Его нет ни в настройках, ни на схеме: `String(20)` без
  ограничения (`finance/shared/models.py:28-30`) — против пятнадцати записей `st-<имя>` у статусов
  заказа (`mocks/settings.ts:208-346`). Отсюда и недостижимый `cancelled` (БАГ-09);
- **срок жизни записи и документа.** Ни `POST`, ни `DELETE` в домене нет ни на одном из пяти путей:
  платёж нельзя создать и нельзя удалить, архив только читается. При этом
  `payment_documents.file_id` — FK с `ondelete="RESTRICT"` (`finance/shared/models.py:75-79`,
  миграция `b2619dfeb90f_phase_10_finance.py:53`), то есть загруженный файл держит документ, а
  документ держит платёж — уборки не существует ни на одном уровне (§16 соглашений);
- **перечень типов документа архива.** Пять значений константой во фронте
  (`types/finance.ts:64`) и `String(50)` без ограничения на схеме
  (`finance/shared/models.py:105-107`); справочника под них нет, а перечень фильтра — третья копия
  того же списка (`views/admin/finance/DocumentArchivePage.vue:24-31`).

**6. Мультиарендность.** **Во фронте не выражена никак, на схеме выражена трижды.** Фронт:
`grep -ci "tenant" frontend_vue/src/types/finance.ts frontend_vue/src/services/mocks/finance.ts frontend_vue/src/services/financeService.ts`
→ 0 у всех трёх; ни `tenantId` в форме, ни query-параметра, ни **одного** заголовка — все пять
вызовов идут без третьего аргумента (`services/financeService.ts:20`, `:33`, `:42`, `:49`, `:63`), а
`options?.headers` — единственный их источник (`services/api.ts:144-158`, `:194-209`). Хранилища
мока — два массива на процесс (`mocks/finance.ts:138`, `:257`) плюс плоский стор заказов под реестр
(`mocks/orders.ts:4712`). Схема: `tenant_id` — FK на `tenants.id`, `ondelete="CASCADE"`,
`nullable=False, index=True` у всех трёх таблиц (`finance/shared/models.py:16-21`, `:63-68`,
`:98-103`; миграция `b2619dfeb90f_phase_10_finance.py:27`, `:51`, `:64`). Правило «арендатор
берётся из токена и только из него» — §4 соглашений; здесь токена не шлют вовсе, и это находка
БАГ-01, а не разрешённое поведение. Отдельно: реестр входящих сшит из чужого домена, у которого
модуля на бэкенде нет вовсе, — фильтровать придётся оба источника (§4 соглашений, первое
следствие). Как сервер узнаёт арендатора при пустых заголовках — **нигде**
(`00-решения-владельца.md:329`).

**7. Права — в какой функции проверяются.** **Ни в одной.** На сервере проверять негде — роутов у
модуля ноль. В моке проверок нет:
`grep -c "requireRight\|maySeeCost\|permission" frontend_vue/src/services/mocks/finance.ts` → 0,
`mockGetPayment` ищет запись по id во всём сторе (`mocks/finance.ts:426-427`). Во фронте гейт **только
тарифный и только на роутах**: `financeIncoming` (`router/index.ts:326`), `financeOutgoing`
(`:332`, `:338`), `financeDocumentArchive` (`:344`), проверка — в общем гварде (`:447-450`).
Мастер-флаг `adminFinance` объявлен во фронте (`config/featureFlags.ts:78`, `types/features.ts:67`)
и в каталоге фич бэкенда, но **не читается ничем** (БАГ-07); подвкладки и ссылка сайдбара флагов не
смотрят вовсе (`views/admin/finance/FinanceSubNav.vue:9-28`,
`components/admin/AdminSidebar.vue:123`) — ведут на роут, который гвард отклонит (БАГ-08). В матрице
прав (§6 соглашений) финансов нет ни строки: роль `Accounting` в перечне есть
(`mocks/config.ts:186`, пользователи `:183`), а элементы матрицы строятся только из секций и полей
карточки поставщика (`:189-190`). Три права заказа на финансовые экраны не распространяются
(`grep -rn "useOrderPermissions\|seeCost" frontend_vue/src/views/admin/finance/` — пусто), при том
что комментарий настроек прямо говорит «Accounting видит себестоимость, потому что сводит её»
(`mocks/settings.ts:59-60`). Нужно ли право на правку счёта поставщика, на прикрепление и удаление
документа и кто вправе читать архив целиком — **нигде** (`00-решения-владельца.md:330`).

**8. Транзакционность и идемпотентность.** **Ключа нет, версии нет, а Save всё же рвётся на два
запроса.** `Idempotency-Key` не шлётся ни на одном из пяти путей
(`grep -c "Idempotency" frontend_vue/src/services/financeService.ts` → 0) при существующем
генераторе (`services/api.ts:239-245`); правило «необратимый `POST` требует ключ» домена не
касается — `POST` у него нет (§11 соглашений). Версии у записи нет ни во фронте, ни на схеме:
`{ ...current, ...data }` без сравнения (`mocks/finance.ts:522`) — last-write-wins. Внутри PATCH
атомарность полная (`mocks/finance.ts:484-488`), а **сохранение карточки атомарно не целиком**:
аплоад уходит отдельным `POST /api/uploads` до нажатия Save (`services/uploadsService.ts:13-17`), и
файл остаётся на сервере, даже если Save не нажали никогда; чистильщика в домене нет, а схема
удалить такой файл запретит, как только документ на него сошлётся
(`finance/shared/models.py:75-79`). Что обязано быть атомарным между аплоадом и Save и кто удаляет
неприкреплённый файл — **нигде** (`00-решения-владельца.md:331`; тот же класс — §15 и §16
соглашений).

**9. Производные значения.** **Четырнадцать на строке реестра, три в конверте, одно в списке
платежей — и последнее сервер, по схеме, обязан хранить.** Реестр: все четырнадцать полей
`Receivable` считаются при чтении и не хранятся нигде (`types/finance.ts:99-123`, сборка
`mocks/orders.ts:4710-4752`), причём считает их домен, **один раз на три представления** —
`invoiceBalances` (`domain/receivable.ts:133-189`), которым пользуются реестр, сводка счетов
клиента и модалка регистрации оплаты; копий было две, и они уже расходились на деньгах, названных
корректировкой (`domain/receivable.ts:101-117`). Отдельно: `dueDate` — дата счёта плюс отсрочка
клиента, снятая на заказ (`domain/receivable.ts:24-28`, вызов `mocks/orders.ts:4721`); `status` — из
суммы, поступлений и срока, и никогда не хранится, потому что хранимый устаревает молча
(`domain/receivable.ts:30-64`); `paidAt` — платёж, на котором накопленная сумма **впервые** покрыла
счёт, а не последний по нему (`domain/receivable.ts:165-176`); `outstandingAmount` — со знаком.
Конверт: `total` — длина отфильтрованного, `totalPages` — `Math.ceil`, `items` — срез
(`mocks/finance.ts:43-50`). Список платежей: `documentCount` = `documents.length`
(`mocks/finance.ts:416`) — и **на схеме это хранимая колонка** `document_count` со
`server_default="0"` (`finance/shared/models.py:49-51`, миграция
`b2619dfeb90f_phase_10_finance.py:43`), то есть одно число у фронта производное, а у сервера —
состояние, которое можно рассинхронизировать (§17 соглашений). Обратное тоже есть и осознанно: у
исходящего платежа `status` и `paidAt` **хранятся**, потому что поступлений по счёту поставщика
система не знает (`mocks/finance.ts:129-137`). Доказано двумя спеками — `domain/receivable.spec.ts`
(включая край нулевой отсрочки, `:75-107`) и `mocks/finance-receivables.spec.ts` (в том числе
«переплата сходится с доменом до копейки», `:175`, и «в исходном коде финансового мока не осталось
ни одного броска монеты», `:460`). Остаётся ли `document_count` колонкой и кто наполняет архив —
**нигде** (`00-решения-владельца.md:332`).

---

## Правила домена

Правила, живущие только в этом домене: в моке, в доменном слое или в типах. Машина перечислит
эндпоинты и без человека — эти правила не перечислит никто.

1. **Форма записи во фронте и схема таблицы расходятся в шести местах, и сервер обязан выбрать
   сторону.** (а) `document_type` на схеме против `type` во фронте
   (`finance/shared/models.py:105-107` против `types/finance.ts:69`); (б) `due_date nullable=True`
   (`finance/shared/models.py:42-44`) против обязательного `dueDate: string`
   (`types/finance.ts:29`); (в) `counterparty_id` и `counterparty_vat_code` — `nullable=True`
   (`finance/shared/models.py:35`, `:37`) против обязательных строк (`types/finance.ts:22`, `:24`);
   (г) три поля связи архива `nullable=True` (`finance/shared/models.py:116-124`) против
   обязательных, причём во фронте это союз из четырёх значений, а на схеме `String(50)`
   (`types/finance.ts:74-76`); (д) `document_count` — колонка на схеме
   (`finance/shared/models.py:49-51`), производное во фронте (`mocks/finance.ts:416`); (е) `id` —
   UUID у всех трёх таблиц (`b2619dfeb90f_phase_10_finance.py:26`, `:50`, `:63`) против строк
   `pay-out-1`, `pdoc-1`, `arch-1`, `file-fin-1` во фронте (`mocks/finance.ts:140`, `:119`, `:259`,
   `:121`) — общий класс §19 соглашений. Плюс поле, которого фронт не знает вовсе: `tenant_id` на
   каждой из трёх таблиц.
2. **Статус входящего вычисляется, статус исходящего хранится — и это не непоследовательность, а
   следствие того, что известно системе.** У счёта заказа есть поступления, из которых статус
   выводится (`domain/receivable.ts:30-64`); у счёта поставщика их нет, потому что заказа
   поставщику в системе не существует (`mocks/finance.ts:129-137`). Отсюда и разные наборы
   значений: `ReceivableStatus` — три (`types/finance.ts:90`), `PaymentStatus` — четыре (`:3`).
3. **«Срок прошёл» — это конец дня срока, а не его момент.** Иначе счёт с нулевой отсрочкой
   становился просроченным через миллисекунды после выдачи, показывая выдуманный сигнал под
   настоящим документом (`domain/receivable.ts:41-48`, реализация `:59-62`). Проверено —
   `domain/receivable.spec.ts:75-107`.
4. **Частичная оплата отдельного статуса не получает.** Две суммы показываются как есть; третье
   слово под них значило бы держать то же самое в двух видах (`domain/receivable.ts:36-39`,
   проверено `domain/receivable.spec.ts:46-51`).
5. **Отозванный корректировкой счёт стоит ровно ноль и в реестр не попадает вовсе.** `amount = 0` у
   отозванного, чтобы два документа сошлись в ничто и лишний цент округления не показался долгом
   (`domain/receivable.ts:149-158`), и строка пропускается при сборке (`mocks/orders.ts:4719`).
   Поэтому у `ReceivableStatus` нет значения `cancelled` (`types/finance.ts:87-89`). Проверено —
   `mocks/finance-receivables.spec.ts:232`.
6. **Корректировка своей строки не заводит, а деньги, названные ею, идут в строку исправленного
   документа.** Один переход по цепочке — корректировки корректировки система не выдаёт
   (`domain/receivable.ts:137-143`, пропуск `:147`); причина — баланс, у которого сумма считает
   корректировки, а поступления нет, разошёлся бы сам с собой (`:113-116`).
7. **`outstandingAmount` не зажимается нулём: переплата отдаётся отрицательным числом.** Решение
   владельца записано в коде с датой (`mocks/orders.ts:4735-4741`), тип его повторяет
   (`types/finance.ts:114-119`). Сервер, приводящий это число к нулю, сделает переплату невидимой
   ровно там, где деньги сводят.
8. **Ответ мока — всегда копия, и это записано причиной, а не привычкой.** Карточка платежа удаляет
   документ из массива до Save, и на прямой ссылке удаление доезжало бы до «сервера» само
   (`mocks/finance.ts:421-425`, реализация `:34-36`, применение `:429`, `:460`, `:487`). Для сервера
   разницы нет — правило записано, чтобы его не приняли за требование (§18 соглашений).
9. **Значение `cancelled` объявлено и недостижимо.** Оно есть в типе (`types/finance.ts:3`), в
   фильтре (`views/admin/finance/OutgoingPaymentsPage.vue:39`) и в двух картах пилюль
   (`:86`, `views/admin/finance/OutgoingPaymentCardPage.vue:37`), но
   `grep -c "status: 'cancelled'" frontend_vue/src/services/mocks/finance.ts` → 0, и ни одна
   операция его не ставит: единственный путь смены статуса — PATCH без валидации
   (`mocks/finance.ts:522`). Кто и по какому событию отменяет платёж — решение владельца; находка —
   БАГ-09.
10. **Даты сида относительные, а не календарные.** `dateStr(daysOffset)`
    (`mocks/finance.ts:28-32`), потому что фиксированная дата протухает сама: через месяц
    «ожидается» стояло бы рядом со сроком в прошлом (`:132-136`). Отсюда же самосогласованность
    сида руками: у оплаченных есть дата оплаты, у просроченных срок в прошлом и оплаты нет. Это
    свойство демо-стенда, серверу его повторять не нужно (§18 соглашений).
11. **Случайных чисел в домене нет ни одного, и это проверяется спекой по исходному коду.** Раньше
    сумма, статус и дата оплаты бросались `Math.random()`, но подписывались номером настоящего
    заказа (`mocks/finance.ts:20-23`); теперь спека читает файл и требует отсутствия броска монеты
    (`mocks/finance-receivables.spec.ts:460`).
12. **Список платежей и архив не сортируются вовсе, а реестр сортируется по ближайшему сроку.**
    `filtered.sort` есть ровно один на весь файл мока (`mocks/finance.ts:102`), и причина названа:
    реестр читают, чтобы узнать, чем заняться сегодня (`:101`). Два других списка отдают порядок
    объявления сида — БАГ-05. Это ровно то расхождение соседей, которое §13 соглашений требует
    называть прямо: три списка одного проекта без параметра сортировки ведут себя по-разному.
13. **Реестр входящих читается фильтрованно, а уведомления рождает по всем строкам.**
    `receivables()` проходит весь результат `orderReceivables()` до применения фильтров и
    пагинации (`mocks/finance.ts:65-81`, вызов `:86`, фильтры `:88-99`). Для сервера это значит:
    страница ответа и объём побочного действия — разные величины. Находка — БАГ-10.
14. **Архив — вторая копия документов, а не представление над ними.** Восемь записей заданы руками
    (`mocks/finance.ts:257-370`), файл сам называет это отложенным решением (`:251-256`), и две из
    них повторяют документы платежа `pay-out-1` по имени, но с другими `fileId` (`:314-341` против
    `:155-158`). Правка документов платежа архив не трогает ничем — БАГ-04.
15. **Реквизиты контрагента — снимок в записи, а не ссылка**, и это правило верное (§17
    соглашений). Нарушено здесь не заморозкой, а тем, что замороженный id не существовал никогда:
    пятёрка поставщиков объявлена константой внутри финансового мока (`mocks/finance.ts:109-115` —
    `sup-001…sup-005`), а в сторе поставщиков id другие (`mocks/suppliers.ts:9`, `:29`, `:49`,
    `:69`, `:89`, `:109` — `'1'…'6'`), и уведомление о просрочке ведёт в пустую карточку. Находка —
    БАГ-03.
16. **`fileIds` — replace-семантика, и её разбирает сервер, а не клиент.** Клиент шлёт полный
    актуальный массив (`views/admin/finance/OutgoingPaymentCardPage.vue:79`), «сервер» оставляет
    пришедшие, создаёт заготовки на новые и молча забывает остальные (`mocks/finance.ts:491-519`);
    метаданные тянутся из реестра аплоадов, чтобы имя и размер не выдумывались на месте (`:463-468`,
    прокидывание `mocks/index.ts:1405`). Общая модель двух фаз — §16 соглашений.
17. **Ошибка Save откатывает карточку чтением, а не сохранённым снимком.** `catch { load() }`
    (`views/admin/finance/OutgoingPaymentCardPage.vue:83-85`), то есть несохранённые правки при
    неудаче теряются целиком. Поведение уже признано разрушительным у карточки заказа и названо
    прямо в §15 соглашений.
18. **Смена размера страницы отправляет два запроса.** Сеттер `pageSizeStr` сам зовёт `load()`
    после `reset()` (`views/admin/finance/IncomingPaymentsPage.vue:100-107`,
    `views/admin/finance/OutgoingPaymentsPage.vue:99-106`,
    `views/admin/finance/DocumentArchivePage.vue:110-117`), и следом срабатывает
    `watch([page, pageSize])` (`views/admin/finance/IncomingPaymentsPage.vue:84-86`,
    `views/admin/finance/OutgoingPaymentsPage.vue:78-80`,
    `views/admin/finance/DocumentArchivePage.vue:91-93`). Для контракта это значит: сервер обязан
    переживать дубль чтения, и счётчик обращений домена вдвое выше ожидаемого.
19. **Ошибка любого из пяти эндпоинтов сводится к булеву флагу.** Все четыре страницы держат
    `error = ref(false)` и печатают общий текст (`views/admin/finance/IncomingPaymentsPage.vue:35`,
    `:149-152`; `views/admin/finance/OutgoingPaymentsPage.vue:28`;
    `views/admin/finance/DocumentArchivePage.vue:49`;
    `views/admin/finance/OutgoingPaymentCardPage.vue:25`), то есть единственный код домена до
    человека не доходит — БАГ-06. Различить «нет такого платежа» и «сеть упала» нельзя.
20. **Скачивание документа идёт мимо API.** `<a :href="doc.url" download>` в архиве
    (`views/admin/finance/DocumentArchivePage.vue:203-207`), `FileItem` на карточке платежа
    (`views/admin/finance/OutgoingPaymentCardPage.vue:8`), то есть `url` обязан быть ссылкой,
    которую браузер откроет сам. Срока жизни такой ссылки не задаёт ни код, ни прежний контракт.
21. **Порядок веток разбора значим: `/payments` разбирается раньше `/payments/:id`.**
    `mocks/index.ts:827` перед `:831`, и та же пара в PATCH — единственная ветка домена
    (`:1399`). У сервера с одним маршрутом `/{payment_id}` порядок обратный по построению — §18
    соглашений.

---

## Чего в домене нет

Ничего не вычеркнуто молча: строка на каждое описание, снятое из прежнего
[`03-api-contract.md`](../03-api-contract.md) (раздел `# Admin — Finance`, строки 1881–2179), с
доказательством отсутствия или несоответствия.

| было описано | чем доказано отсутствие / несоответствие |
|---|---|
| `DOCUMENT_NOT_FOUND` — 404 в каталоге кодов домена (`03-api-contract.md:1935`) | в коде его нет ни в одной строке: `grep -rn "DOCUMENT_NOT_FOUND" .` по репозиторию (без `.git`) даёт попадания только в документах сверки — сам прежний контракт (`03-api-contract.md:1935`), аудит и этот файл; ни `backend/app`, ни `frontend_vue/src` не содержат его нигде. Удаление документа отдельного пути не имеет вовсе — оно выражается отсутствием `fileId` в присланном массиве (правило домена 16) |
| `VALIDATION_ERROR` — 422 в каталоге кодов домена (`03-api-contract.md:1936`) | домен не бросает его ни разу: тела PATCH не проверяет никто, `{ ...current, ...data }` применяет что дали (`mocks/finance.ts:522`). Код существует в ядре бэкенда (§2 соглашений) и на путях финансов не поднят ничем — БАГ-02 |
| «Сортировка фиксированная — `dueDate ASC`» у списка платежей (`03-api-contract.md:2024`) | `mockGetPayments` не сортирует вовсе (`mocks/finance.ts:374-419`, `grep -c sort` по диапазону → 0); порядок = порядок объявления сида, и он не по сроку — БАГ-05 |
| «Сортировка по `uploadedAt DESC`» у архива (`03-api-contract.md:2140`) | `mockGetArchive` не сортирует вовсе (`mocks/finance.ts:432-461`), а единственный `sort` на весь файл стоит у реестра (`mocks/finance.ts:102`, `grep -c sort` по файлу → 1) — БАГ-05 |
| `url` документа — `/uploads/<fileId>/preview` (`03-api-contract.md:2058`, `:2126`) | в коде такого формата нет ни одного: `#uploaded/<fileId>` у сидов (`mocks/finance.ts:122`), data-URL у настоящего аплоада мока (`mocks/index.ts:1672`), `String(500)` на схеме (`finance/shared/models.py:115`). Настоящий сервер аплоада строит `…/static/uploads/<uuid><ext>` — три несовпадающие формы одного поля, и что здесь источник истины, решает владелец (§16 соглашений) |
| «Ссылка на скачивание — `doc.url` (временный/preview URL)» (`03-api-contract.md:2140`) | «временный» не выражено ничем: срока жизни нет ни в коде, ни на схеме, ни в самом прежнем тексте, а `download` работает мимо API (правило домена 20). Обещание снято как необоснованное |
| «Архив — просмотр документов, привязанных ко всем сущностям системы» (`03-api-contract.md:2140`) | привязки нет ни к чему: `related_entity_id` — свободная строка без FK (`finance/shared/models.py:119-121`), архив наполняется руками восемью записями (`mocks/finance.ts:257-370`), и файл сам называет это отложенным решением (`:251-256`) — правило домена 14 |
| «`notes` — единственное текстовое редактируемое поле» (`03-api-contract.md:2094`) | подпись клиента принимает **любое** поле записи (`services/financeService.ts:45-50`), и мок применяет что дали (`mocks/finance.ts:522`): чужая спека меняет этим путём `status` (`mocks/notification-triggers.spec.ts:349`, `:353`). Требование к серверу переформулировано в разделе PATCH как белый список — БАГ-02 |
| «`fileIds`: сервер находит **draft**-файлы по новым ID, привязывает их, переносит из draft в постоянное» (`03-api-contract.md:2095`) | черновиков не существует: единственный писатель аплоада передаёт `is_draft=False`, `expires_at` пуст, уборщика нет — снято в §16 соглашений. Привязка при этом реальна и описана в разделе PATCH; несуществует именно фаза «draft → постоянное» |
| `id` документа в примере ответа — `pdoc-1` (`03-api-contract.md:2055`) | форма не одна, а две: `pdoc-N` у сидов (`mocks/finance.ts:119`) и сам `fileId` у документов, созданных PATCH-ем (`mocks/finance.ts:503-504` — `id: fid` рядом с `fileId: fid`), при том что на схеме это UUID, отдельный от `file_id` (`finance/shared/models.py:58-79`) — БАГ-11. Пример снят: `id` — непрозрачная строка, которую выдаёт сервер (§19 соглашений) |
| `orderNumber: null` и `orderId: null` как «всегда» у исходящего (`03-api-contract.md:2070`) | **подтверждено** кодом (все пять сидов) и оставлено в разделе `GET /api/finance/payments/:id`; здесь строка стоит потому, что прежний текст называл это свойством эндпоинта, а на схеме оба поля просто `nullable=True` (`finance/shared/models.py:38-39`) — ограничение держит не схема, а модель домена |
| «Пагинация обязательна» у списка платежей (`03-api-contract.md:2024`) | верно по факту (клиент всегда шлёт `page`/`pageSize`), но правило это не доменное — перенесено в §13 соглашений |
| общие правила: конверт ответа, коды ядра, пагинация, Save UX clean-slate, файлы и `fileIds`, замороженные снимки, `Idempotency-Key`, форма `id`, даты и валюта | перенесены в [`00-conventions.md`](00-conventions.md) (§1, §2, §13, §15, §16, §17, §11, §19, §14) — правило двух и более доменов в доменном файле не дублируется |
| таблица `Feature Flags — Finance` с четырьмя флагами (`03-api-contract.md:2162-2169`) | флаги существуют (`config/featureFlags.ts:78-81`) и **работают только три из четырёх**: `financeIncoming`, `financeOutgoing`, `financeDocumentArchive` стоят на роутах (`router/index.ts:326`, `:332`, `:338`, `:344`), а мастер-флаг `adminFinance` не читается ничем — БАГ-07. Механизм целиком описан в §7 соглашений; эндпоинта чтения флагов не существует |

Кроме этого в домене **нет и никогда не было описано**: создания и удаления платежа
(`POST`/`DELETE` не существует ни на одном из пяти путей), записи в архив, эндпоинта под входящий
платёж-запись (его не может быть по модели), фильтра по направлению у `/payments`, эндпоинта
сортировки или экспорта. Пять путей — это весь домен.

---

## Пробелы аудита — состояние

Каждый пробел [аудита](../../plans/api/audit/finance.md) закрыт выше или помечен «осталось».
«Осталось» здесь значит одно: ответа нет ни в коде фронта, ни на сервере, и назначать его контракт
не вправе — строка стоит в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) (`:320-332`).

| пробел аудита | где закрыт |
|---|---|
| прежний текст обещает `dueDate ASC` и `uploadedAt DESC`, код не сортирует | разделы `GET /api/finance/payments` и `GET /api/finance/archive`; «Чего в домене нет»; правило домена 12 (БАГ-05) |
| `url` документа обещан как `/uploads/<fileId>/preview` | раздел `GET /api/finance/archive`, абзац о трёх формах `url`; «Чего в домене нет» |
| `DOCUMENT_NOT_FOUND` в каталоге кодов, которого нет в коде | «Каталог кодов ошибок домена»; «Чего в домене нет» |
| `VALIDATION_ERROR` не бросается ни разу | там же; раздел `PATCH /api/finance/payments/:id`, требование белого списка (БАГ-02) |
| «`notes` — единственное редактируемое поле» неверно | раздел `PATCH /api/finance/payments/:id`, абзац о подписи шире тела (БАГ-02) |
| «архив привязан ко всем сущностям системы» — привязки нет | «Чего в домене нет»; правило домена 14 |
| `uploadedBy` — отображаемое имя, а не пользователь | раздел `GET /api/finance/archive`, три поля; графа 3 |
| `counterpartyId` не разрешается ни во что | раздел `GET /api/finance/payments/:id`; правило домена 15 (БАГ-03) |
| реквизиты контрагента — снимок, а не ссылка | там же; правило домена 15 и §17 соглашений |
| чтение реестра рождает уведомление, причём по всем строкам | раздел `GET /api/finance/receivables`, абзац «Это чтение пишет»; графа 2; правило домена 13 (БАГ-10) |
| реестр отдаёт строки всех заказов без фильтра по статусу заказа | раздел `GET /api/finance/receivables`, абзац об отборе строк |
| `id` документа платежа имеет два вида | «Чего в домене нет»; §19 соглашений (БАГ-11) |
| правка документов платежа архив не трогает | правило домена 14 (БАГ-04) |
| статус `cancelled` объявлен и недостижим | правило домена 9; графа 5 (БАГ-09) |
| порядок веток разбора значим | правило домена 21 |
| смена размера страницы даёт два запроса | правило домена 18; раздел `GET /api/finance/archive` |
| ошибка сводится к булеву флагу | «Каталог кодов ошибок домена»; правило домена 19 (БАГ-06) |
| под моками ошибка домена — голый `Error`, а не `ApiRequestError` | «Каталог кодов ошибок домена», третий факт |
| правила домена 1–20 аудита | раздел «Правила домена», пункты 1–21 (порядок иной: наблюдение о модели вынесено выше эндпоинтов, а расхождение с соседним аудитом закрыто ниже) |
| девять граф «Обязанностей сервера» | раздел «Обязанности сервера», графы 1–9 |
| аудит соседа (notifications) завышает эталон заголовков: приписывает `settingsService.ts` пару `Authorization` + `X-CSRF-Token` | закрыто наблюдением: `authHeaders()` возвращает **один** ключ (`services/settingsService.ts:18-22`), а `X-CSRF-Token` во всём `frontend_vue/src` встречается однажды и не в сервисе (`composables/useAuth.ts:106`) — как и записано в §5 соглашений. Для финансов вывод тот же: заголовков нет вовсе (БАГ-01). Правка чужого аудита в разрешённые этой задачей файлы не входит |
| аудит утверждает, что `PAYMENT_NOT_FOUND` подстрокой ни в кого не входит | утверждение снято инверсией К3: ядровый `NOT_FOUND` — его подстрока (`backend/app/core/exceptions.py:13-20`). Закрыто первым фактом «Каталога кодов ошибок домена»; находка — БАГ-12 |
| аудит считает у `FinancePayment` двадцать полей, а у строки списка одиннадцать | закрыто пересчётом: 19 и 12 соответственно (`sed -n '15,35p' src/types/finance.ts \| grep -cE '^  [a-zA-Z]+\??: '` → 19, то же для `types/finance.ts:37-50` → 12). В разделах стоят проверенные числа |
| **решено 2026-09-07** · валюта платежа берётся из настроек в момент создания и дальше хранится у самой записи (П19); размер страницы и перечень размеров принадлежат коду, сервер их не назначает (П20). Литерал `'EUR'` у пяти сидов (`mocks/finance.ts:145,169,190,211,232`) и шесть копий `25` — работа по коду | графа 1; [§13](00-conventions.md), [§14](00-conventions.md) |
| **осталось** · обязан ли сервер сообщать о закрытии счёта клиента и о смене статуса исходящего помимо просрочки, и чем он после перезапуска отличит первое обнаружение просрочки от повтора | графа 2; решение владельца (`:326`) |
| **решено 2026-09-08 (П36)** · **любое** изменение любого свойства платежа, включая доменные операции, а не только правку поля; состав записи — кто, когда, какое поле, было → стало. Автор — пара «`user_id` плюс замороженный снимок имени», схема это уже умеет. Журнала у домена сегодня нет вовсе (`grep -c "auditLog" mocks/finance.ts` → 0), то есть это работа с нуля | графа 3; [§9](00-conventions.md) |
| **осталось** · кто владеет валютой при отсутствии курсов, справочником статусов платежа, сроком жизни записи и документа, перечнем типов документа архива | графа 5, все четыре подпункта; решение владельца (`:328`) |
| **осталось** · как сервер узнаёт арендатора, если ни один из пяти вызовов не шлёт заголовков | графа 6; решение владельца (`:329`), находка БАГ-01 |
| **решено 2026-09-07 (П2, П7)** · права на правку счёта поставщика, на прикрепление и удаление документа и на чтение архива — обычные элементы CRUD-матрицы, назначаемые по надобности роли; отказ `403` | графа 7; [§6.2](00-conventions.md), [§6.6](00-conventions.md) (`:330`) |
| **осталось** · что обязано быть атомарным между аплоадом и Save и кто удаляет неприкреплённый файл | графа 8; решение владельца (`:331`) |
| **осталось** · остаётся ли `document_count` хранимой колонкой и кто наполняет архив документов | графа 9; решение владельца (`:332`) |
| **осталось** · кто и по какому событию создаёт счёт поставщика, меняет его статус и удаляет запись — `POST` и `DELETE` в домене нет ни на одном пути | раздел `GET /api/finance/payments`, последний абзац; графа 5, подпункт о сроке жизни записи (`:328`) |
| **осталось** · какая из трёх форм `url` документа верна — `#uploaded/<fileId>`, data-URL или ссылка на статику, и что считать источником истины по метаданным файла | раздел `GET /api/finance/archive`; вопрос сквозной, строка стоит у домена uploads (`00-решения-владельца.md:251`) |
