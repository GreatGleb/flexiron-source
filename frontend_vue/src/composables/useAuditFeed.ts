import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePagination } from '@/composables/usePagination'
import { getAuditFeed, getAuditFeedUsers, deleteAuditFeedEntry } from '@/services/auditFeedService'
import { useToast } from '@/composables/useToast'
import {
  withoutRow,
  type AuditFeedFilters,
  type AuditFeedRow,
  type AuditFeedUser,
} from '@/types/audit'

/**
 * The merged audit feed.
 *
 * A row is named by entity type + entity id + entry id and by nothing else — an
 * entry id repeats across entities (`bch-au-1` exists on every batch that has a
 * history), and a position in the feed changes with every filter and deletion.
 * Selection, the delete target and the optimistic removal below all use that same
 * key, so they cannot disagree about which row is which.
 */
export function useAuditFeed() {
  const { t } = useI18n()
  const toast = useToast()

  const rows = ref<AuditFeedRow[]>([])
  const users = ref<AuditFeedUser[]>([])
  const loading = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)

  // The shared pagination composable, so the bar under the table is the shared
  // component fed by the shared page-window logic.
  const pagination = usePagination(25)
  const { page, pageSize, total } = pagination

  const filters = ref<AuditFeedFilters>({
    entityType: '',
    user: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  })

  const hasActiveFilters = computed(
    () =>
      !!filters.value.entityType ||
      !!filters.value.user ||
      !!filters.value.dateFrom ||
      !!filters.value.dateTo ||
      !!filters.value.search,
  )

  // Skeleton on the first load only: the search box lives inside the panel, and a
  // skeleton on every keystroke would hide the field and take the focus with it.
  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const result = await getAuditFeed(filters.value, {
        page: page.value,
        pageSize: pageSize.value,
      })
      rows.value = result.items
      total.value = result.total
      page.value = result.page
      initialized = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load the audit feed'
    } finally {
      loading.value = false
    }
  }

  async function loadUsers() {
    try {
      users.value = await getAuditFeedUsers()
    } catch {
      users.value = []
    }
  }

  /**
   * Deletes through the entity's own endpoint — the same one its card calls — and
   * then drops the row here by key.
   *
   * By key, not by index: the list is re-sorted and re-filtered under the user, and
   * an index would remove whatever now sits in that position. `load()` follows so
   * the total and the page count are the server's answer rather than a guess.
   */
  async function removeEntry(row: AuditFeedRow): Promise<boolean> {
    deleting.value = true
    try {
      await deleteAuditFeedEntry(row)
      rows.value = withoutRow(rows.value, row)
      total.value = Math.max(0, total.value - 1)
      toast.success(t('auditLog.toast_deleted'))
      await load()
      return true
    } catch {
      toast.error(t('auditLog.toast_error_delete'))
      return false
    } finally {
      deleting.value = false
    }
  }

  function resetFilters() {
    filters.value = { entityType: '', user: '', dateFrom: '', dateTo: '', search: '' }
  }

  // A filter change starts from page one: page 3 of the old list names nothing in
  // the new one.
  watch(
    filters,
    () => {
      page.value = 1
      load()
    },
    { deep: true },
  )
  watch(page, load)
  watch(pageSize, () => {
    page.value = 1
    load()
  })

  return {
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
  }
}
