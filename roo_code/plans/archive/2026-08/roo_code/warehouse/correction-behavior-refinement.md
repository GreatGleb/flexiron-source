# Correction Behavior Refinement

## Problem

When correction is selected as the movement type, the current behavior has issues:

1. **Default value**: The "Итоговое количество в выбранных" field defaults to the same value as "Количество в выбранных" (e.g., both show 200). This means the user must always change the value to save — a correction that doesn't change anything is meaningless.

2. **Validation**: The correction cannot be saved if "Итоговое количество в выбранных" equals "Количество в выбранных". Also, the value cannot be negative — a red error hint should appear below the field if it goes negative, and disappear when it's 0 or positive.

3. **Effect on total in stock**: When correcting a non-receipt aggregate (e.g., storage, write-off), the total in stock should NOT change. Only when correcting the `receipt` aggregate itself should the total in stock be affected.

## Current Code Analysis

### Script: `selectedAggregateAfter` computed (line 153)
```ts
const selectedAggregateAfter = computed(() => {
  if (!selectedAggregateType.value && !selectedSaleId.value) return null
  if (!type.value) return selectedAggregateQuantity.value
  const dir = movementDirection.value
  if (dir === 'correction') return quantity.value || 0  // <-- uses quantity ref
  ...
})
```

### Script: `totalInStockAfter` computed (line 173)
```ts
const totalInStockAfter = computed(() => {
  ...
  if (dir === 'correction') {
    const delta = (quantity.value || 0) - selectedAggregateQuantity.value
    return Math.max(0, base + delta)  // <-- always applies delta to base
  }
  ...
})
```

### Script: `validate()` function (line 216)
```ts
if (isCorrection.value) {
  if (quantity.value < 0) e.quantity = t('validation.required')
}
```

### Script: `isFormValid` computed (line 237)
```ts
if (isCorrection.value) {
  if (quantity.value < 0) return false
}
```

### Template: form fields (lines 542-596)
- For correction: the "new movement quantity" field is hidden
- The "after" field becomes editable and is bound to `quantity`
- The "total in stock after" field is always read-only

## Proposed Changes

### 1. Add a separate `correctionValue` ref for the correction "after" field

Currently, `quantity` is used for both the new movement quantity AND the correction "after" value. This causes the default to be 0 (from `quantity = ref(0)`), but the user wants it to default to `selectedAggregateQuantity`.

**Solution**: Keep `quantity` for non-correction movements. For correction, introduce a separate `correctionValue` ref that initializes to `selectedAggregateQuantity` when correction is selected.

Actually, simpler approach: keep using `quantity` but initialize it properly when correction is selected.

**Better solution**: Use a `watch` on `type` — when type changes to `correction`, set `quantity` to `selectedAggregateQuantity`. When type changes away from correction, reset `quantity` to 0.

Wait, but the user said: "движение с типом операции корректировка не может быть сохранено, если поле Итоговое количество в выбранных равно полю Количество в выбранных". So we need to validate that `quantity !== selectedAggregateQuantity` for correction.

### 2. Update validation for correction

Add validation rule: for correction, `quantity` must not equal `selectedAggregateQuantity` (no pointless corrections).

Also: for correction, `quantity` must be >= 0 (already partially done, but error message should be clearer).

### 3. Update `totalInStockAfter` for correction

Only apply the delta to the base when the selected aggregate type is `receipt`. If correcting any other aggregate type, the total in stock remains unchanged.

### 4. Update `isFormValid` for correction

Add check: `quantity.value === selectedAggregateQuantity.value` → form is invalid (no change = pointless correction).

## Detailed Implementation Plan

### File: `CreateMovementModal.vue`

#### A. Watch `type` to initialize `quantity` for correction

Add a watch that sets `quantity.value = selectedAggregateQuantity.value` when type changes to `correction`, and resets to 0 when type changes away from correction.

```ts
watch(type, (newType, oldType) => {
  if (newType === 'correction') {
    // Initialize correction value to the selected aggregate quantity
    quantity.value = selectedAggregateQuantity.value
  } else if (oldType === 'correction') {
    // Reset quantity when leaving correction mode
    quantity.value = 0
  }
})
```

#### B. Update `validate()` function

```ts
if (isCorrection.value) {
  if (quantity.value < 0) {
    e.quantity = t('validation.min', { min: 0 })
  } else if (quantity.value === selectedAggregateQuantity.value) {
    e.quantity = t('warehouse.correction_no_change')  // new i18n key
  }
}
```

#### C. Update `isFormValid` computed

```ts
if (isCorrection.value) {
  if (quantity.value < 0) return false
  if (quantity.value === selectedAggregateQuantity.value) return false
}
```

#### D. Update `totalInStockAfter` computed

```ts
if (dir === 'correction') {
  // Only affect total in stock when correcting the 'receipt' aggregate itself
  if (selectedAggregateType.value === 'receipt') {
    const delta = (quantity.value || 0) - selectedAggregateQuantity.value
    return Math.max(0, base + delta)
  }
  // Correcting any other aggregate type does NOT change total in stock
  return base
}
```

#### E. Update template: show error hint below the correction field

The `errors.quantity` is already shown in the template (line 581). We just need to ensure the error message is clear.

### File: `i18n/admin/warehouse.ts`

Add new i18n key:
- `correction_no_change`: "Значение должно отличаться от исходного" / "Value must differ from original" / "Reikšmė turi skirtis nuo pradinės"

## Summary of Changes

| # | File | Change |
|---|------|--------|
| 1 | `CreateMovementModal.vue` | Add `watch(type)` to initialize `quantity` to `selectedAggregateQuantity` when correction is selected |
| 2 | `CreateMovementModal.vue` | Update `validate()` — add check that correction value differs from original |
| 3 | `CreateMovementModal.vue` | Update `isFormValid` — add check that correction value differs from original |
| 4 | `CreateMovementModal.vue` | Update `totalInStockAfter` — only apply delta when correcting `receipt` aggregate |
| 5 | `i18n/admin/warehouse.ts` | Add `correction_no_change` key in ru/en/lt |
