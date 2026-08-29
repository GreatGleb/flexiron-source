# Fix: Missing mock handler for GET /api/warehouse/movements/:id

## Problem

Navigating to `/admin/warehouse/movements/whm-072` shows error:
```
[mock] GET /api/warehouse/movements/whm-072 not found
```

The [`WarehouseMovementCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue) component calls [`getMovement(id)`](../../frontend_vue/src/composables/useWarehouseMovementCard.ts:23) which makes `GET /api/warehouse/movements/{id}`.

The mock handler [`getMock()`](../../frontend_vue/src/services/mocks/index.ts) has no route matcher for individual movement by ID — only the list endpoint is handled. All other warehouse card types (offcuts, batches, stock, deficit) have this handler; movements is the only one missing it.

## Changes Required

### File 1: [`frontend_vue/src/services/mocks/warehouse.ts`](../../frontend_vue/src/services/mocks/warehouse.ts)

Add a new exported function **after** `mockCreateMovement` (around line 600):

```ts
export async function mockGetMovement(id: string): Promise<WarehouseMovement> {
  const movement = movementStore.find((m) => m.id === id)
  if (!movement) throw new Error('MOVEMENT_NOT_FOUND')
  return { ...movement }
}
```

### File 2: [`frontend_vue/src/services/mocks/index.ts`](../../frontend_vue/src/services/mocks/index.ts)

1. Add `mockGetMovement` to the import from `'./warehouse'` (line 15-16 area)
2. Add a route matcher **before** the movements list handler (before line 307):

```ts
const movementCardMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
if (movementCardMatch) {
  return delay(mockGetMovement(movementCardMatch[1] as string) as T)
}
```

## Pattern Reference

This follows the exact same pattern as:
- [`mockGetOffcut(id)`](../../frontend_vue/src/services/mocks/warehouse.ts:399-403) + [`offcutCardMatch`](../../frontend_vue/src/services/mocks/index.ts:302-305)
- [`mockGetBatch(id)`](../../frontend_vue/src/services/mocks/warehouse.ts:227-231) + [`batchCardMatch`](../../frontend_vue/src/services/mocks/index.ts:281-284)
