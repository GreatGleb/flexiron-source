# Phase 5, Subtask 2: Improve Offcuts and Deficit tabs on WarehousePage

## What needs to be done

Enhance the Offcuts and Deficit tabs on the Warehouse page to integrate the new modals and composables, and improve the tab UI with better action buttons, empty states, and inline status management.

## Files to modify

- [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — add modal integrations and improve tab templates
- [`frontend_vue/src/composables/useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts) — integrate new composables for offcuts/deficit operations

## Context

### Existing composables (being created in Phase 4-5)

- [`useWarehouseOffcuts`](frontend_vue/src/composables/useWarehouseOffcuts.ts) — `create()`, `remove()`
- [`useWarehouseDeficit`](frontend_vue/src/composables/useWarehouseDeficit.ts) — `create()`, `update()`, `remove()`
- [`useWarehouseMovement`](frontend_vue/src/composables/useWarehouseMovement.ts) — `create()`, `remove()`

### Existing modals (being created in Phase 4)

- [`CreateOffcutModal`](frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue) — cutting operation modal
- [`CreateMovementModal`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) — movement creation modal
- [`CreateBatchModal`](frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue) — batch receipt modal

### Existing [`useWarehouse.ts`](frontend_vue/src/composables/useWarehouse.ts) structure

The main composable already manages:
- Per-tab state: `offcuts`, `deficit`, `movements`, `batches`, `stock`
- Per-tab loading/error/pagination/filters
- `deleteOffcut(id)`, `deleteDeficit(id)`, `deleteMovement(id)`, `deleteBatch(id)` methods
- Watchers for filter changes, pagination, sort, active tab

### Existing [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) structure

The page has 5 tabs with:
- Filter bar (shared)
- Tab-specific tables with columns
- Action buttons per tab (e.g., "Receive batch", "Write-off / Transfer", "Cutting", "Add to deficit")
- Pagination

## Requirements

### 1. Integrate modals into WarehousePage

Add modal components to the template and wire them up:

```vue
<!-- Batches tab -->
<CreateBatchModal
  :show="showCreateBatchModal"
  @close="showCreateBatchModal = false"
  @created="onBatchCreated"
/>

<!-- Movements tab -->
<CreateMovementModal
  :show="showCreateMovementModal"
  @close="showCreateMovementModal = false"
  @created="onMovementCreated"
/>

<!-- Offcuts tab -->
<CreateOffcutModal
  :show="showCreateOffcutModal"
  @close="showCreateOffcutModal = false"
  @created="onOffcutCreated"
/>
```

### 2. Add modal state to useWarehouse.ts

```ts
const showCreateBatchModal = ref(false)
const showCreateMovementModal = ref(false)
const showCreateOffcutModal = ref(false)
```

### 3. Improve Offcuts tab

- Add "Cutting" button that opens `CreateOffcutModal`
- Add inline status change (quick actions per row: mark as used/scrap)
- Show offcut type badge (sheet/linear) with icon
- Show dimensions in a readable format (e.g., "1200×800 mm" for sheet, "3000 mm" for linear)
- Better empty state with illustration and CTA

### 4. Improve Deficit tab

- Add "Add to deficit" button that opens a simple inline form or modal
- Add inline priority change (clickable priority badge)
- Add inline status change (open → in_progress → resolved → cancelled)
- Show deficit amount with color coding (red for critical, orange for high, etc.)
- Better empty state

### 5. Wire up event handlers

```ts
function onBatchCreated() {
  showCreateBatchModal.value = false
  loadBatches() // reload batches list
}

function onMovementCreated() {
  showCreateMovementModal.value = false
  loadMovements() // reload movements list
}

function onOffcutCreated() {
  showCreateOffcutModal.value = false
  loadOffcuts() // reload offcuts list
}
```

### 6. New i18n keys needed (add to all 3 locales)

```ts
offcut_type_sheet_badge: 'Sheet' / 'Лист' / 'Lakštas'
offcut_type_linear_badge: 'Linear' / 'Линейный' / 'Linijinis'
btn_mark_used: 'Mark used' / 'Отметить использованным' / 'Pažymėti panaudotu'
btn_mark_scrap: 'Mark scrap' / 'В утиль' / 'Į metalo laužą'
deficit_priority_badge_critical: 'Critical' / 'Критичный' / 'Kritinis'
deficit_priority_badge_high: 'High' / 'Высокий' / 'Aukštas'
deficit_priority_badge_medium: 'Medium' / 'Средний' / 'Vidutinis'
deficit_priority_badge_low: 'Low' / 'Низкий' / 'Žemas'
```

### 7. New CSS needed (add to [`warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css))

- `.offcut-type-badge` — badge for sheet/linear type
- `.deficit-priority-badge` — color-coded priority badge
- `.deficit-amount-critical` — red text for critical deficit
- `.deficit-amount-high` — orange text for high deficit
- `.inline-action-btn` — small action buttons for table rows
- `.tab-empty-state` — improved empty state with icon and CTA

### 8. Test IDs

- `offcuts-tab-cutting-btn`
- `offcuts-tab-empty-state`
- `offcuts-row-{index}-mark-used`
- `offcuts-row-{index}-mark-scrap`
- `deficit-tab-add-btn`
- `deficit-tab-empty-state`
- `deficit-row-{index}-priority`
- `deficit-row-{index}-status`

## Acceptance criteria

- [ ] All three modals (CreateBatch, CreateMovement, CreateOffcut) integrated into WarehousePage
- [ ] Modal open/close state managed in `useWarehouse.ts`
- [ ] Event handlers reload respective tab data after creation
- [ ] Offcuts tab shows type badges and dimensions
- [ ] Offcuts tab has inline status actions (mark used/scrap)
- [ ] Deficit tab has priority color coding
- [ ] Deficit tab has inline status/priority changes
- [ ] Better empty states for both tabs
- [ ] New i18n keys added for all 3 locales
- [ ] New CSS classes added
- [ ] All `data-test` attributes added
- [ ] Component compiles without TypeScript errors
