# Phase 5, Subtask 1: Create `useWarehouseOffcuts.ts` + `useWarehouseDeficit.ts`

## What needs to be done

Create two composables for managing offcut and deficit operations on the Warehouse page. These follow the same pattern as [`useWarehouseMovement.ts`](frontend_vue/src/composables/useWarehouseMovement.ts).

## Files to create

- [`frontend_vue/src/composables/useWarehouseOffcuts.ts`](frontend_vue/src/composables/useWarehouseOffcuts.ts) — new file
- [`frontend_vue/src/composables/useWarehouseDeficit.ts`](frontend_vue/src/composables/useWarehouseDeficit.ts) — new file

## Context

### Existing types (from [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts))

- [`OffcutCreatePayload`](frontend_vue/src/types/warehouse.ts:153) — payload for creating an offcut
- [`OffcutListItem`](frontend_vue/src/types/warehouse.ts:136) — offcut list item
- [`WarehouseOffcut`](frontend_vue/src/types/warehouse.ts:104) — full offcut entity
- [`DeficitCreatePayload`](frontend_vue/src/types/warehouse.ts:286) — payload for creating deficit item
- [`DeficitPatchPayload`](frontend_vue/src/types/warehouse.ts:293) — payload for updating deficit item
- [`DeficitListItem`](frontend_vue/src/types/warehouse.ts:274) — deficit list item
- [`WarehouseDeficit`](frontend_vue/src/types/warehouse.ts:250) — full deficit entity
- [`DeficitPriority`](frontend_vue/src/types/warehouse.ts:16) — `'critical' | 'high' | 'medium' | 'low'`
- [`DeficitStatus`](frontend_vue/src/types/warehouse.ts:19) — `'open' | 'in_progress' | 'ordered' | 'resolved' | 'cancelled'`

### Existing services (from [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts))

- [`createOffcut(data)`](frontend_vue/src/services/warehouseService.ts:114) — creates offcut → `WarehouseOffcut`
- [`deleteOffcut(id)`](frontend_vue/src/services/warehouseService.ts:118) — deletes offcut → `void`
- [`createDeficitItem(data)`](frontend_vue/src/services/warehouseService.ts:183) — creates deficit → `WarehouseDeficit`
- [`patchDeficitItem(id, delta)`](frontend_vue/src/services/warehouseService.ts:187) — updates deficit → `WarehouseDeficit`
- [`deleteDeficitItem(id)`](frontend_vue/src/services/warehouseService.ts:191) — deletes deficit → `void`

### Existing composables to use

- [`useToast`](frontend_vue/src/composables/useToast.ts) — for success/error notifications

### Existing i18n keys (from [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))

- `warehouse.toast_offcut_created` — "Offcut added"
- `warehouse.toast_offcut_deleted` — "Offcut deleted"
- `warehouse.toast_deficit_created` — "Deficit registered"
- `warehouse.toast_deficit_saved` — "Deficit updated"
- `warehouse.toast_deficit_deleted` — "Deficit record deleted"
- `warehouse.toast_error_save` — "Error saving data"

## Requirements for `useWarehouseOffcuts.ts`

### State
- `creating` — `Ref<boolean>`
- `deleting` — `Ref<boolean>`
- `error` — `Ref<string | null>`

### Methods
- `create(data: OffcutCreatePayload)` — call `createOffcut(data)`, return created offcut, show success toast. On error show error toast and throw.
- `remove(id: string)` — call `deleteOffcut(id)`, show success toast. On error show error toast and throw.

## Requirements for `useWarehouseDeficit.ts`

### State
- `creating` — `Ref<boolean>`
- `updating` — `Ref<boolean>`
- `deleting` — `Ref<boolean>`
- `error` — `Ref<string | null>`

### Methods
- `create(data: DeficitCreatePayload)` — call `createDeficitItem(data)`, return created deficit, show success toast. On error show error toast and throw.
- `update(id: string, delta: DeficitPatchPayload)` — call `patchDeficitItem(id, delta)`, return updated deficit, show success toast. On error show error toast and throw.
- `remove(id: string)` — call `deleteDeficitItem(id)`, show success toast. On error show error toast and throw.

## Acceptance criteria

- [ ] `useWarehouseOffcuts.ts` created with `create()` and `remove()` methods
- [ ] `useWarehouseDeficit.ts` created with `create()`, `update()`, and `remove()` methods
- [ ] Both use `useToast` for notifications
- [ ] Both properly typed with TypeScript
- [ ] Loading states exposed for UI binding
