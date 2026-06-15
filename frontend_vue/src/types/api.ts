export interface ApiResponse<T> {
  success: boolean
  data?: T         // filled when success === true
  message?: string // human-readable error / info message
  code?: string    // machine error code (see contract)
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * Structured API error with field-level details.
 * Thrown by api.ts when a request fails.
 */
export class ApiRequestError extends Error {
  /** HTTP status code */
  readonly status: number
  /** Machine-readable error code from backend (e.g. VALIDATION_ERROR, CONFLICT) */
  readonly code: string | null
  /** Human-readable error message */
  override readonly message: string
  /** Per-field error details (key = field name, value = error message) */
  readonly fieldErrors: Record<string, string>

  constructor(opts: {
    status: number
    message: string
    code?: string | null
    fieldErrors?: Record<string, string>
  }) {
    super(opts.message)
    this.name = 'ApiRequestError'
    this.status = opts.status
    this.code = opts.code ?? null
    this.message = opts.message
    this.fieldErrors = opts.fieldErrors ?? {}
  }
}
