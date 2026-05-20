import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createDeficitItem, patchDeficitItem, deleteDeficitItem } from '@/services/warehouseService'
import { useToast } from './useToast'
import type { DeficitCreatePayload, DeficitPatchPayload, WarehouseDeficit } from '@/types/warehouse'

export function useWarehouseDeficit() {
  const { t } = useI18n()
  const toast = useToast()

  const creating = ref(false)
  const updating = ref(false)
  const deleting = ref(false)
  const error = ref<string | null>(null)

  async function create(data: DeficitCreatePayload): Promise<WarehouseDeficit> {
    creating.value = true
    error.value = null
    try {
      const deficit = await createDeficitItem(data)
      toast.success(t('warehouse.toast_deficit_created'))
      return deficit
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create deficit record'
      error.value = msg
      toast.error(t('warehouse.toast_error_save'))
      throw e
    } finally {
      creating.value = false
    }
  }

  async function update(id: string, delta: DeficitPatchPayload): Promise<WarehouseDeficit> {
    updating.value = true
    error.value = null
    try {
      const deficit = await patchDeficitItem(id, delta)
      toast.success(t('warehouse.toast_deficit_saved'))
      return deficit
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update deficit record'
      error.value = msg
      toast.error(t('warehouse.toast_error_save'))
      throw e
    } finally {
      updating.value = false
    }
  }

  async function remove(id: string): Promise<void> {
    deleting.value = true
    error.value = null
    try {
      await deleteDeficitItem(id)
      toast.success(t('warehouse.toast_deficit_deleted'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete deficit record'
      error.value = msg
      toast.error(t('warehouse.toast_error_save'))
      throw e
    } finally {
      deleting.value = false
    }
  }

  return {
    creating,
    updating,
    deleting,
    error,
    create,
    update,
    remove,
  }
}
