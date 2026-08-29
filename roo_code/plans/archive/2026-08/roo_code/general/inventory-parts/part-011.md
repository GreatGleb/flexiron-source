# Инвентаризация — часть 011

## `roo_code/plans/bugs/static-analysis-debt-bugs.md`

**Вердикт: частично**

Незакрытых чекбоксов: **0** (`grep -c "^[[:space:]]*- \[ \]"` → `0`, exit 1). Файл — bugs-файл
из девяти записей БАГ-01…БАГ-09, статус несёт таблица в конце, а не чекбоксы. Пять записей
сам файл помечает ✅; ещё две (БАГ-01, БАГ-03) в таблице стоят открытыми, но в коде **уже
сделаны** — то есть таблица отстала от кода. Одна (БАГ-06) не начата осознанно, одна (БАГ-09)
закрыта наполовину: смягчение стоит, причина не найдена — так и записано в самом плане.

### Что проверено и чем

Все команды из `frontend_vue/`.

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/bugs/static-analysis-debt-bugs.md
0            (exit 1)

$ grep -rn "waitForTimeout" tests/ | wc -l
1
tests/e2e/ready-exits.spec.ts:185:    await page.waitForTimeout(700)
   ↑ строкой выше — `// eslint-disable-next-line sonarjs/no-fixed-wait-in-tests`
     с обоснованием: доказывается ОТСУТСТВИЕ запросов за 700 мс, ждать нечего.

$ npx eslint tests/ --rule '{"sonarjs/no-fixed-wait-in-tests":"error"}'
(пусто — ноль срабатываний; правила НЕТ в списке выключенных в eslint.config.js,
 то есть оно включено и держит ноль)

$ npm run lint
exit=0   (eslint src/ tests/ *.ts --max-warnings=0)

$ npm run typecheck
exit=0   (vue-tsc --noEmit, при "allowJs": true + "checkJs": true в tsconfig.json)

$ find src -name "*.js"
(пусто)
$ ls src/main.* src/composables/useHead.* src/i18n/index.* src/i18n/translations.*
src/main.ts  src/composables/useHead.ts  src/i18n/index.ts  src/i18n/translations.ts
tsconfig.json:23  /* .js в src больше нет (переведены 2026-08-25); allowJs с checkJs
                      оставлены храповиком ... */

$ npx eslint src/ --config <временный конфиг с projectService> \
    --rule '{"@typescript-eslint/no-unnecessary-condition":"error"}'   # только **/*.ts
TOTAL .ts in src: 22
{
 "src/composables/order-audit-concurrency.spec.ts": 1,
 "src/composables/order-audit-fuzz-card.spec.ts": 1,
 "src/composables/useBccRequest.ts": 1,
 "src/composables/useOrderCard.ts": 1,
 "src/composables/useProductCard.ts": 1,
 "src/composables/useSettings.ts": 6,        → композаблы 11, план говорит 11 ✔
 "src/services/mocks/categories.ts": 1,
 "src/services/mocks/order-audit-avg-prices.spec.ts": 3,
 "src/services/mocks/order-audit-returns.spec.ts": 1,
 "src/services/mocks/orders.ts": 3,
 "src/services/mocks/warehouse.ts": 2,       → моки (без спек) 6, план говорит 6 ✔
 "src/types/i18n.ts": 1
}
eslint.config.js: '@typescript-eslint/no-unnecessary-condition': 'error' на
  src/domain/**, src/config/**, src/router/**, src/i18n/**, src/mocks/**, src/services/*.ts
  — ровно шесть каталогов, как заявлено; ни одного срабатывания в них нет.

$ grep -n "Клиент написан, UI нет" roo_code/roo-context/03-api-contract.md
2749:# Клиент написан, UI нет      (таблица на 14 строк — посчитано чтением 2749-2790)

$ npm run deadcode
Unused exports (59)
Unused exported types (22)          ← план: «Осталось 59 экспортов и 22 типа» ✔
$ grep -rn "MaterialFailure|OffcutWeightSource|AllocationRow|MultiSelectOption|TagOption" \
    src --include=*.ts --include=*.vue | grep "export type|export interface"
(ни одного export — только `MaterialFailureReason` и `PieceSizeResult`, другие имена) ✔

$ grep -n "resolvePieceSize" -A12 src/domain/cutting.ts
149:  return { ok: true, pieceSize: roundQuantity(formula(offcut)) }     ✔ БАГ-07

$ npx eslint src/ --rule '{"sonarjs/no-floating-point-equality":"error"}' | grep -c ...
64        (eslint.config.js помечает «61» — счётчик подрос на 3, правило по-прежнему off)
$ npx eslint src/ --rule '{"sonarjs/cognitive-complexity":"error"}' | grep -c ...
39        (план и конфиг: 40)
$ npx eslint src/ --rule '{"sonarjs/no-nested-conditional":"error"}' | grep -c ...
24        (план и конфиг: 24)

$ grep -n "Прогон читается по коду возврата" roo_code/skills/verify.md
199:### Прогон читается по коду возврата и по полному выводу — иначе он ничего не значит   ✔ БАГ-08

$ grep -n "trace|retries" frontend_vue/playwright.config.ts
7:  retries: process.env.CI ? 2 : 0,
52:  trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',        ✔ БАГ-09 (часть)

$ grep -rn "export .*waitForDataReady" tests/
tests/e2e/helpers/ready.ts:185
$ grep -rn "waitForDataReady" tests/ | wc -l
68
$ node — скан всех *.spec.ts: `await page.goto(` и первая следующая
  некомментарная строка с .click/.fill/.press/.check/.selectOption/.hover/.type
gotos 235
goto->action без ожидания: 0
```

### По записям

| БАГ | Вердикт | Чем подтверждено / что осталось |
|---|---|---|
| 01 — 10 `waitForTimeout` | **сделано** | осталось одно, с `eslint-disable` и доказанным обоснованием; правило включено (не в off-списке) и даёт ноль. Таблица в конце плана всё ещё показывает БАГ-01 открытым — устарела |
| 02 — 109 nullable-расхождений | **сделано** (как «закрыт храповиком») | правило стоит на шести каталогах, они чисты; остаток совпал с записанным: композаблы 11, моки 6 |
| 03 — пять `.js`, `checkJs` | **сделано** | `.js` в `src` нет вовсе, `checkJs: true`, `npm run typecheck` exit 0. В таблице плана открыт — устарела |
| 04 — 85 неиспользуемых экспортов | **сделано** | раздел контракта на 14 строк, пять типов без `export`, knip даёт ровно 59/22 |
| 05 — 61 сравнение float | **сделано** (решение «чинить нечего») | правило off с обоснованием; счёт вырос 61 → 64, но вывод записи от этого не меняется |
| 06 — 40 сложных функций, 24 тернарника | **не начато** | 39 и 24 сегодня — то же, что было. По самой записи и не должно было делаться отдельным заходом («разбирать при следующем касании файла»); правила off с этими счётчиками |
| 07 — площадь обрезка без округления | **сделано** | `roundQuantity` в `resolvePieceSize`, `cutting.ts:149` |
| 08 — красный прогон читался как зелёный | **сделано** | раздел в `verify.md:199` |
| 09 — `goto` без ожидания готовности | **частично** | смягчение полное: 0 из 235 `goto` идут сразу в действие, `waitForDataReady` в 68 местах, trace локально `retain-on-failure`. Причина падений (пустой `router-view`) по-прежнему не найдена — пять гипотез отработали отрицательно, план сам это фиксирует и ждёт улику |

### Чего не хватает до «сделано» целиком

1. **БАГ-09** — корень не найден; ждать следующее падение с trace (по самому плану).
2. **БАГ-06** — 39 функций и 24 тернарника не тронуты (по плану — не отдельным заходом).
3. **Таблица статусов в конце файла отстала**: БАГ-01 и БАГ-03 фактически закрыты, галочек нет.
4. **Счётчики в `eslint.config.js` разошлись с кодом**: `no-floating-point-equality` помечен «61»,
   сейчас 64; `cognitive-complexity` помечен «40», сейчас 39. Храповик показывает не то число,
   что есть.

### Замер: чего проверить не удалось

`no-unnecessary-condition` замерен только по `**/*.ts` в `src`. Прогон по `src/` целиком (с `.vue`),
как в команде плана, требует конфига с `projectService` внутри `frontend_vue/` — а создавать файлы
в проекте инвентаризации нельзя. Поэтому число «76» из плана не подтверждено и не опровергнуто;
подтверждены его составные части, которые план называет отдельно (композаблы 11, моки 6).
