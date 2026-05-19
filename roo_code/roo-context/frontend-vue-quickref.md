# Frontend Vue — Quick Reference

> Quick-reference for [`frontend_vue/`](../../frontend_vue/) project patterns, conventions, and architecture.
> Detailed architecture: [`frontend-architecture.md`](./frontend-architecture.md)
> Vue pitfalls & rules: [`vue-rules.md`](../skills/vue-rules.md)
> Composables: [`frontend-composables.md`](./frontend-composables.md)
> Services: [`frontend-services.md`](./frontend-services.md)
> Types: [`frontend-types.md`](./frontend-types.md)

---

## Directory Structure

```
frontend_vue/src/
  config/             # Feature flags
  components/
    BackButton.vue    # (public)
    LangSwitcher.vue  # (public)
    admin/            # Admin UI components
      ui/             # Form controls (CustomSelect, Modal, TagInput, etc.)
      tables/         # Table components (AlertsTable, HistoryTable, etc.)
  composables/        # Reusable logic (useXxx pattern)
  i18n/               # Translations (domain-split in admin/)
  layouts/            # AdminLayout.vue
  router/             # Route definitions
  services/           # API layer (pure async, no Vue reactivity)
    mocks/            # Mock data (same interface as real API)
  types/              # TypeScript interfaces (per domain)
  views/
    public/           # Public pages (Landing, Auth, etc.)
    admin/
      analytics/      # 8 analytics pages
      suppliers/      # 5 supplier pages
      products/       # 4 product pages
tests/
  e2e/                # Playwright tests
```

---

## Patterns

### Composition API
- Always `<script setup lang="ts">` — never Options API
- Composables with `use` prefix for reusable logic
- Views for pages, Components for reusable blocks

### v-model for custom components

```vue
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
```

### provide/inject
- `AdminLayout` provides: sidebar collapsed state, toast handler
- Deep components inject directly — no prop drilling

### Slots
- `GlassPanel`: default + header + action slots
- `AppModal`: default (body) + footer slots
- Extend components via slots and props, not by editing source (Open/Closed)

### Teleport
- Modals and toasts render into `<body>` via `<Teleport to="body">`

---

## SOLID

- **S**: One component = one UI task. One composable = one domain. One service = one API domain.
- **O**: Extend via slots/props, not source edits.
- **L**: All v-model components follow `modelValue` + `update:modelValue` contract.
- **I**: Types split by domain. Composables expose only what consumers need.
- **D**: Components → composables → services → mock/real. Swap data source = change service only.

---

## DRY

- UI components written once, used everywhere
- Composables extract shared business logic from views
- Types: single `Supplier` interface used in service, mock, composable, and component
- CSS: single source of truth in `src/styles/` (alias `@styles`), images in `src/assets/images/` (alias `@images`)

---

## DDD (Domain-Driven Design)

Code organized by business domain:

- `suppliers`: [`types/supplier.ts`](../../frontend_vue/src/types/supplier.ts) → [`suppliersService.ts`](../../frontend_vue/src/services/suppliersService.ts) → [`mocks/suppliers.ts`](../../frontend_vue/src/services/mocks/suppliers.ts) → [`useSuppliers.ts`](../../frontend_vue/src/composables/useSuppliers.ts) → views
- `analytics`: [`types/analytics.ts`](../../frontend_vue/src/types/analytics.ts) → [`analyticsService.ts`](../../frontend_vue/src/services/analyticsService.ts) → [`mocks/analytics.ts`](../../frontend_vue/src/services/mocks/analytics.ts) → [`useAnalytics.ts`](../../frontend_vue/src/composables/useAnalytics.ts) → views
- `bcc`: [`types/bcc.ts`](../../frontend_vue/src/types/bcc.ts) → [`bccService.ts`](../../frontend_vue/src/services/bccService.ts) → [`mocks/bcc.ts`](../../frontend_vue/src/services/mocks/bcc.ts) → [`useBccRequest.ts`](../../frontend_vue/src/composables/useBccRequest.ts) → views
- `config`: [`types/config.ts`](../../frontend_vue/src/types/config.ts) → [`configService.ts`](../../frontend_vue/src/services/configService.ts) → [`mocks/config.ts`](../../frontend_vue/src/services/mocks/config.ts) → [`useCardConfig.ts`](../../frontend_vue/src/composables/useCardConfig.ts) → views

---

## Prohibitions

- NO Options API
- NO `data-i18n` attributes
- NO unnecessary `v-html` (only when translation contains HTML like `<br>`)
- NO unused imports
- NO direct DOM manipulation (`document.querySelector`) — use composable or ref
- NO `<a href>` for navigation — use `<router-link>`
- NO copying CSS into `frontend_vue/`
- NO custom i18n composables — use vue-i18n

---

## Verification Checklist

After every component/page/composable:

1. `npm run typecheck` — 0 TypeScript errors
2. `npm run lint` — 0 ESLint errors
3. `npm run dev` → check in browser
4. Verify existing pages still work (regression)
5. Switch language (RU/EN/LT) — translations in place
