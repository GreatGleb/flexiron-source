import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createMovement } from '@/services/warehouseService'
import { useToast } from './useToast'
import type { MovementCreatePayload, WarehouseMovement } from '@/types/warehouse'

export function useWarehouseMovement() {
  const { t } = useI18n()
  const toast = useToast()

  const creating = ref(false)
  const error = ref<string | null>(null)

  async function create(data: MovementCreatePayload): Promise<WarehouseMovement> {
    creating.value = true
    error.value = null
    try {
      const movement = await createMovement(data)
      toast.success(t('warehouse.toast_movement_created'))
      return movement
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create movement'
      error.value = msg
      toast.error(t('warehouse.toast_error_save'))
      throw e
    } finally {
      creating.value = false
    }
  }

  return {
    creating,
    error,
    create,
  }
}
