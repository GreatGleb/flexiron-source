# Plan: Fix mockCreateOffcut — batch quantity + movement

## Problem

[`mockCreateOffcut`](frontend_vue/src/services/mocks/warehouse.ts:433) creates an offcut but:
1. ❌ Does NOT decrease `batch.quantityRemaining`
2. ❌ Does NOT create a movement record
3. ❌ Uses `data.sourceBatchId` (wrong field — `OffcutCreatePayload` has `batchId`)

## Changes

### File: [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

In `mockCreateOffcut` (line 433), after creating the offcut:

```ts
// 1. Find the batch
const batch = batchStore.find((b) => b.id === data.batchId)

// 2. Decrease batch quantity
if (batch) {
  batch.quantityRemaining = Math.max(0, batch.quantityRemaining - data.quantity)
  batch.updatedAt = now
  
  // 3. Create movement
  await mockCreateMovement({
    type: 'offcut',
    batchId: data.batchId,
    offcutId: id,
    quantity: data.quantity,
    unitPrice: 0,
    movedAt: now,
    notes: `Offcut created from batch ${batch.batchNumber}`,
  })
}
```

Also fix the offcut object creation:
- `sourceBatchId: data.sourceBatchId` → `batchId: data.batchId`
- `sourceBatchNumber: null` → `batchNumber: batch?.batchNumber ?? ''`

## Files affected

| File | Change |
|------|--------|
| [`services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts:433) | Fix `mockCreateOffcut` — add batch qty decrease + movement creation |
