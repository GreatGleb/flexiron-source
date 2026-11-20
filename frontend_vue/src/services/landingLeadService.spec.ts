/**
 * Отправка заявки лендинга (L-02, roo_code/plans/landing/tasks.json) — на подменённом fetch.
 *
 * Что держит спека: запрос — POST, `text/plain`, тело — JSON строкой, редирект разрешён,
 * таймаут 15 с подключён к запросу; ответ сервера разводится на sent / rejected / failed.
 * Инверсия каждого утверждения — в roo_code/plans/landing/progress.md, раздел L-02.
 */
import { afterEach, describe, it, expect, vi } from 'vitest'
import { SUBMIT_TIMEOUT_MS, submitLead } from './landingLeadService'
import type { LeadPayload } from '@/domain/landingLead'

const URL_EXEC = 'https://leads.invalid/exec'
const payload: LeadPayload = {
  name: 'Иван',
  company: 'ООО Металл',
  contact: 'ivan@mail.ru',
  message: 'Два склада',
  page: 'https://example.test/',
  userAgent: 'UA/1.0',
}

const respond = (body: string, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(body, { status }))

/** Аргументы первого вызова подменённого fetch. */
function firstCall(fetchImpl: ReturnType<typeof respond>) {
  const call = fetchImpl.mock.calls[0]
  if (!call) throw new Error('fetch не вызывался')
  return { url: call[0], init: call[1] }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('submitLead — запрос', () => {
  it('POST на переданный адрес, text/plain, тело — JSON строкой, redirect follow', async () => {
    const fetchImpl = respond('{"ok":true}')
    await submitLead(payload, URL_EXEC, fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const { url, init } = firstCall(fetchImpl)
    expect(url).toBe(URL_EXEC)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ 'Content-Type': 'text/plain' })
    expect(typeof init?.body).toBe('string')
    expect(JSON.parse(init?.body as string)).toEqual(payload)
    expect(init?.redirect).toBe('follow')
  })

  it('к запросу подключён сигнал таймаута на 15 секунд', async () => {
    const signal = new AbortController().signal
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal)
    const fetchImpl = respond('{"ok":true}')
    await submitLead(payload, URL_EXEC, fetchImpl)
    expect(SUBMIT_TIMEOUT_MS).toBe(15000)
    expect(timeout).toHaveBeenCalledWith(15000)
    expect(firstCall(fetchImpl).init?.signal).toBe(signal)
  })
})

describe('submitLead — ответ', () => {
  it('{ ok: true } → sent', async () => {
    expect(await submitLead(payload, URL_EXEC, respond('{"ok":true}'))).toBe('sent')
  })

  it('{ ok: false, error } → rejected', async () => {
    expect(
      await submitLead(payload, URL_EXEC, respond('{"ok":false,"error":"name required"}')),
    ).toBe('rejected')
  })

  it('сетевой сбой → failed', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await submitLead(payload, URL_EXEC, fetchImpl)).toBe('failed')
  })

  it('таймаут: сработавший сигнал обрывает запрос → failed', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), 5)
      return controller.signal
    })
    // Сервер, который не отвечает никогда: запрос завершает только сигнал.
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    expect(await submitLead(payload, URL_EXEC, fetchImpl)).toBe('failed')
  })

  it('не-JSON (страница ошибки Google) → failed', async () => {
    expect(await submitLead(payload, URL_EXEC, respond('<html>Error</html>'))).toBe('failed')
  })

  it('JSON без поля ok → failed', async () => {
    for (const body of ['{}', 'null', '[]', '"ok"', '{"ok":"true"}']) {
      expect(await submitLead(payload, URL_EXEC, respond(body)), body).toBe('failed')
    }
  })

  it('HTTP-ошибка → failed, даже если тело похоже на успех', async () => {
    expect(await submitLead(payload, URL_EXEC, respond('{"ok":true}', 500))).toBe('failed')
  })
})
