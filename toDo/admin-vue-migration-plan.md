# Plan: Миграция админки InBox LT на Vue 3

## Context

Публичные страницы `demo/public/` уже перенесены в `frontend_vue/`. Теперь нужно перенести админку — 12 HTML-страниц из `demo/admin/` (источник: `demo/panini/pages/`) в Vue 3 SPA. Кроме миграции нужно: API-слой с моками, feature flags для отключения блоков, Playwright тесты, линтер.

---

## Фаза 0: Инфраструктура

### 0A. CLAUDE.md + Skills + Hooks

Создать ДО любого кода — фундамент для всех последующих фаз.

**Файлы:**
- `frontend_vue/CLAUDE.md` — правила проекта (паттерны, запреты, pitfalls, структура)
- `.claude/skills/migrate-page.md` — навык `/migrate-page`
- `.claude/skills/create-component.md` — навык `/create-component`
- `.claude/skills/verify.md` — навык `/verify`
- `.claude/settings.json` — hook afterWrite для автопроверки TS

### 0B. TypeScript

Новый admin-код на TypeScript. Существующие public страницы (JS) не трогаем.

**Новые файлы:**
- `frontend_vue/tsconfig.json` — `strict: true`, `paths: { "@/*": ["./src/*"], "@assets/*": ["../demo/assets/*"] }`
- `frontend_vue/tsconfig.node.json` — для vite.config
- `frontend_vue/src/types/` — директория с интерфейсами:
  - `api.ts` — общие типы (`ApiResponse<T>`, `PaginatedResponse<T>`)
  - `supplier.ts` — `Supplier`, `SupplierFilters`, `SupplierStatus`
  - `analytics.ts` — `KpiItem`, `AlertItem`, `ChartData`, `AnalyticsPage`
  - `bcc.ts` — `BccCategory`, `BccRecipient`, `BccRequest`
  - `config.ts` — `FieldDefinition`, `SectionConfig`, `PermissionMatrix`
  - `features.ts` — `FeatureFlags` (все флаги как typed keys)

**Изменить:** `package.json` — добавить devDep: `typescript`, `vue-tsc`
**Изменить:** `vite.config.js` → `vite.config.ts`

**Правило:** все новые файлы — `.ts` / `<script setup lang="ts">`. Composables, services, mocks, config — всё типизировано.

### 0C. ESLint + Prettier

**Новые файлы:**
- `frontend_vue/eslint.config.js` — flat config (ESLint 9), `eslint-plugin-vue`, `typescript-eslint`
- `frontend_vue/.prettierrc.json` — `{ "singleQuote": true, "semi": false, "trailingComma": "all" }`

**Изменить:** `package.json` — добавить devDeps: `eslint`, `@eslint/js`, `eslint-plugin-vue`, `typescript-eslint`, `prettier`, `eslint-config-prettier`. Скрипты: `lint`, `format`, `typecheck` (`vue-tsc --noEmit`)

### 0D. Feature Flags

Лёгкая система на основе reactive объекта + localStorage оверрайды.

**Новые файлы:**
- `src/config/featureFlags.ts` — реактивный объект с типизированными флагами (тип `FeatureFlags` из `types/features.ts`)
- `src/composables/useFeatureFlag.ts` — `useFeatureFlag('flagName')` возвращает `computed<boolean>`

**Флаги двух уровней:**
- Страничный: `adminDashboard`, `adminDeficit`, `suppliersList`, `bccRequest`, ...
- Секционный: `dashboardAlerts`, `dashboardCharts`, `supplierKanbanView`, `supplierExport`, `bccHistory`, `permissionsEditor`

**Использование:** `<GlassPanel v-if="showAlerts">` + route guard через `beforeEnter`

### 0E. Playwright

**Новые файлы:**
- `frontend_vue/playwright.config.ts` — baseURL `localhost:5173`, webServer auto-start, 3 браузера
- `frontend_vue/tests/e2e/` — директория тестов

**Изменить:** `package.json` — `@playwright/test`, скрипты `test:e2e`, `test:e2e:ui`

---

## Процесс реализации

### Верификация после каждого шага

После каждого логического шага (компонент, страница, composable) — проверка:
1. `npm run typecheck` — TypeScript без ошибок
2. `npm run lint` — ESLint без ошибок
3. `npm run dev` → открыть в браузере → визуальная проверка
4. Проверить что существующие страницы не сломались (регрессия)
5. Переключить язык (RU/EN/LT) — переводы на месте

Коммиты — вручную, когда будет готово. Автоматических коммитов нет.
Работа последовательная (serial) — безопаснее для 20K строк рефакторинга.

---

## Инструменты Claude Code

### CLAUDE.md — правила проекта

**Файл:** `frontend_vue/CLAUDE.md`

Создать **до начала кода** (Фаза 0). Загружается автоматически в каждую сессию. Содержит:
- Архитектурные принципы (SOLID, DDD, DRY, Vue patterns)
- Запреты (Options API, data-i18n, v-html, DOM manipulation и т.д.)
- Известные pitfalls (@ в переводах, #app flex, overflow, z-index)
- Структуру директорий и именование файлов
- CSS стратегию (core vs component vs page)
- API/mock паттерн
- Feature flags паттерн

### Custom Skills — автоматизация повторяющихся операций

Навыки хранятся в `.claude/skills/*.md`. Вызываются через `/skill-name`.

**Skill 1: `/migrate-page`**
**Файл:** `.claude/skills/migrate-page.md`

Автоматизирует миграцию одной admin-страницы. При вызове `/migrate-page dashboard`:
1. Читает `demo/admin/analytics/dashboard.html` (скомпилированный HTML)
2. Читает `demo/panini/pages/analytics/dashboard.html` (Handlebars-исходник)
3. Читает `demo/assets/js/lang/admin/analytic_dashboard.js` (переводы)
4. Читает `demo/assets/js/admin/*_logic.js` (JS-логика, если есть)
5. Создаёт `src/views/admin/analytics/DashboardPage.vue`:
   - `<script setup lang="ts">` с useI18n, useHead, data composable, feature flags
   - Template: Handlebars → Vue (partials → компоненты, data-i18n → t())
   - CSS import страничного стиля (если есть)
6. Добавляет переводы в `src/i18n/admin.ts` (3 языка, с префиксом страницы)
7. Регистрирует route в `src/router/index.ts`
8. Запускает typecheck + lint

**Skill 2: `/create-component`**
**Файл:** `.claude/skills/create-component.md`

Автоматизирует создание Vue-компонента из Handlebars partial. При вызове `/create-component glass-panel`:
1. Читает `demo/panini/partials/sections/glass-panel.html`
2. Определяет CSS-файл компонента из маппинга
3. Создаёт `src/components/admin/GlassPanel.vue`:
   - `<script setup lang="ts">` с defineProps, defineEmits, slots
   - Template: Handlebars → Vue
   - CSS import из `@assets/css/admin/components/`
4. Запускает typecheck + lint

**Skill 3: `/verify`**
**Файл:** `.claude/skills/verify.md`

Чеклист верификации одной командой. При вызове `/verify`:
1. `vue-tsc --noEmit` — TypeScript
2. `eslint src/` — линтер
3. `mcp__ide__getDiagnostics` — ошибки в IDE
4. Проверяет что dev-server запущен и отвечает
5. Выводит сводку: ОК / список проблем

### Hooks — автопроверка после изменений

**Файл:** `.claude/settings.json` (или `frontend_vue/.claude/settings.json`)

Hook `afterWrite` — после каждого Write/Edit файла `.vue` или `.ts`:
- Запускает `vue-tsc --noEmit` на изменённый файл
- Показывает TS-ошибки немедленно, не дожидаясь ручной проверки

### MCP IDE Diagnostics

Использовать `mcp__ide__getDiagnostics` после создания/изменения компонентов для проверки ошибок в IDE (подсвечивает проблемы которые typecheck может пропустить — например, неправильные props).

---

## Известные подводные камни (из предыдущей миграции)

| Проблема | Решение |
|----------|---------|
| `@` в переводах ломает vue-i18n (`SyntaxError: Invalid linked format`) | Экранировать: `name{'@'}company.com` |
| `#app` разрывает flex-layout (оригинальный CSS рассчитан на flex-children body) | `#app { display: flex; flex-direction: column; min-height: 100vh; }` |
| `html { overflow: hidden }` из erp-base.css обрезает длинные страницы | В App.vue: `html { height: auto !important; overflow: visible !important; }` |
| Vite блокирует файлы за пределами корня (403) | `server.fs.allow` в vite.config.ts включает `demo/assets` |
| Контент без z-index рендерится за bg-overlay | Для admin: bg-image/bg-overlay внутри `.shell`, не в App.vue. Для public: z-index: 10+ на view |
| `taskkill //F //IM node.exe` убивает Claude Code | Никогда не убивать node.exe массово. Останавливать dev-server по PID или Ctrl+C |

---

## Запреты

- **Не** использовать Options API — только Composition API с `<script setup lang="ts">`
- **Не** использовать `data-i18n` атрибуты — это паттерн оригинального engine.js
- **Не** ставить `v-html` без необходимости — только если в переводе есть HTML (`<br>`, `<a>`)
- **Не** оставлять неиспользуемые импорты
- **Не** манипулировать DOM напрямую (`document.querySelector`) — обернуть в composable или ref
- **Не** использовать `<a href>` для навигации — только `<router-link>`
- **Не** копировать CSS в `frontend_vue/` — импортировать оригиналы из `@assets`
- **Не** писать самописные i18n composables — использовать vue-i18n

---

## Архитектурные принципы

### Vue 3 Patterns

- **Composition API** — `<script setup lang="ts">`, composables вместо mixins
- **v-model** — двусторонняя привязка в кастомных компонентах (CustomSelect, TagInput, RatingStars и т.д.) через `defineProps` + `defineEmits('update:modelValue')`
- **provide/inject** — для контекста, который нужен глубоко вложенным компонентам без prop drilling:
  - `AdminLayout` provide → sidebar collapsed state, toast handler
  - Компоненты inject → используют напрямую
- **Slots** — гибкая композиция (GlassPanel: default + header + action slots; AppModal: body + footer slots)
- **Teleport** — модалки и тосты рендерятся в `<body>`, не в DOM-дереве компонента

### SOLID

| Принцип | Как реализуется |
|---|---|
| **S — Single Responsibility** | Один компонент = одна UI-задача (`AppModal` не знает про suppliers). Один composable = один домен (`useSuppliers` не знает про BCC). Один service = один API-домен. |
| **O — Open/Closed** | Компоненты расширяются через slots и props, не через правку исходника. `GlassPanel` принимает любой контент через slot, не нужно менять его код для новой страницы. |
| **L — Liskov Substitution** | Все UI-компоненты с `v-model` следуют единому контракту (`modelValue` prop + `update:modelValue` emit). `CustomSelect`, `MultiSelect`, `RatingSelect` — взаимозаменяемы в формах. |
| **I — Interface Segregation** | TypeScript интерфейсы разбиты по доменам: `Supplier` не тянет за собой `BccRequest`. Composables возвращают только то, что нужно потребителю (`{ suppliers, loading, load }` — не весь внутренний state). |
| **D — Dependency Inversion** | Компоненты зависят от composables (абстракция), не от services (реализация). Composables зависят от service-интерфейса, а service решает — mock или real API. Замена источника данных не затрагивает ни компоненты, ни composables. |

### DRY

- UI-компоненты — пишутся один раз, используются на всех страницах
- Composables — бизнес-логика вынесена из views, переиспользуется
- Types — единый интерфейс `Supplier` используется в service, mock, composable и компоненте
- CSS — импорт оригиналов из `@assets`, не копирование

### DDD (Domain-Driven Design)

Код организован по бизнес-доменам, не по техническим слоям:

```
suppliers/                    analytics/
  types/supplier.ts             types/analytics.ts
  services/suppliersService.ts  services/analyticsService.ts
  mocks/suppliers.ts            mocks/analytics.ts
  composables/useSuppliers.ts   composables/useAnalytics.ts
  views/SuppliersListPage.vue   views/DashboardPage.vue
```

Каждый домен автономен: свои типы → свой service → свой mock → свой composable → свои views. Добавление нового домена (например Products) не затрагивает существующие.

---

## Фаза 1: Admin Layout Shell

### Файлы

| Файл | Описание |
|------|----------|
| `src/layouts/AdminLayout.vue` | Обёртка `.shell` (sidebar + topbar + `<router-view>`) |
| `src/components/admin/AdminSidebar.vue` | Навигация, лого, профиль, коллапс (из `partials/layout/sidebar.html`) |
| `src/components/admin/AdminTopbar.vue` | Поиск, уведомления, профиль (из `partials/layout/header.html`) |
| `src/components/admin/AnalyticsSubNav.vue` | Горизонтальные табы 8 разделов аналитики |

### Изменить существующие

- **`src/App.vue`** — условный рендеринг: скрыть `bg-image`, `bg-overlay`, `LangSwitcher` для admin routes (через `route.meta.layout === 'admin'`)
- **`src/router/index.ts`** — nested routes под `/admin` с `AdminLayout` как parent:

```
/admin → redirect → /admin/analytics/dashboard
/admin/analytics/dashboard    → DashboardPage
/admin/analytics/warehouse    → WarehousePage
/admin/analytics/sales        → SalesPage
/admin/analytics/supply       → SupplyPage
/admin/analytics/staff        → StaffPage
/admin/analytics/logistics    → LogisticsPage
/admin/analytics/pl-report    → PlReportPage
/admin/analytics/deficit      → DeficitPage
/admin/suppliers              → SuppliersListPage
/admin/suppliers/:id          → SupplierCardPage
/admin/suppliers/config       → SupplierCardConfigPage
/admin/suppliers/bcc-request  → BccRequestPage
```

### CSS: Vite вместо Gulp, разделение на уровни

**Добавить devDependency:** `sass`

**Создать:** `demo/assets/css/admin/admin-core.scss` — только общие стили:
```scss
@import '_variables.css';
@import 'utilities/_global.css';
@import 'utilities/_flex.css';
@import 'components/_buttons.css';
@import 'components/_glass-panel.css';
@import 'components/_forms.css';
@import 'components/_status-pills.css';
@import 'components/_tables.css';
```

**Импорт в AdminLayout.vue (грузится всегда):**
```js
import '@assets/css/admin/admin-core.scss'
import '@assets/css/admin/base-layout.css'
```

**Component CSS — импорт в каждом Vue-компоненте:**
| Vue Component | CSS |
|---|---|
| `AppModal.vue` | `components/_modal.css` |
| `CustomSelect.vue` | `components/_custom-select.css` |
| `MultiSelect.vue` | `components/_multiselect.css` |
| `TagInput.vue` | `components/_tag-input.css` |
| `DatePicker.vue` | `components/_datepicker.css` |
| `DropZone.vue` | `components/_dropzone.css` |
| `RatingStars.vue` | `components/_rating.css` |
| `CheckboxList.vue` | `components/_checkbox-list.css` |
| `EmailTemplate.vue` | `components/_email-template.css` |
| `PriceInput.vue` | `components/_price-input.css` |
| `FileItem.vue` | `components/_file-item.css` |
| `NoteItem.vue` | `components/_note-item.css` |
| `InputSuffixSelect.vue` | `components/_input-suffix.css` |

**Page CSS — импорт в каждом view:**
| Vue Page | CSS |
|---|---|
| `SuppliersListPage.vue` | `suppliers_list.css` |
| `SupplierCardPage.vue` | `supplier_card.css` |
| `SupplierCardConfigPage.vue` | `supplier_card_config.css` |
| `BccRequestPage.vue` | `bcc_request.css` |
| `PlReportPage.vue` | `analytic_pl-report.css` |

Vite автоматически code-split CSS при lazy-load компонентов. `main.scss` / Gulp больше не нужны.

---

## Фаза 2: Shared UI Components

Маппинг 52 partials → Vue компоненты. Группировка по приоритету.

### Tier 1: Ядро (используется на всех страницах)

| Partial | Vue Component | Путь |
|---------|--------------|------|
| `glass-panel.html` | `GlassPanel.vue` | `components/admin/` |
| `kpi-card.html` | `KpiCard.vue` | `components/admin/` |
| `bar-chart-row.html` | `BarChartRow.vue` | `components/admin/` |
| `acard.html` | `AnalyticsCard.vue` | `components/admin/` |
| `ametric.html` | `AnalyticsMetric.vue` | `components/admin/` |
| `icon.html` | `SvgIcon.vue` + `icons.ts` | `components/admin/` |
| `custom-select.html` | `CustomSelect.vue` | `components/admin/ui/` |
| `modal.html` | `AppModal.vue` | `components/admin/ui/` |
| `datepicker.html` | `DatePicker.vue` | `components/admin/ui/` |
| `dropzone.html` | `DropZone.vue` | `components/admin/ui/` |
| `rating-stars/select` | `RatingStars.vue` / `RatingSelect.vue` | `components/admin/ui/` |
| `tag-input/tag` | `TagInput.vue` / `AppTag.vue` | `components/admin/ui/` |
| `input-group.html` | `InputGroup.vue` | `components/admin/ui/` |
| `alerts-table.html` | `AlertsTable.vue` | `components/admin/tables/` |

### Tier 2: Supplier-specific

| Partial | Vue Component | Путь |
|---------|--------------|------|
| `view-tabs.html` | `ViewTabs.vue` | `components/admin/` |
| `kanban-card.html` | `KanbanCard.vue` | `components/admin/` |
| `multi-select.html` | `MultiSelect.vue` | `components/admin/ui/` |
| `checkbox-list.html` | `CheckboxList.vue` | `components/admin/ui/` |
| `email-template.html` | `EmailTemplate.vue` | `components/admin/ui/` |
| `price-input.html` | `PriceInput.vue` | `components/admin/ui/` |
| `history-table.html` | `HistoryTable.vue` | `components/admin/tables/` |
| `permissions-matrix.html` | `PermissionsMatrix.vue` | `components/admin/tables/` |
| `config-section-card.html` | `ConfigSectionCard.vue` | `components/admin/` |
| `field-library-item.html` | `FieldLibraryItem.vue` | `components/admin/` |
| `file-item/note-item` | `FileItem.vue` / `NoteItem.vue` | `components/admin/` |

### Принципы

- `<script setup lang="ts">`, `defineProps()`, `defineEmits()`
- Slots заменяют Handlebars `{{> @partial-block}}`
- `data-i18n="key"` → `{{ t('key') }}`
- CSS из `@assets/css/admin/` — не копировать
- Loading state через prop `loading` + `v-if`

### Распределение JS-логики из `*_logic.js`

Сейчас в HTML-версии вся логика на странице: `querySelector`, `addEventListener`, `classList.toggle` — и дублируется между страницами (модалки, селекты и т.д.).

Во Vue логика распределяется на 3 уровня:

**1. UI-компоненты** — инкапсулируют своё поведение:
| Компонент | Что внутри |
|---|---|
| `AppModal.vue` | open/close, overlay click, Teleport, анимация |
| `CustomSelect.vue` | dropdown toggle, click-outside, keyboard nav, v-model |
| `MultiSelect.vue` | checkbox state, select all, search, v-model |
| `DropZone.vue` | dragenter/dragleave/drop, file validation, preview |
| `DatePicker.vue` | calendar render, day selection, v-model |
| `TagInput.vue` | add/remove tags, input handling, v-model |
| `RatingStars.vue` | hover highlight, click select, v-model |

**2. Composables** — бизнес-логика, переиспользуется между страницами:
| Composable | Логика из |
|---|---|
| `useSuppliers()` | `suppliers_list_logic.js` — фильтрация, поиск, пагинация, сортировка |
| `useSupplierCard()` | `supplier_card_logic.js` — загрузка/сохранение карточки |
| `useBccRequest()` | `bcc_request_logic.js` — категории, получатели, отправка |
| `useCardConfig()` | `supplier_card_config_logic.js` — секции, поля, permissions |
| `useDirtyCheck()` | из card_logic — отслеживание изменений формы |
| `usePagination()` | из list_logic — page/pageSize/total, вычисление страниц |
| `useDragDrop()` | из config_logic — reorder полей и секций |
| `useToast()` | toast-уведомления (success/error) |

**3. Страницы (views)** — только склейка: props вниз, events вверх:
```vue
<!-- Страница НЕ знает как работает модалка или селект -->
<AppModal :open="showModal" @close="showModal = false" />
<CustomSelect :options="statuses" v-model="filters.status" />
```

**Результат:** ноль дублирования. `AppModal` пишется один раз и используется на любой странице одинаково.

---

## Фаза 3: API / Data Layer

### Архитектура: Service + Composable

Два слоя:
1. **Services** (`src/services/`) — чистые async-функции, без Vue-реактивности
2. **Composables** (`src/composables/`) — вызывают services, управляют `ref()`, `loading`, `error`

Замена mock → real API затрагивает ТОЛЬКО service слой.

### Переключение моков

```ts
// src/services/api.ts
import type { ApiResponse } from '@/types/api'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (USE_MOCKS) {
    const { getMock } = await import('./mocks/index')
    return getMock<T>(path, params)
  }
  // real fetch...
}
```

### Файлы

**Types:**
- `src/types/api.ts` — `ApiResponse<T>`, `PaginatedResponse<T>`
- `src/types/supplier.ts` — `Supplier`, `SupplierFilters`, `SupplierStatus`
- `src/types/analytics.ts` — `KpiItem`, `AlertItem`, `ChartData`
- `src/types/bcc.ts` — `BccCategory`, `BccRecipient`, `BccRequest`
- `src/types/config.ts` — `FieldDefinition`, `SectionConfig`, `PermissionMatrix`

**Services (`.ts`):**
- `src/services/api.ts` — типизированная обёртка fetch + мок-переключатель
- `src/services/analyticsService.ts`
- `src/services/suppliersService.ts`
- `src/services/bccService.ts`
- `src/services/configService.ts`

**Mocks (`.ts`):**
- `src/services/mocks/index.ts` — роутер моков
- `src/services/mocks/analytics.ts`
- `src/services/mocks/suppliers.ts`
- `src/services/mocks/bcc.ts`
- `src/services/mocks/config.ts`

**Composables (`.ts`):**
- `src/composables/useAnalytics.ts` — принимает ключ страницы, загружает данные
- `src/composables/useSuppliers.ts` — фильтры, пагинация, загрузка
- `src/composables/useSupplierCard.ts` — данные карточки
- `src/composables/useBccRequest.ts` — категории, получатели, отправка
- `src/composables/useCardConfig.ts` — поля, секции, права
- `src/composables/useDirtyCheck.ts` — отслеживание изменений формы
- `src/composables/useToast.ts` — уведомления
- `src/composables/usePagination.ts` — пагинация
- `src/composables/useDragDrop.ts` — drag-and-drop для card-config

### API Routes (для будущего бэкенда)

| Method | Route | Используется |
|--------|-------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard |
| GET | `/api/analytics/warehouse` | Warehouse |
| GET | `/api/analytics/sales` | Sales |
| GET | `/api/analytics/supply` | Supply |
| GET | `/api/analytics/staff` | Staff |
| GET | `/api/analytics/logistics` | Logistics |
| GET | `/api/analytics/pl-report` | P&L |
| GET | `/api/analytics/deficit` | Deficit |
| GET | `/api/suppliers?filters` | Suppliers list |
| GET | `/api/suppliers/:id` | Supplier card |
| PUT | `/api/suppliers/:id` | Save supplier |
| GET | `/api/bcc/categories` | BCC request |
| POST | `/api/bcc/send` | BCC send |
| GET | `/api/bcc/history` | BCC history |
| GET | `/api/config/fields` | Card config |
| GET | `/api/config/sections` | Card config |
| PUT | `/api/config/sections` | Save config |
| GET | `/api/config/permissions` | Permissions |

---

## Фаза 4: Translations

**Изменить:** `src/i18n/admin.ts` — заполнить из 12 файлов `demo/assets/js/lang/admin/` + `admin_common.js`

**Структура:**
```ts
export const adminEn = {
  side: { ... },    // из admin_common.js
  sub: { ... },     // из admin_common.js
  head: { ... },    // из admin_common.js
  dashboard: { ... },  // из analytic_dashboard.js (бывшие page.*)
  warehouse: { ... },
  // ... по каждой странице
}
```

**Правило:** `data-i18n="page.kpi1_label"` → `t('dashboard.kpi1_label')` (префикс страницы во избежание коллизий)

---

## Фаза 5: Page Migration

### Порядок миграции

**Batch 1: Analytics (8 страниц, однотипные)**

Общая структура: `AnalyticsSubNav` + ряд `KpiCard` + `GlassPanel` с графиками/таблицами

1. `DashboardPage.vue` — устанавливает паттерн (KPI, charts, alerts, preview cards)
2. `WarehousePage.vue`
3. `SalesPage.vue`
4. `SupplyPage.vue`
5. `StaffPage.vue`
6. `LogisticsPage.vue`
7. `PlReportPage.vue`
8. `DeficitPage.vue`

**Batch 2: Suppliers (4 страницы, сложная логика)**

9. `SuppliersListPage.vue` — таблица + kanban, поиск, фильтры, пагинация
10. `SupplierCardPage.vue` — карточка поставщика, формы, dirty check (63KB compiled)
11. `BccRequestPage.vue` — BCC запрос, email шаблон, история
12. `SupplierCardConfigPage.vue` — конфигуратор полей, drag-and-drop, матрица прав (205KB compiled, самая сложная)

### Чеклист для каждой страницы

1. Создать view в `src/views/admin/` (`<script setup lang="ts">`)
2. Handlebars → Vue template (`{{> partial}}` → `<Component />`, `data-i18n` → `{{ t() }}`)
3. `<script setup lang="ts">` с `useI18n()`, `useHead()`, data composable, feature flags
4. Импорт page-specific CSS (если есть)
5. Зарегистрировать route
6. Добавить переводы в `admin.ts`
7. Проверить рендер vs оригинальный HTML

---

## Фаза 6: Playwright E2E тесты

### Цели

- **Автотесты — основной канал QA.** Ручной проверке остаётся только визуальная сверка при намеренных изменениях дизайна (approve новых baseline'ов).
- **Покрытие по всем страницам** — на каждую admin-страницу есть suite (визуальный + функциональный), чтобы при регрессии видеть **конкретную** страницу и **конкретную** секцию.
- **Две оси поломок:**
  - **Design / visual** — pixel-diff через Playwright `toHaveScreenshot()`. Ловит сдвиг layout, поломанный flex/grid, исчезнувшие блоки, z-index-артефакты.
  - **Feature / functional** — click/fill/asserts. Ловит поломанные обработчики, неверные роуты, не работающий v-model, API-контракт.

### Feature flags: тесты прогоняются со ВСЕМИ флагами ON

На проде некоторые блоки/страницы могут быть скрыты (`supplierKanbanView: false` пока бэкенд не готов). Тесты **должны** видеть всё, иначе регрессия в скрытой секции пройдёт незамеченной.

**Механизм:** глобальный `beforeEach` через `page.addInitScript` выставляет `localStorage['ff_overrides']` на все флаги `true` **до загрузки SPA**. `featureFlags.ts` читает overrides при инициализации reactive объекта.

**Файл:** `tests/e2e/helpers/flags.ts`
```ts
// Список ВСЕХ флагов (sync с src/config/featureFlags.ts).
// При добавлении нового флага — обновить этот список.
export const ALL_FLAGS_ENABLED = {
  adminDashboard: true, adminWarehouse: true, adminSales: true, /* ... */
  dashboardAlerts: true, supplierKanbanView: true, /* ... */
}

export async function enableAllFlags(context: BrowserContext) {
  await context.addInitScript((flags) => {
    localStorage.setItem('ff_overrides', JSON.stringify(flags))
  }, ALL_FLAGS_ENABLED)
}
```

**В `playwright.config.ts`:** глобальный fixture, применяется ко всем тестам автоматически.

**Отдельный `feature-flags.spec.ts`** тестирует обратное: каждый флаг по очереди выключается, проверяется что соответствующая секция/страница исчезла.

### Visual regression: per-section snapshots, не full-page

**Проблема full-page snapshot'а:** тест падает с сообщением «dashboard.png отличается от baseline» — непонятно **где** сломалось. Пользователь вынужден открывать HTML-отчёт и глазами сравнивать.

**Решение — per-section snapshots:**
```ts
test('dashboard › kpi row visual', async ({ page }) => {
  await expect(page.locator('[data-test="kpi-row"]')).toHaveScreenshot('dashboard-kpi-row.png')
})
test('dashboard › alerts table visual', async ({ page }) => {
  await expect(page.locator('[data-test="alerts-table"]')).toHaveScreenshot('dashboard-alerts-table.png')
})
test('dashboard › sales chart visual', async ({ page }) => {
  await expect(page.locator('[data-test="sales-chart"]')).toHaveScreenshot('dashboard-sales-chart.png')
})
```

При регрессии отчёт напишет **конкретно** «dashboard › alerts table visual FAILED» — ты сразу знаешь где и что. Не нужно открывать картинки и сравнивать.

**DOM-assertions как дополнительная локализация:**
- На каждой секции — атрибут `data-test="section-name"` (ставится при создании/миграции страницы)
- В тестах — отдельные assertion'ы на видимость каждой критической секции
- Если CSS бажит и секция исчезла — тест упал с именем `dashboard › kpi-deficit visible`, а не «general visual diff»

**Baseline workflow:**
- Первый прогон: `npx playwright test --update-snapshots` создаёт PNG в `tests/e2e/__screenshots__/`
- Последующие: diff → красный тест + визуальный 3-way diff в отчёте
- Намеренные правки дизайна: `--update-snapshots`, коммит новых PNG
- Threshold: `maxDiffPixelRatio: 0.01` (1% на anti-aliasing)

### Структура

```
tests/e2e/
  helpers/
    admin.ts              — навигация по admin, смена языка, ожидание загрузки страницы
    flags.ts              — enableAllFlags, disableFlag (для feature-flags.spec)
    visual.ts             — makeFullPageSnapshot, snapshotModal, snapshotDropdown
    mocks.ts              — утилиты для стабильных данных (замораживает Math.random, Date.now)
  admin/
    layout.spec.ts                 — sidebar collapsed/expanded, topbar, responsive @375/@768/@1440
    analytics/
      dashboard.spec.ts            — KPI render, alerts, charts, preview cards, visual snapshot
      warehouse.spec.ts
      sales.spec.ts
      supply.spec.ts
      staff.spec.ts
      logistics.spec.ts
      pl-report.spec.ts
      deficit.spec.ts
    suppliers/
      list.spec.ts                 — table/kanban toggle, search, filters, pagination, bulk actions, visual
      card.spec.ts                 — form fields, dirty check, save (PATCH delta), tags, files upload, visual
      card-config.spec.ts          — field library, sections DnD, permissions matrix, save (PUT bulk), visual
      bcc-request.spec.ts          — categories, recipients, email template, send (idempotency), history, visual
      create.spec.ts               — new supplier form, validation, redirect to card, visual
  i18n.spec.ts                     — переключение RU/EN/LT на каждой странице, проверка ключевых переводов
  feature-flags.spec.ts            — выключение каждого флага → соотв. секция/страница скрыта
  navigation.spec.ts               — роуты, deep links, 404, legacy /demo/public/ redirect
  smoke.spec.ts                    — быстрый прогон: каждая страница открывается, нет console errors
```

### ВАЖНО: страницы не типовые, каждая — отдельный deep audit

**Не «написать шаблон и размножить на 12 страниц».** Каждая admin-страница — уникальная логика, уникальные формы, уникальные взаимодействия. Работа по каждой странице = отдельная сессия с:
- Вдумчивым чтением её `.vue` исходника, composables, соответствующего mock'а
- Перечислением ВСЕХ секций, интерактивных элементов, form inputs, модалок, API-вызовов
- Написанием функциональных тестов под каждую из этих единиц
- Per-section visual snapshot'ов (по 1 на каждую логическую секцию)
- Проверкой edge-cases (пустой список, ошибка API, валидация, dirty state)

**Общий только минимум** — нижеперечисленное есть на каждой странице:

1. **Load & no-crash:**
   - `page.goto(url)` → основной заголовок виден
   - No console errors (`page.on('console', err => throw)`)

2. **Per-section visual snapshots** — по одному на каждую логическую секцию (KPI row, alerts table, chart, filter bar, kanban column и т.д.), не full-page. Каждый snapshot — отдельный `test()` с именем где локализована секция.

3. **DOM assertions на `data-test` элементы** — каждая критическая секция помечена `data-test="X"`, тест явно проверяет `toBeVisible()`. Поломка = явное сообщение.

4. **i18n:** RU/EN/LT — ключевые строки переводятся, `html[lang]` меняется

5. **Функциональные тесты — глубокие, специфичные странице.** См. ниже per-page списки. Это **не шаблон**, а стартовый чеклист, который дорабатывается при написании теста.

### Специфичные функциональные тесты

**Analytics (все 8):**
- Sub-nav переключает активную вкладку и URL
- KPI-карточки рендерятся с числами из mock
- Charts: SVG / canvas присутствует, не пустой
- Alerts (если флаг): таблица заполнена

**SuppliersListPage:**
- Search: ввод в поле фильтрует список (debounce)
- Filters: каждый фильтр (status, category, rating) сужает выдачу
- View toggle: table ↔ kanban, сохранение в localStorage
- Pagination: next/prev/jump страницы, корректный `total`
- Click по строке → переход на `/admin/suppliers/:id`
- «New Supplier» → переход на `/admin/suppliers/new`

**SupplierCardPage:**
- Все секции формы рендерятся (Status, Requisites, Contact, Procurement, Notes, Pricing, Files, Audit)
- Edit поля → Save btn становится активной (`dirty`)
- Save → PATCH с delta (проверить request payload через `page.route`)
- Notes: add/remove
- Files: drag-drop → POST `/uploads` → появляется в списке
- Audit entry delete → confirm modal → DELETE
- Discard changes → откат к серверному состоянию

**SupplierCreatePage:**
- Пустая форма: Save выдаёт ошибку «company required» + toast
- Company без email: ошибка «email required»
- Валидная форма → POST `/suppliers` → redirect на `/admin/suppliers/:id`
- Cancel → возврат на `/admin/suppliers` без создания

**SupplierCardConfigPage:**
- Field library: все базовые поля рендерятся
- Drag field из library → в секцию: поле появляется в section
- Create section: кнопка → новая секция, rename inline
- Permissions matrix: клик по ячейке → состояние меняется
- Save → 3 параллельных PUT (fields / sections / permissions), проверить через `page.route`

**BccRequestPage:**
- Categories: select рендерит mock-данные
- Recipients: чекбоксы, «Select all»
- Email template: preview обновляется при редактировании
- Send → POST `/bcc/send` c `Idempotency-Key` header
- History панель: список past-запросов, accept/decline actions

**Layout (sidebar/topbar):**
- Collapse/expand sidebar (localStorage persist)
- Search в topbar: навигация по результатам
- Lang switcher — работает
- На width 375 (mobile) sidebar становится overlay

### Что тестируется cross-cutting

**`navigation.spec.ts`:**
- Все роуты из `router/index.ts` грузятся (smoke)
- Deep link `/admin/suppliers/S-12345` напрямую — карточка грузится
- Несуществующий роут → `/404`
- Legacy: `/demo/public/` → stub → `/` (проверяется через реальный HTTP)

**`i18n.spec.ts`:**
- На LandingPage, каждой admin-странице: RU→EN→LT, каждый раз проверяем ключевую фразу
- `html[lang]` атрибут меняется
- `localStorage['flexiron_lang']` сохраняется

**`feature-flags.spec.ts`:**
- Для каждого флага: выключить через localStorage → перезагрузить → проверить что соответствующая страница/секция исчезла (или редирект на /404 для page-level флагов)

**`smoke.spec.ts`:**
- Быстрый прогон < 30s: каждая из 13 страниц открывается, no console errors, `<h1>` видим
- Запускается первым в CI — если упало, deep-тесты не запускаются

### Все ошибки за один прогон — fail-late, не fail-fast

**Цель:** один `npm run test:e2e` — полный отчёт где ВСЁ упало, а не «первая ошибка и стоп».

**Два уровня независимости:**

1. **Между `test()` блоками (Playwright default).** Каждый `test()` независим — падение одного не останавливает остальные. В отчёте видны **все** упавшие тесты. Ничего не надо настраивать.

   **Практический вывод:** писать **много маленьких `test()`**, а не один большой. Вместо:
   ```ts
   test('dashboard works', async ({ page }) => {
     await expect(kpi).toBeVisible()      // если упало — не проверим chart
     await expect(chart).toBeVisible()
     await expect(alerts).toBeVisible()
   })
   ```
   делать:
   ```ts
   test('dashboard › kpi visible', ...)
   test('dashboard › chart visible', ...)
   test('dashboard › alerts visible', ...)
   ```
   Упали все три → отчёт перечислит все три. Упал один → остальные проходят.

2. **Внутри одного `test()` (soft assertions).** Если несколько assertion'ов логически связаны в одном тесте (нельзя разбить на три) — использовать `expect.soft()` вместо `expect()`:
   ```ts
   test('supplier form validation', async ({ page }) => {
     await page.click('[data-test="save-btn"]')
     expect.soft(toast).toContainText('company required')
     expect.soft(page.locator('[data-test="err-company"]')).toBeVisible()
     expect.soft(page.locator('[data-test="err-email"]')).toBeVisible()
     // тест упадёт В КОНЦЕ со списком ВСЕХ упавших soft-asserts
   })
   ```
   Обычный `expect()` — throw immediately. `expect.soft()` — копит ошибки до конца теста.

**Конфиг (`playwright.config.ts`):**
- `maxFailures: 0` (default) — не останавливаться, прогнать весь suite
- `fullyParallel: true` — параллель, быстрее и независимее
- `retries: 0` для локали (0 - чтобы flaky сразу ловить), `retries: 2` в CI
- `reporter: [['html'], ['list']]` — HTML-отчёт (все ошибки) + консольный list (быстрая сводка)

**После прогона:**
```
npx playwright show-report   # открывает HTML со всеми упавшими тестами
```
Один экран — все упавшие (с названиями секций), visual diff'ы, stack traces, скриншоты.

### Запуск

| Команда | Что делает |
|---|---|
| `npm run test:e2e` | Весь suite |
| `npm run test:e2e -- smoke` | Только smoke (< 30 сек) |
| `npm run test:e2e -- admin/suppliers/list` | Один файл |
| `npm run test:e2e -- --update-snapshots` | Пересоздать visual baseline |
| `npm run test:e2e:ui` | Playwright UI mode для отладки |

### Maintenance

- **Добавил флаг?** Обнови `ALL_FLAGS_ENABLED` в `helpers/flags.ts`.
- **Добавил страницу?** Отдельная сессия — deep audit, не копипаст существующего spec'а (см. «страницы не типовые»). Зарегистрировать в `navigation.spec.ts` и `smoke.spec.ts`.
- **Добавил секцию в существующую страницу?** Добавить `data-test="X"` на корень секции, дописать:
  - визуальный per-section `toHaveScreenshot()` тест
  - DOM assertion на `[data-test="X"]` toBeVisible
  - функциональные тесты под интерактив секции (если есть кнопки/формы/модалки)
  - Visual regression существующих снапшотов всё равно упадёт если новая секция сдвинула layout — это подсказка что тесты **нужно** дописать.
- **Намеренно изменил дизайн?** `npm run test:e2e -- --update-snapshots` → закоммить новые PNG.
- **Мигающий тест** (flaky)? Проверить детерминизм данных (mock возвращает клон через `structuredClone`, зафризить `Date.now()` и `Math.random()` через `helpers/mocks.ts`).

### Последовательность работы по фазе

Строго последовательно (не параллельно):

1. **Инфра** (1 сессия): helpers (admin.ts, flags.ts, visual.ts, mocks.ts), playwright.config.ts с global setup, smoke.spec.ts, navigation.spec.ts, i18n.spec.ts, feature-flags.spec.ts. Baseline smoke зелёный.
2. **layout.spec.ts** (1 сессия): deep audit sidebar + topbar + responsive.
3. **Каждая admin-страница — отдельная сессия:**
   - Dashboard → сессия
   - Warehouse → сессия
   - Sales → сессия
   - ... (8 analytics + 5 suppliers = 13 сессий)
   - В каждой: прочитать исходник страницы, выписать все секции/интеракции, расставить `data-test`, написать visual + functional тесты, прогнать, зафиксировать baseline'ы.
4. **Регрессионный прогон** — весь suite зелёный локально перед коммитом фазы.

---

## Фаза 7: Финальная интеграция

1. ESLint fix + Prettier format на всех новых файлах
2. Визуальная сверка всех 12 страниц с оригиналами
3. Регрессия публичных страниц
4. Все комбинации feature flags
5. Обновить `ScreensPage.vue` — ссылки на admin

---

## Граф зависимостей

```
Фаза 0 (Infra: CLAUDE.md, Skills, TS, ESLint, Flags, Playwright)
  ↓
Фаза 1 (Layout)
  ├→ Фаза 2 (Components) → Фаза 4 (Translations)
  └→ Фаза 3 (API Layer)  ↗
            ↓
       Фаза 5 (Pages) — зависит от 1, 2, 3, 4
            ↓
       Фаза 6 (Tests)
            ↓
       Фаза 7 (Polish)
```

Фазы 2 и 3 последовательно. Фаза 4 после Фазы 2.

---

## Верификация

1. `npm run dev` — проверить каждую admin страницу в браузере
2. Сравнить визуально с `demo/admin/*.html` (открыть рядом)
3. `npm run typecheck` — 0 ошибок TypeScript
4. `npm run lint` — 0 ошибок ESLint
5. `npm run test:e2e` — все тесты зелёные
6. Переключить `VITE_USE_MOCKS=false` — убедиться что fetch идёт на `/api/*`
7. Переключить feature flags через localStorage — секции скрываются/показываются
8. Проверить все 3 языка (RU/EN/LT) на каждой странице

## Критические файлы (существующие, будут изменены)

- `frontend_vue/src/router/index.js` → `.ts`
- `frontend_vue/src/App.vue`
- `frontend_vue/src/i18n/admin.js` → `admin.ts`
- `frontend_vue/src/i18n/translations.js`
- `frontend_vue/package.json`
- `frontend_vue/vite.config.js` → `vite.config.ts`
