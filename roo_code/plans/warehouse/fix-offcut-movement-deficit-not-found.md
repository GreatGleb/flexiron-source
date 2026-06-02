# Fix: OFFCUT_NOT_FOUND / MOVEMENT_NOT_FOUND / DEFICIT_NOT_FOUND

## Root Cause

The offcut, movement, and deficit cards were implemented with a **different pattern** than the stock card. The stock card (working) embeds audit data directly in the main API response, while the other three cards make a **separate API call** for audit data via `loadAudit()`.

### The Stock Card Pattern (WORKING)

[`mockGetStockItem()`](frontend_vue/src/services/mocks/warehouse.ts:132-139) **overrides** `auditLog` with dynamically generated data:
```typescript
return { ...item, auditLog: getOrCreateStockAudit(productId) }
```

[`useWarehouseStockCard.load()`](frontend_vue/src/composables/useWarehouseStockCard.ts:83-103) reads audit directly from the main response:
```typescript
auditLog.value = data.auditLog ?? []
```
**No separate `loadAudit()` function.** No separate API call.

### The Broken Pattern (Offcut/Movement/Deficit)

[`mockGetOffcut()`](frontend_vue/src/services/mocks/warehouse.ts:400-404) returns the offcut **without** dynamic audit data:
```typescript
return { ...offcut }  // auditLog is [] from static mock data
```

[`useWarehouseOffcutCard.load()`](frontend_vue/src/composables/useWarehouseOffcutCard.ts:60-78) makes a **separate** API call for audit:
```typescript
await loadAudit()  // calls getOffcutAudit(id) separately
```

This separate call pattern is fragile and introduces a race condition / state issue that causes `OFFCUT_NOT_FOUND`.

## Fix Plan

### Step 1: Fix mock functions to embed audit data

Modify [`mockGetOffcut()`](frontend_vue/src/services/mocks/warehouse.ts:400-404) to override `auditLog` with dynamically generated data (like stock):

```typescript
export async function mockGetOffcut(id: string): Promise<WarehouseOffcut> {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  return { ...offcut, auditLog: getOrCreateOffcutAudit(id) }
}
```

Same for [`mockGetMovement()`](frontend_vue/src/services/mocks/warehouse.ts:599-603):

```typescript
export async function mockGetMovement(id: string): Promise<WarehouseMovement> {
  const movement = movementStore.find((m) => m.id === id)
  if (!movement) throw new Error('MOVEMENT_NOT_FOUND')
  return { ...movement, auditLog: getOrCreateMovementAudit(id) }
}
```

Same for [`mockGetDeficitItem()`](frontend_vue/src/services/mocks/warehouse.ts:740-744):

```typescript
export async function mockGetDeficitItem(id: string): Promise<WarehouseDeficit> {
  const item = deficitStore.find((d) => d.id === id)
  if (!item) throw new Error('DEFICIT_NOT_FOUND')
  return { ...item, auditLog: getOrCreateDeficitAudit(id) }
}
```

### Step 2: Fix composables to read audit from main response

Modify [`useWarehouseOffcutCard`](frontend_vue/src/composables/useWarehouseOffcutCard.ts):
1. Remove `loadAudit()` function entirely
2. Remove `getOffcutAudit` import from `@/services/warehouseService`
3. In `load()`, replace `await loadAudit()` with `auditLog.value = data.auditLog ?? []`
4. Keep `deleteAuditEntry()` as-is (it calls `deleteOffcutAuditEntry`)

Modify [`useWarehouseMovementCard`](frontend_vue/src/composables/useWarehouseMovementCard.ts):
1. Remove `loadAudit()` function entirely
2. Remove `getMovementAudit` import from `@/services/warehouseService`
3. In `load()`, replace `await loadAudit()` with `auditLog.value = data.auditLog ?? []`
4. Keep `deleteAuditEntry()` as-is

Modify [`useWarehouseDeficitCard`](frontend_vue/src/composables/useWarehouseDeficitCard.ts):
1. Remove `loadAudit()` function entirely
2. Remove `getDeficitAudit` import from `@/services/warehouseService`
3. In `load()`, replace `await loadAudit()` with `auditLog.value = data.auditLog ?? []`
4. Keep `deleteAuditEntry()` as-is

### Step 3: Verify

1. Run TypeScript compilation check
2. Verify all three cards load without NOT_FOUND errors
3. Verify audit tables display correctly with data
4. Verify audit delete functionality works

## Why This Fixes the Issue

The stock card pattern is simpler and more robust:
- **Single API call** for both main data and audit data
- **No race conditions** between parallel data fetches
- **Consistent state** - audit data is always in sync with the main entity
- **Proven working** - the stock card has been working correctly
