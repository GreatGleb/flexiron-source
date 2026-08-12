/**
 * The order's lifecycle statuses — the one place that knows them.
 *
 * They used to be written out by hand in five: two option lists for the selects,
 * three pill maps in three different class schemes, and a fourth scheme in the
 * CRM whose CSS was never written at all. The same status therefore looked like
 * three different things on three screens, and adding one meant finding all five
 * — which is exactly how the card ended up carrying `completed`, `processing`
 * and `pending`, none of which the type has ever had.
 *
 * A pure module with no Vue in it, like `orderPricing.ts`: the mock, the views
 * and the tests all read the same list.
 */

export const ORDER_STATUSES = [
  'new',
  'confirmed',
  'picking',
  'packing',
  'shipped',
  'delivered',
  'paid',
  'completed',
  'return_requested',
  'return_processing',
  'returned',
  'cancelled',
  'rejected',
  'cancelled_by_customer',
  'refused',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * One class scheme for every screen that shows a status.
 *
 * The classes live in `styles/admin/components/_order-status-pill.css`, which
 * each consumer imports itself — a component may not borrow CSS from another
 * page's file, and the CRM badge is the proof: it asked for `order-status--*`
 * classes nobody had ever defined.
 */
export const ORDER_STATUS_PILL: Record<OrderStatus, string> = {
  new: 'order-status-pill--new',
  confirmed: 'order-status-pill--confirmed',
  picking: 'order-status-pill--picking',
  packing: 'order-status-pill--packing',
  shipped: 'order-status-pill--shipped',
  delivered: 'order-status-pill--delivered',
  paid: 'order-status-pill--paid',
  completed: 'order-status-pill--completed',
  return_requested: 'order-status-pill--return-requested',
  return_processing: 'order-status-pill--return-processing',
  returned: 'order-status-pill--returned',
  cancelled: 'order-status-pill--cancelled',
  rejected: 'order-status-pill--rejected',
  cancelled_by_customer: 'order-status-pill--cancelled-by-customer',
  refused: 'order-status-pill--refused',
}

const STATUS_SET = new Set<string>(ORDER_STATUSES)

/**
 * Is this string one of ours?
 *
 * The server needs it before it writes: `PATCH /status` used to record whatever
 * arrived, and a typo produced an order in a state no list, no filter and no
 * pill knows — without a single error (contract §4.5).
 */
export function isOrderStatus(value: string): value is OrderStatus {
  return STATUS_SET.has(value)
}

/**
 * The order was annulled — no goods were sold and no money is coming.
 *
 * Four ways to say it, because who annulled it and when decides what happens
 * next: the shop refusing an order it cannot fill, the client cancelling before
 * assembly, and the client turning the courier away at the door are three
 * different conversations, and reporting has to tell them apart.
 */
export function isCancellation(status: OrderStatus): boolean {
  return (
    status === 'cancelled' ||
    status === 'rejected' ||
    status === 'cancelled_by_customer' ||
    status === 'refused'
  )
}

/** The order reached the end of its road — there is nothing left to do with it. */
export function isTerminal(status: OrderStatus): boolean {
  return status === 'completed' || status === 'returned' || isCancellation(status)
}

/**
 * Still being worked on — the dashboard's `activeOrders`.
 *
 * Stated as "not finished", not as a list of the statuses that count: a list
 * goes stale on the next status somebody adds, and it went stale exactly that
 * way once already (contract §4.7).
 */
export function isActive(status: OrderStatus): boolean {
  return status !== 'delivered' && !isTerminal(status)
}

/**
 * Does this order count as revenue?
 *
 * Everything except an unconfirmed draft, an annulled order, and one that came
 * back. Feeds `salesMtd` and the product's average sale price: a returned order
 * was not a sale, and counting it names an average price for goods that in the
 * end nobody bought (§7.2); a `new` order is a draft nobody has agreed to yet,
 * and booking it as this month's turnover would let the figure be moved by
 * anybody who starts typing an order.
 *
 * Stated as an exclusion rather than the old list of `confirmed | shipped |
 * delivered`, which quietly left out `paid` — an order settled in full and not
 * yet delivered was revenue by every reading except that one.
 */
export function countsAsSale(status: OrderStatus): boolean {
  return status !== 'new' && !isCancellation(status) && status !== 'returned'
}
