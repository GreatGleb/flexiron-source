<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseDeficitCard } from '@/composables/useWarehouseDeficitCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import type { DeficitPriority, DeficitStatus } from '@/types/warehouse'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'

const DEFICIT_PRIORITIES: Array<DeficitPriority> = [
  'critical',
  'high',
  'medium',
  'low',
]

const DEFICIT_STATUSES: Array<DeficitStatus> = [
  'open',
  'in_progress',
  'ordered',
  'resolved',
  'cancelled',
]

const priorityOptions = computed<SelectOption[]>(() =>
  DEFICIT_PRIORITIES.map((p) => ({
    value: p,
    label: t(`warehouse.deficit_priority_${p}`),
  })),
)

const statusOptions = computed<SelectOption[]>(() =>
  DEFICIT_STATUSES.map((s) => ({
    value: s,
    label: t(`warehouse.deficit_status_${s}`),
  })),
)

const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string
const {
  deficit, loading, saving, error,
  form, isAnythingDirty,
  load, save, discard, remove,
  tf,
  auditLog, auditLoading, deleteAuditEntry,
} = useWarehouseDeficitCard(id)

const showAuditDeleteModal = ref(false)
const auditDeleteIndex = ref<number | null>(null)
const deletingAudit = ref(false)

const pageTitle = computed(() =>
  deficit.value
    ? t('warehouse.deficit_card_title', { id: deficit.value.id, productName: tf(deficit.value.productName) })
    : t('warehouse.header_title'),
)

const DEFICIT_PRIORITY_PILL: Record<string, string> = {
  critical: 'pill-danger',
  high: 'pill-warning',
  medium: 'pill-info',
  low: 'pill-muted',
}

const DEFICIT_STATUS_PILL: Record<string, string> = {
  open: 'pill-warning',
  in_progress: 'pill-info',
  ordered: 'pill-mint',
  resolved: 'pill-success',
  cancelled: 'pill-danger',
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

function onDeleteConfirm() {
  showDeleteModal.value = false
  remove()
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
    <div class="entity-not-found" data-test="deficit-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-warehouse', params: { tab: 'deficit' } }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-deficit-card" data-test="deficit-card-page">
      <div v-if="deficit" class="deficit-card-header" data-test="deficit-card-header">
        <Breadcrumb
          :items="[
            { label: t('warehouse.header_title'), to: { name: 'admin-warehouse', params: { tab: 'deficit' } } },
            { label: t('warehouse.tab_deficit'), to: { name: 'admin-warehouse', params: { tab: 'deficit' } } },
            { label: t('warehouse.deficit_card_title', { id: deficit?.id ?? id, productName: deficit ? tf(deficit.productName) : '' }) },
          ]"
        />
        <div class="deficit-card-header-row">
          <h1 class="page-title">
            {{ t('warehouse.deficit_card_title', { id: deficit?.id ?? id, productName: deficit ? tf(deficit.productName) : '' }) }}
            <router-link
              v-tooltip="t('warehouse.open_product_card')"
              :to="{ name: 'admin-product-card', params: { id: deficit.productId } }"
              class="action-icon-btn"
              data-test="deficit-card-product-link"
            >
              <SvgIcon name="external-link" :width="16" :height="16" />
            </router-link>
          </h1>
          <div class="deficit-card-pills">
            <span
              v-if="deficit"
              :class="['pill', DEFICIT_PRIORITY_PILL[deficit.priority] ?? 'pill-muted']"
              data-test="deficit-card-priority-pill"
            >
              {{ t(`warehouse.deficit_priority_${deficit.priority}`) }}
              <span
                v-tooltip="t(`warehouse.deficit_priority_hint_${deficit.priority}`)"
                class="info-hint"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </span>
            <span
              v-if="deficit"
              :class="['pill', DEFICIT_STATUS_PILL[deficit.status] ?? 'pill-muted']"
              data-test="deficit-card-status-pill"
            >
              {{ t(`warehouse.deficit_status_${deficit.status}`) }}
              <span
                v-tooltip="t(`warehouse.deficit_status_hint_${deficit.status}`)"
                class="info-hint"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </span>
          </div>
          <div class="entity-action-bar no-margin pos-static" data-test="deficit-card-save-bar">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!isAnythingDirty || saving"
              data-test="deficit-card-discard-btn"
              @click="discard"
            >
              {{ t('warehouse.btn_discard_changes') }}
            </button>
            <button
              type="button"
              class="btn btn-save"
              :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!isAnythingDirty || saving"
              data-test="deficit-card-save-btn"
              @click="save"
            >
              {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-danger"
              :disabled="saving"
              data-test="deficit-card-delete-btn"
              @click="showDeleteModal = true"
            >
              <SvgIcon name="trash" :width="16" :height="16" />
              {{ t('warehouse.btn_delete_deficit') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="deficit || loading" class="main-card-content" data-test="deficit-card-content">
        <!-- Always-editable entity-card-grid with 3 columns (StockCard pattern) -->
        <div class="entity-card-grid">
          <!-- Left column: productName, currentStock, deficitAmount (readonly) -->
          <div class="entity-col-left">
            <GlassPanel :loading="loading" :skeleton-rows="3" data-test="deficit-card-left-panel">
              <template v-if="deficit">
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
                  :value="tf(deficit.productName)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-product-name"
                />
                <span class="field-hint">{{ t('warehouse.field_product_hint') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_stock') }}</span>
                  <span v-tooltip="t('warehouse.col_stock_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <router-link
                  :to="{ name: 'admin-warehouse-stock-card', params: { id: deficit.productId } }"
                  class="batch-link-row"
                  data-test="deficit-card-stock-link"
                >
                  <span>{{ t('warehouse.open_stock_card') }}</span>
                  <SvgIcon name="external-link" :width="14" :height="14" />
                </router-link>
                <input
                  :value="tf(deficit.productName)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-stock-product-name"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_current_stock') }}</span>
                  <span v-tooltip="t('warehouse.col_current_stock_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="`${deficit.currentStock} ${t(`warehouse.unit_${deficit.unit}`)}`"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-current-stock"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_deficit_amount') }}</span>
                  <span v-tooltip="t('warehouse.col_deficit_amount_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="`${deficit.deficitAmount} ${t(`warehouse.unit_${deficit.unit}`)}`"
                  class="glass-input text-danger"
                  type="text"
                  readonly
                  data-test="field-deficit-amount"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Center column: minRequired (editable), suggestedOrderQty, purchaseOrderId (readonly) -->
          <div class="entity-col-center">
            <GlassPanel :loading="loading" :skeleton-rows="3" data-test="deficit-card-center-panel">
              <template v-if="deficit">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_min_required') }}</span>
                  <span v-tooltip="t('warehouse.col_min_required_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="deficit.minRequired"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-min-required"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_suggested_order_qty') }}</span>
                  <span v-tooltip="t('warehouse.col_suggested_order_qty_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="deficit.suggestedOrderQty != null ? `${deficit.suggestedOrderQty} ${t(`warehouse.unit_${deficit.unit}`)}` : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-suggested-order-qty"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_purchase_order') }}</span>
                  <span v-tooltip="t('warehouse.col_purchase_order_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="deficit.purchaseOrderId ?? '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-purchase-order"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Right column: priority (select), status (select), notes (textarea) -->
          <div class="entity-col-right">
            <GlassPanel :loading="loading" :skeleton-rows="3" data-test="deficit-card-right-panel">
              <template v-if="deficit">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_priority') }}</span>
                  <span v-tooltip="t('warehouse.col_priority_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <CustomSelect
                  v-model="form.priority"
                  :options="priorityOptions"
                  data-test="field-priority"
                />
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
                  <span v-tooltip="t('warehouse.field_notes_hint')" class="info-hint">
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

        <!-- Audit section -->
        <div class="audit-panel-wide" data-test="deficit-card-audit-section">
          <GlassPanel :title="t('warehouse.section_batch_audit')">
            <template v-if="auditLoading">
              <p class="text-muted">{{ t('warehouse.loading') }}</p>
            </template>
            <template v-else-if="auditLog.length === 0">
              <p class="text-muted">{{ t('warehouse.no_audit_entries') }}</p>
            </template>
            <template v-else>
              <table class="audit-log-table" data-test="deficit-card-audit-table">
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
                  <tr v-for="(entry, index) in auditLog" :key="index" data-test="deficit-card-audit-row">
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
                        data-test="deficit-card-audit-delete-btn"
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
        data-test="deficit-card-delete-modal"
      >
        <p>{{ t('warehouse.confirm_delete_deficit') }}</p>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            data-test="deficit-card-delete-modal-cancel"
            @click="showDeleteModal = false"
          >
            {{ t('btn.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            :disabled="saving"
            data-test="deficit-card-delete-modal-confirm"
            @click="onDeleteConfirm"
          >
            {{ saving ? t('btn.delete') + '...' : t('btn.delete') }}
          </button>
        </template>
      </AppModal>

      <!-- Audit delete confirmation modal -->
      <AppModal
        v-model="showAuditDeleteModal"
        :title="t('modal.confirm_delete')"
        size="small"
        data-test="deficit-card-audit-delete-modal"
      >
        <p>{{ t('modal.delete_audit_warning') }}</p>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            data-test="deficit-card-audit-modal-cancel"
            @click="showAuditDeleteModal = false"
          >
            {{ t('btn.cancel') }}
          </button>
          <button
            class="btn btn-danger"
            data-test="deficit-card-audit-modal-confirm"
            @click="onAuditDeleteConfirm"
          >
            {{ t('btn.delete') }}
          </button>
        </template>
      </AppModal>
    </div>
  </template>
</template>
