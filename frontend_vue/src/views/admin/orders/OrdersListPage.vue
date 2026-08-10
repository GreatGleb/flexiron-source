<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useOrders } from '@/composables/useOrders'
import { useToast } from '@/composables/useToast'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import Pagination from '@/components/admin/ui/Pagination.vue'
import { formatCents as money } from '@/domain/orderPricing'
import type { OrderListItem } from '@/types/order'

import '@styles/admin/components/_pagination.css'
import '@styles/admin/orders_list.css'

const { t } = useI18n()

useHead({
  title: () => `Flexiron — ${t('orders.title')}`,
  description: () => t('orders.header_title'),
})

const toast = useToast()
const { items, loading, error, filters, pagination, load, handleDelete, toggleSort } = useOrders()

/**
 * Both shares are derived server-side from the payments and the shipped
 * quantities, never stored — see the order card. Coloured only when it says
 * something: fully paid is good news, and nothing else on this row shows it.
 */
function paidClass(item: OrderListItem): string {
  if (item.paidPercent >= 100) return 'paid-full'
  return item.paidPercent > 0 ? 'paid-part' : ''
}

// ─── Status filter ───
const STATUS_OPTIONS = [
  { value: 'all', label: t('orders.filter_status_all') },
  { value: 'new', label: t('orders.status_new') },
  { value: 'confirmed', label: t('orders.status_confirmed') },
  { value: 'picking', label: t('orders.status_picking') },
  { value: 'packing', label: t('orders.status_packing') },
  { value: 'shipped', label: t('orders.status_shipped') },
  { value: 'delivered', label: t('orders.status_delivered') },
  { value: 'paid', label: t('orders.status_paid') },
  { value: 'cancelled', label: t('orders.status_cancelled') },
]

// ─── Search with debounce ───
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.search = v
  }, 300)
})

// ─── Pagination ───
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

// ─── Order status pill class mapping ───
const ORDER_STATUS_PILL: Record<string, string> = {
  new: 'order-status-pill--new',
  confirmed: 'order-status-pill--confirmed',
  picking: 'order-status-pill--picking',
  packing: 'order-status-pill--packing',
  shipped: 'order-status-pill--shipped',
  delivered: 'order-status-pill--delivered',
  paid: 'order-status-pill--paid',
  cancelled: 'order-status-pill--cancelled',
}

// ─── Delete modal ───
const deletingId = ref<string | null>(null)
const showDeleteModal = ref(false)

function confirmDelete(id: string) {
  deletingId.value = id
  showDeleteModal.value = true
}

async function onDeleteConfirm() {
  if (!deletingId.value) return
  await handleDelete(deletingId.value)
  showDeleteModal.value = false
  deletingId.value = null
}

// ─── Save / Load filter preferences ──────────────────────────────────────────
const PREFS_KEY = 'orders_list_prefs'

function saveView() {
  const prefs = {
    filters: {
      search: filters.search,
      status: filters.status,
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    },
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const prefs = JSON.parse(raw) as {
      filters?: { search?: string; status?: string; sortBy?: string; sortDir?: string }
    }
    if (prefs.filters) {
      if (typeof prefs.filters.search === 'string') filters.search = prefs.filters.search
      if (typeof prefs.filters.status === 'string') filters.status = prefs.filters.status
      if (prefs.filters.sortBy) filters.sortBy = prefs.filters.sortBy
      if (prefs.filters.sortDir) filters.sortDir = prefs.filters.sortDir
    }
  } catch {
    /* ignore malformed prefs */
  }
}

onMounted(() => {
  loadPrefs()
  load()
})
</script>

<template>
  <div class="page-orders" data-test="page-orders">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('orders.title') },
      ]"
    />
    <div class="page-header" data-test="orders-header">
      <h1 class="page-title">{{ t('orders.header_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <router-link :to="{ name: 'admin-order-create' }" class="btn btn-primary">
          <SvgIcon name="plus-add" :width="18" :height="18" />
          <span>{{ t('orders.btn_create') }}</span>
        </router-link>
      </div>
    </div>

    <div class="filters-bar" data-test="orders-filters">
      <div class="filters-bar-header">
        <span>{{ t('orders.filters') }}</span>
      </div>
      <div class="filters-bar-content">
        <div class="filter-group" data-test="orders-filter-search">
          <label class="field-label">{{ t('orders.col_order_number') }}</label>
          <SearchInput
            v-model="searchInput"
            :placeholder="t('orders.search_placeholder')"
            data-test="orders-search"
          />
        </div>
        <div class="filter-group" data-test="orders-filter-status">
          <label class="field-label">{{ t('orders.col_status') }}</label>
          <CustomSelect v-model="filters.status" :options="STATUS_OPTIONS" />
        </div>
        <button class="btn btn-primary" data-test="orders-save-view-btn" @click="saveView">
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
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>{{ t('btn.save_view') }}</span>
        </button>
      </div>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="orders-table">
      <div v-if="error && !loading" class="error-state" data-test="orders-error">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('orders.btn_retry') }}</button>
      </div>

      <div v-else-if="!loading && items.length === 0" class="empty-state" data-test="orders-empty">
        <SvgIcon name="shopping-cart" :width="48" :height="48" />
        <p>{{ t('orders.empty') }}</p>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table">
          <colgroup>
            <col class="col-order" />
            <col class="col-client" />
            <col class="col-status" />
            <col class="col-total" />
            <col class="col-date" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <button class="th-sort-btn" @click="toggleSort('orderNumber')">
                  {{ t('orders.col_order_number') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'orderNumber' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'orderNumber' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('clientName')">
                  {{ t('orders.col_client') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'clientName' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'clientName' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('status')">
                  {{ t('orders.col_status') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'status' && filters.sortDir === 'asc' }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'status' && filters.sortDir === 'desc' }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('totalWithVat')">
                  {{ t('orders.col_total') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'totalWithVat' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'totalWithVat' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('paidPercent')">
                  {{ t('orders.col_paid_percent') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'paidPercent' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'paidPercent' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('shippedPercent')">
                  {{ t('orders.col_shipped_percent') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'shippedPercent' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'shippedPercent' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('createdAt')">
                  {{ t('orders.col_date') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'createdAt' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'createdAt' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="orders-row" data-test="orders-row">
              <td>
                <router-link
                  :to="{ name: 'admin-order-card', params: { id: item.id } }"
                  class="name-link"
                >
                  {{ item.orderNumber }}
                </router-link>
              </td>
              <td>{{ item.clientName }}</td>
              <td>
                <span
                  class="status-pill"
                  :class="ORDER_STATUS_PILL[item.status] || 'order-status-pill--new'"
                >
                  {{ t(`orders.status_${item.status}`) }}
                </span>
              </td>
              <td data-test="orders-row-total">{{ money(item.totalWithVat) }} €</td>
              <td data-test="orders-row-paid">
                <span :class="paidClass(item)">{{ money(item.paidPercent) }}%</span>
              </td>
              <td data-test="orders-row-shipped">{{ money(item.shippedPercent) }}%</td>
              <td>{{ new Date(item.createdAt).toLocaleDateString() }}</td>
              <td>
                <div class="orders-row-actions">
                  <router-link
                    v-tooltip="t('orders.btn_view')"
                    :to="{ name: 'admin-order-card', params: { id: item.id } }"
                    class="action-icon-btn action-edit"
                    data-test="orders-view-btn"
                    @click.stop
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </router-link>
                  <button
                    v-tooltip="t('orders.btn_delete')"
                    class="action-icon-btn action-danger"
                    data-test="orders-delete-btn"
                    @click.stop="confirmDelete(item.id)"
                  >
                    <SvgIcon name="trash" :width="16" :height="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="pagination.total.value > 0">
            <tr>
              <td colspan="8">
                <Pagination
                  v-model:page="pagination.page.value"
                  v-model:size="pageSizeStr"
                  :total-pages="pagination.totalPages.value"
                  :pages="pagination.pageNumbers()"
                  :page-size-options="PAGE_SIZE_OPTIONS"
                  :size-label="t('orders.page_size')"
                  :showing-from="pagination.showingFrom.value"
                  :showing-to="pagination.showingTo.value"
                  :total="pagination.total.value"
                  :of-label="t('orders.of')"
                  test-id="orders-pagination"
                  size-test-id="orders-page-size"
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassPanel>

    <AppModal
      v-model="showDeleteModal"
      :title="t('orders.btn_delete')"
      data-test="modal-delete-order"
    >
      <p>{{ t('orders.confirm_delete') }}</p>
      <template #footer>
        <button class="btn btn-secondary" @click="showDeleteModal = false">
          {{ t('orders.btn_discard') }}
        </button>
        <button class="btn btn-danger" data-test="orders-delete-confirm" @click="onDeleteConfirm">
          {{ t('orders.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style>
@import '@styles/admin/orders_list.css';
</style>
