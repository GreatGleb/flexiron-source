# Бюджет утверждениям после голого `page.goto` — прогон 2026-09-28

Задача: `expect-budget-after-goto-navigation-and-settings`. Класс П1 плана потолков ожиданий,
последний незакрытый: утверждение о странице или локаторе, стоящее ПЕРВЫМ после `page.goto(...)`,
между которым и переходом нет ожидалки готовности (`waitForDataReady`, `openAdminPage`,
`openAdminCard`, `navigateToAdmin`). Пол у такого утверждения отсутствует по построению, а
дефолтный потолок `expect` — пять секунд — под нагрузкой не растёт (растёт только потолок теста,
90 с в `playwright.config.ts`).

Правка добавила таким утверждениям второй аргумент `{ timeout: DATA_READY_TIMEOUT }`, взятый
импортом из `tests/e2e/helpers/ready.ts`. Смысл утверждений не менялся: ни регулярное выражение,
ни ожидаемый путь, ни `not.`, ни `.soft`. Утверждения о простых значениях (`expect(errors).toHaveLength(0)`)
бюджета НЕ получили: ожидания у них нет, потолок к ним не относится. Второе и последующие
утверждения того же теста бюджета не получили: первое уже сработало полом.

## Что тронуто

- `frontend_vue/tests/e2e/navigation.spec.ts` — 14 переходов, 14 утверждений после них без
  ожидалки, все 14 с бюджетом. Правка коснулась одного: в `deep link to product card works` первым
  после `page.goto` стоит `toBeVisible` без бюджета, оно его и получило; в остальных первым уже
  стоит `toHaveURL` с бюджетом, и трогать там нечего. Бюджет файла после правки — 14.
- `frontend_vue/tests/e2e/feature-flags-matrix.spec.ts` — 13 утверждений после голого перехода без
  ожидалки, все 13 с бюджетом. Десять из них получили бюджет этой задачей: `dashboard-title`,
  `suppliers-table-view`, `bcc-request-title`, `supplier-card-config-title`, а также ссылки и
  кнопки в тестах cross-page и sidebar (`supplier-card-bcc-link`, `supplier-card-config-link`,
  `suppliers-bcc-btn`, `suppliers-new-btn`, `sidebar-nav-suppliers`, `sidebar-nav-analytics`).
  Остальные три — `toHaveURL` (по одному в двух тестах parent-route и одно в цикле маршрутов
  страниц) — были закрыты прежними задачами по этому классу. Бюджет файла после правки — 19.
- `frontend_vue/tests/e2e/admin/settings/settings.spec.ts` — 24 перехода, 20 утверждений после них
  без ожидалки, все 20 с бюджетом (табы, поля профиля и компании, поля и таблица почты, вкладка
  финансов с таблицей валют, таблицы единиц измерения и правил пересчёта, таблица статусов заказов
  и её заголовки, поле имени статуса, кнопки сохранения после правки поля). Тесты, где между
  переходом и первым утверждением уже стоит `waitForDataReady` (модалки финансов, единиц измерения,
  статусов), в разбор не входят — у них пол есть. Бюджет файла после правки — 34.
- `frontend_vue/src/services/expectBudgetGoto.spec.ts` — новый сторож.

Числа 14 / 19 / 34 — пофайловый счёт `timeout: DATA_READY_TIMEOUT` после правки (грепом, прогон 2
ниже). Чисел «до» здесь нет: они не измерялись, а выдумывать их незачем. Грепом же проверено, что
числового потолка вида `timeout: 5000` ни в одном из трёх спеков нет: число в опции не записано ни
разу, все опции взяты идентификатором `DATA_READY_TIMEOUT`.

Счёт бюджетов и счёт утверждений — разные вещи, и второй тоже замерен: подсчёт той же логикой,
что и в сторожe (переход → ближайшее `await expect` после него → есть ли между ними ожидалка).
Получено `goto=14 mapped=14 need=14 withBudget=14` по `navigation.spec.ts`, `goto=13 mapped=13
need=13 withBudget=13` по `feature-flags-matrix.spec.ts` и `goto=24 mapped=24 need=20
withBudget=20` по `settings.spec.ts`: `need` — сколько утверждений после перехода без ожидалки,
`withBudget` — сколько из них несут бюджет. Числа совпадают везде, ни одного нарушения не осталось.

## Прогон 1. Формат всех тронутых файлов

Команда:

```bash
cd frontend_vue && npx prettier --write tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts src/services/expectBudgetGoto.spec.ts
```

Код возврата: 0. Вывод целиком:

```
tests/e2e/navigation.spec.ts 92ms (unchanged)
tests/e2e/feature-flags-matrix.spec.ts 43ms (unchanged)
tests/e2e/admin/settings/settings.spec.ts 56ms
src/services/expectBudgetGoto.spec.ts 42ms (unchanged)
```

## Прогон 2. Пофайловый счёт бюджетов

Команда:

```bash
cd frontend_vue && grep -c "timeout: DATA_READY_TIMEOUT" tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts
```

Код возврата: 0. Вывод целиком:

```
tests/e2e/navigation.spec.ts:14
tests/e2e/feature-flags-matrix.spec.ts:19
tests/e2e/admin/settings/settings.spec.ts:34
```

Это и есть замеренные полы, записанные в сторож как `BUDGETS_FLOOR`: 14 / 19 / 34.

## Прогон 3. Новый сторож

Команда:

```bash
cd frontend_vue && npx vitest run src/services/expectBudgetGoto.spec.ts
```

Код возврата: 0. Вывод целиком:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-3/wt-expect-budget-after-goto-navigation-and-settings/frontend_vue

 ✓ src/services/expectBudgetGoto.spec.ts (7 tests) 6ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  09:24:38
   Duration  200ms (transform 61ms, setup 0ms, import 75ms, tests 6ms, environment 0ms)
```

Сторож доказывает непустоту разбора отдельным утверждением: `expect(found.length).toBeGreaterThanOrEqual(10)`
по каждому из трёх файлов и `expect(needBudget.length).toBeGreaterThanOrEqual(30)` по классу
«после перехода без ожидалки». Пустой разбор краснеет.

## Прогон 4. Три затронутых спека Playwright

Команда:

```bash
cd frontend_vue && npx playwright test tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts --reporter=line
```

Код возврата: 0. Вывод целиком (строка `58 passed (38.2s)` стоит ВЫШЕ последующей пустой строки;
обрезаний в этом выводе нет):

```
Running 58 tests using 4 workers

[1/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:38:3 › Settings Layout › tab navigation works — click through all tabs
[2/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:14:3 › Settings Layout › loads without errors
[3/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:64:3 › Settings Layout › save/cancel action bar is visible
[4/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:27:3 › Settings Layout › the settings tabs are the seven sections, in order
[5/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:75:3 › Profile Settings › loads profile form with all fields
[6/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:86:3 › Profile Settings › password change section is visible
[7/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:102:3 › Company Settings › loads company form with all fields
[8/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:113:3 › Company Settings › typing in fields makes save bar dirty
[9/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:128:3 › Mail Settings › loads the mail server form filled from settings
[10/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:139:3 › Mail Settings › the password field stays empty even though a password is set
[11/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:152:3 › Mail Settings › the test button reports the address the letter went to
[12/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:166:3 › Mail Settings › typing in the host field makes the save bar dirty
[13/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:181:3 › Finance Settings › loads finance form with numeric inputs
[14/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:190:3 › Finance Settings › currencies table is visible with rows
[15/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:198:3 › Finance Settings › add currency modal opens and has inputs
[16/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:218:3 › Finance Settings › currency delete button is visible
[17/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:231:3 › Units Settings › loads UoM table with rows
[18/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:238:3 › Units Settings › conversion rules table is visible
[19/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:245:3 › Units Settings › add UoM modal opens with category dropdown
[20/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:259:3 › Units Settings › add conversion modal opens
[21/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:279:3 › Order Statuses Settings › loads statuses table with rows
[22/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:286:3 › Order Statuses Settings › all status columns are present
[23/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:294:3 › Order Statuses Settings › add status modal opens with color picker
[24/58] [chromium] › tests/e2e/admin/settings/settings.spec.ts:305:3 › Order Statuses Settings › status name input is editable in table
[25/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:36:3 › Parent-route redirect › /admin with adminDashboard OFF lands on /404 via dashboard redirect
[26/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:45:3 › Parent-route redirect › /admin with adminDashboard ON lands on dashboard
[27/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin redirects to /404 when all page flags are OFF
[28/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/analytics/dashboard redirects to /404 when all page flags are OFF
[29/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/analytics/warehouse redirects to /404 when all page flags are OFF
[30/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/suppliers redirects to /404 when all page flags are OFF
[31/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/suppliers/new redirects to /404 when all page flags are OFF
[32/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/suppliers/config redirects to /404 when all page flags are OFF
[33/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/suppliers/bcc-request redirects to /404 when all page flags are OFF
[34/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:81:5 › All page flags OFF › /admin/suppliers/S-001 redirects to /404 when all page flags are OFF
[35/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:99:3 › All section flags OFF, page flags ON › DashboardPage renders without alerts/charts panels
[36/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:109:3 › All section flags OFF, page flags ON › SuppliersListPage renders without kanban tabs / export button
[37/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:122:3 › All section flags OFF, page flags ON › BccRequestPage renders without history panel
[38/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:131:3 › All section flags OFF, page flags ON › SupplierCardConfigPage renders without permissions editor
[39/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:142:3 › Cross-page link follow-through › SupplierCard → BCC link redirects to /404 when bccRequest OFF
[40/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:154:3 › Cross-page link follow-through › SupplierCard → Config link redirects to /404 when supplierCardConfig OFF
[41/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:166:3 › Cross-page link follow-through › SuppliersList → BCC header button redirects to /404 when bccRequest OFF
[42/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:178:3 › Cross-page link follow-through › SuppliersList → New supplier button redirects to /404 when supplierCreate OFF
[43/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:192:3 › Sidebar cross-link › Sidebar → Suppliers link redirects to /404 when suppliersList OFF
[44/58] [chromium] › tests/e2e/feature-flags-matrix.spec.ts:204:3 › Sidebar cross-link › Sidebar → Analytics link redirects to /404 when adminDashboard OFF
[45/58] [chromium] › tests/e2e/navigation.spec.ts:5:3 › Navigation › landing renders at /
[46/58] [chromium] › tests/e2e/navigation.spec.ts:11:3 › Navigation › unknown route redirects to /404
[47/58] [chromium] › tests/e2e/navigation.spec.ts:16:3 › Navigation › /admin redirects to dashboard
[48/58] [chromium] › tests/e2e/navigation.spec.ts:21:3 › Navigation › deep link to supplier card works
[49/58] [chromium] › tests/e2e/navigation.spec.ts:27:3 › Navigation › supplier create route resolves before :id
[50/58] [chromium] › tests/e2e/navigation.spec.ts:33:3 › Navigation › deep link to category card works
[51/58] [chromium] › tests/e2e/navigation.spec.ts:41:3 › Navigation › deep link to product card works
[52/58] [chromium] › tests/e2e/navigation.spec.ts:48:3 › Navigation › categories route resolves before :id
[53/58] [chromium] › tests/e2e/navigation.spec.ts:53:3 › Navigation › deep link to client card works
[54/58] [chromium] › tests/e2e/navigation.spec.ts:59:3 › Navigation › client create route resolves before :id
[55/58] [chromium] › tests/e2e/navigation.spec.ts:65:3 › Navigation › clients list route works
[56/58] [chromium] › tests/e2e/navigation.spec.ts:73:3 › Navigation › orders list route works
[57/58] [chromium] › tests/e2e/navigation.spec.ts:79:3 › Navigation › order create route resolves before :id
[58/58] [chromium] › tests/e2e/navigation.spec.ts:85:3 › Navigation › deep link to order card works
  58 passed (38.2s)
```

## Прогон 5. `npm run verify`

Команда:

```bash
cd frontend_vue && npm run verify
```

Код возврата: 0.

Вывод целиком — в приложении A в конце этого документа. Прогон слишком велик (3187 строк,
349549 байт), чтобы пройти через чат без обрезки, поэтому он перенаправлен в файл
(`> "$TMPDIR/verify.log" 2>&1`) и оттуда дописан в документ дословно. Ниже — те же строки для
быстрого чтения: начало (typecheck, lint, начало `dupes`) и хвост (unit-тесты); в приложении A то
же самое без пропусков, включая список совпадений `jscpd` и все строки unit-тестов. Пустую
строку-заполнитель вместо вывода не привожу, чтобы не выдать её за вывод команды.

```
> flexiron-frontend@0.1.0 verify
> npm run typecheck && npm run lint && npm run dupes && npm run format:check && npm run test:unit

> flexiron-frontend@0.1.0 typecheck
> vue-tsc --noEmit

> flexiron-frontend@0.1.0 lint
> eslint src/ tests/ *.ts --max-warnings=0 --cache --cache-location node_modules/.cache/eslint/

> flexiron-frontend@0.1.0 dupes
> jscpd src

Using config from .jscpd.json
Clone found (markup)
 - assets/images/Flexiron_Icon_Blue.svg [2:24 - 21:2] (20 lines, 92 tokens)
   assets/images/Flexiron_Logo_Dark.svg [2:24 - 21:4]
Clone found (html)
 - components/admin/AdminSidebar.vue:html [139:7 - 147:8] (9 lines, 65 tokens)
   components/admin/AdminTopbar.vue:html [95:81 - 104:10]
Clone found (css)
 - components/admin/AdminTopbar.vue:css [123:1 - 134:2] (12 lines, 63 tokens)
   components/admin/NotificationDropdown.vue:css [344:1 - 355:2]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 293:13] (17 lines, 89 tokens)
   views/admin/clients/ClientCardPage.vue:html [253:15 - 269:15]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 293:12] (17 lines, 88 tokens)
   views/admin/orders/OrderCardPage.vue:html [1161:15 - 1177:16]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 297:18] (21 lines, 104 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [358:15 - 376:73]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [477:76 - 495:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [504:72 - 522:29]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:17] (18 lines, 96 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [531:72 - 548:25]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [560:69 - 577:20]
```

Хвост прогона (тот же код возврата 0, ничего не опущено внутри приведённого фрагмента):

```
 ✓ src/services/expectBudgetGoto.spec.ts (7 tests) 8ms
 ✓ src/services/expectUrlBudget.spec.ts (3 tests) 6ms
 ✓ src/services/snapshotBudget.spec.ts (4 tests) 7ms
 ✓ src/services/expectPollBudget.spec.ts (2 tests) 4ms
 ✓ src/services/ordersService.spec.ts (1 test) 14831ms
     ✓ walks the whole surface without a single unmatched route 14828ms

 Test Files  86 passed (86)
      Tests  1263 passed | 3 skipped (1266)
   Start at  09:26:43
   Duration  15.72s (transform 9.07s, setup 0ms, import 21.35s, tests 45.41s, environment 5.46s)
```

Что здесь важно для задачи: `src/services/snapshotBudget.spec.ts` в списке зелёных. Он стережёт,
что глобального `expect: { timeout }` в `playwright.config.ts` нет (ЗАПРЕТ 1), и что
`DATA_READY_TIMEOUT` остался ровно 30 000. `playwright.config.ts` в этой задаче не тронут вовсе.

## Прогон 6. Замер фактического времени ожидания

Инверсия под нагрузкой запрещена условиями задачи и общей машины, поэтому доказательство —
замер: сколько миллисекунд ожидание идёт на самом деле, против дефолтного потолка в 5000 мс.

Замер шёл из `$TMPDIR` (временный каталог задачи), а не из репозитория: файл спека и конфиг лежат
рядом, `testDir` указывает на `$TMPDIR`. Ни одного файла проекта замер не тронул. Порт — свой,
`PW_PORT=5400` из окружения, то есть `--port 5400`; сервер поднят `npm run dev` без мок-подмены
флагов, а с обычными флагами проекта. Три случая — ровно те локаторы, что стоят первыми после
`page.goto` в тронутых тестах: табы настроек, карточка товара, таблица поставщиков. На каждый
случай — по пять итераций «переход, затем ожидание видимости локатора».

Файл `$TMPDIR/expect-timing.spec.js`:

```js
const path = require('node:path')
const FRONT = process.env.FRONT_DIR
const { test } = require(path.join(FRONT, 'node_modules', '@playwright', 'test'))

const CASES = [
  { name: 'settings', goto: '/admin/settings/profile', sel: '[data-test="settings-tabs"]' },
  { name: 'product-card', goto: '/admin/products/prod-001', sel: '[data-test=page-product-card]' },
  { name: 'suppliers', goto: '/admin/suppliers', sel: '[data-test="suppliers-table-view"]' },
]

for (const c of CASES) {
  test(c.name, async ({ page }) => {
    const times = []
    for (let i = 0; i < 5; i++) {
      await page.goto(c.goto)
      const t0 = Date.now()
      await page.locator(c.sel).first().waitFor({ state: 'visible', timeout: 30000 })
      times.push(Date.now() - t0)
    }
    console.log('MEASURE ' + c.name + ' ' + JSON.stringify(times))
  })
}
```

Файл `$TMPDIR/expect-timing.config.js`:

```js
const path = require('node:path')
const FRONT = process.env.FRONT_DIR
const pw = require(path.join(FRONT, 'node_modules', '@playwright', 'test'))
module.exports = pw.defineConfig({
  testDir: process.env.TMPDIR,
  testMatch: 'expect-timing.spec.js',
  timeout: 120000,
  workers: 1,
  reporter: [['line']],
  use: { baseURL: 'http://localhost:5400', testIdAttribute: 'data-test' },
  projects: [{ name: 'chromium', use: { ...pw.devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5400 --strictPort',
    cwd: FRONT,
    url: 'http://localhost:5400',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
```

Команда:

```bash
cd frontend_vue && FRONT_DIR=$PWD npx playwright test --config="$TMPDIR/expect-timing.config.js"
```

Код возврата: 0. Вывод целиком:

```
Running 3 tests using 1 worker

[1/3] [chromium] › ../../tmp-expect-budget-after-goto-navigation-and-settings/expect-timing.spec.js:12:3 › settings
[chromium] › ../../tmp-expect-budget-after-goto-navigation-and-settings/expect-timing.spec.js:12:3 › settings
MEASURE settings [1019,960,955,933,971]

[2/3] [chromium] › ../../tmp-expect-budget-after-goto-navigation-and-settings/expect-timing.spec.js:12:3 › product-card
[chromium] › ../../tmp-expect-budget-after-goto-navigation-and-settings/expect-timing.spec.js:12:3 › product-card
MEASURE product-card [935,924,949,936,944]

[3/3] [chromium] › ../../tmp-expect-budget-after-goto-navigation-and-settings/expect-timing.spec.js:12:3 › suppliers
[chromium] › ../../tmp-expect-budget-after-goto-navigation-and-settings/expect-timing.spec.js:12:3 › suppliers
MEASURE suppliers [358,210,281,205,285]

  3 passed (15.2s)
```

### Числа и вывод по замеру

Миллисекунды на ожидание первого утверждения после `page.goto`, пять итераций:

| случай | итерации | медиана | против потолка 5000 мс |
| --- | --- | --- | --- |
| табы настроек (первый после `goto('/admin/settings/profile')`) | 1019, 960, 955, 933, 971 | 960 | 19 % потолка |
| карточка товара (первый после `goto('/admin/products/prod-001')`) | 935, 924, 949, 936, 944 | 936 | 19 % потолка |
| таблица поставщиков (первый после `goto('/admin/suppliers')`) | 358, 210, 281, 205, 285 | 281 | 6 % потолка |

Машина при замере была непустой: рядом, на том же сервере проекта, только что прошёл полный прогон
58 затронутых тестов, а сам замер шёл на своей базе и своём порту при работающих соседях.

Вывод по замеру — прямой и без округления в удобную сторону. На **пустой** машине одно только
ожидание видимости первых табов настроек и карточки товара занимает около **0,94–1,02 с**, то есть
**пятую часть** дефолтного потолка в 5000 мс; у таблицы поставщиков — около **0,2–0,36 с**.
Это ожидание данных, а не клиентский переход: страница настроек и карточка товара запрашивают свои
данные после монтирования маршрута.

Отсюда бюджет поставлен как **страховка на будущее**, а не как починка наблюдаемой красноты:
при текущих числах до потолка остаётся четырёх- и пятикратный запас, и сегодня эти утверждения
зелёны. Но запас этот тонок ровно в той же степени, в какой он тонок у ожидания данных: по замерам
в `tests/e2e/helpers/ready.ts` под троттлингом 20–40× те же данные приходят втрое-пятеро медленнее
(там приведено: на rate 40 строки движений склада — 5.3 с против 0,6 с на rate 1), и утверждения
с ожиданием около секунды пятый-шестой раз упираются в пять секунд раньше, чем тест — в свои
девяносто. Наблюдаемой близости к потолку (скажем, ожидания в 2,5–4 с) замер не показал: это была бы
отдельная находка, и её здесь нет.

## Прогон 7. Мутационная проверка сторожа

Критерий: снятие `{ timeout: DATA_READY_TIMEOUT }` у одного утверждения после `page.goto` в
`settings.spec.ts` делает `expectBudgetGoto.spec.ts` красным — и по перечню нарушителей, и по
пофайловому счёту бюджетов. Мутирован файл из outputs задачи, и снят ровно один второй аргумент:
у `settings-tabs` в тесте `loads without errors`. Перед мутацией файл сохранён копией в `$TMPDIR`,
после проверки восстановлен из неё.

Команда мутации:

```bash
cd frontend_vue && cp tests/e2e/admin/settings/settings.spec.ts "$TMPDIR/settings.before.spec.ts" && node -e "const fs=require('fs');const p='tests/e2e/admin/settings/settings.spec.ts';let s=fs.readFileSync(p,'utf8');const needle='toBeVisible({\n      timeout: DATA_READY_TIMEOUT,\n    })';const i=s.indexOf(needle);if(i<0){console.error('NEEDLE NOT FOUND');process.exit(2)}s=s.slice(0,i)+'toBeVisible()'+s.slice(i+needle.length);fs.writeFileSync(p,s);console.log('MUTATED offset='+i);const c=(fs.readFileSync(p,'utf8').match(/timeout:\s*DATA_READY_TIMEOUT/g)||[]).length;console.log('BUDGETS_NOW='+c)"
```

Код возврата: 0. Вывод целиком:

```
MUTATED offset=772
BUDGETS_NOW=33
```

Счёт упал с 34 до 33 — мутация ровно одна, и она видна счётом. Строка, у которой снят бюджет,
видна грепом; номер строки в выводе репортёра ниже стоит ВЫШЕ неё:

```bash
cd frontend_vue && grep -n "settings-tabs" tests/e2e/admin/settings/settings.spec.ts | head -5
```

Код возврата: 0. Вывод целиком:

```
21:    await expect(page.locator('[data-test="settings-tabs"]')).toBeVisible()
29:    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')
38:    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')
```

Сторож на мутированном файле:

```bash
cd frontend_vue && npx vitest run src/services/expectBudgetGoto.spec.ts 2>&1 | tail -60; echo "GUARD_EXIT=${PIPESTATUS[0]}"
```

Код возврата: 1. Вывод целиком (цветовые последовательности сняты, текст не правлен):

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-3/wt-expect-budget-after-goto-navigation-and-settings/frontend_vue

 ❯ src/services/expectBudgetGoto.spec.ts (7 tests | 2 failed) 12ms
     ✓ разбор читает все три спека и находит утверждения после перехода 2ms
     ✓ класс «сразу после перехода» не пуст — иначе правило не проверялось бы 0ms
     × каждое утверждение после перехода без ожидалки несёт опцию ожидания 6ms
     ✓ опция взята из DATA_READY_TIMEOUT, а не записана числом 0ms
     ✓ числового потолка в этих спеках не осталось 0ms
     ✓ DATA_READY_TIMEOUT приходит импортом из помощника ready 1ms
     × бюджеты не сняты — в каждом файле их не меньше замеренного числа 1ms

 Failed Tests 2

 FAIL  src/services/expectBudgetGoto.spec.ts > бюджет ожидания у утверждений после голого page.goto > каждое утверждение после перехода без ожидалки несёт опцию ожидания
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/settings/settings.spec.ts:21",
+ ]

  ❯ src/services/expectBudgetGoto.spec.ts:173:23
   146|       .filter((a) => !a.text.includes('timeout:'))
   147|       .map((a) => `${a.rel}:${a.line}`)
   148|     expect(offenders).toEqual([])
   |                       ^
   149|   })

 FAIL  src/services/expectBudgetGoto.spec.ts > бюджет ожидания у утверждений после голого page.goto > бюджеты не сняты — в каждом файле их не меньше замеренного числа
AssertionError: tests/e2e/admin/settings/settings.spec.ts: бюджетов стало меньше замеренного: expected 33 to be greater than or equal to 34
  ❯ src/services/expectBudgetGoto.spec.ts:201:77
   174|   it('бюджеты не сняты — в каждом файле их не меньше замеренного числа…
   175|     for (const [rel, floor] of Object.entries(BUDGETS_FLOOR)) {
   176|       expect(budgetCount(rel), `${rel}: бюджетов стало меньше замеренн…
   |                                                                             ^
   177|         floor,
   178|       )

 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
   Start at  09:32:59
   Duration  191ms (transform 39ms, setup 0ms, import 54ms, tests 12ms, environment 0ms)
```

Оба нарушения названы: перечень — файлом `tests/e2e/admin/settings/settings.spec.ts` и номером
снятого бюджета (двадцать первая строка), счёт — `expected 33 to be greater than or equal to 34`.
Критерий выполнен.

Что делалось после этого. Первый прогон сторожа на мутированном файле дал код возврата 1 и два
падения — выше. Затем снятый бюджет возвращён на место, файл отформатирован, и сторож прогнан
снова. Команда:

```bash
cd frontend_vue && npx prettier --write tests/e2e/admin/settings/settings.spec.ts && grep -c "timeout: DATA_READY_TIMEOUT" tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts
```

Код возврата: 0. Вывод целиком:

```
tests/e2e/admin/settings/settings.spec.ts 130ms (unchanged)
tests/e2e/navigation.spec.ts:14
tests/e2e/feature-flags-matrix.spec.ts:19
tests/e2e/admin/settings/settings.spec.ts:34
```

Счёт `settings.spec.ts` вернулся к 34 — бюджет на месте. Сторож на восстановленном файле и строка,
у которой бюджет был снят:

```bash
cd frontend_vue && npx vitest run src/services/expectBudgetGoto.spec.ts 2>&1 | tail -15; echo "GUARD_EXIT=${PIPESTATUS[0]}"
```

Код возврата: 0. Вывод целиком (цветовые последовательности сняты):

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-3/wt-expect-budget-after-goto-navigation-and-settings/frontend_vue

 ✓ src/services/expectBudgetGoto.spec.ts (7 tests) 6ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  09:33:52
   Duration  210ms (transform 63ms, setup 0ms, import 78ms, tests 6ms, environment 0ms)
```

```bash
cd frontend_vue && grep -n "settings-tabs" tests/e2e/admin/settings/settings.spec.ts | head -5
```

Код возврата: 0. Вывод целиком:

```
21:    await expect(page.locator('[data-test="settings-tabs"]')).toBeVisible({
31:    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')
40:    const tabs = page.locator('[data-test="settings-tabs"] .warehouse-tab')
```

Строка 21 снова несёт бюджет. Круг замкнут: мутация краснит сторожа, откат возвращает зелёное.

## Что осталось за границами задачи

- `navigation.spec.ts` правки почти не потребовал: класс в нём закрыт ещё прежними задачами по
  `toHaveURL`, и бюджет получил ровно один тест — `deep link to product card works`.
- Спеки `feature-flags-matrix.spec.ts` и `settings.spec.ts` сторожами других задач не покрыты:
  пять существующих (`expectBudget.spec.ts`, `expectBudgetClients.spec.ts`,
  `expectBudgetSuppliers.spec.ts`, `expectBudgetWarehouse.spec.ts`,
  `expectBudgetFollowups.spec.ts`) работают по перечню действий из кликов и заполнений, где
  `page.goto(` не назван вовсе. Новый сторож закрывает ровно этот пробел и читает ровно эти три
  файла.
- Файлы вне `outputs` не тронуты: `playwright.config.ts` не изменён, `tests/e2e/helpers/ready.ts`
  не изменён, `refs_shift.py` не запускался.

## Приложение A. Полный вывод `npm run verify`

Прогон 5 целиком: код возврата 0, содержимое файла `$TMPDIR/verify.log` дописано дословно; сняты только цветовые управляющие последовательности, текст не правлен.

`````

> flexiron-frontend@0.1.0 verify
> npm run typecheck && npm run lint && npm run dupes && npm run format:check && npm run test:unit


> flexiron-frontend@0.1.0 typecheck
> vue-tsc --noEmit


> flexiron-frontend@0.1.0 lint
> eslint src/ tests/ *.ts --max-warnings=0 --cache --cache-location node_modules/.cache/eslint/


> flexiron-frontend@0.1.0 dupes
> jscpd src

Using config from .jscpd.json
Clone found (markup)
 - assets/images/Flexiron_Icon_Blue.svg [2:24 - 21:2] (20 lines, 92 tokens)
   assets/images/Flexiron_Logo_Dark.svg [2:24 - 21:4]
Clone found (html)
 - components/admin/AdminSidebar.vue:html [139:7 - 147:8] (9 lines, 65 tokens)
   components/admin/AdminTopbar.vue:html [95:81 - 104:10]
Clone found (css)
 - components/admin/AdminTopbar.vue:css [123:1 - 134:2] (12 lines, 63 tokens)
   components/admin/NotificationDropdown.vue:css [344:1 - 355:2]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 293:13] (17 lines, 89 tokens)
   views/admin/clients/ClientCardPage.vue:html [253:15 - 269:15]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 293:12] (17 lines, 88 tokens)
   views/admin/orders/OrderCardPage.vue:html [1161:15 - 1177:16]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 297:18] (21 lines, 104 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [358:15 - 376:73]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [477:76 - 495:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [504:72 - 522:29]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:17] (18 lines, 96 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [531:72 - 548:25]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [560:69 - 577:20]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [605:72 - 623:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [634:73 - 652:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [664:68 - 682:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [693:74 - 710:20]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [732:76 - 750:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:15] (19 lines, 98 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [763:80 - 780:30]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [796:79 - 814:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [832:23 - 851:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [870:72 - 888:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [899:76 - 917:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [928:77 - 946:29]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:15] (19 lines, 98 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [955:70 - 973:27]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [991:71 - 1008:20]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [1029:77 - 1047:27]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [1056:76 - 1074:27]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [1083:77 - 1101:27]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [1111:76 - 1128:43]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [194:17 - 212:14]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 297:18] (21 lines, 107 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [220:17 - 239:73]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [283:71 - 301:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [349:77 - 367:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [378:78 - 396:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [415:76 - 433:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [444:83 - 462:29]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [477:78 - 495:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [514:72 - 532:29]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 294:12] (18 lines, 92 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [142:13 - 159:12]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:27] (19 lines, 101 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [176:69 - 194:25]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:27] (19 lines, 101 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [213:70 - 231:25]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [250:73 - 268:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [279:77 - 297:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [349:74 - 367:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [378:73 - 395:20]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [423:76 - 441:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [489:79 - 507:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [520:23 - 539:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [552:23 - 571:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:17] (18 lines, 96 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [590:76 - 607:34]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:66 - 295:47] (19 lines, 100 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [240:13 - 257:73]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:27] (19 lines, 101 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [301:76 - 319:25]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [367:75 - 385:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [404:70 - 422:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [433:69 - 451:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [462:73 - 480:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [491:70 - 508:20]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [574:71 - 592:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:20] (19 lines, 99 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [611:79 - 629:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 297:32] (21 lines, 109 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [483:78 - 504:28]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 293:13] (17 lines, 92 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1619:79 - 1635:27]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 294:12] (18 lines, 95 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1665:76 - 1682:22]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1687:79 - 1712:56]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 295:21] (19 lines, 100 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1778:75 - 1796:24]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1800:79 - 1825:56]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1847:81 - 1872:56]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1894:79 - 1919:56]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2853:74 - 2878:51]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 301:14] (25 lines, 122 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3089:70 - 3113:34]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3134:70 - 3159:53]
Clone found (html)
 - components/admin/SupplierFormSections.vue:html [277:49 - 302:33] (26 lines, 128 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3391:71 - 3416:53]
Clone found (html)
 - components/admin/SvgIcon.vue:html [154:41 - 167:8] (14 lines, 131 tokens)
   components/admin/SvgIcon.vue:html [243:56 - 256:8]
Clone found (html)
 - components/admin/ui/AppModal.vue:html [63:71 - 78:11] (16 lines, 76 tokens)
   views/admin/clients/ClientCardPage.vue:html [737:25 - 752:25]
Clone found (html)
 - components/admin/ui/AppModal.vue:html [63:71 - 82:15] (20 lines, 95 tokens)
   views/admin/clients/ClientCardPage.vue:html [807:25 - 846:10]
Clone found (html)
 - components/admin/ui/AppModal.vue:html [63:71 - 81:14] (19 lines, 91 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [638:23 - 671:12]
Clone found (typescript)
 - components/admin/ui/CustomSelect.vue:typescript [41:1 - 50:77] (10 lines, 65 tokens)
   components/admin/ui/RatingSelect.vue:typescript [32:1 - 41:77]
Clone found (typescript)
 - composables/apiErrorCode.consumers.spec.ts [75:1 - 108:2] (34 lines, 120 tokens)
   composables/category-card-refusals.spec.ts [43:1 - 74:2]
Clone found (typescript)
 - composables/apiErrorCode.consumers.spec.ts [75:1 - 95:2] (21 lines, 82 tokens)
   composables/useAuditValueLabel.spec.ts [16:1 - 36:2]
Clone found (typescript)
 - composables/apiErrorCode.consumers.spec.ts [75:1 - 116:22] (42 lines, 141 tokens)
   composables/useSettings.saveErrors.spec.ts [58:1 - 93:39]
Clone found (typescript)
 - composables/apiErrorCode.consumers.spec.ts [75:1 - 111:6] (37 lines, 121 tokens)
   composables/warehouse-refusals-are-translated.spec.ts [94:1 - 127:6]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [21:26 - 81:19] (61 lines, 552 tokens)
   composables/order-audit-pass-four-repro.spec.ts [9:19 - 66:57]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [23:1 - 74:42] (52 lines, 516 tokens)
   composables/order-audit-fuzz-card.spec.ts [14:1 - 69:35]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [23:71 - 31:84] (9 lines, 130 tokens)
   composables/useOrderCard.spec.ts [14:1 - 29:31]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [33:1 - 41:14] (9 lines, 64 tokens)
   composables/useOrderCard.review.spec.ts [29:47 - 38:14]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [41:35 - 81:20] (41 lines, 315 tokens)
   composables/useOrderCard.review.spec.ts [41:6 - 81:20]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [105:39 - 119:94] (15 lines, 90 tokens)
   composables/order-audit-fuzz-card.spec.ts [98:33 - 112:94]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [105:1 - 133:9] (29 lines, 144 tokens)
   services/mocks/order-audit-authority-1.spec.ts [46:1 - 67:9]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [105:29 - 121:31] (17 lines, 108 tokens)
   services/mocks/order-audit-currency-mixing.spec.ts [62:36 - 78:31]
Clone found (typescript)
 - composables/order-audit-concurrency.spec.ts [105:1 - 133:27] (29 lines, 145 tokens)
   services/mocks/order-audit-precision-2.spec.ts [34:1 - 55:10]
Clone found (typescript)
 - composables/order-audit-fuzz-card.spec.ts [85:27 - 98:9] (14 lines, 103 tokens)
   services/mocks/order-audit-fuzz-server.spec.ts [27:41 - 41:9]
Clone found (typescript)
 - composables/order-audit-fuzz-card.spec.ts [89:1 - 98:9] (10 lines, 87 tokens)
   services/mocks/order-audit-fuzz-domain.spec.ts [33:1 - 44:9]
Clone found (typescript)
 - composables/order-audit-fuzz-card.spec.ts [89:1 - 98:9] (10 lines, 87 tokens)
   services/mocks/order-audit-precision-1.spec.ts [29:1 - 40:9]
Clone found (typescript)
 - composables/order-audit-fuzz-card.spec.ts [90:16 - 98:9] (9 lines, 75 tokens)
   services/mocks/orders.ts [275:22 - 303:9]
Clone found (typescript)
 - composables/order-audit-pass-four-repro.spec.ts [8:35 - 19:86] (12 lines, 169 tokens)
   composables/useOrderCard.review.spec.ts [12:47 - 24:76]
Clone found (typescript)
 - composables/useCategories.ts [50:47 - 74:5] (25 lines, 74 tokens)
   composables/useProducts.ts [56:52 - 80:5]
Clone found (typescript)
 - composables/useCategories.ts [52:5 - 76:26] (25 lines, 76 tokens)
   composables/useServices.ts [47:5 - 71:27]
Clone found (typescript)
 - composables/useCategories.ts [59:12 - 76:11] (18 lines, 64 tokens)
   composables/useSuppliers.ts [61:84 - 80:11]
Clone found (typescript)
 - composables/useCategoryCard.ts [60:3 - 69:17] (10 lines, 74 tokens)
   composables/useProductCard.ts [121:3 - 130:17]
Clone found (typescript)
 - composables/useClientCard.spec.ts [11:1 - 19:9] (9 lines, 92 tokens)
   composables/useOrderCreate.spec.ts [11:1 - 19:9]
Clone found (typescript)
 - composables/useOrderCard.spec.ts [141:15 - 159:16] (19 lines, 79 tokens)
   services/mocks/orders.ts [1648:32 - 1666:16]
Clone found (typescript)
 - composables/useOrderCard.ts [1623:19 - 1638:40] (16 lines, 66 tokens)
   composables/useOrderCreate.ts [328:24 - 343:40]
Clone found (typescript)
 - composables/useOrderCard.ts [1937:17 - 1970:16] (34 lines, 63 tokens)
   views/admin/orders/OrderCardPage.vue:typescript [89:17 - 120:14]
Clone found (typescript)
 - composables/useWarehouseBatch.ts [37:1 - 80:16] (44 lines, 270 tokens)
   composables/useWarehouseOffcutCard.ts [45:1 - 88:16]
Clone found (typescript)
 - composables/useWarehouseBatch.ts [69:1 - 78:2] (10 lines, 85 tokens)
   composables/useWarehouseBatchCreate.ts [267:3 - 276:4]
Clone found (typescript)
 - composables/useWarehouseBatch.ts [69:1 - 80:16] (12 lines, 87 tokens)
   composables/useWarehouseOffcutCreate.ts [13:1 - 24:16]
Clone found (typescript)
 - composables/useWarehouseBatch.ts [146:33 - 155:8] (10 lines, 65 tokens)
   composables/useWarehouseOffcutCard.ts [127:34 - 137:8]
Clone found (typescript)
 - composables/useWarehouseBatch.ts [177:12 - 189:10] (13 lines, 86 tokens)
   composables/useWarehouseOffcutCard.ts [144:13 - 156:10]
Clone found (typescript)
 - composables/useWarehouseBatchCreate.ts [87:36 - 103:41] (17 lines, 128 tokens)
   composables/useWarehouseOffcutCreate.ts [76:44 - 93:41]
Clone found (typescript)
 - composables/useWarehouseBatchCreate.ts [88:52 - 104:30] (17 lines, 133 tokens)
   views/admin/orders/AddOrderItemsModal.vue:typescript [155:40 - 172:28]
Clone found (typescript)
 - composables/useWarehouseBatchCreate.ts [104:69 - 121:8] (18 lines, 126 tokens)
   composables/useWarehouseOffcutCreate.ts [94:70 - 113:8]
Clone found (typescript)
 - composables/useWarehouseBatchCreate.ts [104:69 - 119:5] (16 lines, 125 tokens)
   views/admin/orders/AddOrderItemsModal.vue:typescript [172:66 - 188:3]
Clone found (typescript)
 - composables/useWarehouseBatchCreate.ts [279:3 - 295:17] (17 lines, 80 tokens)
   composables/useWarehouseOffcutCreate.ts [164:3 - 180:17]
Clone found (typescript)
 - composables/useWarehouseBatchCreate.ts [295:32 - 305:4] (11 lines, 78 tokens)
   views/admin/warehouse/WarehousePage.vue:typescript [726:23 - 736:2]
Clone found (typescript)
 - composables/useWarehouseDeficitCard.ts [52:36 - 64:12] (13 lines, 67 tokens)
   composables/useWarehouseMovementCard.ts [24:37 - 36:12]
Clone found (typescript)
 - composables/useWarehouseDeficitCard.ts [52:36 - 65:20] (14 lines, 77 tokens)
   composables/useWarehouseOffcutCard.ts [188:35 - 200:41]
Clone found (typescript)
 - composables/useWarehouseOffcutCard.ts [41:1 - 75:2] (35 lines, 184 tokens)
   services/mocks/warehouse.ts [645:1 - 678:2]
Clone found (typescript)
 - mocks/warehouse-batches.ts [1101:43 - 1113:18] (13 lines, 63 tokens)
   mocks/warehouse-batches.ts [1850:43 - 1862:18]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [51:1 - 83:15] (33 lines, 222 tokens)
   services/expectBudgetFollowups.spec.ts [58:1 - 90:15]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [51:1 - 79:10] (29 lines, 214 tokens)
   services/expectBudgetGoto.spec.ts [57:1 - 85:10]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [51:1 - 114:2] (64 lines, 523 tokens)
   services/expectBudgetSuppliers.spec.ts [50:1 - 113:2]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [129:3 - 170:20] (42 lines, 269 tokens)
   services/expectBudgetWarehouse.spec.ts [118:3 - 158:3]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [132:57 - 150:6] (19 lines, 120 tokens)
   services/expectBudgetFollowups.spec.ts [153:57 - 171:6]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [132:57 - 150:6] (19 lines, 120 tokens)
   services/expectBudgetSuppliers.spec.ts [124:56 - 142:6]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [145:7 - 161:15] (17 lines, 125 tokens)
   services/expectBudgetGoto.spec.ts [153:7 - 166:15]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [148:3 - 158:5] (11 lines, 71 tokens)
   services/expectBudgetFollowups.spec.ts [185:3 - 195:5]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [156:5 - 169:6] (14 lines, 64 tokens)
   services/expectBudgetFollowups.spec.ts [174:28 - 187:6]
Clone found (typescript)
 - services/expectBudgetClients.spec.ts [161:31 - 176:3] (16 lines, 80 tokens)
   services/expectBudgetGoto.spec.ts [166:28 - 181:3]
Clone found (typescript)
 - services/expectBudgetFollowups.spec.ts [181:7 - 196:3] (16 lines, 88 tokens)
   services/expectBudgetSuppliers.spec.ts [146:7 - 161:3]
Clone found (typescript)
 - services/expectBudgetSuppliers.spec.ts [43:50 - 115:10] (73 lines, 531 tokens)
   services/expectBudgetWarehouse.spec.ts [40:46 - 112:10]
Clone found (typescript)
 - services/expectPollBudget.spec.ts [22:1 - 37:2] (16 lines, 132 tokens)
   services/expectUrlBudget.spec.ts [24:1 - 39:2]
Clone found (typescript)
 - services/expectPollBudget.spec.ts [22:1 - 40:9] (19 lines, 133 tokens)
   services/snapshotBudget.spec.ts [22:1 - 40:9]
Clone found (typescript)
 - services/expectPollBudget.spec.ts [43:3 - 55:10] (13 lines, 129 tokens)
   services/snapshotBudget.spec.ts [43:3 - 55:10]
Clone found (typescript)
 - services/mocks/bcc-history-rows.spec.ts [78:153 - 87:16] (10 lines, 61 tokens)
   services/mocks/bcc-history-rows.spec.ts [90:135 - 99:16]
Clone found (typescript)
 - services/mocks/bcc-refusals.spec.ts [46:69 - 56:5] (11 lines, 61 tokens)
   services/mocks/bcc-refusals.spec.ts [61:43 - 71:5]
Clone found (typescript)
 - services/mocks/bcc.ts [488:1 - 507:12] (20 lines, 107 tokens)
   services/mocks/bcc.ts [520:51 - 535:12]
Clone found (typescript)
 - services/mocks/categories.ts [23:11 - 48:7] (26 lines, 124 tokens)
   services/mocks/categories.ts [87:20 - 112:7]
Clone found (typescript)
 - services/mocks/categories.ts [45:17 - 67:12] (23 lines, 94 tokens)
   services/mocks/categories.ts [155:17 - 177:12]
Clone found (typescript)
 - services/mocks/categories.ts [45:17 - 63:18] (19 lines, 83 tokens)
   services/mocks/categories.ts [843:17 - 861:18]
Clone found (typescript)
 - services/mocks/categories.ts [86:21 - 111:9] (26 lines, 124 tokens)
   services/mocks/categories.ts [192:20 - 217:9]
Clone found (typescript)
 - services/mocks/categories.ts [86:21 - 115:12] (30 lines, 132 tokens)
   services/mocks/categories.ts [292:20 - 321:12]
Clone found (typescript)
 - services/mocks/categories.ts [86:21 - 115:12] (30 lines, 132 tokens)
   services/mocks/categories.ts [525:20 - 554:12]
Clone found (typescript)
 - services/mocks/categories.ts [114:7 - 149:9] (36 lines, 202 tokens)
   services/mocks/categories.ts [218:7 - 253:9]
Clone found (typescript)
 - services/mocks/categories.ts [152:97 - 169:12] (18 lines, 68 tokens)
   services/mocks/categories.ts [1185:9 - 1202:12]
Clone found (typescript)
 - services/mocks/categories.ts [377:17 - 392:20] (16 lines, 62 tokens)
   services/mocks/categories.ts [1077:17 - 1092:20]
Clone found (typescript)
 - services/mocks/categories.ts [414:17 - 422:8] (9 lines, 65 tokens)
   services/mocks/products.ts [604:25 - 612:8]
Clone found (typescript)
 - services/mocks/categories.ts [524:18 - 554:12] (31 lines, 136 tokens)
   services/mocks/categories.ts [648:18 - 678:12]
Clone found (typescript)
 - services/mocks/categories.ts [524:18 - 554:12] (31 lines, 136 tokens)
   services/mocks/categories.ts [1109:18 - 1139:12]
Clone found (typescript)
 - services/mocks/categories.ts [558:17 - 567:8] (10 lines, 79 tokens)
   services/mocks/products.ts [11851:25 - 11860:8]
Clone found (typescript)
 - services/mocks/categories.ts [646:44 - 678:12] (33 lines, 142 tokens)
   services/mocks/categories.ts [756:67 - 788:12]
Clone found (typescript)
 - services/mocks/categories.ts [646:44 - 678:12] (33 lines, 142 tokens)
   services/mocks/categories.ts [873:41 - 905:12]
Clone found (typescript)
 - services/mocks/categories.ts [646:44 - 678:12] (33 lines, 142 tokens)
   services/mocks/categories.ts [992:103 - 1024:12]
Clone found (typescript)
 - services/mocks/categories.ts [718:20 - 740:12] (23 lines, 84 tokens)
   services/mocks/categories.ts [835:20 - 857:12]
Clone found (typescript)
 - services/mocks/categories.ts [718:20 - 740:12] (23 lines, 84 tokens)
   services/mocks/categories.ts [1069:21 - 1091:12]
Clone found (typescript)
 - services/mocks/categories.ts [726:17 - 750:8] (25 lines, 98 tokens)
   services/mocks/categories.ts [1188:17 - 1212:8]
Clone found (typescript)
 - services/mocks/categories.ts [925:17 - 933:8] (9 lines, 65 tokens)
   services/mocks/products.ts [12758:25 - 12766:8]
Clone found (typescript)
 - services/mocks/categories.ts [1028:17 - 1036:8] (9 lines, 65 tokens)
   services/mocks/products.ts [13015:25 - 13023:8]
Clone found (typescript)
 - services/mocks/categories.ts [1107:51 - 1139:12] (33 lines, 142 tokens)
   services/mocks/categories.ts [1218:45 - 1250:12]
Clone found (typescript)
 - services/mocks/categories.ts [1151:17 - 1159:8] (9 lines, 65 tokens)
   services/mocks/products.ts [13312:25 - 13320:8]
Clone found (typescript)
 - services/mocks/categories.ts [1254:17 - 1265:8] (12 lines, 107 tokens)
   services/mocks/products.ts [13573:25 - 13584:8]
Clone found (typescript)
 - services/mocks/config-notifications-finance-refusals.spec.ts [22:90 - 32:34] (11 lines, 60 tokens)
   services/mocks/config-store-is-a-server.spec.ts [47:73 - 57:34]
Clone found (typescript)
 - services/mocks/idempotency-scope.spec.ts [153:83 - 166:10] (14 lines, 106 tokens)
   services/mocks/idempotency-scope.spec.ts [223:29 - 237:12]
Clone found (typescript)
 - services/mocks/offcut-order-pick.spec.ts [229:137 - 242:10] (14 lines, 73 tokens)
   services/mocks/offcut-order-pick.spec.ts [291:111 - 303:10]
Clone found (typescript)
 - services/mocks/offcut-order-pick.spec.ts [429:140 - 440:10] (12 lines, 65 tokens)
   services/mocks/offcut-order-pick.spec.ts [505:111 - 517:10]
Clone found (typescript)
 - services/mocks/offcut-order-pick.spec.ts [429:140 - 439:7] (11 lines, 64 tokens)
   services/mocks/offcut-order-pick.spec.ts [536:124 - 546:7]
Clone found (typescript)
 - services/mocks/offcut-order-pick.spec.ts [429:140 - 439:7] (11 lines, 64 tokens)
   services/mocks/offcut-order-pick.spec.ts [612:145 - 622:7]
Clone found (typescript)
 - services/mocks/order-audit-authority-1.spec.ts [33:39 - 65:2] (33 lines, 264 tokens)
   services/mocks/order-audit-portability.spec.ts [41:60 - 73:2]
Clone found (typescript)
 - services/mocks/order-audit-authority-1.spec.ts [35:1 - 67:9] (33 lines, 256 tokens)
   services/mocks/order-audit-authority-2.spec.ts [39:1 - 70:9]
Clone found (typescript)
 - services/mocks/order-audit-authority-1.spec.ts [43:1 - 60:13] (18 lines, 99 tokens)
   services/mocks/order-audit-service-invoicing.spec.ts [46:1 - 64:13]
Clone found (typescript)
 - services/mocks/order-audit-authority-2.spec.ts [38:1 - 47:9] (10 lines, 90 tokens)
   services/mocks/order-audit-wire-schema.spec.ts [31:1 - 40:9]
Clone found (typescript)
 - services/mocks/order-audit-fuzz-server.spec.ts [41:25 - 55:13] (15 lines, 67 tokens)
   services/mocks/order-audit-pass-three-repro.spec.ts [27:23 - 41:13]
Clone found (typescript)
 - services/mocks/order-audit-ledger-orphans.spec.ts [38:18 - 50:6] (13 lines, 60 tokens)
   services/mocks/order-audit-ledger-reconcile.spec.ts [42:18 - 47:6]
Clone found (typescript)
 - services/mocks/order-audit-ledger-orphans.spec.ts [117:86 - 152:9] (36 lines, 245 tokens)
   services/mocks/order-audit-ledger-reconcile.spec.ts [66:90 - 104:9]
Clone found (typescript)
 - services/mocks/order-audit-pass-three-repro.spec.ts [24:1 - 43:2] (20 lines, 133 tokens)
   services/mocks/order-audit-pass-two-repro.spec.ts [36:1 - 55:2]
Clone found (typescript)
 - services/mocks/order-audit-pass-three-repro.spec.ts [28:9 - 45:9] (18 lines, 94 tokens)
   services/mocks/order-audit-pass-two-repro.spec.ts [40:9 - 56:9]
Clone found (typescript)
 - services/mocks/order-audit-precision-2.spec.ts [32:46 - 55:9] (24 lines, 154 tokens)
   services/mocks/order-audit-wire-schema.spec.ts [38:38 - 62:9]
Clone found (typescript)
 - services/mocks/order-audit-service-invoicing.spec.ts [217:58 - 226:91] (10 lines, 132 tokens)
   services/mocks/order-audit-service-invoicing.spec.ts [257:75 - 265:91]
Clone found (typescript)
 - services/mocks/orders.spec.ts [741:75 - 752:44] (12 lines, 64 tokens)
   services/mocks/orders.spec.ts [1306:62 - 1317:44]
Clone found (typescript)
 - services/mocks/orders.spec.ts [997:32 - 1005:79] (9 lines, 73 tokens)
   services/mocks/orders.spec.ts [3632:83 - 3640:79]
Clone found (typescript)
 - services/mocks/orders.spec.ts [1288:79 - 1303:32] (16 lines, 76 tokens)
   services/mocks/orders.spec.ts [2792:77 - 2808:32]
Clone found (typescript)
 - services/mocks/orders.spec.ts [1650:65 - 1663:6] (14 lines, 69 tokens)
   services/mocks/orders.spec.ts [3029:82 - 3041:6]
Clone found (typescript)
 - services/mocks/orders.spec.ts [2198:67 - 2211:7] (14 lines, 67 tokens)
   services/mocks/orders.spec.ts [2221:52 - 2231:7]
Clone found (typescript)
 - services/mocks/orders.spec.ts [3630:71 - 3640:79] (11 lines, 104 tokens)
   services/mocks/orders.spec.ts [3665:67 - 3675:79]
Clone found (typescript)
 - services/mocks/orders.spec.ts [3630:71 - 3640:79] (11 lines, 104 tokens)
   services/mocks/orders.spec.ts [3734:81 - 3744:79]
Clone found (typescript)
 - services/mocks/orders.spec.ts [3630:71 - 3642:14] (13 lines, 113 tokens)
   services/mocks/orders.spec.ts [3765:83 - 3779:46]
Clone found (typescript)
 - services/mocks/products.ts [56:28 - 70:15] (15 lines, 71 tokens)
   services/mocks/products.ts [295:28 - 309:15]
Clone found (typescript)
 - services/mocks/products.ts [56:28 - 70:15] (15 lines, 71 tokens)
   services/mocks/products.ts [1342:6 - 1356:15]
Clone found (typescript)
 - services/mocks/products.ts [70:26 - 86:15] (17 lines, 79 tokens)
   services/mocks/products.ts [888:26 - 904:15]
Clone found (typescript)
 - services/mocks/products.ts [70:26 - 86:15] (17 lines, 79 tokens)
   services/mocks/products.ts [1082:26 - 1098:15]
Clone found (typescript)
 - services/mocks/products.ts [70:26 - 86:15] (17 lines, 79 tokens)
   services/mocks/products.ts [1622:26 - 1638:15]
Clone found (typescript)
 - services/mocks/products.ts [70:26 - 122:15] (53 lines, 281 tokens)
   services/mocks/products.ts [6627:28 - 6679:15]
Clone found (typescript)
 - services/mocks/products.ts [70:26 - 129:12] (60 lines, 302 tokens)
   services/mocks/products.ts [10491:26 - 10550:12]
Clone found (typescript)
 - services/mocks/products.ts [78:20 - 106:15] (29 lines, 161 tokens)
   services/mocks/products.ts [2025:20 - 2053:15]
Clone found (typescript)
 - services/mocks/products.ts [78:20 - 94:15] (17 lines, 79 tokens)
   services/mocks/products.ts [6514:20 - 6530:15]
Clone found (typescript)
 - services/mocks/products.ts [78:20 - 122:15] (45 lines, 241 tokens)
   services/mocks/products.ts [10870:20 - 10914:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 106:15] (21 lines, 121 tokens)
   services/mocks/products.ts [1098:17 - 1118:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 106:15] (21 lines, 121 tokens)
   services/mocks/products.ts [1235:17 - 1255:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 122:15] (37 lines, 201 tokens)
   services/mocks/products.ts [1372:17 - 1408:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 122:15] (37 lines, 201 tokens)
   services/mocks/products.ts [1501:18 - 1537:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 114:15] (29 lines, 161 tokens)
   services/mocks/products.ts [1904:17 - 1932:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 122:15] (37 lines, 201 tokens)
   services/mocks/products.ts [5998:18 - 6034:15]
Clone found (typescript)
 - services/mocks/products.ts [86:17 - 122:15] (37 lines, 201 tokens)
   services/mocks/products.ts [7790:17 - 7826:15]
Clone found (typescript)
 - services/mocks/products.ts [94:28 - 106:15] (13 lines, 81 tokens)
   services/mocks/products.ts [215:29 - 227:15]
Clone found (typescript)
 - services/mocks/products.ts [94:28 - 106:15] (13 lines, 81 tokens)
   services/mocks/products.ts [912:28 - 924:15]
Clone found (typescript)
 - services/mocks/products.ts [114:20 - 129:12] (16 lines, 60 tokens)
   services/mocks/products.ts [5905:20 - 5920:12]
Clone found (typescript)
 - services/mocks/products.ts [191:28 - 207:15] (17 lines, 79 tokens)
   services/mocks/products.ts [2017:24 - 2033:15]
Clone found (typescript)
 - services/mocks/products.ts [199:20 - 215:15] (17 lines, 79 tokens)
   services/mocks/products.ts [1364:20 - 1380:15]
Clone found (typescript)
 - services/mocks/products.ts [199:20 - 243:15] (45 lines, 241 tokens)
   services/mocks/products.ts [2162:20 - 2206:15]
Clone found (typescript)
 - services/mocks/products.ts [199:20 - 243:15] (45 lines, 241 tokens)
   services/mocks/products.ts [2432:20 - 2476:15]
Clone found (typescript)
 - services/mocks/products.ts [199:20 - 243:15] (45 lines, 241 tokens)
   services/mocks/products.ts [6381:20 - 6425:15]
Clone found (typescript)
 - services/mocks/products.ts [207:17 - 243:15] (37 lines, 201 tokens)
   services/mocks/products.ts [1638:17 - 1674:15]
Clone found (typescript)
 - services/mocks/products.ts [207:17 - 243:15] (37 lines, 201 tokens)
   services/mocks/products.ts [6135:19 - 6171:15]
Clone found (typescript)
 - services/mocks/products.ts [207:17 - 243:15] (37 lines, 201 tokens)
   services/mocks/products.ts [6522:17 - 6558:15]
Clone found (typescript)
 - services/mocks/products.ts [301:24 - 325:15] (25 lines, 119 tokens)
   services/mocks/products.ts [442:24 - 466:15]
Clone found (typescript)
 - services/mocks/products.ts [301:24 - 325:15] (25 lines, 119 tokens)
   services/mocks/products.ts [2848:25 - 2872:15]
Clone found (typescript)
 - services/mocks/products.ts [309:26 - 325:15] (17 lines, 79 tokens)
   services/mocks/products.ts [2558:26 - 2574:15]
Clone found (typescript)
 - services/mocks/products.ts [309:26 - 353:15] (45 lines, 200 tokens)
   services/mocks/products.ts [3150:26 - 3194:15]
Clone found (typescript)
 - services/mocks/products.ts [309:26 - 325:15] (17 lines, 79 tokens)
   services/mocks/products.ts [7322:26 - 7338:15]
Clone found (typescript)
 - services/mocks/products.ts [309:26 - 325:15] (17 lines, 79 tokens)
   services/mocks/products.ts [7626:26 - 7642:15]
Clone found (typescript)
 - services/mocks/products.ts [325:18 - 369:15] (45 lines, 203 tokens)
   services/mocks/products.ts [2872:18 - 2916:15]
Clone found (typescript)
 - services/mocks/products.ts [325:18 - 365:13] (41 lines, 188 tokens)
   services/mocks/products.ts [7486:18 - 7525:15]
Clone found (typescript)
 - services/mocks/products.ts [325:18 - 365:13] (41 lines, 188 tokens)
   services/mocks/products.ts [11420:19 - 11459:15]
Clone found (typescript)
 - services/mocks/products.ts [325:18 - 375:48] (51 lines, 228 tokens)
   services/mocks/products.ts [11572:19 - 11619:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 377:15] (41 lines, 202 tokens)
   services/mocks/products.ts [478:17 - 518:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 369:15] (33 lines, 162 tokens)
   services/mocks/products.ts [2586:19 - 2618:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 369:15] (33 lines, 162 tokens)
   services/mocks/products.ts [2727:17 - 2759:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 369:15] (33 lines, 162 tokens)
   services/mocks/products.ts [3041:17 - 3073:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 369:15] (33 lines, 162 tokens)
   services/mocks/products.ts [3460:17 - 3492:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 365:13] (29 lines, 147 tokens)
   services/mocks/products.ts [7654:20 - 7681:15]
Clone found (typescript)
 - services/mocks/products.ts [337:17 - 365:13] (29 lines, 147 tokens)
   services/mocks/products.ts [8083:20 - 8110:15]
Clone found (typescript)
 - services/mocks/products.ts [345:20 - 369:15] (25 lines, 122 tokens)
   services/mocks/products.ts [3629:20 - 3653:15]
Clone found (typescript)
 - services/mocks/products.ts [345:20 - 369:15] (25 lines, 122 tokens)
   services/mocks/products.ts [3923:20 - 3947:15]
Clone found (typescript)
 - services/mocks/products.ts [353:23 - 377:15] (25 lines, 122 tokens)
   services/mocks/products.ts [3194:24 - 3218:15]
Clone found (typescript)
 - services/mocks/products.ts [353:23 - 377:15] (25 lines, 122 tokens)
   services/mocks/products.ts [3339:29 - 3363:15]
Clone found (typescript)
 - services/mocks/products.ts [369:20 - 389:15] (21 lines, 80 tokens)
   services/mocks/products.ts [11459:19 - 11479:15]
Clone found (typescript)
 - services/mocks/products.ts [436:28 - 450:15] (15 lines, 71 tokens)
   services/mocks/products.ts [1068:6 - 1082:15]
Clone found (typescript)
 - services/mocks/products.ts [458:20 - 478:15] (21 lines, 80 tokens)
   services/mocks/products.ts [11564:20 - 11584:15]
Clone found (typescript)
 - services/mocks/products.ts [597:28 - 624:15] (28 lines, 167 tokens)
   services/mocks/products.ts [4011:6 - 4038:15]
Clone found (typescript)
 - services/mocks/products.ts [603:20 - 616:15] (14 lines, 95 tokens)
   services/mocks/products.ts [697:19 - 710:15]
Clone found (typescript)
 - services/mocks/products.ts [603:20 - 633:15] (31 lines, 176 tokens)
   services/mocks/products.ts [4381:21 - 4411:15]
Clone found (typescript)
 - services/mocks/products.ts [710:20 - 725:12] (16 lines, 60 tokens)
   services/mocks/products.ts [4304:21 - 4319:12]
Clone found (typescript)
 - services/mocks/products.ts [787:23 - 803:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5027:28 - 5043:15]
Clone found (typescript)
 - services/mocks/products.ts [787:23 - 803:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5290:24 - 5306:15]
Clone found (typescript)
 - services/mocks/products.ts [787:23 - 803:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5480:29 - 5496:15]
Clone found (typescript)
 - services/mocks/products.ts [787:23 - 803:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5666:27 - 5682:15]
Clone found (typescript)
 - services/mocks/products.ts [880:24 - 904:15] (25 lines, 119 tokens)
   services/mocks/products.ts [1735:23 - 1759:15]
Clone found (typescript)
 - services/mocks/products.ts [896:20 - 912:15] (17 lines, 79 tokens)
   services/mocks/products.ts [6127:20 - 6143:15]
Clone found (typescript)
 - services/mocks/products.ts [904:19 - 940:15] (37 lines, 201 tokens)
   services/mocks/products.ts [1759:19 - 1795:15]
Clone found (typescript)
 - services/mocks/products.ts [904:19 - 940:15] (37 lines, 201 tokens)
   services/mocks/products.ts [10999:19 - 11035:15]
Clone found (typescript)
 - services/mocks/products.ts [1067:86 - 1098:15] (32 lines, 153 tokens)
   services/mocks/products.ts [1204:92 - 1235:15]
Clone found (typescript)
 - services/mocks/products.ts [1067:86 - 1098:15] (32 lines, 153 tokens)
   services/mocks/products.ts [2998:73 - 3029:15]
Clone found (typescript)
 - services/mocks/products.ts [1067:86 - 1082:15] (16 lines, 73 tokens)
   services/mocks/products.ts [3280:78 - 3295:15]
Clone found (typescript)
 - services/mocks/products.ts [1074:24 - 1098:15] (25 lines, 119 tokens)
   services/mocks/products.ts [1348:24 - 1372:15]
Clone found (typescript)
 - services/mocks/products.ts [1074:24 - 1098:15] (25 lines, 119 tokens)
   services/mocks/products.ts [1880:24 - 1904:15]
Clone found (typescript)
 - services/mocks/products.ts [1074:24 - 1098:15] (25 lines, 119 tokens)
   services/mocks/products.ts [5974:26 - 5998:15]
Clone found (typescript)
 - services/mocks/products.ts [1074:24 - 1141:12] (68 lines, 342 tokens)
   services/mocks/products.ts [6756:28 - 6823:12]
Clone found (typescript)
 - services/mocks/products.ts [1090:20 - 1134:15] (45 lines, 241 tokens)
   services/mocks/products.ts [6256:20 - 6300:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1372:15] (32 lines, 153 tokens)
   services/mocks/products.ts [1470:74 - 1501:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1372:15] (32 lines, 153 tokens)
   services/mocks/products.ts [2684:64 - 2715:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [3135:92 - 3150:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1408:15] (68 lines, 355 tokens)
   services/mocks/products.ts [5846:68 - 5913:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1408:15] (68 lines, 355 tokens)
   services/mocks/products.ts [6878:90 - 6945:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1380:28] (40 lines, 194 tokens)
   services/mocks/products.ts [7015:87 - 7058:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [7611:83 - 7626:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1372:15] (32 lines, 153 tokens)
   services/mocks/products.ts [7759:75 - 7790:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1372:15] (32 lines, 153 tokens)
   services/mocks/products.ts [8040:77 - 8071:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1380:28] (40 lines, 194 tokens)
   services/mocks/products.ts [8360:88 - 8403:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1372:15] (32 lines, 153 tokens)
   services/mocks/products.ts [11097:90 - 11128:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [11819:87 - 11834:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [12142:92 - 12157:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [12425:91 - 12440:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [12983:103 - 12998:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [13272:69 - 13287:15]
Clone found (typescript)
 - services/mocks/products.ts [1341:75 - 1356:15] (16 lines, 73 tokens)
   services/mocks/products.ts [13541:91 - 13556:15]
Clone found (typescript)
 - services/mocks/products.ts [1607:65 - 1681:12] (75 lines, 376 tokens)
   services/mocks/products.ts [10597:88 - 10671:12]
Clone found (typescript)
 - services/mocks/products.ts [1630:20 - 1658:15] (29 lines, 161 tokens)
   services/mocks/products.ts [2295:20 - 2323:15]
Clone found (typescript)
 - services/mocks/products.ts [1728:63 - 1743:15] (16 lines, 73 tokens)
   services/mocks/products.ts [10476:70 - 10491:15]
Clone found (typescript)
 - services/mocks/products.ts [1728:63 - 1759:15] (32 lines, 153 tokens)
   services/mocks/products.ts [10968:65 - 10999:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1888:15] (16 lines, 73 tokens)
   services/mocks/products.ts [7167:91 - 7182:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1938:56] (66 lines, 342 tokens)
   services/mocks/products.ts [8200:103 - 8270:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1904:15] (32 lines, 153 tokens)
   services/mocks/products.ts [11389:100 - 11420:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1888:15] (16 lines, 73 tokens)
   services/mocks/products.ts [11982:103 - 11997:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1888:15] (16 lines, 73 tokens)
   services/mocks/products.ts [12287:90 - 12302:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1888:15] (16 lines, 73 tokens)
   services/mocks/products.ts [12577:86 - 12592:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1888:15] (16 lines, 73 tokens)
   services/mocks/products.ts [13137:97 - 13152:15]
Clone found (typescript)
 - services/mocks/products.ts [1873:80 - 1888:15] (16 lines, 73 tokens)
   services/mocks/products.ts [13690:91 - 13705:15]
Clone found (typescript)
 - services/mocks/products.ts [1932:20 - 1947:12] (16 lines, 60 tokens)
   services/mocks/products.ts [6671:20 - 6686:12]
Clone found (typescript)
 - services/mocks/products.ts [2002:76 - 2033:15] (32 lines, 153 tokens)
   services/mocks/products.ts [6233:72 - 6264:15]
Clone found (typescript)
 - services/mocks/products.ts [2009:22 - 2025:15] (17 lines, 79 tokens)
   services/mocks/products.ts [10854:28 - 10870:15]
Clone found (typescript)
 - services/mocks/products.ts [2139:78 - 2154:15] (16 lines, 73 tokens)
   services/mocks/products.ts [3417:78 - 3432:15]
Clone found (typescript)
 - services/mocks/products.ts [2146:21 - 2162:15] (17 lines, 79 tokens)
   services/mocks/products.ts [6111:22 - 6127:15]
Clone found (typescript)
 - services/mocks/products.ts [2154:26 - 2206:15] (53 lines, 281 tokens)
   services/mocks/products.ts [10737:28 - 10789:15]
Clone found (typescript)
 - services/mocks/products.ts [2198:20 - 2213:12] (16 lines, 60 tokens)
   services/mocks/products.ts [10781:20 - 10796:12]
Clone found (typescript)
 - services/mocks/products.ts [2279:24 - 2295:15] (17 lines, 79 tokens)
   services/mocks/products.ts [6365:24 - 6381:15]
Clone found (typescript)
 - services/mocks/products.ts [2279:24 - 2295:15] (17 lines, 79 tokens)
   services/mocks/products.ts [6498:23 - 6514:15]
Clone found (typescript)
 - services/mocks/products.ts [2543:76 - 2558:15] (16 lines, 73 tokens)
   services/mocks/products.ts [7307:93 - 7322:15]
Clone found (typescript)
 - services/mocks/products.ts [2543:76 - 2574:15] (32 lines, 153 tokens)
   services/mocks/products.ts [11245:82 - 11276:15]
Clone found (typescript)
 - services/mocks/products.ts [2715:18 - 2743:15] (29 lines, 120 tokens)
   services/mocks/products.ts [3311:18 - 3339:15]
Clone found (typescript)
 - services/mocks/products.ts [2715:18 - 2735:15] (21 lines, 80 tokens)
   services/mocks/products.ts [3903:18 - 3923:15]
Clone found (typescript)
 - services/mocks/products.ts [2715:18 - 2755:13] (41 lines, 188 tokens)
   services/mocks/products.ts [7198:18 - 7237:15]
Clone found (typescript)
 - services/mocks/products.ts [2715:18 - 2755:13] (41 lines, 188 tokens)
   services/mocks/products.ts [8391:19 - 8430:15]
Clone found (typescript)
 - services/mocks/products.ts [2715:18 - 2755:13] (41 lines, 188 tokens)
   services/mocks/products.ts [11276:18 - 11315:15]
Clone found (typescript)
 - services/mocks/products.ts [2757:9 - 2770:9] (14 lines, 61 tokens)
   services/mocks/products.ts [7083:111 - 7096:9]
Clone found (typescript)
 - services/mocks/products.ts [2759:18 - 2776:15] (18 lines, 80 tokens)
   services/mocks/products.ts [3210:20 - 3227:15]
Clone found (typescript)
 - services/mocks/products.ts [2914:9 - 2927:9] (14 lines, 61 tokens)
   services/mocks/products.ts [8268:111 - 8281:9]
Clone found (typescript)
 - services/mocks/products.ts [2916:19 - 2933:15] (18 lines, 80 tokens)
   services/mocks/products.ts [3355:20 - 3372:15]
Clone found (typescript)
 - services/mocks/products.ts [3142:24 - 3178:15] (37 lines, 160 tokens)
   services/mocks/products.ts [3287:24 - 3323:15]
Clone found (typescript)
 - services/mocks/products.ts [3142:24 - 3178:15] (37 lines, 160 tokens)
   services/mocks/products.ts [7174:24 - 7210:15]
Clone found (typescript)
 - services/mocks/products.ts [3432:28 - 3448:15] (17 lines, 79 tokens)
   services/mocks/products.ts [7903:28 - 7919:15]
Clone found (typescript)
 - services/mocks/products.ts [3440:20 - 3488:13] (49 lines, 228 tokens)
   services/mocks/products.ts [11120:20 - 11167:15]
Clone found (typescript)
 - services/mocks/products.ts [3448:18 - 3468:15] (21 lines, 80 tokens)
   services/mocks/products.ts [3609:18 - 3629:15]
Clone found (typescript)
 - services/mocks/products.ts [3448:18 - 3476:15] (29 lines, 120 tokens)
   services/mocks/products.ts [7046:18 - 7074:15]
Clone found (typescript)
 - services/mocks/products.ts [3490:9 - 3503:9] (14 lines, 61 tokens)
   services/mocks/products.ts [11165:111 - 11178:9]
Clone found (typescript)
 - services/mocks/products.ts [3601:20 - 3649:13] (49 lines, 228 tokens)
   services/mocks/products.ts [7911:20 - 7958:15]
Clone found (typescript)
 - services/mocks/products.ts [3621:17 - 3653:15] (33 lines, 162 tokens)
   services/mocks/products.ts [3762:17 - 3794:15]
Clone found (typescript)
 - services/mocks/products.ts [3651:9 - 3664:9] (14 lines, 61 tokens)
   services/mocks/products.ts [7956:111 - 7969:9]
Clone found (typescript)
 - services/mocks/products.ts [3895:20 - 3935:16] (41 lines, 186 tokens)
   services/mocks/products.ts [7330:20 - 7370:16]
Clone found (typescript)
 - services/mocks/products.ts [3895:20 - 3972:39] (78 lines, 350 tokens)
   services/mocks/products.ts [8527:20 - 8603:15]
Clone found (typescript)
 - services/mocks/products.ts [3945:9 - 3958:9] (14 lines, 61 tokens)
   services/mocks/products.ts [7375:111 - 7388:9]
Clone found (typescript)
 - services/mocks/products.ts [3992:15 - 4008:10] (17 lines, 62 tokens)
   services/mocks/products.ts [8646:15 - 8662:10]
Clone found (typescript)
 - services/mocks/products.ts [4010:66 - 4047:15] (38 lines, 210 tokens)
   services/mocks/products.ts [4100:63 - 4137:15]
Clone found (typescript)
 - services/mocks/products.ts [4010:66 - 4038:15] (29 lines, 169 tokens)
   services/mocks/products.ts [4190:66 - 4218:15]
Clone found (typescript)
 - services/mocks/products.ts [4010:66 - 4038:15] (29 lines, 169 tokens)
   services/mocks/products.ts [4284:77 - 4312:15]
Clone found (typescript)
 - services/mocks/products.ts [4030:21 - 4045:12] (16 lines, 60 tokens)
   services/mocks/products.ts [9472:20 - 9487:12]
Clone found (typescript)
 - services/mocks/products.ts [4172:16 - 4188:10] (17 lines, 62 tokens)
   services/mocks/products.ts [8824:15 - 8840:10]
Clone found (typescript)
 - services/mocks/products.ts [4355:19 - 4372:10] (18 lines, 66 tokens)
   services/mocks/products.ts [8997:20 - 9014:10]
Clone found (typescript)
 - services/mocks/products.ts [4374:76 - 4411:15] (38 lines, 210 tokens)
   services/mocks/products.ts [4464:72 - 4501:15]
Clone found (typescript)
 - services/mocks/products.ts [4374:76 - 4411:15] (38 lines, 210 tokens)
   services/mocks/products.ts [4570:69 - 4607:15]
Clone found (typescript)
 - services/mocks/products.ts [4374:76 - 4411:15] (38 lines, 210 tokens)
   services/mocks/products.ts [4660:69 - 4697:15]
Clone found (typescript)
 - services/mocks/products.ts [4374:76 - 4411:15] (38 lines, 210 tokens)
   services/mocks/products.ts [4746:66 - 4783:15]
Clone found (typescript)
 - services/mocks/products.ts [4374:76 - 4411:15] (38 lines, 210 tokens)
   services/mocks/products.ts [4832:71 - 4869:15]
Clone found (typescript)
 - services/mocks/products.ts [4922:24 - 4938:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5197:22 - 5213:15]
Clone found (typescript)
 - services/mocks/products.ts [4922:24 - 4938:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5379:24 - 5395:15]
Clone found (typescript)
 - services/mocks/products.ts [4922:24 - 4938:15] (17 lines, 79 tokens)
   services/mocks/products.ts [5767:23 - 5783:15]
Clone found (typescript)
 - services/mocks/products.ts [6749:63 - 6823:12] (75 lines, 376 tokens)
   services/mocks/products.ts [11701:95 - 11775:12]
Clone found (typescript)
 - services/mocks/products.ts [7074:25 - 7085:15] (12 lines, 67 tokens)
   services/mocks/products.ts [7366:23 - 7377:15]
Clone found (typescript)
 - services/mocks/products.ts [7085:18 - 7105:15] (21 lines, 80 tokens)
   services/mocks/products.ts [7237:18 - 7257:15]
Clone found (typescript)
 - services/mocks/products.ts [7314:22 - 7338:15] (25 lines, 119 tokens)
   services/mocks/products.ts [7462:22 - 7486:15]
Clone found (typescript)
 - services/mocks/products.ts [7377:18 - 7397:15] (21 lines, 80 tokens)
   services/mocks/products.ts [8430:19 - 8450:15]
Clone found (typescript)
 - services/mocks/products.ts [7888:79 - 7903:15] (16 lines, 73 tokens)
   services/mocks/products.ts [10722:83 - 10737:15]
Clone found (typescript)
 - services/mocks/products.ts [7895:26 - 7911:15] (17 lines, 79 tokens)
   services/mocks/products.ts [8511:27 - 8527:15]
Clone found (typescript)
 - services/mocks/products.ts [8504:81 - 8535:15] (32 lines, 153 tokens)
   services/mocks/products.ts [11541:90 - 11572:15]
Clone found (typescript)
 - services/mocks/products.ts [8664:70 - 8691:15] (28 lines, 155 tokens)
   services/mocks/products.ts [8745:79 - 8772:15]
Clone found (typescript)
 - services/mocks/products.ts [8664:70 - 8691:15] (28 lines, 155 tokens)
   services/mocks/products.ts [9453:91 - 9480:15]
Clone found (typescript)
 - services/mocks/products.ts [8671:27 - 8691:15] (21 lines, 121 tokens)
   services/mocks/products.ts [8849:22 - 8869:15]
Clone found (typescript)
 - services/mocks/products.ts [8671:27 - 8691:15] (21 lines, 121 tokens)
   services/mocks/products.ts [9023:21 - 9043:15]
Clone found (typescript)
 - services/mocks/products.ts [8842:63 - 8869:15] (28 lines, 155 tokens)
   services/mocks/products.ts [8939:85 - 8966:15]
Clone found (typescript)
 - services/mocks/products.ts [9016:67 - 9043:15] (28 lines, 155 tokens)
   services/mocks/products.ts [9113:87 - 9140:15]
Clone found (typescript)
 - services/mocks/products.ts [9016:67 - 9043:15] (28 lines, 155 tokens)
   services/mocks/products.ts [9198:68 - 9225:15]
Clone found (typescript)
 - services/mocks/products.ts [9016:67 - 9043:15] (28 lines, 155 tokens)
   services/mocks/products.ts [9283:62 - 9310:15]
Clone found (typescript)
 - services/mocks/products.ts [9016:67 - 9043:15] (28 lines, 155 tokens)
   services/mocks/products.ts [9372:67 - 9399:15]
Clone found (typescript)
 - services/mocks/products.ts [9435:16 - 9451:10] (17 lines, 62 tokens)
   services/mocks/products.ts [10704:17 - 10720:10]
Clone found (typescript)
 - services/mocks/products.ts [11826:24 - 11850:15] (25 lines, 119 tokens)
   services/mocks/products.ts [11989:24 - 12013:15]
Clone found (typescript)
 - services/mocks/products.ts [11850:21 - 11864:15] (15 lines, 109 tokens)
   services/mocks/products.ts [12013:21 - 12027:15]
Clone found (typescript)
 - services/mocks/products.ts [11896:19 - 11916:15] (21 lines, 80 tokens)
   services/mocks/products.ts [12059:17 - 12079:15]
Clone found (typescript)
 - services/mocks/products.ts [12149:24 - 12173:15] (25 lines, 119 tokens)
   services/mocks/products.ts [12294:24 - 12318:15]
Clone found (typescript)
 - services/mocks/products.ts [12205:19 - 12225:15] (21 lines, 80 tokens)
   services/mocks/products.ts [12350:20 - 12370:15]
Clone found (typescript)
 - services/mocks/products.ts [12432:24 - 12456:15] (25 lines, 119 tokens)
   services/mocks/products.ts [12584:24 - 12608:15]
Clone found (typescript)
 - services/mocks/products.ts [12476:18 - 12492:15] (17 lines, 79 tokens)
   services/mocks/products.ts [12628:18 - 12644:15]
Clone found (typescript)
 - services/mocks/products.ts [12492:23 - 12507:15] (16 lines, 68 tokens)
   services/mocks/products.ts [12644:25 - 12659:15]
Clone found (typescript)
 - services/mocks/products.ts [12717:23 - 12741:15] (25 lines, 119 tokens)
   services/mocks/products.ts [12851:23 - 12875:15]
Clone found (typescript)
 - services/mocks/products.ts [12741:18 - 12757:15] (17 lines, 79 tokens)
   services/mocks/products.ts [12875:18 - 12891:15]
Clone found (typescript)
 - services/mocks/products.ts [12757:23 - 12774:15] (18 lines, 96 tokens)
   services/mocks/products.ts [12891:23 - 12908:15]
Clone found (typescript)
 - services/mocks/products.ts [12774:19 - 12793:12] (20 lines, 61 tokens)
   services/mocks/products.ts [12908:19 - 12927:12]
Clone found (typescript)
 - services/mocks/products.ts [12990:24 - 13014:15] (25 lines, 119 tokens)
   services/mocks/products.ts [13144:24 - 13168:15]
Clone found (typescript)
 - services/mocks/products.ts [13014:29 - 13027:15] (14 lines, 95 tokens)
   services/mocks/products.ts [13168:34 - 13181:15]
Clone found (typescript)
 - services/mocks/products.ts [13027:18 - 13047:15] (21 lines, 80 tokens)
   services/mocks/products.ts [13181:18 - 13201:15]
Clone found (typescript)
 - services/mocks/products.ts [13047:17 - 13067:15] (21 lines, 80 tokens)
   services/mocks/products.ts [13201:17 - 13221:15]
Clone found (typescript)
 - services/mocks/products.ts [13287:28 - 13303:15] (17 lines, 79 tokens)
   services/mocks/products.ts [13425:27 - 13441:15]
Clone found (typescript)
 - services/mocks/products.ts [13311:28 - 13324:15] (14 lines, 95 tokens)
   services/mocks/products.ts [13449:31 - 13462:15]
Clone found (typescript)
 - services/mocks/products.ts [13556:28 - 13572:15] (17 lines, 79 tokens)
   services/mocks/products.ts [13705:27 - 13721:15]
Clone found (typescript)
 - services/mocks/products.ts [13572:28 - 13588:15] (17 lines, 137 tokens)
   services/mocks/products.ts [13721:24 - 13737:15]
Clone found (typescript)
 - services/mocks/products.ts [13588:18 - 13608:15] (21 lines, 80 tokens)
   services/mocks/products.ts [13737:19 - 13757:15]
Clone found (typescript)
 - services/mocks/products.ts [13608:24 - 13620:15] (13 lines, 81 tokens)
   services/mocks/products.ts [13757:25 - 13769:15]
Clone found (typescript)
 - services/mocks/reservations.ts [177:45 - 186:56] (10 lines, 68 tokens)
   services/mocks/reservations.ts [231:67 - 240:56]
Clone found (typescript)
 - services/mocks/warehouse.ts [305:71 - 319:6] (15 lines, 100 tokens)
   services/mocks/warehouse.ts [1423:70 - 1435:6]
Clone found (typescript)
 - services/mocks/warehouse.ts [320:46 - 329:8] (10 lines, 73 tokens)
   services/mocks/warehouse.ts [1436:5 - 1444:8]
Clone found (css)
 - styles/admin/categories_list.css [78:40 - 167:2] (90 lines, 382 tokens)
   styles/admin/services_list.css [116:21 - 205:2]
Clone found (css)
 - styles/admin/categories_list.css [82:1 - 101:4] (20 lines, 89 tokens)
   styles/admin/finance_list.css [164:1 - 181:4]
Clone found (css)
 - styles/admin/categories_list.css [100:22 - 144:14] (45 lines, 176 tokens)
   styles/admin/finance_list.css [187:28 - 223:14]
Clone found (css)
 - styles/admin/client_card.css [36:33 - 44:7] (9 lines, 101 tokens)
   styles/admin/orders_card.css [36:31 - 44:7]
Clone found (css)
 - styles/admin/client_card.css [45:13 - 55:7] (11 lines, 61 tokens)
   styles/admin/orders_card.css [45:12 - 55:7]
Clone found (css)
 - styles/admin/clients_list.css [22:15 - 31:2] (10 lines, 60 tokens)
   styles/admin/products_list.css [120:1 - 129:2]
Clone found (css)
 - styles/admin/clients_list.css [35:15 - 45:2] (11 lines, 73 tokens)
   styles/admin/orders_list.css [51:1 - 61:2]
Clone found (css)
 - styles/admin/clients_list.css [104:17 - 112:4] (9 lines, 67 tokens)
   styles/admin/orders_list.css [110:3 - 118:4]
Clone found (css)
 - styles/admin/clients_list.css [229:62 - 269:4] (41 lines, 199 tokens)
   styles/admin/orders_list.css [209:98 - 250:4]
Clone found (css)
 - styles/admin/clients_list.css [229:68 - 269:3] (41 lines, 196 tokens)
   styles/admin/services_list.css [74:16 - 114:2]
Clone found (css)
 - styles/admin/clients_list.css [230:1 - 267:2] (38 lines, 193 tokens)
   styles/admin/products_list.css [28:1 - 65:2]
Clone found (css)
 - styles/admin/clients_list.css [346:15 - 359:2] (14 lines, 95 tokens)
   styles/admin/components/_pagination.css [56:1 - 69:2]
Clone found (css)
 - styles/admin/clients_list.css [386:17 - 395:4] (10 lines, 65 tokens)
   styles/admin/orders_list.css [388:3 - 397:4]
Clone found (css)
 - styles/admin/clients_list.css [419:17 - 427:4] (9 lines, 64 tokens)
   styles/admin/orders_list.css [421:3 - 429:4]
Clone found (css)
 - styles/admin/components/_forms.css [323:21 - 335:2] (13 lines, 70 tokens)
   styles/admin/components/_forms.css [522:31 - 534:2]
Clone found (css)
 - styles/admin/components/_forms.css [323:21 - 335:2] (13 lines, 70 tokens)
   styles/admin/components/_forms.css [600:37 - 612:2]
Clone found (css)
 - styles/admin/components/_forms.css [579:23 - 587:10] (9 lines, 61 tokens)
   styles/admin/supplier_card_config.css [101:21 - 109:10]
Clone found (css)
 - styles/admin/components/_pagination.css [6:39 - 21:4] (16 lines, 72 tokens)
   styles/admin/orders_list.css [255:207 - 270:4]
Clone found (css)
 - styles/admin/components/_pagination.css [8:1 - 19:2] (12 lines, 68 tokens)
   views/admin/finance/IncomingPaymentsPage.vue:css [243:1 - 253:2]
Clone found (css)
 - styles/admin/components/_pagination.css [28:1 - 90:4] (63 lines, 338 tokens)
   styles/admin/orders_list.css [320:1 - 382:4]
Clone found (css)
 - styles/admin/components/_pagination.css [103:18 - 135:4] (33 lines, 126 tokens)
   styles/admin/orders_list.css [395:23 - 427:4]
Clone found (css)
 - styles/admin/components/_tables.css [47:9 - 57:2] (11 lines, 76 tokens)
   styles/erp-base.css [702:6 - 712:2]
Clone found (css)
 - styles/admin/components/_tables.css [47:9 - 57:2] (11 lines, 76 tokens)
   styles/erp-base.css [780:8 - 790:2]
Clone found (css)
 - styles/admin/components/_tree-select.css [31:7 - 45:2] (15 lines, 65 tokens)
   styles/admin/components/_tree-select.css [130:2 - 144:2]
Clone found (css)
 - styles/admin/orders_list.css [35:76 - 43:17] (9 lines, 67 tokens)
   styles/admin/warehouse_list.css [292:184 - 300:17]
Clone found (css)
 - styles/admin/orders_list.css [43:19 - 81:2] (39 lines, 229 tokens)
   styles/admin/products_list.css [126:22 - 164:2]
Clone found (css)
 - styles/admin/orders_list.css [80:24 - 113:4] (34 lines, 201 tokens)
   styles/admin/products_list.css [167:20 - 200:4]
Clone found (css)
 - styles/admin/orders_list.css [112:19 - 143:2] (32 lines, 172 tokens)
   styles/admin/products_list.css [205:28 - 236:2]
Clone found (css)
 - styles/admin/orders_list.css [209:66 - 250:12] (42 lines, 221 tokens)
   styles/admin/warehouse_list.css [986:65 - 1026:14]
Clone found (css)
 - styles/admin/orders_list.css [279:14 - 288:2] (10 lines, 60 tokens)
   styles/admin/products_card.css [72:1 - 81:2]
Clone found (css)
 - styles/admin/orders_list.css [279:14 - 290:2] (12 lines, 61 tokens)
   styles/admin/services_list.css [233:1 - 244:2]
Clone found (css)
 - styles/admin/orders_list.css [279:14 - 290:7] (12 lines, 63 tokens)
   styles/admin/warehouse_list.css [86:17 - 97:7]
Clone found (css)
 - styles/admin/products_card.css [69:37 - 84:4] (16 lines, 74 tokens)
   styles/admin/products_list.css [88:28 - 103:4]
Clone found (css)
 - styles/admin/products_list.css [119:15 - 166:9] (48 lines, 290 tokens)
   styles/admin/services_list.css [27:11 - 74:4]
Clone found (css)
 - styles/admin/products_list.css [119:15 - 236:2] (118 lines, 700 tokens)
   styles/admin/suppliers_list.css [195:28 - 312:2]
Clone found (css)
 - styles/admin/products_list.css [119:15 - 231:10] (113 lines, 663 tokens)
   styles/admin/warehouse_list.css [292:214 - 402:14]
Clone found (css)
 - styles/admin/settings_logs.css [163:16 - 174:2] (12 lines, 61 tokens)
   styles/admin/warehouse_map.css [101:21 - 112:2]
Clone found (css)
 - styles/admin/settings_logs.css [184:16 - 197:4] (14 lines, 145 tokens)
   styles/admin/warehouse_map.css [122:21 - 135:4]
Clone found (css)
 - styles/erp-base.css [203:5 - 213:2] (11 lines, 71 tokens)
   styles/erp-base.css [253:10 - 263:2]
Clone found (css)
 - styles/erp-base.css [399:6 - 407:8] (9 lines, 62 tokens)
   styles/erp-base.css [459:15 - 467:7]
Clone found (css)
 - styles/public/about.css [1:1 - 38:23] (38 lines, 349 tokens)
   styles/public/login.css [1:1 - 38:23]
Clone found (css)
 - styles/public/about.css [1:1 - 35:4] (35 lines, 262 tokens)
   styles/public/support.css [64:1 - 98:4]
Clone found (css)
 - styles/public/about.css [1:1 - 41:4] (41 lines, 379 tokens)
   styles/public/terms.css [1:1 - 41:4]
Clone found (css)
 - styles/public/about.css [2:1 - 34:2] (33 lines, 236 tokens)
   styles/public/register.css [1:1 - 33:2]
Clone found (css)
 - styles/public/about.css [82:12 - 97:2] (16 lines, 82 tokens)
   styles/public/support.css [100:12 - 115:2]
Clone found (css)
 - styles/public/about.css [83:31 - 97:2] (15 lines, 71 tokens)
   styles/public/terms.css [108:24 - 122:2]
Clone found (css)
 - styles/public/about.css [85:3 - 97:2] (13 lines, 69 tokens)
   styles/public/login.css [161:3 - 173:2]
Clone found (css)
 - styles/public/login.css [102:29 - 111:22] (10 lines, 68 tokens)
   styles/public/register.css [72:22 - 82:22]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [1:1 - 46:36] (46 lines, 67 tokens)
   views/admin/analytics/DeficitPage.vue:html [1:1 - 13:36]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [1:1 - 46:36] (46 lines, 67 tokens)
   views/admin/analytics/LogisticsPage.vue:html [1:1 - 13:36]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [1:1 - 46:36] (46 lines, 67 tokens)
   views/admin/analytics/SalesPage.vue:html [1:1 - 13:36]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [1:1 - 46:36] (46 lines, 67 tokens)
   views/admin/analytics/StaffPage.vue:html [1:1 - 13:36]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [1:1 - 46:36] (46 lines, 67 tokens)
   views/admin/analytics/SupplyPage.vue:html [1:1 - 13:36]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [1:1 - 46:36] (46 lines, 67 tokens)
   views/admin/analytics/WarehousePage.vue:html [1:1 - 13:36]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [52:27 - 62:18] (11 lines, 104 tokens)
   views/admin/analytics/DeficitPage.vue:html [19:27 - 29:18]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [95:53 - 106:16] (12 lines, 107 tokens)
   views/admin/analytics/LogisticsPage.vue:html [48:72 - 59:39]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [95:53 - 106:16] (12 lines, 107 tokens)
   views/admin/analytics/SalesPage.vue:html [48:54 - 59:39]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [95:53 - 106:16] (12 lines, 107 tokens)
   views/admin/analytics/SupplyPage.vue:html [50:13 - 61:39]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [95:53 - 106:16] (12 lines, 107 tokens)
   views/admin/analytics/WarehousePage.vue:html [48:87 - 59:39]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [97:14 - 106:6] (10 lines, 93 tokens)
   views/admin/analytics/PlReportPage.vue:html [28:99 - 37:6]
Clone found (html)
 - views/admin/analytics/DashboardPage.vue:html [97:14 - 106:28] (10 lines, 101 tokens)
   views/admin/analytics/StaffPage.vue:html [27:95 - 36:39]
Clone found (html)
 - views/admin/analytics/DeficitPage.vue:html [13:79 - 35:36] (23 lines, 184 tokens)
   views/admin/analytics/LogisticsPage.vue:html [13:83 - 35:36]
Clone found (html)
 - views/admin/analytics/DeficitPage.vue:html [13:79 - 35:36] (23 lines, 184 tokens)
   views/admin/analytics/SalesPage.vue:html [13:75 - 35:36]
Clone found (html)
 - views/admin/analytics/DeficitPage.vue:html [13:79 - 35:36] (23 lines, 184 tokens)
   views/admin/analytics/SupplyPage.vue:html [13:77 - 35:36]
Clone found (html)
 - views/admin/analytics/DeficitPage.vue:html [13:79 - 35:36] (23 lines, 184 tokens)
   views/admin/analytics/WarehousePage.vue:html [13:83 - 35:36]
Clone found (css)
 - views/admin/clients/ClientCardPage.vue:css [870:1 - 888:2] (19 lines, 90 tokens)
   views/admin/orders/OrderCardPage.vue:css [3189:1 - 3207:2]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [181:63 - 203:20] (23 lines, 125 tokens)
   views/admin/orders/OrderCardPage.vue:html [1099:61 - 1120:20]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [746:44 - 757:16] (12 lines, 64 tokens)
   views/admin/products/ProductCardPage.vue:html [668:43 - 679:14]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [785:92 - 795:77] (11 lines, 106 tokens)
   views/admin/products/ProductCardPage.vue:html [703:17 - 713:73]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [785:92 - 805:37] (21 lines, 157 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [290:97 - 309:31]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [785:92 - 795:56] (11 lines, 97 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [1414:19 - 1424:54]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [785:92 - 807:26] (23 lines, 163 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [592:89 - 612:35]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [786:63 - 800:26] (15 lines, 124 tokens)
   views/admin/orders/OrderCardPage.vue:html [2202:79 - 2216:26]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [806:27 - 849:15] (44 lines, 107 tokens)
   views/admin/products/ProductCardPage.vue:html [723:23 - 747:8]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [806:27 - 849:53] (44 lines, 111 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [310:21 - 335:4]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [806:27 - 846:10] (41 lines, 99 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [1435:25 - 1456:14]
Clone found (html)
 - views/admin/clients/ClientCardPage.vue:html [806:27 - 850:43] (45 lines, 115 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [613:25 - 639:6]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:75 - 269:6] (21 lines, 91 tokens)
   views/admin/orders/OrdersListPage.vue:html [167:74 - 187:6]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:75 - 270:45] (22 lines, 106 tokens)
   views/admin/products/ProductsPage.vue:html [273:76 - 293:65]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:75 - 269:9] (21 lines, 94 tokens)
   views/admin/suppliers/SuppliersListPage.vue:html [372:75 - 392:7]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:75 - 266:8] (18 lines, 83 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1176:13 - 1197:12]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:92 - 270:64] (22 lines, 109 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1255:11 - 1277:25]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:92 - 271:8] (23 lines, 113 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1335:11 - 1357:23]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:92 - 271:8] (23 lines, 113 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1421:11 - 1443:23]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [249:92 - 266:8] (18 lines, 79 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1491:11 - 1960:26]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [305:42 - 324:19] (20 lines, 68 tokens)
   views/admin/products/ProductsPage.vue:html [315:43 - 334:19]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [305:42 - 324:54] (20 lines, 76 tokens)
   views/admin/products/ServicesPage.vue:html [189:43 - 209:52]
Clone found (html)
 - views/admin/clients/ClientsListPage.vue:html [351:44 - 370:20] (20 lines, 69 tokens)
   views/admin/orders/OrdersListPage.vue:html [263:43 - 283:18]
Clone found (typescript)
 - views/admin/clients/ClientsListPage.vue:typescript [142:3 - 150:31] (9 lines, 66 tokens)
   views/admin/settings/LogsSettings.vue:typescript [43:3 - 51:31]
Clone found (typescript)
 - views/admin/clients/ClientsListPage.vue:typescript [164:29 - 177:24] (14 lines, 70 tokens)
   views/admin/orders/OrdersListPage.vue:typescript [101:23 - 113:34]
Clone found (typescript)
 - views/admin/clients/ClientsListPage.vue:typescript [164:37 - 175:39] (12 lines, 60 tokens)
   views/admin/suppliers/SuppliersListPage.vue:typescript [236:29 - 247:39]
Clone found (html)
 - views/admin/finance/DocumentArchivePage.vue:html [225:28 - 237:25] (13 lines, 67 tokens)
   views/admin/finance/IncomingPaymentsPage.vue:html [216:28 - 228:25]
Clone found (html)
 - views/admin/finance/DocumentArchivePage.vue:html [225:28 - 245:16] (21 lines, 101 tokens)
   views/admin/finance/OutgoingPaymentsPage.vue:html [214:28 - 234:16]
Clone found (typescript)
 - views/admin/finance/DocumentArchivePage.vue:typescript [65:16 - 85:7] (21 lines, 98 tokens)
   views/admin/finance/IncomingPaymentsPage.vue:typescript [59:18 - 79:7]
Clone found (typescript)
 - views/admin/finance/DocumentArchivePage.vue:typescript [65:16 - 96:34] (32 lines, 158 tokens)
   views/admin/finance/OutgoingPaymentsPage.vue:typescript [52:15 - 85:26]
Clone found (typescript)
 - views/admin/finance/DocumentArchivePage.vue:typescript [101:43 - 119:24] (19 lines, 97 tokens)
   views/admin/finance/OutgoingPaymentsPage.vue:typescript [90:73 - 108:24]
Clone found (typescript)
 - views/admin/finance/DocumentArchivePage.vue:typescript [102:1 - 117:3] (16 lines, 87 tokens)
   views/admin/finance/IncomingPaymentsPage.vue:typescript [92:1 - 107:3]
Clone found (typescript)
 - views/admin/finance/DocumentArchivePage.vue:typescript [104:1 - 117:3] (14 lines, 86 tokens)
   views/admin/products/ProductsPage.vue:typescript [37:1 - 51:14]
Clone found (typescript)
 - views/admin/finance/DocumentArchivePage.vue:typescript [105:3 - 114:23] (10 lines, 75 tokens)
   views/admin/notifications/NotificationsPage.vue:typescript [72:3 - 81:23]
Clone found (html)
 - views/admin/finance/IncomingPaymentsPage.vue:html [121:64 - 144:12] (24 lines, 148 tokens)
   views/admin/finance/OutgoingPaymentsPage.vue:html [118:64 - 141:12]
Clone found (typescript)
 - views/admin/finance/IncomingPaymentsPage.vue:typescript [33:35 - 45:11] (13 lines, 73 tokens)
   views/admin/finance/OutgoingPaymentsPage.vue:typescript [26:44 - 37:11]
Clone found (typescript)
 - views/admin/finance/IncomingPaymentsPage.vue:typescript [66:14 - 92:2] (27 lines, 119 tokens)
   views/admin/finance/OutgoingPaymentsPage.vue:typescript [59:14 - 86:12]
Clone found (html)
 - views/admin/finance/OutgoingPaymentsPage.vue:html [208:23 - 226:25] (19 lines, 91 tokens)
   views/admin/suppliers/SuppliersListPage.vue:html [510:22 - 528:27]
Clone found (html)
 - views/admin/notifications/NotificationsPage.vue:html [191:48 - 214:19] (24 lines, 110 tokens)
   views/admin/orders/OrdersListPage.vue:html [359:41 - 382:19]
Clone found (html)
 - views/admin/notifications/NotificationsPage.vue:html [251:30 - 263:27] (13 lines, 67 tokens)
   views/admin/orders/OrdersListPage.vue:html [445:30 - 457:27]
Clone found (typescript)
 - views/admin/notifications/NotificationsPage.vue:typescript [57:2 - 83:3] (27 lines, 149 tokens)
   views/admin/orders/OrdersListPage.vue:typescript [48:2 - 74:3]
Clone found (typescript)
 - views/admin/notifications/NotificationsPage.vue:typescript [67:2 - 85:9] (19 lines, 95 tokens)
   views/admin/products/CategoriesPage.vue:typescript [26:56 - 43:6]
Clone found (typescript)
 - views/admin/notifications/NotificationsPage.vue:typescript [67:2 - 86:38] (20 lines, 108 tokens)
   views/admin/products/ServicesPage.vue:typescript [26:24 - 43:58]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [897:1 - 909:2] (13 lines, 167 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [443:1 - 455:2]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [919:17 - 947:14] (29 lines, 207 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [462:16 - 490:14]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1016:1 - 1027:23] (12 lines, 90 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:css [879:1 - 890:23]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1038:31 - 1048:2] (11 lines, 85 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [538:39 - 548:2]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1048:10 - 1064:6] (17 lines, 153 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [548:10 - 564:6]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1076:13 - 1098:4] (23 lines, 112 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [566:13 - 588:4]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1103:34 - 1122:18] (20 lines, 163 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [585:21 - 608:14]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1107:7 - 1117:4] (11 lines, 65 tokens)
   views/admin/orders/AddOrderItemsModal.vue:css [1118:6 - 1128:4]
Clone found (css)
 - views/admin/orders/AddOrderItemsModal.vue:css [1230:10 - 1244:2] (15 lines, 126 tokens)
   views/admin/orders/AddOrderServicesModal.vue:css [609:10 - 623:2]
Clone found (html)
 - views/admin/orders/AddOrderItemsModal.vue:html [709:21 - 722:16] (14 lines, 67 tokens)
   views/admin/orders/AddOrderServicesModal.vue:html [337:21 - 350:16]
Clone found (html)
 - views/admin/orders/AddOrderItemsModal.vue:html [858:25 - 603:12] (1 lines, 81 tokens)
   views/admin/orders/AddOrderServicesModal.vue:html [404:19 - 260:12]
Clone found (typescript)
 - views/admin/orders/AddOrderItemsModal.vue:typescript [70:5 - 93:6] (24 lines, 91 tokens)
   views/admin/orders/AddOrderServicesModal.vue:typescript [60:5 - 81:6]
Clone found (typescript)
 - views/admin/orders/AddOrderItemsModal.vue:typescript [350:50 - 359:38] (10 lines, 78 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:typescript [67:34 - 77:38]
Clone found (typescript)
 - views/admin/orders/AddOrderItemsModal.vue:typescript [386:62 - 407:3] (22 lines, 134 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:typescript [104:55 - 125:3]
Clone found (html)
 - views/admin/orders/OrderCardPage.vue:html [1616:45 - 1627:25] (12 lines, 98 tokens)
   views/admin/orders/OrderCardPage.vue:html [1782:48 - 1793:25]
Clone found (html)
 - views/admin/orders/OrderCardPage.vue:html [2263:42 - 2274:25] (12 lines, 87 tokens)
   views/admin/orders/OrderCardPage.vue:html [2850:89 - 2862:25]
Clone found (html)
 - views/admin/orders/OrderCardPage.vue:html [2274:99 - 2286:36] (13 lines, 77 tokens)
   views/admin/orders/OrderCardPage.vue:html [2862:100 - 2874:36]
Clone found (typescript)
 - views/admin/orders/OrdersListPage.vue:typescript [99:29 - 113:35] (15 lines, 81 tokens)
   views/admin/products/ProductsPage.vue:typescript [88:44 - 102:35]
Clone found (html)
 - views/admin/products/CategoryCardPage.vue:html [251:79 - 259:24] (9 lines, 78 tokens)
   views/admin/products/ProductCardPage.vue:html [254:75 - 262:24]
Clone found (html)
 - views/admin/products/CategoryCardPage.vue:html [251:79 - 259:24] (9 lines, 78 tokens)
   views/admin/products/ServiceCardPage.vue:html [66:75 - 74:24]
Clone found (html)
 - views/admin/products/CategoryCardPage.vue:html [251:79 - 259:24] (9 lines, 78 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [166:77 - 174:24]
Clone found (html)
 - views/admin/products/CategoryCardPage.vue:html [347:78 - 357:18] (11 lines, 84 tokens)
   views/admin/products/CategoryCardPage.vue:html [386:17 - 396:20]
Clone found (typescript)
 - views/admin/products/CategoryCardPage.vue:typescript [78:32 - 89:6] (12 lines, 73 tokens)
   views/admin/products/ProductCardPage.vue:typescript [83:80 - 94:6]
Clone found (typescript)
 - views/admin/products/CategoryCardPage.vue:typescript [196:4 - 208:3] (13 lines, 62 tokens)
   views/admin/products/ProductCardPage.vue:typescript [189:15 - 198:3]
Clone found (html)
 - views/admin/products/ProductCardPage.vue:html [688:80 - 700:25] (13 lines, 91 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [279:79 - 290:25]
Clone found (typescript)
 - views/admin/products/ProductCardPage.vue:typescript [81:71 - 92:3] (12 lines, 109 tokens)
   views/admin/products/ServiceCardPage.vue:typescript [28:51 - 39:3]
Clone found (typescript)
 - views/admin/products/ProductCardPage.vue:typescript [134:22 - 146:6] (13 lines, 105 tokens)
   views/admin/products/ProductCardPage.vue:typescript [146:27 - 158:6]
Clone found (typescript)
 - views/admin/products/ProductCardPage.vue:typescript [134:22 - 146:6] (13 lines, 105 tokens)
   views/admin/products/ProductCardPage.vue:typescript [158:26 - 170:6]
Clone found (typescript)
 - views/admin/products/ProductCardPage.vue:typescript [138:31 - 146:6] (9 lines, 73 tokens)
   views/admin/warehouse/WarehousePage.vue:typescript [631:56 - 643:6]
Clone found (typescript)
 - views/admin/products/ProductCardPage.vue:typescript [165:23 - 176:3] (12 lines, 98 tokens)
   views/admin/products/ProductsPage.vue:typescript [138:34 - 149:3]
Clone found (css)
 - views/admin/products/ProductsPage.vue:css [574:1 - 590:2] (17 lines, 466 tokens)
   views/admin/suppliers/SuppliersListPage.vue:css [614:1 - 630:2]
Clone found (html)
 - views/admin/products/ProductsPage.vue:html [294:71 - 303:19] (10 lines, 70 tokens)
   views/admin/products/ServicesPage.vue:html [168:71 - 177:19]
Clone found (html)
 - views/admin/products/ProductsPage.vue:html [415:19 - 431:31] (17 lines, 87 tokens)
   views/admin/products/ServicesPage.vue:html [292:19 - 308:31]
Clone found (typescript)
 - views/admin/products/ProductsPage.vue:typescript [51:59 - 66:6] (16 lines, 88 tokens)
   views/admin/warehouse/WarehousePage.vue:typescript [736:2 - 750:6]
Clone found (typescript)
 - views/admin/products/ServiceCardPage.vue:typescript [43:41 - 52:10] (10 lines, 77 tokens)
   views/admin/products/ServicesPage.vue:typescript [61:18 - 72:9]
Clone found (css)
 - views/admin/settings/FinanceSettings.vue:css [176:18 - 197:2] (22 lines, 134 tokens)
   views/admin/settings/UnitsSettings.vue:css [195:50 - 216:2]
Clone found (css)
 - views/admin/settings/FinanceSettings.vue:css [196:14 - 207:2] (12 lines, 96 tokens)
   views/admin/settings/UnitsSettings.vue:css [219:20 - 230:2]
Clone found (css)
 - views/admin/settings/MailSettings.vue:css [208:1 - 220:2] (13 lines, 61 tokens)
   views/admin/settings/ProfileSettings.vue:css [243:1 - 255:2]
Clone found (css)
 - views/admin/settings/OrderStatusesSettings.vue:css [394:18 - 404:2] (11 lines, 81 tokens)
   views/admin/settings/SettingsLayout.vue:css [1044:10 - 1054:2]
Clone found (css)
 - views/admin/settings/OrderStatusesSettings.vue:css [404:1 - 414:2] (11 lines, 60 tokens)
   views/admin/settings/SettingsLayout.vue:css [1054:21 - 1064:2]
Clone found (css)
 - views/admin/settings/OrderStatusesSettings.vue:css [414:1 - 428:2] (15 lines, 73 tokens)
   views/admin/settings/SettingsLayout.vue:css [1064:21 - 1078:2]
Clone found (css)
 - views/admin/settings/OrderStatusesSettings.vue:css [430:14 - 451:2] (22 lines, 110 tokens)
   views/admin/settings/SettingsLayout.vue:css [1088:17 - 1109:2]
Clone found (css)
 - views/admin/settings/OrderStatusesSettings.vue:css [450:21 - 461:2] (12 lines, 94 tokens)
   views/admin/settings/SettingsLayout.vue:css [1080:14 - 1091:2]
Clone found (css)
 - views/admin/settings/OrderStatusesSettings.vue:css [458:17 - 474:14] (17 lines, 65 tokens)
   views/admin/settings/SettingsLayout.vue:css [1108:21 - 1124:14]
Clone found (html)
 - views/admin/suppliers/BccRequestPage.vue:html [554:19 - 656:39] (103 lines, 81 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [212:10 - 348:33]
Clone found (html)
 - views/admin/suppliers/BccRequestPage.vue:html [609:23 - 629:60] (21 lines, 93 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [299:49 - 320:29]
Clone found (html)
 - views/admin/suppliers/BccRequestPage.vue:html [612:27 - 627:38] (16 lines, 72 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [271:21 - 286:32]
Clone found (html)
 - views/admin/suppliers/BccRequestPage.vue:html [876:65 - 896:41] (21 lines, 68 tokens)
   views/admin/suppliers/BccRequestPage.vue:html [914:37 - 938:41]
Clone found (typescript)
 - views/admin/suppliers/BccRequestPage.vue:typescript [118:1 - 130:8] (13 lines, 74 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:typescript [80:1 - 92:8]
Clone found (typescript)
 - views/admin/suppliers/BccRequestPage.vue:typescript [180:1 - 191:6] (12 lines, 124 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:typescript [125:1 - 137:6]
Clone found (typescript)
 - views/admin/suppliers/BccRequestPage.vue:typescript [281:31 - 296:9] (16 lines, 75 tokens)
   views/admin/suppliers/BccRequestPage.vue:typescript [391:33 - 406:9]
Clone found (html)
 - views/admin/suppliers/SupplierCardConfigPage.vue:html [525:7 - 545:4] (21 lines, 87 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [124:9 - 188:14]
Clone found (html)
 - views/admin/suppliers/SupplierCardConfigPage.vue:html [578:23 - 589:57] (12 lines, 68 tokens)
   views/admin/suppliers/SupplierCardConfigPage.vue:html [597:18 - 645:55]
Clone found (html)
 - views/admin/suppliers/SupplierCardConfigPage.vue:html [580:17 - 591:65] (12 lines, 71 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [190:15 - 200:35]
Clone found (html)
 - views/admin/suppliers/SupplierCardConfigPage.vue:html [638:17 - 647:16] (10 lines, 65 tokens)
   views/admin/suppliers/SupplierCardPage.vue:html [192:17 - 201:21]
Clone found (html)
 - views/admin/warehouse/CreateMovementModal.vue:html [569:88 - 584:13] (16 lines, 115 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:html [421:88 - 436:13]
Clone found (typescript)
 - views/admin/warehouse/CreateMovementModal.vue:typescript [130:35 - 141:6] (12 lines, 123 tokens)
   views/admin/warehouse/WarehouseBatchCard.vue:typescript [218:40 - 232:6]
Clone found (typescript)
 - views/admin/warehouse/CreateMovementModal.vue:typescript [130:35 - 141:6] (12 lines, 123 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:typescript [102:68 - 113:6]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [444:11 - 460:53] (17 lines, 85 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [258:11 - 274:53]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [476:64 - 494:25] (19 lines, 107 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [379:94 - 397:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [477:21 - 501:28] (25 lines, 129 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2073:23 - 2097:34]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [503:60 - 521:25] (19 lines, 107 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [410:93 - 427:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [504:21 - 529:32] (26 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2118:23 - 2142:57]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [527:22 - 548:20] (22 lines, 130 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [338:77 - 359:16]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [555:74 - 578:25] (24 lines, 146 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [307:79 - 330:25]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [593:22 - 623:28] (31 lines, 134 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [409:34 - 478:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [604:60 - 622:25] (19 lines, 107 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [440:93 - 457:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [605:21 - 629:78] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2162:23 - 2187:51]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [634:21 - 659:49] (26 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2207:23 - 2232:51]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [658:19 - 692:32] (35 lines, 213 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [309:19 - 343:32]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [663:56 - 683:26] (21 lines, 112 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [472:89 - 492:23]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [663:52 - 686:26] (24 lines, 123 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [752:50 - 774:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [664:21 - 688:78] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1734:27 - 1759:56]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [687:19 - 710:68] (24 lines, 157 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [302:19 - 338:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [692:62 - 710:23] (19 lines, 107 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [537:92 - 555:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [693:21 - 718:23] (26 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2297:23 - 2322:51]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [723:23 - 751:26] (29 lines, 160 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [571:19 - 597:46]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [869:60 - 887:25] (19 lines, 107 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [603:93 - 620:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [870:21 - 894:78] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2342:23 - 2367:51]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [894:84 - 916:20] (23 lines, 134 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [627:16 - 649:16]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [923:84 - 954:32] (32 lines, 176 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [649:82 - 680:28]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [950:19 - 974:26] (25 lines, 140 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [535:19 - 558:29]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [950:20 - 983:64] (34 lines, 188 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [635:84 - 666:37]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [955:21 - 981:54] (27 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2387:23 - 2411:57]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [986:24 - 1010:46] (25 lines, 143 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [676:16 - 700:42]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1013:22 - 1140:14] (128 lines, 617 tokens)
   views/admin/warehouse/WarehouseBatchCreatePage.vue:html [714:7 - 820:8]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1013:22 - 1142:88] (130 lines, 642 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [818:7 - 929:19]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1220:77 - 1234:29] (15 lines, 103 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [817:78 - 831:29]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1235:17 - 1248:33] (14 lines, 114 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [832:17 - 845:33]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1249:21 - 1262:25] (14 lines, 77 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [846:21 - 859:25]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1397:80 - 1405:24] (9 lines, 84 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [604:82 - 612:24]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1397:80 - 1412:36] (16 lines, 118 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [628:83 - 640:75]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1397:80 - 1412:36] (16 lines, 118 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [894:81 - 906:75]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1397:80 - 1411:25] (15 lines, 109 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [580:80 - 592:29]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1538:7 - 298:45] (1 lines, 110 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [698:7 - 134:45]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1538:7 - 298:45] (1 lines, 110 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [692:7 - 73:45]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCard.vue:html [1561:11 - 298:45] (1 lines, 70 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [1044:8 - 178:45]
Clone found (typescript)
 - views/admin/warehouse/WarehouseBatchCard.vue:typescript [121:1 - 141:2] (21 lines, 97 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:typescript [124:2 - 144:2]
Clone found (typescript)
 - views/admin/warehouse/WarehouseBatchCard.vue:typescript [171:1 - 213:61] (43 lines, 178 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:typescript [45:1 - 90:13]
Clone found (css)
 - views/admin/warehouse/WarehouseBatchCreatePage.vue:css [877:20 - 895:2] (19 lines, 107 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:css [963:16 - 982:2]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCreatePage.vue:html [241:13 - 250:62] (10 lines, 60 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [273:13 - 282:62]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCreatePage.vue:html [316:33 - 332:11] (17 lines, 71 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [341:32 - 357:11]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCreatePage.vue:html [494:40 - 504:14] (11 lines, 63 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [774:43 - 783:14]
Clone found (html)
 - views/admin/warehouse/WarehouseBatchCreatePage.vue:html [676:15 - 704:14] (29 lines, 156 tokens)
   views/admin/warehouse/WarehouseDeficitCard.vue:html [561:19 - 598:16]
Clone found (typescript)
 - views/admin/warehouse/WarehouseBatchCreatePage.vue:typescript [60:14 - 153:8] (94 lines, 702 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:typescript [97:15 - 193:8]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [279:39 - 301:28] (23 lines, 134 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [334:22 - 356:28]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [349:21 - 373:46] (25 lines, 129 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3629:23 - 3653:34]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [378:21 - 402:78] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3719:23 - 3744:51]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [415:21 - 439:78] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3674:23 - 3699:51]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [514:21 - 538:46] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3808:23 - 3833:51]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [595:77 - 662:11] (68 lines, 60 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [619:78 - 686:11]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [595:77 - 667:19] (73 lines, 84 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [885:76 - 957:19]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [616:99 - 636:35] (21 lines, 163 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [640:100 - 660:35]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [616:99 - 636:35] (21 lines, 163 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [906:98 - 926:35]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [637:25 - 673:38] (37 lines, 102 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:html [661:25 - 697:38]
Clone found (html)
 - views/admin/warehouse/WarehouseDeficitCard.vue:html [637:25 - 675:23] (39 lines, 110 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:html [927:25 - 968:23]
Clone found (typescript)
 - views/admin/warehouse/WarehouseDeficitCard.vue:typescript [93:27 - 112:9] (20 lines, 76 tokens)
   views/admin/warehouse/WarehouseOffcutCard.vue:typescript [98:26 - 117:9]
Clone found (typescript)
 - views/admin/warehouse/WarehouseDeficitCard.vue:typescript [96:1 - 108:2] (13 lines, 66 tokens)
   views/admin/warehouse/WarehouseMovementCard.vue:typescript [42:1 - 54:2]
Clone found (html)
 - views/admin/warehouse/WarehouseMovementCard.vue:html [378:21 - 403:27] (26 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3437:23 - 3462:53]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [363:22 - 389:26] (27 lines, 144 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [446:78 - 471:28]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [367:21 - 391:46] (25 lines, 129 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2585:23 - 2609:34]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [392:22 - 423:27] (32 lines, 137 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [521:80 - 543:32]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [404:21 - 428:78] (25 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2675:23 - 2700:51]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [428:84 - 452:27] (25 lines, 141 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [550:16 - 573:32]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [457:84 - 481:27] (25 lines, 141 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [580:16 - 603:32]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [486:84 - 509:65] (24 lines, 141 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [610:16 - 633:32]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [491:21 - 511:80] (21 lines, 135 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2720:23 - 2745:51]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [555:31 - 630:27] (76 lines, 137 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [719:79 - 741:32]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [569:125 - 593:27] (25 lines, 140 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [683:135 - 707:90]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [661:20 - 704:34] (44 lines, 192 tokens)
   views/admin/warehouse/WarehouseOffcutCreatePage.vue:html [781:80 - 817:19]
Clone found (html)
 - views/admin/warehouse/WarehouseOffcutCard.vue:html [1031:10 - 174:76] (1 lines, 61 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [664:15 - 156:40]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1184:22 - 1200:16] (17 lines, 89 tokens)
   views/admin/warehouse/WarehousePage.vue:html [1262:22 - 1278:16]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1619:27 - 1636:54] (18 lines, 106 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [410:21 - 428:28]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1665:25 - 1683:22] (19 lines, 106 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [439:21 - 457:28]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1687:27 - 1704:54] (18 lines, 106 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [468:21 - 486:28]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1731:84 - 1759:56] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2251:82 - 2278:57]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1731:84 - 1759:56] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2807:82 - 2834:57]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1731:84 - 1759:56] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3297:84 - 3325:53]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1731:84 - 1759:56] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3762:82 - 3789:57]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1778:25 - 1796:30] (19 lines, 108 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [504:21 - 522:25]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1800:27 - 1817:54] (18 lines, 106 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [344:21 - 362:28]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1847:27 - 1864:54] (18 lines, 106 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [545:21 - 563:28]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [1894:27 - 1912:35] (19 lines, 109 tokens)
   views/admin/warehouse/WarehouseStockCard.vue:html [381:21 - 399:36]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2070:88 - 2098:51] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2627:88 - 2655:51]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2070:88 - 2098:51] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3205:90 - 3233:53]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2159:85 - 2187:51] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2762:85 - 2790:51]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2159:85 - 2187:51] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3252:87 - 3280:53]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2294:86 - 2322:51] (29 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3342:88 - 3370:53]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2384:83 - 2411:57] (28 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [2895:83 - 2922:57]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2384:83 - 2411:57] (28 lines, 150 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3850:83 - 3877:57]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2476:21 - 2488:24] (13 lines, 60 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3026:21 - 3038:24]
Clone found (html)
 - views/admin/warehouse/WarehousePage.vue:html [2476:21 - 2488:24] (13 lines, 60 tokens)
   views/admin/warehouse/WarehousePage.vue:html [3978:21 - 3990:24]
Clone found (html)
 - views/public/AboutPage.vue:html [1:1 - 10:16] (10 lines, 62 tokens)
   views/public/SupportPage.vue:html [1:1 - 10:16]
Clone found (html)
 - views/public/AboutPage.vue:html [1:10 - 10:16] (10 lines, 60 tokens)
   views/public/TermsPage.vue:html [22:8 - 10:16]
Clone found (html)
 - views/public/LoginPage.vue:html [30:15 - 56:12] (27 lines, 83 tokens)
   views/public/RegisterPage.vue:html [100:13 - 126:12]
Clone found (html)
 - views/public/NotFoundPage.vue:html [11:55 - 27:20] (17 lines, 60 tokens)
   views/public/SupportPage.vue:html [59:12 - 75:20]
Clone found (html)
 - views/public/ScreensPage.vue:html [17:9 - 31:36] (15 lines, 100 tokens)
   views/public/ScreensPage.vue:html [53:9 - 67:36]
Clone found (html)
 - views/public/ScreensPage.vue:html [17:9 - 31:6] (15 lines, 91 tokens)
   views/public/ScreensPage.vue:html [89:9 - 102:4]
Clone found (html)
 - views/public/ScreensPage.vue:html [19:9 - 31:36] (13 lines, 92 tokens)
   views/public/ScreensPage.vue:html [37:9 - 49:36]
Clone found (html)
 - views/public/ScreensPage.vue:html [19:9 - 31:36] (13 lines, 92 tokens)
   views/public/ScreensPage.vue:html [73:9 - 85:36]
┌────────────┬────────────────┬─────────────┬──────────────┬──────────────┬──────────────────┬───────────────────┐
│ Format     │ Files analyzed │ Total lines │ Total tokens │ Clones found │ Duplicated lines │ Duplicated tokens │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ css        │ 99             │ 33742       │ 151029       │ 70           │ 1569 (4.65%)     │ 10167 (6.73%)     │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ html       │ 93             │ 37707       │ 136810       │ 233          │ 5045 (13.38%)    │ 26235 (19.18%)    │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ javascript │ 2              │ 218         │ 733          │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ markup     │ 3              │ 67          │ 493          │ 1            │ 19 (28.36%)      │ 92 (18.66%)       │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ scss       │ 1              │ 18          │ 207          │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ txt        │ 1              │ 1033        │ 4494         │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ typescript │ 322            │ 110063      │ 545170       │ 338          │ 7808 (7.09%)     │ 43351 (7.95%)     │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ vue        │ 95             │ 37564       │ 169947       │ 0            │ 0 (0.00%)        │ 0 (0.00%)         │
├────────────┼────────────────┼─────────────┼──────────────┼──────────────┼──────────────────┼───────────────────┤
│ Total:     │ 616            │ 220412      │ 1008883      │ 642          │ 14441 (6.55%)    │ 79845 (7.91%)     │
└────────────┴────────────────┴─────────────┴──────────────┴──────────────┴──────────────────┴───────────────────┘
Found 642 clones.
time: 142.057ms

💡 Auto-refactor with AI: npx skills add https://github.com/kucherenko/jscpd --skill dry-refactoring
🎩 New: Gangsta Agents — discipline your AI coding → gangsta.page
💖 Support jscpd project → https://opencollective.com/jscpd

> flexiron-frontend@0.1.0 format:check
> prettier --check src/ tests/ --cache

Checking formatting...
All matched files use Prettier code style!

> flexiron-frontend@0.1.0 test:unit
> vitest run


 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-3/wt-expect-budget-after-goto-navigation-and-settings/frontend_vue

 ✓ src/services/mocks/orders.spec.ts (202 tests) 683ms
 ✓ src/services/mocks/offcut-offers-route.spec.ts (2 tests) 1029ms
     ✓ доходит до мока, а не до карточки обрезка  723ms
     ✓ на неизвестный товар отвечает пустым списком, а не ошибкой карточки  303ms
 ✓ src/services/mocks/store-copies.spec.ts (11 tests) 1197ms
     ✓ патч с fieldValues из реактивного источника не роняет сохранение  1188ms
roo_code/roo-context/api/00-conventions.md: ссылок 336, битых 29, глазами 12, без токена 234
  roo_code/roo-context/api/00-conventions.md:29 → services/api.ts:128-139 — нет токена в диапазоне: в 128-139 нет ни одного из: «ApiResponse<T>», «success»
  roo_code/roo-context/api/00-conventions.md:34 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/roo-context/api/00-conventions.md:36 → services/api.ts:140-141 — нет токена в диапазоне: в 140-141 нет ни одного из: «ApiResponse»
  roo_code/roo-context/api/00-conventions.md:65 → core/uploads/action.py:106-114 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 106-114
  roo_code/roo-context/api/00-conventions.md:71 → backend/app/modules/auth/features/me/action.py:44-72 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 44-72
  roo_code/roo-context/api/00-conventions.md:229 → types/config.ts:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «PermissionMatrix», «roles», «users», «rolePermissions»
  roo_code/roo-context/api/00-conventions.md:298 → backend/app/modules/auth/shared/models.py:167-189 — нет токена в диапазоне: в 167-189 нет ни одного из: «parent_id»
  roo_code/roo-context/api/00-conventions.md:357 → crud/action.py:512-516 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 512-516
  roo_code/roo-context/api/00-conventions.md:410 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «unitCost», «costSource», «allocations», «marginPercent»
  roo_code/roo-context/api/00-conventions.md:414 → types/audit.ts:63-74 — нет токена в диапазоне: в 63-74 нет ни одного из: «toRows»
  roo_code/roo-context/api/00-conventions.md:423 → composables/useOrderPermissions.ts:23-32 — нет токена в диапазоне: в 23-32 нет ни одного из: «requireRight», «maySeeCost»
  roo_code/roo-context/api/00-conventions.md:625 → suppliers/shared/models.py:312-316 — нет токена в диапазоне: в 312-316 нет ни одного из: «CASCADE», «category_fields.category_id», «CASCADE»
  roo_code/roo-context/api/00-conventions.md:659 → services/auditFeedService.ts:49-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 49-77
  roo_code/roo-context/api/00-conventions.md:708 → suppliers/shared/models.py:188-194 — нет токена в диапазоне: в 188-194 нет ни одного из: «StockAuditEntry»
  roo_code/roo-context/api/00-conventions.md:736 → types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «entity_type»
  roo_code/roo-context/api/00-conventions.md:750 → warehouse/shared/models.py:310-310 — нет токена в диапазоне: в 310-310 нет ни одного из: «old_value», «new_value», «Text»
  roo_code/roo-context/api/00-conventions.md:939 → mocks/index.ts:1583-1583 — нет токена в диапазоне: в 1583-1583 нет ни одного из: «ifMatchVersion»
  roo_code/roo-context/api/00-conventions.md:1002 → suppliers/shared/models.py:252-252 — нет токена в диапазоне: в 252-252 нет ни одного из: «bcc_events.source», «String(50)»
  roo_code/roo-context/api/00-conventions.md:1004 → suppliers/shared/models.py:129-129 — нет токена в диапазоне: в 129-129 нет ни одного из: «{ru,en,lt}», «String(255)»
  roo_code/roo-context/api/00-conventions.md:1043 → services/api.ts:153-156 — нет токена в диапазоне: в 153-156 нет ни одного из: «url.searchParams»
  roo_code/roo-context/api/00-conventions.md:1117 → types/client.ts:90-96 — нет токена в диапазоне: в 90-96 нет ни одного из: «SalesCrmStats»
  roo_code/roo-context/api/00-conventions.md:1144 → SettingsLayout.vue:436-446 — нет токена в диапазоне: в 436-446 нет ни одного из: «is_default»
  roo_code/roo-context/api/00-conventions.md:1229 → backend/app/core/uploads/action.py:78-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 78-146
  roo_code/roo-context/api/00-conventions.md:1256 → core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/roo-context/api/00-conventions.md:1262 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/roo-context/api/00-conventions.md:1306 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientName», «clientVatCode», «clientAddress», «clientPaymentTermsDays»
  roo_code/roo-context/api/00-conventions.md:1378 → mocks/finance.ts:421-429 — нет токена в диапазоне: в 421-429 нет ни одного из: «mockGetPayment», «clone», «user»
  roo_code/roo-context/api/00-conventions.md:1417 → mocks/categories.ts:1507-1507 — нет токена в диапазоне: в 1507-1507 нет ни одного из: «tmp-<…>»
  roo_code/roo-context/api/00-conventions.md:1464 → core/uploads/action.py:96-114 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 96-114
roo_code/roo-context/api/analytics.md: ссылок 203, битых 9, глазами 13, без токена 123
  roo_code/roo-context/api/analytics.md:73 → types/analytics.ts:216-251 — нет токена в диапазоне: в 216-251 нет ни одного из: «page»
  roo_code/roo-context/api/analytics.md:113 → mocks/analytics.ts:243-248 — нет токена в диапазоне: в 243-248 нет ни одного из: «deadstock»
  roo_code/roo-context/api/analytics.md:180 → mocks/index.ts:402-402 — нет токена в диапазоне: в 402-402 нет ни одного из: «/^\/api\/analytics\/(.+)$/»
  roo_code/roo-context/api/analytics.md:228 → mocks/analytics.ts:452-460 — нет токена в диапазоне: в 452-460 нет ни одного из: «salesByCategory»
  roo_code/roo-context/api/analytics.md:353 → mocks/analytics.ts:1-23 — нет токена в диапазоне: в 1-23 нет ни одного из: «MOCK_SETTINGS»
  roo_code/roo-context/api/analytics.md:364 → analyticsService.ts:5-5 — нет токена в диапазоне: в 5-5 нет ни одного из: «options?.headers», «GET»
  roo_code/roo-context/api/analytics.md:421 → services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «If-Match»
  roo_code/roo-context/api/analytics.md:440 → mocks/analytics.ts:589-646 — нет токена в диапазоне: в 589-646 нет ни одного из: «managers», «workers»
  roo_code/roo-context/api/analytics.md:443 → mocks/analytics.ts:725-793 — нет токена в диапазоне: в 725-793 нет ни одного из: «routes», «loads»
roo_code/roo-context/api/audit-feed.md: ссылок 183, битых 14, глазами 6, без токена 135
  roo_code/roo-context/api/audit-feed.md:76 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/audit-feed.md:100 → composables/useAuditFeed.ts:66-68 — нет токена в диапазоне: в 66-68 нет ни одного из: «pageSize», «totalPages»
  roo_code/roo-context/api/audit-feed.md:113 → LogsSettings.vue:170-173 — нет токена в диапазоне: в 170-173 нет ни одного из: «UNAUTHORIZED»
  roo_code/roo-context/api/audit-feed.md:128 → services/auditFeedService.ts:45-47 — нет токена в диапазоне: в 45-47 нет ни одного из: «getAuditFeedUsers»
  roo_code/roo-context/api/audit-feed.md:196 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:211 → types/audit.ts:63-74 — нет токена в диапазоне: в 63-74 нет ни одного из: «fieldValues»
  roo_code/roo-context/api/audit-feed.md:236 → mocks/auditFeed.ts:23-31 — нет токена в диапазоне: в 23-31 нет ни одного из: «tenant_id»
  roo_code/roo-context/api/audit-feed.md:260 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:281 → mocks/suppliers.ts:559-559 — нет токена в диапазоне: в 559-559 нет ни одного из: «warehouseAuditSources»
  roo_code/roo-context/api/audit-feed.md:302 → mocks/suppliers.ts:545-563 — нет токена в диапазоне: в 545-563 нет ни одного из: «getOrCreateMovementAudit»
  roo_code/roo-context/api/audit-feed.md:313 → types/audit.ts:127-130 — нет токена в диапазоне: в 127-130 нет ни одного из: «entryId»
  roo_code/roo-context/api/audit-feed.md:322 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/roo-context/api/audit-feed.md:336 → types/audit.ts:35-45 — нет токена в диапазоне: в 35-45 нет ни одного из: «:id»
  roo_code/roo-context/api/audit-feed.md:364 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «seeCost»
roo_code/roo-context/api/auth.md: ссылок 225, битых 2, глазами 17, без токена 155
  roo_code/roo-context/api/auth.md:496 → auth/shared/models.py:57-59 — нет токена в диапазоне: в 57-59 нет ни одного из: «secret_link_token»
  roo_code/roo-context/api/auth.md:550 → mocks/index.ts:1013-1013 — нет токена в диапазоне: в 1013-1013 нет ни одного из: «logout»
roo_code/roo-context/api/bcc.md: ссылок 400, битых 24, глазами 37, без токена 274
  roo_code/roo-context/api/bcc.md:88 → views/admin/suppliers/SupplierCardPage.vue:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «NOT_FOUND»
  roo_code/roo-context/api/bcc.md:109 → services/bccService.ts:6-8 — нет токена в диапазоне: в 6-8 нет ни одного из: «options?.headers»
  roo_code/roo-context/api/bcc.md:207 → services/mocks/bcc.ts:240-240 — нет токена в диапазоне: в 240-240 нет ни одного из: «suppliers»
  roo_code/roo-context/api/bcc.md:210 → services/mocks/bcc.ts:146-146 — нет токена в диапазоне: в 146-146 нет ни одного из: «'1'», «'6'»
  roo_code/roo-context/api/bcc.md:267 → BccRequestPage.vue:840-840 — нет токена в диапазоне: в 840-840 нет ни одного из: «getBccHistory»
  roo_code/roo-context/api/bcc.md:273 → services/mocks/bcc.ts:248-267 — нет токена в диапазоне: в 248-267 нет ни одного из: «structuredClone»
  roo_code/roo-context/api/bcc.md:372 → BccRequestPage.vue:266-269 — нет токена в диапазоне: в 266-269 нет ни одного из: «selectedRecipientIds»
  roo_code/roo-context/api/bcc.md:415 → services/bccService.ts:49-67 — нет токена в диапазоне: в 49-67 нет ни одного из: «fileIds», «send»
  roo_code/roo-context/api/bcc.md:430 → services/bccService.ts:56-56 — нет токена в диапазоне: в 56-56 нет ни одного из: «mockLogBccRequest»
  roo_code/roo-context/api/bcc.md:450 → services/mocks/index.ts:917-923 — нет токена в диапазоне: в 917-923 нет ни одного из: «onLogSourcePick»
  roo_code/roo-context/api/bcc.md:461 → types/bcc.ts:22-22 — нет токена в диапазоне: в 22-22 нет ни одного из: «:eventId»
  roo_code/roo-context/api/bcc.md:503 → services/mocks/bcc.ts:495-495 — нет токена в диапазоне: в 495-495 нет ни одного из: «mockAcceptResponse», «notifySupplierResponse»
  roo_code/roo-context/api/bcc.md:537 → services/mocks/bcc.ts:510-510 — нет токена в диапазоне: в 510-510 нет ни одного из: «source»
  roo_code/roo-context/api/bcc.md:585 → services/mocks/bcc.ts:495-495 — нет токена в диапазоне: в 495-495 нет ни одного из: «notifySupplierResponse», «mockAcceptResponse»
  roo_code/roo-context/api/bcc.md:589 → services/mocks/bcc.ts:492-494 — нет токена в диапазоне: в 492-494 нет ни одного из: «no-response»
  roo_code/roo-context/api/bcc.md:605 → backend/alembic/versions/f96e6fb2d5cf_phase_8_bcc.py:50-50 — нет токена в диапазоне: в 50-50 нет ни одного из: «created_at»
  roo_code/roo-context/api/bcc.md:692 → services/mocks/bcc.ts:265-265 — нет токена в диапазоне: в 265-265 нет ни одного из: «total»
  roo_code/roo-context/api/bcc.md:695 → backend/app/modules/bcc/shared/models.py:25-30 — нет токена в диапазоне: в 25-30 нет ни одного из: «created_at»
  roo_code/roo-context/api/bcc.md:734 → services/mocks/bcc.ts:435-437 — нет токена в диапазоне: в 435-437 нет ни одного из: «NO_RECIPIENTS»
  roo_code/roo-context/api/bcc.md:739 → backend/app/modules/bcc/features/send_request/transport.py:20-43 — нет токена в диапазоне: в 20-43 нет ни одного из: «send_message»
  roo_code/roo-context/api/bcc.md:750 → types/bcc.ts:22-22 — нет токена в диапазоне: в 22-22 нет ни одного из: «evt-001», «evt-${Date.now()}»
  roo_code/roo-context/api/bcc.md:795 → BccRequestPage.vue:203-212 — нет токена в диапазоне: в 203-212 нет ни одного из: «products»
  roo_code/roo-context/api/bcc.md:798 → services/mocks/bcc.ts:264-264 — нет токена в диапазоне: в 264-264 нет ни одного из: «structuredClone»
  roo_code/roo-context/api/bcc.md:829 → 03-api-contract.md:563-563 — нет токена в диапазоне: в 563-563 нет ни одного из: «DELETE», «delete»
roo_code/roo-context/api/categories.md: ссылок 181, битых 24, глазами 13, без токена 104
  roo_code/roo-context/api/categories.md:73 → services/api.ts:117-124 — нет токена в диапазоне: в 117-124 нет ни одного из: «ApiRequestError.status»
  roo_code/roo-context/api/categories.md:103 → mocks/categories.ts:1394-1394 — нет токена в диапазоне: в 1394-1394 нет ни одного из: «search»
  roo_code/roo-context/api/categories.md:147 → mocks/index.ts:415-415 — нет токена в диапазоне: в 415-415 нет ни одного из: «services/categoriesService.ts:getCategories»
  roo_code/roo-context/api/categories.md:156 → mocks/categories.ts:11-11 — нет токена в диапазоне: в 11-11 нет ни одного из: «:id», «cat-<n>»
  roo_code/roo-context/api/categories.md:225 → mocks/index.ts:421-421 — нет токена в диапазоне: в 421-421 нет ни одного из: «services/categoriesService.ts:getCategory»
  roo_code/roo-context/api/categories.md:245 → mocks/categories.ts:1364-1364 — нет токена в диапазоне: в 1364-1364 нет ни одного из: «name.en»
  roo_code/roo-context/api/categories.md:271 → mocks/index.ts:949-949 — нет токена в диапазоне: в 949-949 нет ни одного из: «services/categoriesService.ts:createCategory»
  roo_code/roo-context/api/categories.md:290 → composables/useDirtyCheck.ts:62-77 — нет токена в диапазоне: в 62-77 нет ни одного из: «linkedSuppliers»
  roo_code/roo-context/api/categories.md:298 → mocks/categories.ts:1468-1473 — нет токена в диапазоне: в 1468-1473 нет ни одного из: «undefined»
  roo_code/roo-context/api/categories.md:308 → CategoryCardPage.vue:92-92 — нет токена в диапазоне: в 92-92 нет ни одного из: «parentId», «getLevel»
  roo_code/roo-context/api/categories.md:315 → mocks/index.ts:1202-1202 — нет токена в диапазоне: в 1202-1202 нет ни одного из: «services/categoriesService.ts:patchCategory»
  roo_code/roo-context/api/categories.md:323 → CategoriesPage.vue:64-69 — нет токена в диапазоне: в 64-69 нет ни одного из: «categories.toast_deleted», «load()»
  roo_code/roo-context/api/categories.md:327 → services/api.ts:211-211 — нет токена в диапазоне: в 211-211 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/categories.md:356 → mocks/index.ts:1490-1490 — нет токена в диапазоне: в 1490-1490 нет ни одного из: «services/categoriesService.ts:deleteCategory»
  roo_code/roo-context/api/categories.md:379 → mocks/categories.ts:1507-1507 — нет токена в диапазоне: в 1507-1507 нет ни одного из: «Date.now()»
  roo_code/roo-context/api/categories.md:390 → mocks/categories.ts:1513-1513 — нет токена в диапазоне: в 1513-1513 нет ни одного из: «undefined»
  roo_code/roo-context/api/categories.md:397 → mocks/categories.ts:1510-1510 — нет токена в диапазоне: в 1510-1510 нет ни одного из: «fieldCount»
  roo_code/roo-context/api/categories.md:421 → mocks/index.ts:1173-1173 — нет токена в диапазоне: в 1173-1173 нет ни одного из: «services/categoriesService.ts:putCategoryFields»
  roo_code/roo-context/api/categories.md:457 → mocks/config.ts:42-42 — нет токена в диапазоне: в 42-42 нет ни одного из: «f-categories»
  roo_code/roo-context/api/categories.md:482 → CategoriesPage.vue:26-26 — нет токена в диапазоне: в 26-26 нет ни одного из: «v-if», «categoryFieldReorder»
  roo_code/roo-context/api/categories.md:507 → mocks/categories.ts:1510-1510 — нет токена в диапазоне: в 1510-1510 нет ни одного из: «fieldCount», «productCount»
  roo_code/roo-context/api/categories.md:545 → mocks/products.ts:996-996 — нет токена в диапазоне: в 996-996 нет ни одного из: «productCount»
  roo_code/roo-context/api/categories.md:554 → backend/app/modules/products/shared/models.py:201-205 — нет токена в диапазоне: в 201-205 нет ни одного из: «UniqueConstraint»
  roo_code/roo-context/api/categories.md:558 → backend/app/modules/products/shared/models.py:68-70 — нет токена в диапазоне: в 68-70 нет ни одного из: «email»
roo_code/roo-context/api/clients.md: ссылок 267, битых 50, глазами 7, без токена 163
  roo_code/roo-context/api/clients.md:36 → services/clientsService.ts:1-57 — нет токена в диапазоне: в 1-57 нет ни одного из: «Authorization», «X-CSRF-Token»
  roo_code/roo-context/api/clients.md:63 → mocks/index.ts:334-334 — нет токена в диапазоне: в 334-334 нет ни одного из: «name», «companyCode», «email»
  roo_code/roo-context/api/clients.md:69 → mocks/index.ts:605-605 — нет токена в диапазоне: в 605-605 нет ни одного из: «totalPages»
  roo_code/roo-context/api/clients.md:78 → mocks/clients.ts:1075-1077 — нет токена в диапазоне: в 1075-1077 нет ни одного из: «String(e)»
  roo_code/roo-context/api/clients.md:96 → services/api.ts:154-155 — нет токена в диапазоне: в 154-155 нет ни одного из: «null»
  roo_code/roo-context/api/clients.md:117 → mocks/index.ts:473-473 — нет токена в диапазоне: в 473-473 нет ни одного из: «services/clientsService.ts:getClients», «mocks/clients.ts:mockGetClients»
  roo_code/roo-context/api/clients.md:152 → mocks/index.ts:615-615 — нет токена в диапазоне: в 615-615 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/roo-context/api/clients.md:177 → mocks/index.ts:518-518 — нет токена в диапазоне: в 518-518 нет ни одного из: «services/clientsService.ts:getClient», «mocks/clients.ts:mockGetClient»
  roo_code/roo-context/api/clients.md:188 → types/client.ts:60-73 — нет токена в диапазоне: в 60-73 нет ни одного из: «interactionHistory»
  roo_code/roo-context/api/clients.md:210 → mocks/clients.ts:1141-1141 — нет токена в диапазоне: в 1141-1141 нет ни одного из: «ApiResponse<Client>»
  roo_code/roo-context/api/clients.md:211 → mocks/clients.ts:1071-1073 — нет токена в диапазоне: в 1071-1073 нет ни одного из: «CL-NNN»
  roo_code/roo-context/api/clients.md:245 → mocks/clients.ts:1123-1125 — нет токена в диапазоне: в 1123-1125 нет ни одного из: «email»
  roo_code/roo-context/api/clients.md:263 → mocks/index.ts:961-961 — нет токена в диапазоне: в 961-961 нет ни одного из: «services/clientsService.ts:createClient», «mocks/clients.ts:mockCreateClient»
  roo_code/roo-context/api/clients.md:275 → composables/useDirtyCheck.ts:62-77 — нет токена в диапазоне: в 62-77 нет ни одного из: «interactionHistory»
  roo_code/roo-context/api/clients.md:279 → mocks/clients.ts:1163-1163 — нет токена в диапазоне: в 1163-1163 нет ни одного из: «ApiResponse<Client>»
  roo_code/roo-context/api/clients.md:280 → useClientCard.ts:274-274 — нет токена в диапазоне: в 274-274 нет ни одного из: «save()»
  roo_code/roo-context/api/clients.md:285 → domain/paymentTerms.ts:18-20 — нет токена в диапазоне: в 18-20 нет ни одного из: «catch»
  roo_code/roo-context/api/clients.md:295 → mocks/clients.ts:1162-1162 — нет токена в диапазоне: в 1162-1162 нет ни одного из: «createdAt», «auditLog», «diff()»
  roo_code/roo-context/api/clients.md:310 → mocks/index.ts:1250-1250 — нет токена в диапазоне: в 1250-1250 нет ни одного из: «services/clientsService.ts:patchClient», «mocks/clients.ts:mockPatchClient»
  roo_code/roo-context/api/clients.md:321 → mocks/index.ts:1527-1527 — нет токена в диапазоне: в 1527-1527 нет ни одного из: «ApiResponse<void>», «undefined»
  roo_code/roo-context/api/clients.md:328 → useClients.ts:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «clients.toast_error_delete»
  roo_code/roo-context/api/clients.md:348 → mocks/index.ts:1524-1524 — нет токена в диапазоне: в 1524-1524 нет ни одного из: «services/clientsService.ts:deleteClient», «mocks/clients.ts:mockDeleteClient»
  roo_code/roo-context/api/clients.md:394 → mocks/clients.ts:79-79 — нет токена в диапазоне: в 79-79 нет ни одного из: «user_id»
  roo_code/roo-context/api/clients.md:404 → mocks/index.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «services/clientsService.ts:getClientAudit», «mocks/clients.ts:mockGetClientAudit»
  roo_code/roo-context/api/clients.md:414 → services/clientsService.ts:44-46 — нет токена в диапазоне: в 44-46 нет ни одного из: «StockAuditEntry.id»
  roo_code/roo-context/api/clients.md:419 → mocks/index.ts:1536-1536 — нет токена в диапазоне: в 1536-1536 нет ни одного из: «ApiResponse<void>»
  roo_code/roo-context/api/clients.md:443 → mocks/index.ts:1530-1530 — нет токена в диапазоне: в 1530-1530 нет ни одного из: «services/clientsService.ts:deleteClientAuditEntry», «mocks/clients.ts:mockDeleteClientAuditEntry»
  roo_code/roo-context/api/clients.md:468 → mocks/clients.ts:1216-1216 — нет токена в диапазоне: в 1216-1216 нет ни одного из: «ApiResponse<InteractionHistoryEntry>»
  roo_code/roo-context/api/clients.md:470 → useClientCard.ts:253-253 — нет токена в диапазоне: в 253-253 нет ни одного из: «inlineAddInteraction»
  roo_code/roo-context/api/clients.md:474 → mocks/clients.ts:1206-1217 — нет токена в диапазоне: в 1206-1217 нет ни одного из: «summary»
  roo_code/roo-context/api/clients.md:498 → mocks/index.ts:965-965 — нет токена в диапазоне: в 965-965 нет ни одного из: «services/clientsService.ts:addClientInteraction», «mocks/clients.ts:mockAddClientInteraction»
  roo_code/roo-context/api/clients.md:511 → mocks/index.ts:1726-1726 — нет токена в диапазоне: в 1726-1726 нет ни одного из: «/^\/api\/clients\/([^/]+)\/interactions\/(\d+)$/»
  roo_code/roo-context/api/clients.md:512 → mocks/clients.ts:1233-1233 — нет токена в диапазоне: в 1233-1233 нет ни одного из: «InteractionHistoryEntry»
  roo_code/roo-context/api/clients.md:519 → mocks/index.ts:1545-1545 — нет токена в диапазоне: в 1545-1545 нет ни одного из: «ApiResponse<void>»
  roo_code/roo-context/api/clients.md:528 → useClientCard.ts:158-160 — нет токена в диапазоне: в 158-160 нет ни одного из: «load()»
  roo_code/roo-context/api/clients.md:543 → mocks/index.ts:1539-1539 — нет токена в диапазоне: в 1539-1539 нет ни одного из: «services/clientsService.ts:deleteClientInteraction», «mocks/clients.ts:mockDeleteClientInteraction»
  roo_code/roo-context/api/clients.md:606 → mocks/index.ts:533-533 — нет токена в диапазоне: в 533-533 нет ни одного из: «services/clientsService.ts:getClientInvoiceSummary», «mocks/orders.ts:mockGetClientInvoiceSummary»
  roo_code/roo-context/api/clients.md:622 → domain/countries.ts:324-324 — нет токена в диапазоне: в 324-324 нет ни одного из: «suggestedDocumentType»
  roo_code/roo-context/api/clients.md:633 → mocks/index.ts:452-452 — нет токена в диапазоне: в 452-452 нет ни одного из: «pageSize»
  roo_code/roo-context/api/clients.md:643 → mocks/notifications.ts:722-726 — нет токена в диапазоне: в 722-726 нет ни одного из: «inactive»
  roo_code/roo-context/api/clients.md:651 → types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «clientAuditSources»
  roo_code/roo-context/api/clients.md:660 → types/client.ts:15-49 — нет токена в диапазоне: в 15-49 нет ни одного из: «fieldValues»
  roo_code/roo-context/api/clients.md:664 → mocks/config.ts:241-241 — нет токена в диапазоне: в 241-241 нет ни одного из: «clients»
  roo_code/roo-context/api/clients.md:681 → services/clientsService.ts:1-57 — нет токена в диапазоне: в 1-57 нет ни одного из: «options»
  roo_code/roo-context/api/clients.md:707 → useClientCard.ts:273-304 — нет токена в диапазоне: в 273-304 нет ни одного из: «POST»
  roo_code/roo-context/api/clients.md:712 → types/client.ts:15-49 — нет токена в диапазоне: в 15-49 нет ни одного из: «If-Match»
  roo_code/roo-context/api/clients.md:715 → mocks/index.ts:605-605 — нет токена в диапазоне: в 605-605 нет ни одного из: «totalPages»
  roo_code/roo-context/api/clients.md:727 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientPaymentTermsDays»
  roo_code/roo-context/api/clients.md:745 → domain/countries.ts:3-18 — нет токена в диапазоне: в 3-18 нет ни одного из: «null»
  roo_code/roo-context/api/clients.md:747 → ClientCreatePage.vue:73-80 — нет токена в диапазоне: в 73-80 нет ни одного из: «address»
roo_code/roo-context/api/config.md: ссылок 387, битых 53, глазами 38, без токена 242
  roo_code/roo-context/api/config.md:57 → mocks/config.ts:117-117 — нет токена в диапазоне: в 117-117 нет ни одного из: «Contacts», «Location», «Logistics»
  roo_code/roo-context/api/config.md:80 → useCardConfig.ts:51-55 — нет токена в диапазоне: в 51-55 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:146 → useCardConfig.ts:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «GET»
  roo_code/roo-context/api/config.md:150 → useCardConfig.ts:45-61 — нет токена в диапазоне: в 45-61 нет ни одного из: «load()»
  roo_code/roo-context/api/config.md:172 → configService.ts:16-19 — нет токена в диапазоне: в 16-19 нет ни одного из: «required», «options»
  roo_code/roo-context/api/config.md:231 → composables/useCategoryCard.ts:147-147 — нет токена в диапазоне: в 147-147 нет ни одного из: «confirmDeleteField»
  roo_code/roo-context/api/config.md:240 → mocks/config.ts:301-303 — нет токена в диапазоне: в 301-303 нет ни одного из: «sec.fields»
  roo_code/roo-context/api/config.md:267 → useCardConfig.ts:32-32 — нет токена в диапазоне: в 32-32 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:289 → mocks/config.ts:250-252 — нет токена в диапазоне: в 250-252 нет ни одного из: «mockSaveSections»
  roo_code/roo-context/api/config.md:316 → SupplierCardConfigPage.vue:494-508 — нет токена в диапазоне: в 494-508 нет ни одного из: «PATCH»
  roo_code/roo-context/api/config.md:317 → useCardConfig.ts:53-53 — нет токена в диапазоне: в 53-53 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:326 → types/config.ts:20-21 — нет токена в диапазоне: в 20-21 нет ни одного из: «system»
  roo_code/roo-context/api/config.md:375 → e24a3922ed01_phase_7_config.py:43-53 — нет токена в диапазоне: в 43-53 нет ни одного из: «UniqueConstraint»
  roo_code/roo-context/api/config.md:447 → useCardConfig.ts:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:477 → mocks/config.ts:179-184 — нет токена в диапазоне: в 179-184 нет ни одного из: «userPermissions»
  roo_code/roo-context/api/config.md:490 → mocks/config.ts:186-186 — нет токена в диапазоне: в 186-186 нет ни одного из: «PERMISSION_ROLES»
  roo_code/roo-context/api/config.md:492 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «users.role»
  roo_code/roo-context/api/config.md:499 → mocks/config.ts:210-218 — нет токена в диапазоне: в 210-218 нет ни одного из: «can_read», «server_default="true"»
  roo_code/roo-context/api/config.md:511 → backend/app/modules/auth/shared/models.py:167-258 — нет токена в диапазоне: в 167-258 нет ни одного из: «select()»
  roo_code/roo-context/api/config.md:522 → useCardConfig.ts:54-54 — нет токена в диапазоне: в 54-54 нет ни одного из: «Promise.all»
  roo_code/roo-context/api/config.md:528 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «roles», «user_roles.role_name»
  roo_code/roo-context/api/config.md:534 → suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «section_configs.name_translations»
  roo_code/roo-context/api/config.md:538 → SupplierCardConfigPage.vue:205-308 — нет токена в диапазоне: в 205-308 нет ни одного из: «mockSavePermissions»
  roo_code/roo-context/api/config.md:555 → useCardConfig.ts:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «load()»
  roo_code/roo-context/api/config.md:582 → backend/app/modules/suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «uq_field_definitions_tenant_name», «FIELD_NAME_TAKEN», «fieldErrors»
  roo_code/roo-context/api/config.md:608 → SupplierCardConfigPage.vue:86-91 — нет токена в диапазоне: в 86-91 нет ни одного из: «'text'»
  roo_code/roo-context/api/config.md:610 → backend/app/modules/suppliers/shared/models.py:253-253 — нет токена в диапазоне: в 253-253 нет ни одного из: «CHECK»
  roo_code/roo-context/api/config.md:633 → backend/app/core/base.py:42-54 — нет токена в диапазоне: в 42-54 нет ни одного из: «created_by»
  roo_code/roo-context/api/config.md:639 → configService.ts:6-42 — нет токена в диапазоне: в 6-42 нет ни одного из: «field_definitions»
  roo_code/roo-context/api/config.md:641 → frontend_vue/src/types/supplier.ts:12-31 — нет токена в диапазоне: в 12-31 нет ни одного из: «fieldValues», «suppliers»
  roo_code/roo-context/api/config.md:642 → backend/app/modules/suppliers/shared/models.py:17-62 — нет токена в диапазоне: в 17-62 нет ни одного из: «supplier_field_values»
  roo_code/roo-context/api/config.md:645 → backend/app/modules/products/shared/models.py:194-198 — нет токена в диапазоне: в 194-198 нет ни одного из: «f-certified»
  roo_code/roo-context/api/config.md:657 → frontend_vue/src/types/i18n.ts:6-10 — нет токена в диапазоне: в 6-10 нет ни одного из: «usageCount»
  roo_code/roo-context/api/config.md:683 → frontend_vue/src/router/index.ts:192-197 — нет токена в диапазоне: в 192-197 нет ни одного из: «permissionsEditor»
  roo_code/roo-context/api/config.md:684 → SupplierCardConfigPage.vue:21-21 — нет токена в диапазоне: в 21-21 нет ни одного из: «true»
  roo_code/roo-context/api/config.md:710 → backend/app/modules/suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:717 → mocks/config.ts:191-203 — нет токена в диапазоне: в 191-203 нет ни одного из: «MOCK_SECTIONS», «permission_items»
  roo_code/roo-context/api/config.md:718 → backend/app/modules/auth/shared/models.py:179-181 — нет токена в диапазоне: в 179-181 нет ни одного из: «name_translations»
  roo_code/roo-context/api/config.md:720 → backend/app/modules/suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «usageCount»
  roo_code/roo-context/api/config.md:725 → mocks/config.ts:250-252 — нет токена в диапазоне: в 250-252 нет ни одного из: «sort_order»
  roo_code/roo-context/api/config.md:726 → backend/app/modules/suppliers/shared/models.py:282-282 — нет токена в диапазоне: в 282-282 нет ни одного из: «roles», «users»
  roo_code/roo-context/api/config.md:727 → backend/app/modules/auth/shared/models.py:120-120 — нет токена в диапазоне: в 120-120 нет ни одного из: «user_roles.role_name», «users»
  roo_code/roo-context/api/config.md:728 → configService.ts:80-81 — нет токена в диапазоне: в 80-81 нет ни одного из: «PUT»
  roo_code/roo-context/api/config.md:743 → suppliers/shared/models.py:281-281 — нет токена в диапазоне: в 281-281 нет ни одного из: «permission_items.name_translations»
  roo_code/roo-context/api/config.md:754 → e24a3922ed01_phase_7_config.py:34-34 — нет токена в диапазоне: в 34-34 нет ни одного из: «fieldId.startsWith('f-custom-')»
  roo_code/roo-context/api/config.md:759 → types/config.ts:24-25 — нет токена в диапазоне: в 24-25 нет ни одного из: «phase_7_config»
  roo_code/roo-context/api/config.md:790 → mocks/config.ts:191-203 — нет токена в диапазоне: в 191-203 нет ни одного из: «permission_items»
  roo_code/roo-context/api/config.md:822 → mocks/config.ts:318-321 — нет токена в диапазоне: в 318-321 нет ни одного из: «createField»
  roo_code/roo-context/api/config.md:829 → frontend_vue/src/types/i18n.ts:53-63 — нет токена в диапазоне: в 53-63 нет ни одного из: «toTranslatedString»
  roo_code/roo-context/api/config.md:872 → suppliers/shared/models.py:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «DUPLICATE», «uq_field_definitions_tenant_name»
  roo_code/roo-context/api/config.md:875 → mocks/config.ts:346-346 — нет токена в диапазоне: в 346-346 нет ни одного из: «fields», «PATCH», «Object.assign»
  roo_code/roo-context/api/config.md:885 → mocks/config.ts:232-232 — нет токена в диапазоне: в 232-232 нет ни одного из: «MOCK_PERMISSIONS»
  roo_code/roo-context/api/config.md:919 → auth/shared/models.py:236-240 — нет токена в диапазоне: в 236-240 нет ни одного из: «UserPermission.user_id», «uuid», «users»
roo_code/roo-context/api/finance.md: ссылок 344, битых 39, глазами 30, без токена 221
  roo_code/roo-context/api/finance.md:54 → backend/app/core/exceptions.py:13-20 — нет токена в диапазоне: в 13-20 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/roo-context/api/finance.md:129 → views/admin/finance/IncomingPaymentsPage.vue:40-47 — нет токена в диапазоне: в 40-47 нет ни одного из: «ReceivableStatus»
  roo_code/roo-context/api/finance.md:136 → services/financeService.ts:20-20 — нет токена в диапазоне: в 20-20 нет ни одного из: «options?.headers»
  roo_code/roo-context/api/finance.md:168 → mocks/notifications.ts:684-684 — нет токена в диапазоне: в 684-684 нет ни одного из: «notifyPaymentOverdue»
  roo_code/roo-context/api/finance.md:207 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/finance.md:222 → mocks/finance.ts:416-416 — нет токена в диапазоне: в 416-416 нет ни одного из: «documents.length»
  roo_code/roo-context/api/finance.md:231 → mocks/finance.ts:72-72 — нет токена в диапазоне: в 72-72 нет ни одного из: «receivables()»
  roo_code/roo-context/api/finance.md:262 → services/financeService.ts:41-43 — нет токена в диапазоне: в 41-43 нет ни одного из: «encodeURIComponent»
  roo_code/roo-context/api/finance.md:281 → mocks/finance.ts:109-115 — нет токена в диапазоне: в 109-115 нет ни одного из: «sup-001…sup-005», «'1'…'6'»
  roo_code/roo-context/api/finance.md:285 → finance/shared/models.py:11-55 — нет токена в диапазоне: в 11-55 нет ни одного из: «If-Match»
  roo_code/roo-context/api/finance.md:294 → mocks/finance.ts:427-428 — нет токена в диапазоне: в 427-428 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/roo-context/api/finance.md:297 → mocks/finance.ts:426-430 — нет токена в диапазоне: в 426-430 нет ни одного из: «mockGetPayment»
  roo_code/roo-context/api/finance.md:331 → mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «notes»
  roo_code/roo-context/api/finance.md:351 → b2619dfeb90f_phase_10_finance.py:44-45 — нет токена в диапазоне: в 44-45 нет ни одного из: «TimestampMixin»
  roo_code/roo-context/api/finance.md:359 → mocks/finance.ts:474-475 — нет токена в диапазоне: в 474-475 нет ни одного из: «PAYMENT_NOT_FOUND», «VALIDATION_ERROR»
  roo_code/roo-context/api/finance.md:406 → mocks/index.ts:343-343 — нет токена в диапазоне: в 343-343 нет ни одного из: «parseFinanceListParams»
  roo_code/roo-context/api/finance.md:455 → backend/app/modules/finance/features/archive/action.py:18-18 — нет токена в диапазоне: в 18-18 нет ни одного из: «list_archive_items»
  roo_code/roo-context/api/finance.md:501 → mocks/notifications.ts:684-684 — нет токена в диапазоне: в 684-684 нет ни одного из: «notifyPaymentOverdue»
  roo_code/roo-context/api/finance.md:503 → mocks/finance.ts:483-486 — нет токена в диапазоне: в 483-486 нет ни одного из: «overdue»
  roo_code/roo-context/api/finance.md:511 → mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «commit»
  roo_code/roo-context/api/finance.md:522 → mocks/index.ts:392-393 — нет токена в диапазоне: в 392-393 нет ни одного из: «finance_payments»
  roo_code/roo-context/api/finance.md:539 → mocks/config.ts:183-183 — нет токена в диапазоне: в 183-183 нет ни одного из: «Accounting», «description»
  roo_code/roo-context/api/finance.md:559 → types/finance.ts:64-64 — нет токена в диапазоне: в 64-64 нет ни одного из: «String(50)»
  roo_code/roo-context/api/finance.md:569 → mocks/orders.ts:4715-4715 — нет токена в диапазоне: в 4715-4715 нет ни одного из: «tenant_id», «tenants.id», «ondelete="CASCADE"»
  roo_code/roo-context/api/finance.md:581 → mocks/finance.ts:426-427 — нет токена в диапазоне: в 426-427 нет ни одного из: «mockGetPayment»
  roo_code/roo-context/api/finance.md:582 → router/index.ts:326-326 — нет токена в диапазоне: в 326-326 нет ни одного из: «financeIncoming», «financeOutgoing»
  roo_code/roo-context/api/finance.md:599 → services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «POST»
  roo_code/roo-context/api/finance.md:617 → domain/receivable.ts:101-117 — нет токена в диапазоне: в 101-117 нет ни одного из: «dueDate»
  roo_code/roo-context/api/finance.md:620 → domain/receivable.ts:30-64 — нет токена в диапазоне: в 30-64 нет ни одного из: «paidAt»
  roo_code/roo-context/api/finance.md:621 → domain/receivable.ts:165-176 — нет токена в диапазоне: в 165-176 нет ни одного из: «outstandingAmount»
  roo_code/roo-context/api/finance.md:623 → mocks/finance.ts:43-50 — нет токена в диапазоне: в 43-50 нет ни одного из: «documentCount», «documents.length»
  roo_code/roo-context/api/finance.md:624 → mocks/finance.ts:416-416 — нет токена в диапазоне: в 416-416 нет ни одного из: «document_count»
  roo_code/roo-context/api/finance.md:647 → types/finance.ts:29-29 — нет токена в диапазоне: в 29-29 нет ни одного из: «counterparty_id», «counterparty_vat_code», «nullable=True»
  roo_code/roo-context/api/finance.md:651 → types/finance.ts:74-76 — нет токена в диапазоне: в 74-76 нет ни одного из: «document_count»
  roo_code/roo-context/api/finance.md:704 → mocks/finance.ts:102-102 — нет токена в диапазоне: в 102-102 нет ни одного из: «filtered.sort»
  roo_code/roo-context/api/finance.md:748 → views/admin/finance/DocumentArchivePage.vue:203-207 — нет токена в диапазоне: в 203-207 нет ни одного из: «FileItem»
  roo_code/roo-context/api/finance.md:749 → views/admin/finance/OutgoingPaymentCardPage.vue:8-8 — нет токена в диапазоне: в 8-8 нет ни одного из: «url»
  roo_code/roo-context/api/finance.md:777 → 03-api-contract.md:2024-2024 — нет токена в диапазоне: в 2024-2024 нет ни одного из: «page», «pageSize»
  roo_code/roo-context/api/finance.md:820 → mocks/finance.ts:145-145 — нет токена в диапазоне: в 145-145 нет ни одного из: «'EUR'»
roo_code/roo-context/api/notifications.md: ссылок 203, битых 32, глазами 15, без токена 127
  roo_code/roo-context/api/notifications.md:70 → mocks/notifications.ts:432-434 — нет токена в диапазоне: в 432-434 нет ни одного из: «mockGetUnreadCount», «mockMarkAsRead»
  roo_code/roo-context/api/notifications.md:127 → NotificationsPage.vue:105-112 — нет токена в диапазоне: в 105-112 нет ни одного из: «type»
  roo_code/roo-context/api/notifications.md:159 → mocks/notifications.ts:389-389 — нет токена в диапазоне: в 389-389 нет ни одного из: «localeCompare»
  roo_code/roo-context/api/notifications.md:165 → mocks/notifications.ts:424-424 — нет токена в диапазоне: в 424-424 нет ни одного из: «structuredClone(items)»
  roo_code/roo-context/api/notifications.md:203 → mocks/notifications.ts:432-432 — нет токена в диапазоне: в 432-432 нет ни одного из: «ApiResponse<number>»
  roo_code/roo-context/api/notifications.md:222 → NotificationDropdown.vue:96-96 — нет токена в диапазоне: в 96-96 нет ни одного из: «startPolling»
  roo_code/roo-context/api/notifications.md:229 → backend/app/modules/notifications/features/feed/action.py:51-51 — нет токена в диапазоне: в 51-51 нет ни одного из: «unread_count»
  roo_code/roo-context/api/notifications.md:230 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «is_read»
  roo_code/roo-context/api/notifications.md:245 → mocks/index.ts:1394-1394 — нет токена в диапазоне: в 1394-1394 нет ни одного из: «/^\/api\/notifications\/([^/]+)\/read$/»
  roo_code/roo-context/api/notifications.md:255 → mocks/index.ts:1397-1397 — нет токена в диапазоне: в 1397-1397 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/notifications.md:265 → mocks/notifications.ts:436-441 — нет токена в диапазоне: в 436-441 нет ни одного из: «else», «NOTIFICATION_NOT_FOUND»
  roo_code/roo-context/api/notifications.md:276 → backend/app/modules/notifications/features/feed/action.py:71-71 — нет токена в диапазоне: в 71-71 нет ни одного из: «mark_read», «notification_reads»
  roo_code/roo-context/api/notifications.md:277 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «read_at»
  roo_code/roo-context/api/notifications.md:281 → mocks/notifications.ts:436-441 — нет токена в диапазоне: в 436-441 нет ни одного из: «mockMarkAsRead»
  roo_code/roo-context/api/notifications.md:301 → mocks/index.ts:1392-1392 — нет токена в диапазоне: в 1392-1392 нет ни одного из: «ApiResponse<null>»
  roo_code/roo-context/api/notifications.md:320 → backend/app/modules/notifications/features/feed/action.py:61-61 — нет токена в диапазоне: в 61-61 нет ни одного из: «mark_all_read», «notification_reads»
  roo_code/roo-context/api/notifications.md:321 → backend/app/modules/notifications/shared/models.py:33-36 — нет токена в диапазоне: в 33-36 нет ни одного из: «is_read»
  roo_code/roo-context/api/notifications.md:325 → mocks/notifications.ts:443-445 — нет токена в диапазоне: в 443-445 нет ни одного из: «mockMarkAllAsRead»
  roo_code/roo-context/api/notifications.md:338 → mocks/notifications.ts:465-468 — нет токена в диапазоне: в 465-468 нет ни одного из: «createdAt»
  roo_code/roo-context/api/notifications.md:350 → mocks/notifications.ts:518-518 — нет токена в диапазоне: в 518-518 нет ни одного из: «notif-ev-${eventSeq++}», «mockResetNotifications»
  roo_code/roo-context/api/notifications.md:356 → mocks/notifications.ts:380-384 — нет токена в диапазоне: в 380-384 нет ни одного из: «null»
  roo_code/roo-context/api/notifications.md:366 → mocks/notifications.ts:560-560 — нет токена в диапазоне: в 560-560 нет ни одного из: «order.id», «order.orderNumber»
  roo_code/roo-context/api/notifications.md:389 → useNotifications.ts:101-101 — нет токена в диапазоне: в 101-101 нет ни одного из: «30_000»
  roo_code/roo-context/api/notifications.md:412 → mocks/notifications.ts:504-512 — нет токена в диапазоне: в 504-512 нет ни одного из: «seeding», «emit»
  roo_code/roo-context/api/notifications.md:479 → composables/useAuth.ts:101-108 — нет токена в диапазоне: в 101-108 нет ни одного из: «X-CSRF-Token»
  roo_code/roo-context/api/notifications.md:506 → mocks/finance.ts:486-486 — нет токена в диапазоне: в 486-486 нет ни одного из: «emit»
  roo_code/roo-context/api/notifications.md:512 → mocks/notifications.ts:433-433 — нет токена в диапазоне: в 433-433 нет ни одного из: «unreadCount»
  roo_code/roo-context/api/notifications.md:514 → mocks/notifications.ts:428-428 — нет токена в диапазоне: в 428-428 нет ни одного из: «totalPages»
  roo_code/roo-context/api/notifications.md:517 → types/notifications.ts:25-25 — нет токена в диапазоне: в 25-25 нет ни одного из: «router.push»
  roo_code/roo-context/api/notifications.md:519 → models.py:31-32 — нет токена в диапазоне: в 31-32 нет ни одного из: «entityType»
  roo_code/roo-context/api/notifications.md:595 → services/api.ts:128-137 — нет токена в диапазоне: в 128-137 нет ни одного из: «number», «ApiResponse», «unwrap()», «success», «ApiResponse<number>»
  roo_code/roo-context/api/notifications.md:599 → mocks/notifications.ts:739-748 — нет токена в диапазоне: в 739-748 нет ни одного из: «reserve_expiring»
roo_code/roo-context/api/orders.md: ссылок 564, битых 84, глазами 88, без токена 325
  roo_code/roo-context/api/orders.md:66 → mocks/orders.ts:1955-1958 — нет токена в диапазоне: в 1955-1958 нет ни одного из: «bumpVersion»
  roo_code/roo-context/api/orders.md:70 → services/ordersService.ts:41-43 — нет токена в диапазоне: в 41-43 нет ни одного из: «ifMatchVersion»
  roo_code/roo-context/api/orders.md:81 → mocks/index.ts:255-257 — нет токена в диапазоне: в 255-257 нет ни одного из: «delay(...)»
  roo_code/roo-context/api/orders.md:82 → services/api.ts:128-138 — нет токена в диапазоне: в 128-138 нет ни одного из: «ApiResponse<T>»
  roo_code/roo-context/api/orders.md:124 → composables/useClientCard.ts:179-190 — нет токена в диапазоне: в 179-190 нет ни одного из: «total»
  roo_code/roo-context/api/orders.md:125 → views/admin/clients/ClientsListPage.vue:105-116 — нет токена в диапазоне: в 105-116 нет ни одного из: «total»
  roo_code/roo-context/api/orders.md:138 → mocks/orders.ts:1609-1609 — нет токена в диапазоне: в 1609-1609 нет ни одного из: «mockCreateOrder»
  roo_code/roo-context/api/orders.md:143 → mocks/orders.ts:1641-1641 — нет токена в диапазоне: в 1641-1641 нет ни одного из: «data.currency»
  roo_code/roo-context/api/orders.md:145 → mocks/orders.ts:1633-1633 — нет токена в диапазоне: в 1633-1633 нет ни одного из: «ApiResponse<Order>»
  roo_code/roo-context/api/orders.md:149 → mocks/orders.ts:1616-1616 — нет токена в диапазоне: в 1616-1616 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/roo-context/api/orders.md:176 → mocks/orders.ts:1602-1602 — нет токена в диапазоне: в 1602-1602 нет ни одного из: «mockGetOrder»
  roo_code/roo-context/api/orders.md:216 → mocks/orders.ts:1694-1694 — нет токена в диапазоне: в 1694-1694 нет ни одного из: «mockPatchOrder»
  roo_code/roo-context/api/orders.md:223 → mocks/orders.ts:1712-1722 — нет токена в диапазоне: в 1712-1722 нет ни одного из: «Partial<Order>»
  roo_code/roo-context/api/orders.md:239 → mocks/orders.ts:1714-1714 — нет токена в диапазоне: в 1714-1714 нет ни одного из: «currency»
  roo_code/roo-context/api/orders.md:252 → mocks/orders.ts:2055-2055 — нет токена в диапазоне: в 2055-2055 нет ни одного из: «mockDeleteOrder»
  roo_code/roo-context/api/orders.md:265 → mocks/orders.ts:2073-2073 — нет токена в диапазоне: в 2073-2073 нет ни одного из: «releaseOrder»
  roo_code/roo-context/api/orders.md:270 → composables/useOrderCard.ts:575-575 — нет токена в диапазоне: в 575-575 нет ни одного из: «atVersion()»
  roo_code/roo-context/api/orders.md:281 → mocks/orders.ts:1796-1796 — нет токена в диапазоне: в 1796-1796 нет ни одного из: «mockPatchOrderStatus»
  roo_code/roo-context/api/orders.md:285 → mocks/index.ts:1262-1267 — нет токена в диапазоне: в 1262-1267 нет ни одного из: «ORDER_STATUSES»
  roo_code/roo-context/api/orders.md:288 → mocks/orders.ts:1841-1841 — нет токена в диапазоне: в 1841-1841 нет ни одного из: «ApiResponse<Order>»
  roo_code/roo-context/api/orders.md:303 → composables/useOrderCard.ts:662-662 — нет токена в диапазоне: в 662-662 нет ни одного из: «flushBeforeReload»
  roo_code/roo-context/api/orders.md:312 → mocks/orders.ts:1770-1770 — нет токена в диапазоне: в 1770-1770 нет ни одного из: «mockPlanStatusTransition»
  roo_code/roo-context/api/orders.md:316 → services/ordersService.ts:92-97 — нет токена в диапазоне: в 92-97 нет ни одного из: «'new'»
  roo_code/roo-context/api/orders.md:325 → mocks/orders.ts:1775-1775 — нет токена в диапазоне: в 1775-1775 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:331 → domain/orderStatus.ts:15-31 — нет токена в диапазоне: в 15-31 нет ни одного из: «statusRules»
  roo_code/roo-context/api/orders.md:333 → mocks/settings.ts:620-620 — нет токена в диапазоне: в 620-620 нет ни одного из: «isOrderStatus»
  roo_code/roo-context/api/orders.md:351 → mocks/orders.ts:2082-2082 — нет токена в диапазоне: в 2082-2082 нет ни одного из: «mockAddOrderItem»
  roo_code/roo-context/api/orders.md:358 → mocks/orders.ts:2156-2156 — нет токена в диапазоне: в 2156-2156 нет ни одного из: «refuseStatedCost»
  roo_code/roo-context/api/orders.md:376 → services/ordersService.ts:126-126 — нет токена в диапазоне: в 126-126 нет ни одного из: «unit»
  roo_code/roo-context/api/orders.md:378 → mocks/orders.ts:3045-3045 — нет токена в диапазоне: в 3045-3045 нет ни одного из: «uomIdFromOrderLineUnit»
  roo_code/roo-context/api/orders.md:382 → mocks/orders.ts:2189-2189 — нет токена в диапазоне: в 2189-2189 нет ни одного из: «baseCurrencyOf»
  roo_code/roo-context/api/orders.md:396 → mocks/orders.ts:2220-2220 — нет токена в диапазоне: в 2220-2220 нет ни одного из: «mockUpdateOrderItem»
  roo_code/roo-context/api/orders.md:429 → mocks/orders.ts:2251-2253 — нет токена в диапазоне: в 2251-2253 нет ни одного из: «weightPerUnitKg»
  roo_code/roo-context/api/orders.md:441 → mocks/orders.ts:2349-2349 — нет токена в диапазоне: в 2349-2349 нет ни одного из: «mockDeleteOrderItem»
  roo_code/roo-context/api/orders.md:452 → mocks/orders.ts:2367-2367 — нет токена в диапазоне: в 2367-2367 нет ни одного из: «releaseLine»
  roo_code/roo-context/api/orders.md:467 → mocks/orders.ts:2768-2768 — нет токена в диапазоне: в 2768-2768 нет ни одного из: «mockSplitOrderItem»
  roo_code/roo-context/api/orders.md:478 → mocks/orders.ts:2783-2783 — нет токена в диапазоне: в 2783-2783 нет ни одного из: «INVALID_SPLIT_QUANTITY»
  roo_code/roo-context/api/orders.md:496 → mocks/orders.ts:2614-2614 — нет токена в диапазоне: в 2614-2614 нет ни одного из: «mockCorrectOrderLine»
  roo_code/roo-context/api/orders.md:531 → mocks/orders.ts:2548-2548 — нет токена в диапазоне: в 2548-2548 нет ни одного из: «mockAllocateOrderTotal»
  roo_code/roo-context/api/orders.md:549 → orders-backend-contract.md:199-199 — нет токена в диапазоне: в 199-199 нет ни одного из: «allocateGrossTotal»
  roo_code/roo-context/api/orders.md:562 → mocks/orders.ts:2393-2393 — нет токена в диапазоне: в 2393-2393 нет ни одного из: «mockAddOrderService»
  roo_code/roo-context/api/orders.md:577 → types/order.ts:161-191 — нет токена в диапазоне: в 161-191 нет ни одного из: «currencyId», «uomId»
  roo_code/roo-context/api/orders.md:591 → mocks/orders.ts:2285-2285 — нет токена в диапазоне: в 2285-2285 нет ни одного из: «mockUpdateOrderService»
  roo_code/roo-context/api/orders.md:619 → mocks/orders.ts:2439-2439 — нет токена в диапазоне: в 2439-2439 нет ни одного из: «mockDeleteOrderService»
  roo_code/roo-context/api/orders.md:625 → services/ordersService.ts:184-184 — нет токена в диапазоне: в 184-184 нет ни одного из: «serviceId»
  roo_code/roo-context/api/orders.md:648 → mocks/orders.ts:3845-3845 — нет токена в диапазоне: в 3845-3845 нет ни одного из: «mockReserveOrder»
  roo_code/roo-context/api/orders.md:677 → services/ordersService.ts:373-373 — нет токена в диапазоне: в 373-373 нет ни одного из: «getOrderReservations»
  roo_code/roo-context/api/orders.md:703 → mocks/orders.ts:3240-3240 — нет токена в диапазоне: в 3240-3240 нет ни одного из: «mockPlanOrderShipment»
  roo_code/roo-context/api/orders.md:714 → mocks/orders.ts:3242-3242 — нет токена в диапазоне: в 3242-3242 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:736 → mocks/orders.ts:3260-3260 — нет токена в диапазоне: в 3260-3260 нет ни одного из: «mockCreateShipment»
  roo_code/roo-context/api/orders.md:770 → mocks/orders.ts:2814-2814 — нет токена в диапазоне: в 2814-2814 нет ни одного из: «mockGetShipments»
  roo_code/roo-context/api/orders.md:775 → mocks/orders.ts:2817-2817 — нет токена в диапазоне: в 2817-2817 нет ни одного из: «heldReleased»
  roo_code/roo-context/api/orders.md:779 → mocks/orders.ts:2816-2816 — нет токена в диапазоне: в 2816-2816 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:797 → mocks/orders.ts:3372-3372 — нет токена в диапазоне: в 3372-3372 нет ни одного из: «mockCancelShipment»
  roo_code/roo-context/api/orders.md:801 → services/ordersService.ts:305-310 — нет токена в диапазоне: в 305-310 нет ни одного из: «Idempotency-Key»
  roo_code/roo-context/api/orders.md:805 → mocks/orders.ts:3423-3423 — нет токена в диапазоне: в 3423-3423 нет ни одного из: «ApiResponse<Shipment>»
  roo_code/roo-context/api/orders.md:831 → mocks/orders.ts:3638-3638 — нет токена в диапазоне: в 3638-3638 нет ни одного из: «mockPlanReturn»
  roo_code/roo-context/api/orders.md:841 → mocks/orders.ts:3640-3640 — нет токена в диапазоне: в 3640-3640 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:854 → mocks/orders.ts:3660-3660 — нет токена в диапазоне: в 3660-3660 нет ни одного из: «mockCreateReturn»
  roo_code/roo-context/api/orders.md:891 → mocks/orders.ts:3629-3629 — нет токена в диапазоне: в 3629-3629 нет ни одного из: «mockGetReturns»
  roo_code/roo-context/api/orders.md:896 → mocks/orders.ts:3632-3632 — нет токена в диапазоне: в 3632-3632 нет ни одного из: «condition», «compensated»
  roo_code/roo-context/api/orders.md:900 → mocks/orders.ts:3631-3631 — нет токена в диапазоне: в 3631-3631 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:918 → mocks/orders.ts:4257-4257 — нет токена в диапазоне: в 4257-4257 нет ни одного из: «mockCreateInvoice»
  roo_code/roo-context/api/orders.md:960 → mocks/orders.ts:4026-4026 — нет токена в диапазоне: в 4026-4026 нет ни одного из: «mockGetInvoices»
  roo_code/roo-context/api/orders.md:965 → mocks/orders.ts:4029-4029 — нет токена в диапазоне: в 4029-4029 нет ни одного из: «Order.invoices»
  roo_code/roo-context/api/orders.md:969 → mocks/orders.ts:4028-4028 — нет токена в диапазоне: в 4028-4028 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:983 → mocks/orders.ts:3949-3949 — нет токена в диапазоне: в 3949-3949 нет ни одного из: «mockAddOrderPayment»
  roo_code/roo-context/api/orders.md:997 → mocks/orders.ts:3982-3982 — нет токена в диапазоне: в 3982-3982 нет ни одного из: «invoiceId»
  roo_code/roo-context/api/orders.md:1013 → mocks/orders.ts:3942-3942 — нет токена в диапазоне: в 3942-3942 нет ни одного из: «mockGetOrderPayments»
  roo_code/roo-context/api/orders.md:1021 → mocks/orders.ts:3944-3944 — нет токена в диапазоне: в 3944-3944 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/roo-context/api/orders.md:1033 → mocks/orders.ts:4008-4008 — нет токена в диапазоне: в 4008-4008 нет ни одного из: «mockDeleteOrderPayment»
  roo_code/roo-context/api/orders.md:1058 → mocks/orders.ts:2491-2491 — нет токена в диапазоне: в 2491-2491 нет ни одного из: «mockAddOrderFile»
  roo_code/roo-context/api/orders.md:1075 → mocks/orders.ts:2502-2502 — нет токена в диапазоне: в 2502-2502 нет ни одного из: «ord-file-N»
  roo_code/roo-context/api/orders.md:1078 → mocks/orders.ts:2505-2507 — нет токена в диапазоне: в 2505-2507 нет ни одного из: «size», «mime», «url»
  roo_code/roo-context/api/orders.md:1088 → mocks/orders.ts:2515-2515 — нет токена в диапазоне: в 2515-2515 нет ни одного из: «mockRemoveOrderFile»
  roo_code/roo-context/api/orders.md:1113 → services/ordersService.ts:190-190 — нет токена в диапазоне: в 190-190 нет ни одного из: «deleteOrderAuditEntry»
  roo_code/roo-context/api/orders.md:1118 → services/ordersService.ts:190-196 — нет токена в диапазоне: в 190-196 нет ни одного из: «StockAuditEntry»
  roo_code/roo-context/api/orders.md:1147 → mocks/orders.ts:1636-1636 — нет токена в диапазоне: в 1636-1636 нет ни одного из: «'EUR'»
  roo_code/roo-context/api/orders.md:1162 → mocks/orders.ts:1840-1840 — нет токена в диапазоне: в 1840-1840 нет ни одного из: «notifyOrderStatusChanged»
  roo_code/roo-context/api/orders.md:1200 → mocks/orders.ts:1387-1389 — нет токена в диапазоне: в 1387-1389 нет ни одного из: «seeCost»
  roo_code/roo-context/api/orders.md:1238 → mocks/orders.ts:1858-1863 — нет токена в диапазоне: в 1858-1863 нет ни одного из: «requireRight»
  roo_code/roo-context/api/orders.md:1256 → services/ordersService.ts:295-295 — нет токена в диапазоне: в 295-295 нет ни одного из: «Idempotency-Key»
  roo_code/roo-context/api/orders.md:1295 → types/order.ts:132-138 — нет токена в диапазоне: в 132-138 нет ни одного из: «projectItem», «state»
  roo_code/roo-context/api/orders.md:1296 → mocks/orders.ts:3323-3323 — нет токена в диапазоне: в 3323-3323 нет ни одного из: «syncLineState»
roo_code/roo-context/api/products.md: ссылок 411, битых 29, глазами 30, без токена 276
  roo_code/roo-context/api/products.md:80 → services/mocks/products.ts:14225-14225 — нет токена в диапазоне: в 14225-14225 нет ни одного из: «PRODUCT_IN_USE»
  roo_code/roo-context/api/products.md:81 → services/mocks/products.ts:14234-14234 — нет токена в диапазоне: в 14234-14234 нет ни одного из: «AUDIT_ENTRY_NOT_FOUND»
  roo_code/roo-context/api/products.md:103 → composables/useProductCard.ts:260-260 — нет токена в диапазоне: в 260-260 нет ни одного из: «msg.status_error»
  roo_code/roo-context/api/products.md:104 → views/admin/products/ProductCardPage.vue:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «auditLog.toast_error_delete»
  roo_code/roo-context/api/products.md:127 → services/mocks/index.ts:567-567 — нет токена в диапазоне: в 567-567 нет ни одного из: «sortBy»
  roo_code/roo-context/api/products.md:299 → services/mocks/products.ts:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «prod-001»
  roo_code/roo-context/api/products.md:339 → backend/app/modules/products/features/get_product_detail/domain.py:59-68 — нет токена в диапазоне: в 59-68 нет ни одного из: «categoryId», «categoryName»
  roo_code/roo-context/api/products.md:471 → views/admin/products/ProductsPage.vue:197-220 — нет токена в диапазоне: в 197-220 нет ни одного из: «catch»
  roo_code/roo-context/api/products.md:529 → composables/useProductCard.ts:243-255 — нет токена в диапазоне: в 243-255 нет ни одного из: «dirty.isDirty»
  roo_code/roo-context/api/products.md:549 → services/mocks/products.ts:14117-14218 — нет токена в диапазоне: в 14117-14218 нет ни одного из: «products.toast_error»
  roo_code/roo-context/api/products.md:620 → backend/app/modules/suppliers/shared/models.py:224-224 — нет токена в диапазоне: в 224-224 нет ни одного из: «supplier_price_entries.product_id»
  roo_code/roo-context/api/products.md:621 → backend/app/modules/bcc/shared/models.py:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «bcc_events.product_id»
  roo_code/roo-context/api/products.md:630 → backend/app/modules/products/features/archive_product/action.py:22-22 — нет токена в диапазоне: в 22-22 нет ни одного из: «archived_at»
  roo_code/roo-context/api/products.md:651 → services/auditFeedService.ts:57-60 — нет токена в диапазоне: в 57-60 нет ни одного из: «Authorization»
  roo_code/roo-context/api/products.md:654 → services/mocks/index.ts:1503-1503 — нет токена в диапазоне: в 1503-1503 нет ни одного из: «Promise<void>»
  roo_code/roo-context/api/products.md:656 → views/admin/products/ProductCardPage.vue:70-70 — нет токена в диапазоне: в 70-70 нет ни одного из: «withoutRow»
  roo_code/roo-context/api/products.md:663 → composables/useAuditFeed.ts:103-103 — нет токена в диапазоне: в 103-103 нет ни одного из: «auditLog.toast_error_delete», «entryId»
  roo_code/roo-context/api/products.md:667 → services/auditFeedService.ts:49-56 — нет токена в диапазоне: в 49-56 нет ни одного из: «askDeleteAudit»
  roo_code/roo-context/api/products.md:668 → views/admin/products/ProductCardPage.vue:60-63 — нет токена в диапазоне: в 60-63 нет ни одного из: «confirmDeleteAudit»
  roo_code/roo-context/api/products.md:719 → services/mocks/notifications.ts:637-654 — нет токена в диапазоне: в 637-654 нет ни одного из: «notifyStockDeficit»
  roo_code/roo-context/api/products.md:742 → types/warehouse.ts:526-534 — нет токена в диапазоне: в 526-534 нет ни одного из: «sensitive»
  roo_code/roo-context/api/products.md:754 → backend/app/modules/products/shared/models.py:199-199 — нет токена в диапазоне: в 199-199 нет ни одного из: «Text»
  roo_code/roo-context/api/products.md:802 → backend/app/modules/auth/features/me/action.py:36-36 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 36-36
  roo_code/roo-context/api/products.md:811 → views/admin/products/ProductCardPage.vue:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «true»
  roo_code/roo-context/api/products.md:822 → backend/app/core/database.py:22-30 — нет токена в диапазоне: в 22-30 нет ни одного из: «flush»
  roo_code/roo-context/api/products.md:864 → backend/app/modules/products/features/get_product_detail/action.py:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «UUIDMixin»
  roo_code/roo-context/api/products.md:865 → backend/app/modules/products/shared/models.py:87-87 — нет токена в диапазоне: в 87-87 нет ни одного из: «'prod-114'»
  roo_code/roo-context/api/products.md:914 → composables/useProductCard.ts:122-122 — нет токена в диапазоне: в 122-122 нет ни одного из: «addLinkedSupplier»
  roo_code/roo-context/api/products.md:928 → services/mocks/products.ts:14136-14136 — нет токена в диапазоне: в 14136-14136 нет ни одного из: «Pick<>»
roo_code/roo-context/api/services.md: ссылок 219, битых 22, глазами 19, без токена 143
  roo_code/roo-context/api/services.md:128 → types/api.ts:8-14 — нет токена в диапазоне: в 8-14 нет ни одного из: «Service»
  roo_code/roo-context/api/services.md:166 → mocks/services.ts:42-78 — нет токена в диапазоне: в 42-78 нет ни одного из: «error»
  roo_code/roo-context/api/services.md:212 → mocks/services.ts:108-109 — нет токена в диапазоне: в 108-109 нет ни одного из: «TranslatedString»
  roo_code/roo-context/api/services.md:235 → router/index.ts:247-247 — нет токена в диапазоне: в 247-247 нет ни одного из: «products/services/:id»
  roo_code/roo-context/api/services.md:238 → types/service.ts:28-28 — нет токена в диапазоне: в 28-28 нет ни одного из: «null»
  roo_code/roo-context/api/services.md:239 → mocks/services.ts:115-115 — нет токена в диапазоне: в 115-115 нет ни одного из: «undefined»
  roo_code/roo-context/api/services.md:241 → mocks/services.ts:136-136 — нет токена в диапазоне: в 136-136 нет ни одного из: «CATALOG_SERVICE_NOT_FOUND»
  roo_code/roo-context/api/services.md:290 → mocks/services.ts:164-164 — нет токена в диапазоне: в 164-164 нет ни одного из: «updatedAt»
  roo_code/roo-context/api/services.md:292 → mocks/services.ts:153-153 — нет токена в диапазоне: в 153-153 нет ни одного из: «CATALOG_SERVICE_NOT_FOUND», «SERVICE_CURRENCY_NOT_FOUND»
  roo_code/roo-context/api/services.md:297 → frontend_vue/src/domain/servicePricing.spec.ts:102-107 — нет токена в диапазоне: в 102-107 нет ни одного из: «CATALOG_SERVICE_NOT_FOUND»
  roo_code/roo-context/api/services.md:301 → mocks/services.ts:155-163 — нет токена в диапазоне: в 155-163 нет ни одного из: «If-Match», «version»
  roo_code/roo-context/api/services.md:320 → mocks/index.ts:558-558 — нет токена в диапазоне: в 558-558 нет ни одного из: «/^\/api\/services\/([^/]+)$/»
  roo_code/roo-context/api/services.md:327 → mocks/services.ts:170-170 — нет токена в диапазоне: в 170-170 нет ни одного из: «mockDeleteService», «false», «throw»
  roo_code/roo-context/api/services.md:338 → frontend_vue/src/services/mocks/orders.ts:2418-2425 — нет токена в диапазоне: в 2418-2425 нет ни одного из: «serviceId»
  roo_code/roo-context/api/services.md:377 → mocks/services.ts:90-90 — нет токена в диапазоне: в 90-90 нет ни одного из: «SERVICE_CURRENCY_NOT_FOUND», «currencyId», «settings»
  roo_code/roo-context/api/services.md:378 → mocks/services.ts:93-93 — нет токена в диапазоне: в 93-93 нет ни одного из: «SERVICE_UOM_NOT_FOUND», «uomId», «settings»
  roo_code/roo-context/api/services.md:409 → mocks/services.ts:80-87 — нет токена в диапазоне: в 80-87 нет ни одного из: «'EUR/kg'»
  roo_code/roo-context/api/services.md:476 → mocks/orders.ts:1905-1906 — нет токена в диапазоне: в 1905-1906 нет ни одного из: «sensitive», «seeCost»
  roo_code/roo-context/api/services.md:484 → mocks/services.ts:8-8 — нет токена в диапазоне: в 8-8 нет ни одного из: «tenant_id»
  roo_code/roo-context/api/services.md:491 → backend/app/modules/services/shared/models.py:15-20 — нет токена в диапазоне: в 15-20 нет ни одного из: «nullable=False», «index=True»
  roo_code/roo-context/api/services.md:559 → mocks/services.ts:127-128 — нет токена в диапазоне: в 127-128 нет ни одного из: «updatedAt»
  roo_code/roo-context/api/services.md:613 → frontend_vue/src/types/audit.ts:4-14 — нет токена в диапазоне: в 4-14 нет ни одного из: «sensitive»
roo_code/roo-context/api/settings.md: ссылок 592, битых 39, глазами 77, без токена 361
  roo_code/roo-context/api/settings.md:75 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE»
  roo_code/roo-context/api/settings.md:172 → mocks/settings.ts:469-469 — нет токена в диапазоне: в 469-469 нет ни одного из: «mockGetCompany»
  roo_code/roo-context/api/settings.md:218 → mocks/settings.ts:478-478 — нет токена в диапазоне: в 478-478 нет ни одного из: «mockPatchCompany»
  roo_code/roo-context/api/settings.md:281 → mocks/settings.ts:485-485 — нет токена в диапазоне: в 485-485 нет ни одного из: «mockGetConstants»
  roo_code/roo-context/api/settings.md:336 → mocks/settings.ts:505-505 — нет токена в диапазоне: в 505-505 нет ни одного из: «mockPatchConstants»
  roo_code/roo-context/api/settings.md:459 → mocks/settings.ts:512-512 — нет токена в диапазоне: в 512-512 нет ни одного из: «mockGetCurrencies»
  roo_code/roo-context/api/settings.md:492 → mocks/settings.ts:516-516 — нет токена в диапазоне: в 516-516 нет ни одного из: «mockCreateCurrency»
  roo_code/roo-context/api/settings.md:532 → mocks/settings.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «mockUpdateCurrency»
  roo_code/roo-context/api/settings.md:571 → mocks/settings.ts:531-531 — нет токена в диапазоне: в 531-531 нет ни одного из: «mockDeleteCurrency»
  roo_code/roo-context/api/settings.md:608 → mocks/settings.ts:539-539 — нет токена в диапазоне: в 539-539 нет ни одного из: «mockGetUoms»
  roo_code/roo-context/api/settings.md:646 → mocks/settings.ts:558-558 — нет токена в диапазоне: в 558-558 нет ни одного из: «mockCreateUom»
  roo_code/roo-context/api/settings.md:720 → mocks/settings.ts:573-573 — нет токена в диапазоне: в 573-573 нет ни одного из: «mockDeleteUom»
  roo_code/roo-context/api/settings.md:766 → mocks/settings.ts:602-602 — нет токена в диапазоне: в 602-602 нет ни одного из: «mockGetConversions»
  roo_code/roo-context/api/settings.md:808 → mocks/settings.ts:606-606 — нет токена в диапазоне: в 606-606 нет ни одного из: «mockCreateConversion»
  roo_code/roo-context/api/settings.md:847 → mocks/settings.ts:635-635 — нет токена в диапазоне: в 635-635 нет ни одного из: «mockUpdateConversion»
  roo_code/roo-context/api/settings.md:869 → mocks/settings.ts:641-641 — нет токена в диапазоне: в 641-641 нет ни одного из: «mockDeleteConversion»
  roo_code/roo-context/api/settings.md:915 → mocks/settings.ts:649-649 — нет токена в диапазоне: в 649-649 нет ни одного из: «mockGetOrderStatuses»
  roo_code/roo-context/api/settings.md:954 → mocks/settings.ts:653-653 — нет токена в диапазоне: в 653-653 нет ни одного из: «mockCreateOrderStatus»
  roo_code/roo-context/api/settings.md:995 → mocks/settings.ts:663-663 — нет токена в диапазоне: в 663-663 нет ни одного из: «mockUpdateOrderStatus»
  roo_code/roo-context/api/settings.md:1031 → crud/repository.py:318-328 — нет токена в диапазоне: в 318-328 нет ни одного из: «commit»
  roo_code/roo-context/api/settings.md:1040 → mocks/settings.ts:669-669 — нет токена в диапазоне: в 669-669 нет ни одного из: «mockMoveOrderStatus»
  roo_code/roo-context/api/settings.md:1068 → mocks/settings.ts:687-687 — нет токена в диапазоне: в 687-687 нет ни одного из: «mockDeleteOrderStatus»
  roo_code/roo-context/api/settings.md:1112 → mocks/settings.ts:749-749 — нет токена в диапазоне: в 749-749 нет ни одного из: «mockGetProfile»
  roo_code/roo-context/api/settings.md:1145 → mocks/settings.ts:758-758 — нет токена в диапазоне: в 758-758 нет ни одного из: «mockPatchProfile»
  roo_code/roo-context/api/settings.md:1231 → settings/features/mail/action.py:38-38 — нет токена в диапазоне: в 38-38 нет ни одного из: «get_mail_settings»
  roo_code/roo-context/api/settings.md:1236 → mocks/settings.ts:708-708 — нет токена в диапазоне: в 708-708 нет ни одного из: «mockGetMail»
  roo_code/roo-context/api/settings.md:1266 → settings/features/mail/action.py:56-56 — нет токена в диапазоне: в 56-56 нет ни одного из: «patch_mail_settings»
  roo_code/roo-context/api/settings.md:1269 → core/crypto.py:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «password»
  roo_code/roo-context/api/settings.md:1272 → mocks/settings.ts:717-717 — нет токена в диапазоне: в 717-717 нет ни одного из: «mockPatchMail»
  roo_code/roo-context/api/settings.md:1304 → settings/features/mail/action.py:75-75 — нет токена в диапазоне: в 75-75 нет ни одного из: «send_mail_test»
  roo_code/roo-context/api/settings.md:1312 → mocks/settings.ts:740-740 — нет токена в диапазоне: в 740-740 нет ни одного из: «mockSendMailTest»
  roo_code/roo-context/api/settings.md:1367 → mocks/settings.ts:769-769 — нет токена в диапазоне: в 769-769 нет ни одного из: «mockGetWarehouseMap»
  roo_code/roo-context/api/settings.md:1382 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE»
  roo_code/roo-context/api/settings.md:1405 → mocks/settings.ts:773-773 — нет токена в диапазоне: в 773-773 нет ни одного из: «mockSaveWarehouseMap»
  roo_code/roo-context/api/settings.md:1429 → mocks/settings.ts:783-783 — нет токена в диапазоне: в 783-783 нет ни одного из: «mockDeleteWarehouseMap»
  roo_code/roo-context/api/settings.md:1479 → mocks/settings.ts:496-496 — нет токена в диапазоне: в 496-496 нет ни одного из: «mockGetOrderPermissions»
  roo_code/roo-context/api/settings.md:1580 → models.py:51-51 — нет токена в диапазоне: в 51-51 нет ни одного из: «logo_file_id»
  roo_code/roo-context/api/settings.md:1673 → crud/repository.py:318-328 — нет токена в диапазоне: в 318-328 нет ни одного из: «UPDATE», «commit»
  roo_code/roo-context/api/settings.md:1678 → mocks/settings.ts:777-777 — нет токена в диапазоне: в 777-777 нет ни одного из: «MAP_NOT_AN_IMAGE», «ApiRequestError», «code»
roo_code/roo-context/api/suppliers.md: ссылок 270, битых 31, глазами 14, без токена 199
  roo_code/roo-context/api/suppliers.md:58 → frontend_vue/src/components/admin/SupplierFormSections.vue:45-52 — нет токена в диапазоне: в 45-52 нет ни одного из: «String(50)»
  roo_code/roo-context/api/suppliers.md:59 → backend/app/modules/suppliers/shared/models.py:29-31 — нет токена в диапазоне: в 29-31 нет ни одного из: «enum», «CHECK»
  roo_code/roo-context/api/suppliers.md:93 → frontend_vue/src/services/mocks/suppliers.ts:305-305 — нет токена в диапазоне: в 305-305 нет ни одного из: «GET», «PATCH»
  roo_code/roo-context/api/suppliers.md:104 → frontend_vue/src/components/admin/SupplierFormSections.vue:58-63 — нет токена в диапазоне: в 58-63 нет ни одного из: «PAYMENT_OPTIONS»
  roo_code/roo-context/api/suppliers.md:136 → services/mocks/config.ts:63-63 — нет токена в диапазоне: в 63-63 нет ни одного из: «f-country»
  roo_code/roo-context/api/suppliers.md:157 → frontend_vue/src/services/mocks/suppliers.ts:458-458 — нет токена в диапазоне: в 458-458 нет ни одного из: «SUPPLIER_NOT_FOUND»
  roo_code/roo-context/api/suppliers.md:158 → frontend_vue/src/services/mocks/suppliers.ts:466-466 — нет токена в диапазоне: в 466-466 нет ни одного из: «AUDIT_ENTRY_NOT_FOUND», «entryId»
  roo_code/roo-context/api/suppliers.md:210 → frontend_vue/src/services/mocks/suppliers.ts:262-266 — нет токена в диапазоне: в 262-266 нет ни одного из: «contactPerson»
  roo_code/roo-context/api/suppliers.md:247 → mocks/suppliers.ts:279-279 — нет токена в диапазоне: в 279-279 нет ни одного из: «mockGetSuppliers»
  roo_code/roo-context/api/suppliers.md:284 → frontend_vue/src/services/mocks/index.ts:327-330 — нет токена в диапазоне: в 327-330 нет ни одного из: «'1'», «'sup-001'»
  roo_code/roo-context/api/suppliers.md:298 → backend/app/modules/suppliers/features/supplier_reference/action.py:25-25 — нет токена в диапазоне: в 25-25 нет ни одного из: «list_suppliers_reference», «TranslatedString»
  roo_code/roo-context/api/suppliers.md:316 → frontend_vue/src/services/mocks/suppliers.ts:527-527 — нет токена в диапазоне: в 527-527 нет ни одного из: «company»
  roo_code/roo-context/api/suppliers.md:349 → mocks/suppliers.ts:525-525 — нет токена в диапазоне: в 525-525 нет ни одного из: «mockExportSuppliersCsv»
  roo_code/roo-context/api/suppliers.md:391 → frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:531-531 — нет токена в диапазоне: в 531-531 нет ни одного из: «?supplier=<id>»
  roo_code/roo-context/api/suppliers.md:404 → views/admin/suppliers/SupplierCardPage.vue:275-275 — нет токена в диапазоне: в 275-275 нет ни одного из: «SupplierHistoryItem»
  roo_code/roo-context/api/suppliers.md:446 → frontend_vue/src/services/mocks/index.ts:440-440 — нет токена в диапазоне: в 440-440 нет ни одного из: «[^/]»
  roo_code/roo-context/api/suppliers.md:485 → backend/app/core/exceptions.py:23-27 — нет токена в диапазоне: в 23-27 нет ни одного из: «company»
  roo_code/roo-context/api/suppliers.md:489 → frontend_vue/src/services/mocks/suppliers.ts:471-471 — нет токена в диапазоне: в 471-471 нет ни одного из: «sup-NNN»
  roo_code/roo-context/api/suppliers.md:498 → backend/app/modules/suppliers/shared/models.py:49-51 — нет токена в диапазоне: в 49-51 нет ни одного из: «payment_terms»
  roo_code/roo-context/api/suppliers.md:520 → mocks/suppliers.ts:470-470 — нет токена в диапазоне: в 470-470 нет ни одного из: «mockCreateSupplier»
  roo_code/roo-context/api/suppliers.md:607 → mocks/suppliers.ts:411-411 — нет токена в диапазоне: в 411-411 нет ни одного из: «^/api/suppliers/([^/]+)$», «mockPatchSupplier»
  roo_code/roo-context/api/suppliers.md:630 → frontend_vue/src/services/suppliersService.ts:54-56 — нет токена в диапазоне: в 54-56 нет ни одного из: «undefined»
  roo_code/roo-context/api/suppliers.md:660 → mocks/suppliers.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «^/api/suppliers/([^/]+)/status$»
  roo_code/roo-context/api/suppliers.md:672 → frontend_vue/src/services/suppliersService.ts:82-84 — нет токена в диапазоне: в 82-84 нет ни одного из: «deleteMockRoute»
  roo_code/roo-context/api/suppliers.md:694 → frontend_vue/src/services/mocks/suppliers.ts:246-246 — нет токена в диапазоне: в 246-246 нет ни одного из: «entryId»
  roo_code/roo-context/api/suppliers.md:707 → mocks/suppliers.ts:456-456 — нет токена в диапазоне: в 456-456 нет ни одного из: «^/api/suppliers/([^/]+)/audit/([^/]+)$»
  roo_code/roo-context/api/suppliers.md:719 → backend/app/modules/suppliers/shared/models.py:29-31 — нет токена в диапазоне: в 29-31 нет ни одного из: «lead_time=0», «currency='EUR'»
  roo_code/roo-context/api/suppliers.md:722 → backend/app/modules/suppliers/shared/models.py:49-51 — нет токена в диапазоне: в 49-51 нет ни одного из: «payment_terms»
  roo_code/roo-context/api/suppliers.md:755 → frontend_vue/src/types/warehouse.ts:526-534 — нет токена в диапазоне: в 526-534 нет ни одного из: «sensitive»
  roo_code/roo-context/api/suppliers.md:820 → frontend_vue/src/services/mocks/config.ts:13-108 — нет токена в диапазоне: в 13-108 нет ни одного из: «PermissionMatrix»
  roo_code/roo-context/api/suppliers.md:838 → frontend_vue/src/composables/useSupplierCreate.ts:68-68 — нет токена в диапазоне: в 68-68 нет ни одного из: «Idempotency-Key»
roo_code/roo-context/api/uploads.md: ссылок 194, битых 3, глазами 13, без токена 129
  roo_code/roo-context/api/uploads.md:236 → core/uploads/action.py:85-93 — нет токена в диапазоне: в 85-93 нет ни одного из: «store_file», «db.commit()»
  roo_code/roo-context/api/uploads.md:253 → types/category.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «CategoryFieldType»
  roo_code/roo-context/api/uploads.md:300 → backend/app/main.py:74-74 — нет токена в диапазоне: в 74-74 нет ни одного из: «lifespan»
roo_code/roo-context/api/warehouse.md: ссылок 594, битых 67, глазами 16, без токена 399
  roo_code/roo-context/api/warehouse.md:180 → frontend_vue/src/types/warehouse.ts:680-680 — нет токена в диапазоне: в 680-680 нет ни одного из: «paginateStock»
  roo_code/roo-context/api/warehouse.md:189 → frontend_vue/src/services/mocks/warehouse.ts:517-522 — нет токена в диапазоне: в 517-522 нет ни одного из: «name»
  roo_code/roo-context/api/warehouse.md:206 → mocks/index.ts:617-617 — нет токена в диапазоне: в 617-617 нет ни одного из: «services/warehouseService.ts:getStockOverview»
  roo_code/roo-context/api/warehouse.md:231 → mocks/index.ts:644-644 — нет токена в диапазоне: в 644-644 нет ни одного из: «services/warehouseService.ts:getStockItem»
  roo_code/roo-context/api/warehouse.md:243 → frontend_vue/src/types/warehouse.ts:600-611 — нет токена в диапазоне: в 600-611 нет ни одного из: «useDirtyCheck.diff()»
  roo_code/roo-context/api/warehouse.md:274 → mocks/index.ts:1323-1323 — нет токена в диапазоне: в 1323-1323 нет ни одного из: «services/warehouseService.ts:patchStockItem»
  roo_code/roo-context/api/warehouse.md:324 → mocks/index.ts:637-637 — нет токена в диапазоне: в 637-637 нет ни одного из: «services/warehouseService.ts:getBatchCostBreakdown»
  roo_code/roo-context/api/warehouse.md:335 → frontend_vue/src/services/warehouseService.ts:328-328 — нет токена в диапазоне: в 328-328 нет ни одного из: «structuredClone»
  roo_code/roo-context/api/warehouse.md:362 → mocks/index.ts:653-653 — нет токена в диапазоне: в 653-653 нет ни одного из: «services/warehouseService.ts:getStockAudit»
  roo_code/roo-context/api/warehouse.md:369 → frontend_vue/src/services/auditFeedService.ts:67-68 — нет токена в диапазоне: в 67-68 нет ни одного из: «entityType»
  roo_code/roo-context/api/warehouse.md:378 → frontend_vue/src/services/mocks/warehouse.ts:1866-1866 — нет токена в диапазоне: в 1866-1866 нет ни одного из: «STOCK_NOT_FOUND»
  roo_code/roo-context/api/warehouse.md:388 → mocks/index.ts:1437-1437 — нет токена в диапазоне: в 1437-1437 нет ни одного из: «services/warehouseService.ts:deleteStockAuditEntry»
  roo_code/roo-context/api/warehouse.md:406 → frontend_vue/src/services/mocks/index.ts:664-672 — нет токена в диапазоне: в 664-672 нет ни одного из: «receivedAt», «desc»
  roo_code/roo-context/api/warehouse.md:410 → frontend_vue/src/types/warehouse.ts:676-676 — нет токена в диапазоне: в 676-676 нет ни одного из: «toBatchListItem»
  roo_code/roo-context/api/warehouse.md:423 → frontend_vue/src/services/mocks/warehouse.ts:565-613 — нет токена в диапазоне: в 565-613 нет ни одного из: «throw»
  roo_code/roo-context/api/warehouse.md:451 → mocks/index.ts:658-658 — нет токена в диапазоне: в 658-658 нет ни одного из: «services/warehouseService.ts:getBatches»
  roo_code/roo-context/api/warehouse.md:505 → mocks/index.ts:1103-1103 — нет токена в диапазоне: в 1103-1103 нет ни одного из: «services/warehouseService.ts:createBatch»
  roo_code/roo-context/api/warehouse.md:535 → frontend_vue/src/services/mocks/index.ts:682-684 — нет токена в диапазоне: в 682-684 нет ни одного из: «path.endsWith('/audit')», «[^/]»
  roo_code/roo-context/api/warehouse.md:548 → mocks/index.ts:679-679 — нет токена в диапазоне: в 679-679 нет ни одного из: «services/warehouseService.ts:getBatch»
  roo_code/roo-context/api/warehouse.md:594 → mocks/index.ts:1303-1303 — нет токена в диапазоне: в 1303-1303 нет ни одного из: «services/warehouseService.ts:patchBatch»
  roo_code/roo-context/api/warehouse.md:603 → frontend_vue/src/services/warehouseService.ts:114-116 — нет токена в диапазоне: в 114-116 нет ни одного из: «If-Match»
  roo_code/roo-context/api/warehouse.md:627 → mocks/index.ts:1609-1609 — нет токена в диапазоне: в 1609-1609 нет ни одного из: «services/warehouseService.ts:deleteBatch»
  roo_code/roo-context/api/warehouse.md:656 → frontend_vue/src/services/mocks/warehouse.ts:1425-1425 — нет токена в диапазоне: в 1425-1425 нет ни одного из: «movesOffcut»
  roo_code/roo-context/api/warehouse.md:673 → mocks/index.ts:693-693 — нет токена в диапазоне: в 693-693 нет ни одного из: «services/warehouseService.ts:getBatchAggregates»
  roo_code/roo-context/api/warehouse.md:686 → frontend_vue/src/services/mocks/warehouse.ts:1473-1473 — нет токена в диапазоне: в 1473-1473 нет ни одного из: «sale-${batchId}-${idx}»
  roo_code/roo-context/api/warehouse.md:703 → mocks/index.ts:698-698 — нет токена в диапазоне: в 698-698 нет ни одного из: «services/warehouseService.ts:getBatchActiveSales»
  roo_code/roo-context/api/warehouse.md:731 → mocks/index.ts:688-688 — нет токена в диапазоне: в 688-688 нет ни одного из: «services/warehouseService.ts:getBatchAudit»
  roo_code/roo-context/api/warehouse.md:745 → frontend_vue/src/services/mocks/warehouse.ts:1883-1883 — нет токена в диапазоне: в 1883-1883 нет ни одного из: «BATCH_NOT_FOUND»
  roo_code/roo-context/api/warehouse.md:799 → mocks/index.ts:703-703 — нет токена в диапазоне: в 703-703 нет ни одного из: «services/warehouseService.ts:getOffcuts»
  roo_code/roo-context/api/warehouse.md:839 → mocks/index.ts:1107-1107 — нет токена в диапазоне: в 1107-1107 нет ни одного из: «services/warehouseService.ts:createOffcut»
  roo_code/roo-context/api/warehouse.md:854 → frontend_vue/src/types/warehouse.ts:284-305 — нет токена в диапазоне: в 284-305 нет ни одного из: «OffcutListItem»
  roo_code/roo-context/api/warehouse.md:883 → mocks/index.ts:726-726 — нет токена в диапазоне: в 726-726 нет ни одного из: «services/warehouseService.ts:getOffcutOffers»
  roo_code/roo-context/api/warehouse.md:922 → mocks/index.ts:730-730 — нет токена в диапазоне: в 730-730 нет ни одного из: «services/warehouseService.ts:getOffcut»
  roo_code/roo-context/api/warehouse.md:937 → frontend_vue/src/services/mocks/warehouse.ts:1108-1108 — нет токена в диапазоне: в 1108-1108 нет ни одного из: «WarehouseOffcut»
  roo_code/roo-context/api/warehouse.md:959 → mocks/index.ts:1330-1330 — нет токена в диапазоне: в 1330-1330 нет ни одного из: «services/warehouseService.ts:patchOffcut»
  roo_code/roo-context/api/warehouse.md:992 → mocks/index.ts:1615-1615 — нет токена в диапазоне: в 1615-1615 нет ни одного из: «services/warehouseService.ts:deleteOffcut»
  roo_code/roo-context/api/warehouse.md:1015 → mocks/index.ts:739-739 — нет токена в диапазоне: в 739-739 нет ни одного из: «services/warehouseService.ts:getOffcutAudit»
  roo_code/roo-context/api/warehouse.md:1028 → frontend_vue/src/services/mocks/warehouse.ts:1896-1896 — нет токена в диапазоне: в 1896-1896 нет ни одного из: «OFFCUT_NOT_FOUND»
  roo_code/roo-context/api/warehouse.md:1037 → mocks/index.ts:1449-1449 — нет токена в диапазоне: в 1449-1449 нет ни одного из: «services/warehouseService.ts:deleteOffcutAuditEntry»
  roo_code/roo-context/api/warehouse.md:1045 → frontend_vue/src/services/mocks/warehouse.ts:1264-1273 — нет токена в диапазоне: в 1264-1273 нет ни одного из: «writeMovement»
  roo_code/roo-context/api/warehouse.md:1063 → frontend_vue/src/types/warehouse.ts:678-678 — нет токена в диапазоне: в 678-678 нет ни одного из: «toMovementListItem»
  roo_code/roo-context/api/warehouse.md:1064 → frontend_vue/src/services/mocks/warehouse.ts:1120-1137 — нет токена в диапазоне: в 1120-1137 нет ни одного из: «totalCost»
  roo_code/roo-context/api/warehouse.md:1085 → mocks/index.ts:755-755 — нет токена в диапазоне: в 755-755 нет ни одного из: «services/warehouseService.ts:getMovements»
  roo_code/roo-context/api/warehouse.md:1092 → views/admin/warehouse/CreateMovementModal.vue:532-532 — нет токена в диапазоне: в 532-532 нет ни одного из: «transfer»
  roo_code/roo-context/api/warehouse.md:1153 → mocks/index.ts:1111-1111 — нет токена в диапазоне: в 1111-1111 нет ни одного из: «services/warehouseService.ts:createMovement»
  roo_code/roo-context/api/warehouse.md:1188 → mocks/index.ts:750-750 — нет токена в диапазоне: в 750-750 нет ни одного из: «services/warehouseService.ts:getMovement»
  roo_code/roo-context/api/warehouse.md:1221 → mocks/index.ts:745-745 — нет токена в диапазоне: в 745-745 нет ни одного из: «services/warehouseService.ts:getMovementAudit»
  roo_code/roo-context/api/warehouse.md:1247 → mocks/index.ts:1458-1458 — нет токена в диапазоне: в 1458-1458 нет ни одного из: «services/warehouseService.ts:deleteMovementAuditEntry»
  roo_code/roo-context/api/warehouse.md:1273 → frontend_vue/src/services/mocks/warehouse.ts:1497-1500 — нет токена в диапазоне: в 1497-1500 нет ни одного из: «1e-6»
  roo_code/roo-context/api/warehouse.md:1279 → useWarehouseCutting.ts:306-306 — нет токена в диапазоне: в 306-306 нет ни одного из: «OffcutCreatePayload»
  roo_code/roo-context/api/warehouse.md:1322 → mocks/index.ts:1115-1115 — нет токена в диапазоне: в 1115-1115 нет ни одного из: «services/warehouseService.ts:executeCutting»
  roo_code/roo-context/api/warehouse.md:1343 → frontend_vue/src/services/mocks/index.ts:520-520 — нет токена в диапазоне: в 520-520 нет ни одного из: «categoryIds»
  roo_code/roo-context/api/warehouse.md:1374 → mocks/index.ts:779-779 — нет токена в диапазоне: в 779-779 нет ни одного из: «services/warehouseService.ts:getDeficitList»
  roo_code/roo-context/api/warehouse.md:1406 → mocks/index.ts:1119-1119 — нет токена в диапазоне: в 1119-1119 нет ни одного из: «services/warehouseService.ts:createDeficitItem»
  roo_code/roo-context/api/warehouse.md:1420 → frontend_vue/src/services/mocks/warehouse.ts:1656-1656 — нет токена в диапазоне: в 1656-1656 нет ни одного из: «DEFICIT_NOT_FOUND»
  roo_code/roo-context/api/warehouse.md:1429 → mocks/index.ts:798-798 — нет токена в диапазоне: в 798-798 нет ни одного из: «services/warehouseService.ts:getDeficitItem»
  roo_code/roo-context/api/warehouse.md:1464 → mocks/index.ts:1313-1313 — нет токена в диапазоне: в 1313-1313 нет ни одного из: «services/warehouseService.ts:patchDeficitItem»
  roo_code/roo-context/api/warehouse.md:1476 → frontend_vue/src/services/mocks/warehouse.ts:1772-1772 — нет токена в диапазоне: в 1772-1772 нет ни одного из: «DEFICIT_NOT_FOUND»
  roo_code/roo-context/api/warehouse.md:1491 → mocks/index.ts:1627-1627 — нет токена в диапазоне: в 1627-1627 нет ни одного из: «services/warehouseService.ts:deleteDeficitItem»
  roo_code/roo-context/api/warehouse.md:1509 → mocks/index.ts:807-807 — нет токена в диапазоне: в 807-807 нет ни одного из: «services/warehouseService.ts:getDeficitAudit»
  roo_code/roo-context/api/warehouse.md:1516 → frontend_vue/src/services/auditFeedService.ts:76-76 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 76-76
  roo_code/roo-context/api/warehouse.md:1523 → frontend_vue/src/services/mocks/warehouse.ts:1926-1926 — нет токена в диапазоне: в 1926-1926 нет ни одного из: «DEFICIT_NOT_FOUND»
  roo_code/roo-context/api/warehouse.md:1530 → mocks/index.ts:1469-1469 — нет токена в диапазоне: в 1469-1469 нет ни одного из: «services/warehouseService.ts:deleteDeficitAuditEntry»
  roo_code/roo-context/api/warehouse.md:1580 → mocks/index.ts:813-813 — нет токена в диапазоне: в 813-813 нет ни одного из: «services/warehouseService.ts:exportWarehouseData»
  roo_code/roo-context/api/warehouse.md:1645 → frontend_vue/src/services/mocks/warehouse.ts:789-789 — нет токена в диапазоне: в 789-789 нет ни одного из: «notifyStockDeficit»
  roo_code/roo-context/api/warehouse.md:1659 → frontend_vue/src/types/warehouse.ts:625-634 — нет токена в диапазоне: в 625-634 нет ни одного из: «Batch.expiresAt»
  roo_code/roo-context/api/warehouse.md:1986 → 03-api-contract.md:1404-1404 — нет токена в диапазоне: в 1404-1404 нет ни одного из: «If-Match», «WarehouseBatch»
roo_code/plans/api/audit/00-решения-владельца.md: ссылок 1095, битых 29, глазами 182, без токена 708
  roo_code/plans/api/audit/00-решения-владельца.md:119 → backend/app/core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/api/audit/00-решения-владельца.md:340 → crud/domain.py:491-491 — нет токена в диапазоне: в 491-491 нет ни одного из: «is_system=False», «system»
  roo_code/plans/api/audit/00-решения-владельца.md:380 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/00-решения-владельца.md:399 → backend/app/core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/api/audit/00-решения-владельца.md:1464 → frontend_vue/src/config/featureFlags.ts:126-126 — вне границ: в frontend_vue/src/config/featureFlags.ts 101 строк, ссылка на 126-126
  roo_code/plans/api/audit/00-решения-владельца.md:1505 → frontend_vue/src/services/api.ts:259-264 — нет токена в диапазоне: в 259-264 нет ни одного из: «Idempotency-Key»
  roo_code/plans/api/audit/00-решения-владельца.md:1534 → frontend_vue/src/types/audit.ts:5-14 — нет токена в диапазоне: в 5-14 нет ни одного из: «config»
  roo_code/plans/api/audit/00-решения-владельца.md:1537 → backend/app/modules/products/shared/models.py:177-177 — нет токена в диапазоне: в 177-177 нет ни одного из: «product_field_values»
  roo_code/plans/api/audit/00-решения-владельца.md:1543 → backend/app/modules/auth/shared/models.py:236-240 — нет токена в диапазоне: в 236-240 нет ни одного из: «UserPermission.user_id», «uuid», «users»
  roo_code/plans/api/audit/00-решения-владельца.md:1648 → backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:139-139 — вне границ: в backend/alembic/versions/25245d4bf874_phase_3_categories_products.py 91 строк, ссылка на 139-139
  roo_code/plans/api/audit/00-решения-владельца.md:1667 → frontend_vue/src/services/mocks/orders.ts:2418-2425 — нет токена в диапазоне: в 2418-2425 нет ни одного из: «notifications»
  roo_code/plans/api/audit/00-решения-владельца.md:1759 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/api/audit/00-решения-владельца.md:1761 → backend/app/core/config.py:108-108 — вне границ: в backend/app/core/config.py 47 строк, ссылка на 108-108
  roo_code/plans/api/audit/00-решения-владельца.md:1761 → backend/app/core/config.py:118-118 — вне границ: в backend/app/core/config.py 47 строк, ссылка на 118-118
  roo_code/plans/api/audit/00-решения-владельца.md:1763 → backend/app/core/uploads/action.py:79-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 79-146
  roo_code/plans/api/audit/00-решения-владельца.md:1765 → backend/app/core/uploads/action.py:123-123 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 123-123
  roo_code/plans/api/audit/00-решения-владельца.md:1765 → backend/app/core/uploads/action.py:138-138 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 138-138
  roo_code/plans/api/audit/00-решения-владельца.md:1765 → backend/app/core/uploads/action.py:126-126 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 126-126
  roo_code/plans/api/audit/00-решения-владельца.md:1767 → backend/app/core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/api/audit/00-решения-владельца.md:1769 → backend/app/core/uploads/action.py:126-126 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 126-126
  roo_code/plans/api/audit/00-решения-владельца.md:1769 → backend/app/core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/api/audit/00-решения-владельца.md:1773 → backend/app/core/uploads/action.py:135-135 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 135-135
  roo_code/plans/api/audit/00-решения-владельца.md:1779 → backend/app/core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/plans/api/audit/00-решения-владельца.md:1795 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/00-решения-владельца.md:1801 → crud/action.py:146-482 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 146-482
  roo_code/plans/api/audit/00-решения-владельца.md:1803 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/00-решения-владельца.md:1853 → roo_code/roo-context/03-api-contract.md:563-563 — нет токена в диапазоне: в 563-563 нет ни одного из: «DELETE», «delete»
  roo_code/plans/api/audit/00-решения-владельца.md:1894 → orderPricing.ts:158-158 — нет токена в диапазоне: в 158-158 нет ни одного из: «seeCost», «read», «manualCost», «correction», «edit»
  roo_code/plans/api/audit/00-решения-владельца.md:1927 → frontend_vue/src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
roo_code/plans/api/audit/analytics.md: ссылок 164, битых 10, глазами 6, без токена 119
  roo_code/plans/api/audit/analytics.md:44 → mocks/index.ts:402-402 — нет токена в диапазоне: в 402-402 нет ни одного из: «/^\/api\/analytics\/(.+)$/»
  roo_code/plans/api/audit/analytics.md:85 → SalesPage.vue:77-81 — нет токена в диапазоне: в 77-81 нет ни одного из: «RefusalVolumeItem»
  roo_code/plans/api/audit/analytics.md:184 → mocks/analytics.ts:90-97 — нет токена в диапазоне: в 90-97 нет ни одного из: «notifyStockDeficit»
  roo_code/plans/api/audit/analytics.md:212 → src/services/analyticsService.ts:5-5 — нет токена в диапазоне: в 5-5 нет ни одного из: «options», «options?.headers»
  roo_code/plans/api/audit/analytics.md:226 → frontend_vue/src/router/index.ts:92-92 — нет токена в диапазоне: в 92-92 нет ни одного из: «true»
  roo_code/plans/api/audit/analytics.md:262 → mocks/analytics.ts:252-322 — нет токена в диапазоне: в 252-322 нет ни одного из: «deadstock», «turnover»
  roo_code/plans/api/audit/analytics.md:314 → mocks/analytics.ts:453-459 — нет токена в диапазоне: в 453-459 нет ни одного из: «salesByCategory»
  roo_code/plans/api/audit/analytics.md:329 → DashboardPage.vue:15-24 — нет токена в диапазоне: в 15-24 нет ни одного из: «KpiItem.icon»
  roo_code/plans/api/audit/analytics.md:353 → analyticsService.ts:5-5 — нет токена в диапазоне: в 5-5 нет ни одного из: «Authorization»
  roo_code/plans/api/audit/analytics.md:360 → useAnalytics.ts:18-18 — нет токена в диапазоне: в 18-18 нет ни одного из: «data-test»
roo_code/plans/api/audit/audit-feed.md: ссылок 241, битых 5, глазами 29, без токена 161
  roo_code/plans/api/audit/audit-feed.md:18 → frontend_vue/src/services/api.ts:128-141 — нет токена в диапазоне: в 128-141 нет ни одного из: «ApiResponse<T>»
  roo_code/plans/api/audit/audit-feed.md:58 → src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/plans/api/audit/audit-feed.md:63 → src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/plans/api/audit/audit-feed.md:75 → src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/plans/api/audit/audit-feed.md:91 → src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
roo_code/plans/api/audit/auth.md: ссылок 371, битых 40, глазами 86, без токена 185
  roo_code/plans/api/audit/auth.md:20 → src/services/api.ts:144-224 — нет токена в диапазоне: в 144-224 нет ни одного из: «credentials:»
  roo_code/plans/api/audit/auth.md:47 → backend/app/modules/auth/features/me/action.py:34-34 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 34-34
  roo_code/plans/api/audit/auth.md:49 → me/action.py:31-31 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 31-31
  roo_code/plans/api/audit/auth.md:49 → me/action.py:44-48 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 44-48
  roo_code/plans/api/audit/auth.md:50 → me/domain.py:26-37 — вне границ: в backend/app/modules/auth/features/me/domain.py 27 строк, ссылка на 26-37
  roo_code/plans/api/audit/auth.md:50 → me/action.py:67-67 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 67-67
  roo_code/plans/api/audit/auth.md:51 → me/action.py:44-48 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 44-48
  roo_code/plans/api/audit/auth.md:51 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/auth.md:51 → me/action.py:59-63 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 59-63
  roo_code/plans/api/audit/auth.md:53 → me/schemas.py:343-343 — вне границ: в backend/app/modules/auth/features/me/schemas.py 26 строк, ссылка на 343-343
  roo_code/plans/api/audit/auth.md:53 → me/schemas.py:345-345 — вне границ: в backend/app/modules/auth/features/me/schemas.py 26 строк, ссылка на 345-345
  roo_code/plans/api/audit/auth.md:53 → me/action.py:44-72 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 44-72
  roo_code/plans/api/audit/auth.md:54 → me/action.py:34-34 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 34-34
  roo_code/plans/api/audit/auth.md:64 → login/schemas.py:305-305 — вне границ: в backend/app/modules/auth/features/login/schemas.py 44 строк, ссылка на 305-305
  roo_code/plans/api/audit/auth.md:64 → login/schemas.py:310-310 — вне границ: в backend/app/modules/auth/features/login/schemas.py 44 строк, ссылка на 310-310
  roo_code/plans/api/audit/auth.md:64 → useAuth.ts:310-310 — вне границ: в frontend_vue/src/composables/useAuth.ts 237 строк, ссылка на 310-310
  roo_code/plans/api/audit/auth.md:64 → config.py:310-310 — вне границ: в backend/app/core/config.py 47 строк, ссылка на 310-310
  roo_code/plans/api/audit/auth.md:73 → useAuth.ts:238-238 — вне границ: в frontend_vue/src/composables/useAuth.ts 237 строк, ссылка на 238-238
  roo_code/plans/api/audit/auth.md:75 → app/main.py:335-335 — вне границ: в backend/app/main.py 115 строк, ссылка на 335-335
  roo_code/plans/api/audit/auth.md:75 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/auth.md:83 → register/domain.py:157-173 — вне границ: в backend/app/modules/auth/features/register/domain.py 170 строк, ссылка на 157-173
  roo_code/plans/api/audit/auth.md:86 → auth/shared/models.py:327-327 — вне границ: в backend/app/modules/auth/shared/models.py 286 строк, ссылка на 327-327
  roo_code/plans/api/audit/auth.md:86 → auth/shared/models.py:328-328 — вне границ: в backend/app/modules/auth/shared/models.py 286 строк, ссылка на 328-328
  roo_code/plans/api/audit/auth.md:86 → auth/shared/models.py:328-328 — вне границ: в backend/app/modules/auth/shared/models.py 286 строк, ссылка на 328-328
  roo_code/plans/api/audit/auth.md:95 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/auth.md:99 → me/action.py:47-47 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 47-47
  roo_code/plans/api/audit/auth.md:99 → useAuth.ts:906-906 — вне границ: в frontend_vue/src/composables/useAuth.ts 237 строк, ссылка на 906-906
  roo_code/plans/api/audit/auth.md:101 → me/domain.py:33-33 — вне границ: в backend/app/modules/auth/features/me/domain.py 27 строк, ссылка на 33-33
  roo_code/plans/api/audit/auth.md:103 → app/core/config.py:5173-5173 — вне границ: в backend/app/core/config.py 47 строк, ссылка на 5173-5173
  roo_code/plans/api/audit/auth.md:111 → me/action.py:25-28 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 25-28
  roo_code/plans/api/audit/auth.md:117 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/auth.md:119 → app/core/uploads/action.py:50-50 — нет токена в диапазоне: в 50-50 нет ни одного из: «_serializer.loads(token)»
  roo_code/plans/api/audit/auth.md:124 → me/action.py:25-28 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 25-28
  roo_code/plans/api/audit/auth.md:133 → settings/features/crud/action.py:146-482 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 146-482
  roo_code/plans/api/audit/auth.md:137 → settings/features/profile/action.py:127-127 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 127-127
  roo_code/plans/api/audit/auth.md:138 → auth/shared/models.py:53-53 — нет токена в диапазоне: в 53-53 нет ни одного из: «CryptContext»
  roo_code/plans/api/audit/auth.md:151 → src/router/index.ts:1013-1013 — вне границ: в frontend_vue/src/router/index.ts 455 строк, ссылка на 1013-1013
  roo_code/plans/api/audit/auth.md:153 → useAuth.ts:207-207 — нет токена в диапазоне: в 207-207 нет ни одного из: «fetchMe»
  roo_code/plans/api/audit/auth.md:165 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/auth.md:166 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
roo_code/plans/api/audit/bcc.md: ссылок 463, битых 21, глазами 130, без токена 228
  roo_code/plans/api/audit/bcc.md:39 → mocks/bcc.ts:543-543 — вне границ: в frontend_vue/src/services/mocks/bcc.ts 540 строк, ссылка на 543-543
  roo_code/plans/api/audit/bcc.md:39 → mocks/bcc.ts:543-543 — вне границ: в frontend_vue/src/services/mocks/bcc.ts 540 строк, ссылка на 543-543
  roo_code/plans/api/audit/bcc.md:50 → src/types/bcc.ts:563-563 — вне границ: в frontend_vue/src/types/bcc.ts 48 строк, ссылка на 563-563
  roo_code/plans/api/audit/bcc.md:50 → mocks/bcc.ts:563-563 — вне границ: в frontend_vue/src/services/mocks/bcc.ts 540 строк, ссылка на 563-563
  roo_code/plans/api/audit/bcc.md:61 → mocks/bcc.ts:551-551 — вне границ: в frontend_vue/src/services/mocks/bcc.ts 540 строк, ссылка на 551-551
  roo_code/plans/api/audit/bcc.md:94 → src/services/bccService.ts:596-596 — вне границ: в frontend_vue/src/services/bccService.ts 87 строк, ссылка на 596-596
  roo_code/plans/api/audit/bcc.md:94 → bccService.ts:600-600 — вне границ: в frontend_vue/src/services/bccService.ts 87 строк, ссылка на 600-600
  roo_code/plans/api/audit/bcc.md:104 → src/composables/useBccRequest.ts:278-278 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 278-278
  roo_code/plans/api/audit/bcc.md:104 → src/composables/useBccRequest.ts:415-425 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 415-425
  roo_code/plans/api/audit/bcc.md:104 → src/composables/useBccRequest.ts:280-284 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 280-284
  roo_code/plans/api/audit/bcc.md:104 → src/composables/useBccRequest.ts:286-288 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 286-288
  roo_code/plans/api/audit/bcc.md:104 → useBccRequest.ts:292-292 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 292-292
  roo_code/plans/api/audit/bcc.md:104 → useBccRequest.ts:293-293 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 293-293
  roo_code/plans/api/audit/bcc.md:104 → useBccRequest.ts:296-303 — вне границ: в frontend_vue/src/composables/useBccRequest.ts 203 строк, ссылка на 296-303
  roo_code/plans/api/audit/bcc.md:105 → src/services/bccService.ts:585-585 — вне границ: в frontend_vue/src/services/bccService.ts 87 строк, ссылка на 585-585
  roo_code/plans/api/audit/bcc.md:105 → src/services/bccService.ts:581-581 — вне границ: в frontend_vue/src/services/bccService.ts 87 строк, ссылка на 581-581
  roo_code/plans/api/audit/bcc.md:144 → models.py:84-97 — нет токена в диапазоне: в 84-97 нет ни одного из: «subject», «body», «attachment_file_ids», «sender_user_id»
  roo_code/plans/api/audit/bcc.md:165 → src/views/admin/suppliers/BccRequestPage.vue:264-275 — нет токена в диапазоне: в 264-275 нет ни одного из: «requestId»
  roo_code/plans/api/audit/bcc.md:168 → src/services/mocks/bcc.ts:146-146 — нет токена в диапазоне: в 146-146 нет ни одного из: «sup-001», «'1'», «'6'»
  roo_code/plans/api/audit/bcc.md:171 → src/views/admin/suppliers/BccRequestPage.vue:304-306 — нет токена в диапазоне: в 304-306 нет ни одного из: «MAIL_NOT_CONFIGURED»
  roo_code/plans/api/audit/bcc.md:174 → src/services/mocks/bcc.ts:310-335 — нет токена в диапазоне: в 310-335 нет ни одного из: «mockSendBccRequest», «mockLogBccRequest»
roo_code/plans/api/audit/categories.md: ссылок 273, битых 2, глазами 73, без токена 114
  roo_code/plans/api/audit/categories.md:107 → mocks/categories.ts:1510-1510 — нет токена в диапазоне: в 1510-1510 нет ни одного из: «fieldCount», «fieldCount», «fields[]», «inheritedFields[]», «cat-3», «fieldCount=1»
  roo_code/plans/api/audit/categories.md:121 → backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:139-139 — вне границ: в backend/alembic/versions/25245d4bf874_phase_3_categories_products.py 91 строк, ссылка на 139-139
roo_code/plans/api/audit/clients.md: ссылок 336, битых 4, глазами 98, без токена 169
  roo_code/plans/api/audit/clients.md:28 → frontend_vue/src/services/api.ts:128-138 — нет токена в диапазоне: в 128-138 нет ни одного из: «ApiResponse<T>»
  roo_code/plans/api/audit/clients.md:82 → src/services/clientsService.ts:12-13 — нет токена в диапазоне: в 12-13 нет ни одного из: «apiGet(»
  roo_code/plans/api/audit/clients.md:170 → mocks/orders.ts:1626-1631 — нет токена в диапазоне: в 1626-1631 нет ни одного из: «clientName», «clientVatCode», «clientAddress», «clientPaymentTermsDays»
  roo_code/plans/api/audit/clients.md:186 → src/composables/useClients.ts:68-75 — нет токена в диапазоне: в 68-75 нет ни одного из: «code»
roo_code/plans/api/audit/config.md: ссылок 529, битых 14, глазами 121, без токена 292
  roo_code/plans/api/audit/config.md:61 → src/types/config.ts:179-184 — вне границ: в frontend_vue/src/types/config.ts 66 строк, ссылка на 179-184
  roo_code/plans/api/audit/config.md:64 → src/types/config.ts:683-683 — вне границ: в frontend_vue/src/types/config.ts 66 строк, ссылка на 683-683
  roo_code/plans/api/audit/config.md:74 → src/composables/useCardConfig.ts:32-32 — нет токена в диапазоне: в 32-32 нет ни одного из: «Promise.all»
  roo_code/plans/api/audit/config.md:83 → src/types/i18n.ts:294-294 — вне границ: в frontend_vue/src/types/i18n.ts 64 строк, ссылка на 294-294
  roo_code/plans/api/audit/config.md:83 → src/types/i18n.ts:289-289 — вне границ: в frontend_vue/src/types/i18n.ts 64 строк, ссылка на 289-289
  roo_code/plans/api/audit/config.md:86 → backend/app/modules/suppliers/shared/models.py:643-643 — вне границ: в backend/app/modules/suppliers/shared/models.py 380 строк, ссылка на 643-643
  roo_code/plans/api/audit/config.md:97 → mocks/config.ts:674-674 — вне границ: в frontend_vue/src/services/mocks/config.ts 379 строк, ссылка на 674-674
  roo_code/plans/api/audit/config.md:97 → mocks/config.ts:673-673 — вне границ: в frontend_vue/src/services/mocks/config.ts 379 строк, ссылка на 673-673
  roo_code/plans/api/audit/config.md:108 → src/types/config.ts:633-633 — вне границ: в frontend_vue/src/types/config.ts 66 строк, ссылка на 633-633
  roo_code/plans/api/audit/config.md:118 → src/composables/useCardConfig.ts:442-442 — вне границ: в frontend_vue/src/composables/useCardConfig.ts 120 строк, ссылка на 442-442
  roo_code/plans/api/audit/config.md:152 → src/types/config.ts:267-267 — вне границ: в frontend_vue/src/types/config.ts 66 строк, ссылка на 267-267
  roo_code/plans/api/audit/config.md:194 → src/composables/useCardConfig.ts:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «saveConfig()»
  roo_code/plans/api/audit/config.md:198 → mocks/config.ts:265-267 — нет токена в диапазоне: в 265-267 нет ни одного из: «mockSavePermissions»
  roo_code/plans/api/audit/config.md:199 → mocks/config.ts:232-232 — нет токена в диапазоне: в 232-232 нет ни одного из: «MOCK_PERMISSIONS»
roo_code/plans/api/audit/finance.md: ссылок 488, битых 6, глазами 116, без токена 276
  roo_code/plans/api/audit/finance.md:122 → OutgoingPaymentCardPage.vue:90-91 — нет токена в диапазоне: в 90-91 нет ни одного из: «load()»
  roo_code/plans/api/audit/finance.md:135 → src/services/financeService.ts:20-20 — нет токена в диапазоне: в 20-20 нет ни одного из: «tenant_id»
  roo_code/plans/api/audit/finance.md:136 → src/services/mocks/finance.ts:522-522 — нет токена в диапазоне: в 522-522 нет ни одного из: «status», «amount», «paymentNumber»
  roo_code/plans/api/audit/finance.md:137 → src/services/mocks/finance.ts:110-114 — нет токена в диапазоне: в 110-114 нет ни одного из: «counterpartyId», «sup-001…sup-005», «'1'…'6'»
  roo_code/plans/api/audit/finance.md:140 → src/views/admin/finance/OutgoingPaymentCardPage.vue:66-68 — нет токена в диапазоне: в 66-68 нет ни одного из: «PAYMENT_NOT_FOUND»
  roo_code/plans/api/audit/finance.md:145 → src/services/mocks/finance.ts:503-503 — нет токена в диапазоне: в 503-503 нет ни одного из: «pdoc-N», «fileId»
roo_code/plans/api/audit/notifications.md: ссылок 311, битых 4, глазами 88, без токена 173
  roo_code/plans/api/audit/notifications.md:32 → NotificationsPage.vue:2883-2883 — вне границ: в frontend_vue/src/views/admin/notifications/NotificationsPage.vue 335 строк, ссылка на 2883-2883
  roo_code/plans/api/audit/notifications.md:32 → NotificationsPage.vue:2949-2949 — вне границ: в frontend_vue/src/views/admin/notifications/NotificationsPage.vue 335 строк, ссылка на 2949-2949
  roo_code/plans/api/audit/notifications.md:32 → mocks/notifications.ts:2938-2938 — вне границ: в frontend_vue/src/services/mocks/notifications.ts 782 строк, ссылка на 2938-2938
  roo_code/plans/api/audit/notifications.md:54 → backend/app/modules/notifications/shared/models.py:2979-2979 — вне границ: в backend/app/modules/notifications/shared/models.py 126 строк, ссылка на 2979-2979
roo_code/plans/api/audit/orders.md: ссылок 871, битых 18, глазами 281, без токена 458
  roo_code/plans/api/audit/orders.md:39 → frontend_vue/src/services/api.ts:128-138 — нет токена в диапазоне: в 128-138 нет ни одного из: «ApiResponse<T>»
  roo_code/plans/api/audit/orders.md:45 → frontend_vue/src/services/mocks/orders.ts:1955-1958 — нет токена в диапазоне: в 1955-1958 нет ни одного из: «bumpVersion»
  roo_code/plans/api/audit/orders.md:48 → frontend_vue/src/composables/useOrderCard.ts:227-229 — нет токена в диапазоне: в 227-229 нет ни одного из: «DELETE», «If-Match»
  roo_code/plans/api/audit/orders.md:51 → frontend_vue/src/services/mocks/orders.ts:1942-1942 — нет токена в диапазоне: в 1942-1942 нет ни одного из: «undefined»
  roo_code/plans/api/audit/orders.md:100 → src/services/ordersService.ts:160-165 — нет токена в диапазоне: в 160-165 нет ни одного из: «If-Match»
  roo_code/plans/api/audit/orders.md:157 → mocks/orders.ts:4028-4028 — нет токена в диапазоне: в 4028-4028 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/plans/api/audit/orders.md:168 → mocks/orders.ts:3944-3944 — нет токена в диапазоне: в 3944-3944 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/plans/api/audit/orders.md:190 → mocks/orders.ts:3640-3640 — нет токена в диапазоне: в 3640-3640 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/plans/api/audit/orders.md:201 → mocks/orders.ts:3631-3631 — нет токена в диапазоне: в 3631-3631 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/plans/api/audit/orders.md:223 → mocks/orders.ts:2816-2816 — нет токена в диапазоне: в 2816-2816 нет ни одного из: «ORDER_NOT_FOUND»
  roo_code/plans/api/audit/orders.md:277 → mocks/orders.ts:1841-1841 — нет токена в диапазоне: в 1841-1841 нет ни одного из: «ApiResponse<Order>»
  roo_code/plans/api/audit/orders.md:289 → mocks/orders.ts:1616-1616 — нет токена в диапазоне: в 1616-1616 нет ни одного из: «CLIENT_NOT_FOUND»
  roo_code/plans/api/audit/orders.md:290 → src/composables/useOrderCreate.ts:419-477 — нет токена в диапазоне: в 419-477 нет ни одного из: «PATCH»
  roo_code/plans/api/audit/orders.md:332 → mocks/orders.ts:2208-2208 — нет токена в диапазоне: в 2208-2208 нет ни одного из: «ApiResponse<OrderItem>»
  roo_code/plans/api/audit/orders.md:356 → src/composables/useOrderCard.ts:1568-1568 — нет токена в диапазоне: в 1568-1568 нет ни одного из: «line.shippedQuantity»
  roo_code/plans/api/audit/orders.md:419 → src/services/ordersService.ts:305-310 — нет токена в диапазоне: в 305-310 нет ни одного из: «Idempotency-Key»
  roo_code/plans/api/audit/orders.md:471 → src/composables/useOrders.ts:46-46 — нет токена в диапазоне: в 46-46 нет ни одного из: «OrderListItem»
  roo_code/plans/api/audit/orders.md:477 → src/services/ordersService.ts:305-311 — нет токена в диапазоне: в 305-311 нет ни одного из: «Idempotency-Key»
roo_code/plans/api/audit/products.md: ссылок 495, битых 10, глазами 83, без токена 266
  roo_code/plans/api/audit/products.md:16 → frontend_vue/src/types/product.ts:56-109 — нет токена в диапазоне: в 56-109 нет ни одного из: «settings»
  roo_code/plans/api/audit/products.md:53 → src/services/auditFeedService.ts:99-99 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 99-99
  roo_code/plans/api/audit/products.md:53 → src/services/auditFeedService.ts:189-189 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 189-189
  roo_code/plans/api/audit/products.md:97 → src/types/product.ts:1095-1095 — вне границ: в frontend_vue/src/types/product.ts 117 строк, ссылка на 1095-1095
  roo_code/plans/api/audit/products.md:98 → backend/app/modules/products/shared/models.py:98-168 — нет токена в диапазоне: в 98-168 нет ни одного из: «weightPerWarehouseUnitKg»
  roo_code/plans/api/audit/products.md:109 → backend/app/modules/products/features/create_product/action.py:24-24 — нет токена в диапазоне: в 24-24 нет ни одного из: «fieldValues», «linkedSuppliers», «weightPerWarehouseUnitKg»
  roo_code/plans/api/audit/products.md:123 → backend/app/modules/auth/features/me/action.py:36-36 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 36-36
  roo_code/plans/api/audit/products.md:155 → backend/app/modules/products/features/get_product_detail/domain.py:73-73 — нет токена в диапазоне: в 73-73 нет ни одного из: «field_name», «str(fv.field_id)»
  roo_code/plans/api/audit/products.md:161 → frontend_vue/src/services/mocks/products.ts:14145-14145 — нет токена в диапазоне: в 14145-14145 нет ни одного из: «mockPatchProduct», «null»
  roo_code/plans/api/audit/products.md:163 → frontend_vue/src/views/admin/products/ProductsPage.vue:199-218 — нет токена в диапазоне: в 199-218 нет ни одного из: «handleCreate», «catch»
roo_code/plans/api/audit/sales-crm.md: ссылок 136, битых 12, глазами 2, без токена 99
  roo_code/plans/api/audit/sales-crm.md:50 → src/services/api.ts:157-159 — нет токена в диапазоне: в 157-159 нет ни одного из: «options?.headers»
  roo_code/plans/api/audit/sales-crm.md:91 → src/views/admin/sales-crm/SalesCrmPage.vue:105-108 — нет токена в диапазоне: в 105-108 нет ни одного из: «Promise.all»
  roo_code/plans/api/audit/sales-crm.md:187 → frontend_vue/src/types/audit.ts:16-26 — нет токена в диапазоне: в 16-26 нет ни одного из: «sales», «crm»
  roo_code/plans/api/audit/sales-crm.md:202 → frontend_vue/src/types/config.ts:5-5 — нет токена в диапазоне: в 5-5 нет ни одного из: «fieldValues»
  roo_code/plans/api/audit/sales-crm.md:209 → src/domain/orderStatus.ts:15-31 — нет токена в диапазоне: в 15-31 нет ни одного из: «activeOrders», «salesMtd»
  roo_code/plans/api/audit/sales-crm.md:217 → src/types/order.ts:53-53 — нет токена в диапазоне: в 53-53 нет ни одного из: «totalAmount»
  roo_code/plans/api/audit/sales-crm.md:224 → mocks/orders.ts:1581-1583 — нет токена в диапазоне: в 1581-1583 нет ни одного из: «newClientsThisMonth»
  roo_code/plans/api/audit/sales-crm.md:241 → mocks/clients.ts:1046-1048 — нет токена в диапазоне: в 1046-1048 нет ни одного из: «mockGetClients()»
  roo_code/plans/api/audit/sales-crm.md:249 → frontend_vue/src/router/index.ts:139-142 — нет токена в диапазоне: в 139-142 нет ни одного из: «adminSalesCrm»
  roo_code/plans/api/audit/sales-crm.md:260 → mocks/index.ts:540-542 — нет токена в диапазоне: в 540-542 нет ни одного из: «True»
  roo_code/plans/api/audit/sales-crm.md:295 → mocks/clients.ts:1046-1048 — нет токена в диапазоне: в 1046-1048 нет ни одного из: «structuredClone(STORE)»
  roo_code/plans/api/audit/sales-crm.md:303 → mocks/orders.ts:1315-1327 — нет токена в диапазоне: в 1315-1327 нет ни одного из: «invoiceBalances»
roo_code/plans/api/audit/services.md: ссылок 199, битых 5, глазами 39, без токена 99
  roo_code/plans/api/audit/services.md:38 → types/service.ts:3-18 — нет токена в диапазоне: в 3-18 нет ни одного из: «settings»
  roo_code/plans/api/audit/services.md:113 → backend/app/modules/services/shared/models.py:1187-1188 — вне границ: в backend/app/modules/services/shared/models.py 54 строк, ссылка на 1187-1188
  roo_code/plans/api/audit/services.md:123 → frontend_vue/src/services/mocks/orders.ts:2418-2425 — нет токена в диапазоне: в 2418-2425 нет ни одного из: «notifications»
  roo_code/plans/api/audit/services.md:144 → mocks/services.ts:88-95 — нет токена в диапазоне: в 88-95 нет ни одного из: «assertKnownPricing»
  roo_code/plans/api/audit/services.md:146 → mocks/services.ts:80-87 — нет токена в диапазоне: в 80-87 нет ни одного из: «'EUR/kg'»
roo_code/plans/api/audit/settings.md: ссылок 690, битых 39, глазами 186, без токена 373
  roo_code/plans/api/audit/settings.md:12 → backend/app/core/schemas.py:29-35 — нет токена в диапазоне: в 29-35 нет ни одного из: «unwrap()»
  roo_code/plans/api/audit/settings.md:14 → mocks/index.ts:381-381 — нет токена в диапазоне: в 381-381 нет ни одного из: «delay(...)»
  roo_code/plans/api/audit/settings.md:15 → api.ts:149-151 — нет токена в диапазоне: в 149-151 нет ни одного из: «getMock», «postMock», «fetch», «unwrap»
  roo_code/plans/api/audit/settings.md:30 → backend/app/modules/auth/features/me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/api/audit/settings.md:31 → crud/action.py:131-139 — нет токена в диапазоне: в 131-139 нет ни одного из: «_get_tenant»
  roo_code/plans/api/audit/settings.md:35 → crud/action.py:482-482 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 482-482
  roo_code/plans/api/audit/settings.md:46 → backend/app/core/exceptions.py:13-13 — нет токена в диапазоне: в 13-13 нет ни одного из: «UNAUTHORIZED»
  roo_code/plans/api/audit/settings.md:47 → crud/action.py:108-108 — нет токена в диапазоне: в 108-108 нет ни одного из: «_resolve_user_id»
  roo_code/plans/api/audit/settings.md:75 → backend/app/modules/settings/features/crud/action.py:482-482 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 482-482
  roo_code/plans/api/audit/settings.md:77 → crud/action.py:484-484 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 484-484
  roo_code/plans/api/audit/settings.md:78 → crud/action.py:490-490 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 490-490
  roo_code/plans/api/audit/settings.md:79 → crud/action.py:491-495 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 491-495
  roo_code/plans/api/audit/settings.md:79 → crud/action.py:496-500 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 496-500
  roo_code/plans/api/audit/settings.md:134 → mocks/settings.ts:565-567 — нет токена в диапазоне: в 565-567 нет ни одного из: «UNAUTHORIZED», «NOT_FOUND»
  roo_code/plans/api/audit/settings.md:145 → mocks/settings.ts:496-498 — нет токена в диапазоне: в 496-498 нет ни одного из: «UNAUTHORIZED», «NOT_FOUND»
  roo_code/plans/api/audit/settings.md:156 → mocks/settings.ts:708-708 — нет токена в диапазоне: в 708-708 нет ни одного из: «mockGetMail», «throw»
  roo_code/plans/api/audit/settings.md:167 → mocks/settings.ts:496-496 — нет токена в диапазоне: в 496-496 нет ни одного из: «mockGetOrderPermissions»
  roo_code/plans/api/audit/settings.md:178 → mocks/settings.ts:613-615 — нет токена в диапазоне: в 613-615 нет ни одного из: «UNAUTHORIZED», «NOT_FOUND»
  roo_code/plans/api/audit/settings.md:184 → src/services/settingsService.ts:185-185 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 185-185
  roo_code/plans/api/audit/settings.md:187 → settingsService.ts:185-185 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 185-185
  roo_code/plans/api/audit/settings.md:200 → mocks/settings.ts:523-525 — нет токена в диапазоне: в 523-525 нет ни одного из: «UNAUTHORIZED», «NOT_FOUND»
  roo_code/plans/api/audit/settings.md:266 → mocks/settings.ts:717-717 — нет токена в диапазоне: в 717-717 нет ни одного из: «mockPatchMail», «throw», «host», «fromEmail», «port»
  roo_code/plans/api/audit/settings.md:275 → crud/action.py:468-473 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 468-473
  roo_code/plans/api/audit/settings.md:276 → crud/action.py:475-479 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 475-479
  roo_code/plans/api/audit/settings.md:277 → crud/action.py:468-479 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 468-479
  roo_code/plans/api/audit/settings.md:283 → src/services/settingsService.ts:189-189 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 189-189
  roo_code/plans/api/audit/settings.md:286 → settingsService.ts:188-188 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 188-188
  roo_code/plans/api/audit/settings.md:287 → settingsService.ts:188-188 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 188-188
  roo_code/plans/api/audit/settings.md:287 → profile/action.py:111-114 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 111-114
  roo_code/plans/api/audit/settings.md:288 → profile/action.py:115-119 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 115-119
  roo_code/plans/api/audit/settings.md:288 → profile/action.py:120-124 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 120-124
  roo_code/plans/api/audit/settings.md:305 → src/services/settingsService.ts:197-197 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 197-197
  roo_code/plans/api/audit/settings.md:306 → backend/app/modules/settings/features/profile/action.py:127-127 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 127-127
  roo_code/plans/api/audit/settings.md:308 → settingsService.ts:192-196 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 192-196
  roo_code/plans/api/audit/settings.md:309 → settingsService.ts:196-196 — вне границ: в frontend_vue/src/services/settingsService.ts 179 строк, ссылка на 196-196
  roo_code/plans/api/audit/settings.md:309 → profile/action.py:140-140 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 140-140
  roo_code/plans/api/audit/settings.md:310 → profile/action.py:141-145 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 141-145
  roo_code/plans/api/audit/settings.md:310 → profile/action.py:146-150 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 146-150
  roo_code/plans/api/audit/settings.md:431 → useWarehouseMap.ts:39-42 — нет токена в диапазоне: в 39-42 нет ни одного из: «image/*»
roo_code/plans/api/audit/suppliers.md: ссылок 267, битых 8, глазами 56, без токена 126
  roo_code/plans/api/audit/suppliers.md:29 → src/services/auditFeedService.ts:530-530 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 530-530
  roo_code/plans/api/audit/suppliers.md:84 → src/views/admin/suppliers/SupplierCardPage.vue:470-505 — вне границ: в frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue 362 строк, ссылка на 470-505
  roo_code/plans/api/audit/suppliers.md:84 → src/types/supplier.ts:465-465 — вне границ: в frontend_vue/src/types/supplier.ts 113 строк, ссылка на 465-465
  roo_code/plans/api/audit/suppliers.md:93 → mocks/suppliers.ts:451-454 — нет токена в диапазоне: в 451-454 нет ни одного из: «mockUpdateSupplierStatus»
  roo_code/plans/api/audit/suppliers.md:106 → backend/app/modules/suppliers/shared/models.py:420-420 — вне границ: в backend/app/modules/suppliers/shared/models.py 380 строк, ссылка на 420-420
  roo_code/plans/api/audit/suppliers.md:106 → backend/app/modules/suppliers/shared/models.py:424-424 — вне границ: в backend/app/modules/suppliers/shared/models.py 380 строк, ссылка на 424-424
  roo_code/plans/api/audit/suppliers.md:117 → backend/app/modules/suppliers/shared/models.py:470-505 — вне границ: в backend/app/modules/suppliers/shared/models.py 380 строк, ссылка на 470-505
  roo_code/plans/api/audit/suppliers.md:158 → src/services/mocks/index.ts:327-330 — нет токена в диапазоне: в 327-330 нет ни одного из: «sup-NNN»
roo_code/plans/api/audit/uploads.md: ссылок 218, битых 44, глазами 10, без токена 137
  roo_code/plans/api/audit/uploads.md:27 → core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/api/audit/uploads.md:46 → backend/app/core/uploads/action.py:82-82 — нет токена в диапазоне: в 82-82 нет ни одного из: «list[UploadFile]»
  roo_code/plans/api/audit/uploads.md:48 → src/services/api.ts:248-249 — нет токена в диапазоне: в 248-249 нет ни одного из: «File», «apiUpload»
  roo_code/plans/api/audit/uploads.md:49 → src/services/api.ts:243-243 — нет токена в диапазоне: в 243-243 нет ни одного из: «DropZone»
  roo_code/plans/api/audit/uploads.md:52 → uploadsService.ts:16-16 — нет токена в диапазоне: в 16-16 нет ни одного из: «@router.post("")»
  roo_code/plans/api/audit/uploads.md:55 → src/services/uploadsService.ts:14-15 — нет токена в диапазоне: в 14-15 нет ни одного из: «localStorage.getItem('auth_token')»
  roo_code/plans/api/audit/uploads.md:72 → config.py:35-35 — нет токена в диапазоне: в 35-35 нет ни одного из: «uploadFile»
  roo_code/plans/api/audit/uploads.md:73 → uploadsService.ts:13-17 — нет токена в диапазоне: в 13-17 нет ни одного из: «DropZone.handleFiles»
  roo_code/plans/api/audit/uploads.md:78 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/api/audit/uploads.md:79 → core/uploads/action.py:79-79 — нет токена в диапазоне: в 79-79 нет ни одного из: «success», «message», «code», «response_model=ApiResponse»
  roo_code/plans/api/audit/uploads.md:82 → core/uploads/action.py:145-145 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 145-145
  roo_code/plans/api/audit/uploads.md:83 → core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/plans/api/audit/uploads.md:83 → core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/api/audit/uploads.md:84 → uploadsService.ts:16-16 — нет токена в диапазоне: в 16-16 нет ни одного из: «apiUpload<UploadedFile>»
  roo_code/plans/api/audit/uploads.md:87 → mocks/index.ts:337-337 — нет токена в диапазоне: в 337-337 нет ни одного из: «url»
  roo_code/plans/api/audit/uploads.md:89 → mocks/index.ts:1867-1867 — нет токена в диапазоне: в 1867-1867 нет ни одного из: «fileId», «file-<seq>-<Date.now()>»
  roo_code/plans/api/audit/uploads.md:90 → core/uploads/action.py:145-145 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 145-145
  roo_code/plans/api/audit/uploads.md:99 → useWarehouseMap.ts:45-45 — нет токена в диапазоне: в 45-45 нет ни одного из: «undefined»
  roo_code/plans/api/audit/uploads.md:109 → core/uploads/action.py:39-42 — нет токена в диапазоне: в 39-42 нет ни одного из: «UNAUTHORIZED», «Bearer»
  roo_code/plans/api/audit/uploads.md:111 → core/uploads/action.py:97-103 — нет токена в диапазоне: в 97-103 нет ни одного из: «VALIDATION_ERROR»
  roo_code/plans/api/audit/uploads.md:112 → core/uploads/action.py:109-115 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 109-115
  roo_code/plans/api/audit/uploads.md:114 → core/uploads/action.py:72-75 — нет токена в диапазоне: в 72-75 нет ни одного из: «NOT_FOUND»
  roo_code/plans/api/audit/uploads.md:152 → core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/api/audit/uploads.md:156 → core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/plans/api/audit/uploads.md:159 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/api/audit/uploads.md:164 → core/uploads/action.py:106-115 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 106-115
  roo_code/plans/api/audit/uploads.md:173 → core/uploads/service.py:51-57 — нет токена в диапазоне: в 51-57 нет ни одного из: «delete_file»
  roo_code/plans/api/audit/uploads.md:229 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/api/audit/uploads.md:231 → core/uploads/action.py:138-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 138-146
  roo_code/plans/api/audit/uploads.md:246 → core/uploads/action.py:135-135 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 135-135
  roo_code/plans/api/audit/uploads.md:269 → mocks/index.ts:1867-1867 — нет токена в диапазоне: в 1867-1867 нет ни одного из: «fileId»
  roo_code/plans/api/audit/uploads.md:274 → core/uploads/action.py:126-126 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 126-126
  roo_code/plans/api/audit/uploads.md:282 → core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/api/audit/uploads.md:283 → core/uploads/action.py:127-127 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 127-127
  roo_code/plans/api/audit/uploads.md:285 → core/uploads/action.py:34-59 — нет токена в диапазоне: в 34-59 нет ни одного из: «_resolve_user_id»
  roo_code/plans/api/audit/uploads.md:297 → core/uploads/action.py:123-123 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 123-123
  roo_code/plans/api/audit/uploads.md:302 → core/uploads/action.py:117-138 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 117-138
  roo_code/plans/api/audit/uploads.md:304 → core/uploads/action.py:79-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 79-146
  roo_code/plans/api/audit/uploads.md:312 → core/uploads/action.py:141-141 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-141
  roo_code/plans/api/audit/uploads.md:312 → core/uploads/action.py:142-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 142-142
  roo_code/plans/api/audit/uploads.md:328 → DropZone.vue:33-38 — нет токена в диапазоне: в 33-38 нет ни одного из: «fileId»
  roo_code/plans/api/audit/uploads.md:331 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/api/audit/uploads.md:354 → src/services/api.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «USE_MOCKS»
  roo_code/plans/api/audit/uploads.md:360 → core/uploads/action.py:145-145 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 145-145
roo_code/plans/api/audit/warehouse.md: ссылок 925, битых 21, глазами 166, без токена 510
  roo_code/plans/api/audit/warehouse.md:19 → backend/app/modules/warehouse/shared/models.py:11-11 — нет токена в диапазоне: в 11-11 нет ни одного из: «stock_items», «stock_audit_entries»
  roo_code/plans/api/audit/warehouse.md:38 → frontend_vue/src/services/api.ts:128-141 — нет токена в диапазоне: в 128-141 нет ни одного из: «getMock», «postMock»
  roo_code/plans/api/audit/warehouse.md:47 → frontend_vue/src/composables/useWarehouseBatch.ts:341-341 — нет токена в диапазоне: в 341-341 нет ни одного из: «BATCH_LINKED_TO_ORDER»
  roo_code/plans/api/audit/warehouse.md:48 → frontend_vue/src/composables/useWarehouseOffcutCard.ts:386-386 — нет токена в диапазоне: в 386-386 нет ни одного из: «OFFCUT_LINKED_TO_ORDER»
  roo_code/plans/api/audit/warehouse.md:66 → services/mocks/index.ts:1612-1612 — нет токена в диапазоне: в 1612-1612 нет ни одного из: «Promise<void>», «ApiResponse<null>»
  roo_code/plans/api/audit/warehouse.md:77 → services/mocks/index.ts:1447-1447 — нет токена в диапазоне: в 1447-1447 нет ни одного из: «Promise<void>»
  roo_code/plans/api/audit/warehouse.md:88 → services/mocks/index.ts:1631-1631 — нет токена в диапазоне: в 1631-1631 нет ни одного из: «Promise<void>»
  roo_code/plans/api/audit/warehouse.md:98 → src/services/auditFeedService.ts:76-76 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 76-76
  roo_code/plans/api/audit/warehouse.md:99 → services/mocks/index.ts:1477-1477 — нет токена в диапазоне: в 1477-1477 нет ни одного из: «Promise<void>»
  roo_code/plans/api/audit/warehouse.md:101 → src/services/auditFeedService.ts:76-76 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 76-76
  roo_code/plans/api/audit/warehouse.md:110 → services/mocks/index.ts:1468-1468 — нет токена в диапазоне: в 1468-1468 нет ни одного из: «Promise<void>»
  roo_code/plans/api/audit/warehouse.md:121 → services/mocks/index.ts:1618-1618 — нет токена в диапазоне: в 1618-1618 нет ни одного из: «Promise<void>»
  roo_code/plans/api/audit/warehouse.md:132 → services/mocks/index.ts:1459-1459 — нет токена в диапазоне: в 1459-1459 нет ни одного из: «Promise<void>»
  roo_code/plans/api/audit/warehouse.md:188 → services/mocks/warehouse.ts:1417-1417 — нет токена в диапазоне: в 1417-1417 нет ни одного из: «BATCH_NOT_FOUND»
  roo_code/plans/api/audit/warehouse.md:231 → services/mocks/warehouse.ts:1916-1919 — нет токена в диапазоне: в 1916-1919 нет ни одного из: «StockAuditEntry[]», «structuredClone»
  roo_code/plans/api/audit/warehouse.md:275 → services/mocks/warehouse.ts:1902-1904 — нет токена в диапазоне: в 1902-1904 нет ни одного из: «StockAuditEntry[]», «structuredClone», «movementAuditStore»
  roo_code/plans/api/audit/warehouse.md:385 → services/mocks/warehouse.ts:1766-1767 — нет токена в диапазоне: в 1766-1767 нет ни одного из: «WarehouseDeficit», «updatedAt»
  roo_code/plans/api/audit/warehouse.md:420 → src/composables/useWarehouseBatchCreate.ts:389-389 — нет токена в диапазоне: в 389-389 нет ни одного из: «submit()»
  roo_code/plans/api/audit/warehouse.md:501 → frontend_vue/src/services/mocks/warehouse.ts:1264-1273 — нет токена в диапазоне: в 1264-1273 нет ни одного из: «writeMovement»
  roo_code/plans/api/audit/warehouse.md:604 → frontend_vue/src/services/auditFeedService.ts:66-76 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 66-76
  roo_code/plans/api/audit/warehouse.md:610 → frontend_vue/src/services/mocks/index.ts:744-744 — нет токена в диапазоне: в 744-744 нет ни одного из: «path.endsWith('/audit')», «([^/]+)$»
roo_code/plans/bugs/alembic-graph-had-two-heads.md: ссылок 6, битых 2, глазами 0, без токена 4
  roo_code/plans/bugs/alembic-graph-had-two-heads.md:81 → ../../../backend/app/core/uploads/models.py:24-24 — нет файла: не нашёл ../../../backend/app/core/uploads/models.py
  roo_code/plans/bugs/alembic-graph-had-two-heads.md:167 → ../../../backend/app/core/uploads/models.py:24-24 — нет файла: не нашёл ../../../backend/app/core/uploads/models.py
roo_code/plans/bugs/contract-sync-analytics-bugs.md: ссылок 94, битых 7, глазами 0, без токена 79
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:80 → frontend_vue/src/services/api.ts:157-159 — нет токена в диапазоне: в 157-159 нет ни одного из: «options?.headers»
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:85 → frontend_vue/src/composables/useAuth.ts:101-108 — нет токена в диапазоне: в 101-108 нет ни одного из: «X-CSRF-Token»
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:123 → mocks/analytics.ts:891-892 — нет токена в диапазоне: в 891-892 нет ни одного из: «deficitItems»
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:170 → DashboardPage.vue:95-95 — нет токена в диапазоне: в 95-95 нет ни одного из: «chart-bar», «receipt»
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:235 → frontend_vue/src/i18n/index.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «toLocaleString()»
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:314 → mocks/index.ts:402-402 — нет токена в диапазоне: в 402-402 нет ни одного из: «path.match(/^\/api\/analytics\/(.+)$/)»
  roo_code/plans/bugs/contract-sync-analytics-bugs.md:462 → DashboardPage.vue:152-162 — нет токена в диапазоне: в 152-162 нет ни одного из: «<tr>»
roo_code/plans/bugs/contract-sync-audit-feed-bugs.md: ссылок 68, битых 5, глазами 2, без токена 55
  roo_code/plans/bugs/contract-sync-audit-feed-bugs.md:44 → frontend_vue/src/services/mocks/orders.ts:4686-4693 — нет токена в диапазоне: в 4686-4693 нет ни одного из: «toRows»
  roo_code/plans/bugs/contract-sync-audit-feed-bugs.md:45 → frontend_vue/src/services/mocks/auditFeed.ts:47-60 — нет токена в диапазоне: в 47-60 нет ни одного из: «sensitive»
  roo_code/plans/bugs/contract-sync-audit-feed-bugs.md:80 → frontend_vue/src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/plans/bugs/contract-sync-audit-feed-bugs.md:97 → frontend_vue/src/services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
  roo_code/plans/bugs/contract-sync-audit-feed-bugs.md:337 → services/auditFeedService.ts:57-77 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 57-77
roo_code/plans/bugs/contract-sync-auth-bugs.md: ссылок 121, битых 23, глазами 2, без токена 84
  roo_code/plans/bugs/contract-sync-auth-bugs.md:154 → register/domain.py:40-40 — нет токена в диапазоне: в 40-40 нет ни одного из: «VAT», «vat_code»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:188 → backend/app/modules/auth/features/me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-auth-bugs.md:195 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-auth-bugs.md:211 → backend/app/modules/auth/features/me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-auth-bugs.md:219 → register/domain.py:145-151 — нет токена в диапазоне: в 145-151 нет ни одного из: «token_hash»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:221 → register/domain.py:137-137 — нет токена в диапазоне: в 137-137 нет ни одного из: «select(Session)»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:223 → me/action.py:25-28 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 25-28
  roo_code/plans/bugs/contract-sync-auth-bugs.md:249 → backend/app/modules/auth/features/me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-auth-bugs.md:260 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-auth-bugs.md:285 → useAuth.ts:101-108 — нет токена в диапазоне: в 101-108 нет ни одного из: «X-CSRF-Token»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:311 → me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-auth-bugs.md:312 → settings/features/crud/action.py:119-119 — нет токена в диапазоне: в 119-119 нет ни одного из: «_serializer.loads(token)»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:313 → settings/features/profile/action.py:63-63 — нет токена в диапазоне: в 63-63 нет ни одного из: «_serializer.loads(token)»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:314 → core/uploads/action.py:50-50 — нет токена в диапазоне: в 50-50 нет ни одного из: «_serializer.loads(token)»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:317 → useAuth.ts:207-209 — нет токена в диапазоне: в 207-209 нет ни одного из: «401»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:321 → me/action.py:47-47 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 47-47
  roo_code/plans/bugs/contract-sync-auth-bugs.md:322 → settings/features/crud/action.py:108-108 — нет токена в диапазоне: в 108-108 нет ни одного из: «UNAUTHORIZED»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:349 → me/domain.py:33-33 — вне границ: в backend/app/modules/auth/features/me/domain.py 27 строк, ссылка на 33-33
  roo_code/plans/bugs/contract-sync-auth-bugs.md:351 → auth/shared/models.py:60-63 — нет токена в диапазоне: в 60-63 нет ни одного из: «settingsUsers.role_<role>»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:352 → AdminTopbar.vue:26-27 — нет токена в диапазоне: в 26-27 нет ни одного из: «role_owner», «role_admin»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:353 → frontend_vue/src/i18n/admin/settings.ts:231-237 — нет токена в диапазоне: в 231-237 нет ни одного из: «"Owner"»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:412 → register/repository.py:40-42 — нет токена в диапазоне: в 40-42 нет ни одного из: «scalar_one_or_none()»
  roo_code/plans/bugs/contract-sync-auth-bugs.md:442 → me/action.py:47-47 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 47-47
roo_code/plans/bugs/contract-sync-bcc-bugs.md: ссылок 80, битых 14, глазами 5, без токена 50
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:48 → frontend_vue/src/services/mocks/notifications.ts:424-424 — нет токена в диапазоне: в 424-424 нет ни одного из: «structuredClone»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:80 → mocks/orders.ts:1356-1360 — нет токена в диапазоне: в 1356-1360 нет ни одного из: «maxSeq»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:165 → frontend_vue/src/composables/useBccRequest.ts:106-106 — нет токена в диапазоне: в 106-106 нет ни одного из: «max»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:169 → BccRequestPage.vue:274-274 — нет токена в диапазоне: в 274-274 нет ни одного из: «req-NNN», «req-###»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:170 → roo_code/roo-context/03-api-contract.md:581-581 — нет токена в диапазоне: в 581-581 нет ни одного из: «String(50)»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:200 → frontend_vue/src/services/api.ts:259-264 — нет токена в диапазоне: в 259-264 нет ни одного из: «newIdempotencyKey»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:267 → mocks/bcc.ts:146-146 — нет токена в диапазоне: в 146-146 нет ни одного из: «'sup-004'»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:269 → mocks/bcc.ts:240-240 — нет токена в диапазоне: в 240-240 нет ни одного из: «MOCK_SUPPLIERS», «'1'», «'6'»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:272 → mocks/suppliers.ts:306-306 — нет токена в диапазоне: в 306-306 нет ни одного из: «mockGetSupplier», «'sup-001'»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:274 → mocks/bcc.ts:368-368 — нет токена в диапазоне: в 368-368 нет ни одного из: «entityId»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:299 → mocks/bcc.ts:146-146 — нет токена в диапазоне: в 146-146 нет ни одного из: «MOCK_SUPPLIERS»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:320 → frontend_vue/src/services/mocks/products.ts:31-31 — нет токена в диапазоне: в 31-31 нет ни одного из: «cat-1»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:347 → mocks/bcc.ts:7-118 — нет токена в диапазоне: в 7-118 нет ни одного из: «categories»
  roo_code/plans/bugs/contract-sync-bcc-bugs.md:478 → frontend_vue/src/services/auditFeedService.ts:20-20 — нет токена в диапазоне: в 20-20 нет ни одного из: «user_id»
roo_code/plans/bugs/contract-sync-categories-bugs.md: ссылок 50, битых 3, глазами 2, без токена 41
  roo_code/plans/bugs/contract-sync-categories-bugs.md:111 → frontend_vue/src/services/categoriesService.ts:9-10 — нет токена в диапазоне: в 9-10 нет ни одного из: «allCategories»
  roo_code/plans/bugs/contract-sync-categories-bugs.md:253 → frontend_vue/src/types/category.ts:16-23 — нет токена в диапазоне: в 16-23 нет ни одного из: «fieldName»
  roo_code/plans/bugs/contract-sync-categories-bugs.md:254 → mocks/categories.ts:1497-1497 — нет токена в диапазоне: в 1497-1497 нет ни одного из: «mockPutCategoryFields», «f.name»
roo_code/plans/bugs/contract-sync-clients-bugs.md: ссылок 65, битых 4, глазами 2, без токена 51
  roo_code/plans/bugs/contract-sync-clients-bugs.md:30 → frontend_vue/src/types/client.ts:6-13 — нет токена в диапазоне: в 6-13 нет ни одного из: «save()»
  roo_code/plans/bugs/contract-sync-clients-bugs.md:56 → frontend_vue/src/services/mocks/clients.ts:1155-1155 — нет токена в диапазоне: в 1155-1155 нет ни одного из: «mockDeleteClientInteraction»
  roo_code/plans/bugs/contract-sync-clients-bugs.md:159 → frontend_vue/src/services/api.ts:88-89 — нет токена в диапазоне: в 88-89 нет ни одного из: «VALIDATION_ERROR»
  roo_code/plans/bugs/contract-sync-clients-bugs.md:199 → frontend_vue/src/services/api.ts:154-155 — нет токена в диапазоне: в 154-155 нет ни одного из: «URLSearchParams.set»
roo_code/plans/bugs/contract-sync-config-bugs.md: ссылок 86, битых 1, глазами 0, без токена 75
  roo_code/plans/bugs/contract-sync-config-bugs.md:152 → mocks/config.ts:318-321 — нет токена в диапазоне: в 318-321 нет ни одного из: «toTranslatedString»
roo_code/plans/bugs/contract-sync-conventions-bugs.md: ссылок 27, битых 1, глазами 1, без токена 19
  roo_code/plans/bugs/contract-sync-conventions-bugs.md:168 → clients.md:238-238 — нет токена в диапазоне: в 238-238 нет ни одного из: «CLIENT_EMAIL_TAKEN»
roo_code/plans/bugs/contract-sync-finance-bugs.md: ссылок 78, битых 1, глазами 0, без токена 72
  roo_code/plans/bugs/contract-sync-finance-bugs.md:221 → frontend_vue/src/services/mocks/finance.ts:428-428 — нет токена в диапазоне: в 428-428 нет ни одного из: «PAYMENT_NOT_FOUND»
roo_code/plans/bugs/contract-sync-notifications-bugs.md: ссылок 44, битых 1, глазами 0, без токена 38
  roo_code/plans/bugs/contract-sync-notifications-bugs.md:41 → backend/app/modules/settings/features/crud/action.py:97-128 — нет токена в диапазоне: в 97-128 нет ни одного из: «user_id»
roo_code/plans/bugs/contract-sync-orders-bugs.md: ссылок 72, битых 11, глазами 3, без токена 53
  roo_code/plans/bugs/contract-sync-orders-bugs.md:97 → frontend_vue/src/composables/useOrderCard.ts:575-575 — нет токена в диапазоне: в 575-575 нет ни одного из: «atVersion()»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:99 → frontend_vue/src/composables/useOrders.ts:33-35 — нет токена в диапазоне: в 33-35 нет ни одного из: «OrderListItem», «version»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:128 → frontend_vue/src/services/api.ts:155-155 — нет токена в диапазоне: в 155-155 нет ни одного из: «apiGet», «searchParams.set»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:160 → frontend_vue/src/services/mocks/orders.ts:1738-1742 — нет токена в диапазоне: в 1738-1742 нет ни одного из: «statusRules»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:165 → mocks/orders.ts:1822-1822 — нет токена в диапазоне: в 1822-1822 нет ни одного из: «STATUS_BLOCKED_BY_STOCK»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:169 → frontend_vue/src/domain/orderStatus.ts:15-31 — нет токена в диапазоне: в 15-31 нет ни одного из: «st-*»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:294 → mocks/orders.ts:3382-3382 — нет токена в диапазоне: в 3382-3382 нет ни одного из: «SHIPMENT_ALREADY_CANCELLED»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:330 → frontend_vue/src/services/ordersService.ts:202-202 — нет токена в диапазоне: в 202-202 нет ни одного из: «Promise<void>»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:331 → frontend_vue/src/services/mocks/orders.ts:2512-2512 — нет токена в диапазоне: в 2512-2512 нет ни одного из: «OrderFile»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:344 → frontend_vue/src/services/mocks/orders.ts:2505-2507 — нет токена в диапазоне: в 2505-2507 нет ни одного из: «url», «size», «mime»
  roo_code/plans/bugs/contract-sync-orders-bugs.md:375 → frontend_vue/src/composables/useOrders.ts:53-53 — нет токена в диапазоне: в 53-53 нет ни одного из: «lineEditErrorKey»
roo_code/plans/bugs/contract-sync-products-bugs.md: ссылок 94, битых 8, глазами 1, без токена 78
  roo_code/plans/bugs/contract-sync-products-bugs.md:159 → backend/app/modules/products/features/get_product_detail/action.py:29-29 — нет токена в диапазоне: в 29-29 нет ни одного из: «field_name»
  roo_code/plans/bugs/contract-sync-products-bugs.md:162 → backend/app/modules/products/shared/models.py:67-67 — нет токена в диапазоне: в 67-67 нет ни одного из: «product_field_values.field_id»
  roo_code/plans/bugs/contract-sync-products-bugs.md:202 → mocks/products.ts:14230-14236 — нет токена в диапазоне: в 14230-14236 нет ни одного из: «mockDeleteProductAuditEntry»
  roo_code/plans/bugs/contract-sync-products-bugs.md:246 → backend/app/modules/products/features/get_product_detail/domain.py:56-56 — нет токена в диапазоне: в 56-56 нет ни одного из: «NOT_FOUND»
  roo_code/plans/bugs/contract-sync-products-bugs.md:277 → backend/app/modules/products/features/get_product_detail/schemas.py:25-54 — нет токена в диапазоне: в 25-54 нет ни одного из: «useProductCard.load()»
  roo_code/plans/bugs/contract-sync-products-bugs.md:350 → frontend_vue/src/services/productsService.ts:63-83 — нет токена в диапазоне: в 63-83 нет ни одного из: «weightPerWarehouseUnitKg»
  roo_code/plans/bugs/contract-sync-products-bugs.md:388 → frontend_vue/src/composables/useProductCard.ts:257-257 — нет токена в диапазоне: в 257-257 нет ни одного из: «load()»
  roo_code/plans/bugs/contract-sync-products-bugs.md:420 → frontend_vue/src/types/i18n.ts:19-24 — нет токена в диапазоне: в 19-24 нет ни одного из: «name»
roo_code/plans/bugs/contract-sync-sales-crm-bugs.md: ссылок 64, битых 4, глазами 0, без токена 50
  roo_code/plans/bugs/contract-sync-sales-crm-bugs.md:78 → frontend_vue/src/services/mocks/orders.ts:3809-3815 — нет токена в диапазоне: в 3809-3815 нет ни одного из: «salesMtd»
  roo_code/plans/bugs/contract-sync-sales-crm-bugs.md:287 → frontend_vue/src/domain/orderStatus.ts:103-105 — нет токена в диапазоне: в 103-105 нет ни одного из: «completed»
  roo_code/plans/bugs/contract-sync-sales-crm-bugs.md:353 → frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts:51-54 — нет токена в диапазоне: в 49-52 нет ни одного из: «salesMtd»
  roo_code/plans/bugs/contract-sync-sales-crm-bugs.md:405 → frontend_vue/src/composables/useOrderCard.ts:409-412 — нет токена в диапазоне: в 409-412 нет ни одного из: «ERROR_KEYS»
roo_code/plans/bugs/contract-sync-services-bugs.md: ссылок 51, битых 5, глазами 2, без токена 35
  roo_code/plans/bugs/contract-sync-services-bugs.md:80 → backend/app/modules/settings/features/crud/repository.py:188-204 — нет токена в диапазоне: в 188-204 нет ни одного из: «get_uom_by_code»
  roo_code/plans/bugs/contract-sync-services-bugs.md:156 → mocks/services.ts:135-135 — нет токена в диапазоне: в 135-135 нет ни одного из: «mockPatchService», «findIndex»
  roo_code/plans/bugs/contract-sync-services-bugs.md:271 → api.ts:149-151 — нет токена в диапазоне: в 149-151 нет ни одного из: «fetch»
  roo_code/plans/bugs/contract-sync-services-bugs.md:358 → mocks/orders.ts:2418-2425 — нет токена в диапазоне: в 2418-2425 нет ни одного из: «serviceId»
  roo_code/plans/bugs/contract-sync-services-bugs.md:381 → frontend_vue/src/services/mocks/services.ts:168-173 — нет токена в диапазоне: в 168-173 нет ни одного из: «mockDeleteService»
roo_code/plans/bugs/contract-sync-settings-bugs.md: ссылок 122, битых 12, глазами 2, без токена 96
  roo_code/plans/bugs/contract-sync-settings-bugs.md:29 → crud/action.py:131-139 — нет токена в диапазоне: в 131-139 нет ни одного из: «_get_tenant»
  roo_code/plans/bugs/contract-sync-settings-bugs.md:52 → crud/repository.py:320-332 — нет токена в диапазоне: в 320-332 нет ни одного из: «reorder_order_statuses»
  roo_code/plans/bugs/contract-sync-settings-bugs.md:77 → backend/app/modules/auth/features/me/action.py:52-52 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 52-52
  roo_code/plans/bugs/contract-sync-settings-bugs.md:79 → backend/app/modules/auth/features/me/action.py:54-58 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 54-58
  roo_code/plans/bugs/contract-sync-settings-bugs.md:85 → me/action.py:54-58 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 54-58
  roo_code/plans/bugs/contract-sync-settings-bugs.md:144 → crud/action.py:212-212 — нет токена в диапазоне: в 212-212 нет ни одного из: «response_model=ApiResponse»
  roo_code/plans/bugs/contract-sync-settings-bugs.md:379 → crud/action.py:266-284 — нет токена в диапазоне: в 266-284 нет ни одного из: «delete_currency_route»
  roo_code/plans/bugs/contract-sync-settings-bugs.md:393 → backend/app/modules/settings/features/profile/action.py:127-150 — вне границ: в backend/app/modules/settings/features/profile/action.py 108 строк, ссылка на 127-150
  roo_code/plans/bugs/contract-sync-settings-bugs.md:451 → crud/action.py:496-500 — вне границ: в backend/app/modules/settings/features/crud/action.py 470 строк, ссылка на 496-500
  roo_code/plans/bugs/contract-sync-settings-bugs.md:668 → backend/app/modules/auth/features/me/action.py:31-31 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 31-31
  roo_code/plans/bugs/contract-sync-settings-bugs.md:677 → settings/features/crud/action.py:97-97 — нет токена в диапазоне: в 97-97 нет ни одного из: «_resolve_user_id»
  roo_code/plans/bugs/contract-sync-settings-bugs.md:682 → auth/features/me/action.py:31-31 — вне границ: в backend/app/modules/auth/features/me/action.py 16 строк, ссылка на 31-31
roo_code/plans/bugs/contract-sync-suppliers-bugs.md: ссылок 41, битых 5, глазами 0, без токена 31
  roo_code/plans/bugs/contract-sync-suppliers-bugs.md:64 → frontend_vue/src/services/mocks/suppliers.ts:9-9 — нет токена в диапазоне: в 9-9 нет ни одного из: «'1'», «'6'»
  roo_code/plans/bugs/contract-sync-suppliers-bugs.md:127 → frontend_vue/src/services/mocks/suppliers.ts:132-134 — нет токена в диапазоне: в 132-134 нет ни одного из: «...supplier1», «status»
  roo_code/plans/bugs/contract-sync-suppliers-bugs.md:169 → roo_code/roo-context/03-api-contract.md:386-386 — нет токена в диапазоне: в 386-386 нет ни одного из: «null»
  roo_code/plans/bugs/contract-sync-suppliers-bugs.md:256 → backend/app/modules/suppliers/shared/models.py:99-108 — нет токена в диапазоне: в 99-108 нет ни одного из: «supplier_addresses»
  roo_code/plans/bugs/contract-sync-suppliers-bugs.md:333 → mocks/suppliers.ts:429-447 — нет токена в диапазоне: в 429-447 нет ни одного из: «PATCH», «currency»
roo_code/plans/bugs/contract-sync-uploads-bugs.md: ссылок 145, битых 31, глазами 2, без токена 92
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:16 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:22 → core/uploads/action.py:145-145 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 145-145
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:29 → api.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «VITE_USE_MOCKS», «undefined»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:54 → backend/app/core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:114 → core/uploads/action.py:39-42 — нет токена в диапазоне: в 39-42 нет ни одного из: «UNAUTHORIZED»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:115 → core/uploads/action.py:97-103 — нет токена в диапазоне: в 97-103 нет ни одного из: «VALIDATION_ERROR», «VALIDATION_ERROR»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:116 → core/uploads/action.py:109-115 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 109-115
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:160 → backend/app/core/uploads/action.py:79-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 79-146
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:173 → core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:253 → backend/app/core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:279 → backend/app/core/uploads/action.py:117-138 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 117-138
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:287 → core/uploads/action.py:123-123 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 123-123
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:288 → core/uploads/action.py:126-126 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 126-126
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:290 → core/uploads/action.py:128-138 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 128-138
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:297 → backend/app/main.py:74-74 — нет токена в диапазоне: в 74-74 нет ни одного из: «lifespan»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:309 → backend/app/core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:319 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:343 → models.py:24-24 — нет токена в диапазоне: в 24-24 нет ни одного из: «INTEGER»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:364 → backend/app/core/uploads/action.py:126-126 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 126-126
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:371 → core/uploads/action.py:119-119 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 119-119
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:372 → core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:431 → backend/app/core/uploads/action.py:141-142 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 141-142
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:434 → frontend_vue/src/services/api.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «USE_MOCKS»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:456 → service.py:16-16 — нет токена в диапазоне: в 16-16 нет ни одного из: «store_file»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:458 → core/uploads/action.py:130-130 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 130-130
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:459 → core/uploads/action.py:135-135 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 135-135
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:515 → uploadsService.ts:13-17 — нет токена в диапазоне: в 13-17 нет ни одного из: «Idempotency-Key»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:516 → core/uploads/action.py:117-138 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 117-138
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:517 → core/uploads/action.py:136-136 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 136-136
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:520 → ProductCardPage.vue:223-226 — нет токена в диапазоне: в 223-226 нет ни одного из: «fileId»
  roo_code/plans/bugs/contract-sync-uploads-bugs.md:522 → core/uploads/action.py:34-59 — нет токена в диапазоне: в 34-59 нет ни одного из: «store_file»
roo_code/plans/bugs/contract-sync-warehouse-bugs.md: ссылок 181, битых 9, глазами 8, без токена 148
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:30 → frontend_vue/src/services/api.ts:157-159 — нет токена в диапазоне: в 157-159 нет ни одного из: «apiGet», «apiPost»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:40 → frontend_vue/src/services/auditFeedService.ts:66-76 — вне границ: в frontend_vue/src/services/auditFeedService.ts 75 строк, ссылка на 66-76
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:52 → frontend_vue/src/services/api.ts:258-264 — нет токена в диапазоне: в 258-264 нет ни одного из: «Idempotency-Key»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:334 → frontend_vue/src/composables/useWarehouseBatch.ts:92-128 — нет токена в диапазоне: в 92-128 нет ни одного из: «BatchPatchPayload»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:335 → frontend_vue/src/types/warehouse.ts:190-204 — нет токена в диапазоне: в 190-204 нет ни одного из: «uomId», «marginPercent»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:452 → frontend_vue/src/services/mocks/warehouse.ts:1426-1431 — нет токена в диапазоне: в 1426-1431 нет ни одного из: «computeBatchStatus»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:769 → backend/app/modules/warehouse/shared/models.py:33-33 — нет токена в диапазоне: в 33-33 нет ни одного из: «unique»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:1056 → mocks/warehouse.ts:474-474 — нет токена в диапазоне: в 474-474 нет ни одного из: «projectStockRow»
  roo_code/plans/bugs/contract-sync-warehouse-bugs.md:1065 → mocks/warehouse.ts:1721-1721 — нет токена в диапазоне: в 1721-1721 нет ни одного из: «minStock»
roo_code/plans/bugs/contractrefs-bugs.md: ссылок 2, битых 1, глазами 0, без токена 1
  roo_code/plans/bugs/contractrefs-bugs.md:38 → -2.md:10-21 — нет файла: не нашёл -2.md
roo_code/plans/bugs/static-analysis-debt-bugs.md: ссылок 19, битых 2, глазами 2, без токена 15
  roo_code/plans/bugs/static-analysis-debt-bugs.md:146 → LoginPage.vue:161-161 — нет токена в диапазоне: в 161-161 нет ни одного из: «.js»
  roo_code/plans/bugs/static-analysis-debt-bugs.md:211 → cutting.ts:401-401 — нет токена в диапазоне: в 401-401 нет ни одного из: «round2», «netOf»
roo_code/plans/bugs/перетриаж-группы-В.md: ссылок 15, битых 5, глазами 0, без токена 8
  roo_code/plans/bugs/перетриаж-группы-В.md:60 → mocks/index.ts:451-451 — нет токена в диапазоне: в 451-451 нет ни одного из: «page», «items»
  roo_code/plans/bugs/перетриаж-группы-В.md:63 → me/domain.py:22-24 — нет токена в диапазоне: в 22-24 нет ни одного из: «UserInfo», «secret_link», «MeResponse»
  roo_code/plans/bugs/перетриаж-группы-В.md:67 → mocks/bcc.ts:7-118 — нет токена в диапазоне: в 7-118 нет ни одного из: «bcc_categories»
  roo_code/plans/bugs/перетриаж-группы-В.md:80 → core/uploads/action.py:143-146 — вне границ: в backend/app/core/uploads/action.py 111 строк, ссылка на 143-146
  roo_code/plans/bugs/перетриаж-группы-В.md:198 → mocks/services.ts:168-173 — нет токена в диапазоне: в 168-173 нет ни одного из: «mockDeleteService», «splice», «SERVICE_IN_USE»
[ссылки] документов 68 · ссылок 15314 · битых 998
 ✓ src/services/contractRefs.spec.ts (11 tests) 347ms
     ✓ отчёт по каждому документу; экстрактор обязан что-то находить  314ms
 ✓ src/services/mocks/settings-refusals.spec.ts (14 tests) 633ms
     ✓ читает тело: смена меняет принимаемый текущий пароль  603ms
 ✓ src/services/mocks/category-fields-keep-locales.spec.ts (5 tests) 492ms
     ✓ правка имени поля в одной локали оставляет две другие прежними  438ms
 ✓ src/services/mocks/finance-receivables.spec.ts (22 tests) 142ms
 ✓ src/services/custom-fields-conformance.spec.ts (14 tests) 119ms
 ✓ src/services/authToken.spec.ts (34 tests) 3360ms
     ✓ крючок выключен — неподписанный запрос проходит, демо не сломано  1554ms
     ✓ крючок включён, токен есть — запрос проходит  413ms
     ✓ годный Bearer с непустым токеном проходит  416ms
 ✓ src/services/mocks/auditFeed.spec.ts (15 tests) 86ms
 ✓ src/domain/orderPricing.spec.ts (122 tests) 73ms
 ✓ src/views/admin/finance/OutgoingPaymentCardPage.save.spec.ts (2 tests) 103ms
 ✓ src/composables/apiErrorCode.consumers.spec.ts (12 tests) 96ms
[права] разделов 0 из 17 · элементов 0 · эндпоинтов покрыто 0 из 176
 ✓ src/services/rights-contract-conformance.spec.ts (27 tests | 1 skipped) 46ms
 ✓ src/services/mocks/offcut-order-pick.spec.ts (25 tests) 81ms
 ✓ src/services/mocks/config-store-is-a-server.spec.ts (11 tests) 81ms
 ✓ src/composables/useNotifications.dropdown.spec.ts (3 tests) 68ms
 ✓ src/components/admin/ui/DropZone.spec.ts (3 tests) 51ms
 ✓ src/services/orderLineEdits.spec.ts (46 tests) 61ms
 ✓ src/services/tenant-not-sent.spec.ts (5 tests) 51ms
 ✓ src/composables/useOrderCard.spec.ts (13 tests) 44ms
 ✓ src/composables/warehouse-refusals-are-translated.spec.ts (17 tests) 67ms
 ✓ src/services/mocks/auditClock.spec.ts (17 tests) 47ms
 ✓ src/composables/useOrderCard.review.spec.ts (9 tests) 54ms
 ✓ src/services/apiQuery.spec.ts (6 tests) 60ms
stdout | src/composables/useSettings.saveErrors.spec.ts > С4 · единицы и валюты: отказ приходит кодом, а показывается фразой > UOM_IN_USE — занятая единица не удаляется
[useSettings] resetState() — clearing all cached data
[useSettings] load() called — always fetching from API
[useSettings] USE_MOCKS = true

stdout | src/composables/useSettings.saveErrors.spec.ts > С4 · единицы и валюты: отказ приходит кодом, а показывается фразой > CURRENCY_IN_USE — на валюту ссылаются товары
[useSettings] resetState() — clearing all cached data
[useSettings] load() called — always fetching from API
[useSettings] USE_MOCKS = true

stdout | src/composables/useSettings.saveErrors.spec.ts > С4 · единицы и валюты: отказ приходит кодом, а показывается фразой > CURRENCY_IS_DEFAULT — валюту по умолчанию удалить нельзя
[useSettings] resetState() — clearing all cached data
[useSettings] load() called — always fetching from API
[useSettings] USE_MOCKS = true

stdout | src/composables/useSettings.saveErrors.spec.ts > С5 · тела запросов: отказ приходит кодом, а показывается фразой > CONVERSION_PAIR_TAKEN — правило для пары уже есть
[useSettings] resetState() — clearing all cached data

stdout | src/composables/useSettings.saveErrors.spec.ts > С5 · тела запросов: отказ приходит кодом, а показывается фразой > ORDER_STATUS_REORDER_INCOMPLETE — список статусов разъехался
[useSettings] resetState() — clearing all cached data
[useSettings] load() called — always fetching from API
[useSettings] USE_MOCKS = true

stdout | src/composables/useSettings.saveErrors.spec.ts > С15 · границы финансовых констант: отказ приходит кодом, а показывается фразой > CONSTANT_OUT_OF_RANGE — значение вне диапазона
[useSettings] resetState() — clearing all cached data

 ✓ src/composables/useSettings.saveErrors.spec.ts (6 tests) 52ms
 ✓ src/services/mocks/cutting.spec.ts (29 tests) 43ms
 ✓ src/composables/useClientCard.spec.ts (8 tests) 27ms
 ✓ src/services/mocks/notification-triggers.spec.ts (17 tests) 31ms
 ✓ src/services/mocks/warehouse-product-reference.spec.ts (7 tests) 28ms
 ✓ src/domain/countries.spec.ts (13 tests) 31ms
 ✓ src/services/webFontSource.spec.ts (3 tests) 33ms
 ✓ src/composables/audit-feed-refusals.spec.ts (5 tests) 31ms
 ✓ src/services/apiErrorCode.guard.spec.ts (94 tests) 59ms
 ✓ src/composables/useOrderCreate.spec.ts (12 tests) 27ms
 ✓ src/composables/useFontRemeasure.spec.ts (5 tests) 25ms
stderr | src/composables/useAuditValueLabel.spec.ts > useAuditValueLabel — поведение > значение из набора без перевода — возвращается как есть
[intlify] Not found 'warehouse.status_used' key in 'en' locale messages.

 ✓ src/composables/useAuditValueLabel.spec.ts (4 tests) 28ms
 ✓ src/services/mocks/warehouse-transfer-location.spec.ts (14 tests) 23ms
 ✓ src/domain/offcutWeight.spec.ts (12 tests) 23ms
 ✓ src/services/mocks/audit-entry-identity.spec.ts (9 tests) 31ms
 ✓ src/domain/cutting.spec.ts (46 tests) 38ms
 ✓ src/domain/receivable.spec.ts (23 tests) 23ms
 ✓ src/components/admin/ui/AutoResizeTextarea.spec.ts (2 tests) 27ms
 ✓ src/composables/category-card-refusals.spec.ts (3 tests) 26ms
 ✓ src/services/mocks/no-bare-error-in-mocks.spec.ts (19 tests) 20ms
 ✓ src/domain/weightPerUnitCrossCheck.spec.ts (1 test) 19ms
 ✓ src/services/contractAudit.spec.ts (4 tests | 1 skipped) 16ms
 ✓ src/services/mocks/audit-writers.spec.ts (10 tests) 16ms
[контракт] сведено доменов: 17 · описано эндпоинтов: 175 из 175 · спроектировано впрок: 1
 ✓ src/services/contract-conformance.spec.ts (12 tests) 15ms
 ✓ src/services/mocks/orders-refusals.spec.ts (11 tests) 18ms
 ✓ src/services/orderLines.spec.ts (22 tests) 15ms
 ✓ src/i18n/localeParity.spec.ts (3 tests) 15ms
 ✓ src/domain/servicePricing.spec.ts (10 tests) 10ms
 ✓ src/services/mocks/unknown-id-is-refused.spec.ts (11 tests) 16ms
 ✓ src/services/mocks/products-suppliers-refusals.spec.ts (7 tests) 9ms
 ✓ src/composables/notifications-refusals-are-translated.spec.ts (5 tests) 15ms
 ✓ src/services/expectBudget.spec.ts (4 tests) 10ms
 ✓ src/services/expectBudgetSuppliers.spec.ts (6 tests) 8ms
 ✓ src/services/expectBudgetClients.spec.ts (7 tests) 8ms
 ✓ src/services/mocks/bcc-history-rows.spec.ts (8 tests) 11ms
 ✓ src/domain/uom.spec.ts (13 tests) 11ms
 ✓ src/domain/bccEmail.spec.ts (12 tests) 10ms
 ✓ src/services/mocks/clients-refusals.spec.ts (14 tests) 9ms
 ✓ src/services/mocks/bcc-envelope.spec.ts (5 tests) 9ms
 ✓ src/services/mocks/orderRoutes.spec.ts (4 tests) 8766ms
     ✓ carry a line through the whole flow  6341ms
     ✓ carry the date range through the router  608ms
     ✓ patch a service line through its own route, not the items one  906ms
     ✓ keep the order patch route honest about derived numbers  907ms
 ✓ src/domain/paymentTerms.spec.ts (9 tests) 7ms
 ✓ src/services/mocks/mail-settings.spec.ts (8 tests) 9ms
 ✓ src/services/apiErrorCode.spec.ts (11 tests) 9ms
 ✓ src/services/expectBudgetFollowups.spec.ts (7 tests) 9ms
 ✓ src/services/mocks/services-refusals.spec.ts (5 tests) 7ms
 ✓ src/services/expectBudgetWarehouse.spec.ts (6 tests) 8ms
 ✓ src/services/expectBudgetGoto.spec.ts (7 tests) 8ms
 ✓ src/services/mocks/warehouse-map.spec.ts (7 tests) 8ms
 ✓ src/domain/product.spec.ts (7 tests) 6ms
 ✓ src/services/snapshotBudget.spec.ts (4 tests) 8ms
 ✓ src/services/notification-type-catalogue.spec.ts (3 tests) 7ms
 ✓ src/services/mocks/categories-refusals.spec.ts (3 tests) 6ms
 ✓ src/types/conversionFormula.spec.ts (5 tests) 12ms
 ✓ src/services/expectUrlBudget.spec.ts (3 tests) 8ms
 ✓ src/types/mailConfigured.spec.ts (5 tests) 9ms
 ✓ src/services/mocks/bcc-refusals.spec.ts (3 tests) 5ms
 ✓ src/services/contractReadme.spec.ts (3 tests | 1 skipped) 7ms
 ✓ src/services/expectPollBudget.spec.ts (2 tests) 4ms
 ✓ src/services/mocks/config-notifications-finance-refusals.spec.ts (8 tests) 6ms
 ✓ src/services/mocks/idempotency-scope.spec.ts (11 tests) 11773ms
     ✓ the same key on two different paths runs both operations  606ms
     ✓ the same key on the same path does not repeat the operation  603ms
     ✓ an entry older than 24h is not reused — the operation runs again  904ms
     ✓ the same key on the same order path does not repeat a shipment  1811ms
     ✓ the same key on two different orders is two different operations — the id is part of the path  1813ms
     ✓ the same key on the same order path does not repeat a shipment cancellation  1808ms
     ✓ the same key on accept-response does not add a second row to the event feed  602ms
     ✓ the same key on no-response does not add a second row to the event feed  601ms
       ✓ cancelOrderShipment  1813ms
       ✓ acceptBccResponse  603ms
       ✓ markBccNoResponse  603ms
 ✓ src/services/ordersService.spec.ts (1 test) 14924ms
     ✓ walks the whole surface without a single unmatched route  14922ms

 Test Files  86 passed (86)
      Tests  1263 passed | 3 skipped (1266)
   Start at  09:32:33
   Duration  15.82s (transform 9.04s, setup 0ms, import 21.45s, tests 45.54s, environment 5.17s)


`````

## Приложение B. Числового потолка в трёх спеках нет

Команда:

    cd frontend_vue && grep -nE "timeout:[[:space:]]*[0-9]" tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts > "$TMPDIR/numeric.log" 2>&1; cat "$TMPDIR/numeric.log"

Вывод и код возврата целиком:

`````
GREP_EXIT=1
`````
