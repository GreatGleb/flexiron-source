import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useSettings } from '@/composables/useSettings'
import {
  createOrder,
  patchOrder,
  addOrderItem,
  addOrderService,
  addOrderFile,
} from '@/services/ordersService'
import { getClients } from '@/services/clientsService'
import type { Order, OrderDocumentType, OrderItem, OrderService, OrderFile } from '@/types/order'
import type { Client } from '@/types/client'
import type { UploadedFile } from '@/services/uploadsService'
import {
  buildOrderItem,
  buildOrderService,
  pricingSeedFor,
  toPricingLine,
} from '@/services/orderLines'
import { round2, rollupOrder } from '@/domain/orderPricing'

export function useOrderCreate() {
  const { t } = useI18n()
  const toast = useToast()
  const { settings } = useSettings()

  const form = ref<{
    clientId: string | null
    documentType: OrderDocumentType
    notes: string | null
    currency: string
  }>({
    clientId: null,
    documentType: 'local',
    notes: null,
    currency: settings.constants.defaultCurrency,
  })

  const errors = ref<{ clientId?: string }>({})
  const saving = ref(false)
  const error = ref<string | null>(null)
  const clients = ref<Client[]>([])
  const loadingClients = ref(false)

  // ─── Local order state (for UI rendering before server creation) ────────
  const localOrder = ref<{
    items: OrderItem[]
    services: OrderService[]
    files: OrderFile[]
    totalCost: number
    totalAmount: number
    totalVat: number
    totalWithVat: number
    totalWeight: number
  }>({
    items: [],
    services: [],
    files: [],
    totalCost: 0,
    totalAmount: 0,
    totalVat: 0,
    totalWithVat: 0,
    totalWeight: 0,
  })

  // ─── Pending changes to flush after order creation ────────────────────
  const pendingItems = ref<
    Array<{
      productId: string
      productName: string
      quantity: number
      unit: string
      unitPrice: number
    }>
  >([])

  const pendingServices = ref<
    Array<{
      serviceId: string
      serviceName: string
      quantity: number
      price: number
    }>
  >([])

  const pendingFileAdds = ref<string[]>([])

  const hasPendingChanges = computed(
    () =>
      pendingItems.value.length > 0 ||
      pendingServices.value.length > 0 ||
      pendingFileAdds.value.length > 0,
  )

  // ─── Computed for template convenience ─────────────────────────────────
  const totalAmount = computed(() => localOrder.value.totalAmount)
  const totalWeight = computed(() => localOrder.value.totalWeight)

  // ─── Client loading ────────────────────────────────────────────────────
  async function loadClients() {
    loadingClients.value = true
    try {
      const result = await getClients({
        search: '',
        status: null,
        sortBy: 'name',
        sortDir: 'asc',
        pageSize: 1000,
      })
      clients.value = result.items
    } catch (e) {
      error.value = String(e)
    } finally {
      loadingClients.value = false
    }
  }

  // ─── Validation ────────────────────────────────────────────────────────
  function validate(): boolean {
    errors.value = {}
    if (!form.value.clientId) {
      errors.value.clientId = t('orders.error_no_client')
      return false
    }
    return true
  }

  function clearError(field: 'clientId') {
    if (errors.value[field]) {
      const next = { ...errors.value }
      delete next[field]
      errors.value = next
    }
  }

  // ─── Item handlers (local only) ────────────────────────────────────────
  function addItem(
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

    const now = Date.now()
    const newItems: OrderItem[] = items.map((item, idx) => {
      const unitCost = item.unitCost ?? round2(item.unitPrice * 0.7)
      return buildOrderItem({
        // A guessed cost is marked as a guess, so reports can tell them apart.
        costSource: item.unitCost === undefined ? 'estimate' : 'stock',
        id: `temp-${now}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        lineNumber: localOrder.value.items.length + idx + 1,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitCost,
        ...pricingSeedFor(unitCost, item.unitPrice),
        receivedCurrency: 'cur-eur',
        exchangeRate: 1,
      })
    })

    localOrder.value = {
      ...localOrder.value,
      items: [...localOrder.value.items, ...newItems],
    }
    recalcLocalTotals()
  }

  function removeItem(lineId: string) {
    const removedItem = localOrder.value.items.find((i) => i.id === lineId)
    if (removedItem) {
      pendingItems.value = pendingItems.value.filter((pi) => pi.productId !== removedItem.productId)
    }
    localOrder.value = {
      ...localOrder.value,
      items: localOrder.value.items.filter((i) => i.id !== lineId),
    }
    recalcLocalTotals()
  }

  // ─── Service handlers (local only) ─────────────────────────────────────
  function addService(
    data:
      | Array<{
          serviceId: string
          serviceName: string
          quantity: number
          price: number
          cost?: number
        }>
      | {
          serviceId: string
          serviceName: string
          quantity: number
          price: number
          cost?: number
        },
  ) {
    const items = Array.isArray(data) ? data : [data]
    pendingServices.value = [...pendingServices.value, ...items]

    const now = Date.now()
    const newServices: OrderService[] = items.map((item, idx) =>
      buildOrderService({
        id: `temp-svc-${now}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        quantity: item.quantity,
        unitCost: item.cost ?? 0,
        ...pricingSeedFor(item.cost ?? 0, item.price),
      }),
    )

    localOrder.value = {
      ...localOrder.value,
      services: [...localOrder.value.services, ...newServices],
    }
    recalcLocalTotals()
  }

  function removeService(svcId: string) {
    const removed = localOrder.value.services.find((s) => s.id === svcId)
    if (removed) {
      pendingServices.value = pendingServices.value.filter(
        (ps) => ps.serviceId !== removed.serviceId,
      )
    }
    localOrder.value = {
      ...localOrder.value,
      services: localOrder.value.services.filter((s) => s.id !== svcId),
    }
    recalcLocalTotals()
  }

  // ─── File handlers (local only) ────────────────────────────────────────
  function onFilesUploaded(files: UploadedFile[]) {
    for (const f of files) {
      pendingFileAdds.value = [...pendingFileAdds.value, f.fileId]
      localOrder.value = {
        ...localOrder.value,
        files: [
          ...localOrder.value.files,
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
    pendingFileAdds.value = pendingFileAdds.value.filter((id) => id !== fileId)
    localOrder.value = {
      ...localOrder.value,
      files: localOrder.value.files.filter((f) => f.fileId !== fileId),
    }
  }

  // ─── Local totals ──────────────────────────────────────────────────────
  // Same pricing module as everywhere else: no second VAT rate, no invented
  // weight. A brand-new order is always standard-rated until the client and the
  // document type say otherwise, which happens after it is created.
  function recalcLocalTotals() {
    const lines = [...localOrder.value.items, ...localOrder.value.services].map(toPricingLine)
    const rolled = rollupOrder(lines, 'standard', settings.constants.vatRate)
    localOrder.value = {
      ...localOrder.value,
      totalCost: rolled.totalCost,
      totalAmount: rolled.totalNet,
      totalVat: rolled.totalVat,
      totalWithVat: rolled.totalGross,
      // Nothing to compute it from while products carry no weight.
      totalWeight: localOrder.value.totalWeight,
    }
  }

  // ─── Save: create order → patch notes → add items/services/files ────
  async function handleSave(): Promise<Order | null> {
    if (!validate()) {
      toast.error(t('orders.error_no_client'))
      return null
    }

    saving.value = true
    error.value = null

    try {
      // 1. Create the order
      const order = await createOrder({
        clientId: form.value.clientId!,
        documentType: form.value.documentType,
        currency: form.value.currency,
      })

      // 2. Patch notes if provided
      if (form.value.notes) {
        await patchOrder(order.id, { notes: form.value.notes })
      }

      // 3. Add pending items
      for (const item of pendingItems.value) {
        await addOrderItem(order.id, item)
      }

      // 4. Add pending services
      for (const svc of pendingServices.value) {
        await addOrderService(order.id, {
          serviceId: svc.serviceId,
          quantity: svc.quantity,
          price: svc.price,
        })
      }

      // 5. Add pending files
      for (const fileId of pendingFileAdds.value) {
        await addOrderFile(order.id, fileId)
      }

      toast.success(t('orders.toast_created'))
      return order
    } catch (e) {
      error.value = String(e)
      toast.error(t('orders.toast_error_create'))
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    // Form
    form,
    errors,
    saving,
    error,
    // Validation
    validate,
    clearError,
    // Clients
    clients,
    loadingClients,
    loadClients,
    // Local order state
    localOrder,
    totalAmount,
    totalWeight,
    // Pending changes
    pendingItems,
    pendingServices,
    pendingFileAdds,
    hasPendingChanges,
    // Actions
    addItem,
    removeItem,
    addService,
    removeService,
    onFilesUploaded,
    removeFile,
    handleSave,
  }
}
