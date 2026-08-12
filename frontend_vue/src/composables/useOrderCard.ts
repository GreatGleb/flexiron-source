import { ref, computed, watch } from 'vue'
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
  baseCurrencyOf,
  buildOrderItem,
  buildOrderService,
  marginFor,
  pricingSeedFor,
  projectItem,
  stockCostFor,
  toPricingLine,
} from '@/services/orderLines'
import {
  applyLineEdit,
  canDeleteLine,
  lineEditDelta,
  lineEditErrorKey,
  lineKindOf,
  type LineEditContext,
  type LineEditOp,
  type LineKind,
} from '@/services/orderLineEdits'
import {
  round2,
  rollupOrder,
  calcLine,
  netToGross,
  grossToNet,
  achievableGross,
  allocateTotal,
  addLineModes,
  effectiveDiscountPercent,
  isAllocatable,
  isCostFrozen,
  paymentState,
  paymentSummary,
  roundStored,
  type AddLineMode,
  type PricingLine,
} from '@/domain/orderPricing'
import {
  addOrderPayment,
  allocateOrderTotal,
  cancelOrderShipment,
  correctOrderLine,
  createOrderInvoice,
  createOrderShipment,
  createOrderReturn,
  deleteOrderPayment,
  getOrderShipments,
  getOrderReturns,
  planOrderReturn,
  planOrderShipment,
  planOrderStatus,
  reserveOrderStock,
  splitOrderItem,
  updateOrderItem,
  updateOrderService,
  type LineEditPayload,
} from '@/services/ordersService'
import type {
  Invoice,
  Order,
  OrderAuditEntry,
  OrderItem,
  OrderReturn,
  OrderService,
  OrderStatus,
  Payment,
  PaymentPurpose,
  ReturnCondition,
  ReturnableLine,
  ShippableLine,
  Shipment,
  StatusTransitionPlan,
  VatMode,
} from '@/types/order'
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
   *
   * Each one carries the context it was made in as well as the edit itself. An
   * edit is an operation, and "reset to computed" is settled against the order's
   * default discount — so that default belongs to the moment the button was
   * pressed, not to the moment the request is written. Kept alongside rather than
   * folded into the number, because the same context is what the local
   * `applyLineEdit` above ran with: one value, both sides.
   */
  const pendingLineEdits = ref<
    Array<{ lineId: string; kind: LineKind; op: LineEditOp; ctx: LineEditContext }>
  >([])

  /**
   * The order version this card is writing against — contract §3.
   *
   * `null` means this card has never seen one (a server that predates the field,
   * or a test harness), and then no precondition is sent and nothing is checked:
   * a version is a claim about what was read, and a client that read no version
   * cannot make it.
   *
   * Otherwise it moves with the save. The server counts one step per accepted
   * write and answers one request at a time, so a save that sends five requests
   * is writing against five successive versions; sending the loaded one five
   * times would have the client's own second request refused by its first. What
   * this buys is the real thing: another tab writing in the middle of this save
   * is caught on the very next request, and that request writes nothing.
   */
  const orderVersion = ref<number | null>(null)

  /**
   * The request body with the precondition on it — and without the KEY at all
   * when there is no version to state. An absent field and a field holding
   * `undefined` read the same through JSON but not to a reader of this code, and
   * the two mean different things to the server: one offers no precondition, the
   * other would be offering an empty one.
   */
  function withVersion<T extends object>(payload: T): T & { version?: number } {
    return orderVersion.value === null ? payload : { ...payload, version: orderVersion.value }
  }

  /**
   * The same precondition for a call that takes it positionally rather than in a
   * body — a deletion, a status change, a reservation. `undefined` is the honest
   * answer when this card has never seen a version: it states no precondition
   * instead of an empty one, exactly as `withVersion` omits the key.
   */
  function atVersion(): number | undefined {
    return orderVersion.value ?? undefined
  }

  /** One accepted write, one step — the other half of the server's `bumpVersion`. */
  function serverWrote(): void {
    if (orderVersion.value !== null) orderVersion.value += 1
  }

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
   * An emptied number field is not a number — pitfall #25.
   *
   * `v-model.number` runs `parseFloat('')` and stores `NaN`. None of these four
   * fields is nullable, so there is no `null` to fall back to and the honest
   * reading of an empty percentage box is zero.
   *
   * Left alone it does not look broken, which is the trouble. `roundTo` returns
   * zero for anything non-finite, so a cleared VAT rate reads as a perfectly
   * ordinary "VAT 0.00, gross = net": a 21% order quietly presented as one with
   * no VAT at all. And it travels — `useDirtyCheck.diff()` compares through
   * `JSON.stringify` but RETURNS the raw value, so the `NaN` itself goes into the
   * request. Here `requireFiniteNumbers` refuses it and the order simply stops
   * saving; on a real server JSON flattens it to `null` on the way out, which is
   * contract §1 rule 6 word for word.
   */
  watch(
    form,
    (val) => {
      if (Number.isNaN(val.vatPercent)) val.vatPercent = 0
      if (Number.isNaN(val.defaultMarginPercent)) val.defaultMarginPercent = 0
      if (Number.isNaN(val.defaultDiscountPercent)) val.defaultDiscountPercent = 0
      if (Number.isNaN(val.totalWeight)) val.totalWeight = 0
    },
    { deep: true },
  )

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
    if (Object.keys(payload).length === 0) return
    // Added after the emptiness test, never before it: a precondition is not a
    // change, and a request carrying nothing but a version would write nothing
    // and still spend a step of it.
    await patchOrder(id, withVersion(payload))
    serverWrote()
  }

  // ─── Audit log ─────────────────────────────────────────────────────────
  const auditLog = ref<OrderAuditEntry[]>([])

  /**
   * The history comes with the order — §4.1 sends it inside `GET /orders/:id` —
   * so it is read off the copy `load()` already has.
   *
   * It used to fetch the whole order a second time for this one field, with a
   * loading flag of its own. Besides the round trip, that was a second READ:
   * between the two the order can move, and the history on screen would then
   * belong to a version other than the one `order.value` and `orderVersion` are
   * holding. There is nothing left to load separately, so there is nothing left
   * to show a separate spinner for.
   */
  function readAudit() {
    auditLog.value = order.value?.auditLog ?? []
  }

  /**
   * By the record's own name, not by where it sits.
   *
   * The list grows while it is open — every save appends to it — and another
   * admin can be deleting from it at the same time. A position read at render
   * time names a different record by the time the request lands, and the local
   * splice would then hide the wrong row on top of that.
   */
  async function deleteAuditEntry(entryId: string) {
    try {
      await deleteOrderAuditEntry(id, entryId, atVersion())
      serverWrote()
      auditLog.value = auditLog.value.filter((entry) => entry.id !== entryId)
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
      // What this card is now writing against. A reload is the only thing that
      // can put it back in step after somebody else has written.
      orderVersion.value = order.value.version ?? null
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
      // Same reason as the ship plan: what can come back changes with every
      // shipment and every earlier return.
      await loadReturns()
      await loadReturnPlan()
      readAudit()
    } catch (e) {
      // A key, not the exception's own words: `String(e)` put `Error:
      // ORDER_NOT_FOUND` in front of a person, and the table that turns every
      // one of those codes into a sentence is right here (contract §3).
      error.value = lineEditErrorKey(e, 'orders.toast_error_load')
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
        const created = await addOrderItem(
          id,
          withVersion({
            productId: item.productId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            // Sent explicitly: the server would otherwise apply the order default,
            // and the line would change under the admin the moment it is stored.
            discountPercent: item.discountPercent,
          }),
        )
        serverWrote()
        serverLineId.set(item.localId, created.id)
        pendingItems.value = pendingItems.value.slice(1)
      }
      while (pendingServices.value.length > 0) {
        const svc = pendingServices.value[0]!
        const created = await addOrderService(
          id,
          withVersion({
            serviceId: svc.serviceId,
            quantity: svc.quantity,
            price: svc.price,
            discountPercent: svc.discountPercent,
          }),
        )
        serverWrote()
        serverLineId.set(svc.localId, created.id)
        pendingServices.value = pendingServices.value.slice(1)
      }

      // 3. Line edits, one request each and in the order they were made — an
      //    accumulated delta cannot express that order, and the order decides
      //    the result. See `orderLineEdits`.
      while (pendingLineEdits.value.length > 0) {
        const edit = pendingLineEdits.value[0]!
        const target = serverLineId.get(edit.lineId) ?? edit.lineId
        const delta: LineEditPayload = withVersion(lineEditDelta(edit.op, edit.kind))
        // "Reset to computed" is the one edit whose result depends on a field of
        // the order, so it is the one that cannot be left to the server's copy of
        // that field: the fields above went out first, and the default typed
        // AFTER the button was pressed would then settle a line it was never
        // meant to touch. The number that was on screen at the time travels with
        // the operation. See `LineEditEnvelope`.
        if (delta.resetPrice) delta.defaultDiscountPercent = edit.ctx.defaultDiscountPercent
        if (edit.kind === 'item') await updateOrderItem(id, target, delta)
        else await updateOrderService(id, target, delta)
        serverWrote()
        pendingLineEdits.value = pendingLineEdits.value.slice(1)
      }

      // 4. Removals last: a line removed on screen is gone, whatever was done
      //    to it before that. Through `serverLineId` for the same reason the
      //    edits above are: a save that failed halfway has already created the
      //    line, so the id on screen is no longer the id the server knows it by.
      //    Sent raw, the deletion named an id nobody had issued, was accepted as
      //    a no-op, and the line the admin removed came back with the reload.
      //    A deletion carries no body, so its version travels as `If-Match`
      //    (contract §3). It used to state none at all, on the argument that the
      //    requests above had already established what this card was looking at —
      //    which holds only for a save that HAS requests above it. A save whose
      //    single act is a deletion had nothing in front of it, and went through
      //    against an order somebody else had already changed.
      while (pendingItemDeletions.value.length > 0) {
        const lineId = pendingItemDeletions.value[0]!
        await deleteOrderItem(id, serverLineId.get(lineId) ?? lineId, atVersion())
        serverWrote()
        pendingItemDeletions.value = pendingItemDeletions.value.slice(1)
      }
      while (pendingServiceDeletions.value.length > 0) {
        const lineId = pendingServiceDeletions.value[0]!
        await deleteOrderService(id, serverLineId.get(lineId) ?? lineId, atVersion())
        serverWrote()
        pendingServiceDeletions.value = pendingServiceDeletions.value.slice(1)
      }

      // 5. Files
      while (pendingFileAdds.value.length > 0) {
        await addOrderFile(id, pendingFileAdds.value[0]!, atVersion())
        serverWrote()
        pendingFileAdds.value = pendingFileAdds.value.slice(1)
      }
      while (pendingFileRemoves.value.length > 0) {
        await removeOrderFile(id, pendingFileRemoves.value[0]!, atVersion())
        serverWrote()
        pendingFileRemoves.value = pendingFileRemoves.value.slice(1)
      }

      // Reload to get fresh state after all changes
      await load()
      clearPending()
      toast.success(t('orders.toast_saved'))
    } catch (e) {
      // Somebody else wrote this order while this card was being edited. The
      // refused request wrote nothing, so what is on the server is entirely
      // theirs — and the one thing that must not happen is what happened before
      // the version existed: "saved", and one of the two numbers gone. Said out
      // loud, and the card is put back on what the server actually holds, so the
      // admin can see what they are typing over and decide again.
      if (String(e).includes('ORDER_VERSION_CONFLICT')) {
        toast.error(t('orders.error_version_conflict'))
        clearPending()
        await load()
        return
      }
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
      await deleteOrder(id, atVersion())
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

  /**
   * Every server action here ends in `load()`, and `load()` is destructive: it
   * replaces the order, rewrites the form and re-captures the dirty baseline. So
   * each one has to answer the same two questions first — what happens to the
   * unsaved LINES, and what happens to the unsaved FIELDS.
   *
   * Written once because three of them had answered neither: a status change, a
   * cancelled shipment and a reservation all reloaded on top of whatever the
   * admin had typed. The note vanished, the save bar went out, and nobody was
   * told. With line edits it was worse — the table went back to the server's
   * version while `pendingLineEdits` stayed full, so the bar went on offering to
   * save changes that were no longer on screen.
   *
   * Returns false when the lines have to go out first; the caller stops there.
   */
  async function flushBeforeReload(): Promise<boolean> {
    if (hasPendingChanges.value) {
      toast.error(t('orders.error_save_lines_first'))
      return false
    }
    try {
      await saveFormFields()
    } catch (e) {
      // The fields did not go out, so the action below must not happen either:
      // it would reload and take them with it.
      toast.error(t(lineEditErrorKey(e)))
      return false
    }
    return true
  }

  async function applyStatusChange(status: OrderStatus) {
    if (!(await flushBeforeReload())) return
    statusChanging.value = true
    try {
      await patchOrderStatus(id, status, atVersion())
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

  /**
   * The deliveries panel. The ship PLAN is `load()`'s — every caller of this
   * pairs the two, and asking for it here as well fetched it twice each time,
   * including on mount.
   */
  async function loadShipments() {
    shipmentsLoading.value = true
    try {
      shipments.value = await getOrderShipments(id)
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
    // server first — and the reload below would take the unsaved fields.
    if (!(await flushBeforeReload())) return false
    shipmentsLoading.value = true
    try {
      await createOrderShipment(id, withVersion({ lines, vehicle: note ?? null }))
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
    if (!(await flushBeforeReload())) return
    shipmentsLoading.value = true
    try {
      await cancelOrderShipment(
        id,
        shipmentId,
        withVersion({ correctionReason: correctionReason ?? null }),
      )
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

  // ─── Returns ────────────────────────────────────────────────────────────
  // Goods coming back. Not a cancelled shipment: that one says the delivery
  // never effectively happened, this one says it happened and was reversed.

  const returns = ref<OrderReturn[]>([])
  const returnableLines = ref<ReturnableLine[]>([])
  const returnsLoading = ref(false)

  async function loadReturns() {
    try {
      returns.value = await getOrderReturns(id)
    } catch {
      returns.value = []
    }
  }

  async function loadReturnPlan() {
    try {
      returnableLines.value = await planOrderReturn(id)
    } catch {
      returnableLines.value = []
    }
  }

  async function createReturn(
    lines: Array<{
      lineId: string
      quantity: number
      condition: ReturnCondition
      compensated: boolean
    }>,
    reason: string,
  ): Promise<boolean> {
    if (!order.value || lines.length === 0) return false
    // Already going out — `disabled` lands a tick late, and a second Enter puts
    // the same steel back on the shelf twice.
    if (returnsLoading.value) return false
    // The reload below takes the unsaved fields with it, so they go first.
    if (!(await flushBeforeReload())) return false
    returnsLoading.value = true
    try {
      await createOrderReturn(id, withVersion({ lines, reason }))
      await load()
      await loadReturns()
      await loadReturnPlan()
      toast.success(t('orders.toast_return_created'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      returnsLoading.value = false
    }
  }

  /** How much of each line has come back — what the line table marks. */
  const returnedByLine = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const item of order.value?.items ?? []) {
      if (item.returnedQuantity > 0) map[item.id] = item.returnedQuantity
    }
    return map
  })

  /**
   * What the returns take off the bill, gross.
   *
   * Only the compensated part: goods kept against a debt came back without the
   * money following them. Derived, never stored — the order total says what the
   * order was for, and this says what is coming off it.
   */
  const returnedGross = computed(() => {
    let net = 0
    for (const ret of returns.value) {
      for (const line of ret.lines) {
        if (!line.compensated) continue
        const item = order.value?.items.find((i) => i.id === line.lineId)
        if (!item) continue
        net = round2(net + calcLine({ ...toPricingLine(item), quantity: line.quantity }).lineNet)
      }
    }
    return round2(netToGross(net, form.value.vatMode, form.value.vatPercent))
  })

  /** What the client is ultimately expected to pay: the order less what came back. */
  const netAmount = computed(() => round2(totals.value.totalGross - returnedGross.value))

  /**
   * Has anything come back, and is it everything?
   *
   * Counted in goods, not money — the two axes are independent, and this is the
   * one the header badge and the line marks speak about.
   */
  const returnState = computed<'none' | 'partial' | 'full'>(() => {
    let shipped = 0
    let returned = 0
    for (const item of order.value?.items ?? []) {
      shipped = round2(shipped + item.shippedQuantity)
      returned = round2(returned + item.returnedQuantity)
    }
    if (returned <= 0) return 'none'
    return returned >= shipped ? 'full' : 'partial'
  })

  /**
   * Has the money gone back?
   *
   * The other axis, and deliberately separate: goods can be back with the refund
   * still unpaid, and a refund can be paid before the truck arrives. Read off the
   * payments, the way the paid share is — never stored.
   */
  const refundState = computed<'none' | 'partial' | 'full'>(() => {
    const refunded = round2(
      payments.value
        .filter((p) => p.purpose === 'refund')
        .reduce((sum, p) => sum + Math.abs(p.amount), 0),
    )
    if (refunded <= 0) return 'none'
    return refunded >= returnedGross.value ? 'full' : 'partial'
  })

  async function reserveStock() {
    // The lines were already guarded here; the fields were not, and `load()`
    // below takes both.
    if (!(await flushBeforeReload())) return
    try {
      const created = await reserveOrderStock(id, atVersion())
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
   * Documents the client is no longer holding.
   *
   * Withdrawn, not merely corrected: an adjusting correction fixes a figure on a
   * document the client still holds, and that document still has to be taken back
   * before its delivery can be cancelled. Same rule as the server's `isWithdrawn`,
   * and derived once here so the two questions below cannot drift apart.
   */
  const withdrawnIds = computed(
    () =>
      new Set(
        invoices.value
          .filter((i) => i.kind === 'correction' && i.withdrawsOriginal)
          .map((i) => i.correctsInvoiceId),
      ),
  )

  /**
   * The invoice the client is still holding for this delivery — a corrected one
   * does not count, which is what makes the delivery cancellable again.
   */
  function liveInvoiceFor(shipmentId: string): Invoice | null {
    return (
      invoices.value.find(
        (i) =>
          i.shipmentId === shipmentId && i.kind !== 'correction' && !withdrawnIds.value.has(i.id),
      ) ?? null
    )
  }

  /**
   * The invoice the client is still holding that charged for this service line.
   *
   * Asked per service and not "the invoice that covers services", because a live
   * order can carry several, each having charged for a different set — a service
   * added after the first invoice rides on a later one (contract §4.6). Looking
   * for the first services-carrying document named the wrong one.
   */
  function liveInvoiceCoveringService(serviceLineId: string): Invoice | null {
    return (
      invoices.value.find(
        (i) =>
          i.kind !== 'correction' &&
          !withdrawnIds.value.has(i.id) &&
          i.coveredServiceIds.includes(serviceLineId),
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
      const created = await addOrderPayment(id, withVersion(data))
      serverWrote()
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
      await deleteOrderPayment(id, paymentId, atVersion())
      serverWrote()
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
      await createOrderInvoice(id, withVersion({ kind: 'regular' as const, shipmentId }))
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
   * Service lines no live document has charged for yet.
   *
   * The same question the server asks itself in `unbilledServices`, and asked the
   * same way: a service is billed when a regular invoice the client is still
   * holding names it. A correction, or a document that has been withdrawn, does
   * not count — which is exactly how a service becomes billable again after its
   * delivery was cancelled.
   */
  const unbilledServices = computed(() =>
    (order.value?.services ?? []).filter((s) => liveInvoiceCoveringService(s.id) === null),
  )

  /**
   * The invoice for services alone.
   *
   * Services do not ship, so there is no waybill to demand of them: a regular
   * invoice carrying nothing but unbilled services stands on its own, and its
   * amount comes from them (contract §4.6). The server has accepted this since
   * the service-invoicing finding was closed; the card had no way to ask for it,
   * and so an order whose deliveries were all invoiced already held service money
   * that could not be put on any document at all. An advance invoice is not the
   * way round it — an advance is a promise to pay ahead, and this is work done.
   *
   * Issuing it freezes those services, so unsaved changes go out first for the
   * same reason they do for a delivery's invoice.
   */
  async function issueServicesInvoice(): Promise<boolean> {
    if (paymentSaving.value) return false
    if (hasPendingChanges.value || isDirty.value) {
      toast.error(t('orders.error_save_lines_first'))
      return false
    }
    paymentSaving.value = true
    try {
      await createOrderInvoice(id, withVersion({ kind: 'regular' as const }))
      // The freeze lands on the service lines, so the table has to be re-read.
      await load()
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
      const created = await createOrderInvoice(
        id,
        withVersion({ kind: 'advance' as const, amountGross }),
      )
      serverWrote()
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
          .then((r) => ({ unitCost: r.unitPrice, hasShortage: r.shortageQuantity > 0 }))
          .catch(() => null),
      ),
    )
    // One rule for both sides — see `stockCostFor`. Rounded there exactly as the
    // server rounds it: left raw, the margin derived from it would differ in the
    // second decimal from the one that comes back on Save, and the preview would
    // be right about the price and wrong about the markup.
    const costs = items.map((item, idx) => {
      const answer = fifoCosts[idx]
      return stockCostFor(answer ? answer.unitCost : (item.unitCost ?? null), answer?.hasShortage)
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
      const { unitCost, costSource } = costs[idx]!
      return buildOrderItem({
        // A guessed cost is marked as a guess, so reports can tell them apart.
        costSource,
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
        // The caption on a warehouse cost — see `baseCurrencyOf`.
        receivedCurrency: baseCurrencyOf(settings),
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

  /**
   * Refuses a line the freeze covers, and says which document is in the way.
   *
   * Checked here and not only by hiding the button: the button was there and the
   * server took the deletion, so a shipped line could be removed while its waybill,
   * its stock movements and the client's invoice went on naming it.
   */
  function removeLine(lineId: string, kind: LineKind): boolean {
    const line = findLine(lineId, kind)
    if (!line) return false
    const pricing = toPricingLine(line)
    if (!canDeleteLine(pricing)) {
      toast.error(
        t(
          pricing.shippedQuantity > 0
            ? 'orders.error_line_has_shipment'
            : 'orders.error_line_on_invoice',
        ),
      )
      return false
    }
    forgetLine(lineId, kind)
    return true
  }

  function handleDeleteItem(lineId: string) {
    if (!removeLine(lineId, 'item')) return
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
    if (!removeLine(svcId, 'service')) return
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

  /**
   * What a quantity change does to a goods line's cost — settled here so the row
   * shows what the save will store.
   *
   * Growing a line takes its extra units off real batches at real prices, and
   * the line's cost is the blend of everything it now holds. Only the warehouse
   * knows which batches those are, so the server sends the ladder with the order
   * (`costTopUp`) and this takes units off the front of it: the rule stays on
   * the server, the arithmetic — a weighted average — happens on both sides,
   * over the same numbers, and lands on the same figure to all ten stored
   * digits. Running FIFO here instead would be a second copy of the rule, which
   * is where every finding in this audit began.
   *
   * The price does not move: a quantity edit "keeps the price per unit; the line
   * total follows" (`applyQuantityEdit`). The units already in the line did not
   * get dearer — the average did, because cheap ones ran out — so the planned
   * margin takes the difference, exactly as it does for a corrected cost (§4.2.1,
   * rule 4). The server's `topUpAllocation` is the twin of this; changing one
   * without the other puts the card and the order back out of step.
   */
  function settleCostAfterQuantity(line: OrderItem): void {
    // A cost somebody typed by hand is not the shelf's to move, and one that has
    // gone out on paper cannot move at all — the same two exemptions the server
    // makes, for the same reasons.
    if (line.costSource === 'manual' || isCostFrozen(toPricingLine(line))) return

    const held = round2(line.allocations.reduce((sum, a) => sum + a.quantity, 0))
    let missing = round2(line.quantity - held)
    // A line that shrank hands batches back and keeps its cost. The server does
    // not re-read one either: an edit that took no new units off the shelf has
    // nothing new to say about what they cost.
    if (missing <= 0) return
    // No ladder means the server has never spoken about this line — a row added
    // on screen a minute ago. Nothing here may invent what the shelf would give
    // it; the cost stays, and the price is what has to agree, which is why both
    // sides hold the price rather than the cost.
    const ladder = order.value?.costTopUp?.[line.id]
    if (!ladder) return

    // The price as it stands, at full precision, before the cost moves under it.
    const priceBefore = line.unitCost * (1 + line.marginPercent / 100)
    const computesItsPrice = line.manualUnitPrice === null && line.namedUnitPrice === null

    while (missing > 0 && ladder.length > 0) {
      const next = ladder[0]!
      const take = Math.min(missing, next.quantity)
      line.allocations = [...line.allocations, { ...next, quantity: take }]
      next.quantity = round2(next.quantity - take)
      if (next.quantity <= 0) ladder.shift()
      missing = round2(missing - take)
    }

    const covered = round2(line.allocations.reduce((sum, a) => sum + a.quantity, 0))
    const spent = line.allocations.reduce((sum, a) => sum + a.quantity * a.unitCost, 0)
    // Kept at storage precision, not rounded to the cent a second time: the cent
    // is for showing, and a cost rounded twice stops matching the one the order
    // is really worth (§7). `stockCostFor` still decides WHAT the figure is — a
    // cost of nothing is no cost, and a line the shelf cannot cover is a guess.
    const weighted = covered > 0 ? roundStored(spent / covered) : 0
    const { unitCost, costSource } = stockCostFor(weighted, round2(line.quantity - covered) > 0)

    line.unitCost = unitCost === 0 ? 0 : weighted
    line.costSource = costSource
    if (computesItsPrice && priceBefore > 0 && line.unitCost > 0) {
      line.marginPercent = marginFor(line.unitCost, priceBefore)
    }
    projectItem(line)
  }

  /** Returns false when the model refused the edit; the line is left untouched. */
  function editLine(lineId: string, kind: LineKind, op: LineEditOp): boolean {
    const line = findLine(lineId, kind)
    if (!line) return false
    // Read once and kept: the preview below and the request that goes out on Save
    // are the same operation, and an operation settled against a number has to be
    // settled against the SAME number both times. The order default can change
    // between the two — the field is right there on the screen — and it used to.
    const ctx: LineEditContext = { defaultDiscountPercent: form.value.defaultDiscountPercent }
    try {
      applyLineEdit(line, op, ctx)
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    }
    // Only goods draw on the warehouse, and only a quantity change asks it for
    // more. Everything else on a line is priced from a cost that has not moved.
    if (kind === 'item' && op.field === 'quantity') settleCostAfterQuantity(line as OrderItem)
    pendingLineEdits.value = [...pendingLineEdits.value, { lineId, kind, op, ctx }]
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
    // The reload below replaces the form and its dirty baseline, so anything
    // still unsaved there would simply vanish.
    if (!(await flushBeforeReload())) return false
    splitting.value = true
    try {
      // The cut lands exactly on what already shipped — anywhere else and goods
      // would either vanish from the records or count as shipped twice.
      await splitOrderItem(id, lineId, line.shippedQuantity, atVersion())
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

  /**
   * Correcting a frozen line — the only way past the freeze (model, sections 6
   * and 12). A server action, like splitting: it issues a document, so unsaved
   * line changes have to be in first, or the correction would be measured against
   * a price the server has never seen.
   */
  const correcting = ref(false)

  async function correctLine(
    lineId: string,
    data: { unitPrice?: number; unitCost?: number; reason: string },
  ): Promise<boolean> {
    if (correcting.value) return false
    // The reload below replaces the form and its dirty baseline, so anything
    // still unsaved there would simply vanish.
    if (!(await flushBeforeReload())) return false
    correcting.value = true
    try {
      await correctOrderLine(id, lineId, withVersion(data))
      await load()
      // The correcting invoice belongs to a delivery, and the panel that lists
      // them is read separately.
      await loadShipments()
      toast.success(t('orders.toast_line_corrected'))
      return true
    } catch (e) {
      toast.error(t(lineEditErrorKey(e)))
      return false
    } finally {
      correcting.value = false
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
      await allocateOrderTotal(id, allocationPreview.value.requestedGross, atVersion())
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
    // Returns
    returns,
    returnableLines,
    returnsLoading,
    createReturn,
    returnedByLine,
    returnedGross,
    netAmount,
    returnState,
    refundState,
    // Money: payments and invoices
    payments,
    invoices,
    paid,
    paymentDrift,
    paymentSaving,
    liveInvoiceFor,
    liveInvoiceCoveringService,
    addPayment,
    removePayment,
    issueInvoiceFor,
    issueAdvanceInvoice,
    issueServicesInvoice,
    unbilledServices,
    handleAddItemDirect,
    handleDeleteItem,
    handleAddServiceDirect,
    handleDeleteService,
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
    correctLine,
    correcting,
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
