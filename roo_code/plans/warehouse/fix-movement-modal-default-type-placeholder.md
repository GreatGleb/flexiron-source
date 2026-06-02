# Fix: Movement Type Default Value in CreateMovementModal

## Problem

In the batch card's movement creation modal ([`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue)), the "Тип операции" (Movement Type) dropdown always has `'expense'` pre-selected by default. The user wants the dropdown to show a placeholder "Выберите операцию" (Select operation) instead, with no type pre-selected.

## Root Cause

1. The `type` ref is initialized as `ref<MovementType>('expense')` at line 33 — this hardcodes `'expense'` as the default.
2. The `resetForm()` function at line 218 resets `type.value = 'expense'` every time the modal opens.
3. Since `type` always has a value, the `placeholder` prop passed to `CustomSelect` (line 426) is never displayed — `CustomSelect` only shows the placeholder when `modelValue` is empty/falsy.

## Current State

- [`CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue) already supports a `placeholder` prop (added in a previous fix).
- [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:426) already passes `:placeholder="t('warehouse.movement_modal_type_placeholder')"`.
- The CSS already has a `.placeholder` class for dimmed italic styling ([`_custom-select.css`](frontend_vue/src/styles/admin/components/_custom-select.css:16-19)).
- The i18n key `movement_modal_type_placeholder` already exists in all 3 languages (ru/en/lt).

## Changes Required

All changes are in [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue).

### 1. Change default value of `type` ref (line 33)

```ts
// Before:
const type = ref<MovementType>('expense')

// After:
const type = ref<MovementType>('')
```

### 2. Update `resetForm()` to reset type to empty string (line 218)

```ts
// Before:
type.value = 'expense'

// After:
type.value = ''
```

### 3. Update `validate()` to handle empty type (lines 151-166)

The validation already checks `if (!type.value)` at line 153, so this is already correct. No change needed.

### 4. Update `isFormValid` to require type selection (lines 168-176)

The check `if (!type.value || quantity.value <= 0 || !movedAt.value)` at line 169 already handles empty type. No change needed.

### 5. Update `showTransferLocations` and `showReference` (lines 180-181)

```ts
// Before:
const showTransferLocations = computed(() => type.value === 'transfer')
const showReference = computed(() => type.value === 'expense' || type.value === 'write-off')

// After:
// No change needed — these already only show when a specific type is selected.
// When type is '', both will be false, which is correct.
```

### 6. Update `selectedMovementEffect` to handle empty type (lines 184-190)

```ts
// Before:
const selectedMovementEffect = computed(() => {
  if (!type.value) return ''
  // ...
})

// After:
// No change needed — already returns '' when type is empty.
```

### 7. Update `MOVEMENT_TYPE_OPTIONS` — ensure no empty-value option exists (lines 194-204)

The options array already has no empty-value entry, so no change needed.

## Summary of Actual Code Changes

| # | Location | Change |
|---|----------|--------|
| 1 | Line 33: `const type = ref<MovementType>('expense')` | Change to `ref<MovementType>('')` |
| 2 | Line 218: `type.value = 'expense'` in `resetForm()` | Change to `type.value = ''` |

Only **2 lines** need to be changed. All other logic (validation, conditional visibility, form validity) already correctly handles an empty `type` value.

## Verification

1. Open the batch card page at `/admin/warehouse/batches/whb-001`
2. Click "Добавить движение" (Add Movement) to open the modal
3. Verify the movement type dropdown shows the placeholder "Выберите тип операции"
4. Verify the "Сохранить" (Save) button is disabled until a type is selected
5. Verify that selecting a type enables the save button and shows the type effect description
6. Verify that conditional fields (reference, transfer locations) only appear when the appropriate type is selected
