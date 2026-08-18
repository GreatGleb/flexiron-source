<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect, { type SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import Pagination from '@/components/admin/ui/Pagination.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import { useAuditFeed } from '@/composables/useAuditFeed'
import { useTranslatedField } from '@/composables/useTranslatedData'
import {
  AUDIT_ENTITY_ROUTES,
  AUDIT_ENTITY_TYPES,
  auditRowKey,
  type AuditFeedRow,
} from '@/types/audit'
import '@styles/admin/settings_logs.css'

const { t } = useI18n()
const { tf } = useTranslatedField()

const {
  rows,
  users,
  loading,
  deleting,
  error,
  pagination,
  page,
  pageSize,
  total,
  filters,
  hasActiveFilters,
  load,
  loadUsers,
  removeEntry,
  resetFilters,
} = useAuditFeed()

const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const pageSizeStr = computed({
  get: () => String(pageSize.value),
  set: (v: string) => {
    pageSize.value = Number(v)
  },
})

const entityOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('auditLog.filter_entity_all') },
  ...AUDIT_ENTITY_TYPES.map((type) => ({
    value: type,
    label: t(`auditLog.entity_${type}`),
  })),
])

const userOptions = computed<SelectOption[]>(() => [
  { value: '', label: t('auditLog.filter_user_all') },
  ...users.value.map((u) => ({ value: u.key, label: tf(u.name) })),
])

/**
 * The row the delete modal is about, held as the whole row rather than an index
 * or an entry id: an entry id repeats across entities, and the list re-sorts
 * under the modal while it is open.
 */
/**
 * Rows paired with their key, computed once.
 *
 * `:key` and the `data-row-key` a test reads must be the same string: if the
 * template computed them separately, one could be narrowed to the entry id while
 * the other stayed composite, and nothing would notice.
 */
const keyedRows = computed(() => rows.value.map((row) => ({ key: auditRowKey(row), row })))

const rowToDelete = ref<AuditFeedRow | null>(null)
const rowToDeleteKey = computed(() => (rowToDelete.value ? auditRowKey(rowToDelete.value) : null))

function askDelete(row: AuditFeedRow) {
  rowToDelete.value = row
}

async function confirmDelete() {
  const row = rowToDelete.value
  if (!row || deleting.value) return
  const ok = await removeEntry(row)
  if (ok) rowToDelete.value = null
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(() => {
  load()
  loadUsers()
})
</script>

<template>
  <div class="settings-logs" data-test="settings-logs">
    <div class="settings-logs-header">
      <div>
        <h2 class="settings-logs-title">{{ t('auditLog.header_title') }}</h2>
        <p class="settings-logs-subtitle">{{ t('auditLog.subtitle') }}</p>
      </div>
      <span class="settings-logs-total" data-test="audit-log-total">
        {{ t('auditLog.total', { count: total }) }}
      </span>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="6" data-test="audit-log-panel">
      <div class="settings-logs-filters" data-test="audit-log-filters">
        <SearchInput
          v-model="filters.search"
          :placeholder="t('auditLog.search_placeholder')"
          data-test="audit-log-search"
        />
        <CustomSelect
          v-model="filters.entityType"
          :options="entityOptions"
          data-test="audit-log-entity-filter"
        />
        <CustomSelect
          v-model="filters.user"
          :options="userOptions"
          data-test="audit-log-user-filter"
        />
        <div class="filter-group">
          <label class="field-label">{{ t('auditLog.filter_date_from') }}</label>
          <DatePicker
            v-model="filters.dateFrom"
            :placeholder="t('auditLog.filter_date_from')"
            data-test="audit-log-date-from"
          />
        </div>
        <div class="filter-group">
          <label class="field-label">{{ t('auditLog.filter_date_to') }}</label>
          <DatePicker
            v-model="filters.dateTo"
            :placeholder="t('auditLog.filter_date_to')"
            data-test="audit-log-date-to"
          />
        </div>
        <button
          v-if="hasActiveFilters"
          type="button"
          class="btn btn-secondary"
          data-test="audit-log-reset-filters"
          @click="resetFilters"
        >
          {{ t('auditLog.btn_reset_filters') }}
        </button>
      </div>

      <div v-if="error" class="error-state" data-test="audit-log-error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('auditLog.btn_retry') }}</button>
      </div>

      <div
        v-else-if="!loading && rows.length === 0"
        class="empty-state"
        data-test="audit-log-empty"
      >
        <SvgIcon name="file-text" :width="48" :height="48" />
        <p>{{ hasActiveFilters ? t('auditLog.empty_filtered') : t('auditLog.empty') }}</p>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('auditLog.col_time') }}</th>
              <th>{{ t('auditLog.col_entity') }}</th>
              <th>{{ t('auditLog.col_user') }}</th>
              <th>{{ t('auditLog.col_property') }}</th>
              <th>{{ t('auditLog.col_change') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in keyedRows"
              :key="item.key"
              class="audit-log-row"
              data-test="audit-log-row"
              :data-row-key="item.key"
            >
              <td class="audit-log-time">{{ formatTimestamp(item.row.timestamp) }}</td>
              <td>
                <router-link
                  :to="{
                    name: AUDIT_ENTITY_ROUTES[item.row.entityType],
                    params: { id: item.row.entityId },
                  }"
                  class="name-link"
                  :title="t('auditLog.open_entity')"
                  data-test="audit-log-entity-link"
                >
                  <span class="audit-log-kind">{{
                    t(`auditLog.entity_${item.row.entityType}`)
                  }}</span>
                  <span class="audit-log-label">{{ item.row.entityLabel }}</span>
                </router-link>
              </td>
              <td>
                <span class="audit-log-user">
                  <span class="audit-log-initials">{{ item.row.userInitials }}</span>
                  {{ tf(item.row.user) }}
                </span>
              </td>
              <td>{{ tf(item.row.property) }}</td>
              <td class="audit-log-change">
                <span class="audit-diff-old">{{ item.row.oldValue || '—' }}</span>
                <span class="audit-diff-arrow">→</span>
                <span class="audit-diff-new">{{ item.row.newValue || '—' }}</span>
              </td>
              <td class="audit-log-actions">
                <button
                  v-tooltip="t('auditLog.btn_delete')"
                  type="button"
                  class="action-icon-btn action-danger"
                  data-test="audit-log-delete-btn"
                  @click="askDelete(item.row)"
                >
                  <SvgIcon name="trash" :width="16" :height="16" />
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="total > 0">
            <tr>
              <td colspan="6">
                <Pagination
                  v-model:page="page"
                  v-model:size="pageSizeStr"
                  :total-pages="pagination.totalPages.value"
                  :pages="pagination.pageNumbers()"
                  :page-size-options="PAGE_SIZE_OPTIONS"
                  :showing-from="pagination.showingFrom.value"
                  :showing-to="pagination.showingTo.value"
                  :total="total"
                  test-id="audit-log-pagination"
                  page-test-prefix="audit-log-page-"
                  prev-test-id="audit-log-prev"
                  next-test-id="audit-log-next"
                />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassPanel>

    <AppModal
      :model-value="rowToDelete !== null"
      :title="t('auditLog.delete_title')"
      size="small"
      data-test="audit-log-delete-modal"
      :data-row-key="rowToDeleteKey"
      @update:model-value="rowToDelete = null"
    >
      <p>{{ t('auditLog.delete_confirm') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="deleting"
          data-test="audit-log-delete-cancel"
          @click="rowToDelete = null"
        >
          {{ t('auditLog.btn_cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="deleting"
          data-test="audit-log-delete-confirm"
          @click="confirmDelete"
        >
          {{ t('auditLog.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
