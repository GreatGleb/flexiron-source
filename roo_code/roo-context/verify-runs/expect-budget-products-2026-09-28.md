# Бюджет ожиданий каталога товаров — замер и прогон

Задача `expect-budget-after-action-products-specs`. Замеры и прогоны — 2026-09-28, рабочее
дерево `wt-expect-budget-after-action-products-specs`. Номера строк здесь не приводятся
намеренно: ссылок вида `путь:номер` в этом журнале нет, потому что их нечем охранять, а
строки съезжают от собственных правок.

## Что сделано

Три спека каталога товаров получили бюджет ожидания у утверждений, стоящих ПОСЛЕ действия на
странице (клик, заполнение поля), — там, где между действием и утверждением нет
`waitForDataReady`, `openAdminPage` или `openAdminCard`. Бюджет взят ИМПОРТОМ
(`DATA_READY_TIMEOUT`) из помощника `tests/e2e/helpers/ready.ts`; числовых потолков в этих
спеках не осталось, включая три прежних `{ timeout: 5000 }`.

Файлы правки:

- `frontend_vue/tests/e2e/admin/products/products.spec.ts`
- `frontend_vue/tests/e2e/admin/products/services.spec.ts`
- `frontend_vue/tests/e2e/admin/products/service-card.spec.ts`
- `frontend_vue/src/services/expectBudget.spec.ts` — сторож (новый файл)

Утверждения сразу после `openAdminPage` / `openAdminCard` / `waitForDataReady` бюджета не
получили: у них пол уже есть. Смысл утверждений не менялся — правка состоит из второго
аргумента и импорта. `playwright.config.ts` не тронут.

## Сторож

Сторож `frontend_vue/src/services/expectBudget.spec.ts` держит ровно эти три файла и
утверждает: разбор нашёл сами спеки и больше пятидесяти вхождений `await expect(`; числового
потолка (`timeout: <число>`) не осталось, нарушители печатаются файлом и номером строки;
`DATA_READY_TIMEOUT` приходит импортом из помощника `ready`.

Команда:

```
cd frontend_vue && npx vitest run src/services/expectBudget.spec.ts src/services/snapshotBudget.spec.ts
```

Код возврата: 0. Вывод:

```
 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0022/run-1/wt-expect-budget-after-action-products-specs/frontend_vue

 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  00:40:06
   Duration  182ms (transform 69ms, setup 0ms, import 102ms, tests 11ms, environment 1ms)
```

## Замер вместо инверсии

Нагрузку не создавали: машина общая, команды `yes`, `stress`, `pkill`, `killall` в этой задаче
запрещены. Вместо инверсии — замер фактического времени одного тронутого перехода.

Инструментировано место `opens modal on create button click` в
`frontend_vue/tests/e2e/admin/products/products.spec.ts`: `Date.now()` до клика по кнопке
создания товара, `Date.now()` после утверждения о видимости модалки, разница напечатана.
Инструментация снята до коммита — в дереве её нет.

Команда:

```
cd frontend_vue && npx playwright test tests/e2e/admin/products/products.spec.ts -g "opens modal on create button click" --reporter=line
```

Код возврата: 0. Вывод (координата рядом с именем файла снята по той же причине, что и в прогоне
трёх спеков ниже — ссылкам вида `путь:номер` в этом журнале места нет):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › opens modal on create button click
[1/1] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › opens modal on create button click
[замер] клик → утверждение: 566 мс против 5000 мс

  1 passed (5.6s)
```

## Вывод по замеру

566 мс против прежнего потолка 5000 мс — запас почти девятикратный, и переход укладывается в
дефолт с избытком. Значит на этом переходе бюджет поставлен как **страховка на будущее**, а НЕ
как починка наблюдаемой красноты: сегодняшний спек, скорее всего, зелёный и без него. Это
честный вывод, а не доказательство, что бюджет не нужен: замер снят без нагрузки, машина
общая, и потолок `expect` вместе с нагрузкой не растягивается — этим он и отличается от
потолка теста в 90 с.

## Мутационная проверка сторожа

Сторож доказывается не зелёным прогоном, а красным на сломанном: зелёным он был и до правки.

В `products.spec.ts` одному тронутому утверждению возвращён прежний вид с числом —
`not.toHaveCount(totalBefore, { timeout: 5000 })` у теста `search narrows results`.

Команда:

```
cd frontend_vue && npx vitest run src/services/expectBudget.spec.ts; echo "exit=$?"
```

Код возврата: 1 (красный — это и есть требуемый исход). Вывод, значимая часть:

```
 ❯ src/services/expectBudget.spec.ts (3 tests | 1 failed) 14ms
     × числового потолка в этих спеках не осталось 10ms

AssertionError: expected [ Array(1) ] to deeply equal []

- []
+ [
+   "tests/e2e/admin/products/products.spec.ts",
+ ]

 Test Files  1 failed (1)
      Tests  1 failed | 2 passed (3)
exit=1
```

Нарушитель назван этим самым файлом, и названа строка внутри него: вывод витэста привёл и имя
файла, и координату, то есть сторож не просто «что-то роняет», а указывает, кого чинить.
Координату цитата не воспроизводит — ссылкам вида `путь:номер` в этом журнале места нет, и
относилась она к МУТИРОВАННОЙ версии файла, а не к текущей: тем же самым файлом и той же самой
строкой витэст пометил подменённое число. После возврата `DATA_READY_TIMEOUT` сторож снова зелёный
(см. прогон выше: 2 файла, 7 тестов, exit 0), и числового потолка в каталоге не осталось —
`grep -rn "timeout: 5000\|timeout:5000" tests/e2e/admin/products/` вернул пусто.

## Прогон трёх спеков

Команда:

```
cd frontend_vue && npx playwright test tests/e2e/admin/products/products.spec.ts tests/e2e/admin/products/services.spec.ts tests/e2e/admin/products/service-card.spec.ts --reporter=line > "$TMPDIR/products-run.txt" 2>&1; echo "exit=$?"
```

Код возврата: 0. Вывод сохранён в файл целиком (77 строк), ниже он приведён дословно — с двумя
оговорёнными изъятиями. Сняты непечатаемые управляющие ANSI-последовательности, которыми
`--reporter=line` перерисовывает строку прогресса. И снята координата `:строка:колонка` рядом с
именем файла: в этом журнале ссылкам вида `путь:номер` места нет, а после правки эти координаты
устарели бы молча. Номера `[n/73]`, имена тестов, их порядок и итоговая строка — как их напечатал
Playwright:

```
Running 73 tests using 4 workers

[1/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › links to categories visible
[2/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › header visible
[3/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › page-products root div is visible
[4/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › create button visible
[5/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › filters panel visible
[6/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › search input visible
[7/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › category filter visible
[8/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › table renders with rows
[9/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › structure › pagination visible
[10/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › search › search narrows results
[11/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › search › no match shows empty state
[12/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › search › clearing search restores results
[13/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › opens modal on create button click
[14/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › Escape closes modal
[15/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › Cancel button closes modal
[16/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › submit with empty name stays open (validation)
[17/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › create modal › submit with valid data creates product and navigates to card
[18/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › delete › delete button opens confirm modal
[19/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › delete › cancel leaves row count unchanged
[20/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › delete › confirm deletes and reloads list
[21/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › delete › a product still used by orders is refused, not silently kept
[22/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products-list › navigation › row click navigates to /admin/products/:id
[23/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › page-product-card root visible
[24/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › header with breadcrumb visible
[25/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › save bar visible
[26/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › save button disabled initially
[27/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › info section visible
[28/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › price section visible
[29/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › dynamic fields section visible
[30/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › structure › suppliers section visible
[31/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › basic fields › name field visible and editable
[32/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › basic fields › SKU field visible and editable
[33/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › basic fields › description field visible and editable
[34/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › basic fields › min stock field visible and editable
[35/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dirty check › edit name → save button becomes enabled
[36/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dirty check › discard changes → save button becomes disabled again
[37/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dirty check › edit price → save enabled
[38/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dirty check › edit SKU → save enabled
[39/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › save lifecycle › edit → save → button becomes disabled (saved)
[40/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › save lifecycle › toast "Changes saved" appears
[41/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › suppliers section shows supplier list
[42/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › add supplier modal opens
[43/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › add supplier form has select, price, lead inputs
[44/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › confirm adds supplier to list
[45/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › added supplier keeps the unit as a dictionary id, not a composed label
[46/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › remove supplier modal opens
[47/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › suppliers › confirm removes supplier
[48/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dynamic fields › text field renders as <input type="text">
[49/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dynamic fields › number field renders as <input type="number">
[50/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dynamic fields › boolean field renders as checkbox
[51/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dynamic fields › enum field renders as CustomSelect
[52/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › dynamic fields › editing a field enables save button
[53/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products › i18n › switching language updates UI text
[54/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products › i18n › product card section titles change with language
[55/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products › visual @1440 › products list header visual @1440
[56/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products › visual @1440 › products list table visual @1440
[57/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › visual @1440 › product card header visual @1440
[58/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › visual @1440 › product card info section visual @1440
[59/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › visual @1440 › product card fields section visual @1440
[60/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › visual @1440 › product card suppliers section visual @1440
[61/73] [chromium] › tests/e2e/admin/products/products.spec.ts › products › redirects to /404 when adminProducts flag is OFF
[62/73] [chromium] › tests/e2e/admin/products/products.spec.ts › product-card › add supplier button hidden when productSupplierLinks is OFF
[63/73] [chromium] › tests/e2e/admin/products/service-card.spec.ts › Service card page › should display service card with header and breadcrumbs
[64/73] [chromium] › tests/e2e/admin/products/service-card.spec.ts › Service card page › should show service info panel
[65/73] [chromium] › tests/e2e/admin/products/service-card.spec.ts › Service card page › save button is disabled initially (no changes)
[66/73] [chromium] › tests/e2e/admin/products/service-card.spec.ts › Service card page › editing name enables save button
[67/73] [chromium] › tests/e2e/admin/products/service-card.spec.ts › Service card page › clicking discard after edit resets save button to disabled
[68/73] [chromium] › tests/e2e/admin/products/service-card.spec.ts › Service card page › breadcrumb navigates back to services list
[69/73] [chromium] › tests/e2e/admin/products/services.spec.ts › Services page › should display services page with header and table
[70/73] [chromium] › tests/e2e/admin/products/services.spec.ts › Services page › should show create modal on button click
[71/73] [chromium] › tests/e2e/admin/products/services.spec.ts › Services page › should show delete confirmation modal
[72/73] [chromium] › tests/e2e/admin/products/services.spec.ts › Services page › should navigate to service card on open button click
[73/73] [chromium] › tests/e2e/admin/products/services.spec.ts › Services page › should navigate back to products page via breadcrumb
  73 passed (1.8m)
```

Ни одной строки `failed`, `flaky` или `skipped` в выводе нет; вердикт снят по коду возврата
(0) и по последней строке `73 passed`, а не по одному числу `passed`. Вывод был сохранён в
файл целиком — конвейера `| tail` в команде нет, потому что он вернул бы код возврата
`tail`, а строку `N failed` Playwright печатает ВЫШЕ `N passed`.

## Чего НЕ делали

- Нагрузку не создавали: команды `yes`, `stress`, `pkill`, `killall` в этой задаче запрещены,
  машина общая. Поэтому вместо инверсии под нагрузкой — замер фактического времени (выше).
- `frontend_vue/playwright.config.ts` не тронут; сторож `snapshotBudget.spec.ts` зелёный и
  подтверждает, что глобальный `expect.timeout` в конфиге не поднят.
- `refs_shift.py` не запускался.
