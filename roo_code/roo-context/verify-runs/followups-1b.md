# Пункт 1b — проверки отсутствия рядом с полной навигацией: сплошной проход

План: [`review-followups.md` § 1b](../../plans/general/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

**Итог: пункт УСТАРЕЛ.** Популяция утверждений об отсутствии на месте и даже выросла
(102 → 178), но опасного порядка «мутация → полная загрузка → проверка отсутствия»
в `frontend_vue/tests/` не осталось ни одного. Кода не менял.

---

## 1. Что именно искалось

Пункт называет диагнозом не соседство, а порядок:

> мутация → полная загрузка страницы → утверждение об отсутствии

Мок-сторы живут в модулях, полная загрузка пересобирает их из сидов, поэтому к моменту
проверки мутация уже отменена и `toHaveCount(0)` истинно по чужой причине (питфолл #66).
Проверка отсутствия **без** предшествующей мутации законна — так сказано в самом пункте.

Что считалось каждым из трёх звеньев:

| Звено | Признаки |
|---|---|
| мутация | `.click(` `.fill(` `.check(` `.uncheck(` `.press(` `.selectOption(` `.setInputFiles(` `.dblclick(` `.dragTo(` `dispatchEvent(`; плюс вызов локального хелпера, в теле которого есть такое действие |
| полная загрузка | `page.goto(` `page.reload(` `navigateToAdmin(` `openAdminPage(` `openAdminCard(` `loadConfig(` `loadCreate(` `openSuppliersList(` `openCreatePage(` **и** `switchLanguage(` `setFeatureFlag(` `setFlag(` — последние три внутри себя делают `page.reload()` |
| отсутствие | `toHaveCount(0)` `not.toBeVisible` `toBeHidden()` `not.toContainText` `not.toContain(` `toHaveLength(0)` `toEqual([])` |

`page.goBack()` / `page.goForward()` в «полную загрузку» намеренно НЕ включены: все записи
истории после первой `goto` принадлежат одному документу (роутер кладёт их через
`pushState`), popstate документ не перезагружает, состояние модулей живо. Это тот самый
приём, которым чинили два теста в `audit-log.spec.ts` (коммит f2def93).

Три хелпера с `page.reload()` внутри — отдельная находка этого прохода: греп по
`page.goto|page.reload` в спеках их не видит, а перезагружают они по-настоящему.

```
$ grep -rn "page.goto\|\.reload(" tests/e2e/helpers/ tests/e2e/fixtures.ts
tests/e2e/helpers/flags.ts:112:  await page.reload()      # setFlag()
tests/e2e/helpers/admin.ts:5:  await page.goto(path)      # navigateToAdmin()
tests/e2e/helpers/admin.ts:47:  await page.reload()       # switchLanguage()
tests/e2e/helpers/admin.ts:67:  await page.reload()       # setFeatureFlag()
```

## 2. Перепись популяции — она есть и выросла

```
$ python3 - <<'PY'   # счёт утверждений об отсутствии по файлам
...   (регулярка «отсутствие» из таблицы выше, строки-комментарии отброшены)
PY
  61  tests/e2e/admin/orders/orders.spec.ts
  14  tests/e2e/admin/suppliers/suppliers-list.spec.ts
  12  tests/e2e/admin/products/products.spec.ts
  10  tests/e2e/admin/products/categories.spec.ts
   8  tests/e2e/admin/warehouse/warehouse-map.spec.ts
   7  tests/e2e/admin/suppliers/bcc-request.spec.ts
   7  tests/e2e/admin/suppliers/supplier-card-config.spec.ts
   7  tests/e2e/admin/suppliers/supplier-create.spec.ts
   6  tests/e2e/feature-flags-matrix.spec.ts
   6  tests/e2e/admin/settings/audit-log.spec.ts
   5  tests/e2e/admin/clients/clients.spec.ts
   4  tests/e2e/admin/notifications/notifications.spec.ts
   3  tests/e2e/admin/layout.spec.ts
   3  tests/e2e/admin/suppliers/supplier-card.spec.ts
   3  tests/e2e/admin/warehouse/cutting.spec.ts
   2  ready-exits · smoke · analytics/dashboard · analytics/staff ·
      analytics/warehouse · settings/settings · warehouse/offcut-weight ·
      warehouse/warehouse
   1  ready-real-api · analytics/deficit · analytics/logistics ·
      analytics/pl-report · analytics/sales · analytics/supply

всего: 178 в 29 файлах; во всех 29 есть и полная навигация
```

Замер пункта от 2026-08-18 — 102 в 20 файлах. Популяция выросла, то есть пункт устарел
не потому, что проверять стало нечего.

## 3. Сам проход

Скрипт разбирает каждый спек на блоки `test(` / `baseTest(` / `testWithFlags(`, склеивает
перенесённые prettier'ом строки в один оператор и для КАЖДОГО утверждения об отсутствии
ищет ближайшую предшествующую полную загрузку, а перед ней — мутацию.

```python
import re, os
ROOT='tests'
NAV = re.compile(r'page\.goto\(|page\.reload\(|navigateToAdmin\(|openAdminPage\(|openAdminCard\('
                 r'|switchLanguage\(|setFeatureFlag\(|setFlag\(|loadConfig\(|loadCreate\('
                 r'|openSuppliersList\(|openCreatePage\(')
ABS = re.compile(r'toHaveCount\(0\)|not\.toBeVisible|toBeHidden\(\)|not\.toContainText'
                 r'|not\.toContain\(|toHaveLength\(0\)|toEqual\(\[\]\)')
ACTION = re.compile(r'\.click\(|\.fill\(|\.check\(|\.uncheck\(|\.press\(|\.setInputFiles\('
                    r'|\.selectOption\(|\.dblclick\(|\.dragTo\(|dispatchEvent\(')
COMMENT = re.compile(r'^\s*(//|/\*|\*)')
START = re.compile(r'^(await\b|const\b|let\b|var\b|return\b|expect\(|page\.|if\b|for\b|while\b'
                   r'|}|\)|test\b|baseTest\b|testWithFlags\b)')
CALL = re.compile(r'^await\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(')

helper_with_action = set()          # хелперы, внутри которых есть действие
for dp,_,fns in os.walk(ROOT):
    for fn in (f for f in fns if f.endswith('.ts')):
        txt = open(os.path.join(dp,fn), encoding='utf-8').read()
        for m in re.finditer(r'(?:export\s+)?async function\s+([A-Za-z0-9_]+)\s*\(', txt):
            body = txt[m.end():m.end()+3000]
            end = body.find('\n}')
            if ACTION.search(body[:end if end>0 else len(body)]):
                helper_with_action.add(m.group(1))

def statements(lines):              # склейка продолжений в один оператор
    out=[]; cur=None; start=None
    for i,l in enumerate(lines):
        s=l.strip()
        if not s or COMMENT.match(l): continue
        if START.match(s) or cur is None:
            if cur is not None: out.append((start,cur))
            cur=s; start=i
        else: cur += ' ' + s
    if cur is not None: out.append((start,cur))
    return out

def is_mut(t):
    if ACTION.search(t): return True
    m = CALL.match(t)
    return bool(m and m.group(1) in helper_with_action and not NAV.search(t))

for dp,_,fns in os.walk(ROOT):
    for fn in sorted(f for f in fns if f.endswith('.spec.ts')):
        p = os.path.join(dp,fn)
        lines = open(p, encoding='utf-8').read().split('\n')
        starts = [i for i,l in enumerate(lines)
                  if re.match(r'\s*(test|baseTest|testWithFlags)(\.\w+)?\(', l)] + [len(lines)]
        for a,b in zip(starts, starts[1:]):
            st = statements(lines[a:b])
            for k,(ln,txt) in enumerate(st):
                if not ABS.search(txt): continue
                navs = [j for j in range(k) if NAV.search(st[j][1])]
                if not navs: continue
                nav = max(navs)
                muts = [j for j in range(nav) if is_mut(st[j][1])]
                if muts:
                    print(p, 'MUT', a+1+st[muts[-1]][0], '| NAV', a+1+st[nav][0], '| ABS', a+1+ln)
```

**Вывод скрипта — ОДНО срабатывание, и оно разобрано:**

```
$ python3 scan.py        # скрипт выше, дословно
tests/e2e/admin/suppliers/suppliers-list.spec.ts MUT 582 | NAV 583 | ABS 586
```

`suppliers-list.spec.ts:580` «stored kanban view is restored on reload (flag ON)»:

```ts
await page.locator('[data-test="suppliers-view-tabs"] button').nth(1).click()
await page.locator('[data-test="suppliers-save-view-btn"]').click()
await page.reload()
await expect(page.locator('[data-test="suppliers-kanban-view"]')).toBeVisible()
await expect(page.locator('[data-test="suppliers-table-view"]')).toBeHidden()
```

**Законно.** Сохранённый вид живёт в `localStorage`, а не в мок-сторе, — перезагрузка его
не откатывает, она и есть предмет теста. И отсутствию таблицы предшествует присутствие
канбана, то есть ноль здесь не может быть истиной «потому что страница ещё пуста».

Промежуточный, более грубый вариант скрипта держал в списке действий ещё и `.type(` — он
давал восемь лишних срабатываний на `msg.type()` внутри сборщиков консольных ошибок
(`smoke:59`, `audit-log:51`, `settings:17`, `warehouse-map:67`, `orders:55/176/388`,
`notifications:17`). Все восемь прочитаны и отброшены: это чтение типа сообщения, а не
действие пользователя. В итоговом варианте `.type(` убран.

Отдельно, вторым прогоном, выписаны ВСЕ пары «действие → полная загрузка» без требования
отсутствия — четырнадцать штук; шесть содержательных прочитаны целиком:

- `sales-crm.spec.ts:23` «KPI counts include an order created after them» — заказ создаётся
  и возврат идёт `page.goBack()` ×2, с комментарием ровно про то, что перезагрузка
  забыла бы созданный заказ. Правильно;
- `audit-log.spec.ts:196/203/231` — те самые два теста из коммита f2def93: `goBack` и
  `goForward`, состояние модулей живо. Правильно;
- `layout.spec.ts:161` «collapsed state restored after reload» — `localStorage`,
  перезагрузка предмет теста. Правильно;
- `orders.spec.ts:122` — `fill` фильтра, потом `goto` на другую страницу; сравниваются
  числа, отсутствие не утверждается;
- `orders.spec.ts:352/362` «the picker quotes the same price here as it does on a card» —
  переходы читают цену, ничего не мутируют;
- `orders.spec.ts:2103` «selecting a client pulls in that client's own payment terms» —
  клик по клиенту это выбор в форме, а сверка идёт с карточкой клиента, которую никто
  не менял.

Третьим прогоном — хуки: единственный `beforeEach` с действием во всём наборе
(`suppliers-list.spec.ts:413`, переключение на канбан) не сопровождается в своих тестах
ни одной полной загрузкой.

**Итог прохода: настоящих случаев «мутация → полная загрузка → проверка
отсутствия» — ноль.**

## 4. Наблюдение вне области пункта (кода не касался)

`feature-flags-matrix.spec.ts:98–129` — четыре теста «секция выключена флагом»
утверждают отсутствие панели, доказав перед этим только заголовок страницы
(`dashboard-title`, `suppliers-table-view`, `bcc-request-title`,
`supplier-card-config-title`). Мутации перед ними нет, то есть по определению пункта 1b
это законно; но по второму механизму #66 («присутствие должно было быть возможно»)
заголовок — признак слабее данных. Для сравнения, одноимённый тест в
`bcc-request.spec.ts:576` ждёт именно данные (`bcc-request-recipient-item`) и снабжён
ссылкой на #66. Правка здесь была бы «раз уж открыли файл», поэтому не делалась;
если решат чинить — это отдельный пункт про механизм 2, а не про 1b.

## 5. Приёмка

Кода не менял, но гейт прогнан, чтобы вердикт «ничего не потребовалось» опирался на
зелёное дерево, а не на предположение.

```
$ cd frontend_vue && npm run verify > run.txt 2>&1; echo "exit=$?"
exit=0
```

- `typecheck` — чисто
- `lint` (`--max-warnings=0`) — чисто
- `dupes` — 9.29 % при пороге 10 %
- `format:check` — `All matched files use Prettier code style!`
- `test:unit` — `Test Files 28 passed (28)`, `Tests 603 passed (603)`

`npm run test:e2e` не гонялся: правок в `src/` и `tests/` нет, гонять шестнадцать минут
ради неизменного дерева нечего доказывать.

## 6. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л9** (тесты, которые ничего не утверждают) | скрипт из §3 по всем 29 спекам + чтение четырнадцати пар «действие → полная загрузка» + `grep -rn "await page.waitForLoadState" tests/` | скрипт: 0 настоящих срабатываний; греп: пусто | подтверждена |
| **Л10** (целостность) | `npm run verify` (typecheck покрывает `tests/**`) | exit=0 | подтверждена |

Остальные линзы не применимы: правок нет, ни один файл не изменён.

## 7. Что осталось на будущее

Машинной защиты у этого класса нет — в отличие от `networkidle` (пункт 1c), где регресс
ловится одним грепом. Здесь признак — порядок трёх событий, грепом он не выражается;
скрипт из §3 выражает, но в гейт он не поставлен (правило «шаг вводится только зелёным»
он бы прошёл — сегодня он зелёный). Заводить его надо отдельным пунктом плана, а не
попутно этим прогоном.

---

# Прогон 2 — 2026-08-28, перепроверка независимым проходом

Первый прогон (выше) закончился выводом «случаев не осталось», но **скептик по нему не
запускался**: агент упал на ошибке API и результата не вернул, а финальный приёмщик того
прогона высказался ПРОТИВ — по его счёту утверждений об отсутствии стало 166 в 36 спеках
против 102 на момент постановки пункта, и он прочитал это как «сплошного прохода не было».

Поэтому проход сделан заново, с нуля и другим инструментом: не регулярками по строкам, а
**разбором AST** (`typescript` 6.0.2 из `node_modules`). Ниже — что искалось, чем, и почему
«ноль» здесь означает ноль, а не сломанный детектор.

## 1. Почему счёт утверждений ничего не решает

Число зависит только от того, какие матчеры считать «утверждением об отсутствии», и трёх
разных наборов достаточно, чтобы получить три разных числа на одном и том же дереве:

```
$ cd frontend_vue
$ grep -rnE "toHaveCount\(0\)|not\.toBeVisible|toBeHidden\(\)|not\.toContainText|not\.toContain\(|toHaveLength\(0\)|toEqual\(\[\]\)" tests --include=*.spec.ts | wc -l
181
$ grep -rlE "…то же…" tests --include=*.spec.ts | wc -l
29
$ grep -rnE "toHaveCount\(0\)|not\.to|toBeHidden\(\)|toHaveLength\(0\)|toEqual\(\[\]\)|toBeNull\(\)|toBeUndefined\(\)|toBeFalsy\(\)|toBeEmpty\(\)" tests --include=*.spec.ts | wc -l
317
$ grep -rlE "…то же…" tests --include=*.spec.ts | wc -l
32
```

Узкий набор (тот, которым мерили 2026-08-18) — 181 в 29 файлах; широкий — 317 в 32.
Счёт AST по операторам — 241 в 32 файлах. Ни одно из этих чисел не совпадает со 166 в 36,
и это ожидаемо: 36 файлов получается, если считать вместе с юнит-спеками `src/**/*.spec.ts`,
где ни `page`, ни перезагрузки нет вовсе.

**Вывод: спор о счёте неразрешим и не нужен.** Пункт называет диагнозом не количество
утверждений, а ПОРЯДОК трёх событий. Поэтому проверяется покрытие прохода, а не популяция:
разобраны ли ВСЕ тестовые блоки.

## 2. Покрытие: разобраны все тестовые блоки, до единого

```
$ node list-tests.js | head -1          # блоки, найденные разбором AST
959
$ grep -rn "^\s*\(test\|baseTest\|testWithFlags\|it\)\(\.\w\+\)*(" tests --include=*.spec.ts \
    | grep -v "describe\|beforeEach\|afterEach\|beforeAll\|afterAll\|\.step(" | wc -l
964
$ diff <(разбор) <(греп)                # чего греп видит больше
> tests/e2e/admin/settings/audit-log.spec.ts:130     test.skip(term.length < 3, …)
> tests/e2e/admin/settings/audit-log.spec.ts:167     test.skip(!twins, …)
> tests/e2e/ready-exits.spec.ts:106                  test.setTimeout(300_000)
> tests/e2e/ready-exits.spec.ts:149                  test.setTimeout(…)
> tests/e2e/ready-real-api.spec.ts:20                test.use({ baseURL: … })
```

Все пять расхождений — не тестовые блоки, а `test.skip(условие)`, `test.setTimeout`,
`test.use`. То есть разбор покрывает 964 блока из 964.

## 3. Что именно ищется

Опасен порядок: **мутация → полная загрузка → утверждение об отсутствии**. Полная загрузка
пересобирает мок-сторы из сидов (они живут в модулях), мутация к моменту проверки отменена,
и ноль истинен по чужой причине — питфолл #66, механизм 1.

| Звено | Как распознаётся в AST |
|---|---|
| мутация | вызов метода `click` `dblclick` `fill` `check` `uncheck` `press` `selectOption` `setInputFiles` `tap` `hover` `dragTo` `clear` `setChecked` `focus` `blur` `dispatchEvent` `pressSequentially` `type`; `request.post/put/patch/delete`; `evaluate` c `localStorage`/`__mock`; **плюс любой вызов функции, в теле которой это есть** — по транзитивному замыканию, а не по списку имён |
| полная загрузка | `goto` / `reload` — и снова транзитивно: `navigateToAdmin`, `openAdminPage`, `openAdminCard`, `switchLanguage`, `setFeatureFlag`, `setFlag` попадают сюда сами, их не нужно перечислять руками |
| отсутствие | `toHaveCount(0)` `toHaveLength(0)` `toBe(0)` `toEqual([])` `toBeHidden()` `toBeEmpty()` `toBeNull()` `toBeUndefined()` `toBeFalsy()` `toBe('')` и `not.` перед `toBeVisible` `toBeAttached` `toContainText` `toContain` `toHaveText` `toHaveCount` `toBeChecked` `toHaveValue` `toBeEnabled` `toMatch` `toHaveAttribute` `toHaveClass` `toBeDefined` |

Транзитивное замыкание — главное отличие от прохода регулярками: `deleteFirstRow(page)`
для регулярки просто вызов, для этого скана — мутация, потому что внутри неё `click`.

Три прохода:

1. **тела тестов** — включая операторы хуков `beforeEach`/`beforeAll` своей области
   (и области верхнего уровня файла): мутация в хуке предшествует всему телу теста;
2. **тела хелперов** — тестовый проход видит хелпер чёрным ящиком, здесь он раскрыт:
   опасный порядок может целиком лежать внутри одной функции;
3. **история SPA** — `goBack`/`goForward` выписываются отдельно. Это НЕ полная загрузка:
   записи после первой `goto` кладёт роутер через `pushState`, popstate документ не
   перезагружает, состояние модулей живо. Именно этим приёмом чинили два теста в
   `audit-log.spec.ts` (коммит f2def93). Пары выписаны, чтобы прочитать их глазами.

## 4. Скан, дословно

Файл клался в скретчпад, репозиторий он не трогает; воспроизводится копированием.

```js
/* node scan-1b.js [корень тестов]   — по умолчанию frontend_vue/tests */
const ts = require('./frontend_vue/node_modules/typescript')
const fs = require('fs'), path = require('path')
const ROOT = process.argv[2] || 'frontend_vue/tests'

const NAV_NAMES = new Set(['goto', 'reload'])
const MUT_NAMES = new Set(['click','dblclick','fill','check','uncheck','press','selectOption',
  'setInputFiles','tap','hover','dragTo','clear','setChecked','focus','blur','dispatchEvent',
  'pressSequentially','type'])
const REQ_MUT = new Set(['post','put','patch','delete'])
const ABS_NEG = ['toBeVisible','toBeAttached','toContainText','toContain','toHaveText','toHaveCount',
  'toBeChecked','toHaveValue','toBeEnabled','toMatch','toHaveAttribute','toHaveClass','toBeDefined']
const HOOKS = new Set(['beforeEach','beforeAll'])

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(p, out); else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}
const src = new Map()
for (const f of walkFiles(ROOT).sort())
  src.set(f, ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true))

function callEffects(node, sf) {                       // эффекты одного вызова
  const eff = new Set(); const ex = node.expression
  if (!ts.isPropertyAccessExpression(ex)) return eff
  const name = ex.name.text, obj = ex.expression.getText(sf)
  if (NAV_NAMES.has(name)) eff.add('NAV')
  // msg.type() в сборщиках консольных ошибок — чтение типа сообщения, не действие
  if (MUT_NAMES.has(name) && !(name === 'type' && /^(msg|message|err|error|e)\b/.test(obj))) eff.add('MUT')
  if (REQ_MUT.has(name) && /request$/.test(obj)) eff.add('MUT')
  if (name === 'evaluate' && /localStorage|sessionStorage|__mock/.test(node.getText(sf))) eff.add('MUT')
  if (name === 'goBack' || name === 'goForward') eff.add('HIST')
  return eff
}
function isAbs(node, sf) {                             // утверждение об отсутствии
  if (!/^(await\s+)?expect(\.soft)?\s*\(/.test(node.getText(sf))) return false
  const ex = node.expression
  if (!ts.isPropertyAccessExpression(ex)) return false
  const m = ex.name.text, neg = /\.not\./.test(ex.getText(sf))
  const arg = (node.arguments[0] ? node.arguments[0].getText(sf) : '').trim()
  if (neg) return ABS_NEG.includes(m)
  if (['toBeHidden','toBeEmpty','toBeNull','toBeUndefined','toBeFalsy'].includes(m)) return true
  if (['toHaveCount','toHaveLength','toBe'].includes(m) && arg === '0') return true
  if (m === 'toEqual' && /^\[\s*\]$/.test(arg)) return true
  if (['toBe','toHaveText','toContainText'].includes(m) && /^(''|"")$/.test(arg)) return true
  return false
}
// эффекты функций по имени + транзитивное замыкание по вызовам
const fnEffects = new Map(), fnCalls = new Map()
function funcName(n) {
  if (ts.isFunctionDeclaration(n) && n.name) return n.name.text
  if (n.parent && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name)) return n.parent.name.text
  return null
}
for (const [, sf] of src) {
  const visit = (n) => {
    if ((ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && n.body) {
      const name = funcName(n)
      if (name) {
        const eff = fnEffects.get(name) || new Set(), calls = fnCalls.get(name) || new Set()
        const inner = (m) => {
          if (ts.isCallExpression(m)) {
            for (const e of callEffects(m, sf)) eff.add(e)
            if (isAbs(m, sf)) eff.add('ABS')
            if (ts.isIdentifier(m.expression)) calls.add(m.expression.text)
          }
          ts.forEachChild(m, inner)
        }
        ts.forEachChild(n.body, inner); fnEffects.set(name, eff); fnCalls.set(name, calls)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
}
for (let i = 0; i < 10; i++) {                          // замыкание
  let changed = false
  for (const [name, calls] of fnCalls) { const eff = fnEffects.get(name)
    for (const c of calls) { const ce = fnEffects.get(c); if (!ce) continue
      for (const e of ce) if (!eff.has(e)) { eff.add(e); changed = true } } }
  if (!changed) break
}
const isStmt = (n) => ts.isExpressionStatement(n) || ts.isVariableStatement(n) ||
  ts.isReturnStatement(n) || ts.isThrowStatement(n)
function leaves(body) {                                 // листовые операторы по позиции
  const out = []
  const visit = (n) => {
    if (isStmt(n)) { let inner = false
      const probe = (m) => { if (m !== n && isStmt(m)) inner = true; else ts.forEachChild(m, probe) }
      ts.forEachChild(n, probe); if (!inner) { out.push(n); return } }
    ts.forEachChild(n, visit)
  }
  visit(body); return out.sort((a, b) => a.pos - b.pos)
}
function effects(stmt, sf) {
  const eff = new Set()
  const visit = (n) => {
    if (ts.isCallExpression(n)) {
      for (const e of callEffects(n, sf)) eff.add(e)
      if (isAbs(n, sf)) eff.add('ABS')
      if (ts.isIdentifier(n.expression)) { const fe = fnEffects.get(n.expression.text)
        if (fe) for (const e of fe) eff.add(e) }
    }
    ts.forEachChild(n, visit)
  }
  visit(stmt); return eff
}
// дальше: обход спеков (describe → хуки области → тесты), для каждого утверждения об
// отсутствии ищется ближайшая предшествующая NAV, а перед ней — любая MUT; отдельно то же
// по телам хелперов и отдельно пары MUT → HIST → ABS. Печатаются файл, строки и текст.
```

Полнота поиска: для утверждения на позиции k берётся ПОСЛЕДНЯЯ загрузка до k, и мутация
ищется до неё. Этого достаточно: если мутация стоит перед какой-то более ранней загрузкой,
она стоит и перед последней — то есть пара не теряется.

## 5. Скан проверен инверсией — «ноль» настоящий

Проверка, которая всегда печатает ноль, — это питфолл #68. Поэтому дерево тестов скопировано
в скретчпад, туда положен файл с ЗАВЕДОМО плохими образцами и с законными, и скан прогнан по
копии (репозиторий не тронут):

- **A** — `click` → `page.goto` → `toHaveCount(0)`;
- **B** — мутация через хелпер `deleteFirstRow` → `page.reload()` → `not.toBeVisible`;
- **C** — мутация в `beforeEach` → `navigateToAdmin` → `toBeHidden()`;
- **D** — законный порядок: загрузка → мутация → отсутствие;
- **E** — законный: отсутствие на свежей странице без мутации.

```
$ node scan-1b.js selftest/tests | grep -A3 "__selftest"
── tests/e2e/__selftest.spec.ts:10 «A: клик -> goto -> toHaveCount(0)»
   MUT 12  await page.getByTestId('row-delete-btn').first().click()
   NAV 13  await page.goto('/admin/clients')
   ABS 14  await expect(page.getByTestId('clients-row')).toHaveCount(0)
── tests/e2e/__selftest.spec.ts:17 «B: мутация через хелпер -> reload -> not.toBeVisible»
   MUT 19  await deleteFirstRow(page)
   NAV 20  await page.reload()
   ABS 21  await expect(page.getByTestId('products-row')).not.toBeVisible()
── tests/e2e/__selftest.spec.ts:29 «C: мутация в хуке -> navigateToAdmin -> toBeHidden»
   MUT 27  await deleteFirstRow(page)
   NAV 30  await navigateToAdmin(page, '/admin/orders')
   ABS 31  await expect(page.getByTestId('orders-row')).toBeHidden()
```

Все три плохих пойманы — включая мутацию, спрятанную в хелпере, и мутацию из хука.
D и E не сработали ни разу. Детектор рабочий.

## 6. Результат прохода по настоящему дереву

```
$ node scan-1b.js
тестов разобрано: 959, из них с полной загрузкой: 581
операторов с утверждением об отсутствии: 241 в 32 файлах
1) в тестах «мутация → полная загрузка → отсутствие»: 8
2) в хелперах то же: 0
3) «мутация → история SPA → отсутствие» (перезагрузки документа нет, для чтения): 3
```

Все восемь срабатываний прочитаны целиком. Ни одно не является случаем пункта:

| # | Место | Почему не случай |
|---|---|---|
| 1 | `clients.spec.ts:639` «a payment that names a document is money on that document row» | «Мутация» — клик по `a.name-link`, то есть переход внутри SPA, ничего не меняющий. А само утверждение (`not.toHaveCount(unfiltered)`) стоит ПОСЛЕ загрузки и после `fill` фильтра: оно про фильтр, применённый уже на новой странице |
| 2–3 | `order-offcuts.spec.ts:34` | «Мутация» — `firstAvailableOffcut`, которая только читает товар и партию со складской вкладки (внутри `openAdminPage` есть `evaluate(__mockCalls)`, отсюда и метка). Утверждения `not.toHaveText('—')` — про содержимое пришедшей строки, а не про исчезновение |
| 4–5 | `categories.spec.ts:438` «switching language updates UI text» | Язык лежит в `localStorage`; перезагрузка его не откатывает — она и есть предмет теста. Утверждается, что подпись сменилась, а не что запись исчезла |
| 6 | `audit-log.spec.ts:48` «loads without console errors and shows records» | `expect(errors).toHaveLength(0)` — про консоль, а не про данные; мутации нет вовсе (метку MUT дал `evaluate(__mockCalls)` внутри `navigateToAdmin`) |
| 7 | `suppliers-list.spec.ts:580` «stored kanban view is restored on reload» | Сохранённый вид — `localStorage`, перезагрузка предмет теста. Присутствие канбана утверждается строкой выше, то есть ноль у таблицы не может быть истиной «страница пуста» |
| 8 | `warehouse-map.spec.ts:61` «loads without console errors» | То же, что 6 |

Пары из прохода 3 (`audit-log.spec.ts:188` и `:212`) — это и есть починенные в f2def93
тесты: `goBack`/`goForward` вместо `goto`. История здесь принадлежит одному документу —
`navigateToAdmin` в `beforeEach` вызывается ОДИН раз (строка 45), дальше только клик по
ссылке и движения по истории, второй `goto` в тестах отсутствует. Значит модули живы и
удаление к моменту проверки не отменено.

Отдельно закрыта дыра «полная загрузка не от Playwright»: приложение само нигде не грузит
документ заново, поэтому третьего источника перезагрузки нет.

```
$ grep -rn "window\.location\s*=\|location\.href\s*=\|location\.reload\|location\.assign\|location\.replace" src --include=*.vue --include=*.ts --include=*.js
$ echo "exit=$?"
exit=1
```

Пусто. Ссылки с `target="_blank"` (карта склада, сертификаты в модале позиций) открывают
новую вкладку, текущий документ не перезагружают.

## 7. Вердикт

**Случаев «мутация → полная загрузка → проверка отсутствия» в `frontend_vue/tests` нет.**
Проход сплошной: 964 тестовых блока из 964, тела хелперов, хуки, история SPA. Детектор
проверен инверсией на трёх заведомо плохих образцах. Кода не менял — чинить нечего.

Пункт можно закрывать как исчерпанный. Отметку в плане ставит не автор правки.

## 8. Приёмка

```
$ cd frontend_vue && npm run verify > run.txt 2>&1; echo "exit=$?"
exit=0
```

- `typecheck` — чисто
- `lint` (`--max-warnings=0`) — чисто
- `dupes` — 9.19 % при пороге 10 %
- `format:check` — `All matched files use Prettier code style!`
- `test:unit` — `Test Files 30 passed (30)`, `Tests 646 passed (646)`

`npm run test:e2e` не гонялся: ни один файл в `src/` и `tests/` не изменён, доказывать
шестнадцатью минутами нечего.

## 9. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л9** (тесты, которые ничего не утверждают) | скан из §4 по всем 964 блокам, трём проходам и телам хелперов; инверсия детектора из §5; `grep -rn "await page.waitForLoadState" tests/` | скан: 8 кандидатов, все разобраны и отклонены поимённо (§6); инверсия: 3/3 плохих образца пойманы, 0 ложных на законных; греп: пусто (`exit=1`) | подтверждена |
| **Л10** (целостность) | `npm run verify` — typecheck и eslint покрывают `tests/**` | `exit=0` | подтверждена |

Остальные линзы не применимы: ни одного файла кода не изменено, менялся только этот журнал.
