<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import FinanceSubNav from './FinanceSubNav.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import Pagination from '@/components/admin/ui/Pagination.vue'
import { getReceivables } from '@/services/financeService'
import { usePagination } from '@/composables/usePagination'
import { useHead } from '@/composables/useHead'
import type { Receivable } from '@/types/finance'

import '@styles/admin/components/_pagination.css'
import '@styles/admin/finance_list.css'

/**
 * Реестр входящих — представление над счетами заказов.
 *
 * Строка здесь не самостоятельная запись, а счёт: номер, дата и сумма его,
 * срок — из условий оплаты клиента, «оплачено» — из платежей заказа, статус
 * вычислен. Поэтому карточки у строки нет и быть не может: подробности живут в
 * заказе, и ссылка ведёт туда, а не во вторую реализацию того же экрана.
 */

const { t } = useI18n()

useHead({
  title: () => `Flexiron — ${t('page.financeIncoming')}`,
  description: () => t('page.financeIncoming'),
})

const receivables = ref<Receivable[]>([])
const loading = ref(false)
const error = ref(false)

const searchInput = ref('')
const statusFilter = ref('all')

// Отменённого счёта в модели заказа нет: отозванный корректировкой в реестр не
// попадает вовсе, поэтому и варианта «Отменён» здесь нет.
const STATUS_OPTIONS = computed(() => [
  { value: 'all', label: t('st.all') },
  { value: 'pending', label: t('financeList.status_pending') },
  { value: 'overdue', label: t('financeList.status_overdue') },
  { value: 'completed', label: t('financeList.status_completed') },
])

const pagination = usePagination(25)

function load() {
  loading.value = true
  error.value = false
  getReceivables(
    { search: searchInput.value, status: statusFilter.value },
    { page: pagination.page.value, pageSize: pagination.pageSize.value },
  )
    .then((res) => {
      receivables.value = res.items
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

watch([pagination.page, pagination.pageSize], () => {
  load()
})

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-warning',
  completed: 'pill-success',
  overdue: 'pill-danger',
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
}

onMounted(() => load())
</script>

<template>
  <h1 class="page-title" data-test="finance-incoming-title">{{ t('financeList.header_title') }}</h1>

  <FinanceSubNav />

  <div class="filters-bar" data-test="finance-incoming-filters">
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
    :title="t('financeList.header_title')"
    :loading="loading"
    :skeleton-rows="8"
    data-test="finance-incoming-panel"
  >
    <div v-if="error" class="error-state" data-test="finance-incoming-error">
      <SvgIcon name="alert-triangle" :width="48" :height="48" />
      <p>{{ t('common.error_title') }}</p>
      <button class="btn btn-primary" @click="load">{{ t('common.error_btn') }}</button>
    </div>

    <div
      v-else-if="!loading && receivables.length === 0"
      class="empty-state"
      data-test="finance-incoming-empty"
    >
      <SvgIcon name="profit-coin" :width="48" :height="48" />
      <p>{{ t('financeList.empty_title') }}</p>
      <p class="empty-text">{{ t('financeList.empty_text') }}</p>
    </div>

    <div v-else class="data-table-wrapper">
      <table class="data-table" data-test="finance-incoming-table">
        <thead>
          <tr>
            <th>{{ t('financeList.th_invoice') }}</th>
            <th>{{ t('financeList.th_counterparty') }}</th>
            <th>{{ t('financeList.th_order') }}</th>
            <th>{{ t('financeList.th_issued_at') }}</th>
            <th>{{ t('financeList.th_due_date') }}</th>
            <th>{{ t('financeList.th_amount') }}</th>
            <th>{{ t('financeList.th_paid') }}</th>
            <th>{{ t('financeList.th_status') }}</th>
            <th class="text-right">{{ t('financeList.th_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in receivables" :key="r.id" data-test="finance-receivable-row">
            <td>
              <router-link
                :to="{ name: 'admin-order-card', params: { id: r.orderId } }"
                class="name-link"
                data-test="receivable-invoice-link"
              >
                {{ r.invoiceNumber }}
              </router-link>
            </td>
            <td>{{ r.clientName }}</td>
            <td>{{ r.orderNumber }}</td>
            <td>{{ formatDate(r.issuedAt) }}</td>
            <td>{{ formatDate(r.dueDate) }}</td>
            <td>{{ r.amount.toFixed(2) }} {{ r.currency }}</td>
            <td data-test="receivable-paid">{{ r.paidAmount.toFixed(2) }} {{ r.currency }}</td>
            <td>
              <span :class="['status-pill', STATUS_PILL[r.status]]" data-test="receivable-status">
                {{ t(`financeList.status_${r.status}`) }}
              </span>
            </td>
            <td class="text-right">
              <router-link
                v-tooltip="t('financeList.open_order')"
                :to="{ name: 'admin-order-card', params: { id: r.orderId } }"
                class="action-icon-btn"
                data-test="receivable-order-btn"
              >
                <SvgIcon name="external-link" :width="16" :height="16" />
              </router-link>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="9">
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
.name-link {
  color: inherit;
  text-decoration: none;
  transition: text-decoration-color 0.2s ease;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
}
.name-link:hover {
  text-decoration-color: currentColor;
}
.empty-text {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}
</style>
