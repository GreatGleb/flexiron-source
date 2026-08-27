import { describe, it, expect } from 'vitest'
import { isValidPaymentTermsDays, normalizePaymentTermsDays } from './paymentTerms'

describe('isValidPaymentTermsDays', () => {
  it('принимает целые неотрицательные дни', () => {
    expect(isValidPaymentTermsDays(0)).toBe(true)
    expect(isValidPaymentTermsDays(30)).toBe(true)
    expect(isValidPaymentTermsDays(365)).toBe(true)
  })

  it('отказывает отрицательной отсрочке — срок оплаты не бывает раньше счёта', () => {
    expect(isValidPaymentTermsDays(-1)).toBe(false)
    expect(isValidPaymentTermsDays(-30)).toBe(false)
  })

  it('отказывает дробным дням — календарь их не знает', () => {
    expect(isValidPaymentTermsDays(14.5)).toBe(false)
  })

  it('отказывает всему, что не конечное число', () => {
    expect(isValidPaymentTermsDays(NaN)).toBe(false)
    expect(isValidPaymentTermsDays(Infinity)).toBe(false)
    expect(isValidPaymentTermsDays('30')).toBe(false)
    expect(isValidPaymentTermsDays(null)).toBe(false)
    expect(isValidPaymentTermsDays(undefined)).toBe(false)
  })
})

describe('normalizePaymentTermsDays', () => {
  it('оставляет целые неотрицательные дни как есть', () => {
    expect(normalizePaymentTermsDays(0)).toBe(0)
    expect(normalizePaymentTermsDays(45)).toBe(45)
  })

  it('очищенное поле — это ноль, а не NaN (питфолл #25)', () => {
    expect(normalizePaymentTermsDays(NaN)).toBe(0)
    expect(normalizePaymentTermsDays('')).toBe(0)
    expect(normalizePaymentTermsDays(null)).toBe(0)
    expect(normalizePaymentTermsDays(undefined)).toBe(0)
    expect(normalizePaymentTermsDays(Infinity)).toBe(0)
  })

  it('минус превращается в ноль, а не в отсрочку задним числом', () => {
    expect(normalizePaymentTermsDays(-1)).toBe(0)
    expect(normalizePaymentTermsDays(-30)).toBe(0)
  })

  it('дробь отсекается до целого дня', () => {
    expect(normalizePaymentTermsDays(14.9)).toBe(14)
    expect(normalizePaymentTermsDays(0.5)).toBe(0)
  })

  it('строку из поля читает как число', () => {
    expect(normalizePaymentTermsDays('30')).toBe(30)
  })
})
