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
