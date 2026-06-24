import { ref, reactive, toRaw } from 'vue'
import {
  getClient,
  patchClient,
  getClientAudit,
  deleteClientAuditEntry,
  addClientInteraction,
  deleteClientInteraction,
} from '@/services/clientsService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useI18n } from 'vue-i18n'
import type { Client, InteractionHistoryEntry } from '@/types/client'
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

  const newInteraction = reactive<{
    type: 'call' | 'email' | 'note' | 'meeting'
    date: string
    summary: string
  }>({
    type: 'note',
    date: new Date().toISOString().slice(0, 10),
    summary: '',
  })

  /** Snapshot of interactionHistory taken at last capture (for computing diffs) */
  let capturedInteractions: InteractionHistoryEntry[] | null = null

  function resetNewInteraction() {
    newInteraction.type = 'note'
    newInteraction.date = new Date().toISOString().slice(0, 10)
    newInteraction.summary = ''
  }

  const dirty = useDirtyCheck(client)

  async function load() {
    loading.value = true
    error.value = null
    try {
      client.value = await getClient(id)
      dirty.capture()
      capturedInteractions = client.value.interactionHistory
        ? structuredClone(client.value.interactionHistory)
        : null
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

  function inlineAddInteraction() {
    if (!client.value) return
    if (!newInteraction.summary.trim()) return

    const entry: InteractionHistoryEntry = {
      type: newInteraction.type,
      date: newInteraction.date,
      summary: newInteraction.summary.trim(),
      user: 'Current User',
      rejectionReason: null,
    }

    if (!client.value.interactionHistory) {
      client.value.interactionHistory = []
    }
    client.value.interactionHistory.push(entry)
    resetNewInteraction()
  }

  function handleDeleteInteraction(entryIndex: number) {
    if (!client.value) return
    if (client.value.interactionHistory) {
      client.value.interactionHistory = client.value.interactionHistory.filter(
        (_, i) => i !== entryIndex,
      )
    }
  }

  async function save() {
    if (!client.value || !dirty.isDirty.value) return
    saving.value = true
    try {
      // 1. Save client fields (without interactionHistory)
      const delta = dirty.diff() as Partial<Client>
      const { interactionHistory: _, ...clientDelta } = delta
      if (Object.keys(clientDelta).length > 0) {
        await patchClient(id, clientDelta)
      }

      // 2. Save interaction changes via dedicated API endpoints
      const current = client.value.interactionHistory ?? []
      const prev = capturedInteractions ?? []

      // Find deleted entries: entries in prev that are NOT in current (by content)
      const indicesToDelete: number[] = []
      for (let i = 0; i < prev.length; i++) {
        const foundInCurrent = current.some((c) => JSON.stringify(c) === JSON.stringify(prev[i]))
        if (!foundInCurrent) {
          indicesToDelete.push(i)
        }
      }

      // Find added entries: entries in current that are NOT in prev (by content)
      // Use toRaw() to strip Vue reactivity before passing to API (structuredClone in mock fails on proxies)
      const entriesToAdd = current
        .filter((c) => !prev.some((p) => JSON.stringify(p) === JSON.stringify(c)))
        .map((c) => toRaw(c) as InteractionHistoryEntry)

      // Delete from highest index to lowest to avoid index shift on the server
      for (const idx of indicesToDelete.sort((a, b) => b - a)) {
        await deleteClientInteraction(id, idx)
      }

      // Add new entries (strip reactivity with toRaw to avoid structuredClone errors)
      for (const entry of entriesToAdd) {
        await addClientInteraction(id, entry)
      }

      // 3. Update snapshot and dirty state
      // Deep-unwrap reactivity: toRaw() on each element because filter() creates new array with proxy elements
      capturedInteractions =
        current.length > 0
          ? structuredClone(current.map((e) => toRaw(e)) as InteractionHistoryEntry[])
          : null
      dirty.capture()
      toast.success(t('clients.toast_saved'))
    } catch (e) {
      console.error('[useClientCard] save error:', e)
      toast.error(t('clients.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    dirty.reset()
    load()
  }

  return {
    client,
    loading,
    saving,
    error,
    isDirty: dirty.isDirty,
    load,
    save,
    discard,
    tf,
    auditLog,
    auditLoading,
    loadAudit,
    deleteAuditEntry,
    handleDeleteInteraction,
    newInteraction,
    inlineAddInteraction,
    resetNewInteraction,
  }
}
