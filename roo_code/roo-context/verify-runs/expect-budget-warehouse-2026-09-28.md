# Бюджет ожиданий каталога склада — замер и прогон

Задача `expect-budget-after-action-warehouse-specs`. Замеры и прогоны — 2026-09-28, рабочее
дерево `wt-expect-budget-after-action-warehouse-specs`. Собственных ссылок вида `путь:номер`
здесь нет: имя файла и номер пишутся отдельными словами. Координаты с двоеточием внутри вывода
ниже — это дословный вывод инструментов (Playwright и витэста), а не ссылки журнала.

## Что сделано

Семь спеков каталога склада прошли разбор на класс «утверждение, стоящее НЕПОСРЕДСТВЕННО после
действия на странице и не отделённое от него ни `openAdminPage`, ни `openAdminCard`, ни
`waitForDataReady`». Найдено пятнадцать таких утверждений в пяти файлах:

| файл | тронутых утверждений |
|---|---|
| `frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts` | 6 |
| `frontend_vue/tests/e2e/admin/warehouse/warehouse-map.spec.ts` | 1 |
| `frontend_vue/tests/e2e/admin/warehouse/offcut-area.spec.ts` | 2 |
| `frontend_vue/tests/e2e/admin/warehouse/offcut-weight.spec.ts` | 4 |
| `frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts` | 2 |
| `frontend_vue/tests/e2e/admin/warehouse/warehouse-prefs.spec.ts` | 0 |
| `frontend_vue/tests/e2e/admin/warehouse/warehouse-visual.spec.ts` | 0 |

Два последних файла не тронуты: в них после действий нет утверждений без бюджета
(`warehouse-prefs` все свои `expect.poll` и `toHaveValue` ведёт через `waitForDataReady`; у
`warehouse-visual` снимки, а бюджет снимков живёт в `SNAPSHOT_OPTIONS` и сторожится отдельным
спеком).

**Действием признан `navigateToAdmin`.** Он зовёт внутри `waitForDataReady`, и это записано в
шапке сторожа прямым текстом: проверяется записанное (перечень действий из задачи и плана), а не
подразумеваемое. Именно эти пятнадцать мест и названы в поле `почему_не_сделано` задания:
шесть + одно + два + четыре + два.

Правка состоит из ВТОРОГО АРГУМЕНТА и только его: `{ timeout: DATA_READY_TIMEOUT }`. Селекторы,
ожидаемые значения, регулярные выражения, `not.` и `.soft` не менялись. Импорт не добавлялся ни
в один файл: `DATA_READY_TIMEOUT` уже был импортирован из `../../helpers/ready` во всех пяти
тронутых спеках, и второго экземпляра самого числа в каталоге нет.

Больше ничего не трогалось: `expect.poll(...)` и их числовые опции — на месте, файлы
`frontend_vue/tests/e2e/helpers/` — не изменялись, `frontend_vue/playwright.config.ts` — не
изменялся, эталоны снимков и `SNAPSHOT_OPTIONS` — не изменялись.

## Сторож

`frontend_vue/src/services/expectBudgetWarehouse.spec.ts` — витэст, окружение `node`, по образцу
`expectUrlBudget.spec.ts`. Держит ровно семь файлов каталога и утверждает: разбор читает все семь
спеков и находит больше двухсот утверждений; класс «сразу после действия» не пуст; каждое
утверждение этого класса несёт опцию ожидания; опция взята из `DATA_READY_TIMEOUT`, а не записана
числом; `DATA_READY_TIMEOUT` приходит импортом из помощника `ready`.

Два разбора в стороже сделаны намеренно узко. Вызов собирается целиком, вместе с переносами и
цепочкой (`.not.`, `.toHaveText(...)`) — иначе многострочный `expect` читался бы как «без опции».
`expect.poll(...)` из разбора исключён: у него свой предмет и свои опции, и требовать поверх них
второй бюджет было бы второй правкой того же места.

## Мутационная проверка сторожа

Сторож доказывается не зелёным прогоном, а красным на сломанном: зелёным он был и до правки.

У одного утверждения, которому эта задача дала бюджет, второй аргумент снят целиком — в
`offcut-area.spec.ts` у проверки `toHaveValue('500 mm')`.

```
cd frontend_vue && npx vitest run src/services/expectBudgetWarehouse.spec.ts
```

Код возврата: 1. Вывод, значимая часть:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0022/run-2/wt-expect-budget-after-action-warehouse-specs/frontend_vue

 ❯ src/services/expectBudgetWarehouse.spec.ts (6 tests | 1 failed) 18ms
     × каждое утверждение после действия несёт опцию ожидания 8ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudgetWarehouse.spec.ts > бюджет ожидания у утверждений каталога склада > каждое утверждение после действия несёт опцию ожидания
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/warehouse/offcut-area.spec.ts:18",
+ ]

 ❯ src/services/expectBudgetWarehouse.spec.ts:129:23
    127|       .filter((a) => !a.text.includes('timeout:'))
    128|       .map((a) => `${a.rel}:${a.line}`)
    129|     expect(offenders).toEqual([])
       |                       ^
    130|   })
    131|

 Test Files  1 failed (1)
      Tests  1 failed | 5 passed (6)
   Start at  02:21:52
   Duration  331ms (transform 62ms, setup 0ms, import 94ms, tests 18ms, environment 0ms)

exit=1
```

Нарушитель назван этим самым файлом и строкой внутри него — то есть сторож не «что-то роняет», а
указывает, кого чинить. Координата относится к МУТИРОВАННОЙ версии файла; после возврата
`DATA_READY_TIMEOUT` сторож снова зелёный — прогон ниже.

```
cd frontend_vue && npx vitest run src/services/expectBudgetWarehouse.spec.ts src/services/snapshotBudget.spec.ts src/services/expectUrlBudget.spec.ts src/services/expectBudget.spec.ts
```

Код возврата: 0. Вывод:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0022/run-2/wt-expect-budget-after-action-warehouse-specs/frontend_vue


 Test Files  4 passed (4)
      Tests  16 passed (16)
   Start at  02:22:33
   Duration  357ms (transform 216ms, setup 0ms, import 418ms, tests 41ms, environment 1ms)

exit=0
```

Четыре сторожа шли одним прогоном: новый складской, снимков, `toHaveURL` и товарный. Сторож
`snapshotBudget.spec.ts` заодно подтверждает запрет: глобальный `expect.timeout` в
`playwright.config.ts` не поднят.

### Та же мутация на полном `npm run test:unit`

Критерий приёмки называет буквально `npm run test:unit`, а не выборочный прогон, поэтому мутация
повторена целиком — тем же снятием второго аргумента у той же проверки `toHaveValue('500 mm')`.

```
cd frontend_vue && npm run test:unit
```

Код возврата: 1. Полный вывод — 1084 строки, из которых около тысячи занимает отчёт резолвера
ссылок по 67 документам (он печатается тем же прогоном и к этой задаче отношения не имеет: те же
битые ссылки, что и раньше, ни одной новой). Ниже — заголовок прогона, падение целиком и вердикт:

```
> flexiron-frontend@0.1.0 test:unit
> vitest run


 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0022/run-2/wt-expect-budget-after-action-warehouse-specs/frontend_vue

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudgetWarehouse.spec.ts > бюджет ожидания у утверждений каталога склада > каждое утверждение после действия несёт опцию ожидания
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/warehouse/offcut-area.spec.ts:18",
+ ]

 ❯ src/services/expectBudgetWarehouse.spec.ts:129:23
    127|       .filter((a) => !a.text.includes('timeout:'))
    128|       .map((a) => `${a.rel}:${a.line}`)
    129|     expect(offenders).toEqual([])
       |                       ^
    130|   })
    131|

 Test Files  1 failed | 80 passed (81)
      Tests  1 failed | 1232 passed | 3 skipped (1236)
   Start at  02:27:39
   Duration  21.49s (transform 21.32s, setup 0ms, import 49.29s, tests 56.40s, environment 13.23s)
```

Возвращаю второй аргумент и гоняю тот же `npm run test:unit` на зелёном.

```
cd frontend_vue && npm run test:unit
```

Код возврата: 0. Полный вывод — 1071 строка; ниже заголовок и вердикт:

```
> flexiron-frontend@0.1.0 test:unit
> vitest run


 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0022/run-2/wt-expect-budget-after-action-warehouse-specs/frontend_vue

 Test Files  81 passed (81)
      Tests  1233 passed | 3 skipped (1236)
```

**Почему приведена значимая часть, а не вывод дословно целиком.** Полный вывод `test:unit` — это
сводка по 81 файлу; строки падения, вердикт и числа приведены как их напечатал витэст, а около
тысячи строк отчёта резолвера ссылок опущены: они одинаковы в обоих прогонах, говорят о чужих
документах и к правке отношения не имеют. Всё, что относится к проверяемому — падение с именем
файла и строкой, оба вердикта и оба счётчика, — приведено без сокращений.

## Замер вместо инверсии

Нагрузку не создавали: машина общая, команды `yes`, `stress`, `pkill`, `killall` в этой задаче
запрещены. Вместо инверсии — замер фактического времени одного тронутого перехода вместе со
следующим за ним утверждением.

Инструментировано место `a sheet offcut shows the area computed from its dimensions` в
`frontend_vue/tests/e2e/admin/warehouse/offcut-area.spec.ts`: `Date.now()` перед
`navigateToAdmin`, `Date.now()` после утверждения с бюджетом, разница напечатана. Инструментация
снята до прогона семи спеков — в кандидате её нет, проверено грепом (пусто, код возврата 1).

```
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/offcut-area.spec.ts -g "a sheet offcut shows the area" --reporter=line
```

Код возврата: 0. Вывод:

```
Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/warehouse/offcut-area.spec.ts:16:3 › Offcut area › a sheet offcut shows the area computed from its dimensions
[1/1] [chromium] › tests/e2e/admin/warehouse/offcut-area.spec.ts:16:3 › Offcut area › a sheet offcut shows the area computed from its dimensions
[замер] переход → утверждение: 2599 мс против 5000 мс

  1 passed (6.5s)
exit=0
```

## Вывод по замеру

2599 мс против прежнего потолка 5000 мс — запас меньше двукратного, и это В ОТЛИЧИЕ от
товарного замера (566 мс против 5000, запас почти девятикратный). То есть на складе бюджет
поставлен как **страховка на будущее** ровно в том смысле, в каком это слово употреблено в
плане, — но страховка не свободная: половина прежнего потолка уже съедена переходом. Замер снят
без нагрузки, машина общая, и потолок `expect` вместе с нагрузкой не растягивается — этим он и
отличается от потолка теста в 90 с. Инверсию под нагрузкой не делали: запрещено. Здесь важно не
переоценить результат: зелёным спек, скорее всего, был бы и без правки, а число говорит о
тонком, а не о пробитом запасе.

## Прогон семи спеков

Команда:

```
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/warehouse.spec.ts tests/e2e/admin/warehouse/warehouse-map.spec.ts tests/e2e/admin/warehouse/warehouse-prefs.spec.ts tests/e2e/admin/warehouse/warehouse-visual.spec.ts tests/e2e/admin/warehouse/offcut-area.spec.ts tests/e2e/admin/warehouse/offcut-weight.spec.ts tests/e2e/admin/warehouse/cutting.spec.ts --reporter=line > "$TMPDIR/warehouse-run.txt" 2>&1; echo "exit=$?"
```

Код возврата: 0. Вывод сохранён в файл целиком (110 строк) и ниже приведён дословно, с одной
оговорённой изъятием: сняты непечатаемые управляющие ANSI-последовательности, которыми
`--reporter=line` перерисовывает строку прогресса. Имена тестов, их порядок, координаты и
итоговая строка — как их напечатал Playwright:

```
Running 106 tests using 4 workers

[1/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:118:3 › Cutting operation › заголовок панели печатается один раз, а не дважды
[2/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:76:3 › Cutting operation › поиск партии не теряет фокус на каждой букве
[3/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:130:3 › Cutting operation › кнопка смены партии подписана собой, а не текстом подсказки
[4/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:147:3 › Cutting operation › строка раскроя удаляется иконкой, как везде в проекте
[5/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:162:3 › Cutting operation › отступы заданы классами, инлайнового style в разметке не осталось
[6/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:182:3 › Cutting operation › список партий листается, а не вываливается целиком
[7/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:226:3 › Cutting operation › the offcuts tab leads to cutting, not to the manual offcut form
[8/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:236:3 › Cutting operation › the batch card carries its batch into the operation
[9/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:248:3 › Cutting operation › a batch opened by its direct link still names the product
[10/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:275:3 › Cutting operation › the example from the spec: 2500 mm plus a 3 mm kerf is 2.503 m
[11/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:286:3 › Cutting operation › pieces are counted, material is measured
[12/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:297:3 › Cutting operation › kerf and waste are added as separate amounts
[13/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:308:3 › Cutting operation › a second kind of piece adds its own cuts
[14/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:320:3 › Cutting operation › the kerf field is absent where a kerf cannot be expressed
[15/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:336:3 › Cutting operation › a piece with no size refuses the operation and names the piece
[16/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:354:3 › Cutting operation › cutting more than the batch holds is refused
[17/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:367:3 › Cutting operation › executing takes exactly the computed amount off the batch
[18/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:402:3 › Cutting operation › the piece cut off shows up among the offcuts
[19/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:436:3 › Cutting operation › a counted batch loses source pieces, not the offcuts cut out of them
[20/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:458:3 › Cutting operation › the counted batch asks how many pieces went in — it cannot be derived
[21/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:474:3 › Cutting operation › a measured batch is never asked for source pieces
[22/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:483:3 › Cutting operation › a counted batch takes exactly one piece off the batch when one is cut
[23/106] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:515:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[24/106] [chromium] › tests/e2e/admin/warehouse/offcut-area.spec.ts:16:3 › Offcut area › a sheet offcut shows the area computed from its dimensions
[25/106] [chromium] › tests/e2e/admin/warehouse/offcut-area.spec.ts:26:3 › Offcut area › a linear offcut has no area, and says so with a dash
[26/106] [chromium] › tests/e2e/admin/warehouse/offcut-area.spec.ts:36:3 › Offcut area › the create form recomputes the area as the dimensions are typed
[27/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:18:3 › Offcut weight: manual vs derived › a seeded offcut says its weight was entered by hand
[28/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:26:3 › Offcut weight: manual vs derived › the computed number is shown BEFORE the button is pressed
[29/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:35:3 › Offcut weight: manual vs derived › pressing it clears the manual value and the derived one answers
[30/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:50:3 › Offcut weight: manual vs derived › a difference of times over is visible before the choice
[31/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:59:3 › Offcut weight: manual vs derived › where the weight cannot be derived, the reason is named and no button is offered
[32/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:71:3 › Offcut weight: manual vs derived › the manual value survives a save and still reads as manual
[33/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:103:3 › Offcut weight on the create form › the form proposes a weight before anything is saved
[34/106] [chromium] › tests/e2e/admin/warehouse/offcut-weight.spec.ts:116:3 › Offcut weight on the create form › typing a weight by hand switches the source and offers the way back
[35/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:67:3 › Warehouse map › loads without console errors
[36/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:85:3 › Warehouse map › starts empty — no map, no broken image
[37/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:92:3 › Warehouse map › the warehouse page links here
[38/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:101:3 › Warehouse map › uploading a map makes the link point at the uploaded file
[39/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:118:3 › Warehouse map › the map is read back on the next visit, not held in the page
[40/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:130:3 › Warehouse map › replacing asks first, then the link points at the new file
[41/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:154:3 › Warehouse map › cancelling the replacement keeps the old map
[42/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:170:3 › Warehouse map › deleting asks first, then leaves the empty state
[43/106] [chromium] › tests/e2e/admin/warehouse/warehouse-map.spec.ts:199:3 › Warehouse map › a file that is not an image never becomes the map
[44/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:63:5 › Warehouse view preferences › Stock tab › save view writes the current sort, not only the filters
[45/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:92:5 › Warehouse view preferences › Stock tab › saved sort survives a reload and gives the same order as clicking the column
[46/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:119:5 › Warehouse view preferences › Stock tab › saved search survives a reload and narrows the table
[47/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:144:7 › Warehouse view preferences › Remaining tabs restore their own filters › batches tab restores the saved search
[48/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:144:7 › Warehouse view preferences › Remaining tabs restore their own filters › offcuts tab restores the saved search
[49/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:144:7 › Warehouse view preferences › Remaining tabs restore their own filters › movements tab restores the saved search
[50/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:144:7 › Warehouse view preferences › Remaining tabs restore their own filters › deficit tab restores the saved search
[51/106] [chromium] › tests/e2e/admin/warehouse/warehouse-prefs.spec.ts:157:3 › Warehouse view preferences › malformed preferences do not break the page
[52/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:74:5 › Warehouse · visual › вкладка stock — эталон строки
[53/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:74:5 › Warehouse · visual › вкладка batches — эталон строки
[54/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:74:5 › Warehouse · visual › вкладка offcuts — эталон строки
[55/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:74:5 › Warehouse · visual › вкладка movements — эталон строки
[56/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:74:5 › Warehouse · visual › вкладка deficit — эталон строки
[57/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:90:5 › Warehouse · visual › вкладка movements — эталон статусной пилюли
[58/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:90:5 › Warehouse · visual › вкладка batches — эталон статусной пилюли
[59/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:99:3 › Warehouse · visual › панель фильтров склада
[60/106] [chromium] › tests/e2e/admin/warehouse/warehouse-visual.spec.ts:107:3 › Warehouse · visual › карточка партии — шапка со статусной пилюлей
[61/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:39:5 › Warehouse module › Page layout › should display all warehouse tabs
[62/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:49:5 › Warehouse module › Page layout › should display filters bar
[63/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:55:5 › Warehouse module › Stock tab › should display stock overview table
[64/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:60:5 › Warehouse module › Stock tab › should have stock filters
[65/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:88:5 › Warehouse module › Stock tab › во время фильтрации таблица накрыта скелетом, а не пустым местом
[66/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:125:5 › Warehouse module › Stock tab › should have pagination for stock
[67/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:129:5 › Warehouse module › Stock tab › should navigate to stock card on view button click
[68/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:137:5 › Warehouse module › Batches tab › should display batches list
[69/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:145:5 › Warehouse module › Batches tab › should have batch filters
[70/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:154:5 › Warehouse module › Batches tab › should navigate to batch card on view button click
[71/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:165:5 › Warehouse module › Batch card › should display batch details
[72/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:171:5 › Warehouse module › Batch card › should show error state when batch not found
[73/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:182:5 › Warehouse module › Offcuts tab › should display offcuts list
[74/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:190:5 › Warehouse module › Offcuts tab › should have offcut filters
[75/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:199:5 › Warehouse module › Offcuts tab › should have new offcut button in toolbar
[76/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:207:5 › Warehouse module › Offcuts tab › should navigate to offcut card on view button click
[77/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:218:5 › Warehouse module › Offcuts tab › should mark offcut as used (in_production) via quick action
[78/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:226:5 › Warehouse module › Offcuts tab › should mark offcut as scrapped via quick action
[79/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:236:5 › Warehouse module › Offcut card › should display offcut details
[80/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:242:5 › Warehouse module › Offcut card › should display offcut sections
[81/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:249:5 › Warehouse module › Offcut card › should show error state when offcut not found
[82/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:260:5 › Warehouse module › Movements tab › should display movements list
[83/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:268:5 › Warehouse module › Movements tab › every movement type is a label, not the key behind it
[84/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:325:5 › Warehouse module › Movements tab › should have movement filters
[85/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:334:5 › Warehouse module › Movements tab › should navigate to movement card on view button click
[86/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:347:5 › Warehouse module › Movement card › should display movement details
[87/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:353:5 › Warehouse module › Movement card › should show error state when movement not found
[88/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:364:5 › Warehouse module › Deficit tab › should display deficit list
[89/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:372:5 › Warehouse module › Deficit tab › should have deficit filters
[90/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:381:5 › Warehouse module › Deficit tab › should navigate to deficit card on view button click
[91/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:392:5 › Warehouse module › Deficit tab › should mark deficit as in_progress via quick action
[92/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:400:5 › Warehouse module › Deficit tab › should mark deficit as resolved via quick action
[93/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:410:5 › Warehouse module › Deficit card › should display deficit details
[94/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:416:5 › Warehouse module › Deficit card › should show error state when deficit not found
[95/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:427:5 › Warehouse module › Stock card › should display stock card details
[96/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:435:5 › Warehouse module › Stock card › should show error state when stock item not found
[97/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:450:5 › Warehouse module › Movements tab — no create button › should NOT have a new movement button in toolbar
[98/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:476:5 › Warehouse module › Batch create page › should load with product selection panel and form sections
[99/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:496:5 › Warehouse module › Batch create page › should allow product selection via radio button
[100/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:506:5 › Warehouse module › Batch create page › should show validation errors on empty form submit
[101/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:517:5 › Warehouse module › Batch create page › should save and redirect to batch card on valid form submit
[102/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:532:5 › Warehouse module › Batch create page › should cancel and return to batches list
[103/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:538:5 › Warehouse module › Batch create page › should have search and category filter for products
[104/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:556:5 › Warehouse module › Offcut create page › should load with all sections including files
[105/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:578:5 › Warehouse module › Offcut create page › should show batch selection panel after selecting a product
[106/106] [chromium] › tests/e2e/admin/warehouse/warehouse.spec.ts:588:5 › Warehouse module › Offcut create page › should cancel and return to offcuts list
  106 passed (2.6m)
```

Ни одной строки `failed`, `flaky` или `skipped` в выводе нет; вердикт снят по коду возврата (0) и
по последней строке `106 passed`, а не по одному числу `passed`. Вывод был сохранён в файл
целиком — конвейера `| tail` в команде нет, потому что он вернул бы код возврата `tail`, а строку
`N failed` Playwright печатает ВЫШЕ `N passed`.

## Контракт: ссылка на спек карты склада

`roo_code/roo-context/api/uploads.md` ссылается на `warehouse-map.spec.ts` в двух местах одного
предложения — правило домена 7. Первое, про хелпер, ведёт на строки 23-24, где и лежит
объявление `uploadMap`. Второе, про отказ по типу, вело на устаревший диапазон: этот спек
правится не первый раз, и строки уехали. Диапазон исправлен и в самом предложении назван тест,
о котором речь, — чтобы предложение и ссылка говорили одно и то же. Правильность номера
проверена чтением файла: на первой строке диапазона стоит
`test('a file that is not an image never becomes the map'`, то есть ровно тот тест, о котором
говорит предложение, а диапазон накрывает его до закрывающей скобки.

Команда:

```
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/uploads.md ./node_modules/.bin/vitest run src/services/contractRefs.spec.ts
```

Код возврата: 0. Вывод:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-0022/run-2/wt-expect-budget-after-action-warehouse-specs/frontend_vue

roo_code/roo-context/api/uploads.md: ссылок 194, битых 3, глазами 13, без токена 129
  roo_code/roo-context/api/uploads.md:236 → core/uploads/action.py:85-93 — нет токена в диапазоне: в 85-93 нет ни одного из: «store_file», «db.commit()»
  roo_code/roo-context/api/uploads.md:253 → types/category.ts:4-4 — нет токена в диапазоне: в 4-4 нет ни одного из: «CategoryFieldType»
  roo_code/roo-context/api/uploads.md:300 → backend/app/main.py:74-74 — нет токена в диапазоне: в 74-74 нет ни одного из: «lifespan»
[ссылки] документов 1 · ссылок 194 · битых 3

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  02:22:34
   Duration  313ms (transform 69ms, setup 0ms, import 91ms, tests 53ms, environment 0ms)

exit=0
```

Три битых ссылки — не мои и не про склад: все три лежат ВЫШЕ правленого места, правка их не
сдвигала, и каждая названа координатой, к которой эта задача не прикасалась. Ни одна из ссылок на
спек карты склада в списке битых не появилась — значит обе ведут туда, где токен из того же
предложения действительно есть. Устаревший диапазон я починил, чужие старые ссылки — не трогал.

## Чего НЕ делали

- Нагрузку не создавали: команды `yes`, `stress`, `pkill`, `killall` в этой задаче запрещены,
  машина общая. Поэтому вместо инверсии под нагрузкой — замер фактического времени (выше).
- `frontend_vue/playwright.config.ts` не тронут; сторож `snapshotBudget.spec.ts` зелёный и
  подтверждает, что глобальный `expect.timeout` в конфиге не поднят.
- Вызовы `expect.poll(...)` и их числовые опции не тронуты.
- Файлы `frontend_vue/tests/e2e/helpers/` не тронуты.
- `refs_shift.py` не запускался.
- `warehouse-prefs.spec.ts` и `warehouse-visual.spec.ts` не тронуты: в них нет утверждений класса
  «сразу после действия».

## Что гонялось, а что ожидает контроллера

Гонялось в песочнице исполнителя:

- `npm run test:unit` — красный под мутацией (код возврата 1) и зелёный после возврата (код
  возврата 0, 81 файл, 1233 passed | 3 skipped); оба прогона в разделе выше;
- `npx vitest run` по четырём сторожам — зелёный, код возврата 0;
- `npx playwright test` по семи тронутым спекам — зелёный, код возврата 0, `106 passed`;
- `npx playwright test` инструментированного места — зелёный, код возврата 0, замер 2599 мс;
- `CONTRACT_REFS=roo_code/roo-context/api/uploads.md npx vitest run src/services/contractRefs.spec.ts`
  — зелёный, код возврата 0;
- `npm run dupes` — зелёный, код возврата 0: 628 клонов, `Total` 6.41 % при пороге 10 %;
- `npx prettier --check` по тронутым файлам и сторожу — зелёный, код возврата 0.

Ожидает контроллера: `npm run verify` целиком — шаги `typecheck`, `lint` и `format:check` по всему
дереву в песочнице исполнителя не гонялись. `format:check` по СВОИМ файлам гонялся и зелёный, но
это не то же самое, что гейт по `src/` и `tests/`.

## Координаты внутри приведённых выводов

Числа после имени файла в разделах выше — не ссылки журнала, а дословный текст, напечатанный
Playwright и витэстом. Они сняты ПОСЛЕ правки спеков, поэтому перенумерации не подлежат: это
запись того, что инструмент сказал, а не указание, куда смотреть. Проверено чтением: каждая
координата из вывода Playwright указывает на тот самый тест, который назван рядом с ней, а
координата из вывода витэста — на утверждение, у которого мутация сняла второй аргумент.
