import { ref } from 'vue'
import { getClient, patchClient, getClientAudit, deleteClientAuditEntry } from '@/services/clientsService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useI18n } from 'vue-i18n'
import type { Client } from '@/types/client'
import type { StockAuditEntry } from '@/types/warehouse'

export function useClientCard(id: string) {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const client = ref<Client | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  const dirty = useDirtyCheck(client)

  async function load() {
    loading.value = true
    error.value = null
    try {
      client.value = await getClient(id)
      dirty.capture()
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function loadAudit() {
    auditLoading.value = true
    try {
      auditLog.value = await getClientAudit(id)
    } catch {
      auditLog.value = []
    } finally {
      auditLoading.value = false
    }
  }

  async function deleteAuditEntry(entryIndex: number) {
    try {
      await deleteClientAuditEntry(id, entryIndex)
      auditLog.value = auditLog.value.filter((_, i) => i !== entryIndex)
      toast.success(t('clients.toast_audit_deleted'))
    } catch {
      toast.error(t('clients.toast_error_audit_delete'))
    }
  }

  async function save() {
    if (!client.value || !dirty.isDirty.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as Partial<Client>
      if (Object.keys(delta).length === 0) return
      await patchClient(id, delta)
      toast.success(t('clients.toast_saved'))
      dirty.capture()
    } catch (e) {
      toast.error(t('clients.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    dirty.reset()
    load()
  }

  return { client, loading, saving, error, isDirty: dirty.isDirty, load, save, discard, tf, auditLog, auditLoading, loadAudit, deleteAuditEntry }
}
