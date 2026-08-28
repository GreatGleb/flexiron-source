import { describe, it, expect } from 'vitest'
import { receivableDueDate, receivableStatus } from './receivable'

const DAY = 86_400_000

describe('receivableDueDate', () => {
  it('прибавляет отсрочку клиента к дате счёта', () => {
    const due = receivableDueDate('2026-03-01T10:00:00.000Z', 30)
    expect(due).toBe('2026-03-31T10:00:00.000Z')
  })

  it('нулевая отсрочка — срок наступает в день выдачи', () => {
    const issued = '2026-03-01T10:00:00.000Z'
    expect(receivableDueDate(issued, 0)).toBe(issued)
  })

  it('отрицательная отсрочка не датирует счёт задним числом', () => {
    const issued = '2026-03-01T10:00:00.000Z'
    expect(receivableDueDate(issued, -10)).toBe(issued)
  })

  it('нечитаемая дата возвращается как есть, а не превращается в Invalid Date', () => {
    expect(receivableDueDate('не дата', 30)).toBe('не дата')
  })
})

describe('receivableStatus', () => {
  const dueDate = '2026-03-31T10:00:00.000Z'
  const before = new Date(Date.parse(dueDate) - DAY)
  const after = new Date(Date.parse(dueDate) + DAY)

  it('оплат нет, срок не наступил — ожидается', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate, now: before })).toBe('pending')
  })

  it('оплат нет, срок прошёл — просрочен', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate, now: after })).toBe('overdue')
  })

  it('оплачено меньше суммы, срок прошёл — просрочен, а не «частично»', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 999.99, dueDate, now: after })).toBe(
      'overdue',
    )
  })

  it('оплачено меньше суммы, срок не наступил — всё ещё ожидается', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 400, dueDate, now: before })).toBe(
      'pending',
    )
  })

  it('сумма платежей покрыла счёт — оплачен, даже если срок давно прошёл', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 1000, dueDate, now: after })).toBe(
      'completed',
    )
  })

  it('переплата тоже закрывает счёт', () => {
    expect(receivableStatus({ amount: 1000, paidAmount: 1200, dueDate, now: after })).toBe(
      'completed',
    )
  })

  /*
   * Срок — это день, а не мгновение. Даты в реестре показываются
   * `toLocaleDateString()`, то есть по локальному календарю, — по нему же и
   * считается граница просрочки, иначе пилюля спорит с колонкой рядом.
   */
  it('счёт с нулевой отсрочкой не просрочен через миг после выдачи', () => {
    const issued = new Date()
    const dueDate = receivableDueDate(issued.toISOString(), 0)
    const now = new Date(issued.getTime() + 60_000)
    expect(receivableStatus({ amount: 1000, paidAmount: 0, dueDate, now })).toBe('pending')
  })

  it('день срока ещё не кончился — счёт ожидается, а не просрочен', () => {
    const dueMoment = new Date(2026, 2, 31, 10, 0, 0)
    const lateSameDay = new Date(2026, 2, 31, 23, 59, 59, 999)
    expect(
      receivableStatus({
        amount: 1000,
        paidAmount: 0,
        dueDate: dueMoment.toISOString(),
        now: lateSameDay,
      }),
    ).toBe('pending')
  })

  it('просрочка наступает со следующего дня', () => {
    const dueMoment = new Date(2026, 2, 31, 10, 0, 0)
    const nextDay = new Date(2026, 3, 1, 0, 0, 0, 1)
    expect(
      receivableStatus({
        amount: 1000,
        paidAmount: 0,
        dueDate: dueMoment.toISOString(),
        now: nextDay,
      }),
    ).toBe('overdue')
  })
})
