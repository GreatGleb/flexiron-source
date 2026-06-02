# Fix: Correction Mode in Movement Modal

## Problem

When the user selects "Корректировка" (correction) as the movement type in the batch card's movement modal, the behavior should change:

1. **Hide** the "Количество в новом движении" (Quantity in new movement) field — because for correction, the user sets the **total** quantity directly, not an incremental amount.
2. **Make editable** the "Итоговое количество" (Total quantity) field — currently it's read-only and computed as `selectedMovementsQuantity + quantity`.

## Current Logic

- [`totalQuantityAfter`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:138-140): `selectedMovementsQuantity.value + (quantity.value || 0)` — always computed, read-only.
- [`quantity`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:34): `ref(0)` — always represents the "new movement" amount.
- Template lines 447-471: Two separate fields — "new movement quantity" (editable) and "total quantity" (read-only).

## Changes Required

All changes in [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue).

### 1. Add a computed `isCorrection` (line ~180 area)

```ts
const isCorrection = computed(() => type.value === 'correction')
```

### 2. Update `totalQuantityAfter` to handle correction mode

When `isCorrection` is true, the total quantity is just `quantity` (the user sets it directly). When not correction, it's `selectedMovementsQuantity + quantity`.

```ts
const totalQuantityAfter = computed(() => {
  if (isCorrection.value) return quantity.value || 0
  return selectedMovementsQuantity.value + (quantity.value || 0)
})
```

### 3. Update `validate()` to handle correction

For correction, the quantity validation should check that total quantity >= 0 (not > 0), since the user might set it to 0 to zero out the batch. Also, the expense/write-off remaining check doesn't apply to correction.

```ts
function validate(): boolean {
  const e: Record<string, string> = {}
  if (!type.value) e.type = t('validation.required')
  if (isCorrection.value) {
    if (quantity.value < 0) e.quantity = t('validation.required')
  } else {
    if (!quantity.value || quantity.value <= 0) e.quantity = t('validation.required')
  }
  if (!movedAt.value) e.movedAt = t('validation.required')
  if (
    !isCorrection.value &&
    (type.value === 'expense' || type.value === 'write-off') &&
    props.batch &&
    quantity.value > props.batch.quantityRemaining
  ) {
    e.quantity = t('validation.max', { max: props.batch.quantityRemaining })
  }
  errors.value = e
  return Object.keys(e).length === 0
}
```

### 4. Update `isFormValid` to handle correction

```ts
const isFormValid = computed(() => {
  if (!type.value || !movedAt.value) return false
  if (isCorrection.value) {
    if (quantity.value < 0) return false
  } else {
    if (quantity.value <= 0) return false
    if (
      (type.value === 'expense' || type.value === 'write-off') &&
      props.batch &&
      quantity.value > props.batch.quantityRemaining
    ) return false
  }
  return true
})
```

### 5. Update template — conditional visibility and editable total

```vue
<!-- New movement quantity (hidden for correction) -->
<template v-if="!isCorrection">
  <div class="form-group">
    <label class="field-label">{{ t('warehouse.field_new_movement_quantity') }} <span class="required">*</span></label>
    <input
      v-model.number="quantity"
      type="number"
      min="0"
      step="0.01"
      class="glass-input"
      data-test="create-movement-quantity-input"
    />
    <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
  </div>
</template>

<!-- Total quantity after (editable for correction, read-only otherwise) -->
<div class="form-group">
  <label class="field-label">{{ t('warehouse.field_total_quantity') }} <span v-if="isCorrection" class="required">*</span></label>
  <input
    v-if="isCorrection"
    v-model.number="quantity"
    type="number"
    min="0"
    step="0.01"
    class="glass-input"
    data-test="create-movement-total-qty"
  />
  <input
    v-else
    :value="totalQuantityAfter"
    type="number"
    class="glass-input"
    readonly
    data-test="create-movement-total-qty"
  />
</div>
```

### 6. Update `resetForm()` — no change needed, already resets `quantity` to 0

## Summary

| # | Location | Change |
|---|----------|--------|
| 1 | Add computed `isCorrection` | New computed property |
| 2 | `totalQuantityAfter` | Handle correction mode |
| 3 | `validate()` | Handle correction quantity validation |
| 4 | `isFormValid` | Handle correction form validity |
| 5 | Template (lines 447-471) | Conditional visibility + editable total for correction |
