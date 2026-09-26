# Замер: источник веса в резке под нагрузкой — 2026-09-26

Задача `cutting-weight-source-under-load` (П2 плана
[`сквозное-потолки-ожиданий-план.md`](../../plans/general/сквозное-потолки-ожиданий-план.md),
БАГ-02 в [`expect-ceiling-under-load-bugs.md`](../../plans/bugs/expect-ceiling-under-load-bugs.md)).

Предмет — тест `the weight cell says where the weight comes from, and lets it be given back`
в [`cutting.spec.ts`](../../../frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts). Тест упал
один раз в полном прогоне 2026-09-25, причина найдена не была, версия «гонка пересчёта» замером
не подтвердилась. Задача — прогнать его под нагрузкой с повторами и записать, воспроизводится ли
падение.

Это ЗАМЕР. Правок кода он не содержал.

## Команды

Нагрузка и прогон (одна команда, фон поднимается до `npx`, снимается после):

```bash
cd frontend_vue && (for i in $(seq 1 40); do (yes > /dev/null &); done); sleep 2; \
  echo "load_before=$(pgrep -x yes | wc -l)"; \
  npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
    -g "the weight cell says where the weight comes from" \
    --repeat-each=5 --reporter=line > /tmp/cutting-load-run.txt 2>&1; \
  echo "exit=$?"; pkill -x yes; sleep 1; echo "load_after=$(pgrep -x yes | wc -l)"
```

Контроль — та же команда без нагрузки:

```bash
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
  -g "the weight cell says where the weight comes from" \
  --repeat-each=5 --reporter=line > /tmp/cutting-control-run.txt 2>&1; echo "exit=$?"
```

Вывод писался в файл целиком: `| tail` съедает код возврата, а `N failed` печатается ВЫШЕ
`N passed`. Все выводы ниже — из этих файлов, ANSI-последовательности сняты для читаемости,
остальной текст дословен.

## Уровень нагрузки

`load_before=40` — сорок процессов `yes`, по одному на каждое из восьми ядер; после прогона
`load_after=0`. Прогон шёл на той же машине, четырьмя воркерами Playwright (дефолт, `fullyParallel`).

## Прогон под нагрузкой (exit=1)

```
Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  1) [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 

    Test timeout of 90000ms exceeded.

    Error: locator.fill: Test timeout of 90000ms exceeded.
    Call log:
      - waiting for getByTestId('warehouse-cutting-batch-search').locator('input')


      32 | async function openCuttingFor(page: Page, batchNumber: string) {
      33 |   await navigateToAdmin(page, '/admin/warehouse/cutting')
    > 34 |   await page.getByTestId('warehouse-cutting-batch-search').locator('input').fill(batchNumber)
         |                                                                             ^
      35 |   const row = page.locator(`[data-test="warehouse-cutting-batch-row"]`, {
      36 |     hasText: batchNumber,
      37 |   })
        at openCuttingFor (/home/greatgleb/PycharmProjects/flexiron-source/frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts:34:77)
        at /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts:472:5

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium-repeat3/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium-repeat3/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium-repeat3/trace.zip
    Usage:

        npx playwright show-trace test-results/admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium-repeat3/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────


  1 failed
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 
  4 passed (1.7m)
```

## Контрольный прогон без нагрузки (exit=0)

```
Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[5/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  5 passed (13.1s)
```

## Мутационная проверка: прогон действительно исполнял этот тест

Чтобы прогон не оказался «зелёным, потому что ничего не отобрал», поведение теста было сломано
на время одной проверки: в спеке строка `await expect(useDerived).toHaveCount(0)` заменена на
`toHaveCount(1)` (в теле теста ``useDerived`` — кнопка возврата к расчёту, до ручного ввода веса
её на экране нет, и `toHaveCount(1)` обязана покраснеть). Прогон — тот же `-g`, та же форма
команды, без нагрузки; после прогона правка откачена.

```bash
cd frontend_vue && npx playwright test tests/e2e/admin/warehouse/cutting.spec.ts \
  -g "the weight cell says where the weight comes from" \
  --repeat-each=5 --reporter=line > /tmp/cutting-mutation-run.txt 2>&1; echo "exit=$?"
```

`exit=1`, `5 failed`. Первый блок падения дословно:

```
Running 5 tests using 4 workers

[1/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[2/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[3/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
[4/5] [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back
  1) [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 

    Error: expect(locator).toHaveCount(expected) failed

    Locator:  getByTestId('warehouse-cutting-row').first().getByTestId('warehouse-cutting-row-weight-use-derived')
    Expected: 1
    Received: 0
    Timeout:  5000ms

    Call log:
      - Expect "toHaveCount" with timeout 5000ms
      - waiting for getByTestId('warehouse-cutting-row').first().getByTestId('warehouse-cutting-row-weight-use-derived')
        9 × locator resolved to 0 elements
          - unexpected value "0"


      516 |
      517 |     const derivedBadge = (await badge.textContent())!.trim()
    > 518 |     await expect(useDerived).toHaveCount(1)
          |                              ^
      519 |
      520 |     // Ввод руками меняет источник и открывает дорогу назад.
      521 |     await weightInput.fill('99')
        at /home/greatgleb/PycharmProjects/flexiron-source/frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts:518:30

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    ...
```

Повторы 2–5 напечатали такой же блок дословно, отличаясь только каталогом улик
(`...-chromium-repeat1/`, `...-chromium-repeat2/`, `...-chromium-repeat3/`,
`...-chromium-repeat4/`). Итог в конце файла:

```
  5 failed
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 
    [chromium] › tests/e2e/admin/warehouse/cutting.spec.ts:469:3 › Cutting operation › the weight cell says where the weight comes from, and lets it be given back 
```

Правка откачена: `git diff -- cutting.spec.ts` пуст, строка 518 снова несёт
`await expect(useDerived).toHaveCount(0)`. `cutting.spec.ts` в итоговый дифф не входит — он этой
задаче не принадлежит.

## Итог

**Падение ВОСПРОИЗВЕЛОСЬ:** под нагрузкой 40, при `--repeat-each=5`, упал один повтор из пяти —
третий (каталог улик
`admin-warehouse-cutting-Cu-f7f64-m-and-lets-it-be-given-back-chromium-repeat3`, см. вывод выше).
Контроль без нагрузки —
5 из 5 зелёных, `exit=0`.

**Диагностика повторённого падения — НЕ та, что подозревалась в БАГ-02.** Оригинальное падение
2026-09-25 приписывалось гонке пересчёта выведенного веса (бейдж `derivedBadge` против
`useDerived`). Здесь же тест не дошёл даже до этого места: `Test timeout of 90000ms exceeded`
внутри `openCuttingFor` на первом действии — `fill` по полю поиска партии
(`warehouse-cutting-batch-search`) так и не нашёл элемента, то есть страница резки не отрисовала
поле поиска за отведённые тесту 90 секунд. Это падение по потолку теста на входе, а не гонка
бейджа.

**Причина не установлена.** Что именно съело 90 секунд — фоновая нагрузка, холодный первый прогон
(это был первый запуск Playwright в сессии: `vite` поднимался с нуля, кэш зависимостей
`node_modules/.vite` лежал с 2026-09-24), или их сочетание, — этот протокол из двух прогонов
разделить не может: они отличаются сразу и нагрузкой, и порядком. Ни одна из версий не проверена
отдельно, и выдавать одну за причину нельзя.

**Вердикт: БАГ-02 НЕ закрывается.** Критерий задачи однозначен — воспроизвелось хоть раз под
нагрузкой, значит багу оставаться открытым: причина не найдена, и выдумывать её вместо разбора
трассировки нельзя. Выводы записаны в
[`expect-ceiling-under-load-bugs.md`](../../plans/bugs/expect-ceiling-under-load-bugs.md) и в
разделе П2 [`сквозное-потолки-ожиданий-план.md`](../../plans/general/сквозное-потолки-ожиданий-план.md).

## Границы доказательства

- Замер снят на этой машине и этой ревизии (`f5ee84d`, чистое дерево на момент старта).
- `--repeat-each=5` под нагрузкой 40 — пять проходов, не статистика; «1 из 5» — частота на этой
  выборке, а не оценка вероятности.
- Кода задача не тронула: единственная правка, мутационная, откачена до ответа; в итоговом
  диффе только три документа — этот журнал, bugs-файл и план.
