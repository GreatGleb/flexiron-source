// @vitest-environment happy-dom
/**
 * Фронтовые половины отказов настроек — слайсы С4, С5, С15.
 *
 * Три строки приёмки доказывали «код читается во фронте» поиском подстроки в ЛЮБОМ
 * файле `frontend_vue/src`, включая комментарий. Здесь то же утверждение взято
 * поведением: сервис отклоняет запрос той формой, которую присылает настоящий сервер
 * (`ApiRequestError`: код в поле `code`, ЧУЖАЯ фраза в `message`), а сохранение кладёт в
 * `error` перевод СВОЕГО ключа. Фраза сервера намеренно не содержит кода — чтение текста
 * на ней обязано промахнуться, иначе тест был бы зелёным и до правки (питфолл #68).
 *
 * Разбор берётся продуктовый: таблица `SAVE_ERROR_KEYS` и `errorMessageKey` не
 * подменяются, подменяется только сервис (транспорт). Шесть кодов трёх слайсов:
 *   С4  — UOM_IN_USE, CURRENCY_IN_USE, CURRENCY_IS_DEFAULT;
 *   С5  — CONVERSION_PAIR_TAKEN, ORDER_STATUS_REORDER_INCOMPLETE;
 *   С15 — CONSTANT_OUT_OF_RANGE.
 *
 * Пол по числу тестов в этом файле — шесть: удаление любого кейса обязано краснить
 * приёмку, поэтому кейсов ровно шесть, а не «шесть с запасом».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'
import { ApiRequestError } from '@/types/api'
import * as settingsService from '@/services/settingsService'

vi.mock('@/services/settingsService', () => ({
  getCompany: vi.fn(),
  getConstants: vi.fn(),
  getMailServer: vi.fn(),
  getOrderPermissions: vi.fn(),
  getCurrencies: vi.fn(),
  getUoms: vi.fn(),
  getConversions: vi.fn(),
  getOrderStatuses: vi.fn(),
  getProfile: vi.fn(),
  saveCompany: vi.fn(),
  saveConstants: vi.fn(),
  saveMailServer: vi.fn(),
  saveProfile: vi.fn(),
  createCurrency: vi.fn(),
  deleteCurrency: vi.fn(),
  updateCurrency: vi.fn(),
  createUom: vi.fn(),
  deleteUom: vi.fn(),
  createConversion: vi.fn(),
  deleteConversion: vi.fn(),
  updateConversion: vi.fn(),
  moveOrderStatus: vi.fn(),
  createOrderStatus: vi.fn(),
  deleteOrderStatus: vi.fn(),
  updateOrderStatus: vi.fn(),
}))

import { useSettings } from './useSettings'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/** Композабл зовёт `useI18n()`, а тот требует setup — отсюда обёртка, а не прямой вызов. */
function inSetup<T>(factory: () => T): T {
  let result!: T
  mount(
    {
      setup() {
        result = factory()
        return () => null
      },
    },
    { global: { plugins: [i18n] } },
  )
  return result
}

/**
 * Перевод, а не ключ. `i18n.global.t('нет.такого.ключа')` возвращает САМ КЛЮЧ, и
 * `toBe(t(key))` сравнивал бы ключ с ключом, оставаясь зелёным даже без перевода.
 * Бросок на `value === key` заодно доказывает, что ключ перевода существует.
 */
function t(key: string): string {
  const value = i18n.global.t(key)
  if (value === key) throw new Error(`перевода нет: ${key}`)
  return value
}

/** Отказ в той форме, что присылает настоящий сервер: код в поле, фраза — чужая. */
function отказ(code: string, фраза: string): ApiRequestError {
  return new ApiRequestError({ status: 409, message: фраза, code })
}

/** Утверждение «это перевод своего ключа, а не текст сервера». */
function ожидать_перевод(s: ReturnType<typeof useSettings>, key: string, фраза: string): void {
  expect(s.error.value).not.toBe(фраза)
  expect(s.error.value).toBe(t(key))
}

const UOM_ID = 'uom-1'
const VAL_ID = 'cur-1'
const СТ_А = 'st-a'
const СТ_Б = 'st-b'

/** Свежий композабл: модульное состояние общее, поэтому перед каждым случаем оно сброшено. */
function свежий(): ReturnType<typeof useSettings> {
  const s = inSetup(() => useSettings())
  s.resetState()
  return s
}

/**
 * Свежий композабл с состоявшимся `load()`: снимок нужен, чтобы `save()` вычислил
 * УДАЛЁННЫЕ единицу/валюту и перестановку статусов — без снимка разница не видна.
 */
async function поднять(overrides: {
  uoms?: unknown[]
  currencies?: unknown[]
  orderStatuses?: unknown[]
}): Promise<ReturnType<typeof useSettings>> {
  vi.mocked(settingsService.getCompany).mockResolvedValue({
    name: '',
    legalAddress: '',
    vatCode: '',
    bankName: '',
    bankAccount: '',
  } as never)
  vi.mocked(settingsService.getConstants).mockResolvedValue({
    vatRate: 21,
    defaultMargin: 15,
    defaultCurrency: 'EUR',
    defaultDiscountPercent: 0,
  } as never)
  vi.mocked(settingsService.getMailServer).mockResolvedValue({
    host: '',
    port: 587,
    encryption: 'none',
    username: '',
    passwordSet: false,
    fromEmail: '',
    fromName: '',
  } as never)
  vi.mocked(settingsService.getOrderPermissions).mockResolvedValue({
    seeCost: [],
    manualCost: [],
    correction: [],
  } as never)
  vi.mocked(settingsService.getCurrencies).mockResolvedValue((overrides.currencies ?? []) as never)
  vi.mocked(settingsService.getUoms).mockResolvedValue((overrides.uoms ?? []) as never)
  vi.mocked(settingsService.getOrderStatuses).mockResolvedValue(
    (overrides.orderStatuses ?? []) as never,
  )
  vi.mocked(settingsService.getConversions).mockResolvedValue([] as never)
  vi.mocked(settingsService.getProfile).mockResolvedValue({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'owner',
  } as never)

  const s = свежий()
  await s.load()
  return s
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('С4 · единицы и валюты: отказ приходит кодом, а показывается фразой', () => {
  it('UOM_IN_USE — занятая единица не удаляется', async () => {
    const фраза = 'the server declined without naming anything'
    const s = await поднять({ uoms: [{ id: UOM_ID }] })
    s.removeUom(UOM_ID)
    vi.mocked(settingsService.deleteUom).mockRejectedValue(отказ('UOM_IN_USE', фраза))
    await s.save()
    ожидать_перевод(s, 'settingsUom.error_uom_in_use', фраза)
  })

  it('CURRENCY_IN_USE — на валюту ссылаются товары', async () => {
    const фраза = 'a refusal sentence the interface never wrote'
    const s = await поднять({ currencies: [{ id: VAL_ID }] })
    s.removeCurrency(VAL_ID)
    vi.mocked(settingsService.deleteCurrency).mockRejectedValue(отказ('CURRENCY_IN_USE', фраза))
    await s.save()
    ожидать_перевод(s, 'settingsFinance.error_currency_in_use', фраза)
  })

  it('CURRENCY_IS_DEFAULT — валюту по умолчанию удалить нельзя', async () => {
    const фраза = 'something the operator will never read in the UI'
    const s = await поднять({ currencies: [{ id: VAL_ID }] })
    s.removeCurrency(VAL_ID)
    vi.mocked(settingsService.deleteCurrency).mockRejectedValue(отказ('CURRENCY_IS_DEFAULT', фраза))
    await s.save()
    ожидать_перевод(s, 'settingsFinance.error_currency_is_default', фраза)
  })
})

describe('С5 · тела запросов: отказ приходит кодом, а показывается фразой', () => {
  it('CONVERSION_PAIR_TAKEN — правило для пары уже есть', async () => {
    const фраза = 'a foreign sentence that mentions no code at all'
    const s = свежий()
    s.addConversion({ fromUomId: 'uom-a', toUomId: 'uom-b', type: 'static', factor: 2 })
    vi.mocked(settingsService.createConversion).mockRejectedValue(
      отказ('CONVERSION_PAIR_TAKEN', фраза),
    )
    await s.save()
    ожидать_перевод(s, 'settingsUom.error_conversion_pair_taken', фраза)
  })

  it('ORDER_STATUS_REORDER_INCOMPLETE — список статусов разъехался', async () => {
    const фраза = 'the order of the list was rejected for its own reasons'
    const s = await поднять({
      orderStatuses: [
        { id: СТ_А, order: 0 },
        { id: СТ_Б, order: 1 },
      ],
    })
    s.moveOrderStatus(0, 1)
    vi.mocked(settingsService.moveOrderStatus).mockRejectedValue(
      отказ('ORDER_STATUS_REORDER_INCOMPLETE', фраза),
    )
    await s.save()
    ожидать_перевод(s, 'settingsStatuses.error_reorder_incomplete', фраза)
  })
})

describe('С15 · границы финансовых констант: отказ приходит кодом, а показывается фразой', () => {
  it('CONSTANT_OUT_OF_RANGE — значение вне диапазона', async () => {
    const фраза = 'the boundary was checked elsewhere and refused here'
    const s = свежий()
    s.updateConstants({ vatRate: 101 })
    vi.mocked(settingsService.saveConstants).mockRejectedValue(
      отказ('CONSTANT_OUT_OF_RANGE', фраза),
    )
    await s.save()
    ожидать_перевод(s, 'settingsFinance.error_constant_out_of_range', фраза)
  })
})
