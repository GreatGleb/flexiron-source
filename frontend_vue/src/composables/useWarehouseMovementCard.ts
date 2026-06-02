import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMovement, deleteMovementAuditEntry } from '@/services/warehouseService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { WarehouseMovement, StockAuditEntry } from '@/types/warehouse'

export function useWarehouseMovementCard(id: string) {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const movement = ref<WarehouseMovement | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Audit
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  async function deleteAuditEntry(entryIndex: number) {
    try {
      await deleteMovementAuditEntry(id, entryIndex)
      auditLog.value = auditLog.value.filter((_, i) => i !== entryIndex)
      toast.success(t('warehouse.toast_audit_entry_deleted'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getMovement(id)
      movement.value = data
      auditLog.value = data.auditLog ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load movement'
    } finally {
      loading.value = false
    }
  }

  return {
    movement,
    loading,
    error,
    load,
    tf,
    auditLog,
    auditLoading,
    deleteAuditEntry,
  }
}
