<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import { useToast } from '@/composables/useToast'
import { getBatches, executeCutting } from '@/services/warehouseService'
import type { BatchListItem, CuttingOperation } from '@/types/warehouse'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const { t } = useI18n()
const toast = useToast()

// ─── Batch options ───────────────────────────────────────────────────────────
const batches = ref<BatchListItem[]>([])
const batchMap = ref(new Map<string, BatchListItem>())
const loadingBatches = ref(false)

async function loadBatches() {
  loadingBatches.value = true
  try {
    const res = await getBatches({ search: '', sortBy: 'receivedAt', sortDir: 'desc' }, { page: 1, pageSize: 200 })
    batches.value = res.items
    batchMap.value = new Map(res.items.map((b) => [b.id, b]))
  } catch {
    toast.error(t('warehouse.toast_error_load'))
  } finally {
    loadingBatches.value = false
  }
}

const batchOptions = computed(() =>
  batches.value.map((b) => ({
    value: b.id,
    label: `${b.batchNumber} — ${b.productName} (${t('warehouse.col_remaining')}: ${b.quantityRemaining} ${b.unit})`,
  })),
)

const selectedBatch = computed(() =>
  sourceBatchId.value ? batchMap.value.get(sourceBatchId.value) ?? null : null,
)

// ─── Form state ──────────────────────────────────────────────────────────────
const sourceBatchId = ref('')
const sourceQuantity = ref<number | null>(null)
const kerfMm = ref<number>(0)
const wasteQuantity = ref<number | null>(null)
const notes = ref('')

interface OffcutFormItem {
  id: number
  offcutType: 'sheet' | 'linear'
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  weightKg: number | null
  quantity: number
  location: string
  notes: string
}

let nextOffcutId = 1
const offcuts = ref<OffcutFormItem[]>([])

function addOffcut() {
  offcuts.value.push({
    id: nextOffcutId++,
    offcutType: 'linear',
    lengthMm: null,
    widthMm: null,
    thicknessMm: null,
    weightKg: null,
    quantity: 1,
    location: '',
    notes: '',
  })
}

function removeOffcut(id: number) {
  offcuts.value = offcuts.value.filter((o) => o.id !== id)
}

// ─── Validation ──────────────────────────────────────────────────────────────
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const errs: Record<string, string> = {}

  if (!sourceBatchId.value) errs.sourceBatchId = t('warehouse.validation_required')
  if (!sourceQuantity.value || sourceQuantity.value <= 0) errs.sourceQuantity = t('warehouse.validation_required')
  else if (selectedBatch.value && sourceQuantity.value > selectedBatch.value.quantityRemaining) {
    errs.sourceQuantity = t('warehouse.validation_exceeds_remaining')
  }
  if (wasteQuantity.value === null || wasteQuantity.value < 0) errs.wasteQuantity = t('warehouse.validation_required')
  if (offcuts.value.length === 0) errs.offcuts = t('warehouse.validation_required')

  offcuts.value.forEach((o, i) => {
    if (!o.quantity || o.quantity <= 0) errs[`offcut_${i}_quantity`] = t('warehouse.validation_required')
  })

  errors.value = errs
  return Object.keys(errs).length === 0
}

const isFormValid = computed(() => {
  if (!sourceBatchId.value) return false
  if (!sourceQuantity.value || sourceQuantity.value <= 0) return false
  if (selectedBatch.value && sourceQuantity.value > selectedBatch.value.quantityRemaining) return false
  if (wasteQuantity.value === null || wasteQuantity.value < 0) return false
  if (offcuts.value.length === 0) return false
  if (offcuts.value.some((o) => !o.quantity || o.quantity <= 0)) return false
  return true
})

// ─── Save ────────────────────────────────────────────────────────────────────
const saving = ref(false)

async function onSave() {
  if (!validate() || !selectedBatch.value) return
  saving.value = true
  try {
    const payload: CuttingOperation = {
      sourceBatchId: sourceBatchId.value,
      sourceQuantity: sourceQuantity.value!,
      kerfMm: kerfMm.value,
      wasteQuantity: wasteQuantity.value!,
      notes: notes.value || null,
      offcuts: offcuts.value.map((o) => ({
        productId: selectedBatch.value!.productId,
        offcutType: o.offcutType,
        lengthMm: o.lengthMm ?? null,
        widthMm: o.offcutType === 'sheet' ? (o.widthMm ?? null) : null,
        thicknessMm: o.thicknessMm ?? null,
        weightKg: o.weightKg ?? null,
        quantity: o.quantity,
        unit: selectedBatch.value!.unit,
        location: o.location || null,
        notes: o.notes || null,
      })),
    }
    await executeCutting(payload)
    toast.success(t('warehouse.toast_cutting_executed'))
    emit('created')
    close()
  } catch {
    toast.error(t('warehouse.toast_error_save'))
  } finally {
    saving.value = false
  }
}

// ─── Reset ───────────────────────────────────────────────────────────────────
function resetForm() {
  sourceBatchId.value = ''
  sourceQuantity.value = null
  kerfMm.value = 0
  wasteQuantity.value = null
  notes.value = ''
  offcuts.value = []
  errors.value = {}
  nextOffcutId = 1
}

function close() {
  emit('close')
}

watch(
  () => props.show,
  (val) => {
    if (val) {
      resetForm()
      loadBatches()
    }
  },
)
</script>

<template>
  <AppModal
    :model-value="props.show"
    :title="t('warehouse.modal_cutting_title')"
    size="large"
    @update:model-value="close"
    data-test="create-offcut-modal"
  >
    <form class="cutting-form" @submit.prevent="onSave" data-test="cutting-form">
      <!-- Source batch -->
      <div class="cutting-form-row">
        <label class="cutting-form-label">{{ t('warehouse.field_source_batch') }}</label>
        <CustomSelect
          v-model="sourceBatchId"
          :options="batchOptions"
          :placeholder="t('warehouse.field_source_batch')"
          data-test="cutting-source-batch-select"
        />
        <span v-if="errors.sourceBatchId" class="cutting-form-error">{{ errors.sourceBatchId }}</span>
        <span v-if="selectedBatch" class="cutting-form-hint">
          {{ t('warehouse.col_remaining') }}: {{ selectedBatch.quantityRemaining }} {{ selectedBatch.unit }}
        </span>
      </div>

      <!-- Source quantity -->
      <div class="cutting-form-row">
        <label class="cutting-form-label">{{ t('warehouse.field_source_quantity') }}</label>
        <input
          v-model.number="sourceQuantity"
          type="number"
          min="0"
          step="any"
          class="cutting-form-input"
          data-test="cutting-source-quantity-input"
        />
        <span v-if="errors.sourceQuantity" class="cutting-form-error">{{ errors.sourceQuantity }}</span>
      </div>

      <!-- Kerf -->
      <div class="cutting-form-row">
        <label class="cutting-form-label">{{ t('warehouse.field_kerf') }}</label>
        <input
          v-model.number="kerfMm"
          type="number"
          min="0"
          step="0.1"
          class="cutting-form-input cutting-form-input--short"
          data-test="cutting-kerf-input"
        />
      </div>

      <!-- Waste -->
      <div class="cutting-form-row">
        <label class="cutting-form-label">{{ t('warehouse.field_waste') }}</label>
        <input
          v-model.number="wasteQuantity"
          type="number"
          min="0"
          step="any"
          class="cutting-form-input"
          data-test="cutting-waste-input"
        />
        <span v-if="errors.wasteQuantity" class="cutting-form-error">{{ errors.wasteQuantity }}</span>
      </div>

      <!-- Offcuts list -->
      <div class="cutting-form-row cutting-form-row--full">
        <label class="cutting-form-label">{{ t('warehouse.field_offcuts') }}</label>
        <div
          v-if="offcuts.length > 0"
          class="cutting-offcut-list"
          data-test="cutting-offcut-list"
        >
          <div
            v-for="(offcut, index) in offcuts"
            :key="offcut.id"
            class="cutting-offcut-row"
            :data-test="`cutting-offcut-row-${index}`"
          >
            <div class="cutting-offcut-header">
              <span class="cutting-offcut-title">{{ t('warehouse.field_offcuts') }} #{{ index + 1 }}</span>
              <button
                type="button"
                class="cutting-offcut-remove-btn"
                :data-test="`cutting-remove-offcut-btn-${index}`"
                @click="removeOffcut(offcut.id)"
              >
                <SvgIcon name="trash" />
              </button>
            </div>

            <div class="cutting-offcut-fields">
              <!-- Offcut type -->
              <div class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_type') }}</label>
                <select v-model="offcut.offcutType" class="cutting-form-select">
                  <option value="linear">Linear</option>
                  <option value="sheet">Sheet</option>
                </select>
              </div>

              <!-- Length -->
              <div class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_length') }}</label>
                <input
                  v-model.number="offcut.lengthMm"
                  type="number"
                  min="0"
                  step="0.1"
                  class="cutting-form-input"
                />
              </div>

              <!-- Width (only for sheet) -->
              <div v-if="offcut.offcutType === 'sheet'" class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_dimensions') }} ({{ t('warehouse.col_width') }})</label>
                <input
                  v-model.number="offcut.widthMm"
                  type="number"
                  min="0"
                  step="0.1"
                  class="cutting-form-input"
                />
              </div>

              <!-- Thickness -->
              <div class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_thickness') }}</label>
                <input
                  v-model.number="offcut.thicknessMm"
                  type="number"
                  min="0"
                  step="0.1"
                  class="cutting-form-input"
                />
              </div>

              <!-- Weight -->
              <div class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_weight') }}</label>
                <input
                  v-model.number="offcut.weightKg"
                  type="number"
                  min="0"
                  step="0.01"
                  class="cutting-form-input"
                />
              </div>

              <!-- Quantity -->
              <div class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_quantity') }}</label>
                <input
                  v-model.number="offcut.quantity"
                  type="number"
                  min="1"
                  step="1"
                  class="cutting-form-input cutting-form-input--short"
                />
                <span v-if="errors[`offcut_${index}_quantity`]" class="cutting-form-error">{{ errors[`offcut_${index}_quantity`] }}</span>
              </div>

              <!-- Location -->
              <div class="cutting-offcut-field">
                <label class="cutting-form-label">{{ t('warehouse.col_location') }}</label>
                <input
                  v-model="offcut.location"
                  type="text"
                  class="cutting-form-input"
                />
              </div>

              <!-- Notes -->
              <div class="cutting-offcut-field cutting-offcut-field--full">
                <label class="cutting-form-label">{{ t('warehouse.field_notes') }}</label>
                <textarea
                  v-model="offcut.notes"
                  class="cutting-form-textarea"
                  rows="2"
                />
              </div>
            </div>
          </div>
        </div>

        <span v-if="errors.offcuts" class="cutting-form-error">{{ errors.offcuts }}</span>

        <button
          type="button"
          class="cutting-add-offcut-btn"
          data-test="cutting-add-offcut-btn"
          @click="addOffcut"
        >
          <SvgIcon name="plus" />
          {{ t('warehouse.btn_add_offcut') }}
        </button>
      </div>

      <!-- Notes -->
      <div class="cutting-form-row cutting-form-row--full">
        <label class="cutting-form-label">{{ t('warehouse.field_notes') }}</label>
        <textarea
          v-model="notes"
          class="cutting-form-textarea"
          rows="3"
          data-test="cutting-notes-input"
        />
      </div>
    </form>

    <template #footer>
      <div class="cutting-footer">
        <button
          type="button"
          class="cutting-btn cutting-btn--cancel"
          data-test="cutting-cancel-btn"
          @click="close"
        >
          {{ t('warehouse.btn_cancel') }}
        </button>
        <button
          type="submit"
          class="cutting-btn cutting-btn--save"
          :disabled="!isFormValid || saving"
          data-test="cutting-save-btn"
          @click="onSave"
        >
          {{ t('warehouse.btn_save') }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.cutting-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cutting-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cutting-form-row--full {
  grid-column: 1 / -1;
}

.cutting-form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.cutting-form-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #d9d9d9);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1a1a1a);
  transition: border-color 0.2s;
}

.cutting-form-input:focus {
  outline: none;
  border-color: var(--accent-color, #4f46e5);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.cutting-form-input--short {
  max-width: 120px;
}

.cutting-form-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #d9d9d9);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1a1a1a);
  cursor: pointer;
}

.cutting-form-textarea {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #d9d9d9);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1a1a1a);
  resize: vertical;
  font-family: inherit;
}

.cutting-form-textarea:focus {
  outline: none;
  border-color: var(--accent-color, #4f46e5);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.cutting-form-error {
  font-size: 12px;
  color: var(--danger-color, #dc2626);
}

.cutting-form-hint {
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

/* Offcut list */
.cutting-offcut-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cutting-offcut-row {
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-secondary, #f9fafb);
}

.cutting-offcut-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cutting-offcut-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.cutting-offcut-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--danger-color, #dc2626);
  cursor: pointer;
  transition: background 0.2s;
}

.cutting-offcut-remove-btn:hover {
  background: rgba(220, 38, 38, 0.1);
}

.cutting-offcut-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}

.cutting-offcut-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cutting-offcut-field--full {
  grid-column: 1 / -1;
}

/* Add offcut button */
.cutting-add-offcut-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px dashed var(--border-color, #d9d9d9);
  border-radius: 6px;
  background: transparent;
  color: var(--accent-color, #4f46e5);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  margin-top: 4px;
}

.cutting-add-offcut-btn:hover {
  background: rgba(79, 70, 229, 0.05);
  border-color: var(--accent-color, #4f46e5);
}

/* Footer */
.cutting-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cutting-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  border: 1px solid var(--border-color, #d9d9d9);
}

.cutting-btn--cancel {
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1a1a1a);
}

.cutting-btn--cancel:hover {
  background: var(--bg-secondary, #f5f5f5);
}

.cutting-btn--save {
  background: var(--accent-color, #4f46e5);
  color: #fff;
  border-color: var(--accent-color, #4f46e5);
}

.cutting-btn--save:hover:not(:disabled) {
  opacity: 0.9;
}

.cutting-btn--save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
