import type { LeadPayload } from '@/domain/landingLead'

/**
 * Отправка заявки лендинга в Google Apps Script (веб-приложение `…/exec`,
 * roo_code/plans/landing/landing-plan.md, «Форма заявки»).
 *
 * Это не наш API и не мок-слой: настоящий `fetch` на внешний адрес. `text/plain` —
 * чтобы браузер не делал CORS-preflight: Apps Script его не обслуживает.
 * Apps Script отвечает редиректом на googleusercontent.com — отсюда `redirect: 'follow'`.
 */

/** sent — заявка записана; rejected — сервер её не принял; failed — ответа не было или он не читается. */
export type LeadSubmitResult = 'sent' | 'rejected' | 'failed'

export const SUBMIT_TIMEOUT_MS = 15000

export async function submitLead(
  payload: LeadPayload,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LeadSubmitResult> {
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
    })
    if (!response.ok) return 'failed'
    const data: unknown = await response.json()
    const ok = data !== null && typeof data === 'object' ? (data as { ok?: unknown }).ok : undefined
    if (ok === true) return 'sent'
    if (ok === false) return 'rejected'
    return 'failed'
  } catch {
    return 'failed'
  }
}
