<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseOffcutCard } from '@/composables/useWarehouseOffcutCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import type { OffcutStatus } from '@/types/warehouse'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'

const OFFCUT_STATUSES: Array<OffcutStatus> = [
  'available',
  'reserved',
  'in_production',
  'sold',
  'scrapped',
  'expensed',
  'returned_to_supplier',
  'in_storage',
]

const statusOptions = computed<SelectOption[]>(() =>
  OFFCUT_STATUSES.map((s) => ({
    value: s,
    label: t(`warehouse.offcut_status_${s}`),
  })),
)

const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string
const {
  offcut, loading, saving, error,
  deleteBlockedByOrder,
  form, isAnythingDirty,
  movements, movementsLoading,
  load, save, discard, remove,
  resetDeleteBlocked,
  tf,
  onFilesUploaded,
  removeFile,
  auditLog, auditLoading, deleteAuditEntry,
} = useWarehouseOffcutCard(id)

const showAuditDeleteModal = ref(false)
const auditDeleteIndex = ref<number | null>(null)
const deletingAudit = ref(false)

const pageTitle = computed(() =>
  offcut.value
    ? t('warehouse.offcut_card_title', { id: offcut.value.id, productName: tf(offcut.value.productName) })
    : t('warehouse.header_title'),
)

const OFFCUT_STATUS_PILL: Record<string, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  in_production: 'pill-warning',
  sold: 'pill-mint',
  scrapped: 'pill-danger',
  expensed: 'pill-expensed',
  returned_to_supplier: 'pill-returned',
  in_storage: 'pill-info',
}

function onAuditDeleteClick(index: number) {
  auditDeleteIndex.value = index
  showAuditDeleteModal.value = true
}

async function onAuditDeleteConfirm() {
  if (auditDeleteIndex.value === null || deletingAudit.value) return
  deletingAudit.value = true
  await deleteAuditEntry(auditDeleteIndex.value)
  showAuditDeleteModal.value = false
  auditDeleteIndex.value = null
  deletingAudit.value = false
}

const showDeleteModal = ref(false)

function onDeleteClick() {
  if (offcut.value?.orderId) {
    deleteBlockedByOrder.value = true
  } else {
    showDeleteModal.value = true
  }
}

function onDeleteConfirm() {
  showDeleteModal.value = false
  remove()
}

function onDeleteBlockedOk() {
  resetDeleteBlocked()
}

/**
 * Known enum-like codes that may appear in audit oldValue/newValue.
 * Each entry maps a code prefix to the set of known values for that prefix.
 * The function tries each prefix; if the value is found in the set, it
 * returns the translated label via t(`warehouse.${prefix}${value}`).
 * If no prefix matches, the raw value is returned unchanged.
 */
const AUDIT_ENUM_MAP: Record<string, string[]> = {
  deficit_status_: ['open', 'in_progress', 'ordered', 'resolved', 'cancelled'],
  deficit_priority_: ['low', 'medium', 'high', 'critical'],
  offcut_status_: ['available', 'reserved', 'in_production', 'sold', 'scrapped', 'expensed', 'returned_to_supplier', 'in_storage'],
  movement_type_: ['receipt', 'expense', 'transfer', 'write_off', 'return', 'inbound', 'outbound'],
  batch_status_: ['active', 'completed', 'expired', 'archived', 'partial', 'available', 'reserved', 'depleted', 'quarantine'],
  status_: ['available', 'reserved', 'partial', 'depleted', 'quarantine', 'used', 'scrap', 'open', 'in_progress', 'ordered', 'resolved', 'cancelled'],
}

function translateAuditValue(value: string): string {
  for (const [prefix, codes] of Object.entries(AUDIT_ENUM_MAP)) {
    if (codes.includes(value)) {
      const translated = t(`warehouse.${prefix}${value}`)
      if (translated && translated !== `warehouse.${prefix}${value}`) {
        return translated
      }
    }
  }
  return value
}

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => pageTitle.value,
})

onMounted(load)

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

watch(() => form.value.notes, () => {
  nextTick(autoResizeNotes)
})
</script>

<template>
  <!-- Error / Not found state (like ProductCardPage) -->
  <template v-if="error">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found" data-test="offcut-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-warehouse', params: { tab: 'offcuts' } }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-offcut-card" data-test="offcut-card-page">
      <div v-if="offcut" class="offcut-card-header" data-test="offcut-card-header">
        <Breadcrumb
          :items="[
            { label: t('warehouse.header_title'), to: { name: 'admin-warehouse', params: { tab: 'offcuts' } } },
            { label: t('warehouse.tab_offcuts'), to: { name: 'admin-warehouse', params: { tab: 'offcuts' } } },
            { label: t('warehouse.offcut_card_title', { id: offcut?.id ?? id, productName: offcut ? tf(offcut.productName) : '' }) },
          ]"
        />
        <div class="offcut-card-header-row">
          <h1 class="page-title">
            {{ t('warehouse.offcut_card_title', { id: offcut?.id ?? id, productName: offcut ? tf(offcut.productName) : '' }) }}
            <router-link
              v-tooltip="t('warehouse.open_product_card')"
              :to="{ name: 'admin-product-card', params: { id: offcut.productId } }"
              class="action-icon-btn"
              data-test="offcut-card-product-link"
            >
              <SvgIcon name="external-link" :width="16" :height="16" />
            </router-link>
          </h1>
          <span v-if="offcut" class="offcut-status-wrapper">
            <span
              :class="['pill', OFFCUT_STATUS_PILL[offcut.status] ?? 'pill-muted']"
              data-test="offcut-card-status-pill"
            >
              {{ t(`warehouse.offcut_status_${offcut.status}`) }}
            </span>
            <span
              v-tooltip="t(`warehouse.offcut_status_hint_${offcut.status}`)"
              class="info-hint"
              data-test="offcut-card-status-hint"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
          </span>
          <div class="entity-action-bar no-margin pos-static" data-test="offcut-card-save-bar">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!isAnythingDirty || saving"
              data-test="offcut-card-discard-btn"
              @click="discard"
            >
              {{ t('warehouse.btn_discard_changes') }}
            </button>
            <button
              type="button"
              class="btn btn-save"
              :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!isAnythingDirty || saving"
              data-test="offcut-card-save-btn"
              @click="save"
            >
              {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-danger"
              :disabled="saving"
              data-test="offcut-card-delete-btn"
              @click="onDeleteClick"
            >
              <SvgIcon name="trash" :width="16" :height="16" />
              {{ t('warehouse.btn_delete_offcut') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="offcut || loading" class="main-card-content" data-test="offcut-card-content">
        <!-- Always-editable form in entity-card-grid layout (matching StockCard pattern) -->
        <div class="entity-card-grid">
          <!-- Left column: batchNumber (link), productName (readonly), offcutType (readonly) -->
          <div class="entity-col-left">
            <GlassPanel :loading="loading" :skeleton-rows="3" data-test="offcut-card-left-panel">
              <template v-if="offcut">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_batch') }}</span>
                  <span v-tooltip="t('warehouse.col_offcut_batch_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <router-link
                  :to="{ name: 'admin-warehouse-batch', params: { id: offcut.batchId } }"
                  class="batch-link-row"
                  data-test="field-batch-link"
                >
                  <span>{{ t('warehouse.open_batch_card') }}</span>
                  <SvgIcon name="external-link" :width="14" :height="14" />
                </router-link>
                <input
                  :value="offcut.batchNumber"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-batch-number"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_product') }}</span>
                  <span v-tooltip="t('warehouse.col_product_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="tf(offcut.productName)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-product-name"
                />
                <span class="field-hint">{{ t('warehouse.field_product_hint') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_offcut_type') }}</span>
                  <span v-tooltip="t('warehouse.col_offcut_type_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="t(`warehouse.offcut_type_${offcut.offcutType}`)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-offcut-type"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Center column: dimensions (length, width, thickness, weight) - all readonly -->
          <div class="entity-col-center">
            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="offcut-card-center-panel">
              <template v-if="offcut">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_length') }}</span>
                  <span v-tooltip="t('warehouse.col_length_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="offcut.lengthMm != null ? `${offcut.lengthMm} mm` : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-length"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_width') }}</span>
                  <span v-tooltip="t('warehouse.col_width_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="offcut.widthMm != null ? `${offcut.widthMm} mm` : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-width"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_thickness') }}</span>
                  <span v-tooltip="t('warehouse.col_thickness_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="offcut.thicknessMm != null ? `${offcut.thicknessMm} mm` : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-thickness"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_weight') }}</span>
                  <span v-tooltip="t('warehouse.col_weight_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="offcut.weightKg != null ? `${offcut.weightKg} kg` : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-weight"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Right column: quantity (readonly), location, status, notes -->
          <div class="entity-col-right">
            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="offcut-card-right-panel">
              <template v-if="offcut">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_quantity') }}</span>
                  <span v-tooltip="t('warehouse.offcut_col_quantity_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="`${offcut.quantity} ${t(`warehouse.unit_${offcut.unit}`)}`"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-quantity"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_status') }}</span>
                  <span v-tooltip="t('warehouse.col_status_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <CustomSelect
                  v-model="form.status"
                  :options="statusOptions"
                  data-test="field-status"
                />
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_notes') }}</span>
                  <span v-tooltip="t('warehouse.offcut_field_notes_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <textarea
                  ref="notesTextarea"
                  v-model="form.notes"
                  class="glass-input batch-notes-input"
                  data-test="field-notes"
                  @input="autoResizeNotes"
                />
              </div>
              </template>
            </GlassPanel>
          </div>
        </div>

        <!-- FULL WIDTH: Location section -->
        <GlassPanel :title="t('warehouse.section_batch_location')" data-test="offcut-card-location-section">
          <template v-if="offcut">
            <div class="location-grid">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_location_rack') }}</span>
                  <span v-tooltip="t('warehouse.field_location_rack_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  v-model="form.locationRack"
                  class="glass-input"
                  type="text"
                  data-test="field-location-rack"
                />
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_location_row') }}</span>
                  <span v-tooltip="t('warehouse.field_location_row_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  v-model="form.locationRow"
                  class="glass-input"
                  type="text"
                  data-test="field-location-row"
                />
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_location_cell') }}</span>
                  <span v-tooltip="t('warehouse.field_location_cell_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  v-model="form.locationCell"
                  class="glass-input"
                  type="text"
                  data-test="field-location-cell"
                />
              </div>
            </div>
            <div class="input-group" style="margin-top: 12px;">
              <label class="field-label">
                <span>{{ t('warehouse.field_location_notes') }}</span>
                <span v-tooltip="t('warehouse.field_location_notes_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <textarea
                v-model="form.locationNotes"
                class="glass-input"
                data-test="field-location-notes"
              />
            </div>
          </template>
        </GlassPanel>

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

        <!-- FULL WIDTH: Files section -->
        <GlassPanel :title="t('warehouse.section_batch_files')" data-test="offcut-card-files-section">
          <template v-if="offcut">
            <div class="file-list" data-test="offcut-card-file-list" style="margin-bottom: 15px">
              <FileItem
                v-for="f in offcut.files"
                :key="f.id"
                :name="tf(f.name)"
                download-url="#"
                data-test="offcut-card-file-item"
                @delete="removeFile(f.id)"
              />
            </div>
            <DropZone
              data-test="offcut-card-file-dropzone"
              :hint="t('warehouse.dropzone_hint')"
              :multiple="true"
              @uploaded="onFilesUploaded"
            />
          </template>
        </GlassPanel>

        <!-- Audit section -->
        <div class="audit-panel-wide" data-test="offcut-card-audit-section">
          <GlassPanel :title="t('warehouse.section_batch_audit')">
            <template v-if="auditLoading">
              <p class="text-muted">{{ t('warehouse.loading') }}</p>
            </template>
            <template v-else-if="auditLog.length === 0">
              <p class="text-muted">{{ t('warehouse.no_audit_entries') }}</p>
            </template>
            <template v-else>
              <table class="audit-log-table" data-test="offcut-card-audit-table">
                <thead>
                  <tr>
                    <th>{{ t('warehouse.audit_col_date') }}</th>
                    <th>{{ t('warehouse.audit_col_user') }}</th>
                    <th>{{ t('warehouse.audit_col_property') }}</th>
                    <th>{{ t('warehouse.audit_col_old_value') }}</th>
                    <th>{{ t('warehouse.audit_col_new_value') }}</th>
                    <th class="audit-col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(entry, index) in auditLog" :key="index" data-test="offcut-card-audit-row">
                    <td class="audit-log-ts">{{ entry.timestamp }}</td>
                    <td>
                      <div class="audit-log-user">
                        <div class="audit-log-avatar">{{ entry.userInitials }}</div>
                        <span>{{ tf(entry.user) }}</span>
                      </div>
                    </td>
                    <td>{{ tf(entry.property) }}</td>
                    <td>
                      <span class="audit-diff-old">{{ translateAuditValue(entry.oldValue) }}</span>
                    </td>
                    <td>
                      <span class="audit-diff-new">{{ translateAuditValue(entry.newValue) }}</span>
                    </td>
                    <td style="text-align: right">
                      <button
                        v-tooltip="t('btn.delete')"
                        type="button"
                        class="action-icon-btn action-danger"
                        data-test="offcut-card-audit-delete-btn"
                        @click="onAuditDeleteClick(index)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </GlassPanel>
        </div>

      </div>

      <!-- Delete confirmation modal -->
      <AppModal
        v-model="showDeleteModal"
        :title="t('warehouse.delete_title')"
        size="small"
        data-test="offcut-card-delete-modal"
      >
        <p>{{ t('warehouse.confirm_delete_offcut') }}</p>
        <div class="cascade-warnings">
          <span class="cascade-warning">{{ t('warehouse.delete_offcut_cascade_warning') }}</span>
        </div>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            data-test="offcut-card-delete-modal-cancel"
            @click="showDeleteModal = false"
          >
            {{ t('btn.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="saving"
            data-test="offcut-card-delete-modal-confirm"
            @click="onDeleteConfirm"
          >
            {{ saving ? t('btn.delete') + '...' : t('btn.delete') }}
          </button>
        </template>
      </AppModal>

      <!-- Delete blocked by order modal -->
      <AppModal
        v-model="deleteBlockedByOrder"
        :title="t('warehouse.delete_blocked_by_order_title')"
        size="small"
        data-test="offcut-card-delete-blocked-modal"
      >
        <p>{{ t('warehouse.delete_blocked_by_order_message') }}</p>
        <template #footer>
          <button
            type="button"
            class="btn btn-primary"
            data-test="offcut-card-delete-blocked-ok"
            @click="onDeleteBlockedOk"
          >
            {{ t('warehouse.delete_blocked_ok') }}
          </button>
        </template>
      </AppModal>

      <!-- Audit delete confirmation modal -->
      <AppModal
        v-model="showAuditDeleteModal"
        :title="t('modal.confirm_delete')"
        size="small"
        data-test="offcut-card-audit-delete-modal"
      >
        <p>{{ t('modal.delete_audit_warning') }}</p>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            data-test="offcut-card-audit-modal-cancel"
            @click="showAuditDeleteModal = false"
          >
            {{ t('btn.cancel') }}
          </button>
          <button
            class="btn btn-danger"
            data-test="offcut-card-audit-modal-confirm"
            @click="onAuditDeleteConfirm"
          >
            {{ t('btn.delete') }}
          </button>
        </template>
      </AppModal>
    </div>
  </template>
</template>
