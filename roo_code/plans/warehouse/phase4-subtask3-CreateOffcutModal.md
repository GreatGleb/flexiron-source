# Phase 4, Subtask 3: Create `CreateOffcutModal.vue`

## What needs to be done

Create a modal component for the "Cutting" (Резка) operation — cutting material from a source batch and creating offcuts. This modal is triggered from the Offcuts tab on the Warehouse page via the "Cutting" button.

## Files to create

- [`frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue`](frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue) — new file

## Context

### Existing types (from [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts))

- [`CuttingOperation`](frontend_vue/src/types/warehouse.ts:233) — the cutting operation payload:
  ```ts
  interface CuttingOperation {
    sourceBatchId: string
    sourceQuantity: number
    kerfMm: number
    offcuts: Omit<OffcutCreatePayload, 'batchId'>[]
    wasteQuantity: number
    notes?: string | null
  }
  ```
- [`OffcutCreatePayload`](frontend_vue/src/types/warehouse.ts:153) — individual offcut payload:
  ```ts
  interface OffcutCreatePayload {
    batchId: string
    productId: string
    categoryId?: string | null
    offcutType?: 'sheet' | 'linear'
    lengthMm?: number | null
    widthMm?: number | null
    thicknessMm?: number | null
    weightKg?: number | null
    quantity: number
    unit: StockUnit
    location?: string | null
    notes?: string | null
  }
  ```
- [`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:26) — for source batch selection
- [`StockUnit`](frontend_vue/src/types/warehouse.ts:22) — `'kg' | 'm' | 'pcs' | 'm2'`

### Existing services (from [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts))

- [`executeCutting(data)`](frontend_vue/src/services/warehouseService.ts:155) — executes cutting operation → `{ offcuts: WarehouseOffcut[], wasteQuantity: number }`
- [`getBatches(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:52) — for batch selection

### Existing components to use

- [`AppModal`](frontend_vue/src/components/admin/ui/AppModal.vue) — modal wrapper
- [`CustomSelect`](frontend_vue/src/components/admin/ui/CustomSelect.vue) — dropdown selects
- [`SvgIcon`](frontend_vue/src/components/admin/ui/SvgIcon.vue) — icons

### Existing composables to use

- [`useToast`](frontend_vue/src/composables/useToast.ts) — for success/error notifications

### Existing i18n keys (from [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))

- `warehouse.modal_cutting_title` — "Material cutting"
- `warehouse.btn_save` — "Save"
- `warehouse.btn_cancel` — "Cancel"
- `warehouse.toast_cutting_executed` — "Cutting completed"
- `warehouse.toast_error_save` — "Error saving data"
- `warehouse.field_source_batch` — "Source batch"
- `warehouse.field_source_quantity` — "Material consumption"
- `warehouse.field_kerf` — "Kerf width (mm)"
- `warehouse.field_offcuts` — "Offcuts"
- `warehouse.field_waste` — "Waste (kg)"
- `warehouse.btn_add_offcut` — "Add offcut"
- `warehouse.field_notes` — "Notes"
- `warehouse.col_dimensions` — "Dimensions"
- `warehouse.col_length` — "Length, mm"
- `warehouse.col_weight` — "Weight"
- `warehouse.col_location` — "Location"
- `warehouse.col_quantity` — "Quantity"

## Requirements

### Props
- `show: boolean` — controls modal visibility

### Emits
- `close` — when modal is closed
- `created` — when cutting operation is successfully completed

### Form fields (main)
- `sourceBatchId` — searchable select of available batches (show batchNumber + productName + remaining quantity)
- `sourceQuantity` — number input (required, > 0, cannot exceed batch's `quantityRemaining`)
- `kerfMm` — number input (default: 0, for sheet materials)
- `wasteQuantity` — number input (required, >= 0)
- `notes` — optional textarea

### Dynamic offcut list
- User can add multiple offcuts via "Add offcut" button
- Each offcut has:
  - `offcutType` — select: 'sheet' | 'linear'
  - `lengthMm` — optional number
  - `widthMm` — optional number (shown for sheet type)
  - `thicknessMm` — optional number
  - `weightKg` — optional number
  - `quantity` — number (default: 1)
  - `location` — optional text
  - `notes` — optional text
- Each offcut row has a remove button
- Minimum 1 offcut required

### Validation
- Required: `sourceBatchId`, `sourceQuantity`, `wasteQuantity`, at least 1 offcut
- `sourceQuantity` must be > 0 and <= batch's `quantityRemaining`
- Each offcut must have `quantity > 0`

### Behavior
- On save: call `executeCutting(payload)`, emit `created`, show success toast, close modal
- On error: show error toast, keep modal open
- On cancel: close modal without saving
- Reset form when modal opens

### Test IDs
- `create-offcut-modal`
- `cutting-source-batch-select`
- `cutting-source-quantity-input`
- `cutting-kerf-input`
- `cutting-waste-input`
- `cutting-offcut-list`
- `cutting-offcut-row-{index}`
- `cutting-add-offcut-btn`
- `cutting-remove-offcut-btn-{index}`
- `cutting-notes-input`
- `cutting-save-btn`
- `cutting-cancel-btn`

## Acceptance criteria

- [ ] Modal component created at [`frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue`](frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue)
- [ ] Source batch selector with remaining quantity display
- [ ] Dynamic offcut list with add/remove functionality
- [ ] Conditional fields based on offcut type (sheet shows width)
- [ ] Quantity validation against batch remaining
- [ ] On successful cutting: toast, emit `created`, close modal
- [ ] On error: toast error, keep modal open
- [ ] Form resets when modal opens
- [ ] All `data-test` attributes added
- [ ] Component compiles without TypeScript errors
