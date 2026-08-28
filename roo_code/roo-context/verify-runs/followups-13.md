# Пункт 13 — финансовый модуль соединён с оплатами заказа (находка 5-A)

Ветка `auto/followups-2026-08-28`, автономный прогон, 2026-08-28.

## 1. Воспроизведение

Пункт утверждает две вещи: связи между финансовым модулем и заказами нет, а платежи
финансов генерируются случайно, но подписываются номерами настоящих заказов.

```
$ grep -n "^import" src/services/mocks/finance.ts
1:import type {
10:import { notifyPaymentOverdue } from './notifications'

$ grep -c "orders" src/services/mocks/finance.ts
0
$ grep -ci "finance" src/services/mocks/orders.ts
0

$ grep -n "Math.random()\|pick(\[\|rnd(" src/services/mocks/finance.ts
13:function rnd(min: number, max: number): number {
14:  return Math.round((Math.random() * (max - min) + min) * 100) / 100
18:  return arr[Math.floor(Math.random() * arr.length)]!
79:    status: pick(['pending', 'completed', 'overdue'] as PaymentStatus[]),
80:    amount: rnd(500, 15000),
90:    paidAt: Math.random() > 0.5 ? dateStr(-idx * 5) : null,
91:    documents: generateDocuments(Math.floor(Math.random() * 3) + 1),
92:    notes: Math.random() > 0.7 ? `Client confirmed payment via bank transfer.` : null,
   ... (ещё 12 вхождений)
```

Плюс `orderId: ORDERS[idx]!.id` и `description: 'Payment for order ORD-…'` в том же объекте:
случайная сумма и случайный статус под номером настоящего заказа. Воспроизведено.

## 2. Что сделано

### Модель

Реестр «Входящие» перестал быть хранилищем и стал **представлением над счетами заказов**.

- `src/domain/receivable.ts` (новый) — единственное место, где живут два правила:
  `receivableDueDate(issuedAt, paymentTermsDays)` (срок = дата счёта + отсрочка клиента,
  пункт 9) и `receivableStatus({ amount, paidAmount, dueDate })` (оплат ≥ суммы →
  `completed`; меньше и срок прошёл → `overdue`; иначе `pending`). Статус нигде не хранится.
- `src/services/mocks/orders.ts` → `orderReceivables()` — строит строки из `Order.invoices`.
  Лежит в модуле заказов по той же причине, что и `orderAuditSources`: «какой документ
  клиент ещё держит» уже решается здесь (`isWithdrawn`), и второй экземпляр этого правила в
  финансовом моке разошёлся бы с первым.
  - корректировка своей строки не заводит — она поправляет сумму исходного счёта
    (`outstandingGrossOf`);
  - счёт, отозванный корректировкой (`withdrawsOriginal`), из реестра исчезает вовсе;
  - `paidAmount` — только платежи с `invoiceId` этого счёта; аванс без ссылки на документ
    ничей долг не закрывает;
  - `paidAt` — платёж, на котором накопленная сумма впервые покрыла счёт (не последний:
    после закрытия по счёту может пройти возврат).
- `outstandingNetOf` обобщён в `outstandingAmountOf(order, invoice, field)`; брутто-вариант
  нужен потому, что деньги приходят с НДС, и сравнение «нетто против брутто» объявляло бы
  оплаченным счёт, по которому не хватает ровно налога.

### Мок

- `src/services/mocks/finance.ts` переписан: `Math.random()` в коде не осталось ни одного.
  - входящие — `mockGetReceivables()` поверх `orderReceivables()`, своего хранилища нет;
  - исходящие — пять заданных вручную счетов поставщиков с относительными датами
    (фиксированный календарь протухает сам), статус самосогласован с `paidAt`;
  - архив — восемь фиксированных документов, ссылающихся на существующие сущности
    (ORD-2026-100, ORD-2026-009, pay-out-1, sup-002, CL-001), а не на выдуманные номера;
  - `mockGetPayment` теперь отдаёт **копию**, а не ссылку на запись хранилища (питфолл #13):
    карточка удаляет документ из массива до Save, и на прямой ссылке это доезжало до
    «сервера» само;
  - `mockPatchPayment` получил `resolveUpload` — метаданные загруженного файла приходят из
    реестра аплоадов `mocks/index.ts` (так же, как для файлов заказа), а не выдумываются.
- Показательный заказ ORD-100: аванс на 1500 теперь платится **по авансовому счёту**
  (`invoiceId`), иначе реестр показывал бы проформу неоплаченной рядом с пришедшими 1500.

### Клиент

- `GET /api/finance/receivables` — новый роут в моке и `getReceivables()` в
  `financeService.ts`. `GET /api/finance/payments` стал строго исходящим: параметра
  `direction` больше нет.
- `FinancePaymentFilters` (search/status/counterpartyId/dateFrom/dateTo/direction) заменён на
  `FinanceListFilters { search, status }` — остальные поля не использовала ни одна страница.
- `IncomingPaymentsPage.vue` переписана: № счёта, клиент, заказ, дата счёта, срок, сумма,
  оплачено, статус. «Оплачено X из Y» — это две колонки, отдельного статуса под частичную
  оплату нет.
- `IncomingPaymentCardPage.vue` **удалена** вместе с роутом `admin-finance-incoming-payment`:
  у строки реестра нет своего хранилища, а редактируемые заметки и документы на ней —
  ровно та выдумка, от которой лечится пункт. Подробности счёта и платежей уже есть в
  карточке заказа, и строка ведёт туда; вторая реализация того же экрана — это Л5.

### Документы

`roo_code/roo-context/03-api-contract.md` — раздел Finance переписан: добавлена «Модель: у
одной суммы один владелец», описан `GET /api/finance/receivables`, `GET /api/finance/payments`
сужен до исходящих, убраны все ссылки на удалённую страницу.

## 3. Приёмка

```
$ npm run verify
exit=0
 Test Files  31 passed (31)
      Tests  637 passed (637)
```
(typecheck · lint · dupes · format:check · test:unit)

```
$ npm run test:audit
 Test Files  22 passed (22)
      Tests  97 passed (97)

$ npx vite build
✓ built in 8.14s   exit=0
```

`vite build` прогнан отдельно не для галочки: питфолл #67 — многооператорный `@click` в
шаблоне проходит typecheck и lint и ломается только на компиляторе шаблонов.

## 4. Линзы

**Л1 (реактивность и жизненный цикл)** — `grep -n "watch(\|computed(\|onMounted(" src/views/admin/finance/IncomingPaymentsPage.vue`:
три `watch` (search с debounce 300 мс, статус, page/pageSize), у первых двух `pagination.reset()`
перед `load()` — #57 закрыт. Фильтры лежат в `.filters-bar` **вне** `GlassPanel`, поэтому
`initialized`-сторож (#20) здесь не нужен: скелет панели поле поиска не прячет. `useHead`
получает функции, а не значения (#54). Чисто.

**Л2 (i18n)** — счётчики ключей по локалям в `src/i18n/admin/finance.ts`:
```
ru 79 en 79 lt 79
ru-en diff [] []
ru-lt diff [] []
```
Все ключи новой страницы существуют: `financeList.th_invoice`, `th_issued_at`, `th_paid`,
`open_order` добавлены в три локали; `st.all` (`i18n/admin/suppliers.ts:126`),
`page.financeIncoming` (`i18n/admin/layout.ts:56`) — на месте. Русского в моках нет: seed
исходящих и архива на английском. Чисто.

**Л3 (контракт и HTTP)** — вызовы страниц: `getReceivables` → `GET /api/finance/receivables`
(роут добавлен в `mocks/index.ts:813`), `getPayments` → `GET /api/finance/payments`,
`getPayment`/`patchPayment` → `/api/finance/payments/:id`, `getArchive` →
`/api/finance/archive`. Все четыре имеют мок. Методы по смыслу: чтения — GET, правка одной
записи дельтой — PATCH. Contract write-back выполнен (раздел выше). Чисто.

**Л4 (мок = правда)** — `Math.random` в коде `finance.ts` — ноль (проверяется тестом, см. Л9).
Строки реестра больше не выдумываются; замер:
```
rows 3
ORD-2026-009/INV-1 regular overdue   amount 1075.69 paid 0    due 2026-03-29
ORD-2026-100/INV-1 regular pending   amount 2129.57 paid 2000 due 2026-09-10
ORD-2026-100/INV-3 advance completed amount 1500    paid 1500 due 2026-09-10
```
Все три состояния и частичная оплата представлены, и каждое число взято со счёта заказа.
`ORD-2026-100/INV-2` — корректировка, в реестре её нет, а сумму INV-1 она уже поправила.
Три строки на сотню заказов — это правда, а не бедность: счета в сиде выставлены только там,
где сценарий их выставлял, и пустое состояние страницы обещает ровно это.

**Л5 (один источник правила)** — `grep -rn "dueDate\|paymentTermsDays" src/` : срок считается
только в `domain/receivable.ts`, вызывается только из `orderReceivables()`. Статус счёта —
только там же. `outstandingNetOf`/`outstandingGrossOf` сведены к одному
`outstandingAmountOf`. Вторая реализация карточки счёта не заведена — удалена (см. выше).
`npm run dupes` — внутри `npm run verify`, зелёный.

**Л6 (UI и CSS)** — имена иконок проверены грепом по `SvgIcon.vue`: `profit-coin` (:42),
`external-link` (:113), `alert-triangle` (:146). `.name-link` определён в scoped-стиле самой
страницы, а не взят из чужого файла (#63). `.status-pill` глобален
(`admin-core.scss:14`). Пустое состояние закрыто `!loading && …length === 0` (#30) и лежит
внутри `GlassPanel` (#52). Подсказка на кнопке — `v-tooltip`, не `:title` (#28).
Кликабельная строка убрана: навигация — настоящий `router-link`, а не `@click` по `<tr>`
(#62, #31 — теперь нечему конфликтовать).

**Л7 (права, флаги, роутинг)** — `grep -rn "admin-finance-incoming-payment\|IncomingPaymentCardPage" src/ tests/`
→ пусто, висячих ссылок на удалённый роут нет. `admin-order-card` существует
(`router/index.ts:160`). Флаг `financeIncoming` не трогался, в трёх файлах остался как был.

**Л8 (сохранение и потеря данных)** — реестр read-only, терять нечего. У карточки
исходящего платежа clean-slate сохранён; более того, починена настоящая утечка: до правки
`mockGetPayment` отдавал ссылку на запись хранилища, и удаление документа в карточке
доезжало до «сервера» без нажатия Save.

**Л9 (тесты, которые ничего не утверждают)** — восемь инверсий, каждая прогнана:

| Сломано | Спека | Результат |
|---|---|---|
| A. `receivableStatus` не возвращает `overdue` | `domain/receivable.spec.ts` | 2 failed |
| B. `receivableDueDate` игнорирует отсрочку | обе | 3 failed |
| C. отозванный счёт остаётся в реестре | `finance-receivables.spec.ts` | 1 failed |
| D. корректировка не поправляет сумму | то же | 1 failed |
| E. считаются все платежи заказа, а не привязанные | то же | 1 failed |
| F. уведомление о просрочке без памяти | `notification-triggers.spec.ts` | 1 failed |
| G. `Math.random()` вернулся в код мока | `finance-receivables.spec.ts` | 1 failed |
| H. исходящий подписан номером заказа | то же | 1 failed |

После каждой инверсии файл восстанавливался из копии, финальный прогон — 35 passed.

Отдельно: первая версия теста «исходящие дважды подряд отдают то же самое» инверсию G
**прошла** — это питфолл #68 в чистом виде. `MOCK_PAYMENTS` собирается один раз при загрузке
модуля, поэтому два чтения совпадают и со случайными числами: утверждение устраивало
бездействие. Заменено на чтение исходника мока с вырезанными комментариями — единственная
форма, которая этот класс ловит.

`grep -rn "await page.waitForLoadState" tests/` — пусто, как и требует линза.

**Л10 (целостность проекта)** — `npx vite build` exit=0 (компилятор шаблонов доволен),
дублей имён роутов нет, `i18n/admin/index.ts` не менялся.

**Вне гейта.** `npm run deadcode`: 56 неиспользуемых экспортов (было 59) и 24 типа (было 22).
Рост на два объяснён: `PaymentDirection`, `PaymentStatus` и `ArchiveDocumentType` больше
никем не импортируются, потому что их импортировал случайный генератор, которого не стало;
типами полей `FinancePayment` и `FinanceDocumentArchiveItem` они остались. `FinancePaymentFilters`
из списка ушёл — удалён вместе с полями, которых никто не читал.

**E2E, уровень 1.** Правка в одной области плюс мок заказов, который читают спеки заказов:
`ready-exits.spec.ts`, `admin/orders`, `admin/notifications`, `admin/layout.spec.ts`.

```
$ npx playwright test tests/e2e/ready-exits.spec.ts tests/e2e/admin/orders \
    tests/e2e/admin/notifications tests/e2e/admin/layout.spec.ts \
    --workers=3 --reporter=line > e2e3.txt 2>&1; echo "exit=$?"
  171 passed (4.0m)
exit=0
```
Вывод сохранён в файл целиком и прочитан грепом по `failed|flaky|passed \(|exit=`, а не по
последней строке: `N failed` печатается ВЫШЕ `N passed`, и обрезка хвоста меняет смысл.

Первый прогон этого же набора был прочитан, а затем **признан недействительным**: сразу после
него из `Receivable` убрано поле `invoiceKind`, а dev-сервер отдаёт живые файлы. Прогон
повторён на финальном коде — цифры выше от него.

`npm run audit` — 0 уязвимостей.

## 5. Рассмотрено и отклонено

- **`invoiceKind` в строке реестра** — поле было написано и задокументировано, но его никто не
  читал: в таблице колонки под него нет. Убрано — поверхность, которую ничто не читает, не
  нужна.
- **Двойной `load()` при смене размера страницы** — сеттер `pageSizeStr` вызывает `load()`, и
  вотчер `[page, pageSize]` вызывает его же. Поведение скопировано с `OutgoingPaymentsPage` и
  существовало до правки; починка в одной из двух списковых страниц развела бы их между собой
  (Л6 — расхождение между списковыми страницами хуже одного лишнего чтения мока). Не тронуто.
- **Счета для сгенерированных заказов** — сотня заказов, из них «доставленных» и «оплаченных»
  десятки, а счёт выставлен только там, где его выставлял сценарий. Дописать генератору
  выставление счетов заманчиво (реестр стал бы полнее трёх строк), но `mockCreateInvoice`
  **замораживает** покрытые строки, то есть правка изменила бы редактируемость половины
  демо-заказов. Это отдельная задача, не пункт 13.
- **Уведомление о просрочке для входящих** — переехало с «перехода хранимого статуса» на
  «первое вычисление факта», с памятью в `Set`. Ветка `notifyPaymentOverdue` со ссылкой на
  заказ иначе стала бы мёртвой: исходящие платежи заказу не принадлежат по построению.
