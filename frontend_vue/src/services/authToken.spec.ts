// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { authHeaders, getStoredToken, getStoredCsrf, TOKEN_KEY, CSRF_KEY } from './authToken'

describe('authToken — где лежит токен и как он едет на сервер', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('без токена заголовков нет вовсе — публичные роуты уходят чистыми', () => {
    expect(getStoredToken()).toBeNull()
    expect(authHeaders()).toBeUndefined()
  })

  it('токен из localStorage — вход с «запомнить меня»', () => {
    localStorage.setItem(TOKEN_KEY, 'tok-local')
    localStorage.setItem(CSRF_KEY, 'csrf-local')
    expect(authHeaders()).toEqual({
      Authorization: 'Bearer tok-local',
      'X-CSRF-Token': 'csrf-local',
    })
  })

  // Это регресс-тест на settings/БАГ-06: три копии читали только localStorage, и вошедший
  // без «запомнить меня» получал 401 на всех 24 роутах настроек, на ленте аудита и на загрузке.
  it('токен из sessionStorage — вход БЕЗ «запомнить меня» тоже подписан', () => {
    sessionStorage.setItem(TOKEN_KEY, 'tok-session')
    sessionStorage.setItem(CSRF_KEY, 'csrf-session')
    expect(getStoredToken()).toBe('tok-session')
    expect(authHeaders()).toEqual({
      Authorization: 'Bearer tok-session',
      'X-CSRF-Token': 'csrf-session',
    })
  })

  it('localStorage сильнее sessionStorage, когда лежат оба', () => {
    localStorage.setItem(TOKEN_KEY, 'tok-local')
    sessionStorage.setItem(TOKEN_KEY, 'tok-session')
    expect(getStoredToken()).toBe('tok-local')
  })

  it('токен есть, CSRF нет — заголовок CSRF пустой, но Authorization на месте', () => {
    sessionStorage.setItem(TOKEN_KEY, 'tok-session')
    expect(getStoredCsrf()).toBeNull()
    expect(authHeaders()).toEqual({
      Authorization: 'Bearer tok-session',
      'X-CSRF-Token': '',
    })
  })
})

describe('api.ts подписывает запрос сам — сервисы этого не решают', () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    calls.length = 0
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    vi.stubGlobal('fetch', (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { ok: true } }), {
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

  function headersOf(i = 0): Record<string, string> {
    return (calls[i]?.init?.headers ?? {}) as Record<string, string>
  }

  // Ядро класса: до правки заголовки ставили шесть файлов сервисного слоя из двадцати семи,
  // остальные ходили без них. Теперь их ставит сборка запроса, и забыть о них негде.
  it('GET несёт Authorization, хотя вызывающий о заголовках не знает', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-1')
    const { apiGet } = await import('./api')
    await apiGet('/api/analytics/dashboard')
    expect(headersOf()['Authorization']).toBe('Bearer tok-1')
  })

  it('DELETE несёт Authorization', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-2')
    const { apiDelete } = await import('./api')
    await apiDelete('/api/products/p-1')
    expect(headersOf()['Authorization']).toBe('Bearer tok-2')
  })

  it('POST несёт и Authorization, и Content-Type', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-3')
    const { apiPost } = await import('./api')
    await apiPost('/api/bcc/send', { a: 1 })
    expect(headersOf()['Authorization']).toBe('Bearer tok-3')
    expect(headersOf()['Content-Type']).toBe('application/json')
  })

  it('свой заголовок запроса сильнее — Idempotency-Key доезжает вместе с подписью', async () => {
    localStorage.setItem(TOKEN_KEY, 'tok-4')
    const { apiPost } = await import('./api')
    await apiPost('/api/bcc/send', { a: 1 }, { headers: { 'Idempotency-Key': 'key-42' } })
    expect(headersOf()['Idempotency-Key']).toBe('key-42')
    expect(headersOf()['Authorization']).toBe('Bearer tok-4')
  })

  it('без токена заголовков не появляется — 401 остаётся достижимым', async () => {
    const { apiGet } = await import('./api')
    await apiGet('/api/analytics/dashboard')
    expect(headersOf()['Authorization']).toBeUndefined()
  })
})
