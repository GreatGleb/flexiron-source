# Fix: CustomSelect Placeholder Bug in Batch Card Movement Modal

## Problem Description

The user reports two design bugs in the "Add Movement" window on the batch card page (`/admin/warehouse/batches/whb-001`):

1. **`CustomSelect` is not used (or used incorrectly)** — In [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:940), the movement type selector uses `CustomSelect` but passes a `:placeholder` prop that **doesn't exist** on the `CustomSelect` component. The prop is silently ignored by Vue, so no placeholder text is displayed.

2. **Placeholder text appears below the list instead of inside** — Since the `:placeholder` prop is not supported by [`CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue), the placeholder translation key `movement_modal_type_placeholder` (e.g., "Выберите тип операции") is never rendered. The user may be seeing the placeholder text rendered elsewhere (e.g., as a `<span>` below the select), which is incorrect.

## Root Cause Analysis

### Issue 1: `CustomSelect` has no `placeholder` prop

The [`CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue:11-15) component defines only these props:

```ts
const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  openUp?: boolean
}>()
```

There is **no `placeholder` prop**. When [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:944) passes `:placeholder="t('warehouse.movement_modal_type_placeholder')"`, Vue ignores it because it's not declared.

### Issue 2: No placeholder rendering logic in the template

The [`CustomSelect` template](frontend_vue/src/components/admin/ui/CustomSelect.vue:48-83) renders the currently selected value via `selectedLabel`:

```vue
<div class="curr-val">
  <slot name="selected" :label="selectedLabel" :value="modelValue">
    <span>{{ selectedLabel }}</span>
  </slot>
</div>
```

When `modelValue` is empty string `''` (as initialized in [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:169): `const movementType = ref<string>('')`), `selectedLabel` returns `''` because no option matches. The trigger shows an empty value — no placeholder text appears.

### Issue 3: The `CreateMovementModal` has a similar but different approach

In [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:243-247), the movement type `CustomSelect` does NOT pass a `placeholder` prop. Instead, it relies on the default value `'expense'` being pre-selected. However, the batch selector (`batchId`) uses a first option with `{ value: '', label: t('warehouse.filter_batch_placeholder') }` as a fake placeholder option — this works but is inconsistent with the design system.

## Scope of Changes

| File | Change |
|------|--------|
| [`CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue) | Add `placeholder` prop and render it when no value is selected |
| [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) | Already passes `:placeholder` — will work after `CustomSelect` is fixed |
| [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) | Add `:placeholder` to the movement type `CustomSelect` for consistency |

## Plan

### Step 1: Add `placeholder` prop to `CustomSelect.vue`

**File:** [`frontend_vue/src/components/admin/ui/CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue)

1. Add `placeholder` to the props definition:
   ```ts
   const props = defineProps<{
     modelValue: string
     options: SelectOption[]
     openUp?: boolean
     placeholder?: string
   }>()
   ```

2. Update the `selectedLabel` computed to return the placeholder when no value is selected:
   ```ts
   const selectedLabel = computed(() => {
     if (!props.modelValue && props.placeholder) return props.placeholder
     const opt = props.options.find((o) => o.value === props.modelValue)
     return opt?.label ?? opt?.value ?? ''
   })
   ```

3. Add a CSS class for placeholder styling (dimmed text) — the existing `.curr-val` already uses `color: var(--text-dim)`, so placeholder text will automatically appear dimmed.

### Step 2: Add `placeholder` to `CreateMovementModal.vue` movement type selector

**File:** [`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue)

Add `:placeholder` to the movement type `CustomSelect` at line 243:
```vue
<CustomSelect
  v-model="type"
  :options="MOVEMENT_TYPE_OPTIONS"
  :placeholder="t('warehouse.movement_modal_type_placeholder')"
  data-test="create-movement-type-select"
/>
```

Also consider changing the default value from `'expense'` to `''` so the placeholder is visible on first open (or keep `'expense'` as default — this is a UX decision).

### Step 3: Verify the fix

- Open the batch card page at `/admin/warehouse/batches/whb-001`
- Click "Add Movement" to open the modal
- Verify the movement type selector shows the placeholder text (e.g., "Выберите тип операции") inside the select trigger
- Verify the `CreateMovementModal` also shows the placeholder when no type is selected

## Affected Files Summary

| # | File | Action |
|---|------|--------|
| 1 | [`frontend_vue/src/components/admin/ui/CustomSelect.vue`](frontend_vue/src/components/admin/ui/CustomSelect.vue) | Add `placeholder` prop + rendering logic |
| 2 | [`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) | Add `:placeholder` to movement type `CustomSelect` |
| 3 | [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) | No changes needed — already passes `:placeholder` |
