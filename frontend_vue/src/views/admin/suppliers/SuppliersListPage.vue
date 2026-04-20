<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import ViewTabs from '@/components/admin/ViewTabs.vue'
import KanbanCard from '@/components/admin/KanbanCard.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import MultiSelect from '@/components/admin/ui/MultiSelect.vue'
import RatingSelect from '@/components/admin/ui/RatingSelect.vue'
import RatingStars from '@/components/admin/ui/RatingStars.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import { useSuppliers } from '@/composables/useSuppliers'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import type { Supplier, SupplierStatus } from '@/types/supplier'

import '@styles/admin/suppliers_list.css'

const { t } = useI18n()

useHead({
  title: () => `Flexiron — ${t('suppliers.list')}`,
  description: () => t('suppliers.list'),
})

const showKanbanView = useFeatureFlag('supplierKanbanView')
const showExport = useFeatureFlag('supplierExport')

const { suppliers, loading, error, filters, pagination, load, changeStatus } = useSuppliers()

const view = ref<'table' | 'kanban'>('table')
const searchInput = ref('')

const STATUS_OPTIONS: { value: SupplierStatus | 'all'; labelKey: string; pill?: string }[] = [
  { value: 'all', labelKey: 'st.all' },
  { value: 'active', labelKey: 'st.active', pill: 'success' },
  { value: 'preferred', labelKey: 'st.preferred', pill: 'info' },
  { value: 'new', labelKey: 'st.new', pill: 'mint' },
  { value: 'under_review', labelKey: 'st.review', pill: 'warning' },
  { value: 'suspended', labelKey: 'st.suspended', pill: 'suspended' },
  { value: 'blocked', labelKey: 'st.blocked', pill: 'danger' },
]

const statusSelectOptions = computed(() =>
  STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
)

const CATEGORY_KEYS = [
  'Sheets',
  'Pipes',
  'Beams',
  'Rebars',
  'Lintels',
  'Profiles',
  'Wire',
  'Fittings',
]
const categoryOptions = computed(() =>
  CATEGORY_KEYS.map((k) => ({ value: k, label: t(`category.${k}`) })),
)

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const STATUS_PILL: Record<SupplierStatus, string> = {
  active: 'pill-success',
  preferred: 'pill-info',
  new: 'pill-mint',
  under_review: 'pill-warning',
  suspended: 'pill-suspended',
  blocked: 'pill-danger',
}

const STATUS_LABEL: Record<SupplierStatus, string> = {
  active: 'Active',
  preferred: 'Preferred',
  new: 'New',
  under_review: 'Under Review',
  suspended: 'Suspended',
  blocked: 'Blocked',
}

const KANBAN_COLUMNS: { status: SupplierStatus; titleKey: string }[] = [
  { status: 'active', titleKey: 'suppliers.col_active' },
  { status: 'preferred', titleKey: 'suppliers.col_preferred' },
  { status: 'new', titleKey: 'suppliers.col_new' },
  { status: 'under_review', titleKey: 'suppliers.col_under_review' },
  { status: 'suspended', titleKey: 'suppliers.col_suspended' },
  { status: 'blocked', titleKey: 'suppliers.col_blocked' },
]

function suppliersByStatus(status: SupplierStatus): Supplier[] {
  return suppliers.value.filter((s) => s.status === status)
}

const pageSizeStr = computed({
  get: () => String(pagination.pageSize.value),
  set: (v: string) => {
    pagination.pageSize.value = Number(v)
    pagination.reset()
  },
})

const statusFilterStr = computed({
  get: () => filters.status,
  set: (v) => {
    filters.status = v as SupplierStatus | 'all'
  },
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.search = v
  }, 300)
})

// Kanban drag-drop: document-level listeners so that events bubbling from cards → columns are caught reliably.
function onDocDragStart(e: DragEvent) {
  const card = (e.target as HTMLElement | null)?.closest?.('.kanban-card') as HTMLElement | null
  if (!card) return
  card.classList.add('dragging')
  e.dataTransfer?.setData('text/plain', card.dataset.id ?? '')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDocDragEnd(e: DragEvent) {
  const card = (e.target as HTMLElement | null)?.closest?.('.kanban-card') as HTMLElement | null
  card?.classList.remove('dragging')
  document
    .querySelectorAll('.kanban-column.drag-over')
    .forEach((el) => el.classList.remove('drag-over'))
}

function onDocDragOver(e: DragEvent) {
  const col = (e.target as HTMLElement | null)?.closest?.('.kanban-column') as HTMLElement | null
  if (!col) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  document.querySelectorAll('.kanban-column.drag-over').forEach((el) => {
    if (el !== col) el.classList.remove('drag-over')
  })
  col.classList.add('drag-over')
}

function onDocDragLeave(e: DragEvent) {
  const col = (e.target as HTMLElement | null)?.closest?.('.kanban-column') as HTMLElement | null
  if (!col) return
  const related = e.relatedTarget as HTMLElement | null
  if (related && col.contains(related)) return
  col.classList.remove('drag-over')
}

// Drop triggers a confirm modal before actually changing the status
const confirmMoveOpen = ref(false)
const pendingMove = ref<{
  id: string
  company: string
  fromStatus: SupplierStatus
  toStatus: SupplierStatus
} | null>(null)

function onDocDrop(e: DragEvent) {
  const col = (e.target as HTMLElement | null)?.closest?.('.kanban-column') as HTMLElement | null
  if (!col) return
  e.preventDefault()
  col.classList.remove('drag-over')
  const id = e.dataTransfer?.getData('text/plain')
  const newStatus = col.dataset.status as SupplierStatus | undefined
  if (!id || !newStatus) return
  const supplier = suppliers.value.find((s) => s.id === id)
  if (!supplier) return
  if (supplier.status === newStatus) return // no-op drop onto same column
  pendingMove.value = {
    id,
    company: supplier.company,
    fromStatus: supplier.status,
    toStatus: newStatus,
  }
  confirmMoveOpen.value = true
}

function confirmMove() {
  if (!pendingMove.value) return
  changeStatus(pendingMove.value.id, pendingMove.value.toStatus)
  pendingMove.value = null
  confirmMoveOpen.value = false
}

function cancelMove() {
  pendingMove.value = null
  confirmMoveOpen.value = false
}

function exportCsv() {
  const rows = suppliers.value.map((s) =>
    [
      s.company,
      STATUS_LABEL[s.status],
      s.rating,
      s.categories.join(';'),
      s.leadTime,
      s.email,
      s.phone,
    ].join(','),
  )
  const csv = rows.join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'suppliers.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const PREFS_KEY = 'suppliers_list_prefs'

function saveView() {
  const prefs = {
    activeView: view.value,
    filters: {
      search: filters.search,
      status: filters.status,
      categories: [...filters.categories],
      rating: filters.rating,
    },
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const prefs = JSON.parse(raw) as {
      activeView?: 'table' | 'kanban'
      filters?: Partial<typeof filters>
    }
    if (prefs.activeView) {
      view.value =
        prefs.activeView === 'kanban' && !showKanbanView.value ? 'table' : prefs.activeView
    }
    if (prefs.filters) {
      if (typeof prefs.filters.search === 'string') {
        filters.search = prefs.filters.search
        searchInput.value = prefs.filters.search
      }
      if (prefs.filters.status) filters.status = prefs.filters.status
      if (Array.isArray(prefs.filters.categories)) filters.categories = prefs.filters.categories
      if (typeof prefs.filters.rating === 'number') filters.rating = prefs.filters.rating
    }
  } catch {
    /* ignore malformed prefs */
  }
}

onMounted(() => {
  loadPrefs()
  load()
  document.addEventListener('dragstart', onDocDragStart)
  document.addEventListener('dragend', onDocDragEnd)
  document.addEventListener('dragover', onDocDragOver)
  document.addEventListener('dragleave', onDocDragLeave)
  document.addEventListener('drop', onDocDrop)
})

onBeforeUnmount(() => {
  document.removeEventListener('dragstart', onDocDragStart)
  document.removeEventListener('dragend', onDocDragEnd)
  document.removeEventListener('dragover', onDocDragOver)
  document.removeEventListener('dragleave', onDocDragLeave)
  document.removeEventListener('drop', onDocDrop)
})
</script>

<template>
  <h1 class="page-title" data-test="suppliers-title">{{ t('suppliers.header_title') }}</h1>

  <div class="suppliers-header" data-test="suppliers-toolbar">
    <div class="suppliers-header-left">
      <ViewTabs v-if="showKanbanView" v-model="view" data-test="suppliers-view-tabs" />
    </div>
    <div class="suppliers-header-right">
      <button
        v-if="showExport"
        class="btn btn-secondary"
        data-test="suppliers-export-btn"
        @click="exportCsv"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        <span>{{ t('btn.export') }}</span>
      </button>
      <router-link
        :to="{ name: 'admin-bcc-request' }"
        class="btn btn-secondary"
        data-test="suppliers-bcc-btn"
      >
        <SvgIcon name="email" :width="18" :height="18" />
        <span>{{ t('btn.bcc_request') }}</span>
      </router-link>
      <router-link
        :to="{ name: 'admin-supplier-create' }"
        class="btn btn-primary"
        data-test="suppliers-new-btn"
      >
        <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
        <span>{{ t('btn.new_supplier') }}</span>
      </router-link>
    </div>
  </div>

  <div class="filters-bar" data-test="suppliers-filters">
    <div class="filters-bar-header">
      <span>{{ t('suppliers.filters') }}</span>
    </div>
    <div class="filters-bar-content">
      <div class="filter-group" data-test="suppliers-filter-status">
        <label class="field-label">{{ t('suppliers.th_status') }}</label>
        <CustomSelect v-model="statusFilterStr" :options="statusSelectOptions">
          <template #selected="{ value }">
            <span v-if="value === 'all'">{{ t('st.all') }}</span>
            <span v-else :class="['status-pill', STATUS_PILL[value as SupplierStatus]]">
              {{ t(STATUS_OPTIONS.find((o) => o.value === value)!.labelKey) }}
            </span>
          </template>
          <template #option="{ option }">
            <span v-if="option.value === 'all'">{{ t('st.all') }}</span>
            <span v-else :class="['status-pill', STATUS_PILL[option.value as SupplierStatus]]">
              {{ t(STATUS_OPTIONS.find((o) => o.value === option.value)!.labelKey) }}
            </span>
          </template>
        </CustomSelect>
      </div>

      <div class="filter-group" data-test="suppliers-filter-category">
        <label class="field-label">{{ t('suppliers.th_specialization') }}</label>
        <MultiSelect
          v-model="filters.categories"
          :options="categoryOptions"
          :placeholder="t('suppliers.select_categories')"
        />
      </div>

      <div class="filter-group" data-test="suppliers-filter-rating">
        <label class="field-label">{{ t('suppliers.th_rating') }}</label>
        <RatingSelect v-model="filters.rating" />
      </div>

      <button class="btn btn-secondary" data-test="suppliers-save-view-btn" @click="saveView">
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

  <!-- TABLE VIEW -->
  <div v-show="view === 'table'" data-test="suppliers-table-view">
    <GlassPanel
      :title="t('suppliers.list')"
      :loading="loading"
      :skeleton-rows="8"
      data-test="suppliers-table-panel"
    >
      <div v-if="error" class="error-state" data-test="suppliers-error-state">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        <p>{{ t('suppliers.error_title') }}</p>
        <button class="btn btn-primary" @click="load">{{ t('suppliers.error_btn') }}</button>
      </div>

      <div
        v-else-if="!loading && suppliers.length === 0"
        class="empty-state"
        data-test="suppliers-empty-state"
      >
        <SvgIcon name="warehouse-box" :width="48" :height="48" />
        <p>{{ t('suppliers.empty_title') }}</p>
        <router-link :to="{ name: 'admin-supplier-create' }" class="btn btn-primary">{{
          t('suppliers.empty_btn')
        }}</router-link>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table" data-test="suppliers-table">
          <thead>
            <tr>
              <th>
                <div class="th-search">
                  <span>{{ t('suppliers.th_company') }}</span>
                  <div class="search-box-inline">
                    <SvgIcon name="search" :width="14" :height="14" class="icon" />
                    <input
                      v-model="searchInput"
                      type="text"
                      class="search-input-sm"
                      :placeholder="t('suppliers.search_placeholder')"
                      data-test="suppliers-search-input"
                    />
                  </div>
                </div>
              </th>
              <th>{{ t('suppliers.th_status') }}</th>
              <th>{{ t('suppliers.th_rating') }}</th>
              <th class="hid-480">{{ t('suppliers.th_specialization') }}</th>
              <th class="hid-768">{{ t('suppliers.th_lead_time') }}</th>
              <th class="hid-768">{{ t('suppliers.th_last_request') }}</th>
              <th class="hid-600">{{ t('suppliers.th_contacts') }}</th>
              <th>{{ t('suppliers.th_actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in suppliers" :key="s.id" :data-id="s.id" data-test="suppliers-row">
              <td>
                <router-link
                  :to="{ name: 'admin-supplier-card', params: { id: s.id } }"
                  class="link"
                >
                  {{ s.company }}
                </router-link>
                <span
                  v-if="s.hasDeficit"
                  v-tooltip="t('tooltip.deficit_indicator')"
                  class="deficit-indicator"
                />
              </td>
              <td>
                <span :class="['status-pill', STATUS_PILL[s.status]]">
                  {{ t(`status.${STATUS_LABEL[s.status]}`) }}
                </span>
              </td>
              <td><RatingStars :model-value="s.rating" :readonly="true" /></td>
              <td class="hid-480">
                <span v-for="c in s.categories" :key="c" class="tag tag-sm">
                  {{ t(`category.${c}`) }}
                </span>
              </td>
              <td class="hid-768">
                {{ s.leadTime }} <span>{{ t('suppliers.days') }}</span>
              </td>
              <td class="hid-768">{{ s.lastBccDate ?? 'Never' }}</td>
              <td class="hid-600">
                <a :href="`mailto:${s.email}`" class="link">{{ s.email }}</a>
              </td>
              <td>
                <div class="table-actions">
                  <router-link
                    v-tooltip="t('tooltip.view_details')"
                    :to="{ name: 'admin-supplier-card', params: { id: s.id } }"
                    class="action-icon-btn action-edit"
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
                  <router-link
                    v-tooltip="t('tooltip.send_bcc')"
                    :to="{ name: 'admin-bcc-request', query: { supplier: s.id } }"
                    class="action-icon-btn action-success"
                  >
                    <SvgIcon name="email" :width="16" :height="16" />
                  </router-link>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="8">
                <div class="pagination-bar" data-test="suppliers-pagination">
                  <div class="page-size" data-test="suppliers-page-size">
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
                      @click="pagination.prev"
                    >
                      <SvgIcon
                        name="chevron-right"
                        :width="14"
                        :height="14"
                        style="transform: rotate(180deg)"
                      />
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
                      @click="pagination.next"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14" />
                    </button>
                  </div>
                  <div class="pagination-info">
                    <span>{{ pagination.showingFrom.value }}-{{ pagination.showingTo.value }}</span>
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
  </div>

  <!-- KANBAN VIEW -->
  <div
    v-if="showKanbanView"
    v-show="view === 'kanban'"
    class="col-right"
    data-test="suppliers-kanban-view"
  >
    <div class="kanban-board" data-test="suppliers-kanban-board">
      <GlassPanel
        v-for="col in KANBAN_COLUMNS"
        :key="col.status"
        :title="t(col.titleKey)"
        :badge="String(suppliersByStatus(col.status).length)"
        :loading="loading"
        :skeleton-rows="3"
        :data-test="`suppliers-kanban-column-${col.status}`"
      >
        <div class="kanban-column" :data-status="col.status">
          <KanbanCard
            v-for="s in suppliersByStatus(col.status)"
            :id="s.id"
            :key="s.id"
            :company-name="s.company"
            :has-deficit="s.hasDeficit"
            :rating="s.rating"
            :categories="s.categories.map((c) => t(`category.${c}`))"
            :lead-time="s.leadTime"
            data-test="suppliers-kanban-card"
          />
        </div>
      </GlassPanel>
    </div>
  </div>

  <AppModal
    v-model="confirmMoveOpen"
    :title="t('modal.confirm_move_title')"
    size="small"
    data-test="suppliers-confirm-move-modal"
  >
    <p v-if="pendingMove">
      {{
        t('modal.confirm_move_message', {
          company: pendingMove.company,
          from: t(`st.${pendingMove.fromStatus}`),
          to: t(`st.${pendingMove.toStatus}`),
        })
      }}
    </p>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="cancelMove">
        {{ t('btn.cancel') }}
      </button>
      <button type="button" class="btn btn-primary" @click="confirmMove">
        {{ t('btn.confirm', 'Confirm') }}
      </button>
    </template>
  </AppModal>
</template>

<style>
/* Stretch kanban columns to full panel height so drag-over highlight covers the whole column */
.kanban-board .glass-panel {
  display: flex;
  flex-direction: column;
}
.kanban-board .glass-panel .panel-body {
  flex: 1;
  display: flex;
}
.kanban-board .kanban-column {
  flex: 1;
  min-height: 100%;
}

/* Pagination dropdown — open upward so it sits over the table, not below the panel */
.custom-select-list.open-up {
  top: auto;
  bottom: calc(100% + 8px);
  transform: translateY(10px);
}
.custom-select-list.open-up.open {
  transform: translateY(0);
}

/* Make sure the table wrapper doesn't clip upward-opening dropdowns */
.data-table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
}
.data-table tfoot td {
  position: relative;
}
</style>
