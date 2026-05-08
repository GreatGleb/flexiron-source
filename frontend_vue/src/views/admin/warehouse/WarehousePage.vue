<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouse } from '@/composables/useWarehouse'
import type { WarehouseTab } from '@/composables/useWarehouse'
import type { BatchStatus, OffcutStatus, MovementType, DeficitPriority, DeficitStatus } from '@/types/warehouse'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/warehouse_list.css'

const { t } = useI18n()

const {
  activeTab,
  stockItems, stockLoading, stockError,
  batches, batchesLoading, batchesError,
  offcuts, offcutsLoading, offcutsError,
  movements, movementsLoading, movementsError,
  deficitItems, deficitLoading, deficitError,
  filters,
  pagination,
  load,
  loadStock,
  deleteBatch,
  deleteOffcut,
  deleteDeficit,
  tf,
} = useWarehouse()

useHead({
  title: () => `Flexiron — ${t('warehouse.header_title')}`,
  description: () => t('warehouse.title'),
})

const TABS: { key: WarehouseTab; labelKey: string; icon: string }[] = [
  { key: 'stock', labelKey: 'warehouse.tab_stock', icon: 'pie-chart' },
  { key: 'batches', labelKey: 'warehouse.tab_batches', icon: 'package' },
  { key: 'offcuts', labelKey: 'warehouse.tab_offcuts', icon: 'scissors' },
  { key: 'movements', labelKey: 'warehouse.tab_movements', icon: 'refresh-cw' },
  { key: 'deficit', labelKey: 'warehouse.tab_deficit', icon: 'alert-triangle' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const pageSizeStr = computed({
  get: () => String(pagination.pageSize.value),
  set: (v: string) => {
    pagination.pageSize.value = Number(v)
    pagination.reset()
  },
})

// ─── Status pill helpers ──────────────────────────────────────────────────────

const BATCH_STATUS_PILL: Record<BatchStatus, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  partial: 'pill-warning',
  depleted: 'pill-muted',
  quarantine: 'pill-danger',
}

const OFFCUT_STATUS_PILL: Record<OffcutStatus, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  used: 'pill-muted',
  scrap: 'pill-danger',
}

const MOVEMENT_TYPE_PILL: Record<MovementType, string> = {
  receipt: 'pill-success',
  expense: 'pill-danger',
  transfer: 'pill-info',
  'write-off': 'pill-warning',
}

const DEFICIT_PRIORITY_PILL: Record<DeficitPriority, string> = {
  critical: 'pill-danger',
  high: 'pill-warning',
  medium: 'pill-info',
  low: 'pill-muted',
}

const DEFICIT_STATUS_PILL: Record<DeficitStatus, string> = {
  open: 'pill-warning',
  in_progress: 'pill-info',
  ordered: 'pill-mint',
  resolved: 'pill-success',
  cancelled: 'pill-muted',
}

// ─── Delete confirm modals ────────────────────────────────────────────────────

const showDeleteModal = ref(false)
const deletingItem = ref<{ id: string; name: string; type: 'batch' | 'offcut' | 'deficit' } | null>(null)

function confirmDeleteBatch(id: string, name: string) {
  deletingItem.value = { id, name, type: 'batch' }
  showDeleteModal.value = true
}

function confirmDeleteOffcut(id: string, name: string) {
  deletingItem.value = { id, name, type: 'offcut' }
  showDeleteModal.value = true
}

function confirmDeleteDeficit(id: string, name: string) {
  deletingItem.value = { id, name, type: 'deficit' }
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  const { id, type } = deletingItem.value
  if (type === 'batch') await deleteBatch(id)
  else if (type === 'offcut') await deleteOffcut(id)
  else if (type === 'deficit') await deleteDeficit(id)
  showDeleteModal.value = false
  deletingItem.value = null
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="page-warehouse" data-test="page-warehouse">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title') },
      ]"
    />

    <div class="warehouse-header" data-test="warehouse-header">
      <h1 class="page-title">{{ t('warehouse.header_title') }}</h1>
    </div>

    <!-- Tabs -->
    <div class="warehouse-tabs" data-test="warehouse-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="warehouse-tab"
        :class="{ active: activeTab === tab.key }"
        :data-test="`warehouse-tab-${tab.key}`"
        @click="activeTab = tab.key"
      >
        <SvgIcon :name="tab.icon" :width="18" :height="18" />
        <span>{{ t(tab.labelKey) }}</span>
      </button>
    </div>

    <!-- Filters bar (shown for all tabs except stock) -->
    <div v-if="activeTab !== 'stock'" class="filters-bar" data-test="warehouse-filters">
      <div class="filters-bar-header">
        <span>{{ t('warehouse.filters') }}</span>
      </div>
      <div class="filters-bar-content">
        <div class="filter-group" data-test="warehouse-filter-search">
          <label class="field-label">{{ t('warehouse.col_search') }}</label>
          <SearchInput
            v-model="filters.search"
            :placeholder="t('warehouse.search_placeholder')"
            data-test="warehouse-search"
          />
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Stock Overview
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'stock'" data-test="warehouse-tab-stock">
      <GlassPanel :loading="stockLoading" :skeleton-rows="6" data-test="warehouse-stock-panel">
        <div
          v-if="stockError"
          class="error-state"
          data-test="warehouse-stock-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ stockError }}</p>
          <button class="btn btn-primary" @click="loadStock">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!stockLoading && stockItems.length === 0"
          class="empty-state"
          data-test="warehouse-stock-empty"
        >
          <SvgIcon name="package" :width="48" :height="48" />
          <p>{{ t('warehouse.stock_empty') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_product') }}</th>
                <th>{{ t('warehouse.col_total_qty') }}</th>
                <th>{{ t('warehouse.col_reserved') }}</th>
                <th>{{ t('warehouse.col_available') }}</th>
                <th>{{ t('warehouse.col_unit') }}</th>
                <th>{{ t('warehouse.col_batches') }}</th>
                <th>{{ t('warehouse.col_avg_price') }}</th>
                <th>{{ t('warehouse.col_total_value') }}</th>
                <th>{{ t('warehouse.col_min_stock') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in stockItems"
                :key="item.productId"
                :class="{ 'row-deficit': item.isDeficit }"
                data-test="warehouse-stock-row"
              >
                <td>
                  <span class="cell-link">{{ tf(item.productName) }}</span>
                </td>
                <td>{{ item.totalQuantity }}</td>
                <td>{{ item.reservedQuantity }}</td>
                <td>
                  <span :class="{ 'text-danger': item.availableQuantity <= 0 }">
                    {{ item.availableQuantity }}
                  </span>
                </td>
                <td>{{ t(`warehouse.unit_${item.unit}`) }}</td>
                <td>{{ item.batchCount }}</td>
                <td>{{ item.avgUnitPrice.toFixed(2) }} €</td>
                <td>{{ item.totalValue.toFixed(2) }} €</td>
                <td>
                  <template v-if="item.minStock !== null">
                    {{ item.minStock }}
                    <span v-if="item.isDeficit" class="deficit-badge" data-test="deficit-badge">
                      {{ t('warehouse.deficit_badge') }}
                    </span>
                  </template>
                  <span v-else class="text-muted">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Batches
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'batches'" data-test="warehouse-tab-batches">
      <GlassPanel :loading="batchesLoading" :skeleton-rows="8" data-test="warehouse-batches-panel">
        <div
          v-if="batchesError"
          class="error-state"
          data-test="warehouse-batches-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ batchesError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!batchesLoading && batches.length === 0"
          class="empty-state"
          data-test="warehouse-batches-empty"
        >
          <SvgIcon name="package" :width="48" :height="48" />
          <p>{{ t('warehouse.batches_empty') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_product') }}</th>
                <th>{{ t('warehouse.col_batch_number') }}</th>
                <th>{{ t('warehouse.col_lot_code') }}</th>
                <th>{{ t('warehouse.col_quantity') }}</th>
                <th>{{ t('warehouse.col_remaining') }}</th>
                <th>{{ t('warehouse.col_unit') }}</th>
                <th>{{ t('warehouse.col_unit_price') }}</th>
                <th>{{ t('warehouse.col_received') }}</th>
                <th>{{ t('warehouse.col_status') }}</th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="batch in batches"
                :key="batch.id"
                data-test="warehouse-batch-row"
              >
                <td>
                  <router-link
                    :to="{ name: 'admin-warehouse-batch', params: { id: batch.id } }"
                    class="cell-link"
                  >
                    {{ tf(batch.productName) }}
                  </router-link>
                </td>
                <td>{{ batch.batchNumber }}</td>
                <td><code class="lot-code">{{ batch.lotCode }}</code></td>
                <td>{{ batch.quantity }}</td>
                <td>
                  <span :class="{ 'text-danger': batch.quantityRemaining <= 0 }">
                    {{ batch.quantityRemaining }}
                  </span>
                </td>
                <td>{{ t(`warehouse.unit_${batch.unit}`) }}</td>
                <td>{{ batch.unitPrice.toFixed(2) }} €</td>
                <td>{{ batch.receivedAt.slice(0, 10) }}</td>
                <td>
                  <span class="pill" :class="BATCH_STATUS_PILL[batch.status]">
                    {{ t(`warehouse.batch_status_${batch.status}`) }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <router-link
                      :to="{ name: 'admin-warehouse-batch', params: { id: batch.id } }"
                      class="btn btn-sm btn-ghost"
                      :title="t('warehouse.btn_edit')"
                    >
                      <SvgIcon name="edit-pencil" :width="16" :height="16" />
                    </router-link>
                    <button
                      class="btn btn-sm btn-ghost btn-danger-ghost"
                      :title="t('warehouse.btn_delete')"
                      @click="confirmDeleteBatch(batch.id, tf(batch.productName))"
                    >
                      <SvgIcon name="trash-2" :width="16" :height="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.total.value > 0" class="pagination-bar">
          <div class="pagination-info">
            {{ pagination.showingFrom }}–{{ pagination.showingTo }}
            {{ t('st.of') }} {{ pagination.total }}
          </div>
          <div class="pagination-controls">
            <CustomSelect
              v-model="pageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              data-test="warehouse-page-size"
            />
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasPrev.value"
              @click="pagination.prev()"
              data-test="warehouse-prev-page"
            >
              <SvgIcon name="chevron-left" :width="16" :height="16" />
            </button>
            <button
              v-for="p in pagination.pageNumbers()"
              :key="p"
              class="btn btn-sm"
              :class="{ 'btn-primary': p === pagination.page.value, 'btn-ghost': p !== pagination.page.value }"
              :disabled="p === '...'"
              @click="pagination.goTo(p as number)"
              :data-test="`warehouse-page-${p}`"
            >
              {{ p }}
            </button>
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasNext.value"
              @click="pagination.next()"
              data-test="warehouse-next-page"
            >
              <SvgIcon name="chevron-right" :width="16" :height="16" />
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Offcuts
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'offcuts'" data-test="warehouse-tab-offcuts">
      <GlassPanel :loading="offcutsLoading" :skeleton-rows="8" data-test="warehouse-offcuts-panel">
        <div
          v-if="offcutsError"
          class="error-state"
          data-test="warehouse-offcuts-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ offcutsError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!offcutsLoading && offcuts.length === 0"
          class="empty-state"
          data-test="warehouse-offcuts-empty"
        >
          <SvgIcon name="scissors" :width="48" :height="48" />
          <p>{{ t('warehouse.offcuts_empty') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_product') }}</th>
                <th>{{ t('warehouse.col_batch_number') }}</th>
                <th>{{ t('warehouse.col_dimensions') }}</th>
                <th>{{ t('warehouse.col_weight') }}</th>
                <th>{{ t('warehouse.col_quantity') }}</th>
                <th>{{ t('warehouse.col_unit') }}</th>
                <th>{{ t('warehouse.col_location') }}</th>
                <th>{{ t('warehouse.col_status') }}</th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="offcut in offcuts"
                :key="offcut.id"
                data-test="warehouse-offcut-row"
              >
                <td>
                  <span class="cell-link">{{ tf(offcut.productName) }}</span>
                </td>
                <td><code class="lot-code">{{ offcut.batchNumber }}</code></td>
                <td>
                  <template v-if="offcut.lengthMm">
                    {{ offcut.lengthMm }}×{{ offcut.widthMm ?? '—' }} mm
                  </template>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>{{ offcut.weightKg ?? '—' }}</td>
                <td>{{ offcut.quantity }}</td>
                <td>{{ t(`warehouse.unit_${offcut.unit}`) }}</td>
                <td>{{ offcut.location ?? '—' }}</td>
                <td>
                  <span class="pill" :class="OFFCUT_STATUS_PILL[offcut.status]">
                    {{ t(`warehouse.offcut_status_${offcut.status}`) }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <button
                      class="btn btn-sm btn-ghost btn-danger-ghost"
                      :title="t('warehouse.btn_delete')"
                      @click="confirmDeleteOffcut(offcut.id, tf(offcut.productName))"
                    >
                      <SvgIcon name="trash-2" :width="16" :height="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.total.value > 0" class="pagination-bar">
          <div class="pagination-info">
            {{ pagination.showingFrom }}–{{ pagination.showingTo }}
            {{ t('st.of') }} {{ pagination.total }}
          </div>
          <div class="pagination-controls">
            <CustomSelect
              v-model="pageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              data-test="warehouse-page-size"
            />
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasPrev.value"
              @click="pagination.prev()"
            >
              <SvgIcon name="chevron-left" :width="16" :height="16" />
            </button>
            <button
              v-for="p in pagination.pageNumbers()"
              :key="p"
              class="btn btn-sm"
              :class="{ 'btn-primary': p === pagination.page.value, 'btn-ghost': p !== pagination.page.value }"
              :disabled="p === '...'"
              @click="pagination.goTo(p as number)"
            >
              {{ p }}
            </button>
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasNext.value"
              @click="pagination.next()"
            >
              <SvgIcon name="chevron-right" :width="16" :height="16" />
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Movements
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'movements'" data-test="warehouse-tab-movements">
      <GlassPanel :loading="movementsLoading" :skeleton-rows="8" data-test="warehouse-movements-panel">
        <div
          v-if="movementsError"
          class="error-state"
          data-test="warehouse-movements-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ movementsError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!movementsLoading && movements.length === 0"
          class="empty-state"
          data-test="warehouse-movements-empty"
        >
          <SvgIcon name="refresh-cw" :width="48" :height="48" />
          <p>{{ t('warehouse.movements_empty') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_date') }}</th>
                <th>{{ t('warehouse.col_type') }}</th>
                <th>{{ t('warehouse.col_product') }}</th>
                <th>{{ t('warehouse.col_batch_number') }}</th>
                <th>{{ t('warehouse.col_quantity') }}</th>
                <th>{{ t('warehouse.col_unit') }}</th>
                <th>{{ t('warehouse.col_unit_price') }}</th>
                <th>{{ t('warehouse.col_total') }}</th>
                <th>{{ t('warehouse.col_reference') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="mov in movements"
                :key="mov.id"
                data-test="warehouse-movement-row"
              >
                <td>{{ mov.movedAt.slice(0, 10) }}</td>
                <td>
                  <span class="pill" :class="MOVEMENT_TYPE_PILL[mov.type]">
                    {{ t(`warehouse.movement_type_${mov.type}`) }}
                  </span>
                </td>
                <td>
                  <span class="cell-link">{{ tf(mov.productName) }}</span>
                </td>
                <td><code class="lot-code">{{ mov.batchNumber }}</code></td>
                <td>{{ mov.quantity }}</td>
                <td>{{ t(`warehouse.unit_${mov.unit}`) }}</td>
                <td>{{ mov.unitPrice.toFixed(2) }} €</td>
                <td>{{ (mov.quantity * mov.unitPrice).toFixed(2) }} €</td>
                <td>{{ mov.referenceId ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.total.value > 0" class="pagination-bar">
          <div class="pagination-info">
            {{ pagination.showingFrom }}–{{ pagination.showingTo }}
            {{ t('st.of') }} {{ pagination.total }}
          </div>
          <div class="pagination-controls">
            <CustomSelect
              v-model="pageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              data-test="warehouse-page-size"
            />
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasPrev.value"
              @click="pagination.prev()"
            >
              <SvgIcon name="chevron-left" :width="16" :height="16" />
            </button>
            <button
              v-for="p in pagination.pageNumbers()"
              :key="p"
              class="btn btn-sm"
              :class="{ 'btn-primary': p === pagination.page.value, 'btn-ghost': p !== pagination.page.value }"
              :disabled="p === '...'"
              @click="pagination.goTo(p as number)"
            >
              {{ p }}
            </button>
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasNext.value"
              @click="pagination.next()"
            >
              <SvgIcon name="chevron-right" :width="16" :height="16" />
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Deficit
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'deficit'" data-test="warehouse-tab-deficit">
      <GlassPanel :loading="deficitLoading" :skeleton-rows="8" data-test="warehouse-deficit-panel">
        <div
          v-if="deficitError"
          class="error-state"
          data-test="warehouse-deficit-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ deficitError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!deficitLoading && deficitItems.length === 0"
          class="empty-state"
          data-test="warehouse-deficit-empty"
        >
          <SvgIcon name="check-circle" :width="48" :height="48" />
          <p>{{ t('warehouse.deficit_empty') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_product') }}</th>
                <th>{{ t('warehouse.col_current_stock') }}</th>
                <th>{{ t('warehouse.col_min_required') }}</th>
                <th>{{ t('warehouse.col_deficit_amount') }}</th>
                <th>{{ t('warehouse.col_unit') }}</th>
                <th>{{ t('warehouse.col_priority') }}</th>
                <th>{{ t('warehouse.col_status') }}</th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in deficitItems"
                :key="item.id"
                :class="{ 'row-critical': item.priority === 'critical' }"
                data-test="warehouse-deficit-row"
              >
                <td>
                  <span class="cell-link">{{ tf(item.productName) }}</span>
                </td>
                <td :class="{ 'text-danger': item.currentStock <= 0 }">
                  {{ item.currentStock }}
                </td>
                <td>{{ item.minRequired }}</td>
                <td class="text-danger fw-bold">{{ item.deficitAmount }}</td>
                <td>{{ t(`warehouse.unit_${item.unit}`) }}</td>
                <td>
                  <span class="pill" :class="DEFICIT_PRIORITY_PILL[item.priority]">
                    {{ t(`warehouse.deficit_priority_${item.priority}`) }}
                  </span>
                </td>
                <td>
                  <span class="pill" :class="DEFICIT_STATUS_PILL[item.status]">
                    {{ t(`warehouse.deficit_status_${item.status}`) }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <button
                      class="btn btn-sm btn-ghost btn-danger-ghost"
                      :title="t('warehouse.btn_delete')"
                      @click="confirmDeleteDeficit(item.id, tf(item.productName))"
                    >
                      <SvgIcon name="trash-2" :width="16" :height="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.total.value > 0" class="pagination-bar">
          <div class="pagination-info">
            {{ pagination.showingFrom }}–{{ pagination.showingTo }}
            {{ t('st.of') }} {{ pagination.total }}
          </div>
          <div class="pagination-controls">
            <CustomSelect
              v-model="pageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              data-test="warehouse-page-size"
            />
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasPrev.value"
              @click="pagination.prev()"
            >
              <SvgIcon name="chevron-left" :width="16" :height="16" />
            </button>
            <button
              v-for="p in pagination.pageNumbers()"
              :key="p"
              class="btn btn-sm"
              :class="{ 'btn-primary': p === pagination.page.value, 'btn-ghost': p !== pagination.page.value }"
              :disabled="p === '...'"
              @click="pagination.goTo(p as number)"
            >
              {{ p }}
            </button>
            <button
              class="btn btn-sm btn-ghost"
              :disabled="!pagination.hasNext.value"
              @click="pagination.next()"
            >
              <SvgIcon name="chevron-right" :width="16" :height="16" />
            </button>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         Delete confirmation modal
         ════════════════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div
        v-if="showDeleteModal"
        class="modal-overlay"
        data-test="warehouse-delete-modal"
        @click.self="showDeleteModal = false"
      >
        <div class="modal-content">
          <h3>{{ t('warehouse.delete_title') }}</h3>
          <p>{{ t('warehouse.delete_confirm', { name: deletingItem?.name ?? '' }) }}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" @click="showDeleteModal = false">
              {{ t('btn.cancel') }}
            </button>
            <button class="btn btn-danger" @click="handleDelete">
              {{ t('btn.delete') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
