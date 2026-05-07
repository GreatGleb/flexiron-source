# Fix: TranslatedString Display Bugs

## Problem

After the single-locale save refactoring, `TranslatedString` objects (e.g., `{ ru: "Листы", en: "", lt: "" }`) are being rendered directly in Vue templates instead of using `tf()` to extract the string for the current locale. This causes Vue to display `[object Object]` or JSON stringified objects instead of the actual text.

## Root Cause Analysis

The refactoring changed the data format so that `TranslatedString` objects now have only one language filled in (e.g., `{ ru: "Листы", en: "", lt: "" }`). Previously, all 3 languages had the same value, so even if `tf()` wasn't called, the object would render as a string in some contexts. Now, Vue's `{{ }}` interpolation renders the object as `[object Object]`.

## All Affected Locations

### 1. BCC Request Page — `{{ group.categoryName }}` and `{{ p.name }}`
**File:** [`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`](frontend_vue/src/views/admin/suppliers/BccRequestPage.vue)
- **Line 670:** `{{ group.categoryName }}` — `BccCategory.name` is `TranslatedString`
- **Line 692:** `{{ p.name }}` — product name is `TranslatedString`

### 2. Analytics Supply Page — `{{ supplier.name }}`
**File:** [`frontend_vue/src/views/admin/analytics/SupplyPage.vue`](frontend_vue/src/views/admin/analytics/SupplyPage.vue)
- **Line 68:** `{{ supplier.name }}` — supplier name is `TranslatedString`

### 3. Analytics Sales Page — `{{ client.name }}`
**File:** [`frontend_vue/src/views/admin/analytics/SalesPage.vue`](frontend_vue/src/views/admin/analytics/SalesPage.vue)
- **Line 63:** `{{ client.name }}` — client name is `TranslatedString`

### 4. AnalyticsCard component — `{{ m.label }}`
**File:** [`frontend_vue/src/components/admin/AnalyticsCard.vue`](frontend_vue/src/components/admin/AnalyticsCard.vue)
- **Line 26:** `{{ m.label }}` — metric label is `TranslatedString`

### 5. AlertsTable component — `{{ row.description }}`
**File:** [`frontend_vue/src/components/admin/tables/AlertsTable.vue`](frontend_vue/src/components/admin/tables/AlertsTable.vue)
- **Line 27:** `{{ row.description }}` — alert description is `TranslatedString`

### 6. ProductCardPage — `form.description` v-model type mismatch
**File:** [`frontend_vue/src/views/admin/products/ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue)
- **Line 169:** `v-model="form.description"` — `form.description` is `TranslatedString | null` but textarea expects `string`
- This needs a computed getter/setter similar to `formName`

### 7. CategoryCardPage — hardcoded `{ ru: v, en: '', lt: '' }` instead of `toTranslatedString()`
**File:** [`frontend_vue/src/views/admin/products/CategoryCardPage.vue`](frontend_vue/src/views/admin/products/CategoryCardPage.vue)
- **Line 68:** `form.value.name = v ? { ru: v, en: '', lt: '' } as const : null`
- **Line 82:** `form.value.description = v ? { ru: v, en: '', lt: '' } as const : null`
- **Line 143:** `name: { ru: name, en: '', lt: '' } as const`
- **Line 146:** `options: ... .map((o) => ({ ru: o, en: '', lt: '' }))`
- These should use `toTranslatedString(v, locale.value)` for consistency

### 8. SupplierCardPage — `onFilesUploaded` hardcoded multi-locale
**File:** [`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue`](frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue)
- **Line 44:** `name: { ru: u.name, en: u.name, lt: u.name }` — should use `toTranslatedString(u.name, locale.value)`

## Plan

### Sub-task 1: Fix BCC Request Page
**Files:** [`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`](frontend_vue/src/views/admin/suppliers/BccRequestPage.vue)
- Line 670: Change `{{ group.categoryName }}` → `{{ tf(group.categoryName) }}`
- Line 692: Change `{{ p.name }}` → `{{ tf(p.name) }}`
- Ensure `tf` is available in the template (imported from composable)

### Sub-task 2: Fix Analytics Pages
**Files:**
- [`frontend_vue/src/views/admin/analytics/SupplyPage.vue`](frontend_vue/src/views/admin/analytics/SupplyPage.vue) — Line 68: `{{ supplier.name }}` → `{{ tf(supplier.name) }}`
- [`frontend_vue/src/views/admin/analytics/SalesPage.vue`](frontend_vue/src/views/admin/analytics/SalesPage.vue) — Line 63: `{{ client.name }}` → `{{ tf(client.name) }}`
- Ensure `tf` is available in these views

### Sub-task 3: Fix Shared Components
**Files:**
- [`frontend_vue/src/components/admin/AnalyticsCard.vue`](frontend_vue/src/components/admin/AnalyticsCard.vue) — Line 26: `{{ m.label }}` → `{{ tf(m.label) }}`
- [`frontend_vue/src/components/admin/tables/AlertsTable.vue`](frontend_vue/src/components/admin/tables/AlertsTable.vue) — Line 27: `{{ row.description }}` → `{{ tf(row.description) }}`
- Add `tf` import from `useTranslatedField` in these components

### Sub-task 4: Fix ProductCardPage description
**File:** [`frontend_vue/src/views/admin/products/ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue)
- Add computed getter/setter for `form.description` similar to `formName`
- Getter: `() => (form.value.description ? tf(form.value.description) : '')`
- Setter: `(v: string) => { form.value.description = v ? toTranslatedString(v, locale.value) : null }`
- Change `v-model="form.description"` → `v-model="formDescription"`

### Sub-task 5: Fix CategoryCardPage — use toTranslatedString
**File:** [`frontend_vue/src/views/admin/products/CategoryCardPage.vue`](frontend_vue/src/views/admin/products/CategoryCardPage.vue)
- Line 68: Replace `{ ru: v, en: '', lt: '' } as const` → `toTranslatedString(v, locale.value)`
- Line 82: Replace `{ ru: v, en: '', lt: '' } as const` → `toTranslatedString(v, locale.value)`
- Line 143: Replace `{ ru: name, en: '', lt: '' } as const` → `toTranslatedString(name, locale.value)`
- Line 146: Replace `.map((o) => ({ ru: o, en: '', lt: '' }))` → `.map((o) => toTranslatedString(o, locale.value))`
- Add import for `toTranslatedString` and `useI18n` locale

### Sub-task 6: Fix SupplierCardPage onFilesUploaded
**File:** [`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue`](frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue)
- Line 44: Replace `{ ru: u.name, en: u.name, lt: u.name }` → `toTranslatedString(u.name, locale.value)`
- Add import for `toTranslatedString` and `useI18n` locale

### Sub-task 7: Verification
- Run `npx vue-tsc --noEmit` — must pass with zero errors
- Run `npx vite build` — must pass with zero errors
- Search for any remaining `{{ .*(name|title|label|description|categoryName) }}` patterns that might be TranslatedString
