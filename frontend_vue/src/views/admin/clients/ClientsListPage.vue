<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useClients } from '@/composables/useClients'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/clients_list.css'

const { t } = useI18n()

useHead({
  title: () => `Flexiron — ${t('clients.title')}`,
  description: () => t('clients.title'),
})

const { items, loading, error, filters, page, pageSize, total, totalPages, load, handleDelete } = useClients()

// ─── Status filter ─────────────────────────────────────
const STATUS_OPTIONS = [
  { value: '', label: t('clients.filter_status_all') },
  { value: 'active', label: t('clients.status_active') },
  { value: 'inactive', label: t('clients.status_inactive') },
]

const statusFilterStr = computed({
  get: () => filters.value.status ?? '',
  set: (v: string) => { filters.value.status = (v || null) as 'active' | 'inactive' | null },
})

// ─── Search ────────────────────────────────────────────
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { filters.value.search = v }, 300)
})

// ─── Pagination helpers ────────────────────────────────
const showingFrom = computed(() => Math.min((page.value - 1) * pageSize.value + 1, total.value))
const showingTo = computed(() => Math.min(page.value * pageSize.value, total.value))

const pageNumbers = computed(() => {
  const n = totalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  if (page.value <= 3) return [1, 2, 3, 4, '...', n] as (number | '...')[]
  if (page.value >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n] as (number | '...')[]
  return [1, '...', page.value - 1, page.value, page.value + 1, '...', n] as (number | '...')[]
})

// ─── Delete confirm modal ──────────────────────────────
const deletingId = ref<string | null>(null)
const showDeleteModal = ref(false)

const deletingClientName = computed(() => {
  if (!deletingId.value) return ''
  const client = items.value.find((c) => c.id === deletingId.value)
  return client?.name ?? ''
})

const deletingClientHasOrders = computed(() => {
  if (!deletingId.value) return false
  const client = items.value.find((c) => c.id === deletingId.value)
  return (client?.orderHistory?.length ?? 0) > 0
})

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

// ─── Page size ─────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const pageSizeStr = computed({
  get: () => String(pageSize.value),
  set: (v: string) => {
    pageSize.value = Number(v)
    page.value = 1
  },
})

onMounted(load)
</script>

<template>
  <div class="page-clients" data-test="page-clients">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('clients.title') },
      ]"
    />
    <div class="page-header" data-test="clients-header">
      <h1 class="page-title">{{ t('clients.header_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <router-link
          :to="{ name: 'admin-client-create' }"
          class="btn btn-primary"
          data-test="clients-new-btn"
        >
          <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
          <span>{{ t('clients.btn_create') }}</span>
        </router-link>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar" data-test="clients-filters">
      <div class="filters-bar-header">
        <span>{{ t('clients.filters') }}</span>
      </div>
      <div class="filters-bar-content">
        <div class="filter-group" data-test="clients-filter-search">
          <label class="field-label">{{ t('clients.search_placeholder') }}</label>
          <SearchInput
            v-model="searchInput"
            :placeholder="t('clients.search_placeholder')"
            data-test="clients-search-input"
          />
        </div>
        <div class="filter-group" data-test="clients-filter-status">
          <label class="field-label">{{ t('clients.col_status') }}</label>
          <CustomSelect v-model="statusFilterStr" :options="STATUS_OPTIONS" />
        </div>
      </div>
    </div>

    <!-- Table -->
    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="clients-table-panel">
      <div v-if="error" class="error-state" data-test="clients-error-state">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('clients.btn_retry') }}</button>
      </div>

      <div v-else-if="!loading && items.length === 0" class="empty-state" data-test="clients-empty-state">
        <SvgIcon name="warehouse-box" :width="48" :height="48" />
        <p>{{ t('clients.empty') }}</p>
        <router-link :to="{ name: 'admin-client-create' }" class="btn btn-primary">
          {{ t('clients.btn_create') }}
        </router-link>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table" data-test="clients-table">
          <colgroup>
            <col class="col-name" />
            <col class="col-code" />
            <col class="col-vat" />
            <col class="col-addr" />
            <col class="col-phone" />
            <col class="col-email" />
            <col class="col-status" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <button class="th-sort-btn">
                  {{ t('clients.col_name') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                    />
                  </span>
                </button>
              </th>
              <th>{{ t('clients.col_company_code') }}</th>
              <th>{{ t('clients.col_vat') }}</th>
              <th>{{ t('clients.col_address') }}</th>
              <th>{{ t('clients.col_phone') }}</th>
              <th>{{ t('clients.col_email') }}</th>
              <th>{{ t('clients.col_status') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="clients-row" data-test="clients-row">
              <td>
                <router-link
                  :to="{ name: 'admin-client-card', params: { id: item.id } }"
                  class="name-link"
                >
                  {{ item.name }}
                </router-link>
              </td>
              <td>{{ item.companyCode }}</td>
              <td>{{ item.vatCode }}</td>
              <td>{{ item.address }}</td>
              <td>{{ item.phone }}</td>
              <td>{{ item.email }}</td>
              <td>
                <span :class="['client-status-badge', item.status === 'active' ? 'badge-active' : 'badge-inactive']">
                  {{ item.status === 'active' ? t('clients.status_active') : t('clients.status_inactive') }}
                </span>
              </td>
              <td>
                <div class="clients-row-actions">
                  <router-link
                    v-tooltip="t('clients.btn_edit')"
                    :to="{ name: 'admin-client-card', params: { id: item.id } }"
                    class="action-icon-btn"
                    data-test="clients-view-btn"
                    @click.stop
                  >
                    <SvgIcon name="external-link" :width="16" :height="16" />
                  </router-link>
                  <button
                    v-tooltip="t('clients.btn_delete')"
                    class="action-icon-btn action-danger"
                    data-test="clients-delete-btn"
                    @click.stop="confirmDelete(item.id)"
                  >
                    <SvgIcon name="trash" :width="16" :height="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="total > 0">
            <tr>
              <td colspan="8">
                <div class="pagination-bar" data-test="clients-pagination">
                  <div class="page-size" data-test="clients-page-size">
                    <span>{{ t('clients.page_size') }}</span>
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
                      :disabled="page <= 1"
                      :style="{ display: totalPages <= 1 ? 'none' : 'flex' }"
                      @click="page--"
                    >
                      <SvgIcon
                        name="chevron-right"
                        :width="14"
                        :height="14"
                        style="transform: rotate(180deg)"
                      />
                    </button>
                    <div class="pagination-pages">
                      <template v-for="(p, i) in pageNumbers" :key="i">
                        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                        <button
                          v-else
                          class="page-btn"
                          :class="{ active: p === page }"
                          @click="page = p as number"
                        >
                          {{ p }}
                        </button>
                      </template>
                    </div>
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="page * pageSize >= total"
                      :style="{ display: totalPages <= 1 ? 'none' : 'flex' }"
                      @click="page++"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14" />
                    </button>
                  </div>
                  <div class="pagination-info">
                    <span>{{ showingFrom }}-{{ showingTo }}</span>
                    <span>&nbsp;{{ t('clients.of') }}&nbsp;</span>
                    <span>{{ total }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassPanel>

    <!-- Delete Confirm Modal -->
    <AppModal v-model="showDeleteModal" :title="t('clients.btn_delete')" size="small" data-test="clients-delete-modal">
      <p>{{ t('clients.confirm_delete', { name: deletingClientName }) }}</p>
      <p v-if="deletingClientHasOrders" class="text-warning">{{ t('clients.delete_warning_orders') }}</p>
      <template #footer>
        <template v-if="deletingClientHasOrders">
          <button class="btn btn-primary" data-test="clients-delete-confirm" @click="showDeleteModal = false">
            {{ t('clients.btn_ok') }}
          </button>
        </template>
        <template v-else>
          <button class="btn btn-secondary" data-test="clients-delete-cancel" @click="showDeleteModal = false">
            {{ t('clients.btn_discard') }}
          </button>
          <button class="btn btn-danger" data-test="clients-delete-confirm" @click="onDeleteConfirm">
            {{ t('clients.btn_delete') }}
          </button>
        </template>
      </template>
    </AppModal>
  </div>
</template>

<style>
@import '@styles/admin/clients_list.css';
</style>
