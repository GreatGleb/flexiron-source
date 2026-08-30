<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useOrderCard } from '@/composables/useOrderCard'
import { useUnitLabel } from '@/composables/useUnitLabel'
import { useToast } from '@/composables/useToast'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import AutoResizeTextarea from '@/components/admin/ui/AutoResizeTextarea.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import SuffixSelect from '@/components/admin/ui/SuffixSelect.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import AddOrderItemsModal from './AddOrderItemsModal.vue'
import AddOrderServicesModal from './AddOrderServicesModal.vue'
import { getCurrencies } from '@/services/settingsService'
import type { Currency } from '@/types/settings'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useOrderPermissions } from '@/composables/useOrderPermissions'
import {
  canDeleteLine,
  canEditLineField,
  type LineEditOp,
  type LineKind,
} from '@/services/orderLineEdits'
import { splitsWholePiece, toPricingLine } from '@/services/orderLines'
import {
  applyCorrection,
  applyCostCorrection,
  calcLine,
  formatCents as money,
  isPriceLocked,
  rollupOrder,
  roundTo,
} from '@/domain/orderPricing'
import { ORDER_STATUSES, ORDER_STATUS_PILL } from '@/domain/orderStatus'
import { invoiceBalances, isInvoiceWithdrawn, nextUnsettledInvoice } from '@/domain/receivable'
import type {
  Invoice,
  OrderItem,
  OrderService,
  OrderStatus,
  PaymentPurpose,
  ShippableLine,
  ReturnableLine,
  ReturnCondition,
  VatMode,
} from '@/types/order'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'
import '@styles/admin/components/_order-status-pill.css'
import '@styles/admin/orders_card.css'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const unitLabel = useUnitLabel()
const toast = useToast()
const id = route.params.id as string

const {
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
  statusPlan,
  statusChanging,
  requestStatusChange,
  confirmStatusChange,
  cancelStatusChange,
  shipments,
  shipmentsLoading,
  loadShipments,
  shippableLines,
  shipLines,
  cancelShipment,
  reserveStock,
  returns,
  returnableLines,
  returnsLoading,
  createReturn,
  returnedByLine,
  returnedGross,
  netAmount,
  returnState,
  refundState,
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
  totals,
  allocationPreview,
  allocating,
  previewTotal,
  cancelAllocation,
  confirmAllocation,
  pendingVatMode,
  requestVatMode,
  confirmVatMode,
  cancelVatMode,
  defaultsPreview,
  requestApplyDefaults,
  cancelApplyDefaults,
  applyDefaultsToAllLines,
  addModes,
  orderTermsDiscount,
  keepTotalPreview,
  confirmKeepTotal,
  cancelKeepTotal,
  editLine,
  correctLine,
  correcting,
  splitItemLine,
  splitting,
  tf,
  hasPendingChanges,
} = useOrderCard(id)

const pageTitle = computed(() =>
  order.value ? `${t('orders.card_title')} ${order.value.orderNumber}` : t('orders.title'),
)

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => t('orders.card_title'),
})

// ─── Document type options ─────────────────────────────────────
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'local', label: t('orders.create_option_local') },
  { value: 'export', label: t('orders.create_option_export') },
]

// ─── Status options ────────────────────────────────────────────
// One list, from `domain/orderStatus`. Written out here as well, it drifted from
// the list page's copy the moment either gained a status.
const STATUS_OPTIONS = computed(() =>
  ORDER_STATUSES.map((s) => ({ value: s, label: t(`orders.status_${s}`) })),
)

const statusStr = computed({
  get: () => order.value?.status ?? 'new',
  set: (v: string) => {
    // Never straight through: a status may reserve the remainder or write it off
    // the shelf, and the admin is shown what that means before it happens.
    requestStatusChange(v as OrderStatus)
  },
})

// ─── Financials ──────────────────────────────────────────────
// Everything comes from the pricing module through the composable. The old chain
// here charged VAT on the cost and then stacked margin on top of the VAT, which
// showed 26 438,50 on an order whose real total with VAT is 22 990,00.

const isShipmentsOn = useFeatureFlag('orderShipments')
const isMoneyOn = useFeatureFlag('orderInvoicesPayments')
const isReturnsOn = useFeatureFlag('orderReturns')

// Model section 12: three rights. Not flags — a flag says the system has the
// capability, a right says this user may use it. The server refuses the two write
// ones as well; a hidden button is a suggestion, not a rule.
const { ready: rightsReady, canSeeCost, canSetManualCost, canCorrect } = useOrderPermissions()

/**
 * The card waits for the rights as it waits for the order.
 *
 * They arrive from the server a moment later, and the cost columns depend on them:
 * rendering first and then adding two columns is a visible jump, and the first
 * frame is a card that quietly says this user may not see cost.
 */
const cardLoading = computed(() => (loading.value && !order.value) || !rightsReady.value)

/** Product name for a shipment row, which stores only the line id. */
function lineNameFor(lineId: string): string {
  return order.value?.items.find((i) => i.id === lineId)?.productName ?? lineId
}

/** The gross total the admin edits. Read-only until the flag is on. */
const grossInput = ref('')
const grossError = ref<string | null>(null)

watch(
  () => totals.value.totalGross,
  (value) => {
    grossInput.value = value.toFixed(2)
  },
  { immediate: true },
)

function onGrossCommit() {
  grossError.value = null
  const target = Number(grossInput.value)
  if (!Number.isFinite(target) || target < 0) {
    grossError.value = t('orders.error_total_not_possible')
    return
  }
  if (Math.abs(target - totals.value.totalGross) < 0.005) return
  const problem = previewTotal(target)
  if (problem) grossError.value = t(problem)
}

/**
 * Walking away from the preview puts the field back on the order's real total.
 *
 * The watch above only fires when the TOTAL moves, and cancelling moves nothing
 * — so the field went on showing the figure that was asked for and refused,
 * next to a net and a VAT amount that were still telling the truth, with no
 * error beside it to say which of the three to believe.
 */
function onCancelAllocation() {
  cancelAllocation()
  grossError.value = null
  grossInput.value = totals.value.totalGross.toFixed(2)
}

const VAT_MODE_OPTIONS = computed(() => [
  { value: 'standard', label: t('orders.vat_mode_standard', { rate: form.value.vatPercent }) },
  { value: 'export_zero', label: t('orders.vat_mode_export_zero') },
  { value: 'reverse_charge', label: t('orders.vat_mode_reverse_charge') },
  { value: 'exempt', label: t('orders.vat_mode_exempt') },
])

const vatModeStr = computed({
  get: () => form.value.vatMode as string,
  set: (value: string) => requestVatMode(value as VatMode),
})

// ─── Line table ────────────────────────────────────────────────
// The numeric columns are the same six for goods and for services, so both
// tables render them from one list. Everything read-only — cost, planned and
// actual margin, the 🔒 and the line state — shows for everyone; only the
// editing sits behind the flag.

type CellField =
  | 'quantity'
  | 'unitCost'
  | 'marginPercent'
  | 'discountPercent'
  | 'unitPrice'
  | 'lineTotal'

const ALL_LINE_CELLS = [
  { field: 'quantity', label: 'orders.col_quantity', step: '0.001', suffix: '' },
  { field: 'unitCost', label: 'orders.col_unit_cost', step: '0.01', suffix: '' },
  { field: 'marginPercent', label: 'orders.col_margin_percent', step: '0.1', suffix: '%' },
  { field: 'discountPercent', label: 'orders.col_discount', step: '0.1', suffix: '%' },
  { field: 'unitPrice', label: 'orders.col_unit_price', step: '0.01', suffix: '' },
  { field: 'lineTotal', label: 'orders.col_total_price', step: '0.01', suffix: '' },
] as const satisfies ReadonlyArray<{
  field: CellField
  label: string
  step: string
  suffix: string
}>

/**
 * Without the right to see cost, the cost and the markup are not columns at all.
 * What is left is the client's side of the line — how much, at what price, for how
 * much — which is exactly what the model says those users work with.
 */
const LINE_CELLS = computed(() =>
  canSeeCost.value
    ? ALL_LINE_CELLS
    : ALL_LINE_CELLS.filter((c) => c.field !== 'unitCost' && c.field !== 'marginPercent'),
)

/**
 * The order's history, minus what this user may not see.
 *
 * Two kinds of entry carry the unit cost as a number — a cost typed by hand and
 * a cost correction — and the history table used to render every entry there
 * was. Cost and margin are hidden in six other places on this card and were
 * readable here in plain figures, which is the same right defeated by a
 * different road (contract §5). The entry says so itself rather than being
 * recognised by its text: the property is translated into three languages, and
 * matching on words is not a rule.
 *
 * The real answer is the server not sending them, and it does not — this is the
 * curtain on top of the rule, not instead of it.
 */
const visibleAuditLog = computed(() =>
  canSeeCost.value ? auditLog.value : auditLog.value.filter((e) => e.sensitive !== 'cost'),
)

type OrderLine = OrderItem | OrderService

/** What the cell shows — and what it goes back to after any commit. */
function cellValue(line: OrderLine, field: CellField): string {
  switch (field) {
    case 'quantity':
      return String(line.quantity)
    case 'unitCost':
      return money(line.unitCost)
    case 'marginPercent':
      // No cost, no markup — 0.00 here would read as "sold at cost".
      return line.unitCost > 0 ? money(line.marginPercent) : '—'
    case 'discountPercent':
      return money(line.discountPercent)
    case 'unitPrice':
      return money('unitPrice' in line ? line.unitPrice : line.price)
    case 'lineTotal':
      return money(line.totalPrice)
  }
}

function opFor(field: CellField, value: number, reason?: string): LineEditOp {
  switch (field) {
    case 'quantity':
      return { field: 'quantity', value }
    case 'unitCost':
      return reason ? { field: 'unitCost', value, reason } : { field: 'unitCost', value }
    case 'marginPercent':
      return { field: 'marginPercent', value }
    case 'discountPercent':
      return { field: 'discountPercent', value }
    case 'unitPrice':
      return { field: 'unitPrice', value }
    case 'lineTotal':
      return { field: 'lineTotal', value }
  }
}

function canEdit(line: OrderLine, field: CellField | 'resetPrice' | 'resetCost'): boolean {
  if ((field === 'unitCost' || field === 'resetCost') && !canSetManualCost.value) return false
  return canEditLineField(toPricingLine(line), field)
}

function onCellCommit(event: Event, line: OrderLine, kind: LineKind, field: CellField) {
  const el = event.target as HTMLInputElement
  const raw = el.value.trim()
  const typed = Number(raw)
  const shown = Number(cellValue(line, field))

  // An empty cell is not a zero. A number input also empties itself on anything
  // it cannot parse ("380,50" with a comma), and reading that as 0 would wipe a
  // quantity or give the goods away for nothing.
  //
  // Committing the same number the cell was already showing is not an edit
  // either, and that matters: a cell shows two decimals while the price behind
  // it may carry more (a spread total does), so sending the rounded reading back
  // would move the money by a cent for someone who only tabbed through the row.
  if (raw !== '' && Number.isFinite(typed) && Math.abs(typed - shown) > 1e-9) {
    if (field === 'unitCost' && kind === 'item') askCostReason(line as OrderItem, typed)
    else editLine(line.id, kind, opFor(field, typed))
  }

  // Applied, refused or rounded — the cell now shows what the line actually
  // holds. An input still displaying a refused value is what makes an admin
  // believe the edit landed.
  el.value = cellValue(line, field)
}

/** Actual margin — the money left after the discount, not the planned markup. */
function lineMargin(line: OrderLine): number {
  return calcLine(toPricingLine(line)).marginAmount
}

function isFrozenLine(line: OrderLine): boolean {
  return line.state !== 'draft' || line.documentIssued
}

/**
 * The bin is gone once the line is named by a document.
 *
 * Not merely disabled: removal is the strongest edit there is, and every other
 * frozen control on this row is simply absent. The server refuses it too — this
 * only keeps the admin from reaching for something that cannot happen.
 */
function canDelete(line: OrderLine): boolean {
  return canDeleteLine(toPricingLine(line))
}

function lineStateLabel(line: OrderLine): string {
  if (line.state === 'partially_shipped') {
    return t('orders.line_state_partial', {
      shipped: line.shippedQuantity,
      total: line.quantity,
    })
  }
  if (line.state === 'shipped') return t('orders.line_state_shipped')
  // Nothing has shipped, but it is already on a document the client holds.
  return line.documentIssued ? t('orders.line_state_invoiced') : t('orders.line_state_draft')
}

function resetLinePriceCmd(line: OrderLine, kind: LineKind) {
  editLine(line.id, kind, { field: 'resetPrice' })
}

function resetLineCostCmd(item: OrderItem) {
  editLine(item.id, 'item', { field: 'resetCost' })
}

/** Only when there is a warehouse figure to go back to — see `clearManualCost`. */
function canResetCost(item: OrderItem): boolean {
  return item.manualUnitCost !== null && item.allocations.length > 0 && canEdit(item, 'resetCost')
}

// ─── Manual cost: the reason is mandatory ──────────────────────
const costEdit = ref<{ lineId: string; lineName: string; from: number; to: number } | null>(null)
const costReason = ref('')

function askCostReason(item: OrderItem, value: number) {
  costEdit.value = { lineId: item.id, lineName: item.productName, from: item.unitCost, to: value }
  costReason.value = item.manualCostReason ?? ''
}

function confirmCostEdit() {
  const pending = costEdit.value
  const reason = costReason.value.trim()
  if (!pending || !reason) return
  editLine(pending.lineId, 'item', { field: 'unitCost', value: pending.to, reason })
  costEdit.value = null
}

/**
 * Отказ на входе, а не на подтверждении.
 *
 * Всё, что перечислено ниже, сервер выполняет по СВОИМ позициям заказа: он спишет
 * со склада, вернёт на склад, посчитает корректировку и спланирует резервы по той
 * таблице, которая у него сохранена. Пока в карточке висят несохранённые правки
 * позиций, любое из этих действий будет отклонено — раньше отклонялось в самом
 * конце, после заполненного диалога, и сообщением, из которого было не понять, при
 * чём тут вообще возврат или отгрузка.
 *
 * Поэтому проверка стоит там, где диалог ещё не открыт: работу, которую всё равно
 * выбросят, не дают начать, а причина названа в тот момент, когда её можно убрать
 * одним нажатием Save. Несохранённые ПОЛЯ карточки сюда не входят — их
 * `flushBeforeReload()` отправляет сам, и мешать они не могут.
 *
 * Возвращает true, когда действие не должно состояться.
 */
function refusedForUnsavedLines(messageKey: string): boolean {
  if (!hasPendingChanges.value) return false
  toast.error(t(messageKey))
  return true
}

// ─── Correcting a frozen line ──────────────────────────────────
// Model, sections 6 and 12. The freeze exists so a document the client is holding
// cannot be rewritten behind their back — and this is the one door through it:
// a right, a mandatory reason, a line in the order's history, and a correcting
// invoice for the difference. It is a server action, so nothing happens locally.

const correctTarget = ref<{ line: OrderLine; kind: LineKind } | null>(null)
const correctPrice = ref('')
const correctCost = ref('')
const correctReason = ref('')

function askCorrection(line: OrderLine, kind: LineKind) {
  // Said out loud rather than by a missing button: the admin needs to know whom
  // to ask, and the server refuses it anyway.
  if (!canCorrect.value) {
    toast.error(t('orders.error_forbidden_correction'))
    return
  }
  if (refusedForUnsavedLines('orders.error_correction_needs_save')) return
  correctTarget.value = { line, kind }
  correctPrice.value = cellValue(line, 'unitPrice')
  correctCost.value = cellValue(line, 'unitCost')
  correctReason.value = ''
}

/**
 * What the correction would do, run through the same functions the server runs.
 *
 * The exact amount of the correcting invoice is deliberately NOT restated here:
 * it is the difference over the quantity each document actually billed, the server
 * works that out from the shipments, and a second implementation of it on this
 * side is precisely the kind of copy that drifts. The dialog says what changes and
 * that a document follows; the invoices panel then shows the figure.
 */
const correctionPreview = computed(() => {
  const target = correctTarget.value
  if (!target || !order.value) return null
  const before = toPricingLine(target.line)
  const price = Number(correctPrice.value)
  const cost = Number(correctCost.value)
  const priceChanged =
    Number.isFinite(price) && Math.abs(price - Number(cellValue(target.line, 'unitPrice'))) > 1e-9
  const costChanged =
    Number.isFinite(cost) && Math.abs(cost - Number(cellValue(target.line, 'unitCost'))) > 1e-9

  let after = before
  try {
    if (costChanged) after = applyCostCorrection(after, cost, 'manual')
    if (priceChanged) after = applyCorrection(after, price)
  } catch {
    return null
  }

  const others = [...order.value.items, ...order.value.services]
    .filter((l) => l.id !== target.line.id)
    .map(toPricingLine)
  return {
    priceChanged,
    costChanged,
    changed: priceChanged || costChanged,
    lineBefore: calcLine(before),
    lineAfter: calcLine(after),
    totalBefore: totals.value.totalGross,
    totalAfter: rollupOrder([...others, after], form.value.vatMode, form.value.vatPercent)
      .totalGross,
    // Which document the client is holding for this line, if any.
    invoice: invoiceCovering(target.line.id),
  }
})

/** The live invoice that names this line — what a correction would adjust. */
function invoiceCovering(lineId: string): Invoice | null {
  for (const shipment of shipments.value) {
    if (!shipment.lines.some((sl) => sl.lineId === lineId)) continue
    const invoice = liveInvoiceFor(shipment.id)
    if (invoice) return invoice
  }
  return liveInvoiceCoveringService(lineId)
}

async function confirmLineCorrection() {
  const target = correctTarget.value
  const preview = correctionPreview.value
  const reason = correctReason.value.trim()
  if (!target || !preview?.changed || !reason) return
  const payload: { unitPrice?: number; unitCost?: number; reason: string } = { reason }
  if (preview.priceChanged) payload.unitPrice = Number(correctPrice.value)
  if (preview.costChanged) payload.unitCost = Number(correctCost.value)
  correctTarget.value = null
  await correctLine(target.line.id, payload)
}

// ─── Shipments ─────────────────────────────────────────────────
const showShipModal = ref(false)
const shipQuantities = ref<Record<string, number>>({})
const shipVehicle = ref('')

function openShipModal() {
  if (refusedForUnsavedLines('orders.error_shipment_needs_save')) return
  shipQuantities.value = {}
  shipVehicle.value = ''
  showShipModal.value = true
}

/**
 * What a row offers to send: what can actually go, until the admin says otherwise.
 *
 * Read per row rather than snapshotted when the dialog opens. The plan comes from
 * the server, and a row that arrives a moment later would otherwise sit there
 * empty while its goods are on the shelf — and the dialog would refuse to send
 * anything at all.
 *
 * Offering what CAN go rather than what is owed matters too: a quantity the
 * write-off would refuse is worse than a smaller one that works.
 */
function shipQty(line: ShippableLine): number {
  return shipQuantities.value[line.lineId] ?? line.shippable
}

function setShipQty(line: ShippableLine, value: string) {
  shipQuantities.value[line.lineId] = Number(value)
}

/**
 * Режет ли введённое количество обрезок.
 *
 * Кусок неделим: он уезжает весь или не уезжает вовсе, поэтому количество, попавшее
 * СТРОГО внутрь куска, отгрузка отклонит. Верхнюю границу держит `max` поля, нижнюю —
 * ноль, а эти дырки внутри диапазона ничем, кроме проверки, не выразить: `step` у
 * `input[type=number]` умеет решётку, но не пропуски.
 *
 * Границы приходят с планом (`ShippableLine.wholePieces`) — вычислять их здесь значило
 * бы завести вторую разбивку строки рядом с той, по которой отгружают.
 */
function shipQtySplitsPiece(line: ShippableLine): boolean {
  return splitsWholePiece(shipQty(line), line.wholePieces)
}

const shipSelection = computed(() =>
  shippableLines.value
    .map((line) => ({ lineId: line.lineId, quantity: shipQty(line) }))
    .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0),
)

/** Диалог не отправляет то, что списание отклонит, — и говорит об этом до отправки. */
const shipSplitsPiece = computed(() => shippableLines.value.some(shipQtySplitsPiece))

async function confirmShipment() {
  const lines = shipSelection.value
  if (lines.length === 0 || shipSplitsPiece.value) return
  const ok = await shipLines(lines, shipVehicle.value.trim() || undefined)
  if (ok) showShipModal.value = false
}

// ─── Returns ───────────────────────────────────────────────────
const showReturnModal = ref(false)
const returnQuantities = ref<Record<string, number>>({})
const returnConditions = ref<Record<string, ReturnCondition>>({})
const returnCompensated = ref<Record<string, boolean>>({})
const returnReason = ref('')

const RETURN_CONDITION_OPTIONS = computed(() => [
  { value: 'good', label: t('orders.return_condition_good') },
  { value: 'defective', label: t('orders.return_condition_defective') },
])

function openReturnModal() {
  if (refusedForUnsavedLines('orders.error_return_needs_save')) return
  returnQuantities.value = {}
  returnConditions.value = {}
  returnCompensated.value = {}
  returnReason.value = ''
  showReturnModal.value = true
}

/**
 * Nothing is pre-filled here, unlike the shipping dialog.
 *
 * Shipping offers everything that can go, because sending the lot is the normal
 * case. A return is the opposite: what came back is a fact somebody has in front
 * of them, and a dialog that guesses "all of it" invites a return of goods still
 * sitting at the client's.
 */
function returnQty(line: ReturnableLine): number {
  return returnQuantities.value[line.lineId] ?? 0
}

function setReturnQty(line: ReturnableLine, value: string) {
  returnQuantities.value[line.lineId] = Number(value)
}

function returnCondition(line: ReturnableLine): ReturnCondition {
  return returnConditions.value[line.lineId] ?? 'good'
}

/**
 * Damaged goods default to no refund and sound ones to a refund — the answer
 * that is right more often, and switchable either way, because the two are
 * genuinely independent decisions.
 */
function setReturnCondition(line: ReturnableLine, value: string) {
  const condition = value as ReturnCondition
  returnConditions.value[line.lineId] = condition
  if (returnCompensated.value[line.lineId] === undefined) return
  returnCompensated.value[line.lineId] = condition === 'good'
}

function returnCompensates(line: ReturnableLine): boolean {
  return returnCompensated.value[line.lineId] ?? returnCondition(line) === 'good'
}

function toggleReturnCompensate(line: ReturnableLine, value: boolean) {
  returnCompensated.value[line.lineId] = value
}

const returnSelection = computed(() =>
  returnableLines.value
    .map((line) => ({
      lineId: line.lineId,
      quantity: returnQty(line),
      condition: returnCondition(line),
      compensated: returnCompensates(line),
    }))
    .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0),
)

/**
 * Чего не хватает для подтверждения возврата — пустая строка означает «всё готово».
 * Порядок веток тот же, что у `disabled` кнопки: сперва количества, потом причина.
 */
const returnBlockReason = computed(() => {
  if (returnSelection.value.length === 0) return t('orders.return_need_qty')
  if (!returnReason.value.trim()) return t('orders.return_need_reason')
  return ''
})

async function confirmReturn() {
  const lines = returnSelection.value
  if (lines.length === 0 || !returnReason.value.trim()) return
  const ok = await createReturn(lines, returnReason.value.trim())
  if (ok) showReturnModal.value = false
}

function returnLineSummary(line: {
  lineId: string
  quantity: number
  condition: ReturnCondition
  compensated: boolean
}): string {
  const marks: string[] = []
  if (line.condition === 'defective') marks.push(t('orders.return_line_defective'))
  if (!line.compensated) marks.push(t('orders.return_line_not_compensated'))
  const suffix = marks.length > 0 ? ` (${marks.join(', ')})` : ''
  return `${lineNameFor(line.lineId)} — ${line.quantity}${suffix}`
}

const cancelShipmentTarget = ref<string | null>(null)

async function confirmCancelShipment() {
  const target = cancelShipmentTarget.value
  cancelShipmentTarget.value = null
  if (target) await cancelShipment(target)
}

/**
 * Cancelling a delivery the client has an invoice for is a different operation —
 * the document has to be withdrawn by a correcting one, with a reason. So the
 * button leads to a different dialog rather than to a refusal.
 */
function askCancelShipment(shipmentId: string) {
  if (refusedForUnsavedLines('orders.error_shipment_cancel_needs_save')) return
  if (isMoneyOn.value && liveInvoiceFor(shipmentId)) {
    // Withdrawing a document the client holds is the "correction" right. Said out
    // loud rather than by a missing button: the admin needs to know whom to ask.
    if (!canCorrect.value) {
      toast.error(t('orders.error_forbidden_correction'))
      return
    }
    correctionReason.value = ''
    correctionTarget.value = shipmentId
    return
  }
  cancelShipmentTarget.value = shipmentId
}

// ─── Payments and invoices ─────────────────────────────────────
const correctionTarget = ref<string | null>(null)
const correctionReason = ref('')

/** The invoice the correction dialog is about — it names it and its amount. */
const correctionInvoice = computed(() =>
  correctionTarget.value ? liveInvoiceFor(correctionTarget.value) : null,
)

async function confirmCorrection() {
  const target = correctionTarget.value
  const reason = correctionReason.value.trim()
  if (!target || !reason) return
  correctionTarget.value = null
  await cancelShipment(target, reason)
}

const PAYMENT_PURPOSES = computed(() => [
  { value: 'advance', label: t('orders.payment_purpose_advance') },
  { value: 'balance', label: t('orders.payment_purpose_balance') },
  { value: 'refund', label: t('orders.payment_purpose_refund') },
])

const showPaymentModal = ref(false)
const paymentAmount = ref('')
const paymentPurpose = ref<PaymentPurpose>('balance')
const paymentDate = ref('')
const paymentNote = ref('')
const paymentInvoiceId = ref('')

/**
 * What each of the order's documents is worth today and what has come in on it —
 * from the domain, the same call the incoming registry and the client's summary
 * make. The dialog needs it to say WHICH document the money settles.
 */
const invoiceBalanceList = computed(() => invoiceBalances(invoices.value, payments.value))

function openPaymentModal() {
  // The money names the document it settles — the oldest one still owed.
  //
  // Left unnamed (the field used to open empty), the card counted the money and
  // the incoming registry did not: the same order showed "Paid" here and an
  // "Overdue, 0.00 received" line there, under the very invoice just settled.
  // Suggested, not imposed: the picker still offers every document and "no
  // document" for money that genuinely settles none — an advance before the
  // proforma, a payment on account. Money going the other way has no such
  // option: a refund names the document it goes back on (пункт 14).
  const target = nextUnsettledInvoice(invoiceBalanceList.value)
  const owed = target ? target.outstanding : paid.value.outstanding
  paymentAmount.value = owed > 0 ? money(owed) : ''
  paymentPurpose.value = paid.value.paidAmount > 0 ? 'balance' : 'advance'
  paymentDate.value = new Date().toISOString().slice(0, 10)
  paymentNote.value = ''
  paymentInvoiceId.value = target?.id ?? ''
  showPaymentModal.value = true
}

/**
 * What one click of "fill what is left" should put in the field: the balance of
 * the document being paid, and the order's own remainder only when the money
 * names no document. Filling the order's remainder against a single invoice is
 * how one document ends up overpaid while another stays open — the two views
 * part company again, one click away from the dialog that was just taught not to.
 */
const paymentTargetOutstanding = computed(() => {
  const selected = invoiceBalanceList.value.find((b) => b.id === paymentInvoiceId.value)
  return selected ? selected.outstanding : paid.value.outstanding
})

/**
 * Уходят ли эти деньги обратно.
 *
 * Тот же ответ, что даёт модель, и по тому же признаку — по ЗНАКУ суммы, а не
 * по ярлыку назначения. Поле суммы принимает минус (`type="number"` без `min`),
 * и «-50» при назначении «Balance» — это ушедшие деньги, названные приходом:
 * стража, смотревшая только на назначение, пропускала их без документа, и
 * карточка заказа снова расходилась с реестром «Входящих» на их сумму.
 */
const paymentGoesOut = computed(
  () => paymentPurpose.value === 'refund' || Number(paymentAmount.value) < 0,
)

/**
 * Документы, которые деньги могут назвать.
 *
 * «Без счёта» — вариант ТОЛЬКО для пришедших денег: аванс приходит раньше
 * проформы, «на счёт» не закрывает ничей долг, и такие деньги живут отдельной
 * строкой. У ушедших этого варианта нет (пункт 14): деньги уходят по
 * документу, который клиент держит на руках, а безымянный возврат считался
 * карточкой заказа и не считался реестром «Входящих» — те же два расхождения,
 * что пункт 13 закрыл для оплаты.
 */
const paymentInvoiceOptions = computed(() => [
  ...(paymentGoesOut.value ? [] : [{ value: '', label: t('orders.payment_invoice_none') }]),
  ...invoices.value
    .filter((i) => i.kind !== 'correction')
    .map((i) => ({ value: i.id, label: `${i.number} · ${money(i.amountGross)}` })),
])

/** Ушедшим деньгам нужен документ, и без выбранного документа их не сохранить. */
const refundNeedsInvoice = computed(() => paymentGoesOut.value && paymentInvoiceId.value === '')

// Переключились на возврат — подсказываем документ, по которому деньги пришли:
// возвращают то, что получили. Подсказка, а не подстановка молча: список открыт,
// «без счёта» из него убран, и человек видит, что документ назван.
watch(paymentPurpose, (purpose) => {
  if (purpose !== 'refund' || paymentInvoiceId.value !== '') return
  const settled = invoiceBalanceList.value.find((b) => b.paidAmount > 0)
  paymentInvoiceId.value = settled?.id ?? ''
})

async function confirmPayment() {
  const typed = Number(paymentAmount.value)
  if (!Number.isFinite(typed) || typed === 0) return
  if (refundNeedsInvoice.value) return
  const ok = await addPayment({
    // The admin types what arrived; a refund is money going the other way, and
    // making them type the minus sign themselves is how it gets forgotten.
    amount: paymentPurpose.value === 'refund' ? -Math.abs(typed) : typed,
    purpose: paymentPurpose.value,
    paidAt: paymentDate.value ? new Date(paymentDate.value).toISOString() : undefined,
    note: paymentNote.value.trim() || null,
    invoiceId: paymentInvoiceId.value || null,
  })
  if (ok) showPaymentModal.value = false
}

const showAdvanceModal = ref(false)
const advanceAmount = ref('')

function openAdvanceModal() {
  advanceAmount.value = money(totals.value.totalGross)
  showAdvanceModal.value = true
}

async function confirmAdvanceInvoice() {
  const typed = Number(advanceAmount.value)
  if (!Number.isFinite(typed) || typed <= 0) return
  const ok = await issueAdvanceInvoice(typed)
  if (ok) showAdvanceModal.value = false
}

/** Money the client has settled: shown as a share, so it moves with the total. */
/**
 * The refund, when there is one, outranks the coverage label.
 *
 * `PaymentState` is deliberately not extended with it: coverage answers "has the
 * client paid for this order", refunds answer "has money gone back", and an
 * order can be fully paid and partly refunded at the same time. Two questions,
 * two computeds — one pill, because the refund is the newer news.
 */
const paidStateLabel = computed(() => {
  if (isReturnsOn.value && refundState.value !== 'none') {
    return refundState.value === 'full'
      ? t('orders.payment_state_refunded')
      : t('orders.payment_state_partially_refunded')
  }
  switch (paid.value.state) {
    case 'paid':
      return t('orders.payment_state_paid')
    case 'partial':
      return t('orders.payment_state_partial', { percent: money(paid.value.paidPercent) })
    case 'overpaid':
      return t('orders.payment_state_overpaid')
    default:
      return t('orders.payment_state_unpaid')
  }
})

const PAID_STATE_PILL: Record<string, string> = {
  unpaid: 'pill-secondary',
  partial: 'pill-warning',
  paid: 'pill-success',
  overpaid: 'pill-danger',
}

function invoiceKindLabel(kind: string): string {
  if (kind === 'advance') return t('orders.invoice_kind_advance')
  if (kind === 'correction') return t('orders.invoice_kind_correction')
  return t('orders.invoice_kind_regular')
}

function purposeLabel(purpose: string): string {
  return t(`orders.payment_purpose_${purpose}`)
}

function invoiceNumberOf(invoiceId: string | null): string {
  if (!invoiceId) return '—'
  return invoices.value.find((i) => i.id === invoiceId)?.number ?? '—'
}

/** Shipment number for an invoice row, which stores only the id. */
function shipmentNumberOf(shipmentId: string | null): string {
  return shipments.value.find((s) => s.id === shipmentId)?.number ?? '—'
}

function invoiceBasis(shipmentId: string | null, kind: string): string {
  if (kind === 'advance') return t('orders.invoice_basis_advance')
  if (!shipmentId) return '—'
  return t('orders.invoice_basis_shipment', { number: shipmentNumberOf(shipmentId) })
}

/**
 * Withdrawn — the client is not holding this document any more.
 *
 * Not the same as corrected. A mirror correction takes the invoice back; a
 * correction for a stated amount only fixes a figure on one the client still has,
 * which is what a price correction issues. Struck through alike, the panel said a
 * document had been withdrawn when it had only been put right.
 */
function isWithdrawnInvoice(invoiceId: string): boolean {
  return isInvoiceWithdrawn(invoices.value, invoiceId)
}

/** Adjusted by a later document, and still in the client's hands. */
function isAdjustedInvoice(invoiceId: string): boolean {
  return invoices.value.some(
    (i) => i.kind === 'correction' && i.correctsInvoiceId === invoiceId && !i.withdrawsOriginal,
  )
}

/**
 * Whether this delivery can still be billed.
 *
 * The two buttons on a delivery row — issue the invoice, cancel it — are both
 * disabled while `shipmentsLoading` is up. A row still showing the state it was
 * in before the last action would otherwise take a click meant for the new one.
 * (Kept here rather than in the template: pitfall #9.)
 */
function canInvoiceShipment(shipmentId: string): boolean {
  const shipment = shipments.value.find((s) => s.id === shipmentId)
  return !!shipment && !shipment.cancelled && !liveInvoiceFor(shipmentId)
}

// ─── Splitting a partially shipped line ────────────────────────
const splitTarget = ref<OrderItem | null>(null)

async function confirmSplit() {
  const target = splitTarget.value
  splitTarget.value = null
  if (target) await splitItemLine(target.id)
}

// ─── Status pill mapping ───────────────────────────────────────

// ─── Delete order modal ────────────────────────────────────────
const showDeleteModal = ref(false)

function onDeleteClick() {
  showDeleteModal.value = true
}

async function onDeleteConfirm() {
  showDeleteModal.value = false
  const success = await remove()
  if (success) {
    await router.push({ name: 'admin-orders' })
  }
}

/**
 * The history stamp, for reading.
 *
 * The wire carries a full ISO-8601 instant, in one format everywhere, so that a
 * column of them sorts by time when sorted as text (contract §3). That is a
 * storage decision, not a display one — nobody reads `2026-08-08T17:30:03.475Z`.
 * Cutting it here rather than shortening it at the source is the whole point:
 * the two used to be the same string, and the server was writing the short one.
 */
function auditTimestamp(iso: string): string {
  return iso.slice(0, 16).replace('T', ' ')
}

// ─── Audit delete modal ────────────────────────────────────────
const deleteAuditOpen = ref(false)
// The record's own name, not its place in the list: the log grows underneath the
// open dialog, and a position picked before it grew points somewhere else after.
const auditToDeleteId = ref<string | null>(null)
const deletingAudit = ref(false)

function askDeleteAudit(entryId: string) {
  auditToDeleteId.value = entryId
  deleteAuditOpen.value = true
}

const showAddItemsModal = ref(false)
const showAddServicesModal = ref(false)

// Named handlers rather than two statements inline: Prettier reformats an inline
// "a = false; b($event)" onto separate lines, which Vue's expression parser
// rejects — and the build fails only after the file has been reformatted.
type AddedItems = Parameters<typeof handleAddItemDirect>[0]
type AddedServices = Parameters<typeof handleAddServiceDirect>[0]
type AddMode = Parameters<typeof handleAddItemDirect>[1]

function onItemsAdded(payload: AddedItems, mode: AddMode) {
  showAddItemsModal.value = false
  handleAddItemDirect(payload, mode)
}

function onServicesAdded(payload: AddedServices, mode: AddMode) {
  showAddServicesModal.value = false
  handleAddServiceDirect(payload, mode)
}

async function confirmDeleteAudit() {
  if (auditToDeleteId.value === null || deletingAudit.value) return
  deletingAudit.value = true
  await deleteAuditEntry(auditToDeleteId.value)
  auditToDeleteId.value = null
  deleteAuditOpen.value = false
  deletingAudit.value = false
}

// ─── Currency selector for total amount ─────────────────────
const currencyList = ref<Currency[]>([])
const currenciesLoading = ref(false)

async function loadCurrencies() {
  currenciesLoading.value = true
  try {
    currencyList.value = await getCurrencies()
  } finally {
    currenciesLoading.value = false
  }
}

const CURRENCY_OPTIONS = computed(() => currencyList.value.map((c) => c.code))

// Opening and closing the list belongs to `SuffixSelect`; what stays here is
// the one thing that is this card's own — the order object follows the form,
// so the pricing shown beside every line changes label with it.
function selectCurrency(c: string) {
  form.value.currency = c
  if (order.value) order.value.currency = c
}

onMounted(load)
onMounted(loadCurrencies)
// Not `loadShipPlan` as well: `load()` reads it, and asking twice on mount was
// half of the five requests the card used to open with.
onMounted(loadShipments)
</script>

<template>
  <template v-if="cardLoading">
    <div class="page-order-card" data-test="page-order-card">
      <div class="main-card-content">
        <div class="entity-card-grid">
          <div class="entity-col-left">
            <GlassPanel :loading="true" :skeleton-rows="4" />
          </div>
          <div class="entity-col-center">
            <GlassPanel :loading="true" :skeleton-rows="3" />
          </div>
          <div class="entity-col-right">
            <GlassPanel :loading="true" :skeleton-rows="1" />
          </div>
        </div>
      </div>
    </div>
  </template>

  <template v-else-if="error && !order">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('orders.title'), to: { name: 'admin-orders' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found" data-test="order-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-orders' }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-order-card" data-test="page-order-card">
      <div class="order-card-header" data-test="order-card-header">
        <Breadcrumb
          :items="[
            { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
            { label: t('orders.title'), to: { name: 'admin-orders' } },
            { label: order ? `${t('orders.card_title')} ${order.orderNumber}` : '...' },
          ]"
        />
        <div class="order-card-header-row">
          <div class="order-card-header-left">
            <h1 class="page-title">
              {{ order ? `${t('orders.card_title')} ${order.orderNumber}` : '...' }}
            </h1>
            <span v-if="order" class="order-status-wrapper">
              <span
                class="order-status-pill order-status-pill--lg"
                :class="ORDER_STATUS_PILL[order.status] || 'order-status-pill--new'"
                data-test="order-card-status-pill"
              >
                {{ t(`orders.status_${order.status}`) }}
              </span>
              <span
                v-tooltip="t(`orders.status_hint_${order.status}`)"
                class="info-hint"
                data-test="order-card-status-hint"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span
                v-if="isReturnsOn && returnState !== 'none'"
                class="pill pill-lg"
                :class="returnState === 'full' ? 'pill-danger' : 'pill-warning'"
                data-test="order-card-return-badge"
              >
                {{
                  returnState === 'full'
                    ? t('orders.badge_returned')
                    : t('orders.badge_partially_returned')
                }}
              </span>
            </span>
          </div>
          <div class="entity-action-bar no-margin pos-static" data-test="order-card-save-bar">
            <button
              class="btn btn-secondary"
              :disabled="(!isDirty && !hasPendingChanges) || saving"
              data-test="order-card-discard-btn"
              @click="discard"
            >
              {{ t('orders.btn_discard_changes') }}
            </button>
            <button
              class="btn btn-save"
              :class="{ dirty: isDirty || hasPendingChanges, loading: saving }"
              :disabled="(!isDirty && !hasPendingChanges) || saving"
              data-test="order-card-save-btn"
              @click="save"
            >
              {{ saving ? t('orders.btn_save') + '...' : t('orders.btn_save') }}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="saving"
              data-test="order-card-delete-btn"
              @click="onDeleteClick"
            >
              <SvgIcon name="trash" :width="16" :height="16" />
              {{ t('orders.btn_delete_order') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-state" data-test="order-card-error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('orders.btn_retry') }}</button>
      </div>

      <div class="main-card-content">
        <div class="entity-card-grid">
          <div class="entity-col-left">
            <GlassPanel
              :title="t('orders.section_header')"
              :loading="loading"
              :skeleton-rows="4"
              data-test="order-info-left"
            >
              <template v-if="order">
                <InputGroup :label="t('orders.field_order_number')">
                  <span class="glass-input-static">{{ order.orderNumber }}</span>
                  <span class="field-hint">{{ t('orders.field_order_number_hint') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_client')">
                  <span class="glass-input-static" data-test="field-client">{{
                    order.clientName
                  }}</span>
                  <span class="field-hint">{{ t('orders.field_client_hint') }}</span>
                </InputGroup>
                <InputGroup :label="t('clients.field_payment_terms')">
                  <span class="glass-input-static" data-test="field-payment-terms">{{
                    t('clients.payment_terms_days', { days: order.clientPaymentTermsDays })
                  }}</span>
                  <span class="field-hint">{{ t('orders.field_payment_terms_hint') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_document_type')">
                  <CustomSelect
                    v-model="form.documentType"
                    :options="DOCUMENT_TYPE_OPTIONS"
                    data-test="field-document-type"
                  />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <div class="entity-col-center">
            <GlassPanel
              :title="t('orders.section_financial')"
              :loading="loading"
              :skeleton-rows="6"
              data-test="order-financial"
            >
              <template v-if="order">
                <InputGroup v-if="canSeeCost" :label="t('orders.field_total_cost')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="totals.totalCost.toFixed(2)"
                      readonly
                      data-test="field-total-cost"
                    />
                    <span class="input-suffix static-suffix">{{ form.currency }}</span>
                  </div>
                  <span class="field-hint">{{ t('orders.field_total_cost_hint') }}</span>
                </InputGroup>

                <div class="inline-group">
                  <InputGroup :label="t('orders.field_default_margin')" class="inline-short">
                    <div class="input-with-suffix">
                      <input
                        v-model.number="form.defaultMarginPercent"
                        class="glass-input"
                        type="number"
                        min="0"
                        max="1000"
                        step="0.1"
                        data-test="field-default-margin"
                      />
                      <span class="input-suffix static-suffix">%</span>
                    </div>
                    <span class="field-hint">{{ t('orders.field_for_new_lines') }}</span>
                  </InputGroup>

                  <InputGroup :label="t('orders.field_default_discount')" class="inline-short">
                    <div class="input-with-suffix">
                      <input
                        v-model.number="form.defaultDiscountPercent"
                        class="glass-input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        data-test="field-default-discount"
                      />
                      <span class="input-suffix static-suffix">%</span>
                    </div>
                    <span class="field-hint">{{ t('orders.field_for_new_lines') }}</span>
                  </InputGroup>
                </div>

                <button
                  class="btn btn-sm btn-secondary apply-defaults-btn"
                  :disabled="saving"
                  data-test="apply-defaults-btn"
                  @click="requestApplyDefaults"
                >
                  {{ t('orders.btn_apply_to_all_lines') }}
                </button>

                <InputGroup :label="t('orders.field_vat_mode')">
                  <CustomSelect
                    v-model="vatModeStr"
                    :options="VAT_MODE_OPTIONS"
                    data-test="field-vat-mode"
                  />
                  <span class="field-hint">{{ t('orders.field_vat_mode_hint') }}</span>
                </InputGroup>

                <InputGroup :label="t('orders.field_vat_percent')">
                  <div class="input-with-suffix">
                    <input
                      v-model.number="form.vatPercent"
                      class="glass-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      :disabled="form.vatMode !== 'standard'"
                      data-test="field-vat-percent"
                    />
                    <span class="input-suffix static-suffix">%</span>
                  </div>
                  <span class="field-hint">{{
                    form.vatMode === 'standard'
                      ? t('orders.field_vat_percent_hint')
                      : t('orders.field_vat_percent_unused')
                  }}</span>
                </InputGroup>

                <div class="section-divider" />

                <h4 class="subsection-title">{{ t('orders.field_calculation_breakdown') }}</h4>

                <InputGroup :label="t('orders.field_net_total')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="totals.totalNet.toFixed(2)"
                      readonly
                      data-test="field-net-total"
                    />
                    <span class="input-suffix static-suffix">{{ form.currency }}</span>
                  </div>
                  <span class="field-hint">{{ t('orders.hint_auto_calculated') }}</span>
                </InputGroup>

                <InputGroup :label="t('orders.field_vat_amount')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="totals.totalVat.toFixed(2)"
                      readonly
                      data-test="field-vat-amount"
                    />
                    <span class="input-suffix static-suffix">{{ form.currency }}</span>
                  </div>
                  <span class="field-hint">{{ t('orders.field_vat_on_net_hint') }}</span>
                </InputGroup>

                <div class="section-divider" />

                <InputGroup :label="t('orders.field_gross_total')">
                  <div class="input-with-suffix custom-select-wrap">
                    <input
                      v-model="grossInput"
                      class="glass-input client-price-input"
                      type="number"
                      min="0"
                      step="0.01"
                      data-test="field-gross-total"
                      @change="onGrossCommit"
                      @keyup.enter="onGrossCommit"
                    />
                    <SuffixSelect
                      :model-value="form.currency"
                      :options="CURRENCY_OPTIONS"
                      trigger-test="field-currency-trigger"
                      option-test="field-currency-option"
                      option-attr="currency"
                      @update:model-value="selectCurrency"
                    />
                  </div>
                  <span v-if="grossError" class="field-error" data-test="gross-total-error">{{
                    grossError
                  }}</span>
                  <span v-else class="field-hint">{{ t('orders.field_gross_total_hint') }}</span>
                </InputGroup>

                <div class="inline-group">
                  <InputGroup
                    v-if="canSeeCost"
                    :label="t('orders.field_actual_margin')"
                    class="inline-short"
                  >
                    <div class="input-with-suffix">
                      <input
                        class="glass-input"
                        type="text"
                        :value="totals.marginAmount.toFixed(2)"
                        readonly
                        data-test="field-total-margin"
                        :class="{ 'value-negative': totals.marginAmount < 0 }"
                      />
                      <span class="input-suffix static-suffix">{{ form.currency }}</span>
                    </div>
                    <span class="field-hint"
                      >{{ money(totals.actualMarginPercent) }}% ·
                      {{ t('orders.field_actual_margin_hint') }}</span
                    >
                  </InputGroup>

                  <InputGroup :label="t('orders.field_effective_discount')" class="inline-short">
                    <div class="input-with-suffix">
                      <input
                        class="glass-input"
                        type="text"
                        :value="money(totals.effectiveDiscountPercent)"
                        readonly
                        data-test="field-effective-discount"
                      />
                      <span class="input-suffix static-suffix">%</span>
                    </div>
                    <span class="field-hint">{{ t('orders.field_effective_discount_hint') }}</span>
                  </InputGroup>
                </div>

                <template v-if="isReturnsOn && returnState !== 'none'">
                  <div class="section-divider" />
                  <div class="inline-group">
                    <InputGroup :label="t('orders.field_returned_amount')" class="inline-short">
                      <div class="input-with-suffix">
                        <input
                          class="glass-input value-negative"
                          type="text"
                          :value="'−' + money(returnedGross)"
                          readonly
                          data-test="field-returned-amount"
                        />
                        <span class="input-suffix static-suffix">{{ form.currency }}</span>
                      </div>
                      <span class="field-hint">{{ t('orders.field_returned_amount_hint') }}</span>
                    </InputGroup>

                    <InputGroup :label="t('orders.field_net_amount')" class="inline-short">
                      <div class="input-with-suffix">
                        <input
                          class="glass-input"
                          type="text"
                          :value="money(netAmount)"
                          readonly
                          data-test="field-net-amount"
                        />
                        <span class="input-suffix static-suffix">{{ form.currency }}</span>
                      </div>
                      <span class="field-hint">{{ t('orders.field_net_amount_hint') }}</span>
                    </InputGroup>
                  </div>
                </template>

                <template v-if="isMoneyOn">
                  <div class="section-divider" />
                  <div class="inline-group">
                    <InputGroup :label="t('orders.field_paid')" class="inline-short">
                      <div class="input-with-suffix">
                        <input
                          class="glass-input"
                          type="text"
                          :value="money(paid.paidAmount)"
                          readonly
                          data-test="field-paid-amount"
                        />
                        <span class="input-suffix static-suffix">{{ form.currency }}</span>
                      </div>
                      <span class="field-hint" data-test="field-paid-percent"
                        >{{ money(paid.paidPercent) }}%</span
                      >
                    </InputGroup>

                    <InputGroup
                      :label="
                        paid.outstanding < 0
                          ? t('orders.field_overpaid')
                          : t('orders.field_outstanding')
                      "
                      class="inline-short"
                    >
                      <div class="input-with-suffix">
                        <input
                          class="glass-input"
                          type="text"
                          :value="money(Math.abs(paid.outstanding))"
                          readonly
                          data-test="field-outstanding"
                          :class="{ 'value-negative': paid.outstanding < 0 }"
                        />
                        <span class="input-suffix static-suffix">{{ form.currency }}</span>
                      </div>
                    </InputGroup>
                  </div>

                  <p v-if="paymentDrift" class="payment-warning" data-test="payment-drift-warning">
                    {{
                      paymentDrift.kind === 'overpaid'
                        ? t('orders.payment_warn_overpaid', { amount: money(paymentDrift.amount) })
                        : t('orders.payment_warn_underpaid', { amount: money(paymentDrift.amount) })
                    }}
                  </p>
                </template>
              </template>
            </GlassPanel>
          </div>

          <div class="entity-col-right">
            <GlassPanel
              :title="t('orders.field_status')"
              :loading="loading"
              :skeleton-rows="1"
              data-test="order-info-right"
            >
              <template v-if="order">
                <InputGroup :label="t('orders.col_status')">
                  <CustomSelect
                    v-model="statusStr"
                    :options="STATUS_OPTIONS"
                    data-test="order-card-status"
                  />
                </InputGroup>
              </template>
            </GlassPanel>

            <GlassPanel
              :title="t('orders.field_total_weight')"
              :loading="loading"
              :skeleton-rows="1"
            >
              <template v-if="order">
                <InputGroup :label="t('orders.field_total_weight')">
                  <div class="input-with-suffix">
                    <input
                      v-model.number="form.totalWeight"
                      class="glass-input"
                      type="number"
                      min="0"
                      step="0.01"
                      data-test="field-total-weight"
                    />
                    <span class="input-suffix static-suffix">kg</span>
                  </div>
                </InputGroup>
              </template>
            </GlassPanel>

            <GlassPanel :title="t('orders.field_notes')" :loading="loading" :skeleton-rows="1">
              <template v-if="order">
                <InputGroup :label="t('orders.field_notes')">
                  <AutoResizeTextarea v-model="form.notes" data-test="field-notes" />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>
        </div>

        <GlassPanel data-test="order-items">
          <template #header>
            <span class="panel-title">{{ t('orders.section_items') }}</span>
            <button
              class="btn btn-sm btn-primary"
              data-test="order-add-item-btn"
              @click="showAddItemsModal = true"
            >
              <SvgIcon name="plus-add" :width="14" :height="14" />
              {{ t('orders.btn_add_item') }}
            </button>
          </template>
          <div v-if="order && order.items.length === 0" class="empty-state-inline">
            <p>{{ t('orders.items_empty') }}</p>
          </div>
          <div v-else-if="order" class="data-table-wrapper order-lines-wrapper">
            <table class="data-table order-lines-table">
              <thead>
                <tr>
                  <th>{{ t('orders.col_line') }}</th>
                  <th>{{ t('orders.col_product') }}</th>
                  <th>{{ t('orders.col_unit') }}</th>
                  <th v-for="cell in LINE_CELLS" :key="cell.field" class="num">
                    {{ t(cell.label) }}
                  </th>
                  <th v-if="canSeeCost" class="num">{{ t('orders.col_margin_amount') }}</th>
                  <th>{{ t('orders.col_state') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in order.items"
                  :key="item.id"
                  class="order-item-row"
                  :class="{
                    'line-frozen': isFrozenLine(item),
                    'is-returned': (returnedByLine[item.id] ?? 0) > 0,
                    'is-returned-fully': (returnedByLine[item.id] ?? 0) >= item.shippedQuantity,
                  }"
                  data-test="order-item-row"
                >
                  <td>{{ item.lineNumber }}</td>
                  <td class="line-product">
                    {{ item.productName }}
                    <span
                      v-if="(returnedByLine[item.id] ?? 0) > 0"
                      class="pill pill-warning line-returned-pill"
                      data-test="line-returned"
                    >
                      {{ t('orders.line_returned', { qty: returnedByLine[item.id] }) }}
                    </span>
                  </td>
                  <td>{{ unitLabel(item.unit) }}</td>
                  <td
                    v-for="cell in LINE_CELLS"
                    :key="cell.field"
                    class="num"
                    :data-test="'cell-' + cell.field"
                  >
                    <span class="cell-wrap">
                      <input
                        v-if="canEdit(item, cell.field)"
                        class="cell-input"
                        type="number"
                        :step="cell.step"
                        :value="cellValue(item, cell.field)"
                        data-test="cell-input"
                        @change="onCellCommit($event, item, 'item', cell.field)"
                        @keyup.enter="onCellCommit($event, item, 'item', cell.field)"
                      />
                      <span v-else class="cell-static">{{ cellValue(item, cell.field) }}</span>
                      <span v-if="cell.suffix" class="cell-suffix">{{ cell.suffix }}</span>
                      <template
                        v-if="cell.field === 'unitPrice' && isPriceLocked(toPricingLine(item))"
                      >
                        <span
                          v-tooltip="t('orders.badge_manual_price')"
                          class="cell-badge"
                          data-test="line-lock"
                        >
                          <SvgIcon name="lock" :width="12" :height="12" />
                        </span>
                        <button
                          v-if="canEdit(item, 'resetPrice')"
                          v-tooltip="t('orders.btn_reset_price')"
                          class="action-icon-btn cell-action"
                          data-test="line-reset-price"
                          @click="resetLinePriceCmd(item, 'item')"
                        >
                          <SvgIcon name="refresh-cw" :width="12" :height="12" />
                        </button>
                      </template>
                      <template v-if="cell.field === 'unitCost'">
                        <span
                          v-if="item.manualUnitCost !== null"
                          v-tooltip="
                            t('orders.badge_manual_cost', {
                              reason: item.manualCostReason ?? '—',
                            })
                          "
                          class="cell-badge cell-badge-warn"
                          data-test="line-manual-cost"
                          >M</span
                        >
                        <span
                          v-else-if="item.costSource === 'estimate'"
                          v-tooltip="t('orders.badge_cost_estimate')"
                          class="cell-badge cell-badge-warn"
                          data-test="line-cost-estimate"
                          >≈</span
                        >
                        <button
                          v-if="canResetCost(item)"
                          v-tooltip="t('orders.btn_reset_cost')"
                          class="action-icon-btn cell-action"
                          data-test="line-reset-cost"
                          @click="resetLineCostCmd(item)"
                        >
                          <SvgIcon name="refresh-cw" :width="12" :height="12" />
                        </button>
                      </template>
                    </span>
                  </td>
                  <td
                    v-if="canSeeCost"
                    class="num"
                    :class="{ 'margin-negative': lineMargin(item) < 0 }"
                    data-test="line-margin"
                  >
                    {{ lineMargin(item).toFixed(2) }}
                  </td>
                  <td class="line-state" data-test="line-state">{{ lineStateLabel(item) }}</td>
                  <td class="line-actions">
                    <button
                      v-if="item.state === 'partially_shipped'"
                      v-tooltip="t('orders.btn_split_line')"
                      class="action-icon-btn"
                      data-test="line-split-btn"
                      @click="splitTarget = item"
                    >
                      <SvgIcon name="scissors" :width="14" :height="14" />
                    </button>
                    <button
                      v-if="isFrozenLine(item)"
                      v-tooltip="t('orders.btn_correct_line')"
                      class="action-icon-btn"
                      data-test="line-correct-btn"
                      @click="askCorrection(item, 'item')"
                    >
                      <SvgIcon name="edit" :width="14" :height="14" />
                    </button>
                    <button
                      v-if="canDelete(item)"
                      v-tooltip="t('orders.btn_remove_item')"
                      class="action-icon-btn action-danger"
                      data-test="line-remove-btn"
                      @click="handleDeleteItem(item.id)"
                    >
                      <SvgIcon name="trash" :width="14" :height="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel data-test="order-services">
          <template #header>
            <span class="panel-title">{{ t('orders.section_services') }}</span>
            <button
              class="btn btn-sm btn-primary"
              data-test="order-add-service-btn"
              @click="showAddServicesModal = true"
            >
              <SvgIcon name="plus-add" :width="14" :height="14" />
              {{ t('orders.btn_add_service') }}
            </button>
          </template>
          <div v-if="order && order.services.length === 0" class="empty-state-inline">
            <p>{{ t('orders.services_empty') }}</p>
          </div>
          <div v-else-if="order" class="data-table-wrapper order-lines-wrapper">
            <table class="data-table order-lines-table">
              <thead>
                <tr>
                  <th>{{ t('orders.col_service') }}</th>
                  <th v-for="cell in LINE_CELLS" :key="cell.field" class="num">
                    {{ t(cell.label) }}
                  </th>
                  <th v-if="canSeeCost" class="num">{{ t('orders.col_margin_amount') }}</th>
                  <th>{{ t('orders.col_state') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="svc in order.services"
                  :key="svc.id"
                  class="order-service-row"
                  :class="{ 'line-frozen': isFrozenLine(svc) }"
                  data-test="order-service-row"
                >
                  <td>{{ svc.serviceName }}</td>
                  <td
                    v-for="cell in LINE_CELLS"
                    :key="cell.field"
                    class="num"
                    :data-test="'cell-' + cell.field"
                  >
                    <span class="cell-wrap">
                      <input
                        v-if="canEdit(svc, cell.field)"
                        class="cell-input"
                        type="number"
                        :step="cell.step"
                        :value="cellValue(svc, cell.field)"
                        data-test="cell-input"
                        @change="onCellCommit($event, svc, 'service', cell.field)"
                        @keyup.enter="onCellCommit($event, svc, 'service', cell.field)"
                      />
                      <span v-else class="cell-static">{{ cellValue(svc, cell.field) }}</span>
                      <span v-if="cell.suffix" class="cell-suffix">{{ cell.suffix }}</span>
                      <template
                        v-if="cell.field === 'unitPrice' && isPriceLocked(toPricingLine(svc))"
                      >
                        <span
                          v-tooltip="t('orders.badge_manual_price')"
                          class="cell-badge"
                          data-test="line-lock"
                        >
                          <SvgIcon name="lock" :width="12" :height="12" />
                        </span>
                        <button
                          v-if="canEdit(svc, 'resetPrice')"
                          v-tooltip="t('orders.btn_reset_price')"
                          class="action-icon-btn cell-action"
                          data-test="line-reset-price"
                          @click="resetLinePriceCmd(svc, 'service')"
                        >
                          <SvgIcon name="refresh-cw" :width="12" :height="12" />
                        </button>
                      </template>
                    </span>
                  </td>
                  <td
                    v-if="canSeeCost"
                    class="num"
                    :class="{ 'margin-negative': lineMargin(svc) < 0 }"
                    data-test="line-margin"
                  >
                    {{ lineMargin(svc).toFixed(2) }}
                  </td>
                  <td class="line-state" data-test="line-state">{{ lineStateLabel(svc) }}</td>
                  <td class="line-actions">
                    <button
                      v-if="isFrozenLine(svc)"
                      v-tooltip="t('orders.btn_correct_line')"
                      class="action-icon-btn"
                      data-test="line-correct-btn"
                      @click="askCorrection(svc, 'service')"
                    >
                      <SvgIcon name="edit" :width="14" :height="14" />
                    </button>
                    <button
                      v-if="canDelete(svc)"
                      v-tooltip="t('orders.btn_remove_service')"
                      class="action-icon-btn action-danger"
                      data-test="line-remove-btn"
                      @click="handleDeleteService(svc.id)"
                    >
                      <SvgIcon name="trash" :width="14" :height="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel v-if="isShipmentsOn" data-test="order-shipments">
          <template #header>
            <span class="panel-title">{{ t('orders.section_shipments') }}</span>
            <div class="doc-gen-actions in-header">
              <button
                class="btn btn-sm btn-secondary"
                :disabled="shipmentsLoading"
                data-test="order-reserve-btn"
                @click="reserveStock"
              >
                {{ t('orders.btn_reserve') }}
              </button>
              <button
                class="btn btn-sm btn-primary"
                :disabled="shipmentsLoading || shippableLines.length === 0"
                data-test="order-ship-btn"
                @click="openShipModal"
              >
                <SvgIcon name="package" :width="14" :height="14" />
                {{ t('orders.btn_create_shipment') }}
              </button>
            </div>
          </template>
          <div v-if="shipments.length === 0" class="empty-state-inline">
            <p>{{ t('orders.shipments_empty') }}</p>
          </div>
          <div v-else class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('orders.col_shipment_number') }}</th>
                  <th>{{ t('orders.col_shipment_date') }}</th>
                  <th>{{ t('orders.col_waybill') }}</th>
                  <th>{{ t('orders.col_vehicle') }}</th>
                  <th>{{ t('orders.col_shipment_lines') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in shipments"
                  :key="s.id"
                  :class="{ 'line-frozen': s.cancelled }"
                  data-test="order-shipment-row"
                >
                  <td>{{ s.number }}</td>
                  <td>{{ s.shippedAt.slice(0, 10) }}</td>
                  <td>{{ s.waybillNumber ?? '—' }}</td>
                  <td>{{ s.vehicle ?? '—' }}</td>
                  <td>
                    <span v-for="line in s.lines" :key="line.lineId" class="shipment-line">
                      {{ lineNameFor(line.lineId) }} — {{ line.quantity }}
                    </span>
                  </td>
                  <td class="line-actions">
                    <span v-if="s.cancelled" class="pill pill-danger">{{
                      t('orders.shipment_cancelled')
                    }}</span>
                    <template v-else>
                      <button
                        v-if="isMoneyOn && canInvoiceShipment(s.id)"
                        v-tooltip="t('orders.btn_issue_invoice')"
                        class="action-icon-btn"
                        :disabled="paymentSaving || shipmentsLoading"
                        data-test="shipment-invoice-btn"
                        @click="issueInvoiceFor(s.id)"
                      >
                        <SvgIcon name="file-text" :width="14" :height="14" />
                      </button>
                      <button
                        v-tooltip="t('orders.btn_cancel_shipment')"
                        class="action-icon-btn action-danger"
                        :disabled="paymentSaving || shipmentsLoading"
                        data-test="shipment-cancel-btn"
                        @click="askCancelShipment(s.id)"
                      >
                        <SvgIcon name="corner-up-left" :width="14" :height="14" />
                      </button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel v-if="isReturnsOn" :loading="returnsLoading" data-test="order-returns">
          <template #header>
            <span class="panel-title">{{ t('orders.section_returns') }}</span>
            <span
              v-if="returnState !== 'none'"
              class="pill"
              :class="returnState === 'full' ? 'pill-danger' : 'pill-warning'"
              data-test="order-returns-state"
            >
              {{
                returnState === 'full'
                  ? t('orders.badge_returned')
                  : t('orders.badge_partially_returned')
              }}
            </span>
            <div class="doc-gen-actions in-header">
              <button
                class="btn btn-sm btn-secondary"
                :disabled="returnsLoading || returnableLines.length === 0"
                data-test="order-return-btn"
                @click="openReturnModal"
              >
                <SvgIcon name="corner-up-left" :width="14" :height="14" />
                {{ t('orders.btn_create_return') }}
              </button>
            </div>
          </template>
          <div v-if="!returnsLoading && returns.length === 0" class="empty-state-inline">
            <p>{{ t('orders.returns_empty') }}</p>
          </div>
          <div v-else class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('orders.col_return_number') }}</th>
                  <th>{{ t('orders.col_return_date') }}</th>
                  <th>{{ t('orders.col_return_reason') }}</th>
                  <th>{{ t('orders.col_return_lines') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in returns" :key="r.id" data-test="order-return-row">
                  <td>{{ r.number }}</td>
                  <td>{{ r.returnedAt.slice(0, 10) }}</td>
                  <td>{{ r.reason }}</td>
                  <td>
                    <span v-for="line in r.lines" :key="line.lineId" class="shipment-line">
                      {{ returnLineSummary(line) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel v-if="isMoneyOn" data-test="order-payments">
          <template #header>
            <span class="panel-title">{{ t('orders.section_payments') }}</span>
            <span
              class="pill"
              :class="
                isReturnsOn && refundState !== 'none'
                  ? refundState === 'full'
                    ? 'pill-danger'
                    : 'pill-warning'
                  : PAID_STATE_PILL[paid.state]
              "
              data-test="order-payment-state"
              >{{ paidStateLabel }}</span
            >
            <div class="doc-gen-actions in-header">
              <button
                class="btn btn-sm btn-primary"
                :disabled="paymentSaving"
                data-test="order-add-payment-btn"
                @click="openPaymentModal"
              >
                <SvgIcon name="plus-add" :width="14" :height="14" />
                {{ t('orders.btn_add_payment') }}
              </button>
            </div>
          </template>
          <div v-if="payments.length === 0" class="empty-state-inline">
            <p>{{ t('orders.payments_empty') }}</p>
          </div>
          <div v-else class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('orders.col_payment_date') }}</th>
                  <th>{{ t('orders.col_payment_purpose') }}</th>
                  <th class="num">{{ t('orders.col_payment_amount') }}</th>
                  <th>{{ t('orders.col_payment_invoice') }}</th>
                  <th>{{ t('orders.col_payment_note') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in payments" :key="p.id" data-test="order-payment-row">
                  <td>{{ p.paidAt.slice(0, 10) }}</td>
                  <td>{{ purposeLabel(p.purpose) }}</td>
                  <td class="num" data-test="payment-amount">{{ money(p.amount) }}</td>
                  <td>{{ invoiceNumberOf(p.invoiceId) }}</td>
                  <td>{{ p.note ?? '—' }}</td>
                  <td class="line-actions">
                    <button
                      v-tooltip="t('orders.btn_remove_payment')"
                      class="action-icon-btn action-danger"
                      :disabled="paymentSaving"
                      data-test="payment-delete-btn"
                      @click="removePayment(p.id)"
                    >
                      <SvgIcon name="trash" :width="14" :height="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel v-if="isMoneyOn" data-test="order-invoices">
          <template #header>
            <span class="panel-title">{{ t('orders.section_invoices') }}</span>
            <div class="doc-gen-actions in-header">
              <button
                v-if="unbilledServices.length > 0"
                class="btn btn-sm btn-secondary"
                :disabled="paymentSaving"
                data-test="order-services-invoice-btn"
                @click="issueServicesInvoice"
              >
                {{ t('orders.btn_invoice_services') }}
              </button>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="paymentSaving"
                data-test="order-advance-invoice-btn"
                @click="openAdvanceModal"
              >
                {{ t('orders.btn_advance_invoice') }}
              </button>
            </div>
          </template>
          <div v-if="invoices.length === 0" class="empty-state-inline">
            <p>{{ t('orders.invoices_empty') }}</p>
          </div>
          <div v-else class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('orders.col_invoice_number') }}</th>
                  <th>{{ t('orders.col_invoice_date') }}</th>
                  <th>{{ t('orders.col_invoice_kind') }}</th>
                  <th>{{ t('orders.col_invoice_basis') }}</th>
                  <th class="num">{{ t('orders.col_invoice_amount') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="inv in invoices"
                  :key="inv.id"
                  :class="{ 'line-frozen': isWithdrawnInvoice(inv.id) }"
                  data-test="order-invoice-row"
                >
                  <td>{{ inv.number }}</td>
                  <td>{{ inv.issuedAt.slice(0, 10) }}</td>
                  <td>{{ invoiceKindLabel(inv.kind) }}</td>
                  <td>
                    <span v-if="inv.correctsInvoiceId">{{
                      t('orders.invoice_corrects', {
                        number: invoiceNumberOf(inv.correctsInvoiceId),
                      })
                    }}</span>
                    <span v-else>{{ invoiceBasis(inv.shipmentId, inv.kind) }}</span>
                  </td>
                  <td class="num" data-test="invoice-amount">{{ money(inv.amountGross) }}</td>
                  <td class="line-actions">
                    <span
                      v-if="isWithdrawnInvoice(inv.id)"
                      class="pill pill-danger"
                      data-test="invoice-corrected"
                      >{{ t('orders.invoice_corrected') }}</span
                    >
                    <span
                      v-else-if="isAdjustedInvoice(inv.id)"
                      class="pill pill-warning"
                      data-test="invoice-adjusted"
                      >{{ t('orders.invoice_adjusted') }}</span
                    >
                    <span v-else-if="inv.reason" v-tooltip="inv.reason" class="pill pill-warning">{{
                      t('orders.invoice_kind_correction')
                    }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel :title="t('orders.section_files')" data-test="order-files">
          <template v-if="order">
            <div class="order-file-list" data-test="order-file-list">
              <FileItem
                v-for="f in order.files"
                :key="f.id"
                :name="f.name"
                download-url="#"
                data-test="order-file-item"
                @delete="removeFile(f.fileId)"
              />
            </div>
            <DropZone
              data-test="order-file-dropzone"
              :hint="t('orders.dropzone_hint')"
              :multiple="true"
              @uploaded="onFilesUploaded"
            />
          </template>
        </GlassPanel>

        <div class="audit-panel-wide" data-test="order-audit">
          <GlassPanel :title="t('orders.section_audit')">
            <template v-if="visibleAuditLog.length > 0">
              <div class="table-responsive">
                <table class="audit-log-table" data-test="order-audit-table">
                  <thead>
                    <tr>
                      <th>{{ t('orders.audit_col_date') }}</th>
                      <th>{{ t('orders.audit_col_user') }}</th>
                      <th>{{ t('orders.audit_col_property') }}</th>
                      <th>{{ t('orders.audit_col_old_value') }}</th>
                      <th>{{ t('orders.audit_col_new_value') }}</th>
                      <th class="audit-actions-col" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in visibleAuditLog" :key="a.id" data-test="order-audit-row">
                      <td class="audit-log-ts">{{ auditTimestamp(a.timestamp) }}</td>
                      <td>
                        <div class="audit-log-user">
                          <div class="audit-log-avatar">{{ a.userInitials }}</div>
                          <span>{{ tf(a.user) }}</span>
                        </div>
                      </td>
                      <td>{{ tf(a.property) }}</td>
                      <td>
                        <span class="audit-diff-old">{{ a.oldValue }}</span>
                      </td>
                      <td>
                        <span class="audit-diff-new">{{ a.newValue }}</span>
                      </td>
                      <td class="audit-actions-cell">
                        <button
                          v-tooltip="t('btn.delete')"
                          type="button"
                          class="action-icon-btn action-danger"
                          data-test="order-audit-delete-btn"
                          @click="askDeleteAudit(a.id)"
                        >
                          <SvgIcon name="x-close" :width="14" :height="14" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
            <div v-else class="audit-empty">
              <SvgIcon name="warehouse-box" :width="32" :height="32" />
              <p>{{ t('orders.no_audit_entries') }}</p>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>

    <AppModal
      :model-value="allocationPreview !== null"
      :title="t('orders.allocate_title')"
      size="medium"
      data-test="allocate-modal"
      @update:model-value="onCancelAllocation"
    >
      <template v-if="allocationPreview">
        <p
          v-if="
            Math.abs(allocationPreview.achievedGross - allocationPreview.requestedGross) >= 0.005
          "
          class="allocate-warning"
          data-test="allocate-unreachable"
        >
          {{
            t('orders.allocate_unreachable', {
              requested: allocationPreview.requestedGross.toFixed(2),
              achieved: allocationPreview.achievedGross.toFixed(2),
            })
          }}
        </p>
        <p>{{ t('orders.allocate_explain') }}</p>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.allocate_before') }}</th>
                <th>{{ t('orders.allocate_after') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in allocationPreview.rows" :key="row.lineId" data-test="allocate-row">
                <td>{{ row.lineName }}</td>
                <td>{{ row.before.toFixed(2) }}</td>
                <td>{{ row.after.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="allocating"
          data-test="allocate-cancel"
          @click="onCancelAllocation"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="allocating"
          data-test="allocate-confirm"
          @click="confirmAllocation"
        >
          {{ t('orders.allocate_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="defaultsPreview !== null"
      :title="t('orders.apply_defaults_title')"
      size="small"
      data-test="apply-defaults-modal"
      @update:model-value="cancelApplyDefaults"
    >
      <template v-if="defaultsPreview">
        <p>
          {{
            t('orders.apply_defaults_explain', {
              count: defaultsPreview.lineCount,
              margin: form.defaultMarginPercent,
              discount: form.defaultDiscountPercent,
            })
          }}
        </p>
        <p v-if="defaultsPreview.skipped > 0" data-test="apply-defaults-skipped">
          {{ t('orders.apply_defaults_skipped', { count: defaultsPreview.skipped }) }}
        </p>
        <p data-test="apply-defaults-totals">
          {{
            t('orders.apply_defaults_totals', {
              before: defaultsPreview.before.toFixed(2),
              after: defaultsPreview.after.toFixed(2),
            })
          }}
        </p>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="apply-defaults-cancel"
          @click="cancelApplyDefaults"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="saving"
          data-test="apply-defaults-confirm"
          @click="applyDefaultsToAllLines"
        >
          {{ t('orders.apply_defaults_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="statusPlan !== null"
      :title="t('orders.status_plan_title')"
      size="medium"
      data-test="status-plan-modal"
      @update:model-value="cancelStatusChange"
    >
      <template v-if="statusPlan">
        <p
          v-if="statusPlan.shortages.length > 0"
          class="allocate-warning"
          data-test="status-plan-short"
        >
          {{ t('orders.status_plan_shortage') }}
        </p>
        <p v-else>
          {{
            statusPlan.writesOff
              ? t('orders.status_plan_writeoff')
              : t('orders.status_plan_reserve')
          }}
        </p>
        <div v-if="statusPlan.shortages.length > 0" class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.col_missing') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in statusPlan.shortages" :key="row.lineId" data-test="status-plan-row">
                <td>{{ row.productName }}</td>
                <td>{{ row.missing }} {{ unitLabel(row.unit) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="statusPlan.lines.length > 0" class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.col_quantity') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in statusPlan.lines" :key="row.lineId" data-test="status-plan-row">
                <td>{{ row.productName }}</td>
                <td>{{ row.quantity }} {{ unitLabel(row.unit) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="status-plan-cancel"
          @click="cancelStatusChange"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          v-if="statusPlan && statusPlan.shortages.length === 0"
          type="button"
          class="btn btn-primary"
          :disabled="statusChanging"
          data-test="status-plan-confirm"
          @click="confirmStatusChange"
        >
          {{ t('orders.status_plan_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showShipModal"
      :title="t('orders.ship_modal_title')"
      size="medium"
      data-test="ship-modal"
    >
      <p>{{ t('orders.ship_modal_explain') }}</p>
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('orders.col_product') }}</th>
              <th>{{ t('orders.col_remaining') }}</th>
              <th>{{ t('orders.col_available') }}</th>
              <th>{{ t('orders.col_quantity') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="line in shippableLines" :key="line.lineId" data-test="ship-line-row">
              <td>{{ line.productName }}</td>
              <td>{{ line.remaining }} {{ unitLabel(line.unit) }}</td>
              <td
                :class="{ 'margin-negative': line.shippable < line.remaining }"
                data-test="ship-line-available"
              >
                {{ line.shippable }} {{ unitLabel(line.unit) }}
              </td>
              <td>
                <input
                  class="cell-input"
                  :class="{ 'has-error': shipQtySplitsPiece(line) }"
                  type="number"
                  min="0"
                  :max="line.shippable"
                  step="0.001"
                  :value="shipQty(line)"
                  data-test="ship-line-qty"
                  @input="setShipQty(line, ($event.target as HTMLInputElement).value)"
                />
                <p
                  v-if="shipQtySplitsPiece(line)"
                  class="field-error"
                  data-test="ship-line-splits-offcut"
                >
                  {{ t('orders.ship_qty_splits_offcut') }}
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <InputGroup :label="t('orders.col_vehicle')">
        <input
          v-model="shipVehicle"
          class="glass-input"
          type="text"
          :placeholder="t('orders.ship_vehicle_placeholder')"
          data-test="ship-vehicle"
        />
      </InputGroup>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="ship-cancel"
          @click="showShipModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="shipmentsLoading || shipSelection.length === 0 || shipSplitsPiece"
          data-test="ship-confirm"
          @click="confirmShipment"
        >
          {{ t('orders.btn_create_shipment') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showReturnModal"
      :title="t('orders.return_modal_title')"
      size="medium"
      data-test="return-modal"
    >
      <!--
        Пояснение, таблица позиций и поле причины разведены общим `.modal-form`
        из `components/_modal.css` — тем же, что у модалок настроек и конфига
        карточки поставщика. Глобальный сброс обнуляет margin у всего, поэтому
        без обёртки блоки стоят впритык: своих отступов у них нет и взяться им
        неоткуда. Строка «чего не хватает» оставлена снаружи: у неё собственный
        margin-top, и внутри контейнера он сложился бы с gap.
      -->
      <div class="modal-form">
        <p>{{ t('orders.return_modal_explain') }}</p>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.col_shipped_qty') }}</th>
                <th>{{ t('orders.col_available_to_return') }}</th>
                <th>{{ t('orders.col_quantity') }}</th>
                <th>{{ t('orders.col_condition') }}</th>
                <th>{{ t('orders.col_compensate') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in returnableLines" :key="line.lineId" data-test="return-line-row">
                <td>{{ line.productName }}</td>
                <td>{{ line.shipped }} {{ unitLabel(line.unit) }}</td>
                <td data-test="return-line-available">
                  {{ line.returnable }} {{ unitLabel(line.unit) }}
                </td>
                <td>
                  <input
                    class="cell-input"
                    type="number"
                    min="0"
                    :max="line.returnable"
                    step="0.001"
                    :value="returnQty(line)"
                    data-test="return-line-qty"
                    @input="setReturnQty(line, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td>
                  <CustomSelect
                    :model-value="returnCondition(line)"
                    :options="RETURN_CONDITION_OPTIONS"
                    data-test="return-line-condition"
                    @update:model-value="setReturnCondition(line, $event)"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    :checked="returnCompensates(line)"
                    data-test="return-line-compensate"
                    @change="
                      toggleReturnCompensate(line, ($event.target as HTMLInputElement).checked)
                    "
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <InputGroup>
          <!--
            Метка написана здесь, а не отдана `:label` в InputGroup: звёздочку тот
            не рисует. Разметка та же, что у обязательных полей на страницах
            создания клиента и партии — общий `.required-star` из
            `components/_forms.css`.
          -->
          <label class="field-label"
            >{{ t('orders.return_reason_label') }} <span class="required-star">*</span></label
          >
          <AutoResizeTextarea
            v-model="returnReason"
            :placeholder="t('orders.return_reason_placeholder')"
            data-test="return-reason"
          />
        </InputGroup>
      </div>
      <!--
        Кнопка подтверждения гаснет по двум причинам сразу — нет количеств и нет
        причины, — и раньше молчала о том, какая из них сработала. Строка называет
        недостающее и исчезает, когда всё заполнено: она и кнопка читают одно и то
        же условие, разойтись им негде.
      -->
      <p v-if="returnBlockReason" class="return-block-reason" data-test="return-block-reason">
        {{ returnBlockReason }}
      </p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="return-cancel"
          @click="showReturnModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="returnsLoading || returnSelection.length === 0 || !returnReason.trim()"
          data-test="return-confirm"
          @click="confirmReturn"
        >
          {{ t('orders.btn_confirm_return') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="cancelShipmentTarget !== null"
      :title="t('orders.btn_cancel_shipment')"
      size="small"
      data-test="cancel-shipment-modal"
      @update:model-value="cancelShipmentTarget = null"
    >
      <p>{{ t('orders.cancel_shipment_explain') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="cancel-shipment-no"
          @click="cancelShipmentTarget = null"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="shipmentsLoading"
          data-test="cancel-shipment-yes"
          @click="confirmCancelShipment"
        >
          {{ t('orders.btn_cancel_shipment') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="correctionTarget !== null"
      :title="t('orders.correction_title')"
      size="small"
      data-test="correction-modal"
      @update:model-value="correctionTarget = null"
    >
      <template v-if="correctionInvoice">
        <p>
          {{
            t('orders.correction_explain', {
              number: correctionInvoice.number,
              amount: money(correctionInvoice.amountGross),
            })
          }}
        </p>
        <InputGroup :label="t('orders.correction_reason_label')">
          <input
            v-model="correctionReason"
            class="glass-input"
            type="text"
            :placeholder="t('orders.correction_reason_placeholder')"
            data-test="correction-reason-input"
            @keyup.enter="confirmCorrection"
          />
        </InputGroup>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="correction-cancel"
          @click="correctionTarget = null"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="shipmentsLoading || correctionReason.trim().length === 0"
          data-test="correction-confirm"
          @click="confirmCorrection"
        >
          {{ t('orders.correction_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showPaymentModal"
      :title="t('orders.add_payment_title')"
      size="small"
      data-test="payment-modal"
    >
      <InputGroup :label="t('orders.payment_amount_label')">
        <div class="input-with-suffix">
          <input
            v-model="paymentAmount"
            class="glass-input"
            type="number"
            step="0.01"
            data-test="payment-amount-input"
            @keyup.enter="confirmPayment"
          />
          <span class="input-suffix static-suffix">{{ form.currency }}</span>
        </div>
        <button
          v-if="paymentTargetOutstanding > 0"
          type="button"
          class="btn btn-sm btn-secondary"
          data-test="payment-fill-outstanding"
          @click="paymentAmount = money(paymentTargetOutstanding)"
        >
          {{
            t('orders.payment_amount_fill_outstanding', {
              amount: money(paymentTargetOutstanding),
            })
          }}
        </button>
      </InputGroup>
      <InputGroup :label="t('orders.col_payment_purpose')">
        <CustomSelect
          v-model="paymentPurpose"
          :options="PAYMENT_PURPOSES"
          data-test="payment-purpose"
        />
        <span v-if="paymentGoesOut" class="field-hint" data-test="payment-refund-hint">
          {{
            invoices.length === 0
              ? t('orders.payment_refund_needs_invoice')
              : t('orders.payment_refund_hint')
          }}
        </span>
      </InputGroup>
      <InputGroup :label="t('orders.payment_date_label')">
        <DatePicker v-model="paymentDate" data-test="payment-date" />
      </InputGroup>
      <InputGroup v-if="invoices.length > 0" :label="t('orders.payment_invoice_label')">
        <CustomSelect
          v-model="paymentInvoiceId"
          :options="paymentInvoiceOptions"
          :placeholder="paymentGoesOut ? t('orders.payment_invoice_pick') : undefined"
          data-test="payment-invoice"
        />
      </InputGroup>
      <InputGroup :label="t('orders.payment_note_label')">
        <input
          v-model="paymentNote"
          class="glass-input"
          type="text"
          :placeholder="t('orders.payment_note_placeholder')"
          data-test="payment-note"
          @keyup.enter="confirmPayment"
        />
      </InputGroup>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="payment-cancel"
          @click="showPaymentModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="
            paymentSaving ||
            Number(paymentAmount) === 0 ||
            paymentAmount === '' ||
            refundNeedsInvoice
          "
          data-test="payment-confirm"
          @click="confirmPayment"
        >
          {{ t('orders.btn_add_payment') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showAdvanceModal"
      :title="t('orders.advance_invoice_title')"
      size="small"
      data-test="advance-invoice-modal"
    >
      <p>{{ t('orders.advance_invoice_explain') }}</p>
      <InputGroup :label="t('orders.advance_invoice_amount')">
        <div class="input-with-suffix">
          <input
            v-model="advanceAmount"
            class="glass-input"
            type="number"
            min="0"
            step="0.01"
            data-test="advance-amount-input"
            @keyup.enter="confirmAdvanceInvoice"
          />
          <span class="input-suffix static-suffix">{{ form.currency }}</span>
        </div>
      </InputGroup>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="advance-cancel"
          @click="showAdvanceModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="paymentSaving || Number(advanceAmount) <= 0"
          data-test="advance-confirm"
          @click="confirmAdvanceInvoice"
        >
          {{ t('orders.btn_advance_invoice') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="keepTotalPreview !== null"
      :title="t('orders.keep_total_title')"
      size="medium"
      data-test="keep-total-modal"
      @update:model-value="cancelKeepTotal"
    >
      <template v-if="keepTotalPreview">
        <p>
          {{ t('orders.keep_total_explain', { total: keepTotalPreview.total.toFixed(2) }) }}
        </p>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.allocate_before') }}</th>
                <th>{{ t('orders.allocate_after') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in keepTotalPreview.rows" :key="row.lineId" data-test="keep-total-row">
                <td>{{ row.lineName }}</td>
                <td>{{ row.before.toFixed(2) }}</td>
                <td>{{ row.after.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="keep-total-cancel"
          @click="cancelKeepTotal"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-test="keep-total-confirm"
          @click="confirmKeepTotal"
        >
          {{ t('orders.allocate_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="costEdit !== null"
      :title="t('orders.cost_reason_title')"
      size="small"
      data-test="cost-reason-modal"
      @update:model-value="costEdit = null"
    >
      <template v-if="costEdit">
        <p>
          {{
            t('orders.cost_reason_explain', {
              line: costEdit.lineName,
              from: costEdit.from.toFixed(2),
              to: costEdit.to.toFixed(2),
            })
          }}
        </p>
        <InputGroup :label="t('orders.cost_reason_label')">
          <input
            v-model="costReason"
            class="glass-input"
            type="text"
            :placeholder="t('orders.cost_reason_placeholder')"
            data-test="cost-reason-input"
            @keyup.enter="confirmCostEdit"
          />
        </InputGroup>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="cost-reason-cancel"
          @click="costEdit = null"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="costReason.trim().length === 0"
          data-test="cost-reason-confirm"
          @click="confirmCostEdit"
        >
          {{ t('orders.cost_reason_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="correctTarget !== null"
      :title="t('orders.correct_title')"
      size="small"
      data-test="correct-modal"
      @update:model-value="correctTarget = null"
    >
      <template v-if="correctTarget && correctionPreview">
        <p class="correct-line-name" data-test="correct-line">
          {{
            'productName' in correctTarget.line
              ? correctTarget.line.productName
              : correctTarget.line.serviceName
          }}
          · {{ lineStateLabel(correctTarget.line) }}
        </p>
        <InputGroup :label="t('orders.col_unit_price')">
          <input
            v-model="correctPrice"
            class="glass-input"
            type="number"
            step="0.01"
            data-test="correct-price-input"
          />
        </InputGroup>
        <InputGroup v-if="canSeeCost" :label="t('orders.col_unit_cost')">
          <input
            v-model="correctCost"
            class="glass-input"
            type="number"
            step="0.01"
            data-test="correct-cost-input"
          />
        </InputGroup>
        <InputGroup :label="t('orders.correct_reason_label')">
          <input
            v-model="correctReason"
            class="glass-input"
            type="text"
            :placeholder="t('orders.correct_reason_placeholder')"
            data-test="correct-reason-input"
            @keyup.enter="confirmLineCorrection"
          />
        </InputGroup>
        <div v-if="correctionPreview.changed" class="correct-effect" data-test="correct-effect">
          <p v-if="correctionPreview.priceChanged && correctionPreview.invoice">
            {{ t('orders.correct_effect_invoice', { invoice: correctionPreview.invoice.number }) }}
          </p>
          <p v-else-if="correctionPreview.priceChanged">
            {{ t('orders.correct_effect_no_invoice') }}
          </p>
          <p v-if="correctionPreview.costChanged && !correctionPreview.priceChanged">
            {{
              t('orders.correct_effect_cost_only', {
                before: money(correctionPreview.lineBefore.marginAmount),
                after: money(correctionPreview.lineAfter.marginAmount),
              })
            }}
          </p>
          <p>
            {{
              t('orders.correct_effect_total', {
                before: money(correctionPreview.totalBefore),
                after: money(correctionPreview.totalAfter),
              })
            }}
          </p>
          <p class="correct-effect-note">{{ t('orders.correct_effect_stock') }}</p>
        </div>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="correct-cancel"
          @click="correctTarget = null"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="correcting || correctReason.trim().length === 0 || !correctionPreview?.changed"
          data-test="correct-confirm"
          @click="confirmLineCorrection"
        >
          {{ t('orders.correct_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="splitTarget !== null"
      :title="t('orders.split_title')"
      size="small"
      data-test="split-modal"
      @update:model-value="splitTarget = null"
    >
      <template v-if="splitTarget">
        <p>
          {{
            t('orders.split_explain', {
              line: splitTarget.productName,
              shipped: splitTarget.shippedQuantity,
              remainder: roundTo(splitTarget.quantity - splitTarget.shippedQuantity, 6),
              unit: unitLabel(splitTarget.unit),
            })
          }}
        </p>
      </template>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="splitting"
          data-test="split-cancel"
          @click="splitTarget = null"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="splitting"
          data-test="split-confirm"
          @click="confirmSplit"
        >
          {{ t('orders.split_apply') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :model-value="pendingVatMode !== null"
      :title="t('orders.vat_mode_change_title')"
      size="small"
      data-test="vat-mode-modal"
      @update:model-value="cancelVatMode"
    >
      <p>{{ t('orders.vat_mode_change_explain') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="vat-mode-cancel"
          @click="cancelVatMode"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="vat-mode-keep-gross"
          @click="confirmVatMode('gross')"
        >
          {{ t('orders.vat_mode_keep_gross') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-test="vat-mode-keep-net"
          @click="confirmVatMode('net')"
        >
          {{ t('orders.vat_mode_keep_net') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteModal"
      :title="t('orders.confirm_delete')"
      size="small"
      data-test="order-card-delete-modal"
    >
      <p>{{ t('orders.confirm_delete') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="order-card-delete-modal-cancel"
          @click="showDeleteModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="saving"
          data-test="order-card-delete-modal-confirm"
          @click="onDeleteConfirm"
        >
          {{ saving ? t('btn.delete') + '...' : t('btn.delete') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="deleteAuditOpen"
      :title="t('modal.confirm_delete')"
      size="small"
      data-test="order-audit-modal"
    >
      <p>{{ t('modal.delete_audit_warning') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="order-audit-modal-cancel"
          @click="deleteAuditOpen = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="order-audit-modal-confirm"
          @click="confirmDeleteAudit"
        >
          {{ t('btn.delete') }}
        </button>
      </template>
    </AppModal>

    <AddOrderItemsModal
      :show="showAddItemsModal"
      :modes="addModes"
      :effective-discount="orderTermsDiscount"
      :default-margin-percent="form.defaultMarginPercent"
      :default-discount-percent="form.defaultDiscountPercent"
      @close="showAddItemsModal = false"
      @add="onItemsAdded"
    />

    <AddOrderServicesModal
      :show="showAddServicesModal"
      :modes="addModes"
      :effective-discount="orderTermsDiscount"
      :default-discount-percent="form.defaultDiscountPercent"
      @close="showAddServicesModal = false"
      @add="onServicesAdded"
    />
  </template>
</template>

<style>
@import '@styles/admin/orders_card.css';

/* Audit log empty state — matches design system empty-state pattern */
.audit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 24px;
  color: var(--text-secondary, #8c8c8c);
  text-align: center;
}

.audit-empty svg {
  opacity: 0.4;
}

.audit-empty p {
  margin: 0;
  font-size: 13px;
}

/* Client price — bold and slightly larger */
.client-price-input {
  font-weight: 700 !important;
  font-size: 15px !important;
}

/* `.inline-group` / `.inline-short` used to live here behind `:deep()`. This
   block is NOT scoped, and a non-scoped block never expands `:deep()` — the
   selector went to the browser verbatim and was thrown away as invalid. They
   are form layout helpers used by more than one page, so they now sit in
   `components/_forms.css`, which `admin-core.scss` loads globally. */

/* A bare button between the fields keeps their rhythm: .input-group carries a
   20px bottom margin, this one does not, so the VAT field sat right under it. */
.apply-defaults-btn {
  margin-bottom: 20px;
}

/* Subsection title */
.subsection-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.75;
  margin: 0 0 10px 0;
  color: var(--text-color, rgba(255, 255, 255, 0.85));
}

/* Строка «чего не хватает» под формой возврата.

   Селектор с тегом `p` — не украшение: `.modal-body p` в `components/_modal.css`
   задаёт цвет и размер и весит больше одноклассового селектора. Без `p` строка
   вышла бы обычным текстом модалки, а не приглушённой подсказкой. Та же причина
   у `.modal-body p.field-error` в `components/_forms.css`. */
.modal-body p.return-block-reason {
  margin: 8px 0 0 0;
  font-size: 12px;
  /* 0.5, как у поясняющих строк в настройках. `.text-muted` этой страницы —
     0.35: он для пустых мест, а это указание, которое надо прочитать. */
  color: rgba(255, 255, 255, 0.5);
}

/* Section divider */
.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 16px 0;
}
</style>
