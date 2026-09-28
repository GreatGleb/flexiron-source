# Бюджет `expect.poll` и уборка числовых потолков ожидания

Задача `expect-budget-literal-ceilings-and-poll-guard`, ночь `night-2026-09-28-0022`, run-1.
Ночная приёмка признала правку в спеках и сторожа верными и забраковала задачу за журнал: вывод
прогона был обрезан `...`, целиком лежал во временном файле вне checkout, а утверждение про
оставшиеся числовые потолки устарело. Черновик наложен 2026-09-28 утром поверх задачи заказов, и
журнал переписан на прогонах, снятых при приёмке заново.

## Что сделано

Числовые потолки ожидания заменены на `{ timeout: DATA_READY_TIMEOUT }` (30 000 мс, больше
каждого из прежних чисел — потолки только выросли), константа — импортом из помощника `ready`:

- `frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts` — `{ timeout: 10_000 }` у
  `expect.poll`, ждущего скрытую таблицу запасов после ввода в поиск;
- `frontend_vue/tests/e2e/ready-exits.spec.ts` — `{ timeout: 10_000 }` у `page.waitForFunction`,
  ждущего счётчик мок-вызовов;
- `frontend_vue/tests/e2e/smoke.spec.ts` — `{ timeout: 15_000 }` у мягкого ожидания заголовка.

Шесть потолков `{ timeout: 5000 }` в `frontend_vue/tests/e2e/admin/orders/orders.spec.ts`, которые
черновик тоже заменял, к моменту наложения уже заменила задача
`expect-budget-after-action-orders-spec` (коммит того же утра), поэтому в этот коммит спек заказов
не входит. Числовых потолков во всём дереве `frontend_vue/tests/e2e` вне помощников после обеих
задач нет: `grep -rn 'timeout: *[0-9]' frontend_vue/tests/e2e --include=*.ts | grep -v helpers/`
пуст.

Новый сторож `frontend_vue/src/services/expectPollBudget.spec.ts` разбирает каждый вызов `.poll(`
в `tests/e2e` до парной скобки через переносы и утверждает две вещи: разбор не пуст (вызовов не
меньше двадцати; сейчас их 27) и каждый несёт `timeout: DATA_READY_TIMEOUT`. `playwright.config.ts`
не тронут.

## Сторож зелёный, мутация ловится

Мутация: у `expect.poll` скрытой таблицы в спеке склада возвращён прежний `{ timeout: 10_000 }`.
Сторож краснеет и называет этот вызов файлом и строкой:

```
cd frontend_vue && npx vitest run src/services/expectPollBudget.spec.ts
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
RUN  v4.1.10 /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue

 ❯ src/services/expectPollBudget.spec.ts (2 tests | 1 failed) 9ms
     × каждый вызов expect.poll берёт DATA_READY_TIMEOUT 6ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectPollBudget.spec.ts > бюджет ожидания у expect.poll > каждый вызов expect.poll берёт DATA_READY_TIMEOUT
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/warehouse/warehouse.spec.ts:109",
+ ]

 ❯ src/services/expectPollBudget.spec.ts:70:23
     68|       .filter(({ call }) => !call.includes('timeout: DATA_READY_TIMEOU…
     69|       .map(({ file, line }) => `${file.slice(ROOT.length + 1)}:${line}…
     70|     expect(offenders).toEqual([])
       |                       ^
     71|   })
     72| })

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  07:12:03
   Duration  199ms (transform 45ms, setup 0ms, import 66ms, tests 9ms, environment 0ms)

exit=1
```

Возврат файла копией (`cmp` пуст) — снова зелёный:

```
cd frontend_vue && npx vitest run src/services/expectPollBudget.spec.ts
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
RUN  v4.1.10 /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  07:12:04
   Duration  193ms (transform 49ms, setup 0ms, import 68ms, tests 4ms, environment 0ms)

exit=0
```

## Прогон четырёх тронутых спеков

Спек заказов в прогоне оставлен: его потолки заменены соседней задачей, но черновик нацелен и на
него, и прогон подтверждает, что вместе обе правки зелёные.

```
cd frontend_vue && npx playwright test tests/e2e/admin/orders/orders.spec.ts tests/e2e/admin/warehouse/warehouse.spec.ts tests/e2e/ready-exits.spec.ts tests/e2e/smoke.spec.ts --reporter=line
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 210 tests using 4 workers

[1/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:54:3 › Orders List › loads without errors
[2/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:75:3 › Orders List › table panel renders with rows
[3/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:64:3 › Orders List › header is visible
[4/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:69:3 › Orders List › filters section is visible
[5/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:82:3 › Orders List › pagination is visible when orders exist
[6/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:86:3 › Orders List › create button navigates to create page
[7/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:92:3 › Orders List › order row links to card page
[8/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:102:3 › Orders List › view button navigates to card page
[9/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:110:3 › Orders List › the row says what the client pays, and how much of it arrived
[10/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:138:3 › Orders List › an order that left something behind refuses to be deleted, and says why
[11/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:174:3 › Order Create › loads without errors
[12/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:184:3 › Order Create › header with breadcrumbs and action bar is visible
[13/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:197:3 › Order Create › client selection panel renders with search, list and pagination
[14/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:209:3 › Order Create › client selection highlights selected client
[15/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:223:3 › Order Create › notes panel is visible
[16/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:228:3 › Order Create › leaving a started order asks in our own dialog, once, and can be refused
[17/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:264:3 › Order Create › leaving an untouched order asks nothing
[18/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:273:3 › Order Create › document type panel renders with dropdown
[19/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:278:3 › Order Create › items section is visible with add button
[20/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:283:3 › Order Create › services section is visible with add button
[21/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:288:3 › Order Create › files section with dropzone is visible
[22/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:293:3 › Order Create › saves the lines that are on screen, duplicates and removals included
[23/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:344:3 › Order Create › the picker quotes the same price here as it does on a card
[24/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:378:3 › Order Card › loads without errors
[25/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:388:3 › Order Card › header with breadcrumbs, title and status pill is visible
[26/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:394:3 › Order Card › save bar with action buttons is visible
[27/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:398:3 › Order Card › entity card grid with 3 columns is visible
[28/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:405:3 › Order Card › items section renders with table
[29/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:409:3 › Order Card › services section is visible
[30/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:413:3 › Order Card › files section with dropzone is visible
[31/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:417:3 › Order Card › audit log section is visible
[32/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:421:3 › Order Card › error state for non-existent order
[33/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:434:3 › Order Card › fields & structure › status pill and hint are visible
[34/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:439:3 › Order Card › fields & structure › save bar is present
[35/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:443:3 › Order Card › fields & structure › left column fields render
[36/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:451:3 › Order Card › fields & structure › center column financial fields render
[37/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:470:3 › Order Card › fields & structure › the panel shows the money the order actually comes to
[38/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:509:3 › Order Card › fields & structure › a zero-rated order charges no VAT
[39/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:516:3 › Order Card › fields & structure › an order-wide discount is visible, not hidden at zero
[40/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:522:3 › Order Card › fields & structure › editing the total spreads it across the lines
[41/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:547:3 › Order Card › fields & structure › a total that cannot exist is announced, never quietly substituted
[42/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:557:3 › Order Card › fields & structure › unsaved lines block the total edit rather than failing on the server
[43/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:585:3 › Order Card › fields & structure › changing the VAT mode asks what to keep, and keeps the net by default
[44/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:614:3 › Order Card › fields & structure › keeping the total across a VAT mode change re-targets the net
[45/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:646:3 › Order Card › fields & structure › the services table shows per-line money, not per-unit times quantity
[46/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:668:3 › Order Card › fields & structure › an unsaved note survives an allocation
[47/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:686:3 › Order Card › fields & structure › applying the percentages to every line says what it will do first
[48/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:717:3 › Order Card › fields & structure › the percentages reach a line that has not been saved yet
[49/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:761:3 › Order Card › fields & structure › saving stores the fields the admin owns
[50/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:790:3 › Order Card › fields & structure › cancelling the VAT dialog leaves the order untouched
[51/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:810:3 › Order Card › fields & structure › status dropdown renders
[52/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:814:3 › Order Card › fields & structure › items and services sections render
[53/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:819:3 › Order Card › fields & structure › files section with dropzone is visible
[54/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:854:3 › Order Card › line table › opens exactly the cells the line state allows
[55/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:878:3 › Order Card › line table › the state of every line is spelled out, shipped quantity and all
[56/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:886:3 › Order Card › line table › a margin edit reprices the line and the order, and Save keeps it
[57/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:915:3 › Order Card › line table › a price cut becomes a discount and locks the line; reset undoes both
[58/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:944:3 › Order Card › line table › a refused edit puts the cell back and says why
[59/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:965:3 › Order Card › line table › a cost typed by hand demands a reason before it lands
[60/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1004:3 › Order Card › line table › cancelling the reason dialog leaves the cost alone
[61/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1020:3 › Order Card › line table › splitting a partially shipped line keeps every euro
[62/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1053:3 › Order Card › line table › edits to several lines go out with one Save
[63/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1073:3 › Order Card › line table › a line added and edited before Save arrives with the edit on it
[64/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1108:3 › Order Card › line table › a line added and then removed before Save never reaches the server
[65/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1133:3 › Order Card › line table › editing the line total is the same edit seen from the other side
[66/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1156:3 › Order Card › line table › the owner sees cost and margin, and may type a cost by hand
[67/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1175:3 › Order Card › line table › cost, margin and the line state are there for everyone, unflagged
[68/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1206:3 › Order Card › adding lines › asks nothing when nobody has repriced the order by hand
[69/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1214:3 › Order Card › adding lines › sells at the catalogue price, never at cost
[70/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1235:3 › Order Card › adding lines › a line added to a discounted order gets that discount
[71/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1273:3 › Order Card › adding lines › "keep the total" shows what it will do, and can be called off
[72/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1322:3 › Order Card › adding lines › the price and the sum in a row agree to the cent
[73/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1342:3 › Order Card › adding lines › the picker promises the number the row then shows
[74/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1362:3 › Order Card › adding lines › a shipped order takes new lines without moving the old ones
[75/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1444:3 › Order Card › shipments › the panel is there, with nothing in it until something ships
[76/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1449:3 › Order Card › shipments › offers what the shelf can back, not what the client is owed
[77/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1468:3 › Order Card › shipments › a shipment freezes the line, carries a waybill, and can be undone
[78/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1529:3 › Order Card › shipments › a partially shipped order still takes new lines
[79/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1555:3 › Order Card › shipments › a seeded shipment really moved goods, and says which document
[80/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1570:3 › Order Card › shipments › with the flag off the panel is gone and nothing can ship
[81/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1614:5 › Order Card › ширина таблицы позиций › при 1440 и языке ru таблица влезает целиком
[82/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1614:5 › Order Card › ширина таблицы позиций › при 1440 и языке lt таблица влезает целиком
[83/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1666:5 › Order Card › ширина таблицы позиций › ни одно значение в поле ввода не обрезано (ORD-054)
[84/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1666:5 › Order Card › ширина таблицы позиций › ни одно значение в поле ввода не обрезано (ORD-100)
[85/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1690:3 › Order Card › ширина таблицы позиций › в ORD-054 есть значение, на котором обрезка и проявлялась
[86/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1702:3 › Order Card › ширина таблицы позиций › у ORD-100 есть таблица услуг
[87/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1739:3 › Order Card › returns › the panel is there, and empty until something comes back
[88/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1744:3 › Order Card › returns › nothing shipped means nothing to return
[89/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1755:3 › Order Card › returns › an unsaved line stops the return dialog before it opens
[90/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1787:3 › Order Card › returns › the dialog offers only what shipped, and closes on Escape
[91/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1806:3 › Order Card › returns › a return needs a reason before it can be confirmed
[92/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1825:3 › Order Card › returns › a partial return is recorded, badged, marked on the line and taken off the total
[93/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1882:3 › Order Card › returns › пилюля возврата — цельный бокс в одну строку, как все прочие пилюли
[94/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1916:3 › Order Card › returns › a second partial return of the same line still goes through
[95/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1932:3 › Order Card › returns › with the flag off the panel is gone and nothing can be returned
[96/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1973:3 › Order Card › unsaved lines close the door › the shipping dialog does not open
[97/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:1984:3 › Order Card › unsaved lines close the door › cancelling a delivery does not open either of its dialogs
[98/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2000:3 › Order Card › unsaved lines close the door › correcting a frozen line does not open its dialog
[99/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2051:3 › Order Card › unsaved lines close the door › a status change never reaches its plan
[100/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2146:3 › Order Card › payments and invoices › an order nobody has paid says so, and holds no records
[101/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2157:3 › Order Card › payments and invoices › the advance is a record, and the percentage is worked out from it
[102/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2165:3 › Order Card › payments and invoices › the paid share falls by itself when the order grows
[103/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2182:3 › Order Card › payments and invoices › a settled order that is changed warns, and still lets it happen
[104/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2202:3 › Order Card › payments and invoices › paying what is left settles the order, and deleting it undoes that
[105/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2235:3 › Order Card › payments and invoices › the payment date is our own calendar, and the day picked is the day recorded
[106/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2274:3 › Order Card › payments and invoices › a refund names its document, and is entered positive and stored negative
[107/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2359:3 › Order Card › payments and invoices › one payment stays one payment however hard the key is pressed
[108/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2389:3 › Order Card › payments and invoices › an advance invoice covers no delivery and states its own amount
[109/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2408:3 › Order Card › payments and invoices › a payment can name the invoice it settles
[110/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2437:3 › Order Card › payments and invoices › the dialog names the document, and the incoming registry says what the card says
[111/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2501:3 › Order Card › payments and invoices › a delivery is invoiced once, and the document freezes what it covers
[112/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2518:3 › Order Card › payments and invoices › a price printed wrong is corrected in the open, not rewritten
[113/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2611:3 › Order Card › payments and invoices › cancelling an invoiced delivery asks for a reason and corrects it
[114/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2661:3 › Order Card › payments and invoices › with the flag off both panels are gone
[115/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2676:3 › Order Card › save flow › edit notes enables save button
[116/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2686:3 › Order Card › save flow › discard resets notes field
[117/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2702:3 › Order Card › delete › delete button opens confirmation modal
[118/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2710:3 › Order Card › delete › cancel closes deletion modal
[119/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2728:3 › Order Card › audit log › audit section is visible
[120/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2732:3 › Order Card › audit log › audit delete button opens confirmation modal
[121/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2746:3 › Order Card › audit log › cancel closes audit delete modal
[122/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2766:3 › Order Create › client selector › client panel renders with search, list and pagination
[123/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2776:3 › Order Create › client selector › client search filters the list
[124/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2794:3 › Order Create › client selector › selecting a client shows selected indicator
[125/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2813:3 › Order Create › client selector › selecting a client pulls in that client's own payment terms
[126/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2850:3 › Order Create › client selector › the saved order carries the terms its client was picked with
[127/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2875:3 › Order Create › client selector › new client search shows empty state for no results
[128/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2889:3 › Orders i18n › orders list page renders with title
[129/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2893:3 › Orders i18n › order card page renders
[130/210] [chromium] › tests/e2e/admin/orders/orders.spec.ts:2908:3 › Add item modal › the price column quotes the price the line will be sold at
[131/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:39:5 › Warehouse module › Page layout › should display all warehouse tabs
[132/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:49:5 › Warehouse module › Page layout › should display filters bar
[133/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:55:5 › Warehouse module › Stock tab › should display stock overview table
[134/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:60:5 › Warehouse module › Stock tab › should have stock filters
[135/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[136/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:125:5 › Warehouse module › Stock tab › should have pagination for stock
[137/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:129:5 › Warehouse module › Stock tab › should navigate to stock card on view button click
[138/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:137:5 › Warehouse module › Batches tab › should display batches list
[139/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:145:5 › Warehouse module › Batches tab › should have batch filters
[140/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:154:5 › Warehouse module › Batches tab › should navigate to batch card on view button click
[141/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:165:5 › Warehouse module › Batch card › should display batch details
[142/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:171:5 › Warehouse module › Batch card › should show error state when batch not found
[143/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:182:5 › Warehouse module › Offcuts tab › should display offcuts list
[144/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:190:5 › Warehouse module › Offcuts tab › should have offcut filters
[145/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:199:5 › Warehouse module › Offcuts tab › should have new offcut button in toolbar
[146/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:207:5 › Warehouse module › Offcuts tab › should navigate to offcut card on view button click
[147/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:218:5 › Warehouse module › Offcuts tab › should mark offcut as used (in_production) via quick action
[148/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:226:5 › Warehouse module › Offcuts tab › should mark offcut as scrapped via quick action
[149/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:236:5 › Warehouse module › Offcut card › should display offcut details
[150/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:242:5 › Warehouse module › Offcut card › should display offcut sections
[151/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:249:5 › Warehouse module › Offcut card › should show error state when offcut not found
[152/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:260:5 › Warehouse module › Movements tab › should display movements list
[153/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:268:5 › Warehouse module › Movements tab › every movement type is a label, not the key behind it
[154/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:325:5 › Warehouse module › Movements tab › should have movement filters
[155/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:334:5 › Warehouse module › Movements tab › should navigate to movement card on view button click
[156/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:347:5 › Warehouse module › Movement card › should display movement details
[157/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:353:5 › Warehouse module › Movement card › should show error state when movement not found
[158/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:364:5 › Warehouse module › Deficit tab › should display deficit list
[159/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:372:5 › Warehouse module › Deficit tab › should have deficit filters
[160/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:381:5 › Warehouse module › Deficit tab › should navigate to deficit card on view button click
[161/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:392:5 › Warehouse module › Deficit tab › should mark deficit as in_progress via quick action
[162/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:400:5 › Warehouse module › Deficit tab › should mark deficit as resolved via quick action
[163/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:410:5 › Warehouse module › Deficit card › should display deficit details
[164/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:416:5 › Warehouse module › Deficit card › should show error state when deficit not found
[165/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:427:5 › Warehouse module › Stock card › should display stock card details
[166/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:435:5 › Warehouse module › Stock card › should show error state when stock item not found
[167/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:450:5 › Warehouse module › Movements tab — no create button › should NOT have a new movement button in toolbar
[168/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:476:5 › Warehouse module › Batch create page › should load with product selection panel and form sections
[169/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:496:5 › Warehouse module › Batch create page › should allow product selection via radio button
[170/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:506:5 › Warehouse module › Batch create page › should show validation errors on empty form submit
[171/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:517:5 › Warehouse module › Batch create page › should save and redirect to batch card on valid form submit
[172/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:532:5 › Warehouse module › Batch create page › should cancel and return to batches list
[173/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:538:5 › Warehouse module › Batch create page › should have search and category filter for products
[174/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:556:5 › Warehouse module › Offcut create page › should load with all sections including files
[175/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:578:5 › Warehouse module › Offcut create page › should show batch selection panel after selecting a product
[176/210] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:588:5 › Warehouse module › Offcut create page › should cancel and return to offcuts list
[177/210] [chromium] › tests/e2e/ready-exits.spec.ts:104:1 › every admin route is either traffic-seen or declared — never a silent third thing
[178/210] [chromium] › tests/e2e/ready-exits.spec.ts:135:1 › every declaration carries a reason
[179/210] [chromium] › tests/e2e/ready-exits.spec.ts:149:1 › the declared no-data routes ask for nothing, and are not waited for
[180/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › landing loads without errors
[181/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › login loads without errors
[182/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › register loads without errors
[183/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › about loads without errors
[184/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › support loads without errors
[185/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › terms loads without errors
[186/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › screens loads without errors
[187/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › dashboard loads without errors
[188/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › warehouse loads without errors
[189/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › sales loads without errors
[190/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › supply loads without errors
[191/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › staff loads without errors
[192/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › logistics loads without errors
[chromium] › tests/e2e/ready-exits.spec.ts:149:1 › the declared no-data routes ask for nothing, and are not waited for
data-free exits: {
 "/": "no-data-route",
 "/login": "no-data-route",
 "/register": "no-data-route",
 "/about": "no-data-route",
 "/support": "no-data-route",
 "/terms": "no-data-route",
 "/screens": "no-data-route",
 "/404": "no-data-route"
}

data-free mock calls: {
 "/": 0,
 "/login": 0,
 "/register": 0,
 "/about": 0,
 "/support": 0,
 "/terms": 0,
 "/screens": 0,
 "/404": 0
}

[193/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › pl-report loads without errors
[194/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › deficit loads without errors
[195/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › categories loads without errors
[196/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › category-card loads without errors
[197/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › products loads without errors
[198/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › product-card loads without errors
[199/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › clients-list loads without errors
[200/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › client-create loads without errors
[201/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › client-card loads without errors
[202/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › suppliers-list loads without errors
[203/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › supplier-create loads without errors
[204/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › supplier-card loads without errors
[205/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › supplier-card-config loads without errors
[206/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › bcc-request loads without errors
[207/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › sales-crm loads without errors
[208/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › orders-list loads without errors
[209/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › order-create loads without errors
[210/210] [chromium] › tests/e2e/smoke.spec.ts:56:3 › order-card loads without errors
[chromium] › tests/e2e/ready-exits.spec.ts:104:1 › every admin route is either traffic-seen or declared — never a silent third thing
all admin routes: traffic-seen

  210 passed (5.3m)
exit=0
```

## Замер вместо инверсии

Нагрузку не создавали. Инструментировано ожидание, которое тронула именно эта задача:
`Date.now()` перед вводом в поиск запасов, разница напечатана после `expect.poll`, дождавшегося
скрытой таблицы. Три прогона, инструментация после них снята, файл сверен `cmp` с копией.

```
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/warehouse.spec.ts -g "во время фильтрации таблица накрыта скелетом" --reporter=line
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[замер] ввод в поиск → панель скрыта: 503 мс против 10000 мс

  1 passed (6.9s)
exit=0
```

```
(второй прогон, та же команда)
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[замер] ввод в поиск → панель скрыта: 503 мс против 10000 мс

  1 passed (6.5s)
exit=0
```

```
(третий прогон, та же команда)
```

Вывод целиком (управляющие ANSI-последовательности сняты, подряд повторённые строки прогресса `--reporter=line` схлопнуты в одну):

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[замер] ввод в поиск → панель скрыта: 513 мс против 10000 мс

  1 passed (6.9s)
exit=0
```

## Вывод по замеру

503–513 мс против прежнего потолка 10 000 мс — запас около двадцати раз. Бюджет здесь —
**страховка на будущее** и единый источник числа, а не починка наблюдаемой красноты. Числа после
имени файла в выводах выше — дословный текст инструментов, а не ссылки журнала.
