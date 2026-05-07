import { ref, watchEffect, toRaw, type Ref } from 'vue'

/**
 * Walk every leaf of a reactive proxy through the proxy itself, so that Vue's
 * dependency-tracking system registers all deep properties as dependencies.
 *
 * Must be called INSIDE a watchEffect / computed / watch getter BEFORE any
 * toRaw() call, because toRaw() returns the plain object and Vue would lose
 * track of deep reactive dependencies.
 */
function deepTouch(obj: unknown): void {
  if (typeof obj !== 'object' || obj === null) return
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) deepTouch(obj[i])
  } else {
    const keys = Object.keys(obj as Record<string, unknown>)
    for (const key of keys) {
      const val = (obj as Record<string, unknown>)[key]
      if (val && typeof val === 'object') deepTouch(val)
    }
  }
}

export function useDirtyCheck<T>(source: Ref<T>) {
  const isDirty = ref(false)
  let snapshot = JSON.stringify(toRaw(source.value))
  let snapshotObj: unknown = safeParse(snapshot)

  function capture() {
    snapshot = JSON.stringify(toRaw(source.value))
    snapshotObj = safeParse(snapshot)
    isDirty.value = false
  }

  // Use watchEffect instead of watch with deep: true.
  // Vue 3's watch with deep: true internally uses structuredClone on the reactive proxy,
  // which fails when a property's type changes (e.g. null → { ru, en, lt }).
  // watchEffect does NOT clone the proxy — it simply re-runs the effect whenever
  // any tracked reactive dependency changes.
  //
  // deepTouch(source.value) is called BEFORE toRaw() to explicitly traverse all
  // deep properties through the reactive proxy, ensuring Vue tracks every nested
  // property as a dependency. Without this, toRaw() returns the plain object and
  // Vue loses deep reactivity tracking — changes to nested properties (e.g.
  // form.value.name.ru) would not trigger the effect.
  watchEffect(() => {
    deepTouch(source.value)
    isDirty.value = JSON.stringify(toRaw(source.value)) !== snapshot
  })

  /**
   * Shallow diff for object payloads: returns only top-level keys whose serialized value
   * differs from the captured snapshot. Deep-nested structure (arrays, nested objects)
   * is emitted as a whole value when any leaf changes — which is the right thing for
   * merge-patch semantics with fileIds[], categories[], etc.
   *
   * IMPORTANT: Uses toRaw() on each value to strip Vue reactive proxies before returning.
   * Without this, the returned Partial<T> would contain reactive proxies, which later
   * cause "Failed to execute 'structuredClone'" errors when passed to mock functions
   * that use structuredClone internally.
   */
  function diff(): Partial<T> {
    const current = source.value
    if (!isPlainObject(current) || !isPlainObject(snapshotObj)) {
      // Non-object payloads — return full value on any change
      return isDirty.value ? (toRaw(current) as Partial<T>) : ({} as Partial<T>)
    }
    const result: Record<string, unknown> = {}
    const currentObj = current as Record<string, unknown>
    const snapObj = snapshotObj as Record<string, unknown>
    for (const key of Object.keys(currentObj)) {
      if (JSON.stringify(currentObj[key]) !== JSON.stringify(snapObj[key])) {
        result[key] = toRaw(currentObj[key])
      }
    }
    return result as Partial<T>
  }

  function reset() {
    capture()
  }

  return { isDirty, capture, reset, diff }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
