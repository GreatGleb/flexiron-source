# Plan: Add "Movements by Offcut" Section to Offcut Card

## Overview

Add a "Движения по обрезку" (Movements by Offcut) section to the offcut card page, analogous to the existing "Движения по партии" (Movements by Batch) section in the batch card.

## Current State

### Batch Card (`WarehouseBatchCard.vue`)
- Has a full-width `GlassPanel` section at line 682 with title `t('warehouse.section_batch_movements')`
- Shows a table with columns: Date, Type, Quantity, Reference, and a link to the movement card
- Movements are loaded via `loadMovements()` in `useWarehouseBatch` composable, which calls `getMovements()` with `{ search: '', batchNumber: batch.value.batchNumber }`
- The movements are filtered by `batchNumber` on the server/mock side

### Offcut Card (`WarehouseOffcutCard.vue`)
- Has no movements section
- The `useWarehouseOffcutCard` composable does not expose movements data
- Offcut-related movements exist in the same `movementStore` but use `referenceId` = offcut ID and `referenceType` = offcut-related type (e.g., `'location_change'`, `'offcut_available'`, etc.)

### Movement Data Model
- `WarehouseMovement.referenceId` — stores the offcut ID when the movement is offcut-related
- `WarehouseMovement.referenceType` — stores the type (e.g., `'location_change'`, `'offcut_available'`, `'offcut_used'`, etc.)
- Offcut movements are created automatically in the mock on status/location change via `createOffcutMovement()`

## Changes Required

### 1. Add `referenceId` filter to `getMovements()` service and mock

**File: `frontend_vue/src/services/warehouseService.ts`** (line ~139)
- Add optional `referenceId` parameter to the `getMovements()` function's query params

**File: `frontend_vue/src/services/mocks/warehouse.ts`** (line ~770, `mockGetMovements`)
- Add filtering by `referenceId` when the filter is provided

### 2. Update `useWarehouseOffcutCard` composable to load movements

**File: `frontend_vue/src/composables/useWarehouseOffcutCard.ts`**
- Import `getMovements` from `@/services/warehouseService`
- Import `MovementListItem` type from `@/types/warehouse`
- Add reactive state:
  - `movements` — `ref<MovementListItem[]>([])`
  - `movementsLoading` — `ref(false)`
- Add `loadMovements()` async function that calls `getMovements()` with `{ search: '', referenceId: offcut.value.id }`
- Call `loadMovements()` inside the existing `load()` function (after `offcut.value` is set)
- Expose `movements` and `movementsLoading` in the return object

### 3. Add movements section template to offcut card

**File: `frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue`**
- In the `<script setup>` section:
  - Destructure `movements` and `movementsLoading` from `useWarehouseOffcutCard`
- In the `<template>` section, after the Location section (line ~558) and before the Audit section (line ~561), add a new full-width `GlassPanel`:

```html
<!-- FULL WIDTH: Movements section -->
<GlassPanel :title="t('warehouse.section_offcut_movements')" data-test="offcut-card-movements-section">
  <div v-if="movementsLoading" class="text-muted" style="padding: 12px 0;">
    {{ t('warehouse.loading') }}...
  </div>
  <div v-else-if="movements.length" class="table-responsive">
    <table class="data-table" data-test="offcut-card-movements-table">
      <thead>
        <tr>
          <th>{{ t('warehouse.col_date') }}</th>
          <th>{{ t('warehouse.col_type') }}</th>
          <th>{{ t('warehouse.col_quantity') }}</th>
          <th>{{ t('warehouse.col_reference') }}</th>
          <th style="width: 48px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="movement in movements" :key="movement.id" data-test="offcut-card-movements-row">
          <td>{{ movement.movedAt.slice(0, 10) }}</td>
          <td>{{ t(`warehouse.movement_type_${movement.type}`) }}</td>
          <td>{{ movement.quantity }} {{ t(`warehouse.unit_${movement.unit}`) }}</td>
          <td>{{ movement.referenceId ?? '—' }}</td>
          <td style="text-align: center">
            <router-link
              v-tooltip="t('warehouse.open_movement_card')"
              :to="{ name: 'admin-warehouse-movement', params: { id: movement.id } }"
              class="action-icon-btn"
              data-test="offcut-card-movement-link"
            >
              <SvgIcon name="external-link" :width="16" :height="16" />
            </router-link>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="text-muted" style="padding: 12px 0;">{{ t('warehouse.empty_movements') }}</p>
</GlassPanel>
```

### 4. Add i18n translation keys

**File: `frontend_vue/src/i18n/admin/warehouse.ts`**
- Add `section_offcut_movements` key in all three language sections (ru, en, lt):
  - ru: `'Движения по обрезку'`
  - en: `'Offcut movements'`
  - lt: `'Atraižos judėjimai'`

### 5. Add `referenceId` filter support in mock `getMovements`

**File: `frontend_vue/src/services/mocks/warehouse.ts`** (function `mockGetMovements`, line ~770)
- Add `referenceId` to the filter parameter type
- Add filter logic: `if (filters.referenceId) filtered = filtered.filter((m) => m.referenceId === filters.referenceId)`

## Files to Modify (Summary)

| # | File | Change |
|---|------|--------|
| 1 | `frontend_vue/src/services/warehouseService.ts` | Add `referenceId` param to `getMovements()` |
| 2 | `frontend_vue/src/services/mocks/warehouse.ts` | Add `referenceId` filter to `mockGetMovements()` |
| 3 | `frontend_vue/src/composables/useWarehouseOffcutCard.ts` | Add movements loading logic |
| 4 | `frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue` | Add movements section template |
| 5 | `frontend_vue/src/i18n/admin/warehouse.ts` | Add `section_offcut_movements` i18n key |

## Data Flow

```
OffcutCard.vue
  └─ useWarehouseOffcutCard composable
       └─ load()
            ├─ getOffcut(id)           — loads offcut data
            └─ loadMovements()
                 └─ getMovements({ referenceId: offcut.id })
                      └─ GET /api/warehouse/movements?referenceId=...
                           └─ mockGetMovements filters by referenceId
```

## Testing Notes

- The movements table should appear between the Location section and the Audit section
- When no movements exist, show "Движения не найдены" (already translated as `warehouse.empty_movements`)
- Each movement row should link to the movement card via `admin-warehouse-movement` route
- Test data: offcut movements are auto-created in the mock when offcut status or location changes
