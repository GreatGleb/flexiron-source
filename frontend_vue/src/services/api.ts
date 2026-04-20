import type { ApiResponse } from '@/types/api'

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

export interface RequestOptions {
  /** Extra headers for this request (e.g. Idempotency-Key). */
  headers?: Record<string, string>
}

async function unwrap<T>(res: Response, method: string, path: string): Promise<T> {
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`)
  const json: ApiResponse<T> = await res.json()
  if (!json.success) throw new Error(json.message ?? 'API error')
  return json.data as T
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (USE_MOCKS) {
    const { getMock } = await import('./mocks/index')
    return getMock<T>(path, params)
  }
  const url = new URL(path, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  const res = await fetch(url.toString())
  return unwrap<T>(res, 'GET', path)
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  options?: RequestOptions,
): Promise<T> {
  if (USE_MOCKS) {
    const { postMock } = await import('./mocks/index')
    return postMock<T>(path, body, options?.headers)
  }
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    body: JSON.stringify(body),
  })
  return unwrap<T>(res, 'POST', path)
}

export async function apiPut<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  if (USE_MOCKS) {
    const { putMock } = await import('./mocks/index')
    return putMock<T>(path, body, options?.headers)
  }
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
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
    return patchMock<T>(path, body, options?.headers)
  }
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    body: JSON.stringify(body),
  })
  return unwrap<T>(res, 'PATCH', path)
}

export async function apiDelete<T = void>(path: string, options?: RequestOptions): Promise<T> {
  if (USE_MOCKS) {
    const { deleteMock } = await import('./mocks/index')
    return deleteMock<T>(path, options?.headers)
  }
  const res = await fetch(path, {
    method: 'DELETE',
    headers: options?.headers ?? {},
  })
  return unwrap<T>(res, 'DELETE', path)
}

/** Multipart upload. Returns file metadata (incl. fileId). */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  if (USE_MOCKS) {
    const { uploadMock } = await import('./mocks/index')
    return uploadMock<T>(path, file)
  }
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(path, { method: 'POST', body: form })
  return unwrap<T>(res, 'UPLOAD', path)
}

/** Generate a v4 uuid for Idempotency-Key headers (crypto-backed when available). */
export function newIdempotencyKey(): string {
  const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  // Fallback — good enough for mock scenarios
  return 'idm-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
}
