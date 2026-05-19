# Phase 4, Subtask 4: Create `useWarehouseMovement.ts` composable

## What needs to be done

Create a composable that manages movement-related operations for the Movements tab on the Warehouse page. This composable handles creating movements, deleting movements, and managing the movement list state.

## Files to create

- [`frontend_vue/src/composables/useWarehouseMovement.ts`](frontend_vue/src/composables/useWarehouseMovement.ts) — new file

## Context

### Existing types (from [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts))

- [`MovementCreatePayload`](frontend_vue/src/types/warehouse.ts:217) — payload for creating a movement
- [`MovementListItem`](frontend_vue/src/types/warehouse.ts:201) — list item type
- [`WarehouseMovement`](frontend_vue/src/types/warehouse.ts:170) — full movement entity
- [`MovementType`](frontend_vue/src/types/warehouse.ts:7) — `'receipt' | 'expense' | 'transfer' | 'write-off'`

### Existing services (from [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts))

- [`createMovement(data)`](frontend_vue/src/services/warehouseService.ts:145) — creates movement → `WarehouseMovement`
- [`deleteMovement(id)`](frontend_vue/src/services/warehouseService.ts:149) — deletes movement → `void`
- [`getMovements(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:124) — fetches movement list

### Existing composables to use

- [`useToast`](frontend_vue/src/composables/useToast.ts) — for success/error notifications

### Existing i18n keys (from [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))

- `warehouse.toast_movement_created` — "Movement registered"
- `warehouse.toast_movement_deleted` — "Movement deleted"
- `warehouse.toast_error_save` — "Error saving data"

## Requirements

The composable should accept no parameters (it will be used within the WarehousePage context which already has its own state management via [`useWarehouse`](frontend_vue/src/composables/useWarehouse.ts)).

### State
- `creating` — `Ref<boolean>` — whether a create operation is in progress
- `deleting` — `Ref<boolean>` — whether a delete operation is in progress
- `error` — `Ref<string | null>`

### Methods
- `create(data: MovementCreatePayload)` — call `createMovement(data)`, return the created movement, show success toast. On error show error toast and throw.
- `remove(id: string)` — call `deleteMovement(id)`, show success toast. On error show error toast and throw.

### Usage pattern

```ts
const movementOps = useWarehouseMovement()

async function handleCreate(payload: MovementCreatePayload) {
  const movement = await movementOps.create(payload)
  // parent can then add to list or reload
}

async function handleDelete(id: string) {
  await movementOps.remove(id)
  // parent can then remove from list or reload
}
```

## Acceptance criteria

- [ ] Composable created at [`frontend_vue/src/composables/useWarehouseMovement.ts`](frontend_vue/src/composables/useWarehouseMovement.ts)
- [ ] Provides `create()` and `remove()` methods
- [ ] Uses `useToast` for success/error notifications
- [ ] Properly typed with all TypeScript interfaces
- [ ] Loading states exposed for UI binding
