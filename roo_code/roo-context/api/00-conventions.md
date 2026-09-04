# Общие соглашения API

Всё, что верно для **двух и более** доменов. Доменный файл такое правило не повторяет, а
ссылается сюда; правило, живущее в одном домене, остаётся в его файле.

Источник — семнадцать аудитов в [`plans/api/audit/`](../../plans/api/audit/), сверенных с кодом,
и строки 1–293 прежнего [`03-api-contract.md`](../03-api-contract.md), каждая из которых здесь
либо подтверждена кодом, либо снята с указанием, чем именно она неверна (раздел «Чего в общих
соглашениях больше нет»). Порядок старшинства источников — бэкенд → мок и клиент → замысел —
задан [скилом](../../skills/api-contract.md) и планом
[`contract-sync-plan.md`](../../plans/api/contract-sync-plan.md).

**Наблюдение — да, решение — нет.** Там, где правила нет ни в моке, ни на бэкенде, ни константой
во фронте, ниже стоит ссылка на строку в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md). Такие места
контракт **не** назначает: их решает владелец.

Замеры ниже сделаны 2026-09-04 командами по коду. Эндпоинтов в коде — **175** в 17 доменах,
инвентарь считает [`services/contractInventory.ts`](../../../frontend_vue/src/services/contractInventory.ts),
состояние печатает [`contract-conformance.spec.ts`](../../../frontend_vue/src/services/contract-conformance.spec.ts).

---

## 1. Конверт ответа: три формы, а не одна

Клиент принимает **три** разных тела, и это не запас на будущее — все три встречаются в живом
коде (`unwrap`, [`services/api.ts:108-142`](../../../frontend_vue/src/services/api.ts)):

1. **Обёртка `ApiResponse<T>`** — тело, у которого есть ключ `success` (`services/api.ts:128-139`). При
   `success === false` клиент бросает `ApiRequestError` с `message` и `code`. Тип —
   `types/api.ts:1-6`; серверный двойник — `backend/app/core/schemas.py:29-35`. Так отвечают
   **успехи** всех 31 реализованного роута: `ApiResponse(success=True, data=…)`
   (например `backend/app/modules/auth/features/login/action.py:36-40`,
   `backend/app/core/uploads/action.py:143-146`).
2. **Голое тело** — тело без ключа `success` возвращается как есть: «doesn't have the
   `ApiResponse` envelope, return as-is» (`services/api.ts:140-141`). Это не мёртвая ветка: мок
   отдаёт данные без обёртки повсеместно, и вся мок-разработка идёт по этому пути.
3. **Ошибка FastAPI `detail`** — при `res.ok === false` тело разбирает `parseErrorBody`
   (`services/api.ts:19-84`) и понимает две подформы: `detail` — объект `{ message, code }` (наш
   `AppError`) и `detail` — массив pydantic-ошибок `[{ loc, msg, type }]`, из которого собирается
   `fieldErrors` по последнему сегменту `loc`, а `code` подставляется `VALIDATION_ERROR`.

**Правило для сервера.** Успех — `ApiResponse` (`success`, `data`, опционально `message`, `code`).
Ошибка — HTTP-статус плюс `detail: { message, code }`; обёртки в ошибке **нет** и появиться не
должна: так уже написаны все обработчики (`backend/app/modules/settings/features/crud/action.py:106-116`,
`:492-500`).

Исключение: два эндпоинта объявлены отдающими не-JSON — `GET /api/suppliers/export.csv`
(`services/suppliersService.ts:86-93`) и `GET /api/warehouse/export/:tab`
(`services/warehouseService.ts:323`). Оба зовут `apiGet`, который читает только `res.json()`
(`services/api.ts:110-114`), то есть прочитать `text/csv` клиент **не может** — находки
`contract-sync-suppliers-bugs.md` (БАГ-04) и `contract-sync-warehouse-bugs.md` (№27). Контракт
фиксирует форму на проводе; починка — на стороне фронта.

## 2. Каталог кодов ошибок

Ядро бэкенда объявляет шесть кодов, и они же определяют статус
(`backend/app/core/exceptions.py:13-48`):

| код | класс | статус, которым его отдают |
|---|---|---|
| `NOT_FOUND` | `NotFoundError` (`:13-20`) | 404 |
| `VALIDATION_ERROR` | `ValidationError` (`:23-27`) | 422 (и 413 у слишком большого файла, `core/uploads/action.py:106-114`) |
| `UNAUTHORIZED` | `UnauthorizedError` (`:30-34`) | 401 |
| `FORBIDDEN` | `ForbiddenError` (`:37-41`) | 403 |
| `CONFLICT` | `ConflictError` (`:44-48`) | 409 |

Плюс три кода, которые объявлены **не в ядре, а прямо в эндпоинте** `GET /api/auth/me`:
`MISSING_TOKEN`, `TOKEN_EXPIRED`, `INVALID_TOKEN` (`backend/app/modules/auth/features/me/action.py:44-72`).
Ни одного из трёх мок не знает — путь ошибки под моками не воспроизводится.

Доменные коды (их каталог — в файле своего домена) держатся двух правил, и оба выведены из
кода, а не из вкуса:

- **Ни один код не является подстрокой другого.** Фронт местами сравнивает код подстрокой
  (`services/orderLineEdits.ts:343-354`), поэтому «услуги нет в каталоге» называется
  `CATALOG_SERVICE_NOT_FOUND`, а не `SERVICE_NOT_FOUND` (`mocks/orders.ts:373-376`).
- **Отказ несёт код, а не текст.** Мок повсеместно бросает голый `Error('текст')`, и текст
  доходит до человека вместо перевода: заказы (`useOrders.ts:38`), клиенты (`useClients.ts:68-75`),
  товары (`useProducts.ts:51-52`), категории (`mocks/categories.ts:1419`), уведомления
  (`useNotifications.ts:37`), склад (`useWarehouseOffcutCard.ts:385`). Против настоящего API код
  лежит в `ApiRequestError.code` (`types/api.ts:29`), а не в `message`, — то есть ветки, читающие
  `e.message`, на сервере не сработают. Класс записан в баг-файлах пяти доменов.

## 3. PATCH против PUT

Правило прежнего контракта в силе и подтверждено кодом:

- **`PATCH` — merge одной сущности.** Тело — дельта (`Partial<T>`), собранная клиентом
  (`useDirtyCheck`), сервер сливает поверх текущего состояния и возвращает объект целиком.
  Хелпер так и подписан: «PATCH with RFC 7396 merge-patch body. Send only dirty fields»
  (`services/api.ts:193-194`).
- **`PUT` — замена коллекции целиком.** Тело — весь массив или вся матрица, сервер перезаписывает
  без слияния.

Соотношение измерено, а не угадано: **27 вызовов `apiPatch` против 6 вызовов `apiPut`**
(`grep -rn "apiPatch<\|apiPatch(" src --include=*.ts --include=*.vue | grep -v '\.spec\.' | grep -v 'services/api.ts' | wc -l` → 27, то же для `apiPut` → 6).

Перечня путей здесь нет намеренно: он устареет на следующей странице. Карта «метод путь → файл»
генерируется задачей 38 плана; до тех пор актуальный список берётся машиной:

```bash
cd frontend_vue && npx vitest run src/services/contract-conformance.spec.ts
```

Что важно для сервера: **`PUT` в проекте применяется шире, чем к двум путям прежнего контракта.**
Помимо `/api/config/sections` и `/api/config/permissions` это `/api/config/fields`
(`services/configService.ts:12`), `/api/categories/:id/fields` (`services/categoriesService.ts:65`),
`/api/settings/order-statuses/reorder` (`services/settingsService.ts:128-133`) и
`/api/settings/warehouse-map` (`:152`) — единичный ресурс, где `PUT` заменяет карту целиком, а
версий нет. Все шесть — либо порядок в массиве, либо полная замена набора; ни один не правит одно
поле.

## 4. Мультиарендность — одно правило на все домены

`tenant_id` объявлен в моделях **всех десяти** модулей бэкенда (`grep -c tenant_id
backend/app/modules/<модуль>/shared/models.py`: auth 7, bcc 2, billing 6, finance 3,
notifications 1, products 4, services 1, settings 7, suppliers 10, warehouse 6), везде как
`ForeignKey("tenants.id", ondelete="CASCADE")`, `nullable=False`, `index=True`. Значит **фильтр по
арендатору обязателен в каждом запросе**, и это не свойство домена, а свойство проекта.

Как сервер узнаёт арендатора: **из токена, и только из него.** `tenant_id` в теле или query не
шлёт ни один из 175 вызовов; работающий образец — `_get_tenant_id`, который читает пользователя
токена (`backend/app/core/uploads/action.py:62-76`, тот же приём в
`backend/app/modules/settings/features/crud/action.py:131-139`).

Три вещи, которые из этого следуют и в отдельном домене не видны:

- **Ответ, сшитый из нескольких источников, обязан фильтровать каждый.** Лента аудита собирается
  из девяти логов (`services/auditFeedService.ts`, `mocks/auditFeed.ts:15-31`), сводка CRM читает
  два хранилища (`mocks/orders.ts:1585-1593`), реестр входящих и сводка счетов клиента считаются
  по заказам (`mocks/orders.ts:4055-4124`, `:4710-4752`). Один пропущенный фильтр течёт именно
  туда, где это заметно меньше всего.
- **Фронт про арендатора не знает ничего.** Ни в одном типе, ни в одном сервисе нет ни `tenantId`,
  ни заголовка арендатора — проверено грепом в каждом из семнадцати аудитов. Это правильно и
  должно остаться так.
- **Уникальность считается парой с арендатором, а не глобально.** Так уже сделано:
  `ix_users_tenant_id_email` на `(tenant_id, email)`
  (`backend/alembic/versions/3a0b5d31bde7_phase_1_tenants_auth_users_sessions.py:54`),
  `uq_field_definitions_tenant_name` и `uq_role_permission` на `(tenant_id, …)`
  (`backend/alembic/versions/e24a3922ed01_phase_7_config.py:40`, `:93`). Два известных исключения —
  находки: код ищет пользователя по одному email (`contract-sync-auth-bugs.md`, БАГ-13), а
  `stock_items` уникален по одному `product_id`
  (`backend/app/modules/warehouse/shared/models.py:213-219`, `contract-sync-warehouse-bugs.md`, №28).

## 5. Авторизация и заголовки

**Сессия живёт не в cookie.** Сервер возвращает `session.token` и `session.csrf_token` в **теле**
входа (`backend/app/modules/auth/features/login/action.py:29-31`), клиент кладёт их в
`localStorage` (при «запомнить меня») или в `sessionStorage` (только эта вкладка) и шлёт
`Authorization: Bearer <token>` плюс `X-CSRF-Token: <csrf_token>`
(`composables/useAuth.ts:101-108`, хранилища — `:36`, `:39-45`). `credentials: 'include'` и
HttpOnly-cookie в коде отсутствуют.

Два наблюдения этого уровня, каждое видно только поперёк доменов:

- **«Где лежит токен» реализовано четырьмя разными способами.** Канонический — `useAuth.authHeaders()`
  (читает оба хранилища, шлёт и CSRF); три копии читают только `localStorage` и шлют один
  `Authorization`: `services/settingsService.ts:18-22`, `services/auditFeedService.ts:20-24`,
  `services/uploadsService.ts:14-15`. Следствие измеримо: вошедший **без** «запомнить меня»
  получит 401 на всех 24 роутах настроек, на ленте аудита и на загрузке. Уже записано —
  `contract-sync-settings-bugs.md`, БАГ-06.
- **Заголовков не шлёт почти никто.** Из сервисного слоя какие-либо заголовки ставят шесть файлов
  (`settingsService`, `auditFeedService`, `uploadsService`, `ordersService`, `bccService` и сам
  `api.ts`); остальные — `analyticsService`, `clientsService`, `financeService`,
  `notificationsService`, `productsService`, `suppliersService`, `warehouseService`,
  `categoriesService`, `configService`, `servicesService` — идут без единого заголовка, при том что
  их таблицы объявлены `tenant_id NOT NULL`. Это находка в баг-файле каждого такого домена, а не
  разрешённое поведение.
- **`X-CSRF-Token` сервер не проверяет нигде.** Все попадания `csrf` в `backend/app` — генерация,
  запись в модель и поля схем; чтения заголовка нет ни одного (`contract-sync-auth-bugs.md`, БАГ-10).

## 6. Права — сквозная обязанность, размазанная по трём доменам

В проекте **два независимых механизма прав** и один механизм тарифов; путать их нельзя.

**Механизм 1 — матрица прав карточки поставщика (домен `config`).**
`PermissionAction = 'read' | 'edit' | 'create' | 'delete'` (`types/config.ts:35`),
`PermissionMatrix` с `roles`, `users`, `rolePermissions`, `userPermissions`, `items`
(`:37-57`); элементы матрицы — секции и поля карточки поставщика (`mocks/config.ts:189-203`);
чтение и запись — `GET/PUT /api/config/permissions` (`services/configService.ts:76`, `:81`).
Пять правил каскада матрицы живут только на клиенте и пронумерованы прямо в коде
(`views/admin/suppliers/SupplierCardConfigPage.vue:196-299`).

**Механизм 2 — три права заказа (домен `settings`).** `seeCost`, `manualCost`, `correction`, по
списку ролей на каждое; отдаёт `GET /api/settings/order-permissions` (`mocks/settings.ts:62-66`,
`:433-442`). Применяет их домен orders — три computed во фронте,
`canSeeCost`, `canSetManualCost`, `canCorrect` (`composables/useOrderPermissions.ts:23-32`), и
`requireRight`/`maySeeCost` на «сервере» мока (`mocks/orders.ts:1855-1860`, `:1390-1393`). Модель
описана в [`orders-backend-contract.md`](../../plans/orders/orders-backend-contract.md), §5.
Отдельным эндпоинтом это сделано намеренно: сервер обязан иметь ответ, даже когда экран настроек
не открыт (`mocks/settings.ts:433-442`), а пустой дефолт `{ seeCost: [], manualCost: [],
correction: [] }` плюс флаг `settled` (`composables/useSettings.ts:30`, `:92`) отличают «сервер
сказал нет» от «сервер ещё не отвечал».

**Механизм 3 — фича-флаги. Это тариф, а не право** (см. §7). Правило сформулировано в коде:
«a flag says whether the system has a capability at all, a right says whether this person may use
it» (`composables/useOrderPermissions.ts:6-10`).

Теперь то, ради чего этот раздел и собран, — **ответ на вопрос «где сервер применяет матрицу и
что отвечает при отказе»:**

- **Сервер её не применяет нигде.** Единственная функция, которая должна была это делать, —
  заглушка: `check_permission` возвращает `True` безусловно с комментарием «Placeholder —
  implement actual RBAC logic here. Returns True for now (permissive default)»
  (`backend/app/modules/auth/internal_api/interface.py:27-38`); вызывающих у неё нет.
  `backend/app/modules/auth/shared/dependencies.py` — четыре строки докстринга и ноль кода.
  Модели прав существуют и не читаются ни одним `select()`: `PermissionItem`,
  `RolePermission`, `UserPermission` (`backend/app/modules/auth/shared/models.py:145-236`).
- **Матрицу не применяет и фронт.** Единственный её потребитель — сама страница-редактор
  (`grep -rn "PermissionMatrix\|rolePermissions" frontend_vue/src` даёт четыре файла домена
  `config` плюс `SupplierCardConfigPage.vue`), а настоящая карточка поставщика конфигурацию не
  читает вовсе (`components/admin/SupplierFormSections.vue` рисует пять жёстко зашитых панелей).
- **Форма отказа прежнего контракта — `403 { code: 'FORBIDDEN' }` — неверна по форме и не
  существует по факту.** По форме: ошибка приходит как `detail: { message, code }` (§1). По факту:
  `ForbiddenError` во всём бэкенде поднимается ровно один раз, и не матрицей, а запретом удалять
  системный статус заказа (`backend/app/modules/settings/features/crud/domain.py:529`, отдача —
  `crud/action.py:496-500`). Единственный работающий отказ по праву — в моке заказов, и код у него
  другой: `FORBIDDEN_` плюс имя права заглавными, то есть `FORBIDDEN_MANUALCOST`,
  `FORBIDDEN_CORRECTION` (`mocks/orders.ts:1858`, словарь сообщений — `services/orderLineEdits.ts:343-344`).
- **Право проверяет та же функция, что пишет — но только в одном домене.** `requireRight` зовётся
  из пяти пишущих мест заказа (`mocks/orders.ts:2237`, `:2307`, `:1998`, `:2631`, `:3390`). Во всех
  остальных шестнадцати доменах функции, проверяющей право, нет ни одной — проверено грепом в
  каждом аудите.
- **Сокрытие себестоимости в интерфейсе — занавеска, а не право.** Сервер не имеет права отдавать
  `cost`/`margin` пользователю без `seeCost`; поскольку карточка пересчитывает цены из
  себестоимости, сервер, вырезавший её, обязан прислать посчитанную цену — «hiding the cost in the
  UI is a `curtain`, not a right» (`composables/useOrderPermissions.ts:17-21`). Сегодня `seeCost`
  применяется только к истории заказа (`mocks/orders.ts:1384-1386`), а та же величина открыта
  всем в услугах
  (`views/admin/products/ServicesPage.vue:274`), на складе и в аналитике.
- **Право `seeCost` обходится через ленту аудита.** Признак `sensitive: 'cost' | null` есть только
  у записи заказа (`types/order.ts:591-606`), строка ленты его не несёт (`types/audit.ts:63-74`) и
  `toRows` его не копирует (`mocks/auditFeed.ts:43-60`) — `contract-sync-audit-feed-bugs.md`, БАГ-01.

Кто чем вправе распоряжаться — **решение владельца**: строки «Права — в какой функции
проверяются» стоят в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md) у пятнадцати доменов.

## 7. Фичи и тарифы — обе стороны реализованы и не знают друг о друге

**Бэкенд держит полную модель** (`backend/app/modules/billing/shared/models.py`): `Plan` —
тариф как набор фич (`:11-35`), `TenantPlan` — тариф арендатора (`:37-73`), `PlanFeature` —
`feature_key` плюс разрешено ли, с уникальностью `(plan_id, feature_key)` (`:75-105`),
`TenantFeatureOverride` — переопределение на арендатора, уникальное по `(tenant_id, feature_key)`
(`:108-134`), и `FeatureDefinition` — «Registry of all known feature flag keys — single source of
truth» с полями `key` (unique), `level`, `is_system` (`:137-155`). Ключи сеются миграцией:
список `FEATURE_FLAGS` (`backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py:25`)
уезжает в таблицу одним `bulk_insert` (`:255-274`).

**Фронт держит те же флаги константой**: 52 ключа в `config/featureFlags.ts:4-82` (плюс тип
`types/features.ts` — те же 52), переопределения читаются из `localStorage` по ключу
`ff_overrides` (`featureFlags.ts:84-91`). Проверка одна на проект — `useFeatureFlag('name')`:
`meta.featureFlag` на роуте для страниц, `v-if` для секций.

**Эндпоинта между ними нет ни одного, роутов у модуля `billing` — ноль**
(`grep -rn "@router\." backend/app/modules/billing --include=*.py` — пусто; в инвентаре кода нет
ни одного пути `/api/billing` и ни одного вызова фич).

Словари сверены машинно, и они **не совпадают**: у фронта 52 ключа, миграция сеет **46**, шесть
существуют только во фронте — `orderInvoicesPayments`, `orderReturns`, `orderShipments`,
`settingsAuditLog`, `warehouseCutting`, `warehouseMap`; ключей, которые есть только на сервере,
**нет ни одного**. Проверка:

```bash
awk '/^FEATURE_FLAGS/,/^\]/' backend/alembic/versions/8cf3bfa380dd_phase_12_plans_multi_role.py \
  | grep -oE '^\s+\(\s*"[a-zA-Z]+"' | tr -d ' ("' | sort > /tmp/be_keys.txt      # 46
grep -oE "^  [a-zA-Z]+:" frontend_vue/src/config/featureFlags.ts | tr -d ' :' | sort > /tmp/fe_keys.txt  # 52
comm -23 /tmp/fe_keys.txt /tmp/be_keys.txt   # шесть; обратная разность пуста
```

Что из этого следует и **чего контракт не назначает**: откуда админка берёт матрицу фич и каким
эндпоинтом, что сервер отвечает на запрос к выключенной фиче (404, 403 или пустой ответ), и что
сильнее — тариф или переопределение арендатора. Это
[решение владельца №1](../../plans/api/audit/00-решения-владельца.md); до него раздел любого
домена, описывающий чтение фич, получает `**Статус:** спроектировано`.

Ещё одно наблюдение того же класса: один флаг закрывает две разные вещи — `adminWarehouse` стоит
и на отчёте `analytics/warehouse`, и на семи операционных страницах склада
(`router/index.ts:98`, `:258-318`); и мастер-флаг `adminFinance` объявлен с обеих сторон и не
читается ничем (`contract-sync-finance-bugs.md`, БАГ-07).

## 8. Кастомные поля — определения в двух местах, значения в одном, жизненного цикла нет нигде

**Две библиотеки определений, два разных вокабуляра типов, и они не совпадают:**

| | домен | тип поля | где значения |
|---|---|---|---|
| поля карточки поставщика | `config` — `FieldDefinition` (`types/config.ts:5-14`), CRUD `/api/config/fields` | `FieldType` — шесть: `enum, number, text, date, boolean, tags` (`types/config.ts:3`) | **негде**: у `Supplier` нет `fieldValues`, таблицы `supplier_field_values` не существует |
| поля категории | `categories` — `Category.fields` / `inheritedFields` (`types/category.ts:22-23`), запись `PUT /api/categories/:id/fields` | `CategoryFieldType` — семь: те же плюс `email` и `file` (`types/category.ts:4`) | у товара: `ProductFieldValue` (`types/product.ts:9-16`), сборка `mocks/products.ts:14046-14063` |

Отсюда три сквозных правила:

- **Значение везёт с собой копию определения, и сервер обязан её игнорировать.**
  `ProductFieldValue` несёт `fieldName`, `fieldType`, `options`, `inherited` — четыре поля из шести
  производные; на схеме у значения только `field_id` и `value`
  (`backend/app/modules/products/shared/models.py:203-208`), уникальность — `(product_id, field_id)`
  (`:210-214`).
- **Валидирует значения никто.** Ни `required`, ни тип при записи товара не проверяются
  (`mocks/products.ts:14117-14218` — ни одной проверки); клиент нормализует только
  `Number.isNaN` (`useProductCard.ts:247`), а на схеме значение — свободный `Text`
  (`backend/app/modules/products/shared/models.py:203-208`).
- **Перечень типов поля закрыт во фронте и открыт на схеме.** Колонка `field_type` — `String(50)`
  без `CHECK`, допустимые значения живут комментарием рядом и их пять, а не семь
  (`backend/app/modules/products/shared/models.py:77-79`). Тот же класс у формул пересчёта:
  `CONVERSION_FORMULA_TYPES` — три имени с типом, выведенным из массива (`types/settings.ts:55-67`),
  против `String(30)` без ограничения (`products/shared/models.py:165-177`).

**Жизненного цикла значения нет нигде.** Что происходит со значениями при удалении определения,
кто валидирует тип при записи, что делать при смене типа определения — в `mocks/config.ts` об этом
ни строки, схема же выражает три разные политики на близких связях: `section_fields.field_id` —
`CASCADE` (`suppliers/shared/models.py:311-315`), `category_fields.category_id` — `CASCADE`,
`product_field_values.field_id` — `RESTRICT`
(`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:46`, `:78`), а строку в
`permission_items` не снимает никто — `item_id` там просто `String(100)` без связи
(`auth/shared/models.py:156`), то есть осиротевшие права схема допускает. Это
[решение владельца №2](../../plans/api/audit/00-решения-владельца.md), расширенное случаем
поставщика и случаем файлового поля (значение поля типа `file` хранит **имя** файла, а не `fileId`
— `views/admin/products/ProductCardPage.vue:223-226`, `contract-sync-uploads-bugs.md`, БАГ-10).

## 9. Аудит-лог: девять сущностей, адресация по id

Историю держат **девять** сущностей, и десятой не будет без своей таблицы: `product`, `order`,
`client`, `supplier`, `batch`, `stock`, `offcut`, `movement`, `deficit`. Перечень замкнут и
объявлен прямо — «There is no tenth, and no feed of its own» (`types/audit.ts:4-14`, тот же список
константой `:16-26`, маршруты карточек `:35-45`).

**Запись адресуется своим `id`, а не позицией**, и удаление идёт в эндпоинт своей сущности:
`DELETE` на путь `<сущность>/:id/audit/:entryId` — девять функций клиента
(`productsService.ts:125`, `clientsService.ts:45`, `suppliersService.ts:83`, `ordersService.ts:195`
и пять складских `apiDelete` — `warehouseService.ts:333-373`). Своего `DELETE` у ленты нет
намеренно: второй путь к той же записи — второе правило о том, кто её вправе убрать
(`services/auditFeedService.ts:49-77`). Строка ленты ключуется тройкой `entityType + entityId +
entryId` одной функцией `auditRowKey` (`types/audit.ts:86-92`).

Почему не индекс: устаревшая позиция удаляет не ту запись, и молча; в сводной ленте это обычный
сценарий. Доказано `mocks/audit-entry-identity.spec.ts` — позиционная адресация оставляет
`[2, 3]` там, где должно остаться `[2, 4]`.

**Неизвестный `entryId` — отказ, а не тихий no-op**: `AUDIT_ENTRY_NOT_FOUND` бросают пять
складских удалений (`services/mocks/warehouse.ts:1868`, `:1885`, `:1898`, `:1912`, `:1928`), поставщик
(`mocks/suppliers.ts:460`) и клиент (`mocks/clients.ts:1142`); у заказа код свой —
`ORDER_AUDIT_ENTRY_NOT_FOUND` (`services/orderLineEdits.ts:354`). Молчание неотличимо от успеха, и
клиент сотрёт у себя строку, которая на сервере осталась.

Три наблюдения, каждое видно только поперёк доменов:

- **Свой журнал пишет ровно один домен из девяти.** Заказы — через единственный `appendHistory`
  (`mocks/orders.ts:1874-1893`), шесть вызывающих. У остальных лог **засеян и не пополняется**:
  товары (`mocks/products.ts` — ни одного `push`), клиенты, поставщики, и все пять складских
  журналов (`mocks/warehouse.ts` — ни одного `push`). То есть удалить запись можно, а появиться ей
  неоткуда.
- **Автор записи — отображаемое имя, а не ссылка на пользователя.** Форма записи —
  `{id, timestamp, user: TranslatedString, userInitials, property: TranslatedString, oldValue,
  newValue}` (`types/warehouse.ts:526-534`), в посеве встречается буквально
  `{ru:'Система',en:'System',lt:'Sistema'}` (`mocks/clients.ts:50`). На схеме предусмотрена пара:
  `user_id` с `ondelete="SET NULL"` плюс замороженные переводы имени и инициалы
  (`backend/app/modules/warehouse/shared/models.py:246-252`,
  `backend/app/modules/suppliers/shared/models.py:170-201`).
- **Таблиц журнала на схеме две, а журналов девять.** Есть `stock_audit_entries`, привязанная к
  партии `nullable=False` (`warehouse/shared/models.py:229-258`), и журнал поставщика
  `SupplierAuditEntry` (`suppliers/shared/models.py:170-201`). Под остальные семь таблиц нет.
  Признака `sensitive` нет ни у одной.

Что именно сервер обязан писать, кто автор и есть ли след у удаления записи — строки владельцу у
восьми доменов.

## 10. Уведомления: событие — это переход

Записи ленты рождаются **не эндпоинтом уведомлений** (`POST` в домене нет), а **семью**
эмиттерами, которые зовут чужие домены:
`notifyOrderStatusChanged`, `notifyWarehouseReady`, `notifyPaymentReceived`, `notifyBatchReceived`,
`notifyStockDeficit`, `notifySupplierResponse`, `notifyPaymentOverdue`
(`mocks/notifications.ts:542`, `:566`, `:592`, `:616`, `:637`, `:657`, `:684`; счёт —
`grep -c "^export function notify"` → 7). Все семеро проходят через один `emit` (`:514-522`),
который и присваивает `id`, `isRead: false` и `createdAt`.

Вызывающие — четыре домена, и **каждый вызов защищён условием перехода**:
`orders` (`mocks/orders.ts:1837` при `oldStatus !== status`, `:3929` при `!wasReady && fullyReserved`,
`:4001` при `payment.amount > 0` — возврат денег не «поступление оплаты»),
`warehouse` (`services/mocks/warehouse.ts:789` создание партии, `:1710` только **вновь открытая** нехватка),
`finance` (`mocks/finance.ts:70` первое обнаружение просрочки, `:486` при `!wasOverdue && …`),
`bcc` (`mocks/bcc.ts:368`).

**Правило «событие пишет ровно одну запись, повтор не пишет ничего» доказано спекой**
[`mocks/notification-triggers.spec.ts`](../../../frontend_vue/src/services/mocks/notification-triggers.spec.ts):
отдельные проверки у статуса (`:111-119`), дефицита (`:181-200`), готовности склада (`:232-234`) и
просрочки (`:257-266`). Единственное нарушение — `mockAcceptResponse` зовёт эмиттер безусловно,
поэтому правка уже принятого ответа рождает второе уведомление (`contract-sync-bcc-bugs.md`, БАГ-10).

Сопутствующие правила, общие для всех вызывающих:

- **Тексты — снимок на момент события, а не ссылка на словарь** (`mocks/notifications.ts:532-538`);
  на схеме им соответствуют `title_translations`/`message_translations` типа `JSONB`
  (`backend/app/modules/notifications/shared/models.py:29-30`).
- **Сумма пишется в валюте, в которой пришла, и не конвертируется** — курсов в системе нет нигде
  (`mocks/notifications.ts:588-596`).
- **Уведомление адресное**: `user_id` объявлен `nullable=False` с индексом (`backend/app/modules/notifications/shared/models.py:22-27`), то
  есть запись принадлежит пользователю, а не арендатору; мок этого не знает — лента у него одна на
  всех.
- **Сборка сида событий не рождает** — `seedQuietly` плюс флаг `seeding`, который `emit` проверяет
  первой строкой (`mocks/notifications.ts:504-515`, зовётся из `mocks/orders.ts:4578`, `:4676`).
- **Канал доставки один — лента в интерфейсе.** С почтовыми настройками уведомления не связаны
  ничем, поля «отправлено письмом» в модели нет. Модуль `notifications` роутов не имеет.

Чем сервер отличит новое событие от повтора **после перезапуска** — не сказано нигде: память
просрочки живёт в процессе (`mocks/finance.ts:63`), колонки под неё на схеме нет. Строка владельцу.

## 11. Идемпотентность и оптимистичная блокировка

**`Idempotency-Key` шлют пять вызовов из 175**, и все пять — необратимые `POST`:
`POST /api/bcc/send` и `POST /api/bcc/log` (`services/bccService.ts:43`, `:64`), отгрузка, платёж и
возврат заказа (`services/ordersService.ts:295`, `:352`, `:386`). Генератор один —
`newIdempotencyKey()` (`services/api.ts:239-245`): `crypto.randomUUID()` с запасной ветвью для
мок-сценариев. «Сервер» мока ключ чтит и возвращает закэшированный ответ — `withIdempotency`
(`mocks/index.ts:259-269`).

Правило: **необратимый `POST` требует `Idempotency-Key`; остальные `POST` — нет**, потому что
клиент формирует локальный state и повторяет по кнопке. Известные нарушения записаны как находки:
отмена отгрузки ключа не шлёт, хотя двигает склад и выпускает документы
(`contract-sync-orders-bugs.md`, БАГ-09), и `POST /api/bcc/events/:id/response` /
`.../no-response` создают строки без ключа (`contract-sync-bcc-bugs.md`, БАГ-03).

Два свойства кэша ключей, которые сервер обязан задать иначе: он живёт в `Map` на процесс —
**без срока и без привязки к пути** (`mocks/index.ts:260`), то есть один ключ, посланный на
отгрузку и на платёж, вернул бы первый ответ на оба. Прежний контракт обещал кэш 24 ч; области
действия ключа не задавал ни он, ни §3
[контракта заказов](../../plans/orders/orders-backend-contract.md).

**Версия спрашивается только в одном домене.** `If-Match` ставит `ifMatch()` в
`services/ordersService.ts:41-43` и шлют шесть удалений заказа (`:113`, `:165`, `:187`, `:195`,
`:211`, `:395`); мок читает его в `ifMatchVersion` (`mocks/index.ts:1416-1428`) и **пропускает
проверку, когда заголовка нет** — тот, кто заказа не читал, версии заявить не может (`:1416-1421`).
Отсюда правило: удаление записи истории из общей ленты от проверки версии освобождено
(`services/auditFeedService.ts:62` зовёт ту же функцию без третьего аргумента). Во всех остальных
шестнадцати доменах версии нет ни во фронте, ни на схеме — поведение last-write-wins, и в прежнем
контракте оно названо прямо.

## 12. TranslatedString

Переводимое поле — объект с **тремя обязательными** ключами; локали ровно три, и список закрыт
типом:

```ts
interface TranslatedString { ru: string; en: string; lt: string }   // types/i18n.ts:6-10
```

Клиент всегда шлёт все три; неактивные локали — пустая строка. Сервер обязан хранить и возвращать
все три без изменений. Помощников три, и выбор между ними — правило, а не вкус
(`types/i18n.ts:19-61`):

- `toTranslatedString(value, locale)` (`:19-25`) — для **создания**: две другие локали обнуляются;
- `mergeTranslatedString(existing, incoming)` (`:36-50`) — для **PATCH**: перезаписывает только
  определённые ключи;
- `mergeLocaleValue(existing, value, locale)` (`:53-61`) — для **правки в UI**: сохраняет остальные
  локали.

Употребление `toTranslatedString` на пути правки стирает переводы двух других языков — это уже
находка в двух доменах (`contract-sync-categories-bugs.md` №8, `contract-sync-config-bugs.md` №15)
и отдельный баг-файл `fix-toTranslatedString-merge-bug.md`.

**Слияние на сервере — по `id`, а не по позиции.** Мок категорий сливает переводы имени поля по
индексу в массиве (`mocks/categories.ts:1495-1509`); сегодня это не проявляется, потому что клиент
всегда шлёт все три ключа, но для сервера правило «по позиции» было бы неверным — строка владельцу.

**Схема расходится с типом систематически, и это самое крупное расхождение проекта.** Переводимое
имя во фронте против одной строки на схеме: `categories.name` и `category_fields.name` —
`String(255)` (`backend/app/modules/products/shared/models.py:25`, `:76`), `field_definitions.name`
— тоже (`suppliers/shared/models.py:251`), `bcc_events.source` — `String(50)`
(`bcc/shared/models.py:71-73`), контакт поставщика `position` — `String(255)`
(`suppliers/shared/models.py:130`). Хранить `{ru,en,lt}` в `String(255)` нечем. Наоборот,
переводимость **есть** у `section_configs.name_translations`, `permission_items.name_translations`,
`notifications.title_translations`, `stock_audit_entries` — то есть внутри одной миграции
асимметрия. Разрешение — задача бэкенда, и она затрагивает почти каждый домен.

## 13. Пагинация и списки

```ts
interface PaginatedResponse<T> { items: T[]; total: number; page: number; pageSize: number; totalPages: number }
interface PaginationParams { page: number; pageSize: number }     // types/api.ts:8-19
```

Параметры всегда в query: `?page=1&pageSize=25`; клиент кладёт их строками
(`String(page)`, `String(pageSize)`). `total` — длина **отфильтрованного**, а не всего;
`totalPages` — `Math.max(1, Math.ceil(total / pageSize))`, считается при чтении и никогда не
хранится (одинаково во всех доменах, например `mocks/bcc.ts:265`, `services/mocks/services.ts:75`,
`mocks/finance.ts:43-50`, `mocks/notifications.ts:428`).

Четыре правила, каждое подтверждено больше чем одним доменом:

- **Размер страницы по умолчанию — 25, и он продублирован десятками копий.** Дефолт общего
  композабла (`composables/usePagination.ts:3`) плюс явные `usePagination(25)` и дефолты веток
  мока: шесть экземпляров в складе, шесть в финансах, по два-три у остальных. Перечень доступных
  размеров — константа компонента, и он **разный**: `10/25/50/100` у заказов, склада и
  уведомлений, `25/50/100` у финансов и товаров, `10/25/50` у товаров BCC. Справочника под него нет
  ни в настройках, ни на схеме — строка владельцу у пяти доменов.
- **Сортировка принадлежит серверу, а не странице.** «Пять самых новых» — это `sortBy: 'createdAt'`
  в запросе, а не выбор из полученной страницы: выбирать из страницы значит выбирать из того, что
  на неё попало (`types/client.ts:54-56`, потребитель `composables/useSalesCrmDashboard.ts:38-51`).
  По той же причине счёт по странице — не счёт, и для сводки CRM заведён отдельный эндпоинт
  (`types/order.ts:44-47`, `services/ordersService.ts:50-51`).
- **Поведение без `sortBy` разное у соседей, и это два разных API.** Заказы сортируют по
  `createdAt DESC` умолчанием (`mocks/orders.ts:1548-1549`), товары отдают порядок хранилища
  (`mocks/products.ts:13965-13974`), список платежей и архив не сортируются вовсе
  (`contract-sync-finance-bugs.md`, БАГ-05). Контракт обязан назвать умолчание по каждому списку.
- **Пустая строка фильтра доезжает до сервера буквально.** `apiGet` кладёт каждый параметр в
  `url.searchParams` без проверки на пустоту (`services/api.ts:153-156`), поэтому «все» — это
  `entityType=`, а не отсутствие параметра; сервер обязан читать пустую строку как «без фильтра»
  (`mocks/index.ts:396-401`). Обратная сторона
  — известная находка: `null` уезжает в query литералом `"null"`
  (`contract-sync-orders-bugs.md` БАГ-04, `contract-sync-clients-bugs.md` БАГ-04).

Отдельно: **сервер вправе зажать страницу в границы**, и клиент принятое значение читает
(`mocks/auditFeed.ts:95-99`, `useAuditFeed.ts:68`) — но `pageSize` и `totalPages` из ответа не
читает никто, страница считает их сама (`contract-sync-audit-feed-bugs.md`, БАГ-06).

## 14. Даты, деньги, единицы, валюта

- **Даты и время — ISO 8601** (`2026-04-17`, `2026-04-17T14:32:05Z`). Точность на проводе
  различается по домену и это значимо: клиент несёт день без времени (`YYYY-MM-DD`), заказ — полный
  инстант, и для схемы это `date` против `timestamptz` (`contract-sync-sales-crm-bugs.md`, БАГ-04).
  Записи истории живут в двух форматах (`2026-04-23 13:17` и полный ISO), поэтому парсер один на
  проект — `mocks/auditClock.ts:23-36`: строковая сортировка перемешала бы их неверно.
- **`createdAt`/`updatedAt` ставит сервер и только он** — `server_default=func.now()` и
  `onupdate=func.now()` (`backend/app/core/base.py:25-37`).
- **Деньги — `number`, точность до двух знаков**, minor units не используются. Округление —
  `round2` в домене, а не в шаблоне.
- **Длительность — в днях** (`leadTime`, `paymentTermsDays`). Ноль законен и означает «оплата по
  счёту, без отсрочки», поэтому поле обязательное: «не заполнено» иначе неотличимо от «платит
  сразу» (`domain/paymentTerms.ts:12-20`).
- **Цена, которой никто не назвал, — это `null`, а не ноль** (`types/warehouse.ts:91-101`);
  средние взвешиваются только по оценённым записям.
- **Конвертации валют в проекте нет нигде, и это решение, а не пробел.** Валюты сосуществуют, курса
  нет: сумма пишется в валюте, в которой пришла (`mocks/notifications.ts:588-590`), итоги по
  клиенту — отдельной строкой на каждую валюту (`types/client.ts:90-96`), складской слой говорит на
  одной базовой валюте и отвергает чужую кодом `BATCH_CURRENCY_NOT_BASE`
  (`services/mocks/warehouse.ts:65-76`, `:724-726`). Колонка `exchange_rate` на схеме валюты и партии
  существует и во фронте не читается ничем — строка владельцу.
- **Валютой, единицами, правилами пересчёта, статусами заказа и четырьмя финансовыми константами
  владеет домен `settings`** (`vat_rate=21`, `default_margin=15`, `default_currency='EUR'`,
  `default_discount_percent=0` — `backend/app/modules/settings/shared/models.py:44-55`, автосоздание
  `settings/features/crud/domain.py:129-131`). Сквозная беда: **эти значения продублированы
  константами во фронте почти в каждом домене** — заказ пишет литералами скидку, НДС и валюту
  (`mocks/orders.ts:1634-1638`), партия — `'EUR'` (`useWarehouseBatch.ts:120`), услуга —
  `'cur-eur'`/`'uom-pcs'` (`ServicesPage.vue:59-60`), поставщик — список `EUR/USD/PLN/GBP`
  (`components/admin/SupplierFormSections.vue:58-63`), BCC — четыре единицы
  (`BccRequestPage.vue:333`), CRM — знак `€` в форматтере (`SalesCrmPage.vue:43-45`), аналитика —
  литерал `'EUR'` пятнадцатью переводами. Каждый случай — находка в баг-файле своего домена; общее
  правило: **справочник принадлежит серверу, во фронте его копии быть не должно.**
- **Валюта по умолчанию выражена двумя способами** — флагом `Currency.isDefault`
  (`types/settings.ts:26`) и кодом в `constants.defaultCurrency` (`:17`); `orderLines.ts:160`
  читает сначала первое, потом второе. Какой источник главный — строка владельцу.
- **Часового пояса арендатора нет нигде** (`grep -rin "timezone" frontend_vue/src/types/settings.ts`
  — пусто; на бэкенде единственные попадания — свойство типа колонки). Граница дня и месяца при
  этом режется: фильтр ленты по UTC-дате, таблица печатает местное время, сводка CRM режет месяц
  местной полуночью. Строка владельцу у трёх доменов.

## 15. Save UX: clean-slate против quick-action

Модель — **clean-slate**: сервер знает только сохранённое состояние, всё остальное живёт в
локальном Vue-state. Правила прежнего контракта подтверждены кодом и остаются в силе: local-first
state, Save собирает дельту через `useDirtyCheck`, reload = сброс без восстановления черновиков,
никакого autosave и никаких промежуточных запросов.

**Дельта считается по верхнему уровню.** `useDirtyCheck.diff()` сравнивает `JSON.stringify`
каждого ключа первого уровня и отдаёт ключ целиком, если изменился любой лист
(`composables/useDirtyCheck.ts:51-77`). Следствие для сервера: у вложенных массивов —
**replace-семантика**, а не дельта по элементам, и удаление элемента выражается его отсутствием в
присланном массиве. Так же ведут себя `fileIds` (`mocks/finance.ts:491-519`).

**Quick-action — действие, применяемое немедленно**, вне редактируемой формы: смена статуса
поставщика перетаскиванием, ответ и «не ответил» в BCC, отправка и логирование BCC, удаление записи
аудита, загрузка файла в `DropZone`. У каждого раздела доменного файла стоит строка про его
save-режим.

Теперь то, что видно только поперёк доменов: **«Single Save = single PATCH» верно ровно в трёх
доменах из десяти.**

| домен | что уходит по одной кнопке Save | где |
|---|---|---|
| products | один PATCH на форму, значения полей и поставщиков | `useProductCard.ts:233-256` |
| suppliers | один PATCH | `useSupplierCard.ts:40` |
| services | один PATCH | `useServiceCard.ts:70-74` |
| categories | **два** параллельных запроса | `useCategoryCard.ts:102-112` |
| config | **три** параллельных PUT | `useCardConfig.ts:51-55` |
| finance | PATCH плюс независимый аплоад до Save | `OutgoingPaymentCardPage.vue:72-87` |
| warehouse | PATCH плюс до двух движений, провал заглушён | `useWarehouseBatch.ts:255-276`, `useWarehouseOffcutCard.ts:288-323` |
| clients | **1 + N + M** последовательных запросов | `useClientCard.ts:273-304` |
| settings | **до десятка** параллельных запросов | `useSettings.ts:518` |
| orders | **1 + N + M + K + L** последовательных запросов | `useOrderCard.ts:418-533` |

Общего правила поведения при частичном отказе нет ни у одного из семи многозапросных: снимок не
сдвигается, `load()` после ошибки не вызывается, и экран остаётся с несохранёнными данными поверх
частично сохранённых (`useSettings.ts:518-521`, `useCardConfig.ts:56-58`,
`useCategoryCard.ts:113-117`, `useClientCard.ts:314-316`). Единственное место, где правило на этот
счёт записано: очередь опустошается по мере отправки, и при падении на середине **остаток остаётся
в очереди** — повтор не должен добавить ту же строку второй раз, а перезагрузка, которая показала
бы дубль, случается только при успехе (`useOrderCard.ts:430-434`).
Что обязано быть атомарным — строка владельцу у **девяти** доменов;
это самая частая строка во всём файле решений.

И обратная крайность, тоже общая: **`catch { load() }` разрушает несохранённое.** Так сделано в
карточке исходящего платежа (`OutgoingPaymentCardPage.vue:83-85`), и у карточки заказа это
поведение уже было признано разрушительным.

## 16. Файлы

Один эндпоинт на все домены — `POST /api/uploads`; `multipart/form-data`, поле `file`
(`services/api.ts:224-236`). Реализация есть: `backend/app/core/uploads/action.py:78-146`.

- **Загрузка и привязка — две независимые фазы.** Файл уходит на сервер по drop
  (`components/.../DropZone.vue`), а `fileId` копится в локальном массиве и уезжает по Save в
  составе `fileIds[]`. Отмена формы загрузку не отменяет: файл на сервере остаётся.
- **Удаление файла из карточки — удаление ссылки, а не файла.** Все `removeFile` работают с
  массивом в памяти, ни один не зовёт сервер; отдельного `DELETE` для файла нет. На стороне БД
  удаление запрещено, пока на файл ссылается документ — `ondelete="RESTRICT"` в трёх местах
  (`a8dd7d7ba74b:88`, `b2619dfeb90f:53`, `:67`).
- **Ограничения владеет сервер, и фронт их не знает.** `max_upload_size_mb = 20`,
  белый список из пяти MIME (pdf, docx, xlsx, png, jpeg), `draft_ttl_hours = 24` —
  `backend/app/core/config.py:35-43`. Наружу не отдаётся ни одно: эндпоинта настроек аплоада нет.
  Во фронте лимита размера нет ни в одном месте, а `accept` стоит у двух дропзон из двенадцати и
  обе шире серверного списка. Правило, которое стоит помнить: `accept` фильтрует диалог выбора и
  ничего не значит для перетаскивания (`useWarehouseMap.ts:37-43`) — проверять тип обязан сервер.
- **`url` — производное, а не колонка.** Сервер собирает его на каждый ответ из базы текущего
  запроса — `base_url` плюс путь файла (`core/uploads/action.py:141-142`); в таблице лежит только
  `storage_path`. При этом ровно это производное три чужие таблицы сохраняют как данные
  (`payment_documents.url`,
  `document_archive_items.url` плюс `size` и `mime`), и фронт делает то же. Что здесь источник
  истины — строка владельцу.
- **Черновиков фактически нет:** модель и миграция говорят `is_draft=True`, эндпоинт передаёт
  `False` (`core/uploads/action.py:136`), `expires_at` пуст, уборщика нет. То есть TTL 24 ч из
  прежнего контракта не реализован ничем.

## 17. Производные значения: сервер считает, а не хранит

Правило общее: величина, выводимая из других данных, считается при чтении и не хранится — иначе
хранимая устаревает молча. Три класса, встречающиеся во всех доменах:

- **Всегда производные:** `total`, `page`, `totalPages`, `itemCount`, любые суммы и средние. Самая
  большая доля — у склада: одиннадцать значений, включая `quantityRemaining` и `status` партии,
  выводимые **из журнала движений целиком**, — и это объявлено инвариантом с прямым указанием, что
  «бэкенд сделает ровно этот пересчёт при старте с сохранённого журнала»
  (`services/mocks/warehouse.ts:389-416`).
- **Осознанные снимки — не денормализация, а заморозка.** Реквизиты клиента, попавшие в заказ
  (`clientName`, `clientVatCode`, `clientAddress`, `clientPaymentTermsDays` — `mocks/orders.ts:1623-1628`),
  имя и себестоимость услуги в строке заказа (`:2415-2422`), тексты уведомлений, имя автора в записи
  аудита. Документ обязан говорить то, что говорил в день выписки; сервер обязан знать, что это
  решение, а не оптимизация.
- **Расхождения «фронт считает — схема хранит», которые придётся разрешить.** `level`, `field_count`
  и `product_count` категории (`products/shared/models.py:33-41`), `usage_count` определения поля
  (`suppliers/shared/models.py:259-261`), `document_count` платежа (`finance/shared/models.py:49-51`),
  `has_deficit` и `last_bcc_date` поставщика (`suppliers/shared/models.py:58-61`),
  `quantity_remaining`/`status`/`total_cost` партии. В каждом случае одно и то же число у фронта
  производное, а у сервера — состояние, которое можно рассинхронизировать. Строки владельцу.

Отдельный сквозной случай: **`entityRouteName` уведомления** — поле обязательное в типе
(`types/notifications.ts:22`), колонки под него на схеме нет, и значение однозначно выводится из
`entityType` (пять типов → пять имён роутов). Тот же приём выбора маршрута лента аудита переиспользует
намеренно, а не заводит второе правило (`types/audit.ts:28-45`).

## 18. Чем мок отличается от обязанностей сервера

Мок называет себя reference implementation, и по большинству доменов он — единственный источник
истины. Но он **не эталон** в четырёх повторяющихся местах, и это часть контракта:

- **Мок слабее сервера.** Отправка BCC: сервер снимает дубли адресов и отвергает пустой список
  ошибкой `NoRecipientsError` (`backend/app/modules/bcc/features/send_request/domain.py:95-99`);
  её код — `NO_RECIPIENTS` (`backend/app/modules/bcc/features/send_request/domain.py:34-38`). Мок
  не делает ни того, ни другого. Magic-link: сервер отвергает просроченный токен, мок принимает
  любой непустой. Загрузка: сервер проверяет MIME и размер, мок — нет. Значит **пути ошибки под моками не
  воспроизводятся вовсе**, и демо не доказывает их существования.
- **Мок строже будущего сервера.** Услуги: `assertKnownPricing` проверяет `currencyId`/`uomId` по
  справочнику (`services/mocks/services.ts:86-93`), а на схеме этих колонок нет вовсе — внешнего ключа,
  который держал бы то же правило, на сервере не существует.
- **Мок отдаёт ссылки, а не копии.** Где отдаётся копия — это записано причиной: карточка платежа
  удаляет документ до Save, и на прямой ссылке удаление доехало бы до «сервера» само, поэтому
  `mockGetPayment` отдаёт `clone` (`mocks/finance.ts:421-429`); лента аудита копирует `user` и
  `property` объектами (`mocks/auditFeed.ts:53-59`). Где отдаётся ссылка — это находка:
  `mockGetProduct` возвращает запись стора (`mocks/products.ts:13985-13989`), и карточка правит
  стор напрямую. Для сервера разницы нет — правило записано, чтобы её не перенесли в контракт.
- **Порядок веток разбора мока — часть контракта.** Вложенный путь обязан разбираться раньше
  голого `:id`: восемь путей заказа перед `/api/orders/:id` (`mocks/index.ts:563-611`),
  `/api/products/list` перед `/api/products/:id` (`:440` перед `:449`), `/stock/:id/cost` перед
  `/stock/:id`, `/offcuts/offers` перед `/offcuts/:id`, `/movements/:id/audit` перед
  `/movements/:id` (`:637`, `:726`, `:745`). **У сервера с одним маршрутом `/{id}` порядок
  обратный по построению**, и это уже даёт живой дефект: `GET /api/products/list` против настоящего
  бэкенда попадёт в `GET /api/products/{product_id}` и вернёт 422 о UUID
  (`contract-sync-products-bugs.md`, №8).

И один класс, общий для всех семнадцати: **демо-данные держатся тех же правил, что приложение.**
Сценарии создаются настоящими функциями мока, а не объектами, положенными в стор; сборка сида
глушит уведомления; демо-часы двигают историю, чтобы «этот месяц» не стал вечным нулём
(`mocks/demoClock.ts:4-17`). Сдвиг часов — свойство мока, серверу его делать не нужно; правило
записано, чтобы его не перенесли в контракт по ошибке.

## 19. Форма идентификатора

Правило: **`id` на проводе — непрозрачная строка.** Клиент не имеет права выводить её из позиции,
длины хранилища или времени, а сервер обязан её выдавать.

Наблюдения, из которых правило собрано (встречается в семи аудитах):

- **Схема повсеместно использует UUID** (`UUIDMixin`), мок — читаемые префиксы: `prod-001`,
  `cat-1`, `whb-001`, `evt-001`, `pay-out-1`, `notif-001`, `au-2`, `bch-au-2`. Это расхождение
  фронта со схемой у каждого домена с реализованным бэкендом, и у `products` оно уже ломает
  карточку.
- **Идентификатор, выведенный из длины массива, столкнётся с существующим после удаления**:
  товары (`mocks/products.ts:14077`), обрезки и счётчики склада (`services/mocks/warehouse.ts:240-243`).
  Заказы от этого защищены отдельным счётчиком, и причина записана: из id собираются номера
  накладных и счетов (`mocks/orders.ts:1355-1357`, `:1615-1617`).
- **`Date.now()` в качестве id даёт коллизию у двух объектов одной миллисекунды**
  (`SupplierCardConfigPage.vue:316`, `:410`, `:458`; `mocks/config.ts:274`, `:312`). Временный id
  клиента — это `tmp-<…>`, и постоянный обязан выдать сервер (`mocks/categories.ts:1507`).
- **Два пространства id в одном домене — известный класс дефекта**: поставщик (`sup-001` против
  `'1'…'6'`), обрезок (`who-NNN` против `offcut-NNN`), документ платежа (`pdoc-N` против `fileId`).
- **`entityId` — идентификатор, а не номер документа**, хотя у заказа они похожи: `id` = `ORD-1`,
  `orderNumber` = `ORD-2026-1` (`mocks/orders.ts:577-578`), и переход строится по первому.
- **`entryId` уникален внутри своего лога**, глобальной уникальности не требуется (§9).

## 20. Что остаётся в доменном файле

Здесь — только правила двух и более доменов. В файле домена остаются:

- раздел на каждый эндпоинт формата `### <МЕТОД> <путь>` со строкой `Реализация:`, а у домена с
  модулем бэкенда — ещё и строкой `Бэкенд:`;
- каталог кодов ошибок домена;
- раздел «Обязанности сервера» — девять граф из аудита со ссылками на код;
- правила, живущие в одном домене: арифметика резки, FIFO по доступному, статусы заказа, склейка
  `priceHistory`, наследование полей категории, «одна сумма — один владелец» в финансах и т. п.;
- «Чего в домене нет» — строка на каждое удалённое из прежнего контракта описание;
- «Клиент написан, UI нет» — реестр эндпоинтов без вызывающего экрана.

Примеры в этом файле намеренно **не** оформлены заголовком уровня `###` с методом и путём: спека
инвентаря читает такие заголовки как описание эндпоинта и отнесёт его к чужому домену
(`contract-conformance.spec.ts`, утверждение 3).

## 21. Чего в общих соглашениях больше нет

Ничего не вычеркнуто молча — каждое снятое утверждение прежнего `03-api-contract.md` (строки
1–293) названо здесь вместе с тем, чем оно опровергнуто.

| было в прежнем тексте | чем опровергнуто |
|---|---|
| «Любой ответ, успех и ошибка, обёрнут `ApiResponse`» | ошибка приходит как `detail` FastAPI, а мок отдаёт голое тело; `unwrap` принимает все три формы (§1) |
| «Клиент бросает `Error(message)`» | клиент бросает `ApiRequestError` со `status`, `code` и `fieldErrors` (`types/api.ts:25-47`) |
| код `UNAUTHENTICATED` для 401 | в коде такого кода нет; 401 приходит с `UNAUTHORIZED` (`core/exceptions.py:30-34`) плюс три кода `/me` |
| коды `RATE_LIMITED`, `SERVER_ERROR` | не встречаются ни во фронте, ни на бэкенде (`grep -rl` по обоим деревьям — пусто) |
| «`PUT` оставлен только на `/api/config/sections` и `/api/config/permissions`» | `PUT` в коде шесть вызовов, включая `/api/config/fields`, `/api/categories/:id/fields`, `/api/settings/order-statuses/reorder`, `/api/settings/warehouse-map` (§3) |
| перечисление путей PATCH и PUT | заменено правилом плюс машинным инвентарём: перечень устаревал на каждой новой странице (§3) |
| «Бэкенд выдаёт HttpOnly Secure cookie `session`, fetch ходит с `credentials: 'include'`» | токен приходит в теле, лежит в `localStorage`/`sessionStorage` и шлётся `Authorization: Bearer`; `credentials` в `api.ts` нет (§5) |
| «клиент читает cookie `csrf_token`» | CSRF-токен приходит в теле входа, а в заголовок его кладёт `getStoredCsrf` (`useAuth.ts:101-108`); сервер его не проверяет нигде |
| «Все `/api/admin/**` требуют валидной сессии» | пространства `/api/admin` не существует: все 175 путей начинаются с `/api/<домен>` |
| «бэкенд должен проверять `PermissionMatrix`… отказ — `403 { code: 'FORBIDDEN' }`» | проверка — заглушка `return True`; матрица не применяется ни на сервере, ни во фронте; единственный работающий отказ по праву несёт код `FORBIDDEN_<ПРАВО>` (§6) |
| «Virus-scan синхронный, 422 `INFECTED`» | ни `virus`, ни `scan`, ни `INFECTED` в коде нет |
| «Max 20 MB, whitelist (pdf, docx, xlsx, png, jpg), 413 при превышении» | верно, и это единственное место, где прежний текст совпал с кодом дословно (`core/config.py:35-42`, `core/uploads/action.py:96-114`) |
| «Draft-файлы удаляются по TTL 24 ч» | `draft_ttl_hours = 24` в конфиге есть, но эндпоинт пишет `is_draft=False`, `expires_at` пуст, уборщика нет (§16) |
| «Отдельного DELETE-эндпоинта для файла нет» | верно и подтверждено: удаление — это отсутствие `fileId` в присланном массиве (§16) |
| список из ~15 фича-флагов | флагов 52 во фронте и 46 в реестре бэкенда; список заменён правилом и машинной сверкой (§7) |
| «Сейчас — фиксированный порядок `updatedAt DESC`» (раздел «Возможные расширения») | сортировка есть у большинства списков и ведёт себя по-разному без параметра (§13) |
| «Optimistic locking… сейчас last-write-wins» | верно для шестнадцати доменов; у заказов `If-Match` реализован (§11) |
| «heavy кеш 5 мин per-user» для аналитики | кеша нет ни на одном уровне: восемь страниц — восемь запросов |
| «`POST /api/support/contact` и `GET /api/public/stats` удалены» | остаётся в силе: публичные страницы статичны, поддержка использует `mailto:` |

---

## Строки, оставленные владельцу

Сквозные обязанности, у которых ответа нет **нигде** в коде, собраны в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md): два засеянных
решения (матрица фич; жизненный цикл значения кастомного поля) плюс 189 доменных строк за
семнадцать аудитов (`grep -c '^- '` по этому файлу → 189). Контракт их не назначает. Раздел,
описывающий поведение, которого нет ни в коде фронта, ни на сервере, получает
`**Статус:** спроектировано`.

Домены, у которых своего заголовка в файле решений нет — `products` и `orders`: их строки дописаны
в конец разделов `auth` и `warehouse` соответственно. Это дефект оформления того файла, а не
пропущенные строки; читать их следует там.
