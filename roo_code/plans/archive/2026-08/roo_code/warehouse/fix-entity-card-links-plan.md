# Fix Entity Card Links in Warehouse Section

## Problem

On the Warehouse page ([`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)), three tabs — **Offcuts**, **Movements**, and **Deficit** — have table rows where:

1. The **product name link** opens the **Product Card** (`admin-product-card` route)
2. The **"View" / "Open Card" button** also opens the **Product Card**

Instead, they should open their **own entity card**:
- Offcuts → Offcut Card
- Movements → Movement Card
- Deficit → Deficit Card

## Current State Summary

| Aspect | Offcuts | Movements | Deficit |
|--------|---------|-----------|---------|
| Service `getById` | `getOffcut(id)` ✅ | `getMovement(id)` ❌ **MISSING** | `getDeficitItem(id)` ✅ |
| Service `patch` | `patchOffcut(id, data)` ✅ | N/A (no patch needed) | `patchDeficitItem(id, data)` ✅ |
| Service `delete` | `deleteOffcut(id)` ✅ | `deleteMovement(id)` ✅ | `deleteDeficitItem(id)` ✅ |
| Card composable | ❌ needs `useWarehouseOffcutCard.ts` | ❌ needs `useWarehouseMovementCard.ts` | ❌ needs `useWarehouseDeficitCard.ts` |
| Card Vue page | ❌ needs `WarehouseOffcutCard.vue` | ❌ needs `WarehouseMovementCard.vue` | ❌ needs `WarehouseDeficitCard.vue` |
| Route | ❌ needs `admin-warehouse-offcut` | ❌ needs `admin-warehouse-movement` | ❌ needs `admin-warehouse-deficit` |
| Links in WarehousePage | 2 links to `admin-product-card` | 2 links to `admin-product-card` | 2 links to `admin-product-card` |

Existing composables [`useWarehouseMovement.ts`](frontend_vue/src/composables/useWarehouseMovement.ts), [`useWarehouseDeficit.ts`](frontend_vue/src/composables/useWarehouseDeficit.ts), [`useWarehouseOffcuts.ts`](frontend_vue/src/composables/useWarehouseOffcuts.ts) are **modal-action composables** (create/delete only) — they are NOT card composables. New card composables must be created following the [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) pattern.

## Implementation Plan

### Phase 1: Add missing service method

**File:** [`frontend_vue/src/services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts)

Add `getMovement(id)` after line 162 (after `deleteMovement`):

```typescript
export async function getMovement(id: string): Promise<WarehouseMovement> {
  return apiGet<WarehouseMovement>(`/api/warehouse/movements/${id}`)
}
```

**Why:** The Movements section has `getMovements` (list), `createMovement`, and `deleteMovement`, but no `getMovement` for fetching a single movement by ID. This is needed by the card composable.

---

### Phase 2: Create 3 card composables

All three composables follow the [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) pattern:
- Accept an `id: string` parameter
- Load entity on mount via service method
- Create reactive `form` copy for editing
- Use `useDirtyCheck` for dirty tracking
- Provide `save()`, `discard()`, `remove()` methods
- Handle loading/saving/error states
- Provide `tf()` for translations
- Redirect to warehouse list on delete

#### 2a. `useWarehouseOffcutCard.ts`

**File:** [`frontend_vue/src/composables/useWarehouseOffcutCard.ts`](frontend_vue/src/composables/useWarehouseOffcutCard.ts) (new)

```typescript
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getOffcut, patchOffcut, deleteOffcut } from '@/services/warehouseService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { WarehouseOffcut, OffcutPatchPayload, OffcutStatus } from '@/types/warehouse'

export function useWarehouseOffcutCard(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const offcut = ref<WarehouseOffcut | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<{
    status: OffcutStatus
    location: string | null
    notes: string | null
  }>({
    status: 'available',
    location: null,
    notes: null,
  })

  const dirty = useDirtyCheck(form)
  const isAnythingDirty = computed(() => dirty.isDirty.value)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getOffcut(id)
      offcut.value = data
      form.value = {
        status: data.status,
        location: data.location,
        notes: data.notes,
      }
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load offcut'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!offcut.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as OffcutPatchPayload
      const updated = await patchOffcut(id, delta)
      offcut.value = updated
      form.value = {
        status: updated.status,
        location: updated.location,
        notes: updated.notes,
      }
      dirty.capture()
      toast.success(t('warehouse.toast_offcut_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!offcut.value) return
    form.value = {
      status: offcut.value.status,
      location: offcut.value.location,
      notes: offcut.value.notes,
    }
    dirty.capture()
  }

  async function remove() {
    if (!offcut.value) return
    saving.value = true
    try {
      await deleteOffcut(id)
      toast.success(t('warehouse.toast_offcut_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'offcuts' } })
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  return {
    offcut, loading, saving, error,
    form, isAnythingDirty,
    load, save, discard, remove,
    tf,
  }
}
```

**Editable fields:** `status`, `location`, `notes` (matches [`OffcutPatchPayload`](frontend_vue/src/types/warehouse.ts:168))

#### 2b. `useWarehouseMovementCard.ts`

**File:** [`frontend_vue/src/composables/useWarehouseMovementCard.ts`](frontend_vue/src/composables/useWarehouseMovementCard.ts) (new)

```typescript
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getMovement, deleteMovement } from '@/services/warehouseService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { WarehouseMovement } from '@/types/warehouse'

export function useWarehouseMovementCard(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const movement = ref<WarehouseMovement | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getMovement(id)
      movement.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load movement'
    } finally {
      loading.value = false
    }
  }

  async function remove() {
    if (!movement.value) return
    saving.value = true
    try {
      await deleteMovement(id)
      toast.success(t('warehouse.toast_movement_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'movements' } })
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  return {
    movement, loading, saving, error,
    load, remove,
    tf,
  }
}
```

**Note:** Movements are read-only (no patch endpoint exists). The card shows data in view-only mode with a delete button. No `save()`/`discard()`/`isAnythingDirty` needed.

#### 2c. `useWarehouseDeficitCard.ts`

**File:** [`frontend_vue/src/composables/useWarehouseDeficitCard.ts`](frontend_vue/src/composables/useWarehouseDeficitCard.ts) (new)

```typescript
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getDeficitItem, patchDeficitItem, deleteDeficitItem } from '@/services/warehouseService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { WarehouseDeficit, DeficitPatchPayload, DeficitStatus, DeficitPriority } from '@/types/warehouse'

export function useWarehouseDeficitCard(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const deficit = ref<WarehouseDeficit | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<{
    minRequired: number
    priority: DeficitPriority
    status: DeficitStatus
    suggestedOrderQty: number | null
    purchaseOrderId: string | null
    notes: string | null
  }>({
    minRequired: 0,
    priority: 'medium',
    status: 'open',
    suggestedOrderQty: null,
    purchaseOrderId: null,
    notes: null,
  })

  const dirty = useDirtyCheck(form)
  const isAnythingDirty = computed(() => dirty.isDirty.value)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getDeficitItem(id)
      deficit.value = data
      form.value = {
        minRequired: data.minRequired,
        priority: data.priority,
        status: data.status,
        suggestedOrderQty: data.suggestedOrderQty,
        purchaseOrderId: data.purchaseOrderId,
        notes: data.notes,
      }
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load deficit item'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!deficit.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as DeficitPatchPayload
      const updated = await patchDeficitItem(id, delta)
      deficit.value = updated
      form.value = {
        minRequired: updated.minRequired,
        priority: updated.priority,
        status: updated.status,
        suggestedOrderQty: updated.suggestedOrderQty,
        purchaseOrderId: updated.purchaseOrderId,
        notes: updated.notes,
      }
      dirty.capture()
      toast.success(t('warehouse.toast_deficit_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!deficit.value) return
    form.value = {
      minRequired: deficit.value.minRequired,
      priority: deficit.value.priority,
      status: deficit.value.status,
      suggestedOrderQty: deficit.value.suggestedOrderQty,
      purchaseOrderId: deficit.value.purchaseOrderId,
      notes: deficit.value.notes,
    }
    dirty.capture()
  }

  async function remove() {
    if (!deficit.value) return
    saving.value = true
    try {
      await deleteDeficitItem(id)
      toast.success(t('warehouse.toast_deficit_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'deficit' } })
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  return {
    deficit, loading, saving, error,
    form, isAnythingDirty,
    load, save, discard, remove,
    tf,
  }
}
```

**Editable fields:** `minRequired`, `priority`, `status`, `suggestedOrderQty`, `purchaseOrderId`, `notes` (matches [`DeficitPatchPayload`](frontend_vue/src/types/warehouse.ts:299))

---

### Phase 3: Create 3 Vue card pages

All three pages follow the [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) Pattern B:
- Single [`GlassPanel`] with loading skeleton
- View/edit toggle (for editable entities)
- `<dl>` definition lists for view mode
- Form inputs for edit mode
- Delete button with [`AppModal`] confirmation + redirect
- [`Breadcrumb`] with link back to warehouse
- [`useHead`] for dynamic title
- `onMounted(load)`

#### 3a. `WarehouseOffcutCard.vue`

**File:** [`frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue) (new)

**Structure:**
- `<script setup>`: import `useWarehouseOffcutCard`, `useRoute`, `useI18n`, `useHead`, `GlassPanel`, `Breadcrumb`, `SvgIcon`, `AppModal`
- Destructure composable: `offcut, loading, saving, error, form, isAnythingDirty, load, save, discard, remove, tf`
- `isEditing` ref, `showDeleteModal` ref
- `OFFCUT_STATUS_PILL` map
- `onSave()`, `onDiscard()`, `onDeleteConfirm()` handlers
- `useHead` with title

**View mode fields (in `<dl>`):**
- Product name (`tf(offcut.productName)`)
- Batch number (`offcut.batchNumber`)
- Offcut type (`offcut_type_${offcut.offcutType}`)
- Dimensions (length × width × thickness)
- Weight
- Quantity + unit
- Location
- Status (pill)
- Notes

**Edit mode fields:**
- Status (select)
- Location (text input)
- Notes (textarea)

**Delete redirect:** `{ name: 'admin-warehouse', params: { tab: 'offcuts' } }`

#### 3b. `WarehouseMovementCard.vue`

**File:** [`frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue) (new)

**Structure:**
- `<script setup>`: import `useWarehouseMovementCard`, `useRoute`, `useI18n`, `useHead`, `GlassPanel`, `Breadcrumb`, `SvgIcon`, `AppModal`
- Destructure composable: `movement, loading, saving, error, load, remove, tf`
- `showDeleteModal` ref
- `MOVEMENT_TYPE_PILL` map
- `onDeleteConfirm()` handler
- `useHead` with title

**Note:** Movements are **view-only** — no edit mode. Only a delete button in the header.

**View mode fields (in `<dl>`):**
- Product name (`tf(movement.productName)`)
- Movement type (pill)
- Batch number
- Quantity + unit
- Unit price
- Total cost
- Reference type + reference ID
- From location / To location
- Performed by
- Movement date
- Notes

**Delete redirect:** `{ name: 'admin-warehouse', params: { tab: 'movements' } }`

#### 3c. `WarehouseDeficitCard.vue`

**File:** [`frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue) (new)

**Structure:**
- `<script setup>`: import `useWarehouseDeficitCard`, `useRoute`, `useI18n`, `useHead`, `GlassPanel`, `Breadcrumb`, `SvgIcon`, `AppModal`
- Destructure composable: `deficit, loading, saving, error, form, isAnythingDirty, load, save, discard, remove, tf`
- `isEditing` ref, `showDeleteModal` ref
- `DEFICIT_STATUS_PILL`, `DEFICIT_PRIORITY_PILL` maps
- `onSave()`, `onDiscard()`, `onDeleteConfirm()` handlers
- `useHead` with title

**View mode fields (in `<dl>`):**
- Product name (`tf(deficit.productName)`)
- Current stock + unit
- Min required
- Deficit amount
- Priority (badge)
- Status (pill)
- Suggested order qty
- Purchase order ID
- Notes

**Edit mode fields:**
- Min required (number)
- Priority (select)
- Status (select)
- Suggested order qty (number)
- Purchase order ID (text)
- Notes (textarea)

**Delete redirect:** `{ name: 'admin-warehouse', params: { tab: 'deficit' } }`

---

### Phase 4: Add 3 new routes

**File:** [`frontend_vue/src/router/index.ts`](frontend_vue/src/router/index.ts)

Add after line 189 (after `admin-warehouse-batch` route, before `admin-warehouse` route):

```typescript
{
  path: 'warehouse/offcuts/:id',
  name: 'admin-warehouse-offcut',
  component: () => import('@/views/admin/warehouse/WarehouseOffcutCard.vue'),
  meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
},
{
  path: 'warehouse/movements/:id',
  name: 'admin-warehouse-movement',
  component: () => import('@/views/admin/warehouse/WarehouseMovementCard.vue'),
  meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
},
{
  path: 'warehouse/deficit/:id',
  name: 'admin-warehouse-deficit',
  component: () => import('@/views/admin/warehouse/WarehouseDeficitCard.vue'),
  meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
},
```

---

### Phase 5: Fix links in WarehousePage.vue

**File:** [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

#### 5a. Offcuts tab (lines 2389-2432)

| Location | Current | Replace with |
|----------|---------|--------------|
| Line 2389-2390 (product name) | `:to="{ name: 'admin-product-card', params: { id: offcut.productId } }"` | `:to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"` |
| Line 2429-2431 (view button) | `:to="{ name: 'admin-product-card', params: { id: offcut.productId } }"` | `:to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"` |

#### 5b. Movements tab (lines 2837-2862)

| Location | Current | Replace with |
|----------|---------|--------------|
| Line 2837-2838 (product name) | `:to="{ name: 'admin-product-card', params: { id: mov.productId } }"` | `:to="{ name: 'admin-warehouse-movement', params: { id: mov.id } }"` |
| Line 2860-2862 (view button) | `:to="{ name: 'admin-product-card', params: { id: mov.productId } }"` | `:to="{ name: 'admin-warehouse-movement', params: { id: mov.id } }"` |

#### 5c. Deficit tab (lines 3185-3226)

| Location | Current | Replace with |
|----------|---------|--------------|
| Line 3185-3186 (product name) | `:to="{ name: 'admin-product-card', params: { id: item.productId } }"` | `:to="{ name: 'admin-warehouse-deficit', params: { id: item.id } }"` |
| Line 3224-3226 (view button) | `:to="{ name: 'admin-product-card', params: { id: item.productId } }"` | `:to="{ name: 'admin-warehouse-deficit', params: { id: item.id } }"` |

---

### Phase 6: Add i18n translations

**File:** [`frontend_vue/src/i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts)

Add the following keys to all three locales (ru, en, lt) under the `warehouse` object:

#### Offcut card keys
```typescript
offcut_card_title: 'Offcut #{id}',       // ru: 'Обрезок #{id}', lt: 'Atraiža #{id}'
offcut_card_not_found: 'Offcut not found', // ru: 'Обрезок не найден', lt: 'Atraiža nerasta'
section_offcut_info: 'Offcut Info',       // ru: 'Информация об обрезке', lt: 'Atraižos informacija'
field_offcut_type: 'Offcut Type',         // ru: 'Тип обрезка', lt: 'Atraižos tipas'
field_dimensions: 'Dimensions',           // ru: 'Размеры', lt: 'Matmenys'
field_weight: 'Weight',                   // ru: 'Вес', lt: 'Svoris'
btn_edit_offcut: 'Edit Offcut',           // ru: 'Редактировать обрезок', lt: 'Redaguoti atraižą'
btn_delete_offcut: 'Delete Offcut',       // ru: 'Удалить обрезок', lt: 'Ištrinti atraižą'
confirm_delete_offcut: 'Are you sure you want to delete this offcut?', // ru/lt similar
```

#### Movement card keys
```typescript
movement_card_title: 'Movement #{id}',    // ru: 'Движение #{id}', lt: 'Judėjimas #{id}'
movement_card_not_found: 'Movement not found', // ru: 'Движение не найдено', lt: 'Judėjimas nerastas'
section_movement_info: 'Movement Info',   // ru: 'Информация о движении', lt: 'Judėjimo informacija'
field_movement_type: 'Movement Type',     // (already exists at line 504)
field_movement_quantity: 'Quantity',      // (already exists at line 505)
field_unit_price: 'Unit Price',           // (already exists at line 486)
field_total_cost: 'Total Cost',           // (already exists at line 487)
field_from_location: 'From Location',     // (already exists at line 510)
field_to_location: 'To Location',         // (already exists at line 511)
field_performed_by: 'Performed By',       // (already exists at line 508)
field_moved_at: 'Movement Date',          // (already exists at line 509)
btn_delete_movement: 'Delete Movement',   // ru: 'Удалить движение', lt: 'Ištrinti judėjimą'
confirm_delete_movement: 'Are you sure you want to delete this movement?', // ru/lt similar
```

#### Deficit card keys
```typescript
deficit_card_title: 'Deficit #{id}',      // ru: 'Дефицит #{id}', lt: 'Trūkumas #{id}'
deficit_card_not_found: 'Deficit record not found', // ru: 'Запись дефицита не найдена', lt: 'Trūkumo įrašas nerastas'
section_deficit_info: 'Deficit Info',     // ru: 'Информация о дефиците', lt: 'Trūkumo informacija'
field_current_stock: 'Current Stock',     // (already exists at line 525)
field_min_required: 'Min. Required',      // (already exists at line 526)
field_deficit_amount: 'Deficit Amount',   // (already exists at line 527)
field_suggested_order: 'Suggested Order', // (already exists at line 528)
field_purchase_order: 'Purchase Order',   // (already exists at line 529)
btn_edit_deficit: 'Edit Deficit Record',  // ru: 'Редактировать запись дефицита', lt: 'Redaguoti trūkumo įrašą'
btn_delete_deficit: 'Delete Deficit Record', // ru: 'Удалить запись дефицита', lt: 'Ištrinti trūkumo įrašą'
confirm_delete_deficit: 'Are you sure you want to delete this deficit record?', // ru/lt similar
```

---

## Dependency Graph

```
Phase 1 (getMovement) ──┐
                         ├──> Phase 2b (useWarehouseMovementCard)
                         │
Phase 2a (useWarehouseOffcutCard) ──> Phase 3a (WarehouseOffcutCard.vue)
Phase 2b (useWarehouseMovementCard) ──> Phase 3b (WarehouseMovementCard.vue)
Phase 2c (useWarehouseDeficitCard) ──> Phase 3c (WarehouseDeficitCard.vue)
                         │
Phase 3a/b/c ──> Phase 4 (routes) ──> Phase 5 (fix links)
                         │
Phase 6 (i18n) ──> can be done in parallel with Phases 2-3
```

## Execution Order

1. **Phase 1** — Add `getMovement()` to service
2. **Phase 2** — Create 3 composables (can be parallelized)
3. **Phase 3** — Create 3 Vue pages (can be parallelized)
4. **Phase 4** — Add 3 routes to router
5. **Phase 5** — Fix 6 links in WarehousePage.vue
6. **Phase 6** — Add i18n translations (can be done alongside Phases 2-3)

## Files Created (6 new files)

| # | File | Purpose |
|---|------|---------|
| 1 | `frontend_vue/src/composables/useWarehouseOffcutCard.ts` | Offcut card composable |
| 2 | `frontend_vue/src/composables/useWarehouseMovementCard.ts` | Movement card composable |
| 3 | `frontend_vue/src/composables/useWarehouseDeficitCard.ts` | Deficit card composable |
| 4 | `frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue` | Offcut card page |
| 5 | `frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue` | Movement card page |
| 6 | `frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue` | Deficit card page |

## Files Modified (4 existing files)

| # | File | Changes |
|---|------|---------|
| 1 | `frontend_vue/src/services/warehouseService.ts` | Add `getMovement()` function |
| 2 | `frontend_vue/src/router/index.ts` | Add 3 new routes |
| 3 | `frontend_vue/src/views/admin/warehouse/WarehousePage.vue` | Fix 6 `router-link` targets |
| 4 | `frontend_vue/src/i18n/admin/warehouse.ts` | Add card-specific translation keys |
