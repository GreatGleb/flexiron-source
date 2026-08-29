# Plan: Fix Clients List Page UI Bugs

## Reference Page
**Products Page** (`frontend_vue/src/views/admin/products/ProductsPage.vue`) + (`frontend_vue/src/styles/admin/products_list.css`)

## Buggy Page
**Clients List Page** (`frontend_vue/src/views/admin/clients/ClientsListPage.vue`) + (`frontend_vue/src/styles/admin/clients_list.css`)

---

## Bug 1: Header & Filters Bar Layout

### Root Causes

| Issue | Cause |
|-------|-------|
| `.page-clients` missing flex layout | Missing `display: flex; flex-direction: column; gap: 24px;` (present on `.page-products`) |
| `.page-header` missing flex styles | No CSS for `.page-header` at all (`.products-header` has flex layout) |
| Filters-bar header shows wrong text | Uses `t('clients.title')` = "Клиенты" instead of `t('products.filters')` pattern → "ФИЛЬТРЫ" |
| Search input is 100% wide | No `max-width` constraint on the filter-group wrapping SearchInput |
| Status dropdown overflows container | Missing `overflow: visible` / z-index on filters-bar |

### Fixes

**A. Template changes** (`ClientsListPage.vue` lines 114-145):

1. Change wrapper class from `page-clients` to `clients-page` and add proper flex gap CSS
2. Add CSS class for `.page-header` → rename to `.clients-header` with flexbox layout matching `.products-header`
3. Change `{{ t('clients.title') }}` in `filters-bar-header` to a proper "ФИЛЬТРЫ" label — add `t('clients.filters')` key to i18n or use common label
4. Add `max-width` constraint on the search filter group
5. Ensure Status dropdown is properly contained within the filters bar

**B. CSS changes** (`clients_list.css`):

```css
/* 1. Page layout */
.page-clients {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 2. Header row */
.page-clients .page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.page-clients .page-header .page-title {
  margin: 0;
}

/* 3. Limit search input width */
.filter-group:first-child {
  flex: 1 1 320px;
  max-width: 400px;
}

/* 4. Ensure filters bar doesn't clip dropdowns */
.filters-bar {
  overflow: visible;
}
```

---

## Bug 2: Table Column Widths & Action Icons Alignment

### Root Causes

- Table uses `table-layout: auto` (default) → columns resize based on content length
- Long address / email text pushes the actions column rightward
- No fixed grid-template-columns on the table
- Missing sort icons in table headers

### Fixes

**A. Template changes** (columns 163-173 in `ClientsListPage.vue`):

1. Add `<colgroup>` with fixed percentage widths:
   - Name: 18%
   - Company Code: 10%
   - VAT: 10%
   - Address: 18%
   - Phone: 12%
   - Email: 14%
   - Status: 8%
   - Actions: 10%

2. Add sort icons (chevron-up / chevron-down) to sortable headers (Name, Company Code, Status), matching the `th-sort-btn` pattern from products page
   - Note: This requires the `useClients` composable to expose sort state (or we add it). Check if backend supports sorting.

3. Replace inline SVG for eye icon with `<SvgIcon name="eye" />` for consistency

**B. CSS changes** (`clients_list.css`):

```css
/* Fixed table layout */
.page-clients .data-table {
  table-layout: fixed;
  width: 100%;
}

/* Column widths via colgroup */
/* Already defined in <colgroup> above */

/* Ensure action buttons column is right-aligned and doesn't shrink */
.page-clients .data-table th:last-child,
.page-clients .data-table td:last-child {
  width: 80px;
  min-width: 80px;
  text-align: right;
}

/* Add sort button styles (import from products_list.css or shared) */
.th-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}

.sort-icon-group {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  gap: 0;
  margin-left: 2px;
}

.sort-icon {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.25);
  transition: color 0.15s;
}

.sort-icon.active {
  color: var(--primary, #1890ff);
}
```

---

## Bug 3: Pagination (Table Footer)

### Root Causes

- Current pagination is too basic: just prev/next buttons + "of X" text
- No current page number displayed
- Left/right arrow buttons are plain SVG without proper button styling
- "на странице 25" selector lacks bottom padding inside GlassPanel
- No page number buttons (like products page has)

### Fixes

**A. Template changes** (lines 224-243 in `ClientsListPage.vue`):

Replace the simple pagination with the full-featured version matching `ProductsPage.vue` lines 347-398:

```html
<div v-if="total > 0" class="pagination-bar" data-test="clients-pagination">
  <div class="page-size" data-test="clients-page-size">
    <span>{{ t('clients.page_size') }}</span>
    <CustomSelect
      v-model="pageSizeStr"
      :options="PAGE_SIZE_OPTIONS"
      :open-up="true"
      class="custom-select-sm"
    />
  </div>
  <div class="pagination-nav">
    <button
      class="btn btn-icon btn-sm"
      :disabled="page <= 1"
      :style="{ display: pagination.totalPages <= 1 ? 'none' : 'flex' }"
      @click="page--"
    >
      <SvgIcon name="chevron-right" :width="14" :height="14" style="transform: rotate(180deg)" />
    </button>
    <div class="pagination-pages">
      <span v-for="p in pageNumbers" :key="p">
        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
        <button
          v-else
          class="page-btn"
          :class="{ active: p === page }"
          @click="page = p"
        >{{ p }}</button>
      </span>
    </div>
    <button
      class="btn btn-icon btn-sm"
      :disabled="page * pageSize >= total"
      :style="{ display: pagination.totalPages <= 1 ? 'none' : 'flex' }"
      @click="page++"
    >
      <SvgIcon name="chevron-right" :width="14" :height="14" />
    </button>
  </div>
  <div class="pagination-info">
    <span>{{ showingFrom }}-{{ showingTo }}</span>
    <span>&nbsp;{{ t('clients.of') }}&nbsp;</span>
    <span>{{ total }}</span>
  </div>
</div>
```

**B. Script changes** (`ClientsListPage.vue` <script> section):

Add computed properties for pagination:

```typescript
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const showingFrom = computed(() => Math.min((page.value - 1) * pageSize.value + 1, total.value))
const showingTo = computed(() => Math.min(page.value * pageSize.value, total.value))

const pageNumbers = computed(() => {
  const n = totalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  if (page.value <= 3) return [1, 2, 3, 4, '...', n]
  if (page.value >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
  return [1, '...', page.value - 1, page.value, page.value + 1, '...', n]
})
```

**C. CSS changes** (`clients_list.css`):

Add padding-bottom to GlassPanel when it contains pagination:

```css
/* Pagination bottom spacing */
.page-clients .glass-panel {
  padding-bottom: 0;
}

.page-clients .pagination-bar {
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: 0;
}
```

---

## Additional Fixes

### A. Add `t('clients.filters')` i18n key

In `frontend_vue/src/i18n/admin/clients.ts`:

```typescript
// Add to all three locales (ru, en, lt):
filters: 'Фильтры',  // ru
filters: 'Filters',  // en  
filters: 'Filtrai',  // lt
```

### B. Import pagination CSS

Ensure `clients_list.css` imports the shared pagination styles or they're already available via the `<style>` import in the component. Currently the component imports `@import '@styles/admin/components/_pagination.css'` in the style block but also has the old pagination markup. After refactoring to use the new pagination, the import should remain.

### C. Fix `useClients` composable to expose pagination utilities

The current `useClients` destructures only `{ page, pageSize, total }` from `usePagination()`. We need to also expose `totalPages` and other helpers. Update `useClients.ts` to return the full pagination object:

```typescript
const pagination = usePagination()
// ... use pagination.page, pagination.pageSize, pagination.total
return { items, loading, error, filters, pagination, load, handleDelete, tf }
// OR destructure additional fields:
return { items, loading, error, filters, page, pageSize, total, totalPages, load, handleDelete, tf }
```

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `frontend_vue/src/views/admin/clients/ClientsListPage.vue` | Template: header layout, colgroup, sort icons, pagination markup. Script: pagination computed helpers |
| 2 | `frontend_vue/src/styles/admin/clients_list.css` | Page layout, header flex, table-layout fixed, col widths, pagination spacing |
| 3 | `frontend_vue/src/i18n/admin/clients.ts` | Add `filters` key to all 3 locales |
| 4 | `frontend_vue/src/composables/useClients.ts` | Expose `totalPages` from usePagination |

## Merge / Conflict Note

If the `useClients` composable is used elsewhere (e.g., `ClientCardPage`), ensure the return value change is backward-compatible or only add new exports without removing existing ones.
