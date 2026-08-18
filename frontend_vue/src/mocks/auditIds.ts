import type { StockAuditEntry, StockAuditSeed } from '@/types/warehouse'

/**
 * An entity as written in a mock seed file: its audit entries carry no id.
 *
 * The seeds are data, not records — the id is what the API addresses a record
 * by, and it is assigned when the store is built, once, in one place. A real
 * backend does the same thing with a generated column; hand-typing 294 ids
 * would be 294 chances to repeat one.
 */
export type AuditSeeded<T> = Omit<T, 'auditLog'> & { auditLog?: StockAuditSeed[] }

/**
 * Gives every seeded entry the id its entity's log addresses it by, and hands
 * back the same array as the real type.
 *
 * The id is unique inside ONE entity's log, not across the system: a record is
 * reached through its entity (`/api/<entity>/:id/audit/:entryId`), exactly as an
 * order line is. `prefix` says which kind of log it belongs to, so a row in the
 * merged audit feed can be read on sight — `bch-au-2` is a batch's second entry.
 *
 * The cast is the whole point of the function and the only one in the chain:
 * what comes in lacks ids, what goes out has them.
 */
export function sealAuditIds<T extends { auditLog?: StockAuditEntry[] }>(
  seeds: AuditSeeded<T>[],
  prefix: string,
): T[] {
  for (const entity of seeds) {
    assignAuditIds(entity.auditLog, prefix)
  }
  return seeds as unknown as T[]
}

/**
 * The same for one log — for stores that are not an array of entities, and for
 * a log that arrives on its own.
 */
export function assignAuditIds(
  log: StockAuditSeed[] | StockAuditEntry[] | undefined | null,
  prefix: string,
): StockAuditEntry[] {
  if (!log) return []
  log.forEach((entry, i) => {
    const record = entry as StockAuditEntry
    // Never overwrite: an entry that already knows its id keeps it, or a reload
    // would re-point every row a user is looking at.
    if (!record.id) record.id = `${prefix}-au-${i + 1}`
  })
  return log as StockAuditEntry[]
}

/** The next free id in a log — for entries added after the seed. */
export function nextAuditId(log: StockAuditEntry[], prefix: string): string {
  let max = 0
  for (const entry of log) {
    const match = entry.id?.match(/-au-(\d+)$/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `${prefix}-au-${max + 1}`
}

/** The same for a store keyed by entity id rather than an array. */
export function sealAuditIdsMap<T extends { auditLog?: StockAuditEntry[] }>(
  seeds: Record<string, AuditSeeded<T>>,
  prefix: string,
): Record<string, T> {
  for (const entity of Object.values(seeds)) {
    assignAuditIds(entity.auditLog, prefix)
  }
  return seeds as unknown as Record<string, T>
}
