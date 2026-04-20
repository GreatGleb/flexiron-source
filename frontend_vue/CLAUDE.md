# InBox LT — Frontend Vue (Admin Migration)

> Specific patterns, pitfalls, save-UX rules — в skill `vue-rules` (вызывается через `/vue-rules` или подгружается автоматически при триггерных задачах: добавление class binding, mock'и, editable форма, перед коммитом).

## Stack

- Vue 3 (Composition API, `<script setup lang="ts">`)
- Vue Router 4 (history mode, nested routes)
- vue-i18n v11 (legacy: false, 3 languages: RU/EN/LT)
- TypeScript (strict mode)
- Vite 6 (build tool, SCSS support)
- Playwright (E2E tests)
- ESLint 9 (flat config) + Prettier

## Architecture

### Directory Structure

```
src/
  config/             # Feature flags
  components/
    BackButton.vue    # (public)
    LangSwitcher.vue  # (public)
    admin/            # Admin UI components
      ui/             # Form controls (CustomSelect, Modal, TagInput, etc.)
      tables/         # Table components (AlertsTable, HistoryTable, etc.)
  composables/        # Reusable logic (useHead, useSuppliers, useAnalytics, etc.)
  i18n/               # Translations (public.js, admin.ts, translations.js)
  layouts/            # AdminLayout.vue
  router/             # Route definitions
  services/           # API layer (pure async functions, no Vue reactivity)
    mocks/            # Mock data (same interface as real API)
  types/              # TypeScript interfaces (per domain)
  views/
    public/           # Public pages (existing, JS)
    admin/
      analytics/      # 8 analytics pages
      suppliers/      # 4 supplier pages
tests/
  e2e/                # Playwright tests
```

### Patterns

#### Composition API

- Always `<script setup lang="ts">` — never Options API
- Composables with `use` prefix for reusable logic
- Views for pages, Components for reusable blocks

#### v-model for custom components

<!-- prettier-ignore -->
```vue
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
```

#### provide/inject

- `AdminLayout` provides: sidebar collapsed state, toast handler
- Deep components inject directly — no prop drilling

#### Slots

- GlassPanel: default + header + action slots
- AppModal: default (body) + footer slots
- Extend components via slots and props, not by editing source (Open/Closed)

#### Teleport

- Modals and toasts render into `<body>` via `<Teleport to="body">`

### SOLID

- **S**: One component = one UI task. One composable = one domain. One service = one API domain.
- **O**: Extend via slots/props, not source edits.
- **L**: All v-model components follow `modelValue` + `update:modelValue` contract.
- **I**: Types split by domain. Composables expose only what consumers need.
- **D**: Components → composables → services → mock/real. Swap data source = change service only.

### DRY

- UI components written once, used everywhere
- Composables extract shared business logic from views
- Types: single `Supplier` interface used in service, mock, composable, and component
- CSS: single source of truth in `src/styles/` (alias `@styles`), images in `src/assets/images/` (alias `@images`)

### DDD (Domain-Driven Design)

Code organized by business domain:

- `suppliers`: types/supplier.ts → suppliersService.ts → mocks/suppliers.ts → useSuppliers.ts → views
- `analytics`: types/analytics.ts → analyticsService.ts → mocks/analytics.ts → useAnalytics.ts → views
- `bcc`: types/bcc.ts → bccService.ts → mocks/bcc.ts → useBccRequest.ts → views
- `config`: types/config.ts → configService.ts → mocks/config.ts → useCardConfig.ts → views

## CSS Strategy

Three levels, Vite handles bundling (no Gulp):

1. **Core** → `AdminLayout.vue`: `@styles/admin/admin-core.scss` + `base-layout.css`
2. **Component** → each Vue component imports its own CSS from `@styles/admin/components/`
3. **Page** → each view imports page-specific CSS if it exists

CSS lives under `src/styles/` (alias `@styles`). Images under `src/assets/images/` (alias `@images`). Use `url('@images/foo.avif')` inside CSS — Vite resolves the alias.

## API / Mock Layer

```
Component → Composable → Service → Mock or Real API
```

- `VITE_USE_MOCKS=true` (default) — services return mock data
- `VITE_USE_MOCKS=false` — services make real fetch calls to `/api/*`
- Swapping mock → real changes ONLY the service layer
- HTTP-методы и save-режим (clean-slate / quick-action) детально описаны в skill `vue-rules`

## Feature Flags

- `src/config/featureFlags.ts` — reactive object with typed flags
- `useFeatureFlag('flagName')` returns `computed<boolean>`
- Two levels: page-level (`adminDashboard`) and section-level (`dashboardAlerts`)
- Override via `localStorage.setItem('ff_overrides', JSON.stringify({ flagName: false }))`
- Route guards via `beforeEnter` for page-level flags

## i18n

- vue-i18n v11, Composition API mode (`legacy: false`)
- `const { t } = useI18n()` in components, `{{ t('key') }}` in templates
- `fallbackLocale: 'en'`, locale persisted in `localStorage('flexiron_lang')`
- Admin translations in `src/i18n/admin.ts` with page prefix: `t('dashboard.kpi1_label')`
- Language change updates `document.documentElement.lang`

## Routing

- `<router-link>` for all navigation — never `<a href>`
- Admin routes nested under `/admin` with `AdminLayout` as parent
- Lazy-loaded via `() => import('@/views/admin/...')`

## Known Pitfalls

Полный список (14 пунктов) с фиксами и примерами — в skill `vue-rules`. Top-6 baseline:

1. **`@` in translations** breaks vue-i18n → escape: `name{'@'}company.com`
2. **`#app` wrapper** breaks flex-layout → `#app { display: flex; flex-direction: column; min-height: 100vh; }`
3. **`html { overflow: hidden }`** from erp-base.css cuts long pages → override in App.vue
4. ~~**Vite blocks files outside root** (403)~~ — устарело: assets теперь внутри `src/`, `server.fs.allow` не нужен
5. **Content behind bg-overlay** → admin uses bg inside `.shell`, public views need `z-index: 10+`
6. **Never `taskkill //F //IM node.exe`** — kills Claude Code. Stop dev-server by PID or Ctrl+C

## Prohibitions

- NO Options API
- NO `data-i18n` attributes
- NO unnecessary `v-html` (only when translation contains HTML like `<br>`)
- NO unused imports
- NO direct DOM manipulation (`document.querySelector`) — use composable or ref
- NO `<a href>` for navigation — use `<router-link>`
- NO copying CSS into `frontend_vue/`
- NO custom i18n composables — use vue-i18n

## Verification Checklist

After every component/page/composable:

1. `npm run typecheck` — 0 TypeScript errors
2. `npm run lint` — 0 ESLint errors
3. `npm run dev` → check in browser
4. Verify existing pages still work (regression)
5. Switch language (RU/EN/LT) — translations in place
