# Пункт 10 — сводка выставленных счетов в карточке клиента

План: [`review-followups.md` § 10](../../plans/general/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

Пункт утверждает: «заказы клиента подтягиваются реальные — это сделано; счетов в карточке
нет». Проверено грепом ДО правки.

```
$ grep -rn "invoice" src/views/admin/clients/ -i
(пусто)

$ ls src/views/admin/clients/
ClientCardPage.vue
ClientCreatePage.vue
ClientsListPage.vue
```

Ни одного упоминания счёта во всём каталоге карточки клиента. Заказы при этом есть —
`useClientCard.loadOrders()` ходит в `/api/orders?clientId=…` постранично и складывает всю
историю, то есть первая половина требования ТЗ (CRM §54) сделана, а вторая — нет.

Выборки счетов по клиенту не существовало и на уровне сервиса:

```
$ grep -n "apiGet\|apiPost\|apiPatch\|apiDelete" src/services/clientsService.ts
9:  return apiGet('/api/clients', …)
13:  return apiGet(`/api/clients/${id}`)
17:  return apiPost('/api/clients', data)
21:  return apiPatch(`/api/clients/${id}`, delta)
25:  return apiDelete(`/api/clients/${id}`)
39:  return apiGet<StockAuditEntry[]>(`/api/clients/${clientId}/audit`)
43:  return apiDelete<void>(`/api/clients/${clientId}/audit/${entryId}`)
50:  return apiPost(`/api/clients/${clientId}/interactions`, entry)
54:  return apiDelete<void>(`/api/clients/${clientId}/interactions/${entryIndex}`)
```

Счёт при этом в системе есть — он живёт внутри заказа (`Invoice` в `src/types/order.ts`,
`GET /api/orders/:id/invoices`), и правило «отозван ли документ» тоже есть, на стороне
заказов:

```
$ grep -rn "withdrawsOriginal" src/ --include=*.ts --include=*.vue | grep -v spec.ts
src/views/admin/orders/OrderCardPage.vue:845
src/views/admin/orders/OrderCardPage.vue:852
src/services/mocks/orders.ts:3924  ← isWithdrawn(order, invoiceId)
src/services/mocks/orders.ts:4081/4083/4130/4156
src/composables/useOrderCard.ts:948
src/types/order.ts:376
```

Пункт воспроизводится полностью: данные есть, выборки и таблицы нет.

---

## 2. Что сделано

### 2.1 Выборку считает та сторона, что держит заказы

`GET /api/clients/:id/invoices` → `mockGetClientInvoices(clientId)` в
`src/services/mocks/orders.ts` (там же, где STORE заказов и `isWithdrawn`).

Почему не «сходить за заказами карточки и спросить счета у каждого»: это N+1 запросов и,
что важнее, **вторая копия правила отзыва** на стороне карточки. Правило `isWithdrawn`
уже существует у заказов; карточка получает строки, которые про отзыв уже знают, и своей
реализации не заводит. Проверка Л5 ниже показывает, что новой копии не появилось.

Форма строки — `ClientInvoice` в `src/types/client.ts`:

- `amountGross` — что было написано на документе в день выписки;
- `amountGrossCurrent` — что на нём сейчас, после всех корректировок, которые его называют.
  У отозванного документа **ровно ноль**, а не «зеркальная сумма, сложенная обратно»: лишний
  цент округления вылез бы в остатке клиента как деньги, которых никто не должен;
- `withdrawn` — тот же `isWithdrawn`. Строку не убирает (бухгалтер о ней спросит), но в
  «выставлено» такой документ не входит — ровно то, о чём предупреждает сам пункт 10;
- корректировка своей строки не получает: это не документ, на который клиенту выставили, а
  поправка суммы на том, который у него уже есть;
- `paidAmount` — платежи, названные этим счётом (`payment.invoiceId`); `outstanding` —
  `amountGrossCurrent − paidAmount`, минус означает переплату. Платёж без ссылки на счёт
  сюда не попадает намеренно: это деньги заказа, а не деньги документа;
- `currency` — валюта заказа, подписью, а не множителем.

### 2.2 Итог считается по каждой валюте отдельно

`invoiceTotals` в `src/composables/useClientCard.ts` группирует по `currency`. Курса в
системе нет нигде (это записанное решение, а не пробел), поэтому один общий итог по счетам
в евро и долларах был бы не суммой, а склейкой двух разных величин. Отозванные документы в
«выставлено» не входят сами собой: у них `amountGrossCurrent === 0`.

### 2.3 Таблица

`ClientCardPage.vue` — панель «Выставленные счета» между историей заказов и заметками:
номер (перечёркнут и с пилюлей «Отозван», если документ отозван), вид документа, дата,
ссылка на заказ (`router-link`, имя роута `admin-order-card`), сумма (плюс исходная,
перечёркнутая, если корректировка её сдвинула), оплачено, остаток; в `tfoot` — строка итога
на каждую валюту. Пустое состояние внутри панели, скелет на время загрузки.

Файлы: `src/types/client.ts`, `src/services/mocks/orders.ts`, `src/services/mocks/index.ts`,
`src/services/clientsService.ts`, `src/composables/useClientCard.ts`,
`src/views/admin/clients/ClientCardPage.vue`, `src/styles/admin/client_card.css`,
`src/i18n/admin/clients.ts`, `roo_code/plans/orders/orders-backend-contract.md` (write-back),
спеки — `src/services/mocks/orders.spec.ts`, `src/composables/useClientCard.spec.ts`.

---

## 3. Машинная приёмка

```
$ npm run typecheck
> vue-tsc --noEmit
exit=0

$ npm run lint
> eslint src/ tests/ *.ts --max-warnings=0 --cache …
exit=0

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!
exit=0

$ npm run test:unit
 Test Files  28 passed (28)
      Tests  610 passed (610)
exit=0

$ npm run verify            # typecheck · lint · dupes · format:check · test:unit
exit=0
 Test Files  28 passed (28)
      Tests  610 passed (610)

$ npm run test:audit        # тронут src/services/mocks/orders.ts
 Test Files  22 passed (22)
      Tests  97 passed (97)
exit=0

$ npm run dupes
Total: 685 clones, 9.27 % — порог 10 % в .jscpd.json
exit=0
```

E2E, уровень 1 (правка в одной области):

```
$ npx playwright test tests/e2e/admin/clients/clients.spec.ts --reporter=line --workers=3
75 passed (1.1m)     exit=0

$ npx playwright test tests/e2e/smoke.spec.ts -g "client-card" --reporter=line
1 passed (4.9s)      exit=0
```

Второй прогон — не формальность: smoke собирает `console.error` и ответы ≥ 400. Мок без
зарегистрированного роута печатает `[mock] GET … not found` в консоль, то есть этот тест
и есть машинная проверка того, что новый эндпоинт кто-то обслуживает (питфолл #40).

---

## 4. Линзы

**Л1 — реактивность.** `invoices` — `ref`, `invoiceTotals` — `computed` от него; ничего не
кэшируется в обычной переменной.

```
$ grep -n "structuredClone\|toRaw(\|useHead(\|watch(" src/composables/useClientCard.ts \
    src/views/admin/clients/ClientCardPage.vue
ClientCardPage.vue:61: useHead({          ← геттеры, было до правки
useClientCard.ts:127,256,259,266,272,275   ← interactionHistory, было до правки
```

Ни одно вхождение правкой не тронуто, новых нет. Вывод: чисто.

**Л2 — i18n.** Ключи добавлены во все три локали, счётчики совпадают:

```
$ python3 … re.findall(r"^      ([a-z_0-9]+):", body)   # по блокам ru/en/lt
ru 116 116
en 116 116
lt 116 116

$ grep -n "clients" src/i18n/admin/index.ts
11:import { adminClients } from './clients'
```

Сырых точечных ключей в шаблоне нет — весь текст идёт через `t()`. Единственный запасной
вариант без перевода, `INVOICE_KIND_LABEL[invoice.kind] || invoice.kind`, отдаёт не ключ, а
слово `regular`/`advance`, и не срабатывает вовсе: корректировки строк не получают, а
других видов у документа нет. Вывод: чисто.

**Л3 — контракт и HTTP.** Метод GET на чтение. Все вызовы `clientsService` сверены с
роутами диспетчера поштучно:

```
$ grep -n "api\\/clients" src/services/mocks/index.ts
517: /^\/api\/clients\/([^/]+)$/          ← GET карточка
524: /^\/api\/clients\/([^/]+)\/audit$/
531: /^\/api\/clients\/([^/]+)\/invoices$/   ← новый
960: …/interactions$/ (POST)
1242: …$ (PATCH)   1511: …$ (DELETE)   1517: …/audit/:id (DELETE)   1526: …/interactions/:i (DELETE)
```

Пересечения с `^/api/clients/([^/]+)$` нет — у нового пути лишний сегмент. Write-back:
эндпоинт описан в `roo_code/plans/orders/orders-backend-contract.md` § 4.6 (в живом
`03-api-contract.md` раздела клиентов нет вовсе — `grep -n "api/clients"` по нему пуст,
а счета относятся к модулю заказов, где их контракт и лежит). Вывод: чисто.

**Л4 — мок = правда.** Возвращаются свежие объекты, ссылки на STORE наружу не уходит —
проверено не чтением, а мутацией результата:

```ts
own[0]!.number = 'MUTATED'
expect(mockGetClientInvoices(order.clientId).some((r) => r.number === 'MUTATED')).toBe(false)
```
→ 1 passed (временная спека, удалена после прогона).

Сид даёт непустую панель и попадает в неочевидную ветку — у ORD-100 счёт поправлен
корректировкой, а не отозван:

```
rows for ORD-100:
 { number: "ORD-2026-100/INV-3", kind: "advance",  amountGross: 1500,    current: 1500,    paid: 0,    outstanding: 1500 }
 { number: "ORD-2026-100/INV-1", kind: "regular",  amountGross: 2179.45, current: 2129.57, paid: 2000, outstanding: 129.57 }
```

Вывод: чисто.

**Л5 — один источник правила.** Новой копии правила отзыва не появилось:

```
$ grep -rn "withdrawsOriginal" src/ --include=*.ts --include=*.vue | grep -v spec.ts
```

вернул те же семь мест, что и до правки (OrderCardPage ×2, useOrderCard ×1, orders.ts ×4,
types ×1). Ни `useClientCard.ts`, ни `ClientCardPage.vue`, ни `clientsService.ts` в выдаче
нет — карточка клиента читает готовый признак `withdrawn`.

Рассмотрено и отклонено: зеркало правила на клиенте (`useOrderCard.withdrawnIds`,
`OrderCardPage.isWithdrawnInvoice`) существовало до этой задачи, лежит вне её области и
заведено осознанно — в коде прямо написано «Same rule as the server's `isWithdrawn`».
Новой находкой не считается, в bugs-file не уходит.

**Л6 — UI и CSS.** Каждый класс шаблона доступен на этой странице:

```
invoice-number, is-withdrawn, invoice-kind-pill, invoice-withdrawn-pill,
invoice-amount-was, invoice-totals-row, order-total, order-link → src/styles/admin/client_card.css
audit-log-table, audit-log-ts, audit-panel-wide                 → components/_audit-log.css
table-responsive                                                → src/styles/admin/main.css (глобальный)
audit-empty                                                     → <style> самой ClientCardPage.vue
```

Имена состояний в BEM-стиле (`is-withdrawn`), а не generic (питфолл #12). Пустое состояние
внутри панели (#52) и не мигает на загрузке: при `loading` GlassPanel прячет `panel-body`
целиком (#30). Строка счёта не кликабельна — карточки у счёта нет, поэтому и `cursor:
pointer` на ней нет (#28); переход даёт `router-link` в колонке заказа (#32, #62).
Подсказка у пилюли «Отозван» — `v-tooltip`, не `:title` (#28). Многооператорных inline-
обработчиков не добавлено (#67), и это доказано сборкой:

```
$ npx vite build
✓ built in 8.25s     exit=0
```

**Л7 — права, флаги, роутинг.** Новых флагов и роутов нет. Имя роута ссылки существует:

```
$ grep -n "admin-order-card" src/router/index.ts
160:        name: 'admin-order-card',
```

**Л8 — сохранение и потеря данных.** Панель только читает: ни одного поля формы, ни
`load()`, разрушающего несохранённое. `loadInvoices()` пишет только в свой `ref` и при сбое
кладёт пустой список, а не роняет карточку (на это есть тест). Вывод: чисто.

**Л9 — тесты, которые ничего не утверждают.** Добавлено 4 спеки на уровне мока и 3 на
уровне композабла. Инверсия — по одной на утверждение, каждая ломает своё:

| Что сломано | Где | Результат |
|---|---|---|
| `const withdrawn = false && isWithdrawn(…)` | mocks/orders.ts | `1 failed` — `expected false to be true` |
| `paidAmount: 0` вместо `paid` | mocks/orders.ts | `1 failed` — `expected +0 to be 100` |
| итог считает `amountGross` вместо `amountGrossCurrent` | useClientCard.ts | `2 failed` — `issued: 350` вместо `100` |
| группировка по константе `'ALL'` вместо валюты | useClientCard.ts | `1 failed` — один итог вместо двух |

Все четыре правки откатаны (файлы восстановлены из копий, не `git restore`), после чего
`npm run verify` снова зелёный. Ни одно утверждение не устраивается бездействием (#68):
проверяются равенства конкретным числам, а не `<=`/`toBeTruthy`; строка отозванного счёта
проверяется отдельно от суммы, а количество строк — точным `toHaveLength(1)`, то есть
появление лишней строки на корректировку тест уронит.

**Л10 — целостность.** `vite build` exit=0, `i18n/admin/index.ts` импортирует `clients`,
дублей имён в роутере не добавлено, весь юнит-набор и e2e области зелёные.

---

## 5. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 10 — сводка счетов клиента
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK · format OK · unit OK
                   test:audit OK · e2e уровень 1 OK (75 + 1)
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 0       Починено: 0      Отклонено: 1 (зеркало isWithdrawn — вне области, заведено осознанно)
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Чего этот прогон **не** доказывает: полный набор e2e не гонялся — правка лежит в одной
области (карточка клиента), общий пол тестов не тронут, поэтому по правилу уровней из
`verify.md` платить шестнадцать минут не за что.
