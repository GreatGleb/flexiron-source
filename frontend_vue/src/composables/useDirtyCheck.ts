import { ref, watch, type Ref } from 'vue'

export function useDirtyCheck<T>(source: Ref<T>) {
  const isDirty = ref(false)
  let snapshot = JSON.stringify(source.value)
  let snapshotObj: unknown = safeParse(snapshot)

  function capture() {
    snapshot = JSON.stringify(source.value)
    snapshotObj = safeParse(snapshot)
    isDirty.value = false
  }

  watch(
    source,
    (val) => {
      isDirty.value = JSON.stringify(val) !== snapshot
    },
    { deep: true },
  )

  /**
   * Shallow diff for object payloads: returns only top-level keys whose serialized value
   * differs from the captured snapshot. Deep-nested structure (arrays, nested objects)
   * is emitted as a whole value when any leaf changes — which is the right thing for
   * merge-patch semantics with fileIds[], categories[], etc.
   */
  function diff(): Partial<T> {
    const current = source.value
    if (!isPlainObject(current) || !isPlainObject(snapshotObj)) {
      // Non-object payloads — return full value on any change
      return isDirty.value ? (current as Partial<T>) : ({} as Partial<T>)
    }
    const result: Record<string, unknown> = {}
    const currentObj = current as Record<string, unknown>
    const snapObj = snapshotObj as Record<string, unknown>
    for (const key of Object.keys(currentObj)) {
      if (JSON.stringify(currentObj[key]) !== JSON.stringify(snapObj[key])) {
        result[key] = currentObj[key]
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
