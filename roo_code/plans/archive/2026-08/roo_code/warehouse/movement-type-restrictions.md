# Movement Type Restrictions Based on Selected Aggregate

## Overview

The movement type dropdown in `CreateMovementModal.vue` needs to be dynamically filtered based on which aggregate type (if any) is currently selected. Additionally, `transfer` should be permanently removed from the available options since this modal only handles quantity/status changes, not physical relocation.

## Rules

### 1. No aggregate selected (default)
Only **receipt** (поступление) is available — it's the only movement type that doesn't require linking to existing stock.

### 2. Aggregate selected — receipt is NEVER available
When any aggregate type is selected, `receipt` is removed from options.

### 3. Per-aggregate type restrictions

`receipt` (в наличии) is special — it means stock is physically present and can be transformed into any other state except `return` and `receipt` itself.

All other statuses (sale, production, expense, write-off, storage) only allow `return` and `correction` — you can either reverse them (return) or adjust the quantity (correction).

| Selected Aggregate | Available Movement Types |
|---|---|
| `receipt` (в наличии) | `sale`, `production`, `expense`, `write-off`, `storage`, `return-to-supplier`, `correction` |
| `sale` (продажа) | `return`, `correction` |
| `production` (в производстве) | `return`, `correction` |
| `expense` (израсходовано) | `return`, `correction` |
| `write-off` (в утиль) | `return`, `correction` |
| `storage` (хранение) | `return`, `correction` |

### 4. `transfer` is permanently removed
The `transfer` movement type is never available in this modal — it's for physical relocation, not quantity/status changes.

## Implementation Plan

### File: `frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`

#### 1. Remove `transfer` from `MOVEMENT_TYPE_OPTIONS` (line ~221)
Delete the transfer entry from the static array.

#### 2. Add `availableMovementTypes` computed property
Replace usage of `MOVEMENT_TYPE_OPTIONS` in the template with a computed that filters based on `selectedAggregateType`.

Logic:
```ts
const AVAILABLE_MOVEMENT_TYPES: SelectOption[] = [
  { value: 'receipt', ... },
  { value: 'sale', ... },
  { value: 'production', ... },
  { value: 'expense', ... },
  { value: 'write-off', ... },
  { value: 'storage', ... },
  { value: 'return', ... },
  { value: 'return-to-supplier', ... },
  { value: 'correction', ... },
]

// Types that only allow return/correction when selected
const RESTRICTED_TO_RETURN_CORRECTION = new Set([
  'sale', 'production', 'expense', 'write-off', 'storage'
])

const availableMovementTypes = computed(() => {
  if (!selectedAggregateType.value) {
    // No aggregate selected — only receipt is available
    return AVAILABLE_MOVEMENT_TYPES.filter(o => o.value === 'receipt')
  }

  // Aggregate selected — receipt is never available
  let filtered = AVAILABLE_MOVEMENT_TYPES.filter(o => o.value !== 'receipt')

  if (selectedAggregateType.value === 'receipt') {
    // Receipt (в наличии): all except return and receipt itself
    filtered = filtered.filter(o => o.value !== 'return')
  } else {
    // All other statuses: only return and correction
    filtered = filtered.filter(o => o.value === 'return' || o.value === 'correction')
  }

  return filtered
})
```

#### 3. Watch `selectedAggregateType` to clear invalid `type`
If the user has a movement type selected and then changes the aggregate selection, the current `type` value might become invalid. Add a watcher:

```ts
watch(selectedAggregateType, () => {
  if (type.value && !availableMovementTypes.value.some(o => o.value === type.value)) {
    type.value = ''
  }
})
```

#### 4. Update template
Change:
```html
:options="MOVEMENT_TYPE_OPTIONS"
```
to:
```html
:options="availableMovementTypes"
```

## Files to Modify

1. `frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue` — main changes
