<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseBatch } from '@/composables/useWarehouseBatch'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { OffcutStatus } from '@/types/warehouse'
import { getBatch } from '@/services/warehouseService'
import CreateMovementModal from './CreateMovementModal.vue'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'

const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string
const {
  batch, loading, saving, error,
  deleteBlockedByOrder,
  form, isAnythingDirty,
  movements, movementsLoading,
  batchAggregates,
  batchActiveSales,
  offcuts, offcutsLoading,
  auditLog, auditLoading,
  load, save, discard, remove,
  resetDeleteBlocked,
  deleteAuditEntry,
  loadMovements,
  loadBatchAggregates,
  loadBatchActiveSales,
  onFilesUploaded, removeFile,
  tf,
} = useWarehouseBatch(id)

const showDeleteModal = ref(false)

const pageTitle = computed(() =>
  batch.value
    ? t('warehouse.batch_card_title', { batchNumber: batch.value.batchNumber }) + ' — ' + tf(batch.value.productName)
    : t('warehouse.header_title'),
)

// ─── Audit log entry deletion (with confirm modal) ───
const deleteAuditOpen = ref(false)
const auditToDeleteIdx = ref<number | null>(null)
const deletingAudit = ref(false)

function askDeleteAudit(index: number) {
  auditToDeleteIdx.value = index
  deleteAuditOpen.value = true
}

async function confirmDeleteAudit() {
  if (auditToDeleteIdx.value === null || deletingAudit.value) return
  deletingAudit.value = true
  const idx = auditToDeleteIdx.value
  await deleteAuditEntry(idx)
  auditToDeleteIdx.value = null
  deleteAuditOpen.value = false
  deletingAudit.value = false
}

const BATCH_STATUS_PILL: Record<string, string> = {
  available: 'pill-success',
  in_storage: 'pill-info',
  in_production: 'pill-warning',
  sold: 'pill-sold',
  scrapped: 'pill-danger',
  expensed: 'pill-expensed',
  returned_to_supplier: 'pill-returned',
  partial: 'pill-warning',
  depleted: 'pill-consumed',
  reserved: 'pill-info',
  converted_to_offcuts: 'pill-offcut',
}

/** Offcut status pill mapping (mirrors WarehousePage) */
const OFFCUT_STATUS_PILL: Record<OffcutStatus, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  in_production: 'pill-warning',
  sold: 'pill-mint',
  scrapped: 'pill-danger',
  expensed: 'pill-expensed',
  returned_to_supplier: 'pill-returned',
  in_storage: 'pill-info',
}


// ─── Aggregate status cards (reused in CreateMovementModal) ──────────────────

const AGGREGATE_ICONS: Record<string, string> = {
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
  offcut: 'scissors',
}

const AGGREGATE_LABEL_KEYS: Record<string, string> = {
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
  offcut: 'batch_summary_offcut',
}

const AGGREGATE_COLOR_CLASSES: Record<string, string> = {
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
  offcut: 'agg-card-offcut',
}

const HIDDEN_AGGREGATE_TYPES = new Set(['return', 'transfer'])

/** Sorted aggregate entries for display. Sale is always placed last. */
const aggregateEntries = computed(() => {
  if (!batchAggregates.value) return []
  const visible = batchAggregates.value.filter(
    (a) => a.quantity > 0 && !HIDDEN_AGGREGATE_TYPES.has(a.type),
  )
  const sale = visible.find((a) => a.type === 'sale')
  const others = visible.filter((a) => a.type !== 'sale').sort((a, b) => b.quantity - a.quantity)
  const result = others.map((a) => [a.type, a.quantity] as [string, number])
  if (sale) result.push(['sale', sale.quantity])
  return result
})

// ─── Currency selector for unit price ───
const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'PLN']
const currencyOpen = ref(false)

function selectCurrency(c: string) {
  form.value.currency = c
  currencyOpen.value = false
}

function onDocClickCloseCurrency(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.('.input-with-suffix')
  if (!el) currencyOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClickCloseCurrency))
onBeforeUnmount(() => document.removeEventListener('click', onDocClickCloseCurrency))

function onDeleteClick() {
  if (batch.value?.orderId) {
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

// ─── Movement creation modal ──────────────────────────────────────────
const showMovementModal = ref(false)

function openMovementModal() {
  showMovementModal.value = true
}

/** Called after CreateMovementModal emits 'created' — refresh all reactive data */
async function onMovementCreated() {
  showMovementModal.value = false
  try {
    // Fetch fresh batch from store (mockCreateMovement updated quantityRemaining, status,
    // quantity, totalCost on the store object — but our batch.value is an older copy).
    const updated = await getBatch(id)
    if (updated) {
      batch.value = { ...updated }
      // Also sync read-only form fields that may have changed
      form.value.quantity = updated.quantity
      form.value.status = updated.status
    }
    await Promise.all([
      loadMovements(),
      loadBatchAggregates(),
      loadBatchActiveSales(),
    ])
  } catch (e) {
    console.error('Failed to refresh after movement creation', e)
  }
}
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
    <div class="entity-not-found" data-test="batch-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-warehouse', params: { tab: 'batches' } }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-batch-card" data-test="page-batch-card">
      <div v-if="batch" class="batch-card-header" data-test="batch-card-header">
        <Breadcrumb
          :items="[
            { label: t('warehouse.header_title'), to: { name: 'admin-warehouse', params: { tab: 'batches' } } },
            { label: t('warehouse.tab_batches'), to: { name: 'admin-warehouse', params: { tab: 'batches' } } },
            { label: t('warehouse.batch_card_title', { batchNumber: batch.batchNumber }) + ' — ' + tf(batch.productName) },
          ]"
        />
        <div class="batch-card-header-row">
          <div class="batch-card-header-left">
            <h1 class="page-title">
              {{ t('warehouse.batch_card_title', { batchNumber: batch.batchNumber }) }} — {{ tf(batch.productName) }}
              <router-link
                v-tooltip="t('warehouse.open_product_card')"
                :to="{ name: 'admin-product-card', params: { id: batch.productId } }"
                class="action-icon-btn"
                data-test="batch-card-product-link"
              >
                <SvgIcon name="external-link" :width="16" :height="16" />
              </router-link>
            </h1>
            <span class="batch-status-wrapper">
              <span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]" data-test="batch-card-status-pill">
                {{ t(`warehouse.batch_status_${batch.status}`) }}
              </span>
              <span
                v-tooltip="t(`warehouse.batch_status_hint_${batch.status}`)"
                class="info-hint"
                data-test="batch-card-status-hint"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </span>
          </div>
          <div class="entity-action-bar no-margin pos-static" data-test="batch-card-save-bar">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!isAnythingDirty || saving"
              data-test="batch-card-discard-btn"
              @click="discard"
            >
              {{ t('warehouse.btn_discard_changes') }}
            </button>
            <button
              type="button"
              class="btn btn-save"
              :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!isAnythingDirty || saving"
              data-test="batch-card-save-btn"
              @click="save"
            >
              {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="saving"
              data-test="batch-card-add-movement-btn"
              @click="openMovementModal"
            >
              <SvgIcon name="plus-add" :width="14" :height="14" />
              {{ t('warehouse.btn_add_movement') }}
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-danger"
              :disabled="saving"
              data-test="batch-card-delete-btn"
              @click="onDeleteClick"
            >
              <SvgIcon name="trash" :width="16" :height="16" />
              {{ t('warehouse.btn_delete_batch') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Batch Total + Aggregate Status Cards (read-only summary) ── -->
      <div v-if="batch" class="batch-aggregate-cards" data-test="batch-aggregate-cards">
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

        <!-- Aggregate cards (only when there are visible entries) -->
        <div v-if="aggregateEntries.length > 0" class="aggregate-cards">
          <div
            v-for="[movementType, qty] in aggregateEntries"
            :key="movementType"
            class="aggregate-card"
            :class="AGGREGATE_COLOR_CLASSES[movementType] || ''"
            :data-test="'batch-agg-card-' + movementType"
          >
            <div class="agg-icon">
              <SvgIcon :name="AGGREGATE_ICONS[movementType] || 'package'" :width="14" :height="14" />
            </div>
            <div class="agg-info">
              <div class="agg-label">{{ t(`warehouse.${AGGREGATE_LABEL_KEYS[movementType] || 'batch_summary_in_stock'}`) }}</div>
              <div class="agg-value">
                {{ qty }}
                <span class="agg-unit">{{ t(`warehouse.unit_${batch.unit}`) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="batch || loading" class="main-card-content" data-test="batch-card-content">

        <!-- Always-editable form in entity-card-grid layout (matching StockCard pattern) -->
        <div class="entity-card-grid">
          <!-- Left column: batchNumber, lotCode, supplier (readonly), location -->
          <div class="entity-col-left">
            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="batch-card-left-panel">
              <template v-if="batch">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_batch_number') }}</span>
                  <span v-tooltip="t('warehouse.col_batch_number_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  v-model="form.batchNumber"
                  class="glass-input"
                  type="text"
                  data-test="field-batch-number"
                />
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_lot_code') }}</span>
                  <span v-tooltip="t('warehouse.col_lot_code_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  v-model="form.lotCode"
                  class="glass-input"
                  type="text"
                  data-test="field-lot-code"
                />
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_supplier') }}</span>
                  <span v-tooltip="t('warehouse.col_supplier_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="batch.supplierName ? tf(batch.supplierName) : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-supplier"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
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
                  :to="{ name: 'admin-warehouse-stock-card', params: { id: batch.productId } }"
                  class="batch-link-row"
                  data-test="batch-card-stock-link"
                >
                  <span>{{ t('warehouse.open_stock_card') }}</span>
                  <SvgIcon name="external-link" :width="14" :height="14" />
                </router-link>
                <input
                  :value="tf(batch.productName)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-product-name"
                />
                <span class="field-hint">{{ t('warehouse.field_product_hint') }}</span>
              </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Center column: quantity, quantityRemaining (readonly), unitPrice, totalCost (readonly) -->
          <div class="entity-col-center">
            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="batch-card-center-panel">
              <template v-if="batch">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_quantity') }}</span>
                  <span v-tooltip="t('warehouse.col_quantity_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="batch.quantity"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-quantity"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_remaining') }}</span>
                  <span v-tooltip="t('warehouse.col_remaining_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="batch.quantityRemaining"
                  class="glass-input"
                  type="text"
                  readonly
                  :class="{ 'text-danger': batch.quantityRemaining <= 0 }"
                  data-test="field-remaining"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_unit') }}</span>
                  <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="t(`warehouse.unit_${form.unit}`)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-unit"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_unit_price') }}</span>
                  <span v-tooltip="t('warehouse.col_unit_price_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <div class="input-with-suffix custom-select-wrap">
                  <input
                    v-model.number="form.unitPrice"
                    class="glass-input"
                    type="number"
                    min="0"
                    step="0.01"
                    data-test="field-unit-price"
                  />
                  <div
                    class="input-suffix custom-select-trigger"
                    data-test="field-currency-trigger"
                    @click.stop="currencyOpen = !currencyOpen"
                  >
                    <span class="curr-val">{{ form.currency }}</span>
                  </div>
                  <div class="custom-select-list" :class="{ open: currencyOpen }">
                    <div
                      v-for="c in CURRENCY_OPTIONS"
                      :key="c"
                      class="custom-select-option"
                      data-test="field-currency-option"
                      :data-currency="c"
                      @click="selectCurrency(c)"
                    >
                      {{ c }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_total_cost') }}</span>
                  <span v-tooltip="t('warehouse.field_total_cost_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="`${batch.totalCost.toFixed(2)} ${form.currency}`"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-total-cost"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Right column: receivedAt (readonly), expiresAt (readonly), certificateRef, status, notes -->
          <div class="entity-col-right">
            <GlassPanel :loading="loading" :skeleton-rows="5" data-test="batch-card-right-panel">
              <template v-if="batch">
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.col_received') }}</span>
                  <span v-tooltip="t('warehouse.col_received_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="batch.receivedAt.slice(0, 10)"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-received-at"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_expires_at') }}</span>
                  <span v-tooltip="t('warehouse.field_expires_at_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  :value="batch.expiresAt ? batch.expiresAt.slice(0, 10) : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-expires-at"
                />
                <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
              </div>
              <div class="input-group">
                <label class="field-label">
                  <span>{{ t('warehouse.field_certificate') }}</span>
                  <span v-tooltip="t('warehouse.field_certificate_hint')" class="info-hint">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                </label>
                <input
                  v-model="form.certificateRef"
                  class="glass-input"
                  type="text"
                  data-test="field-certificate-ref"
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
                <div class="glass-input" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px;">
                  <span class="pill" :class="BATCH_STATUS_PILL[batch.status]" data-test="field-status-pill">
                    {{ t(`warehouse.batch_status_${batch.status}`) }}
                  </span>
                  <span class="field-hint" style="margin: 0;">{{ t('warehouse.hint_readonly') }}</span>
                </div>
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

        <!-- FULL WIDTH: Location section -->
        <GlassPanel :title="t('warehouse.section_batch_location')" data-test="batch-card-location-section">
          <template v-if="batch">
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
        <GlassPanel :title="t('warehouse.section_batch_movements')" data-test="batch-card-movements-section">
          <div v-if="movementsLoading" class="text-muted" style="padding: 12px 0;">
            {{ t('warehouse.loading') }}...
          </div>
          <div v-else-if="movements.length" class="table-responsive">
            <table class="data-table" data-test="batch-card-movements-table">
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
                <tr v-for="movement in movements" :key="movement.id" data-test="batch-card-movements-row">
                  <td>{{ movement.movedAt.slice(0, 10) }}</td>
                  <td>{{ t(`warehouse.movement_type_${movement.type}`) }}</td>
                  <td>{{ movement.quantity }} {{ t(`warehouse.unit_${movement.unit}`) }}</td>
                  <td>{{ movement.referenceId ?? '—' }}</td>
                  <td style="text-align: center">
                    <router-link
                      v-tooltip="t('warehouse.open_movement_card')"
                      :to="{ name: 'admin-warehouse-movement', params: { id: movement.id } }"
                      class="action-icon-btn"
                      data-test="batch-card-movement-link"
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

        <!-- FULL WIDTH: Offcuts section -->
        <GlassPanel data-test="batch-card-offcuts-section">
          <template #header>
            <span class="panel-title">{{ t('warehouse.section_batch_offcuts') }}</span>
            <router-link
              v-if="batch"
              v-tooltip="t('warehouse.create_offcut_for_batch')"
              :to="{
                name: 'admin-warehouse-offcut-create',
                query: { batchId: batch.id, productId: batch.productId }
              }"
              class="btn btn-sm btn-primary"
              style="margin-left: auto;"
              data-test="batch-card-create-offcut-link"
            >
              <SvgIcon name="plus-add" :width="14" :height="14" />
              {{ t('warehouse.btn_new_offcut') }}
            </router-link>
          </template>
          <div v-if="offcutsLoading" class="text-muted" style="padding: 12px 0;">
            {{ t('warehouse.loading') }}...
          </div>
          <div v-else-if="offcuts.length" class="table-responsive">
            <table class="data-table" data-test="batch-card-offcuts-table">
              <thead>
                <tr>
                  <th>{{ t('warehouse.col_dimensions') }}</th>
                  <th>{{ t('warehouse.col_weight') }}</th>
                  <th>{{ t('warehouse.col_quantity') }}</th>
                  <th>{{ t('warehouse.col_status') }}</th>
                  <th>{{ t('warehouse.col_location') }}</th>
                  <th style="width: 48px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="offcut in offcuts" :key="offcut.id" data-test="batch-card-offcuts-row">
                  <td>
                    <template v-if="offcut.lengthMm && offcut.widthMm">
                      {{ offcut.lengthMm }} × {{ offcut.widthMm }} мм
                    </template>
                    <span v-else>—</span>
                  </td>
                  <td>{{ offcut.weightKg ?? '—' }} кг</td>
                  <td>{{ offcut.quantity }} {{ t(`warehouse.unit_${offcut.unit}`) }}</td>
                  <td>
                    <span class="pill pill-sm" :class="OFFCUT_STATUS_PILL[offcut.status] || 'pill-secondary'">
                      {{ t(`warehouse.offcut_status_${offcut.status}`) }}
                    </span>
                  </td>
                  <td>{{ offcut.location ?? '—' }}</td>
                  <td style="text-align: center">
                    <router-link
                      v-tooltip="t('warehouse.open_offcut_card')"
                      :to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"
                      class="action-icon-btn"
                      data-test="batch-card-offcut-link"
                    >
                      <SvgIcon name="external-link" :width="16" :height="16" />
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-muted" style="padding: 12px 0;">{{ t('warehouse.empty_offcuts') }}</p>
        </GlassPanel>

        <!-- FULL WIDTH: Files section -->
        <GlassPanel :title="t('warehouse.section_batch_files')" data-test="batch-card-files-section">
          <template v-if="batch">
            <div class="file-list" data-test="batch-card-file-list" style="margin-bottom: 15px">
              <FileItem
                v-for="f in batch.files"
                :key="f.id"
                :name="tf(f.name)"
                download-url="#"
                data-test="batch-card-file-item"
                @delete="removeFile(f.id)"
              />
            </div>
            <DropZone
              data-test="batch-card-file-dropzone"
              :hint="t('warehouse.dropzone_hint')"
              :multiple="true"
              @uploaded="onFilesUploaded"
            />
          </template>
        </GlassPanel>

        <!-- Audit section -->
        <div class="audit-panel-wide" data-test="batch-card-audit">
          <GlassPanel :title="t('warehouse.section_batch_audit')">
            <div v-if="auditLoading" class="text-muted" style="padding: 12px 0;">
              {{ t('warehouse.loading') }}...
            </div>
            <div v-else class="table-responsive">
              <table class="audit-log-table" data-test="batch-card-audit-table">
                <thead>
                  <tr>
                    <th>{{ t('warehouse.audit_col_date') }}</th>
                    <th>{{ t('warehouse.audit_col_user') }}</th>
                    <th>{{ t('warehouse.audit_col_property') }}</th>
                    <th>{{ t('warehouse.audit_col_old_value') }}</th>
                    <th>{{ t('warehouse.audit_col_new_value') }}</th>
                    <th style="width: 40px" />
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(a, i) in auditLog" :key="i" data-test="batch-card-audit-row">
                    <td class="audit-log-ts">{{ a.timestamp }}</td>
                    <td>
                      <div class="audit-log-user">
                        <div class="audit-log-avatar">{{ a.userInitials }}</div>
                        <span>{{ tf(a.user) }}</span>
                      </div>
                    </td>
                    <td>{{ tf(a.property) }}</td>
                    <td>
                      <span class="audit-diff-old">{{ translateAuditValue(a.oldValue) }}</span>
                    </td>
                    <td>
                      <span class="audit-diff-new">{{ translateAuditValue(a.newValue) }}</span>
                    </td>
                    <td style="text-align: right">
                      <button
                        v-tooltip="t('btn.delete')"
                        type="button"
                        class="action-icon-btn action-danger"
                        data-test="batch-card-audit-delete-btn"
                        @click="askDeleteAudit(i)"
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
            </div>
            <p v-if="!auditLoading && !auditLog.length" class="text-muted" style="padding: 12px 0;">{{ t('warehouse.no_audit_entries') }}</p>
          </GlassPanel>
        </div>

      </div>

    <!-- Movement creation modal (enhanced with batch summary) -->
    <CreateMovementModal
      :show="showMovementModal"
      :batch="batch"
      :movements="movements"
      :aggregates="batchAggregates"
      :active-sales="batchActiveSales"
      @close="showMovementModal = false"
      @created="onMovementCreated"
    />

    <!-- Delete confirmation modal -->
    <AppModal
      v-model="showDeleteModal"
      :title="t('warehouse.delete_title')"
      size="small"
      data-test="batch-card-delete-modal"
    >
      <p>{{ t('warehouse.confirm_delete_batch') }}</p>
      <div v-if="offcuts.length > 0 || movements.length > 0" class="cascade-warnings">
        <span v-if="offcuts.length > 0" class="cascade-warning">
          {{ t('warehouse.delete_batch_cascade_offcuts', { count: offcuts.length }) }}
        </span>
        <span v-if="movements.length > 0" class="cascade-warning">
          {{ t('warehouse.delete_batch_cascade_movements', { count: movements.length }) }}
        </span>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="batch-card-delete-modal-cancel"
          @click="showDeleteModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="saving"
          data-test="batch-card-delete-modal-confirm"
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
      data-test="batch-card-delete-blocked-modal"
    >
      <p>{{ t('warehouse.delete_blocked_by_order_message') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-primary"
          data-test="batch-card-delete-blocked-ok"
          @click="onDeleteBlockedOk"
        >
          {{ t('warehouse.delete_blocked_ok') }}
        </button>
      </template>
    </AppModal>

    <!-- Audit delete confirmation modal -->
    <AppModal
      v-model="deleteAuditOpen"
      :title="t('modal.confirm_delete')"
      size="small"
      data-test="batch-card-audit-modal"
    >
      <p>{{ t('modal.delete_audit_warning') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="batch-card-audit-modal-cancel"
          @click="deleteAuditOpen = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="batch-card-audit-modal-confirm"
          @click="confirmDeleteAudit"
        >
          {{ t('btn.delete') }}
        </button>
      </template>
    </AppModal>
    </div>
  </template>
</template>
