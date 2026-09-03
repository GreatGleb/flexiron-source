# Fix: "Cannot read properties of null (reading 'items')" in admin/products

## Bug Analysis

The error occurs in [`ProductsPage.vue`](../../frontend_vue/src/views/admin/products/ProductsPage.vue:28) when the page loads. The page uses `useProductsTranslated()` which calls [`getProductsTranslated()`](../../frontend_vue/src/services/productsService.ts:23) → `GET /api/products/translated`.

### Root Cause 1: Wrong API endpoint path

After the translation refactoring, the backend now returns translated data directly from the original `/api/products` endpoint. The separate `/api/products/translated` endpoint either doesn't exist or returns unexpected data.

The [`getProductsTranslated()`](../../frontend_vue/src/services/productsService.ts:34) function calls `/api/products/translated`, but it should call `/api/products` — the same endpoint as [`getProducts()`](../../frontend_vue/src/services/productsService.ts:16), since the backend now handles translation internally.

### Root Cause 2: `tf()` has no null guard

The [`tf()` function](../../frontend_vue/src/composables/useTranslatedData.ts:26) does:
```typescript
function tf(field: TranslatedString): string {
  return field[locale.value as keyof TranslatedString] ?? field.ru
}
```

If `field` is `null` or `undefined`, this crashes with "Cannot read properties of null (reading 'en')".

In [`ProductsPage.vue` template](../../frontend_vue/src/views/admin/products/ProductsPage.vue:308):
```html
<td>{{ tf(item.name) }}</td>
```
`tf(item.name)` is called without null check.

## Fix Plan

### Fix 1: Change API endpoint in [`productsService.ts`](../../frontend_vue/src/services/productsService.ts)

Change [`getProductsTranslated()`](../../frontend_vue/src/services/productsService.ts:34) to call `/api/products` instead of `/api/products/translated`:

```typescript
// Before:
return apiGet('/api/products/translated', params)

// After:
return apiGet('/api/products', params)
```

Also change [`getProductTranslated()`](../../frontend_vue/src/services/productsService.ts:38) to call `/api/products/${id}` instead of `/api/products/${id}/translated`:

```typescript
// Before:
return apiGet(`/api/products/${id}/translated`)

// After:
return apiGet(`/api/products/${id}`)
```

### Fix 2: Add null-safety guard in [`tf()`](../../frontend_vue/src/composables/useTranslatedData.ts)

Make `tf()` handle `null`/`undefined` gracefully:

```typescript
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  return field[locale.value as keyof TranslatedString] ?? field.ru
}
```

### Fix 3: Add null-safety in [`ProductsPage.vue`](../../frontend_vue/src/views/admin/products/ProductsPage.vue) template

Change line 308 from:
```html
<td>{{ tf(item.name) }}</td>
```
to:
```html
<td>{{ item.name ? tf(item.name) : '—' }}</td>
```

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | [`frontend_vue/src/services/productsService.ts`](../../frontend_vue/src/services/productsService.ts) | Change `getProductsTranslated()` to call `/api/products` (line 34) and `getProductTranslated()` to call `/api/products/${id}` (line 38) |
| 2 | [`frontend_vue/src/composables/useTranslatedData.ts`](../../frontend_vue/src/composables/useTranslatedData.ts) | Add null guard to `tf()` parameter type and implementation |
| 3 | [`frontend_vue/src/views/admin/products/ProductsPage.vue`](../../frontend_vue/src/views/admin/products/ProductsPage.vue) | Add null check before `tf(item.name)` on line 308 |

## Verification

1. Open the admin products page in the browser
2. Verify the product list loads without errors
3. Verify translations work correctly (switch locale)
4. Verify the error state still works (if API fails)
