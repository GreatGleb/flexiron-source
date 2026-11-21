// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick, ref } from 'vue'
import { useLandingLead, type LeadCaptcha } from './useLandingLead'

/**
 * Состояния формы заявки лендинга (задача L-06). Браузерный путь — landing-lead.spec.ts;
 * здесь то, что от адреса зависит напрямую: пустой адрес — disabled, и из него не отправляют.
 */
const LEADS_URL_STUB = 'https://leads.invalid/exec'

function fill(lead: ReturnType<typeof useLandingLead>) {
  lead.draft.name = 'Иван'
  lead.draft.contact = 'ivan@metal.lt'
}

describe('useLandingLead', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('пустой адрес → disabled, submit не зовёт fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const lead = useLandingLead('')
    expect(lead.state.value).toBe('disabled')
    fill(lead)
    await lead.submit()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(lead.state.value).toBe('disabled')
  })

  it('адрес задан → idle; отправка → sending → success', async () => {
    let answer!: (r: Response) => void
    const fetchSpy = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)))
    vi.stubGlobal('fetch', fetchSpy)
    const lead = useLandingLead(LEADS_URL_STUB)
    expect(lead.state.value).toBe('idle')
    fill(lead)
    const done = lead.submit()
    expect(lead.state.value).toBe('sending')
    // Второй submit во время отправки — без второго запроса.
    await lead.submit()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    answer(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    await done
    expect(lead.state.value).toBe('success')
  })

  it('неверная форма: ошибки по полям, первое неверное — по порядку формы, запроса нет', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const lead = useLandingLead(LEADS_URL_STUB)
    lead.draft.contact = '12'
    await lead.submit()
    expect(lead.errors.value).toEqual({ name: 'required', contact: 'invalidContact' })
    expect(lead.firstInvalid()).toBe('name')
    expect(lead.state.value).toBe('idle')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('validateField трогает только своё поле и снимает ошибку, когда значение стало верным', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const lead = useLandingLead(LEADS_URL_STUB)
    lead.draft.contact = '12'
    await lead.submit()
    expect(lead.errors.value).toEqual({ name: 'required', contact: 'invalidContact' })
    lead.draft.contact = '+370 600 12345'
    lead.validateField('contact')
    expect(lead.errors.value).toEqual({ name: 'required' })
    lead.draft.company = 'x'.repeat(151)
    lead.validateField('company')
    expect(lead.errors.value).toEqual({ name: 'required', company: 'tooLong' })
  })
})

/** Подставная капча: токен задаёт тест, сбросы считаются. */
function fakeCaptcha(initial = '') {
  const token = ref(initial)
  const resets = { count: 0 }
  const captcha: LeadCaptcha = {
    required: () => true,
    token,
    reset: () => {
      resets.count++
      token.value = ''
    },
  }
  return { captcha, token, resets }
}

const okResponse = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

/** Тело первого запроса подменённого fetch. */
function sentBody(fetchSpy: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
  if (!init) throw new Error('fetch не вызывался')
  return JSON.parse(String(init.body)) as Record<string, unknown>
}

describe('useLandingLead — капча', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('токена нет — запроса нет, captchaMissing; токен пришёл — заявка уходит сама', async () => {
    const fetchSpy = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const { captcha, token } = fakeCaptcha()
    const lead = useLandingLead(LEADS_URL_STUB, captcha)
    fill(lead)
    await lead.submit()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(lead.captchaMissing.value).toBe(true)
    expect(lead.state.value).toBe('idle')

    token.value = 'tok-late'
    await nextTick()
    await vi.waitFor(() => expect(lead.state.value).toBe('success'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(sentBody(fetchSpy).captcha).toBe('tok-late')
    expect(lead.captchaMissing.value).toBe(false)
  })

  it('токен пришёл, а «Отправить» не нажимали — ничего не уходит', async () => {
    const fetchSpy = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const { captcha, token } = fakeCaptcha()
    const lead = useLandingLead(LEADS_URL_STUB, captcha)
    fill(lead)
    token.value = 'tok'
    await nextTick()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('неверная форма о капче не говорит: сначала поля', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { captcha } = fakeCaptcha()
    const lead = useLandingLead(LEADS_URL_STUB, captcha)
    await lead.submit()
    expect(lead.errors.value.name).toBe('required')
    expect(lead.captchaMissing.value).toBe(false)
  })

  it('сервер отказал — токен израсходован, капча сброшена; успех — без сброса', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify({ ok: false, error: 'captcha failed' })),
    )
    vi.stubGlobal('fetch', fetchSpy)
    const { captcha, token, resets } = fakeCaptcha('tok-1')
    const lead = useLandingLead(LEADS_URL_STUB, captcha)
    fill(lead)
    await lead.submit()
    expect(lead.state.value).toBe('error')
    expect(sentBody(fetchSpy).captcha).toBe('tok-1')
    expect(resets.count).toBe(1)

    fetchSpy.mockImplementation(async () => okResponse())
    token.value = 'tok-2'
    await lead.submit()
    expect(lead.state.value).toBe('success')
    expect(resets.count).toBe(1)
  })

  it('капча выключена (по умолчанию) — токен не нужен, уходит пустым', async () => {
    const fetchSpy = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchSpy)
    const lead = useLandingLead(LEADS_URL_STUB)
    fill(lead)
    await lead.submit()
    expect(lead.state.value).toBe('success')
    expect(sentBody(fetchSpy).captcha).toBe('')
  })
})
