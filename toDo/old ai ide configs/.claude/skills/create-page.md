---
name: create-page
description: Create a new Vue 3 admin page from scratch based on TZ specs in toDo/
user_invocable: true
arguments:
  - name: page
    description: "Page identifier (e.g., products-list, product-card, customers, orders, services, low-stock)"
    required: true
---

> ⚠️ Кастомный скил — НЕ вызывать через `Skill()`. Читать через `Read` и выполнять inline.

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
7. **IF save-mode is unclear** — STOP and ask: «Это clean-slate (Save-batch) или quick-action (immediate)?»
8. **IF anything is unclear** — STOP and ask
9. **Verify every code claim** — before stating "X exists / is used / is named Y": state the Grep or Read query, run it, show the result, then conclude. Never from logic or memory alone.
10. **STOP after every Phase** — after completing each Phase (0–10), output the stop block and wait for explicit confirmation before proceeding:

```
⏸ СТОП — Phase N: [название]
Сделано: [что именно — 1-3 пункта]
Следующая: Phase N+1 — [название]
Продолжить?
```

---

## Phase 0: Context & Spec Analysis

Read **before writing a single line of code**:

### Step 0a — vue-rules
Read `vue-rules` skill completely. Pay attention to:
- Save UX (clean-slate vs quick-action) — determines Phase 4 architecture
- HTTP methods — determines Phase 3 service signatures
- All pitfalls (#1–#23) — apply from the start, not as a hotfix after

### Step 0b — TZ Sources
Read all relevant docs:
- `toDo/Flexiron_ERP_CRM.md` — functional requirements for this section
- `toDo/Flexiron_ERP_Process_Algorithm.md` — business process algorithms
- `toDo/design/screen_specs/[XX.X_Page].md` — detailed screen spec (if exists)
- `toDo/design/Flexiron_ERP_Sitemap.md` — navigation placement, section hierarchy

### Step 0c — Project Context (skip if already read this session)
- `frontend_vue/CLAUDE.md` — patterns, prohibitions, pitfalls
- `frontend_vue/src/router/index.ts` — existing routes (verify names before using)
- `frontend_vue/src/i18n/admin.ts` — existing translation keys and prefixes
- `frontend_vue/src/components/admin/` — available components (use, don't recreate)
- `frontend_vue/src/types/` — existing TypeScript types (reuse where possible)
- `frontend_vue/src/config/featureFlags.ts` — existing flags
- `toDo/admin-api-contract.md` — **contract-first**: add a new section for this domain (endpoints, methods, request/response shapes) BEFORE writing any service/composable. Follow the structure of existing sections in the file.

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
⏸ СТОП — Phase 0: Context & Spec Analysis
Сделано: все TZ-источники прочитаны, Checkpoint 0 заполнен и выведен
Следующая: Phase 1 — TypeScript Types
Продолжить?
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

### Checkpoint 1
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors before Phase 2.**

```
⏸ СТОП — Phase 1: TypeScript Types
Сделано: src/types/[domain].ts создан/дополнен, typecheck ✅
Следующая: Phase 2 — Mock Data
Продолжить?
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
- **ALL mock data in English** — names, field labels, enum options, descriptions. Russian strings in STORE cause tests to break when mock data changes, since tests are always run with English locale.
- Cover edge cases: null optional fields, max-length strings, empty arrays
- `structuredClone` on all reads; mutations operate on STORE directly (simulates REST isolation)
- **Exception:** `structuredClone` crashes on Vue reactive proxies. For cloning reactive state → `JSON.parse(JSON.stringify(...))`
- **If domain has typed fields** (e.g. text/number/enum/boolean/email/date/file): STORE must contain at least one item per field type — otherwise `v-if="field.type === 'boolean'"` branches can never be tested in browser or Playwright
- **If domain uses tmp-* IDs** (client assigns temporary ID before server save): mock mutations (PUT/POST) must replace `id.startsWith('tmp-')` entries with permanent IDs using a counter (`let fieldSeq = 1000`). Server contract guarantees this — mock must simulate it
- **If domain is hierarchical (tree structure):** use parent's pre-computed `inheritedX` chain instead of recursive traversal up the tree (recursive traversal duplicates fields from grandparent). After mutating a parent's fields, cascade to all descendants with a recursive helper. Sort: depth-first for full list; flat sort by name for filtered/search results (filtered results may not include their tree parents)

  ```ts
  // ПЛОХО — рекурсивный обход вверх (дублирует поля):
  let cur = parentId
  while (cur) { chain.unshift([...parent.inheritedFields, ...parent.fields]); cur = parent.parentId }
  
  // ХОРОШО — берём у прямого родителя (он уже хранит полную накопленную цепочку):
  const parent = STORE.find(c => c.id === parentId)
  const inheritedFields = parent ? [...parent.inheritedFields, ...parent.fields] : []
  ```

### Register in `src/services/mocks/index.ts`
Add new domain routes to the mock router. Follow existing pattern exactly.

### Checkpoint 2
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors.**

```
⏸ СТОП — Phase 2: Mock Data
Сделано: src/services/mocks/[domain].ts создан, зарегистрирован в index.ts, typecheck ✅
Следующая: Phase 3 — Service Layer
Продолжить?
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

**Idempotency-Key** header on irreversible POST (send email, log event): use `newIdempotencyKey()` from `services/api.ts`.

**File uploads** — always separate from main save:
```ts
// DropZone uploads immediately on drop — NOT as part of Save
import { uploadFile } from './uploadsService'
// DropZone emits: { fileId, name, size, mime, url }
// Save PATCH collects: fileIds: string[]
// Never embed binary data in JSON payload
```

### Update api-contract write-back
After implementing, open `toDo/admin-api-contract.md` and:
- Remove `"TBD"`, `"UI — отдельная итерация"` markers for implemented endpoints
- Add reference to actual `Page.vue` and composable

### Checkpoint 3
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors.**

```
⏸ СТОП — Phase 3: Service Layer
Сделано: контракт в admin-api-contract.md написан, [domain]Service.ts создан, typecheck ✅
Следующая: Phase 4 — Composable
Продолжить?
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
import { getProducts } from '@/services/productService'
import { usePagination } from '@/composables/usePagination'
import type { ProductItem, ProductFilters } from '@/types/product'

export function useProducts() {
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

  return { items, loading, error, filters, page, pageSize, total, load }
}
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

### Checkpoint 4
```bash
cd frontend_vue && npm run typecheck
```
**Must pass 0 errors.**

```
⏸ СТОП — Phase 4: Composable
Сделано: use[Domain].ts создан (+ use[Domain]Card.ts если есть карточка), typecheck ✅
Следующая: Phase 5 — i18n Translations
Продолжить?
```

---

## Phase 5: i18n Translations

Add all keys **before** writing the template — avoids missing-key errors in browser.

### Add to `src/i18n/admin.ts` — all 3 languages simultaneously

```ts
// adminRu.[domain]:
[domain]: {
  title: 'Товары',
  header_title: 'Каталог товаров',
  search_placeholder: 'Поиск по наименованию...',
  filter_category_all: 'Все категории',
  filter_status_all: 'Все статусы',
  empty: 'Товары не найдены',
  btn_create: 'Добавить товар',
  btn_save: 'Сохранить',
  btn_discard: 'Отменить',
  // ... every label, placeholder, tooltip, button, error, empty state
},
```

Rules:
- Key prefix = domain name (`products.title`, `products.search_placeholder`)
- **Every** visible text string → translation key. Zero hardcoded text in template.
- Escape `@` in values: `name{'@'}company.com` (Pitfall #1)
- Count keys: RU/EN/LT counts must match exactly
- For LT: reasonable approximations are acceptable, but key must exist in all 3

### Checkpoint 5
Verify key counts: RU === EN === LT for this domain prefix. Check with grep if needed.

```
⏸ СТОП — Phase 5: i18n Translations
Сделано: все ключи [domain].* добавлены в RU/EN/LT, количество ключей совпадает
Следующая: Phase 6 — Page Template Skeleton
Продолжить?
```

---

## Phase 6: Page Template — Skeleton

### Create `src/views/admin/[section]/[PageName]Page.vue`

**Step 6a — Read existing similar page first (design inheritance):**

Before writing a single line, read the closest existing page to understand layout, CSS class names, SCSS import pattern, and component usage:
- **List page** → read `src/views/admin/suppliers/SuppliersListPage.vue`
- **Card/detail page** → read `src/views/admin/suppliers/SupplierCardPage.vue`
- **Config/drag-drop page** → read `src/views/admin/suppliers/SupplierCardConfigPage.vue`
- Also check `src/styles/admin/components/` — find the closest existing SCSS file to understand class naming conventions and structure

Study:
- Root element class name pattern (e.g. `page-suppliers`, `page-supplier-card`)
- How GlassPanel is nested and what props it receives
- Save bar markup and class names
- Where and how `<style>` import is written at the bottom of the component
- How drag-and-drop is implemented if relevant (dragstart/dragover/drop pattern)

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

Rules:
- `data-test="page-[domain]"` on root element
- `data-test="[domain]-[section]"` on every logical section — required for Playwright
- All sections from Phase 0 Checkpoint must have a corresponding `data-test` div
- `<GlassPanel>` wraps every logical panel
- `<h1 class="page-title">` in the view itself (AdminLayout `<h1 v-if="pageTitle">` is dead code)
- **Pitfall #9:** No `<!-- comments -->` inside `<template>` — they go to DOM. Comments only in `<script>`.
- CSS aliases: `@styles` for CSS, `@images` for images — **not** `@assets`
- **Pitfall #17:** Before `<SvgIcon name="X">` — grep SvgIcon.vue to confirm the name exists
- **Pitfall #16 + BUG-17:** If page uses `entity-action-bar`, `save-bar`, or any class from `_entity-card-layout.css` — import it explicitly (NOT in admin-core.scss):
  ```ts
  import '@styles/admin/components/_entity-card-layout.css'
  ```
- **BUG-18/19 prevention:** After writing page CSS, compare it with the closest existing page CSS (`suppliers_list.css` or similar). Verify:
  - Every CSS class used in the template is defined in the page CSS (especially `.empty-state`, `.page-header`, action/row classes)
  - `.empty-state` must be defined with `display:flex; flex-direction:column; align-items:center` — not just `text-align:center`
  - Search/filters inside GlassPanel (Pitfall #19) — no separate wrapper outside the panel

### Checkpoint 6
```bash
cd frontend_vue && npm run typecheck && npm run lint
```
**Both must pass 0 errors.**

```
⏸ СТОП — Phase 6: Page Template Skeleton
Сделано: [PageName]Page.vue (+ CardPage.vue) созданы с data-test секциями, typecheck + lint ✅
Следующая: Phase 7 — Template Data Bindings
Продолжить?
```

---

## Phase 7: Template — Data Bindings

Fill in v-for / v-if / v-model / @click — one section per step, max 40 lines per edit.

### List section (data table — см. Pitfall #28 для точных значений):
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
        @click="router.push({ name: 'admin-[domain]-card', params: { id: item.id } })"
      >
        <td>{{ item.name }}</td>
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
.[domain]-row { cursor: pointer; }
.[domain]-row td { transition: background 0.15s, color 0.15s; }
.[domain]-row td:first-child { font-weight: 500; color: rgba(255, 255, 255, 0.85); }
.[domain]-row:hover td:first-child { color: #fff; }
.[domain]-row-actions { display: flex; gap: 8px; justify-content: flex-end; }
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
- `entity-action-bar no-margin pos-static` — ready container from `_entity-card-layout.css`; import it in the page script block
- Don't create new CSS classes for navigation links — all styles exist in core

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
- **Pitfall #10:** Route names must match exactly what's in `src/router/index.ts`. Verify by grep before using. TypeScript does NOT catch wrong route names.
- All navigation: `<router-link :to="{ name: 'exact-route-name' }">` — never `<a href>`
- All text: `{{ t('key') }}` — never hardcoded strings
- Loading state: `:loading="loading"` on GlassPanel
- Empty state: separate `v-if` block with `data-test="[domain]-empty"`
- **Pitfall #12:** Before using `:class="{ hidden }"` or any generic class — grep existing CSS to ensure the class name doesn't conflict globally. Use BEM state modifiers: `.is-hidden`, `.is-active`, `.has-error`
- Filters: `watch(filters, load, { deep: true })` — or `@change="load"` on each filter
- **Pitfall #20 (BUG-25):** If filters/search are inside GlassPanel AND use `watch(filters, load)` — add `initialized` flag to the composable so `loading=true` fires only on first load. Filter reloads must be silent (no skeleton, no panel-body hide).
- **BUG-20:** Every flex page header (`display: flex; justify-content: space-between`) must have responsive breakpoints:
  ```css
  @media (max-width: 992px) { .page-header { gap: 12px; } }
  @media (max-width: 600px) { .page-header { flex-direction: column; align-items: stretch; } .page-header .btn { width: 100%; justify-content: center; } }
  ```

### Checkpoint 7
```bash
cd frontend_vue && npm run typecheck && npm run lint
```
Open browser → navigate to the page → verify:
- Renders without console errors
- All `data-test` sections visible with mock data
- No layout breaks (flex, z-index, overflow)
- **Pitfall #14:** If using CustomSelect — use it consistently, no mix with native `<select>` on same page

```
⏸ СТОП — Phase 7: Template Data Bindings
Сделано: все v-for/v-if/v-model/@click привязаны, страница открывается в браузере с данными, typecheck + lint ✅
Следующая: Phase 8 — Route Registration & Integration
Продолжить?
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

**Два уровня флагов:**

```ts
// Page-level — защищает весь роут через beforeEnter guard
// В FeatureFlags type и defaultFlags:
admin[PageName]: boolean   // adminCategories, adminProducts и т.п.

// Section-level — скрывает часть страницы через v-if, если бэкенд этой фичи не готов
// Примеры: categoryFieldReorder (drag-and-drop + PUT endpoint),
//          supplierKanbanView, dashboardAlerts
[domain][Feature]: boolean
```

Section-level флаги применяются в template:
```vue
<div v-if="useFeatureFlag('categoryFieldReorder').value">
  <!-- drag-and-drop + reorder кнопки -->
</div>
```

Правило: **каждая фича с отдельным backend endpoint'ом** — кандидат на section-level флаг. Если endpoint не будет готов одновременно с UI — добавь флаг сейчас, не потом.

### Step 8c — Add sidebar link to `src/components/admin/AdminSidebar.vue`
Find the correct nav section (Suppliers, Analytics, etc.) and add:
```vue
<router-link :to="{ name: 'admin-[domain]' }" class="sidebar-link">
  <SvgIcon name="[icon]" />
  <span>{{ t('[domain].title') }}</span>
</router-link>
```

### Step 8d — Update `src/views/public/ScreensPage.vue`
Add a card for the new page in the admin section:
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
⏸ СТОП — Phase 8: Route Registration & Integration
Сделано: роут, feature flags, sidebar, ScreensPage, flags.ts обновлены, typecheck + lint ✅
Следующая: Phase 9 — Verification
Продолжить?
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
7. Language switch: RU → EN → LT — all text translates, no untranslated keys

### 9d — Regression check
Open 2–3 existing pages (Dashboard, SuppliersListPage) — verify no new console errors.

### 9e — Pitfalls final pass
Run through vue-rules pitfalls #1–#23 for this page:
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

**Done = all 9a–9e passed. Not just typecheck.**

---

## ⏸ PAUSE — Full Testing Cycle Before Phase 10

**After Phase 9 is complete, STOP and report to the user:**

> «Phase 9 завершена. Дальше — полный цикл тестирования и обновления скилов перед написанием тестов:
> 1. `/pre-manual-check [plan]` — автоматические проверки
> 2. Ручное тестирование → `/add-bug [plan]` для каждого найденного бага
> 3. `/fix-bugs [plan]` — исправить все баги
> 4. `/update-skills [plan]` — обновить скилы по урокам из багов
> После этого — подтверди, и начнём Phase 10.»

**Only proceed to Phase 10 after explicit user confirmation that all steps above are done.**

**Why:** Tests written against buggy UI become invalid after fixes, snapshot baselines need to be regenerated, and test assumptions about behavior change. Writing tests last saves 40+ minutes of rework.

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
⏸ СТОП — Phase 10 Step 10a: Аудит
Сделано: список всех секций, элементов, кейсов для тестирования
Следующий: Step 10b — написание spec-файла
Продолжить?
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

**Test data independence — critical:**
- **Never hardcode mock data values** (category names, field names, counts) in tests. Mock STORE changes = all hardcoded assertions break.
- **Search tests**: read the value dynamically from the first row, don't hardcode the search term:
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
- **For API-specific assertions** (e.g. 409 error on delete): intercept with `page.route()` instead of relying on mock STORE state — this works identically for both mock and real API.

**Test structure:**
- **Many small `test()`** instead of one big — each failure names exactly what broke
- **`expect.soft()`** inside a test when multiple assertions are logically linked
- **Per-section snapshots** not full-page — failure message names the exact section
- **`data-test` attrs** on every section — assert `toBeVisible()` separately
- **Wait for DOM markers**, not `networkidle` — mock layer doesn't trigger network events
- **SPA navigation** via `router-link` clicks (not `page.goto`) for state that must persist across pages

```
⏸ СТОП — Phase 10 Step 10b: Spec написан
Сделано: [domain].spec.ts создан — load, snapshots, DOM, functional, i18n тесты
Следующий: Step 10c — регистрация в smoke/navigation/feature-flags
Продолжить?
```

### Step 10c — Register in cross-cutting specs

In `tests/e2e/smoke.spec.ts`: add the new page to the smoke list.
In `tests/e2e/navigation.spec.ts`: add the route to the navigation matrix.
In `tests/e2e/feature-flags.spec.ts`: add the page-level flag test (flag OFF → /404).

```
⏸ СТОП — Phase 10 Step 10c: Регистрация
Сделано: страница добавлена в smoke, navigation, feature-flags specs
Следующий: Step 10d — запуск тестов
Продолжить?
```

### Step 10d — Run tests
```bash
cd frontend_vue && npx playwright test admin/[section]/[domain]
```

First run (no baseline): `npx playwright test --update-snapshots admin/[section]/[domain]`

**Checkpoint 10:** All tests green. Snapshots created. No regressions in other spec files.

```
⏸ СТОП — Phase 10: Playwright Tests
Сделано: [domain].spec.ts создан, зарегистрирован в smoke/navigation/feature-flags, все тесты зелёные ✅
Страница полностью готова.
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
