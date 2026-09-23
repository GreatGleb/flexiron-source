// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { translations } from '@/i18n/translations'
import { ApiRequestError } from '@/types/api'

/**
 * Восемь складских композаблов клали текст исключения (`e.message`) прямо в видимое
 * человеку значение — английскую строку, зашитую в код, никак не зависящую от локали.
 * Здесь проверяется обратное: отказ сервера, поданный формой настоящего API
 * (`ApiRequestError` с полем `code` и человеческой фразой в `message`), обязан
 * превращаться в ПЕРЕВОД, а не показываться как есть.
 *
 * `message` у каждой ошибки — намеренно ЧУЖАЯ фраза, которой нет ни в одной локали:
 * если бы её текст совпал со случайно верным переводом, тест был бы зелёным и до
 * правки — тот самый питфолл #68 (`apiErrorCode.consumers.spec.ts`).
 */

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/services/warehouseService', () => ({
  getStockOverview: vi.fn(),
  getBatches: vi.fn(),
  getOffcuts: vi.fn(),
  getMovements: vi.fn(),
  getDeficitList: vi.fn(),
  deleteBatch: vi.fn(),
  deleteOffcut: vi.fn(),
  deleteDeficitItem: vi.fn(),
  patchDeficitItem: vi.fn(),
  patchOffcut: vi.fn(),
  createMovement: vi.fn(),
  getBatch: vi.fn(),
  patchBatch: vi.fn(),
  getBatchAudit: vi.fn(),
  deleteBatchAuditEntry: vi.fn(),
  getBatchAggregates: vi.fn(),
  getBatchActiveSales: vi.fn(),
  getStockItem: vi.fn(),
  patchStockItem: vi.fn(),
  deleteStockAuditEntry: vi.fn(),
  getMovement: vi.fn(),
  deleteMovementAuditEntry: vi.fn(),
  deleteDeficitAuditEntry: vi.fn(),
  getOffcut: vi.fn(),
  deleteOffcutAuditEntry: vi.fn(),
  getDeficitItem: vi.fn(),
  createOffcut: vi.fn(),
}))

vi.mock('@/services/settingsService', () => ({
  getWarehouseMap: vi.fn(),
  saveWarehouseMap: vi.fn(),
  deleteWarehouseMap: vi.fn(),
}))

vi.mock('@/services/productsService', () => ({
  getProducts: vi.fn(),
  getProduct: vi.fn(),
}))

vi.mock('./useProductNames', () => ({
  ensureProductNames: vi.fn(),
  useProductNames: () => ({}),
}))

import {
  getStockOverview,
  getBatches,
  getOffcuts,
  getMovements,
  getDeficitList,
  getBatch,
  getStockItem,
  getMovement,
  getDeficitItem,
  getOffcut,
  createOffcut,
} from '@/services/warehouseService'
import { getWarehouseMap } from '@/services/settingsService'
import { useWarehouse } from './useWarehouse'
import { useWarehouseBatch } from './useWarehouseBatch'
import { useWarehouseStockCard } from './useWarehouseStockCard'
import { useWarehouseMap } from './useWarehouseMap'
import { useWarehouseMovementCard } from './useWarehouseMovementCard'
import { useWarehouseDeficitCard } from './useWarehouseDeficitCard'
import { useWarehouseOffcutCard } from './useWarehouseOffcutCard'
import { useWarehouseOffcutCreate } from './useWarehouseOffcutCreate'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/** Композабл зовёт `useI18n()`/`useRouter()`, а те требуют setup — отсюда обёртка. */
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
 * Перевод, а не ключ. `i18n.global.t('нет.такого.ключа')` возвращает САМ КЛЮЧ — значит
 * `toBe(t(key))` остался бы зелёным, даже если перевода нет ни в одной локали.
 */
function t(key: string): string {
  const value = i18n.global.t(key)
  if (value === key) throw new Error(`перевода нет: ${key}`)
  return value
}

/** Фраза сервера, которую не переводит ни одна локаль и не содержит машинного кода. */
const FOREIGN_PHRASE = 'The kraken ate the response before it reached the client'

function refusal(message: string, code?: string): ApiRequestError {
  return new ApiRequestError({ status: 500, message, code })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useWarehouse — пять вкладок, общий тост загрузки, кода нет ни у одной', () => {
  it('остатки: незнакомый отказ становится переводом, а не текстом исключения', async () => {
    vi.mocked(getStockOverview).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const w = inSetup(() => useWarehouse())
    await w.loadStock()
    expect(w.stockError.value).toBe(t('warehouse.toast_error_load'))
    expect(w.stockError.value).not.toContain('kraken')
  })

  it('партии: то же самое', async () => {
    vi.mocked(getBatches).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const w = inSetup(() => useWarehouse())
    await w.loadBatches()
    expect(w.batchesError.value).toBe(t('warehouse.toast_error_load'))
  })

  it('обрезки: то же самое', async () => {
    vi.mocked(getOffcuts).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const w = inSetup(() => useWarehouse())
    await w.loadOffcuts()
    expect(w.offcutsError.value).toBe(t('warehouse.toast_error_load'))
  })

  it('движения: то же самое', async () => {
    vi.mocked(getMovements).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const w = inSetup(() => useWarehouse())
    await w.loadMovements()
    expect(w.movementsError.value).toBe(t('warehouse.toast_error_load'))
  })

  it('дефицит: то же самое', async () => {
    vi.mocked(getDeficitList).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const w = inSetup(() => useWarehouse())
    await w.loadDeficit()
    expect(w.deficitError.value).toBe(t('warehouse.toast_error_load'))
  })
})

describe('useWarehouseBatch — карточка партии', () => {
  it('BATCH_NOT_FOUND доводит до своего сообщения', async () => {
    vi.mocked(getBatch).mockRejectedValue(refusal(FOREIGN_PHRASE, 'BATCH_NOT_FOUND'))
    const b = inSetup(() => useWarehouseBatch('bat-1'))
    await b.load()
    expect(b.error.value).toBe(t('warehouse.batch_card_not_found'))
    expect(b.error.value).not.toContain('kraken')
  })

  it('незнакомый код остаётся общей фразой загрузки', async () => {
    vi.mocked(getBatch).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const b = inSetup(() => useWarehouseBatch('bat-1'))
    await b.load()
    expect(b.error.value).toBe(t('warehouse.toast_error_load'))
  })
})

describe('useWarehouseStockCard — карточка остатка', () => {
  it('STOCK_ITEM_NOT_FOUND доводит до своего сообщения', async () => {
    vi.mocked(getStockItem).mockRejectedValue(refusal(FOREIGN_PHRASE, 'STOCK_ITEM_NOT_FOUND'))
    const s = inSetup(() => useWarehouseStockCard('prod-1'))
    await s.load()
    expect(s.error.value).toBe(t('warehouse.stock_card_not_found'))
  })

  it('незнакомый код остаётся общей фразой загрузки', async () => {
    vi.mocked(getStockItem).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const s = inSetup(() => useWarehouseStockCard('prod-1'))
    await s.load()
    expect(s.error.value).toBe(t('warehouse.toast_error_load'))
  })
})

describe('useWarehouseMap — карта склада', () => {
  it('отказ без кода становится переводом, а не текстом исключения', async () => {
    vi.mocked(getWarehouseMap).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const m = inSetup(() => useWarehouseMap())
    await m.load()
    expect(m.error.value).toBe(t('warehouse.toast_error_load'))
    expect(m.error.value).not.toContain('kraken')
  })
})

describe('useWarehouseMovementCard — карточка движения', () => {
  it('MOVEMENT_NOT_FOUND доводит до своего сообщения', async () => {
    vi.mocked(getMovement).mockRejectedValue(refusal(FOREIGN_PHRASE, 'MOVEMENT_NOT_FOUND'))
    const mv = inSetup(() => useWarehouseMovementCard('mov-1'))
    await mv.load()
    expect(mv.error.value).toBe(t('warehouse.movement_not_found'))
  })

  it('незнакомый код остаётся общей фразой загрузки', async () => {
    vi.mocked(getMovement).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const mv = inSetup(() => useWarehouseMovementCard('mov-1'))
    await mv.load()
    expect(mv.error.value).toBe(t('warehouse.toast_error_load'))
  })
})

describe('useWarehouseDeficitCard — карточка нехватки', () => {
  it('DEFICIT_NOT_FOUND доводит до своего сообщения', async () => {
    vi.mocked(getDeficitItem).mockRejectedValue(refusal(FOREIGN_PHRASE, 'DEFICIT_NOT_FOUND'))
    const d = inSetup(() => useWarehouseDeficitCard('def-1'))
    await d.load()
    expect(d.error.value).toBe(t('warehouse.deficit_not_found'))
  })

  it('незнакомый код остаётся общей фразой загрузки', async () => {
    vi.mocked(getDeficitItem).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const d = inSetup(() => useWarehouseDeficitCard('def-1'))
    await d.load()
    expect(d.error.value).toBe(t('warehouse.toast_error_load'))
  })
})

describe('useWarehouseOffcutCard — карточка обрезка', () => {
  it('OFFCUT_NOT_FOUND доводит до своего сообщения', async () => {
    vi.mocked(getOffcut).mockRejectedValue(refusal(FOREIGN_PHRASE, 'OFFCUT_NOT_FOUND'))
    const o = inSetup(() => useWarehouseOffcutCard('off-1'))
    await o.load()
    expect(o.error.value).toBe(t('warehouse.offcut_not_found'))
  })

  it('незнакомый код остаётся общей фразой загрузки', async () => {
    vi.mocked(getOffcut).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const o = inSetup(() => useWarehouseOffcutCard('off-1'))
    await o.load()
    expect(o.error.value).toBe(t('warehouse.toast_error_load'))
  })
})

describe('useWarehouseOffcutCreate — страница создания обрезка', () => {
  it('отказ без кода становится переводом, а не текстом исключения', async () => {
    vi.mocked(createOffcut).mockRejectedValue(refusal(FOREIGN_PHRASE))
    const oc = inSetup(() => useWarehouseOffcutCreate())
    oc.selectedProductId.value = 'prod-1'
    oc.form.batchId = 'bat-1'
    await oc.save()
    expect(oc.error.value).toBe(t('warehouse.toast_offcut_create_error'))
    expect(oc.error.value).not.toContain('kraken')
  })
})
