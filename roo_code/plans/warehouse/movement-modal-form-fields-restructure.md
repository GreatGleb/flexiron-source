# Movement Modal: Form Fields Restructure

## Current State

The form has these quantity-related fields:

1. **"Количество в выбранных"** (`field_selected_quantity`) — read-only display of selected aggregate quantity. Shown only when `selectedAggregateType || selectedSaleId`.
2. **"Количество в новом движении"** (`field_new_movement_quantity`) — editable input for new movement quantity. Hidden for correction (`v-if="!isCorrection"`).
3. **"Итоговое количество"** (`field_total_quantity`) — read-only sum of selected + new (for non-correction), or editable (for correction, bound to `quantity`).

## Required Changes

### New Field: "Итоговое количество в выбранных" (read-only auto-calculated)

- Appears only when user has selected an aggregate type or active sale
- Default value = same as "Количество в выбранных" (the selected aggregate quantity)
- Calculates what the selected stock type will have AFTER the new movement
- **Adds or subtracts** the new movement quantity depending on movement type:
  - **Incoming types** (add to selected): `receipt`, `return`, `return-to-supplier`, `correction`
  - **Outgoing types** (subtract from selected): `sale`, `expense`, `write-off`, `production`, `storage`, `transfer`
- For **correction**: this field becomes editable (same behavior as current "Итоговое количество")
- Read-only hint text below the field: "Рассчитывается автоматически"

### Rename: "Количество в новом движении" → "Количество товаров в новом движении"

- Just a label change in i18n
- Hidden for correction (as before)
- Read-only hint text below: "Рассчитывается автоматически" (but it IS editable... actually this one is editable by user, so no hint needed)

Wait — re-reading the user's request:

> все реад онли поля - нужно добавить под ними надпись, что они рассчитываются автоматически и их нельзя редактировать.

So the hint is only for read-only fields. The "Количество товаров в новом движении" is editable, so no hint needed there.

### Rename: "Итоговое количество" → "Итоговое количество товаров в наличии"

- This field shows the total quantity of goods **in stock** after the movement
- Default value = batch's current `quantity` (total in stock)
- Changes when user modifies "Количество товаров в новом движении" (or the correction field)
- For **correction**: this field is NOT editable (user edits the "Итоговое количество в выбранных" instead)
- Read-only hint text below: "Рассчитывается автоматически"

Wait, let me re-read the user's request more carefully:

> также поле Итоговое количество надо переименовать на Итоговое количество товаров в наличии (или как то так, чтобы было ясно что это количество товаров в наличии, которое будет после нового движения) это поле также реад онли, по умолчанию оно равно количеству товаров которое уже в наличии. и потом рассчитывается при изменении поля Количество в новом движении * либо при изменении другого поля во время коррекции.

So the "Итоговое количество товаров в наличии" is:
- Always read-only
- Default = batch.quantity (total in stock)
- Changes when "Количество товаров в новом движении" changes
- During correction: changes when the correction field changes

But wait — what does "total in stock after movement" mean exactly? Let me think...

The batch has a total quantity (e.g., 1000 kg). The aggregates sum to 1000 kg. If we do a new movement of +50 kg (receipt), the total in stock becomes 1050. If we do -30 kg (sale), total becomes 970.

So: `totalInStockAfter = batch.quantity + (incoming ? +qty : -qty)`

Where incoming types are: receipt, return, return-to-supplier, correction
And outgoing types are: sale, expense, write-off, production, storage, transfer

### Correction behavior

For correction:
- "Количество товаров в новом движении" — hidden (as before)
- "Итоговое количество в выбранных" — becomes **editable** (user sets the new total for the selected aggregate)
- "Итоговое количество товаров в наличии" — read-only, calculated as: `batch.quantity + (newAggregateTotal - oldAggregateQuantity)`

Actually, for correction the calculation is:
- Old selected aggregate quantity = `selectedAggregateQuantity`
- New selected aggregate quantity = `quantity` (the correction value)
- Delta = `quantity - selectedAggregateQuantity`
- Total in stock after = `batch.quantity + delta`

### Movement type effect on calculation

For the "Итоговое количество в выбранных" field:

| Movement Type | Effect on Selected Aggregate | Formula |
|---|---|---|
| receipt | + | selectedAggregateQuantity + newQty |
| sale | - | selectedAggregateQuantity - newQty |
| production | - | selectedAggregateQuantity - newQty |
| expense | - | selectedAggregateQuantity - newQty |
| write-off | - | selectedAggregateQuantity - newQty |
| storage | - | selectedAggregateQuantity - newQty |
| return | + | selectedAggregateQuantity + newQty |
| return-to-supplier | + | selectedAggregateQuantity + newQty |
| correction | = | quantity (editable) |

For "Итоговое количество товаров в наличии":

| Movement Type | Effect on Total Stock | Formula |
|---|---|---|
| receipt | + | batch.quantity + newQty |
| sale | - | batch.quantity - newQty |
| production | - | batch.quantity - newQty |
| expense | - | batch.quantity - newQty |
| write-off | - | batch.quantity - newQty |
| storage | - | batch.quantity - newQty |
| return | + | batch.quantity + newQty |
| return-to-supplier | - | batch.quantity - newQty |
| correction | ± | batch.quantity + (quantity - selectedAggregateQuantity) |

Wait, `return-to-supplier` — is it incoming or outgoing? Returning to supplier means goods leave the warehouse, so it's outgoing (subtract). But the user said "возвращено поставщику" is a status... Let me think about this differently.

Actually, the movement type determines the direction:
- **Incoming** (adds to stock): `receipt`, `return`
- **Outgoing** (removes from stock): `sale`, `expense`, `write-off`, `production`, `storage`, `transfer`, `return-to-supplier`
- **Neutral** (correction): user sets the new value directly

Let me define a helper:

```ts
const movementDirection = computed(() => {
  if (!type.value) return 'none'
  const incoming = new Set(['receipt', 'return'])
  if (incoming.has(type.value)) return 'incoming'
  if (type.value === 'correction') return 'correction'
  return 'outgoing'
})
```

Then:
```ts
const selectedAggregateAfter = computed(() => {
  if (!selectedAggregateType.value && !selectedSaleId.value) return null
  if (!type.value) return selectedAggregateQuantity.value
  
  const dir = movementDirection.value
  if (dir === 'correction') return quantity.value || 0
  if (dir === 'incoming') return selectedAggregateQuantity.value + (quantity.value || 0)
  if (dir === 'outgoing') return Math.max(0, selectedAggregateQuantity.value - (quantity.value || 0))
  return selectedAggregateQuantity.value
})

const totalInStockAfter = computed(() => {
  if (!props.batch) return 0
  if (!type.value) return props.batch.quantity
  
  const dir = movementDirection.value
  if (dir === 'correction') {
    const delta = (quantity.value || 0) - selectedAggregateQuantity.value
    return props.batch.quantity + delta
  }
  if (dir === 'incoming') return props.batch.quantity + (quantity.value || 0)
  if (dir === 'outgoing') return Math.max(0, props.batch.quantity - (quantity.value || 0))
  return props.batch.quantity
})
```

## Files to Modify

### 1. [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue)

**Script changes:**
- Add `movementDirection` computed (incoming/outgoing/correction/none)
- Add `selectedAggregateAfter` computed (what selected aggregate will be after movement)
- Add `totalInStockAfter` computed (what total stock will be after movement)
- Remove old `totalQuantityAfter` computed (replaced by the two new computeds)
- Update `validate()` and `isFormValid` to use new field names/logic

**Template changes:**
- Replace "Количество в выбранных" section with:
  1. "Количество в выбранных" (read-only, shown when aggregate/sale selected)
  2. "Итоговое количество в выбранных" (read-only, shown when aggregate/sale selected AND type selected; editable for correction)
  3. Read-only hint below: "Рассчитывается автоматически"
- Rename "Количество в новом движении" label → "Количество товаров в новом движении"
- Rename "Итоговое количество" → "Итоговое количество товаров в наличии"
- Make "Итоговое количество товаров в наличии" always read-only
- Add read-only hint below both read-only fields

### 2. [`warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) (i18n)

Add/modify keys in all 3 languages (ru/en/lt):

| Key | Current | New |
|---|---|---|
| `field_selected_quantity` | "Количество в выбранных" | Keep (no change) |
| `field_new_movement_quantity` | "Количество в новом движении" | "Количество товаров в новом движении" |
| `field_total_quantity` | "Итоговое количество" | "Итоговое количество товаров в наличии" |
| `field_selected_after` | — | "Итоговое количество в выбранных" (NEW) |
| `field_readonly_hint` | — | "Рассчитывается автоматически" (NEW) |

### 3. [`_forms.css`](frontend_vue/src/styles/admin/components/_forms.css)

Add styles for the read-only hint text (`.field-readonly-hint`).

## Template Structure (After Changes)

```html
<!-- Selected aggregate quantity (read-only) — shown when aggregate/sale selected -->
<div v-if="selectedAggregateType || selectedSaleId" class="form-group">
  <label class="field-label">{{ t('warehouse.field_selected_quantity') }}</label>
  <div class="selected-qty-display" data-test="create-movement-selected-qty">
    <span class="selected-qty-value">{{ selectedAggregateQuantity }}</span>
    <span v-if="batchUnitLabel" class="qty-unit">{{ batchUnitLabel }}</span>
  </div>
</div>

<!-- New movement quantity (hidden for correction) -->
<template v-if="!isCorrection">
  <div class="form-group">
    <label class="field-label">{{ t('warehouse.field_new_movement_quantity') }} <span class="required">*</span></label>
    <input
      v-model.number="quantity"
      type="number"
      min="0"
      :step="quantityStep"
      class="glass-input"
      data-test="create-movement-quantity-input"
    />
    <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
  </div>
</template>

<!-- Selected aggregate after (read-only; editable for correction) — shown when aggregate/sale selected AND type selected -->
<div v-if="(selectedAggregateType || selectedSaleId) && type" class="form-group">
  <label class="field-label">
    {{ t('warehouse.field_selected_after') }}
    <span v-if="isCorrection" class="required">*</span>
  </label>
  <input
    v-if="isCorrection"
    v-model.number="quantity"
    type="number"
    min="0"
    :step="quantityStep"
    class="glass-input"
    data-test="create-movement-selected-after"
  />
  <input
    v-else
    :value="selectedAggregateAfter"
    type="number"
    class="glass-input"
    readonly
    data-test="create-movement-selected-after"
  />
  <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
  <p v-if="!isCorrection" class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
</div>

<!-- Total in stock after (always read-only) — shown when type selected -->
<div v-if="type" class="form-group">
  <label class="field-label">{{ t('warehouse.field_total_quantity') }}</label>
  <input
    :value="totalInStockAfter"
    type="number"
    class="glass-input"
    readonly
    data-test="create-movement-total-stock-after"
  />
  <p class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
</div>
```

## Validation Updates

- `validate()`: For non-correction, validate `quantity > 0` (as before)
- `isFormValid`: For non-correction, check `quantity > 0` (as before)
- For correction: validate `quantity >= 0` (as before)
- Remove the old `quantity > batch.quantityRemaining` check for expense/write-off — this was for the old movement selection model. Now we work with aggregates, not individual movements.

Actually, let me keep the quantityRemaining check for now since it's a safety net. But it should compare against the selected aggregate quantity, not batch.quantityRemaining.

Hmm, actually the user didn't mention changing validation. Let me keep it simple and just restructure the fields as requested.

## Summary of Changes

| # | Change | File |
|---|--------|------|
| 1 | Add `movementDirection` computed | CreateMovementModal.vue |
| 2 | Add `selectedAggregateAfter` computed | CreateMovementModal.vue |
| 3 | Add `totalInStockAfter` computed | CreateMovementModal.vue |
| 4 | Remove old `totalQuantityAfter` computed | CreateMovementModal.vue |
| 5 | Update template: add "Итоговое количество в выбранных" field | CreateMovementModal.vue |
| 6 | Update template: rename "Итоговое количество" → "Итоговое количество товаров в наличии" | CreateMovementModal.vue |
| 7 | Update template: rename "Количество в новом движении" → "Количество товаров в новом движении" | CreateMovementModal.vue |
| 8 | Update template: add read-only hints | CreateMovementModal.vue |
| 9 | Add i18n keys: `field_selected_after`, `field_readonly_hint` | warehouse.ts (3 languages) |
| 10 | Update i18n keys: `field_new_movement_quantity`, `field_total_quantity` | warehouse.ts (3 languages) |
| 11 | Add CSS for `.field-readonly-hint` | _forms.css |
