<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { createBatch } from '@/services/warehouseService'
import { getProductList } from '@/services/productsService'
import { getSupplierList } from '@/services/suppliersService'
import { useToast } from '@/composables/useToast'
import type { BatchCreatePayload, StockUnit } from '@/types/warehouse'
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

const productId = ref('')
const supplierId = ref('')
const batchNumber = ref('')
const lotCode = ref('')
const quantity = ref(0)
const unit = ref<StockUnit>('kg')
const unitPrice = ref(0)
const receivedAt = ref(new Date().toISOString().slice(0, 10))
const expiresAt = ref('')
const location = ref('')
const certificateRef = ref('')
const notes = ref('')

/** Step for quantity inputs: 1 for pcs, 0.01 for others */
const quantityStep = computed(() => unit.value === 'pcs' ? 1 : 0.01)

// ─── Validation errors ───────────────────────────────────────────────────────

const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!productId.value) e.productId = t('validation.required')
  if (!batchNumber.value.trim()) e.batchNumber = t('validation.required')
  if (!lotCode.value.trim()) e.lotCode = t('validation.required')
  if (!quantity.value || quantity.value <= 0) e.quantity = t('validation.required')
  if (!unit.value) e.unit = t('validation.required')
  if (unitPrice.value < 0) e.unitPrice = t('validation.required')
  if (!receivedAt.value) e.receivedAt = t('validation.required')
  errors.value = e
  return Object.keys(e).length === 0
}

const isFormValid = computed(() => {
  return (
    productId.value &&
    batchNumber.value.trim() &&
    lotCode.value.trim() &&
    quantity.value > 0 &&
    unit.value &&
    unitPrice.value >= 0 &&
    receivedAt.value
  )
})

// ─── Computed ────────────────────────────────────────────────────────────────

const totalCost = computed(() => {
  return (quantity.value || 0) * (unitPrice.value || 0)
})

// ─── Select options ──────────────────────────────────────────────────────────

const productOptions = ref<SelectOption[]>([])
const supplierOptions = ref<SelectOption[]>([])

const UNIT_OPTIONS: SelectOption[] = [
  { value: 'kg', label: 'kg' },
  { value: 'm', label: 'm' },
  { value: 'pcs', label: 'pcs' },
  { value: 'm2', label: 'm²' },
]

// ─── Load select data ────────────────────────────────────────────────────────

async function loadOptions() {
  try {
    const products = await getProductList()
    productOptions.value = products.map((p) => ({
      value: p.id,
      label: p.name.ru || p.name.en || p.name.lt,
    }))
  } catch {
    productOptions.value = []
  }
  try {
    const suppliers = await getSupplierList()
    supplierOptions.value = [
      { value: '', label: t('warehouse.filter_supplier_all') },
      ...suppliers.map((s) => ({ value: s.id, label: s.company })),
    ]
  } catch {
    supplierOptions.value = [{ value: '', label: t('warehouse.filter_supplier_all') }]
  }
}

// ─── Reset form ──────────────────────────────────────────────────────────────

function resetForm() {
  productId.value = ''
  supplierId.value = ''
  batchNumber.value = ''
  lotCode.value = ''
  quantity.value = 0
  unit.value = 'kg'
  unitPrice.value = 0
  receivedAt.value = new Date().toISOString().slice(0, 10)
  expiresAt.value = ''
  location.value = ''
  certificateRef.value = ''
  notes.value = ''
  errors.value = {}
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      resetForm()
      loadOptions()
    }
  },
)

// ─── Save ────────────────────────────────────────────────────────────────────

async function onSave() {
  if (!validate()) return
  saving.value = true
  try {
    const payload: BatchCreatePayload = {
      productId: productId.value,
      supplierId: supplierId.value || null,
      batchNumber: batchNumber.value.trim(),
      lotCode: lotCode.value.trim(),
      quantity: quantity.value,
      unit: unit.value,
      unitPrice: unitPrice.value,
      receivedAt: receivedAt.value,
      expiresAt: expiresAt.value || null,
      location: location.value || null,
      certificateRef: certificateRef.value || null,
      notes: notes.value || null,
    }
    await createBatch(payload)
    toast.success(t('warehouse.toast_batch_created'))
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

// ─── Auto-resize notes textarea ──────────────────────────────────────
const notesTextarea = ref<HTMLTextAreaElement | null>(null)
const MAX_NOTES_HEIGHT = 300

function autoResizeNotes() {
  const el = notesTextarea.value
  if (!el) return
  el.style.height = 'auto'
  if (el.scrollHeight > MAX_NOTES_HEIGHT) {
    el.style.height = MAX_NOTES_HEIGHT + 'px'
    el.style.overflowY = 'auto'
  } else {
    el.style.height = el.scrollHeight + 'px'
    el.style.overflowY = 'hidden'
  }
}

watch(notes, () => {
  nextTick(autoResizeNotes)
})
</script>

<template>
  <AppModal
    :model-value="show"
    :title="t('warehouse.modal_receipt_title')"
    size="medium"
    data-test="create-batch-modal"
    @update:model-value="(v: boolean) => { if (!v) emit('close') }"
  >
    <div class="modal-form" data-test="create-batch-form">
      <!-- Product -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.col_product') }} <span class="required">*</span></label>
        <CustomSelect
          v-model="productId"
          :options="productOptions"
          data-test="create-batch-product-select"
        />
        <p v-if="errors.productId" class="field-error">{{ errors.productId }}</p>
      </div>

      <!-- Supplier -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.col_supplier') }}</label>
        <CustomSelect
          v-model="supplierId"
          :options="supplierOptions"
          data-test="create-batch-supplier-select"
        />
      </div>

      <!-- Batch number -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_batch_number') }} <span class="required">*</span></label>
        <input
          v-model="batchNumber"
          type="text"
          class="glass-input"
          data-test="create-batch-number-input"
        />
        <p v-if="errors.batchNumber" class="field-error">{{ errors.batchNumber }}</p>
      </div>

      <!-- Lot code -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_lot_code') }} <span class="required">*</span></label>
        <input
          v-model="lotCode"
          type="text"
          class="glass-input"
          data-test="create-batch-lot-input"
        />
        <p v-if="errors.lotCode" class="field-error">{{ errors.lotCode }}</p>
      </div>

      <!-- Quantity + Unit (side by side) -->
      <div class="form-row">
        <div class="form-group form-group-flex">
          <label class="field-label">{{ t('warehouse.col_quantity') }} <span class="required">*</span></label>
          <input
            v-model.number="quantity"
            type="number"
            min="0"
            :step="quantityStep"
            class="glass-input"
            data-test="create-batch-quantity-input"
          />
          <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
        </div>
        <div class="form-group form-group-shrink">
          <label class="field-label">{{ t('warehouse.col_unit') }} <span class="required">*</span></label>
          <CustomSelect
            v-model="unit"
            :options="UNIT_OPTIONS"
            data-test="create-batch-unit-select"
          />
          <p v-if="errors.unit" class="field-error">{{ errors.unit }}</p>
        </div>
      </div>

      <!-- Unit price -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.col_unit_price') }} <span class="required">*</span></label>
        <input
          v-model.number="unitPrice"
          type="number"
          min="0"
          step="0.01"
          class="glass-input"
          data-test="create-batch-price-input"
        />
        <p v-if="errors.unitPrice" class="field-error">{{ errors.unitPrice }}</p>
      </div>

      <!-- Total cost (read-only) -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_total_cost') }}</label>
        <div class="total-cost-display" data-test="create-batch-total-display">
          {{ totalCost.toFixed(2) }} €
        </div>
      </div>

      <!-- Received at -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_received_at') }} <span class="required">*</span></label>
        <DatePicker
          v-model="receivedAt"
          data-test="create-batch-received-date"
        />
        <p v-if="errors.receivedAt" class="field-error">{{ errors.receivedAt }}</p>
      </div>

      <!-- Expires at -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_expires_at') }}</label>
        <DatePicker
          v-model="expiresAt"
          data-test="create-batch-expires-date"
        />
      </div>

      <!-- Location -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_location') }}</label>
        <input
          v-model="location"
          type="text"
          class="glass-input"
          data-test="create-batch-location-input"
        />
      </div>

      <!-- Certificate -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_certificate') }}</label>
        <input
          v-model="certificateRef"
          type="text"
          class="glass-input"
          data-test="create-batch-certificate-input"
        />
      </div>

      <!-- Notes -->
      <div class="form-group">
        <label class="field-label">{{ t('warehouse.field_notes') }}</label>
        <textarea
          ref="notesTextarea"
          v-model="notes"
          class="glass-input glass-textarea batch-notes-input"
          data-test="create-batch-notes-input"
          @input="autoResizeNotes"
        />
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="saving"
        data-test="create-batch-cancel-btn"
        @click="onCancel"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        class="btn btn-primary"
        :disabled="saving || !isFormValid"
        data-test="create-batch-save-btn"
        @click="onSave"
      >
        <SvgIcon v-if="saving" name="loader" :width="16" :height="16" class="spin" />
        {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
      </button>
    </template>
  </AppModal>
</template>
