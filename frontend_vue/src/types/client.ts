import type { StockAuditEntry } from '@/types/warehouse'
import type { InvoiceKind } from '@/types/order'

/** A single entry in the client's interaction history (calls, emails, notes) */
export interface InteractionHistoryEntry {
  date: string
  type: 'call' | 'email' | 'note' | 'meeting'
  summary: string
  user: string
  /** Optional reason if this interaction relates to a rejection/issue */
  rejectionReason?: string | null
}

export interface Client {
  id: string
  name: string
  companyCode: string
  vatCode: string
  address: string
  phone: string
  email: string
  status: 'active' | 'inactive'
  /**
   * Условия оплаты: отсрочка в днях от даты счёта, 0 — оплата по счёту.
   *
   * Правило и его границы живут в `domain/paymentTerms.ts` — там же сказано,
   * почему это дни, а не свободная строка вроде поставщицкой `'30 Days Net'`.
   * Обязательное: клиент без условий оплаты — это заказ, которому нечего
   * подтянуть, а ТЗ (Process 2.1 §1) обещает подтягивать их при выборе клиента.
   */
  paymentTermsDays: number
  notes: string | null
  /** Free-text reason when client is rejected or blocked */
  rejectionReason?: string | null
  createdAt: string
  /** Client change audit log */
  auditLog?: StockAuditEntry[]
  /** Manager's interaction history (calls, emails, notes, meetings) */
  interactionHistory?: InteractionHistoryEntry[]
}

export interface ClientFilters {
  search: string
  status: 'active' | 'inactive' | null
  // `createdAt` is what "the newest clients" is sorted by, and that sort belongs
  // to the server: picking the newest out of one page picks them out of a page.
  sortBy: 'name' | 'email' | 'status' | 'createdAt' | null
  sortDir: 'asc' | 'desc'
}

export type ClientFormData = Pick<
  Client,
  | 'name'
  | 'companyCode'
  | 'vatCode'
  | 'address'
  | 'phone'
  | 'email'
  | 'status'
  | 'paymentTermsDays'
  | 'notes'
  | 'rejectionReason'
>

/**
 * Одна строка сводки выставленных счетов в карточке клиента (ТЗ CRM §54).
 *
 * Счёт живёт внутри заказа, а карточка клиента спрашивает про клиента — поэтому
 * сюда едет плоская строка, у которой уже есть и заказ, и деньги. Корректировки
 * своей строки не получают: документ у клиента один, а корректировка меняет
 * сумму на нём — она приходит в `amountGrossCurrent` и в `withdrawn`.
 */
export interface ClientInvoice {
  id: string
  orderId: string
  orderNumber: string
  number: string
  issuedAt: string
  kind: InvoiceKind
  /**
   * Валюта заказа, под которым выписан счёт.
   *
   * Подпись, а не множитель: курса в системе нет нигде, поэтому суммы разных
   * валют не складываются в один итог — итог считается по каждой отдельно.
   */
  currency: string
  /** Что было написано на документе в день выписки. */
  amountGross: number
  /**
   * Сколько на документе сейчас — после всех корректировок, которые его называют.
   *
   * У отозванного документа это ноль: клиент его не держит, и в «выставлено» он
   * не входит. Иначе простая сумма по колонке насчитала бы деньги, которых
   * никто не должен.
   */
  amountGrossCurrent: number
  /** Клиент больше не держит этот документ — зеркальная корректировка его отозвала. */
  withdrawn: boolean
  /** Деньги, пришедшие именно по этому счёту. */
  paidAmount: number
  /** `amountGrossCurrent - paidAmount`; минус — переплата, её возвращают. */
  outstanding: number
}
