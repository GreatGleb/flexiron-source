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
