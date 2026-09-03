# Add readonly "Unit of Measurement" field to Batch Card

## Goal

Add a readonly field "Ед. изм." (Unit of Measurement) to the batch card page (`warehouse/batches/whb-024`), displaying the unit from the associated product — exactly as done in the stock card (`warehouse/stock/prod-003`).

## Analysis

### Current state

1. **Type** [`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:36) already has `unit: StockUnit` field (line 53).
2. **Composable** [`useWarehouseBatch`](frontend_vue/src/composables/useWarehouseBatch.ts:23) — the `form` ref does **NOT** include `unit`. It only tracks: `batchNumber, lotCode, quantity, unitPrice, currency, location, certificateRef, status, notes`.
3. **Template** [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:423) — `unit` is only used inline in the `quantityRemaining` readonly display: `` `${batch.quantityRemaining} ${t(`warehouse.unit_${batch.unit}`)}` ``.
4. **Patch type** [`BatchPatchPayload`](frontend_vue/src/types/warehouse.ts:110) does **NOT** include `unit` — it's a readonly field derived from the product, not editable on the batch.
5. **Stock card reference** [`WarehouseStockCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue:182-201) — has a dedicated readonly `unit` field with label `t('warehouse.col_unit')` and tooltip `t('warehouse.col_unit_hint')`.
6. **i18n keys** `col_unit` and `col_unit_hint` already exist in all 3 locales (ru, en, lt) in [`warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts).

### User feedback

The user specified: **"добавить во вторую секцию где пишется количество"** — add to the **second (center) column** where quantity fields are.

## Changes Required

### 1. [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts)

**Add `unit` to the form type and initial value:**

```typescript
// In the form type (line 23-33), add:
unit: StockUnit

// In the initial value (line 33-43), add:
unit: 'kg'
```

**Update `load()`** (line 107-117) — populate `form.value.unit` from `data.unit`:

```typescript
form.value = {
  batchNumber: data.batchNumber,
  lotCode: data.lotCode,
  quantity: data.quantity,
  unitPrice: data.unitPrice,
  currency: data.currency,
  unit: data.unit,        // ← ADD
  location: data.location,
  certificateRef: data.certificateRef,
  status: data.status,
  notes: data.notes,
}
```

**Update `save()`** (line 143-153) — same for the save path:

```typescript
form.value = {
  batchNumber: updated.batchNumber,
  lotCode: updated.lotCode,
  quantity: updated.quantity,
  unitPrice: updated.unitPrice,
  currency: updated.currency,
  unit: updated.unit,        // ← ADD
  location: updated.location,
  certificateRef: updated.certificateRef,
  status: updated.status,
  notes: updated.notes,
}
```

**Update `discard()`** (line 165-177) — same:

```typescript
form.value = {
  batchNumber: batch.value.batchNumber,
  lotCode: batch.value.lotCode,
  quantity: batch.value.quantity,
  unitPrice: batch.value.unitPrice,
  currency: batch.value.currency,
  unit: batch.value.unit,        // ← ADD
  location: batch.value.location,
  certificateRef: batch.value.certificateRef,
  status: batch.value.status,
  notes: batch.value.notes,
}
```

**No changes needed to `buildDelta`/`diff`** — since `unit` is readonly (not in `BatchPatchPayload`), it won't be sent to the server. The `useDirtyCheck` will detect it as dirty if it changes, but since it's readonly in the UI, it will never actually change.

### 2. [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)

**Add readonly unit field in the center column** (after `quantityRemaining`, before `unitPrice`), matching the stock card pattern:

```vue
<div class="input-group">
  <label class="field-label">
    <span>{{ t('warehouse.col_unit') }}</span>
    <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </span>
  </label>
  <input
    :value="t(`warehouse.unit_${form.unit}`)"
    class="glass-input"
    type="text"
    readonly
    data-test="field-unit"
  />
  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
</div>
```

**Placement:** Insert this block right after the `quantityRemaining` input group (after line 431) and before the `unitPrice` input group (line 432), in the center column `<GlassPanel>`.

### 3. No i18n changes needed

Keys `col_unit`, `col_unit_hint`, `unit_kg`, `unit_m`, `unit_pcs`, `unit_m2`, and `hint_readonly` already exist in all locales.

## Files to modify

| File | Changes |
|------|---------|
| [`frontend_vue/src/composables/useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) | Add `unit` to form type, initial value, load(), save(), discard() |
| [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) | Add readonly unit field in center column after quantityRemaining |

## Visual reference (stock card pattern)

The unit field in the stock card looks like:

```
┌─────────────────────────────────────┐
│  Ед. изм.  ⓘ                       │
│  ┌──────────────────────────────┐   │
│  │ кг                           │   │
│  └──────────────────────────────┘   │
│  Значение наследуется из товара     │
└─────────────────────────────────────┘
```

The batch card will have the exact same appearance in the center column.
