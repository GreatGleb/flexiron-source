import type { ReceivableStatus } from '@/types/finance'

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
