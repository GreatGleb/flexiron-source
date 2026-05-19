# Fix ServiceCardPage Translation Handling

## Problem

[`useServiceCard`](frontend_vue/src/composables/useServiceCard.ts) stores form fields as plain strings (`name: string`, `description: string`), losing the multi-locale `TranslatedString` structure. This causes:

1. **Language switcher doesn't update form fields** — when `locale` changes, the form still shows the old value because it's a plain string, not a computed getter over `TranslatedString`
2. **Saving destroys other locale translations** — `patchService` wraps the string in `toTranslatedString()`, creating `{ ru: "value", en: "", lt: "" }`
3. **Discard doesn't restore multi-locale data** — it re-extracts a single-locale string from `service.value`

## Root Cause

The composable was built with `form.name: string` instead of `form.name: TranslatedString | null`, unlike [`useCategoryCard`](frontend_vue/src/composables/useCategoryCard.ts:24-32) which correctly stores `name: TranslatedString | null`.

## Solution

### 1. Fix [`useServiceCard.ts`](frontend_vue/src/composables/useServiceCard.ts)

Change `form` type from `{ name: string; description: string }` to `{ name: TranslatedString | null; description: TranslatedString | null }`.

**Changes:**

- **Line 19-31**: Change form type — `name: TranslatedString | null`, `description: TranslatedString | null`
- **Line 43-51** (`load()`): Assign `data.name` directly instead of extracting single locale
- **Line 76-84** (`save()`): Assign `updated.name` directly instead of extracting single locale
- **Line 96-104** (`discard()`): Assign `service.value.name` directly instead of extracting single locale

### 2. Fix [`ServiceCardPage.vue`](frontend_vue/src/views/admin/products/ServiceCardPage.vue)

Add computed properties with getter/setter (same pattern as CategoryCardPage), and use them in the template instead of direct `v-model` on `form`.

**Changes:**

Add computed properties after the composable destructuring:

```typescript
import { toTranslatedString, mergeLocaleValue } from '@/types/i18n'

const formName = computed({
  get: () => (form.value.name ? tf(form.value.name) : ''),
  set: (v: string) => {
    form.value.name = v ? mergeLocaleValue(form.value.name, v, locale.value) : null
  },
})

const formDescription = computed({
  get: () => (form.value.description ? tf(form.value.description) : ''),
  set: (v: string) => {
    form.value.description = v ? mergeLocaleValue(form.value.description, v, locale.value) : null
  },
})
```

In template, replace:
- `v-model="form.name"` → `v-model="formName"`
- `v-model="form.description"` → `v-model="formDescription"`

### 3. Fix [`mockPatchService`](frontend_vue/src/services/mocks/services.ts)

Already fixed in previous session — accepts `TranslatedString` directly and assigns it.

### 4. Verify

- Language switcher changes all form fields instantly
- Saving only updates the current locale, preserving others
- Discard restores all three locales from `service.value`
- All existing tests pass
