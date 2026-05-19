# Phase 4, Subtask 1: Create `CreateBatchModal.vue`

## What needs to be done

Create a modal component for receiving (оприходование) a new batch of material. This modal is triggered from the Batches tab on the Warehouse page via the "Receive batch" button.

## Files to create

- [`frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue`](frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue) — new file

## Context

### Existing types (from [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts))

- [`BatchCreatePayload`](frontend_vue/src/types/warehouse.ts:76) — payload for creating a batch:
  ```ts
  interface BatchCreatePayload {
    productId: string
    supplierId?: string | null
    batchNumber: string
    lotCode: string
    quantity: number
    unit: StockUnit
    unitPrice: number
    receivedAt: string
    expiresAt?: string | null
    location?: string | null
    certificateRef?: string | null
    notes?: string | null
  }
  ```
- [`StockUnit`](frontend_vue/src/types/warehouse.ts:22) — `'kg' | 'm' | 'pcs' | 'm2'`

### Existing services (from [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts))

- [`createBatch(data)`](frontend_vue/src/services/warehouseService.ts:76) — creates a new batch → `WarehouseBatch`

### Existing components to use

- [`AppModal`](frontend_vue/src/components/admin/ui/AppModal.vue) — modal wrapper with header, body, footer slots
- [`CustomSelect`](frontend_vue/src/components/admin/ui/CustomSelect.vue) — dropdown selects
- [`DatePicker`](frontend_vue/src/components/admin/ui/DatePicker.vue) — date input
- [`SvgIcon`](frontend_vue/src/components/admin/SvgIcon.vue) — icons

### Existing composables to use

- [`useToast`](frontend_vue/src/composables/useToast.ts) — for success/error notifications

### Existing i18n keys (from [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))

- `warehouse.modal_receipt_title` — "Receipt" / "Оприходование" / "Gavimas"
- `warehouse.btn_save` — "Save"
- `warehouse.btn_cancel` — "Cancel"
- `warehouse.toast_batch_created` — "Batch received"
- `warehouse.toast_error_save` — "Error saving data"
- `warehouse.field_batch_number` — "Batch number"
- `warehouse.field_lot_code` — "Lot code"
- `warehouse.col_product` — "Product"
- `warehouse.col_supplier` — "Supplier"
- `warehouse.col_quantity` — "Quantity"
- `warehouse.col_unit` — "Unit"
- `warehouse.col_unit_price` — "Unit price"
- `warehouse.field_total_cost` — "Total cost"
- `warehouse.field_received_at` — "Received at"
- `warehouse.field_expires_at` — "Expires at"
- `warehouse.field_location` — "Storage location"
- `warehouse.field_certificate` — "Certificate"
- `warehouse.field_notes` — "Notes"
- `warehouse.filter_product_all` — "All products"
- `warehouse.filter_supplier_all` — "All suppliers"

### How the modal is triggered

The modal is opened from [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) Batches tab. The parent component will pass a `show` prop and listen for `close` and `created` events.

## Requirements

### Props
- `show: boolean` — controls modal visibility

### Emits
- `close` — when modal is closed (cancel or after successful creation)
- `created` — when batch is successfully created (parent should reload batches list)

### Form fields
- `productId` — searchable select (fetch products list — use a prop or inject for available products)
- `supplierId` — optional searchable select (fetch suppliers list)
- `batchNumber` — text input (required)
- `lotCode` — text input (required)
- `quantity` — number input (required, > 0)
- `unit` — select from `StockUnit` options
- `unitPrice` — number input (required, >= 0)
- `receivedAt` — date picker (default: today)
- `expiresAt` — optional date picker
- `location` — optional text input
- `certificateRef` — optional text input
- `notes` — optional textarea

### Computed
- `totalCost` — `quantity * unitPrice` (display only, read-only)

### Validation
- Required fields: `productId`, `batchNumber`, `lotCode`, `quantity`, `unit`, `unitPrice`, `receivedAt`
- Show validation errors inline below each field
- Disable Save button if form is invalid

### Behavior
- On save: call `createBatch(payload)`, emit `created`, show success toast, close modal
- On error: show error toast, keep modal open
- On cancel: close modal without saving
- Reset form when modal is opened (watch `show` prop)

### Test IDs
- `create-batch-modal`
- `create-batch-form`
- `create-batch-product-select`
- `create-batch-supplier-select`
- `create-batch-number-input`
- `create-batch-lot-input`
- `create-batch-quantity-input`
- `create-batch-unit-select`
- `create-batch-price-input`
- `create-batch-received-date`
- `create-batch-expires-date`
- `create-batch-location-input`
- `create-batch-certificate-input`
- `create-batch-notes-input`
- `create-batch-total-display`
- `create-batch-save-btn`
- `create-batch-cancel-btn`

## Acceptance criteria

- [ ] Modal component created at [`frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue`](frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue)
- [ ] All form fields present with proper validation
- [ ] Total cost auto-calculated from quantity × unitPrice
- [ ] On successful creation: toast, emit `created`, close modal
- [ ] On error: toast error, keep modal open
- [ ] Form resets when modal opens
- [ ] All `data-test` attributes added
- [ ] Component compiles without TypeScript errors
