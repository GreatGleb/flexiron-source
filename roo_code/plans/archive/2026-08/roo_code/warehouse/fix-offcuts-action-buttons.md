# Fix: Offcuts Action Buttons ("Использован" / "В утиль")

## Bug Description

The "Mark as Used" (`btn_mark_used`) and "Mark as Scrap" (`btn_mark_scrap`) buttons on the offcuts tab at `/admin/warehouse/offcuts` show a generic error toast ("Произошла ошибка") when clicked.

## Root Cause

The function [`updateOffcutStatus`](frontend_vue/src/composables/useWarehouse.ts:363) incorrectly calls [`patchDeficitItemApi`](frontend_vue/src/services/warehouseService.ts:198) — the **deficit** PATCH endpoint (`PATCH /api/warehouse/deficit/{id}`) — instead of an offcut-specific PATCH endpoint. Since offcut IDs (e.g., `who-001`) don't exist in the deficit store, the mock handler throws `'DEFICIT_NOT_FOUND'`, resulting in a generic error toast.

This is a copy-paste defect: `updateOffcutStatus` was modeled after [`updateDeficitStatus`](frontend_vue/src/composables/useWarehouse.ts:383) but the API call was never updated.

## Fix Plan (5 Layers)

### Layer 1: Types — Add `OffcutPatchPayload`

**File:** [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts)

Add after `OffcutCreatePayload` (after line ~166):

```typescript
export interface OffcutPatchPayload {
  status?: OffcutStatus
  notes?: string | null
  location?: string | null
}
```

### Layer 2: Service — Add `patchOffcut` function

**File:** [`frontend_vue/src/services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts)

Add after `createOffcut` (after line ~128), before `deleteOffcut`:

```typescript
export async function patchOffcut(
  id: string,
  data: OffcutPatchPayload,
): Promise<WarehouseOffcut> {
  const response = await api.patch<WarehouseOffcut>(`/api/warehouse/offcuts/${id}`, data)
  return response.data
}
```

Add import for `OffcutPatchPayload` and `WarehouseOffcut` (they should already be imported from `@/types/warehouse`).

### Layer 3: Mocks — Add `mockPatchOffcut` handler

**File:** [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

Add after `mockCreateOffcut` (after line ~438), before `mockDeleteOffcut`:

```typescript
export async function mockPatchOffcut(
  id: string,
  data: {
    status?: string
    notes?: string | null
    location?: string | null
  },
): Promise<WarehouseOffcut> {
  const index = offcutStore.findIndex((o) => o.id === id)
  if (index === -1) throw new Error('OFFCUT_NOT_FOUND')
  
  const offcut = offcutStore[index]!
  
  if (data.status !== undefined) {
    offcut.status = data.status as OffcutStatus
  }
  if (data.notes !== undefined) {
    offcut.notes = data.notes
  }
  if (data.location !== undefined) {
    offcut.location = data.location
  }
  
  offcut.updatedAt = new Date().toISOString()
  offcutStore[index] = { ...offcut }
  
  return { ...offcut }
}
```

### Layer 4: Mock Router — Add PATCH route for offcuts

**File:** [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)

**Step A:** Add `mockPatchOffcut` to the import from `'./warehouse'` (around line 2-26).

**Step B:** Add the route handler in the PATCH section (after the stock patch match, around line 533):

```typescript
const offcutPatchMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
if (offcutPatchMatch) {
  return delay(
    mockPatchOffcut(offcutPatchMatch[1] as string, body as Parameters<typeof mockPatchOffcut>[1]) as T,
  )
}
```

### Layer 5: Composable — Fix `updateOffcutStatus` to use correct API

**File:** [`frontend_vue/src/composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts)

**Step A:** Add `patchOffcut as patchOffcutApi` to the import from `@/services/warehouseService` (around line 3-15).

**Step B:** Replace the body of `updateOffcutStatus` (lines 363-371):

```typescript
async function updateOffcutStatus(id: string, status: string) {
  try {
    await patchOffcutApi(id, { status: status as OffcutStatus })
    toast.success(t('warehouse.toast_offcut_saved'))
    await loadOffcuts()
  } catch {
    toast.error(t('warehouse.toast_error'))
  }
}
```

**Step C:** Ensure `OffcutStatus` is imported from `@/types/warehouse` in the imports section (around line 19-27). Currently it's NOT imported — only `OffcutListItem`, `OffcutCreatePayload`, etc. are imported. Add `OffcutStatus` to the destructured import from `@/types/warehouse`.

## Verification Checklist

- [ ] `OffcutPatchPayload` type exists in types/warehouse.ts
- [ ] `patchOffcut` function exists in warehouseService.ts
- [ ] `mockPatchOffcut` handler exists in mocks/warehouse.ts
- [ ] `mockPatchOffcut` is imported in mocks/index.ts
- [ ] PATCH route for `/api/warehouse/offcuts/:id` exists in mocks/index.ts
- [ ] `patchOffcutApi` is imported in useWarehouse.ts
- [ ] `updateOffcutStatus` calls `patchOffcutApi` instead of `patchDeficitItemApi`
- [ ] `OffcutStatus` type is imported in useWarehouse.ts (from `@/types/warehouse`)
- [ ] Clicking "Использован" sets status to 'used' and shows success toast
- [ ] Clicking "В утиль" sets status to 'scrap' and shows success toast
- [ ] Error case shows error toast without crashing
