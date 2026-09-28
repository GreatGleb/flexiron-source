# Бюджет ожиданий спека заказов — проверка и замер

Задача `expect-budget-after-action-orders-spec`, ночь `night-2026-09-28-0022`, run-3. Ночная
приёмка забраковала её за красный `format:check` на `src/services/expectBudget.spec.ts`; журнала
в черновике не было — автор оставил короткую сводку в
[`orders-spec-waits-for-element-not-data.md`](../../plans/bugs/orders-spec-waits-for-element-not-data.md).
Черновик наложен 2026-09-28 утром, формат исправлен `npx prettier --write`, а все прогоны ниже
сняты заново при приёмке, не взяты из отчёта автора.

## Смысл утверждений не изменился

Старая и новая версии `tests/e2e/admin/orders/orders.spec.ts` сравнены после удаления из обеих
всех опций `{ timeout: … }`, строки импорта `DATA_READY_TIMEOUT` и пробелов: остаток совпадает
побайтно. Значит дифф спека — только вторые аргументы, замена числового `timeout: 5000` на
константу и импорт. Числовых потолков в файле после правки нет: `grep -c 'timeout: *[0-9]'` → 0.

## Сторож зелёный

```
cd frontend_vue && npx vitest run src/services/expectBudget.spec.ts
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
RUN  v4.1.10 /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  07:03:48
   Duration  194ms (transform 43ms, setup 0ms, import 56ms, tests 11ms, environment 0ms)

guard rc=0
```

## Мутация 1 — вернуть числовой потолок

Первое `timeout: DATA_READY_TIMEOUT` в спеке заменено на `timeout: 5000`. Сторож краснеет и
называет файл со строкой; счётное утверждение краснеет тоже, потому что бюджетов стало на один
меньше.

```
cd frontend_vue && npx vitest run src/services/expectBudget.spec.ts
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
RUN  v4.1.10 /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue

 ❯ src/services/expectBudget.spec.ts (4 tests | 2 failed) 13ms
     × числового потолка в этих спеках не осталось 7ms
     × бюджеты в спеке заказов не сняты — их не меньше замеренного числа 2ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudget.spec.ts > бюджет ожидания у утверждений после действия > числового потолка в этих спеках не осталось
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/orders/orders.spec.ts:36",
+ ]

 ❯ src/services/expectBudget.spec.ts:81:39
     79|     // `timeout: 5000` и любое другое число — тот же бюджет, записанны…
     80|     // разошёлся бы с `DATA_READY_TIMEOUT` молча, и назван он файлом и…
     81|     expect(offences(/timeout:\s*\d/)).toEqual([])
       |                                       ^
     82|   })
     83|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/services/expectBudget.spec.ts > бюджет ожидания у утверждений после действия > бюджеты в спеке заказов не сняты — их не меньше замеренного числа
AssertionError: expected 293 to be greater than or equal to 294
 ❯ src/services/expectBudget.spec.ts:96:33
     94|     // поймать: утверждение возвращается к дефолтным пяти секундам, ко…
     95|     // не хватает (питфолл #70), а глазами такая потеря не видна.
     96|     expect(budgetCount(ORDERS)).toBeGreaterThanOrEqual(ORDERS_BUDGETS_…
       |                                 ^
     97|   })
     98| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
   Start at  07:03:48
   Duration  207ms (transform 53ms, setup 0ms, import 65ms, tests 13ms, environment 0ms)

mut1 rc=1
```

## Мутация 2 — снять бюджет у одного утверждения

Первое утверждение с многострочной опцией `{ timeout: DATA_READY_TIMEOUT }` оставлено без второго
аргумента. Краснеет счётное утверждение: 293 против 294.

```
cd frontend_vue && npx vitest run src/services/expectBudget.spec.ts
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
RUN  v4.1.10 /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue

 ❯ src/services/expectBudget.spec.ts (4 tests | 1 failed) 11ms
     × бюджеты в спеке заказов не сняты — их не меньше замеренного числа 4ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudget.spec.ts > бюджет ожидания у утверждений после действия > бюджеты в спеке заказов не сняты — их не меньше замеренного числа
AssertionError: expected 293 to be greater than or equal to 294
 ❯ src/services/expectBudget.spec.ts:96:33
     94|     // поймать: утверждение возвращается к дефолтным пяти секундам, ко…
     95|     // не хватает (питфолл #70), а глазами такая потеря не видна.
     96|     expect(budgetCount(ORDERS)).toBeGreaterThanOrEqual(ORDERS_BUDGETS_…
       |                                 ^
     97|   })
     98| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 3 passed (4)
   Start at  07:03:49
   Duration  205ms (transform 53ms, setup 0ms, import 68ms, tests 11ms, environment 0ms)

mut2 rc=1
```

## Возврат файла — снова зелёный

Файл возвращён копией, `cmp` с копией пуст.

```
cd frontend_vue && npx vitest run src/services/expectBudget.spec.ts
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
RUN  v4.1.10 /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  07:03:50
   Duration  193ms (transform 52ms, setup 0ms, import 65ms, tests 9ms, environment 0ms)

back rc=0
```

## Прогон спека заказов

```
cd frontend_vue && npx playwright test tests/e2e/admin/orders/orders.spec.ts --reporter=line
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 130 tests using 4 workers

[1/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:75:3 › Orders List › table panel renders with rows
[2/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:54:3 › Orders List › loads without errors
[3/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:69:3 › Orders List › filters section is visible
[4/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:64:3 › Orders List › header is visible
[5/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:82:3 › Orders List › pagination is visible when orders exist
[6/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:86:3 › Orders List › create button navigates to create page
[7/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:92:3 › Orders List › order row links to card page
[8/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:102:3 › Orders List › view button navigates to card page
[9/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:110:3 › Orders List › the row says what the client pays, and how much of it arrived
[10/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:138:3 › Orders List › an order that left something behind refuses to be deleted, and says why
[11/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:174:3 › Order Create › loads without errors
[12/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:184:3 › Order Create › header with breadcrumbs and action bar is visible
[13/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:197:3 › Order Create › client selection panel renders with search, list and pagination
[14/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:209:3 › Order Create › client selection highlights selected client
[15/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:223:3 › Order Create › notes panel is visible
[16/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:228:3 › Order Create › leaving a started order asks in our own dialog, once, and can be refused
[17/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:264:3 › Order Create › leaving an untouched order asks nothing
[18/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:273:3 › Order Create › document type panel renders with dropdown
[19/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:278:3 › Order Create › items section is visible with add button
[20/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:283:3 › Order Create › services section is visible with add button
[21/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:288:3 › Order Create › files section with dropzone is visible
[22/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:293:3 › Order Create › saves the lines that are on screen, duplicates and removals included
[23/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:344:3 › Order Create › the picker quotes the same price here as it does on a card
[24/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:378:3 › Order Card › loads without errors
[25/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:388:3 › Order Card › header with breadcrumbs, title and status pill is visible
[26/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:394:3 › Order Card › save bar with action buttons is visible
[27/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:398:3 › Order Card › entity card grid with 3 columns is visible
[28/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:405:3 › Order Card › items section renders with table
[29/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:409:3 › Order Card › services section is visible
[30/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:413:3 › Order Card › files section with dropzone is visible
[31/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:417:3 › Order Card › audit log section is visible
[32/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:421:3 › Order Card › error state for non-existent order
[33/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:434:3 › Order Card › fields & structure › status pill and hint are visible
[34/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:439:3 › Order Card › fields & structure › save bar is present
[35/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:443:3 › Order Card › fields & structure › left column fields render
[36/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:451:3 › Order Card › fields & structure › center column financial fields render
[37/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:470:3 › Order Card › fields & structure › the panel shows the money the order actually comes to
[38/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:509:3 › Order Card › fields & structure › a zero-rated order charges no VAT
[39/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:516:3 › Order Card › fields & structure › an order-wide discount is visible, not hidden at zero
[40/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[41/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:547:3 › Order Card › fields & structure › a total that cannot exist is announced, never quietly substituted
[42/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:557:3 › Order Card › fields & structure › unsaved lines block the total edit rather than failing on the server
[43/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:585:3 › Order Card › fields & structure › changing the VAT mode asks what to keep, and keeps the net by default
[44/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:614:3 › Order Card › fields & structure › keeping the total across a VAT mode change re-targets the net
[45/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:646:3 › Order Card › fields & structure › the services table shows per-line money, not per-unit times quantity
[46/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:668:3 › Order Card › fields & structure › an unsaved note survives an allocation
[47/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:686:3 › Order Card › fields & structure › applying the percentages to every line says what it will do first
[48/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:717:3 › Order Card › fields & structure › the percentages reach a line that has not been saved yet
[49/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:761:3 › Order Card › fields & structure › saving stores the fields the admin owns
[50/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:790:3 › Order Card › fields & structure › cancelling the VAT dialog leaves the order untouched
[51/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:810:3 › Order Card › fields & structure › status dropdown renders
[52/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:814:3 › Order Card › fields & structure › items and services sections render
[53/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:819:3 › Order Card › fields & structure › files section with dropzone is visible
[54/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:854:3 › Order Card › line table › opens exactly the cells the line state allows
[55/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:878:3 › Order Card › line table › the state of every line is spelled out, shipped quantity and all
[56/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:886:3 › Order Card › line table › a margin edit reprices the line and the order, and Save keeps it
[57/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:915:3 › Order Card › line table › a price cut becomes a discount and locks the line; reset undoes both
[58/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:944:3 › Order Card › line table › a refused edit puts the cell back and says why
[59/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:965:3 › Order Card › line table › a cost typed by hand demands a reason before it lands
[60/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1004:3 › Order Card › line table › cancelling the reason dialog leaves the cost alone
[61/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1020:3 › Order Card › line table › splitting a partially shipped line keeps every euro
[62/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1053:3 › Order Card › line table › edits to several lines go out with one Save
[63/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1073:3 › Order Card › line table › a line added and edited before Save arrives with the edit on it
[64/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1108:3 › Order Card › line table › a line added and then removed before Save never reaches the server
[65/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1133:3 › Order Card › line table › editing the line total is the same edit seen from the other side
[66/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1156:3 › Order Card › line table › the owner sees cost and margin, and may type a cost by hand
[67/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1175:3 › Order Card › line table › cost, margin and the line state are there for everyone, unflagged
[68/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1206:3 › Order Card › adding lines › asks nothing when nobody has repriced the order by hand
[69/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1214:3 › Order Card › adding lines › sells at the catalogue price, never at cost
[70/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1235:3 › Order Card › adding lines › a line added to a discounted order gets that discount
[71/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1273:3 › Order Card › adding lines › "keep the total" shows what it will do, and can be called off
[72/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1322:3 › Order Card › adding lines › the price and the sum in a row agree to the cent
[73/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1342:3 › Order Card › adding lines › the picker promises the number the row then shows
[74/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1362:3 › Order Card › adding lines › a shipped order takes new lines without moving the old ones
[75/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1444:3 › Order Card › shipments › the panel is there, with nothing in it until something ships
[76/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1449:3 › Order Card › shipments › offers what the shelf can back, not what the client is owed
[77/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1468:3 › Order Card › shipments › a shipment freezes the line, carries a waybill, and can be undone
[78/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1529:3 › Order Card › shipments › a partially shipped order still takes new lines
[79/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1555:3 › Order Card › shipments › a seeded shipment really moved goods, and says which document
[80/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1570:3 › Order Card › shipments › with the flag off the panel is gone and nothing can ship
[81/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1614:5 › Order Card › ширина таблицы позиций › при 1440 и языке ru таблица влезает целиком
[82/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1614:5 › Order Card › ширина таблицы позиций › при 1440 и языке lt таблица влезает целиком
[83/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1666:5 › Order Card › ширина таблицы позиций › ни одно значение в поле ввода не обрезано (ORD-054)
[84/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1666:5 › Order Card › ширина таблицы позиций › ни одно значение в поле ввода не обрезано (ORD-100)
[85/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1690:3 › Order Card › ширина таблицы позиций › в ORD-054 есть значение, на котором обрезка и проявлялась
[86/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1702:3 › Order Card › ширина таблицы позиций › у ORD-100 есть таблица услуг
[87/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1739:3 › Order Card › returns › the panel is there, and empty until something comes back
[88/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1744:3 › Order Card › returns › nothing shipped means nothing to return
[89/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1755:3 › Order Card › returns › an unsaved line stops the return dialog before it opens
[90/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1787:3 › Order Card › returns › the dialog offers only what shipped, and closes on Escape
[91/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1806:3 › Order Card › returns › a return needs a reason before it can be confirmed
[92/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1825:3 › Order Card › returns › a partial return is recorded, badged, marked on the line and taken off the total
[93/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1882:3 › Order Card › returns › пилюля возврата — цельный бокс в одну строку, как все прочие пилюли
[94/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1916:3 › Order Card › returns › a second partial return of the same line still goes through
[95/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1932:3 › Order Card › returns › with the flag off the panel is gone and nothing can be returned
[96/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1973:3 › Order Card › unsaved lines close the door › the shipping dialog does not open
[97/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1984:3 › Order Card › unsaved lines close the door › cancelling a delivery does not open either of its dialogs
[98/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2000:3 › Order Card › unsaved lines close the door › correcting a frozen line does not open its dialog
[99/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2051:3 › Order Card › unsaved lines close the door › a status change never reaches its plan
[100/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2146:3 › Order Card › payments and invoices › an order nobody has paid says so, and holds no records
[101/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2157:3 › Order Card › payments and invoices › the advance is a record, and the percentage is worked out from it
[102/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2165:3 › Order Card › payments and invoices › the paid share falls by itself when the order grows
[103/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2182:3 › Order Card › payments and invoices › a settled order that is changed warns, and still lets it happen
[104/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2202:3 › Order Card › payments and invoices › paying what is left settles the order, and deleting it undoes that
[105/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2235:3 › Order Card › payments and invoices › the payment date is our own calendar, and the day picked is the day recorded
[106/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2274:3 › Order Card › payments and invoices › a refund names its document, and is entered positive and stored negative
[107/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2359:3 › Order Card › payments and invoices › one payment stays one payment however hard the key is pressed
[108/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2389:3 › Order Card › payments and invoices › an advance invoice covers no delivery and states its own amount
[109/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2408:3 › Order Card › payments and invoices › a payment can name the invoice it settles
[110/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2437:3 › Order Card › payments and invoices › the dialog names the document, and the incoming registry says what the card says
[111/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2501:3 › Order Card › payments and invoices › a delivery is invoiced once, and the document freezes what it covers
[112/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2518:3 › Order Card › payments and invoices › a price printed wrong is corrected in the open, not rewritten
[113/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2611:3 › Order Card › payments and invoices › cancelling an invoiced delivery asks for a reason and corrects it
[114/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2661:3 › Order Card › payments and invoices › with the flag off both panels are gone
[115/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2676:3 › Order Card › save flow › edit notes enables save button
[116/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2686:3 › Order Card › save flow › discard resets notes field
[117/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2702:3 › Order Card › delete › delete button opens confirmation modal
[118/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2710:3 › Order Card › delete › cancel closes deletion modal
[119/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2728:3 › Order Card › audit log › audit section is visible
[120/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2732:3 › Order Card › audit log › audit delete button opens confirmation modal
[121/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2746:3 › Order Card › audit log › cancel closes audit delete modal
[122/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2766:3 › Order Create › client selector › client panel renders with search, list and pagination
[123/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2776:3 › Order Create › client selector › client search filters the list
[124/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2794:3 › Order Create › client selector › selecting a client shows selected indicator
[125/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2813:3 › Order Create › client selector › selecting a client pulls in that client's own payment terms
[126/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2850:3 › Order Create › client selector › the saved order carries the terms its client was picked with
[127/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2875:3 › Order Create › client selector › new client search shows empty state for no results
[128/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2889:3 › Orders i18n › orders list page renders with title
[129/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2893:3 › Orders i18n › order card page renders
[130/130] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2908:3 › Add item modal › the price column quotes the price the line will be sold at
  130 passed (3.4m)
exit=0
```

## Замер вместо инверсии

Нагрузку не создавали. Инструментирован тест `editing the total spreads it across the lines`:
`Date.now()` перед нажатием Enter в поле итога, разница напечатана после утверждения о появлении
окна распределения суммы (оно получило бюджет этой задачей). Три прогона подряд, инструментация
после них снята, файл сверен `cmp` с копией.

```
cd frontend_vue && npx playwright test tests/e2e/admin/orders/orders.spec.ts -g "editing the total spreads it across the lines" --reporter=line
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[замер] Enter → окно распределения: 192 мс против 5000 мс

  1 passed (8.7s)
exit=0
```

```
(второй прогон, та же команда)
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[замер] Enter → окно распределения: 86 мс против 5000 мс

  1 passed (8.2s)
exit=0
```

```
(третий прогон, та же команда)
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[замер] Enter → окно распределения: 90 мс против 5000 мс

  1 passed (8.2s)
exit=0
```

## Вывод по замеру

86–192 мс против прежнего потолка в 5000 мс — запас в 26–58 раз. Бюджет здесь — **страховка на
будущее**, а не починка наблюдаемой красноты: на быстрой машине он не тратится, платит только
падающий тест. Числа после имени файла в выводах выше — дословный текст инструментов, а не ссылки
журнала.
