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
import {
  buildOrderItem,
  buildOrderService,
  pricingSeedFor,
  toPricingLine,
} from '@/services/orderLines'
import {
  applyLineEdit,
  lineEditDelta,
  lineEditErrorKey,
  lineKindOf,
  type LineEditOp,
  type LineKind,
} from '@/services/orderLineEdits'
import {
  round2,
  rollupOrder,
  grossToNet,
  achievableGross,
  allocateTotal,
  addLineModes,
  effectiveDiscountPercent,
  isAllocatable,
  paymentState,
  paymentSummary,
  type AddLineMode,
  type PricingLine,
} from '@/domain/orderPricing'
import {
  addOrderPayment,
  allocateOrderTotal,
  cancelOrderShipment,
  createOrderInvoice,
  createOrderShipment,
  deleteOrderPayment,
  getOrderShipments,
  planOrderShipment,
  planOrderStatus,
  reserveOrderStock,
  splitOrderItem,
  updateOrderItem,
  updateOrderService,
} from '@/services/ordersService'
import type {
  Invoice,
  Order,
  OrderItem,
  OrderService,
  OrderStatus,
  Payment,
  PaymentPurpose,
  ShippableLine,
  Shipment,
  StatusTransitionPlan,
  VatMode,
} from '@/types/order'
import type { StockAuditEntry } from '@/types/warehouse'
import type { UploadedFile } from '@/services/uploadsService'

/**
 * Only what the admin may actually set. Everything else on an order — totals,
 * VAT, margin, the paid share — is derived and comes back from the server, so
 * it has no place in a form the dirty check would then send back.
 *
 * `defaultMarginPercent` and `defaultDiscountPercent` apply to NEW lines only;
 * existing lines keep what was agreed on them.
 */
interface OrderFormFields {
  totalWeight: number
  notes: Order['notes']
  documentType: Order['documentType']
  currency: string
  vatMode: VatMode
  vatPercent: number
  defaultMarginPercent: number
  defaultDiscountPercent: number
}

/** Fields the admin owns. Everything else about an order is derived. */
const SAVABLE_FIELDS = [
  'notes',
  'documentType',
  'currency',
  'vatMode',
  'vatPercent',
  'defaultMarginPercent',
  'defaultDiscountPercent',
  // Hand-entered until products carry a weight of their own.
  'totalWeight',
] as const satisfies ReadonlyArray<keyof OrderFormFields>

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
    totalWeight: 0,
    notes: null,
    documentType: 'local',
    currency: settings.constants.defaultCurrency,
    vatMode: 'standard',
    vatPercent: settings.constants.vatRate,
    defaultMarginPercent: settings.constants.defaultMargin,
    defaultDiscountPercent: 0,
  })

  // ─── Pending changes (items, services, files) ────────────────────────
  /**
   * `localId` is the id the row carries on screen until it exists on the server.
   * Without it a line added and then edited — or added and then removed — before
   * Save cannot be matched back to its pending entry.
   */
  const pendingItems = ref<
    Array<{
      localId: string
      productId: string
      productName: string
      quantity: number
      unit: string
      unitPrice: number
      /** Decided by the add-mode, so the server cannot fall back to the default. */
      discountPercent: number
    }>
  >([])
  const pendingItemDeletions = ref<string[]>([])
  const pendingServices = ref<
    Array<{
      localId: string
      serviceId: string
      serviceName: string
      quantity: number
      price: number
      discountPercent: number
    }>
  >([])
  const pendingServiceDeletions = ref<string[]>([])
  const pendingFileAdds = ref<string[]>([])
  const pendingFileRemoves = ref<string[]>([])

  /**
   * Line edits, in the order the admin made them — see `orderLineEdits`. Order is
   * kept because it decides the outcome: a margin edit after a price edit clears
   * the lock, the other way round it does not.
   */
  const pendingLineEdits = ref<Array<{ lineId: string; kind: LineKind; op: LineEditOp }>>([])

  /**
   * On-screen id of a new line → the id the server gave it. Outlives a single
   * Save on purpose: if a save fails after the line was created, the retry has to
   * send the edits to the real line rather than to an id nobody issued.
   */
  const serverLineId = new Map<string, string>()

  const hasPendingChanges = computed(
    () =>
      pendingItems.value.length > 0 ||
      pendingItemDeletions.value.length > 0 ||
      pendingServices.value.length > 0 ||
      pendingServiceDeletions.value.length > 0 ||
      pendingLineEdits.value.length > 0 ||
      pendingFileAdds.value.length > 0 ||
      pendingFileRemoves.value.length > 0,
  )

  const { isDirty, capture, diff } = useDirtyCheck(form)

  /**
   * Sends only the fields the admin owns. The totals are the server's to compute,
   * and a client that could dictate them would make the invoice and the lines
   * disagree.
   */
  async function saveFormFields() {
    if (!isDirty.value) return
    const delta = diff() as Partial<OrderFormFields>
    const payload: Record<string, unknown> = {}
    for (const key of SAVABLE_FIELDS) {
      if (delta[key] !== undefined) payload[key] = delta[key]
    }
    if (Object.keys(payload).length > 0) await patchOrder(id, payload)
  }

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

  // ─── Totals ────────────────────────────────────────────────────────────
  // One source: the pricing module, over the lines. No second VAT rate, no
  // invented weight coefficient, and no order-level discount applied on top of
  // prices that already carry their own.

  const lines = computed(() =>
    order.value ? [...order.value.items, ...order.value.services].map(toPricingLine) : [],
  )

  const totals = computed(() => rollupOrder(lines.value, form.value.vatMode, form.value.vatPercent))

  /** Refreshes the locally held order so the table and the summary agree. */
  function recalcLocalTotals() {
    if (!order.value) return
    const rolled = rollupOrder(lines.value, form.value.vatMode, form.value.vatPercent)
    order.value = {
      ...order.value,
      totalCost: rolled.totalCost,
      totalAmount: rolled.totalNet,
      totalVat: rolled.totalVat,
      totalWithVat: rolled.totalGross,
      actualMarginPercent: rolled.actualMarginPercent,
      effectiveDiscountPercent: rolled.effectiveDiscountPercent,
    }
  }

  // ─── Order CRUD ────────────────────────────────────────────────────────
  async function load() {
    loading.value = true
    error.value = null
    try {
      order.value = await getOrder(id)
      // Kept apart from `order.totalWithVat`, which follows the local edits: the
      // payment warning is about the difference between the two.
      savedTotalGross.value = order.value.totalWithVat
      form.value = {
        totalWeight: order.value.totalWeight,
        notes: order.value.notes,
        documentType: order.value.documentType,
        currency: order.value.currency,
        vatMode: order.value.vatMode,
        vatPercent: order.value.vatPercent ?? settings.constants.vatRate,
        defaultMarginPercent: order.value.defaultMarginPercent ?? settings.constants.defaultMargin,
        defaultDiscountPercent: order.value.defaultDiscountPercent ?? 0,
      }
      capture()
      // What can go on a truck depends on the lines and on the shelf, so it is
      // re-read whenever the order is. Without this the shipping dialog offers
      // the list it was built with — a line added a minute ago simply is not there.
      await loadShipPlan()
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
      // 1. The fields the admin owns go FIRST: the line edits below are read
      //    against the order defaults — "reset to computed" re-applies the default
      //    discount, and a new line inherits it — and the server reads those from
      //    its own copy. Only these fields go out; the totals are the server's to
      //    compute, and a client that could dictate them would make the invoice
      //    and the lines disagree.
      await saveFormFields()

      // Every bucket below is emptied as it goes out, one entry at a time. If a
      // request fails halfway the rest stays pending — a retry must not add the
      // same line a second time, and the reload that would reveal the duplicate
      // only happens on success.
      //
      // 2. New lines, before their edits, so an edit has a real id to land on.
      while (pendingItems.value.length > 0) {
        const item = pendingItems.value[0]!
        const created = await addOrderItem(id, {
          productId: item.productId,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          // Sent explicitly: the server would otherwise apply the order default,
          // and the line would change under the admin the moment it is stored.
          discountPercent: item.discountPercent,
        })
        serverLineId.set(item.localId, created.id)
        pendingItems.value = pendingItems.value.slice(1)
      }
      while (pendingServices.value.length > 0) {
        const svc = pendingServices.value[0]!
        const created = await addOrderService(id, {
          serviceId: svc.serviceId,
          quantity: svc.quantity,
          price: svc.price,
          discountPercent: svc.discountPercent,
        })
        serverLineId.set(svc.localId, created.id)
        pendingServices.value = pendingServices.value.slice(1)
      }

      // 3. Line edits, one request each and in the order they were made — an
      //    accumulated delta cannot express that order, and the order decides
      //    the result. See `orderLineEdits`.
      while (pendingLineEdits.value.length > 0) {
        const edit = pendingLineEdits.value[0]!
        const target = serverLineId.get(edit.lineId) ?? edit.lineId
        const delta = lineEditDelta(edit.op, edit.kind)
        if (edit.kind === 'item') await updateOrderItem(id, target, delta)
        else await updateOrderService(id, target, delta)
        pendingLineEdits.value = pendingLineEdits.value.slice(1)
      }

      // 4. Removals last: a line removed on screen is gone, whatever was done
      //    to it before that.
      while (pendingItemDeletions.value.length > 0) {
        await deleteOrderItem(id, pendingItemDeletions.value[0]!)
        pendingItemDeletions.value = pendingItemDeletions.value.slice(1)
      }
      while (pendingServiceDeletions.value.length > 0) {
        await deleteOrderService(id, pendingServiceDeletions.value[0]!)
        pendingServiceDeletions.value = pendingServiceDeletions.value.slice(1)
      }

      // 5. Files
      while (pendingFileAdds.value.length > 0) {
        await addOrderFile(id, pendingFileAdds.value[0]!)
        pendingFileAdds.value = pendingFileAdds.value.slice(1)
      }
      while (pendingFileRemoves.value.length > 0) {
        await removeOrderFile(id, pendingFileRemoves.value[0]!)
        pendingFileRemoves.value = pendingFileRemoves.value.slice(1)
      }

      // Reload to get fresh state after all changes
      await load()
      clearPending()
      toast.success(t('orders.toast_saved'))
    } catch (e) {
      // A refused line edit says which line and why; anything else is a plain
      // save failure. Silently showing "could not save" for a frozen line is how
      // an admin ends up retyping the same number five times.
      toast.error(t(lineEditErrorKey(e)))
    } finally {
      saving.value = false
    }
  }

  function clearPending() {
    serverLineId.clear()
    pendingItems.value = []
    pendingItemDeletions.value = []
    pendingServices.value = []
    pendingServiceDeletions.value = []
    pendingLineEdits.value = []
    pendingFileAdds.value = []
    pendingFileRemoves.value = []
  }

  async function discard() {
    clearPending()
    await load()
  }

  async function remove(): Promise<boolean> {
    saving.value = true
    try {
      await deleteOrder(id)
      toast.success(t('orders.toast_deleted'))
      return true
    } catch (e) {
      // An invoice, a shipment or a payment blocks this, and each has its own way
      // back — the message has to say which one, not just "could not delete".
      toast.error(t(lineEditErrorKey(e, 'orders.toast_error_delete')))
      return false
    } finally {
      saving.value = false
    }
  }

  // ─── Status change: the shipping workflow for an ordinary order ────────
  // One status may hold the remainder and one may write it off, so changing it can
  // empty a shelf. It says what it will do first, and a shortage refuses it.

  const statusPlan = ref<StatusTransitionPlan | null>(null)
  const statusChanging = ref(false)

  async function requestStatusChange(status: OrderStatus) {
    if (!order.value || status === order.value.status) return
    try {
      const plan = await planOrderStatus(id, status)
      // A status that touches neither the shelf nor the holds is just a status.
      if (!plan.writesOff && !plan.reserves) {
        await applyStatusChange(status)
        return
      }
      statusPlan.value = plan
    } catch {
      toast.error(t('orders.toast_error_save'))
    }
  }

  function cancelStatusChange() {
    statusPlan.value = null
  }

  async function confirmStatusChange() {
    const plan = statusPlan.value
    if (!plan || plan.shortages.length > 0) return
    statusPlan.value = null
    await applyStatusChange(plan.status)
  }

  async function applyStatusChange(status: OrderStatus) {
    statusChanging.value = true
    try {
      await patchOrderStatus(id, status)
      toast.success(t('orders.toast_status_changed'))
      await load()
      // The transition may have created a shipment and emptied a shelf. Without
      // this the line says "shipped" while the shipments panel shows nothing —
      // the one place the admin would go to check what left.
      await loadShipments()
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
    } finally {
      statusChanging.value = false
    }
  }

  /** Kept for the plain path — the selector goes through `requestStatusChange`. */
  async function handleChangeStatus(status: OrderStatus) {
    await applyStatusChange(status)
  }

  // ─── Shipments ─────────────────────────────────────────────────────────
  const shipments = ref<Shipment[]>([])
  const shipmentsLoading = ref(false)

  async function loadShipments() {
    shipmentsLoading.value = true
    try {
      shipments.value = await getOrderShipments(id)
      await loadShipPlan()
    } catch {
      shipments.value = []
    } finally {
      shipmentsLoading.value = false
    }
  }

  /**
   * What could go on a truck right now — from the server, because only it knows
   * what is on the shelf. `remaining` is what the client is still owed;
   * `shippable` is what the warehouse can back.
   */
  const shippableLines = ref<ShippableLine[]>([])

  async function loadShipPlan() {
    try {
      shippableLines.value = await planOrderShipment(id)
    } catch {
      shippableLines.value = []
    }
  }

  async function shipLines(lines: Array<{ lineId: string; quantity: number }>, note?: string) {
    if (!order.value || lines.length === 0) return false
    // Already going out. A `disabled` attribute is not enough on its own: Vue
    // applies it on the next tick, so a second Enter or a double click lands
    // while the button still looks live — and a second shipment writes the same
    // goods off the shelf again.
    if (shipmentsLoading.value) return false
    // A shipment writes stock off; the lines it references have to exist on the
    // server first.
    if (hasPendingChanges.value) {
      toast.error(t('orders.error_save_lines_first'))
      return false
    }
    shipmentsLoading.value = true
    try {
      await saveFormFields()
      await createOrderShipment(id, { lines, vehicle: note ?? null })
      await load()
      await loadShipments()
      toast.success(t('orders.toast_shipment_created'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      shipmentsLoading.value = false
    }
  }

  /**
   * `correctionReason` is only needed for a delivery the client has an invoice
   * for: the server withdraws that document with a correcting invoice and returns
   * the goods in the same call. Without a reason it refuses, as before.
   */
  async function cancelShipment(shipmentId: string, correctionReason?: string) {
    if (shipmentsLoading.value) return
    shipmentsLoading.value = true
    try {
      await cancelOrderShipment(id, shipmentId, { correctionReason: correctionReason ?? null })
      await load()
      await loadShipments()
      toast.success(
        correctionReason
          ? t('orders.toast_shipment_corrected')
          : t('orders.toast_shipment_cancelled'),
      )
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
    } finally {
      shipmentsLoading.value = false
    }
  }

  async function reserveStock() {
    if (hasPendingChanges.value) {
      toast.error(t('orders.error_save_lines_first'))
      return
    }
    try {
      const created = await reserveOrderStock(id)
      await load()
      toast.success(
        created.length > 0 ? t('orders.toast_reserved') : t('orders.toast_nothing_to_reserve'),
      )
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
    }
  }

  // ─── Money: payments and invoices ───────────────────────────────────────
  // Both lists arrive with the order, so the paid share is derived from the SAME
  // totals the line table shows. That is the whole point of never storing the
  // percentage: add a line and it falls before anything is saved.

  const payments = computed<Payment[]>(() => order.value?.payments ?? [])
  const invoices = computed<Invoice[]>(() => order.value?.invoices ?? [])
  const paymentAmounts = computed(() => payments.value.map((p) => p.amount))
  const paid = computed(() => paymentSummary(totals.value.totalGross, paymentAmounts.value))
  const paymentSaving = ref(false)

  /**
   * The total as the server last confirmed it. `order.totalWithVat` is kept in
   * step with the local edits, so it cannot answer "what has changed since".
   */
  const savedTotalGross = ref(0)

  /**
   * Payment against a total that has moved — a warning, never a block (model
   * section 6). Money that has to go back is worth saying whatever the order used
   * to be; a shortfall is only news on an order that was settled, because an order
   * that was 25% paid and is now 20% paid is ordinary work.
   */
  const paymentDrift = computed<{ kind: 'overpaid' | 'underpaid'; amount: number } | null>(() => {
    if (paymentAmounts.value.length === 0) return null
    if (paid.value.state === 'overpaid')
      return { kind: 'overpaid', amount: -paid.value.outstanding }
    // An order that was overpaid counts as settled here too: going from "we owe
    // them money" to "they owe us money" is exactly the change worth saying.
    const before = paymentState(savedTotalGross.value, paymentAmounts.value)
    if ((before === 'paid' || before === 'overpaid') && paid.value.state !== 'paid') {
      return { kind: 'underpaid', amount: paid.value.outstanding }
    }
    return null
  })

  /**
   * The invoice the client is still holding for this delivery — a corrected one
   * does not count, which is what makes the delivery cancellable again.
   */
  function liveInvoiceFor(shipmentId: string): Invoice | null {
    const corrected = new Set(
      invoices.value.filter((i) => i.kind === 'correction').map((i) => i.correctsInvoiceId),
    )
    return (
      invoices.value.find(
        (i) => i.shipmentId === shipmentId && i.kind !== 'correction' && !corrected.has(i.id),
      ) ?? null
    )
  }

  /**
   * A payment is a fact about money, not about lines, so this does not reload the
   * order: a reload would throw away line edits the admin has not saved yet. The
   * created record is merged in and every derived figure follows from it.
   *
   * The `paymentSaving` guard is what keeps one payment one payment. Disabling the
   * button is not enough: Vue applies `disabled` on the next tick, and Enter
   * pressed twice — which is what people do — arrives before that. Two records for
   * the same money, and the order reads as paid twice over. The flag is set
   * synchronously before the first await, so the second call sees it.
   */
  async function addPayment(data: {
    amount: number
    purpose: PaymentPurpose
    paidAt?: string
    note?: string | null
    invoiceId?: string | null
  }): Promise<boolean> {
    if (!order.value || paymentSaving.value) return false
    paymentSaving.value = true
    try {
      const created = await addOrderPayment(id, data)
      order.value = { ...order.value, payments: [...order.value.payments, created] }
      toast.success(t('orders.toast_payment_added'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      paymentSaving.value = false
    }
  }

  async function removePayment(paymentId: string): Promise<void> {
    if (!order.value || paymentSaving.value) return
    paymentSaving.value = true
    try {
      await deleteOrderPayment(id, paymentId)
      order.value = {
        ...order.value,
        payments: order.value.payments.filter((p) => p.id !== paymentId),
      }
      toast.success(t('orders.toast_payment_removed'))
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
    } finally {
      paymentSaving.value = false
    }
  }

  /**
   * The invoice for a delivery. Its amount comes off the shipment's lines as the
   * SERVER holds them, and issuing it freezes those lines — so unsaved edits have
   * to go out first, or the client is billed a price the card no longer shows and
   * the line can never be corrected.
   */
  async function issueInvoiceFor(shipmentId: string): Promise<boolean> {
    if (paymentSaving.value) return false
    if (hasPendingChanges.value || isDirty.value) {
      toast.error(t('orders.error_save_lines_first'))
      return false
    }
    paymentSaving.value = true
    try {
      await createOrderInvoice(id, { kind: 'regular', shipmentId })
      // The freeze lands on the lines of that shipment, so the table has to be
      // re-read — it is what tells the admin why a cell stopped accepting edits.
      await load()
      await loadShipments()
      toast.success(t('orders.toast_invoice_issued'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      paymentSaving.value = false
    }
  }

  /**
   * An advance invoice covers no delivery, so it freezes nothing and the amount is
   * stated by hand — as gross, which is what the client is asked to pay.
   */
  async function issueAdvanceInvoice(amountGross: number): Promise<boolean> {
    if (!order.value || paymentSaving.value) return false
    paymentSaving.value = true
    try {
      const created = await createOrderInvoice(id, { kind: 'advance', amountGross })
      order.value = { ...order.value, invoices: [...order.value.invoices, created] }
      toast.success(t('orders.toast_invoice_issued'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      paymentSaving.value = false
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
    mode: AddLineMode | null = null,
  ) {
    if (!order.value) return
    const items = Array.isArray(data) ? data : [data]
    const discountOnAdd = discountForMode(mode)

    // FIFO cost lookup — the same figure the server will read off the warehouse.
    const fifoCosts = await Promise.all(
      items.map((item) =>
        getBatchCostBreakdown(item.productId, item.quantity ?? 1)
          .then((r) => r.unitPrice)
          .catch(() => null),
      ),
    )
    const costs = items.map((item, idx) => {
      // Rounded to cents exactly as the server rounds it. Left raw, the margin
      // derived from it would differ in the second decimal from the one that
      // comes back on Save — the preview would be right about the price and
      // wrong about the markup.
      const fromStock = fifoCosts[idx] !== null ? round2(fifoCosts[idx]!) : (item.unitCost ?? null)
      return { fromStock, unitCost: fromStock ?? round2(item.unitPrice * 0.7) }
    })
    const withIds = items.map((item, idx) => ({
      ...item,
      localId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
      // A line with no cost keeps its stated price: a discount is a share of a
      // computed price, and it has none. Same rule as the line table and as
      // services — a percentage stored but never applied is worse than none.
      discountPercent: costs[idx]!.unitCost > 0 ? discountOnAdd : 0,
    }))

    const newItems = withIds.map((item, idx) => {
      const { fromStock, unitCost } = costs[idx]!
      return buildOrderItem({
        // A guessed cost is marked as a guess, so reports can tell them apart.
        costSource: fromStock === null ? 'estimate' : 'stock',
        id: item.localId,
        lineNumber: order.value!.items.length + idx + 1,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitCost,
        // The price the picker showed, expressed as a markup where possible.
        ...pricingSeedFor(unitCost, item.unitPrice),
        discountPercent: item.discountPercent,
        receivedCurrency: 'cur-eur',
        exchangeRate: 1,
      })
    })

    // "Keep the total" has to be seen before it happens: it moves the price of
    // every other line that can still be repriced.
    if (mode === 'keep_total') {
      openKeepTotalPreview(newItems, [], withIds, [])
      return
    }
    commitNewItems(newItems, withIds)
  }

  /**
   * The discount a line gets on the way in.
   *
   * "With the order's terms" means the discount the order REALLY ended up giving
   * — one number the admin can see and print — not the default percentage, which
   * says nothing about what was negotiated line by line.
   */
  function discountForMode(mode: AddLineMode | null): number {
    return mode === 'order_terms' ? orderTermsDiscount.value : form.value.defaultDiscountPercent
  }

  function commitNewItems(newItems: OrderItem[], pending: (typeof pendingItems.value)[number][]) {
    if (!order.value) return
    pendingItems.value = [...pendingItems.value, ...pending]
    order.value = { ...order.value, items: [...order.value.items, ...newItems] }
    recalcLocalTotals()
  }

  function commitNewServices(
    newServices: OrderService[],
    pending: (typeof pendingServices.value)[number][],
  ) {
    if (!order.value) return
    pendingServices.value = [...pendingServices.value, ...pending]
    order.value = { ...order.value, services: [...order.value.services, ...newServices] }
    recalcLocalTotals()
  }

  /**
   * Removing a line. A line that has never reached the server is removed by
   * dropping its pending add: recording a deletion instead would create it on
   * Save and then delete an id the server never issued, leaving it behind.
   */
  function forgetLine(lineId: string, kind: LineKind): void {
    pendingLineEdits.value = pendingLineEdits.value.filter((e) => e.lineId !== lineId)
    if (kind === 'item') {
      const unsaved = pendingItems.value.some((i) => i.localId === lineId)
      if (unsaved) pendingItems.value = pendingItems.value.filter((i) => i.localId !== lineId)
      else pendingItemDeletions.value = [...pendingItemDeletions.value, lineId]
    } else {
      const unsaved = pendingServices.value.some((s) => s.localId === lineId)
      if (unsaved) pendingServices.value = pendingServices.value.filter((s) => s.localId !== lineId)
      else pendingServiceDeletions.value = [...pendingServiceDeletions.value, lineId]
    }
  }

  function handleDeleteItem(lineId: string) {
    forgetLine(lineId, 'item')
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
    mode: AddLineMode | null = null,
  ) {
    if (!order.value) return
    const items = Array.isArray(data) ? data : [data]
    const now = Date.now()
    const discountOnAdd = discountForMode(mode)
    const withIds = items.map((item, idx) => ({
      ...item,
      localId: `temp-svc-${now}-${Math.random().toString(36).slice(2, 8)}-${idx}`,
      // A service with no cost keeps its stated price — a discount is a share of
      // a computed price, and it has none. Same rule as the line table.
      discountPercent: (item.cost ?? 0) > 0 ? discountOnAdd : 0,
    }))
    {
      const newServices = withIds.map((item) =>
        buildOrderService({
          id: item.localId,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          quantity: item.quantity,
          unitCost: item.cost ?? 0,
          ...pricingSeedFor(item.cost ?? 0, item.price),
          discountPercent: item.discountPercent,
        }),
      )
      if (mode === 'keep_total') {
        openKeepTotalPreview([], newServices, [], withIds)
        return
      }
      commitNewServices(newServices, withIds)
    }
  }

  function handleDeleteService(svcId: string) {
    forgetLine(svcId, 'service')
    // Update local order state for immediate UI feedback
    if (order.value) {
      order.value = {
        ...order.value,
        services: order.value.services.filter((s) => s.id !== svcId),
      }
      recalcLocalTotals()
    }
  }

  // ─── Adding lines: which question the dialog asks ──────────────────────
  // Model, section 10. Nothing hand-priced in the order → nothing to ask, the
  // line just takes the order's defaults.

  const addModes = computed(() => addLineModes(lines.value))

  /** The discount the order actually gave, as one number a document can print. */
  const orderTermsDiscount = computed(() => round2(effectiveDiscountPercent(lines.value)))

  /**
   * "Keep the total" — the new line is paid for out of the other lines, so the
   * order comes to the same money. Never silent: this moves prices that were
   * agreed one by one, and shipped lines cannot take part at all.
   */
  const keepTotalPreview = ref<{
    total: number
    rows: Array<{ lineId: string; lineName: string; before: number; after: number }>
    apply: () => void
  } | null>(null)

  function openKeepTotalPreview(
    newItems: OrderItem[],
    newServices: OrderService[],
    pendingItemEntries: (typeof pendingItems.value)[number][],
    pendingServiceEntries: (typeof pendingServices.value)[number][],
  ) {
    if (!order.value) return
    const targetNet = totals.value.totalNet
    const added = [...newItems, ...newServices]
    const nameOf = new Map<string, string>(
      added.map((line) => [
        line.id,
        'productName' in line ? line.productName : (line as OrderService).serviceName,
      ]),
    )

    let result: ReturnType<typeof allocateTotal>
    try {
      // The same spreading the server runs, over the lines as they WILL be.
      result = allocateTotal([...lines.value, ...added.map(toPricingLine)], targetNet)
    } catch {
      toast.error(t('orders.error_no_editable_lines'))
      return
    }

    keepTotalPreview.value = {
      total: totals.value.totalGross,
      rows: result.rows.map((row) => ({
        ...row,
        lineName: nameOf.get(row.lineId) ?? lineNameOf(row.lineId),
      })),
      apply: () => {
        commitNewItems(newItems, pendingItemEntries)
        commitNewServices(newServices, pendingServiceEntries)
        // Full precision on purpose — the same division `allocateTotal` did, so
        // the line totals add up to the target exactly rather than a cent away.
        for (const row of result.rows) {
          const kind: LineKind = order.value!.items.some((i) => i.id === row.lineId)
            ? 'item'
            : 'service'
          const line = findLine(row.lineId, kind)
          if (!line || row.after === row.before) continue
          editLine(row.lineId, kind, { field: 'unitPrice', value: row.after / line.quantity })
        }
      },
    }
  }

  function confirmKeepTotal() {
    const preview = keepTotalPreview.value
    keepTotalPreview.value = null
    preview?.apply()
  }

  function cancelKeepTotal() {
    // Nothing was added, so there is nothing to undo — the lines only exist
    // inside the closure above.
    keepTotalPreview.value = null
  }

  // ─── Line edits ────────────────────────────────────────────────────────
  // Applied to the local line at once so the row and the totals move under the
  // admin's hand, and recorded to go out with Save. Both sides run the same
  // `applyLineEdit`, so the preview cannot disagree with what gets stored.

  function findLine(lineId: string, kind: LineKind) {
    if (!order.value) return undefined
    return kind === 'item'
      ? order.value.items.find((i) => i.id === lineId)
      : order.value.services.find((s) => s.id === lineId)
  }

  /** Returns false when the model refused the edit; the line is left untouched. */
  function editLine(lineId: string, kind: LineKind, op: LineEditOp): boolean {
    const line = findLine(lineId, kind)
    if (!line) return false
    try {
      applyLineEdit(line, op, { defaultDiscountPercent: form.value.defaultDiscountPercent })
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    }
    pendingLineEdits.value = [...pendingLineEdits.value, { lineId, kind, op }]
    recalcLocalTotals()
    return true
  }

  /**
   * Cutting a partially shipped line in two: the part that left on the waybill,
   * and a free remainder that can be repriced. A server action — it renumbers the
   * lines — so unsaved line changes have to be in first.
   */
  const splitting = ref(false)

  async function splitItemLine(lineId: string): Promise<boolean> {
    const line = findLine(lineId, 'item')
    if (!line || splitting.value) return false
    if (hasPendingChanges.value) {
      toast.error(t('orders.error_save_lines_first'))
      return false
    }
    splitting.value = true
    try {
      // The reload below replaces the form and its dirty baseline, so anything
      // still unsaved there would simply vanish.
      await saveFormFields()
      // The cut lands exactly on what already shipped — anywhere else and goods
      // would either vanish from the records or count as shipped twice.
      await splitOrderItem(id, lineId, line.shippedQuantity)
      await load()
      toast.success(t('orders.toast_line_split'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      splitting.value = false
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

  // ─── Manual total, VAT mode, applying defaults ─────────────────────────

  /** Preview rows for the allocation dialog: what each line becomes. */
  const allocationPreview = ref<{
    requestedGross: number
    achievedGross: number
    rows: Array<{ lineId: string; lineName: string; before: number; after: number }>
  } | null>(null)

  const allocating = ref(false)

  function lineNameOf(lineId: string): string {
    if (!order.value) return lineId
    return (
      order.value.items.find((i) => i.id === lineId)?.productName ??
      order.value.services.find((s) => s.id === lineId)?.serviceName ??
      lineId
    )
  }

  /**
   * Builds the preview for a target gross total. Reports the total the order will
   * REALLY come to: with VAT rounded to cents some gross amounts do not exist
   * (at 21% nothing lands on 100.00), and the admin has to be told rather than
   * handed a total a cent away from what they typed.
   */
  function previewTotal(targetGross: number): string | null {
    if (!order.value) return null
    // The server does the real spreading and only knows the lines it has, so a
    // preview over unsaved ones would show rows it would then reject. Unsaved
    // FIELDS are fine — every action below flushes them before it reloads.
    if (hasPendingChanges.value) {
      allocationPreview.value = null
      return 'orders.error_save_lines_first'
    }

    const targetNet = grossToNet(targetGross, form.value.vatMode, form.value.vatPercent)
    try {
      // Same function the server runs, so the preview cannot disagree with the
      // result — including which lines are off limits and what the bounds are.
      const result = allocateTotal(lines.value, targetNet)
      allocationPreview.value = {
        requestedGross: targetGross,
        achievedGross: achievableGross(targetGross, form.value.vatMode, form.value.vatPercent),
        rows: result.rows.map((r) => ({ ...r, lineName: lineNameOf(r.lineId) })),
      }
      return null
    } catch (e) {
      allocationPreview.value = null
      const code = String(e)
      if (code.includes('BELOW_FROZEN_MINIMUM')) return 'orders.error_total_below_shipped'
      if (code.includes('NO_EDITABLE_LINES')) return 'orders.error_no_editable_lines'
      return 'orders.error_total_not_possible'
    }
  }

  function cancelAllocation() {
    allocationPreview.value = null
  }

  /** Applies the previewed allocation. The server does the spreading. */
  async function confirmAllocation() {
    if (!allocationPreview.value || allocating.value) return
    allocating.value = true
    try {
      // Flushed first: the reload below replaces the whole form, and with it the
      // dirty baseline, so anything still unsaved would simply vanish.
      await saveFormFields()
      await allocateOrderTotal(id, allocationPreview.value.requestedGross)
      allocationPreview.value = null
      await load()
      toast.success(t('orders.toast_total_allocated'))
    } catch {
      toast.error(t('orders.toast_error_save'))
    } finally {
      allocating.value = false
    }
  }

  /**
   * Changing the VAT mode. Keeping the net price is the default: selling
   * zero-rated at a VAT-inclusive price would be a hidden 21% markup, and the
   * other way round a 21% loss.
   */
  const pendingVatMode = ref<VatMode | null>(null)

  function requestVatMode(mode: VatMode) {
    if (!order.value || mode === form.value.vatMode) return
    // Nothing to weigh up on an empty order.
    if (totals.value.totalNet === 0) {
      form.value.vatMode = mode
      return
    }
    pendingVatMode.value = mode
  }

  /** `keep: 'net'` leaves line prices alone; `keep: 'gross'` re-targets the total. */
  async function confirmVatMode(keep: 'net' | 'gross') {
    const mode = pendingVatMode.value
    if (!mode) return
    const grossBefore = totals.value.totalGross
    const modeBefore = form.value.vatMode
    form.value.vatMode = mode
    pendingVatMode.value = null

    if (keep !== 'gross') {
      // Purely local: the mode goes out with the next Save like any other field.
      recalcLocalTotals()
      return
    }

    // Unsaved LINES cannot be allocated over — the server does not have them.
    // Unsaved fields are fine: they go out with the mode below.
    if (hasPendingChanges.value) {
      form.value.vatMode = modeBefore
      toast.error(t('orders.error_save_lines_first'))
      return
    }

    // The spreading happens server-side, and the server reads the VAT mode from
    // its own copy of the order — so the new mode has to be there first, or the
    // amount would be split at the old rate. Deliberately no capture() here: it
    // would reset the whole dirty baseline and swallow other unsaved edits.
    saving.value = true
    try {
      await saveFormFields()
    } catch {
      toast.error(t('orders.toast_error_save'))
      form.value.vatMode = modeBefore
      saving.value = false
      return
    }
    saving.value = false

    recalcLocalTotals()
    const warning = previewTotal(grossBefore)
    if (warning) toast.error(t(warning))
  }

  function cancelVatMode() {
    pendingVatMode.value = null
  }

  /**
   * Pushes the order defaults onto every line that can still be repriced. An
   * explicit button, never a side effect of editing the percentage — the whole
   * point of "defaults for new lines" is that they do not rewrite what was
   * already agreed.
   */
  /**
   * What applying the defaults would do. Shown before doing it, because this
   * rewrites the margin and discount of every line that can still be repriced —
   * including ones the admin negotiated by hand. Everything else in this model
   * refuses to overwrite those silently, and so does this.
   */
  const defaultsPreview = ref<{
    lineCount: number
    skipped: number
    before: number
    after: number
  } | null>(null)

  /**
   * A percentage markup needs a cost to apply to. A line without one — a service
   * priced outright — would be repriced to zero, so the defaults leave it alone
   * and the preview says how many were left.
   */
  function takesDefaults(line: PricingLine): boolean {
    return isAllocatable(line) && line.unitCost > 0
  }

  /**
   * The defaults expressed as ordinary line edits — the same ones the admin makes
   * by hand in the table. Two of them, and the ORDER is what makes them stick: a
   * discount edit computes a price and locks it, a margin edit is a rule and
   * releases that lock again. Margin-then-discount would leave every line
   * hand-priced, which is precisely what "apply the defaults" undoes.
   */
  function defaultsOps(): LineEditOp[] {
    return [
      { field: 'discountPercent', value: form.value.defaultDiscountPercent },
      { field: 'marginPercent', value: form.value.defaultMarginPercent },
    ]
  }

  /** Which lines the defaults would touch, as the real line objects. */
  function linesTakingDefaults(): Array<OrderItem | OrderService> {
    if (!order.value) return []
    return [...order.value.items, ...order.value.services].filter((line) =>
      takesDefaults(toPricingLine(line)),
    )
  }

  function requestApplyDefaults() {
    if (!order.value) return
    const editable = linesTakingDefaults()
    const skipped = lines.value.filter((line) => isAllocatable(line) && line.unitCost <= 0).length
    if (editable.length === 0) {
      // "Everything has shipped" would be the wrong reason when the lines are
      // simply priced outright and have no cost to mark up.
      toast.error(
        t(skipped > 0 ? 'orders.error_no_cost_to_mark_up' : 'orders.error_no_editable_lines'),
      )
      return
    }

    // The preview runs the REAL edits over throwaway copies, so it cannot promise
    // a total the apply below would not produce. A shallow copy is enough: these
    // two edits write scalars only and read `allocations` without touching it.
    // It also does the validating — a percentage out of range is refused here,
    // before a single line has been moved.
    const ops = defaultsOps()
    const probe = new Map(editable.map((line) => [line.id, { ...line }]))
    try {
      for (const copy of probe.values()) {
        for (const op of ops) {
          applyLineEdit(copy, op, { defaultDiscountPercent: form.value.defaultDiscountPercent })
        }
      }
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return
    }

    const after = [...order.value.items, ...order.value.services].map((line) =>
      toPricingLine(probe.get(line.id) ?? line),
    )
    defaultsPreview.value = {
      lineCount: editable.length,
      skipped,
      before: totals.value.totalGross,
      after: rollupOrder(after, form.value.vatMode, form.value.vatPercent).totalGross,
    }
  }

  function cancelApplyDefaults() {
    defaultsPreview.value = null
  }

  /**
   * Purely local, like every other line edit: the rows and the totals move at
   * once and the edits go out with Save. Nothing is written here, so the
   * defaults reach lines that have never been to the server, and "Discard"
   * takes them back off — the admin can weigh the result before committing to it.
   */
  function applyDefaultsToAllLines() {
    if (!order.value) return
    defaultsPreview.value = null
    const ops = defaultsOps()
    for (const line of linesTakingDefaults()) {
      const kind = lineKindOf(line)
      // Refusals were caught by the preview, so this only trips if something
      // changed under us. Stop rather than press on: a half-applied set of
      // defaults is worse than none, and `editLine` has already said why.
      for (const op of ops) {
        if (!editLine(line.id, kind, op)) return
      }
    }
    toast.success(t('orders.toast_defaults_applied'))
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
    // Status change and shipments
    statusPlan,
    statusChanging,
    requestStatusChange,
    confirmStatusChange,
    cancelStatusChange,
    shipments,
    shipmentsLoading,
    loadShipments,
    shippableLines,
    loadShipPlan,
    shipLines,
    cancelShipment,
    reserveStock,
    // Money: payments and invoices
    payments,
    invoices,
    paid,
    paymentDrift,
    paymentSaving,
    liveInvoiceFor,
    addPayment,
    removePayment,
    issueInvoiceFor,
    issueAdvanceInvoice,
    handleAddItemDirect,
    handleDeleteItem,
    handleAddServiceDirect,
    handleDeleteService,
    handleGenerateDocument,
    onFilesUploaded,
    removeFile,
    tf,
    // Totals — all derived, all read-only for the template
    totals,
    // Manual total
    allocationPreview,
    allocating,
    previewTotal,
    cancelAllocation,
    confirmAllocation,
    // VAT mode
    pendingVatMode,
    requestVatMode,
    confirmVatMode,
    cancelVatMode,
    // Defaults
    defaultsPreview,
    requestApplyDefaults,
    cancelApplyDefaults,
    applyDefaultsToAllLines,
    // Adding lines
    addModes,
    orderTermsDiscount,
    keepTotalPreview,
    confirmKeepTotal,
    cancelKeepTotal,
    // Line edits
    editLine,
    splitItemLine,
    splitting,
    pendingLineEdits,
    pendingItems,
    pendingItemDeletions,
    pendingServices,
    pendingServiceDeletions,
    pendingFileAdds,
    pendingFileRemoves,
    hasPendingChanges,
  }
}
