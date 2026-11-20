// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useLandingLead } from './useLandingLead'

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
