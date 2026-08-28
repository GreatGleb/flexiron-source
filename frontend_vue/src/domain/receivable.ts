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
 */
export function receivableStatus(input: {
  amount: number
  paidAmount: number
  dueDate: string
  now?: Date
}): ReceivableStatus {
  if (input.paidAmount >= input.amount) return 'completed'
  const due = new Date(input.dueDate).getTime()
  const now = (input.now ?? new Date()).getTime()
  if (!Number.isNaN(due) && now > due) return 'overdue'
  return 'pending'
}
