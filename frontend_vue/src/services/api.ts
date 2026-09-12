import type { ApiResponse } from '@/types/api'
import { ApiRequestError } from '@/types/api'
import { authHeaders } from './authToken'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

export interface RequestOptions {
  /** Extra headers for this request (e.g. Idempotency-Key). */
  headers?: Record<string, string>
}

/**
 * Заголовки запроса: авторизация плюс то, что запрос принёс с собой.
 *
 * Собираются и для мок-ветки тоже, а не только перед `fetch`. Мок держится того же
 * правила, что приложение (линза Л4): он обязан видеть тот же запрос, который увидел бы
 * сервер. До этого мок-ветки получали только заголовки самого вызова, то есть подписи не
 * видели никогда — и стоять на такой опоре не может ни проверка отказа, ни что-либо ещё.
 *
 * Подписывание перестало быть решением каждого вызова: до правки подпись ставили **три**
 * файла из пятнадцати, ходящих в этот модуль (`settingsService`, `auditFeedService`,
 * `uploadsService`), а остальные двенадцать шли без неё при том, что их таблицы объявлены
 * `tenant_id NOT NULL`.
 *
 * **Порядок слияния: опции идут последними, поэтому вызывающий может перебить любой ключ** —
 * в том числе `Content-Type`, и это единственное столкновение, которое здесь вообще бывает.
 * С `Idempotency-Key` и `If-Match` никакого старшинства нет: подпись даёт только
 * `Authorization` и `X-CSRF-Token`, столкнуться с ними эти ключи не могут — разные имена.
 * Прежняя формулировка обещала им защиту от конфликта, которого не бывает; охранять там было
 * нечего, и инверсия порядка это подтверждала зелёным прогоном. Утверждается тестом на
 * `Content-Type` в `authToken.spec.ts`.
 */
function buildHeaders(
  options: RequestOptions | undefined,
  base?: Record<string, string>,
): Record<string, string> | undefined {
  const merged = { ...base, ...authHeaders(), ...options?.headers }
  return Object.keys(merged).length > 0 ? merged : undefined
}

/**
 * Parse an HTTP error response and extract structured error details.
 * Handles:
 *  - FastAPI 422 detail (ValidationError) → { message, code }
 *  - FastAPI default 422 (Pydantic) → [{ loc, msg, type }]
 *  - Our ApiResponse envelope → { message, code }
 *  - Plain HTTP status text
 */
function parseErrorBody(
  body: unknown,
  status: number,
): {
  message: string
  code: string | null
  fieldErrors: Record<string, string>
} {
  const fieldErrors: Record<string, string> = {}

  // Case 1: FastAPI detail object { message, code } — our custom ValidationError
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as Record<string, unknown>).detail

    // Case 1a: detail is an array — Pydantic validation errors [{ loc, msg, type }]
    if (Array.isArray(detail)) {
      for (const err of detail) {
        if (err && typeof err === 'object' && 'loc' in err && 'msg' in err) {
          const loc = (err as { loc?: unknown[] }).loc ?? []
          const msg = String((err as { msg?: string }).msg ?? '')
          // loc looks like ["body", "email"] — take the last element as field name
          const field = loc.length > 1 ? String(loc[loc.length - 1]) : null
          if (field && field !== 'body') {
            fieldErrors[field] = msg
          }
        }
      }
      const firstMsg =
        Array.isArray(detail) && detail.length > 0
          ? String((detail[0] as { msg?: string } | undefined)?.msg ?? 'Validation error')
          : 'Validation error'
      return { message: firstMsg, code: 'VALIDATION_ERROR', fieldErrors }
    }

    // Case 1b: detail is an object { message, code } — our custom error
    if (typeof detail === 'object' && detail !== null) {
      const msg = String((detail as Record<string, unknown>).message ?? '')
      const code = String((detail as Record<string, unknown>).code ?? '') || null
      // Try to infer which field the error relates to from the message
      const inferredField = inferFieldFromMessage(msg, code)
      if (inferredField) {
        fieldErrors[inferredField] = msg
      }
      return { message: msg || `Request failed (${status})`, code, fieldErrors }
    }

    // Case 1c: detail is a plain string
    if (typeof detail === 'string') {
      return { message: detail, code: null, fieldErrors }
    }
  }

  // Case 2: Our ApiResponse envelope { success: false, message, code }
  if (body && typeof body === 'object' && 'success' in body) {
    const b = body as Record<string, unknown>
    if (b.success === false) {
      const msg = String(b.message ?? '')
      const code = b.code ? String(b.code) : null
      return { message: msg || 'API error', code, fieldErrors }
    }
  }

  // Case 3: Plain text or unknown format
  return { message: `Request failed (${status})`, code: null, fieldErrors }
}

/** Map backend error messages/codes to form field names based on content. */
function inferFieldFromMessage(message: string, code: string | null): string | null {
  const lower = message.toLowerCase()
  if (code === 'VALIDATION_ERROR') {
    if (lower.includes('vat') || lower.includes('company code')) return 'vat_code'
    if (lower.includes('email')) return 'email'
    if (lower.includes('password') || lower.includes('pwd')) return 'password'
    if (lower.includes('phone')) return 'phone'
    if (
      lower.includes('first_name') ||
      lower.includes('first name') ||
      (lower.includes('name') && !lower.includes('company') && !lower.includes('last'))
    )
      return 'first_name'
    if (lower.includes('last_name') || lower.includes('last name')) return 'last_name'
    if (lower.includes('company') || lower.includes('company_name')) return 'company_name'
  }
  if (code === 'CONFLICT') {
    if (lower.includes('email')) return 'email'
  }
  return null
}

async function unwrap<T>(res: Response, method: string, path: string): Promise<T> {
  // Try to parse the response body regardless of status
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // Response is not JSON — use status text
  }

  if (!res.ok) {
    const { message, code, fieldErrors } = parseErrorBody(body, res.status)
    throw new ApiRequestError({
      status: res.status,
      message: message || `${method} ${path} failed: ${res.status}`,
      code,
      fieldErrors,
    })
  }

  // Successful response — unwrap ApiResponse envelope
  if (body && typeof body === 'object' && 'success' in (body as Record<string, unknown>)) {
    const json = body as ApiResponse<T>
    if (!json.success) {
      throw new ApiRequestError({
        status: res.status,
        message: json.message ?? 'API error',
        code: json.code ?? null,
      })
    }
    return json.data as T
  }

  // If the response doesn't have the ApiResponse envelope, return as-is
  return body as T
}

/**
 * Значения query-параметров такими, какими их отдают сервисы.
 *
 * Фильтры экранов объявлены nullable (`status: 'active' | null`, `sortBy: … | null`),
 * и `null` там означает «фильтра нет». Раньше тип был `Record<string, string>`, а
 * сервисы дотягивались до него приведением — и `URLSearchParams.set` превращал
 * `null` в строку `"null"`, то есть в фильтр по несуществующему значению.
 * Тип честный, а отсев пустых — в `toQueryStrings`.
 */
export type QueryParams = Record<string, string | number | boolean | null | undefined>

/**
 * `null`/`undefined` — не значение, а отсутствие параметра: такой ключ в query не едет.
 * Всё остальное приводится строкой здесь, а не у вызывающего.
 *
 * Пустая строка — значение: `search=` это осознанно пустой поиск, и сервер вправе
 * отличать его от отсутствия ключа.
 */
function toQueryStrings(params?: QueryParams): Record<string, string> | undefined {
  if (!params) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue
    out[key] = String(value)
  }
  return out
}

export async function apiGet<T>(
  path: string,
  params?: QueryParams,
  options?: RequestOptions,
): Promise<T> {
  // Моки получают ровно то же, что уехало бы в query: иначе дефект вида «null стал
  // строкой» живёт до настоящего сервера и под моками не виден.
  const query = toQueryStrings(params)
  if (USE_MOCKS) {
    const { getMock } = await import('./mocks/index')
    return getMock<T>(path, query, buildHeaders(options))
  }
  const url = new URL(path, window.location.origin)
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString(), {
    headers: buildHeaders(options),
  })
  return unwrap<T>(res, 'GET', path)
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  if (USE_MOCKS) {
    const { postMock } = await import('./mocks/index')
    return postMock<T>(path, body, buildHeaders(options))
  }
  const res = await fetch(path, {
    method: 'POST',
    headers: buildHeaders(options, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return unwrap<T>(res, 'POST', path)
}

export async function apiPut<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  if (USE_MOCKS) {
    const { putMock } = await import('./mocks/index')
    return putMock<T>(path, body, buildHeaders(options))
  }
  const res = await fetch(path, {
    method: 'PUT',
    headers: buildHeaders(options, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return unwrap<T>(res, 'PUT', path)
}

/** PATCH with RFC 7396 merge-patch body. Send only dirty fields. */
export async function apiPatch<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  if (USE_MOCKS) {
    const { patchMock } = await import('./mocks/index')
    return patchMock<T>(path, body, buildHeaders(options))
  }
  const res = await fetch(path, {
    method: 'PATCH',
    headers: buildHeaders(options, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return unwrap<T>(res, 'PATCH', path)
}

export async function apiDelete<T = void>(path: string, options?: RequestOptions): Promise<T> {
  if (USE_MOCKS) {
    const { deleteMock } = await import('./mocks/index')
    return deleteMock<T>(path, buildHeaders(options))
  }
  const res = await fetch(path, {
    method: 'DELETE',
    headers: buildHeaders(options),
  })
  return unwrap<T>(res, 'DELETE', path)
}

/** Multipart upload. Returns file metadata (incl. fileId). */
export async function apiUpload<T>(path: string, file: File, options?: RequestOptions): Promise<T> {
  if (USE_MOCKS) {
    const { uploadMock } = await import('./mocks/index')
    return uploadMock<T>(path, file, buildHeaders(options))
  }
  const form = new FormData()
  form.append('file', file)
  // Content-Type не ставим: его вместе с boundary выставляет FormData.
  const res = await fetch(path, {
    method: 'POST',
    body: form,
    headers: buildHeaders(options),
  })
  return unwrap<T>(res, 'UPLOAD', path)
}

/** Generate a v4 uuid for Idempotency-Key headers (crypto-backed when available). */
export function newIdempotencyKey(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  // Fallback — good enough for mock scenarios
  return 'idm-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
}
