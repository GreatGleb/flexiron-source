import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  getOffcut,
  patchOffcut,
  deleteOffcut,
  deleteOffcutAuditEntry,
  createMovement,
  getMovements,
  getBatch,
} from '@/services/warehouseService'
import { getProduct } from '@/services/productsService'
import { resolveOffcutWeight } from '@/domain/cutting'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type {
  WarehouseOffcut,
  OffcutPatchPayload,
  OffcutStatus,
  MovementType,
  StockAuditEntry,
  MovementListItem,
} from '@/types/warehouse'
import type { Product } from '@/types/product'
import type { UploadedFile } from '@/services/uploadsService'

// ─── Offcut status → Movement type mapping ──────────────────────────
const OFFCUT_STATUS_TO_MOVEMENT_TYPE: Record<OffcutStatus, MovementType> = {
  available: 'return',
  reserved: 'transfer',
  in_production: 'production',
  sold: 'sale',
  scrapped: 'write-off',
  expensed: 'expense',
  returned_to_supplier: 'return-to-supplier',
  in_storage: 'storage',
}

// ─── Location parse / compose helpers (same pattern as useWarehouseBatch) ──
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

export function useWarehouseOffcutCard(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const offcut = ref<WarehouseOffcut | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const deleteBlockedByOrder = ref(false)

  const form = ref<{
    status: OffcutStatus
    locationRack: string
    locationRow: string
    locationCell: string
    locationNotes: string
    notes: string | null
    /** Введённый руками вес. null — «пусть отвечает вывод». */
    weightKg: number | null
  }>({
    status: 'available',
    locationRack: '',
    locationRow: '',
    locationCell: '',
    locationNotes: '',
    notes: null,
    weightKg: null,
  })

  const dirty = useDirtyCheck(form)

  const isAnythingDirty = computed(() => {
    if (dirty.isDirty.value) return true
    // File additions (pending uploads not yet saved)
    if (fileIdsToAttach.value.length > 0) return true
    // File removals
    if (offcut.value) {
      const currentFiles = offcut.value.files
      if (originalFiles.value.length > 0) {
        const currentIds = currentFiles?.map((f) => f.id) ?? []
        if (originalFiles.value.some((f) => !currentIds.includes(f.id))) return true
      }
    }
    return false
  })

  // ─── Files ────────────────────────────────────────────────────────────────
  const fileIdsToAttach = ref<string[]>([])
  const originalFiles = ref<NonNullable<WarehouseOffcut['files']>>([])

  function onFilesUploaded(uploaded: UploadedFile[]) {
    if (!offcut.value) return
    if (!offcut.value.files) offcut.value.files = []
    for (const u of uploaded) {
      offcut.value.files.push({
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
    if (!offcut.value) return
    if (!offcut.value.files) return
    offcut.value.files = offcut.value.files.filter((f) => f.id !== fileId)
    fileIdsToAttach.value = fileIdsToAttach.value.filter((id) => id !== fileId)
  }

  // Movements
  const movements = ref<MovementListItem[]>([])
  const movementsLoading = ref(false)

  async function loadMovements() {
    if (!offcut.value) return
    movementsLoading.value = true
    try {
      const response = await getMovements(
        { search: '', offcutId: offcut.value.id, sortBy: 'movedAt', sortDir: 'desc' },
        { page: 1, pageSize: 50 },
      )
      movements.value = response.items
    } catch {
      movements.value = []
    } finally {
      movementsLoading.value = false
    }
  }

  // Audit
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  async function deleteAuditEntry(entryId: string) {
    try {
      await deleteOffcutAuditEntry(id, entryId)
      auditLog.value = auditLog.value.filter((entry) => entry.id !== entryId)
      toast.success(t('warehouse.toast_audit_entry_deleted'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getOffcut(id)
      offcut.value = data
      const parsed = parseLocation(data.location)
      form.value = {
        status: data.status,
        locationRack: parsed.locationRack,
        locationRow: parsed.locationRow,
        locationCell: parsed.locationCell,
        locationNotes: parsed.locationNotes,
        notes: data.notes,
        weightKg: data.weightKg,
      }
      dirty.capture()
      // Deep-clone original files for removal detection and discard restoration
      originalFiles.value = data.files ? JSON.parse(JSON.stringify(data.files)) : []
      fileIdsToAttach.value = []
      auditLog.value = data.auditLog
      await loadMovements()
      await loadBatchProduct(data.batchId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load offcut'
    } finally {
      loading.value = false
    }
  }

  /**
   * Товар ПАРТИИ — источник плотности и килограммов на складскую единицу.
   *
   * Не товар обрезка: `productId` обрезка это копия ссылки, разошедшаяся у десяти
   * записей из тринадцати (п. 4e). Партия — единственная настоящая ссылка.
   */
  const batchProduct = ref<Product | null>(null)

  async function loadBatchProduct(batchId: string) {
    batchProduct.value = null
    try {
      const batch = await getBatch(batchId)
      batchProduct.value = await getProduct(batch.productId)
    } catch {
      // Вывод веса просто откажет — с названной причиной, а не молча.
    }
  }

  /** Вес, посчитанный из размеров и материала: то, что будет, если убрать ручной ввод. */
  const derivedWeight = computed(() =>
    offcut.value
      ? resolveOffcutWeight({
          offcut: { ...offcut.value, quantity: 1 },
          product: batchProduct.value,
        })
      : null,
  )

  /**
   * Источник ВЫЧИСЛЯЕТСЯ, а не хранится: есть ручное значение — значит руками, нет —
   * значит вывод. Отдельное поле источника было бы третьей правдой об одном и том же.
   */
  const weightIsManual = computed(() => form.value.weightKg != null)

  /** Показываемый вес: ручной, если введён, иначе выведенный. */
  const shownWeightKg = computed<number | null>(() => {
    if (form.value.weightKg != null) return form.value.weightKg
    const derived = derivedWeight.value
    return derived?.ok ? derived.weightKg : null
  })

  /** Сброс к расчётному — это обнулить ручное, а не записать выведенное. */
  function useDerivedWeight() {
    form.value.weightKg = null
  }

  async function save() {
    if (!offcut.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as OffcutPatchPayload
      // Include pending file uploads
      if (fileIdsToAttach.value.length > 0) {
        ;(delta as OffcutPatchPayload & { fileIds: string[] }).fileIds = [...fileIdsToAttach.value]
      }
      // Compose location sub-fields into a single string for the API
      const newLocation = composeLocation(
        form.value.locationRack,
        form.value.locationRow,
        form.value.locationCell,
        form.value.locationNotes,
      )
      delta.location = newLocation
      // Capture old state before patch (for movement detection)
      const oldLocation = offcut.value.location
      const oldStatus = offcut.value.status
      const updated = await patchOffcut(id, delta)
      offcut.value = updated

      const movementsToCreate: Promise<unknown>[] = []

      // ─── Auto-create transfer movement on location change ──────────────
      if (oldLocation !== newLocation) {
        movementsToCreate.push(
          createMovement({
            type: 'transfer',
            offcutId: updated.id,
            batchId: updated.batchId,
            quantity: updated.quantity,
            fromLocation: oldLocation,
            toLocation: newLocation,
            movedAt: new Date().toISOString(),
            notes: t('warehouse.movement_auto_location_change'),
          }).catch(() => {}),
        )
      }

      // ─── Auto-create movement on status change ─────────────────────────
      if (delta.status && delta.status !== oldStatus) {
        const movementType = OFFCUT_STATUS_TO_MOVEMENT_TYPE[delta.status]
        movementsToCreate.push(
          createMovement({
            type: movementType,
            offcutId: updated.id,
            batchId: updated.batchId,
            quantity: updated.quantity,
            movedAt: new Date().toISOString(),
            notes: t(`warehouse.movement_offcut_${delta.status}`, { id: updated.id }),
          }).catch(() => {}),
        )
      }

      if (movementsToCreate.length > 0) {
        await Promise.all(movementsToCreate)
        if (oldLocation !== newLocation) {
          toast.success(t('warehouse.toast_movement_auto_created'))
        }
      }

      const parsed = parseLocation(updated.location)
      form.value = {
        status: updated.status,
        locationRack: parsed.locationRack,
        locationRow: parsed.locationRow,
        locationCell: parsed.locationCell,
        locationNotes: parsed.locationNotes,
        notes: updated.notes,
        weightKg: updated.weightKg,
      }
      dirty.capture()
      // Re-capture original files after save
      originalFiles.value = updated.files ? JSON.parse(JSON.stringify(updated.files)) : []
      fileIdsToAttach.value = []
      // Refresh movements list — status/location changes may have created new movements
      await loadMovements()
      toast.success(t('warehouse.toast_offcut_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!offcut.value) return
    const parsed = parseLocation(offcut.value.location)
    form.value = {
      status: offcut.value.status,
      locationRack: parsed.locationRack,
      locationRow: parsed.locationRow,
      locationCell: parsed.locationCell,
      locationNotes: parsed.locationNotes,
      notes: offcut.value.notes,
      weightKg: offcut.value.weightKg,
    }
    dirty.capture()
    // Restore removed files from the original snapshot
    offcut.value.files = JSON.parse(JSON.stringify(originalFiles.value))
    fileIdsToAttach.value = []
  }

  async function remove() {
    if (!offcut.value) return
    saving.value = true
    deleteBlockedByOrder.value = false
    try {
      await deleteOffcut(id)
      toast.success(t('warehouse.toast_offcut_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'offcuts' } })
    } catch (e) {
      if (e instanceof Error && e.message === 'OFFCUT_LINKED_TO_ORDER') {
        deleteBlockedByOrder.value = true
      } else {
        toast.error(t('warehouse.toast_error_save'))
      }
    } finally {
      saving.value = false
    }
  }

  function resetDeleteBlocked() {
    deleteBlockedByOrder.value = false
  }

  return {
    offcut,
    // Вес: показанное значение, откуда оно, и как вернуться к выведенному
    batchProduct,
    derivedWeight,
    weightIsManual,
    shownWeightKg,
    useDerivedWeight,
    loading,
    saving,
    error,
    deleteBlockedByOrder,
    form,
    isAnythingDirty,
    movements,
    movementsLoading,
    load,
    save,
    discard,
    remove,
    resetDeleteBlocked,
    tf,
    onFilesUploaded,
    removeFile,
    auditLog,
    auditLoading,
    deleteAuditEntry,
  }
}
