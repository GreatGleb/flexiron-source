<!-- DEPRECATED: Movement creation removed from UI. Keep file for backward compatibility / potential future use. -->
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMovement } from '@/services/warehouseService'
import { useToast } from '@/composables/useToast'
import type { MovementCreatePayload, MovementType, MovementListItem, WarehouseBatch, BatchStatusAggregate, BatchActiveSale } from '@/types/warehouse'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t } = useI18n()
const toast = useToast()

const props = defineProps<{
  show: boolean
  batch?: WarehouseBatch | null
  movements?: MovementListItem[]
  aggregates?: BatchStatusAggregate[]
  activeSales?: BatchActiveSale[]
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const saving = ref(false)

// ─── Form state ──────────────────────────────────────────────────────────────

const type = ref<MovementType | ''>('')
const quantity = ref(0)
/** Tracks whether the user has interacted with the quantity input field.
 *  Prevents showing validation error on initial render (when quantity = 0). */
const quantityTouched = ref(false)
const referenceType = ref('')
const referenceId = ref('')
const fromLocation = ref('')
const toLocation = ref('')
const performedBy = ref('')
const notes = ref('')
const movedAt = ref(new Date().toISOString().slice(0, 10))

// ─── Batch summary (from props) ──────────────────────────────────────────────

const MOVEMENT_TYPE_ICONS: Record<string, string> = {
  receipt: 'package',
  expense: 'trending-down',
  'write-off': 'trash-2',
  sale: 'shopping-cart',
  production: 'settings',
  transfer: 'refresh-cw',
  return: 'corner-up-left',
  'return-to-supplier': 'corner-up-left',
  correction: 'edit',
  storage: 'archive',
}

const MOVEMENT_TYPE_AGGREGATE_LABELS: Record<string, string> = {
  receipt: 'batch_summary_in_stock',
  sale: 'batch_summary_sold',
  'write-off': 'batch_summary_scrapped',
  production: 'batch_summary_production',
  expense: 'batch_summary_expensed',
  'return-to-supplier': 'batch_summary_returned_to_supplier',
  transfer: 'batch_summary_transferred',
  return: 'batch_summary_returned',
  correction: 'batch_summary_corrected',
  storage: 'batch_summary_storage',
}

const MOVEMENT_TYPE_AGGREGATE_COLORS: Record<string, string> = {
  receipt: 'agg-card-in-stock',
  sale: 'agg-card-sold',
  'write-off': 'agg-card-scrapped',
  production: 'agg-card-production',
  expense: 'agg-card-expensed',
  'return-to-supplier': 'agg-card-returned-to-supplier',
  transfer: 'agg-card-transferred',
  return: 'agg-card-returned',
  correction: 'agg-card-corrected',
  storage: 'agg-card-storage',
}

/** Movement types that should NOT be shown in the aggregate cards in this modal */
const HIDDEN_AGGREGATE_TYPES = new Set(['return', 'transfer'])

/** Sorted aggregate entries for display (from pre-computed aggregates prop).
 *  Sale is always placed last, right before the active sales section. */
const aggregateEntries = computed(() => {
  if (!props.aggregates) return []
  const visible = props.aggregates.filter((a) => a.quantity > 0 && !HIDDEN_AGGREGATE_TYPES.has(a.type))
  const sale = visible.find((a) => a.type === 'sale')
  const others = visible.filter((a) => a.type !== 'sale').sort((a, b) => b.quantity - a.quantity)
  const result = others.map((a) => [a.type, a.quantity] as [string, number])
  if (sale) result.push(['sale', sale.quantity])
  return result
})

/** Which aggregate type is currently selected (single-select radio behavior). null = none. */
const selectedAggregateType = ref<string | null>(null)

/** Which active sale is currently selected (for return linking). null = none. */
const selectedSaleId = ref<string | null>(null)

/** Select an aggregate type (single-select — previous selection is cleared). */
function selectAggregateType(type: string) {
  selectedAggregateType.value = selectedAggregateType.value === type ? null : type
  // Clear sale selection when selecting an aggregate
  selectedSaleId.value = null
}

/** Select an active sale (single-select). */
function selectSale(saleId: string) {
  selectedSaleId.value = selectedSaleId.value === saleId ? null : saleId
  // Clear aggregate selection when selecting a sale
  selectedAggregateType.value = null
}

/** Quantity from the selected aggregate type or active sale (or 0 if none selected) */
const selectedAggregateQuantity = computed(() => {
  // If an active sale is selected, return its quantity
  if (selectedSaleId.value && props.activeSales) {
    const sale = props.activeSales.find((s) => s.id === selectedSaleId.value)
    if (sale) return sale.quantity
  }
  // Otherwise check the selected aggregate type
  if (!selectedAggregateType.value || !props.aggregates) return 0
  const agg = props.aggregates.find((a) => a.type === selectedAggregateType.value)
  return agg ? agg.quantity : 0
})

/** Whether the selected type is 'correction' */
const isCorrection = computed(() => type.value === 'correction')

/**
 * Direction of the selected movement type.
 * - 'incoming': adds to stock (receipt, return)
 * - 'outgoing': removes from stock (sale, expense, write-off, production, storage, transfer, return-to-supplier)
 * - 'correction': user sets the new value directly
 * - 'none': no type selected
 */
const movementDirection = computed<'incoming' | 'outgoing' | 'correction' | 'none'>(() => {
  if (!type.value) return 'none'
  const incoming = new Set(['receipt', 'return'])
  if (incoming.has(type.value)) return 'incoming'
  if (type.value === 'correction') return 'correction'
  return 'outgoing'
})

/**
 * What the selected aggregate quantity will be AFTER the new movement.
 * For correction: the user edits this value directly (bound to `quantity`).
 * For incoming types (receipt): selected + new quantity.
 * For return: selected - new quantity (return reduces the aggregate quantity).
 * For outgoing types: selected - new quantity (min 0).
 * null when no aggregate/sale is selected.
 */
const selectedAggregateAfter = computed(() => {
  if (!selectedAggregateType.value && !selectedSaleId.value) return null
  if (!type.value) return selectedAggregateQuantity.value

  const dir = movementDirection.value
  if (dir === 'correction') return quantity.value || 0
  // Return is 'incoming' for total stock but reduces the selected aggregate
  if (type.value === 'return') return Math.max(0, selectedAggregateQuantity.value - (quantity.value || 0))
  if (dir === 'incoming') return selectedAggregateQuantity.value + (quantity.value || 0)
  if (dir === 'outgoing') return Math.max(0, selectedAggregateQuantity.value - (quantity.value || 0))
  return selectedAggregateQuantity.value
})

/**
 * What the "в наличии" (in stock) quantity will be AFTER the movement.
 * Always read-only.
 * Base value = the 'receipt' aggregate quantity (goods currently in stock).
 * If receipt aggregate not found, falls back to batch.quantity.
 * For incoming: base + new quantity.
 * For outgoing: base - new quantity (min 0).
 * For correction: only affects total in stock when correcting the 'receipt'
 *   aggregate itself. Correcting any other aggregate type does NOT change
 *   the total in stock.
 */
const totalInStockAfter = computed(() => {
  if (!props.batch) return 0

  // Always use the "в наличии" (receipt) aggregate as the base
  const receiptAgg = props.aggregates?.find((a) => a.type === 'receipt')
  const base = receiptAgg ? receiptAgg.quantity : props.batch.quantity

  if (!type.value) return base

  const dir = movementDirection.value
  if (dir === 'correction') {
    // Only affect total in stock when correcting the 'receipt' aggregate itself
    if (selectedAggregateType.value === 'receipt') {
      const delta = (quantity.value || 0) - selectedAggregateQuantity.value
      return Math.max(0, base + delta)
    }
    // Correcting any other aggregate type does NOT change total in stock
    return base
  }
  if (dir === 'incoming') return base + (quantity.value || 0)
  if (dir === 'outgoing') return Math.max(0, base - (quantity.value || 0))
  return base
})

/** Step for quantity inputs: 1 for pcs, 0.01 for others */
const quantityStep = computed(() => props.batch?.unit === 'pcs' ? 1 : 0.01)

/** Translated unit label for the batch (e.g. "шт", "кг", "м", "м²") */
const batchUnitLabel = computed(() => {
  if (!props.batch?.unit) return ''
  return t(`warehouse.unit_${props.batch.unit}`)
})

// ─── Validation errors ───────────────────────────────────────────────────────

const errors = ref<Record<string, string>>({})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!type.value) e.type = t('validation.required')
  if (!movedAt.value) e.movedAt = t('validation.required')
  if (isCorrection.value) {
    if (quantity.value < 0) {
      e.quantity = t('validation.min', { min: 0 })
    } else if (quantity.value === selectedAggregateQuantity.value) {
      e.quantity = t('warehouse.correction_no_change')
    }
  } else {
    if (!quantity.value || quantity.value <= 0) e.quantity = t('validation.required')
    // Cannot exceed the selected aggregate/sale quantity
    if ((selectedAggregateType.value || selectedSaleId.value) && quantity.value > selectedAggregateQuantity.value) {
      e.quantity = t('validation.max', { max: selectedAggregateQuantity.value })
    }
    // For expense/write-off, check against remaining
    if (
      (type.value === 'expense' || type.value === 'write-off') &&
      props.batch &&
      quantity.value > props.batch.quantityRemaining
    ) {
      e.quantity = t('validation.max', { max: props.batch.quantityRemaining })
    }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const isFormValid = computed(() => {
  if (!type.value || !movedAt.value) return false
  if (isCorrection.value) {
    if (quantity.value < 0) return false
    if (quantity.value === selectedAggregateQuantity.value) return false
  } else {
    if (quantity.value <= 0) return false
    // Cannot exceed the selected aggregate/sale quantity
    if ((selectedAggregateType.value || selectedSaleId.value) && quantity.value > selectedAggregateQuantity.value) return false
    if (
      (type.value === 'expense' || type.value === 'write-off') &&
      props.batch &&
      quantity.value > props.batch.quantityRemaining
    ) return false
  }
  return true
})

/**
 * Real-time validation error for the "new movement quantity" field.
 * Returns the error message or null if the value is valid.
 * Only shows after the user has interacted with the field (quantityTouched).
 * Updated reactively as the user types — error appears/disappears instantly.
 */
const quantityError = computed<string | null>(() => {
  // Don't show error until user has interacted with the field
  if (!quantityTouched.value) return null

  // Correction mode hides this field, no validation needed
  if (isCorrection.value) return null

  // Must be positive (> 0)
  if (!quantity.value || quantity.value <= 0) return t('warehouse.movement_modal_quantity_positive')

  // Cannot exceed the selected aggregate/sale quantity
  if ((selectedAggregateType.value || selectedSaleId.value) && quantity.value > selectedAggregateQuantity.value) {
    return t('warehouse.movement_modal_quantity_exceeds', { max: selectedAggregateQuantity.value })
  }

  // For expense/write-off, check against remaining stock
  if (
    (type.value === 'expense' || type.value === 'write-off') &&
    props.batch &&
    quantity.value > props.batch.quantityRemaining
  ) {
    return t('warehouse.movement_modal_quantity_exceeds', { max: props.batch.quantityRemaining })
  }

  return null
})

// ─── Conditional visibility ──────────────────────────────────────────────────

const showTransferLocations = computed(() => type.value === 'transfer')
const showReference = computed(() => type.value === 'expense' || type.value === 'write-off')

/** Summary of the selected movement type (label + effect description) */
const selectedMovementEffect = computed(() => {
  if (!type.value) return ''
  const key = `warehouse.movement_type_effect_${type.value}`
  const translated = t(key)
  if (translated === key) return t(`warehouse.movement_type_hint_${type.value}`)
  return translated
})

// ─── Select options ──────────────────────────────────────────────────────────

/** All possible movement types (except 'transfer' — not available in this modal) */
const ALL_MOVEMENT_TYPE_OPTIONS: SelectOption[] = [
  { value: 'receipt', label: t('warehouse.type_receipt'), hint: t('warehouse.movement_type_hint_receipt') },
  { value: 'sale', label: t('warehouse.type_sale'), hint: t('warehouse.movement_type_hint_sale') },
  { value: 'production', label: t('warehouse.type_production'), hint: t('warehouse.movement_type_hint_production') },
  { value: 'expense', label: t('warehouse.type_expense'), hint: t('warehouse.movement_type_hint_expense') },
  { value: 'write-off', label: t('warehouse.type_write_off'), hint: t('warehouse.movement_type_hint_write_off') },
  { value: 'storage', label: t('warehouse.type_storage'), hint: t('warehouse.movement_type_hint_storage') },
  { value: 'return', label: t('warehouse.type_return'), hint: t('warehouse.movement_type_hint_return') },
  { value: 'return-to-supplier', label: t('warehouse.type_return_to_supplier'), hint: t('warehouse.movement_type_hint_return_to_supplier') },
  { value: 'correction', label: t('warehouse.type_correction'), hint: t('warehouse.movement_type_hint_correction') },
]

/**
 * Dynamically filtered movement type options based on selected aggregate type
 * or active sale.
 *
 * Rules:
 * - Nothing selected → only 'receipt' (no existing stock needed)
 * - 'receipt' (в наличии) selected → all except 'return' and 'receipt'
 * - A sale (aggregate or active sale) selected → only 'return' and 'correction'
 * - Any other status selected → only 'return' and 'correction'
 */
const availableMovementTypes = computed(() => {
  // If a sale is selected (either aggregate card or active sale), treat it as 'sale'
  const effectiveType = selectedSaleId.value
    ? 'sale'
    : selectedAggregateType.value

  if (!effectiveType) {
    // Nothing selected — only receipt is available
    return ALL_MOVEMENT_TYPE_OPTIONS.filter((o) => o.value === 'receipt')
  }

  if (effectiveType === 'receipt') {
    // Receipt (в наличии): all except 'return' and 'receipt' itself
    return ALL_MOVEMENT_TYPE_OPTIONS.filter((o) => o.value !== 'return' && o.value !== 'receipt')
  }

  // All other statuses (including sale): only 'return' and 'correction'
  return ALL_MOVEMENT_TYPE_OPTIONS.filter((o) => o.value === 'return' || o.value === 'correction')
})

const REFERENCE_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: t('warehouse.filter_type_all') },
  { value: 'purchase_order', label: t('warehouse.reference_purchase_order') },
  { value: 'work_order', label: t('warehouse.reference_work_order') },
  { value: 'waste_report', label: t('warehouse.reference_waste_report') },
  { value: 'cutting', label: t('warehouse.reference_cutting') },
  { value: 'sale', label: t('warehouse.reference_sale') },
]

// ─── Reset form ──────────────────────────────────────────────────────────────

function resetForm() {
  type.value = ''
  quantity.value = 0
  quantityTouched.value = false
  referenceType.value = ''
  referenceId.value = ''
  fromLocation.value = ''
  toLocation.value = ''
  performedBy.value = ''
  notes.value = ''
  movedAt.value = new Date().toISOString().slice(0, 10)
  errors.value = {}
  selectedAggregateType.value = null
  selectedSaleId.value = null
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      resetForm()
    }
  },
)

/** When aggregate or sale selection changes, clear movement type if it's no longer available.
 *  Also sync quantity to the selected aggregate/sale value (for both correction and normal mode). */
watch([selectedAggregateType, selectedSaleId], () => {
  if (type.value && !availableMovementTypes.value.some((o) => o.value === type.value)) {
    type.value = ''
  }
  // Sync quantity to the newly selected aggregate/sale value
  if (type.value === 'correction') {
    quantity.value = selectedAggregateQuantity.value
  } else if (selectedAggregateType.value || selectedSaleId.value) {
    // For normal mode: default quantity to the selected aggregate/sale quantity
    quantity.value = selectedAggregateQuantity.value || 0
    // Reset touch state so validation error doesn't show for the pre-filled value
    quantityTouched.value = false
  } else {
    // Nothing selected — reset quantity to 0
    quantity.value = 0
    quantityTouched.value = false
  }
})

/** When correction is selected, initialize quantity to the selected aggregate quantity.
 *  When leaving correction, reset quantity to 0. */
watch(type, (newType, oldType) => {
  if (newType === 'correction') {
    quantity.value = selectedAggregateQuantity.value
  } else if (oldType === 'correction') {
    quantity.value = 0
  }
})

// ─── Save ────────────────────────────────────────────────────────────────────

async function onSave() {
  if (!validate()) return
  if (!props.batch) return
  saving.value = true
  try {
    // For return from an active sale: use that sale's referenceId so the
    // backend can match the return to the original sale for active-sales tracking.
    const returnRefId = type.value === 'return' && selectedSaleId.value && props.activeSales
      ? (props.activeSales.find((s) => s.id === selectedSaleId.value)?.referenceId ?? null)
      : null

    const payload: MovementCreatePayload = {
      type: type.value as MovementType,
      batchId: props.batch.id,
      quantity: quantity.value,
      referenceId: returnRefId || referenceId.value || null,
      referenceType: type.value === 'return'
        ? (selectedAggregateType.value || (selectedSaleId.value ? 'sale' : null))
        : type.value === 'correction'
          ? (selectedAggregateType.value || null)
          : (referenceType.value || null),
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

// ─── Notes auto-resize ──────────────────────────────────────────────────────────

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

// ─── Format helpers ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString()
}

</script>

<template>
  <AppModal
    :model-value="show"
    :title="t('warehouse.movement_modal_title')"
    size="large"
    data-test="create-movement-modal"
    @update:model-value="(v: boolean) => { if (!v) emit('close') }"
  >
    <div class="modal-form">
      <!-- ── Batch Summary Section (scrollable) ── -->
      <div v-if="batch" class="batch-summary-section" data-test="batch-summary-section">
        <!-- Total batch quantity -->
        <div class="batch-total-stat">
          <div class="total-icon">
            <SvgIcon name="package" :width="18" :height="18" />
          </div>
          <div class="total-info">
            <div class="total-label">{{ t('warehouse.batch_summary_total') }}</div>
            <div class="total-value">
              {{ batch.quantity }}
              <span class="total-unit">{{ t(`warehouse.unit_${batch.unit}`) }}</span>
            </div>
          </div>
        </div>

        <!-- Instruction: select which stock type to modify -->
        <p class="batch-summary-instruction">
          {{ t('warehouse.batch_summary_instruction') }}
        </p>

        <!-- Aggregate status cards (clickable — single-select radio behavior; sale card is NOT clickable — select individual sales below) -->
        <div v-if="aggregateEntries.length > 0" class="aggregate-cards">
          <div
            v-for="[movementType, qty] in aggregateEntries"
            :key="movementType"
            class="aggregate-card"
            :class="[
              MOVEMENT_TYPE_AGGREGATE_COLORS[movementType] || '',
              { 'is-selected': movementType !== 'sale' && selectedAggregateType === movementType }
            ]"
            :data-test="'aggregate-card-' + movementType"
            @click="movementType !== 'sale' && selectAggregateType(movementType)"
          >
            <!-- Checkbox only for selectable types (not sale) -->
            <div v-if="movementType !== 'sale'" class="agg-checkbox">
              <SvgIcon v-if="selectedAggregateType === movementType" name="check" :width="12" :height="12" />
            </div>
            <div class="agg-icon">
              <SvgIcon :name="MOVEMENT_TYPE_ICONS[movementType] || 'package'" :width="14" :height="14" />
            </div>
            <div class="agg-info">
              <div class="agg-label">{{ t(`warehouse.${MOVEMENT_TYPE_AGGREGATE_LABELS[movementType] || 'batch_summary_in_stock'}`) }}</div>
              <div class="agg-value">
                {{ qty }}
                <span class="agg-unit">{{ t(`warehouse.unit_${batch.unit}`) }}</span>
              </div>
              <!-- Hint inside sale card: select a specific sale below -->
              <div v-if="movementType === 'sale'" class="agg-sale-hint">{{ t('warehouse.batch_summary_active_sales_hint') }}</div>
            </div>
          </div>
        </div>

        <!-- Active sales section (individual sales shown for return linking — clickable) -->
        <div v-if="activeSales && activeSales.length > 0" class="active-sales-section">
          <div class="active-sales-header">
            <SvgIcon name="shopping-cart" :width="14" :height="14" />
            <span>{{ t('warehouse.batch_summary_active_sales') }}</span>
          </div>
          <div class="active-sales-list">
            <div
              v-for="sale in activeSales"
              :key="sale.id"
              class="active-sale-card"
              :class="{ 'is-selected': selectedSaleId === sale.id }"
              data-test="active-sale-card"
              @click="selectSale(sale.id)"
            >
              <div class="active-sale-checkbox">
                <SvgIcon v-if="selectedSaleId === sale.id" name="check" :width="12" :height="12" />
              </div>
              <div class="active-sale-info">
                <span class="active-sale-qty">
                  {{ sale.quantity }}
                  <span class="qty-unit">{{ batchUnitLabel }}</span>
                </span>
                <span v-if="sale.referenceId" class="active-sale-ref">{{ sale.referenceId }}</span>
              </div>
              <div class="active-sale-date">{{ formatDate(sale.soldAt) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Form Fields (fixed bottom) ── -->
      <div class="batch-form-fields">
        <!-- Movement type -->
        <div class="form-group">
          <label class="field-label">{{ t('warehouse.field_movement_type') }} <span class="required">*</span></label>
          <CustomSelect
            v-model="type"
            :options="availableMovementTypes"
            :placeholder="t('warehouse.movement_modal_type_placeholder')"
            data-test="create-movement-type-select"
          />
          <p v-if="errors.type" class="field-error">{{ errors.type }}</p>
          <p v-if="type && selectedMovementEffect" class="movement-type-effect">
            {{ selectedMovementEffect }}
          </p>
        </div>

        <!-- Selected aggregate quantity (read-only, with unit) — shown when an aggregate type or sale is selected -->
        <div v-if="selectedAggregateType || selectedSaleId" class="form-group">
          <label class="field-label">{{ t('warehouse.field_selected_quantity') }}</label>
          <div class="selected-qty-display" data-test="create-movement-selected-qty">
            <span class="selected-qty-value">{{ selectedAggregateQuantity }}</span>
            <span v-if="batchUnitLabel" class="qty-unit">{{ batchUnitLabel }}</span>
          </div>
          <p class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
        </div>

        <!-- New movement quantity (hidden for correction — user sets new qty directly via the "after" field) -->
        <template v-if="!isCorrection">
          <div class="form-group">
            <label class="field-label">{{ t('warehouse.field_new_movement_quantity') }} <span class="required">*</span></label>
            <input
              v-model.number="quantity"
              type="number"
              min="0"
              :step="quantityStep"
              class="glass-input"
              data-test="create-movement-quantity-input"
              @input="quantityTouched = true"
            />
            <p v-if="quantityError" class="field-error">{{ quantityError }}</p>
          </div>
        </template>

        <!-- Selected aggregate after (read-only; editable for correction) — shown when aggregate/sale selected AND type selected -->
        <div v-if="(selectedAggregateType || selectedSaleId) && type" class="form-group">
          <label class="field-label">
            {{ t('warehouse.field_selected_after') }}
            <span v-if="isCorrection" class="required">*</span>
          </label>
          <input
            v-if="isCorrection"
            v-model.number="quantity"
            type="number"
            min="0"
            :step="quantityStep"
            class="glass-input"
            data-test="create-movement-selected-after"
          />
          <input
            v-else
            :value="selectedAggregateAfter"
            type="number"
            class="glass-input"
            readonly
            data-test="create-movement-selected-after"
          />
          <p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>
          <p v-if="!isCorrection" class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
        </div>

        <!-- Total in stock after (always read-only) — shown when type selected -->
        <div v-if="type" class="form-group">
          <label class="field-label">{{ t('warehouse.field_total_quantity') }}</label>
          <input
            :value="totalInStockAfter"
            type="number"
            class="glass-input"
            readonly
            data-test="create-movement-total-stock-after"
          />
          <p class="field-readonly-hint">{{ t('warehouse.field_readonly_hint') }}</p>
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
            ref="notesTextarea"
            v-model="notes"
            class="glass-input glass-textarea batch-notes-input"
            rows="3"
            data-test="create-movement-notes-input"
            @input="autoResizeNotes"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="saving"
        data-test="create-movement-cancel-btn"
        @click="onCancel"
      >
        {{ t('btn.cancel') }}
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
