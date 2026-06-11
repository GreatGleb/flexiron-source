<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import FinanceSubNav from './FinanceSubNav.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import { getArchive } from '@/services/financeService'
import { usePagination } from '@/composables/usePagination'
import { useHead } from '@/composables/useHead'
import type { FinanceDocumentArchiveItem } from '@/types/finance'

import '@styles/admin/components/_pagination.css'
import '@styles/admin/finance_list.css'

const { t } = useI18n()

const searchInput = ref('')
const typeFilter = ref('all')
const entityFilter = ref('all')

// ─── Type filter options (computed for reactive i18n) ───
const TYPE_OPTIONS = computed(() => [
  { value: 'all', label: t('st.all') },
  { value: 'invoice', label: t('financeArchive.type_invoice') },
  { value: 'facture', label: t('financeArchive.type_facture') },
  { value: 'waybill', label: t('financeArchive.type_waybill') },
  { value: 'cmr', label: t('financeArchive.type_cmr') },
  { value: 'other', label: t('financeArchive.type_other') },
])

// ─── Entity type filter options (computed for reactive i18n) ───
const ENTITY_OPTIONS = computed(() => [
  { value: 'all', label: t('st.all') },
  { value: 'order', label: t('financeArchive.related_type_order') },
  { value: 'payment', label: t('financeArchive.related_type_payment') },
  { value: 'supplier', label: t('financeArchive.related_type_supplier') },
  { value: 'client', label: t('financeArchive.related_type_client') },
])

useHead({
  title: () => `Flexiron — ${t('page.financeArchive')}`,
  description: () => t('page.financeArchive'),
})

const documents = ref<FinanceDocumentArchiveItem[]>([])
const loading = ref(false)
const error = ref(false)

const pagination = usePagination(25)

function load() {
  loading.value = true
  error.value = false
  getArchive({
    search: searchInput.value,
    type: typeFilter.value,
    relatedEntityType: entityFilter.value,
  }, { page: pagination.page.value, pageSize: pagination.pageSize.value })
    .then((res) => {
      documents.value = res.items
      pagination.total.value = res.total
    })
    .catch(() => { error.value = true })
    .finally(() => { loading.value = false })
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    pagination.reset()
    load()
  }, 300)
})

watch([typeFilter, entityFilter], () => {
  pagination.reset()
  load()
})

// Reload on page/pageSize changes
watch([pagination.page, pagination.pageSize], () => {
  load()
})


function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString()
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
  <h1 class="page-title" data-test="finance-archive-title">{{ t('financeArchive.header_title') }}</h1>

  <FinanceSubNav />

  <div class="filters-bar" data-test="finance-archive-filters">
    <div class="filters-bar-header">
      <span>{{ t('financeArchive.filters') }}</span>
    </div>
    <div class="filters-bar-content">
      <div class="filter-group" data-test="archive-filter-search">
        <label class="field-label">{{ t('financeArchive.search_placeholder') }}</label>
        <input
          v-model="searchInput"
          class="glass-input"
          type="text"
          :placeholder="t('financeArchive.search_placeholder')"
          data-test="archive-search-input"
        />
      </div>
      <div class="filter-group" data-test="archive-filter-type">
        <label class="field-label">{{ t('financeArchive.th_type') }}</label>
        <CustomSelect v-model="typeFilter" :options="TYPE_OPTIONS" />
      </div>
      <div class="filter-group" data-test="archive-filter-entity">
        <label class="field-label">{{ t('financeArchive.th_related') }}</label>
        <CustomSelect v-model="entityFilter" :options="ENTITY_OPTIONS" />
      </div>
    </div>
  </div>

  <GlassPanel
    :title="t('financeArchive.header_title')"
    :loading="loading"
    :skeleton-rows="8"
    data-test="finance-archive-panel"
  >
    <div v-if="error" class="error-state" data-test="finance-archive-error">
      <SvgIcon name="alert-triangle" :width="48" :height="48" />
      <p>{{ t('common.error_title') }}</p>
      <button class="btn btn-primary" @click="load">{{ t('common.error_btn') }}</button>
    </div>

    <div v-else-if="!loading && documents.length === 0" class="empty-state" data-test="finance-archive-empty">
      <SvgIcon name="file" :width="48" :height="48" />
      <p>{{ t('financeArchive.empty_title') }}</p>
    </div>

    <div v-else class="data-table-wrapper">
      <table class="data-table" data-test="finance-archive-table">
        <thead>
          <tr>
            <th>{{ t('financeArchive.th_name') }}</th>
            <th>{{ t('financeArchive.th_type') }}</th>
            <th>{{ t('financeArchive.th_related') }}</th>
            <th>{{ t('financeArchive.th_date') }}</th>
            <th>{{ t('financeArchive.th_size') }}</th>
            <th class="text-right">{{ t('financeArchive.th_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in documents" :key="doc.id" data-test="archive-document-row">
            <td class="doc-name-cell">{{ doc.name }}</td>
            <td>
              <span class="doc-type-badge">{{ t(`financeArchive.type_${doc.type}`) }}</span>
            </td>
            <td>
              <span class="related-entity">
                {{ t(`financeArchive.related_type_${doc.relatedEntityType}`) }}
                <span class="entity-number">#{{ doc.relatedEntityNumber }}</span>
              </span>
            </td>
            <td>{{ formatDate(doc.uploadedAt) }}</td>
            <td>{{ formatSize(doc.size) }}</td>
            <td class="text-right">
              <a
                :href="doc.url"
                class="action-icon-btn"
                download
                :data-test="`archive-download-${doc.id}`"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </a>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6">
              <div class="pagination-bar" data-test="finance-archive-pagination">
                <div class="page-size" data-test="finance-page-size">
                  <span>{{ t('suppliers.page_size') }}</span>
                  <CustomSelect
                    v-model="pageSizeStr"
                    :options="PAGE_SIZE_OPTIONS"
                    :open-up="true"
                    class="custom-select-sm"
                  />
                </div>
                <div class="pagination-nav">
                  <button
                    class="btn btn-icon btn-sm"
                    :disabled="!pagination.hasPrev.value"
                    :style="{ display: pagination.totalPages.value <= 1 ? 'none' : 'flex' }"
                    @click="pagination.prev()"
                  >
                    <SvgIcon name="chevron-right" :width="14" :height="14" style="transform: rotate(180deg)" />
                  </button>
                  <div class="pagination-pages">
                    <template v-for="(p, i) in pagination.pageNumbers()" :key="i">
                      <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                      <button
                        v-else
                        class="page-btn"
                        :class="{ active: p === pagination.page.value }"
                        @click="pagination.goTo(p as number)"
                      >
                        {{ p }}
                      </button>
                    </template>
                  </div>
                  <button
                    class="btn btn-icon btn-sm"
                    :disabled="!pagination.hasNext.value"
                    :style="{ display: pagination.totalPages.value <= 1 ? 'none' : 'flex' }"
                    @click="pagination.next()"
                  >
                    <SvgIcon name="chevron-right" :width="14" :height="14" />
                  </button>
                </div>
                <div class="pagination-info">
                  <span>{{ pagination.showingFrom.value }}–{{ pagination.showingTo.value }}</span>
                  <span>&nbsp;{{ t('suppliers.of') }}&nbsp;</span>
                  <span>{{ pagination.total.value }}</span>
                </div>
              </div>
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
.doc-name-cell {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}
.doc-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}
.related-entity {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.65);
}
.entity-number {
  color: rgba(255, 255, 255, 0.4);
  margin-left: 2px;
}
</style>
