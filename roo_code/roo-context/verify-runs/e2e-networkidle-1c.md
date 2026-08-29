# Цикл проверок: пункт 1c — `networkidle` как признак прихода данных

Цель: [`review-followups.md` §1c](../../plans/archive/2026-08/review-followups.md) — 169 мест
`waitForLoadState('networkidle')` в 23 файлах заменить на признак ПРИШЕДШИХ ДАННЫХ
(питфолл #64). Область: только `frontend_vue/tests/`, приложение не трогается.

Замер на входе (2026-08-26): `grep -rc networkidle tests/` → 169 в 23 файлах,
из них 3 — комментарии в `helpers/ready.ts`, объясняющие, почему он врёт.

## Правило замены

| Что было | Чем стало | Почему |
|---|---|---|
| `goto(X)` + `networkidle` | `navigateToAdmin(page, X)` + признак страницы | пол `waitForDataReady` уже вшит в хелпер, признак добивает до «данные ЭТОЙ страницы» |
| `reload()` + `networkidle` | `switchLanguage` / `setFeatureFlag` / `waitForDataReady` | у перезагрузки те же хелперы |
| действие + `networkidle` | значение, которого до действия быть не могло | внутристраничный переход: разметка уже есть, ждать её бессмысленно |
| `goto` + `waitForFontsReady` + `networkidle` | признак данных, потом шрифты | снимок пустой панели неотличим от регресса вёрстки |
| навигация, где данных не будет (флаг OFF → /404, ошибка карточки) | само утверждение (`toHaveURL`, error-state) | ждать нечего, и утверждение ждёт само |

Признак «где ноль законен» — контейнер, который рисуется и при нуле, а не первая строка.

## Итерация 1 — clients.spec.ts (22 места)

Запускалось: `npx playwright test tests/e2e/admin/clients/clients.spec.ts --reporter=line`
→ 74 passed, 1 failed (после первой правки), затем 1 passed на починенном тесте.

**Находка 1 (Л9, #68): `clients › i18n` не переключал язык вообще.**
Тест звал `localStorage.setItem('flexiron_lang', …)` + `reload()`, но фикстура `test`
ставит `flexiron_lang = 'en'` init-скриптом КОНТЕКСТА, а тот выполняется на каждой
загрузке — язык возвращался в английский. Прежнее утверждение (`toBeVisible` на
заголовке) этого не видело: заголовок виден на любом языке. Вскрылось ровно потому,
что признак прихода данных здесь — сам перевод.
Починено: describe переведён на `testWithFlags` (фикстура без замка языка — так же
сделано в `categories.spec.ts` и `products.spec.ts`), утверждения стали
`toContainText('Клиенты' / 'Klientai')`.
Проверено инверсией: до правки тест падал на «Received: Clients — Counterparty
Directory», после — зелёный.

## Итерация 2 — сплошной проход по остальным 22 файлам

Порядок: warehouse (20) → categories (19) → suppliers-list (18) → аналитика ×8 (57) →
products (8) → layout (6) → supplier-* и bcc (11) → services, service-card, smoke, i18n (5).

Прогоны по областям (уровень 1, только затронутые файлы):

| Область | Команда | Итог |
|---|---|---|
| clients | `npx playwright test tests/e2e/admin/clients/clients.spec.ts` | 75 passed |
| warehouse | `… tests/e2e/admin/warehouse/warehouse.spec.ts` | 45 passed |
| categories | `… tests/e2e/admin/products/categories.spec.ts` | 45 passed |
| suppliers-list | `… tests/e2e/admin/suppliers/suppliers-list.spec.ts` | 59 passed |
| аналитика | `… tests/e2e/admin/analytics` | 237 passed |

**Находка 2 (Л9/Л5): `products.spec.ts` навигировал диагностической простынёй.**
`navigateToProductsList` состоял из `goto` с `domcontentloaded`, восьми `console.log`
про состояние `#app` и `waitForLoadState('networkidle')` посередине — то есть печатал
ровно то, что тест обязан утверждать, и ждать при этом не умел. Заменено на
`openAdminPage(page, PRODUCTS_URL, '[data-test="products-row"]')`.

**Находка 3 (Л9/#66): проверки отсутствия при выключенном секционном флаге стояли
до прихода данных.** `suppliers-list` (view-tabs, kanban, export), `products`
(add-supplier), `bcc-request` (history-panel), `dashboard` (alerts, charts) утверждали
`toHaveCount(0)` сразу после `networkidle` — на пустой странице это истина по другой
причине. Теперь сначала признак данных, потом утверждение об отсутствии.

**Находка 4 (Л5): восемь одинаковых локальных хелперов.** Первая правка развела по
файлам один и тот же четырёхстрочный «навигация + признак» с одинаковым комментарием
на шесть строк. Свёрнуто в `openAdminPage` / `openAdminCard` в
[`helpers/admin.ts`](../../../frontend_vue/tests/e2e/helpers/admin.ts); в спеках
осталась строка с именем и маркером страницы.
Замерено: `npm run dupes` — 9.77 % и до, и после (jscpd считает только `src/`,
`tests/` в его области нет; в самом `tests/` typescript-дубликаты 4.15 %).

## Что заменено — сводка

**Поправка к замеру плана.** 169 — это все УПОМИНАНИЯ `networkidle` в `tests/`, включая
десять в комментариях (три в `helpers/ready.ts` и семь в спеках, в том числе четыре в
диагностических печатях `products.spec.ts`). Настоящих вызовов было **159 в 22 файлах** —
проверено на дереве до правки: `grep -rc "await page.waitForLoadState" tests/`.

| Чем заменён вызов | Мест |
|---|---|
| открывалка страницы: навигация + признак данных (`openAdminPage` / `openAdminCard` и их именованные обёртки) | 116 |
| `navigateToAdmin` — пол; дальше ждёт собственное утверждение теста | 19 |
| удалён без замены: данных не будет вовсе (флаг OFF → /404, ненайденная сущность) либо следующее утверждение уже ждёт значение | 16 |
| `waitForDataReady` (перезагрузка, смоук по всем маршрутам, публичные страницы) | 4 |
| `switchLanguage` вместо `localStorage` + `reload` | 4 |
| **итого** | **159** |

Замерено по диффу: `git diff -U0 tests/ | grep -c "^-.*waitForLoadState"` → 159;
`grep -cE "^\+ +await open"` → 116; `navigateToAdmin(page` → 19; `waitForDataReady` → 4;
`switchLanguage` → 4; остаток 16.

Проверка: `grep -rn "await page.waitForLoadState" tests/` → **пусто**. Оставшиеся 15
упоминаний `networkidle` — в комментариях, объясняющих, почему его здесь нет.

## Итерация 3 — полный прогон и доказательство от обратного

Правка задела `tests/e2e/helpers/admin.ts` — общий пол, через который проходит каждый
тест. По [`verify.md`](../../skills/verify.md) это уровень 2: полный набор, и не один раз.

**Прогон 1:** `npx playwright test --reporter=line > full1.txt 2>&1; echo exit=$?`
→ **1007 passed, 1 failed** (16.6 мин), `exit=1`. Вердикт снят по коду возврата и по
строке `failed`, а не по последней строке вывода.

**Находка 5 (моя же, в этой правке): якорем взят элемент, выключенный тем же флагом.**
`products.spec.ts › add supplier button hidden when productSupplierLinks is OFF` — я
поставил признаком `[data-test="product-card-suppliers"]`, но эта панель и есть то, что
флаг убирает: ждать её значило ждать никогда. Панели вообще не годятся признаком на этой
карточке — `product-card-info` это `GlassPanel` с `:loading`, он виден и со скелетом.
Заменено на `openAdminCard(…, '[data-test="field-name"]')` — непустое значение поля.
Проверено: `npx playwright test tests/e2e/admin/products/products.spec.ts` → 61 passed.

**Доказательство от обратного** (обязательное по #64, «стало зелёно» доказательством не
считается). Временная спека под `Emulation.setCPUThrottlingRate` ×20, один прогон, две
проверки:

```
[ИНВЕРСИЯ] строк на networkidle: 0
[ИНВЕРСИЯ] строк после openAdminPage: 25
```

То есть на `networkidle` страница клиентов держит НОЛЬ строк — тест на старом ожидании
читал пустой экран и утверждал по нему; новая открывалка держит до двадцати пяти. Спека
после доказательства удалена (`tests/e2e/zz-inversion.spec.ts`), в репозитории её нет.

## Отчёт

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 1c — networkidle в e2e
Итераций: 3 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK (9.77 %, порог 10) ·
                   format OK · unit 543/543 · e2e уровень 2 — 1008 passed ×2 подряд
Линзы:             Л2, Л3, Л5, Л7, Л9, Л10 подтверждены (область — tests/)
                   Л1, Л4, Л6, Л8 неприменимы: приложение не тронуто ни строкой
Найдено за прогон: 5       Починено: 5      Отклонено: 0
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Чем проверена каждая линза**

- **Л2 (i18n).** `clients › i18n` и `categories › i18n` переведены на проверку самого
  перевода: `toContainText('Клиенты')`, `toContainText('Klientai')`, «надпись изменилась».
  Прогон обоих файлов зелёный; до правки первый падал на английском заголовке.
- **Л3 (контракт).** Новых вызовов к API правка не добавила: она целиком в ожиданиях.
  Проверено `git diff --name-only`: в `frontend_vue/src` — 0 файлов, в
  `tests/e2e/mocks` — 0; изменены 23 файла, все под `tests/e2e/`.
  Оставшиеся 236 `page.goto` в `tests/` — это в основном файлы, которых сплошной проход
  не касался (`navigation`, `feature-flags`, `orders`, `settings`, `sales-crm`) и
  визуальные блоки со `stabilizeForSnapshot`; ни одного `networkidle` рядом с ними нет.
- **Л5 (один источник).** Разобрана находка 4: восемь одинаковых хелперов свёрнуты в
  `openAdminPage` / `openAdminCard`. `npm run dupes` — 9.77 % до и после (jscpd считает
  только `src/`), `npx jscpd tests/` — typescript 4.15 %.
- **Л7 (флаги).** `ALL_FLAGS_ENABLED` не тронут; тесты выключенных флагов теперь сначала
  доказывают, что страница пришла. Прогон всех `baseTest`-случаев зелёный.
- **Л9 (тесты, которые ничего не утверждают).** Главная линза здесь. Инверсия проведена
  под троттлингом ×20 (см. итерацию 3): 0 строк на `networkidle` против 25 на новой
  открывалке. Плюс три находки этого класса (1, 3, 5) починены.
- **Л10 (целостность).** `npm run verify` зелёный целиком; полный набор e2e — 1008
  тестов, ни одного skipped.

**Рассмотрено (дедупликация)**

| # | Находка | Итог |
|---|---|---|
| 1 | `clients › i18n` не переключал язык | починено, `testWithFlags` |
| 2 | `products.spec.ts`: диагностическая простыня вместо ожидания | починено |
| 3 | проверки отсутствия до прихода данных (5 мест) | починено |
| 4 | восемь копий локального хелпера | свёрнуто в `helpers/admin.ts` |
| 5 | якорь, выключенный тем же флагом (`product-card-suppliers`) | починено |

**Что закрыто в скилах** (шаг update-skills):

- [`vue-rules.md`](../../skills/vue-rules.md) #64 — добавлены `openAdminPage` /
  `openAdminCard` и храповик «в `tests/` нет ни одного `networkidle`».
- [`verify.md`](../../skills/verify.md) Л9 — тот же храповик как машинная часть линзы:
  `grep -rn "await page.waitForLoadState" frontend_vue/tests/` обязан быть пустым.
