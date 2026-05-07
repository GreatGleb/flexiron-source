# Translation Refactoring — Audit & Fix Summary

## Status: ✅ All fixes completed

All 6 bugs across 5 files have been fixed. The project compiles with zero TypeScript errors.

## Fixed Issues

| # | File | Problem | Fix |
|---|------|---------|-----|
| 1 | [`categoriesService.ts`](frontend_vue/src/services/categoriesService.ts:48) | Missing `createCategoryTranslated()` | Added function that wraps name/description as `{ ru, en, lt }` |
| 2 | [`CategoriesPage.vue:54`](frontend_vue/src/views/admin/products/CategoriesPage.vue:54) | `createCategory()` with plain string | Switched to `createCategoryTranslated()` |
| 3 | [`BccRequestPage.vue:526`](frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:526) | `supplier.company` in toast → `[object Object]` | Wrapped with `tf()` |
| 4 | [`CategoryCardPage.vue:205`](frontend_vue/src/views/admin/products/CategoryCardPage.vue:205) | `s.company` in select label → `[object Object]` | Wrapped with `tf()` |
| 5 | [`SupplierCardConfigPage.vue:964`](frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue:964) | `v-model` with `TranslatedString` object | Changed to `:value` + `@input` pattern |
| 6 | [`ProductCardPage.vue:76,335`](frontend_vue/src/views/admin/products/ProductCardPage.vue:76) | Nested `TranslatedString` + label without `tf()` | Passed `s.company` directly + wrapped with `tf()` |

## Verification
- ✅ `vue-tsc --noEmit` — 0 errors
- ✅ `npm run build` — build successful
