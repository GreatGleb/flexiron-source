# Domain: Categories — Single-Locale Save Refactoring

## Prerequisites

Phase 1 (infrastructure) must be completed first. The utilities `toTranslatedString()` and `mergeTranslatedString()` must exist in `src/types/i18n.ts`.

## Goal

Update Categories domain so that:
- **Create:** sends only user's locale: `{ name: { ru: "Листы" } }` instead of `{ ru, en, lt }`
- **Patch:** sends only changed locale, merges with existing
- **Read:** `tf()` falls back to any non-empty language

## Files to modify

### 1. Service: [`categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts)

**a) `createCategory` (or `createCategoryTranslated`)**

Currently sends `{ ru: data.name, en: data.name, lt: data.name }`. Change to use `toTranslatedString()`:

```ts
import { toTranslatedString } from '@/types/i18n'

export async function createCategory(data: { name: string; ... }, locale: string) {
  return apiPost('/api/categories', {
    name: toTranslatedString(data.name, locale),
    // other fields...
  })
}
```

**b) `patchCategory` (or `patchCategoryTranslated`)**

When building the PATCH payload, any `TranslatedString` field in dirty fields should use `toTranslatedString()`:

```ts
export async function patchCategory(id: string, data: Record<string, any>, locale: string) {
  const payload: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (isTranslatedStringField(key)) { // you need to know which fields are TranslatedString
      payload[key] = toTranslatedString(value, locale)
    } else {
      payload[key] = value
    }
  }
  return apiPatch(`/api/categories/${id}`, payload)
}
```

**c) `putCategoryFields` (or `putCategoryFieldsTranslated`)**

Field names and options are `TranslatedString`. Wrap them:

```ts
export async function putCategoryFields(categoryId: string, fields: FieldDef[], locale: string) {
  return apiPut(`/api/categories/${categoryId}/fields`, {
    fields: fields.map(f => ({
      ...f,
      fieldName: toTranslatedString(f.fieldName, locale),
      options: f.options?.map(o => toTranslatedString(o, locale)),
    }))
  })
}
```

### 2. Mock: [`mocks/categories.ts`](../frontend_vue/src/services/mocks/categories.ts)

**a) `mockCreateCategory`** — store the incoming `TranslatedString` as-is (with empty other locales)

**b) `mockPatchCategory`** — merge TranslatedString fields using `mergeTranslatedString()`:

```ts
import { mergeTranslatedString } from '@/types/i18n'

// When patching a category:
const existing = store.find(c => c.id === id)
if (existing && patchData.name) {
  existing.name = mergeTranslatedString(existing.name, patchData.name)
}
```

**c) `mockPutCategoryFields`** — same merge logic for field names and options

### 3. Composable: [`useCategories.ts`](../frontend_vue/src/composables/useCategories.ts)

- Remove the `translated` option from the interface
- Always use translated service functions
- Pass `locale` to save functions (get locale from `useI18n()` or `useTranslatedData`)

```ts
// Before:
export function useCategories(options?: { translated?: boolean }) {
  const { t, locale } = useI18n()
  const svc = options?.translated ? categoriesService : categoriesServiceTranslated
  
  async function create(data) {
    return svc.createCategory(data)
  }
}

// After:
export function useCategories() {
  const { locale } = useI18n()
  
  async function create(data) {
    return categoriesService.createCategory(data, locale.value)
  }
}
```

### 4. Composable: [`useCategoryCard.ts`](../frontend_vue/src/composables/useCategoryCard.ts)

Same changes as `useCategories.ts`:
- Remove `translated` option
- Pass `locale` to save/patch functions

### 5. Views

**`CategoriesPage.vue`** — remove `translated: true` from composable call:
```ts
// Before:
const { categories, loading, error } = useCategories({ translated: true })

// After:
const { categories, loading, error } = useCategories()
```

**`CategoryCardPage.vue`** — same change.

## Verification

- `vue-tsc --noEmit` passes
- Creating a category sends only the user's locale
- Patching a category merges TranslatedString fields (doesn't overwrite other languages)
- Reading a category shows fallback to any non-empty language
