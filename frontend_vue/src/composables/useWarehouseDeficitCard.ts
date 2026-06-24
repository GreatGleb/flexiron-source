import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  getDeficitItem,
  patchDeficitItem,
  deleteDeficitItem,
  deleteDeficitAuditEntry,
} from '@/services/warehouseService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type {
  WarehouseDeficit,
  DeficitPatchPayload,
  DeficitPriority,
  DeficitStatus,
  StockAuditEntry,
} from '@/types/warehouse'

export function useWarehouseDeficitCard(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const deficit = ref<WarehouseDeficit | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<{
    priority: DeficitPriority
    status: DeficitStatus
    notes: string | null
  }>({
    priority: 'medium',
    status: 'open',
    notes: null,
  })

  const dirty = useDirtyCheck(form)

  const isAnythingDirty = computed(() => dirty.isDirty.value)

  // Audit
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  async function deleteAuditEntry(entryIndex: number) {
    try {
      await deleteDeficitAuditEntry(id, entryIndex)
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
      const data = await getDeficitItem(id)
      deficit.value = data
      form.value = {
        priority: data.priority,
        status: data.status,
        notes: data.notes,
      }
      dirty.capture()
      auditLog.value = data.auditLog ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load deficit item'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!deficit.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as DeficitPatchPayload
      const updated = await patchDeficitItem(id, delta)
      deficit.value = updated
      form.value = {
        priority: updated.priority,
        status: updated.status,
        notes: updated.notes,
      }
      dirty.capture()
      toast.success(t('warehouse.toast_deficit_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!deficit.value) return
    form.value = {
      priority: deficit.value.priority,
      status: deficit.value.status,
      notes: deficit.value.notes,
    }
    dirty.capture()
  }

  async function remove() {
    if (!deficit.value) return
    saving.value = true
    try {
      await deleteDeficitItem(id)
      toast.success(t('warehouse.toast_deficit_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'deficit' } })
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  return {
    deficit,
    loading,
    saving,
    error,
    form,
    isAnythingDirty,
    load,
    save,
    discard,
    remove,
    tf,
    auditLog,
    auditLoading,
    deleteAuditEntry,
  }
}
