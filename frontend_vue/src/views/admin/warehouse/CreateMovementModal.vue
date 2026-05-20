<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMovement, getBatches } from '@/services/warehouseService'
import { useToast } from '@/composables/useToast'
import type { MovementCreatePayload, MovementType, BatchListItem } from '@/types/warehouse'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t } = useI18n()
const toast = useToast()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const saving = ref(false)

// ─── Form state ──────────────────────────────────────────────────────────────

const type = ref<MovementType>('expense')
const batchId = ref('')
const quantity = ref(0)
const unitPrice = ref(0)
const referenceType = ref('')
const referenceId = ref('')
const fromLocation = ref('')
const toLocation = ref('')
const performedBy = ref('')
const notes = ref('')
const movedAt = ref(new Date().toISOString().slice(0, 10))

// ─── Batch options ───────────────────────────────────────────────────────────

const batchOptions = ref<SelectOption[]>([])
const batchMap = ref<Map<string, BatchListItem>>(new Map())

const selectedBatch = computed(() => {
  return batchMap.value.get(batchId.value) ?? null
})

const remainingHint = computed(() => {
  if (!selectedBatch.value) return ''
  return `${t('warehouse.col_remaining')}: ${selectedBatch.value.quantityRemaining} ${t(`warehouse.unit_${selectedBatch.value.unit}`)}`
})

// ─── Validation errors ───────────────────────────────────────────────────────

const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!type.value) e.type = t('validation.required')
  if (!batchId.value) e.batchId = t('validation.required')
  if (!quantity.value || quantity.value <= 0) e.quantity = t('validation.required')
  if (!movedAt.value) e.movedAt = t('validation.required')
  // For expense/write-off, check against remaining
  if (
    (type.value === 'expense' || type.value === 'write-off') &&
    selectedBatch.value &&
    quantity.value > selectedBatch.value.quantityRemaining
  ) {
    e.quantity = t('validation.max', { max: selectedBatch.value.quantityRemaining })
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const isFormValid = computed(() => {
  if (!type.value || !batchId.value || quantity.value <= 0 || !movedAt.value) return false
  if (
    (type.value === 'expense' || type.value === 'write-off') &&
    selectedBatch.value &&
    quantity.value > selectedBatch.value.quantityRemaining
  ) return false
  return true
})

// ─── Conditional visibility ──────────────────────────────────────────────────

const showTransferLocations = computed(() => type.value === 'transfer')
const showReference = computed(() => type.value === 'expense' || type.value === 'write-off')

// ─── Select options ──────────────────────────────────────────────────────────

const MOVEMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'receipt', label: t('warehouse.type_receipt') },
  { value: 'expense', label: t('warehouse.type_expense') },
  { value: 'transfer', label: t('warehouse.type_transfer') },
  { value: 'write-off', label: t('warehouse.type_write_off') },
]

const REFERENCE_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: t('warehouse.filter_type_all') },
  { value: 'purchase_order', label: t('warehouse.reference_purchase_order') },
  { value: 'work_order', label: t('warehouse.reference_work_order') },
  { value: 'waste_report', label: t('warehouse.reference_waste_report') },
  { value: 'cutting', label: t('warehouse.reference_cutting') },
  { value: 'sale', label: t('warehouse.reference_sale') },
]

// ─── Load batches ────────────────────────────────────────────────────────────

async function loadBatches() {
  try {
    const response = await getBatches(
      { search: '', status: undefined, productId: undefined, supplierId: undefined, unit: undefined, dateFrom: undefined, dateTo: undefined, sortBy: undefined, sortDir: undefined },
      { page: 1, pageSize: 200 },
    )
    batchMap.value = new Map()
    batchOptions.value = [
      { value: '', label: t('warehouse.filter_batch_placeholder') },
      ...response.items.map((b) => {
        batchMap.value.set(b.id, b)
        return {
          value: b.id,
          label: `${b.batchNumber} — ${b.productName?.ru || b.productName?.en || b.productName?.lt || ''}`,
        }
      }),
    ]
  } catch {
    batchOptions.value = [{ value: '', label: t('warehouse.filter_batch_placeholder') }]
  }
}

// ─── Reset form ──────────────────────────────────────────────────────────────

function resetForm() {
  type.value = 'expense'
  batchId.value = ''
  quantity.value = 0
  unitPrice.value = 0
  referenceType.value = ''
  referenceId.value = ''
  fromLocation.value = ''
  toLocation.value = ''
  performedBy.value = ''
  notes.value = ''
  movedAt.value = new Date().toISOString().slice(0, 10)
  errors.value = {}
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      resetForm()
      loadBatches()
    }
  },
)

// ─── Auto-fill unitPrice when batch changes ──────────────────────────────────

watch(batchId, (id) => {
  if (id) {
    const batch = batchMap.value.get(id)
    if (batch) {
      unitPrice.value = batch.unitPrice
    }
  } else {
    unitPrice.value = 0
  }
})

// ─── Save ────────────────────────────────────────────────────────────────────

async function onSave() {
  if (!validate()) return
  saving.value = true
  try {
    const payload: MovementCreatePayload = {
      type: type.value,
      batchId: batchId.value,
      quantity: quantity.value,
      unitPrice: unitPrice.value || undefined,
      referenceId: referenceId.value || null,
      referenceType: referenceType.value || null,
      fromLocation: fromLocation.value || null,
      toLocation: toLocation.value || null,
      performedBy: performedBy.value || null,
      notes: notes.value || null,
      movedAt: movedAt.value,
    }
    await createMovement(payload)
    toast.success(t('warehouse.toast_movement_created'))
    emit('created')
    emit('close')
  } catch {
    toast.error(t('warehouse.toast_error_save'))
  } finally {
    saving.value = false
  }
}

function onCancel() {
  emit('close')
}
</script>

<template>
  <AppModal
    :model-value="show"
    :title="t('warehouse.modal_expense_title')"
    size="medium"
    data-test="create-movement-modal"
    @update:model-value="(v: boolean) => { if (!v) emit('close') }"
  >
    <div class="modal-form">
      <!-- Movement type -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_movement_type') }} <span class="required">*</span></label>
        <CustomSelect
          v-model="type"
          :options="MOVEMENT_TYPE_OPTIONS"
          data-test="create-movement-type-select"
        />
        <p v-if="errors.type" class="field-error">{{ errors.type }}</p>
      </div>

      <!-- Source batch -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_source_batch') }} <span class="required">*</span></label>
        <CustomSelect
          v-model="batchId"
          :options="batchOptions"
          data-test="create-movement-batch-select"
        />
        <p v-if="selectedBatch" class="field-hint">{{ remainingHint }}</p>
        <p v-if="errors.batchId" class="field-error">{{ errors.batchId }}</p>
      </div>

      <!-- Quantity -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_movement_quantity') }} <span class="required">*</span></label>
        <input
          v-model.number="quantity"
          type="number"
          min="0"
          step="0.01"
          class="glass-input"
          data-test="create-movement-quantity-input"
        />
        <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
      </div>

      <!-- Unit price (auto-filled) -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.col_unit_price') }}</label>
        <input
          v-model.number="unitPrice"
          type="number"
          min="0"
          step="0.01"
          class="glass-input"
          data-test="create-movement-price-input"
        />
      </div>

      <!-- Reference (conditional: expense / write-off) -->
      <template v-if="showReference">
        <div class="form-group">
          <label class="field-label">{{ t('warehouse.field_reference_type') }}</label>
          <CustomSelect
            v-model="referenceType"
            :options="REFERENCE_TYPE_OPTIONS"
            data-test="create-movement-ref-type-select"
          />
        </div>
        <div class="form-group">
          <label class="field-label">{{ t('warehouse.field_reference_id') }}</label>
          <input
            v-model="referenceId"
            type="text"
            class="glass-input"
            data-test="create-movement-ref-id-input"
          />
        </div>
      </template>

      <!-- Transfer locations (conditional: transfer) -->
      <template v-if="showTransferLocations">
        <div class="form-row">
          <div class="form-group form-group-flex">
            <label class="field-label">{{ t('warehouse.field_from_location') }}</label>
            <input
              v-model="fromLocation"
              type="text"
              class="glass-input"
              data-test="create-movement-from-location"
            />
          </div>
          <div class="form-group form-group-flex">
            <label class="field-label">{{ t('warehouse.field_to_location') }}</label>
            <input
              v-model="toLocation"
              type="text"
              class="glass-input"
              data-test="create-movement-to-location"
            />
          </div>
        </div>
      </template>

      <!-- Performed by -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_performed_by') }}</label>
        <input
          v-model="performedBy"
          type="text"
          class="glass-input"
          data-test="create-movement-performer-input"
        />
      </div>

      <!-- Movement date -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_moved_at') }} <span class="required">*</span></label>
        <DatePicker
          v-model="movedAt"
          data-test="create-movement-date-picker"
        />
        <p v-if="errors.movedAt" class="field-error">{{ errors.movedAt }}</p>
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_notes') }}</label>
        <textarea
          v-model="notes"
          class="glass-input glass-textarea"
          rows="3"
          data-test="create-movement-notes-input"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="btn btn-ghost"
        :disabled="saving"
        data-test="create-movement-cancel-btn"
        @click="onCancel"
      >
        {{ t('warehouse.btn_cancel') }}
      </button>
      <button
        class="btn btn-primary"
        :disabled="saving || !isFormValid"
        data-test="create-movement-save-btn"
        @click="onSave"
      >
        <SvgIcon v-if="saving" name="loader" :width="16" :height="16" class="spin" />
        {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
      </button>
    </template>
  </AppModal>
</template>
