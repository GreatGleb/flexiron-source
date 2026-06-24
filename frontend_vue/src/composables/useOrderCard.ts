import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useDirtyCheck } from '@/composables/useDirtyCheck'
import { useTranslatedField } from '@/composables/useTranslatedData'
import { useSettings } from '@/composables/useSettings'
import {
  getOrder,
  patchOrder,
  patchOrderStatus,
  deleteOrder,
  addOrderItem,
  deleteOrderItem,
  addOrderService,
  deleteOrderService,
  deleteOrderAuditEntry,
  addOrderFile,
  removeOrderFile,
} from '@/services/ordersService'
import { getBatchCostBreakdown } from '@/services/warehouseService'
import type { Order, OrderStatus } from '@/types/order'
import type { StockAuditEntry } from '@/types/warehouse'
import type { UploadedFile } from '@/services/uploadsService'

interface OrderFormFields {
  totalAmount: number
  totalWeight: number
  notes: Order['notes']
  documentType: Order['documentType']
  currency: string
  orderDiscount: number
  costPrice: number
  vatPercent: number
  marginPercent: number
}

export function useOrderCard(id: string) {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()
  const { settings } = useSettings()
  const order = ref<Order | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // ─── Form state (editable fields, source for dirty check) ──────────────
  const form = ref<OrderFormFields>({
    totalAmount: 0,
    totalWeight: 0,
    notes: null,
    documentType: 'local',
    currency: settings.constants.defaultCurrency,
    orderDiscount: 0,
    costPrice: 0,
    vatPercent: settings.constants.vatRate,
    marginPercent: settings.constants.defaultMargin,
  })

  // ─── Pending changes (items, services, files) ────────────────────────
  const pendingItems = ref<
    Array<{
      productId: string
      productName: string
      quantity: number
      unit: string
      unitPrice: number
    }>
  >([])
  const pendingItemDeletions = ref<string[]>([])
  const pendingServices = ref<
    Array<{ serviceId: string; serviceName: string; quantity: number; price: number }>
  >([])
  const pendingServiceDeletions = ref<string[]>([])
  const pendingFileAdds = ref<string[]>([])
  const pendingFileRemoves = ref<string[]>([])

  const hasPendingChanges = computed(
    () =>
      pendingItems.value.length > 0 ||
      pendingItemDeletions.value.length > 0 ||
      pendingServices.value.length > 0 ||
      pendingServiceDeletions.value.length > 0 ||
      pendingFileAdds.value.length > 0 ||
      pendingFileRemoves.value.length > 0,
  )

  const { isDirty, capture, diff } = useDirtyCheck(form)

  // ─── Audit log ─────────────────────────────────────────────────────────
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  async function loadAudit() {
    auditLoading.value = true
    try {
      const o = await getOrder(id)
      auditLog.value = o.auditLog ?? []
    } catch {
      auditLog.value = []
    } finally {
      auditLoading.value = false
    }
  }

  async function deleteAuditEntry(index: number) {
    try {
      await deleteOrderAuditEntry(id, index)
      auditLog.value.splice(index, 1)
      toast.success(t('orders.toast_saved'))
    } catch {
      toast.error(t('orders.toast_error_save'))
    }
  }

  // ─── Local totals recalculation ────────────────────────────────────────
  function recalcLocalTotals() {
    if (!order.value) return
    const itemsTotal = order.value.items.reduce((sum, i) => sum + i.totalPrice, 0)
    const servicesTotal = order.value.services.reduce(
      (sum, s) => sum + (s.price ?? 0) * (s.quantity ?? 1),
      0,
    )
    const itemsWeight = order.value.items.reduce(
      (sum, i) => sum + parseFloat(String(i.quantity)) * 0.5,
      0,
    )
    const newAmount = itemsTotal + servicesTotal
    const discount = form.value.orderDiscount ?? 0
    const discountedAmount = newAmount * (1 - discount / 100)
    const newVat = Math.round(discountedAmount * 0.21 * 100) / 100
    const newWeight = Math.round(itemsWeight * 100) / 100
    order.value = {
      ...order.value,
      totalAmount: newAmount,
      totalVat: newVat,
      totalWithVat: discountedAmount + newVat,
      totalWeight: newWeight,
    }
    form.value.totalAmount = newAmount
    form.value.totalWeight = newWeight
  }

  // ─── Order CRUD ────────────────────────────────────────────────────────
  async function load() {
    loading.value = true
    error.value = null
    try {
      order.value = await getOrder(id)
      form.value = {
        totalAmount: order.value.totalAmount,
        totalWeight: order.value.totalWeight,
        notes: order.value.notes,
        documentType: order.value.documentType,
        currency: order.value.currency,
        orderDiscount: ((order.value as Record<string, unknown>).orderDiscount as number) ?? 0,
        costPrice: order.value.totalAmount,
        vatPercent: order.value.vatPercent ?? 21,
        marginPercent: order.value.marginPercent ?? settings.constants.defaultMargin,
      }
      capture()
      await loadAudit()
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!order.value || (!isDirty.value && !hasPendingChanges.value)) return
    saving.value = true
    try {
      // 1. Add new items (server recalculates totals — that's expected)
      for (const item of pendingItems.value) {
        await addOrderItem(id, item)
      }

      // 2. Delete removed items
      for (const lineId of pendingItemDeletions.value) {
        await deleteOrderItem(id, lineId)
      }

      // 3. Add new services
      for (const svc of pendingServices.value) {
        await addOrderService(id, {
          serviceId: svc.serviceId,
          quantity: svc.quantity,
          price: svc.price,
        })
      }

      // 4. Delete removed services
      for (const svcId of pendingServiceDeletions.value) {
        await deleteOrderService(id, svcId)
      }

      // 5. Add new files
      for (const fileId of pendingFileAdds.value) {
        await addOrderFile(id, fileId)
      }

      // 6. Remove deleted files
      for (const fileId of pendingFileRemoves.value) {
        await removeOrderFile(id, fileId)
      }

      // 7. Save form fields LAST — ensures manual edits to totalAmount/discount
      //    are the final write and aren't overwritten by item recalculations
      if (isDirty.value) {
        const delta = diff()
        if (Object.keys(delta).length > 0) {
          await patchOrder(id, delta)
        }
      }

      // Reload to get fresh state after all changes
      await load()
      // Clear pending changes — they've already been applied server-side
      pendingItems.value = []
      pendingItemDeletions.value = []
      pendingServices.value = []
      pendingServiceDeletions.value = []
      pendingFileAdds.value = []
      pendingFileRemoves.value = []
      toast.success(t('orders.toast_saved'))
    } catch {
      toast.error(t('orders.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  async function discard() {
    // Reset pending changes and reload
    pendingItems.value = []
    pendingItemDeletions.value = []
    pendingServices.value = []
    pendingServiceDeletions.value = []
    pendingFileAdds.value = []
    pendingFileRemoves.value = []
    await load()
  }

  async function remove(): Promise<boolean> {
    saving.value = true
    try {
      await deleteOrder(id)
      toast.success(t('orders.toast_deleted'))
      return true
    } catch {
      toast.error(t('orders.toast_error_delete'))
      return false
    } finally {
      saving.value = false
    }
  }

  // Quick-action: status change
  async function handleChangeStatus(status: OrderStatus) {
    try {
      await patchOrderStatus(id, status)
      toast.success(t('orders.toast_status_changed'))
      await load()
    } catch {
      toast.error(t('orders.toast_error_save'))
    }
  }

  // ─── Deferred items (accepts single item or array) ───────────────────
  async function handleAddItemDirect(
    data:
      | Array<{
          productId: string
          productName: string
          quantity: number
          unit: string
          unitPrice: number
          unitCost?: number
        }>
      | {
          productId: string
          productName: string
          quantity: number
          unit: string
          unitPrice: number
          unitCost?: number
        },
  ) {
    const items = Array.isArray(data) ? data : [data]
    pendingItems.value = [...pendingItems.value, ...items]
    // Update local order state for immediate UI feedback
    if (order.value) {
      // FIFO cost lookup — fetch actual cost from warehouse batches
      const fifoCosts = await Promise.all(
        items.map((item) =>
          getBatchCostBreakdown(item.productId, item.quantity ?? 1)
            .then((r) => r.unitPrice)
            .catch(() => null),
        ),
      )
      const newItems = items.map((item, idx) => {
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`
        const fifoCost = fifoCosts[idx]
        return {
          id: tempId,
          lineNumber: order.value!.items.length + idx + 1,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          unitCost: fifoCost ?? item.unitCost ?? Math.round(item.unitPrice * 0.7 * 100) / 100,
          discount: 0,
          totalPrice: item.quantity * item.unitPrice,
          batchId: null,
          offcutId: null,
          receivedCurrency: 'cur-eur',
          exchangeRate: 1,
        }
      })
      order.value = {
        ...order.value,
        items: [...order.value.items, ...newItems],
      }
      recalcLocalTotals()
    }
  }

  function handleDeleteItem(lineId: string) {
    pendingItemDeletions.value = [...pendingItemDeletions.value, lineId]
    // Update local order state for immediate UI feedback
    if (order.value) {
      order.value = {
        ...order.value,
        items: order.value.items.filter((i) => i.id !== lineId),
      }
      recalcLocalTotals()
    }
  }

  // ─── Deferred services ────────────────────────────────────────────────
  function handleAddServiceDirect(
    data:
      | Array<{
          serviceId: string
          serviceName: string
          quantity: number
          price: number
          cost?: number
        }>
      | { serviceId: string; serviceName: string; quantity: number; price: number; cost?: number },
  ) {
    const items = Array.isArray(data) ? data : [data]
    pendingServices.value = [...pendingServices.value, ...items]
    // Update local order state for immediate UI feedback
    if (order.value) {
      const now = Date.now()
      const newServices = items.map((item, idx) => ({
        id: `temp-svc-${now}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        cost: item.cost ?? 0,
        price: item.price,
        margin: item.price - (item.cost ?? 0),
        quantity: item.quantity,
      }))
      order.value = {
        ...order.value,
        services: [...order.value.services, ...newServices],
      }
      recalcLocalTotals()
    }
  }

  function handleDeleteService(svcId: string) {
    pendingServiceDeletions.value = [...pendingServiceDeletions.value, svcId]
    // Update local order state for immediate UI feedback
    if (order.value) {
      order.value = {
        ...order.value,
        services: order.value.services.filter((s) => s.id !== svcId),
      }
      recalcLocalTotals()
    }
  }

  // ─── Deferred files ───────────────────────────────────────────────────
  function onFilesUploaded(files: UploadedFile[]) {
    if (!order.value) return
    for (const f of files) {
      pendingFileAdds.value = [...pendingFileAdds.value, f.fileId]
      // Update local order state for immediate UI feedback
      order.value = {
        ...order.value,
        files: [
          ...order.value.files,
          {
            id: f.fileId,
            name: f.name,
            fileId: f.fileId,
            url: '#',
            size: f.size,
            mime: f.mime,
            uploadedAt: new Date().toISOString(),
          },
        ],
      }
    }
  }

  function removeFile(fileId: string) {
    pendingFileRemoves.value = [...pendingFileRemoves.value, fileId]
    // Update local order state for immediate UI feedback
    if (order.value) {
      order.value = {
        ...order.value,
        files: order.value.files.filter((f) => f.fileId !== fileId),
      }
    }
  }

  // Document generation placeholder
  async function handleGenerateDocument(_type: string) {
    toast.info(t('orders.toast_document_generated'))
  }

  return {
    form,
    order,
    loading,
    saving,
    error,
    isDirty,
    load,
    save,
    discard,
    remove,
    auditLog,
    auditLoading,
    loadAudit,
    deleteAuditEntry,
    handleChangeStatus,
    handleAddItemDirect,
    handleDeleteItem,
    handleAddServiceDirect,
    handleDeleteService,
    handleGenerateDocument,
    onFilesUploaded,
    removeFile,
    tf,
    pendingItems,
    pendingItemDeletions,
    pendingServices,
    pendingServiceDeletions,
    pendingFileAdds,
    pendingFileRemoves,
    hasPendingChanges,
  }
}
