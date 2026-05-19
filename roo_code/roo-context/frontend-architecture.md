# Frontend Architecture — Flexiron Enterprise

## Overview

**Stack**: Vue 3 (Composition API) + Vite + vue-i18n + TypeScript  
**Entry**: [`frontend_vue/src/main.js`](../frontend_vue/src/main.js) — creates app with router, i18n, tooltip directive  
**Root**: [`frontend_vue/src/App.vue`](../frontend_vue/src/App.vue) — LangSwitcher on public pages, bg-image/overlay, RouterView

## Project Structure

```
frontend_vue/src/
├── main.js                    # Entry point
├── App.vue                    # Root component
├── config/
│   └── featureFlags.ts        # 25 feature flags (16 page-level, 9 section-level)
├── router/
│   └── index.ts               # All routes + feature flag guard
├── types/
│   ├── api.ts                 # ApiResponse<T>, PaginatedResponse<T>, PaginationParams
│   ├── features.ts            # FeatureFlags interface (25 booleans)
│   ├── analytics.ts           # AnalyticsPageKey, DashboardData, KpiItem, etc.
│   ├── supplier.ts            # Supplier, SupplierCardData, SupplierFilters, etc.
│   ├── product.ts             # Product, ProductListItem, ProductFilters, etc.
│   ├── category.ts            # Category, CategoryField, CategoryListItem, etc.
│   ├── bcc.ts                 # BccCategory, BccRecipient, BccRequest, etc.
│   └── config.ts              # FieldDefinition, SectionConfig, PermissionMatrix
├── i18n/
│   ├── index.js               # vue-i18n setup (localStorage lang, fallback 'en')
│   ├── translations.js        # Merges public.js + admin.ts
│   ├── public.js              # RU/EN/LT — Landing, Auth, Register, About, Support, Terms, Screens
│   ├── admin.js               # RU/EN/LT — Sidebar, header, sub-nav (small)
│   └── admin.ts               # RU/EN/LT — Full admin SPA (2408 lines)
├── layouts/
│   └── AdminLayout.vue        # Admin shell: Sidebar + Topbar + RouterView + ToastContainer
├── composables/               # 18 composables (see frontend-composables.md)
├── services/                  # 7 services + mock layer (see frontend-services.md)
├── views/
│   ├── public/                # 8 pages: Landing, Login, Register, About, Support, Terms, Screens, NotFound
│   └── admin/
│       ├── analytics/         # 8 pages: Dashboard, Warehouse, Sales, Supply, Staff, Logistics, PlReport, Deficit
│       ├── products/          # 4 pages: Products, ProductCard, Categories, CategoryCard
│       └── suppliers/         # 5 pages: SuppliersList, SupplierCard, SupplierCreate, SupplierCardConfig, BccRequest
├── components/                # Shared UI components
│   ├── BackButton.vue, LangSwitcher.vue
│   ├── admin/                 # Admin-specific: AdminSidebar, AdminTopbar, AnalyticsCard, etc.
│   │   ├── AdminSidebar.vue, AdminTopbar.vue
│   │   ├── AnalyticsCard.vue, AnalyticsMetric.vue, AnalyticsSubNav.vue
│   │   ├── BarChartRow.vue, Breadcrumb.vue, ConfigSectionCard.vue
│   │   ├── FieldLibraryItem.vue, FileItem.vue, GlassPanel.vue
│   │   ├── KanbanCard.vue, KpiCard.vue, NoteItem.vue
│   │   ├── SupplierFormSections.vue, SvgIcon.vue, ToastContainer.vue, ViewTabs.vue
│   │   ├── AlertsTable.vue, HistoryTable.vue, PermissionsMatrix.vue
│   │   └── ui/               # UI primitives
│   │       ├── AppModal.vue, AppTag.vue, CheckboxList.vue
│   │       ├── CustomSelect.vue, DatePicker.vue, DropZone.vue
│   │       ├── EmailTemplate.vue, InputGroup.vue, MultiSelect.vue
│   │       ├── PriceInput.vue, RatingSelect.vue, RatingStars.vue
│   │       ├── SearchInput.vue, TagInput.vue
│   └── ...
└── styles/
    ├── erp-base.css           # Global base styles (CSS variables, typography, layout)
    ├── admin-core.scss        # Admin layout shell styles
    ├── admin/                 # 10 page CSS files + 30+ component partials
    └── public/                # public.css (glassmorphism landing/auth/register)
```

## Routing

Defined in [`frontend_vue/src/router/index.ts`](../frontend_vue/src/router/index.ts).

### Public Routes
| Name | Path | Component |
|------|------|-----------|
| `landing` | `/` | LandingPage.vue |
| `login` | `/login` | LoginPage.vue |
| `register` | `/register` | RegisterPage.vue |
| `about` | `/about` | AboutPage.vue |
| `support` | `/support` | SupportPage.vue |
| `terms` | `/terms` | TermsPage.vue |
| `screens` | `/screens` | ScreensPage.vue |
| `not-found` | `/404` | NotFoundPage.vue |

### Admin Routes (nested under `/admin`)
| Name | Path | Feature Flag |
|------|------|-------------|
| `admin-dashboard` | `/admin` | `adminDashboard` |
| `admin-warehouse` | `/admin/warehouse` | `adminWarehouse` |
| `admin-sales` | `/admin/sales` | `adminSales` |
| `admin-supply` | `/admin/supply` | `adminSupply` |
| `admin-staff` | `/admin/staff` | `adminStaff` |
| `admin-logistics` | `/admin/logistics` | `adminLogistics` |
| `admin-pl-report` | `/admin/pl-report` | `adminPlReport` |
| `admin-deficit` | `/admin/deficit` | `adminDeficit` |
| `admin-suppliers` | `/admin/suppliers` | `suppliersList` |
| `admin-supplier-config` | `/admin/suppliers/config` | `supplierCardConfig` |
| `admin-bcc-request` | `/admin/suppliers/bcc` | `bccRequest` |
| `admin-supplier-create` | `/admin/suppliers/create` | `supplierCreate` |
| `admin-supplier-card` | `/admin/suppliers/:id` | `supplierCard` |
| `admin-products` | `/admin/products` | `adminProducts` |
| `admin-product-card` | `/admin/products/:id` | `adminProducts` |
| `admin-categories` | `/admin/categories` | `adminCategories` |
| `admin-category-card` | `/admin/categories/:id` | `adminCategories` |

### Feature Flag Guard
```ts
router.beforeEach((to) => {
  const flag = to.meta?.featureFlag as FeatureFlagKey | undefined
  if (flag && !isEnabled(flag)) {
    return { name: 'not-found' }
  }
})
```

## Feature Flags

Defined in [`frontend_vue/src/config/featureFlags.ts`](../frontend_vue/src/config/featureFlags.ts).

- **25 flags total**: 16 page-level + 9 section-level
- **Defaults**: all `true` except `adminServices: false`
- **Overrides**: localStorage key `'ff_overrides'` — JSON `{ "flagName": false }`
- **Usage**: `useFeatureFlag('supplierKanbanView')` returns `ComputedRef<boolean>`
- **Section-level flags**: `dashboardAlerts`, `dashboardCharts`, `supplierKanbanView`, `supplierExport`, `bccHistory`, `permissionsEditor`, `categoryFieldReorder`, `categorySupplierLinks`, `productSupplierLinks`

## i18n

Setup in [`frontend_vue/src/i18n/index.js`](../frontend_vue/src/i18n/index.js):
- Language saved in localStorage key `'flexiron_lang'`
- Fallback: `'en'`
- Sets `document.documentElement.lang`

Translation files:
- [`public.js`](../frontend_vue/src/i18n/public.js) — RU/EN/LT for public pages (149+143+144 lines)
- [`admin.js`](../frontend_vue/src/i18n/admin.js) — RU/EN/LT for admin layout (sidebar, header)
- [`admin.ts`](../frontend_vue/src/i18n/admin.ts) — Full admin SPA translations (2408 lines)
- [`translations.js`](../frontend_vue/src/i18n/translations.js) — Merges public + admin

## Layout

### Public Pages
- No admin shell
- `LangSwitcher` shown at top
- Background: radial gradient with overlay divs
- Glassmorphism cards (backdrop-filter blur)

### Admin Pages
- [`AdminLayout.vue`](../frontend_vue/src/layouts/AdminLayout.vue) wraps all admin routes
- Components: `AdminSidebar` + `AdminTopbar` + `<RouterView>` + `ToastContainer`
- Sidebar: collapsible on desktop, drawer on mobile (breakpoint 860px)
- Uses `useSidebar` composable (module-level state, persisted to localStorage)

## Key Architectural Patterns

### 1. Clean-Slate Save UX
- Form loads data → captures snapshot via `useDirtyCheck`
- Save bar appears when `isDirty`
- PATCH sends only delta (merge-patch)
- Discard reloads from server (resets form)

### 2. Mock Architecture
- Environment variable `VITE_USE_MOCKS` controls mock vs real API
- Mock router in [`services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts)
- In-memory stores with `structuredClone` for data isolation
- 300ms delay simulation on all mock responses
- Idempotency cache (`Map<string, unknown>`) for POST safety

### 3. Feature Flag System
- Page-level: `router.beforeEach` redirects to 404
- Section-level: `v-if="isEnabled('flagName')"` in templates
- localStorage overrides for testing

### 4. Dynamic Fields (Zero-Code)
- Categories define custom fields (text, number, enum, boolean, date, tags, file)
- Products inherit fields from their category
- Field values stored as `ProductFieldValue[]` with `fieldId`, `fieldName`, `fieldType`, `value`
- Configurator UI allows admin to add/remove/reorder fields per category

### 5. BCC (Blind Carbon Copy) Email System
- Send price requests to multiple suppliers simultaneously
- Event-sourcing: each product × supplier is a row
- Idempotency-Key prevents double-send
- History tracking with accept/no-response actions

### 6. Supplier Card Configurator
- Field library: define reusable field definitions
- Sections: group fields into collapsible sections
- Permissions matrix: role-based + user-level overrides
- Drag-drop reorder for sections and fields

## CSS Architecture

- [`erp-base.css`](../frontend_vue/src/styles/erp-base.css) — CSS variables, typography (JetBrains Mono), layout grid, glassmorphism tokens
- [`admin-core.scss`](../frontend_vue/src/styles/admin-core.scss) — Admin shell (sidebar, topbar, main content area)
- Page-specific CSS in `styles/admin/` directory
- Component CSS as `<style scoped>` or partials in `styles/admin/`
- Public CSS in `styles/public/public.css` — landing, auth, register glassmorphism styles

## Design System Tokens (from erp-base.css)

- **Font**: Inter (body), JetBrains Mono (mono/data)
- **Colors**: CSS variables `--color-bg`, `--color-surface`, `--color-text`, `--color-primary`, etc.
- **Glassmorphism**: `--glass-bg`, `--glass-border`, `--glass-blur` (backdrop-filter)
- **Spacing**: 4px grid base
- **Border radius**: 8px (cards), 6px (buttons), 4px (inputs)
