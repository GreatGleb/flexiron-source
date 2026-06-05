import { ref, watch } from 'vue'
import { getClients, deleteClient } from '@/services/clientsService'
import { usePagination } from './usePagination'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useI18n } from 'vue-i18n'
import type { Client, ClientFilters } from '@/types/client'

export function useClients() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const items = ref<Client[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = ref<ClientFilters>({ search: '', status: null })
  const pagination = usePagination()
  const { page, pageSize, total, totalPages } = pagination

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const result = await getClients({
        ...filters.value,
        page: page.value,
        pageSize: pageSize.value,
      } as ClientFilters & { page: number; pageSize: number })
      items.value = result.items
      total.value = result.total
      initialized = true
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  // Reload when filters change — reset to page 1
  let skipNextPageWatch = false
  watch(filters, () => {
    skipNextPageWatch = page.value !== 1
    page.value = 1
    load()
  }, { deep: true })

  // Reload when pagination page/pageSize changes
  watch([page, pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  async function handleDelete(id: string) {
    try {
      await deleteClient(id)
      toast.success(t('clients.toast_deleted'))
      await load()
    } catch (e) {
      const msg = String(e)
      if (msg.includes('CONFLICT')) {
        toast.error(t('clients.toast_error_delete_conflict'))
      } else {
        toast.error(t('clients.toast_error_delete'))
      }
    }
  }

  return { items, loading, error, filters, page, pageSize, total, totalPages, pagination, load, handleDelete, tf }
}
