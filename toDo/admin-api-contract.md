# API Contract — Admin SPA

Контракт HTTP API для Vue SPA (`frontend_vue/`), фиксирующий поведение ДО начала бэкенд-разработки. Всё, что сейчас живёт в `src/services/mocks/*`, должно быть переведено в реальные эндпоинты, отвечающие этому контракту.

---

## Общие соглашения

### Envelope

Любой ответ (успех и ошибка) обёрнут единой структурой:

```ts
interface ApiResponse<T> {
  success: boolean
  data?: T         // заполнено при success === true
  message?: string // человекочитаемое описание ошибки / оповещения
  code?: string    // машинный код ошибки (см. ниже)
}
```

Клиент (`src/services/api.ts`) бросает `Error(message)`, если `!json.success` или `res.ok === false`.

Исключение: `GET /api/suppliers/export.csv` возвращает `text/csv` напрямую, без envelope.

### Update pattern: PATCH vs PUT

В контракте **чётко разделены** два способа мутации состояния — `PATCH` и `PUT`. Путаница между ними = баги на concurrent edit, лишний трафик и непредсказуемое поведение для пользователя. Правило простое:

**`PATCH` — merge-обновление одной сущности** (RFC 7396 JSON Merge Patch). Клиент шлёт **только изменённые поля** (`Partial<T>`), сервер merge'ит их поверх текущего состояния и возвращает финальный объект целиком. Используется для правок карточек/форм: supplier card, single section rename, single field rename. Request body — дельта, собранная клиентом через `useDirtyCheck` composable.

**`PUT` — bulk replace коллекции**, когда одним действием меняется состояние **многих записей атомарно** и важна консистентность (reorder массива, каскад правил по матрице). Request body — **весь массив/матрица целиком**. Сервер перезаписывает без merge. Оставлен только на `PUT /api/config/sections` (drag-drop reorder переставляет order у всех секций) и `PUT /api/config/permissions` (Rules 1-5 каскадно меняют десятки ячеек).

**Почему не только PATCH:** атомарный reorder или каскад прав проще одним `PUT` с полным payload'ом, чем десятками параллельных PATCH'ей, которые могут частично упасть и оставить данные в полуизменённом виде. **Почему не только PUT:** на single-entity edit PUT гоняет весь объект туда-сюда (лишний трафик) и перезатирает поля, которые мог обновить другой клиент параллельно (last-write-wins без нужды).

Итог по контракту:
- PATCH: `/suppliers/:id`, `/suppliers/:id/status`, `/config/sections/:id`, `/config/fields/:id`.
- PUT: `/config/sections` (массив целиком), `/config/permissions` (матрица целиком).

### Типы

Фронт использует типы из `src/types/*.ts`. При несовпадении схемы бэкенда с типами — менять типы только с ручной сверкой всех потребителей. Типы, упоминаемые ниже:

- `Supplier`, `SupplierCardData`, `SupplierFilters`, `SupplierFile`, `SupplierAuditEntry`, `SupplierPriceEntry` — `src/types/supplier.ts`
- `BccCategory`, `BccRecipient`, `BccRequest`, `BccEventStatus`, `BccEmailTemplate`, `BccAttachment` — `src/types/bcc.ts`
- `FieldDefinition`, `SectionConfig`, `PermissionMatrix`, `PermissionAction`, `PermissionItem` — `src/types/config.ts`
- `DashboardData`, `KpiItem`, `AlertItem`, `ChartBarItem`, `AnalyticsSectionPreview` — `src/types/analytics.ts`
- `ApiResponse<T>`, `PaginatedResponse<T>`, `PaginationParams` — `src/types/api.ts`

### Pagination

```ts
interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
interface PaginationParams { page: number; pageSize: number }
```

Параметры всегда в query: `?page=1&pageSize=25`.

### Даты и время

- Все даты/время — ISO 8601 (`2026-04-17`, `2026-04-17T14:32:05Z`).
- Длительность — в днях (`leadTime: number`).
- Деньги — `number` (minor units не используем, точность до 2 знаков).
- Временные штампы в заметках (notes) — локальный формат `dd.mm.yyyy hh:mm` в начале блока.

### Авторизация и заголовки

- Бэкенд выдаёт **HttpOnly Secure cookie** `session` (после `POST /api/auth/login`). Fetch должен ходить с `credentials: 'include'`.
- Для не-GET запросов — CSRF-токен: клиент читает cookie `csrf_token` (не HttpOnly) и шлёт его в заголовке `X-CSRF-Token`.
- Все `/api/admin/**` и `/api/auth/me` требуют валидной сессии. Без неё — `401 { success: false, code: 'UNAUTHENTICATED' }`.
- Разрешения: бэкенд должен проверять `PermissionMatrix` на операциях create/edit/delete по полям / секциям супплайера. Отказ — `403 { code: 'FORBIDDEN' }`.

### Коды ошибок

- `UNAUTHENTICATED` — 401, нет/истекла сессия
- `FORBIDDEN` — 403, прав нет
- `NOT_FOUND` — 404
- `VALIDATION_ERROR` — 422, с `message` и опциональным `data: { field: 'email' }`
- `CONFLICT` — 409 (например, удаление секции с fields у супплайеров)
- `RATE_LIMITED` — 429
- `SERVER_ERROR` — 500

### Идемпотентность и Idempotency-Key

- Все `GET` идемпотентны по определению.
- Мутирующие `PUT` (`/config/sections`, `/config/permissions`) — идемпотентны (перезапись полного состояния коллекции/матрицы).
- Мутирующие `PATCH` (`/suppliers/:id`, `/suppliers/:id/status`, `/config/sections/:id`, `/config/fields/:id`) — идемпотентны при том же payload'е (merge тех же полей в те же значения = no-op).
- Необратимые `POST` — требуют заголовок `Idempotency-Key: <uuid>`, сервер кеширует ответ 24 ч и возвращает тот же результат на повторе с тем же ключом:
  - `POST /api/bcc/send`
  - `POST /api/bcc/log`
- На остальных `POST`-ах `Idempotency-Key` **не нужен** — клиент формирует локальный state и ретраит явно по кнопке.

### Возможные расширения (не включаем сейчас)

- **Optimistic locking на PATCH /suppliers/:id.** Можно добавить поле `version` в `SupplierCardData` и возвращать `409 CONFLICT` при рассинхроне. Сейчас — last-write-wins.
- **Сортировка в списке супплайеров.** Можно добавить `?sort=company&dir=asc`. Сейчас — фиксированный порядок `updatedAt DESC`.
- **Per-page типы для аналитики.** Можно разбить `DashboardData` на discriminated union по `page`. Сейчас — общий shape.

### Файлы и аплоады

Универсальный паттерн для любых файлов (супплайер-документы, BCC-аттачменты и т. п.).

#### POST /api/uploads

- **Когда:** drag-drop файла в любой `DropZone` (на карточке супплайера, в BCC-шаблоне, в будущих модалках).
- **Body:** `multipart/form-data`, поле `file` (один или несколько).
- **Response 200:**
  ```ts
  Array<{
    fileId: string
    name: string
    size: number
    mime: string
    url: string         // временный URL для preview
    uploadedAt: string  // ISO
  }>
  ```
- **Notes:**
  - Файл попадает в **draft-хранилище** (не привязан ни к какой сущности).
  - Max 20 MB/файл, whitelist MIME (pdf, docx, xlsx, png, jpg). 413 при превышении.
  - Virus-scan async. 422 `INFECTED` — если scan упал.

#### Привязка к сущности

Save-эндпоинты принимают массив `fileIds: string[]` (в body или в соответствующем nested-поле). Сервер:

1. Находит draft-файлы по `fileId`.
2. Привязывает их к сущности (supplier, BCC request, и т. п.).
3. Переносит из draft-хранилища в постоянное.

Endpoints, принимающие `fileIds`:
- `PATCH /api/suppliers/:id` — поле `fileIds` (replace-семантика для array-поля: присланный массив заменяет текущий полностью; отсутствует в payload → не трогаем).
- `POST /api/bcc/send` и `POST /api/bcc/log` — внутри `template.attachments` (массив `fileIds`).

#### Удаление файла

Удаление = убрать `fileId` из массива и сохранить сущность. Сервер видит отсутствующие ID и удаляет файлы каскадом. Отдельного DELETE-эндпоинта нет.

#### Cleanup

Draft-файлы, не привязанные ни к чему, удаляются по TTL **24 ч**.

---

## Feature Flags

Механизм отключения страниц и секций, которые ещё в разработке или тестируются в проде точечно.

- **Файл:** `frontend_vue/src/config/featureFlags.ts`
- **Composable:** `useFeatureFlag('flagName')` → `computed<boolean>`
- **Override (локальный):** `localStorage.setItem('ff_overrides', JSON.stringify({ flagName: false }))`

### Текущие флаги

**Page-level** (используются в `router.beforeEnter` для blocking навигации):

- `adminDashboard`, `adminWarehouse`, `adminSales`, `adminSupply`, `adminStaff`, `adminLogistics`, `adminPlReport`, `adminDeficit` — 8 аналитических страниц.
- `suppliersList`, `supplierCard`, `supplierCardConfig` — страницы модуля Suppliers.
- `bccRequest` — страница BCC Request Tool.

**Section-level** (используются в template через `v-if="useFeatureFlag('...').value"`):

- `dashboardAlerts`, `dashboardCharts` — виджеты на `DashboardPage`.
- `supplierKanbanView` — kanban-вью в списке.
- `supplierExport` — кнопка CSV-экспорта.
- `bccHistory` — таблица истории в BCC.
- `permissionsEditor` — матрица прав в конфигураторе.

### Применение

- **Page-level:** `beforeEnter` для защиты роутов.
- **Section-level:** `v-if` в template.
- Обе проверки идут через `useFeatureFlag('name')` — единая точка.

### В будущем

Планируется добавить флаги для модулей CRM / Warehouse / Orders / Logistics / Staff по мере появления их UI.

---

# Save UX / Clean-slate

Как система обрабатывает правки, сделанные пользователем в UI. **Это ТЗ для бэкендеров** (не строить autosave / draft-инфраструктуру) **и напоминание для frontend'а** (не отправлять на сервер ничего до явного Save). Модель — **clean-slate**: сервер знает только сохранённое состояние, всё остальное живёт в локальном Vue state.

## Правила

**Правило 1 — Local-first state.** Все изменения в редактируемых карточках/формах хранятся в локальном Vue state композабла (обычно в `ref`/`reactive` внутри `useSupplierCard`, `useCardConfig`, и т. п.). Сервер **НЕ знает** о них до клика Save. Промежуточных запросов нет.

**Правило 2 — Single Save = single PATCH.** Кнопка `Save` собирает **дельту** (dirty-only fields) через `useDirtyCheck` composable и шлёт **один** `PATCH`-запрос. Если ничего не изменилось (`!isDirty`) — Save disabled, запрос не уходит.

**Правило 3 — Reload = сброс.** Reload страницы / переход в другую вкладку / закрытие браузера → возврат к последнему сохранённому server-state. **Pending changes теряются без предупреждения** (кроме `beforeunload` guard, если `isDirty`). Никакого восстановления черновиков.

**Правило 4 — Никакого autosave / draft / per-keystroke sync.** Сервер **не принимает** промежуточные state'ы, не хранит черновики, не синхронизирует каждое нажатие клавиши. Debounce-ов на сохранение нет. Всё — только по явному действию пользователя.

## Исключения — quick actions

Действия, которые применяются **немедленно** (без открытия карточки и без Save-кнопки). Они логически атомарны и не часть редактируемой формы:

- `PATCH /suppliers/:id/status` — drag-drop карточки в kanban → сразу server-side (с confirm-модалкой перед).
- `POST /bcc/events/:id/response` — accept/edit response на строке history → сразу server-side (новый event).
- `POST /bcc/events/:id/no-response` — пометка "no response" → сразу server-side.
- `DELETE /suppliers/:id/audit/:entryId` — удаление аудит-записи → сразу (confirm-модалка перед, но применяется без отдельного Save).
- `POST /bcc/send`, `POST /bcc/log` — отправка / логирование BCC → сразу (с Idempotency-Key).
- `POST /uploads` — файл загружается сразу при drag-drop в DropZone (файл падает в draft-хранилище, привязка к сущности потом — через Save-PATCH с `fileIds[]`).

## Какие страницы работают через save-batch (clean-slate)

- **Supplier Card (`SupplierCardPage`)** — одна `PATCH /api/suppliers/:id` по клику Save, body = `Partial<SupplierCardData>` (только dirty fields + `fileIds[]` если были измения в файлах).
- **Card Config (`SupplierCardConfigPage`)** — по клику Save параллельно (`Promise.all`): `PUT /api/config/sections` + `PUT /api/config/permissions` (bulk replace, см. раздел «Update pattern»).

## Какие через quick actions (server-side сразу)

- **Suppliers List (`SuppliersListPage`)** — drag-drop в kanban (`PATCH /suppliers/:id/status`). Фильтры и search — **клиентская фильтрация локального набора + перезапрос `GET /api/suppliers`** (не мутация, просто reload); никаких PATCH по фильтрам нет.
- **BCC Request Tool (`BccRequestPage`)** — `send` / `log` / `response` / `no-response` — все сразу.

## Почему так

1. **Предсказуемость для пользователя** — до Save состояние на сервере не меняется; пользователь может спокойно редактировать, сравнивать, отменять через Cancel / refresh.
2. **Меньше server load** — один запрос вместо N (по одному на поле).
3. **Atomic rollback через Cancel** — достаточно сбросить локальный state, сервер ничего не откатывает.
4. **Нет конфликтов draft vs saved** — один source of truth на каждое состояние (local — черновик, server — saved).
5. **Проще бэкенду** — нет draft-хранилища, нет GC черновиков (кроме uploads TTL 24 ч), нет состояний "in progress".

---

# Public — статика

Все публичные страницы — `LandingPage`, `AboutPage`, `SupportPage`, `TermsPage`, `NotFoundPage`, `ScreensPage` — **полностью статичны**. Контент рендерится фронтендом из шаблонов и переводов (`src/i18n/public.js`). API-эндпоинты **не требуются**.

Исключение — формы **входа и регистрации**: `LoginPage` и `RegisterPage` используют Auth endpoints (см. ниже).

Раньше в контракте были `POST /api/support/contact` и `GET /api/public/stats` — **удалены**. Support использует `mailto:` и мессенджер-ссылки; hero landing'а — статичные цифры в переводах.

---

# Auth

## POST /api/auth/login

- **Когда:** submit формы на `LoginPage.vue`.
- **Body:**
  ```ts
  { email: string; password: string; remember?: boolean }
  ```
- **Response 200:**
  ```ts
  { user: { id: string; email: string; name: string; role: string }; expiresAt: string }
  ```
  ```json
  { "success": true, "data": { "user": { "id": "u-1", "email": "director@metalltorg.com", "name": "Danyil", "role": "Admin" }, "expiresAt": "2026-04-24T10:00:00Z" } }
  ```
- **Notes:** ставит HttpOnly-cookie `session` и `csrf_token`. Rate-limit 5/min/IP. `remember=true` продлевает TTL до 30 дней. Ошибка: 401 `INVALID_CREDENTIALS`.

## POST /api/auth/register

- **Когда:** submit формы на `RegisterPage.vue`.
- **Body:**
  ```ts
  {
    fullName: string
    email: string
    phone: string
    password: string
    company: string
    vatCode: string
    country: string
  }
  ```
- **Response 200:** тот же `{ user, expiresAt }`, что и `/login` — сразу логинит.
- **Notes:** валидация VAT, email, phone. Триал на 14 дней. Ошибка: 409 `EMAIL_TAKEN`. Rate-limit 3/h/IP.

## POST /api/auth/logout

- **Когда:** клик по "Выход" в `AdminTopbar`.
- **Body:** пусто.
- **Response 200:** `{ success: true }`.
- **Notes:** инвалидирует сессию, чистит cookie. Идемпотентно.

## GET /api/auth/me

- **Когда:** монтирование `AdminLayout` (hydrate user), ручной refresh.
- **Query:** —
- **Response 200:**
  ```ts
  { id: string; email: string; name: string; role: string; locale: 'ru'|'en'|'lt' }
  ```
- **Notes:** 401 если сессия истекла. Клиент редиректит на `/login`.

## POST /api/auth/refresh

- **Когда:** background-интервал за 5 мин до `expiresAt`, или при 401 от любого endpoint.
- **Body:** пусто (refresh-токен живёт в cookie).
- **Response 200:** `{ expiresAt: string }`.
- **Notes:** обновляет `session`-cookie. 401 → force logout.

---

# Admin — Suppliers

## Список поставщиков

Page: `SuppliersListPage.vue`. Composable `useSuppliers`.

### GET /api/suppliers

- **Когда:** `onMounted` → `load()`, изменение любого фильтра (`watch` filters, debounce 300 мс для search), смена page/pageSize.
- **Query:**
  ```ts
  {
    page: string          // "1"
    pageSize: string      // "25" | "50" | "100"
    search: string        // company/contactPerson/email LIKE
    status: SupplierStatus | 'all'
    categories?: string   // "Sheets,Pipes,Beams"
    rating: string        // "0" = any, "1..5" = min rating
  }
  ```
- **Response 200:** `PaginatedResponse<Supplier>`.
  ```json
  { "success": true, "data": { "items": [{ "id": "s-1", "company": "Metalltorg", "status": "active", "rating": 4, "categories": ["Sheets"], "leadTime": 14, "hasDeficit": false, "lastBccDate": "2026-04-10", "...": "..." }], "total": 87, "page": 1, "pageSize": 25, "totalPages": 4 } }
  ```
- **Notes:** requires auth. **Сортировка фиксированная: `updatedAt DESC`** (последние обновлённые сверху). Опциональный `?sort=` — будущее расширение.

### GET /api/suppliers/export.csv

- **Когда:** клик "Export CSV" в списке (секция-флаг `supplierExport`).
- **Query:** те же, что и у `GET /api/suppliers` (те же фильтры, без `page`/`pageSize` — сервер отдаёт всё, что подпадает).
- **Response 200:** `text/csv` напрямую (не envelope!). `Content-Disposition: attachment; filename="suppliers-YYYY-MM-DD.csv"`.
- **Notes:** стриминг — для больших tenant'ов (>10k строк) сервер не должен держать всё в памяти. Колонки: все основные поля `Supplier` + флаги.

### POST /api/suppliers

- **Когда:** клик "New supplier" из списка → `SupplierCreatePage` (`/admin/suppliers/new`) → Create. Сохранение заполненной формы целиком (clean-slate), не черновик.
- **Body:** `Partial<SupplierCardData>` с обязательным `company` и `email`.
- **Response 200:** `SupplierCardData` целиком (с сгенерированным `id`). Клиент редиректит на `/admin/suppliers/:id`.
- **Notes:** permission `create` на корневую секцию. 422 `VALIDATION_ERROR` если нет company/email. UI: `SupplierCreatePage.vue` + `useSupplierCreate` composable, форма на общем `SupplierFormSections.vue` (тот же что в CardPage).

### PATCH /api/suppliers/:id/status

- **Когда:** подтверждение drag-drop в kanban (`confirmMove` в `SuppliersListPage`) + `changeStatus` в `useSuppliers`. **Quick action** — применяется сразу, без Save (см. «Save UX / Clean-slate»).
- **Body:** `{ status: SupplierStatus }` (единственное поле, которое меняем — merge patch семантика).
- **Response 200:** `Supplier` (обновлённая запись с новым `updatedAt`) — клиент уже заоптимизированно обновил локально, но сверяется с server-state.
- **Notes:** **разрешены любые переходы (any → any)** — бэкенд не накладывает бизнес-правил. Каждое изменение пишется в `auditLog` супплайера. Идемпотентно (повторное `active→active` = no-op).

## Карточка поставщика

Page: `SupplierCardPage.vue`. Composable `useSupplierCard` + `useDirtyCheck`.

### GET /api/suppliers/:id

- **Когда:** `onMounted` в карточке; также в `BccRequestPage` при `?supplier=<id>` для preselect.
- **Response 200:** `SupplierCardData` (включая `files`, `auditLog`, `priceHistory`, `addresses`, `contacts`, `bccEmails`, `notes`).
  ```json
  { "success": true, "data": { "id": "s-1", "company": "Metalltorg", "status": "active", "statusReason": "", "vatCode": "LT100001234567", "currency": "EUR", "paymentTerms": "30 Days Net", "leadTime": 14, "minOrder": 2500, "bccEmails": ["bid@..."], "notes": "17.04.2026 14:32\nDiscussed new pricing.\n\n16.04.2026 09:10\nFirst contact.", "files": [], "auditLog": [], "priceHistory": [], "...": "..." } }
  ```
- **Notes:** 404 `NOT_FOUND`. Поля, на которые у роли нет `read`, сервер вырезает или присылает `null`.

### PATCH /api/suppliers/:id

- **Когда:** клик "Save" (`handleSave` → `save()`), только если `isDirty`. **Save-batch** — один запрос собирается из всей формы.
- **Body:** **dirty-only fields** — `Partial<SupplierCardData>`, собрано клиентом через `useDirtyCheck` composable. Включаются только реально изменённые поля. Если менялись файлы — поле `fileIds: string[]` содержит **полный** актуальный массив (replace-семантика для array-полей проще, чем delta по ID; см. «Файлы и аплоады»). Если менялись заметки — поле `notes: string` содержит полную финальную строку.
- **Response 200:** актуальный `SupplierCardData` целиком (после merge — с пересчитанным `updatedAt` и новой аудит-записью).
- **Example:**
  ```http
  PATCH /api/suppliers/s-1
  Content-Type: application/json

  { "rating": 5, "notes": "18.04.2026 11:15\nUpdated contract terms.\n\n17.04.2026 14:32\nDiscussed new pricing.", "fileIds": ["f-1", "f-2"] }
  ```
  Ответ — полный обновлённый объект:
  ```json
  { "success": true, "data": { "id": "s-1", "company": "Metalltorg", "rating": 5, "notes": "18.04.2026 11:15\n...", "fileIds": ["f-1", "f-2"], "updatedAt": "2026-04-18T11:15:00Z", "...": "..." } }
  ```
- **Notes:**
  - Сервер сам генерит `auditLog` entries по diff (сравнивает с предыдущим state).
  - Поля, недоступные на `edit` для роли, — игнор (не ошибка, просто не применяются).
  - Last-write-wins (optimistic locking — возможное расширение).
  - Клиент собирает дельту сам через `useDirtyCheck` — сервер merge-ит любой `Partial<SupplierCardData>`.

#### Формат поля `notes`

`notes: string` — единая строка, несколько блоков разделены пустой строкой (`\n\n`). Каждый блок начинается с timestamp `dd.mm.yyyy hh:mm`:

```
17.04.2026 14:32
Discussed new pricing with Ivan. Will send revised offer Friday.

16.04.2026 09:10
First contact, exchanged VAT codes.
```

Изменения заметок — **локальные до Save**. Клиент добавляет/удаляет блоки в строке, **дата `dd.mm.yyyy hh:mm` генерируется клиентом** и подставляется в начало нового блока. Сервер принимает финальную строку как часть общего `PATCH /api/suppliers/:id` (поле `notes` в dirty-дельте). Отдельных endpoints `/notes` **нет**.

#### Файлы карточки

Добавление: клиент сначала вызывает `POST /api/uploads`, получает `fileId`, держит его в локальном state; на Save отправляет в `fileIds: string[]` (полный массив). Удаление — убрать ID из массива и сохранить. Отдельных endpoints `POST/DELETE /api/suppliers/:id/files` **нет**.

### DELETE /api/suppliers/:id/audit/:entryId

- **Когда:** `confirmDeleteAudit` в модалке на карточке.
- **Response 200:** `void`.
- **Notes:** permission `delete` на аудит (обычно только Admin/Director). Сервер удаляет запись **напрямую**, без мета-записи «X удалил Y» (бэкапы — на стороне инфраструктуры).

## BCC Request Tool

Page: `BccRequestPage.vue`. Composable `useBccRequest`.

### GET /api/bcc/categories

- **Когда:** `onMounted` → `loadCategories`.
- **Response 200:** `BccCategory[]` — корневые категории с nested `children` (товары).
  ```json
  { "success": true, "data": [{ "id": "cat-1", "name": "Sheets", "productCount": 12, "children": [{ "id": "prod-1", "name": "Hot-rolled 1.5mm", "productCount": 0 }] }] }
  ```
- **Notes:** полный каталог — кешируется (ETag). Видимость товара фильтруется по товарным правам, если они понадобятся.

### GET /api/bcc/recipients

- **Когда:** `refreshRecipients` — на старте и при каждом изменении `selectedProductIds` (deep watch).
- **Query:** `{ products?: string }` — CSV-список product id; пустая строка или отсутствие → все поставщики.
- **Response 200:** `BccRecipient[]` с флагом `selected: true` для тех, у кого **в профиле** есть хотя бы один из запрошенных товаров.
  ```json
  { "success": true, "data": [{ "id": "s-1", "company": "Metalltorg", "email": "bid@metalltorg.com", "contactPerson": "Ivan", "selected": true }] }
  ```
- **Notes:** `selected` — подсказка UI (auto-check), поверх которой пользователь может руками переключить.

### GET /api/bcc/history

- **Когда:** `onMounted` → `loadHistory`, смена `page`/`pageSize`.
- **Query:** `{ page: string; pageSize: string }`.
- **Response 200:** `PaginatedResponse<BccRequest>`. Event-sourcing: каждая строка — одна пара product × supplier × статус; `id` уникален, `requestId` группирует.
  ```json
  { "success": true, "data": { "items": [{ "id": "evt-1", "requestId": "req-007", "date": "2026-04-15", "supplierId": "s-1", "supplierName": "Metalltorg", "productId": "prod-1", "productName": "Hot-rolled 1.5mm", "source": "BCC Tool", "status": "sent" }], "total": 1240, "page": 1, "pageSize": 50, "totalPages": 25 } }
  ```
- **Notes:** сортировка DESC по создания. Пагинация обязательна — tenant за год может набрать 50k+ event-rows.

### POST /api/bcc/send

- **Когда:** клик "Send Request" (`sendRequest` → composable.send).
- **Headers:** `Idempotency-Key: <uuid>` (обязательный, server cache 24 ч).
- **Body:**
  ```ts
  {
    productIds: string[]
    recipientIds: string[]
    template: {
      subject: string
      body: string
      attachments: { fileIds: string[] }  // от POST /api/uploads
    }
  }
  ```
- **Response 200:** `{ requestId: string }` (формат `req-###`).
  ```json
  { "success": true, "data": { "requestId": "req-008" } }
  ```
- **Notes:** валидация: оба массива непустые; subject обязателен. Сервер отправляет email с BCC и одновременно создаёт N × M row'ов в history со `status: 'sent'`, `source: 'BCC Tool'`. Аттачменты предварительно загружены через `POST /api/uploads` (см. раздел «Файлы и аплоады») и переданы как `fileIds`.

### POST /api/bcc/log

- **Когда:** клик "Log: &lt;source&gt;" (`logRequest`) — создаёт записи в history БЕЗ отправки email (учёт внесистемных переговоров).
- **Headers:** `Idempotency-Key: <uuid>` (обязательный).
- **Body:**
  ```ts
  {
    productIds: string[]
    recipientIds: string[]
    source: 'BCC Tool' | 'Email' | 'Phone' | 'Messenger' | 'Other'
    attachments?: { fileIds: string[] }
  }
  ```
- **Response 200:** `{ requestId: string; events: BccRequest[] }` — массив созданных строк, чтобы клиент сразу подложил в `history`.
- **Notes:** Email НЕ отправляется.

### POST /api/bcc/events/:id/response

- **Когда:** `savePrice` в модалке "Accept/Edit response". Event-sourcing — создаётся новая строка со статусом `responded`, старая остаётся как audit trail.
- **Body:** `{ price: number; unit: 'kg'|'m'|'piece'|'ton' }`.
- **Response 200:** `BccRequest` — новая созданная строка (status: 'responded').
- **Notes:** 422, если `price <= 0`. В БД старый event не меняется. Также обновляет `priceHistory` карточки соответствующего супплайера.

### POST /api/bcc/events/:id/no-response

- **Когда:** `markNoResponse` — x-кнопка рядом со строкой `sent`.
- **Body:** пусто.
- **Response 200:** `BccRequest` — новая строка со `status: 'no_response'`.
- **Notes:** event-sourcing, не мутирует исходник.

Секция "Add manual entry" из оригинала **не используется** — её заменил `POST /api/bcc/log`. Аттачменты для BCC заливаются через общий `POST /api/uploads` — отдельного `POST /api/bcc/attachments` **нет**.

## Конфигуратор карточки

Page: `SupplierCardConfigPage.vue`. Composable `useCardConfig`.

### GET /api/config/fields

- **Когда:** `onMounted` → `load` (Promise.all с /sections и /permissions).
- **Response 200:** `FieldDefinition[]` — глобальная библиотека полей.
  ```json
  { "success": true, "data": [{ "id": "f-company", "name": "Company", "type": "text", "required": true, "usageCount": 87 }, { "id": "f-custom-170", "name": "Factory ID", "type": "text", "required": false, "usageCount": 3 }] }
  ```
- **Notes:** `usageCount` — сколько супплайеров реально заполнили это поле. Только Admin.

### POST /api/config/fields

- **Когда:** `createField` (модалка "New field") и `confirmAddField` (в секции). Клиент локально создаёт `id: f-custom-<ts>` — сервер его **переопределяет** своим (игнорирует клиентский).
- **Body:** `{ name: string; type: FieldType; required?: boolean; options?: string[] }`.
- **Response 200:** `FieldDefinition` — финальный объект с серверным `id` (префикс `f-custom-`).
- **Notes:** уникальность по `name` per-tenant — 409 `DUPLICATE`. `type: 'enum'` требует `options: string[]`.

### PATCH /api/config/fields/:id

- **Когда:** переименование кастомного поля в library (будущий UI — inline rename). **Quick action** для admin-утилиты конфигуратора (не часть save-batch в `useCardConfig`).
- **Body:** `Partial<FieldDefinition>` — merge patch, обычно `{ name?: string; required?: boolean; options?: string[] }`. Поле `type` менять нельзя (422 `VALIDATION_ERROR`). Поле `id` иммутабельно.
- **Response 200:** `FieldDefinition` (после merge).
- **Example:** `PATCH /api/config/fields/f-custom-170 { "name": "Factory Code" }` → `{ "id": "f-custom-170", "name": "Factory Code", "type": "text", "required": false, "usageCount": 3 }`.
- **Notes:** уникальность по `name` per-tenant — 409 `DUPLICATE`. Встроенные поля (без `f-custom-` префикса) — 403 `IMMUTABLE`.

### DELETE /api/config/fields/:id

- **Когда:** `confirmDeleteField` — удаляется только custom-поле (detect по id-префиксу `f-custom-`).
- **Response 200:** `void`.
- **Notes:** **каскадное удаление без warning** — если поле заполнено у супплайеров, данные удаляются вместе с полем. Бэкапы — на уровне инфраструктуры. Встроенные поля (без `f-custom-` префикса) — 403 `IMMUTABLE`.

### GET /api/config/sections

- **Когда:** часть `load()` в composable.
- **Response 200:** `SectionConfig[]` отсортированный по `order`.
  ```json
  { "success": true, "data": [{ "id": "sec-status", "name": "Status", "order": 0, "collapsed": false, "visible": true, "fields": [{ "fieldId": "f-status", "order": 0, "visible": true }] }] }
  ```
- **Notes:** `collapsed` — только UI-флаг билдера, не рендерится на карточке; сервер просто сохраняет/возвращает. `visible` — реально скрывает секцию на карточке.

### PUT /api/config/sections

- **Когда:** `saveConfig` (клик "Save" внизу конфига) — отправляется массив **целиком**, сервер перезаписывает. **Bulk replace** (см. «Update pattern: PATCH vs PUT»).
- **Body:** `SectionConfig[]`.
- **Response 200:** `void` (клиент верит локальному состоянию).
- **Notes:** атомарная замена. Используется `PUT` специально — drag-drop reorder переставляет `order` у всех секций одновременно; десятки параллельных PATCH'ей дают риск partial-write. Idempotent.

### PATCH /api/config/sections/:id

- **Когда:** точечная правка одной секции без перезаливки всего массива — `rename` / `hide` (visible=false) / `show` (visible=true) / точечное изменение `order` при простой перестановке без каскада. Может использоваться как optimization-путь в будущих UI-операциях "Rename this section" из контекстного меню (без открытия полного конфигуратора).
- **Body:** `Partial<SectionConfig>` — merge patch, обычно `{ name?: string; visible?: boolean; order?: number }`. Поле `fields` в PATCH **не принимаем** (для изменения полей внутри секции — через bulk `PUT /api/config/sections` либо через `PATCH /api/config/fields/:id`).
- **Response 200:** `SectionConfig` (после merge).
- **Example:** `PATCH /api/config/sections/sec-status { "name": "Status & State", "visible": true }` → `{ "id": "sec-status", "name": "Status & State", "visible": true, "order": 0, "collapsed": false, "fields": [...] }`.
- **Notes:** 404 `NOT_FOUND`, если section не существует. В `SupplierCardConfigPage` сейчас не используется (там save-batch через PUT) — endpoint для будущих точечных UI.

### GET /api/config/permissions

- **Когда:** часть `load()`.
- **Response 200:** `PermissionMatrix` — roles, users, rolePermissions, userPermissions, items.
  ```json
  { "success": true, "data": { "roles": ["Admin","Sales","Warehouse"], "users": { "Admin": ["danyil@logisoft.ai"] }, "items": [{ "itemId": "sec-status", "name": "Status", "type": "section" }, { "itemId": "f-status", "name": "Status", "type": "field", "parentId": "sec-status" }], "rolePermissions": {"sec-status": {"Admin": {"read": true, "edit": true, "create": true, "delete": true}}}, "userPermissions": {} } }
  ```
- **Notes:** items соответствуют sections + их полям (в порядке рендера). Сервер обязан добавлять item, когда создаётся section / field.

### PUT /api/config/permissions

- **Когда:** `saveConfig` — параллельно с `PUT /sections` (Promise.all). **Bulk replace** (см. «Update pattern: PATCH vs PUT»).
- **Body:** `PermissionMatrix` целиком.
- **Response 200:** `void`.
- **Notes:** **сервер НЕ проверяет согласованность** — атомарная замена payload'а. Все 5 правил синхронизации (cascade section→fields, clear user overrides, collapse на aligned users, и т. д.) — на стороне фронта (`SupplierCardConfigPage`). Сервер принимает всё что пришло. `PUT`, а не PATCH, специально — каскад правил меняет десятки ячеек одновременно, и атомарный replace проще и безопаснее parallel PATCH'ей.

---

# Admin — Analytics

Pages: `DashboardPage`, `WarehousePage`, `SalesPage`, `SupplyPage`, `StaffPage`, `LogisticsPage`, `PlReportPage`, `DeficitPage`. Service `analyticsService.ts`.

### GET /api/analytics/:page

Общий endpoint для всех 8 страниц — `:page` принимает литерал из `AnalyticsPageKey`. **Все 8 страниц возвращают общий shape `DashboardData`** — discriminated union не делаем.

- **Когда:** `onMounted` каждой analytics view → `getAnalyticsPage(key)`.
- **Params:** `page` ∈ `'dashboard' | 'warehouse' | 'sales' | 'supply' | 'staff' | 'logistics' | 'pl-report' | 'deficit'`.
- **Query (опц., будущее):** `{ from?: string; to?: string; granularity?: 'day'|'week'|'month' }` — сейчас views фильтров не имеют, но резервируем.
- **Response 200:** `DashboardData`.
  ```ts
  interface DashboardData {
    kpis: KpiItem[]
    salesByCategory: ChartBarItem[]
    alerts: AlertItem[]
    sectionPreviews: AnalyticsSectionPreview[]
  }
  ```
  ```json
  { "success": true, "data": { "kpis": [{ "key": "revenue", "value": "€ 1.2M", "delta": "+12%", "trend": "up", "icon": "chart-line", "iconColor": "green" }], "salesByCategory": [{ "label": "Sheets", "value": 240000, "percentage": 34 }], "alerts": [{ "type": "deficit", "description": "Rebar A500C below safety stock", "status": "critical" }], "sectionPreviews": [{ "key": "warehouse", "title": "Warehouse", "metrics": [{ "label": "Turnover", "value": "4.2x", "status": "ok" }] }] } }
  ```
- **Notes:** heavy кеш (5 мин per-user). Permission `read` на соответствующий модуль.

Endpoints по страницам (все той же формы `ApiResponse<DashboardData>`):

### GET /api/analytics/dashboard
Общий обзор. KPIs + sales chart + alerts + section previews (8 виджетов-карточек).

### GET /api/analytics/warehouse
Склад. KPI: остатки, оборачиваемость; alerts: переполнение/нехватка.

### GET /api/analytics/sales
Продажи. KPI: revenue, orders, avg ticket; chart: sales by category; alerts: просроченные.

### GET /api/analytics/supply
Закупки/поставки. KPI: in-transit, overdue; chart: лидтайм по supplier.

### GET /api/analytics/staff
Персонал. KPI: активные, часы, выполненные таски.

### GET /api/analytics/logistics
Логистика. KPI: shipments, damages; chart: lanes.

### GET /api/analytics/pl-report
P&L. KPI: gross/net profit, margin; chart: по месяцам.

### GET /api/analytics/deficit
Дефицит. KPI: total SKU in deficit, critical; alerts: per-SKU.

---

# Changelog

Изменения в этой версии контракта (относительно предыдущей редакции с Open questions):

- **Закрыты все 15 Open questions** — блок удалён.
- **Добавлен раздел «Feature Flags»** — механика отключения страниц и секций через `featureFlags.ts` + `localStorage`.
- **Добавлен раздел «Файлы и аплоады»** в общие соглашения — универсальный `POST /api/uploads` → `fileId` → save-endpoint.
- **Добавлен раздел «Public — статика»** — пояснение, что публичные страницы API не используют.
- **Добавлен `GET /api/suppliers/export.csv`** — серверный CSV-экспорт (стриминг, `text/csv` напрямую).
- **Добавлена пагинация `GET /api/bcc/history`** — теперь `PaginatedResponse<BccRequest>`.
- **`Idempotency-Key` теперь обязательный** на `POST /api/bcc/send` и `POST /api/bcc/log` (server cache 24 ч).
- **Удалены endpoints** (не нужны):
  - `POST /api/suppliers/:id/files`, `DELETE /api/suppliers/:id/files/:fileId` → заменены на uploads + `PUT /api/suppliers/:id` с `fileIds`.
  - `POST /api/suppliers/:id/notes`, `DELETE /api/suppliers/:id/notes/:noteId` → notes живут в строке `notes` и сохраняются через `PUT /api/suppliers/:id`.
  - `POST /api/bcc/attachments` → заменён на общий uploads.
  - `POST /api/support/contact` → не нужен (страница использует `mailto:`).
  - `GET /api/public/stats` → не нужен (hero landing'а — статика).
- **Уточнены решения по спорным моментам:**
  - Supplier list sort — фиксированный `updatedAt DESC`.
  - Supplier status — разрешены любые переходы.
  - Optimistic locking — не включаем сейчас (возможное расширение).
  - Audit delete — без мета-записи.
  - Custom field delete — каскадом без warning.
  - Permissions matrix — сервер не проверяет согласованность (фронт гарантирует).
  - Analytics — общий `DashboardData` shape для всех 8 страниц.
  - New supplier flow — endpoint оставлен, UI — отдельная итерация.

**Итого endpoints в новой версии:** 29
- Auth: 5 (login, register, logout, me, refresh)
- Uploads: 1 (POST /api/uploads)
- Suppliers: 5 (list, export.csv, create, status, get, update) + 1 DELETE audit = 6
- BCC: 7 (categories, recipients, history, send, log, event response, event no-response)
- Config: 9 (fields GET/POST/PATCH/DELETE, sections GET/PUT/PATCH, permissions GET/PUT)
- Analytics: 1 базовый + 8 per-page алиасов (технически один контракт)

---

## 2026-04-18 — PATCH semantics & Save UX

- **Switched `PUT` → `PATCH`** (RFC 7396 JSON Merge Patch) для single-entity updates:
  - `PUT /api/suppliers/:id` → `PATCH /api/suppliers/:id` — body теперь `Partial<SupplierCardData>` (dirty-only fields, собраны через `useDirtyCheck`).
  - `PUT /api/suppliers/:id/status` → `PATCH /api/suppliers/:id/status`.
- **Добавлены новые PATCH endpoints** для точечных правок:
  - `PATCH /api/config/sections/:id` — merge patch одной секции (`{ name?, visible?, order? }`) без перезаливки всего массива.
  - `PATCH /api/config/fields/:id` — merge patch одного field (rename кастомного поля в library).
- **`PUT` оставлен только для bulk replace коллекций**, где важна атомарная консистентность:
  - `PUT /api/config/sections` — drag-drop reorder меняет `order` у всех секций.
  - `PUT /api/config/permissions` — каскад Rules 1-5 меняет десятки ячеек одновременно.
- **Добавлен подраздел «Update pattern: PATCH vs PUT»** в общие соглашения — PATCH для merge-обновления единичных сущностей, PUT для bulk replace коллекций.
- **Добавлен отдельный крупный раздел «Save UX / Clean-slate»** — ТЗ для бэкендеров (не строить autosave/draft) и правила для frontend'а:
  - Local-first state, Single Save = single PATCH, Reload = сброс, никакого autosave.
  - **Quick actions enumeration** (применяются сразу, без Save): `PATCH /suppliers/:id/status`, `POST /bcc/events/:id/response`, `POST /bcc/events/:id/no-response`, `DELETE /suppliers/:id/audit/:entryId`, `POST /bcc/send`, `POST /bcc/log`, `POST /uploads`.
  - Save-batch страницы: `SupplierCardPage` (один PATCH), `SupplierCardConfigPage` (PUT sections + PUT permissions).
- **Уточнён `PATCH /api/suppliers/:id`**: body — dirty-only fields; `notes` обновляется как часть общего PATCH (не через отдельный endpoint); дата `dd.mm.yyyy hh:mm` генерируется клиентом и попадает в `notes` строку при Save; `fileIds` — полный массив (replace-семантика для array-поля).

---

# Admin — Categories (1.2)

Управление иерархическим деревом категорий номенклатуры. Каждая категория задаёт набор кастомных полей (`fields[]`), которые наследуются всеми товарами в ней. Дочерняя категория получает `inheritedFields[]` из всей цепочки родителей.

Типы из `src/types/category.ts`:
- `Category`, `CategoryListItem`, `CategoryField`, `CategoryFilters`, `CategoryFieldType`

### Коды ошибок (специфичные для домена)

- `CATEGORY_HAS_PRODUCTS` — 409, попытка удалить категорию у которой `productCount > 0`
- `CATEGORY_HAS_CHILDREN` — 409, попытка удалить категорию у которой есть дочерние категории
- `CATEGORY_NOT_FOUND` — 404
- `DUPLICATE_FIELD_NAME` — 409, поле с таким именем уже существует в этой категории
- `VALIDATION_ERROR` — 422, отсутствует обязательное поле (напр. `name`)

---

## Список категорий

Page: `CategoriesPage.vue`. Composable: `useCategories`.

### GET /api/categories

- **Когда:** `onMounted` → `load()`, изменение `filters.search` (`watch(filters, load, { deep: true })`).
- **Query:**
  ```ts
  {
    search?: string    // фильтр по name (LIKE), пустая строка = без фильтра
    page: string       // "1"
    pageSize: string   // "25"
  }
  ```
- **Response 200:** `PaginatedResponse<CategoryListItem>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "id": "cat-1", "name": "Металл", "parentId": null, "parentName": null, "fieldCount": 2, "productCount": 0, "level": 0 },
        { "id": "cat-2", "name": "Листы", "parentId": "cat-1", "parentName": "Металл", "fieldCount": 3, "productCount": 12, "level": 1 },
        { "id": "cat-3", "name": "Алюминиевые листы", "parentId": "cat-2", "parentName": "Листы", "fieldCount": 1, "productCount": 4, "level": 2 }
      ],
      "total": 3, "page": 1, "pageSize": 25, "totalPages": 1
    }
  }
  ```
- **Notes:** Сортировка: корневые категории по `name ASC`, дочерние после своего родителя (depth-first). `level` = глубина вложенности (0 = root), вычисляется сервером по цепочке `parentId`. `fieldCount` — только собственные поля категории (не унаследованные).

### POST /api/categories

- **Когда:** submit модала «Создать категорию» в `CategoriesPage`. **Quick action** — применяется немедленно.
- **Body:**
  ```ts
  {
    name: string           // обязательное
    parentId?: string | null
    description?: string | null
  }
  ```
- **Response 200:** `ApiResponse<Category>` — созданная категория целиком (с пустыми `fields`, `inheritedFields` цепочка от родителя).
- **Notes:** 422 `VALIDATION_ERROR` если нет `name`. Клиент после успеха перезапрашивает список (`load()`).

### DELETE /api/categories/:id

- **Когда:** `confirmDelete` в `CategoriesPage` (после confirmation modal). **Quick action.**
- **Response 200:** `ApiResponse<void>`.
- **Notes:** 409 `CATEGORY_HAS_PRODUCTS` если `productCount > 0` — клиент показывает toast с текстом ошибки. Каскадного удаления дочерних категорий **нет** — сервер отклоняет удаление если есть дочерние категории (возвращает 409 с отдельным кодом `CATEGORY_HAS_CHILDREN`).

---

## Карточка категории

Page: `CategoryCardPage.vue`. Composable: `useCategoryCard` + `useDirtyCheck`.

### GET /api/categories/:id

- **Когда:** `onMounted` → `load()`.
- **Response 200:** `ApiResponse<Category>`
  ```json
  {
    "success": true,
    "data": {
      "id": "cat-2",
      "name": "Листы",
      "parentId": "cat-1",
      "description": null,
      "fieldCount": 3,
      "productCount": 12,
      "inheritedFields": [
        { "id": "f-inh-1", "name": "Марка стали", "type": "text", "required": true, "order": 0, "options": [] }
      ],
      "fields": [
        { "id": "f-1", "name": "Толщина (мм)", "type": "number", "required": true, "order": 0, "options": [] },
        { "id": "f-2", "name": "Тип листа", "type": "enum", "required": false, "order": 1, "options": ["Горячекатаный", "Холоднокатаный", "Оцинкованный"] }
      ]
    }
  }
  ```
- **Notes:** `inheritedFields` — объединённый плоский список полей всех родителей (цепочка вверх), в порядке от дальнего предка к ближнему. Read-only для клиента. 404 `CATEGORY_NOT_FOUND`.

### PATCH /api/categories/:id

- **Когда:** клик «Сохранить» (`save()`), только если `isDirty`. **Clean-slate** — часть общего Save вместе с `PUT /fields`.
- **Body:** dirty-only delta, собранный через `useDirtyCheck.diff()`:
  ```ts
  {
    name?: string
    parentId?: string | null
    description?: string | null
  }
  ```
- **Response 200:** `ApiResponse<Category>` — обновлённый объект целиком (с пересчитанными `inheritedFields` если изменился `parentId`).
- **Example:**
  ```http
  PATCH /api/categories/cat-2
  { "name": "Листы металла" }
  ```
- **Notes:** Если изменился `parentId` — сервер пересчитывает `inheritedFields` (возвращает в ответе актуальную цепочку). Last-write-wins.

### PUT /api/categories/:id/fields

- **Когда:** клик «Сохранить», только если `fieldsChanged`. Отправляется параллельно с PATCH (`Promise.all`). **Bulk replace** — весь массив собственных полей целиком.
- **Body:** `CategoryField[]` — полный актуальный массив `localFields` (с пересчитанными `order` по индексу).
  ```json
  [
    { "id": "f-1", "name": "Толщина (мм)", "type": "number", "required": true, "order": 0, "options": [] },
    { "id": "f-2", "name": "Тип листа", "type": "enum", "required": false, "order": 1, "options": ["Горячекатаный", "Холоднокатаный"] },
    { "id": "tmp-1714123456789", "name": "Покрытие", "type": "text", "required": false, "order": 2, "options": [] }
  ]
  ```
- **Response 200:** `ApiResponse<CategoryField[]>` — финальный массив полей с серверными `id` (сервер заменяет `tmp-*` id своими).
- **Notes:** `PUT` (а не PATCH) — потому что drag-and-drop reorder меняет `order` у всех полей атомарно; bulk replace проще и безопаснее параллельных PATCH'ей. Новые поля (с `id` начинающимся на `tmp-`) сервер создаёт и присваивает постоянный `id`. Удалённые поля (отсутствующие в массиве) сервер удаляет каскадом. Флаг `categoryFieldReorder: false` скрывает drag-and-drop в UI, но endpoint остаётся активным для save полей.

---

## Save UX — Categories

**CategoriesPage** — **quick-action**: POST и DELETE применяются немедленно после действия пользователя (без Save bar). DELETE требует confirmation modal перед запросом.

**CategoryCardPage** — **clean-slate**:
- Локальный state: `useDirtyCheck` для `name`/`parentId`/`description`; `localFields ref` для изменений полей
- Save bar всегда видна; кнопка «Сохранить» `disabled` пока `!isDirty && !fieldsChanged`
- Save = `Promise.all([ isDirty ? PATCH : skip, fieldsChanged ? PUT fields : skip ])`
- Discard = `load()` (перезагрузка с сервера, локальный state сбрасывается)
- Reload страницы = rollback к последнему сохранённому state

## Feature Flags — Categories

| Флаг | Уровень | Что скрывает |
|---|---|---|
| `adminCategories` | page-level | весь роут `/admin/products/categories` и `/admin/products/categories/:id` |
| `categoryFieldReorder` | section-level | drag-and-drop reorder полей на `CategoryCardPage` (PUT endpoint остаётся активным) |

→ Implementation:
- Service: `src/services/categoriesService.ts`
- Mock: `src/services/mocks/categories.ts`
- Composables: `src/composables/useCategories.ts`, `src/composables/useCategoryCard.ts`
- Views: `src/views/admin/products/CategoriesPage.vue`, `src/views/admin/products/CategoryCardPage.vue`
- E2E: `tests/e2e/admin/products/categories.spec.ts`
