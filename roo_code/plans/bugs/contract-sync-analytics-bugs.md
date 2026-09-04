# Bugs — contract-sync / домен analytics

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4, К6. Аудит: [`roo_code/plans/api/audit/analytics.md`](../api/audit/analytics.md).
Область: `frontend_vue/src/services/analyticsService.ts`,
`frontend_vue/src/services/mocks/analytics.ts`, ветка analytics в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useAnalytics.ts`,
`frontend_vue/src/types/analytics.ts`, восемь страниц
`frontend_vue/src/views/admin/analytics/`, `frontend_vue/src/components/admin/AnalyticsSubNav.vue`,
`frontend_vue/src/i18n/admin/analytics.ts`, `frontend_vue/src/i18n/admin/layout.ts`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — карточка P&L на дашборде печатает сам ключ перевода

**File:** `frontend_vue/src/views/admin/analytics/DashboardPage.vue:176` ·
`frontend_vue/src/services/mocks/analytics.ts:226` ·
`frontend_vue/src/i18n/admin/layout.ts:22,80,138`
**Severity:** High — видно любому пользователю на главной странице админки, во всех трёх локалях.
**Источник:** К4 (формы ответа) — сверка вокабуляра ключей, которые сервер обязан знать.

### Problem

`AnalyticsSectionPreview.key` используется дважды: как сегмент маршрута
(`:to="'/admin/analytics/' + section.key"`, `DashboardPage.vue:173`) и как ключ перевода
(`{{ t('sub.' + section.key) }}`, `:176`). Одно из семи значений, которые шлёт сервер, —
`'pl-report'` (`mocks/analytics.ts:226`). Ключа `sub.pl-report` в словаре нет:
`grep -rn "pl-report" frontend_vue/src/i18n/` — **ни одного попадания**, вкладка называется
`pl` (`i18n/admin/layout.ts:22` — `pl: '7.7 P&L'`, зеркала `:80`, `:138`), и подшивка зовёт её
именно так (`AnalyticsSubNav.vue:16` — `key: 'sub.pl'`).

vue-i18n на отсутствующий ключ печатает сам ключ, `fallbackLocale: 'en'` не спасает — в
английском словаре ключа тоже нет (`i18n/index.ts:13`). То есть седьмая карточка сетки на
`/admin/analytics/dashboard` показывает в номерной строке текст `sub.pl-report` вместо `7.7 P&L`.

Ни один тест этого не ловит: e2e считают карточки и проверяют `href`
(`frontend_vue/tests/e2e/admin/analytics/dashboard.spec.ts:283-302`), но текст `.acard-num` не
читает никто — `grep -rn "acard-num" frontend_vue/tests/e2e/` пусто.

### Fix

TBD — развилка, и выбрать её должен владелец, потому что это про контракт, а не про опечатку:
либо ключ маршрута и ключ перевода разводятся (у `AnalyticsSectionPreview` появляется отдельное
поле подписи или `title` начинает нести и номер), либо словарь получает `sub['pl-report']` и
перестаёт расходиться с сегментом маршрута. Правка «дописать ключ» закрывает симптом и оставляет
механизм: любое новое значение `key`, присланное сервером, снова напечатается как есть.

### Future rule

Значение, которое сервер шлёт как данные, а фронт использует как ключ словаря, обязано иметь
машинную сверку: тест «каждый `key` из `sectionPreviews` мока резолвится в `sub.*` во всех трёх
локалях». Пока такой сверки нет, вокабуляр держится на внимательности.

---

## БАГ-02 — единственный вызов домена не шлёт `Authorization`

**File:** `frontend_vue/src/services/analyticsService.ts:5`
**Severity:** High — против настоящего сервера запрос анонимен, арендатор неопределим.
**Источник:** К6 (обязанности сервера), графа «Мультиарендность».

### Problem

Весь клиент домена — шесть строк, и вызов идёт без третьего аргумента:

```ts
return apiGet<DashboardData>(`/api/analytics/${page}`)
```

`options?.headers` — единственный источник заголовков у GET (`frontend_vue/src/services/api.ts:157-159`),
поэтому заголовков нет вовсе: `grep -c "Idempotency\|Authorization\|authHeaders"
frontend_vue/src/services/analyticsService.ts` → `0`.

Соседние домены, у которых бэкенд живой, заголовки шлют: `authHeaders()` даёт
`Authorization: Bearer <token>` + `X-CSRF-Token` (`frontend_vue/src/composables/useAuth.ts:101-108`),
потребители — `frontend_vue/src/services/settingsService.ts:21`,
`frontend_vue/src/services/auditFeedService.ts:23`, `frontend_vue/src/services/uploadsService.ts:15`.
Из двадцати нетестовых файлов `frontend_vue/src/services/*.ts` (всего их 25, пять — спеки)
заголовок шлют три: `grep -ln "Authorization" frontend_vue/src/services/*.ts` даёт
`auditFeedService.ts`, `settingsService.ts`, `uploadsService.ts`.

Для аналитики это не косметика: все сущности, из которых отчёт считается, обязательно
привязаны к арендатору — `tenant_id` у шести складских таблиц
(`backend/app/modules/warehouse/shared/models.py:16,96,136,173,207,234`) и у трёх финансовых
(`backend/app/modules/finance/shared/models.py:16,63,98`). Без токена сервер не узнает, чей отчёт
считать. Под моками это не проявляется никак: ветка `mocks/index.ts:310-313` заголовков не читает.

### Fix

TBD — правка та же, что у соседей (`options: { headers: authHeaders() }`), но она системная:
безголовыми остаются семнадцать файлов сервисного слоя из двадцати, и чинить их по одному
значит получить семнадцать разных мест, где о заголовке можно забыть. Решение — общее для всех доменов,
и принимается один раз.

### Future rule

Отсутствие заголовка авторизации не отличается от его наличия ни в одном тесте, потому что мок
заголовки игнорирует. Пока проверка не машинная («каждый вызов `api*` из `services/*.ts` несёт
`authHeaders()`, кроме перечисленных публичных»), это будет всплывать в каждом домене заново —
у `notifications` (БАГ-01 своего файла) и `services` (БАГ-05 своего файла) уже всплыло.

---

## БАГ-03 — KPI «8 позиций в дефиците» против таблицы из пяти строк на той же странице

**File:** `frontend_vue/src/services/mocks/analytics.ts:888-898` · `:931-1006`
**Severity:** Medium — демо-данные противоречат сами себе внутри одного экрана.
**Источник:** К2 (мок ↔ контракт ↔ код).

### Problem

Страница `/admin/analytics/deficit` берёт из одного ответа и KPI, и таблицу. KPI-карточка
говорит «Позиций в дефиците: 8» (`mocks/analytics.ts:891-892`), а `deficitItems` в том же
объекте `deficitData` (`:1007-1014`) содержит **пять** записей (`:931-1006`) — и e2e это число
закрепляет: `await expect(page.locator('[data-test="deficit-item-row"]')).toHaveCount(5)`
(`frontend_vue/tests/e2e/admin/analytics/deficit.spec.ts:204`).

Соседние KPI той же карточки расходятся со складом так же: «Решено: 3» (`:921-922`) при том, что
в складском сторе дефицитов со статусом `resolved` две записи
(`frontend_vue/src/mocks/warehouse-deficit.ts` — 20 записей, `grep -n "status:" | sort | uniq -c`
даёт `8 open`, `5 in_progress`, `4 ordered`, `2 resolved`, `1 cancelled`).

Корень — не арифметика, а устройство мока: `mocks/analytics.ts` импортирует **только типы**
(`grep -c "^import " frontend_vue/src/services/mocks/analytics.ts` → `2`, оба `import type`,
`:1-23`), то есть ни одного чужого стора не читает и ничего не считает. Все 1044 строки — литералы,
и связи «число отчёта ↔ данные, из которых оно выведено» в коде нет вовсе.

### Fix

TBD. Прямолинейное «поправить 8 на 5» лечит одну строку и оставляет механизм: следующее
расхождение появится при первом изменении складского сида. Настоящая развилка — считает ли мок
аналитики свои числа из чужих сторов (как это делает мок склада, импортирующий `MOCK_SETTINGS`,
`frontend_vue/src/services/mocks/warehouse.ts:42`) или остаётся витриной. Это решение про то,
чем мок служит, и оно шире одного домена.

### Future rule

Мок держат к тем же правилам, что и приложение. Число, выведенное из другого числа, в моке либо
выводится кодом, либо снабжается тестом равенства — иначе оно расходится молча и живёт
расхождением до первого человека, который сложит колонку.

---

## БАГ-04 — `icon` шлётся всегда, читает его одна страница из восьми, и знает половину имён

**File:** `frontend_vue/src/views/admin/analytics/DashboardPage.vue:15-24,95` ·
`frontend_vue/src/views/admin/analytics/WarehousePage.vue:48` ·
`frontend_vue/src/types/analytics.ts:27`
**Severity:** Medium — поле контракта, которое почти никто не читает, и тихий промах у того, кто читает.
**Источник:** К4 (формы ответа) — сверка вокабуляра.

### Problem

`KpiItem.icon: string` объявлен обязательным (`types/analytics.ts:27`), и мок шлёт его у каждой
KPI-карточки — десять различных имён: `alert`, `chart-bar`, `check`, `clock`, `currency`,
`package`, `receipt`, `trending-up`, `truck`, `users`
(`grep -c "icon: '" frontend_vue/src/services/mocks/analytics.ts` → `25`, уникальных 10).

Читает его **одна** страница: `<path :d="kpiIconPaths[kpi.icon] ?? ''" />`
(`DashboardPage.vue:95`), и её карта знает пять имён из десяти — `chart-bar`, `receipt`,
`trending-up`, `currency`, `alert` (`:15-24`). Неизвестное имя даёт `d=""`, то есть пустую
иконку без единого предупреждения.

Остальные семь страниц поле игнорируют:
- пять рисуют один и тот же жёстко вписанный путь всем карточкам подряд —
  `WarehousePage.vue:48`, `SalesPage.vue:48`, `SupplyPage.vue:48-50`, `LogisticsPage.vue:48`,
  `DeficitPage.vue:48-50`;
- две вообще не рисуют иконку: у `StaffPage.vue:26-34` и `PlReportPage.vue:27-35` в карточке нет
  блока `kpi-icon`.

`grep -n "kpi.icon" frontend_vue/src/views/admin/analytics/*.vue` → одно попадание,
`DashboardPage.vue:95`.

### Problem — почему это про контракт

Сервер обязан отдавать имя иконки из замкнутого набора, который нигде не объявлен: в типе это
`string` (`types/analytics.ts:27`), в контракте — ничего, а единственный потребитель знает
половину значений, которые шлёт единственный источник. Обе стороны при этом «работают»: на семи
страницах промах невидим, потому что поле не читают.

### Fix

TBD — три взаимоисключающих пути, выбор за владельцем: (а) `icon` становится перечислением в типе
и карта иконок общей для восьми страниц; (б) поле уходит из контракта, а иконка выбирается фронтом
по `key`; (в) остаётся как есть, и тогда контракт обязан прямо сказать, что поле читает только
дашборд. Догадка здесь дороже пропуска.

### Future rule

Поле, чей допустимый набор значений живёт в шаблоне потребителя, а не в типе, расходится с
источником молча. Либо перечисление в `types/`, либо тест «каждое значение из мока есть в карте
потребителя».

---

## БАГ-05 — три разных форматирования одних и тех же денег, одно из них — по локали браузера

**File:** `frontend_vue/src/views/admin/analytics/DashboardPage.vue:131` ·
`frontend_vue/src/views/admin/analytics/SalesPage.vue:84` ·
`frontend_vue/src/views/admin/analytics/StaffPage.vue:124`
**Severity:** Medium — одинаковые величины на соседних экранах выглядят по-разному, и одна из
записей зависит от настроек браузера, а не приложения.
**Источник:** К4 (формы ответа).

### Problem

Денежные величины приходят двумя способами: уже отформатированной строкой
(`KpiItem.value: string`, `types/analytics.ts:16`, в моке `'127 400'`, `mocks/analytics.ts:31`) и
сырым числом (`ChartBarItem.value`, `TopClientItem.value`, `RevenueItem.value` —
`types/analytics.ts:42,84,144`). Сырые числа фронт форматирует тремя разными способами:

1. `mocks/analytics.ts` — сервер форматирует сам, узкими пробелами и в разном порядке со знаком:
   `'€248 000'` префиксом (`:159`) против `'26 000 €'` суффиксом (`:231`);
2. `DashboardPage.vue:131` — руками, регуляркой:
   `item.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'`;
3. `SalesPage.vue:84` и `StaffPage.vue:124` — `value.toLocaleString()` без аргументов, то есть по
   локали **браузера**, а не приложения. Приложение своё состояние языка держит отдельно
   (`localStorage 'flexiron_lang'`, `frontend_vue/src/i18n/index.ts:4,12`), и `toLocaleString()`
   о нём не знает: у пользователя с браузером `en-US` то же число получит запятые, у него же с
   `de-DE` — точки, при неизменном языке интерфейса.

### Fix

TBD. Развилка контрактная, а не косметическая: форматирует сервер (тогда все денежные поля
становятся строками и `ChartBarItem.value: number` уходит) или форматирует фронт (тогда строковые
`KpiItem.value` становятся числами, а формат — одной общей функцией, знающей язык приложения и
валюту арендатора). Смешение двух способов — то, что сейчас в коде, — и порождает три записи
одного числа.

### Future rule

`toLocaleString()` и `Intl.*` без явного аргумента локали берут локаль браузера. В приложении со
своим переключателем языка это всегда ошибка — локаль передаётся явно.

---

## БАГ-06 — `percentage` означает разное в соседних полях одного ответа

**File:** `frontend_vue/src/services/mocks/analytics.ts:81-85` · `:420-449` · `:453-459`
**Severity:** Medium — сервер обязан считать поле, правило для которого не определено.
**Источник:** К6 (обязанности сервера), графа «Производные значения».

### Problem

Поле `percentage` есть у восьми типов ответа
(`types/analytics.ts:43,75,86,94,113,146,166,205`), и
единственный его потребитель везде один — ширина полосы `width: item.percentage + '%'`
(`DashboardPage.vue:125`, `SalesPage.vue:76,104`, `StaffPage.vue:112`, `LogisticsPage.vue:107`,
`SupplyPage.vue:111`, `DeficitPage.vue:109`). Фронту всё равно, а сервер должен знать правило —
и в моке правил три:

- `refusalReasons` — доля от целого: 62 + 28 + 10 = **100** (`:453-459`);
- `salesByCategory` — не доля: 78 + 55 + 38 + 20 + 12 = **203**, и не доля от максимума тоже
  (у максимума 78, а не 100) (`:81-85`);
- `topClients` — 88 + 62 + 45 + 30 + 19 = **244** (`:420-449`).

Что `value` рядом с ними — настоящая величина, проверяется: сумма `salesByCategory.value` равна
KPI «Выручка (мес.) 84 200» (32400 + 22800 + 15900 + 8200 + 4900 = 84200; `:81-85` против `:50-52`).
То есть расходится именно производное поле.

### Fix

TBD — какое из трёх правил верное, решает владелец: доля от суммы, доля от максимума ряда или
масштаб полосы. Пока правило не названо, сервер не сможет посчитать поле воспроизводимо, а
контракт — описать его иначе как «число от 0 до 100».

### Future rule

Производное поле, которое сервер обязан посчитать, описывается формулой, а не типом. `percentage:
number` — не описание; описание это «доля `value` в сумме ряда, округлённая до целого».

---

## БАГ-07 — неизвестное значение `page` даёт 200 с пустым ответом вместо ошибки

**File:** `frontend_vue/src/services/mocks/analytics.ts:1036-1042` ·
`frontend_vue/src/services/mocks/index.ts:310`
**Severity:** Medium — путь ошибки домена не воспроизводится под моками вовсе.
**Источник:** К3 (коды ошибок).

### Problem

Резолвер мока на неизвестное значение возвращает валидный пустой `DashboardData`:

```ts
default:
  return { kpis: [], salesByCategory: [], alerts: [], sectionPreviews: [] }
```

(`mocks/analytics.ts:1036-1042`). Ветка маршрутизации при этом принимает **любой** хвост, включая
слэши: `path.match(/^\/api\/analytics\/(.+)$/)` (`mocks/index.ts:310`), — то есть
`/api/analytics/foo/bar` тоже успешно вернёт пустоту.

Следствий два. Первое: клиент не может отличить «за период нет данных» от «такой страницы нет» —
`useAnalytics` в обоих случаях получит объект, а не ошибку (`composables/useAnalytics.ts:16`), и
покажет пустой экран без сообщения. Второе, для контракта важнее: у домена **ноль** кодов ошибок
(`grep -c "throw" frontend_vue/src/services/mocks/analytics.ts` → `0`), значит путь ошибки не
воспроизводится под моками ни одним способом, и настоящий сервер, отвечающий 404, встретит фронт,
который этого не ждал.

Из UI неизвестное значение сейчас недостижимо: маршрутов ровно восемь, все литеральные
(`frontend_vue/src/router/index.ts:89,95,101,107,113,119,125,131`), а тип сегмента сужен
(`analyticsService.ts:4`). Достижимо оно из мока, который принимает `page: string`
(`mocks/analytics.ts:1018`).

### Fix

TBD — что сервер отвечает на неизвестное значение `page` (404 `NOT_FOUND` из
`backend/app/core/exceptions.py:20` или 422), решает владелец; после этого мок обязан бросать тот
же код, а регулярка — сужаться до восьми известных значений.

### Future rule

Мок, который на неверный вход отвечает успехом, делает недостижимой ветку обработки ошибки во
фронте. Ветка, которую нельзя вызвать, не проверена ничем.

---

## БАГ-08 — число из отчёта лежит в файле переводов

**File:** `frontend_vue/src/i18n/admin/analytics.ts:51,251,451` ·
`frontend_vue/src/views/admin/analytics/SalesPage.vue:91`
**Severity:** Medium — данные подписаны как перевод, меняются правкой словаря на трёх языках.
**Источник:** К6 (обязанности сервера), графа «Значения по умолчанию».

### Problem

Значок панели «Причины отказов» на странице продаж рендерится как
`{{ t('sales.badge_deals') }}` (`SalesPage.vue:91`), а в словаре это
`badge_deals: '29 сделок'` (`i18n/admin/analytics.ts:51`), `'29 deals'` (`:251`),
`'29 sandoriai'` (`:451`). Двадцать девять — величина из отчёта, а не подпись: она обязана
приходить с сервера вместе с `refusalReasons`, из которых и посчитана.

Рядом тот же приём применён к периоду: `badge_march: 'Март 2026'` повторён 21 раз — по семь
секций в каждой из трёх локалей (`:15,50,67,86,118,141,190`, `:215,250,267,286,318,341,390`,
`:415,450,467,486,518,541,590`), плюс `badge_april` (`:142,342,542`), `badge_q1` (`:68,87,268,287,
468,487`), `badge_today` (`:191,391,591`). Всего таких подписей на восьми страницах семнадцать
(`grep -n "badge_" frontend_vue/src/views/admin/analytics/*.vue` → 17). Ответ при этом периода не
несёт вовсе: `grep -c "asOf\|generatedAt\|timestamp" frontend_vue/src/types/analytics.ts` → `0`.

### Fix

TBD — перенос периода и числа сделок в тело ответа это изменение контракта
(`DashboardData` получает поля периода и подписи панелей), и его форма — решение владельца, оно
вынесено в `roo_code/plans/api/audit/00-решения-владельца.md`.

### Future rule

В файле переводов лежат подписи, а не значения. Цифра в словаре — признак того, что поле забыли в
контракте: перевод «29 сделок» не переведёт следующие тридцать.

---

## БАГ-09 — ошибка загрузки показывается сырым текстом сервера

**File:** `frontend_vue/src/composables/useAnalytics.ts:17-19` ·
`frontend_vue/src/views/admin/analytics/DashboardPage.vue:79` (и семь таких же строк)
**Severity:** Low — путь редкий, но не проверен и не оформлен ничем.
**Источник:** К3 (коды ошибок).

### Problem

`catch` кладёт в состояние текст исключения:

```ts
error.value = e instanceof Error ? e.message : 'Failed to load analytics'
```

(`useAnalytics.ts:17-19`), а восемь страниц печатают его как есть:
`<div v-else-if="error" class="error-state">{{ error }}</div>` — `DashboardPage.vue:79`,
`WarehousePage.vue:33`, `SalesPage.vue:33`, `SupplyPage.vue:33`, `StaffPage.vue:24`,
`LogisticsPage.vue:33`, `PlReportPage.vue:25`, `DeficitPage.vue:33`.

Против настоящего сервера `e.message` — это `message` из тела ответа
(`frontend_vue/src/services/api.ts:117-124`), то есть текст сервера на его языке, а `code`
(`ApiRequestError.code`) не читается вовсе. Запасная строка `'Failed to load analytics'` —
единственная в домене строка интерфейса мимо i18n.

Проверить это состояние нечем: у блока нет `data-test`
(`grep -n "error-state" frontend_vue/src/views/admin/analytics/*.vue` — восемь строк, ни одного
атрибута), в e2e домена оно не встречается (`grep -rn "error-state"
frontend_vue/tests/e2e/admin/analytics/` — пусто). Стиля у него на этих страницах тоже нет:
`.error-state` определён только в css чужих страниц —
`frontend_vue/src/styles/admin/finance_list.css:45`,
`frontend_vue/src/styles/admin/services_list.css:249`,
`frontend_vue/src/styles/admin/suppliers_list.css:851`. Ни один из них аналитика не импортирует:
её единственный импорт стилей — `frontend_vue/src/views/admin/analytics/PlReportPage.vue:7`.

### Fix

TBD — оформление зависит от того, какие коды ошибок у домена появятся (БАГ-07): пока каталог
пуст, сообщение не к чему привязать.

### Future rule

Сообщение об ошибке — такой же элемент интерфейса, как остальные: ему нужны перевод, стиль и
`data-test`. Ветка, которую e2e не открывает, не проверена ничем, даже на то, что она вообще
рендерится.

---

## Сводка

| | Тип | Файл | Суть |
|---|---|---|---|
| | Contract | `DashboardPage.vue` | БАГ-01: карточка P&L печатает ключ `sub.pl-report` — перевода нет |
| | Contract | `analyticsService.ts` | БАГ-02: единственный вызов домена не шлёт `Authorization` |
| | Mock data | `mocks/analytics.ts` | БАГ-03: KPI «8 позиций в дефиците» против таблицы из пяти строк |
| | Contract | `DashboardPage.vue` | БАГ-04: `icon` читает одна страница из восьми и знает 5 имён из 10 |
| | Contract | `SalesPage.vue` | БАГ-05: три формата одних и тех же денег, один — по локали браузера |
| | Contract | `mocks/analytics.ts` | БАГ-06: `percentage` — доля от целого в одном поле и масштаб в двух соседних |
| | Contract | `mocks/analytics.ts` | БАГ-07: неизвестный `page` даёт 200 с пустым ответом вместо ошибки |
| | Contract | `i18n/admin/analytics.ts` | БАГ-08: «29 сделок» и период отчёта лежат в файле переводов |
| | Contract | `useAnalytics.ts` | БАГ-09: ошибка показывается сырым текстом сервера, без кода и стиля |
