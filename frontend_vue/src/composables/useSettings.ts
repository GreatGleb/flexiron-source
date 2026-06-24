import { ref, reactive } from 'vue'
import * as settingsService from '@/services/settingsService'
import type {
  AppSettings,
  Currency,
  Uom,
  UomConversion,
  OrderStatusSetting,
  UserProfile,
} from '@/types/settings'

const defaultSettings: AppSettings = {
  company: { name: '', legalAddress: '', vatCode: '', bankName: '', bankAccount: '' },
  constants: { vatRate: 21, defaultMargin: 15, defaultCurrency: 'EUR', defaultDiscountPercent: 0 },
  currencies: [],
  uoms: [],
  conversions: [],
  orderStatuses: [],
  sectors: [],
  users: [],
  profile: { firstName: '', lastName: '', email: '', phone: '', role: 'owner' },
}

// ─── localStorage cache helpers ──────────────────────────────────────────
const CACHE_VERSION = 3 // bump when data shape changes (e.g., new fields)
const CACHE_KEY = `flexiron_settings_cache_v${CACHE_VERSION}`
const LEGACY_CACHE_KEYS = ['flexiron_settings_cache', 'flexiron_settings_cache_v2'] // old keys to purge
// const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface SettingsCache {
  data: AppSettings
  timestamp: number
}

// function loadFromCache(): AppSettings | null {
//   try {
//     const raw = localStorage.getItem(CACHE_KEY)
//     if (!raw) return null
//     const cache: SettingsCache = JSON.parse(raw)
//     const age = Date.now() - cache.timestamp
//     if (age >= CACHE_TTL_MS) {
//       localStorage.removeItem(CACHE_KEY)
//       return null
//     }
//     return cache.data
//   } catch {
//     return null
//   }
// }

function saveToCache(data: AppSettings) {
  try {
    const cache: SettingsCache = { data, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // storage full or unavailable — ignore
  }
}

// ─── Module-level singleton state ────────────────────────────────────────
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const settings = reactive<AppSettings>({ ...defaultSettings })
/** Snapshot captured after last load/save, used for dirty diffing */
let snapshot: AppSettings | null = null

/** Sections that have been modified since last snapshot */
const dirtySections = reactive(new Set<string>())

function markDirty(section: string) {
  dirtySections.add(section)
}

// function clearDirty() {
//   dirtySections.clear()
// }

function takeSnapshot() {
  snapshot = JSON.parse(JSON.stringify(settings)) as AppSettings
}

/** Deep-diff a simple (non-array) section */
function sectionChanged(key: keyof AppSettings): boolean {
  if (!snapshot) return false
  return JSON.stringify(settings[key]) !== JSON.stringify(snapshot[key])
}

/** Detect added items in a collection (in current but not in original) */
// function findAdded<T extends { id: string }>(
//   original: T[] | undefined,
//   current: T[],
// ): Omit<T, 'id'>[] {
//   if (!original) return current.map(({ id, ...rest }) => rest as unknown as Omit<T, 'id'>)
//   return current
//     .filter((c) => !original.find((o) => o.id === c.id))
//     .map(({ id, ...rest }) => rest as unknown as Omit<T, 'id'>)
// }

/** Detect removed items (in original but not in current) */
function findRemoved<T extends { id: string }>(original: T[] | undefined, current: T[]): string[] {
  if (!original) return []
  return original.filter((o) => !current.find((c) => c.id === o.id)).map((o) => o.id)
}

/** Detect updated items (in both sets, but data differs) */
function findUpdated<T extends { id: string }>(
  original: T[] | undefined,
  current: T[],
): { id: string; data: Partial<T> }[] {
  if (!original) return []
  const result: { id: string; data: Partial<T> }[] = []
  for (const cur of current) {
    const orig = original.find((o) => o.id === cur.id)
    if (!orig) continue
    // Compare each key except id
    const diff: Record<string, unknown> = {}
    for (const key of Object.keys(cur) as (keyof T)[]) {
      if (key === 'id') continue
      if (JSON.stringify(cur[key]) !== JSON.stringify(orig[key])) {
        diff[key as string] = cur[key] as unknown
      }
    }
    if (Object.keys(diff).length > 0) {
      result.push({ id: cur.id, data: diff as Partial<T> })
    }
  }
  return result
}

export function useSettings() {
  async function load() {
    console.log('[useSettings] load() called — always fetching from API')
    console.log('[useSettings] USE_MOCKS =', import.meta.env.VITE_USE_MOCKS)

    // Always purge localStorage cache to avoid stale data
    const allCacheKeys = [CACHE_KEY, ...LEGACY_CACHE_KEYS]
    for (const key of allCacheKeys) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }

    // Fetch from API in parallel
    // Use allSettled so one failing endpoint doesn't block the rest.
    loading.value = true
    error.value = null

    const allResults = await Promise.allSettled([
      settingsService.getCompany(),
      settingsService.getConstants(),
      settingsService.getCurrencies(),
      settingsService.getUoms(),
      settingsService.getConversions(),
      settingsService.getOrderStatuses(),
      settingsService.getProfile(),
    ])

    const labels: (keyof AppSettings)[] = [
      'company',
      'constants',
      'currencies',
      'uoms',
      'conversions',
      'orderStatuses',
      'profile',
    ]
    let anySuccess = false

    allResults.forEach((result, i) => {
      const key = labels[i]!
      if (result.status === 'fulfilled') {
        ;(settings as Record<string, unknown>)[key] = (
          result as PromiseFulfilledResult<unknown>
        ).value
        anySuccess = true
        console.log(`[useSettings] "${key}" loaded successfully`)
      } else {
        console.warn(`[useSettings] Failed to load "${key as string}"`)
      }
    })

    if (!anySuccess) {
      // All requests failed — don't cache
      error.value = 'Failed to load settings. Backend may be unavailable.'
      loading.value = false
      return
    }

    const data = { ...settings } as AppSettings
    saveToCache(data)
    takeSnapshot()
    loading.value = false
  }

  /** Force re-fetch from API (same as load() but with different error reporting) */
  async function reload() {
    console.log('[useSettings] reload() called — forcing API fetch')
    // Purge localStorage cache
    const allCacheKeys = [CACHE_KEY, ...LEGACY_CACHE_KEYS]
    for (const key of allCacheKeys) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }

    loading.value = true
    error.value = null

    const allResults = await Promise.allSettled([
      settingsService.getCompany(),
      settingsService.getConstants(),
      settingsService.getCurrencies(),
      settingsService.getUoms(),
      settingsService.getConversions(),
      settingsService.getOrderStatuses(),
      settingsService.getProfile(),
    ])

    const labels: (keyof AppSettings)[] = [
      'company',
      'constants',
      'currencies',
      'uoms',
      'conversions',
      'orderStatuses',
      'profile',
    ]
    const failed: string[] = []

    allResults.forEach((result, i) => {
      const key = labels[i]!
      if (result.status === 'fulfilled') {
        ;(settings as Record<string, unknown>)[key] = (
          result as PromiseFulfilledResult<unknown>
        ).value
      } else {
        failed.push(key as string)
        console.warn(`[useSettings] Failed to reload "${key as string}"`)
      }
    })

    if (failed.length > 0) {
      error.value = `Failed to load: ${failed.join(', ')}. Some settings may be unavailable.`
    }

    const data = { ...settings } as AppSettings
    saveToCache(data)
    takeSnapshot()
    loading.value = false
  }

  /**
   * Save only the sections that have been modified.
   * For simple sections (company, constants, profile) → PUT full section data.
   * For collection sections → diff against snapshot and POST/PATCH/DELETE individual items.
   */
  async function save() {
    saving.value = true
    error.value = null
    const promises: Promise<unknown>[] = []

    try {
      // ── Company ──
      if (dirtySections.has('company') || sectionChanged('company')) {
        promises.push(settingsService.saveCompany({ ...settings.company }))
        dirtySections.delete('company')
      }

      // ── Constants ──
      if (dirtySections.has('constants') || sectionChanged('constants')) {
        promises.push(settingsService.saveConstants({ ...settings.constants }))
        dirtySections.delete('constants')
      }

      // ── Currencies ──
      if (dirtySections.has('currencies') || sectionChanged('currencies')) {
        const removed = findRemoved(snapshot?.currencies, settings.currencies)
        const updated = findUpdated(snapshot?.currencies, settings.currencies)
        // For added items, keep a reference to local items so we can replace IDs
        const localAdded = snapshot
          ? settings.currencies.filter((c) => !snapshot!.currencies.find((o) => o.id === c.id))
          : [...settings.currencies]
        const addedData = localAdded.map(({ id: _id, ...rest }) => rest)

        for (const item of addedData) {
          const p = settingsService.createCurrency(item).then((created) => {
            // Replace the client-generated temp ID with the server-assigned one
            const local = settings.currencies.find((c) => c.code === item.code)
            if (local && created?.id) {
              // Use defineProperty to change id on the reactive object
              const idx = settings.currencies.indexOf(local)
              if (idx !== -1) {
                settings.currencies.splice(idx, 1, created as Currency)
              }
            }
          })
          promises.push(p)
        }
        for (const id of removed) {
          promises.push(settingsService.deleteCurrency(id))
        }
        for (const { id, data } of updated) {
          promises.push(settingsService.updateCurrency(id, data))
        }
        dirtySections.delete('currencies')
      }

      // ── UOMs ──
      if (dirtySections.has('uoms') || sectionChanged('uoms')) {
        const removed = findRemoved(snapshot?.uoms, settings.uoms)
        const localAdded = snapshot
          ? settings.uoms.filter((u) => !snapshot!.uoms.find((o) => o.id === u.id))
          : [...settings.uoms]
        const addedData = localAdded.map(({ id: _id, ...rest }) => rest)

        for (const item of addedData) {
          const p = settingsService.createUom(item).then((created) => {
            const local = settings.uoms.find(
              (u) => u.category === item.category && u.code === item.code,
            )
            if (local && created?.id) {
              const idx = settings.uoms.indexOf(local)
              if (idx !== -1) settings.uoms.splice(idx, 1, created as Uom)
            }
          })
          promises.push(p)
        }
        for (const id of removed) {
          promises.push(settingsService.deleteUom(id))
        }
        dirtySections.delete('uoms')
      }

      // ── Conversions ──
      if (dirtySections.has('conversions') || sectionChanged('conversions')) {
        const removed = findRemoved(snapshot?.conversions, settings.conversions)
        const updated = findUpdated(snapshot?.conversions, settings.conversions)
        const localAdded = snapshot
          ? settings.conversions.filter((c) => !snapshot!.conversions.find((o) => o.id === c.id))
          : [...settings.conversions]
        const addedData = localAdded.map(({ id: _id, ...rest }) => rest)

        for (const item of addedData) {
          const p = settingsService.createConversion(item).then((created) => {
            // Match by fromUomId+toUomId (most reliable for conversions)
            const local = settings.conversions.find(
              (c) => c.fromUomId === item.fromUomId && c.toUomId === item.toUomId,
            )
            if (local && created?.id) {
              const idx = settings.conversions.indexOf(local)
              if (idx !== -1) settings.conversions.splice(idx, 1, created as UomConversion)
            }
          })
          promises.push(p)
        }
        for (const id of removed) {
          promises.push(settingsService.deleteConversion(id))
        }
        for (const { id, data } of updated) {
          promises.push(settingsService.updateConversion(id, data))
        }
        dirtySections.delete('conversions')
      }

      // ── Order Statuses ──
      if (dirtySections.has('orderStatuses') || sectionChanged('orderStatuses')) {
        const removed = findRemoved(snapshot?.orderStatuses, settings.orderStatuses)
        const updated = findUpdated(snapshot?.orderStatuses, settings.orderStatuses)
        const localAdded = snapshot
          ? settings.orderStatuses.filter(
              (s) => !snapshot!.orderStatuses.find((o) => o.id === s.id),
            )
          : [...settings.orderStatuses]
        const addedData = localAdded.map(({ id: _id, ...rest }) => rest)
        // Also check if order changed
        const orderChanged = snapshot?.orderStatuses?.some(
          (o, i) =>
            o.id !== settings.orderStatuses[i]?.id || o.order !== settings.orderStatuses[i]?.order,
        )

        if (removed.length > 0 || orderChanged) {
          // If items were added/removed/reordered, send the full reorder list
          const orderedIds = settings.orderStatuses.map((s) => s.id)
          promises.push(settingsService.moveOrderStatus(orderedIds))
        }

        for (const item of addedData) {
          const p = settingsService.createOrderStatus(item).then((created) => {
            // Match by order (most recently added has highest order)
            const local = snapshot
              ? settings.orderStatuses.find(
                  (s) => !snapshot!.orderStatuses.find((o) => o.id === s.id),
                )
              : null
            if (local && created?.id) {
              const idx = settings.orderStatuses.indexOf(local)
              if (idx !== -1) settings.orderStatuses.splice(idx, 1, created as OrderStatusSetting)
            }
          })
          promises.push(p)
        }
        for (const id of removed) {
          promises.push(settingsService.deleteOrderStatus(id))
        }
        for (const { id, data } of updated) {
          promises.push(settingsService.updateOrderStatus(id, data))
        }
        dirtySections.delete('orderStatuses')
      }

      // ── Profile ──
      if (dirtySections.has('profile') || sectionChanged('profile')) {
        promises.push(settingsService.saveProfile({ ...settings.profile }))
        dirtySections.delete('profile')
      }

      await Promise.all(promises)
      saveToCache({ ...settings })
      takeSnapshot()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save settings'
    } finally {
      saving.value = false
    }
  }

  /** Check if any settings have been modified since last load/save */
  const isDirty = ref(false)
  // Patch each mutation to also update isDirty
  const _updateCompany = (patch: Partial<AppSettings['company']>) => {
    Object.assign(settings.company, patch)
    markDirty('company')
    isDirty.value = true
  }
  const _updateConstants = (patch: Partial<AppSettings['constants']>) => {
    Object.assign(settings.constants, patch)
    markDirty('constants')
    isDirty.value = true
  }
  const _addCurrency = (data: Omit<Currency, 'id'>) => {
    const currency: Currency = { ...data, id: `cur-temp-${Date.now()}` }
    settings.currencies.push(currency)
    markDirty('currencies')
    isDirty.value = true
  }
  const _removeCurrency = (id: string) => {
    const idx = settings.currencies.findIndex((c) => c.id === id)
    if (idx !== -1) settings.currencies.splice(idx, 1)
    markDirty('currencies')
    isDirty.value = true
  }
  const _updateCurrency = (id: string, patch: Partial<Currency>) => {
    const cur = settings.currencies.find((c) => c.id === id)
    if (cur) Object.assign(cur, patch)
    markDirty('currencies')
    isDirty.value = true
  }
  const _addUom = (data: Omit<Uom, 'id'>) => {
    const uom: Uom = { ...data, id: `uom-temp-${Date.now()}` }
    settings.uoms.push(uom)
    markDirty('uoms')
    isDirty.value = true
  }
  const _removeUom = (id: string) => {
    const idx = settings.uoms.findIndex((u) => u.id === id)
    if (idx !== -1) settings.uoms.splice(idx, 1)
    markDirty('uoms')
    isDirty.value = true
  }
  const _addConversion = (data: Omit<UomConversion, 'id'>) => {
    const conv: UomConversion = { ...data, id: `conv-temp-${Date.now()}` }
    settings.conversions.push(conv)
    markDirty('conversions')
    isDirty.value = true
  }
  const _removeConversion = (id: string) => {
    const idx = settings.conversions.findIndex((c) => c.id === id)
    if (idx !== -1) settings.conversions.splice(idx, 1)
    markDirty('conversions')
    isDirty.value = true
  }
  const _updateConversion = (id: string, patch: Partial<UomConversion>) => {
    const conv = settings.conversions.find((c) => c.id === id)
    if (conv) Object.assign(conv, patch)
    markDirty('conversions')
    isDirty.value = true
  }
  const _addOrderStatus = (data: Omit<OrderStatusSetting, 'id'>) => {
    const status: OrderStatusSetting = { ...data, id: `st-temp-${Date.now()}` }
    settings.orderStatuses.push(status)
    markDirty('orderStatuses')
    isDirty.value = true
  }
  const _removeOrderStatus = (id: string) => {
    const idx = settings.orderStatuses.findIndex((s) => s.id === id)
    if (idx !== -1) settings.orderStatuses.splice(idx, 1)
    markDirty('orderStatuses')
    isDirty.value = true
  }
  const _updateOrderStatus = (id: string, patch: Partial<OrderStatusSetting>) => {
    const st = settings.orderStatuses.find((s) => s.id === id)
    if (st) Object.assign(st, patch)
    markDirty('orderStatuses')
    isDirty.value = true
  }
  const _moveOrderStatus = (fromIdx: number, toIdx: number) => {
    const arr = settings.orderStatuses
    const moved = arr.splice(fromIdx, 1)[0]
    if (!moved) return
    arr.splice(toIdx, 0, moved)
    arr.forEach((s, i) => (s.order = i))
    markDirty('orderStatuses')
    isDirty.value = true
  }
  const _updateProfile = (patch: Partial<UserProfile>) => {
    Object.assign(settings.profile, patch)
    markDirty('profile')
    isDirty.value = true
  }

  /** Discard all changes — reset to the last snapshot */
  function discard() {
    if (snapshot) {
      Object.assign(settings, JSON.parse(JSON.stringify(snapshot)))
      dirtySections.clear()
      isDirty.value = false
    }
  }

  // Patch save to reset dirty state
  const _origSave = save
  async function _save() {
    await _origSave()
    isDirty.value = false
  }

  /**
   * Reset all settings state to defaults and clear all caches.
   * Use this after auth state changes (register/login/logout) to force
   * fresh API calls on the next load().
   */
  function resetState() {
    console.log('[useSettings] resetState() — clearing all cached data')
    // Reset reactive settings to defaults
    Object.assign(settings, JSON.parse(JSON.stringify(defaultSettings)))
    // Clear all localStorage caches
    const allCacheKeys = [CACHE_KEY, ...LEGACY_CACHE_KEYS]
    for (const key of allCacheKeys) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    }
    // Reset state flags
    loading.value = false
    saving.value = false
    error.value = null
    snapshot = null
    dirtySections.clear()
    isDirty.value = false
  }

  return {
    settings,
    loading,
    saving,
    error,
    isDirty,
    load,
    reload,
    save: _save,
    discard,
    resetState,
    updateCompany: _updateCompany,
    updateConstants: _updateConstants,
    addCurrency: _addCurrency,
    removeCurrency: _removeCurrency,
    updateCurrency: _updateCurrency,
    addUom: _addUom,
    removeUom: _removeUom,
    addConversion: _addConversion,
    removeConversion: _removeConversion,
    updateConversion: _updateConversion,
    addOrderStatus: _addOrderStatus,
    removeOrderStatus: _removeOrderStatus,
    updateOrderStatus: _updateOrderStatus,
    moveOrderStatus: _moveOrderStatus,
    updateProfile: _updateProfile,
  }
}
