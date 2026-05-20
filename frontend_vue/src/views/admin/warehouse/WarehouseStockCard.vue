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
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'

const { t } = useI18n()
const route = useRoute()
const productId = route.params.id as string

const {
  item, loading, saving, error,
  form, formName, formCategoryName, isAnythingDirty,
  auditLog, deleteAuditEntry,
  load, save, discard,
  tf,
} = useWarehouseStockCard(productId)

const pageTitle = computed(() =>
  item.value ? tf(item.value.productName) : t('warehouse.header_title'),
)

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => pageTitle.value,
})

// ─── Audit log entry deletion (with confirm modal) ───
const deleteAuditOpen = ref(false)
const auditToDeleteIdx = ref<number | null>(null)

function askDeleteAudit(index: number) {
  auditToDeleteIdx.value = index
  deleteAuditOpen.value = true
}

async function confirmDeleteAudit() {
  if (auditToDeleteIdx.value === null) return
  const idx = auditToDeleteIdx.value
  await deleteAuditEntry(idx)
  auditToDeleteIdx.value = null
  deleteAuditOpen.value = false
}

onMounted(load)
</script>

<template>
  <div class="page-stock-card" data-test="stock-card-page">
    <div v-if="item" class="stock-card-header" data-test="stock-card-header">
      <Breadcrumb
        :items="[
          { label: t('warehouse.header_title'), to: { name: 'admin-warehouse', params: { tab: 'stock' } } },
          { label: t('warehouse.tab_stock'), to: { name: 'admin-warehouse', params: { tab: 'stock' } } },
          { label: tf(item.productName) },
        ]"
      />
      <div class="stock-card-header-row">
        <h1 class="page-title">
          {{ t('warehouse.tab_stock') }} — {{ tf(item.productName) }}
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

    <!-- Error state (outside grid, wrapped in its own GlassPanel) -->
    <GlassPanel v-if="error" data-test="stock-card-error-panel">
      <div class="error-state" data-test="stock-card-error">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>
    </GlassPanel>

    <!-- Not found state (outside grid, wrapped in its own GlassPanel) -->
    <GlassPanel v-else-if="!loading && !item" data-test="stock-card-empty-panel">
      <div class="entity-not-found" data-test="stock-card-empty">
        <SvgIcon name="tag" :width="48" :height="48" />
        <h2>{{ t('warehouse.stock_card_not_found') }}</h2>
        <p>{{ t('common.entity_not_found_id', { id: productId }) }}</p>
        <router-link :to="{ name: 'admin-warehouse', params: { tab: 'stock' } }" class="btn btn-primary">
          {{ t('common.back_to_list') }}
        </router-link>
      </div>
    </GlassPanel>

    <!-- Stock card content: GlassPanels inside grid columns (matching ProductCardPage pattern) -->
    <div v-else-if="item" class="main-card-content">
      <div class="entity-card-grid">
        <div class="entity-col-left">
          <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-left-panel">
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
          </GlassPanel>
        </div>
        <div class="entity-col-center">
          <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-center-panel">
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
              <input v-model.number="form.minStock" class="glass-input" type="number" min="0" step="0.01" data-test="field-min-stock" />
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
          </GlassPanel>
        </div>
        <div class="entity-col-right">
          <GlassPanel :loading="loading" :skeleton-rows="4" data-test="stock-card-right-panel">
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
                :value="`${item.totalValue.toFixed(2)} €`"
                class="glass-input"
                type="text"
                readonly
                data-test="field-total-value"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
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
                  <th>{{ t('th.timestamp') }}</th>
                  <th>{{ t('th.user') }}</th>
                  <th>{{ t('th.prop') }}</th>
                  <th>{{ t('th.diff') }}</th>
                  <th style="width: 40px" />
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
                    <span class="audit-diff-old">{{ a.oldValue }}</span>
                    &nbsp;→&nbsp;
                    <span class="audit-diff-new">{{ a.newValue }}</span>
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

/* Batch link row — text + icon link between label and input */
.batch-link-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  cursor: pointer;
}
.batch-link-row:hover {
  text-decoration: underline;
}
.batch-link-row svg {
  flex-shrink: 0;
  opacity: 0.5;
}
</style>
