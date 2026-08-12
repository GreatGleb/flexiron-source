<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import FinanceSubNav from './FinanceSubNav.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import Pagination from '@/components/admin/ui/Pagination.vue'
import { getPayments } from '@/services/financeService'
import { usePagination } from '@/composables/usePagination'
import { useHead } from '@/composables/useHead'
import type { FinancePaymentListItem } from '@/types/finance'

import '@styles/admin/components/_pagination.css'
import '@styles/admin/finance_list.css'

const { t } = useI18n()
const router = useRouter()

useHead({
  title: () => `Flexiron — ${t('page.financeOutgoing')}`,
  description: () => t('page.financeOutgoing'),
})

const payments = ref<FinancePaymentListItem[]>([])
const loading = ref(false)
const error = ref(false)

const searchInput = ref('')
const statusFilter = ref('all')

// ─── Status filter options (computed for reactive i18n) ───
const STATUS_OPTIONS = computed(() => [
  { value: 'all', label: t('st.all') },
  { value: 'pending', label: t('financeList.status_pending') },
  { value: 'completed', label: t('financeList.status_completed') },
  { value: 'overdue', label: t('financeList.status_overdue') },
  { value: 'cancelled', label: t('financeList.status_cancelled') },
])

const pagination = usePagination(25)

function load() {
  loading.value = true
  error.value = false
  getPayments(
    'outgoing',
    {
      search: searchInput.value,
      status: statusFilter.value,
      counterpartyId: null,
      dateFrom: '',
      dateTo: '',
      direction: 'outgoing',
    },
    { page: pagination.page.value, pageSize: pagination.pageSize.value },
  )
    .then((res) => {
      payments.value = res.items
      pagination.total.value = res.total
    })
    .catch(() => {
      error.value = true
    })
    .finally(() => {
      loading.value = false
    })
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.reset()
    load()
  }, 300)
})

watch(statusFilter, () => {
  pagination.reset()
  load()
})

// Reload on page/pageSize changes
watch([pagination.page, pagination.pageSize], () => {
  load()
})

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-warning',
  completed: 'pill-success',
  overdue: 'pill-danger',
  cancelled: 'pill-suspended',
}

function goToPayment(id: string) {
  router.push({ name: 'admin-finance-outgoing-payment', params: { id } })
}

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const pageSizeStr = computed({
  get: () => String(pagination.pageSize.value),
  set: (v: string) => {
    pagination.pageSize.value = Number(v)
    pagination.reset()
    load()
  },
})

onMounted(() => load())
</script>

<template>
  <h1 class="page-title" data-test="finance-outgoing-title">
    {{ t('financeList.header_title_outgoing') }}
  </h1>

  <FinanceSubNav />

  <div class="filters-bar" data-test="finance-outgoing-filters">
    <div class="filters-bar-header">
      <span>{{ t('financeList.filters') }}</span>
    </div>
    <div class="filters-bar-content">
      <div class="filter-group" data-test="finance-filter-search">
        <label class="field-label">{{ t('financeList.search_placeholder') }}</label>
        <input
          v-model="searchInput"
          class="glass-input"
          type="text"
          :placeholder="t('financeList.search_placeholder')"
          data-test="finance-search-input"
        />
      </div>
      <div class="filter-group" data-test="finance-filter-status">
        <label class="field-label">{{ t('financeList.th_status') }}</label>
        <CustomSelect v-model="statusFilter" :options="STATUS_OPTIONS" />
      </div>
    </div>
  </div>

  <GlassPanel
    :title="t('financeList.header_title_outgoing')"
    :loading="loading"
    :skeleton-rows="8"
    data-test="finance-outgoing-panel"
  >
    <div v-if="error" class="error-state" data-test="finance-outgoing-error">
      <SvgIcon name="alert-triangle" :width="48" :height="48" />
      <p>{{ t('common.error_title') }}</p>
      <button class="btn btn-primary" @click="load">{{ t('common.error_btn') }}</button>
    </div>

    <div
      v-else-if="!loading && payments.length === 0"
      class="empty-state"
      data-test="finance-outgoing-empty"
    >
      <SvgIcon name="profit-coin" :width="48" :height="48" />
      <p>{{ t('financeList.empty_title') }}</p>
      <p class="empty-text">{{ t('financeList.empty_text') }}</p>
    </div>

    <div v-else class="data-table-wrapper">
      <table class="data-table" data-test="finance-outgoing-table">
        <thead>
          <tr>
            <th>{{ t('financeList.th_number') }}</th>
            <th>{{ t('financeList.th_counterparty') }}</th>
            <th>{{ t('financeList.th_invoice_ref') }}</th>
            <th>{{ t('financeList.th_amount') }}</th>
            <th>{{ t('financeList.th_status') }}</th>
            <th>{{ t('financeList.th_due_date') }}</th>
            <th>{{ t('financeList.th_documents') }}</th>
            <th class="text-right">{{ t('financeList.th_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="p in payments"
            :key="p.id"
            class="clickable-row"
            data-test="finance-payment-row"
            @click="goToPayment(p.id)"
          >
            <td>{{ p.paymentNumber }}</td>
            <td>{{ p.counterpartyName }}</td>
            <td>{{ p.supplierInvoiceRef ?? '—' }}</td>
            <td>{{ p.amount.toFixed(2) }} {{ p.currency }}</td>
            <td>
              <span :class="['status-pill', STATUS_PILL[p.status]]">
                {{ t(`financeList.status_${p.status}`) }}
              </span>
            </td>
            <td>{{ new Date(p.dueDate).toLocaleDateString() }}</td>
            <td>
              <span v-if="p.documentCount > 0" class="doc-badge">
                <SvgIcon name="file" :width="14" :height="14" />
                {{ p.documentCount }}
              </span>
              <span v-else class="doc-badge doc-badge-empty">0</span>
            </td>
            <td class="text-right">
              <button
                class="action-icon-btn"
                data-test="payment-view-btn"
                @click.stop="goToPayment(p.id)"
              >
                <SvgIcon name="external-link" width="16" height="16" />
              </button>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="8">
              <Pagination
                v-model:page="pagination.page.value"
                v-model:size="pageSizeStr"
                :total-pages="pagination.totalPages.value"
                :pages="pagination.pageNumbers()"
                :page-size-options="PAGE_SIZE_OPTIONS"
                :size-label="t('suppliers.page_size')"
                :showing-from="pagination.showingFrom.value"
                :showing-to="pagination.showingTo.value"
                :total="pagination.total.value"
                :of-label="t('suppliers.of')"
                test-id="finance-pagination"
                size-test-id="finance-page-size"
              />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </GlassPanel>
</template>

<style scoped>
.text-right {
  text-align: right;
}
.clickable-row {
  cursor: pointer;
}
.clickable-row:hover {
  background: rgba(255, 255, 255, 0.03);
}
.doc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.65);
}
.doc-badge-empty {
  opacity: 0.4;
}
.empty-text {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}
</style>
