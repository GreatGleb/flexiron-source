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

### TranslatedString

Мультилокалевые поля (`company`, `contactPerson`, `statusReason`, `product`, `unit`, `source`, `user`, `property`, `name`, `role`, `action`, `details`) передаются как объект с тремя обязательными полями:

```ts
interface TranslatedString {
  ru: string
  en: string
  lt: string
}
```

Клиент всегда шлёт все 3 поля. Неактивные локали — пустая строка. Сервер должен хранить и возвращать все 3 поля без изменений.

**Пример в запросе (PATCH body):**
```json
{ "company": { "ru": "Металлторг", "en": "Metalltorg", "lt": "Metalltorg" } }
```

**Пример в ответе (GET /api/suppliers):**
```json
{ "company": { "ru": "Металлторг", "en": "Metalltorg", "lt": "Metalltorg" } }
```

> **Важно:** В примерах ниже для краткости может использоваться `"company": "Metalltorg"` — это сокращение. Реальный wire format — всегда `TranslatedString`.

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
  - Virus-scan синхронный (блокирующий). 422 `INFECTED` — если файл заражён.

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
- **Body:** `Partial<SupplierCardData>` — клиент шлёт только заполненные поля, сервер заполняет defaults для остальных:
  ```ts
  {
    // Required
    company: TranslatedString    // или string → клиент конвертирует в TranslatedString
    email: string

    // Optional — сервер заполняет default при отсутствии
    contactPerson?: TranslatedString  // default: {ru:'',en:'',lt:''}
    phone?: string                    // default: ''
    status?: SupplierStatus           // default: 'new'
    categories?: string[]             // default: []
    rating?: number                   // default: 0
    country?: string                  // default: ''
    city?: string                     // default: ''
    tags?: string[]                   // default: []
    notes?: string                    // default: ''
    leadTime?: number                 // default: 0
    statusReason?: TranslatedString   // default: {ru:'',en:'',lt:''}
    contractDate?: string             // default: ''
    vatCode?: string                  // default: ''
    currency?: string                 // default: 'EUR'
    paymentTerms?: string             // default: '30 Days Net'
    minOrder?: number | null          // default: null
    bccEmails?: string[]              // default: []
    addresses?: SupplierAddress[]     // default: [{type:'Legal',line1:'',city:'',country:'',zip:''}]
    contacts?: SupplierContact[]      // default: []
    files?: SupplierFile[]            // default: []
    fileIds?: string[]                // default: []
  }
  ```
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

#### Формат аудит-лога

Каждая запись `SupplierAuditEntry` содержит `oldValue` и `newValue` — JSON-строки с ключами изменённых полей. Формат максимально удобен для хранения в БД и работы на сервере:

```ts
interface SupplierAuditEntry {
  id: string              // UUID, генерируется сервером
  timestamp: string       // ISO 8601
  user: TranslatedString  // имя пользователя
  userInitials: string    // инициалы для UI
  property: TranslatedString  // название поля (локализовано)
  oldValue: string        // JSON-строка с предыдущим значением
  newValue: string        // JSON-строка с новым значением
}
```

**Пример для single-field изменения (rating):**
```json
{
  "id": "audit-a1b2c3d4",
  "timestamp": "2026-04-18T11:15:00Z",
  "user": { "ru": "Даниил", "en": "Danyil", "lt": "Danilas" },
  "userInitials": "DD",
  "property": { "ru": "Рейтинг", "en": "Rating", "lt": "Įvertinimas" },
  "oldValue": "{\"rating\":3}",
  "newValue": "{\"rating\":5}"
}
```

**Пример для multi-field изменения (компания + статус):**
```json
{
  "oldValue": "{\"company\":{\"ru\":\"СтальТрейд\",\"en\":\"StalTrade\",\"lt\":\"PlienoPrekyba\"},\"status\":\"new\"}",
  "newValue": "{\"company\":{\"ru\":\"Металлторг\",\"en\":\"Metalltorg\",\"lt\":\"Metalltorg\"},\"status\":\"active\"}"
}
```

> **Важно:** `oldValue`/`newValue` — это строки (JSON serialized), а не вложенные объекты. Сервер хранит их как есть, без парсинга. Клиент парсит для отображения diff в UI.

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
- **Params:** `entryId` — UUID аудит-записи (генерируется сервером, возвращается в `auditLog[].id`).
- **Response 200:** `void`.
- **Notes:** permission `delete` на аудит (обычно только Admin/Director). Сервер удаляет запись **напрямую**, без мета-записи «X удалил Y» (бэкапы — на стороне инфраструктуры). `entryId` — это DB ID (UUID), а не индекс в массиве.

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

- **Когда:** клик "Log: <source>" (`logRequest`) — создаёт записи в history БЕЗ отправки email (учёт внесистемных переговоров).
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
- **Body:** `{ price: number; unit: 'kg'|'m- **Response 200:** `BccRequest` — новая созданная строка (status: 'responded').
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

## 2026-06-01 — Added Warehouse (Batches / Movements / Offcuts) section

- **Добавлен крупный раздел «Warehouse — Batches (2.0)»** — документированы все эндпоинты для карточки партии:
  - `GET /api/warehouse/batches/:id` — данные партии
  - `PATCH /api/warehouse/batches/:id` — обновление полей
  - `DELETE /api/warehouse/batches/:id` — удаление партии
  - `GET /api/warehouse/batches/:id/aggregates` — агрегированные статусы
  - `GET /api/warehouse/batches/:id/active-sales` — активные продажи для возврата
  - `GET /api/warehouse/batches/:id/audit` — аудит партии
  - `DELETE /api/warehouse/batches/:id/audit/:entryIndex` — удаление записи аудита
  - `GET /api/warehouse/movements` — список движений (с фильтром batchNumber)
  - `POST /api/warehouse/movements` — создание движения
  - `GET /api/warehouse/offcuts` — список обрезков (с фильтром batchNumber)
- **Документирована бизнес-логика** для бэкенда:
  - Вычисление агрегатов из движений (см. `GET /batches/:id/aggregates`)
  - Пересчёт остатков партии при создании движения (см. `POST /movements`)
  - Определение статуса партии по распределению агрегатов

**Новых endpoints:** 9 (с учётом общих batch/audit/movements/offcuts)
**Итого endpoints:** 29 + 9 = 38

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
      ],
      "linkedSuppliers": [
        { "id": "1", "name": "Steel Plus OÜ", "price": null, "priceUnit": null, "leadDays": 7 }
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
    linkedSuppliers?: LinkedSupplier[]  // полный массив если изменился список поставщиков
  }
  ```
- **Response 200:** `ApiResponse<Category>` — обновлённый объект целиком (с пересчитанными `inheritedFields` если изменился `parentId`).
- **Example:**
  ```http
  PATCH /api/categories/cat-2
  { "name": "Листы металла" }
  ```
- **Notes:** Если изменился `parentId` — сервер пересчитывает `inheritedFields` (возвращает в ответе актуальную цепочку). Last-write-wins. `linkedSuppliers` — администратор вручную привязывает поставщиков к категории (default-список для товаров этой категории); `price`/`priceUnit` всегда `null` на уровне категории (цена — на уровне товара).

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
- Локальный state: `useDirtyCheck` для `name`/`parentId`/`description`; `localFields ref` для изменений полей; `linkedSuppliers ref` для поставщиков
- Save bar всегда видна; кнопка «Сохранить» `disabled` пока `!isDirty && !fieldsChanged && !linkedSuppliersChanged`
- Save = `Promise.all([ isDirty || linkedSuppliersChanged ? PATCH : skip, fieldsChanged ? PUT fields : skip ])`
- Discard = `load()` (перезагрузка с сервера, локальный state сбрасывается)
- Reload страницы = rollback к последнему сохранённому state

## Feature Flags — Categories

| Флаг | Уровень | Что скрывает |
|---|---|---|
| `adminCategories` | page-level | весь роут `/admin/products/categories` и `/admin/products/categories/:id` |
| `categoryFieldReorder` | section-level | drag-and-drop reorder полей на `CategoryCardPage` (PUT endpoint остаётся активным) |
| `categorySupplierLinks` | section-level | секция «Поставщики» в `CategoryCardPage` |

→ Implementation:
- Service: `src/services/categoriesService.ts`
- Mock: `src/services/mocks/categories.ts`
- Composables: `src/composables/useCategories.ts`, `src/composables/useCategoryCard.ts`
- Views: `src/views/admin/products/CategoriesPage.vue`, `src/views/admin/products/CategoryCardPage.vue`
- E2E: `tests/e2e/admin/products/categories.spec.ts`

---

## Список товаров (Products 1.1)

Page: `ProductsPage.vue`. Composable: `useProducts`.

### GET /api/products

- **Когда:** `onMounted` → `load()`, изменение `filters.search` / `filters.categoryIds` (`watch(filters, load, { deep: true })`).
- **Query:**
  ```ts
  {
    search?: string       // фильтр по name (LIKE), пустая строка = без фильтра
    categoryIds?: string  // ID категорий через запятую, отсутствует = все категории
    page: string          // "1"
    pageSize: string      // "25"
    sortBy?: string       // "name" | "category" | "price" (default: "name")
    sortDir?: string      // "asc" | "desc" (default: "asc")
  }
  ```
- **Response 200:** `PaginatedResponse<ProductListItem>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "id": "prod-1", "name": "Steel Sheet 3mm", "categoryId": "cat-2", "categoryName": "Sheets",
          "sku": "SS-3-1000", "price": 120.50, "minStock": 50, "priceUnit": "EUR/vnt", "createdAt": "2025-01-15" }
      ],
      "total": 10, "page": 1, "pageSize": 25, "totalPages": 1
    }
  }
  ```
- **Notes:** Сортировка по `name ASC` (дефолт). `sortBy=category` сортирует по `categoryName`. `categoryIds: null` = без категории.

### POST /api/products

- **Когда:** submit модала «Добавить товар» в `ProductsPage`. **Quick action.**
- **Body:**
  ```ts
  {
    name: string
    categoryId?: string | null
    sku?: string | null
    description?: string | null
    price?: number | null
    minStock?: number | null
    priceUnit?: 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | null
  }
  ```
- **Response 200:** `ApiResponse<Product>` — созданный товар целиком (с `fieldValues: []`, `linkedSuppliers: []`).
- **Notes:** 422 `VALIDATION_ERROR` если нет `name`. Клиент после успеха перезапрашивает список (`load()`).

### DELETE /api/products/:id

- **Когда:** `confirmDelete` в `ProductsPage` (после confirmation modal). **Quick action.**
- **Response 200:** `ApiResponse<void>`.
- **Notes:** 409 `PRODUCT_IN_USE` если товар используется в активных заказах.

---

## Карточка товара (Products 1.1)

Page: `ProductCardPage.vue`. Composable: `useProductCard` + `useDirtyCheck`.

### GET /api/products/:id

- **Когда:** `onMounted` → `load()`.
- **Response 200:** `ApiResponse<Product>`
  ```json
  {
    "success": true,
    "data": {
      "id": "prod-1",
      "name": "Steel Sheet 3mm",
      "categoryId": "cat-2", "categoryName": "Sheets",
      "sku": "SS-3-1000", "description": "Hot-rolled steel sheet", "price": 120.50, "minStock": 50,
      "priceUnit": "EUR/vnt", "createdAt": "2025-01-15",
      "fieldValues": [
        { "fieldId": "f-2-1", "fieldName": "Thickness (mm)", "fieldType": "number", "value": 3, "inherited": false, "options": [] },
        { "fieldId": "f-2-2", "fieldName": "Sheet type", "fieldType": "enum", "value": "Hot-rolled", "inherited": false, "options": ["Hot-rolled","Cold-rolled","Galvanized"] }
      ],
      "linkedSuppliers": [
        { "id": "sup-1", "name": "Metinvest", "price": 115.00, "priceUnit": "EUR/vnt", "leadDays": 7 }
      ]
    }
  }
  ```
- **Notes:** 404 `PRODUCT_NOT_FOUND`.

### PATCH /api/products/:id

- **Когда:** клик «Сохранить» (`save()`), только если `isAnythingDirty`. **Clean-slate** — delta из `useDirtyCheck.diff()` + измененные `fieldValues`.
- **Body:** dirty-only delta:
  ```ts
  {
    name?: string
    sku?: string | null
    description?: string | null
    price?: number | null
    minStock?: number | null
    priceUnit?: 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | null
    fieldValues?: ProductFieldValue[]       // полный массив если изменились dynamic fields
    linkedSuppliers?: LinkedSupplier[]      // полный массив если изменился список поставщиков
  }
  ```
- **Response 200:** `ApiResponse<Product>` — обновлённый товар целиком.
- **Notes:** Last-write-wins. Клиент пересчитывает `fieldValues` из `Record<fieldId,value>` обратно в массив перед отправкой. `linkedSuppliers` — администратор вручную добавляет/удаляет поставщиков из карточки товара; BCC requests к этому списку не относятся.

---

## Save UX — Products

**ProductsPage** — **quick-action**: POST и DELETE применяются немедленно. DELETE требует confirmation modal.

**ProductCardPage** — **clean-slate**:
- `useDirtyCheck` для `name`/`sku`/`description`/`price`/`minStock`/`priceUnit`
- `fieldValues: ref<Record<fieldId,value>>` для dynamic fields + `originalFieldValues: ref<string>` (JSON.stringify baseline)
- Save bar видна при `isAnythingDirty = isDirty || fieldValuesChanged`
- Save = PATCH (если `isAnythingDirty`) → затем `load()` (сброс baseline)
- Discard = `load()` (перезагрузка с сервера)

## Feature Flags — Products

| Флаг | Уровень | Что скрывает |
|---|---|---|
| `adminProducts` | page-level | весь роут `/admin/products` и `/admin/products/:id` |
| `productSupplierLinks` | section-level | секция «Поставщики» в `ProductCardPage` |
| `adminServices` | page-level | весь роут `/admin/services` и `/admin/services/:id` |

→ Implementation:
- Service: `src/services/productsService.ts`
- Mock: `src/services/mocks/products.ts`
- Composables: `src/composables/useProducts.ts`, `src/composables/useProductCard.ts`
- Views: `src/views/admin/products/ProductsPage.vue` (расширена), `src/views/admin/products/ProductCardPage.vue` (новый)
- E2E: `tests/e2e/admin/products/products.spec.ts`

---
# Admin — Services (1.3)

Управление прайс-листом услуг (работ, сервисов), которые можно добавлять в заказы.

Типы из `src/types/service.ts`:
- `Service`, `ServiceListItem`, `ServiceFilters`
- `ServiceCreatePayload`, `ServicePatchPayload`
- `ServicePriceUnit` = `'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'`

### Коды ошибок (специфичные для домена)

- `SERVICE_NOT_FOUND` — 404
- `VALIDATION_ERROR` — 422, отсутствует обязательное поле (напр. `name`)

---

## Список услуг

Page: `ServicesPage.vue`. Composable: `useServices`.

### GET /api/services

- **Когда:** `onMounted` → `load()`, изменение `filters.search`, смена page/pageSize.
- **Query:**
  ```ts
  {
    search?: string       // фильтр по name (LIKE), пустая строка = без фильтра
    sortBy?: string       // "name" | "costPrice" | "sellingPrice" (default: "name")
    sortDir?: string      // "asc" | "desc" (default: "asc")
    page: string          // "1"
    pageSize: string      // "25"
  }
  ```
- **Response 200:** `PaginatedResponse<ServiceListItem>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        { "id": "svc-1", "name": { "ru": "Лазерная резка", "en": "Laser Cutting", "lt": "Lazerinis pjovimas" }, "costPrice": 15.00, "sellingPrice": 25.00, "priceUnit": "EUR/h" }
      ],
      "total": 10, "page": 1, "pageSize": 25, "totalPages": 1
    }
  }
  ```
- **Notes:** Сортировка по `name ASC` (дефолт).

### POST /api/services

- **Когда:** submit модала «Создать услугу» в `ServicesPage`. **Quick action.**
- **Body:**
  ```ts
  {
    name: string               // обязательное
    costPrice?: number         // default: 0
    sellingPrice?: number      // default: 0
    priceUnit?: ServicePriceUnit   // default: 'EUR/vnt'
    description?: string
  }
  ```
- **Response 200:** `ApiResponse<Service>` — созданная услуга целиком.
- **Notes:** 422 `VALIDATION_ERROR` если нет `name`. Клиент после успеха перезапрашивает список (`load()`).

### DELETE /api/services/:id

- **Когда:** `confirmDelete` в `ServicesPage` (после confirmation modal). **Quick action.**
- **Response 200:** `ApiResponse<void>`.
- **Notes:** 404 `SERVICE_NOT_FOUND` если услуга не существует. Каскадного удаления из заказов нет — сервер отклоняет удаление если услуга используется в активных заказах (409 `SERVICE_IN_USE`).

---

## Карточка услуги

Page: `ServiceCardPage.vue`. Composable: `useServiceCard` + `useDirtyCheck`.

### GET /api/services/:id

- **Когда:** `onMounted` → `load()`.
- **Response 200:** `ApiResponse<Service>`
  ```json
  {
    "success": true,
    "data": {
      "id": "svc-1",
      "name": { "ru": "Лазерная резка", "en": "Laser Cutting", "lt": "Lazerinis pjovimas" },
      "costPrice": 15.00,
      "sellingPrice": 25.00,
      "priceUnit": "EUR/h",
      "description": null,
      "createdAt": "2025-01-15"
    }
  }
  ```
- **Notes:** 404 `SERVICE_NOT_FOUND`.

### PATCH /api/services/:id

- **Когда:** клик «Сохранить» (`save()`), только если `isAnythingDirty`. **Clean-slate** — delta из `useDirtyCheck.diff()`.
- **Body:** dirty-only delta (`ServicePatchPayload`):
  ```ts
  {
    name?: TranslatedString
    costPrice?: number
    sellingPrice?: number
    priceUnit?: ServicePriceUnit
    description?: TranslatedString | null
  }
  ```
- **Response 200:** `ApiResponse<Service>` — обновлённая услуга целиком.
- **Notes:** Last-write-wins.

---

## Save UX — Services

**ServicesPage** — **quick-action**: POST и DELETE применяются немедленно. DELETE требует confirmation modal.

**ServiceCardPage** — **clean-slate**:
- `useDirtyCheck` для `name`/`costPrice`/`sellingPrice`/`priceUnit`/`description`
- Save bar видна при `isAnythingDirty`
- Save = PATCH с dirty-only delta
- Discard = сброс формы до последнего сохранённого состояния

## Feature Flags — Services

| Флаг | Уровень | Что скрывает |
|---|---|---|
| `adminServices` | page-level | весь роут `/admin/services` и `/admin/services/:id` |

→ Implementation:
- Service: `src/services/servicesService.ts`
- Mock: `src/services/mocks/services.ts`
- Composables: `src/composables/useServices.ts`, `src/composables/useServiceCard.ts`
- Views: `src/views/admin/products/ServicesPage.vue`, `src/views/admin/products/ServiceCardPage.vue`
- E2E: `tests/e2e/admin/products/services.spec.ts`, `tests/e2e/admin/products/service-card.spec.ts`

---


# Warehouse — Batches (2.0)

Управление складскими партиями, движениями, обрезками, дефицитом и общим остатком.

Типы из `src/types/warehouse.ts`:
- `WarehouseBatch`, `BatchListItem`, `BatchCreatePayload`, `BatchPatchPayload`
- `WarehouseMovement`, `MovementListItem`, `MovementCreatePayload`
- `MovementType` = `'receipt' | 'expense' | 'transfer' | 'write-off' | 'return' | 'return-to-supplier' | 'correction' | 'production' | 'sale' | 'storage' | 'offcut'`
- `BatchStatus` = `'available' | 'in_storage' | 'in_production' | 'sold' | 'scrapped' | 'expensed' | 'returned_to_supplier' | 'partial' | 'depleted' | 'reserved'`
- `WarehouseOffcut`, `OffcutListItem`, `OffcutCreatePayload`, `OffcutPatchPayload`
- `WarehouseDeficit`, `DeficitListItem`, `DeficitCreatePayload`, `DeficitPatchPayload`
- `StockOverviewItem`, `StockPatchPayload`
- `BatchStatusAggregate`, `BatchActiveSale`
- `StockAuditEntry`, `StockUnit` = `'kg' | 'm' | 'pcs' | 'm2'`

### Коды ошибок (специфичные для домена)

- `BATCH_NOT_FOUND` — 404, партия не найдена
- `BATCH_LINKED_TO_ORDER` — 409, попытка удалить партию привязанную к заказу
- `OFFCUT_NOT_FOUND` — 404, обрезок не найден
- `MOVEMENT_NOT_FOUND` — 404, движение не найдено
- `STOCK_ITEM_NOT_FOUND` — 404, товарная позиция склада не найдена
- `DEFICIT_NOT_FOUND` — 404, запись дефицита не найдена
- `VALIDATION_ERROR` — 422, отсутствует обязательное поле
- `NOT_FOUND` — 404, аудит не найден

### Envelope

Все ответы обёрнуты в `ApiResponse<T>` (см. Общие соглашения). Список эндпоинтов с пагинацией возвращают `PaginatedResponse<T>`.

### Save UX — Warehouse

**Список партий/обрезков/движений/дефицита** — **quick-action**: POST (create), DELETE (delete) применяются немедленно. DELETE требует confirmation modal.

**Карточка партии** — **clean-slate**:
- `useDirtyCheck` для полей формы (`batchNumber`, `lotCode`, `unitPrice`, `currency`, `lotCode`, `locationRack/Row/Cell/Notes`, `certificateRef`, `notes`, `status`)
- Save bar при `isAnythingDirty || имеет незагруженные файлы || файлы были удалены`
- Save = `PATCH /api/warehouse/batches/:id` с dirty-only delta
- После Save: если изменился `location` → автоматически создаётся `POST /api/warehouse/movements` с `type=transfer`
- Discard = сброс формы до последнего сохранённого состояния с сервера
- Файлы: drag-drop через `POST /api/uploads` → `fileIds` → PATCH batch с `fileIds[]`

**Карточка движения** — data-only (read-only для созданных движений, редактирование не предусмотрено).

**Создание движения (модалка)** — **quick-action**: submit → `POST /api/warehouse/movements` → refresh данных карточки партии.

---

## Карточка партии (Batch Card)

Page: `WarehouseBatchCard.vue`. Composable: `useWarehouseBatch` + `useDirtyCheck`.

### GET /api/warehouse/batches/:id

- **Когда:** `onMounted` → `load()`.
- **Response 200:** `ApiResponse<WarehouseBatch>`
  ```json
  {
    "success": true,
    "data": {
      "id": "whb-001",
      "productId": "prod-1",
      "productName": { "ru": "Стальной лист 3мм", "en": "Steel Sheet 3mm", "lt": "Plieno lakštas 3mm" },
      "supplierId": "sup-1",
      "supplierName": { "ru": "Металлторг", "en": "Metalltorg", "lt": "Metalltorg" },
      "batchNumber": "INV-2026-001",
      "lotCode": "LOT-2026-001",
      "quantity": 5000,
      "quantityRemaining": 4200,
      "unit": "kg",
      "unitPrice": 1.25,
      "totalCost": 6250.00,
      "currency": "EUR",
      "receivedAt": "2026-04-17T08:00:00Z",
      "expiresAt": null,
      "location": "Rack: A | Row: 3 | Cell: B12\nNotes: near entrance",
      "certificateRef": "CERT-2026-001",
      "status": "partial",
      "files": [
        { "id": "file-1", "name": { "ru": "Сертификат", "en": "Certificate", "lt": "Sertifikatas" }, "size": 102400, "type": "application/pdf", "uploadedAt": "2026-04-17" }
      ],
      "notes": "Quality check passed",
      "orderId": null,
      "createdAt": "2026-04-17T08:00:00Z",
      "updatedAt": "2026-04-17T08:00:00Z"
    }
  }
  ```
- **Notes:** 404 `BATCH_NOT_FOUND`. Поле `location` — составная строка формата `"Rack: X | Row: Y | Cell: Z\nNotes: ..."`, парсится клиентом через `parseLocation()`. Поле `files` — полный массив прикреплённых файлов.

### PATCH /api/warehouse/batches/:id

- **Когда:** клик «Сохранить» (`save()`), только если `isAnythingDirty`. **Clean-slate** — delta из `useDirtyCheck.diff()`.
- **Body:** dirty-only delta (`BatchPatchPayload`):
  ```ts
  {
    batchNumber?: string
    lotCode?: string
    quantity?: number
    unitPrice?: number
    currency?: string
    location?: string | null      // составная строка, как в GET
    certificateRef?: string | null
    status?: BatchStatus
    notes?: string | null
    fileIds?: string[]            // полный массив (replace-семантика для array-поля)
  }
  ```
- **Response 200:** `ApiResponse<WarehouseBatch>` — обновлённая партия целиком.
- **Example:**
  ```http
  PATCH /api/warehouse/batches/whb-001
  { "location": "Rack: B | Row: 1 | Cell: A05", "notes": "Moved to new rack" }
  ```
- **Notes:** Last-write-wins. После PATCH, если `location` изменился, клиент автоматически создаёт transfer movement (quick-action). Поля `quantity`, `unitPrice`, `status` могут меняться моками автоматически при создании движений — клиент синхронизируется через перезагрузку.

### DELETE /api/warehouse/batches/:id

- **Когда:** `onDeleteConfirm` в `WarehouseBatchCard` (после confirmation modal с предупреждением о каскадном удалении offcuts/movements). **Quick action.**
- **Response 200:** `ApiResponse<void>`.
- **Notes:** 409 `BATCH_LINKED_TO_ORDER` если `orderId !== null`. Каскадное удаление: сервер удаляет все движения и обрезки, привязанные к партии. Клиент показывает предупреждение о количестве удаляемых связанных записей до подтверждения.

### DELETE /api/warehouse/batches/:id/audit/:entryIndex

- **Когда:** клик на иконку удаления в строке аудита → confirmation modal → confirm. **Quick action.**
- **Response 200:** `ApiResponse<void>`.
- **Notes:** 404 `NOT_FOUND` если запись не существует. `entryIndex` — порядковый номер записи в массиве аудита.

---

## Агрегаты партии (Batch Aggregates & Active Sales)

Используется в `WarehouseBatchCard.vue` и `CreateMovementModal.vue` для отображения распределения товара по статусам и выбора источника для нового движения.

### GET /api/warehouse/batches/:id/aggregates

- **Когда:** загрузка карточки партии (`load()`), обновление после создания движения.
- **Response 200:** `ApiResponse<BatchStatusAggregate[]>`
  ```json
  {
    "success": true,
    "data": [
      { "type": "receipt", "quantity": 4200, "unit": "kg" },
      { "type": "sale", "quantity": 500, "unit": "kg" },
      { "type": "production", "quantity": 200, "unit": "kg" },
      { "type": "write-off", "quantity": 100, "unit": "kg" }
    ]
  }
  ```
- **Notes:** Агрегаты вычисляются сервером на основе движений партии. `receipt` = `batch.quantityRemaining`. Остальные типы суммируются по движениям с учётом возвратов и коррекций.

**Логика вычисления (бэкенд):**
```
1. receipt = batch.quantityRemaining (остаток на складе)
2. Для каждого движения (кроме receipt, transfer, correction):
   - outgoing типа (sale, expense, write-off, production, return-to-supplier, storage): += quantity
   - return: -= quantity для referenceType (уменьшает соответствующий агрегат)
3. Второй проход: correction → перезаписывает quantity для referenceType
4. Возвращаются только агрегаты с quantity > 0
```

### GET /api/warehouse/batches/:id/active-sales

- **Когда:** загрузка карточки партии (`load()`), обновление после создания движения. Используется в `CreateMovementModal` для выбора продажи для возврата.
- **Response 200:** `ApiResponse<BatchActiveSale[]>`
  ```json
  {
    "success": true,
    "data": [
      { "id": "sale-whb-001-001", "movementId": "whm-005", "quantity": 300, "unit": "kg", "referenceId": "ORD-2026-042", "soldAt": "2026-04-20T10:30:00Z" },
      { "id": "sale-whb-001-002", "movementId": "whm-008", "quantity": 200, "unit": "kg", "referenceId": "ORD-2026-048", "soldAt": "2026-04-25T14:00:00Z" }
    ]
  }
  ```
- **Notes:** Активные продажи = продажи, по которым ещё не было полного возврата. Вычисляются как `sale.quantity - SUM(return.quantity WHERE referenceId = sale.referenceId)` для каждого sale-движения.

---

## Движения партии (Batch Movements)

Используется в `WarehouseBatchCard.vue` для таблицы движений и в `CreateMovementModal.vue` для создания нового движения.

### GET /api/warehouse/movements

- **Когда:** загрузка карточки партии (`loadMovements()`).
- **Query:**
  ```ts
  {
    search?: string         // поиск по productName / batchNumber
    type?: string           // фильтр по MovementType
    unit?: string
    categoryIds?: string    // ID категорий через запятую
    batchNumber?: string    // фильтр по номеру партии (частичное совпадение, ILIKE) (основной для карточки партии)
    dateFrom?: string       // ISO
    dateTo?: string         // ISO
    sortBy?: string         // "movedAt" | "type" | "productName" | "batchNumber" | "quantity" | "unitPrice" | "totalCost" (default: "movedAt")
    sortDir?: string        // "asc" | "desc" (default: "desc")
    page: string            // "1"
    pageSize: string        // "50" (в карточке партии используется 50)
  }
  ```
- **Response 200:** `PaginatedResponse<MovementListItem>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "whm-001",
          "type": "sale",
          "batchId": "whb-001",
          "batchNumber": "INV-2026-001",
          "productId": "prod-1",
          "productName": { "ru": "Стальной лист 3мм", "en": "Steel Sheet 3mm", "lt": "Plieno lakštas 3mm" },
          "quantity": 300,
          "unit": "kg",
          "unitPrice": 1.25,
          "referenceId": "ORD-2026-042",
          "referenceType": "sale",
          "notes": null,
          "movedAt": "2026-04-20T10:30:00Z"
        }
      ],
      "total": 5, "page": 1, "pageSize": 50, "totalPages": 1
    }
  }
  ```
- **Notes:** Сортировка по умолчанию `movedAt DESC`. `batchNumber` — фильтр по частичному совпадению (ILIKE/lowercase contains).

### POST /api/warehouse/movements

- **Когда:** submit модала «Создать движение» в `CreateMovementModal.vue` или автоматическое создание transfer при смене локации в `useWarehouseBatch.save()`. **Quick action.**
- **Body:**
  ```ts
  {
    type: MovementType
    batchId: string
    quantity: number
    unitPrice?: number
    referenceId?: string | null    // ID заказа/наряда/продажи
    referenceType?: string | null  // "sale" | "purchase_order" | "work_order" | "waste_report" | "cutting"
    fromLocation?: string | null
    toLocation?: string | null
    performedBy?: string | null
    notes?: string | null
    movedAt?: string               // ISO, default: now
  }
  ```
- **Response 200:** `ApiResponse<WarehouseMovement>` — созданное движение целиком.
- **Notes:** Сервер должен пересчитать остатки партии (`quantityRemaining`, `quantity`, `totalCost`) в соответствии с типом движения (см. таблицу ниже) и обновить `status` партии.

**Логика пересчёта остатков (бэкенд):**

| Movement Type | `batch.quantityRemaining` | `batch.quantity` | `batch.totalCost` |
|---|---|---|---|
| `receipt` | `+= quantity` | `+= quantity` | `+= quantity × unitPrice` |
| `sale`, `expense`, `write-off`, `production`, `storage`, `return-to-supplier` | `-= quantity` (min 0) | без изменений | без изменений |
| `return` | `+= quantity` | без изменений | без изменений |
| `correction` (receipt) | `= quantity` | `+= (new - old) remainder` | без изменений |
| `correction` (non-receipt) | без изменений | `+= delta` | `+= delta × unitPrice` |

**Логика определения статуса партии (бэкенд):**

```
1. receipt > 0 AND нет других агрегатов → 'available'
2. receipt > 0 AND есть другие агрегаты → 'partial'
3. receipt = 0 AND ровно один другой агрегат → маппинг:
   storage → 'in_storage', production → 'in_production',
   sale → 'sold', write-off → 'scrapped',
   expense → 'expensed', return-to-supplier → 'returned_to_supplier'
4. receipt = 0 AND несколько/ноль агрегатов → 'depleted'
```

---

## Обрезки партии (Batch Offcuts)

Используется в `WarehouseBatchCard.vue` для таблицы обрезков, привязанных к партии.

### GET /api/warehouse/offcuts

- **Когда:** загрузка карточки партии (`loadOffcuts()`).
- **Query:**
  ```ts
  {
    search?: string
    productId?: string
    status?: string
    unit?: string
    offcutType?: string      // "sheet" | "linear"
    categoryIds?: string
    batchNumber?: string     // фильтр по номеру партии (основной для карточки партии)
    sortBy?: string          // "createdAt" | "productName" | "quantity" (default: "createdAt")
    sortDir?: string         // "asc" | "desc" (default: "desc")
    page: string
    pageSize: string
  }
  ```
- **Response 200:** `PaginatedResponse<OffcutListItem>`

---

## Аудит партии (Batch Audit)

### GET /api/warehouse/batches/:id/audit

- **Когда:** загрузка карточки партии (`loadAudit()`).
- **Response 200:** `ApiResponse<StockAuditEntry[]>`
  ```json
  {
    "success": true,
    "data": [
      {
        "timestamp": "17.04.2026 14:32",
        "user": { "ru": "Иван Петров", "en": "Ivan Petrov", "lt": "Ivan Petrov" },
        "userInitials": "ИП",
        "property": { "ru": "Статус", "en": "Status", "lt": "Būsena" },
        "oldValue": "available",
        "newValue": "partial"
      }
    ]
  }
  ```
- **Notes:** `timestamp` — локальный формат `dd.mm.yyyy hh:mm`. Значения `oldValue`/`newValue` могут содержать enum-коды (с префиксами `batch_status_`, `movement_type_`, `offcut_status_`), которые клиент переводит через `translateAuditValue()`.

### DELETE /api/warehouse/batches/:id/audit/:entryIndex

(Документирован выше, в разделе "Карточка партии")

---

## Save UX — Warehouse Batch Card

**Clean-slate** (как SupplierCardPage, ProductCardPage):

- `useDirtyCheck` для полей: `batchNumber`, `lotCode`, `unitPrice`, `currency`, `locationRack`, `locationRow`, `locationCell`, `locationNotes`, `certificateRef`, `notes`, `status`
- Save bar при `isAnythingDirty || fileIdsToAttach.length > 0 || files удалены`
- Save = `PATCH /api/warehouse/batches/:id` с dirty-only delta + `fileIds[]` (если есть незагруженные файлы)
- После Save: если `location` изменился → `POST /api/warehouse/movements` с `type=transfer`
- Discard = сброс формы до состояния `batch.value` (последний ответ с сервера)
- Reload страницы = rollback к последнему сохранённому состоянию

## Feature Flags — Warehouse

| Флаг | Уровень | Что скрывает |
|---|---|---|
| `adminWarehouse` | page-level | весь роут `/admin/warehouse` и все подстраницы |

→ Implementation:
- Service: `src/services/warehouseService.ts`
- Mock: `src/services/mocks/warehouse.ts`
- Composables: `src/composables/useWarehouseBatch.ts`, `src/composables/useWarehouseOffcutsAndDeficit.ts`, `src/composables/useWarehouseStock.ts`
- Views: `src/views/admin/warehouse/WarehousePage.vue`, `src/views/admin/warehouse/WarehouseBatchCard.vue`, `src/views/admin/warehouse/WarehouseMovementCard.vue`, `src/views/admin/warehouse/WarehouseOffcutCard.vue`, `src/views/admin/warehouse/CreateMovementModal.vue`, `src/views/admin/warehouse/StockCardPage.vue`, `src/views/admin/warehouse/DeficitCardPage.vue`
- E2E: `tests/e2e/admin/warehouse/warehouse.spec.ts`

---

# Admin — Finance

Управление платежами (входящими/исходящими) и архивом документов.

Pages: `IncomingPaymentsPage.vue`, `OutgoingPaymentsPage.vue`, `DocumentArchivePage.vue`, `IncomingPaymentCardPage.vue`, `OutgoingPaymentCardPage.vue`.
Service: [`financeService.ts`](frontend_vue/src/services/financeService.ts).
Mock: [`mocks/finance.ts`](frontend_vue/src/services/mocks/finance.ts).

Типы из [`types/finance.ts`](frontend_vue/src/types/finance.ts):
- `PaymentDirection` = `'incoming' | 'outgoing'`
- `PaymentStatus` = `'pending' | 'completed' | 'overdue' | 'cancelled'`
- `PaymentDocument` — файл, прикреплённый к платежу (`id`, `name`, `fileId`, `url`, `size`, `mime`, `uploadedAt`)
- `FinancePayment` — полная карточка платежа
- `FinancePaymentListItem` — строка списка платежей (без documents, notes)
- `FinancePaymentFilters` — параметры фильтрации
- `ArchiveDocumentType` = `'invoice' | 'facture' | 'waybill' | 'cmr' | 'other'`
- `FinanceDocumentArchiveItem` — строка архива документов

### Коды ошибок (специфичные для домена)

- `PAYMENT_NOT_FOUND` — 404
- `DOCUMENT_NOT_FOUND` — 404
- `VALIDATION_ERROR` — 422

---

## Список платежей

### GET /api/finance/payments

- **Когда:** загрузка `IncomingPaymentsPage` / `OutgoingPaymentsPage` (`onMounted`), изменение search/status фильтра (debounce 300 мс), смена page/pageSize.
- **Query:**
  ```ts
  {
    direction: 'incoming' | 'outgoing' | 'all'
    search?: string         // по paymentNumber, counterpartyName, orderNumber (LIKE)
    status?: PaymentStatus | 'all'
    counterpartyId?: string
    dateFrom?: string       // ISO
    dateTo?: string         // ISO
    page: string            // "1"
    pageSize: string        // "25" | "50" | "100"
  }
  ```
- **Response 200:** `PaginatedResponse<FinancePaymentListItem>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "pay-in-1",
          "paymentNumber": "PAY-2026-001",
          "direction": "incoming",
          "status": "pending",
          "amount": 5000.00,
          "currency": "EUR",
          "counterpartyName": "UAB Metalica",
          "orderNumber": "ORD-2026-001",
          "supplierInvoiceRef": null,
          "dueDate": "2026-06-01T00:00:00Z",
          "paidAt": null,
          "documentCount": 2
        }
      ],
      "total": 87, "page": 1, "pageSize": 25, "totalPages": 4
    }
  }
  ```
- **Notes:** Сортировка фиксированная — `dueDate ASC` (ближайшие сверху) или `createdAt DESC` (на усмотрение бэкенда). Пагинация обязательна.

---

## Карточка платежа

### GET /api/finance/payments/:id

- **Когда:** `onMounted` карточки платежа (`IncomingPaymentCardPage`, `OutgoingPaymentCardPage`).
- **Response 200:** `FinancePayment` (включая `documents[]`, `notes`).
  ```json
  {
    "success": true,
    "data": {
      "id": "pay-in-1",
      "paymentNumber": "PAY-2026-001",
      "direction": "incoming",
      "status": "pending",
      "amount": 5000.00,
      "currency": "EUR",
      "counterpartyId": "CL-001",
      "counterpartyName": "UAB Metalica",
      "counterpartyVatCode": "LT304567890",
      "orderId": "ORD-001",
      "orderNumber": "ORD-2026-001",
      "supplierInvoiceRef": null,
      "description": "Payment for order ORD-2026-001",
      "dueDate": "2026-06-01T00:00:00Z",
      "paidAt": null,
      "documents": [
        {
          "id": "pdoc-1",
          "name": "Invoice #INV-2026-001",
          "fileId": "file-abc123",
          "url": "/uploads/file-abc123/preview",
          "size": 102400,
          "mime": "application/pdf",
          "uploadedAt": "2026-05-15T10:00:00Z"
        }
      ],
      "notes": "Client confirmed payment via bank transfer.",
      "createdAt": "2026-04-17T08:00:00Z",
      "updatedAt": "2026-04-17T08:00:00Z"
    }
  }
  ```
- **Notes:** 404 `PAYMENT_NOT_FOUND`. Поля read-only на карточке: все, кроме `notes`. Документы управляются через `fileIds` (см. Общие соглашения — «Файлы и аплоады»).

### PATCH /api/finance/payments/:id

- **Когда:** клик Save на карточке платежа (`saveChanges()`), только если `isDirty`.
- **Body:** dirty-only delta:
  ```ts
  {
    notes?: string | null      // заметки (единственное редактируемое поле)
    fileIds?: string[]         // полный актуальный массив fileId документов (replace-семантика)
  }
  ```
- **Response 200:** `FinancePayment` — обновлённый объект целиком (с пересчитанными `documents`).
- **Example:**
  ```http
  PATCH /api/finance/payments/pay-in-1
  Content-Type: application/json

  {
    "notes": "Updated: payment received 01.06.2026",
    "fileIds": ["file-abc123", "file-def456"]
  }
  ```
- **Notes:**
  - `notes` — единственное текстовое редактируемое поле (clean-slate, см. Save UX).
  - `fileIds` — replace-семантика для массива: сервер находит draft-файлы по новым ID (через `POST /api/uploads`), привязывает их; удаляет документы, чьи fileId отсутствуют в массиве.
  - Last-write-wins.

---

## Архив документов

### GET /api/finance/archive

- **Когда:** загрузка `DocumentArchivePage` (`onMounted`), изменение search/type/entity фильтров (debounce 300 мс для search), смена page/pageSize.
- **Query:**
  ```ts
  {
    search?: string                 // по name, relatedEntityNumber (LIKE)
    type?: ArchiveDocumentType | 'all'
    relatedEntityType?: 'order' | 'payment' | 'supplier' | 'client' | 'all'
    page: string                    // "1"
    pageSize: string                // "25" | "50" | "100"
  }
  ```
- **Response 200:** `PaginatedResponse<FinanceDocumentArchiveItem>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "arch-1",
          "name": "Invoice #INV-2026-001",
          "type": "invoice",
          "fileId": "file-arch-0",
          "url": "/uploads/file-arch-0/preview",
          "size": 102400,
          "mime": "application/pdf",
          "relatedEntityType": "order",
          "relatedEntityId": "order-0",
          "relatedEntityNumber": "ORD-2026-001",
          "uploadedAt": "2026-05-15T10:00:00Z",
          "uploadedBy": "Maxim V."
        }
      ],
      "total": 15, "page": 1, "pageSize": 25, "totalPages": 1
    }
  }
  ```
- **Notes:** Архив — read-only просмотр документов, привязанных ко всем сущностям системы. Сортировка по `uploadedAt DESC`. Ссылка на скачивание — `doc.url` (временный/preview URL).

---

## Save UX — Finance

**Payment list pages** (`IncomingPaymentsPage`, `OutgoingPaymentsPage`) — read-only с серверной фильтрацией (search debounce 300 мс, статус). Никаких мутаций.

**Document Archive** (`DocumentArchivePage`) — read-only с серверной фильтрацией.

**Payment card pages** (`IncomingPaymentCardPage`, `OutgoingPaymentCardPage`) — **clean-slate** (как SupplierCardPage, см. «Save UX / Clean-slate»):

- Локальный state: `notesDraft`, `payment.value.documents` (модифицируется in-place при add/delete)
- Save bar при `isDirty` (notesChanged || filesChanged)
- Save = один `PATCH /api/finance/payments/:id` с `{ notes, fileIds }`
  - `fileIds` вычисляется как `payment.value.documents.map(d => d.fileId)` — полный актуальный массив
- Discard = `load()` (перезагрузка с сервера, локальные изменения сбрасываются)
- Файлы: drag-drop через `DropZone` → `POST /api/uploads` (через `uploadsService`) → получает `UploadedFile` с `fileId` → добавляет в `payment.value.documents` → при Save `fileIds[]` уходит в PATCH
- Удаление файла: удаляется из `payment.value.documents` локально → при Save отсутствие fileId в массиве = сервер удаляет документ

---

## Feature Flags — Finance

| Флаг | Уровень | Что скрывает |
|------|---------|--------------|
| `adminFinance` | page-level | мастер-флаг всего раздела |
| `financeIncoming` | page-level | роут `/admin/finance/incoming` и `/admin/finance/incoming/:id` |
| `financeOutgoing` | page-level | роут `/admin/finance/outgoing` и `/admin/finance/outgoing/:id` |
| `financeDocumentArchive` | page-level | роут `/admin/finance/archive` |

→ Implementation:
- Service: `src/services/financeService.ts`
- Mock: `src/services/mocks/finance.ts`
- Views: `src/views/admin/finance/IncomingPaymentsPage.vue`, `src/views/admin/finance/OutgoingPaymentsPage.vue`, `src/views/admin/finance/DocumentArchivePage.vue`, `src/views/admin/finance/IncomingPaymentCardPage.vue`, `src/views/admin/finance/OutgoingPaymentCardPage.vue`
- i18n: `src/i18n/admin/finance.ts`

---

# Admin — Settings

Управление настройками системы: реквизиты компании, финансовые константы, валюты, единицы измерения, правила пересчёта, статусы заказов и профиль пользователя.

Pages: `SettingsLayout.vue` (роутер-лейаут) + `ProfileSettings.vue`, `CompanySettings.vue`, `FinanceSettings.vue`, `UnitsSettings.vue`, `OrderStatusesSettings.vue`.

Service: [`settingsService.ts`](frontend_vue/src/services/settingsService.ts).
Mock: [`mocks/settings.ts`](frontend_vue/src/services/mocks/settings.ts).
Composable: [`useSettings.ts`](frontend_vue/src/composables/useSettings.ts).

Типы из [`types/settings.ts`](frontend_vue/src/types/settings.ts):
- `CompanyInfo` — реквизиты компании (name, legalAddress, vatCode, bankName, bankAccount, logoUrl?)
- `GlobalConstants` — финансовые константы (vatRate, defaultMargin, defaultCurrency, defaultDiscountPercent)
- `Currency` — валюта (id, code, name: TranslatedString, exchangeRate, isDefault)
- `Uom` — единица измерения (id, code: TranslatedString, name: TranslatedString, category: UomCategory)
- `UomConversion` — правило пересчёта (id, fromUomId, toUomId, type: ConversionType, factor?, formulaType?)
- `OrderStatusSetting` — статус заказа (id, name: TranslatedString, color, order, system?, reserveOnTransition?, writeOffOnTransition?)
- `UserProfile` — профиль пользователя (firstName, lastName, email, phone, role)
- `AppSettings` — полный срез настроек (агрегирует все выше)

### Коды ошибок (специфичные для домена)

- `COMPANY_NOT_FOUND` — 404
- `CURRENCY_NOT_FOUND` — 404
- `UOM_NOT_FOUND` — 404
- `CONVERSION_NOT_FOUND` — 404
- `ORDER_STATUS_NOT_FOUND` — 404
- `VALIDATION_ERROR` — 422
- `INVALID_PASSWORD` — 422, текущий пароль неверен

### Update pattern

В Settings используются два подхода к мутации:

| Тип секции | Метод | Семантика |
|-----------|-------|-----------|
| Простые секции (company, constants, profile) | `PATCH` | Merge-обновление. Клиент шлёт только изменённые поля (`Partial<T>`). Сервер merge'ит поверх текущего состояния |
| Коллекции (currencies, uoms, conversions, order-statuses) | `POST` / `PATCH` / `DELETE` | CRUD отдельных элементов коллекции |
| Reorder статусов | `PUT` | Полный массив `orderedIds` для атомарной перестановки |

### Сохранение (Save UX)

Settings использует **гибридный подход**:

1. **Простые секции** (company, constants, profile) — **clean-slate**: пользователь редактирует локально, Save собирает dirty-секции и шлёт PATCH для каждой.
2. **Коллекции** (currencies, uoms, conversions, order-statuses) — **diff-based**: на Save клиент вычисляет добавленные/удалённые/изменённые элементы и шлёт соответствующие `POST`/`DELETE`/`PATCH` запросы.

Локальное состояние управляется [`useSettings.ts`](frontend_vue/src/composables/useSettings.ts) через снепшот-диффинг: после каждого load/save фиксируется снепшот, на Save сравнивается текущее состояние со снепшотом.

---

## Компания (Company)

Page: `CompanySettings.vue` (таб `/admin/settings/company`).

### GET /api/settings/company

- **Когда:** загрузка таба Settings, `useSettings.load()`.
- **Response 200:** `CompanyInfo`
  ```json
  {
    "success": true,
    "data": {
      "name": "Flexiron UAB",
      "legalAddress": "Verkių g. 25, Vilnius, Lietuva",
      "vatCode": "LT123456789",
      "bankName": "Swedbank",
      "bankAccount": "LT12 7300 0100 1234 5678",
      "logoUrl": "https://cdn.example.com/logo.png"
    }
  }
  ```
- **Notes:** `logoUrl` — опциональное поле. Хранит URL загруженного через `POST /api/uploads` логотипа.

### PATCH /api/settings/company

- **Когда:** клик Save при наличии изменений в company-секции.
- **Body:** dirty-only поля:
  ```ts
  {
    name?: string
    legalAddress?: string
    vatCode?: string
    bankName?: string
    bankAccount?: string
    logoUrl?: string   // URL от POST /api/uploads
  }
  ```
- **Response 200:** `CompanyInfo` — полный объект после merge.
- **Notes:** `logoUrl` обновляется через `POST /api/uploads` → получает URL → сохраняет в company. Клиент **не** шлёт base64.

---

## Финансовые константы (Constants)

Page: `FinanceSettings.vue` (таб `/admin/settings/finance`).

### GET /api/settings/constants

- **Когда:** загрузка таба Settings.
- **Response 200:** `GlobalConstants`
  ```json
  {
    "success": true,
    "data": {
      "vatRate": 21,
      "defaultMargin": 15,
      "defaultCurrency": "EUR",
      "defaultDiscountPercent": 0
    }
  }
  ```

### PATCH /api/settings/constants

- **Когда:** клик Save при наличии изменений в constants-секции.
- **Body:** dirty-only поля:
  ```ts
  {
    vatRate?: number
    defaultMargin?: number
    defaultCurrency?: string
    defaultDiscountPercent?: number
  }
  ```
- **Response 200:** `GlobalConstants` — полный объект после merge.
- **Notes:** `defaultCurrency` — код валюты (например, `EUR`, `USD`). Должен соответствовать одной из валют в `/api/settings/currencies`.

---

## Валюты (Currencies)

Section внутри `FinanceSettings.vue`.

### GET /api/settings/currencies

- **Когда:** загрузка таба Settings.
- **Response 200:** `Currency[]`
  ```json
  {
    "success": true,
    "data": [
      { "id": "cur-eur", "code": "EUR", "name": { "ru": "Евро", "en": "Euro", "lt": "Euras" }, "exchangeRate": 1, "isDefault": true },
      { "id": "cur-usd", "code": "USD", "name": { "ru": "Доллар США", "en": "US Dollar", "lt": "JAV doleris" }, "exchangeRate": 1.08, "isDefault": false }
    ]
  }
  ```

### POST /api/settings/currencies

- **Когда:** submit модала "Add currency".
- **Body:** `Omit<Currency, 'id'>` — данные без id (сервер генерирует):
  ```ts
  {
    code: string
    name: TranslatedString
    exchangeRate: number
    isDefault: boolean
  }
  ```
- **Response 200:** `Currency` — созданная валюта с серверным `id`.
  ```json
  {
    "success": true,
    "data": {
      "id": "cur-11",
      "code": "GBP",
      "name": { "ru": "Фунт стерлингов", "en": "British Pound", "lt": "Svaras sterlingų" },
      "exchangeRate": 0.86,
      "isDefault": false
    }
  }
  ```
- **Notes:** Клиент шлёт данные **без** поля `id`. Сервер генерирует `id` (формат `cur-{N}` — инкрементальный). 422 если `code` пустой или дублируется.

### PATCH /api/settings/currencies/:id

- **Когда:** изменение курса валюты (inline edit в таблице), переключение default.
- **Body:** `Partial<Currency>` (merge patch):
  ```ts
  {
    exchangeRate?: number
    isDefault?: boolean
  }
  ```
- **Response 200:** `void`.
- **Notes:** `code` и `name` обычно не редактируются через PATCH. Для смены `isDefault` клиент устанавливает `isDefault: true` у одной валюты (другие автоматически сбрасываются на клиенте).

### DELETE /api/settings/currencies/:id

- **Когда:** клик Delete для не-default валюты.
- **Response 200:** `void`.
- **Notes:** 422 если попытка удалить валюту, установленную как `defaultCurrency` в константах. Нельзя удалить валюту с `isDefault: true`.

---

## Единицы измерения (UOMs)

Page: `UnitsSettings.vue` (таб `/admin/settings/units`).

### GET /api/settings/uoms

- **Когда:** загрузка таба Settings.
- **Response 200:** `Uom[]`
  ```json
  {
    "success": true,
    "data": [
      { "id": "uom-t", "code": { "ru": "т", "en": "t", "lt": "t" }, "name": { "ru": "Тонна", "en": "Tonne", "lt": "Tona" }, "category": "weight" },
      { "id": "uom-m", "code": { "ru": "м", "en": "m", "lt": "m" }, "name": { "ru": "Метр", "en": "Meter", "lt": "Metras" }, "category": "length" }
    ]
  }
  ```

### POST /api/settings/uoms

- **Когда:** submit модала "Add unit of measure".
- **Body:** `Omit<Uom, 'id'>`:
  ```ts
  {
    code: TranslatedString
    name: TranslatedString
    category: UomCategory   // 'weight' | 'length' | 'area' | 'volume' | 'quantity' | 'density' | 'thickness'
  }
  ```
- **Response 200:** `Uom` — созданная единица с серверным `id`.
  ```json
  {
    "success": true,
    "data": {
      "id": "uom-11",
      "code": { "ru": "см", "en": "cm", "lt": "cm" },
      "name": { "ru": "Сантиметр", "en": "Centimeter", "lt": "Centimetras" },
      "category": "length"
    }
  }
  ```
- **Notes:** Клиент шлёт без `id`. Сервер генерирует `id` (формат `uom-{N}`).

### PATCH /api/settings/uoms/:id

- **Когда:** редактирование существующей единицы измерения (будущий UI — inline rename).
- **Body:** `Partial<Uom>`:
  ```ts
  {
    code?: TranslatedString
    name?: TranslatedString
    category?: UomCategory
  }
  ```
- **Response 200:** `void`.
- **Notes:** `category` менять можно (с осторожностью — может затронуть существующие товары).

### DELETE /api/settings/uoms/:id

- **Когда:** клик Delete для единицы измерения.
- **Response 200:** `void`.
- **Notes:** 409 если UOM используется в товарах, правилах пересчёта или заказах.

---

## Правила пересчёта (Conversions)

Section внутри `UnitsSettings.vue`.

### GET /api/settings/conversions

- **Когда:** загрузка таба Settings.
- **Response 200:** `UomConversion[]`
  ```json
  {
    "success": true,
    "data": [
      { "id": "conv-ton-kg", "fromUomId": "uom-t", "toUomId": "uom-kg", "type": "static", "factor": 1000 },
      { "id": "conv-m-kg", "fromUomId": "uom-m", "toUomId": "uom-kg", "type": "dynamic", "formulaType": "weight_per_meter" }
    ]
  }
  ```

### POST /api/settings/conversions

- **Когда:** submit модала "Add conversion rule".
- **Body:** `Omit<UomConversion, 'id'>`:
  ```ts
  {
    fromUomId: string
    toUomId: string
    type: ConversionType               // 'static' | 'dynamic'
    factor?: number                     // required if type === 'static'
    formulaType?: ConversionFormulaType // required if type === 'dynamic'
  }
  ```
- **Response 200:** `UomConversion` — созданное правило с серверным `id`.
- **Notes:** 422 если `fromUomId === toUomId`. 409 если правило между теми же UOM уже существует.

### PATCH /api/settings/conversions/:id

- **Когда:** изменение factor у static-правила (inline edit).
- **Body:** `Partial<UomConversion>`:
  ```ts
  {
    factor?: number
    type?: ConversionType
    formulaType?: ConversionFormulaType
  }
  ```
- **Response 200:** `void`.

### DELETE /api/settings/conversions/:id

- **Когда:** клик Delete для правила пересчёта.
- **Response 200:** `void`.

---

## Статусы заказов (Order Statuses)

Page: `OrderStatusesSettings.vue` (таб `/admin/settings/order-statuses`).

### GET /api/settings/order-statuses

- **Когда:** загрузка таба Settings.
- **Response 200:** `OrderStatusSetting[]`
  ```json
  {
    "success": true,
    "data": [
      { "id": "st-new", "name": { "ru": "Новый", "en": "New", "lt": "Naujas" }, "color": "#6B7280", "order": 0, "system": true, "reserveOnTransition": false, "writeOffOnTransition": false },
      { "id": "st-paid", "name": { "ru": "Оплачен", "en": "Paid", "lt": "Apmokėtas" }, "color": "#047857", "order": 6, "system": true, "reserveOnTransition": false, "writeOffOnTransition": false }
    ]
  }
  ```
- **Notes:** `system: true` — системный статус, нельзя удалить. `order` — порядок сортировки (0-based).

### POST /api/settings/order-statuses

- **Когда:** submit модала "Add status".
- **Body:** `Omit<OrderStatusSetting, 'id'>`:
  ```ts
  {
    name: TranslatedString
    color: string                     // HEX (#RRGGBB)
    order: number
    system?: boolean                  // default: false
    reserveOnTransition?: boolean     // default: false
    writeOffOnTransition?: boolean    // default: false
  }
  ```
- **Response 200:** `OrderStatusSetting` — созданный статус с серверным `id`.
  ```json
  {
    "success": true,
    "data": {
      "id": "st-11",
      "name": { "ru": "В обработке", "en": "Processing", "lt": "Apdorojamas" },
      "color": "#F59E0B",
      "order": 8,
      "system": false,
      "reserveOnTransition": false,
      "writeOffOnTransition": false
    }
  }
  ```
- **Notes:** `system` всегда `false` для пользовательских статусов.

### PATCH /api/settings/order-statuses/:id

- **Когда:** изменение названия, цвета или warehouse-флагов статуса.
- **Body:** `Partial<OrderStatusSetting>`:
  ```ts
  {
    name?: TranslatedString
    color?: string
    reserveOnTransition?: boolean
    writeOffOnTransition?: boolean
  }
  ```
- **Response 200:** `void`.
- **Notes:** `order` изменяется через reorder (см. ниже). `system` иммутабельно. Цвет — HEX `#RRGGBB` (с решёткой).

### PUT /api/settings/order-statuses/reorder

- **Когда:** drag-and-drop перестановка статусов (изменение `order` у нескольких статусов).
- **Body:**
  ```ts
  {
    orderedIds: string[]  // полный упорядоченный массив id статусов
  }
  ```
- **Response 200:** `void`.
- **Notes:** Атомарная перезапись порядка. Клиент шлёт полный массив `orderedIds` в новом порядке. Сервер пересчитывает `order` по индексу в массиве.

### DELETE /api/settings/order-statuses/:id

- **Когда:** клик Delete для не-system статуса.
- **Response 200:** `void`.
- **Notes:** 403 если `system: true`. 409 если статус используется в заказах.

---

## Профиль пользователя (Profile)

Page: `ProfileSettings.vue` (таб `/admin/settings/profile`).

### GET /api/settings/profile

- **Когда:** загрузка таба Settings.
- **Response 200:** `UserProfile`
  ```json
  {
    "success": true,
    "data": {
      "firstName": "Mindaugas",
      "lastName": "Volkovas",
      "email": "admin@flexiron.com",
      "phone": "+37060000000",
      "role": "admin"
    }
  }
  ```

### PATCH /api/settings/profile

- **Когда:** клик Save при наличии изменений в profile-секции.
- **Body:** dirty-only поля:
  ```ts
  {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  ```
- **Response 200:** `UserProfile` — полный объект после merge.

### POST /api/settings/change-password

- **Когда:** submit формы смены пароля в `ProfileSettings`.
- **Body:**
  ```ts
  {
    currentPassword: string
    newPassword: string
    confirmPassword: string
  }
  ```
- **Response 200:** `{ success: true }`.
- **Notes:**
  - 422 `INVALID_PASSWORD` если `currentPassword` неверен.
  - 422 `VALIDATION_ERROR` если `newPassword.length < 6` или `newPassword !== confirmPassword`.
  - Rate-limit: 3 попытки/min/IP.
  - Сервер НЕ возвращает данные пользователя — только статус.

---

## Save UX — Settings

Settings работает по **local-first** принципу (см. «Save UX / Clean-slate»):

- **Local state:** весь `AppSettings` живёт в реактивном state [`useSettings.ts`](frontend_vue/src/composables/useSettings.ts).
- **Snapshot:** после каждого load/save фиксируется снепшот для diff-детекции.
- **Dirty tracking:** каждая секция отслеживается отдельно через `dirtySections Set`.
- **Save = granular:** на Save клиент итерирует dirty-секции и для каждой вызывает соответствующий endpoint:
  - Простые секции (`company`, `constants`, `profile`) → PATCH с dirty-полями
  - Коллекции (`currencies`, `uoms`, `conversions`, `order-statuses`) → diff против снепшота → POST созданий + PATCH изменений + DELETE удалений
- **Reorder статусов:** при изменении порядка (drag-and-drop) шлётся `PUT /api/settings/order-statuses/reorder` с полным `orderedIds`.
- **Discard:** сброс локального state до последнего снепшота.
- **Локализация:** мультилокалевые поля (`TranslatedString`) передаются во всех трёх локалях (ru, en, lt) всегда.

---

## Feature Flags — Settings

| Флаг | Уровень | Что скрывает |
|------|---------|--------------|
| `adminSettings` | page-level | весь роут `/admin/settings` |

→ Implementation:
- Service: `src/services/settingsService.ts`
- Mock: `src/services/mocks/settings.ts`
- Composable: `src/composables/useSettings.ts`
- Views: `src/views/admin/settings/SettingsLayout.vue`, `ProfileSettings.vue`, `CompanySettings.vue`, `FinanceSettings.vue`, `UnitsSettings.vue`, `OrderStatusesSettings.vue`
- i18n: `src/i18n/admin/settings.ts`

---

# Admin — Notifications

Управление системными уведомлениями: просмотр, фильтрация, отметка о прочтении. Уведомления генерируются сервером при событиях (изменение статуса заказа, дефицит склада, ответ поставщика, приёмка партии, истечение резерва, просрочка/поступление оплаты, подготовка склада).

Pages: `NotificationsPage.vue` (полный список), `NotificationDropdown.vue` (дропдаун в хедере — топ-5 уведомлений).

Types from [`types/notifications.ts`](frontend_vue/src/types/notifications.ts):
- `NotificationType` = `'order_status' | 'stock_deficit' | 'supplier_response' | 'batch_received' | 'reserve_expiring' | 'payment_overdue' | 'payment_received' | 'warehouse_ready'`
- `NotificationEntityType` = `'order' | 'product' | 'batch' | 'client' | 'supplier'`
- `Notification` — полная модель уведомления (см. ниже)
- `NotificationFilters` — параметры фильтрации

### Модель уведомления

```ts
interface Notification {
  id: string
  type: NotificationType
  title: TranslatedString       // заголовок уведомления
  message: TranslatedString     // текст уведомления
  entityType: NotificationEntityType  // тип связанной сущности
  entityId: string              // ID связанной сущности
  entityRouteName: string       // Vue Router name для перехода (генерируется фронтом)
  isRead: boolean               // прочитано / не прочитано
  createdAt: string             // ISO 8601
}
```

### Pagination

Используется общий `PaginatedResponse<T>` (см. Общие соглашения). Параметры в query: `?page=1&pageSize=25`.

### Коды ошибок (специфичные для домена)

- `NOTIFICATION_NOT_FOUND` — 404, уведомление не найдено

---

## Список уведомлений

### GET /api/notifications

- **Когда:** загрузка `NotificationsPage.vue` (`onMounted` → `load()` из `useNotifications`), изменение любого фильтра, смена page/pageSize.
- **Query:**
  ```ts
  {
    page: string          // "1"
    pageSize: string      // "25" | "50" | "100"
    search?: string       // поиск по message/text (ILIKE по всем локалям)
    type?: string         // NotificationType | 'all' (default: 'all')
    isRead?: string       // "true" | "false" | "" (пустая строка = все)
    sortBy?: string       // "createdAt" | "type" (default: "createdAt")
    sortDir?: string      // "asc" | "desc" (default: "desc")
  }
  ```
- **Response 200:** `PaginatedResponse<Notification>`
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "notif-001",
          "type": "order_status",
          "title": { "ru": "Статус заказа изменён", "en": "Order status changed", "lt": "Užsakymo būsena pakeista" },
          "message": {
            "ru": "Заказ ORD-001 перешёл в статус «В пути»",
            "en": "Order ORD-001 has moved to \"In Transit\"",
            "lt": "Užsakymas ORD-001 perėjo į \"Kelyje\" būseną"
          },
          "entityType": "order",
          "entityId": "ORD-001",
          "entityRouteName": "admin-order-card",
          "isRead": false,
          "createdAt": "2026-06-11T16:34:44Z"
        }
      ],
      "total": 18,
      "page": 1,
      "pageSize": 25,
      "totalPages": 1
    }
  }
  ```
- **Notes:**
  - Сортировка по умолчанию `createdAt DESC` (сначала новые).
  - `search` — фильтр по `message.ru`, `message.en`, `message.lt`, `title.ru`, `title.en`, `title.lt` (ILIKE).
  - `isRead`: пустая строка = все, `"true"` = только прочитанные, `"false"` = только непрочитанные.
  - `entityRouteName` генерируется клиентом на основе `entityType` — сервер его не хранит (или хранит как опциональное поле). Клиент использует готовый маппинг.

### GET /api/notifications/unread-count

- **Когда:** `onMounted` / polling (каждые 30 с) в `NotificationDropdown.vue` и `useNotifications`.
- **Query:** нет.
- **Response 200:** `number` (без `ApiResponse`-обёртки? Формат уточнить)
  ```json
  {
    "success": true,
    "data": 5
  }
  ```
- **Notes:**
  - Возвращает количество непрочитанных уведомлений для текущего пользователя.
  - Клиент опрашивает этот endpoint раз в 30 секунд для обновления бейджа в хедере.
  - Лёгкий endpoint — минимум нагрузки, без пагинации и фильтров.

---

## Мутации (отметка о прочтении)

### PATCH /api/notifications/:id/read

- **Когда:** клик по уведомлению (в списке или дропдауне) → отметить как прочитанное + переход к сущности.
- **Body:** пусто `{}`.
- **Response 200:** `void` (`{ success: true }`).
- **Notes:**
  - 404 `NOTIFICATION_NOT_FOUND` если `id` не существует.
  - Идемпотентно: повторный PATCH с тем же ID — no-op.
  - Клиент после успеха декрементирует локальный `unreadCount`.

### PATCH /api/notifications/read-all

- **Когда:** клик "Прочитать всё" в `NotificationsPage.vue` или `NotificationDropdown.vue`.
- **Body:** пусто `{}`.
- **Response 200:** `void` (`{ success: true }`).
- **Notes:**
  - Отмечает все уведомления текущего пользователя как прочитанные.
  - Идемпотентно.
  - Клиент сбрасывает `unreadCount` в 0 и обновляет `items` (`isRead: true`).

---

## Save UX — Notifications

**Notifications** — **read-only + quick actions**:

- **NotificationsPage** — read-only список с серверной фильтрацией (search debounce 300 мс, тип, статус, сортировка). Единственное действие — `markAllAsRead` (quick action, применяется сразу).
- **NotificationDropdown** — read-only превью топ-5. Действия: mark single as read (при клике), markAllAsRead (через кнопку в футере).
- **Polling:** `unreadCount` опрашивается каждые 30 секунд (module-level interval в `useNotifications`).
- **Никаких форм редактирования, clean-slate не применим.**

## Feature Flags — Notifications

| Флаг | Уровень | Что скрывает |
|------|---------|--------------|
| `notificationsPage` | page-level | весь роут `/admin/notifications` |

→ Implementation:
- Service: [`notificationsService.ts`](frontend_vue/src/services/notificationsService.ts)
- Mock: [`mocks/notifications.ts`](frontend_vue/src/services/mocks/notifications.ts)
- Composable: [`composables/useNotifications.ts`](frontend_vue/src/composables/useNotifications.ts)
- Views: [`views/admin/notifications/NotificationsPage.vue`](frontend_vue/src/views/admin/notifications/NotificationsPage.vue), [`components/admin/NotificationDropdown.vue`](frontend_vue/src/components/admin/NotificationDropdown.vue)
- i18n: [`i18n/admin/notifications.ts`](frontend_vue/src/i18n/admin/notifications.ts)
