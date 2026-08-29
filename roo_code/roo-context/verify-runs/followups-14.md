# Пункт 14 — возврат денег обязан называть счёт

**Дата:** 2026-08-28 · **Режим:** автономный · **Ветка:** `auto/followups-2026-08-27`

Раздел «## 14.» плана [`review-followups.md`](../../plans/general/review-followups.md).
Находка пришла из приёмки пункта 13: пункт 13 закрыл штатный путь регистрации ОПЛАТЫ,
возврат остался лазейкой того же класса.

## 1. Воспроизведение — до единой правки

Временная спека против живого мока (после снятия показаний удалена):

```
order.paidAmount = 3380
sum of invoice paidAmount = 3500
payments: [
  'ORD-100-PAY-1 1500 advance inv=ORD-100-INV-3',
  'ORD-100-PAY-2 2000 balance inv=ORD-100-INV-1',
  'ORD-100-PAY-3 -120 refund inv=null'
]
```

Разница ровно 120,00 — платёж `ORD-100-PAY-3` с `invoiceId = null`. Обе цифры честные:
карточка считает деньги заказа, реестр — деньги по документам.

Тот же проход по всем ста заказам демо-хранилища: **безымянный возврат в проекте ровно
один** — `ORD-100/ORD-100-PAY-3`. То есть речь не о классе данных, а о единственной
записи, которая нарушает правило на первом же открываемом экране.

Правила в коде не было:

```
$ grep -n "REFUND" src/services/mocks/orders.ts
3966:  if (purpose === 'refund' && data.amount > 0) throw new Error('REFUND_MUST_BE_NEGATIVE')
```

— знак проверялся, документ нет. Модалка отправляла `invoiceId: paymentInvoiceId.value || null`
без всякой оглядки на назначение.

## 2. Что сделано

| Файл | Правка |
|---|---|
| `src/services/mocks/orders.ts` | `mockAddOrderPayment`: `purpose === 'refund' && !invoiceId` → `REFUND_INVOICE_REQUIRED`. Проверка идёт по **выведенному** назначению, а не по переданному: `purpose` при отсутствии берётся из знака суммы, и `{ amount: -50 }` без `purpose` — тот же возврат |
| `src/services/mocks/orders.ts` (сид) | `pay(-120, 'refund', …)` → `pay(-120, 'refund', …, regular?.id)`. Возврат назвал накладную, на отгрузку по которой согласовали скидку |
| `src/services/mocks/orders.ts` (докстринг `mockGetClientInvoiceSummary`) | число безымянных денег было «13 заказов из 100» — замер даёт 11 (12 до правки). Цифра пересчитана, а не оставлена рядом с изменившимися данными |
| `src/services/orderLineEdits.ts` | `REFUND_INVOICE_REQUIRED` → `orders.error_refund_invoice_required` |
| `src/i18n/admin/orders.ts` | 4 ключа × 3 локали: `error_refund_invoice_required`, `payment_refund_needs_invoice`, `payment_invoice_pick`, дополненный `payment_refund_hint` |
| `src/views/admin/orders/OrderCardPage.vue` | у возврата в списке нет варианта «без счёта»; `refundNeedsInvoice` гасит «Сохранить» и `confirmPayment`; вотчер подсказывает документ, по которому деньги пришли; подсказка объясняет, что делать, когда счетов ещё нет вовсе |
| `roo_code/plans/orders/orders-backend-contract.md` | §1, §4.6 (правило + цена его отсутствия), §4.7 (число безымянных денег), §6 (код в каталоге) |

Тесты: `src/services/mocks/orders.spec.ts` (два новых утверждения о правиле, два — о
демо-данных), `src/services/mocks/notification-triggers.spec.ts` (возврат теперь называет
документ), `tests/e2e/admin/orders/orders.spec.ts` (путь через UI).

**Почему правило живёт в моке, а не в домене.** Мок — референсная реализация, с которой
пишется бэкенд (преамбула контракта), и все остальные отказы того же эндпоинта
(`PAYMENT_AMOUNT_REQUIRED`, `REFUND_MUST_BE_NEGATIVE`, `PAYMENT_INVOICE_NOT_FOUND`) стоят
там же. Второй экземпляр правила в домене был бы ровно тем, от чего лечит Л5.

## 3. Инверсия — Л9, обязательна

Три прогона. Тест, не покрасневший на сломанном коде, не тест.

**Инверсия 1 — снято правило мока:**

```
$ npx vitest run src/services/mocks/orders.spec.ts
× records a refund as a negative amount, and only against a document
× refuses a refund that names no document however the purpose was arrived at
Tests  2 failed | 196 passed (198)
```

**Инверсия 2 — сид вернули к `pay(-120, 'refund', …)` при живом правиле:** запись просто
не создаётся (`pay` глушит отказ), и краснеет `carries money in and money back` —
1 failed | 197 passed. То есть сид под правилом безымянным быть уже не может.

**Инверсия 3 — точное состояние ДО правки (снято правило И расcоединён сид):**

```
× holds no refund that names no document
× records a refund as a negative amount, and only against a document
× refuses a refund that names no document however the purpose was arrived at
× says the same figure in the card and in the incoming registry
Tests  4 failed | 194 passed (198)
```

и внутри четвёртого — та самая цифра из находки:

```
AssertionError: expected 3380 to be 3500
```

После восстановления правки — 198 passed.

## 4. Машинная приёмка

```
$ npm run verify        # typecheck · lint · dupes · format:check · test:unit
exit=0
Test Files  35 passed (35)
     Tests  725 passed (725)

$ npm run test:audit    # тронут src/services/mocks/orders.ts — семья order-audit-*
exit=0
Test Files  22 passed (22)
     Tests  97 passed (97)
```

Первый прогон `test:audit` был **красным**, и это оказалась настоящая находка:

```
FAIL order-audit-contract-conformance.spec.ts > every code the mock throws is in the catalogue
AssertionError: thrown by the reference implementation, absent from §6:
  expected [ 'REFUND_INVOICE_REQUIRED' ] to deeply equal []
```

Новый код отказа не был в §6 контракта. Машина поймала Л3 раньше глаз — контракт дописан.
`format:check` тоже покраснел один раз (`orders.spec.ts`) — питфолл #67 в действии,
`prettier --write` по этому файлу.

## 5. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л3 контракт** | `npm run test:audit` → `order-audit-contract-conformance.spec.ts` | сначала `[ 'REFUND_INVOICE_REQUIRED' ] absent from §6`, после правки контракта 97 passed | код отказа в каталоге §6, отображён в сообщение, ни с чем не пересекается по подстроке (тест `no code is a substring of another` зелёный) |
| **Л4 мок = правда** | замер по всем 100 заказам: безымянных возвратов было 1, стало 0; `order.paidAmount` = Σ по документам | обе цифры **3380** (см. поправку в §8: вниз пришёл реестр, 3500 → 3380, а карточка как называла 3380, так и называет) | проверяется не «панель непустая», а что две цифры сошлись; правило приложения держат и его собственные данные |
| **Л5 один источник** | `grep -rn "REFUND_INVOICE_REQUIRED\|purpose === 'refund'" src/` | правило в одном месте (`mockAddOrderPayment`); в UI не копия правила, а его следствие — выключенная кнопка | второй реализации нет; расчёт по-прежнему один (`invoiceBalances`), к нему не притрагивались |
| **Л2 i18n** | счётчики ключей по трём локалям в `src/i18n/admin/orders.ts` | ru/en/lt — по 4 новых ключа, симметрично; `@` в строках нет | сырых ключей в DOM нет: все три новых значения выводятся через `t()` |
| **Л9 тесты** | инверсии 1–3 выше | 2, 1 и 4 покрасневших теста соответственно | ни одно утверждение не устраивает бездействие: кнопка гаснет при введённой сумме и выбранном назначении, то есть её выключает ровно отсутствие счёта (питфолл #68) |
| **Л1 реактивность** | прочитан добавленный `watch(paymentPurpose, …)` | простой источник-ref, без `deep`, без `toRaw`, без `structuredClone` | #36/#37 неприменимы |
| **Л6 UI** | прочитан шаблон модалки | `field-hint` и `glass-input` — классы, которые страница уже использует; новых классов нет | новых CSS-имён не заведено |
| **Л7 права/роутинг** | правка внутри существующей модалки | ни флагов, ни роутов не добавлено | нечего проверять |
| **Л8 потеря данных** | `confirmPayment` при отказе не закрывает модалку | введённое остаётся на месте | данные не теряются |
| **Л10 целостность** | `npm run verify` | exit=0 | роутер, i18n-индекс, типы флагов не трогались |

## 6. E2E — уровень 1

Правка в одной области (заказы) плюс её мок. Круг «кто читает тот же мок» снят грепом
`admin/orders|admin/finance|admin/clients|receivable` по `tests/e2e`.

```
$ npx playwright test tests/e2e/admin/orders/orders.spec.ts \
    tests/e2e/admin/orders/order-offcuts.spec.ts \
    tests/e2e/admin/clients/clients.spec.ts --reporter=line > run.txt 2>&1; echo "exit=$?"
```

```
exit=0
  197 passed (3.5m)
```

Код возврата снят сразу после команды, без конвейера (`| tail` вернул бы код `tail`, а не
Playwright), и вывод прочитан целиком: строк `failed`, `flaky`, `skipped` в нём нет.

**Инверсия e2e — Л9, тест тронут, значит обязательна.** Снята стража
`refundNeedsInvoice` из `:disabled` и из `confirmPayment`:

```
$ npx playwright test tests/e2e/admin/orders/orders.spec.ts -g "a refund names its document"
exit=1
Error: expect(locator).toBeDisabled() failed
  Expected: disabled
  - unexpected value "enabled"
> 1761 |     await expect(page.locator('[data-test="payment-confirm"]')).toBeDisabled()
  1 failed
```

После восстановления — `exit=0`, `1 passed (11.7s)`. Утверждение бездействие не устраивает:
сумма введена, назначение выбрано, и единственное, что держит кнопку выключенной, —
отсутствующий счёт.

## 7. Что осталось за границей правки

- **Полный набор e2e не гонялся.** Правка не в общем полу (`helpers/`, фикстуры,
  диспетчер моков, i18n-индекс, роутер, глобальный CSS) — по правилу уровней это
  уровень 1. Полный набор и пара — на финальном свипе ветки.
- **Модалка по-прежнему не предлагает корректировки** в списке документов
  (`kind !== 'correction'`), хотя модель платёж на корректировку принимает. Это
  состояние ДО пункта 14, правкой не задето и в пункте не названо.

---

# Заход 2 — работа над ошибками (2026-08-29)

Приёмка отклонила первую правку. Разбор приёмщика в одной фразе: **правило закрыло ЯРЛЫК,
а не деньги, уходящие обратно.**

## 8. Что было не так

`mockAddOrderPayment` требовал документ при `purpose === 'refund'`, а `purpose` выводился
из знака **только когда его не передали**:

```ts
const purpose: PaymentPurpose = data.purpose ?? (data.amount < 0 ? 'refund' : 'balance')
```

Отрицательная сумма с ЯВНЫМ `purpose: 'balance'` (или `'advance'`) проходила мимо стражи.
Воспроизведено временной спекой против живого мока — тот самый заказ-витрина:

```
$ npx vitest run src/services/mocks/tmp-repro-14.spec.ts
AssertionError: expected 3330 to be 3380
```

то есть после `{ amount: -50, purpose: 'balance', invoiceId: null }` карточка называет
3330, реестр «Входящих» — 3380, и признак готовности пункта сломан ровно тем же способом,
ради устранения которого пункт заведён.

Путь достижим руками: поле суммы — `type="number" step="0.01"` без `min`,
`refundNeedsInvoice` при `purpose === 'balance'` ложно, `:disabled` смотрел только на
`paymentSaving` / `=== 0` / `''`. Приёмщик прошёл его живым зондом на ORD-005 (счетов нет
вовсе): «-50» при подписи «Balance» — кнопка активна, модалка закрылась, в таблице строка
«Balance -50.00 — —».

И собственная непоследовательность правки: инвариант сида
`holds no refund that names no document` фильтрует `p.amount < 0 && !p.invoiceId`, то есть
опознаёт возврат **по знаку**, — а стража модели опознавала по ярлыку. Тест и модель
расходились в определении того, что такое возврат.

**Поправка к отчёту первого захода.** Строка «3380 → 3500» неверна: замер даёт 3380 и в
карточке, и в реестре. Вниз пришёл реестр (5500... точнее 3500 → 3380), потому что
названный документ засчитал минус себе; карточка как называла 3380, так и называет.
Критерий пункта («одна и та же сумма») при этом выполняется. Строка в §5 исправлена.

## 9. Правка второго захода

| Файл | Правка |
|---|---|
| `src/services/mocks/orders.ts` | `mockAddOrderPayment`: назначение выводится из ЗНАКА — `data.amount < 0 ? 'refund' : (data.purpose ?? 'balance')`. Минус — ушедшие деньги, как бы вызывающий их ни назвал; проверка `REFUND_MUST_BE_NEGATIVE` осталась на переданном ярлыке (`purpose: 'refund'` с плюсом) и ведёт себя как прежде |
| `src/views/admin/orders/OrderCardPage.vue` | новый `paymentGoesOut` = «назначение возврат ИЛИ введён минус»; на него переведены `paymentInvoiceOptions`, `refundNeedsInvoice`, подсказка и плейсхолдер списка. Докстринг `openPaymentModal` больше не обещает «без документа» для «a rebate going back» — то самое место, которое противоречило новому правилу |
| `roo_code/plans/orders/orders-backend-contract.md` | §4.6: «правило проверяется по выведенному назначению» → «возврат опознаётся по ЗНАКУ суммы, а не по ярлыку», с обеими измеренными ценами (3380/3500 и 3330/3380) |

Тесты: два новых в `src/services/mocks/orders.spec.ts` (правило по знаку; заказ-витрину
нельзя развести деньгами под чужим ярлыком) и продолжение существующего e2e — ровно тот
путь, которым прошёл приёмщик.

Ничего из принятого приёмщиком не переписано: сид, i18n, `orderLineEdits.ts`, вотчер
подсказки документа и оба прежних e2e-утверждения остались как были.

**Побочный эффект, о котором стоит сказать вслух.** `useOrderCard.refundState` считает
возвраты по ярлыку (`p.purpose === 'refund'`). До правки минус под ярлыком «balance» был
для него невидим — деньги ушли, а признак «деньги вернулись» молчал. Теперь такой записи
не существует: модель приводит назначение к знаку, и одно определение возврата на всю
систему (Л5).

## 10. Инверсия — Л9

**Юнит, инверсия 1** — вернул выведение назначения к прежнему (ярлык побеждает знак),
остальное на месте:

```
$ npx vitest run src/services/mocks/orders.spec.ts
× payments > reads money going out by the sign of the amount, not by the label above it
    expected [Function] to throw an error / Received: undefined
× the showcase order > cannot be pushed apart again by money going out under another name
    expected [Function] to throw an error / Received: undefined
Tests  2 failed | 198 passed (200)
```

После восстановления — `200 passed`.

**E2E, инверсия 2** — `paymentGoesOut` вернул к «только ярлык»:

```
$ npx playwright test tests/e2e/admin/orders/orders.spec.ts -g "a refund names its document" --reporter=line
exit=1
Error: expect(locator).toContainText("Issue an invoice first") failed
  Error: element(s) not found
> 1772 |     await expect(page.locator('[data-test="payment-refund-hint"]')).toContainText(
1 failed
```

**E2E, инверсия 3** — подсказка правильная, а `refundNeedsInvoice` обезврежен (`&& false`):
краснеет уже второе утверждение, а не первое, то есть кнопку проверяет именно оно:

```
exit=1
Error: expect(locator).toBeDisabled() failed
  9 × locator resolved to <button class="btn btn-primary" data-test="payment-confirm">Add payment</button>
> 1761 |     await expect(page.locator('[data-test="payment-confirm"]')).toBeDisabled()
1 failed
```

После восстановления — `1 passed (13.3s)`.

## 11. Машинная приёмка второго захода

```
$ cd frontend_vue && npm run verify
exit=0
Test Files  35 passed (35)
     Tests  727 passed (727)
(typecheck OK · lint OK · dupes 8.92 % при пороге 10 · format:check OK)

$ npm run test:audit
exit=0
Test Files  22 passed (22)
     Tests  97 passed (97)
```

`test:audit` зелёный без правок каталога: новых кодов отказа второй заход не заводит.

## 12. Линзы второго захода

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л1 реактивность** | `grep -n "structuredClone\|toRaw(\|watch(" src/views/admin/orders/OrderCardPage.vue` | две строки: существовавший `watch(` на 212 и вотчер подсказки на 821; новый код — `computed` над двумя ref | ни `deep`, ни `toRaw`, ни `structuredClone` — #36/#37 неприменимы; `paymentGoesOut` читает `paymentAmount` напрямую, поэтому подсказка появляется на вводе минуса (проверено e2e) |
| **Л2 i18n** | подсчёт ключей `src/i18n/admin/orders.ts` по трём локалям | ru 441 · en 441 · lt 441 | новых ключей заход не добавил, симметрия не нарушена; сырых точечных ключей в шаблоне нет — всё через `t()` |
| **Л3 контракт** | `npm run test:audit` (в нём `order-audit-contract-conformance`) + правка §4.6 | 97 passed | каталог кодов не менялся, текст правила приведён к тому, что делает код |
| **Л4 мок = правда** | замер по живому моку: `card`, `Σ invoiceBalances`, реестр по ORD-100 | `{ card: 3380, byDoc: 3380, registry: 3380 }` | три способа спросить дают одну цифру; демо-хранилище правило приложения не нарушает |
| **Л5 один источник** | `grep -rn "amount < 0\|purpose === 'refund'\|Math.abs(p.amount)" src/` | правило «минус = возврат» в одном месте (`mockAddOrderPayment`); `useOrderCard.refundState` и инвариант сида читают его результат, а не повторяют его; в UI — следствие правила (выключенная кнопка), не копия | второй реализации нет; расхождение теста и модели, на которое указал приёмщик, устранено — определение одно и оно по знаку |
| **Л6 UI** | прочитан изменённый фрагмент шаблона | те же `field-hint` и `data-test`, новых классов и компонентов нет | #12/#16/#63 неприменимы |
| **Л7 права/роутинг** | правка внутри существующей модалки | ни флагов, ни роутов | нечего проверять |
| **Л8 потеря данных** | `confirmPayment` при `refundNeedsInvoice` возвращается, модалку не закрывает | введённое остаётся | данные не теряются |
| **Л9 тесты** | инверсии 1–3 выше | 2 юнит-теста и по одному утверждению e2e краснеют поимённо | ни одно новое утверждение не устраивает бездействие: сумма введена, назначение выбрано, и держит кнопку ровно отсутствие документа |
| **Л10 целостность** | `npm run verify` | exit=0 | роутер, i18n-индекс, типы флагов не трогались |

## 13. E2E — уровень 1

Область та же (заказы + их мок), общий пол не тронут.

```
$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/clients \
    tests/e2e/admin/sales-crm --reporter=line --workers=3 > run.txt 2>&1; echo "exit=$?"
```

```
exit=0
  198 passed (4.2m)
```

Код возврата снят сразу после команды, до конвейеров; вывод сохранён целиком и прочитан —
строк `failed`, `flaky`, `skipped` в нём нет (`grep -cE "^\s*(failed|flaky)"` → 0).

## 14. Отчёт

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 14, заход 2 (работа над ошибками)
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK · format OK · unit OK (727)
                   test:audit OK (97) · e2e ур. 1 — 198 passed
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 1 (дыра по ярлыку из разбора приёмщика)   Починено: 1   Отклонено: 0
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Признак готовности пункта: карточка ORD-2026-100 и «Входящие» называют **3380** обе, и
развести их деньгами под чужим ярлыком больше нельзя — тест на это краснеет на прежнем
коде (§10). Отметку ✅ в плане ставит не автор правки.
