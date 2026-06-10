import { ref, reactive } from 'vue'
import { getSettings } from '@/services/settingsService'
import * as settingsService from '@/services/settingsService'
import type {
  AppSettings,
  CompanyInfo,
  GlobalConstants,
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
  profile: { firstName: '', lastName: '', email: '', phone: '', role: 'admin' },
}

// ─── localStorage cache helpers ──────────────────────────────────────────
const CACHE_KEY = 'flexiron_settings_cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface SettingsCache {
  data: AppSettings
  timestamp: number
}

function loadFromCache(): AppSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache: SettingsCache = JSON.parse(raw)
    const age = Date.now() - cache.timestamp
    if (age >= CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cache.data
  } catch {
    return null
  }
}

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
let loaded = false
/** Snapshot captured after last load/save, used for dirty diffing */
let snapshot: AppSettings | null = null

/** Sections that have been modified since last snapshot */
const dirtySections = reactive(new Set<string>())

function markDirty(section: string) {
  dirtySections.add(section)
}

function clearDirty() {
  dirtySections.clear()
}

function takeSnapshot() {
  snapshot = JSON.parse(JSON.stringify(settings)) as AppSettings
}

/** Deep-diff a simple (non-array) section */
function sectionChanged(key: keyof AppSettings): boolean {
  if (!snapshot) return false
  return JSON.stringify((settings as any)[key]) !== JSON.stringify((snapshot as any)[key])
}

/** Detect added items in a collection (in current but not in original) */
function findAdded<T extends { id: string }>(
  original: T[] | undefined,
  current: T[],
): Omit<T, 'id'>[] {
  if (!original) return current.map(({ id, ...rest }) => rest as unknown as Omit<T, 'id'>)
  return current
    .filter((c) => !original.find((o) => o.id === c.id))
    .map(({ id, ...rest }) => rest as unknown as Omit<T, 'id'>)
}

/** Detect removed items (in original but not in current) */
function findRemoved<T extends { id: string }>(
  original: T[] | undefined,
  current: T[],
): string[] {
  if (!original) return []
  return original
    .filter((o) => !current.find((c) => c.id === o.id))
    .map((o) => o.id)
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
        (diff as any)[key] = cur[key]
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
    if (loaded) return // already fetched in this session

    // 1) Try localStorage cache first
    const cached = loadFromCache()
    if (cached) {
      Object.assign(settings, cached)
      loaded = true
      takeSnapshot()
      return
    }

    // 2) Cache miss or expired — fetch from API
    loading.value = true
    error.value = null
    try {
      const data = await getSettings()
      Object.assign(settings, data)
      saveToCache(data)
      loaded = true
      takeSnapshot()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
    } finally {
      loading.value = false
    }
  }

  /** Force re-fetch from API (skip cache) */
  async function reload() {
    loaded = false
    loading.value = true
    error.value = null
    try {
      const data = await getSettings()
      Object.assign(settings, data)
      saveToCache(data)
      loaded = true
      takeSnapshot()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
    } finally {
      loading.value = false
    }
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
          ? settings.currencies.filter((c) => !snapshot.currencies.find((o) => o.id === c.id))
          : [...settings.currencies]
        const addedData = localAdded.map(({ id, ...rest }) => rest)

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
          ? settings.uoms.filter((u) => !snapshot.uoms.find((o) => o.id === u.id))
          : [...settings.uoms]
        const addedData = localAdded.map(({ id, ...rest }) => rest)

        for (const item of addedData) {
          const p = settingsService.createUom(item).then((created) => {
            const local = settings.uoms.find((u) => u.category === item.category && u.code === item.code)
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
          ? settings.conversions.filter((c) => !snapshot.conversions.find((o) => o.id === c.id))
          : [...settings.conversions]
        const addedData = localAdded.map(({ id, ...rest }) => rest)

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
          ? settings.orderStatuses.filter((s) => !snapshot.orderStatuses.find((o) => o.id === s.id))
          : [...settings.orderStatuses]
        const addedData = localAdded.map(({ id, ...rest }) => rest)
        // Also check if order changed
        const orderChanged = snapshot?.orderStatuses?.some(
          (o, i) => o.id !== settings.orderStatuses[i]?.id || o.order !== settings.orderStatuses[i]?.order,
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
              ? settings.orderStatuses.find((s) => !snapshot!.orderStatuses.find((o) => o.id === s.id))
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

  // ─── Company ───
  function updateCompany(patch: Partial<AppSettings['company']>) {
    Object.assign(settings.company, patch)
    markDirty('company')
  }

  // ─── Constants ───
  function updateConstants(patch: Partial<AppSettings['constants']>) {
    Object.assign(settings.constants, patch)
    markDirty('constants')
  }

  // ─── Currencies ───
  function addCurrency(currency: Currency) {
    settings.currencies.push(currency)
    markDirty('currencies')
  }
  function removeCurrency(id: string) {
    const idx = settings.currencies.findIndex((c) => c.id === id)
    if (idx !== -1) settings.currencies.splice(idx, 1)
    markDirty('currencies')
  }
  function updateCurrency(id: string, patch: Partial<Currency>) {
    const cur = settings.currencies.find((c) => c.id === id)
    if (cur) Object.assign(cur, patch)
    markDirty('currencies')
  }

  // ─── UOM ───
  function addUom(uom: Uom) {
    settings.uoms.push(uom)
    markDirty('uoms')
  }
  function removeUom(id: string) {
    const idx = settings.uoms.findIndex((u) => u.id === id)
    if (idx !== -1) settings.uoms.splice(idx, 1)
    markDirty('uoms')
  }

  // ─── UOM Conversions ───
  function addConversion(conv: UomConversion) {
    settings.conversions.push(conv)
    markDirty('conversions')
  }
  function removeConversion(id: string) {
    const idx = settings.conversions.findIndex((c) => c.id === id)
    if (idx !== -1) settings.conversions.splice(idx, 1)
    markDirty('conversions')
  }
  function updateConversion(id: string, patch: Partial<UomConversion>) {
    const conv = settings.conversions.find((c) => c.id === id)
    if (conv) Object.assign(conv, patch)
    markDirty('conversions')
  }

  // ─── Order Statuses ───
  function addOrderStatus(status: OrderStatusSetting) {
    settings.orderStatuses.push(status)
    markDirty('orderStatuses')
  }
  function removeOrderStatus(id: string) {
    const idx = settings.orderStatuses.findIndex((s) => s.id === id)
    if (idx !== -1) settings.orderStatuses.splice(idx, 1)
    markDirty('orderStatuses')
  }
  function updateOrderStatus(id: string, patch: Partial<OrderStatusSetting>) {
    const st = settings.orderStatuses.find((s) => s.id === id)
    if (st) Object.assign(st, patch)
    markDirty('orderStatuses')
  }
  function moveOrderStatus(fromIdx: number, toIdx: number) {
    const arr = settings.orderStatuses
    const moved = arr.splice(fromIdx, 1)[0]
    if (!moved) return
    arr.splice(toIdx, 0, moved)
    arr.forEach((s, i) => (s.order = i))
    markDirty('orderStatuses')
  }

  // ─── Profile ───
  function updateProfile(patch: Partial<UserProfile>) {
    Object.assign(settings.profile, patch)
    markDirty('profile')
  }

  /** Check if any settings have been modified since last load/save */
  const isDirty = ref(false)
  function updateIsDirty() {
    isDirty.value = dirtySections.size > 0
  }
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
  const _addCurrency = (currency: Currency) => {
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
  const _addUom = (uom: Uom) => {
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
  const _addConversion = (conv: UomConversion) => {
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
  const _addOrderStatus = (status: OrderStatusSetting) => {
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
