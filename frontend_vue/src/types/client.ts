import type { StockAuditEntry } from '@/types/warehouse'
import type { InvoiceKind } from '@/types/order'
import type { CountryCode } from '@/domain/countries'

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
  /**
   * Страна клиента кодом справочника ISO 3166-1 alpha-2 (`src/domain/countries.ts`),
   * или `null` у клиента, заведённого до появления поля.
   *
   * Отдельно от `address` потому, что по ней система предлагает тип комплекта
   * документов: вытащить страну из строки «Vytauto g. 15, Kaunas» нечем.
   */
  country: CountryCode | null
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
  | 'country'
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
  /**
   * Деньги, пришедшие по этому счёту, — вместе с деньгами по его корректировкам.
   *
   * Область та же, что у `amountGrossCurrent`: корректировка не получает своей
   * строки, её сумма сложена в документ — значит и возврат, выписанный по этой
   * корректировке, обязан лечь в ту же строку. Считать эти две половины по-разному
   * — тот же остаток, посчитанный по двум разным правилам, и деньги в разнице.
   */
  paidAmount: number
  /** `amountGrossCurrent - paidAmount`; минус — переплата, её возвращают. */
  outstanding: number
}

/**
 * Деньги клиента по одному заказу, не названные ни одним документом.
 *
 * `payment.invoiceId` необязателен, и это не пробел модели: аванс приходит до
 * проформы, а «оплата по договору» не называет счёта вовсе — в демо-хранилище так
 * лежат 13 заказов из 100, у 11 из них счёта нет ни одного. Сводка, которая
 * складывает только платежи со ссылкой, теряет эти деньги молча — на карточке
 * клиента ORD-100 это было 1380 евро, а вместе с соседним заказом 4971,72.
 *
 * Поэтому такие деньги приходят отдельной строкой, а не растворяются: сложить их
 * в какой-нибудь счёт — значит выдумать привязку, которой в данных нет.
 */
export interface ClientUnassignedPayment {
  orderId: string
  orderNumber: string
  currency: string
  /** Дата последнего такого платежа по заказу — по ней строка встаёт в порядок. */
  paidAt: string
  /** Сумма всех непривязанных платежей заказа; минус — деньги ушли обратно. */
  amount: number
}

/**
 * Ответ `GET /api/clients/:id/invoices` целиком.
 *
 * Два списка, а не один: документы и деньги без документа — разные сущности, и
 * вместе они дают полную картину. Каждый платёж заказа попадает ровно в одно из
 * двух мест (счёт своей строки, корректировка — в строку исправленного счёта,
 * ни то ни другое — сюда), поэтому сумма «оплачено» по сводке сходится с
 * `paidAmount` заказов клиента до цента.
 */
export interface ClientInvoiceSummary {
  invoices: ClientInvoice[]
  unassignedPayments: ClientUnassignedPayment[]
}
