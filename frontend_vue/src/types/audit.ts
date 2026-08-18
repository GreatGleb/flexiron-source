import type { TranslatedString } from './i18n'
import type { StockAuditEntry } from './warehouse'

/** The nine entities that keep a history. There is no tenth, and no feed of its own. */
export type AuditEntityType =
  | 'product'
  | 'order'
  | 'client'
  | 'supplier'
  | 'batch'
  | 'stock'
  | 'offcut'
  | 'movement'
  | 'deficit'

export const AUDIT_ENTITY_TYPES: AuditEntityType[] = [
  'product',
  'order',
  'client',
  'supplier',
  'batch',
  'stock',
  'offcut',
  'movement',
  'deficit',
]

/**
 * Where a row leads, by the notifications pattern (`entityType` / `entityId` /
 * `entityRouteName`) rather than a second one invented here.
 *
 * Five of the nine are warehouse cards. They are their own routes, not tabs of
 * the warehouse table page, so a row leads straight to the card.
 */
export const AUDIT_ENTITY_ROUTES: Record<AuditEntityType, string> = {
  product: 'admin-product-card',
  order: 'admin-order-card',
  client: 'admin-client-card',
  supplier: 'admin-supplier-card',
  batch: 'admin-warehouse-batch',
  stock: 'admin-warehouse-stock-card',
  offcut: 'admin-warehouse-offcut',
  movement: 'admin-warehouse-movement',
  deficit: 'admin-warehouse-deficit',
}

/** One entity's log, as its own module hands it over to the feed. */
export interface AuditSource {
  entityType: AuditEntityType
  entityId: string
  /** What the row calls the object: batch number, order number, client name. */
  entityLabel: string
  log: StockAuditEntry[]
}

/**
 * One line of the merged feed.
 *
 * `entryId` is unique inside ONE entity's log and nowhere else: `bch-au-2` exists
 * on every batch. So the entry id does not identify a row here — see
 * `auditRowKey`.
 */
export interface AuditFeedRow {
  entityType: AuditEntityType
  entityId: string
  entityLabel: string
  entryId: string
  timestamp: string
  user: TranslatedString
  userInitials: string
  property: TranslatedString
  oldValue: string
  newValue: string
}

/**
 * The only thing that names a row in the merged feed: entity type + entity id +
 * entry id.
 *
 * Not `entryId`, which repeats across entities, and not the position in the feed,
 * which changes with every filter and every deletion. Both would make Vue reuse
 * one row's DOM for another's data — after a deletion the highlight, or the row
 * itself, lands on the wrong record. The same key is what selection, the delete
 * modal's target and the optimistic removal are all keyed by, so all four agree.
 */
export function auditRowKey(row: {
  entityType: AuditEntityType
  entityId: string
  entryId: string
}): string {
  return `${row.entityType}:${row.entityId}:${row.entryId}`
}

export interface AuditFeedFilters {
  /** '' — все сущности */
  entityType: string
  /** '' — все пользователи; ключ — `user.en`, подпись переводится через tf() */
  user: string
  dateFrom: string
  dateTo: string
  search: string
}

export interface AuditFeedResponse {
  items: AuditFeedRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Distinct authors across the whole feed — for the user filter. */
export interface AuditFeedUser {
  /** `user.en`, the stable key. */
  key: string
  name: TranslatedString
  initials: string
}

/**
 * The feed without one row — the optimistic removal after a successful delete.
 *
 * Matched on the composite key, never on the entry id: `bch-au-1` exists on every
 * batch that has a history, so dropping "the rows with this entry id" would take
 * another entity's record off the screen along with the one that was deleted.
 */
export function withoutRow(rows: AuditFeedRow[], removed: AuditFeedRow): AuditFeedRow[] {
  const key = auditRowKey(removed)
  return rows.filter((row) => auditRowKey(row) !== key)
}
