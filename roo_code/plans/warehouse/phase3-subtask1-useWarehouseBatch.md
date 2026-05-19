# Phase 3, Subtask 1: Create `useWarehouseBatch.ts` composable

## What needs to be done

Create a new composable [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) that manages the state and operations for a single warehouse batch card page. This composable follows the same pattern as [`useServiceCard.ts`](frontend_vue/src/composables/useServiceCard.ts).

## Files to create

- [`frontend_vue/src/composables/useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) — new file

## Context

### Existing types (from [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts))

- [`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:26) — full batch entity with all fields
- [`BatchPatchPayload`](frontend_vue/src/types/warehouse.ts:91) — partial update payload for PATCH
- [`BatchStatus`](frontend_vue/src/types/warehouse.ts:10) — `'available' | 'reserved' | 'partial' | 'depleted' | 'quarantine'`
- [`StockUnit`](frontend_vue/src/types/warehouse.ts:22) — `'kg' | 'm' | 'pcs' | 'm2'`
- [`WarehouseMovement`](frontend_vue/src/types/warehouse.ts:170) — movement entity (for loading movements related to this batch)
- [`MovementListItem`](frontend_vue/src/types/warehouse.ts:201) — list item version
- [`WarehouseOffcut`](frontend_vue/src/types/warehouse.ts:104) — offcut entity (for loading offcuts related to this batch)
- [`OffcutListItem`](frontend_vue/src/types/warehouse.ts:136) — list item version

### Existing services (from [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts))

- [`getBatch(id)`](frontend_vue/src/services/warehouseService.ts:72) — fetch single batch by ID → `WarehouseBatch`
- [`patchBatch(id, delta)`](frontend_vue/src/services/warehouseService.ts:80) — partial update → `WarehouseBatch`
- [`deleteBatch(id)`](frontend_vue/src/services/warehouseService.ts:84) — delete batch → `void`
- [`getMovements(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:124) — fetch movements (filter by `batchNumber`)
- [`getOffcuts(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:90) — fetch offcuts (filter by `batchNumber`)

### Existing composables to use

- [`useDirtyCheck`](frontend_vue/src/composables/useDirtyCheck.ts) — dirty check for edit form. Provides `isDirty`, `capture()`, `diff()`, `reset()`
- [`useToast`](frontend_vue/src/composables/useToast.ts) — toast notifications. Provides `success(msg)`, `error(msg)`, `info(msg)`
- [`useTranslatedField`](frontend_vue/src/composables/useTranslatedData.ts) — for displaying `TranslatedString` fields via `tf()`

### Pattern reference: [`useServiceCard.ts`](frontend_vue/src/composables/useServiceCard.ts)

```ts
export function useServiceCard(id: string) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const service = ref<Service | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<{ ... }>({ ... })
  const dirty = useDirtyCheck(form)

  async function load() { ... }
  async function save() { ... }
  function discard() { ... }

  return { service, loading, saving, error, form, isAnythingDirty, load, save, discard, tf }
}
```

### Existing batch card component (will be refactored to use this composable)

The current [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) has inline loading/error logic. After this composable is created, the component will be refactored to delegate all logic to the composable.

## Requirements for the composable

The composable should accept a batch `id` (string) and return:

### State
- `batch` — `Ref<WarehouseBatch | null>` — the loaded batch
- `loading` — `Ref<boolean>`
- `saving` — `Ref<boolean>`
- `error` — `Ref<string | null>`
- `form` — `Ref<{ ... }>` — editable form fields mirroring `BatchPatchPayload` fields:
  - `batchNumber: string`
  - `lotCode: string`
  - `quantity: number`
  - `unitPrice: number`
  - `location: string | null`
  - `certificateRef: string | null`
  - `status: BatchStatus`
  - `notes: string | null`
- `isAnythingDirty` — `ComputedRef<boolean>` — from `useDirtyCheck`
- `movements` — `Ref<MovementListItem[]>` — movements related to this batch
- `movementsLoading` — `Ref<boolean>`
- `offcuts` — `Ref<OffcutListItem[]>` — offcuts related to this batch
- `offcutsLoading` — `Ref<boolean>`

### Methods
- `load()` — fetch batch by ID, populate form, call `dirty.capture()`. Also load related movements and offcuts.
- `save()` — call `patchBatch(id, dirty.diff())`, update batch and form, call `dirty.capture()`, show success toast. On error show error toast.
- `discard()` — reset form from batch data, call `dirty.capture()`
- `remove()` — call `deleteBatch(id)`, show success toast, navigate back to warehouse page. On error show error toast.
- `loadMovements()` — fetch movements filtered by `batch.batchNumber`
- `loadOffcuts()` — fetch offcuts filtered by `batch.batchNumber`
- `tf()` — expose `useTranslatedField` for template use

### Navigation
- Use `useRouter` to navigate back to `{ name: 'admin-warehouse', params: { tab: 'batches' } }` after delete

### i18n keys used (already exist in [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))
- `warehouse.toast_batch_saved` — "Batch saved"
- `warehouse.toast_batch_deleted` — "Batch deleted"
- `warehouse.toast_error_save` — "Error saving data"

## Acceptance criteria

- [ ] Composable is created at [`frontend_vue/src/composables/useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts)
- [ ] Follows the same pattern as [`useServiceCard.ts`](frontend_vue/src/composables/useServiceCard.ts)
- [ ] Uses `useDirtyCheck` for form dirty tracking
- [ ] Uses `useToast` for success/error notifications
- [ ] Loads batch, related movements, and related offcuts
- [ ] Provides `save()`, `discard()`, `remove()` methods
- [ ] Exposes `tf()` for template use
- [ ] All state refs and methods are properly typed
