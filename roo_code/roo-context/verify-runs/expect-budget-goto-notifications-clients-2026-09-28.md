# Бюджет утверждениям после голых `page.goto` — уведомления, sales-crm, followups, клиенты, layout, категории

Задача: `expect-budget-goto-notifications-clients-group`. Класс П1 плана потолков ожиданий —
утверждение о странице или локаторе, стоящее ПЕРВЫМ после `page.goto(...)`, между которым и
переходом нет ожидалки готовности (`waitForDataReady`, `openAdminPage`, `openAdminCard`,
`navigateToAdmin`). Пол у такого утверждения отсутствует по построению, а дефолтный потолок
`expect` — пять секунд — под нагрузкой не растёт (растёт только потолок теста, 90 с в
`playwright.config.ts`).

Сторож `expectBudgetGoto.spec.ts` держал три файла. Задача расширила его список до девяти —
прежние три (`navigation`, `feature-flags-matrix`, спек настроек) и шесть новых: уведомления,
sales-crm, followups-list1, клиенты, layout, категории товаров. Правка добавила нарушителям
второй аргумент `{ timeout: DATA_READY_TIMEOUT }`, взятый импортом из
`tests/e2e/helpers/ready.ts`. Смысл утверждений не менялся: ни селектор, ни ожидаемое значение,
ни регулярное выражение, ни отрицание, ни `.soft`.

## Что тронуто

- `frontend_vue/tests/e2e/admin/notifications/notifications.spec.ts` — восемь первых утверждений
  после голого перехода получили бюджет: страница уведомлений, её шапка, хлебные крошки, панель
  фильтров, таблица, пагинация, первая строка (в тесте перехода по уведомлению) и колокольчик в
  шапке. Остальные переходы уже стоят за `waitForDataReady` либо первое утверждение после них —
  `toHaveURL` с бюджетом.
- `frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts` — бюджет получило единственное
  первое утверждение после перехода: видимость блока KPI. Второе утверждение того же теста
  (после двух `goBack`) бюджет уже несло и осталось как было.
- `frontend_vue/tests/e2e/admin/followups-list1.spec.ts` — восемь первых утверждений после голых
  переходов: ссылки в шапке карточки партии и настроек поставщика, ссылка на раскрой в двух
  тестах, три утверждения о строке почты и две кнопки шапки Sales CRM.
- `frontend_vue/src/services/expectBudgetGoto.spec.ts` — список расширен до девяти файлов,
  добавлены пороги `BUDGETS_FLOOR` по факту замера, в `READY` добавлен `stabilizeForSnapshot`
  (он зовёт `waitForDataReady`, а первое утверждение после него — снимок со своим бюджетом в
  `SNAPSHOT_OPTIONS`).
- Файлы `clients.spec.ts`, `layout.spec.ts`, `categories.spec.ts` входили в outputs, но правок не
  потребовали: разбор сторожа нарушений в них не нашёл — первые утверждения после голых переходов
  там уже несут бюджет либо стоят за ожидалкой. Их содержимое не изменено.

## Прогон 1. Формат всех файлов задачи

Команда:

```bash
cd frontend_vue && npx prettier --write src/services/expectBudgetGoto.spec.ts tests/e2e/admin/notifications/notifications.spec.ts tests/e2e/admin/sales-crm/sales-crm.spec.ts tests/e2e/admin/followups-list1.spec.ts tests/e2e/admin/clients/clients.spec.ts tests/e2e/admin/layout.spec.ts tests/e2e/admin/products/categories.spec.ts > "$TMPDIR/prettier.log" 2>&1; echo "PRETTIER_EXIT=$?" | tee -a "$TMPDIR/prettier.log"; cat "$TMPDIR/prettier.log"
```

Код возврата: 0. Вывод целиком:

```
PRETTIER_EXIT=0
src/services/expectBudgetGoto.spec.ts 110ms (unchanged)
tests/e2e/admin/notifications/notifications.spec.ts 38ms (unchanged)
tests/e2e/admin/sales-crm/sales-crm.spec.ts 9ms (unchanged)
tests/e2e/admin/followups-list1.spec.ts 62ms (unchanged)
tests/e2e/admin/clients/clients.spec.ts 100ms (unchanged)
tests/e2e/admin/layout.spec.ts 43ms (unchanged)
tests/e2e/admin/products/categories.spec.ts 61ms (unchanged)
PRETTIER_EXIT=0
```

## Прогон 2. Пофайловый счёт бюджетов

Команда:

```bash
cd frontend_vue && grep -c "timeout: DATA_READY_TIMEOUT" tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts tests/e2e/admin/notifications/notifications.spec.ts tests/e2e/admin/sales-crm/sales-crm.spec.ts tests/e2e/admin/followups-list1.spec.ts tests/e2e/admin/clients/clients.spec.ts tests/e2e/admin/layout.spec.ts tests/e2e/admin/products/categories.spec.ts > "$TMPDIR/budgets.log" 2>&1; echo "GREP_BUDGETS_EXIT=$?" | tee -a "$TMPDIR/budgets.log"; cat "$TMPDIR/budgets.log"
```

Код возврата: 0. Вывод целиком:

```
GREP_BUDGETS_EXIT=0
tests/e2e/navigation.spec.ts:14
tests/e2e/feature-flags-matrix.spec.ts:19
tests/e2e/admin/settings/settings.spec.ts:34
tests/e2e/admin/notifications/notifications.spec.ts:20
tests/e2e/admin/sales-crm/sales-crm.spec.ts:4
tests/e2e/admin/followups-list1.spec.ts:37
tests/e2e/admin/clients/clients.spec.ts:50
tests/e2e/admin/layout.spec.ts:44
tests/e2e/admin/products/categories.spec.ts:37
GREP_BUDGETS_EXIT=0
```

Это и есть замеренные полы, записанные в сторож как `BUDGETS_FLOOR`: 14 / 19 / 34 / 20 / 4 / 37 /
50 / 44 / 37. Три первых числа — из прежней задачи, шесть новых — сняты здесь. У `sales-crm`
порог равен четырём и не мог быть больше: в спеке один голый переход, и первое утверждение после
него одно.

## Прогон 3. Числового потолка в девяти спеках нет

Команда:

```bash
cd frontend_vue && grep -nE "timeout:[[:space:]]*[0-9]" tests/e2e/navigation.spec.ts tests/e2e/feature-flags-matrix.spec.ts tests/e2e/admin/settings/settings.spec.ts tests/e2e/admin/notifications/notifications.spec.ts tests/e2e/admin/sales-crm/sales-crm.spec.ts tests/e2e/admin/followups-list1.spec.ts tests/e2e/admin/clients/clients.spec.ts tests/e2e/admin/layout.spec.ts tests/e2e/admin/products/categories.spec.ts > "$TMPDIR/numeric.log" 2>&1; echo "NUMERIC_EXIT=$?" | tee -a "$TMPDIR/numeric.log"; cat "$TMPDIR/numeric.log"
```

Код возврата: 1 — совпадений нет, и это ожидаемый исход. Вывод целиком:

```
NUMERIC_EXIT=1
NUMERIC_EXIT=1
```

Числового потолка вида `timeout: 5000` ни в одном из девяти спеков не осталось: все опции взяты
идентификатором `DATA_READY_TIMEOUT`.

## Прогон 4. Сторож голых переходов

Команда:

```bash
cd frontend_vue && npx vitest run src/services/expectBudgetGoto.spec.ts > "$TMPDIR/guard-after.log" 2>&1; echo "GUARD_AFTER_EXIT=$?"; sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$TMPDIR/guard-after.log"
```

Код возврата: 0. Вывод целиком:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-expect-budget-goto-notifications-clients-group/frontend_vue


 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  22:16:49
   Duration  184ms (transform 38ms, setup 0ms, import 62ms, tests 7ms, environment 0ms)




GUARD_AFTER_EXIT=0
```

Сторож доказывает непустоту разбора отдельными утверждениями: непустота у каждого из девяти
файлов и общая сумма найденных утверждений не меньше сотни. Пустой разбор краснеет.

Соседние сторожа, читающие те же файлы, не задеты расширением списка. Команда:

```bash
cd frontend_vue && npx vitest run src/services/snapshotBudget.spec.ts src/services/expectBudgetFollowups.spec.ts src/services/expectBudgetGoto.spec.ts
```

Код возврата: 0. Вывод целиком:

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-expect-budget-goto-notifications-clients-group/frontend_vue


 Test Files  3 passed (3)
      Tests  18 passed (18)
   Start at  22:28:02
   Duration  214ms (transform 135ms, setup 0ms, import 208ms, tests 21ms, environment 1ms)

VITEST_EXIT=0
```

`snapshotBudget.spec.ts` здесь не формальность: он отдельно стережёт, что глобального
`expect: { timeout }` в `playwright.config.ts` нет (ЗАПРЕТ 1) и что `DATA_READY_TIMEOUT` остался
ровно 30 000. `playwright.config.ts` в этой задаче не тронут.

## Прогон 5. Шесть тронутых спеков Playwright

Команда:

```bash
cd frontend_vue && npx playwright test tests/e2e/admin/notifications/notifications.spec.ts tests/e2e/admin/sales-crm/sales-crm.spec.ts tests/e2e/admin/followups-list1.spec.ts tests/e2e/admin/clients/clients.spec.ts tests/e2e/admin/layout.spec.ts tests/e2e/admin/products/categories.spec.ts --reporter=dot > "$TMPDIR/pw-dot.log" 2>&1; echo "PW_DOT_EXIT=$?" | tee -a "$TMPDIR/pw-dot.log"; sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$TMPDIR/pw-dot.log"
```

Код возврата: 0. Вывод целиком:

```

Running 185 tests using 4 workers
················································································
················································································
·························
  185 passed (4.0m)
PW_DOT_EXIT=0
```

## Прогон 6. Замер фактического времени ожидания

Инверсия под нагрузкой запрещена условиями задачи и общей машины, поэтому доказательство —
замер: сколько миллисекунд ожидание идёт на самом деле, против дефолтного потолка в 5000 мс.

Замер шёл из `$TMPDIR` (временный каталог задачи), а не из репозитория: файл спека и конфиг
лежат рядом, `testDir` указывает на `$TMPDIR`. Ни одного файла проекта замер не тронул — и это
видно в `git status` в конце: временных файлов в рабочем дереве нет. Порт — свой, `PW_PORT=5400`
из окружения. Три случая — те же локаторы, что стоят первыми после `page.goto` в тронутых
тестах: страница уведомлений, блок KPI Sales CRM и строка почты. На каждый случай — по пять
итераций «переход, затем ожидание видимости локатора».

Команда:

```bash
cd frontend_vue && FRONT_DIR=$PWD npx playwright test --config="$TMPDIR/expect-timing.config.js" > "$TMPDIR/measure.log" 2>&1; echo "MEASURE_EXIT=$?" | tee -a "$TMPDIR/measure.log"; sed 's/\x1b\[[0-9;]*[A-Za-z]//g' "$TMPDIR/measure.log"
```

Код возврата: 0. Вывод целиком:

```

Running 3 tests using 1 worker

[1/3] [chromium] › ../../tmp-expect-budget-goto-notifications-clients-group/expect-timing.spec.js:10:3 › notifications-page
[chromium] › ../../tmp-expect-budget-goto-notifications-clients-group/expect-timing.spec.js:10:3 › notifications-page
MEASURE notifications-page [1104,342,346,347,295]

[2/3] [chromium] › ../../tmp-expect-budget-goto-notifications-clients-group/expect-timing.spec.js:10:3 › sales-crm-kpis
[chromium] › ../../tmp-expect-budget-goto-notifications-clients-group/expect-timing.spec.js:10:3 › sales-crm-kpis
MEASURE sales-crm-kpis [1171,996,1075,1075,1078]

[3/3] [chromium] › ../../tmp-expect-budget-goto-notifications-clients-group/expect-timing.spec.js:10:3 › mail-test-target
[chromium] › ../../tmp-expect-budget-goto-notifications-clients-group/expect-timing.spec.js:10:3 › mail-test-target
MEASURE mail-test-target [1117,1064,1094,1105,1078]

  3 passed (15.3s)
MEASURE_EXIT=0
```

### Числа и вывод по замеру

Миллисекунды на ожидание первого утверждения после `page.goto`, пять итераций:

| случай                                        | итерации                     | медиана | против потолка 5000 мс |
| --------------------------------------------- | ---------------------------- | ------- | ---------------------- |
| страница уведомлений (`/admin/notifications`) | 1104, 342, 346, 347, 295     | 346     | 7 % потолка            |
| блок KPI Sales CRM (`/admin/sales-crm`)       | 1171, 996, 1075, 1075, 1078  | 1075    | 22 % потолка           |
| строка почты (`/admin/settings/mail`)         | 1117, 1064, 1094, 1105, 1078 | 1094    | 22 % потолка           |

Машина при замере была непустой: рядом, на том же сервере проекта, шли чужие прогоны, а сам замер
шёл на своей базе и своём порту.

Вывод по замеру — прямой и без округления в удобную сторону. Ожидание данных после перехода
занимает от **0,3 с** (уведомления) до **1,1 с** (KPI Sales CRM и строка почты), то есть
**от одной пятнадцатой до примерно пятой части** дефолтного потолка в 5000 мс. Это ожидание
данных, а не клиентский переход: страницы запрашивают их после монтирования маршрута.

Отсюда бюджет поставлен как **страховка на будущее**, а не как починка наблюдаемой красноты:
при текущих числах до потолка остаётся четырёх- и пятикратный запас, и сегодня эти утверждения
зелены. Наблюдаемой близости к потолку (ожидания в 2,5–4 с) замер не показал: это была бы
отдельная находка, и её здесь нет.

## Прогон 7. Мутационная проверка сторожа

Критерий: снятие `{ timeout: DATA_READY_TIMEOUT }` у одного утверждения после `page.goto` в
`sales-crm.spec.ts` делает `expectBudgetGoto.spec.ts` красным — и по перечню нарушителей, и по
пофайловому счёту бюджетов. Мутирован файл из outputs, и снят ровно один второй аргумент:
у блока KPI в тесте `KPI counts include an order created after them`. Перед мутацией файл
сохранён копией в `$TMPDIR`, после проверки восстановлен из неё.

Команда мутации:

```bash
cd frontend_vue && cp tests/e2e/admin/sales-crm/sales-crm.spec.ts "$TMPDIR/sales-crm.before.spec.ts" && node -e "const fs=require('fs');const p='tests/e2e/admin/sales-crm/sales-crm.spec.ts';let s=fs.readFileSync(p,'utf8');const needle='toBeVisible({\n      timeout: DATA_READY_TIMEOUT,\n    })';const i=s.indexOf(needle);if(i<0){console.error('NEEDLE NOT FOUND');process.exit(2)}s=s.slice(0,i)+'toBeVisible()'+s.slice(i+needle.length);fs.writeFileSync(p,s);console.log('MUTATED offset='+i);const c=(fs.readFileSync(p,'utf8').match(/timeout:\s*DATA_READY_TIMEOUT/g)||[]).length;console.log('BUDGETS_NOW='+c)" 2>&1 | tee "$TMPDIR/mutation.log"; echo "MUTATE_EXIT=${PIPESTATUS[0]}" | tee -a "$TMPDIR/mutation.log"
```

Код возврата: 0. Вывод целиком:

```
MUTATED offset=1006
BUDGETS_NOW=3
MUTATE_EXIT=0
```

Счёт упал с 4 до 3 — мутация ровно одна, и она видна счётом.

Сторож на мутированном файле:

```bash
cd frontend_vue && npx vitest run src/services/expectBudgetGoto.spec.ts 2>&1 | tee "$TMPDIR/guard-mutated.log"; echo "GUARD_MUTATED_EXIT=${PIPESTATUS[0]}" | tee -a "$TMPDIR/guard-mutated.log"
```

Код возврата: 1. Вывод целиком (цветовые последовательности сняты, текст не правлен):

```

 RUN  v4.1.10 /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-expect-budget-goto-notifications-clients-group/frontend_vue

 ❯ src/services/expectBudgetGoto.spec.ts (7 tests | 2 failed) 19ms
     × каждое утверждение после перехода без ожидалки несёт опцию ожидания 9ms
     × бюджеты не сняты — в каждом файле их не меньше замеренного числа 2ms

⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/services/expectBudgetGoto.spec.ts > бюджет ожидания у утверждений после голого page.goto > каждое утверждение после перехода без ожидалки несёт опцию ожидания
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "tests/e2e/admin/sales-crm/sales-crm.spec.ts:26",
+ ]

 ❯ src/services/expectBudgetGoto.spec.ts:173:23
    171|       .filter((a) => !a.text.includes('timeout:'))
    172|       .map((a) => `${a.rel}:${a.line}`)
    173|     expect(offenders).toEqual([])
       |                       ^
    174|   })
    175|

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/services/expectBudgetGoto.spec.ts > бюджет ожидания у утверждений после голого page.goto > бюджеты не сняты — в каждом файле их не меньше замеренного числа
AssertionError: tests/e2e/admin/sales-crm/sales-crm.spec.ts: бюджетов стало меньше замеренного: expected 3 to be greater than or equal to 4
 ❯ src/services/expectBudgetGoto.spec.ts:201:77
    199|   it('бюджеты не сняты — в каждом файле их не меньше замеренного числ…
    200|     for (const [rel, floor] of Object.entries(BUDGETS_FLOOR)) {
    201|       expect(budgetCount(rel), `${rel}: бюджетов стало меньше замер…
       |                                                                             ^
    202|         floor,
    203|       )

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
   Start at  22:15:00
   Duration  243ms (transform 45ms, setup 0ms, import 77ms, tests 19ms, environment 0ms)

GUARD_MUTATED_EXIT=1
```

Оба нарушения названы: перечень — файлом `tests/e2e/admin/sales-crm/sales-crm.spec.ts` и номером
снятого бюджета, счёт — `expected 3 to be greater than or equal to 4`. Критерий выполнен.

Номера, стоящие в выводе выше, — с момента прогона, и с тех пор не ездили. Утверждение, у
которого снимался бюджет, и сейчас стоит на `tests/e2e/admin/sales-crm/sales-crm.spec.ts:26` —
селектор `sales-crm-kpis`.

Перечень нарушителей строится на `src/services/expectBudgetGoto.spec.ts:173` — `offenders`.

Счёт бюджетов — на `src/services/expectBudgetGoto.spec.ts:201` — `budgetCount`.

Что делалось после этого. Снятый бюджет возвращён на место, файл отформатирован, и сторож
прогнан снова. Команда:

```bash
cd frontend_vue && npx prettier --write tests/e2e/admin/sales-crm/sales-crm.spec.ts >/dev/null 2>&1; diff -u "$TMPDIR/sales-crm.before.spec.ts" tests/e2e/admin/sales-crm/sales-crm.spec.ts && echo "RESTORED_IDENTICAL"; grep -c "timeout: DATA_READY_TIMEOUT" tests/e2e/admin/sales-crm/sales-crm.spec.ts
```

Код возврата: 0. Вывод целиком:

```
RESTORED_IDENTICAL
4
```

`RESTORED_IDENTICAL` — файл побайтово совпал с копией «до» мутации: возвращён ровно один снятый
аргумент, ничего лишнего. Счёт вернулся к 4.

## Прогон 8. Ссылки в документах: построчное сравнение до и после

Отчёт резолвера снят дважды и сравнён построчно, а не по итоговому числу: итог падает на чужой
чистке и прячет рост. «До» — на HEAD-версиях трёх тронутых спеков (их пришлось вернуть из `git`,
иначе снимать «до» было не из чего: резолвер читает файлы с диска от корня репозитория). «После»
— на правленых.

Команды:

```bash
cd frontend_vue && cp tests/e2e/admin/notifications/notifications.spec.ts "$TMPDIR/notifications.after.spec.ts" && cp tests/e2e/admin/followups-list1.spec.ts "$TMPDIR/followups.after.spec.ts" && git show HEAD:frontend_vue/tests/e2e/admin/notifications/notifications.spec.ts > tests/e2e/admin/notifications/notifications.spec.ts && git show HEAD:frontend_vue/tests/e2e/admin/followups-list1.spec.ts > tests/e2e/admin/followups-list1.spec.ts && git show HEAD:frontend_vue/tests/e2e/admin/sales-crm/sales-crm.spec.ts > tests/e2e/admin/sales-crm/sales-crm.spec.ts
cd frontend_vue && npx vitest run src/services/contractRefs.spec.ts > "$TMPDIR/refs-before.log" 2>&1; echo "REF_BEFORE_EXIT=$?"; grep -E "^[^ ].*: ссылок [0-9]+, битых" "$TMPDIR/refs-before.log" > "$TMPDIR/sum-before.txt"; echo "DOCS_BEFORE=$(wc -l < "$TMPDIR/sum-before.txt")"; grep -E "^\[ссылки\]" "$TMPDIR/refs-before.log"
cd frontend_vue && cp "$TMPDIR/notifications.after.spec.ts" tests/e2e/admin/notifications/notifications.spec.ts && cp "$TMPDIR/followups.after.spec.ts" tests/e2e/admin/followups-list1.spec.ts && cp "$TMPDIR/sales-crm.before.spec.ts" tests/e2e/admin/sales-crm/sales-crm.spec.ts
cd frontend_vue && npx vitest run src/services/contractRefs.spec.ts > "$TMPDIR/refs-after.log" 2>&1; echo "REF_AFTER_EXIT=$?"; grep -E "^[^ ].*: ссылок [0-9]+, битых" "$TMPDIR/refs-after.log" > "$TMPDIR/sum-after.txt"; echo "DOCS_AFTER=$(wc -l < "$TMPDIR/sum-after.txt")"; grep -E "^\[ссылки\]" "$TMPDIR/refs-after.log"; echo "--- построчная разница сводок по документам ---"; diff "$TMPDIR/sum-before.txt" "$TMPDIR/sum-after.txt" && echo "SUMMARIES_IDENTICAL"
```

Код возврата: 0 у всех трёх команд. Вывод целиком:

```
REF_BEFORE_EXIT=0
DOCS_BEFORE=57
[ссылки] документов 68 · ссылок 15314 · битых 998
```

```
tests/e2e/admin/notifications/notifications.spec.ts:20
tests/e2e/admin/followups-list1.spec.ts:37
tests/e2e/admin/sales-crm/sales-crm.spec.ts:4
```

```
REF_AFTER_EXIT=0
DOCS_AFTER=57
[ссылки] документов 68 · ссылок 15314 · битых 998
--- построчная разница сводок по документам ---
SUMMARIES_IDENTICAL
```

`SUMMARIES_IDENTICAL` — сводки по всем 57 документам, у которых есть ссылки, совпали построчно.
Ни у одного документа счёт битых не вырос: ни 998, ни разбивка по файлам не изменились.

Полные журналы прогона тоже совпали — содержательно. Их разница, и только она:

```bash
cd /home/greatgleb/.local/share/flexiron/night-2026-09-28-2152/run-1/wt-expect-budget-goto-notifications-clients-group && diff "$TMPDIR/refs-before.log" "$TMPDIR/refs-after.log"
```

Код возврата: 1 (есть различия). Вывод целиком:

```
1063,1064c1063,1064
<    Start at  22:16:08
<    Duration  562ms (transform 66ms, setup 0ms, import 83ms, tests 353ms, environment 0ms)
---
>    Start at  22:16:10
>    Duration  508ms (transform 74ms, setup 0ms, import 91ms, tests 301ms, environment 0ms)
```

Разошлись только строки «когда начали» и «сколько шло». Ни одной строки отчёта о ссылках,
ни одного названного документа, ни одного нарушителя между прогонами не появилось и не исчезло.

## Границы правки и чего в ней нет

- Дифф скучный: во всех трёх спеках добавлен только второй аргумент `{ timeout: DATA_READY_TIMEOUT }`
  (или его разворот на две строки). Селекторы, ожидаемые значения, регулярные выражения,
  `not.` и `.soft` не тронуты.
- `frontend_vue/playwright.config.ts` не изменён — ЗАПРЕТ 1 соблюдён, и это отдельно стерегут
  `snapshotBudget.spec.ts` и `expectBudgetFollowups.spec.ts` (оба зелёные, Прогон 4).
- `tests/e2e/helpers/ready.ts` не изменён: число живёт в одном экземпляре, все опции взяты
  импортом.
- Короткие ссылки `:NNN` в чужих документах не трогались, `refs_shift.py` не запускался —
  ЗАПРЕТ 2 соблюдён.
- Инструментация замера жила в `$TMPDIR`, в репозиторий не попадала; в рабочем дереве её нет.

## Что осталось за границами задачи

- Файлы `clients.spec.ts`, `layout.spec.ts`, `categories.spec.ts` из outputs не изменены: разбор
  сторожа нашёл в них ноль нарушений. В `categories.spec.ts` первые утверждения после голого
  перехода — либо `toHaveURL` с бюджетом, либо снимки за `stabilizeForSnapshot` со своим бюджетом
  в `SNAPSHOT_OPTIONS`.
- Прогон `npm run verify` целиком за задачей не закреплён: он ожидает контроллера. Здесь сняты
  его составные части — формат, типы через витэст-прогоны сторожей и Playwright по шести спекам.
