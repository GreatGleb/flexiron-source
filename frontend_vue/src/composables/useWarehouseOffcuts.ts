import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createOffcut, deleteOffcut } from '@/services/warehouseService'
import { useToast } from './useToast'
import type { OffcutCreatePayload, WarehouseOffcut } from '@/types/warehouse'

export function useWarehouseOffcuts() {
  const { t } = useI18n()
  const toast = useToast()

  const creating = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)

  async function create(data: OffcutCreatePayload): Promise<WarehouseOffcut> {
    creating.value = true
    error.value = null
    try {
      const offcut = await createOffcut(data)
      toast.success(t('warehouse.toast_offcut_created'))
      return offcut
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create offcut'
      error.value = msg
      toast.error(t('warehouse.toast_error_save'))
      throw e
    } finally {
      creating.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    deleting.value = true
    error.value = null
    try {
      await deleteOffcut(id)
      toast.success(t('warehouse.toast_offcut_deleted'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete offcut'
      error.value = msg
      toast.error(t('warehouse.toast_error_save'))
      throw e
    } finally {
      deleting.value = false
    }
  }

  return {
    creating,
    deleting,
    error,
    create,
    remove,
  }
}
