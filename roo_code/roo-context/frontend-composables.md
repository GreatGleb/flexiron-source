# Composables Reference — Flexiron Enterprise

All composables are in [`frontend_vue/src/composables/`](../frontend_vue/src/composables/). 18 files total.

---

## Core / Utility Composables

### [`useDirtyCheck<T>(source: Ref<T>)`](../frontend_vue/src/composables/useDirtyCheck.ts)
JSON-serialization based dirty detection for clean-slate save UX.

```ts
const { isDirty, capture, reset, diff } = useDirtyCheck(form)
```

- `capture()` — snapshots current `source.value` as JSON string
- `reset()` — re-captures (same as capture)
- `diff(): Partial<T>` — shallow diff between current and snapshot; returns only changed keys for merge-patch
- `isDirty: Ref<boolean>` — reactive dirty flag via deep watch
- Internal: `safeParse()` fallback for JSON parse errors

### [`usePagination(defaultPageSize = 25)`](../frontend_vue/src/composables/usePagination.ts)
Reactive pagination state with computed helpers.

```ts
const pagination = usePagination(25)
// page, pageSize, total, totalPages, hasPrev, hasNext
// showingFrom, showingTo, pageNumbers(), goTo(), prev(), next(), reset()
```

- `pageNumbers()` — smart ellipsis logic (≤7 pages shows all, >7 shows windowed)
- `reset()` — sets page to 1

### [`useToast()`](../frontend_vue/src/composables/useToast.ts)
Reactive toast notification system.

```ts
const toast = useToast()
toast.show('message', 'success', 3000)
toast.success('Saved!')
toast.error('Failed!')
toast.info('Loading...')
toast.dismiss(id)
```

- `toasts: Ref<Toast[]>` — reactive list
- `ENTER_DELAY_MS = 50`, `EXIT_DURATION_MS = 500` for enter/exit animations
- Auto-dismiss after duration, manual dismiss available

### [`useHead({ title, description })`](../frontend_vue/src/composables/useHead.js)
Reactive document head manager.

```ts
useHead({ title: () => t('page.title'), description: 'Page description' })
```

- `watchEffect`-based — supports functions or strings
- Sets `document.title` and `<meta name="description">`

### [`useTooltip.ts`](../frontend_vue/src/composables/useTooltip.ts) — `vTooltip` directive
Custom tooltip directive registered globally in `main.js`.

```vue
<button v-tooltip="'Click to save'">Save</button>
```

- Creates fixed-position tooltip div with glassmorphism styling
- Smart positioning: flips above/below, avoids viewport edges
- Touch support for mobile
- CSS injected once via `ensureStyles()`

### [`useDragDrop<T>(items: T[])`](../frontend_vue/src/composables/useDragDrop.ts)
Generic drag-and-drop reorder for arrays of `{ id: string, order: number }`.

```ts
const { list, draggingId, onDragStart, onDragEnd, onDrop, setItems } = useDragDrop(items)
```

- Reorders array on drop, reassigns `order` indices
- Used in Configurator for section/field reorder

---

## Feature Flag Composables

### [`useFeatureFlag(flag: FeatureFlagKey)`](../frontend_vue/src/composables/useFeatureFlag.ts)
Simple computed ref wrapper.

```ts
const isKanbanEnabled = useFeatureFlag('supplierKanbanView')
// Usage: v-if="isKanbanEnabled"
```

- Returns `ComputedRef<boolean>`
- Reads from reactive `featureFlags` object in [`config/featureFlags.ts`](../frontend_vue/src/config/featureFlags.ts)

---

## Sidebar Composables

### [`useSidebar()`](../frontend_vue/src/composables/useSidebar.ts)
Module-level singleton state for admin sidebar.

```ts
const { collapsed, active, toggle, close, closeMobileDrawer } = useSidebar()
```

- `collapsed` — desktop mode (persisted to localStorage key `'sidebar-collapsed'`)
- `active` — mobile drawer mode (breakpoint 860px)
- Backdrop click closes mobile drawer
- Resize listener auto-closes drawer when crossing breakpoint

---

## Domain Composables

### Products

#### [`useProducts()`](../frontend_vue/src/composables/useProducts.ts)
Products list page state management.

```ts
const { items, loading, error, filters, pagination, load, deleteProduct, toggleSort } = useProducts()
```

- `filters: ProductFilters` — reactive with `search`, `categoryIds[]`, `sortBy`, `sortDir`
- Auto-loads on filter change (debounce via watch)
- `skipNextPageWatch` flag prevents double-fetch when filter reset triggers page change
- `toggleSort(col)` — cycles asc/desc or switches column
- `deleteProduct(id)` — calls API, shows toast, reloads

#### [`useProductCard(id: string)`](../frontend_vue/src/composables/useProductCard.ts)
Product card (edit page) state management.

```ts
const { product, form, fieldValues, linkedSuppliers, isAnythingDirty, save, discard, ... } = useProductCard(id)
```

- Three dirty trackers: basic fields (`useDirtyCheck`), dynamic field values (JSON compare), linked suppliers (JSON compare)
- `isAnythingDirty` — computed OR of all three
- NaN normalization: `watch` on form converts NaN to null for number inputs
- `getCategoryPath(categoryId)` — builds breadcrumb string (e.g. "Metal → Sheets")
- `addLinkedSupplier` / `removeLinkedSupplier` — manage supplier links
- `save()` — builds PATCH delta from dirty sources, calls `patchProduct`
- `discard()` — reloads from server
- Loads categories and suppliers list on init (for dropdowns)

### Suppliers

#### [`useSuppliers()`](../frontend_vue/src/composables/useSuppliers.ts)
Suppliers list page state management.

```ts
const { suppliers, loading, error, filters, pagination, load, resetFilters, changeStatus } = useSuppliers()
```

- `filters: SupplierFilters` — reactive with `search`, `status`, `categories[]`, `rating`
- `changeStatus(id, status)` — optimistic UI update (mutates before API call)
- Same `skipNextPageWatch` pattern as useProducts
- `resetFilters()` — clears all filters and resets pagination

#### [`useSupplierCard(id: string)`](../frontend_vue/src/composables/useSupplierCard.ts)
Supplier card (edit page) state management.

```ts
const { supplier, loading, saving, error, isDirty, load, save } = useSupplierCard(id)
```

- Uses `useDirtyCheck` on the entire `supplier` ref (SupplierCardData)
- `save()` — calls `patchSupplier` with merge-patch delta, re-captures snapshot
- Simple pattern: load → edit → save sends only changed fields

#### [`useSupplierCreate()`](../frontend_vue/src/composables/useSupplierCreate.ts)
Supplier creation form state.

```ts
const { supplier, saving, error, save, validate, reset } = useSupplierCreate()
```

- `emptyCard()` factory returns blank `SupplierCardData` with defaults
- `validate()` — checks `company` and `email` are non-empty
- `save()` — validates, POSTs, returns created card with server-assigned id
- `reset()` — resets to empty card

### Categories

#### [`useCategories()`](../frontend_vue/src/composables/useCategories.ts)
Categories list page state management.

```ts
const { items, loading, error, filters, load, deleteCategory } = useCategories()
```

- `filters: CategoryFilters` — reactive with `search`
- `deleteCategory(id)` — handles error codes: `CATEGORY_HAS_PRODUCTS`, `CATEGORY_HAS_CHILDREN`
- Auto-loads on filter change

#### [`useCategoryCard(id: string)`](../frontend_vue/src/composables/useCategoryCard.ts)
Category card (edit page) state management.

```ts
const { category, form, localFields, linkedSuppliers, isAnythingDirty, save, discard, addField, updateField, deleteField, reorderFields, ... } = useCategoryCard(id)
```

- Three dirty trackers: header fields (`useDirtyCheck`), own fields (JSON compare), linked suppliers (JSON compare)
- `localFields: Ref<CategoryField[]>` — working copy of fields with `tmp-` prefixed IDs for new fields
- `addField(field)` — creates field with `tmp-${Date.now()}` id
- `updateField(fieldId, delta)` — partial update of a field
- `deleteField(fieldId)` — removes and re-indexes order
- `reorderFields(newOrder)` — replaces entire array with new order
- `save()` — parallel PATCH (header + linkedSuppliers) + PUT (fields replacement)
- Loads suppliers list on init

### BCC (Blind Carbon Copy)

#### [`useBccRequest()`](../frontend_vue/src/composables/useBccRequest.ts)
BCC email request tool state management.

```ts
const { categories, recipients, history, selectedProductIds, template, sending, send, resetForm, ... } = useBccRequest()
```

- `categories: Ref<BccCategory[]>` — product categories for selection
- `recipients: Ref<BccRecipient[]>` — auto-filtered by selected products
- `recipientsLocked: Ref<boolean>` — when true, watcher doesn't overwrite recipients (e.g. preselected from URL)
- `template: BccEmailTemplate` — reactive email template with subject, body, attachments
- `send()` — validates selected recipients, sends with Idempotency-Key, returns requestId
- `resetForm()` — clears all selections and template
- Watcher on `selectedProductIds` triggers `refreshRecipients`

### Configurator

#### [`useCardConfig()`](../frontend_vue/src/composables/useCardConfig.ts)
Supplier card configurator state management.

```ts
const { fieldLibrary, sections, permissions, loading, saving, load, saveConfig, moveSection, toggleSection, ... } = useCardConfig()
```

- Loads three resources in parallel: field library, sections, permissions
- `saveConfig()` — atomic save batch: PUT all three simultaneously
- `moveSection(fromId, toId)` — reorder with order reassignment
- `toggleSection(id)` — collapse/expand in config builder
- `toggleSectionVisibility(id)` — show/hide in rendered card
- `renameSection(id, name)` — inline rename
- `toggleFieldVisibility(sectionId, fieldId)` — show/hide field in section
- `toggleFieldLibraryHidden(fieldId)` — hide field from library

### Analytics

#### [`useAnalytics(page: AnalyticsPageKey)`](../frontend_vue/src/composables/useAnalytics.ts)
Analytics page data fetching.

```ts
const { data, loading, error, load } = useAnalytics('dashboard')
```

- `page: AnalyticsPageKey` — one of: `'dashboard' | 'warehouse' | 'sales' | 'supply' | 'staff' | 'logistics' | 'pl-report' | 'deficit'`
- `data: Ref<DashboardData | null>` — contains `kpis`, `salesByCategory`, `alerts`, `sectionPreviews`
