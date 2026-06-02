# Add Currency Selector to Batch Card

## Problem

1. In [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:379-417), the **Цена за ед.** (unitPrice) field is a plain `<input type="number">` without any currency indicator — the user doesn't know what currency the price is in.
2. The **Общая стоимость** (totalCost) field at line 411 hardcodes `€` (euro): `` `${batch.totalCost.toFixed(2)} €` `` — but the currency should be dynamic.
3. There is no `currency` field on the [`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:36-71) type, nor in [`BatchPatchPayload`](frontend_vue/src/types/warehouse.ts:102-113).

## Solution

Add a currency selector dropdown (like the BccRequestPage's Price field pattern at [`BccRequestPage.vue:1104-1133`](frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:1104-1133)) to the unitPrice field, and make totalCost display the selected currency.

## Pattern to Follow

The BccRequestPage modal uses this structure:
```html
<div class="input-with-suffix custom-select-wrap">
  <input v-model="responsePrice" type="number" class="glass-input" />
  <div class="input-suffix custom-select-trigger" @click.stop="responseUnitOpen = !responseUnitOpen">
    <span class="curr-val">{{ responseUnit }}</span>
  </div>
  <div class="custom-select-list" :class="{ open: responseUnitOpen }">
    <div v-for="u in UNIT_OPTIONS" :key="u" class="custom-select-option" @click="selectUnit(u)">
      {{ u }}
    </div>
  </div>
</div>
```

The CSS classes `.input-with-suffix`, `.input-suffix`, `.custom-select-wrap`, `.custom-select-list`, `.custom-select-option`, `.custom-select-trigger` already exist in [`_input-suffix.css`](frontend_vue/src/styles/admin/components/_input-suffix.css) and [`main.css`](frontend_vue/src/styles/admin/main.css:563-700).

## Files to Modify

### 1. [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts)

Add `currency: string` field to:

- **`WarehouseBatch`** interface (after `totalCost` at line 57)
- **`BatchListItem`** interface (after `unitPrice` at line 82)
- **`BatchCreatePayload`** (add `currency?: string`)
- **`BatchPatchPayload`** (add `currency?: string`)

### 2. [`frontend_vue/src/composables/useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts)

Add `currency` to:

- The `form` ref reactive state (line 22-40) — add `currency: string`
- The `load()` function (line 104-113) — populate `form.currency` from `data.currency`
- The `save()` function (line 139-148) — re-populate `form.currency` from `updated.currency`
- The `discard()` function (line 162-171) — reset `form.currency` from `batch.value.currency`

### 3. [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)

**Script section changes:**
- Add `CURRENCY_OPTIONS` constant: `['EUR', 'USD', 'GBP', 'PLN']` (or similar)
- Add `currencyOpen` ref for dropdown visibility
- Add `selectCurrency(currency: string)` function
- Add click-outside handler (like BccRequestPage's `onDocClickCloseUnit`)

**Template changes:**
- Replace the plain unitPrice `<input>` (lines 390-397) with `input-with-suffix` + `custom-select-wrap` pattern
- Update totalCost display (line 411) from `` `${batch.totalCost.toFixed(2)} €` `` to use `form.currency` or `batch.currency`

### 4. [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts)

Add `currency: 'EUR'` to every mock batch object (there are ~80+ objects).

### 5. [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

Update mock service to handle `currency` in batch patch payloads — ensure the `patchBatch` mock function applies `currency` to the stored batch.

### 6. [`frontend_vue/src/i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts)

No changes strictly needed since currency codes (EUR, USD, etc.) are universal. But optionally add a `currency_` prefix translation map if localized currency names are desired.

## Implementation Order

1. **Types** — Add `currency` field to all TypeScript interfaces
2. **Mock data** — Add `currency: 'EUR'` to all mock batch objects
3. **Mock service** — Handle `currency` in patch operations
4. **Composable** — Add `currency` to form state, load, save, discard
5. **Template** — Replace unitPrice input with currency selector, update totalCost display
6. **CSS** — Ensure `.input-with-suffix` styles are imported (already in `_input-suffix.css`, may need import in the component)

## Visual Reference

The currency selector should look like this (same pattern as BccRequest modal):

```
┌──────────────────────┬──────────┐
│ [      input        ] │ [ EUR ▼ ] │
└──────────────────────┴──────────┘
                         ┌──────────┐
                         │ EUR      │
                         │ USD      │
                         │ GBP      │
                         │ PLN      │
                         └──────────┘
```

The totalCost field should display like: `1200.00 EUR` instead of `1200.00 €`
