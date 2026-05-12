# Fix: Replace native date inputs with DatePicker component

## Problem
The date filters in the Batches tab use native `<input type="date">` with class `glass-input`, which:
1. Uses the browser's native datepicker (inconsistent across browsers)
2. Has no gray calendar icon
3. Has no proper placeholder styling

The project already has a custom [`DatePicker`](frontend_vue/src/components/admin/ui/DatePicker.vue) component used in [`ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue:282) and [`SupplierFormSections.vue`](frontend_vue/src/components/admin/SupplierFormSections.vue:161) that provides:
- A custom calendar popup with consistent styling
- A gray calendar SVG icon (`opacity: 0.5`)
- Formatted date display (`DD.MM.YYYY`)

## Changes Required

### File: [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

1. **Import `DatePicker`** — add to the import section at the top:
   ```typescript
   import DatePicker from '@/components/admin/ui/DatePicker.vue'
   ```

2. **Replace the two `<input type="date">` elements** with `<DatePicker>` components:
   ```vue
   <!-- Before -->
   <input
     v-model="batchesFilters.dateFrom"
     type="date"
     class="glass-input"
     data-test="warehouse-batches-date-from"
   />

   <!-- After -->
   <DatePicker
     :model-value="batchesFilters.dateFrom ?? ''"
     data-test="warehouse-batches-date-from"
     @update:model-value="(v: string) => batchesFilters.dateFrom = v || undefined"
   />
   ```

   Same for `dateTo`.

## Type Compatibility
- `DatePicker` expects `modelValue: string` (required)
- `batchesFilters.dateFrom`/`dateTo` are `string | undefined`
- Solution: Use `:model-value` with `?? ''` fallback + `@update:model-value` handler (same pattern already used for `CustomSelect` in this file)

## Files to Modify
- [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — 2 changes (import + 2 DatePicker replacements)
