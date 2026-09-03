import type { ReceivableStatus } from '@/types/finance'
import type { InvoiceKind } from '@/types/order'

/**
 * Счёт к получению — то, из чего строится реестр «Входящие».
 *
 * Пункт 13 плана `review-followups.md`: у одной суммы один владелец. Счёт
 * отвечает на «сколько должны и когда», платёж — на «сколько пришло», а статус
 * не отвечает ни на что самостоятельно и потому не хранится: он выводится здесь
 * из суммы счёта, суммы привязанных к нему платежей и срока. Хранимый статус
 * устаревает молча — ровно так реестр и показывал «Оплачено» рядом с нулём
 * поступлений.
 */

const MS_PER_DAY = 86_400_000

/**
 * Срок оплаты счёта — дата счёта плюс отсрочка клиента (пункт 9).
 *
 * Руками этот срок не вводится нигде: условия оплаты сняты на заказ в момент
 * оформления (`Order.clientPaymentTermsDays`), и счёт наследует их через заказ.
 * Ноль дней — законное значение: оплата по счёту, срок наступает в день выдачи.
 */
export function receivableDueDate(issuedAt: string, paymentTermsDays: number): string {
  const issued = new Date(issuedAt)
  if (Number.isNaN(issued.getTime())) return issuedAt
  return new Date(issued.getTime() + Math.max(0, paymentTermsDays) * MS_PER_DAY).toISOString()
}

/**
 * Статус счёта — вычисляется, а не хранится.
 *
 * - сумма платежей ≥ суммы счёта → `completed`;
 * - иначе срок прошёл → `overdue` (в том числе при частичной оплате);
 * - иначе → `pending`.
 *
 * Частичная оплата отдельного статуса не получает: «оплачено X из Y» — это две
 * суммы, которые строка показывает как есть, и заводить под них третье слово
 * значило бы держать то же самое в двух видах.
 *
 * **Срок — это день, а не мгновение.** Сравнение `сейчас > dueDate` считало
 * просроченным счёт, выставленный клиенту с предоплатой (`paymentTermsDays = 0`),
 * через миллисекунды после выдачи: срок у него равен дате счёта, и «позже» такой
 * момент наступает сразу. В колонке «Срок» при этом стояло сегодняшнее число —
 * то есть страница показывала выдуманный сигнал под настоящим документом, ровно
 * ту болезнь, от которой лечится пункт 13. Должник опаздывает не в ту же
 * секунду, а когда день срока кончился, поэтому граница — конец дня срока по
 * тому же календарю, в котором дата и показана (`toLocaleDateString`, локальный).
 */
export function receivableStatus(input: {
  amount: number
  paidAmount: number
  dueDate: string
  now?: Date
}): ReceivableStatus {
  if (input.paidAmount >= input.amount) return 'completed'
  const due = new Date(input.dueDate)
  if (Number.isNaN(due.getTime())) return 'pending'
  const endOfDueDay = new Date(due)
  endOfDueDay.setHours(23, 59, 59, 999)
  const now = input.now ?? new Date()
  if (now.getTime() > endOfDueDay.getTime()) return 'overdue'
  return 'pending'
}

/** Документ заказа в том виде, в каком его читает расчёт баланса. */
export interface InvoiceRecord {
  id: string
  issuedAt: string
  kind: InvoiceKind
  correctsInvoiceId: string | null
  withdrawsOriginal: boolean
  amountGross: number
}

/** Пришедшие деньги: сумма, дата и документ, который они закрывают. */
export interface PaymentRecord {
  amount: number
  paidAt: string
  invoiceId: string | null
}

/** Что документ стоит сегодня и сколько по нему пришло. */
export interface InvoiceBalance {
  id: string
  issuedAt: string
  /** Сумма с учётом всех корректировок этого документа; у отозванного — 0. */
  amount: number
  paidAmount: number
  /** Может быть отрицательным: переплату скрывать нельзя, её видно как есть. */
  outstanding: number
  withdrawn: boolean
  /** Платёж, на котором накопленная сумма впервые покрыла счёт. */
  paidAt: string | null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Сколько по каждому документу заказа выставлено и сколько пришло — ОДИН расчёт
 * на все три места, где этот вопрос задаётся: реестр «Входящих», сводка счетов
 * клиента и модалка регистрации оплаты в карточке заказа.
 *
 * Собран сюда потому, что копий было две и они уже расходились: сводка клиента
 * засчитывала деньги, названные корректировкой, на исправленный ею документ, а
 * реестр — нет; отозванный счёт у одной стоил ноль, у другой — сумму с
 * корректировкой. Пункт 13 требует, чтобы «оплачено X из Y» было ТЕМ ЖЕ
 * расчётом, а не тремя похожими, и одинаковость держится только тем, что расчёт
 * один.
 *
 * Корректировка своего баланса не получает: это не отдельный долг, а поправка к
 * сумме исходного документа, и деньги, названные ею, идут в ту же строку —
 * баланс, у которого сумма считает корректировки, а поступления нет, разошёлся
 * бы сам с собой на величину, которой никто не видит.
 */
/**
 * Клиент этот документ больше не держит — его отозвала зеркальная корректировка.
 *
 * Не то же самое, что «скорректирован»: корректировка на названную сумму лишь
 * поправляет цифру на документе, который у клиента остался. Спутанные, эти два
 * случая размораживали только что исправленную строку и выставляли услуги заказа
 * второй раз. Правило живёт здесь одно на всех: спрашивают его и мок заказов, и
 * панель счетов в карточке, и расчёт баланса ниже.
 */
export function isInvoiceWithdrawn(invoices: InvoiceRecord[], invoiceId: string): boolean {
  return invoices.some(
    (i) => i.kind === 'correction' && i.correctsInvoiceId === invoiceId && i.withdrawsOriginal,
  )
}

export function invoiceBalances(
  invoices: InvoiceRecord[],
  payments: PaymentRecord[],
): InvoiceBalance[] {
  /** Строка, к которой относится названный платежом документ. */
  const rowOf = (invoiceId: string): string | null => {
    const named = invoices.find((i) => i.id === invoiceId)
    if (!named) return null
    // Корректировку корректировки система не выдаёт, поэтому один переход — вся цепочка.
    return named.kind === 'correction' ? named.correctsInvoiceId : named.id
  }

  const balances: InvoiceBalance[] = []
  for (const invoice of invoices) {
    if (invoice.kind === 'correction') continue
    const withdrawn = isInvoiceWithdrawn(invoices, invoice.id)
    // Отозванный — ровно ноль, а не «сумма плюс зеркальная поправка»: два
    // документа сходятся в ничто, и лишний цент округления показался бы долгом.
    const amount = withdrawn
      ? 0
      : round2(
          invoices.reduce(
            (sum, i) => (i.correctsInvoiceId === invoice.id ? round2(sum + i.amountGross) : sum),
            invoice.amountGross,
          ),
        )

    const settling = payments
      .filter((p) => p.invoiceId !== null && rowOf(p.invoiceId) === invoice.id)
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    const paidAmount = round2(settling.reduce((sum, p) => round2(sum + p.amount), 0))

    // Дата закрытия — платёж, на котором накопленная сумма впервые покрыла счёт.
    // Последний платёж на эту роль не годится: после закрытия по счёту может
    // пройти возврат, и тогда «оплачен» датировался бы днём, когда деньги ушли.
    let running = 0
    let paidAt: string | null = null
    for (const record of settling) {
      running = round2(running + record.amount)
      if (running >= amount) {
        paidAt = record.paidAt
        break
      }
    }

    balances.push({
      id: invoice.id,
      issuedAt: invoice.issuedAt,
      amount,
      paidAmount,
      outstanding: round2(amount - paidAmount),
      withdrawn,
      paidAt: paidAmount >= amount ? paidAt : null,
    })
  }
  return balances
}

/**
 * Какой документ закрывают пришедшие деньги, если платящий не назвал его сам.
 *
 * Старейший из непокрытых: долги гасятся в порядке возникновения, и это же
 * правило стоит за предзаполнением модалки регистрации оплаты. Пустое поле там
 * означало «деньги не названы ничьими» — карточка заказа показывала их
 * полученными, а реестр по тому же документу рисовал «Просрочен» и «оплачено
 * 0.00». Расхождение двух представлений начиналось не в расчёте, а в том, что
 * штатное нажатие «Сохранить» отправляло `invoiceId: null`.
 */
export function nextUnsettledInvoice(balances: InvoiceBalance[]): InvoiceBalance | null {
  const open = balances
    .filter((b) => !b.withdrawn && b.outstanding > 0)
    .sort((a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id))
  return open[0] ?? null
}
