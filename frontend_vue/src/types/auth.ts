/** Auth module types matching backend API responses. */

export interface UserInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  locale: string
  role: string
  tenant_id: string | null
  is_active: boolean
}

export interface SessionInfo {
  token: string
  csrf_token: string
  expires_at: string
}

export interface LoginInput {
  email: string
  password: string
  /** true = localStorage (persist across browser restarts), false = sessionStorage (tab only). Default: true. */
  rememberMe?: boolean
}

export interface RegisterInput {
  email: string
  password: string
  company_name: string
  vat_code: string
  locale?: string
  first_name?: string
  last_name?: string
  phone?: string
}

export interface LoginResponse {
  user: UserInfo
  session: SessionInfo
}

export interface RegisterResponse {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  locale: string
  role: string
  tenant_id: string | null
  is_active: boolean
  session: SessionInfo
  secret_link: string
}
