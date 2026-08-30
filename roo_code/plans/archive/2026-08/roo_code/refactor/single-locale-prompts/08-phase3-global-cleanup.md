# Phase 3: Global Cleanup

## Prerequisites

All domain-specific refactoring tasks (Categories, Products, Suppliers, BCC, Config, Analytics) must be completed first.

## Goal

Remove all dead code that is no longer needed after the single-locale refactoring.

## Changes needed

### 1. Remove non-translated functions from services

For each service file, remove the non-translated functions and rename the `*Translated` variants to the original names.

**Example for [`categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts):**

```ts
// REMOVE these:
export async function getCategories() { ... }
export async function getCategory(id: string) { ... }
export async function createCategory(data: any) { ... }

// RENAME these (remove 'Translated' suffix):
export async function getCategories() { ... }  // was getCategoriesTranslated
export async function getCategory(id: string) { ... }  // was getCategoryTranslated
export async function createCategory(data: any, locale: string) { ... }  // was createCategoryTranslated
```

**Files to modify:**
- [`categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts)
- [`productsService.ts`](../frontend_vue/src/services/productsService.ts)
- [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts)
- [`bccService.ts`](../frontend_vue/src/services/bccService.ts)
- [`configService.ts`](../frontend_vue/src/services/configService.ts)
- [`analyticsService.ts`](../frontend_vue/src/services/analyticsService.ts)

### 2. Remove non-translated GET routes from mocks

In [`mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts), remove all non-`/translated` GET route handlers.

**Example:**
```ts
// REMOVE these:
httpMock.onGet('/api/categories').reply(...)
httpMock.onGet('/api/categories/:id').reply(...)
httpMock.onGet('/api/products').reply(...)
httpMock.onGet('/api/products/:id').reply(...)
httpMock.onGet('/api/suppliers').reply(...)
httpMock.onGet('/api/suppliers/:id').reply(...)
httpMock.onGet('/api/bcc/categories').reply(...)
httpMock.onGet('/api/bcc/recipients').reply(...)
httpMock.onGet('/api/bcc/history').reply(...)
httpMock.onGet('/api/config/fields').reply(...)
httpMock.onGet('/api/config/sections').reply(...)
httpMock.onGet('/api/config/permissions').reply(...)

// KEEP only the /translated variants:
httpMock.onGet('/api/categories/translated').reply(...)
httpMock.onGet('/api/categories/:id/translated').reply(...)
// etc.
```

### 3. Remove `translated` option from composable interfaces

For each composable, remove the `translated` option from the function signature and options interface.

**Example for [`useCategories.ts`](../frontend_vue/src/composables/useCategories.ts):**
```ts
// Before:
export function useCategories(options?: { translated?: boolean }) { ... }

// After:
export function useCategories() { ... }
```

**Files to modify:**
- [`useCategories.ts`](../frontend_vue/src/composables/useCategories.ts)
- [`useCategoryCard.ts`](../frontend_vue/src/composables/useCategoryCard.ts)
- [`useProducts.ts`](../frontend_vue/src/composables/useProducts.ts)
- [`useProductCard.ts`](../frontend_vue/src/composables/useProductCard.ts)
- [`useSuppliers.ts`](../frontend_vue/src/composables/useSuppliers.ts)
- [`useSupplierCard.ts`](../frontend_vue/src/composables/useSupplierCard.ts)
- [`useSupplierCreate.ts`](../frontend_vue/src/composables/useSupplierCreate.ts)
- [`useBccRequest.ts`](../frontend_vue/src/composables/useBccRequest.ts)
- [`useCardConfig.ts`](../frontend_vue/src/composables/useCardConfig.ts)
- [`useAnalytics.ts`](../frontend_vue/src/composables/useAnalytics.ts)

### 4. Remove `useLabelResolver` if unused

Search for usages of `useLabelResolver` across the codebase. If it's no longer used after the refactoring, remove it.

## Verification

- `vue-tsc --noEmit` passes with zero errors
- `npm run build` succeeds
- No references to removed functions remain in the codebase
