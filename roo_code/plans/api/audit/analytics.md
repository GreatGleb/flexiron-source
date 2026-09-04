# Аудит контракта — analytics

Эндпоинтов в коде: **1**. Реализовано бэкендом: **0**.

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-analytics-bugs.md`.

> **Модуля `analytics` на бэкенде нет вовсе** — не «есть, но без роутов», как у `warehouse` или
> `notifications`, а нет каталога: `ls backend/app/modules/` даёт `auth bcc billing finance
> notifications products services settings suppliers warehouse` и ни одного `analytics`. Ни модели,
> ни таблицы: `grep -rn "analytic" backend/ --include=*.py` даёт ровно два попадания, и оба —
> текст описания фичи в сид-миграции
> (`backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py:28,34`), то есть слово в
> переводе, а не код. По К5 старшинство «бэкенд» здесь не наступает, источник истины — мок и
> клиент.
>
> **Домен особый по природе: он ничего не хранит.** Все 20 массивов ответа — производные от чужих
> сущностей (склад, заказы, поставщики, финансы, пользователи). Поэтому главное содержимое этого
> аудита не в форме ответа, а в графе «Производные значения»: там перечислено, что именно сервер
> обязан посчитать и из чего, — и там же видно, что для двух страниц из восьми считать **не из
> чего**, потому что исходных сущностей нет ни во фронте, ни на сервере.

## Эндпоинты

### GET /api/analytics/:id
- Вызывающий: `src/services/analyticsService.ts:5`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:310`
- Форма запроса: **только сегмент пути, ни одного query-параметра и ни одного заголовка.**
  Клиент — шесть строк целиком: `apiGet<DashboardData>(\`/api/analytics/${page}\`)`
  (`src/services/analyticsService.ts:5`), вызванный без второго и третьего аргументов, то есть без
  `params` и без `options.headers` — а `options?.headers` единственный источник заголовков у GET
  (`src/services/api.ts:157-159`). `grep -c "Idempotency\|Authorization\|authHeaders"
  src/services/analyticsService.ts` → `0` (см. БАГ-02).
  Сегмент типизирован `AnalyticsPageKey` (`src/services/analyticsService.ts:4`) — замкнутый союз из
  восьми литералов: `'dashboard' | 'warehouse' | 'sales' | 'supply' | 'staff' | 'logistics' |
  'pl-report' | 'deficit'` (`src/types/analytics.ts:3-11`). Восемь значений = восемь страниц, каждая
  зовёт своё: `useAnalytics('dashboard')` (`src/views/admin/analytics/DashboardPage.vue:11`),
  `'warehouse'` (`WarehousePage.vue:8`), `'sales'` (`SalesPage.vue:8`), `'supply'`
  (`SupplyPage.vue:8`), `'staff'` (`StaffPage.vue:8`), `'logistics'` (`LogisticsPage.vue:8`),
  `'pl-report'` (`PlReportPage.vue:10`), `'deficit'` (`DeficitPage.vue:8`). Мок принимает
  `page: string` без сужения (`mocks/analytics.ts:1018`), а его ветка ловит регуляркой
  `/^\/api\/analytics\/(.+)$/` (`mocks/index.ts:310`) — то есть любой хвост, включая слэши
  (см. БАГ-07).
- Форма ответа: `ApiResponse<DashboardData>` — конверт снимает `unwrap()`, возвращая `json.data`
  (`src/services/api.ts:127-138`), тип объявлен `src/types/analytics.ts:216-251`.
  **Один shape на все восемь значений `page`, дискриминации нет:** четыре поля обязательны —
  `kpis: KpiItem[]`, `salesByCategory: ChartBarItem[]`, `alerts: AlertItem[]`,
  `sectionPreviews: AnalyticsSectionPreview[]` (`:217-220`), — и **шестнадцать** необязательных,
  по два на страницу (`:222-250`). Страница, которой поле не принадлежит, получает `[]`, а не
  отсутствие ключа: `warehouseData` шлёт `salesByCategory: []`, `alerts: []`, `sectionPreviews: []`
  (`mocks/analytics.ts:365-372`), и так же все остальные семь.
  Раскладка «значение `page` → какие поля непусты», замерено по моку:
  `dashboard` → `kpis` (5), `salesByCategory` (5), `alerts` (5), `sectionPreviews` (7)
  (`mocks/analytics.ts:243-248`); `warehouse` → `kpis` (4), `deadstock` (5), `turnover` (5)
  (`:365-372`); `sales` → `kpis` (4), `topClients` (5), `refusalReasons` (3) (`:462-469`);
  `supply` → `kpis` (4), `suppliers` (4), `supplyCategories` (4) (`:578-585`);
  `staff` → `kpis` **пуст**, `managers` (4), `workers` (3), `revenues` (4) (`:670-678`);
  `logistics` → `kpis` (4), `routes` (5), `loads` (4) (`:795-802`);
  `pl-report` → `kpis` **пуст**, `plRows` (10), `calendarEvents` (6) (`:877-884`);
  `deficit` → `kpis` (4), `deficitItems` (5), `refusalVolumes` (5) (`:1007-1014`).
  Все человекочитаемые строки — `TranslatedString` (`{ru,en,lt}`, `src/types/i18n.ts:6-10`): сервер
  отдаёт все три языка сразу, локаль выбирается на клиенте `tf()`
  (`src/composables/useTranslatedData.ts:26-32`) — перезапроса при смене языка нет. В моке
  заполнены все три без исключений: `grep -c "ru: '"` → 164, `en: '` → 164, `lt: '` → 164
  (`mocks/analytics.ts`), плюс шесть многострочных блоков с тем же балансом
  (`grep -c "^      ru:"` → 6, `"^      lt:"` → 6).
  **Числа приходят двумя несовместимыми способами.** Уже отформатированной строкой —
  `KpiItem.value: string` (`src/types/analytics.ts:16`, в моке `'127 400'`, `:31`),
  `AnalyticsMetricItem.value: string` (`:55`), `DeficitItem.stock/min` (`:192-193`),
  `PlRowItem.value` (`:174`), `LoadItem.value` (`:167`) — и сырым числом:
  `ChartBarItem.value: number` (`:42`), `TopClientItem.value` (`:84`), `RevenueItem.value` (`:144`),
  `RouteItem.revenue` (`:155`). Форматирование сырых чисел фронт делает тремя разными способами —
  см. БАГ-05.
  **Часть полей — не данные, а презентация**, и её вокабуляр замкнут фронтендом:
  `KpiItem.trend: 'up'|'down'|'neutral'` (`:26`) → CSS-класс `kpi-delta` (`DashboardPage.vue:102`);
  `KpiItem.iconColor: 'blue'|'red'|'green'|'gold'` (`:28`) → класс `icon-<цвет>` (`:84`);
  `KpiItem.icon: string` (`:27`) → путь SVG по карте из пяти имён (`DashboardPage.vue:15-24`), при
  том что мок шлёт десять (`alert`, `chart-bar`, `check`, `clock`, `currency`, `package`, `receipt`,
  `trending-up`, `truck`, `users`) и семь страниц из восьми это поле игнорируют — БАГ-04;
  `AlertItem.status` (`:36`) → и класс пилюли, и ключ i18n (`DashboardPage.vue:27-42`);
  `color` у `TurnoverItem` (`:78`), `TopClientItem` (`:87`), `RefusalReasonItem` (`:95`),
  `SupplyCategoryItem` (`:115`), `RevenueItem` (`:147`), `LoadItem` (`:168`),
  `RefusalVolumeItem` (`:207`) → готовый CSS-градиент (`SalesPage.vue:77-81`,
  `StaffPage.vue:113-120`); `statusType`/`ageStatus`/`errorType`/`ratingType` (`:68,106,127,138,159,
  198`) → класс пилюли.
  **И один ключ i18n сервер обязан знать буквально:** `KpiItem.unit` — «i18n key of the unit shown
  after the value, e.g. 'warehouse.unit_eur'» (`src/types/analytics.ts:17-24`), рендерится как
  `t(kpi.unit)` (`DashboardPage.vue:100`, `WarehousePage.vue:53`, и так все восемь страниц). Мок
  шлёт 15 таких ключей в шести пространствах имён; все 15 существуют во всех трёх локалях —
  проверено разбором `i18n/admin/analytics.ts` по секциям, ни одного промаха. Тот же механизм у
  `AnalyticsSectionPreview.key` (`:47`): он одновременно сегмент маршрута
  (`:to="'/admin/analytics/' + section.key"`, `DashboardPage.vue:173`) и ключ перевода
  (`t('sub.' + section.key)`, `:176`) — и на значении `'pl-report'` перевод отсутствует, БАГ-01.
- Коды ошибок: **каталог домена пуст.** Мок не бросает ничего: `grep -c "throw"
  frontend_vue/src/services/mocks/analytics.ts` → `0`, ветка `mocks/index.ts:310-313` тоже без
  бросков. Бэкенда нет, поэтому и общих кодов ядра
  (`NOT_FOUND`, `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT` —
  `backend/app/core/exceptions.py:20,27,34,41,48`) домен не наследует ни одного: наследовать
  некуда. Путь ошибки во фронте есть, но безымянный: `catch` кладёт `e.message`
  (`src/composables/useAnalytics.ts:17-19`), а восемь страниц печатают его сырым —
  `<div v-else-if="error" class="error-state">{{ error }}</div>` (`DashboardPage.vue:79`,
  `WarehousePage.vue:33`, `SalesPage.vue:33`, `SupplyPage.vue:33`, `StaffPage.vue:24`,
  `LogisticsPage.vue:33`, `PlReportPage.vue:25`, `DeficitPage.vue:33`). Ни кода, ни перевода, ни
  `data-test`, ни стиля — БАГ-09.
- Save-режим: **нет и быть не может — домен read-only.** `grep -c
  "apiPost\|apiPut\|apiPatch\|apiDelete\|apiUpload" frontend_vue/src/services/analyticsService.ts`
  → `0`; во всём домене один вызов, и он GET. Загрузка разовая и без кеша: `load()` стоит прямо в
  теле `<script setup>`, а не в `onMounted` (`DashboardPage.vue:12`, `WarehousePage.vue:9`,
  `SalesPage.vue:9`, `SupplyPage.vue:9`, `StaffPage.vue:9`, `LogisticsPage.vue:9`,
  `PlReportPage.vue:11`, `DeficitPage.vue:9`), состояние создаётся заново на каждый вызов
  композабла (`src/composables/useAnalytics.ts:7-9`) — значит каждый переход по вкладкам подшивки
  `AnalyticsSubNav` (`src/components/admin/AnalyticsSubNav.vue:9-18`) это новый запрос, и
  повторного использования ответа нет нигде.
- Пробел контракта: старый раздел — `roo_code/roo-context/03-api-contract.md:694-746`. Подтвердилось
  два утверждения, не подтвердилось шесть.
  **Подтвердилось:** восемь значений `page` из `AnalyticsPageKey` (`:703` против
  `src/types/analytics.ts:3-11`); «все 8 страниц возвращают общий shape, discriminated union не
  делаем» (`:700` против `src/types/analytics.ts:216-251` — union действительно нет).
  **Не подтвердилось:**
  (1) форма `DashboardData` показана из четырёх полей (`:707-712`), в коде их двадцать —
  шестнадцать необязательных (`src/types/analytics.ts:222-250`) в старом тексте отсутствуют
  полностью, то есть половины страниц контракт не описывает вовсе;
  (2) пример ответа даёт `label`, `title`, `description`, `type` **простыми строками**
  (`:715` — `"label": "Sheets"`, `"type": "deficit"`), в коде это `TranslatedString`
  (`src/types/analytics.ts:15,32-35,40,49,54`) — форма поля другая;
  (3) `AlertItem.type` в примере выглядит перечислением (`"type": "deficit"`), в коде это
  переведённая подпись, а перечислением является `status` (`src/types/analytics.ts:32-36`);
  (4) `KpiItem` в примере без поля `unit` (`:715`), в коде оно есть и несёт ключ i18n
  (`src/types/analytics.ts:17-24`) — это самая нагруженная обязанность сервера в домене;
  (5) «Когда: `onMounted` каждой analytics view» (`:702`) — `load()` вызывается в теле
  `<script setup>`, `onMounted` в каталоге `views/admin/analytics/` не встречается ни разу
  (`grep -n "onMounted" views/admin/analytics/*.vue` — пусто);
  (6) «heavy кеш (5 мин per-user)» и «Permission `read` на соответствующий модуль» (`:717`) — ни
  того, ни другого в коде нет: кеша нет нигде (см. Save-режим), проверки права нет ни во фронте
  (гейт только фича-флагами, `src/router/index.ts:92,98,104,110,116,122,128,134`), ни на сервере
  (модуля нет). Обе строки — задание, которое некому подтвердить; вынесены владельцу.
  **Отдельно про формат:** старый текст разворачивает динамический сегмент в восемь заголовков
  `### GET /api/analytics/dashboard` … `### GET /api/analytics/deficit` (`:721-743`). В коде такого
  вызова нет ни одного — путь строится шаблоном (`analyticsService.ts:5`), инвентарь видит один
  эндпоинт `GET /api/analytics/:id`. Переносить эти восемь заголовков нельзя: спека К1 прочитает их
  как восемь несуществующих эндпоинтов (правило шага 3 скила). Содержательная часть строк
  (какая страница про что) переносится прозой внутрь единственного раздела.
  **Не описано нигде, ни старым текстом, ни кодом:** период отчёта (см. «Правила домена», п. 1),
  валюта (п. 2), смысл `percentage` (п. 3), происхождение каждого числа (п. 4).
- Источник истины: **мок + клиент** (ступень 2 старшинства). Бэкенда нет — модуля нет в
  `backend/app/modules/`; замысел (`03-api-contract.md:694-746`) старше кода по времени, но
  расходится с ним в шести местах выше, поэтому ступенью 3 не пользуемся. Раздел контракта пишется
  по `src/types/analytics.ts:216-251` (форма) и `mocks/analytics.ts:1018-1044` (раскладка по
  страницам); всё, чего мок не знает — период, валюта, права, источники чисел, — идёт в контракт
  строками «осталось» и в `00-решения-владельца.md`, а не выдумывается.

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец: **валюта домена — константа перевода, а не настройка
  арендатора.** Единица `unit_eur` переведена как литерал `'EUR'` пятнадцать раз — по пять секций
  в каждой из трёх локалей (`frontend_vue/src/i18n/admin/analytics.ts:5,41,57,159,184`,
  `:208,244,261,359,384`, `:405,441,457,559,584`), и
  именно эта строка печатается после каждой денежной величины (`t(kpi.unit)`,
  `DashboardPage.vue:100`). Ещё в трёх местах символ валюты вшит прямо в шаблон:
  `+ ' €'` (`DashboardPage.vue:131`), `{{ client.value.toLocaleString() }} €`
  (`SalesPage.vue:84`), `{{ rev.value.toLocaleString() }} €` (`StaffPage.vue:124`). И сам мок
  вкладывает знак в строку значения — причём непоследовательно: `'€248 000'` префиксом
  (`mocks/analytics.ts:159`) против `'26 000 €'` суффиксом (`:231`). Владелец валюты при этом —
  настройки: `AppSettings.currencies` (`frontend_vue/src/types/settings.ts:239`) и
  `constants.defaultCurrency` (`:17`, дефолт `'EUR'` в состоянии композабла
  `src/composables/useSettings.ts:27`). Аналитика к настройкам не обращается ни разу:
  `grep -rn "useSettings\|settings\." frontend_vue/src/views/admin/analytics/
  frontend_vue/src/composables/useAnalytics.ts frontend_vue/src/services/mocks/analytics.ts` — пусто.
  То же с единицами измерения: `'т'`, `'шт.'`, `'поз.'`, `'дн.'` — литералы перевода
  (`i18n/admin/analytics.ts:6,7,42,111`), тогда как справочником единиц владеют настройки
  (`AppSettings.uoms`, `types/settings.ts:240`). → владельцу.
- События и уведомления: **домен не рождает ни одного.** `grep -c "notify" 
  frontend_vue/src/services/mocks/analytics.ts` → `0`; ни один из семи триггеров уведомлений
  (`frontend_vue/src/services/mocks/notifications.ts:542,566,592,616,637,657,684`) аналитики не
  касается — `grep -cin "analytic" frontend_vue/src/services/mocks/notifications.ts` → `0`. Это
  ожидаемо для чтения, и обратная сторона тоже верна: домен **потребляет** те же события с другой
  стороны — «Запас листа 2 мм критически мал», `status: 'critical'`
  (`mocks/analytics.ts:90-97`) описывает ровно то, о чём складской мок шлёт `notifyStockDeficit`
  (`frontend_vue/src/services/mocks/warehouse.ts:1710`). Связи между этими двумя источниками в коде
  нет: массив `alerts` — литерал (`mocks/analytics.ts:88-134`), из уведомлений он не строится. Чем
  сервер обязан наполнять `alerts` — теми же событиями или отдельным правилом — не сказано нигде.
  → владельцу.
- Запись в аудит-лог: **чтение следа не оставляет, и это единственное, что известно.**
  `grep -c "auditLog" frontend_vue/src/services/mocks/analytics.ts` → `0`; замкнутый перечень
  сущностей ленты аудита аналитики не содержит — девять типов, все чужие
  (`frontend_vue/src/types/audit.ts:5-14`). Обратное — нужно ли писать след о самом просмотре
  отчёта (P&L и себестоимость видны не всем ролям, см. графу «Права») — в домене не выражено
  ничем. → владельцу.
- Кастомные поля: **домен их не касается ни в одну сторону.** `grep -cn "fieldValues\|fieldDefinition\|customField"
  frontend_vue/src/types/analytics.ts frontend_vue/src/services/mocks/analytics.ts` → `0` и `0`;
  разрезов по кастомному полю товара нет ни в одном из 20 массивов ответа
  (`src/types/analytics.ts:216-251`), хотя определения полей существуют отдельным доменом
  (`FieldDefinition`, `frontend_vue/src/types/config.ts:5`) и значения у товаров тоже
  (`fieldValues`, `frontend_vue/src/types/product.ts`). Наблюдение, а не пробел: расширять отчёты
  кастомными разрезами никто не просил — но и запрета в коде нет.
- Настройки, которых мок не отслеживает: **все до единой.** Мок аналитики импортирует **только
  типы** — `grep -c "^import " frontend_vue/src/services/mocks/analytics.ts` → `2`, оба
  `import type` (`:1-23`), — то есть не читает ни `MOCK_SETTINGS`, ни один чужой стор, в отличие от
  складского мока, который `MOCK_SETTINGS` импортирует явно
  (`frontend_vue/src/services/mocks/warehouse.ts:42`). Практическое следствие измеримо: ставка НДС
  (`vatRate`, `types/settings.ts:15`), маржа по умолчанию, валюта, единицы, набор статусов заказа
  меняются в настройках — числа аналитики не двигаются никогда. Под моками все 1044 строки домена
  — литералы, дат в них нет вообще (`grep -c "new Date\|Date.now\|createdAt"
  frontend_vue/src/services/mocks/analytics.ts` → `0`).
- Мультиарендность: **во фронте не выражена ничем.** Клиент не шлёт ни `tenantId`, ни заголовка:
  единственный вызов идёт без `options` (`src/services/analyticsService.ts:5`), а `options?.headers`
  — единственный источник заголовков у GET (`src/services/api.ts:157-159`);
  `grep -cin "tenant\|user_id\|userId" frontend_vue/src/services/mocks/analytics.ts` → `0`. У
  соседних доменов с живым бэкендом заголовок есть — `Authorization: Bearer` из `authHeaders()`
  (`src/composables/useAuth.ts:101-108`, потребители `src/services/settingsService.ts:21`,
  `src/services/auditFeedService.ts:23`, `src/services/uploadsService.ts:15`), и сервер достаёт
  из токена пользователя и его арендатора. На стороне схемы арендатор обязателен у всех сущностей,
  из которых отчёт считается: `tenant_id` у шести складских таблиц
  (`backend/app/modules/warehouse/shared/models.py:16,96,136,173,207,234`) и у трёх финансовых
  (`backend/app/modules/finance/shared/models.py:16,63,98`). То есть выборка обязана быть
  ограничена арендатором, а как сервер о нём узнает — в домене не сказано. → БАГ-02 и владельцу.
- Права — в какой функции проверяются: **нигде, ни во фронте, ни на сервере.** Восемь маршрутов
  закрыты только фича-флагами — `adminDashboard`, `adminWarehouse`, `adminSales`, `adminSupply`,
  `adminStaff`, `adminLogistics`, `adminPlReport`, `adminDeficit`
  (`frontend_vue/src/router/index.ts:92,98,104,110,116,122,128,134`; значения — константы `true`,
  `frontend_vue/src/config/featureFlags.ts:6-13`), а внутри дашборда ещё две секции гейтятся
  флагами `dashboardAlerts`/`dashboardCharts` (`DashboardPage.vue:9-10`,
  `featureFlags.ts:30-31`). Флаг — это тариф, а не роль: в матрице прав
  (`frontend_vue/src/services/mocks/config.ts`) аналитики нет —
  `grep -cin "analytic\|dashboard\|report" frontend_vue/src/services/mocks/config.ts` → `0`, а
  серверная проверка прав вообще заглушка, возвращающая `True`
  (`backend/app/modules/auth/internal_api/interface.py:27-38`). **Но словарь этих десяти флагов у
  сервера есть**, и он тот же: все десять ключей засеяны в `feature_definitions` миграцией —
  восемь страничных (`backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py:27-50`,
  `level="page"`) и два секционных `dashboardAlerts`/`dashboardCharts` (`:89-94`,
  `level="section"`), все с `is_system=False`; таблица объявлена «Registry of all known feature
  flag keys — single source of truth» (`backend/app/modules/billing/shared/models.py:137-138`).
  Эндпоинта между этим реестром и константой фронта нет ни одного, роутов у модуля `billing` — 0
  (`grep -rn "@router\." backend/app/modules/billing --include=*.py` — пусто). То есть один и тот
  же словарь существует дважды и синхронизируется руками — частный случай засеянного решения
  владельца №1, замеренный на этом домене. При этом три права заказов, которые
  прямо про видимость денег, — `seeCost`, `manualCost`, `correction`
  (`frontend_vue/src/composables/useOrderPermissions.ts:28-30`) — на P&L и себестоимость складского
  отчёта не влияют никак: `grep -cn "useOrderPermissions\|seeCost"
  frontend_vue/src/views/admin/analytics/*.vue` → `0`. Отдельно: флаг `adminWarehouse` один на две
  разные вещи — отчёт `analytics/warehouse` (`router/index.ts:98`) и семь операционных страниц
  склада (`:258,264,276,282,288,306,318`). → владельцу.
- Транзакционность и идемпотентность: **не применимо по составу домена, и это доказуемо.** Ни
  одной записи: `grep -c "apiPost\|apiPut\|apiPatch\|apiDelete\|apiUpload"
  frontend_vue/src/services/analyticsService.ts` → `0`; `Idempotency-Key` не шлётся
  (`grep -c "Idempotency" frontend_vue/src/services/analyticsService.ts` → `0`) при том, что
  механизм в проекте есть (`frontend_vue/src/services/api.ts:240-245`). Единственное требование
  этого класса, которое к чтению всё-таки относится, — **согласованность среза**: восемь страниц
  это восемь независимых запросов (`useAnalytics.ts:16`, по вызову на страницу), между которыми
  данные могут измениться, и одна страница может показать цифры двух разных моментов. Обязан ли
  сервер отдавать срез на одну отметку времени — не сказано нигде: отметки в ответе нет вовсе
  (`grep -c "asOf\|generatedAt\|timestamp" frontend_vue/src/types/analytics.ts` → `0`). → владельцу.
- Производные значения (считать, не хранить): **весь ответ целиком — производное; своих таблиц у
  домена нет** (модуля в `backend/app/modules/` нет, миграции нет). Источники по массивам, как их
  описывают подписи и значения мока:
  `deadstock`/`turnover` (`mocks/analytics.ts:252-322`) — склад
  (`backend/app/modules/warehouse/shared/models.py:14` `warehouse_batches`, `:205` `stock_items`,
  роутов 0);
  `salesByCategory`, `topClients`, `refusalReasons`, `revenues` (`:80-86`, `:419-460`, `:648-669`) —
  заказы, у которых **модуля на бэкенде нет вовсе** (`ls backend/app/modules/` — `orders`
  отсутствует);
  `suppliers.deliveries/ontime` (`:516-550`) — поставщики, но полей нет и во фронте: в типе
  `Supplier` есть `rating` и `leadTime` и **нет** ни счётчика поставок, ни процента вовремя
  (`frontend_vue/src/types/supplier.ts:12-31`);
  `plRows`, `calendarEvents` (`:806-876`) — финансы
  (`backend/app/modules/finance/shared/models.py:14` `finance_payments`, роутов 0);
  `managers`/`workers` (`:589-647`) — пользователи (`backend/app/modules/auth/shared/models.py`);
  `deficitItems`/`refusalVolumes` (`:931-1006`) — складской дефицит
  (`warehouse_deficits`, `backend/app/modules/warehouse/shared/models.py:171`);
  `routes`/`loads` (`:725-794`) — **источника нет ни одного**: домена логистики не существует ни во
  фронте, ни на бэкенде (`grep -rln -i "logistic" frontend_vue/src backend/app` вне аналитики даёт
  только совпадения в чужих строках — название секции карточки `sec-logistics`
  (`services/mocks/config.ts:154`), должность контакта (`services/mocks/suppliers.ts:158`), имя
  клиента `UAB Krantas Logistics` (`services/mocks/clients.ts:216`) — и фича-флаг
  (`types/features.ts`)).
  Сам мок не считает **ничего**: он импортирует только типы (`:1-23`), поэтому связь «число отчёта
  ↔ данные домена» в коде не выражена нигде, и расхождения не ловятся — на странице дефицита KPI
  говорит «8 позиций» (`:892`), а таблица под ним содержит 5 строк (`:931-1006`, БАГ-03).
  Отдельно — `percentage`: сервер шлёт его рядом со значением, но правило разное в соседних полях
  одного ответа (см. «Правила домена», п. 3). → владельцу.

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет.

1. **Период отчёта не передаётся, не возвращается и подписан переводом.** Ни запрос
   (`analyticsService.ts:5` — параметров нет), ни ответ периода не знают: во всём файле типов нет
   ни отметки времени, ни границ интервала —
   `grep -c "asOf\|generatedAt\|timestamp" frontend_vue/src/types/analytics.ts` → `0`, и ни одно
   из двадцати полей `DashboardData` (`src/types/analytics.ts:216-251`) даты не несёт.
   При этом на экране он показан — и взят из словаря переводов: `badge_march` повторён 21 раз, по
   семь секций в каждой из трёх локалей — `'Март 2026'`
   (`frontend_vue/src/i18n/admin/analytics.ts:15,50,67,86,118,141,190`), `'March 2026'`
   (`:215,250,267,286,318,341,390`), `'Kovo 2026'` и `'2026 m. kovas'`
   (`:415,450,467,486,518,541,590`), — плюс `badge_april`, `badge_q1`, `badge_today`. Рендерится
   это как `t('dashboard.badge_march')` (`DashboardPage.vue:111`) и ещё в шестнадцати местах:
   `grep -n "badge_" views/admin/analytics/*.vue` → 17 попаданий. Значит смена месяца требует правки словаря
   переводов на трёх языках. Старый контракт зарезервировал `{ from, to, granularity }`
   «на будущее» (`03-api-contract.md:704`) — в коде этого нет.
   **Хуже того, в подписи периода спрятаны данные:** `badge_deals: '29 сделок'`
   (`i18n/admin/analytics.ts:51`, `'29 deals'` `:251`, `'29 sandoriai'` `:451`) — число из отчёта,
   живущее в файле переводов.
2. **Валюта и единицы измерения домена — константы, а не настройка арендатора.** Подробности с
   ссылками — в графе «Значения по умолчанию»; правило в том, что отчёт нельзя показать арендатору
   с другой валютой, не тронув `i18n/admin/analytics.ts` и три шаблона.
3. **Поле `percentage` означает разное в соседних полях одного ответа.** В `refusalReasons` это
   доля от целого: 62 + 28 + 10 = 100 (`mocks/analytics.ts:453-459`). В `salesByCategory` — нет:
   78 + 55 + 38 + 20 + 12 = 203, и это не доля от максимума тоже (у максимума 78, а не 100)
   (`:81-85`). В `topClients` — 88 + 62 + 45 + 30 + 19 = 244 (`:420-449`). Потребитель во всех
   случаях один и тот же — ширина полосы `width: item.percentage + '%'`
   (`DashboardPage.vue:125`, `SalesPage.vue:76,104`, `StaffPage.vue:112`, `LogisticsPage.vue:107`,
   `SupplyPage.vue:111`, `DeficitPage.vue:109`), — то есть фронту всё равно, а серверу нужно
   правило, и правила нет. Проверяемое следствие: в `salesByCategory` сумма `value` равна KPI
   «Выручка (мес.) 84 200» (`mocks/analytics.ts:52`; 32400+22800+15900+8200+4900 = 84200), то есть
   `value` — настоящая доля, а `percentage` рядом с ней — нет.
4. **Ключи, которые сервер обязан знать буквально, потому что фронт ими индексирует свои словари.**
   Их четыре семейства, и все замкнуты кодом фронта, а не схемой:
   `KpiItem.unit` → ключ i18n (`types/analytics.ts:17-24`, потребитель `t(kpi.unit)`,
   `DashboardPage.vue:100`);
   `AnalyticsSectionPreview.key` → одновременно сегмент маршрута и ключ `sub.<key>`
   (`DashboardPage.vue:173,176`);
   `KpiItem.icon` → карта из пяти путей SVG (`DashboardPage.vue:15-24`);
   `AlertItem.status` → карта классов и карта ключей подписи (`:27-42`).
   У всех четырёх промах тихий: `kpiIconPaths[kpi.icon] ?? ''` рисует пустой путь (`:95`),
   `t()` печатает сам ключ. Один промах уже есть в коде — БАГ-01.
5. **Восемь страниц — восемь запросов, кеша нет ни на одном уровне.** `useAnalytics` создаёт
   состояние заново на каждый вызов (`src/composables/useAnalytics.ts:7-9`), `load()` стоит в теле
   `<script setup>` (восемь страниц, ссылки в графе «Save-режим»), общего стора нет. Проход по
   восьми вкладкам подшивки (`AnalyticsSubNav.vue:9-18`) — восемь полных ответов. Старый контракт
   обещал «heavy кеш 5 мин per-user» (`03-api-contract.md:717`) — в коде его нет.
6. **`kpis` — обязательное поле, которое две страницы из восьми присылают пустым**, и обе страницы
   про это знают: `staffData.kpis: []` (`mocks/analytics.ts:671`), `plReportData.kpis: []` (`:878`),
   а шаблоны обёрнуты в `v-if="data?.kpis?.length"` (`StaffPage.vue:26`, `PlReportPage.vue:27`) —
   единственные две из восьми, у остальных шести обёртки нет
   (`DashboardPage.vue:82`, `WarehousePage.vue:35`, `SalesPage.vue:35`, `SupplyPage.vue:35`,
   `LogisticsPage.vue:35`, `DeficitPage.vue:35`). То есть «пустой массив вместо отсутствия поля» —
   действующее правило домена, и оно нигде не записано.

## Находки про код → contract-sync-analytics-bugs.md

Девять находок, код не тронут: `roo_code/plans/bugs/contract-sync-analytics-bugs.md`.

| № | что | якорь |
|---|---|---|
| БАГ-01 | ключ `sub.pl-report` не существует — карточка P&L на дашборде печатает сам ключ | `DashboardPage.vue:176` · `i18n/admin/layout.ts:22,80,138` |
| БАГ-02 | единственный вызов домена не шлёт `Authorization` | `analyticsService.ts:5` |
| БАГ-03 | KPI «8 позиций в дефиците» против таблицы из 5 строк на той же странице | `mocks/analytics.ts:892` · `:931-1006` |
| БАГ-04 | `icon` шлётся всегда, читает его одна страница из восьми, и знает 5 имён из 10 | `DashboardPage.vue:15-24,95` · `WarehousePage.vue:48` |
| БАГ-05 | три разных форматирования одних и тех же денег, одно из них — локаль браузера | `DashboardPage.vue:131` · `SalesPage.vue:84` · `StaffPage.vue:124` |
| БАГ-06 | `percentage` — доля от целого в одном поле и произвольный масштаб в двух соседних | `mocks/analytics.ts:81-85,420-449,453-459` |
| БАГ-07 | неизвестное значение `page` даёт 200 с пустым ответом вместо ошибки | `mocks/analytics.ts:1036-1042` · `mocks/index.ts:310` |
| БАГ-08 | число из отчёта («29 сделок») лежит в файле переводов | `i18n/admin/analytics.ts:51,251,451` |
| БАГ-09 | ошибка показывается сырым текстом сервера: без кода, перевода, `data-test` и стиля | `useAnalytics.ts:18` · восемь страниц |
