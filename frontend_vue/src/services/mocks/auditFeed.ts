import { productAuditSources } from './products'
import { clientAuditSources } from './clients'
import { supplierAuditSources } from './suppliers'
import { orderAuditSources } from './orders'
import { warehouseAuditSources } from './warehouse'
import type {
  AuditFeedFilters,
  AuditFeedResponse,
  AuditFeedRow,
  AuditFeedUser,
  AuditSource,
} from '@/types/audit'

/**
 * The merged audit feed — a view over the nine logs, not a tenth store.
 *
 * Nothing is copied into a list of its own: every read walks the same arrays the
 * cards read, and deletion goes to the entity's own endpoint. That is what makes
 * "deleted here, gone there" true by construction rather than by a second
 * mechanism that has to be kept in step.
 */
function allSources(): AuditSource[] {
  return [
    ...productAuditSources(),
    ...orderAuditSources(),
    ...clientAuditSources(),
    ...supplierAuditSources(),
    ...warehouseAuditSources(),
  ]
}

/**
 * Two timestamp formats live in these logs: `2026-04-23 13:17` and full ISO.
 *
 * Sorted as strings they interleave wrongly — `T` sorts after a space, so for one
 * date every short stamp lands ahead of every long one whatever the clock said.
 * The feed is sorted by time, so it sorts by an actual instant.
 */
export function auditTimestampValue(timestamp: string): number {
  const direct = Date.parse(timestamp)
  if (!Number.isNaN(direct)) return direct
  // `2026-04-23 13:17` — a local stamp with no zone.
  const normalized = Date.parse(timestamp.replace(' ', 'T'))
  return Number.isNaN(normalized) ? 0 : normalized
}

/** The day a stamp falls on, for date-range filtering. */
function auditDay(timestamp: string): string {
  return timestamp.slice(0, 10)
}

function toRows(sources: AuditSource[]): AuditFeedRow[] {
  const rows: AuditFeedRow[] = []
  for (const source of sources) {
    for (const entry of source.log) {
      rows.push({
        entityType: source.entityType,
        entityId: source.entityId,
        entityLabel: source.entityLabel,
        entryId: entry.id,
        timestamp: entry.timestamp,
        // Copies, not the stored objects: a reader must not be able to edit the
        // store by having read it.
        user: { ...entry.user },
        userInitials: entry.userInitials,
        property: { ...entry.property },
        oldValue: entry.oldValue,
        newValue: entry.newValue,
      })
    }
  }
  return rows
}

export function mockGetAuditFeed(
  filters: AuditFeedFilters,
  pagination: { page: number; pageSize: number },
): AuditFeedResponse {
  let rows = toRows(allSources())

  if (filters.entityType) rows = rows.filter((r) => r.entityType === filters.entityType)
  if (filters.user) rows = rows.filter((r) => r.user.en === filters.user)
  if (filters.dateFrom) rows = rows.filter((r) => auditDay(r.timestamp) >= filters.dateFrom)
  if (filters.dateTo) rows = rows.filter((r) => auditDay(r.timestamp) <= filters.dateTo)
  if (filters.search) {
    const q = filters.search.toLowerCase()
    const hit = (value: string) => value.toLowerCase().includes(q)
    rows = rows.filter(
      (r) =>
        hit(r.property.ru) ||
        hit(r.property.en) ||
        hit(r.property.lt) ||
        hit(r.oldValue) ||
        hit(r.newValue) ||
        hit(r.entityLabel),
    )
  }

  // Newest first, across all nine — then paginate. Paging each entity separately
  // and stitching the pages together would give a page that is not a slice of
  // anything: the second page could hold records older than the third.
  rows.sort((a, b) => auditTimestampValue(b.timestamp) - auditTimestampValue(a.timestamp))

  const total = rows.length
  const pageSize = Math.max(1, pagination.pageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, pagination.page), totalPages)
  const start = (page - 1) * pageSize

  return {
    items: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages,
  }
}

/** Everyone who appears in the feed, for the user filter. */
export function mockGetAuditFeedUsers(): AuditFeedUser[] {
  const byKey = new Map<string, AuditFeedUser>()
  for (const source of allSources()) {
    for (const entry of source.log) {
      const key = entry.user.en
      if (!byKey.has(key)) {
        byKey.set(key, { key, name: { ...entry.user }, initials: entry.userInitials })
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}
