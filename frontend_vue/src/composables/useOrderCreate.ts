import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { useSettings } from '@/composables/useSettings'
import { usePagination } from '@/composables/usePagination'
import {
  createOrder,
  getOrder,
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
  baseCurrencyOf,
  buildOrderItem,
  buildOrderService,
  pricingSeedFor,
  stockCostFor,
  toPricingLine,
} from '@/services/orderLines'
import { rollupOrder, type VatMode } from '@/domain/orderPricing'

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
  /**
   * A failed load is not an empty directory.
   *
   * Kept apart from `clients` so the page can say which of the two happened: an
   * empty list under a broken request reads as "this company has no clients",
   * and the admin has no way to tell, nor anything to press.
   */
  const clientsError = ref<string | null>(null)
  /** The chosen client, kept whole — the selection has to survive paging away. */
  const selectedClient = ref<Client | null>(null)
  const clientSearch = ref('')
  const clientPagination = usePagination(5)

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
  //
  // Its one reader is the guard that asks before leaving the page, so it counts
  // everything the reader would lose — not only the lines. A chosen client and a
  // typed note used to leave without a word, while the guard's own comment said
  // nothing typed is worth losing to a mis-click.
  const hasPendingChanges = computed(
    () =>
      localOrder.value.items.length > 0 ||
      localOrder.value.services.length > 0 ||
      localOrder.value.files.length > 0 ||
      form.value.clientId !== null ||
      (form.value.notes ?? '').trim().length > 0,
  )

  // ─── Computed for template convenience ─────────────────────────────────
  const totalAmount = computed(() => localOrder.value.totalAmount)
  const totalWeight = computed(() => localOrder.value.totalWeight)

  // ─── Client loading ────────────────────────────────────────────────────
  //
  // Search and paging belong to the server, the same as on the clients list.
  // Asking for one page of a thousand and filtering it here looked like "load
  // everything": the client at position 1001 was unreachable and indistinguishable
  // from a client that does not exist, and the local filter searched name and
  // e-mail while the server also searches the company code — so the same query
  // found a client on one screen and nothing on this one.
  let clientsInitialized = false

  async function loadClients() {
    // Skeleton on the first load only. The search field lives inside the panel,
    // and `.glass-panel.loading .panel-body` hides it — re-showing it on every
    // keystroke would take the focus with it (pitfall #20).
    if (!clientsInitialized) loadingClients.value = true
    clientsError.value = null
    try {
      const result = await getClients({
        search: clientSearch.value,
        // Every client, active or not: refusing an order for a client somebody
        // marked inactive is a decision for the order rules, not for a picker.
        status: null,
        sortBy: 'name',
        sortDir: 'asc',
        page: clientPagination.page.value,
        pageSize: clientPagination.pageSize.value,
      })
      clients.value = result.items
      clientPagination.total.value = result.total
      clientsInitialized = true
    } catch (e) {
      clientsError.value = String(e)
      clients.value = []
      clientPagination.total.value = 0
    } finally {
      loadingClients.value = false
    }
  }

  // A new query starts from the first page; the page watcher below must not then
  // fire a second identical request — same guard as `useClients`.
  let skipNextPageWatch = false
  watch(clientSearch, () => {
    skipNextPageWatch = clientPagination.page.value !== 1
    clientPagination.page.value = 1
    loadClients()
  })

  watch([clientPagination.page, clientPagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    loadClients()
  })

  function selectClient(client: Client) {
    form.value.clientId = client.id
    selectedClient.value = client
    clearError('clientId')
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
        // The caption on a warehouse cost — see `baseCurrencyOf`.
        receivedCurrency: baseCurrencyOf(settings),
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
  //
  // Same pricing module as everywhere else: no second VAT rate, no invented
  // weight. The rate follows the document type, because that is what the server
  // does the moment the order is created — `mockCreateOrder` sets
  // `vatMode: documentType === 'export' ? 'export_zero' : 'standard'`. Reading it
  // as standard regardless meant an export order showed 21% here and came back
  // zero-rated: the totals on screen were not the totals being created.
  const vatMode = computed<VatMode>(() =>
    form.value.documentType === 'export' ? 'export_zero' : 'standard',
  )

  function recalcLocalTotals() {
    const lines = [...localOrder.value.items, ...localOrder.value.services].map(toPricingLine)
    const rolled = rollupOrder(lines, vatMode.value, settings.constants.vatRate)
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

  // Switching Local ↔ Export changes the rate, so the totals have to be redone —
  // they used to be recomputed only when a line was added or removed.
  watch(vatMode, recalcLocalTotals)

  // ─── Save: create order → patch notes → add items/services/files ────
  //
  // Creating an order is five kinds of request, and the order exists after the
  // first of them. So the whole thing has to be resumable: if a line is refused
  // half-way — and the server refuses lines on purpose, `ZERO_QUANTITY`,
  // `CATALOG_PRODUCT_NOT_FOUND`, a number that is not finite — the order is
  // already on the server. Starting over would create a second one and leave the
  // first half-built, while the admin was told nothing was created at all.
  //
  // What has already landed is remembered here, so pressing Create again finishes
  // the order that exists instead of beginning another.
  const createdOrderId = ref<string | null>(null)
  const notesSaved = ref(false)
  const savedLineIds = ref(new Set<string>())

  /** True once the order exists on the server — the next Save resumes it. */
  const isPartiallySaved = computed(() => createdOrderId.value !== null)

  async function handleSave(): Promise<Order | null> {
    if (!validate()) {
      toast.error(t('orders.error_no_client'))
      return null
    }

    saving.value = true
    error.value = null

    try {
      // 1. The order itself — once. On a retry it is already there.
      if (!createdOrderId.value) {
        const created = await createOrder({
          clientId: form.value.clientId!,
          documentType: form.value.documentType,
          currency: form.value.currency,
        })
        createdOrderId.value = created.id
      }
      const orderId = createdOrderId.value

      // 2. Patch notes if provided
      if (form.value.notes && !notesSaved.value) {
        await patchOrder(orderId, { notes: form.value.notes })
        notesSaved.value = true
      }

      // 3. The lines, in the order they are on screen. Each line is sent once,
      //    including two lines of the same product: they are two lines. The local
      //    id is what marks a line as sent — the same id the table is keyed by,
      //    so a duplicate product cannot mark its twin as done.
      for (const item of localOrder.value.items) {
        if (savedLineIds.value.has(item.id)) continue
        await addOrderItem(orderId, {
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          // Sent explicitly, as on the card: the server would otherwise apply
          // the new order's default discount and the price would change under
          // the admin between the table they saw and the order they got.
          discountPercent: item.discountPercent,
        })
        savedLineIds.value.add(item.id)
      }

      // 4. Services, same rule.
      for (const svc of localOrder.value.services) {
        if (savedLineIds.value.has(svc.id)) continue
        await addOrderService(orderId, {
          serviceId: svc.serviceId,
          quantity: svc.quantity,
          price: svc.price,
          discountPercent: svc.discountPercent,
        })
        savedLineIds.value.add(svc.id)
      }

      // 5. Files
      for (const file of localOrder.value.files) {
        if (savedLineIds.value.has(file.id)) continue
        await addOrderFile(orderId, file.fileId)
        savedLineIds.value.add(file.id)
      }

      toast.success(t('orders.toast_created'))
      // Read back rather than returning what `createOrder` answered: that copy
      // predates every line, and on a resumed save there is no such copy at all.
      return await getOrder(orderId)
    } catch (e) {
      error.value = String(e)
      // Two different failures, and telling them apart is the whole point: before
      // the order exists nothing was written, after it exists the admin owns a
      // half-built order and needs to know it is there.
      toast.error(
        createdOrderId.value
          ? t('orders.toast_error_create_partial')
          : t('orders.toast_error_create'),
      )
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
    settings,
    // Validation
    validate,
    clearError,
    // Clients
    clients,
    loadingClients,
    clientsError,
    clientSearch,
    clientPagination,
    selectedClient,
    selectClient,
    loadClients,
    // Local order state
    localOrder,
    totalAmount,
    totalWeight,
    hasPendingChanges,
    isPartiallySaved,
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
