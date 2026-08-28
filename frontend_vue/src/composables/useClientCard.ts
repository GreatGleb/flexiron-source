import { computed, ref, reactive, toRaw } from 'vue'
import {
  getClient,
  patchClient,
  getClientAudit,
  deleteClientAuditEntry,
  addClientInteraction,
  deleteClientInteraction,
  getClientInvoiceSummary,
} from '@/services/clientsService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useI18n } from 'vue-i18n'
import { getOrders } from '@/services/ordersService'
import { normalizePaymentTermsDays } from '@/domain/paymentTerms'
import { round2 } from '@/domain/orderPricing'
import type {
  Client,
  ClientInvoice,
  ClientUnassignedPayment,
  InteractionHistoryEntry,
} from '@/types/client'
import type { OrderListItem } from '@/types/order'
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

  /**
   * The client's real orders, asked for by client id.
   *
   * The seeded client used to carry its own `orderHistory` — invented ids, invented
   * totals and statuses like "completed" that the order model does not have. None
   * of those orders existed, so the links went nowhere and the money agreed with
   * nothing. An order belongs to the orders module; this is the same list endpoint
   * the orders page uses, filtered.
   */
  const orders = ref<OrderListItem[]>([])
  const ordersLoading = ref(false)

  /**
   * Выставленные клиенту счета — вторая половина сводки из ТЗ (CRM §54).
   *
   * Приходят одним запросом и уже размеченными: держит клиент документ или он
   * отозван и какие деньги на нём — решено на стороне заказов, где эти правила
   * и живут.
   */
  const invoices = ref<ClientInvoice[]>([])
  /**
   * Деньги клиента, не названные ни одним документом, — по заказам.
   *
   * Отдельным списком, потому что это не счета. Но и не «мелочь, которой можно
   * пренебречь»: сводка без них показывала оплату 2000 евро клиенту, заплатившему
   * 6971,72, — деньги, стоящие в заказах без ссылки на счёт, просто не доходили
   * до колонки «оплачено».
   */
  const unassignedPayments = ref<ClientUnassignedPayment[]>([])
  const invoicesLoading = ref(false)

  /**
   * Итог по колонкам — отдельно на каждую валюту.
   *
   * Курса в системе нет нигде, поэтому один общий итог по счетам в евро и
   * долларах был бы не суммой, а склейкой двух разных величин.
   *
   * Отозванные документы в «выставлено» не входят: `amountGrossCurrent` у них
   * ноль, потому что клиент их не держит. Деньги без ссылки на счёт, наоборот,
   * входят в «оплачено» целиком — они клиентские, и остаток без них завышен ровно
   * на их величину.
   */
  const invoiceTotals = computed(() => {
    const byCurrency = new Map<
      string,
      {
        currency: string
        issued: number
        paid: number
        unassignedPaid: number
        outstanding: number
      }
    >()
    const rowFor = (currency: string) => {
      const existing = byCurrency.get(currency)
      if (existing) return existing
      const fresh = { currency, issued: 0, paid: 0, unassignedPaid: 0, outstanding: 0 }
      byCurrency.set(currency, fresh)
      return fresh
    }
    for (const invoice of invoices.value) {
      const row = rowFor(invoice.currency)
      row.issued = round2(row.issued + invoice.amountGrossCurrent)
      row.paid = round2(row.paid + invoice.paidAmount)
    }
    for (const payment of unassignedPayments.value) {
      const row = rowFor(payment.currency)
      row.paid = round2(row.paid + payment.amount)
      row.unassignedPaid = round2(row.unassignedPaid + payment.amount)
    }
    for (const row of byCurrency.values()) {
      row.outstanding = round2(row.issued - row.paid)
    }
    return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency))
  })

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

  /**
   * Условия оплаты правятся через переходник, а не напрямую.
   *
   * `v-model.number` на очищенном поле кладёт `NaN` (питфолл #25), и `diff()`
   * отдаёт сырое значение — то есть `NaN` уехал бы в PATCH. Нормализация стоит на
   * записи, а не в вотчере: вотчер чинит уже испорченное состояние, а карточка
   * между его срабатыванием и сохранением успевает показать пустое поле как
   * «условий нет».
   */
  const paymentTermsDays = computed<number>({
    get: () => client.value?.paymentTermsDays ?? 0,
    set: (value) => {
      if (client.value) client.value.paymentTermsDays = normalizePaymentTermsDays(value)
    },
  })

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

  async function loadOrders() {
    ordersLoading.value = true
    try {
      // The whole history, page by page. A fixed first page cut the list at 50
      // without saying so, and everything the card says about the client — how
      // much they have bought, when they last ordered — would have been read
      // off a list that quietly stopped.
      const PAGE_SIZE = 50
      const collected: OrderListItem[] = []
      let pageNumber = 1
      for (;;) {
        const page = await getOrders(
          {
            search: '',
            status: 'all',
            clientId: id,
            dateFrom: '',
            dateTo: '',
            sortBy: 'createdAt',
            sortDir: 'desc',
          },
          { page: pageNumber, pageSize: PAGE_SIZE },
        )
        collected.push(...page.items)
        if (collected.length >= page.total || page.items.length === 0) break
        pageNumber += 1
      }
      orders.value = collected
    } catch {
      orders.value = []
    } finally {
      ordersLoading.value = false
    }
  }

  async function loadInvoices() {
    invoicesLoading.value = true
    try {
      const summary = await getClientInvoiceSummary(id)
      invoices.value = summary.invoices
      unassignedPayments.value = summary.unassignedPayments
    } catch {
      invoices.value = []
      unassignedPayments.value = []
    } finally {
      invoicesLoading.value = false
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

  async function deleteAuditEntry(entryId: string) {
    try {
      await deleteClientAuditEntry(id, entryId)
      auditLog.value = auditLog.value.filter((entry) => entry.id !== entryId)
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
    paymentTermsDays,
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
    orders,
    ordersLoading,
    loadOrders,
    invoices,
    unassignedPayments,
    invoicesLoading,
    invoiceTotals,
    loadInvoices,
    deleteAuditEntry,
    handleDeleteInteraction,
    newInteraction,
    inlineAddInteraction,
    resetNewInteraction,
  }
}
