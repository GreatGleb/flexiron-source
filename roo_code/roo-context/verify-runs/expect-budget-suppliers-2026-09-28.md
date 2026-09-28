# Бюджет ожиданий каталога поставщиков — замер и прогон

Задача `expect-budget-after-action-suppliers-specs`. Замеры и прогоны — 2026-09-28. Собственных
ссылок вида `путь:номер` здесь нет: имя файла и номер пишутся отдельными словами. Координаты с
двоеточием внутри вывода ниже — дословный вывод инструментов (Playwright и витэста), а не ссылки
журнала.

## Что сделано

Пять спеков каталога поставщиков прошли разбор на класс «утверждение, стоящее НЕПОСРЕДСТВЕННО
после действия на странице и не отделённое от него ни `openAdminPage`, ни `openAdminCard`, ни
`waitForDataReady`». Найдено семь таких утверждений в четырёх файлах:

| файл                                                                  | тронутых утверждений |
| --------------------------------------------------------------------- | -------------------- |
| `frontend_vue/tests/e2e/admin/suppliers/supplier-card.spec.ts`        | 2                    |
| `frontend_vue/tests/e2e/admin/suppliers/supplier-card-config.spec.ts` | 3                    |
| `frontend_vue/tests/e2e/admin/suppliers/supplier-create.spec.ts`      | 1                    |
| `frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts`          | 1                    |
| `frontend_vue/tests/e2e/admin/suppliers/suppliers-list.spec.ts`       | 0                    |

Список не тронут: в нём после действий нет утверждений без бюджета — все 19 вызовов `toHaveURL`
закрыты отдельной задачей 2026-09-26 и стерегутся `expectUrlBudget.spec.ts`, а прочие
утверждения разделены открывалкой `openAdminPage`.

**Действием признан `navigateToAdmin`.** Он зовёт внутри `waitForDataReady`, но назван действием и
в задаче, и в плане, и в сторожe каталога склада, — проверяется записанное, а не подразумеваемое.
Поэтому у пяти открывалок каталога бюджет теперь стоит.

Правка состоит из ВТОРОГО АРГУМЕНТА и только его: `{ timeout: DATA_READY_TIMEOUT }`. Селекторы,
ожидаемые значения, регулярные выражения, `not.` и `.soft` не менялись. Импорт не добавлялся ни в
один файл: `DATA_READY_TIMEOUT` уже был импортирован из `../../helpers/ready` во всех пяти спеках,
и второго экземпляра самого числа в каталоге нет.

- `loadCard` — видимость содержимого карточки после `navigateToAdmin`;
- `dirty + save flow` — `not.toHaveClass(/\bloading\b/)` после `save.click()`;
- `loadConfig` — видимость заголовка после `navigateToAdmin`;
- `sections editor` — `not.toHaveClass(/\bcollapsed\b/)` после клика по сворачиванию;
- `permissions matrix` — `not.toBeChecked()` после клика по чекбоксу права пользователя;
- `loadCreate` — видимость содержимого страницы создания после `navigateToAdmin`;
- `bccHistory flag OFF` — видимость заголовка после `navigateToAdmin`.

Больше ничего не трогалось: `expect.poll(...)` и их числовые опции — на месте, файлы
`frontend_vue/tests/e2e/helpers/` — не изменялись, `frontend_vue/playwright.config.ts` — не
изменялся, эталоны снимков и `SNAPSHOT_OPTIONS` — не изменялись.

## Сторож

`frontend_vue/src/services/expectBudgetSuppliers.spec.ts` — витэст, окружение `node`, по образцу
`expectBudgetWarehouse.spec.ts`. Держит ровно пять файлов каталога и утверждает: разбор читает все
пять спеков и находит больше двухсот утверждений; класс «сразу после действия» не пуст; каждое
утверждение этого класса несёт опцию ожидания; опция взята из `DATA_READY_TIMEOUT`, а не записана
числом; `DATA_READY_TIMEOUT` приходит импортом из помощника `ready`.

Порог класса выставлен по факту: `toBeGreaterThanOrEqual(7)` — ровно столько утверждений в каталоге
и есть. Выше он быть не может, ниже — значило бы, что разбор потерял файл.

Два разбора в стороже сделаны намеренно узко. Вызов собирается целиком, вместе с переносами и
цепочкой (`.not.`, `.toHaveText(...)`) — иначе многострочный `expect` читался бы как «без опции».
`expect.poll(...)` из разбора исключён: у него свой предмет и свои опции, и требовать поверх них
второй бюджет было бы второй правкой того же места.

## Мутационная проверка сторожа

Сторож доказывается не зелёным прогоном, а красным на сломанном: зелёным он был и до правки.

### Мутация первая: снят второй аргумент целиком

Утверждение про чекбокс права пользователя в `supplier-card-config.spec.ts` — то самое, что стоит
после клика, — лишено второго аргумента.

Команда:

```
cd frontend_vue && npx vitest run src/services/expectBudgetSuppliers.spec.ts
```

Код возврата: 1. Значимая часть вывода:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-1/wt-expect-budget-after-action-suppliers-specs/frontend_vue

 ❯ src/services/expectBudgetSuppliers.spec.ts (6 tests | 1 failed) 11ms
     × каждое утверждение после действия несёт опцию ожидания 6ms

⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudgetSuppliers.spec.ts > бюджет ожидания у утверждений каталога поставщиков > каждое утверждение после действия несёт опцию ожидания
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/suppliers/supplier-card-config.spec.ts:647",
+ ]

 ❯ src/services/expectBudgetSuppliers.spec.ts:132:23
    130|       .filter((a) => !a.text.includes('timeout:'))
    131|       .map((a) => `${a.rel}:${a.line}`)
    132|       expect(offenders).toEqual([])
       |                       ^
    133|   })
    134|

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
   Start at  07:38:05
   Duration  226ms (transform 41ms, setup 0ms, import 66ms, tests 11ms, environment 0ms)

exit=1
```

Нарушитель назван этим самым файлом и строкой внутри него — то есть сторож не «что-то роняет», а
указывает, кого чинить. Второй аргумент возвращён, сторож снова зелёный (прогон ниже).

### Мутация вторая: бюджет записан числом

Утверждение про сворачивание секции в том же файле получило `{ timeout: 30000 }` вместо импорта —
то же самое число, но копией.

Команда:

```
cd frontend_vue && npx vitest run src/services/expectBudgetSuppliers.spec.ts
```

Код возврата: 1. Вывод:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-1/wt-expect-budget-after-action-suppliers-specs/frontend_vue

 ❯ src/services/expectBudgetSuppliers.spec.ts (6 tests | 2 failed) 12ms
     × опция взята из DATA_READY_TIMEOUT, а не записана числом 6ms
     × числового потолка в этих спеках не осталось 1ms

⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudgetSuppliers.spec.ts > бюджет ожидания у утверждений каталога поставщиков > опция взята из DATA_READY_TIMEOUT, а не записана числом
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/suppliers/supplier-card-config.spec.ts:254",
+ ]

 ❯ src/services/expectBudgetSuppliers.spec.ts:139:23
    137|       .filter((a) => /timeout:\s*\d/.test(a.text))
    138|       .map((a) => `${a.rel}:${a.line}`)
    139|       expect(offenders).toEqual([])
       |                       ^
    140|   })
    141|
```

Два утверждения покраснели — и «опция записана числом», и «числового потолка не осталось»: второе
проверяет весь каталог, а не только класс после действия, поэтому числовой потолок ловится даже
там, где действие перед утверждением не стояло. Обе половины правила оказались проверяемыми.

### Сторож зелёный после обоих возвратов

Команда:

```
cd frontend_vue && npx vitest run src/services/expectBudgetSuppliers.spec.ts src/services/snapshotBudget.spec.ts src/services/expectUrlBudget.spec.ts src/services/expectBudget.spec.ts src/services/expectPollBudget.spec.ts
```

Код возврата: 0. Вывод:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0719/run-1/wt-expect-budget-after-action-suppliers-specs/frontend_vue


 Test Files  5 passed (5)
      Tests  19 passed (19)
   Start at  07:38:13
   Duration  251ms (transform 285ms, setup 0ms, import 448ms, tests 33ms, environment 2ms)

exit=0
```

Пять сторожей шли одним прогоном: новый поставщицкий, снимков, `toHaveURL`, товарный и опросный.
Сторож `snapshotBudget.spec.ts` заодно подтверждает запрет: глобальный `expect.timeout` в
`playwright.config.ts` не поднят.

## Замер вместо инверсии

Нагрузку не создавали: машина общая, команды `yes`, `stress`, `pkill`, `killall` в этой задаче
запрещены. Вместо инверсии — замер фактического времени одного тронутого перехода вместе со
следующим за ним утверждением.

Инструментировано место `collapse button toggles .collapsed on the section card` в
`frontend_vue/tests/e2e/admin/suppliers/supplier-card-config.spec.ts`: `Date.now()` перед кликом по
кнопке сворачивания, `Date.now()` после утверждения с бюджетом, разница напечатана.
Инструментация снята до прогона пяти спеков — в кандидате её нет, проверено диффом (второй
аргумент вернулся, строки `console.log` нет).

Команда:

```
cd frontend_vue && npx playwright test tests/e2e/admin/suppliers/supplier-card-config.spec.ts -g "collapse button toggles" --reporter=line
```

Код возврата: 0. Вывод:

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:247:3 › supplier-card-config › sections editor › collapse button toggles .collapsed on the section card
[1/1] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:247:3 › supplier-card-config › sections editor › collapse button toggles .collapsed on the section card
[замер] клик → утверждение: 218 мс против 5000 мс

  1 passed (5.9s)
exit=0
```

## Вывод по замеру

218 мс против прежнего потолка 5000 мс — запас больше двадцатикратного. Переход здесь клиентский
(сворачивание секции перерисовывает класс, данных не ждёт), и покраснеть на пятисекундном потолке
он не может в принципе. То есть бюджет поставлен как **страховка на будущее**, а не как починка
наблюдаемой краноты: зелёным это место было бы и без правки.

Так же — и по остальным шести: все они стоят не после запроса данных, а после локальной реакции
интерфейса (видимость контейнера, класс кнопки, флаг чекбокса). Запас тонким не назвать ни у
одного, отдельной находки про подход к пяти секундам замер не дал. Число здесь важно другим: оно
делает правило единым для всего класса и оставляет его проверяемым машиной.

## Прогон пяти спеков

Команда:

```
cd frontend_vue && npx playwright test tests/e2e/admin/suppliers --reporter=line > "$TMPDIR/suppliers-run.txt" 2>&1; echo "exit=$?"
```

Код возврата: 0. Вывод сохранён в файл целиком (217 строк) и ниже приведён дословно, с одной
оговорённой изъятием: сняты непечатаемые управляющие ANSI-последовательности, которыми
`--reporter=line` перерисовывает строку прогресса. Имена тестов, их порядок, координаты и
итоговая строка — как их напечатал Playwright:

```
Running 213 tests using 4 workers

[1/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:124:3 › bcc-request › structure › title + action bar + content render
[2/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:139:3 › bcc-request › structure › action bar exposes the log split button + send button
[3/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:150:3 › bcc-request › sender › shows the sender configured in the mail settings
[4/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:130:3 › bcc-request › structure › all four panels render (categories / recipients / template / history)
[5/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:177:3 › bcc-request › products table › renders a full first page of product rows with group headers (default page size 10)
[6/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:187:3 › bcc-request › products table › clicking a product row toggles its checkbox and updates the selected count
[7/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:198:3 › bcc-request › products table › select-all toggles every visible product (14 mock fits on default 10-per-page → only the visible slice)
[8/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:212:3 › bcc-request › products table › product search filters by name (case-insensitive substring)
[9/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:229:3 › bcc-request › recipients picker › renders the mock recipients paged at 5 per page (6 total → 5 on page 1)
[10/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:235:3 › bcc-request › recipients picker › clicking a recipient checkbox toggles the selection and bumps the count
[11/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:246:3 › bcc-request › recipients picker › select-all picks every mock recipient (6); deselect-all clears the selection
[12/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:261:3 › bcc-request › recipients picker › recipient search filters by company name or email
[13/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:268:3 › bcc-request › recipients picker › selecting a product auto-flags category-matching suppliers (sup-001 Sheets/Pipes)
[14/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:289:3 › bcc-request › ?supplier= preselect › arriving with ?supplier=1 preselects Steel Plus OÜ and surfaces a toast
[15/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:307:3 › bcc-request › ?supplier= preselect › an unknown ?supplier= value degrades silently (no preselect, no toast)
[16/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:326:3 › bcc-request › email template › the subject names OUR company and the date, not a hardcoded third party
[17/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:336:3 › bcc-request › email template › the body is signed by the manager the app is logged in as
[18/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:348:3 › bcc-request › email template › selecting a product rebuilds the body to include its label
[19/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:355:3 › bcc-request › email template › uploading an attachment via the dropzone appends a FileItem
[20/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:383:3 › bcc-request › send flow › send with no products selected shows an error toast (select_product)
[21/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:390:3 › bcc-request › send flow › send with products but no recipients shows select_recipient error
[22/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:413:3 › bcc-request › send flow › send with empty subject shows enter_subject error (no send happens)
[23/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:423:3 › bcc-request › send flow › full send: products + recipients + subject → success toast + new history rows
[24/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:445:3 › bcc-request › send flow › after a successful send, the product selection resets to 0
[25/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:473:3 › bcc-request › log request › caret opens the source dropdown with every SOURCE_OPTIONS entry
[26/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:483:3 › bcc-request › log request › picking "Phone" from the dropdown logs rows with source=Phone
[27/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:505:3 › bcc-request › log request › log with no products shows an error toast
[28/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:521:3 › bcc-request › history table › seeds 7 mock events
[29/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:527:3 › bcc-request › history table › a "sent" row exposes both accept and cancel buttons
[30/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:535:3 › bcc-request › history table › a "responded" row exposes an edit button
[31/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:542:3 › bcc-request › history table › a "no_response" row exposes an accept button (retry) but no cancel
[32/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:552:3 › bcc-request › history table › cancel → prepends a no_response event; original row drops its buttons (no longer latest)
[33/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:585:3 › bcc-request › response modal › accept on a sent row opens the modal prefilled with the supplier name
[34/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:596:3 › bcc-request › response modal › edit on a responded row prefills price from the event
[35/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:604:3 › bcc-request › response modal › save with empty price surfaces an error toast (modal stays open)
[36/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:614:3 › bcc-request › response modal › cancel closes the modal without mutating history
[37/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:625:3 › bcc-request › response modal › save with a valid price closes the modal, toasts success, and prepends a responded event
[38/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:646:3 › bcc-request › response modal › unit trigger opens a dropdown and picks the chosen unit
[39/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:661:1 › bcc-request › bccHistory flag OFF hides the history panel (page still works)
[40/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:687:1 › bcc-request › redirects to /404 when bccRequest flag is OFF
[41/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:710:3 › bcc-request › visual @1440 › action bar
[42/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:717:3 › bcc-request › visual @1440 › categories panel
[43/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:724:3 › bcc-request › visual @1440 › recipients panel
[44/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:731:3 › bcc-request › visual @1440 › email template panel
[45/213] [chromium] › tests/e2e/admin/suppliers/bcc-request.spec.ts:738:3 › bcc-request › visual @1440 › history panel
[46/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:120:3 › supplier-card-config › structure › title + action bar + grid + permissions panel render
[47/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:129:3 › supplier-card-config › structure › save button is enabled by default (config page has no dirty-check gating)
[48/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:144:3 › supplier-card-config › field library › renders 12 mock field-library items
[49/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:152:3 › supplier-card-config › field library › search filters the list by name (case-insensitive substring)
[50/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:161:3 › supplier-card-config › field library › clearing the search restores the full list
[51/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:172:3 › supplier-card-config › field library › system fields in the library expose NO delete button (only custom fields are deletable)
[52/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:183:3 › supplier-card-config › field library › creating a new library field via the modal appends a custom item with a delete button
[53/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:206:3 › supplier-card-config › field library › creating with a blank name surfaces an error toast and does NOT append
[54/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:229:3 › supplier-card-config › sections editor › renders 5 mock sections in the builder
[55/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:237:3 › supplier-card-config › sections editor › General Info section renders its name + 4-field count from the mock
[56/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:247:3 › supplier-card-config › sections editor › collapse button toggles .collapsed on the section card
[57/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:257:3 › supplier-card-config › sections editor › hide button toggles .is-hidden on the section card
[58/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:264:3 › supplier-card-config › sections editor › system section delete button is disabled (all 5 mock sections are system=true)
[59/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:276:3 › supplier-card-config › sections editor › section field slot renders the section fields as field-library-items
[60/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:295:3 › supplier-card-config › section CRUD › add section → modal → fill name → create → new section appears
[61/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:312:3 › supplier-card-config › section CRUD › add section with blank name surfaces error toast and does NOT append
[62/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:324:3 › supplier-card-config › section CRUD › rename section → modal opens prefilled → save → name updates
[63/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:338:3 › supplier-card-config › section CRUD › user-added sections are deletable → confirm modal removes the section
[64/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:362:3 › supplier-card-config › section CRUD › cancelling the delete-section modal leaves the section intact
[65/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:387:3 › supplier-card-config › section fields CRUD › add field to section → modal → fill name → add → field appears in section AND library
[66/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:414:3 › supplier-card-config › section fields CRUD › removing a custom field from a section asks for confirm → only section reference goes
[67/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:445:3 › supplier-card-config › section fields CRUD › delete custom field from the library removes it from every section
[68/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:481:3 › supplier-card-config › drag-reorder sections › dragging sec-general onto sec-location reorders the list (moveSection)
[69/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:547:3 › supplier-card-config › permissions matrix › renders 17 rows (5 section rows + 12 field rows)
[70/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:553:3 › supplier-card-config › permissions matrix › renders a role cell per role on every row (4 cells × 17 rows)
[71/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:561:3 › supplier-card-config › permissions matrix › Admin row defaults to all-checked; Sales row defaults to all-unchecked (per mock)
[72/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:583:3 › supplier-card-config › permissions matrix › Rule 1 cascade: toggling Sales.read on sec-general propagates to ALL its field rows
[73/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:610:3 › supplier-card-config › permissions matrix › expand button reveals a user sub-row per role user
[74/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:628:3 › supplier-card-config › permissions matrix › toggling a user checkbox creates a per-user override (Rule 5)
[75/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:669:3 › supplier-card-config › save › clicking Save triggers saveConfig() and shows a success toast
[76/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:676:3 › supplier-card-config › save › edits survive an in-SPA navigation away and back (module state persists)
[77/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:712:1 › supplier-card-config › redirects to /404 when supplierCardConfig flag is OFF
[78/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:729:1 › supplier-card-config › permissionsEditor flag OFF hides the matrix (library/builder still render)
[79/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:762:3 › supplier-card-config › visual @1440 › action bar
[80/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:769:3 › supplier-card-config › visual @1440 › global field library
[81/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:776:3 › supplier-card-config › visual @1440 › section builder
[82/213] [chromium] › tests/e2e/admin/suppliers/supplier-card-config.spec.ts:783:3 › supplier-card-config › visual @1440 › permissions matrix
[83/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:121:3 › supplier-card › structure › title visible
[84/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:125:3 › supplier-card › structure › action bar + content render once supplier loads
[85/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:130:3 › supplier-card › structure › all eight panels render (status / requisites / contact / procurement / notes / pricing / files / audit)
[86/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:152:3 › supplier-card › action bar › bcc + config links go to the correct routes (with supplier query for bcc)
[87/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:163:3 › supplier-card › action bar › save button is initially disabled and not dirty
[88/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:178:3 › supplier-card › status section › all status sub-fields render
[89/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:185:3 › supplier-card › status section › status select displays the active pill (mock id=1 → status="active")
[90/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:192:3 › supplier-card › status section › status reason textarea is pre-populated from the mock
[91/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:204:3 › supplier-card › requisites section › company / vat / address all carry mock values
[92/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:218:3 › supplier-card › contact section › contact name / email / phone are pre-populated from the mock
[93/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:239:3 › supplier-card › procurement section › all procurement sub-fields render
[94/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:248:3 › supplier-card › procurement section › categories / bcc-emails render the mock chips
[95/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:257:3 › supplier-card › procurement section › currency / payment / lead-time / min-order carry mock values
[96/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:278:3 › supplier-card › notes section › input + add button render
[97/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:283:3 › supplier-card › notes section › typing a note + clicking "add" appends it as a NoteItem
[98/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:298:3 › supplier-card › notes section › add button is a no-op when the textarea is blank
[99/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:307:3 › supplier-card › notes section › adding a note marks the form dirty (Save becomes enabled)
[100/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:324:3 › supplier-card › pricing history › renders 4 mock price rows
[101/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:330:3 › supplier-card › pricing history › table head exposes 7 columns (date / product / stock / price / unit / source / status)
[102/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:338:3 › supplier-card › pricing history › first row carries the expected mock values (Sheet 10mm / 1.05 / replied)
[103/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:348:3 › supplier-card › pricing history › a row whose price is null renders an em-dash
[104/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:362:3 › supplier-card › files section › renders 2 mock file items + dropzone
[105/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:369:3 › supplier-card › files section › clicking a file’s delete icon removes it from the list
[106/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:381:3 › supplier-card › files section › upload via the hidden file input appends a new FileItem
[107/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:410:3 › supplier-card › audit log › renders 2 mock audit entries
[108/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:414:3 › supplier-card › audit log › audit table head has 5 columns (timestamp / user / prop / diff / action)
[109/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:420:3 › supplier-card › audit log › first row holds the most-recent entry (Payment Terms diff)
[110/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:427:3 › supplier-card › audit log › clicking a delete icon opens the confirm modal (does NOT delete yet)
[111/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:437:3 › supplier-card › audit log › cancelling the modal closes it and leaves the audit log untouched
[112/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:448:3 › supplier-card › audit log › confirming the modal removes at least one entry, closes the modal, and shows a toast
[113/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:474:3 › supplier-card › dirty + save flow › editing the company input flips Save from disabled → enabled (.dirty)
[114/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:484:3 › supplier-card › dirty + save flow › clearing the edit back to the original value flips Save back to disabled (clean)
[115/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:496:3 › supplier-card › dirty + save flow › clicking Save commits the change, clears dirty, and toasts a success message
[116/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:513:3 › supplier-card › dirty + save flow › a follow-up edit after Save re-enables Save (snapshot was re-captured)
[117/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:536:1 › supplier-card › redirects to /404 when supplierCard flag is OFF
[118/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:559:3 › supplier-card › visual @1440 › action bar
[119/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:566:3 › supplier-card › visual @1440 › status section
[120/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:573:3 › supplier-card › visual @1440 › requisites section
[121/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:580:3 › supplier-card › visual @1440 › contact section
[122/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:587:3 › supplier-card › visual @1440 › procurement section
[123/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:594:3 › supplier-card › visual @1440 › notes section
[124/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:601:3 › supplier-card › visual @1440 › pricing panel
[125/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:608:3 › supplier-card › visual @1440 › files panel
[126/213] [chromium] › tests/e2e/admin/suppliers/supplier-card.spec.ts:615:3 › supplier-card › visual @1440 › audit panel
[127/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:97:3 › supplier-create › structure › title + action bar + content render
[128/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:103:3 › supplier-create › structure › all five form sections render (status / requisites / contact / procurement / notes)
[129/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:113:3 › supplier-create › structure › right-column panels (pricing / files / audit) are NOT rendered on the create page
[130/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:130:3 › supplier-create › action bar › cancel + save buttons render and are enabled
[131/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:139:3 › supplier-create › action bar › save button is hard-coded .dirty (unlike SupplierCard it does not depend on diff)
[132/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:155:3 › supplier-create › default values › status defaults to "new" (pill-mint)
[133/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:162:3 › supplier-create › default values › currency defaults to EUR and payment defaults to "30 Days Net"
[134/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:171:3 › supplier-create › default values › company / vat / contact-name / email / phone inputs are all empty
[135/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:179:3 › supplier-create › default values › categories + bcc-emails chip containers render with zero chips
[136/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:184:3 › supplier-create › default values › rating defaults to 0 (RatingSelect renders the "any rating" placeholder)
[137/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:193:3 › supplier-create › default values › address block renders with a single empty Legal address (emptyCard default)
[138/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:209:3 › supplier-create › validation › empty form → clicking Save shows the company-required error toast and stays on /new
[139/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:222:3 › supplier-create › validation › company filled but email missing → email-required error toast
[140/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:233:3 › supplier-create › validation › email filled but company blank → still company-required (validated first)
[141/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:247:3 › supplier-create › validation › whitespace-only company is treated as empty (validate() uses .trim())
[142/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:269:3 › supplier-create › save happy-path › filling company + email then Save redirects to the new supplier card
[143/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:279:3 › supplier-create › save happy-path › success toast appears after a valid save
[144/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:294:3 › supplier-create › save happy-path › the newly created card renders the data that was submitted
[145/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:312:3 › supplier-create › save happy-path › the new supplier appears in the suppliers list (in-SPA back-navigation)
[146/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:345:3 › supplier-create › cancel › clicking Cancel returns to /admin/suppliers
[147/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:350:3 › supplier-create › cancel › Cancel does NOT create a supplier (list still has the original 6 rows)
[148/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:370:1 › supplier-create › redirects to /404 when supplierCreate flag is OFF
[149/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:393:3 › supplier-create › visual @1440 › action bar
[150/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:400:3 › supplier-create › visual @1440 › status section
[151/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:407:3 › supplier-create › visual @1440 › requisites section
[152/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:414:3 › supplier-create › visual @1440 › contact section
[153/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:421:3 › supplier-create › visual @1440 › procurement section
[154/213] [chromium] › tests/e2e/admin/suppliers/supplier-create.spec.ts:428:3 › supplier-create › visual @1440 › notes section
[155/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:79:3 › suppliers-list › structure › title visible
[156/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:83:3 › suppliers-list › structure › toolbar, filters, and table view all render
[157/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:89:3 › suppliers-list › structure › kanban view is rendered in DOM but hidden by default (table is initial view)
[158/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:97:3 › suppliers-list › structure › table is the initial active view
[159/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:111:3 › suppliers-list › toolbar › view tabs, export, bcc, new-supplier buttons all present
[160/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:118:3 › suppliers-list › toolbar › view-tabs exposes exactly two buttons (table/kanban)
[161/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:122:3 › suppliers-list › toolbar › first tab (table) is active by default
[162/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:128:3 › suppliers-list › toolbar › new-supplier button links to /admin/suppliers/new
[163/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:135:3 › suppliers-list › toolbar › bcc button links to /admin/suppliers/bcc-request
[164/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:142:3 › suppliers-list › toolbar › clicking new-supplier navigates to the create page
[165/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:157:3 › suppliers-list › table view › renders all 6 mock rows
[166/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:161:3 › suppliers-list › table view › table head renders 8 columns
[167/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:165:3 › suppliers-list › table view › company cell links to the supplier card
[168/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:175:3 › suppliers-list › table view › deficit indicator renders only on suppliers with hasDeficit=true
[169/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:181:3 › suppliers-list › table view › status pills are coloured per status
[170/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:190:3 › suppliers-list › table view › row action icons link to card and bcc-request with supplier id
[171/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:200:3 › suppliers-list › table view › clicking a row navigates to that supplier card
[172/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:221:3 › suppliers-list › search › typing "Steel" narrows to 2 rows (Steel Plus + Nordic Steel)
[173/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:229:3 › suppliers-list › search › typing "metal" (case-insensitive) narrows to 3 rows
[174/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:237:3 › suppliers-list › search › non-matching query yields the empty state instead of rows
[175/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:247:3 › suppliers-list › search › clearing the search restores all rows
[176/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:269:3 › suppliers-list › status filter › clicking a status opens the dropdown and shows 7 options (all + 6 statuses)
[177/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:280:3 › suppliers-list › status filter › selecting "active" narrows to 3 rows
[178/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:293:3 › suppliers-list › status filter › selecting "preferred" narrows to 1 row
[179/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:303:3 › suppliers-list › status filter › selecting "blocked" yields the empty state (0 mock rows with that status)
[180/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:324:3 › suppliers-list › category filter › renders 8 checkbox options (one per CATEGORY_KEY)
[181/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:332:3 › suppliers-list › category filter › checking first category (Sheets) narrows to 2 rows (Steel Plus + Nordic Steel)
[182/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:346:3 › suppliers-list › category filter › checking two categories uses OR semantics (union of matches)
[183/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:357:3 › suppliers-list › category filter › selected categories render as chips inside the trigger
[184/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:378:3 › suppliers-list › rating filter › renders 6 options (any + 5..1)
[185/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:386:3 › suppliers-list › rating filter › selecting 5-star narrows to 1 row (Steel Plus)
[186/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:395:3 › suppliers-list › rating filter › selecting 4-star narrows to 3 rows
[187/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:413:3 › suppliers-list › view switch › clicking the kanban tab shows the kanban view and hides the table
[188/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:423:3 › suppliers-list › view switch › clicking the kanban tab marks it active and un-marks the table tab
[189/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:430:3 › suppliers-list › view switch › clicking the table tab after kanban restores the table view
[190/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:459:3 › suppliers-list › kanban view › renders 6 columns (one per status)
[191/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:467:3 › suppliers-list › kanban view › active column holds 3 cards
[192/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:474:3 › suppliers-list › kanban view › preferred/new/under_review columns hold exactly 1 card each
[193/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:498:3 › suppliers-list › kanban view › suspended and blocked columns are empty
[194/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:515:3 › suppliers-list › kanban view › column header badge shows the card count
[195/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:523:3 › suppliers-list › kanban view › kanban cards are draggable
[196/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:528:3 › suppliers-list › kanban view › kanban card title links to the supplier card page
[197/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:548:3 › suppliers-list › pagination › pagination bar renders
[198/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:552:3 › suppliers-list › page-size selector renders (default pageSize=25)
[199/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:557:3 › suppliers-list › pagination › showing info reports "1-6 … 6" with the 6-row mock
[200/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:565:3 › suppliers-list › pagination › prev/next buttons are hidden for a single-page result (totalPages <= 1)
[201/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:574:3 › suppliers-list › page-size dropdown opens upward and lists three options (25/50/100)
[202/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:593:3 › suppliers-list › export › export button is visible when flag is ON
[203/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:597:3 › suppliers-list › export › clicking export triggers a CSV download named suppliers.csv
[204/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:615:3 › suppliers-list › save view › clicking save-view writes the current view + filters to localStorage
[205/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:625:3 › suppliers-list › save view › stored kanban view is restored on reload (flag ON)
[206/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:642:1 › suppliers-list › redirects to /404 when suppliersList flag is OFF
[207/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:660:1 › suppliers-list › hides view tabs and kanban view when supplierKanbanView is OFF
[208/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:676:1 › suppliers-list › forces table view when supplierKanbanView is OFF even if prefs say kanban
[209/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:696:1 › suppliers-list › hides export button when supplierExport is OFF
[210/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:722:3 › suppliers-list › visual @1440 › toolbar
[211/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:729:3 › suppliers-list › visual @1440 › filters bar
[212/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:736:3 › suppliers-list › visual @1440 › table panel
[213/213] [chromium] › tests/e2e/admin/suppliers/suppliers-list.spec.ts:743:3 › suppliers-list › visual @1440 › kanban board
 213 passed (3.6m)
```

Ни одной строки `failed`, `flaky` или `skipped` в выводе нет; вердикт снят по коду возврата (0) и
по последней строке `213 passed`, а не по одному числу `passed`. Вывод был сохранён в файл целиком
— конвейера `| tail` в команде нет, потому что он вернул бы код возврата `tail`, а строку
`N failed` Playwright печатает ВЫШЕ `N passed`.

## Форматирование

`format:check` входит в `npm run verify`, и красный формат бракует всю работу, поэтому prettier
гонялся по каждому тронутому файлу отдельно.

Команда:

```
cd frontend_vue && npx prettier --write tests/e2e/admin/suppliers/supplier-card.spec.ts tests/e2e/admin/suppliers/supplier-card-config.spec.ts tests/e2e/admin/suppliers/supplier-create.spec.ts tests/e2e/admin/suppliers/bcc-request.spec.ts tests/e2e/admin/suppliers/suppliers-list.spec.ts src/services/expectBudgetSuppliers.spec.ts
```

Код возврата: 0. Вывод:

```
tests/e2e/admin/suppliers/supplier-card.spec.ts 198ms (unchanged)
tests/e2e/admin/suppliers/supplier-card-config.spec.ts 112ms (unchanged)
tests/e2e/admin/suppliers/supplier-create.spec.ts 39ms (unchanged)
tests/e2e/admin/suppliers/bcc-request.spec.ts 84ms (unchanged)
tests/e2e/admin/suppliers/suppliers-list.spec.ts 79ms (unchanged)
src/services/expectBudgetSuppliers.spec.ts 20ms (unchanged)
```

Все шесть — `unchanged`: правка форматирование не задела. Отдельно проверен `supplier-card-config`
после возврата мутации числом — тоже `unchanged`.

## Проверка ссылок контрактов

Два документа контракта, попавшие в outputs, содержат ссылки на строки тронутых спеков. Проверено
резолвером, что моя правка счёт битых не увеличила.

Команды:

```
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/config.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/bcc.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Коды возврата: 0 и 0. Значимая часть выводов:

```
roo_code/roo-context/api/config.md: ссылок 387, битых 53, глазами 38, без токена 242
[ссылки] документов 1 · ссылок 387 · битых 53
```

```
roo_code/roo-context/api/bcc.md: ссылок 400, битых 24, глазами 37, без токена 274
[ссылки] документов 1 · ссылок 24 · битых 24
```

Ни в одном из двух списков битых ссылок нет записи, ведущей на `supplier-card-config.spec.ts` или
`bcc-request.spec.ts`: чужие старые битые ссылки не трогались, а моя правка по счёту битых не
добавила ни одной. Ссылки на дословно переехавшие строки правит контроллер.

## Чего НЕ делали

- Нагрузку не создавали: команды `yes`, `stress`, `pkill`, `killall` в этой задаче запрещены,
  машина общая. Поэтому вместо инверсии под нагрузкой — замер фактического времени (выше).
- `frontend_vue/playwright.config.ts` не тронут; сторож `snapshotBudget.spec.ts` зелёный и
  подтверждает, что глобальный `expect.timeout` в конфиге не поднят.
- Вызовы `expect.poll(...)` и их числовые опции не тронуты.
- Файлы `frontend_vue/tests/e2e/helpers/` не тронуты.
- `refs_shift.py` не запускался.
- `suppliers-list.spec.ts` не тронут: в нём нет утверждений класса «сразу после действия».
- Инструментация замера в `supplier-card-config.spec.ts` снята до прогона пяти спеков.

## Что гонялось, а что ожидает контроллера

Гонялось в песочнице исполнителя:

- `npm run test:unit` (сторож `expectBudgetSuppliers.spec.ts` в составе) — зелёный, код возврата
  0, 6 тестов; красный под обеими мутациями (коды возврата 1 и 1);
- `npx vitest run` по пяти сторожа́м одним прогоном — зелёный, код возврата 0, 19 тестов;
- `npx playwright test tests/e2e/admin/suppliers --reporter=line` — зелёный, код возврата 0,
  `213 passed`;
- `npx playwright test` инструментированного места — зелёный, код возврата 0, замер 218 мс;
- `CONTRACT_REFS` по `config.md` и `bcc.md` — зелёные, коды возврата 0 и 0;
- `npx prettier --write` по тронутым файлам и сторожу — зелёный, код возврата 0;
- греп числовых потолков по пяти спекам — пусто, код возврата 1.

Ожидает контроллера: `npm run verify` целиком — шаги `typecheck`, `lint` и `format:check` по всему
дереву в песочнице исполнителя не гонялись. `format:check` по СВОИМ файлам гонялся и зелёный, но
это не то же самое, что гейт по `src/` и `tests/`.

## Координаты внутри приведённых выводов

Числа после имени файла в разделах выше — не ссылки журнала, а дословный текст, напечатанный
Playwright и витэстом. Они сняты ПОСЛЕ правки спеков, поэтому перенумерации не подлежат: это
запись того, что инструмент сказал, а не указание, куда смотреть. Первая редакция этого журнала
восстанавливала блок вывода по частям, и координаты в нём разошлись с настоящими; блок переписан
из файла прогона целиком, и каждому номеру теперь соответствует тот тест, который рядом с ним
назван. Единственная правка блока — снятые ANSI-последовательности `--reporter=line`: без них
строки прогресса остаются тем, чем их напечатал Playwright.
