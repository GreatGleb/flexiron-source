import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  getBatch,
  patchBatch,
  deleteBatch,
  createMovement,
  getMovements,
  getOffcuts,
  getBatchAudit,
  deleteBatchAuditEntry,
  getBatchAggregates,
  getBatchActiveSales,
} from '@/services/warehouseService'
import type { UploadedFile } from '@/services/uploadsService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useSettings } from './useSettings'
import type {
  WarehouseBatch,
  BatchPatchPayload,
  BatchStatus,
  StockUnit,
  MovementListItem,
  OffcutListItem,
  StockAuditEntry,
  MovementCreatePayload,
  BatchStatusAggregate,
  BatchActiveSale,
} from '@/types/warehouse'

// ─── Location parse / compose helpers ────────────────────────────────────
// Format: "Rack: X | Row: Y | Cell: Z\nNotes: ..."
const LOCATION_RACK_RE = /Rack:\s*(.*?)\s*\|/
const LOCATION_ROW_RE = /\|\s*Row:\s*(.*?)\s*\|/
const LOCATION_CELL_RE = /\|\s*Cell:\s*(.*?)(?:\n|$)/
const LOCATION_NOTES_RE = /\nNotes:\s*(.*)$/

function parseLocation(raw: string | null): {
  locationRack: string
  locationRow: string
  locationCell: string
  locationNotes: string
} {
  const fallback = { locationRack: '', locationRow: '', locationCell: '', locationNotes: '' }
  if (!raw) return fallback

  const rackMatch = raw.match(LOCATION_RACK_RE)
  const rowMatch = raw.match(LOCATION_ROW_RE)
  const cellMatch = raw.match(LOCATION_CELL_RE)
  const notesMatch = raw.match(LOCATION_NOTES_RE)

  if (rackMatch || rowMatch || cellMatch) {
    return {
      locationRack: rackMatch?.[1]?.trim() ?? '',
      locationRow: rowMatch?.[1]?.trim() ?? '',
      locationCell: cellMatch?.[1]?.trim() ?? '',
      locationNotes: notesMatch?.[1]?.trim() ?? '',
    }
  }

  // Legacy format — put the whole string into rack as fallback
  return { ...fallback, locationRack: raw }
}

function composeLocation(rack: string, row: string, cell: string, notes: string): string | null {
  const parts: string[] = []
  if (rack || row || cell) {
    parts.push(`Rack: ${rack} | Row: ${row} | Cell: ${cell}`)
  }
  if (notes) {
    parts.push(`Notes: ${notes}`)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

export function useWarehouseBatch(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()
  const { settings } = useSettings()

  const batch = ref<WarehouseBatch | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const deleteBlockedByOrder = ref(false)

  const form = ref<{
    batchNumber: string
    lotCode: string
    quantity: number
    unit: StockUnit
    unitPrice: number
    marginPercent: number | null
    currency: string
    locationRack: string
    locationRow: string
    locationCell: string
    locationNotes: string
    certificateRef: string | null
    status: BatchStatus
    notes: string | null
  }>({
    batchNumber: '',
    lotCode: '',
    quantity: 0,
    unit: 'kg',
    unitPrice: 0,
    marginPercent: settings.constants.defaultMargin,
    currency: 'EUR',
    locationRack: '',
    locationRow: '',
    locationCell: '',
    locationNotes: '',
    certificateRef: null,
    status: 'available',
    notes: null,
  })

  const dirty = useDirtyCheck(form)

  // Deep clone of the original batch.files so we can detect removals and restore on discard
  const originalFiles = ref<WarehouseBatch['files']>([])

  const isAnythingDirty = computed(() => {
    // Form field changes
    if (dirty.isDirty.value) return true
    // File additions (pending uploads not yet saved)
    if (fileIdsToAttach.value.length > 0) return true
    // File removals (files deleted from batch.files that were originally present)
    // Always access batch.value.files outside conditional to ensure Vue tracks it
    // as a dependency, even when originalFiles is empty.
    if (batch.value) {
      // Touch files array so Vue tracks mutations/reassignments to it
      const currentFiles = batch.value.files
      if (originalFiles.value.length > 0) {
        const currentIds = currentFiles.map((f) => f.id)
        if (originalFiles.value.some((f) => !currentIds.includes(f.id))) return true
      }
    }
    return false
  })

  const movements = ref<MovementListItem[]>([])
  const movementsLoading = ref(false)

  const batchAggregates = ref<BatchStatusAggregate[]>([])
  const batchAggregatesLoading = ref(false)

  const batchActiveSales = ref<BatchActiveSale[]>([])
  const batchActiveSalesLoading = ref(false)

  const offcuts = ref<OffcutListItem[]>([])
  const offcutsLoading = ref(false)

  // Audit log
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  const fileIdsToAttach = ref<string[]>([])

  function onFilesUploaded(uploaded: UploadedFile[]) {
    if (!batch.value) return
    if (!batch.value.files) batch.value.files = []
    for (const u of uploaded) {
      batch.value.files.push({
        id: u.fileId,
        name: { ru: u.name, en: u.name, lt: u.name },
        size: u.size,
        type: u.mime,
        uploadedAt: u.uploadedAt.slice(0, 10),
      })
      fileIdsToAttach.value.push(u.fileId)
    }
  }

  function removeFile(fileId: string) {
    if (!batch.value) return
    if (!batch.value.files) return
    batch.value.files = batch.value.files.filter((f) => f.id !== fileId)
    fileIdsToAttach.value = fileIdsToAttach.value.filter((id) => id !== fileId)
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getBatch(id)
      batch.value = data
      const parsed = parseLocation(data.location)
      form.value = {
        batchNumber: data.batchNumber,
        lotCode: data.lotCode,
        quantity: data.quantity,
        unit: data.unit,
        unitPrice: data.unitPrice,
        marginPercent: data.marginPercent ?? settings.constants.defaultMargin,
        currency: data.currency,
        locationRack: parsed.locationRack,
        locationRow: parsed.locationRow,
        locationCell: parsed.locationCell,
        locationNotes: parsed.locationNotes,
        certificateRef: data.certificateRef,
        status: data.status,
        notes: data.notes,
      }
      dirty.capture()
      // Deep-clone original files for removal detection and discard restoration
      originalFiles.value = data.files ? JSON.parse(JSON.stringify(data.files)) : []
      fileIdsToAttach.value = []

      await Promise.all([
        loadMovements(),
        loadOffcuts(),
        loadAudit(),
        loadBatchAggregates(),
        loadBatchActiveSales(),
      ])
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load batch'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!batch.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as BatchPatchPayload
      // Compose location sub-fields into a single string for the API
      const newLocation = composeLocation(
        form.value.locationRack,
        form.value.locationRow,
        form.value.locationCell,
        form.value.locationNotes,
      )
      delta.location = newLocation
      // Capture old location before patch (for movement detection)
      const oldLocation = batch.value.location
      // Attach any pending file IDs
      if (fileIdsToAttach.value.length) {
        delta.fileIds = [...fileIdsToAttach.value]
      }
      const updated = await patchBatch(id, delta)
      fileIdsToAttach.value = []
      batch.value = updated

      // ─── Auto-create transfer movement on location change ──────────────
      if (oldLocation !== newLocation) {
        try {
          await createMovement({
            type: 'transfer',
            batchId: updated.id,
            quantity: updated.quantityRemaining,
            fromLocation: oldLocation,
            toLocation: newLocation,
            movedAt: new Date().toISOString(),
            notes: t('warehouse.movement_auto_location_change'),
          })
          toast.success(t('warehouse.toast_movement_auto_created'))
        } catch {
          toast.info(t('warehouse.toast_movement_auto_failed'))
        }
        await loadMovements()
      }

      const parsed = parseLocation(updated.location)
      form.value = {
        batchNumber: updated.batchNumber,
        lotCode: updated.lotCode,
        quantity: updated.quantity,
        unit: updated.unit,
        unitPrice: updated.unitPrice,
        marginPercent: updated.marginPercent ?? settings.constants.defaultMargin,
        currency: updated.currency,
        locationRack: parsed.locationRack,
        locationRow: parsed.locationRow,
        locationCell: parsed.locationCell,
        locationNotes: parsed.locationNotes,
        certificateRef: updated.certificateRef,
        status: updated.status,
        notes: updated.notes,
      }
      dirty.capture()
      // Re-capture original files after save (server now has the new file set)
      originalFiles.value = updated.files ? JSON.parse(JSON.stringify(updated.files)) : []
      toast.success(t('warehouse.toast_batch_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!batch.value) return
    const parsed = parseLocation(batch.value.location)
    form.value = {
      batchNumber: batch.value.batchNumber,
      lotCode: batch.value.lotCode,
      quantity: batch.value.quantity,
      unit: batch.value.unit,
      unitPrice: batch.value.unitPrice,
      marginPercent: batch.value.marginPercent ?? settings.constants.defaultMargin,
      currency: batch.value.currency,
      locationRack: parsed.locationRack,
      locationRow: parsed.locationRow,
      locationCell: parsed.locationCell,
      locationNotes: parsed.locationNotes,
      certificateRef: batch.value.certificateRef,
      status: batch.value.status,
      notes: batch.value.notes,
    }
    // Restore removed files from the original snapshot
    batch.value.files = JSON.parse(JSON.stringify(originalFiles.value))
    fileIdsToAttach.value = []
    dirty.capture()
  }

  async function remove() {
    if (!batch.value) return
    saving.value = true
    deleteBlockedByOrder.value = false
    try {
      await deleteBatch(id)
      toast.success(t('warehouse.toast_batch_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'batches' } })
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err?.code === 'BATCH_LINKED_TO_ORDER' || err?.message === 'BATCH_LINKED_TO_ORDER') {
        deleteBlockedByOrder.value = true
      } else {
        toast.error(t('warehouse.toast_error_save'))
      }
    } finally {
      saving.value = false
    }
  }

  async function loadMovements() {
    if (!batch.value) return
    movementsLoading.value = true
    try {
      const response = await getMovements(
        { search: '', batchNumber: batch.value.batchNumber, sortBy: 'movedAt', sortDir: 'desc' },
        { page: 1, pageSize: 50 },
      )
      movements.value = response.items
    } catch {
      movements.value = []
    } finally {
      movementsLoading.value = false
    }
  }

  async function loadBatchAggregates() {
    if (!batch.value) return
    batchAggregatesLoading.value = true
    try {
      batchAggregates.value = await getBatchAggregates(batch.value.id)
    } catch {
      batchAggregates.value = []
    } finally {
      batchAggregatesLoading.value = false
    }
  }

  async function loadBatchActiveSales() {
    if (!batch.value) return
    batchActiveSalesLoading.value = true
    try {
      batchActiveSales.value = await getBatchActiveSales(batch.value.id)
    } catch {
      batchActiveSales.value = []
    } finally {
      batchActiveSalesLoading.value = false
    }
  }

  const movementSaving = ref(false)

  /**
   * Create a movement for the current batch and refresh data.
   * Supports all movement types: receipt, expense, write-off, return, return-to-supplier, correction, production.
   */
  async function createBatchMovement(data: {
    type: MovementCreatePayload['type']
    quantity: number
    notes?: string | null
    movedAt?: string
  }): Promise<boolean> {
    if (!batch.value) return false
    movementSaving.value = true
    try {
      await createMovement({
        type: data.type,
        batchId: batch.value.id,
        quantity: data.quantity,
        notes: data.notes ?? null,
        movedAt: data.movedAt ?? new Date().toISOString(),
      })
      await Promise.all([loadMovements(), load()])
      toast.success(t('warehouse.toast_movement_created'))
      return true
    } catch {
      toast.error(t('warehouse.toast_error_save'))
      return false
    } finally {
      movementSaving.value = false
    }
  }

  async function loadOffcuts() {
    if (!batch.value) return
    offcutsLoading.value = true
    try {
      const response = await getOffcuts(
        { search: '', batchNumber: batch.value.batchNumber },
        { page: 1, pageSize: 50 },
      )
      offcuts.value = response.items
    } catch {
      offcuts.value = []
    } finally {
      offcutsLoading.value = false
    }
  }

  async function loadAudit() {
    if (!batch.value) return
    auditLoading.value = true
    try {
      auditLog.value = await getBatchAudit(id)
    } catch {
      auditLog.value = []
    } finally {
      auditLoading.value = false
    }
  }

  async function deleteAuditEntry(entryIndex: number) {
    try {
      await deleteBatchAuditEntry(id, entryIndex)
      auditLog.value.splice(entryIndex, 1)
      toast.success(t('msg.audit_deleted'))
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  function resetDeleteBlocked() {
    deleteBlockedByOrder.value = false
  }

  return {
    batch,
    loading,
    saving,
    error,
    deleteBlockedByOrder,
    form,
    isAnythingDirty,
    movements,
    movementsLoading,
    movementSaving,
    batchAggregates,
    batchAggregatesLoading,
    batchActiveSales,
    batchActiveSalesLoading,
    offcuts,
    offcutsLoading,
    auditLog,
    auditLoading,
    load,
    save,
    discard,
    remove,
    resetDeleteBlocked,
    loadMovements,
    loadOffcuts,
    loadBatchAggregates,
    loadBatchActiveSales,
    deleteAuditEntry,
    createBatchMovement,
    onFilesUploaded,
    removeFile,
    tf,
  }
}
