<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseStockCard } from '@/composables/useWarehouseStockCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import type { BatchStatusAggregate } from '@/types/warehouse'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'

const { t } = useI18n()
const route = useRoute()
const productId = route.params.id as string

const {
  item, loading, saving, error,
  form, formName, formCategoryName, isAnythingDirty,
  stockAggregates, stockAggregatesLoading, totalUsableQuantity,
  auditLog, deleteAuditEntry,
  load, save, discard,
  tf,
} = useWarehouseStockCard(productId)

// ─── Aggregate status cards (reused pattern from WarehouseBatchCard) ─────

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

/** In stock card, only show usable aggregates: in stock, storage, offcuts */
const HIDDEN_AGGREGATE_TYPES = new Set([
  'return', 'transfer',
  'sale', 'write-off', 'production', 'expense', 'return-to-supplier', 'correction',
])

/** Sorted aggregate entries for display. Sale is always placed last. */
const aggregateEntries = computed(() => {
  if (!stockAggregates.value) return []
  const visible = (stockAggregates.value as BatchStatusAggregate[]).filter(
    (a) => a.quantity > 0 && !HIDDEN_AGGREGATE_TYPES.has(a.type),
  )
  const sale = visible.find((a) => a.type === 'sale')
  const others = visible.filter((a) => a.type !== 'sale').sort((a, b) => b.quantity - a.quantity)
  const result = others.map((a) => [a.type, a.quantity] as [string, number])
  if (sale) result.push(['sale', sale.quantity])
  return result
})

/** Step for quantity inputs: 1 for pcs, 0.01 for others */
const quantityStep = computed(() => form.value.unit === 'pcs' ? 1 : 0.01)

const pageTitle = computed(() =>
  item.value
    ? t('warehouse.stock_card_title', { id: productId, productName: tf(item.value.productName) })
    : t('warehouse.header_title'),
)

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => pageTitle.value,
})

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

onMounted(load)
</script>

<template>
  <!-- Error / Not found state (like ProductCardPage) -->
  <template v-if="error">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse', params: { tab: 'stock' } } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found" data-test="stock-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id: productId }) }}</p>
      <router-link :to="{ name: 'admin-warehouse', params: { tab: 'stock' } }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-stock-card" data-test="stock-card-page">
      <div v-if="item" class="stock-card-header" data-test="stock-card-header">
        <Breadcrumb
          :items="[
            { label: t('warehouse.header_title'), to: { name: 'admin-warehouse', params: { tab: 'stock' } } },
            { label: t('warehouse.tab_stock'), to: { name: 'admin-warehouse', params: { tab: 'stock' } } },
            { label: t('warehouse.stock_card_title', { id: productId, productName: tf(item.productName) }) },
          ]"
        />
        <div class="stock-card-header-row">
          <h1 class="page-title">
            {{ t('warehouse.stock_card_title', { id: productId, productName: tf(item.productName) }) }}
            <router-link
              v-tooltip="t('warehouse.open_product_card')"
              :to="{ name: 'admin-product-card', params: { id: item.productId } }"
              class="action-icon-btn"
              data-test="stock-card-product-link"
            >
              <SvgIcon name="external-link" :width="16" :height="16" />
            </router-link>
          </h1>
          <span v-if="item.isDeficit" class="pill pill-danger" data-test="stock-card-deficit-badge">
            {{ t('warehouse.deficit_badge') }}
          </span>
          <div class="entity-action-bar no-margin pos-static" data-test="stock-card-save-bar">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!isAnythingDirty || saving"
              @click="discard"
            >
              {{ t('warehouse.btn_discard_changes') }}
            </button>
            <button
              type="button"
              class="btn btn-save"
              :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!isAnythingDirty || saving"
              @click="save"
            >
              {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── Stock Aggregate Cards (summed across all batches) ── -->
      <div v-if="item" class="batch-aggregate-cards" data-test="stock-aggregate-cards">
        <!-- Total stock quantity -->
        <div class="batch-total-stat">
          <div class="total-icon">
            <SvgIcon name="package" :width="18" :height="18" />
          </div>
          <div class="total-info">
            <div class="total-label">{{ t('warehouse.stock_total') }}</div>
            <div class="total-value">
              {{ totalUsableQuantity }}
              <span class="total-unit">{{ t(`warehouse.unit_${item.unit}`) }}</span>
            </div>
          </div>
        </div>

        <!-- Aggregate cards -->
        <div v-if="aggregateEntries.length > 0" class="aggregate-cards">
          <div
            v-for="[movementType, qty] in aggregateEntries"
            :key="movementType"
            class="aggregate-card"
            :class="AGGREGATE_COLOR_CLASSES[movementType] || ''"
            :data-test="'stock-agg-card-' + movementType"
          >
            <div class="agg-icon">
              <SvgIcon :name="AGGREGATE_ICONS[movementType] || 'package'" :width="14" :height="14" />
            </div>
            <div class="agg-info">
              <div class="agg-label">{{ t(`warehouse.${AGGREGATE_LABEL_KEYS[movementType] || 'batch_summary_in_stock'}`) }}</div>
              <div class="agg-value">
                {{ qty }}
                <span class="agg-unit">{{ t(`warehouse.unit_${item.unit}`) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="stockAggregatesLoading" class="text-muted" style="padding: 12px 0;">
          {{ t('warehouse.loading') }}...
        </div>
      </div>

      <!-- Stock card content: GlassPanels inside grid columns (matching ProductCardPage pattern) -->
      <div v-if="item || loading" class="main-card-content">
      <div class="entity-card-grid">
        <div class="entity-col-left">
          <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-left-panel">
            <template v-if="item">
            <div class="input-group">
              <label class="field-label">{{ t('warehouse.col_product') }}</label>
              <input
                :value="formName"
                class="glass-input"
                type="text"
                readonly
                data-test="field-product-name"
              />
              <span class="field-hint">{{ t('warehouse.field_product_hint') }}</span>
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('warehouse.col_category') }}</label>
              <input
                :value="formCategoryName"
                class="glass-input"
                type="text"
                readonly
                data-test="field-category-name"
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
                <span>{{ t('warehouse.col_avg_price') }}</span>
                <span v-tooltip="t('warehouse.col_avg_price_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                :value="form.avgUnitPrice"
                class="glass-input"
                type="number"
                min="0"
                step="0.01"
                readonly
                data-test="field-avg-price"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            </template>
          </GlassPanel>
        </div>
        <div class="entity-col-center">
          <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-center-panel">
            <template v-if="item">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_min_stock') }}</span>
                <span v-tooltip="t('warehouse.col_min_stock_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input v-model.number="form.minStock" class="glass-input" type="number" min="0" :step="quantityStep" data-test="field-min-stock" />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_total_qty') }}</span>
                <span v-tooltip="t('warehouse.col_total_qty_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                :value="`${item.totalQuantity} ${t(`warehouse.unit_${form.unit}`)}`"
                class="glass-input"
                type="text"
                readonly
                data-test="field-total-qty"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_reserved') }}</span>
                <span v-tooltip="t('warehouse.col_reserved_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                :value="`${item.reservedQuantity} ${t(`warehouse.unit_${form.unit}`)}`"
                class="glass-input"
                type="text"
                readonly
                data-test="field-reserved-qty"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_available') }}</span>
                <span v-tooltip="t('warehouse.col_available_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                :value="`${item.availableQuantity} ${t(`warehouse.unit_${form.unit}`)}`"
                class="glass-input"
                type="text"
                :class="{ 'text-danger': item.availableQuantity <= 0 }"
                readonly
                data-test="field-available-qty"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            </template>
          </GlassPanel>
        </div>
        <div class="entity-col-right">
          <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-right-panel">
            <template v-if="item">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_batches') }}</span>
                <span v-tooltip="t('warehouse.col_batches_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <router-link
                :to="{ name: 'admin-warehouse', params: { tab: 'batches' }, query: { productId: item.productId } }"
                class="batch-link-row"
                data-test="batch-link"
              >
                <span>{{ t('warehouse.open_batches_for_product') }}</span>
                <SvgIcon name="external-link" :width="14" :height="14" />
              </router-link>
              <input
                :value="item.batchCount"
                class="glass-input"
                type="text"
                readonly
                data-test="field-batch-count"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_total_value') }}</span>
                <span v-tooltip="t('warehouse.col_total_value_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                :value="`${item.totalValue.toFixed(2)} ${t('warehouse.currency_eur')}`"
                class="glass-input"
                type="text"
                readonly
                data-test="field-total-value"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            </template>
          </GlassPanel>
        </div>
      </div>

      <!-- FULL WIDTH: Audit History -->
      <div class="audit-panel-wide" data-test="stock-card-audit">
        <GlassPanel :title="t('warehouse.section_stock_audit')">
          <div class="table-responsive">
            <table class="audit-log-table" data-test="stock-card-audit-table">
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
                <tr v-for="(a, i) in auditLog" :key="i" data-test="stock-card-audit-row">
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
                      data-test="stock-card-audit-delete-btn"
                      @click="askDeleteAudit(i)"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>
    </div>
  </div>

  <AppModal
    v-model="deleteAuditOpen"
    :title="t('modal.confirm_delete')"
    size="small"
    data-test="stock-card-audit-modal"
  >
    <p>{{ t('modal.delete_audit_warning') }}</p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="stock-card-audit-modal-cancel"
        @click="deleteAuditOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        data-test="stock-card-audit-modal-confirm"
        @click="confirmDeleteAudit"
      >
        {{ t('btn.delete') }}
      </button>
    </template>
  </AppModal>
</template>
</template>

<style scoped>
.page-stock-card {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 0;
}

.stock-card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.stock-card-header-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 16px;
}

.stock-card-header-row .page-title {
  margin: 0;
  flex: 1;
  min-width: 0;
}

@media (max-width: 992px) {
  .stock-card-header-row {
    gap: 12px;
  }
}

@media (max-width: 600px) {
  .stock-card-header-row {
    flex-direction: column;
    align-items: stretch;
  }
}

</style>
