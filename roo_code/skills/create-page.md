---
name: create-page
description: Create a new Vue 3 admin page from scratch based on TZ specs in toDo/. Phase-by-phase discipline — complete each phase fully, validate, then proceed.
user_invocable: true
arguments:
  - name: page
    description: "Page identifier (e.g., products-list, product-card, customers, orders, services, low-stock)"
    required: true
---

# Create New Admin Page from Scratch

Build a new admin page in `frontend_vue/` based on TZ specs. **Phase-by-phase discipline** — complete each phase fully, validate, then proceed. Never generate an entire page in one step.

---

## CRITICAL RULES

1. **NEVER skip a phase** — every phase is mandatory
2. **NEVER generate >60 lines per file in one step** — split into multiple edits
3. **NEVER guess data shapes or HTTP methods** — read TZ and api-contract first
4. **ALWAYS run typecheck after each phase** — catch errors immediately
5. **ALWAYS use existing components** — never recreate what's in `src/components/admin/`
6. **Done ≠ typecheck+lint** — final verification = plan→files→typecheck→lint→contract sync→browser walk-through golden path
7. **IF save-mode is unclear** — STOP and ask: "Clean-slate (Save-batch) or quick-action (immediate)?"
8. **IF anything is unclear** — STOP and ask
9. **Verify every code claim** — before stating "X exists / is used / is named Y": state the Grep or Read query, run it, show the result, then conclude. Never from logic or memory alone.
10. **STOP after every Phase** — after completing each Phase (0–10), output the stop block and wait for explicit confirmation before proceeding.

---

## Phase 0: Context & Spec Analysis

Read **before writing a single line of code**:

### Step 0a — vue-rules
Read `vue-rules` skill completely. Pay attention to:
- Save UX (clean-slate vs quick-action) — determines Phase 4 architecture
- HTTP methods — determines Phase 3 service signatures
- All pitfalls (#1–#28) — apply from the start, not as a hotfix after

### Step 0b — TZ Sources
Read all relevant docs:
- `toDo/Flexiron_ERP_CRM.md` — functional requirements for this section
- `toDo/Flexiron_ERP_Process_Algorithm.md` — business process algorithms
- `toDo/design/screen_specs/[XX.X_Page].md` — detailed screen spec (if exists)
- `toDo/design/Flexiron_ERP_Sitemap.md` — navigation placement, section hierarchy

### Step 0c — Project Context (skip if already read this session)
- `frontend_vue/CLAUDE.md` — patterns, prohibitions, pitfalls
- `frontend_vue/src/router/index.ts` — existing routes (verify names before using)
- `frontend_vue/src/i18n/admin/` — existing domain translation files (layout, dashboard, products, categories, suppliers, bcc, cardConfig, analytics, common)
- `frontend_vue/src/components/admin/` — available components (use, don't recreate)
- `frontend_vue/src/types/` — existing TypeScript types (reuse where possible)
- `frontend_vue/src/config/featureFlags.ts` — existing flags
- `toDo/admin-api-contract.md` — **contract-first**: add a new section for this domain BEFORE writing any service/composable

### Checkpoint 0 — Extract and OUTPUT before proceeding:

```
Page goal: (1 sentence)
Sections: (every visual block)
Key entities: (data objects + fields + types)
User actions: (buttons, forms, filters, modals, drag-drop)
Related pages: (links in, links out)
API endpoints needed: (METHOD /path — per operation)
Save mode decision: clean-slate / quick-action / mixed (ask if unclear)
Existing components usable: (list from src/components/admin/)
Existing types reusable: (list from src/types/)
Route path: /admin/...
Feature flag name: admin[PageName]
```

**IF any field is empty → re-read TZ docs. Do not proceed.**

```
⏸ STOP — Phase 0: Context & Spec Analysis
Done: all TZ sources read, Checkpoint 0 filled and output
Next: Phase 1 — TypeScript Types
Continue?
```

---

## Phase 1: TypeScript Types

### Check existing types first
- Does `src/types/[domain].ts` already exist? If yes, add to it, don't duplicate.
- Does `src/types/api.ts` have `PaginatedResponse<T>`, `ApiResponse<T>`? Reuse them.

### Create/extend `src/types/[domain].ts`
```ts
export interface ProductItem {
  id: string
  name: string
  categoryId: string | null   // nullable references → string | null, not undefined
  status: 'active' | 'archived'  // string unions, not enum
  price: number
  createdAt: string
}

export interface ProductFilters {
  search: string
  categoryId: string | null
  status: 'active' | 'archived' | null
}
```

Rules:
- All fields typed — no `any`
- Optional references: `string | null` (not `undefined`)
- Enums as string unions: `'active' | 'archived'` (not `enum`)
- Arrays initialize as `[]` not `null`
- Pagination: reuse `PaginatedResponse<T>` from `src/types/api.ts`
- For forms with dirty-check: create separate `[Entity]FormData` type if different from API shape
- **No redundant ListItem types:** Before creating `[Entity]ListItem`, compare its fields with the main `[Entity]` type. If they are identical, use `[Entity]` everywhere instead — don't create a duplicate. Only create a separate `ListItem` type if it genuinely has fewer fields or a different shape (e.g. no relations, no nested objects).

### Checkpoint 1
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors before Phase 2.**

```
⏸ STOP — Phase 1: TypeScript Types
Done: src/types/[domain].ts created/extended, typecheck ✅
Next: Phase 2 — Mock Data
Continue?
```

---

## Phase 2: Mock Data

### Create `src/services/mocks/[domain].ts`
```ts
import type { ProductItem } from '@/types/product'

const STORE: ProductItem[] = [
  { id: 'P-001', name: 'Steel Sheet 3mm', categoryId: 'CAT-01', status: 'active', price: 120.50, createdAt: '2025-01-15' },
  { id: 'P-002', name: 'Aluminum Profile 2m', categoryId: null, status: 'archived', price: 85.00, createdAt: '2025-02-20' },
  // 5-10 items — cover: null optional fields, varied statuses, edge-case strings
]

export function mockGetProducts(): ProductItem[] {
  return structuredClone(STORE)   // ALWAYS structuredClone — prevents mutation leaking between calls
}

export function mockGetProduct(id: string): ProductItem | undefined {
  return structuredClone(STORE.find(p => p.id === id))
}
```

**Pitfall #13:** `mockGetX()` must return `structuredClone(STORE)`, never the raw STORE reference. Otherwise reactive mutations in composables leak back to STORE without a server roundtrip — double items, phantom state.

Rules:
- Realistic data (not "foo", "test") — use domain-appropriate values
- **ALL mock data in English** — names, field labels, enum options, descriptions
- Cover edge cases: null optional fields, max-length strings, empty arrays
- `structuredClone` on all reads; mutations operate on STORE directly (simulates REST isolation)
- **Exception:** `structuredClone` crashes on Vue reactive proxies. For cloning reactive state → `JSON.parse(JSON.stringify(...))`
- **If domain has typed fields** (e.g. text/number/enum/boolean/email/date/file): STORE must contain at least one item per field type
- **If domain uses tmp-* IDs** (client assigns temporary ID before server save): mock mutations must replace `id.startsWith('tmp-')` entries with permanent IDs using a counter
- **If domain is hierarchical (tree structure):** use parent's pre-computed `inheritedX` chain instead of recursive traversal up the tree

### Register in `src/services/mocks/index.ts`
Add new domain routes to the mock router. Follow existing pattern exactly.

- **Register both endpoint variants:** For every `/api/domain` mock route, also register `/api/domain/translated` that delegates to the same handler. Composables may call either variant depending on whether the backend handles translation internally.
  ```ts
  httpMock.get('/api/categories', getCategories)
  httpMock.get('/api/categories/translated', getCategories) // same handler
  ```

- **Comprehensive domain mocks:** When creating mock data for domain entities (e.g., metal categories, supplier types), research and include all industry-standard fields. Don't just copy generic fields — ensure the mock dataset exercises all field types that real data would have.

### Checkpoint 2
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors.**

```
⏸ STOP — Phase 2: Mock Data
Done: src/services/mocks/[domain].ts created, registered in index.ts, typecheck ✅
Next: Phase 3 — Service Layer
Continue?
```

---

## Phase 3: Service Layer

### Write the contract first
Open `toDo/admin-api-contract.md` and **add a new section** for this domain. Use existing sections (suppliers, bcc, config) as structural template. Define before writing a single line of service code:
- Endpoint paths + HTTP methods (GET/POST/PATCH/PUT/DELETE)
- Request body shape (required vs optional fields, types)
- Response shape (envelope `ApiResponse<T>` or `PaginatedResponse<T>`)
- Error codes specific to this domain
- Idempotency requirements (if any POST is irreversible)
- Save mode per endpoint: clean-slate (PATCH delta) or quick-action (immediate)

**Only after the contract section is written** — implement the service functions against it.

### Create `src/services/[domain]Service.ts`
```ts
import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { ProductItem, ProductFilters } from '@/types/product'
import type { PaginatedResponse } from '@/types/api'

// LIST — GET with filters
export async function getProducts(filters: ProductFilters): Promise<PaginatedResponse<ProductItem>> {
  return apiGet('/api/products', filters as Record<string, string>)
}

// GET single
export async function getProduct(id: string): Promise<ProductItem> {
  return apiGet(`/api/products/${id}`)
}

// CREATE — POST
export async function createProduct(data: Omit<ProductItem, 'id' | 'createdAt'>): Promise<ProductItem> {
  return apiPost('/api/products', data)
}

// UPDATE — PATCH with delta (only changed fields)
export async function patchProduct(id: string, delta: Partial<ProductItem>): Promise<ProductItem> {
  return apiPatch(`/api/products/${id}`, delta)
}

// DELETE
export async function deleteProduct(id: string): Promise<void> {
  return apiDelete(`/api/products/${id}`)
}
```

### HTTP method guide
| Operation | Method | When |
|---|---|---|
| Read collection | GET | Always |
| Read single | GET | Always |
| Create | POST | New resource |
| Update single (delta) | PATCH | Editable card, status change, any partial update |
| Update bulk/replace | PUT | Entire collection replace (config sections, permissions) |
| Action (non-CRUD) | POST | BCC send, accept response, log event |
| Delete | DELETE | Remove resource |

**PATCH sends only changed fields** — never the full object. Composable uses `useDirtyCheck.diff()` to produce the delta.

**Clearing string fields:** When a string field can be cleared by the user (e.g. description, notes), never use a falsy check like `if (data.description)` — this rejects empty string `""` and the old value persists. Use explicit `!== undefined`:
```ts
// ❌ Bad — empty string is falsy, field never clears
if (data.description) { payload.description = data.description }

// ✅ Good — explicit undefined check, sends null to clear
if (data.description !== undefined) { payload.description = data.description || null }
```
Apply this pattern to every optional string field that the user can clear.

**Idempotency-Key** header on irreversible POST (send email, log event): use `newIdempotencyKey()` from `services/api.ts`.

**File uploads** — always separate from main save:
```ts
// DropZone uploads immediately on drop — NOT as part of Save
import { uploadFile } from './uploadsService'
// DropZone emits: { fileId, name, size, mime, url }
// Save PATCH collects: fileIds: string[]
// Never embed binary data in JSON payload
```

- **Verify /translated endpoint necessity:** After any backend refactoring, verify which endpoints still need the `/translated` suffix. If the backend now returns translated data from the base endpoint (`/api/domain`), use that directly instead of `/api/domain/translated`.

### Update api-contract write-back
After implementing, open `toDo/admin-api-contract.md` and:
- Remove `"TBD"`, `"UI — separate iteration"` markers for implemented endpoints
- Add reference to actual `Page.vue` and composable

### Checkpoint 3
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors.**

```
⏸ STOP — Phase 3: Service Layer
Done: contract in admin-api-contract.md written, [domain]Service.ts created, typecheck ✅
Next: Phase 4 — Composable
Continue?
```

---

## Phase 4: Composable

### Decide save mode first (from Phase 0)

**Clean-slate** (default for editable forms):
- All mutations in local Vue reactive state
- Server doesn't know until Save button clicked
- Page reload = rollback to server state
- Use `useDirtyCheck` to produce diff, activate Save button

**Quick-action** (immediate server call):
- Kanban drag-drop status change
- Delete with confirm modal
- File upload on drop
- Accept/reject actions in history

**If mixed** — separate composable functions: `saveForm()` (clean-slate) + `deleteItem()` (quick-action).

### Create `src/composables/use[Domain].ts`

**For list page:**
```ts
import { ref } from 'vue'
import { getProducts, createProduct, deleteProduct } from '@/services/productService'
import { usePagination } from '@/composables/usePagination'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import type { ProductItem, ProductFilters } from '@/types/product'

export function useProducts() {
  const { t } = useI18n()
  const toast = useToast()
  const items = ref<ProductItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = ref<ProductFilters>({ search: '', categoryId: null, status: null })
  const { page, pageSize, total, setTotal } = usePagination()

  async function load() {
    loading.value = true
    error.value = null
    try {
      const result = await getProducts(filters.value)
      items.value = result.data
      setTotal(result.total)
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  // Quick-action operations (create, delete) — always with toast feedback
  async function handleCreate(data: CreateProductData) {
    try {
      await createProduct(data)
      toast.success(t('products.toast_created'))
      await load()  // reload list
    } catch (e) {
      toast.error(t('products.toast_error_create'))
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct(id)
      toast.success(t('products.toast_deleted'))
      await load()
    } catch (e) {
      toast.error(t('products.toast_error_delete'))
    }
  }

  return { items, loading, error, filters, page, pageSize, total, load, handleCreate, handleDelete }
}
```

**IMPORTANT — `initialized` flag for filter watcher (Pitfall #20):**
If the page has filters/search inside a GlassPanel AND uses `watch(filters, load, { deep: true })`, add an `initialized` flag to prevent the skeleton loader from showing on every filter change (which hides the search field and loses focus):
```ts
let initialized = false

async function load() {
  if (!initialized) loading.value = true  // skeleton only on first load
  try {
    const result = await getProducts(filters.value)
    items.value = result.data
    initialized = true
  } finally {
    loading.value = false
  }
}
```
See [`vue-rules.md`](roo_code/skills/vue-rules.md) Pitfall #20 for full explanation.
```

**For detail/form page with dirty-check:**
```ts
import { ref } from 'vue'
import { getProduct, patchProduct } from '@/services/productService'
import { useDirtyCheck } from '@/composables/useDirtyCheck'
import type { ProductItem } from '@/types/product'

export function useProductCard(id: string) {
  const item = ref<ProductItem | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const { isDirty, track, diff, reset } = useDirtyCheck<ProductItem>()

  async function load() {
    loading.value = true
    try {
      item.value = await getProduct(id)
      track(item.value)   // start dirty tracking from server state
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!item.value || !isDirty.value) return
    saving.value = true
    try {
      const delta = diff(item.value)   // only changed top-level keys
      await patchProduct(id, delta)
      track(item.value)   // reset dirty baseline
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (item.value) {
      item.value = JSON.parse(JSON.stringify(/* server snapshot via track */{}))
      reset()
    }
  }

  return { item, loading, saving, isDirty, load, save, discard }
}
```

Rules:
- Expose ONLY what the view needs
- `load()` called from view's `onMounted`
- Error: `ref<string | null>(null)` — string, not raw Error object
- Filters are reactive refs — view v-models into them, watch triggers reload

- **Use watchEffect for dirty checks on reactive proxies:** `watch({ deep: true })` internally calls `structuredClone` on reactive proxies, which throws `DOMException`. Use `watchEffect` instead — it doesn't call `structuredClone` on proxies, and inside the effect you can safely call `toRaw()` for serialization:
  ```ts
  // ❌ Bad: watch + deep: true on reactive proxy
  watch(source, (newVal) => { ... }, { deep: true })
  
  // ✅ Good: watchEffect for dirty check
  watchEffect(() => {
    const raw = JSON.parse(JSON.stringify(toRaw(source.value)))
    // use raw for dirty check comparison
  })
  ```

- **Never use watch getter + toRaw():** `watch(() => toRaw(source.value), ...)` breaks dependency tracking because `toRaw()` extracts the raw object, so Vue loses visibility into nested property changes. Always use `watchEffect` when you need both raw snapshots and reactive tracking.

### Checkpoint 4
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors.**

```
⏸ STOP — Phase 4: Composable
Done: use[Domain].ts created (+ use[Domain]Card.ts if card exists), typecheck ✅
Next: Phase 5 — i18n Translations
Continue?
```

---

## Phase 5: i18n Translations

Add all keys **before** writing the template — avoids missing-key errors in browser.

### Add to `src/i18n/admin/[domain].ts` — create or update the domain file with all 3 languages

Each domain file exports a single object with `ru`, `en`, `lt` keys nested inside:

```ts
// src/i18n/admin/products.ts
export const adminProducts = {
  ru: {
    products: {
      title: 'Товары',
      header_title: 'Каталог товаров',
      search_placeholder: 'Поиск по названию...',
      filter_category_all: 'Все категории',
      filter_status_all: 'Все статусы',
      empty: 'Товары не найдены',
      btn_create: 'Добавить товар',
      btn_save: 'Сохранить',
      btn_discard: 'Отмена',
      // ... every label, placeholder, tooltip, button, error, empty state
    },
  },
  en: {
    products: {
      title: 'Products',
      header_title: 'Product Catalog',
      search_placeholder: 'Search by name...',
      filter_category_all: 'All categories',
      filter_status_all: 'All statuses',
      empty: 'No products found',
      btn_create: 'Add product',
      btn_save: 'Save',
      btn_discard: 'Discard',
    },
  },
  lt: {
    products: {
      title: 'Prekės',
      header_title: 'Prekių katalogas',
      search_placeholder: 'Ieškoti pagal pavadinimą...',
      filter_category_all: 'Visos kategorijos',
      filter_status_all: 'Visos būsenos',
      empty: 'Prekių nerasta',
      btn_create: 'Pridėti prekę',
      btn_save: 'Išsaugoti',
      btn_discard: 'Atšaukti',
    },
  },
}
```

Rules:
- **If domain file doesn't exist** — create it in `src/i18n/admin/`
- **Export name** = `admin[Domain]` (e.g., `adminProducts`, `adminCategories`)
- **Key prefix** = domain name (`products.title`, `products.search_placeholder`)
- **Every** visible text string → translation key. Zero hardcoded text in template.
- **3 languages per file** — all RU/EN/LT together, not separate files per language
- Escape `@` in values: `name{'@'}company.com` (Pitfall #1)
- Count keys: RU/EN/LT counts must match exactly within each domain file
- For LT: reasonable approximations are acceptable, but key must exist in all 3
- For data coming from API/mocks: use `TranslatedString` type + `tf()` helper, NOT `resolveLabel()`
- For form inputs: use `mergeLocaleValue()` / `toTranslatedString()` utilities from `@/types/i18n`
- **Cross-reference i18n keys from composable/service:** After writing the composable (Phase 4) and before declaring Phase 5 done — grep all `t('...')` calls in the composable and service files. Every key used in `t()` must exist in the domain i18n file. Missing keys cause runtime display of raw key strings that typecheck+lint cannot catch.
- **No cross-namespace i18n references:** Never use `$t('otherDomain.key')` in a template or composable of a different domain. Each domain must have its own keys. If a key is shared (e.g. pagination `of`), duplicate it in each domain file rather than referencing another domain's namespace. Cross-namespace references break silently when the source domain is refactored.
- **Include ALL toast keys from composable:** The composable example in Phase 4 uses `toast_created`, `toast_error_create`, `toast_deleted`, `toast_error_delete`. Every toast call in the composable MUST have a corresponding i18n key. Grep the composable for `toast.success(t('` and `toast.error(t('` — each key must exist in the domain file.
- **Include ALL button/label keys from template:** The template will use `btn_create`, `btn_save`, `btn_discard`, `btn_delete`, `col_*`, `field_*`, `header_title`, `title`, `search_placeholder`, `filter_*`, `empty`, `tooltip_*`. Add all of them now to avoid missing-key errors in browser.
- **Include `title` key for useHead:** `useHead({ title: t('domain.title') })` is used in Phase 6. The `title` key MUST exist in the domain i18n file. Without it, the browser tab shows a raw key string.

- **Use mergeTranslatedString() for UI updates, not toTranslatedString():** `toTranslatedString(value, locale)` creates an object with only one locale filled — correct for API calls, but incorrect for UI updates (other locales get zeroed out). Use `mergeTranslatedString(existing, value, locale)` which preserves existing translations:
  ```ts
  // ❌ Bad: toTranslatedString() in computed setter
  set(val) { model.value.name = toTranslatedString(val, locale.value) }
  
  // ✅ Good: mergeTranslatedString() in computed setter
  set(val) { model.value.name = mergeTranslatedString(model.value.name, val, locale.value) }
  ```

### Checkpoint 5

**Mandatory checks before declaring Phase 5 done:**

1. **Key count parity:** RU === EN === LT for this domain file. Check with `grep -c "ru:"` / `grep -c "en:"` / `grep -c "lt:"`.
2. **Cross-reference composable keys:** Grep ALL `t('` calls in the composable (`src/composables/use[Domain].ts`) and service (`src/services/[domain]Service.ts`) files. Every key used in `t()` MUST exist in the domain i18n file. Missing keys cause runtime display of raw key strings that typecheck+lint cannot catch.
3. **No cross-namespace references:** Search the composable and template for `$t('` — if any reference points to a DIFFERENT domain (e.g. `$t('products.of')` in a services page), that's a bug. Each domain must have its own keys.
4. **No hardcoded text:** Search the template for any visible text strings not wrapped in `{{ t('...') }}` or `{{ $t('...') }}`.

```
⏸ STOP — Phase 5: i18n Translations
Done: src/i18n/admin/[domain].ts created/updated, all [domain].* keys added to RU/EN/LT, key counts match, composable keys cross-referenced ✅
Next: Phase 6 — Page Template Skeleton
Continue?
```

---

## Phase 6: Page Template — Skeleton

### Create `src/views/admin/[section]/[PageName]Page.vue`

**Step 6a — Read existing similar page first (design inheritance):**

Before writing a single line, read the closest existing page to understand layout, CSS class names, SCSS import pattern, and component usage:
- **List page** → read `src/views/admin/suppliers/SuppliersListPage.vue`
- **Card/detail page** → read `src/views/admin/suppliers/SupplierCardPage.vue`
- **Config/drag-drop page** → read `src/views/admin/suppliers/SupplierCardConfigPage.vue`
- Also check `src/styles/admin/components/` — find the closest existing SCSS file

Study:
- Root element class name pattern (e.g. `page-suppliers`, `page-supplier-card`)
- How GlassPanel is nested and what props it receives
- Save bar markup and class names
- Where and how `<style>` import is written at the bottom of the component
- How drag-and-drop is implemented if relevant

**Step 6b — Script block:**
```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useProducts } from '@/composables/useProducts'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
// ... other components (verify each exists in src/components/admin/)

const { t } = useI18n()
useHead({ title: t('products.title') })

const showProducts = useFeatureFlag('adminProducts')
const { items, loading, filters, load } = useProducts()

onMounted(load)
</script>
```

**Step 6b — Template skeleton (sections only, no data bindings yet):**
```vue
<template>
  <div class="page-products" data-test="page-products">

    <div class="page-header" data-test="products-header">
      <h1 class="page-title">{{ t('products.header_title') }}</h1>
    </div>

    <!-- Section: Filters -->
    <div class="filter-bar" data-test="products-filters">
      <!-- placeholders -->
    </div>

    <!-- Section: Main table -->
    <GlassPanel :loading="loading" data-test="products-table">
      <!-- content placeholder -->
    </GlassPanel>

  </div>
</template>
```

**Step 6c — CSS import (if page-specific styles exist):**
```vue
<style>
@import '@styles/admin/products.css';
</style>
```

**CSS organization — import shared, don't duplicate:**
Before writing page-specific CSS, check `src/styles/admin/components/` for existing shared CSS files (e.g. `_pagination.css`, `_entity-card-layout.css`, `_buttons.css`). If the page needs styles that already exist in a shared file, import it instead of duplicating:
```ts
import '@styles/admin/components/_pagination.css'
```
Never copy-paste shared CSS classes into page-specific files — this creates maintenance duplication (BUG-14 pattern).

Rules:
- `data-test="page-[domain]"` on root element
- `data-test="[domain]-[section]"` on every logical section — required for Playwright
- All sections from Phase 0 Checkpoint must have a corresponding `data-test` div
- **data-test alignment check:** After writing the template, grep the existing test spec file (`tests/e2e/admin/[section]/[domain].spec.ts`) for `[data-test="..."]` patterns. Every `data-test` value used in tests must exist in the template, and every `data-test` in the template must match the test expectations. Mismatches cause silent test failures that typecheck+lint cannot catch.
- `<GlassPanel>` wraps every logical panel
- `<h1 class="page-title">` in the view itself (AdminLayout `<h1 v-if="pageTitle">` is dead code)
- **Pitfall #9:** No `<!-- comments -->` inside `<template>` — they go to DOM. Comments only in `<script>`.
- CSS aliases: `@styles` for CSS, `@images` for images — **not** `@assets`
- **Pitfall #17:** Before `<SvgIcon name="X">` — grep SvgIcon.vue to confirm the name exists
- **Pitfall #16 + BUG-17:** If page uses `entity-action-bar`, `save-bar`, or any class from `_entity-card-layout.css` — import it explicitly (NOT in admin-core.scss):
  ```ts
  import '@styles/admin/components/_entity-card-layout.css'
  ```
- **BUG-18/19 prevention:** After writing page CSS, compare it with the closest existing page CSS. Verify:
  - Every CSS class used in the template is defined in the page CSS
  - `.empty-state` must be defined with `display:flex; flex-direction:column; align-items:center`
  - Search/filters inside GlassPanel (Pitfall #19) — no separate wrapper outside the panel

- **Always wrap TranslatedString with tf() in templates:** `{{ item.name }}` renders as `[object Object]` when the value is a `TranslatedString` object. Always use `{{ tf(item.name) }}` to get the translated text.
  
- **Use skeleton loading states, never text placeholders:** Replace `<div class="loading-state">{{ t('common.loading') }}</div>` with skeleton markup that mirrors the page layout. Use `<GlassPanel :loading="true" :skeleton-rows="5" />` for card/panel skeletons. This prevents layout shift and provides better UX.

### Checkpoint 6
```bash
cd frontend_vue && npm run typecheck && npm run lint
```
**Both must pass 0 errors.**

**Dead CSS check:** After writing the template and its CSS, grep every CSS class defined in the page's CSS file against the template. Any class defined but not used in the template is dead code — remove it. Dead CSS accumulates across pages and creates confusion during maintenance.

```
⏸ STOP — Phase 6: Page Template Skeleton
Done: [PageName]Page.vue (+ CardPage.vue) created with data-test sections, typecheck + lint ✅
Next: Phase 7 — Template Data Bindings
Continue?
```

---

## Phase 7: Template — Data Bindings

Fill in v-for / v-if / v-model / @click — one section per step, max 40 lines per edit.

### List section (data table):
```vue
<div v-if="!loading && items.length === 0" class="empty-state" data-test="[domain]-empty">
  <SvgIcon name="..." :width="48" :height="48" />
  <p>{{ t('[domain].empty') }}</p>
</div>
<div v-else class="data-table-wrapper">
  <table class="data-table">
    <thead>
      <tr>
        <th>{{ t('[domain].col_name') }}</th>
        <!-- ... -->
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="item in items"
        :key="item.id"
        class="[domain]-row"
        data-test="[domain]-row"
      >
        <td>
          <router-link
            :to="{ name: 'admin-[domain]-card', params: { id: item.id } }"
            class="name-link"
          >
            {{ tf(item.name) }}
          </router-link>
        </td>
        <!-- ... -->
        <td>
          <div class="[domain]-row-actions">
            <router-link
              v-tooltip="t('tooltip.view_details')"
              :to="{ name: 'admin-[domain]-card', params: { id: item.id } }"
              class="action-icon-btn action-edit"
              data-test="[domain]-view-btn"
              @click.stop
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </router-link>
            <button
              v-tooltip="t('[domain].btn_delete')"
              class="action-icon-btn action-danger"
              data-test="[domain]-delete-btn"
              @click.stop="openDeleteModal(item.id)"
            >
              <SvgIcon name="trash" :width="16" :height="16" />
            </button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```
Required CSS in `[domain]_list.css`:
```css
.[domain]-row td { transition: background 0.15s, color 0.15s; }
.[domain]-row td:first-child { font-weight: 500; color: rgba(255, 255, 255, 0.85); }
.[domain]-row:hover td:first-child { color: #fff; }
.[domain]-row-actions { display: flex; gap: 8px; justify-content: flex-end; }
.name-link {
  color: inherit;
  text-decoration: none;
  transition: text-decoration-color 0.2s ease;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
}
.name-link:hover {
  text-decoration-color: currentColor;
}
```

### Filter section:
```vue
<CustomSelect
  :options="categoryOptions"
  v-model="filters.categoryId"
  :placeholder="t('products.filter_category_all')"
/>
```

### Form fields (detail page):
```vue
<InputGroup :label="t('products.field_name')">
  <input v-model="item.name" type="text" />
</InputGroup>
```

### Navigation links to related pages (in page header):
```vue
<div class="entity-action-bar no-margin pos-static">
  <router-link :to="{ name: 'admin-target' }" class="btn btn-secondary">
    <SvgIcon name="folder" :width="18" :height="18" />
    <span>{{ t('section.title') }}</span>
  </router-link>
</div>
```
- `router-link` + `btn btn-secondary` — never a custom class, never `<a href>`
- `entity-action-bar no-margin pos-static` — ready container from `_entity-card-layout.css`

### Save bar (for dirty-check pages):
```vue
<div class="save-bar" v-if="isDirty" data-test="products-save-bar">
  <button @click="discard">{{ t('products.btn_discard') }}</button>
  <button @click="save" :disabled="saving">{{ t('products.btn_save') }}</button>
</div>
```

### Modal:
```vue
<AppModal :open="showCreateModal" @close="showCreateModal = false">
  <!-- form content -->
  <template #footer>
    <button @click="handleCreate">{{ t('products.btn_save') }}</button>
  </template>
</AppModal>
```

Rules:
- **Pitfall #10:** Route names must match exactly what's in `src/router/index.ts`. Verify by grep before using.
- All navigation: `<router-link :to="{ name: 'exact-route-name' }">` — never `<a href>`
- All text: `{{ t('key') }}` — never hardcoded strings
- Loading state: `:loading="loading"` on GlassPanel
- Empty state: separate `v-if` block with `data-test="[domain]-empty"`
- **Pitfall #12:** Before using `:class="{ hidden }"` or any generic class — grep existing CSS to ensure no global conflict
- Filters: `watch(filters, load, { deep: true })` — or `@change="load"` on each filter
- **Pitfall #20 (BUG-25):** If filters/search are inside GlassPanel AND use `watch(filters, load)` — add `initialized` flag to composable
- **BUG-20:** Every flex page header must have responsive breakpoints

- **Use computed get/set for TranslatedString form fields:** Never use direct `v-model` on a `TranslatedString` property. Instead, create a computed with get/set that wraps/unwraps the value:
  ```vue
  <!-- ❌ Bad: direct v-model on TranslatedString -->
  <input v-model="item.name" />
  
  <!-- ✅ Good: computed get/set -->
  <input v-model="localName" />
  ```
  ```ts
  const localName = computed({
    get: () => tf(model.value.name),
    set: (val) => { model.value.name = mergeTranslatedString(model.value.name, val, locale.value) }
  })
  ```

- **Add null-safe tf() checks in templates:** `tf()` can crash on `null`/`undefined` fields. Always add a guard:
  ```vue
  {{ item.name ? tf(item.name) : '—' }}
  ```

### Checkpoint 7

**Mandatory checks before declaring Phase 7 done:**

1. **Typecheck + lint:**
```bash
cd frontend_vue && npm run typecheck && npm run lint
```

2. **Browser verification:**
- Renders without console errors
- All `data-test` sections visible with mock data
- No layout breaks (flex, z-index, overflow)
- **Pitfall #14:** If using CustomSelect — use it consistently, no mix with native `<select>`

3. **i18n template audit:**
- Search template for `{{ ` — every `TranslatedString` value MUST be wrapped in `tf()` (e.g. `{{ tf(item.name) }}`, NOT `{{ item.name }}`)
- Search template for `$t('` — if any reference points to a DIFFERENT domain (e.g. `$t('products.xxx')` in a services page), that's a cross-namespace bug. Each domain must have its own keys.
- Search template for hardcoded visible text — every visible string must use `{{ t('key') }}` or `{{ $t('key') }}`

```
⏸ STOP — Phase 7: Template Data Bindings
Done: all v-for/v-if/v-model/@click bound, page opens in browser with data, typecheck + lint ✅, i18n template audit passed ✅
Next: Phase 8 — Route Registration & Integration
Continue?
```

---

## Phase 8: Route Registration & Integration

### Step 8a — Add route to `src/router/index.ts`
```ts
{
  path: '[domain]',
  name: 'admin-[domain]',
  component: () => import('@/views/admin/[section]/[PageName]Page.vue'),
  meta: { featureFlag: '[pageFlag]' },
},
// For list + card pair:
{
  path: '[domain]/:id',
  name: 'admin-[domain]-card',
  component: () => import('@/views/admin/[section]/[PageName]CardPage.vue'),
  meta: { featureFlag: '[pageFlag]' },
},
```

### Step 8b — Add feature flags to `src/config/featureFlags.ts`

**Two flag levels:**

```ts
// Page-level — protects entire route via beforeEnter guard
// In FeatureFlags type and defaultFlags:
admin[PageName]: boolean   // adminCategories, adminProducts etc.

// Section-level — hides page section via v-if if backend feature not ready
// Examples: categoryFieldReorder (drag-and-drop + PUT endpoint),
//           supplierKanbanView, dashboardAlerts
[domain][Feature]: boolean
```

Section-level flags in template:
```vue
<div v-if="useFeatureFlag('categoryFieldReorder').value">
  <!-- drag-and-drop + reorder buttons -->
</div>
```

Rule: **each feature with its own backend endpoint** — candidate for section-level flag.

### Step 8c — Add sidebar link to `src/components/admin/AdminSidebar.vue`
Find the correct nav section and add:
```vue
<router-link :to="{ name: 'admin-[domain]' }" class="sidebar-link">
  <SvgIcon name="[icon]" />
  <span>{{ t('[domain].title') }}</span>
</router-link>
```

### Step 8d — Update `src/views/public/ScreensPage.vue`
Add a card for the new page:
```vue
<router-link :to="{ name: 'admin-[domain]' }" class="screen-card">
  <span class="screen-id">XX.0</span>
  {{ t('[domain].header_title') }}
</router-link>
```

### Step 8e — Playwright flags file
Open `frontend_vue/tests/e2e/helpers/flags.ts` and add to `ALL_FLAGS_ENABLED`:
```ts
admin[PageName]: true,
```

### Checkpoint 8
```bash
cd frontend_vue && npm run typecheck && npm run lint
```
Browser:
- Click sidebar link → page loads at correct URL
- URL in address bar matches registered route
- Back-navigate to existing pages — no regression

```
⏸ STOP — Phase 8: Route Registration & Integration
Done: route, feature flags, sidebar, ScreensPage, flags.ts updated, typecheck + lint ✅
Next: Phase 9 — Verification
Continue?
```

---

## Phase 9: Verification

Full verification before declaring done.

### 9a — Static checks
```bash
cd frontend_vue && npm run typecheck && npm run lint
```

### 9b — Contract sync
Open `toDo/admin-api-contract.md`:
- Implemented endpoints marked (no "TBD" remaining)
- References to actual `Page.vue` and composable added

### 9c — Browser walk-through (golden path)
1. Navigate to the page via sidebar link
2. Mock data renders in all sections
3. Every filter/search input works
4. Open every modal — renders, closes on Escape and overlay click
5. For form pages: edit a field → Save bar appears → Save → dirty cleared
6. Navigation links in rows work (router-link to detail page)
7. **Language switch audit (RU → EN → LT):**
   - [ ] Switch to RU — all visible text translates to Russian
   - [ ] Switch to EN — all visible text translates to English
   - [ ] Switch to LT — all visible text translates to Lithuanian
   - [ ] No raw i18n keys visible (e.g. `services.toast_error_delete` showing as text)
   - [ ] No `[object Object]` visible (TranslatedString without `tf()`)
   - [ ] Browser tab title updates correctly (`useHead` + i18n)
   - [ ] Pagination text (e.g. "of", "page") uses domain's own keys, not cross-namespace references
   - [ ] Toast messages appear in correct language after actions

### 9d — Regression check
Open 2–3 existing pages (Dashboard, SuppliersListPage) — verify no new console errors.

### 9e — Pitfalls final pass
Run through vue-rules pitfalls #1–#28 for this page:
- [ ] #1: `@` in translations escaped
- [ ] #9: No comments inside `<template>`
- [ ] #10: All route names verified against router
- [ ] #12: No generic class names in `:class` bindings
- [ ] #13: Mock returns structuredClone, not raw ref
- [ ] #14: No mix of native + custom selects
- [ ] #15: Mock STORE in English; tests use dynamic values not hardcoded strings
- [ ] #16: Every component imports its own CSS — no borrowing from co-located components
- [ ] #17: Every `<SvgIcon name="X">` verified against SvgIcon.vue grep
- [ ] #18: Save bar uses `btn_discard_changes`; modal cancel uses `btn_discard`
- [ ] #19: Search/filters inside GlassPanel (same panel as the table)
- [ ] #20: Filter watcher composable uses `initialized` flag — no skeleton on filter reload
- [ ] #21: Sidebar has only section entry point; sub-pages link via `router-link.btn.btn-secondary`
- [ ] #22: Snapshot baseline updated if any UI element in snapshot zone changed
- [ ] #23: Any new `<Teleport>` root component has `inheritAttrs: false` + `v-bind="$attrs"`
- [ ] All `/api/domain` routes have corresponding `/api/domain/translated` mock routes
- [ ] All `{{ }}` expressions with TranslatedString values are wrapped in `tf()`
- [ ] All TranslatedString form fields use computed get/set, not direct v-model
- [ ] All dirty checks use `watchEffect` instead of `watch({ deep: true })`
- [ ] All UI translation updates use `mergeTranslatedString()` not `toTranslatedString()`
- [ ] Loading states use skeleton layouts, not text placeholders
- [ ] `tf()` has null guard for null/undefined safety

**Done = all 9a–9e passed. Not just typecheck.**

---

## ⏸ PAUSE — Full Testing Cycle Before Phase 10

**After Phase 9 is complete, STOP and report to the user:**

> "Phase 9 complete. Next — full testing cycle before writing tests:
> 1. `/pre-manual-check [plan]` — automated checks
> 2. Manual testing → `/add-bug [plan]` for each bug found
> 3. `/fix-bugs [plan]` — fix all bugs
> 4. `/update-skills [plan]` — update skills from bug lessons
> After this — confirm, and we'll start Phase 10."

**Only proceed to Phase 10 after explicit user confirmation that all steps above are done.**

**Why:** Tests written against buggy UI become invalid after fixes, snapshot baselines need regeneration, and test assumptions about behavior change. Writing tests last saves 40+ minutes of rework.

---

## Phase 10: Playwright Tests

Write E2E tests for the new page. Each page is a **separate deep audit** — not a template copy.

### Step 10a — Audit the page
List every:
- Visual section (with `data-test`)
- Interactive element (buttons, filters, modals, drag-drop)
- Form input and its validation
- API call (mock route or real)
- Edge case (empty list, API error, dirty-unsaved, invalid input)

```
⏸ STOP — Phase 10 Step 10a: Audit
Done: list of all sections, elements, test cases
Next: Step 10b — write spec file
Continue?
```

### Step 10b — Create `tests/e2e/admin/[section]/[domain].spec.ts`

Structure:
```ts
import { test, expect } from '@playwright/test'
import { enableAllFlags } from '../../helpers/flags'

test.beforeEach(async ({ context }) => {
  await enableAllFlags(context)
})

// 1. Load & no-crash (mandatory for every page)
test('[domain] › loads without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/admin/[path]')
  await expect(page.locator('[data-test="page-[domain]"]')).toBeVisible()
  expect(errors).toHaveLength(0)
})

// 2. Per-section visual snapshots (one test per section)
test('[domain] › header visual', async ({ page }) => {
  await page.goto('/admin/[path]')
  await expect(page.locator('[data-test="[domain]-header"]')).toHaveScreenshot('[domain]-header.png')
})

test('[domain] › main table visual', async ({ page }) => {
  await page.goto('/admin/[path]')
  await expect(page.locator('[data-test="[domain]-table"]')).toHaveScreenshot('[domain]-table.png')
})

// 3. DOM assertions on data-test (every critical section)
test('[domain] › all sections visible', async ({ page }) => {
  await page.goto('/admin/[path]')
  await expect(page.locator('[data-test="[domain]-filters"]')).toBeVisible()
  await expect(page.locator('[data-test="[domain]-table"]')).toBeVisible()
})

// 4. Functional tests (specific to this page — not a template)
test('[domain] › search filters list', async ({ page }) => {
  await page.goto('/admin/[path]')
  await page.fill('[data-test="search-input"]', 'Steel')
  await expect(page.locator('[data-test="[domain]-row"]')).toHaveCount(1)
})

// 5. i18n
test('[domain] › translations RU/EN/LT', async ({ page }) => {
  await page.goto('/admin/[path]')
  // ... switch language, verify key phrase translates
})
```

### Playwright rules

**Import:** always `import { test, expect } from '../../fixtures'` — NOT from `@playwright/test`.
`fixtures.ts` sets `flexiron_lang: 'en'` + all feature flags before every page load.

**API route interception — mandatory for every spec:**
Every E2E test spec MUST intercept API calls via `page.route()` to prevent real HTTP requests that fail in CI/headless mode. Add a `beforeEach` block that registers mock routes for ALL endpoints used by the page:
```ts
test.beforeEach(async ({ page }) => {
  await page.route('**/api/services/**', async (route) => {
    // fulfill with mock data matching the service response shape
    await route.fulfill({ json: { data: [...] } })
  })
  // repeat for every endpoint: GET list, GET single, POST, PATCH, DELETE
})
```
For tests that verify specific API responses (409 error, validation error), use per-test `page.route()` overrides.

**Test data independence — critical:**
- **Never hardcode mock data values** (category names, field names, counts) in tests.
- **Search tests**: read the value dynamically from the first row:
  ```ts
  const term = (await rows.first().locator('td').first().textContent())!.trim().split(' ')[0]!
  await searchInput.fill(term)
  const after = await rows.count()
  expect(after).toBeGreaterThan(0)
  expect(after).toBeLessThan(totalBefore) // relative, not absolute
  ```
- **Count assertions**: use relative (+1 / -1 after action), not absolute numbers:
  ```ts
  const before = await rows.count()
  await addItem()
  await expect(rows).toHaveCount(before + 1) // not .toHaveCount(7)
  ```
- **For API-specific assertions** (e.g. 409 error on delete): intercept with `page.route()` instead of relying on mock STORE state.

**Test structure:**
- **Many small `test()`** instead of one big — each failure names exactly what broke
- **`expect.soft()`** inside a test when multiple assertions are logically linked
- **Per-section snapshots** not full-page — failure message names the exact section
- **`data-test` attrs** on every section — assert `toBeVisible()` separately
- **Wait for DOM markers**, not `networkidle` — mock layer doesn't trigger network events
- **SPA navigation** via `router-link` clicks (not `page.goto`) for state that must persist across pages

```
⏸ STOP — Phase 10 Step 10b: Spec written
Done: [domain].spec.ts created — load, snapshots, DOM, functional, i18n tests
Next: Step 10c — register in smoke/navigation/feature-flags
Continue?
```

### Step 10c — Register in cross-cutting specs

In `tests/e2e/smoke.spec.ts`: add the new page to the smoke list.
In `tests/e2e/navigation.spec.ts`: add the route to the navigation matrix.
In `tests/e2e/feature-flags.spec.ts`: add the page-level flag test (flag OFF → /404).

```
⏸ STOP — Phase 10 Step 10c: Registration
Done: page added to smoke, navigation, feature-flags specs
Next: Step 10d — run tests
Continue?
```

### Step 10d — Run tests
```bash
cd frontend_vue && npx playwright test admin/[section]/[domain]
```

First run (no baseline): `npx playwright test --update-snapshots admin/[section]/[domain]`

**Checkpoint 10:** All tests green. Snapshots created. No regressions in other spec files.

```
⏸ STOP — Phase 10: Playwright Tests
Done: [domain].spec.ts created, registered in smoke/navigation/feature-flags, all tests green ✅
Page fully complete.
```

---

## Available Components (use these, don't recreate)

### Layout & containers
- `GlassPanel` — main panel (props: `loading`, `skeletonRows`, `title`, `badge`)
- `ViewTabs` — tab switcher

### Data display
- `KpiCard` — metric card (props: `label`, `value`, `trend`)
- `AnalyticsCard`, `AnalyticsMetric`, `BarChartRow`
- `KanbanCard`, `FileItem`, `NoteItem`, `FieldLibraryItem`
- `SvgIcon` — icons

### Form controls (all v-model)
- `CustomSelect` — single select
- `MultiSelect` — multi-select
- `TagInput` — tag chips
- `DatePicker` — date
- `PriceInput` — price + currency
- `RatingStars` / `RatingSelect` — rating
- `CheckboxList` — checkbox group
- `DropZone` — file upload (emits `uploaded: UploadedFile[]` with `fileId` immediately on drop)
- `InputGroup` — labeled input wrapper
- `SearchInput` — search with debounce
- `EmailTemplate` — email draft

### Tables
- `AlertsTable`, `HistoryTable`, `PermissionsMatrix`

### UI
- `AppModal` (slots: default body + `#footer`; closes on Escape + overlay click)
- `AppTag` — badge/chip
- `ToastContainer` — via `useToast()` composable

### Composables ready to use
- `usePagination()` — page/pageSize/total
- `useDirtyCheck<T>()` — isDirty, track, diff, reset
- `useDragDrop()` — drag-and-drop reordering
- `useToast()` — success/error notifications
- `useFeatureFlag('flagName')` — computed<boolean>
- `useHead({ title })` — document title

---

## Page-Type Quick Reference

| Type | Key composables | Key components | Save mode |
|---|---|---|---|
| List | `useX()`, `usePagination()` | GlassPanel, CustomSelect, SearchInput | n/a (read-only) |
| Detail/card | `useXCard()`, `useDirtyCheck()` | GlassPanel, InputGroup, AppModal | clean-slate |
| Create form | `useXCard()` | GlassPanel, InputGroup | quick-action (POST on submit) |
| Config/admin | `useXConfig()`, `useDragDrop()` | GlassPanel, PermissionsMatrix | clean-slate (PUT bulk on Save) |
| Dashboard | `useAnalytics('key')` | KpiCard, BarChartRow, AnalyticsCard | n/a |
