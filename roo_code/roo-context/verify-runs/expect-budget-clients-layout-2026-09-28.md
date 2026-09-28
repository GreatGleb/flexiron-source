# Бюджет ожидания после действия: `clients.spec.ts` и `layout.spec.ts`

Задача `expect-budget-after-action-clients-and-layout`, 2026-09-28. Класс правки — второй
аргумент `{ timeout: DATA_READY_TIMEOUT }` у утверждений, стоящих в тесте сразу после
действия на странице. Общий корень и решение владельца — в плане сквозных потолков
ожиданий.

## Что тронуто

- `frontend_vue/tests/e2e/admin/clients/clients.spec.ts` — 50 бюджетов;
- `frontend_vue/tests/e2e/admin/layout.spec.ts` — 44 бюджета;
- `frontend_vue/src/services/expectBudgetClients.spec.ts` — новый сторож.

Число взято импортом из `DATA_READY_TIMEOUT` помощника `tests/e2e/helpers/ready.ts`;
числовых потолков `timeout: <цифра>` в обоих спеках не осталось.

## Замер времени ожидания

Условие плана: замер вместо инверсии, искусственную нагрузку не создавать. Измерена пара
`not.toHaveURL` после клика по `sidebar-nav-items` в `layout.spec.ts` — ожидание
инструментировано `Date.now()` вокруг каждого утверждения, прогон одного теста.

```
$ cd frontend_vue && npx playwright test tests/e2e/admin/layout.spec.ts -g "placeholder nav-links" --reporter=line

Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/layout.spec.ts:405:3 › admin layout › navigation › placeholder nav-links (items/warehouse/sales/finance) do not navigate away
[замер] not.toHaveURL items: 21 мс; warehouse: 17 мс
  1 passed (5.1s)
exit=0
```

**Число против потолка:** 21 мс и 17 мс против дефолтных 5000 мс — запас более чем
двухсоткратный. То есть бюджет поставлен **страховкой на будущее**, а не починкой
наблюдаемой красноты: эти утверждения сегодня зелёные и на дефолтном потолке. Вывод
сделан по числу из прогона, а не по попытке воспроизвести красное.

## Прогон затронутых спеков (уровень 1)

```
$ cd frontend_vue && npx playwright test tests/e2e/admin/layout.spec.ts tests/e2e/admin/clients/clients.spec.ts --reporter=line

Running 110 tests using 4 workers

[1/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:77:3 › clients-list › structure › new-client button links to /admin/clients/new
[2/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:67:3 › clients-list › structure › header, filters, and table panel all render
[3/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:63:3 › clients-list › structure › page root is visible
[4/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:73:3 › clients-list › structure › page title is visible
[5/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:94:3 › clients-list › table view › renders 25 mock rows on page 1
[6/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:98:3 › clients-list › table view › table head renders 8 columns
[7/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:102:3 › clients-list › table view › first row company cell links to client card
[8/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:112:3 › clients-list › table view › clicking the first row navigates to that client card
[9/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:123:3 › clients-list › table view › view-btn links to client card
[10/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:129:3 › clients-list › table view › delete button exists per row
[11/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:135:3 › clients-list › table view › status badge renders for each row
[12/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:156:3 › clients-list › search › typing "Metalica" narrows to 1 row (UAB Metalica)
[13/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:165:3 › clients-list › search › typing "steelworks" (case-insensitive) narrows to 1 row (SIA SteelWorks)
[14/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:176:3 › clients-list › search › non-matching query yields the empty state instead of rows
[15/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:187:3 › clients-list › search › clearing the search restores all rows on page 1
[16/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:209:3 › clients-list › status filter › selecting "active" changes row count compared to unfiltered
[17/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:232:3 › clients-list › status filter › selecting "inactive" shows only inactive clients
[18/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:281:3 › clients-list › pagination › pagination bar renders
[19/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:285:3 › clients-list › pagination › page-size selector renders (default pageSize=25)
[20/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:290:3 › clients-list › pagination › pagination info shows range and total
[21/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:296:3 › clients-list › pagination › next page button is visible and clickable
[22/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:326:3 › clients-list › delete modal › clicking delete opens the confirmation modal
[23/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:333:3 › clients-list › delete modal › cancelling the modal closes it
[24/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:347:3 › clients-list › delete modal › a client with orders is not offered for deletion
[25/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:367:3 › clients-list › empty state › shows empty state when search yields no results
[26/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:392:3 › client-create › structure & validation › page root is visible
[27/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:396:3 › client-create › structure & validation › all sections render
[28/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:406:3 › client-create › structure & validation › cancel button navigates back to list
[29/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:411:3 › client-create › structure & validation › save button is present
[30/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:415:3 › client-create › structure & validation › empty name shows validation error
[31/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:441:3 › client-create › structure & validation › notes box is sized under the font actually in use, not the fallback
[32/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:461:3 › client-create › structure & validation › all form fields are present
[33/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:482:3 › client-create › create flow › filling the form and saving redirects to the card page
[34/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:507:3 › client-card › structure › page root is visible
[35/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:511:3 › client-card › structure › header and all panels render
[36/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:518:3 › client-card › structure › status pill and hint are visible
[37/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:523:3 › client-card › structure › save bar is present (initially hidden when clean)
[38/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:528:3 › client-card › structure › audit log section is visible
[39/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:542:3 › client-card › fields & save flow › all form fields carry mock data for CL-001
[40/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:551:3 › client-card › fields & save flow › editing a field activates the save bar (dirty state)
[41/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:565:3 › client-card › fields & save flow › discard resets the form
[42/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:577:3 › client-card › fields & save flow › save commits the change and disables save button
[43/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:602:3 › client-card › audit log › audit table renders with mock entries
[44/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:609:3 › client-card › audit log › audit delete button exists on each row
[45/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:615:3 › client-card › audit log › clicking delete removes the audit entry
[46/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:627:3 › client-card › audit log › cancelling the delete keeps the entry
[47/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:638:3 › client-card › audit log › delete entry shows toast notification
[48/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:656:3 › client-card › order history › order history section is visible
[49/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:660:3 › client-card › order history › the order history is the client's real orders
[50/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:677:3 › client-card › order history › order row renders order ID, date, total and status
[51/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:688:3 › client-card › order history › order row navigates to order card on click
[52/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:693:3 › client-card › order history › order link navigates to order card
[53/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:715:3 › client-card › issued invoices › a payment that names a document is money on that document row
[54/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:771:3 › client-card › order history empty › shows the empty state for a client nobody has ordered from
[55/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:804:3 › client-card › interaction history › interaction section is visible
[56/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:808:3 › client-card › interaction history › interaction form renders with type, date and summary fields
[57/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:814:3 › client-card › interaction history › interaction add button is disabled when summary is empty
[58/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:818:3 › client-card › interaction history › filling summary enables the add button
[59/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:827:3 › client-card › interaction history › adding an interaction appends a row to the table
[60/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:840:3 › client-card › interaction history › discard button resets the interaction form
[61/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:848:3 › client-card › interaction history › interaction table renders with rows for CL-001
[62/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:853:3 › client-card › interaction history › interaction delete button exists per row
[63/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:858:3 › client-card › interaction history › clicking delete removes the interaction row from UI
[64/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:873:3 › client-card › error state › non-existent client shows error state
[65/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:884:1 › clients › redirects to /404 when adminClients flag is OFF
[66/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:905:3 › clients › i18n › key header text translates in RU/EN/LT
[67/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:934:3 › clients-list › visual @1440 › header section
[68/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:941:3 › clients-list › visual @1440 › filters bar
[69/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:948:3 › clients-list › visual @1440 › table panel
[70/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:964:3 › client-create › visual @1440 › create page header
[71/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:971:3 › client-create › visual @1440 › create page general panel
[72/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:978:3 › client-create › visual @1440 › create page contact panel
[73/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:985:3 › client-create › visual @1440 › create page status panel
[74/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:1001:3 › client-card › visual @1440 › card header and save bar
[75/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:1008:3 › client-card › visual @1440 › card general panel
[76/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:1015:3 › client-card › visual @1440 › card contact panel
[77/110] [chromium] › tests/e2e/admin/clients/clients.spec.ts:1022:3 › client-card › visual @1440 › card audit panel
[78/110] [chromium] › tests/e2e/admin/layout.spec.ts:54:3 › admin layout › structure › shell, sidebar, topbar, main all render
[79/110] [chromium] › tests/e2e/admin/layout.spec.ts:72:3 › admin layout › structure › sidebar has all 6 nav entries
[80/110] [chromium] › tests/e2e/admin/layout.spec.ts:90:3 › admin layout › structure › sidebar footer: settings always visible @1440; user+lang hidden by CSS
[81/110] [chromium] › tests/e2e/admin/layout.spec.ts:110:3 › admin layout › structure › sidebar footer @1000: user + lang + settings all visible (tablet takeover)
[82/110] [chromium] › tests/e2e/admin/layout.spec.ts:129:3 › admin layout › structure › topbar has menu-toggle, search, lang-switcher, notifications, user
[83/110] [chromium] › tests/e2e/admin/layout.spec.ts:158:3 › admin layout › sidebar collapse (desktop) › initial state: shell is not collapsed
[84/110] [chromium] › tests/e2e/admin/layout.spec.ts:165:3 › admin layout › sidebar collapse (desktop) › clicking menu-toggle adds sidebar-collapsed class
[85/110] [chromium] › tests/e2e/admin/layout.spec.ts:176:3 › admin layout › sidebar collapse (desktop) › clicking menu-toggle twice restores expanded state
[86/110] [chromium] › tests/e2e/admin/layout.spec.ts:186:3 › admin layout › sidebar collapse (desktop) › collapsed state persists to localStorage
[87/110] [chromium] › tests/e2e/admin/layout.spec.ts:196:3 › admin layout › sidebar collapse (desktop) › collapsed state restored after reload
[88/110] [chromium] › tests/e2e/admin/layout.spec.ts:212:3 › admin layout › sidebar collapse (desktop) › sidebar-close button is hidden on desktop (CSS)
[89/110] [chromium] › tests/e2e/admin/layout.spec.ts:229:3 › admin layout › sidebar drawer (mobile) › initial state: shell is not active
[90/110] [chromium] › tests/e2e/admin/layout.spec.ts:236:3 › admin layout › sidebar drawer (mobile) › menu-toggle toggles sidebar-active on mobile
[91/110] [chromium] › tests/e2e/admin/layout.spec.ts:243:3 › admin layout › sidebar drawer (mobile) › mobile toggle does NOT persist to localStorage
[92/110] [chromium] › tests/e2e/admin/layout.spec.ts:254:3 › admin layout › sidebar drawer (mobile) › sidebar-close button is visible and hides the drawer
[93/110] [chromium] › tests/e2e/admin/layout.spec.ts:266:3 › admin layout › sidebar drawer (mobile) › open drawer locks body scroll
[94/110] [chromium] › tests/e2e/admin/layout.spec.ts:281:3 › admin layout › topbar search › accepts input and can be cleared
[95/110] [chromium] › tests/e2e/admin/layout.spec.ts:291:3 › admin layout › topbar search › has a localized placeholder
[96/110] [chromium] › tests/e2e/admin/layout.spec.ts:309:3 › admin layout › lang switcher › topbar EN click sets html[lang]=en and persists
[97/110] [chromium] › tests/e2e/admin/layout.spec.ts:322:3 › admin layout › lang switcher › topbar LT click sets html[lang]=lt
[98/110] [chromium] › tests/e2e/admin/layout.spec.ts:333:3 › admin layout › lang switcher › topbar RU click sets html[lang]=ru
[99/110] [chromium] › tests/e2e/admin/layout.spec.ts:345:3 › admin layout › lang switcher › sidebar EN click sets html[lang]=en (tablet viewport)
[100/110] [chromium] › tests/e2e/admin/layout.spec.ts:358:3 › admin layout › lang switcher › active class reflects current locale in both switchers
[101/110] [chromium] › tests/e2e/admin/layout.spec.ts:382:3 › admin layout › navigation › suppliers nav-link navigates to /admin/suppliers
[102/110] [chromium] › tests/e2e/admin/layout.spec.ts:391:3 › admin layout › navigation › analytics nav-link gets active class on analytics routes
[103/110] [chromium] › tests/e2e/admin/layout.spec.ts:398:3 › admin layout › navigation › suppliers nav-link gets active class on /admin/suppliers
[104/110] [chromium] › tests/e2e/admin/layout.spec.ts:405:3 › admin layout › navigation › placeholder nav-links (items/warehouse/sales/finance) do not navigate away
[105/110] [chromium] › tests/e2e/admin/layout.spec.ts:429:3 › admin layout › visual @1440 › sidebar expanded
[106/110] [chromium] › tests/e2e/admin/layout.spec.ts:450:3 › admin layout › visual @1440 › shell left edge with the sidebar collapsed
[107/110] [chromium] › tests/e2e/admin/layout.spec.ts:480:3 › admin layout › visual @1440 › topbar
[108/110] [chromium] › tests/e2e/admin/layout.spec.ts:492:3 › admin layout › responsive › shell @ 1440 (desktop)
[109/110] [chromium] › tests/e2e/admin/layout.spec.ts:502:3 › admin layout › responsive › shell @ 768 (tablet)
[110/110] [chromium] › tests/e2e/admin/layout.spec.ts:512:3 › admin layout › responsive › shell @ 375 (mobile)
  110 passed (1.5m)
exit=0
```

## Сторож и мутационная проверка

```
$ cd frontend_vue && npx vitest run src/services/expectBudgetClients.spec.ts

 ✓ src/services/expectBudgetClients.spec.ts (7 tests) 7ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
exit=0
```

Мутация: у одного утверждения в `clients.spec.ts` бюджет заменён числом (`{ timeout: 1 }`),
файл после правки несёт 49 бюджетов вместо 50.

```
$ cd frontend_vue && npx vitest run src/services/expectBudgetClients.spec.ts

 ❯ src/services/expectBudgetClients.spec.ts (7 tests | 3 failed)
     × опция взята из DATA_READY_TIMEOUT, а не записана числом
     × числового потолка в этих спеках не осталось
     × бюджеты не сняты — в каждом файле их не меньше замеренного числа

AssertionError: expected [ Array(1) ] to deeply equal []
+ [ "tests/e2e/admin/clients/clients.spec.ts:120", ]

AssertionError: tests/e2e/admin/clients/clients.spec.ts: бюджетов стало меньше замеренного: expected 49 to be greater than or equal to 50

 Test Files  1 failed (1)
      Tests  3 failed | 4 passed (7)
exit=1
```

После восстановления файла — снова 50 бюджетов и сторож зелёный (7 из 7). Значит потеря
одного `{ timeout: DATA_READY_TIMEOUT }` видна счётом, а числовой потолок — поимённо.

## Формат

```
$ cd frontend_vue && npx prettier --check tests/e2e/admin/clients/clients.spec.ts tests/e2e/admin/layout.spec.ts src/services/expectBudgetClients.spec.ts

Checking formatting...
All matched files use Prettier code style!
exit=0
```

## Итог

- Оба спека закрыты: каждое утверждение после действия несёт бюджет импортом, числовых
  потолков нет.
- `playwright.config.ts` не тронут, глобального `expect: { timeout }` там по-прежнему нет.
- Прогон затронутых спеков: 110 passed, exit 0.
- Замер пары `not.toHaveURL` при под-навигации: 21 мс и 17 мс против дефолтных 5000 мс —
  бюджет поставлен страховкой на будущее, а не починкой наблюдаемой красноты.
