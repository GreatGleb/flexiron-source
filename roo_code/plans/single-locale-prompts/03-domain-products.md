# Domain: Products — Single-Locale Save Refactoring

## Prerequisites

Phase 1 (infrastructure) must be completed first. The utilities `toTranslatedString()` and `mergeTranslatedString()` must exist in `src/types/i18n.ts`.

## Goal

Update Products domain so that:
- **Create:** sends only user's locale for TranslatedString fields
- **Patch:** sends only changed locale, merges with existing
- **Read:** `tf()` falls back to any non-empty language

## TranslatedString fields in Products

- `name`
- `description`
- `fieldValues[].fieldName`
- `fieldValues[].options[]` (array of TranslatedString)
- `linkedSuppliers[].name`

## Files to modify

### 1. Service: [`productsService.ts`](../frontend_vue/src/services/productsService.ts)

**a) `createProduct` (or `createProductTranslated`)**

Currently sends `{ ru: data.name, en: data.name, lt: data.name }` for name/description. Change to use `toTranslatedString()`:

```ts
import { toTranslatedString } from '@/types/i18n'

export async function createProduct(data: CreateProductData, locale: string) {
  return apiPost('/api/products', {
    name: toTranslatedString(data.name, locale),
    description: toTranslatedString(data.description, locale),
    fieldValues: data.fieldValues?.map(fv => ({
      ...fv,
      fieldName: toTranslatedString(fv.fieldName, locale),
      options: fv.options?.map(o => toTranslatedString(o, locale)),
    })),
    linkedSuppliers: data.linkedSuppliers?.map(ls => ({
      ...ls,
      name: toTranslatedString(ls.name, locale),
    })),
    // other fields...
  })
}
```

**b) `patchProduct` (or `patchProductTranslated`)**

When building the PATCH payload, wrap TranslatedString fields:

```ts
export async function patchProduct(id: string, data: Record<string, any>, locale: string) {
  const payload: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (['name', 'description'].includes(key)) {
      payload[key] = toTranslatedString(value, locale)
    } else if (key === 'fieldValues') {
      payload[key] = value.map(fv => ({
        ...fv,
        fieldName: toTranslatedString(fv.fieldName, locale),
        options: fv.options?.map(o => toTranslatedString(o, locale)),
      }))
    } else if (key === 'linkedSuppliers') {
      payload[key] = value.map(ls => ({
        ...ls,
        name: toTranslatedString(ls.name, locale),
      }))
    } else {
      payload[key] = value
    }
  }
  return apiPatch(`/api/products/${id}`, payload)
}
```

### 2. Mock: [`mocks/products.ts`](../frontend_vue/src/services/mocks/products.ts)

**a) `mockCreateProduct`** — store incoming TranslatedString fields as-is

**b) `mockPatchProduct`** — merge TranslatedString fields using `mergeTranslatedString()`:

```ts
import { mergeTranslatedString } from '@/types/i18n'

// For simple fields:
if (existing && patchData.name) {
  existing.name = mergeTranslatedString(existing.name, patchData.name)
}

// For fieldValues array — need to match by fieldName or index:
if (patchData.fieldValues) {
  patchData.fieldValues.forEach((fv, i) => {
    if (existing.fieldValues[i]) {
      existing.fieldValues[i].fieldName = mergeTranslatedString(
        existing.fieldValues[i].fieldName, fv.fieldName
      )
    }
  })
}
```

### 3. Composable: [`useProducts.ts`](../frontend_vue/src/composables/useProducts.ts)

- Remove the `translated` option
- Always use translated service functions
- Pass `locale` to save functions

```ts
// Before:
export function useProducts(options?: { translated?: boolean }) {
  const { locale } = useI18n()
  const svc = options?.translated ? productsService : productsServiceTranslated
}

// After:
export function useProducts() {
  const { locale } = useI18n()
  
  async function create(data) {
    return productsService.createProduct(data, locale.value)
  }
  
  async function patch(id, data) {
    return productsService.patchProduct(id, data, locale.value)
  }
}
```

### 4. Composable: [`useProductCard.ts`](../frontend_vue/src/composables/useProductCard.ts)

Same changes — remove `translated` option, pass `locale` to save/patch.

### 5. Views

**`ProductsPage.vue`** — remove `translated: true`:
```ts
// Before:
const { products, loading, error } = useProducts({ translated: true })

// After:
const { products, loading, error } = useProducts()
```

**`ProductCardPage.vue`** — same change.

## Verification

- `vue-tsc --noEmit` passes
- Creating a product sends only the user's locale for name, description, fieldValues, linkedSuppliers
- Patching a product merges TranslatedString fields
- Reading a product shows fallback to any non-empty language
