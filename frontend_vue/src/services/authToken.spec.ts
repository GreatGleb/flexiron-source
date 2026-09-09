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

  // Регресс охранника роутера: `??` отсекает только null и undefined, поэтому пустая
  // строка доезжала как «токен есть», и сравнение с null пускало в админку невошедшего.
  it('пустая строка в localStorage — это не токен', () => {
    localStorage.setItem(TOKEN_KEY, '')
    expect(getStoredToken()).toBeNull()
    expect(authHeaders()).toBeUndefined()
  })

  it('пустая строка в sessionStorage — это не токен', () => {
    sessionStorage.setItem(TOKEN_KEY, '')
    expect(getStoredToken()).toBeNull()
    expect(authHeaders()).toBeUndefined()
  })

  // Дефект СТАРШЕ правки: так вёл себя и прежний getStoredToken в useAuth.ts. Пустая
  // строка в localStorage возвращалась через `??` как значение и заслоняла настоящий
  // токен в sessionStorage — человек с живой сессией не получал заголовков вовсе.
  it('пустая строка в localStorage не заслоняет настоящий токен в sessionStorage', () => {
    localStorage.setItem(TOKEN_KEY, '')
    sessionStorage.setItem(TOKEN_KEY, 'tok-session')
    expect(getStoredToken()).toBe('tok-session')
    expect(authHeaders()?.['Authorization']).toBe('Bearer tok-session')
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

// Проводка подписи в мок-ветку. Заведено после разбора скептика: до этого мок-ветки
// получали только заголовки самого вызова, то есть подписи не видели никогда, и снятие
// всей проводки не роняло ни одного теста из 801 — изменение было ненаблюдаемым.
describe('мок видит тот же запрос, что увидел бы сервер', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('./mocks/index')
  })

  /** Подменяем мок-слой целиком и запоминаем, с какими заголовками его позвали. */
  async function callThrough(
    verb: 'get' | 'post' | 'delete' | 'upload',
  ): Promise<Record<string, string> | undefined> {
    let seen: Record<string, string> | undefined
    vi.doMock('./mocks/index', () => ({
      getMock: (_p: string, _q: unknown, h?: Record<string, string>) => {
        seen = h
        return Promise.resolve({})
      },
      postMock: (_p: string, _b: unknown, h?: Record<string, string>) => {
        seen = h
        return Promise.resolve({})
      },
      deleteMock: (_p: string, h?: Record<string, string>) => {
        seen = h
        return Promise.resolve({})
      },
      uploadMock: (_p: string, _f: File, h?: Record<string, string>) => {
        seen = h
        return Promise.resolve({})
      },
    }))
    const api = await import('./api')
    if (verb === 'get') await api.apiGet('/api/analytics/dashboard')
    if (verb === 'post') await api.apiPost('/api/bcc/send', {})
    if (verb === 'delete') await api.apiDelete('/api/products/p-1')
    if (verb === 'upload') await api.apiUpload('/api/uploads', new File(['x'], 'x.pdf'))
    return seen
  }

  it.each(['get', 'post', 'delete', 'upload'] as const)(
    'мок-ветка %s получает Authorization',
    async (verb) => {
      localStorage.setItem(TOKEN_KEY, 'tok-mock')
      expect((await callThrough(verb))?.['Authorization']).toBe('Bearer tok-mock')
    },
  )

  it('без токена мок получает undefined, а не пустой объект', async () => {
    expect(await callThrough('get')).toBeUndefined()
  })
})

// Регресс: подпись собирается и для мок-ветки, а юнит-спеки идут в окружении `node`, где
// localStorage не объявлен вовсе. Отсутствие хранилища обязано читаться как «токена нет».
describe('хранилища может не быть вовсе', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('нет localStorage — токена нет, а не падение', () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('sessionStorage', undefined)
    expect(() => getStoredToken()).not.toThrow()
    expect(getStoredToken()).toBeNull()
    expect(authHeaders()).toBeUndefined()
  })

  it('хранилище бросает на обращении — токена нет, а не падение', () => {
    const throwing = {
      getItem() {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      },
    }
    vi.stubGlobal('localStorage', throwing)
    vi.stubGlobal('sessionStorage', throwing)
    expect(getStoredToken()).toBeNull()
    expect(getStoredCsrf()).toBeNull()
  })
})

// Вторая половина uploads/БАГ-04: «путь 401 под моками недостижим». Достижимой её делает
// крючок test_mock_require_auth — флаг-состояние по образцу питфолла #65, единственного
// такого крючка в проекте (mocks/notifications.ts). По умолчанию выключен: под моками
// админка доступна без входа намеренно, и отказ по умолчанию снёс бы демо целиком.
describe('путь 401 под моками достижим', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.stubEnv('VITE_USE_MOCKS', 'true')
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.removeItem('test_mock_require_auth')
    vi.unstubAllEnvs()
  })

  it('крючок выключен — неподписанный запрос проходит, демо не сломано', async () => {
    const { apiGet } = await import('./api')
    await expect(apiGet('/api/analytics/dashboard')).resolves.toBeDefined()
  })

  it('крючок включён, токена нет — 401 с кодом UNAUTHORIZED', async () => {
    localStorage.setItem('test_mock_require_auth', 'true')
    const { apiGet } = await import('./api')
    await expect(apiGet('/api/analytics/dashboard')).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED',
    })
  })

  it('крючок включён, токен есть — запрос проходит', async () => {
    localStorage.setItem('test_mock_require_auth', 'true')
    localStorage.setItem(TOKEN_KEY, 'tok-signed')
    const { apiGet } = await import('./api')
    await expect(apiGet('/api/analytics/dashboard')).resolves.toBeDefined()
  })

  it('флаг залипает: второй запрос отвергается так же, как первый (#65)', async () => {
    localStorage.setItem('test_mock_require_auth', 'true')
    const { apiGet } = await import('./api')
    await expect(apiGet('/api/analytics/dashboard')).rejects.toMatchObject({ status: 401 })
    await expect(apiGet('/api/analytics/dashboard')).rejects.toMatchObject({ status: 401 })
  })

  it('загрузка файла закрыта тем же крючком — это и был uploads/БАГ-04', async () => {
    localStorage.setItem('test_mock_require_auth', 'true')
    const { apiUpload } = await import('./api')
    await expect(
      apiUpload('/api/uploads', new File(['x'], 'x.pdf', { type: 'application/pdf' })),
    ).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
  })
})
