# Plan: Add Descriptions to Movement Type Options in Dropdown

## Problem

In the "Add Movement" modal on the batch card page (`CreateMovementModal.vue`), the movement type dropdown (`CustomSelect`) shows only the label for each option (e.g., "Receipt", "Expense", "Transfer", "Write-off"). Users don't understand what each type means or what effect it will have, because there's no description visible inside the dropdown.

## Solution

Add a short hint/description under each option's label inside the dropdown list. The i18n translations for these hints already exist (`movement_type_hint_receipt`, `movement_type_hint_expense`, etc.) — they just need to be wired into the UI.

## Changes Required

### 1. Extend `SelectOption` interface — [`CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue:6)

Add an optional `hint` field to the `SelectOption` interface:

```ts
export interface SelectOption {
  value: string
  label?: string
  hint?: string   // <-- new optional description
}
```

### 2. Update `MOVEMENT_TYPE_OPTIONS` — [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:94)

Add `hint` to each movement type option, referencing the existing i18n keys:

```ts
const MOVEMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'receipt',   label: t('warehouse.type_receipt'),   hint: t('warehouse.movement_type_hint_receipt') },
  { value: 'expense',   label: t('warehouse.type_expense'),   hint: t('warehouse.movement_type_hint_expense') },
  { value: 'transfer',  label: t('warehouse.type_transfer'),  hint: t('warehouse.movement_type_hint_transfer') },
  { value: 'write-off', label: t('warehouse.type_write_off'), hint: t('warehouse.movement_type_hint_write_off') },
]
```

### 3. Update `CustomSelect` template — [`CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue:73-82)

Modify the default slot content for each option to render the hint below the label when `opt.hint` is present:

```vue
<div
  v-for="opt in options"
  :key="opt.value"
  class="custom-select-option"
  @click="select(opt.value)"
>
  <slot name="option" :option="opt">
    <div class="option-content">
      <span class="option-label">{{ opt.label ?? opt.value }}</span>
      <span v-if="opt.hint" class="option-hint">{{ opt.hint }}</span>
    </div>
  </slot>
</div>
```

### 4. Add CSS for hint text — [`_custom-select.css`](frontend_vue/src/styles/admin/components/_custom-select.css)

Add styles for the new `.option-content`, `.option-label`, and `.option-hint` classes:

```css
.custom-select-option .option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.custom-select-option .option-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}
.custom-select-option .option-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  line-height: 1.3;
  white-space: normal;
}
```

Also increase `max-height` of the dropdown list from `250px` to `350px` to accommodate the taller options.

## Visual Mockup

```
┌─────────────────────────────────────┐
│  Select operation type          ▼   │
├─────────────────────────────────────┤
│  Receipt                            │
│  Receipt of goods to warehouse      │
│  from supplier or production        │
├─────────────────────────────────────┤
│  Expense                            │
│  Expense of goods from warehouse    │
│  to production, sale or other       │
├─────────────────────────────────────┤
│  Transfer                           │
│  Internal transfer of goods between │
│  locations or warehouses            │
├─────────────────────────────────────┤
│  Write-off                          │
│  Write-off of goods due to defect,  │
│  damage, loss or expiration         │
└─────────────────────────────────────┘
```

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/src/components/admin/ui/CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue) | Add `hint` to `SelectOption` interface; update option template |
| [`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) | Add `hint` to each `MOVEMENT_TYPE_OPTIONS` entry |
| [`frontend_vue/src/styles/admin/components/_custom-select.css`](frontend_vue/src/styles/admin/components/_custom-select.css) | Add `.option-content`, `.option-label`, `.option-hint` styles; increase `max-height` |

## Testing

1. Open the batch card page (e.g., `/admin/warehouse/batches/whb-001`)
2. Click "Add Movement" button
3. Open the movement type dropdown
4. Verify each option shows its label **and** a description below it
5. Verify the descriptions are readable (proper contrast, spacing)
6. Verify the dropdown doesn't overflow the viewport (scroll if needed)
