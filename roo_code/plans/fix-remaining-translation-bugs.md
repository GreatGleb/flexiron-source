# Fix Remaining Translation Refactoring Bugs

## Bug 1: `[mock] GET /api/bcc/recipients/translated not found`

### Root Cause

The [`useBccRequestTranslated()`](frontend_vue/src/composables/useBccRequest.ts:162) composable calls [`getBccRecipientsTranslated()`](frontend_vue/src/services/bccService.ts:63), which makes a GET request to `/api/bcc/recipients/translated`. However, the mock router in [`getMock()`](frontend_vue/src/services/mocks/index.ts:84) only handles the non-translated path `/api/bcc/recipients` (line 125-128). There is no handler for `/api/bcc/recipients/translated`, so it falls through to the final `throw new Error('[mock] GET ${path} not found')` on line 176.

The same issue exists for `/api/bcc/categories/translated` and `/api/bcc/history/translated` — none of these translated BCC endpoints have mock handlers.

### Fix

Add three new route handlers in [`getMock()`](frontend_vue/src/services/mocks/index.ts:84) before the final `throw`:

1. **`/api/bcc/categories/translated`** → call `mockGetBccCategories()` (same data, no translation needed in mock)
2. **`/api/bcc/recipients/translated`** → call `mockGetBccRecipients(productIds)` (same data)
3. **`/api/bcc/history/translated`** → call `mockGetBccHistory(page, pageSize)` (same data)

These should be placed right after the existing non-translated BCC handlers (after line 133).

---

## Bug 2: `Cannot read properties of undefined (reading 'items')` in Categories

### Root Cause

The [`CategoriesPage.vue`](frontend_vue/src/views/admin/products/CategoriesPage.vue:24) uses [`useCategoriesTranslated()`](frontend_vue/src/composables/useCategories.ts:61), which calls [`getCategoriesTranslated()`](frontend_vue/src/services/categoriesService.ts:20). This function makes a GET request to `/api/categories/translated`. However, the mock router in [`getMock()`](frontend_vue/src/services/mocks/index.ts:84) has **no handler** for `/api/categories/translated`.

The existing handler at line 151 matches `/api/categories` (without `/translated`), but `/api/categories/translated` does not match any route, so it falls through to the `throw` on line 176.

The error `Cannot read properties of undefined (reading 'items')` occurs because the exception is caught in [`useCategoriesTranslated().load()`](frontend_vue/src/composables/useCategories.ts:73), which sets `error.value` but does **not** set `items.value`. The template then tries to access `items.value` (which remains `undefined`), and when it tries to iterate or access `.items` on it, it crashes.

### Fix

Add a handler for `/api/categories/translated` in [`getMock()`](frontend_vue/src/services/mocks/index.ts:84). Place it right after the existing `/api/categories` handler (after line 156):

```
if (path === '/api/categories/translated') {
  const filters: CategoryFilters = { search: params?.search ?? '' }
  const page = Number(params?.page ?? 1)
  const pageSize = Number(params?.pageSize ?? 25)
  return delay(mockGetCategories(filters, page, pageSize) as T)
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) | Add 4 missing translated mock routes: `/api/bcc/categories/translated`, `/api/bcc/recipients/translated`, `/api/bcc/history/translated`, `/api/categories/translated` |

## Verification

- ✅ `vue-tsc --noEmit` — 0 errors
- ✅ Navigate to BCC Request page — recipients load without `[mock] GET ... not found` error
- ✅ Navigate to Categories page — categories list renders without `Cannot read properties of undefined (reading 'items')`
