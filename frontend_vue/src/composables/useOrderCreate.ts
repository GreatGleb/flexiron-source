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
  stockCostFor,
  toPricingLine,
} from '@/services/orderLines'
import { rollupOrder } from '@/domain/orderPricing'

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

  // ─── What will be sent after the order is created ─────────────────────
  //
  // There is no second list. `localOrder` is both the table on screen and the
  // thing that gets saved: a queue kept beside it drifted from it — it was
  // emptied by product, so removing one of two lines of the same product
  // removed both from the queue and the admin got an order that was missing a
  // line they were looking at when they pressed Save.
  const hasPendingChanges = computed(
    () =>
      localOrder.value.items.length > 0 ||
      localOrder.value.services.length > 0 ||
      localOrder.value.files.length > 0,
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
          /** The warehouse could not cover the whole line — the cost is an estimate. */
          hasShortage?: boolean
        }>
      | {
          productId: string
          productName: string
          quantity: number
          unit: string
          unitPrice: number
          unitCost?: number
          /** The warehouse could not cover the whole line — the cost is an estimate. */
          hasShortage?: boolean
        },
  ) {
    const items = Array.isArray(data) ? data : [data]

    const now = Date.now()
    const newItems: OrderItem[] = items.map((item, idx) => {
      // One rule for both sides — see `stockCostFor`. A product the warehouse
      // cannot cost gets no cost at all rather than an invented one, which is
      // also what the server will store when this line is created.
      const { unitCost, costSource } = stockCostFor(item.unitCost ?? null, item.hasShortage)
      return buildOrderItem({
        // A guessed cost is marked as a guess, so reports can tell them apart.
        costSource,
        id: `temp-${now}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
        lineNumber: localOrder.value.items.length + idx + 1,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitCost,
        ...pricingSeedFor(unitCost, item.unitPrice),
        receivedCurrency: 'cur-eur',
      })
    })

    localOrder.value = {
      ...localOrder.value,
      items: [...localOrder.value.items, ...newItems],
    }
    recalcLocalTotals()
  }

  function removeItem(lineId: string) {
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
    localOrder.value = {
      ...localOrder.value,
      services: localOrder.value.services.filter((s) => s.id !== svcId),
    }
    recalcLocalTotals()
  }

  // ─── File handlers (local only) ────────────────────────────────────────
  function onFilesUploaded(files: UploadedFile[]) {
    for (const f of files) {
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

      // 3. The lines, in the order they are on screen. Each line is sent once,
      //    including two lines of the same product: they are two lines.
      for (const item of localOrder.value.items) {
        await addOrderItem(order.id, {
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          // Sent explicitly, as on the card: the server would otherwise apply
          // the new order's default discount and the price would change under
          // the admin between the table they saw and the order they got.
          discountPercent: item.discountPercent,
        })
      }

      // 4. Services, same rule.
      for (const svc of localOrder.value.services) {
        await addOrderService(order.id, {
          serviceId: svc.serviceId,
          quantity: svc.quantity,
          price: svc.price,
          discountPercent: svc.discountPercent,
        })
      }

      // 5. Files
      for (const file of localOrder.value.files) {
        await addOrderFile(order.id, file.fileId)
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
