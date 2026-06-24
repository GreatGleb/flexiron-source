/**
 * useAuth — authentication composable.
 *
 * Provides reactive auth state and methods for login, register, logout,
 * and fetching the current user. Stores the session token in localStorage
 * (when "remember me" is checked) or sessionStorage (session-only) and
 * attaches it to all subsequent API requests via the Authorization header.
 */
import { ref, computed, readonly } from 'vue'
import { useRouter } from 'vue-router'
import { apiPost, apiGet } from '@/services/api'
import { ApiRequestError } from '@/types/api'
import { useSettings } from '@/composables/useSettings'
import type {
  LoginInput,
  RegisterInput,
  LoginResponse,
  RegisterResponse,
  UserInfo,
} from '@/types/auth'

// ── Reactive singleton state ──
const currentUser = ref<UserInfo | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

const TOKEN_KEY = 'auth_token'
const CSRF_KEY = 'csrf_token'
const USER_CACHE_KEY = 'auth_user_cache'

/** Which storage to use — set on login, used by getters. */
let _useLocalStorage = true

/** Resolve the correct Storage based on the remember-me flag. */
function storage(): Storage {
  return _useLocalStorage ? localStorage : sessionStorage
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY) ?? null
}

function getStoredCsrf(): string | null {
  return localStorage.getItem(CSRF_KEY) ?? sessionStorage.getItem(CSRF_KEY) ?? null
}

function removeFromBothStorages(key: string): void {
  localStorage.removeItem(key)
  sessionStorage.removeItem(key)
}

/** Load cached user from localStorage (survives page refresh). */
function loadCachedUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as UserInfo) : null
  } catch {
    return null
  }
}

/** Save user data to localStorage cache (called on login/register success). */
function saveCachedUser(user: UserInfo): void {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
}

/** Remove cached user data (called on logout). */
function clearCachedUser(): void {
  localStorage.removeItem(USER_CACHE_KEY)
}

export function useAuth() {
  const router = useRouter()

  const isAuthenticated = computed(() => currentUser.value !== null)
  const user = computed(() => currentUser.value)
  const authToken = computed(() => getStoredToken())
  const authError = computed(() => error.value)

  /** Set session data in the appropriate storage only. */
  function setSession(token: string, csrfToken: string, rememberMe: boolean): void {
    _useLocalStorage = rememberMe
    // Clear both storages first to prevent stale tokens
    removeFromBothStorages(TOKEN_KEY)
    removeFromBothStorages(CSRF_KEY)
    // Write only to the chosen storage
    const s = storage()
    s.setItem(TOKEN_KEY, token)
    s.setItem(CSRF_KEY, csrfToken)
  }

  /** Clear session data + cached user from both storages. */
  function clearSession(): void {
    removeFromBothStorages(TOKEN_KEY)
    removeFromBothStorages(CSRF_KEY)
    clearCachedUser()
    currentUser.value = null
  }

  /** Build headers with auth token for API calls. */
  function authHeaders(): Record<string, string> | undefined {
    const token = getStoredToken()
    if (!token) return undefined
    return {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': getStoredCsrf() ?? '',
    }
  }

  /**
   * Login with email + password.
   * On success, stores the session token + cached user and sets the current user.
   */
  async function login(input: LoginInput): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const result = await apiPost<LoginResponse>('/api/auth/login', input)
      setSession(result.session.token, result.session.csrf_token, input.rememberMe ?? true)
      saveCachedUser(result.user)
      currentUser.value = result.user
      // Reset settings cache so admin pages fetch fresh data for this user
      const { resetState } = useSettings()
      resetState()
      await router.push('/admin/analytics/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      error.value = message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Register a new user + company.
   * On success, auto-login by storing session and set current user.
   * Returns the secret_link so the page can show it in a popup.
   */
  async function register(input: RegisterInput): Promise<string> {
    isLoading.value = true
    error.value = null

    try {
      const result = await apiPost<RegisterResponse>('/api/auth/register', input)
      // Registration returns user info + session (auto-login)
      setSession(result.session.token, result.session.csrf_token, true)
      const regUser: UserInfo = {
        id: result.id,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name,
        phone: result.phone,
        locale: result.locale,
        role: result.role,
        tenant_id: result.tenant_id,
        is_active: result.is_active,
      }
      saveCachedUser(regUser)
      currentUser.value = regUser
      // Reset settings cache so admin pages fetch fresh data for this new user
      const { resetState } = useSettings()
      resetState()
      return result.secret_link
    } catch (err: unknown) {
      // Pass through ApiRequestError as-is so the UI gets fieldErrors
      if (err instanceof ApiRequestError) {
        error.value = err.message
        throw err
      }
      const message = err instanceof Error ? err.message : 'Registration failed'
      error.value = message
      throw err instanceof Error ? err : new Error(String(err))
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch the current user profile (GET /api/auth/me).
   * Used to validate an existing session on app startup.
   *
   * - On success: updates cache + current user
   * - On 401 (Unauthorized): token is invalid/expired → clear session
   * - On other errors (network, 5xx): keep cached user, don't force logout
   */
  async function fetchMe(): Promise<void> {
    const token = getStoredToken()
    if (!token) {
      currentUser.value = null
      return
    }

    // Pre-fill from cache for instant display
    currentUser.value = loadCachedUser()

    isLoading.value = true
    try {
      const result = await apiGet<UserInfo>('/api/auth/me', undefined, {
        headers: authHeaders(),
      })
      saveCachedUser(result)
      currentUser.value = result
    } catch (err: unknown) {
      // 401/404 = token invalid or user not found → clear session
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 404)) {
        clearSession()
      }
      // Other errors (network, 5xx) → keep cached user, don't force logout
    } finally {
      isLoading.value = false
    }
  }

  /** Logout — clear session and redirect to the given path.
   *
   * In real mode (VITE_USE_MOCKS = false), calls POST /api/auth/logout
   * before clearing the session. In mock mode, just redirects without
   * clearing anything (so the admin stays accessible without login).
   * Default redirect is to `/` (public landing page). */
  async function logout(redirectTo = '/'): Promise<void> {
    const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

    if (USE_MOCKS) {
      // Mock mode: just redirect, don't clear session
      await router.push(redirectTo)
      return
    }

    try {
      await apiPost('/api/auth/logout', {}, { headers: authHeaders() })
    } catch {
      // Silently ignore — session will be cleared locally anyway
    }

    clearSession()
    await router.push(redirectTo)
  }

  return {
    // State (readonly to prevent direct mutation)
    user: readonly(user),
    isAuthenticated: readonly(isAuthenticated),
    authToken: readonly(authToken),
    isLoading: readonly(isLoading),
    authError: readonly(authError),

    // Actions
    login,
    register,
    fetchMe,
    logout,
    authHeaders,
    clearSession,
    setSession,
  }
}
