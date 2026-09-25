// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Регресс на класс 4 прогона 2026-09-09 (`orders/БАГ-04`, `clients/БАГ-04`).
 *
 * Фильтры экранов объявлены nullable, `null` там значит «фильтра нет». Сборка query
 * клала значение через `URLSearchParams.set`, который приводит `null` строкой, —
 * и на настоящий сервер уезжало `status=null`, `clientId=null`, `sortBy=null`.
 * Под моками это не было видно: мок читает `params?.status ?? ''`, и строка `"null"`
 * туда не попадала, потому что мок получал объект до сборки query.
 *
 * Поэтому проверяется и то, и другое: и URL живого запроса, и то, что мок видит
 * ровно тот же набор параметров.
 */
describe('сборка query — `null` это отсутствие параметра, а не строка "null"', () => {
  const calls: string[] = []

  beforeEach(() => {
    calls.length = 0
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    vi.stubGlobal('fetch', (url: unknown) => {
      calls.push(String(url))
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  function query(i = 0): URLSearchParams {
    return new URL(calls[i]!).searchParams
  }

  it('null и undefined ключей в query не оставляют', async () => {
    const { apiGet } = await import('./api')
    await apiGet('/api/clients', { status: null, sortBy: undefined, sortDir: 'asc' })
    expect(query().has('status')).toBe(false)
    expect(query().has('sortBy')).toBe(false)
    expect(query().get('sortDir')).toBe('asc')
    expect(calls[0]).not.toContain('null')
  })

  it('пустая строка — значение, а не отсутствие: `search=` доезжает', async () => {
    const { apiGet } = await import('./api')
    await apiGet('/api/clients', { search: '' })
    expect(query().has('search')).toBe(true)
    expect(query().get('search')).toBe('')
  })

  it('числа и булевы приводит сама сборка, вызывающему строчить нечего', async () => {
    const { apiGet } = await import('./api')
    await apiGet('/api/orders', { page: 2, pageSize: 25, archived: false })
    expect(query().get('page')).toBe('2')
    expect(query().get('pageSize')).toBe('25')
    expect(query().get('archived')).toBe('false')
  })

  it('getClients с начальными фильтрами не фильтрует по статусу "null"', async () => {
    const { getClients } = await import('./clientsService')
    await getClients({ search: '', status: null, sortBy: null, sortDir: 'asc' })
    expect(query().has('status')).toBe(false)
    expect(query().has('sortBy')).toBe(false)
    expect(query().get('sortDir')).toBe('asc')
  })

  it('getOrders не шлёт clientId="null" и sortBy="null"', async () => {
    const { getOrders } = await import('./ordersService')
    await getOrders(
      {
        search: '',
        status: '',
        clientId: null,
        dateFrom: '',
        dateTo: '',
        sortBy: null,
        sortDir: 'asc',
      },
      { page: 1, pageSize: 20 },
    )
    expect(query().has('clientId')).toBe(false)
    expect(query().has('sortBy')).toBe(false)
    expect(query().get('page')).toBe('1')
    expect(query().get('pageSize')).toBe('20')
  })
})

describe('мок видит тот же набор параметров, что уехал бы в query', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('./mocks/index')
  })

  it('пустые значения отсеяны до мок-ветки, а не только перед fetch', async () => {
    let seen: Record<string, string> | undefined
    vi.doMock('./mocks/index', () => ({
      getMock: (_p: string, q?: Record<string, string>) => {
        seen = q
        return Promise.resolve({ items: [], total: 0 })
      },
    }))
    const { apiGet } = await import('./api')
    await apiGet('/api/clients', { search: '', status: null, sortBy: undefined, page: 3 })
    expect(seen).toEqual({ search: '', page: '3' })
  })
})
