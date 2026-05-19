# Phase 4, Subtask 2: Create `CreateMovementModal.vue`

## What needs to be done

Create a modal component for registering a movement (write-off / transfer / expense) of material. This modal is triggered from the Movements tab on the Warehouse page via the "Write-off / Transfer" button.

## Files to create

- [`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) — new file

## Context

### Existing types (from [`types/warehouse.ts`](frontend_vue/src/types/warehouse.ts))

- [`MovementCreatePayload`](frontend_vue/src/types/warehouse.ts:217) — payload for creating a movement:
  ```ts
  interface MovementCreatePayload {
    type: MovementType
    batchId: string
    quantity: number
    unitPrice?: number
    referenceId?: string | null
    referenceType?: string | null
    fromLocation?: string | null
    toLocation?: string | null
    performedBy?: string | null
    notes?: string | null
    movedAt?: string
  }
  ```
- [`MovementType`](frontend_vue/src/types/warehouse.ts:7) — `'receipt' | 'expense' | 'transfer' | 'write-off'`
- [`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:26) — for batch selection (need `id`, `batchNumber`, `productName`, `quantityRemaining`)

### Existing services (from [`services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts))

- [`createMovement(data)`](frontend_vue/src/services/warehouseService.ts:145) — creates a new movement → `WarehouseMovement`
- [`getBatches(filters, pagination)`](frontend_vue/src/services/warehouseService.ts:52) — for batch selection dropdown

### Existing components to use

- [`AppModal`](frontend_vue/src/components/admin/ui/AppModal.vue) — modal wrapper
- [`CustomSelect`](frontend_vue/src/components/admin/ui/CustomSelect.vue) — dropdown selects
- [`DatePicker`](frontend_vue/src/components/admin/ui/DatePicker.vue) — date input
- [`SvgIcon`](frontend_vue/src/components/admin/SvgIcon.vue) — icons

### Existing composables to use

- [`useToast`](frontend_vue/src/composables/useToast.ts) — for success/error notifications

### Existing i18n keys (from [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))

- `warehouse.modal_expense_title` — "Write-off / Expense"
- `warehouse.btn_save` — "Save"
- `warehouse.btn_cancel` — "Cancel"
- `warehouse.toast_movement_created` — "Movement registered"
- `warehouse.toast_error_save` — "Error saving data"
- `warehouse.col_type` — "Type"
- `warehouse.col_batch` — "Batch"
- `warehouse.col_quantity` — "Quantity"
- `warehouse.col_unit` — "Unit"
- `warehouse.col_reference` — "Reference"
- `warehouse.field_notes` — "Notes"
- `warehouse.type_receipt` / `type_expense` / `type_transfer` / `type_write_off` — movement type labels
- `warehouse.reference_purchase_order` / `reference_work_order` / `reference_waste_report` / `reference_cutting` / `reference_sale` — reference type labels

### New i18n keys needed (add to all 3 locales)

```ts
field_movement_type: 'Movement type' / 'Тип операции' / 'Operacijos tipas'
field_source_batch: 'Source batch' / 'Исходная партия' / 'Šaltinio partija'
field_movement_quantity: 'Quantity to move' / 'Количество' / 'Kiekis'
field_reference_type: 'Reference type' / 'Тип основания' / 'Pagrindo tipas'
field_reference_id: 'Reference document' / 'Документ-основание' / 'Pagrindo dokumentas'
field_performed_by: 'Performed by' / 'Ответственный' / 'Atsakingas'
field_moved_at: 'Movement date' / 'Дата операции' / 'Operacijos data'
field_from_location: 'From location' / 'Откуда' / 'Iš kur'
field_to_location: 'To location' / 'Куда' / 'Į kur'
```

## Requirements

### Props
- `show: boolean` — controls modal visibility

### Emits
- `close` — when modal is closed
- `created` — when movement is successfully created

### Form fields
- `type` — select from `MovementType` options (receipt, expense, transfer, write-off)
- `batchId` — searchable select of available batches (show batchNumber + productName)
- `quantity` — number input (required, > 0, cannot exceed batch's `quantityRemaining` for expense/write-off)
- `unitPrice` — optional number (auto-filled from selected batch's unitPrice)
- `referenceType` — optional select (purchase_order, work_order, waste_report, cutting, sale)
- `referenceId` — optional text input
- `fromLocation` — optional text input (shown for transfer type)
- `toLocation` — optional text input (shown for transfer type)
- `performedBy` — optional text input
- `notes` — optional textarea
- `movedAt` — date picker (default: now)

### Conditional fields
- Show `fromLocation` and `toLocation` only when `type === 'transfer'`
- Show `referenceType` and `referenceId` only when `type === 'expense'` or `type === 'write-off'`

### Validation
- Required: `type`, `batchId`, `quantity`, `movedAt`
- Quantity must be > 0
- For expense/write-off: show remaining quantity of selected batch as hint

### Behavior
- On save: call `createMovement(payload)`, emit `created`, show success toast, close modal
- On error: show error toast, keep modal open
- On cancel: close modal without saving
- Reset form when modal opens

### Test IDs
- `create-movement-modal`
- `create-movement-type-select`
- `create-movement-batch-select`
- `create-movement-quantity-input`
- `create-movement-price-input`
- `create-movement-ref-type-select`
- `create-movement-ref-id-input`
- `create-movement-from-location`
- `create-movement-to-location`
- `create-movement-performer-input`
- `create-movement-date-picker`
- `create-movement-notes-input`
- `create-movement-save-btn`
- `create-movement-cancel-btn`

## Acceptance criteria

- [ ] Modal component created at [`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue)
- [ ] All form fields present with conditional visibility based on movement type
- [ ] Batch selector shows available batches with remaining quantity
- [ ] Quantity validation against batch remaining for expense/write-off
- [ ] On successful creation: toast, emit `created`, close modal
- [ ] On error: toast error, keep modal open
- [ ] Form resets when modal opens
- [ ] All `data-test` attributes added
- [ ] New i18n keys added for all 3 locales
- [ ] Component compiles without TypeScript errors
