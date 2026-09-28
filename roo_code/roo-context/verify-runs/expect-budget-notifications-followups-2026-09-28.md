# Бюджет ожидания у утверждений после действия: notifications, sales-crm, followups, order-offcuts, categories

Задача `expect-budget-after-action-notifications-and-followups` ночи
`night-2026-09-28-0719`. Дата замера и прогонов — 2026-09-28.

Продолжение сквозного плана [`сквозное-потолки-ожиданий-план.md`](../../plans/general/сквозное-потолки-ожиданий-план.md),
пункт П1 (БАГ-01). Каталоги `admin/suppliers/` и `admin/analytics/` закрыты 2026-09-26,
`admin/warehouse/` — своими задачами порции; здесь пять спеков, которых не покрывал ни один сторож.

Дерево: `8541ee58b134432675209d36f727297423ac3db6`. Прогоны — на этом дереве, порт `PW_PORT=5402`.

## Что сделано

Три утверждения стояли после действия над страницей и ждали перерисовки по дефолтному потолку
`expect` в 5000 мс:

- `tests/e2e/admin/sales-crm/sales-crm.spec.ts` — `toBeVisible` на `[data-test="sales-crm-kpis"]`
  сразу за двумя `page.goBack()`;
- `tests/e2e/admin/followups-list1.spec.ts` — отрицательное `not.toContainText('changed@example.com')`
  на строке `[data-test="settings-mail-test-target"]` за `from.fill('changed@example.com')`
  и такое же отрицательное утверждение на тосте за кликом по `[data-test="settings-mail-test-btn"]`.

Остальные три файла (`notifications.spec.ts`, `order-offcuts.spec.ts`, `categories.spec.ts`)
на момент сдачи покрыты полностью: разбор нашёл в них 0 нарушителей. Импорт `DATA_READY_TIMEOUT`
из `tests/e2e/helpers/ready.ts` был во всех пяти файлах и до правки — импорты не добавлялись.

Разбор ведётся состоянием ПО ТЕСТУ, а не по строке выше утверждения: последнее действие
запоминается и переносится на следующие утверждения, пока его не снимет открывалка
(`openAdminPage`, `openAdminCard`, `waitForDataReady`, `switchLanguage`, локальные
`openCategoriesList` / `openCategoryCard` каталога категорий) или начало нового теста. Оба
`not.toContainText` из `followups-list1.spec.ts` стоят за другим `expect`, а не за действием, —
разбор «по строке» их бы не увидел, оба они найдены новым сторожем.

Сторож — `frontend_vue/src/services/expectBudgetFollowups.spec.ts`, по образцу
`expectBudgetSuppliers.spec.ts`: читает ровно пять спеков, требует бюджета у каждого утверждения
после действия, требует импорта `DATA_READY_TIMEOUT` из помощника и отсутствия числовых потолков,
держит замеренный пол числа бюджетов в каждом файле.

## Машинная часть

### Бюджеты и числовые потолки по файлам

```
$ cd frontend_vue && for f in tests/e2e/admin/notifications/notifications.spec.ts \
    tests/e2e/admin/sales-crm/sales-crm.spec.ts \
    tests/e2e/admin/followups-list1.spec.ts \
    tests/e2e/admin/orders/order-offcuts.spec.ts \
    tests/e2e/admin/products/categories.spec.ts; do
    printf '%-70s budgets=%s numeric=%s\n' "$f" \
      "$(grep -c 'timeout: DATA_READY_TIMEOUT' "$f")" "$(grep -cE 'timeout: *[0-9]' "$f")"
  done
tests/e2e/admin/notifications/notifications.spec.ts                    budgets=12 numeric=0
tests/e2e/admin/sales-crm/sales-crm.spec.ts                            budgets=3 numeric=0
tests/e2e/admin/followups-list1.spec.ts                                budgets=29 numeric=0
tests/e2e/admin/orders/order-offcuts.spec.ts                           budgets=11 numeric=0
tests/e2e/admin/products/categories.spec.ts                            budgets=37 numeric=0
exit=0
```

`numeric=0` у всех пяти — числовых потолков вида `timeout: <цифра>` в них не осталось; все
бюджеты взяты токеном `DATA_READY_TIMEOUT`, то есть импортом.

### Импорт бюджета — во всех пяти

```
$ cd frontend_vue && for f in tests/e2e/admin/notifications/notifications.spec.ts \
    tests/e2e/admin/sales-crm/sales-crm.spec.ts \
    tests/e2e/admin/followups-list1.spec.ts \
    tests/e2e/admin/orders/order-offcuts.spec.ts \
    tests/e2e/admin/products/categories.spec.ts; do
    echo "== $f"; grep -n "DATA_READY_TIMEOUT" "$f" | grep "import"
  done
== tests/e2e/admin/notifications/notifications.spec.ts
2:import { DATA_READY_TIMEOUT, waitForDataReady } from '../../helpers/ready'
== tests/e2e/admin/sales-crm/sales-crm.spec.ts
3:import { DATA_READY_TIMEOUT } from '../../helpers/ready'
== tests/e2e/admin/followups-list1.spec.ts
14:import { DATA_READY_TIMEOUT } from '../helpers/ready'
== tests/e2e/admin/orders/order-offcuts.spec.ts
4:import { DATA_READY_TIMEOUT } from '../../helpers/ready'
== tests/e2e/admin/products/categories.spec.ts
6:import { DATA_READY_TIMEOUT } from '../../helpers/ready'
exit=0
```

### Глобальный `expect.timeout` в конфиге не поднят

```
$ cd frontend_vue && grep -nE '^ *(expect|timeout):' playwright.config.ts
50:  timeout: 90_000,
53:  expect: {
113:      timeout: 120_000,
133:      timeout: 120_000,
exit=0
```

Блок `expect:` начинается строкой 53 и содержит только `toHaveScreenshot`
(`maxDiffPixelRatio`, `animations`, `threshold`) — ключа `timeout` внутри него нет. Три
`timeout:` в выводе — потолок теста (90 с) и два потолка `webServer` (по 120 с), ни один не
относится к `expect`. Конфиг не входил в разрешённые файлы и не менялся: `git status` показывает
изменёнными только два спека, а `playwright.config.ts` — нет.

### Ожидания сети по времени в наборе не появились

```
$ cd frontend_vue && grep -rn "await page.waitForLoadState" tests/ | wc -l
0
exit=0
```

## Замер

Инверсия под искусственной нагрузкой в постановке заменена замером: машина общая, рядом идут
чужие тесты, и ни фоновых потребителей процессора, ни снятия процессов по имени здесь не делалось.

Замер снят на том же тесте `sales-crm.spec.ts`, чьё утверждение и получило бюджет: вокруг двух
`page.goBack()` и `toBeVisible` временно поставлены отсечки времени (файл из моих outputs,
инструментация после замера снята — в диффе её нет).

```
$ cd frontend_vue && npx playwright test tests/e2e/admin/sales-crm/sales-crm.spec.ts --reporter=line
Running 1 test using 1 worker
[1/1] [chromium] › tests/e2e/admin/sales-crm/sales-crm.spec.ts:24:3 › Sales CRM dashboard › KPI counts include an order created after them
[chromium] › tests/e2e/admin/sales-crm/sales-crm.spec.ts:24:3 › Sales CRM dashboard › KPI counts include an order created after them
[MEASURE] goBack1=246ms goBack2=265ms awaitVisible=456ms total=967ms

  1 passed (14.3s)
exit=0
```

Замеренное ожидание — **456 мс** против дефолтного потолка в **5000 мс**. То есть бюджет поставлен
как **страховка на будущее**, а не как починка наблюдаемой красноты: сейчас утверждению хватает
десятой доли потолка, и ни одно падение этого теста ожиданием не объяснялось. Искусственной
нагрузки для этого замера не создавалось; вывод про потолок — по числу из прогона, а не по
предположению.

## Мутационные проверки сторожа

Четыре прогона сторожа: три мутации и откат. Сломанное проверялось на файле из моих outputs.

**A. Убран бюджет у одного утверждения в `followups-list1.spec.ts`** (снят второй аргумент
у `not.toContainText('changed@example.com')` на строке `[data-test="settings-mail-test-target"]`):

```
$ cd frontend_vue && ./node_modules/.bin/vitest run src/services/expectBudgetFollowups.spec.ts; echo "exit=$?"
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-2/wt-expect-budget-after-action-notifications-and-followups/frontend_vue
 ❯ src/services/expectBudgetFollowups.spec.ts (7 tests | 1 failed) 12ms
     ✓ разбор читает все пять спеков и находит в них утверждения 2ms
     ✓ класс «после действия» не пуст — иначе правило не проверялось бы 0ms
     × каждое утверждение после действия несёт опцию ожидания 6ms
     ✓ опция взята из DATA_READY_TIMEOUT, а не записана числом 1ms
     ✓ пол числа утверждений после действия в каждом файле держится 0ms
     ✓ DATA_READY_TIMEOUT приходит импортом из помощника ready 1ms
     ✓ числового потолка в этих спеках не осталось 0ms
 FAIL  src/services/expectBudgetFollowups.spec.ts > бюджет ожидания у утверждений после действия > каждое утверждение после действия несёт опцию ожидания
AssertionError: expected [ Array(1) ] to deeply equal []
- Expected
+ Received
- []
+ [
+   "tests/e2e/admin/followups-list1.spec.ts:132",
+ ]
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
   Start at  08:33:15
   Duration  206ms
exit=1
```

Красное и назван файл — сторож настоящий (Л9, приёмка инверсии #71: хоть один тест покраснел).
Названная строка — `tests/e2e/admin/followups-list1.spec.ts:132`, отрицательное утверждение
`not.toContainText` с бюджетом `DATA_READY_TIMEOUT`; снятие второго аргумента у неё и есть мутация A.

**B. Бюджет заменён числом `5000` и снят импорт в `sales-crm.spec.ts`**:

```
$ cd frontend_vue && ./node_modules/.bin/vitest run src/services/expectBudgetFollowups.spec.ts; echo "exit=$?"
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-2/wt-expect-budget-after-action-notifications-and-followups/frontend_vue
 ❯ src/services/expectBudgetFollowups.spec.ts (7 tests | 3 failed) 14ms
     ✓ разбор читает все пять спеков и находит в них утверждения 3ms
     ✓ класс «после действия» не пуст — иначе правило не проверялось бы 0ms
     ✓ каждое утверждение после действия несёт опцию ожидания 1ms
     × опция взята из DATA_READY_TIMEOUT, а не записана числом 7ms
     ✓ пол числа утверждений после действия в каждом файле держится 0ms
     × DATA_READY_TIMEOUT приходит импортом из помощника ready 1ms
     × числового потолка в этих спеках не осталось 1ms
 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
   Start at  08:33:35
   Duration  203ms
exit=1
```

Оффендеры обеих проверок о числе — две строки `sales-crm.spec.ts` с `timeout: 5000` (видно в
выводе выше); проверка импорта назвала этот же файл и сказала, что импорта `DATA_READY_TIMEOUT`
в нём нет.

**C. Только использование заменено числом, импорт оставлен** — то есть ровно формулировка
критерия «заменить импорт числом»:

```
$ cd frontend_vue && ./node_modules/.bin/vitest run src/services/expectBudgetFollowups.spec.ts; echo "exit=$?"
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-2/wt-expect-budget-after-action-notifications-and-followups/frontend_vue
 ❯ src/services/expectBudgetFollowups.spec.ts (7 tests | 2 failed) 23ms
     ✓ разбор читает все пять спеков и находит в них утверждения 5ms
     ✓ класс «после действия» не пуст — иначе правило не проверялось бы 1ms
     ✓ каждое утверждение после действия несёт опцию ожидания 1ms
     × опция взята из DATA_READY_TIMEOUT, а не записана числом 12ms
     ✓ пол числа утверждений после действия в каждом файле держится 0ms
     ✓ DATA_READY_TIMEOUT приходит импортом из помощника ready 1ms
     × числового потолка в этих спеках не осталось 1ms
 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
   Start at  08:36:19
   Duration  235ms
exit=1
```

Оффендеры — те же две строки `sales-crm.spec.ts`, что и в мутации B. Откат обеих правок вернул
сторож в зелёное:

```
$ cd frontend_vue && ./node_modules/.bin/vitest run src/services/expectBudgetFollowups.spec.ts; echo "exit=$?"
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-2/wt-expect-budget-after-action-notifications-and-followups/frontend_vue

 ✓ src/services/expectBudgetFollowups.spec.ts (7 tests) 6ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  08:36:20
   Duration  197ms
exit=0
```

## Прогон затронутых спеков

Уровень 1: правки — в спеках и в новом стороже, общего пола (`tests/e2e/helpers/`) не касались.

```
$ cd frontend_vue && npx playwright test \
    tests/e2e/admin/notifications/notifications.spec.ts \
    tests/e2e/admin/sales-crm/sales-crm.spec.ts \
    tests/e2e/admin/followups-list1.spec.ts \
    tests/e2e/admin/orders/order-offcuts.spec.ts \
    tests/e2e/admin/products/categories.spec.ts --reporter=dot
Running 78 tests using 4 workers
··············································································
  78 passed (2.5m)
exit=0
```

Тот же набор через `list`-репортер дал `78 passed (2.6m)`, `exit=0` — числа совпали.

## Ссылки

Ссылка вида `файл:строка` в журнале одна — на строку, которую эта задача изменила:
`tests/e2e/admin/followups-list1.spec.ts:132` в разделе про мутацию A, и в том же предложении
стоит токен `DATA_READY_TIMEOUT` с самой этой строки. Остальные места в коде названы токенами
в бэктиках (`not.toContainText`, `toBeVisible`, имена селекторов) без номеров, а номера строк
внутри блоков кода — это вывод репортера, который резолвер пропускает. Правка текста вокруг
чужих ссылок и вставка строк в чужие файлы не делались.

## Вывод

Приёмка сторожа и замера — зелёная; прогон пяти затронутых спеков — 78 из 78. Смысл утверждений
не менялся: в диффе у тронутых строк появился только второй аргумент `{ timeout: DATA_READY_TIMEOUT }`
(в `followups-list1.spec.ts` — две строки, в `sales-crm.spec.ts` — одна, плюс комментарий).
`frontend_vue/playwright.config.ts` не изменён, глобального `expect: { timeout }` в нём по-прежнему
нет. Ожидание, которое уже подходит к пяти секундам, замером не обнаружено — худшее из виденных
занимает 456 мс.
