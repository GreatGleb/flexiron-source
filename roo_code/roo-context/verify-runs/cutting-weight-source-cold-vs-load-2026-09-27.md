# Замер: разделение холодного старта и нагрузки в падении `cutting.spec.ts` — 2026-09-27

Предмет — тест `the weight cell says where the weight comes from, and lets it be given back`
в `frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts`.

Задача `cutting-weight-source-cold-vs-load` (П2 плана
[`сквозное-потолки-ожиданий-план.md`](../../plans/general/сквозное-потолки-ожиданий-план.md),
БАГ-02 в [`expect-ceiling-under-load-bugs.md`](../../plans/bugs/expect-ceiling-under-load-bugs.md)).

Предыдущий журнал [`cutting-weight-source-load-2026-09-26.md`](cutting-weight-source-load-2026-09-26.md)
записал падение на третьем повторе из пяти под нагрузкой 40 — `Test timeout of 90000ms exceeded`
внутри `openCuttingFor` — и назвал три неразделённые версии: нагрузка, холодный первый прогон, их
сочетание. Этот журнал их разделяет.

Это ЗАМЕР. Правок кода он не содержит: итоговый дифф по `cutting.spec.ts` пуст (md5 на входе
`72526bc6efcc3f68fe5b1174dab432b4` и тот же md5 на выходе, `git diff` пуст).

## Что чем мерилось

Четыре ячейки — {холодный, прогретый} × {нагрузка 40, без нагрузки}. В каждой тест гоняется
с `--repeat-each=5`, отбирается по имени. Порядок: холодная без нагрузки → прогретая без
нагрузки → холодная под нагрузкой → прогретая под нагрузкой.

- **«Холодный»** — прогон сразу после `rm -rf node_modules/.vite`, то есть кэш сборки фронтенда
  удалён. Кэш — это `node_modules/.vite/deps`, куда Vite складывает предсобранные зависимости;
  удалённый кэш Vite собирает заново с первого запроса. `cache_removed=yes` в команде ячейки и
  `cache_present=yes` в команде прогретой ячейки фиксируют состояние перед прогоном.
- **«Прогретый»** — тот же прогон сразу следом за холодным, без удаления кэша.
- **Нагрузка 40** — `for i in $(seq 1 40); do (yes > /dev/null &); done`, снимается
  `pkill -x yes`. Снятие перед каждой безнагрузочной ячейкой обязательно и видно в командах:
  `load_before=0` стоит там первым действием.

**Чем «холодный» НЕ был.** Процесс dev-сервера поднимался заново в каждой ячейке: порт 5400
после каждого прогона свободен (`ss -ltn` по 5400/5401 — free), `pgrep -af vite` находит только
саму команду замера, `CI` не выставлен. Значит эта пара ячеек разделяет именно КЭШ СБОРКИ, а не
время жизни процесса Vite: он был свежим во всех четырёх.

**Чем «без нагрузки» НЕ был.** Это «без созданных мною сорока `yes`», а не «на спокойной
машине»: рядом одновременно работают другие авторы. Замер снят на 8 ядрах, `load average` на
входе в сессию — 1.19 / 3.71 / 7.50 (окна 1 / 5 / 15 минут), то есть фон от чужой работы был.

## Разминка перед протоколом

Один прогон в один повтор, без нагрузки и без удаления кэша — чтобы знать время страницы и что
она вообще открывается.

```bash
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
  -g "the weight cell says where the weight comes from" --repeat-each=1 --reporter=line \
  > /tmp/cw-sanity.txt 2>&1; echo "exit=$?"; cat /tmp/cw-sanity.txt
```

```
exit=0

Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  1 passed (6.4s)
```

## Ячейка 1 — холодный кэш сборки, без нагрузки

```bash
cd frontend_vue && pkill -x yes; sleep 1; echo "load_before=$(pgrep -x yes | wc -l)"; \
  rm -rf node_modules/.vite && echo "cache_removed=yes"; \
  npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
    -g "the weight cell says where the weight comes from" --repeat-each=5 --reporter=line \
    > /tmp/cw-cold-noload.txt 2>&1; echo "exit=$?"; cat /tmp/cw-cold-noload.txt
```

```
load_before=0
cache_removed=yes
exit=0

Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  5 passed (11.9s)
```

**Зелёных 5 из 5.** Код возврата — 0.

## Ячейка 2 — прогретый, без нагрузки

Кэш на месте (`cache_present=yes`), нагрузка снята и зафиксирована (`load_before=0`).

```bash
cd frontend_vue && pkill -x yes; sleep 1; echo "load_before=$(pgrep -x yes | wc -l)"; \
  ls node_modules/.vite/deps >/dev/null 2>&1 && echo "cache_present=yes"; \
  npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
    -g "the weight cell says where the weight comes from" --repeat-each=5 --reporter=line \
    > /tmp/cw-warm-noload.txt 2>&1; echo "exit=$?"; cat /tmp/cw-warm-noload.txt
```

```
load_before=0
cache_present=yes
exit=0

Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  5 passed (11.4s)
```

**Зелёных 5 из 5.** Код возврата — 0.

## Ячейка 3 — холодный кэш сборки, нагрузка 40

```bash
cd frontend_vue && rm -rf node_modules/.vite && echo "cache_removed=yes"; \
  for i in $(seq 1 40); do (yes > /dev/null &); done; sleep 2; \
  echo "load_before=$(pgrep -x yes | wc -l)"; \
  npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
    -g "the weight cell says where the weight comes from" --repeat-each=5 --reporter=line \
    > /tmp/cw-cold-load.txt 2>&1; echo "exit=$?"; pkill -x yes; sleep 1; \
  echo "load_after=$(pgrep -x yes | wc -l)"; cat /tmp/cw-cold-load.txt
```

```
cache_removed=yes
load_before=40
exit=0
load_after=0

Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  5 passed (44.3s)
```

**Зелёных 5 из 5.** Код возврата — 0. Нагрузка снята после прогона: `load_after=0`.

## Ячейка 4 — прогретый, нагрузка 40

```bash
cd frontend_vue && pkill -x yes; sleep 1; \
  echo "load_before=$(pgrep -x yes | wc -l)"; \
  ls node_modules/.vite/deps >/dev/null 2>&1 && echo "cache_present=yes"; \
  for i in $(seq 1 40); do (yes > /dev/null &); done; sleep 2; \
  echo "load_raised=$(pgrep -x yes | wc -l)"; \
  npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
    -g "the weight cell says where the weight comes from" --repeat-each=5 --reporter=line \
    > /tmp/cw-warm-load.txt 2>&1; echo "exit=$?"; pkill -x yes; sleep 1; \
  echo "load_after=$(pgrep -x yes | wc -l)"; cat /tmp/cw-warm-load.txt
```

```
load_before=0
cache_present=yes
load_raised=40
exit=0
load_after=0

Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  5 passed (43.0s)
```

**Зелёных 5 из 5.** Код возврата — 0. Нагрузка снята после прогона: `load_after=0`.

## Сводка ячеек

| ячейка | кэш | нагрузка | код возврата | зелёных | время |
|---|---|---|---|---|---|
| 1 | удалён | нет | 0 | 5 из 5 | 11.9 с |
| 2 | на месте | нет | 0 | 5 из 5 | 11.4 с |
| 3 | удалён | 40 `yes` | 0 | 5 из 5 | 44.3 с |
| 4 | на месте | 40 `yes` | 0 | 5 из 5 | 43.0 с |

Разница времени между холодной и прогретой ячейкой — 0.5 с без нагрузки и 1.3 с под нагрузкой.
Это замер одного прогона на ячейку, а не статистика: разница сравнима с разбросом между прогонами,
и по ней одной ничего не решается. Нагрузка при этом растянула прогон вчетверо (11 → 44 с) — вот
это различие устойчиво и видно на всех ячейках.

## Мутационная проверка непустоты опыта

Зелёный протокол неотличим от протокола, который вообще не исполнял тело теста. Поэтому локатор
поля поиска партии временно испорчен, ячейка прогнана, локатор возвращён.

**Испорченный локатор.** Строка в `openCuttingFor` заменена на
`warehouse-cutting-batch-search-BROKEN` (md5 спеки после правки —
`c9b1d832a4a719382d035bd1f9e319fb`).

```bash
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
  -g "the weight cell says where the weight comes from" --repeat-each=1 --reporter=line \
  > /tmp/cw-mutation-broken.txt 2>&1; echo "exit=$?"; cat /tmp/cw-mutation-broken.txt
```

```
load_before=0
exit=1

Running 1 test using 1 worker

[1/1] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  1) [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back

    Test timeout of 90000ms exceeded.

    Error: locator.fill: Test timeout of 90000ms exceeded.
    Call log:
      - waiting for getByTestId('warehouse-cutting-batch-search-BROKEN').locator('input')


      32 | async function openCuttingFor(page: Page, batchNumber: string) {
      33 |   await navigateToAdmin(page, '/admin/warehouse/cutting')
    > 34 |   await page.getByTestId('warehouse-cutting-batch-search-BROKEN').locator('input').fill(batchNumber)
         |                                                                                    ^
      35 |   const row = page.locator(`[data-test="warehouse-cutting-batch-row"]`, {
      36 |     hasText: batchNumber,
      37 |   })
        at openCuttingFor (/home/greatgleb/.local/share/flexiron/night-2026-09-27-0224/run-1/wt-cutting-weight-source-cold-vs-load/frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts:34:84)
        at /home/greatgleb/.local/share/flexiron/night-2026-09-27-0224/run-1/wt-cutting-weight-source-cold-vs-load/frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts:486:5

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────


  1 failed
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
```

Красное ровно на испорченном локаторе: `locator.fill`, `openCuttingFor`, поле
`warehouse-cutting-batch-search-BROKEN` — то есть на том же шаге и том же поле, где падал
прогон 2026-09-26. Тело теста исполняется, и падение по потолку теста на входе действительно
достижимо.

**Возвращённый локатор.** md5 вернулся к `72526bc6efcc3f68fe5b1174dab432b4`, `git diff` по спеке
пуст.

```bash
cd frontend_vue && pkill -x yes; sleep 1; echo "load_before=$(pgrep -x yes | wc -l)"; \
  npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
    -g "the weight cell says where the weight comes from" --repeat-each=5 --reporter=line \
    > /tmp/cw-mutation-restored.txt 2>&1; echo "exit=$?"; cat /tmp/cw-mutation-restored.txt
```

```
load_before=0
exit=0

Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:511:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  5 passed (11.4s)
```

**Зелёных 5 из 5 после отката.** Код возврата — 0. Опыт непуст: тот же отбор, тот же тест,
покраснел на испорченном поле и позеленел на возвращённом.

Итоговый дифф по `cutting.spec.ts` — пустой (md5 на входе в задачу равен md5 на выходе,
`git diff` пуст).

## Итог

**Падение `Test timeout of 90000ms exceeded` внутри `openCuttingFor` НИ ОДНА из четырёх ячеек не
воспроизвела — во всех четырёх по 5 зелёных повторов из 5.** То есть ни нагрузка 40 сама по себе,
ни холодный старт с удалённым кэшем сборки сам по себе, ни их сочетание при пяти повторах
падения не дают.

**Причина падения 2026-09-26 остаётся неустановленной.** Разделить факторы не удалось: протокол
из четырёх ячеек по пять повторов падение не воспроизвёл. Отрицательный результат — это результат
этой задачи, а не её провал.

**БАГ-02 не закрывается.** «Воспроизводится → не закрывать» — а разделение факторов само по себе
закрытием не является: причина не найдена, и воспроизводимость под прежними условиями
(нагрузка 40, пять повторов) остаётся зафиксированной в журнале 2026-09-26.

## Границы доказательства

- Замер снят на этой машине (8 ядер) и этой ревизии, в рабочем дереве задачи. Между ячейками
  других моих нагрузок не было; чужая работа рядом была.
- По пять повторов на ячейку — это двадцать повторов на протокол, не статистика. «5 из 5» —
  частота на этой выборке, а не оценка вероятности. Падение, случающееся реже одного раза на
  двадцать, протокол такой длины пропустит.
- Нагрузка 40 замерена командой (`load_before=40`, `load_after=0`), но её воздействие на машину
  не измерялось отдельно: числа «44.3 с против 11.9 с» — единственная её видимая мера здесь.
- «Холодный» относится к кэшу сборки (`node_modules/.vite`), а не к времени жизни процесса
  Vite: процесс был свежим во всех четырёх ячейках. Если у падения есть третья версия — «первый
  запуск браузера и первого мок-чанка в этом дереве», — этот протокол её не разделяет.
- Кода задача не тронула: единственная правка, мутационная, откачена до ответа.
