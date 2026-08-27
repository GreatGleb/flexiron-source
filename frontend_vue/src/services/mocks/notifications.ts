import type { Notification, NotificationFilters } from '@/types/notifications'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import type { TranslatedString } from '@/types/i18n'
import type { OrderStatus } from '@/domain/orderStatus'
import type { FinancePayment } from '@/types/finance'
import { adminOrders } from '@/i18n/admin/orders'

// ─── Mock data ────────────────────────────────────────────────────────────────

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

const MOCK_NOTIFICATIONS: Notification[] = [
  // ── Order status notifications ──
  {
    id: 'notif-001',
    type: 'order_status',
    title: {
      ru: 'Статус заказа изменён',
      en: 'Order status changed',
      lt: 'Užsakymo būsena pakeista',
    },
    message: {
      ru: 'Заказ ORD-001 перешёл в статус «В пути»',
      en: 'Order ORD-001 has moved to "In Transit"',
      lt: 'Užsakymas ORD-001 perėjo į "Kelyje" būseną',
    },
    entityType: 'order',
    entityId: 'ORD-001',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: hoursAgo(2),
  },
  {
    id: 'notif-002',
    type: 'order_status',
    title: {
      ru: 'Статус заказа изменён',
      en: 'Order status changed',
      lt: 'Užsakymo būsena pakeista',
    },
    message: {
      ru: 'Заказ ORD-003 перешёл в статус «Готов к отгрузке»',
      en: 'Order ORD-003 has moved to "Ready to Ship"',
      lt: 'Užsakymas ORD-003 perėjo į "Paruoštas išsiuntimui" būseną',
    },
    entityType: 'order',
    entityId: 'ORD-003',
    entityRouteName: 'admin-order-card',
    isRead: true,
    createdAt: hoursAgo(5),
  },
  {
    id: 'notif-010',
    type: 'order_status',
    title: {
      ru: 'Статус заказа изменён',
      en: 'Order status changed',
      lt: 'Užsakymo būsena pakeista',
    },
    message: {
      ru: 'Заказ ORD-010 перешёл в статус «Доставлено»',
      en: 'Order ORD-010 has moved to "Delivered"',
      lt: 'Užsakymas ORD-010 perėjo į "Pristatyta" būseną',
    },
    entityType: 'order',
    entityId: 'ORD-010',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: hoursAgo(0.25),
  },
  {
    id: 'notif-018',
    type: 'order_status',
    title: {
      ru: 'Статус заказа изменён',
      en: 'Order status changed',
      lt: 'Užsakymo būsena pakeista',
    },
    message: {
      ru: 'Заказ ORD-006 перешёл в статус «Подтвержден»',
      en: 'Order ORD-006 has moved to "Confirmed"',
      lt: 'Užsakymas ORD-006 perėjo į "Patvirtinta" būseną',
    },
    entityType: 'order',
    entityId: 'ORD-006',
    entityRouteName: 'admin-order-card',
    isRead: true,
    createdAt: daysAgo(7),
  },

  // ── Stock deficit notifications ──
  {
    id: 'notif-003',
    type: 'stock_deficit',
    title: { ru: 'Дефицит склада', en: 'Stock deficit', lt: 'Sandėlio trūkumas' },
    message: {
      ru: '[Стальной лист 3мм] достиг нижнего лимита остатка',
      en: '[Steel Sheet 3mm] has reached minimum stock level',
      lt: '[Plieno lakštas 3mm] pasiekė minimalų atsargų lygį',
    },
    entityType: 'product',
    entityId: 'prod-001',
    entityRouteName: 'admin-product-card',
    isRead: false,
    createdAt: hoursAgo(1),
  },
  {
    id: 'notif-012',
    type: 'stock_deficit',
    title: { ru: 'Дефицит склада', en: 'Stock deficit', lt: 'Sandėlio trūkumas' },
    message: {
      ru: '[Сварочная проволока 1.2мм] достиг нижнего лимита остатка',
      en: '[Welding Wire 1.2mm] has reached minimum stock level',
      lt: '[Suvirinimo viela 1.2mm] pasiekė minimalų atsargų lygį',
    },
    entityType: 'product',
    entityId: 'prod-005',
    entityRouteName: 'admin-product-card',
    isRead: false,
    createdAt: daysAgo(1),
  },
  {
    id: 'notif-020',
    type: 'stock_deficit',
    title: { ru: 'Дефицит склада', en: 'Stock deficit', lt: 'Sandėlio trūkumas' },
    message: {
      ru: '[Оцинкованный лист 1.5мм] достиг нижнего лимита остатка',
      en: '[Galvanized Sheet 1.5mm] has reached minimum stock level',
      lt: '[Cinkuotas lakštas 1.5mm] pasiekė minimalų atsargų lygį',
    },
    entityType: 'product',
    entityId: 'prod-008',
    entityRouteName: 'admin-product-card',
    isRead: true,
    createdAt: daysAgo(10),
  },

  // ── Supplier response notifications ──
  {
    id: 'notif-004',
    type: 'supplier_response',
    title: { ru: 'Ответ поставщика', en: 'Supplier response', lt: 'Tiekėjo atsakymas' },
    message: {
      ru: 'Пришёл ответ от поставщика «Steel Plus OÜ» на BCC-запрос',
      en: 'Response received from supplier "Steel Plus OÜ" for BCC request',
      lt: 'Gautas tiekėjo "Steel Plus OÜ" atsakymas į BCC užklausą',
    },
    entityType: 'supplier',
    entityId: '1',
    entityRouteName: 'admin-supplier-card',
    isRead: false,
    createdAt: hoursAgo(3),
  },
  {
    id: 'notif-013',
    type: 'supplier_response',
    title: { ru: 'Ответ поставщика', en: 'Supplier response', lt: 'Tiekėjo atsakymas' },
    message: {
      ru: 'Пришёл ответ от поставщика «Metal Trade LT» на BCC-запрос',
      en: 'Response received from supplier "Metal Trade LT" for BCC request',
      lt: 'Gautas tiekėjo "Metal Trade LT" atsakymas į BCC užklausą',
    },
    entityType: 'supplier',
    entityId: '2',
    entityRouteName: 'admin-supplier-card',
    isRead: true,
    createdAt: daysAgo(2),
  },

  // ── Batch received notifications ──
  {
    id: 'notif-005',
    type: 'batch_received',
    title: { ru: 'Приёмка партии', en: 'Batch received', lt: 'Partija gauta' },
    message: {
      ru: 'Партия whb-001 принята на склад (сектор B5)',
      en: 'Batch whb-001 has been received (sector B5)',
      lt: 'Partija whb-001 priimta į sandėlį (sektorius B5)',
    },
    entityType: 'batch',
    entityId: 'whb-001',
    entityRouteName: 'admin-warehouse-batch',
    isRead: true,
    createdAt: hoursAgo(8),
  },
  {
    id: 'notif-011',
    type: 'batch_received',
    title: { ru: 'Приёмка партии', en: 'Batch received', lt: 'Partija gauta' },
    message: {
      ru: 'Партия whb-003 принята на склад (сектор A2)',
      en: 'Batch whb-003 has been received (sector A2)',
      lt: 'Partija whb-003 priimta į sandėlį (sektorius A2)',
    },
    entityType: 'batch',
    entityId: 'whb-003',
    entityRouteName: 'admin-warehouse-batch',
    isRead: false,
    createdAt: hoursAgo(6),
  },
  {
    id: 'notif-019',
    type: 'batch_received',
    title: { ru: 'Приёмка партии', en: 'Batch received', lt: 'Partija gauta' },
    message: {
      ru: 'Партия whb-002 принята на склад (сектор C1)',
      en: 'Batch whb-002 has been received (sector C1)',
      lt: 'Partija whb-002 priimta į sandėlį (sektorius C1)',
    },
    entityType: 'batch',
    entityId: 'whb-002',
    entityRouteName: 'admin-warehouse-batch',
    isRead: false,
    createdAt: daysAgo(3),
  },

  // ── Reserve expiring notifications ──
  {
    id: 'notif-006',
    type: 'reserve_expiring',
    title: { ru: 'Истечение резерва', en: 'Reserve expiring', lt: 'Rezervas baigiasi' },
    message: {
      ru: 'Резерв по заказу ORD-005 истекает через 2 дня',
      en: 'Reserve for order ORD-005 expires in 2 days',
      lt: 'Rezervas pagal užsakymą ORD-005 baigiasi po 2 dienų',
    },
    entityType: 'order',
    entityId: 'ORD-005',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: daysAgo(3),
  },
  {
    id: 'notif-016',
    type: 'reserve_expiring',
    title: { ru: 'Истечение резерва', en: 'Reserve expiring', lt: 'Rezervas baigiasi' },
    message: {
      ru: 'Резерв по заказу ORD-011 истекает через 1 день',
      en: 'Reserve for order ORD-011 expires in 1 day',
      lt: 'Rezervas pagal užsakymą ORD-011 baigiasi po 1 dienos',
    },
    entityType: 'order',
    entityId: 'ORD-011',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: daysAgo(4),
  },

  // ── Payment overdue notifications ──
  {
    id: 'notif-007',
    type: 'payment_overdue',
    title: { ru: 'Просрочка оплаты', en: 'Payment overdue', lt: 'Mokėjimo vėlavimas' },
    message: {
      ru: 'Оплата по заказу ORD-008 просрочена на 5 дней',
      en: 'Payment for order ORD-008 is overdue by 5 days',
      lt: 'Mokėjimas už užsakymą ORD-008 vėluoja 5 dienas',
    },
    entityType: 'order',
    entityId: 'ORD-008',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: daysAgo(5),
  },
  {
    id: 'notif-014',
    type: 'payment_overdue',
    title: { ru: 'Просрочка оплаты', en: 'Payment overdue', lt: 'Mokėjimo vėlavimas' },
    message: {
      ru: 'Оплата по заказу ORD-012 просрочена на 2 дня',
      en: 'Payment for order ORD-012 is overdue by 2 days',
      lt: 'Mokėjimas už užsakymą ORD-012 vėluoja 2 dienas',
    },
    entityType: 'order',
    entityId: 'ORD-012',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: daysAgo(2),
  },

  // ── Payment received notifications ──
  {
    id: 'notif-008',
    type: 'payment_received',
    title: { ru: 'Поступление оплаты', en: 'Payment received', lt: 'Mokėjimas gautas' },
    message: {
      ru: 'Поступила оплата по заказу ORD-002 на сумму 1 250 €',
      en: 'Payment received for order ORD-002 in the amount of €1,250',
      lt: 'Gautas mokėjimas už užsakymą ORD-002, suma 1 250 €',
    },
    entityType: 'order',
    entityId: 'ORD-002',
    entityRouteName: 'admin-order-card',
    isRead: true,
    createdAt: hoursAgo(12),
  },
  {
    id: 'notif-015',
    type: 'payment_received',
    title: { ru: 'Поступление оплаты', en: 'Payment received', lt: 'Mokėjimas gautas' },
    message: {
      ru: 'Поступила оплата по заказу ORD-007 на сумму 3 400 €',
      en: 'Payment received for order ORD-007 in the amount of €3,400',
      lt: 'Gautas mokėjimas už užsakymą ORD-007, suma 3 400 €',
    },
    entityType: 'order',
    entityId: 'ORD-007',
    entityRouteName: 'admin-order-card',
    isRead: true,
    createdAt: daysAgo(0.5),
  },

  // ── Warehouse ready notifications ──
  {
    id: 'notif-009',
    type: 'warehouse_ready',
    title: { ru: 'Подготовка склада', en: 'Warehouse ready', lt: 'Sandėlio paruošimas' },
    message: {
      ru: 'Кладовщику: подготовить металл для заказа ORD-004',
      en: 'Warehouse: prepare metal for order ORD-004',
      lt: 'Sandininkui: paruošti metalą užsakymui ORD-004',
    },
    entityType: 'order',
    entityId: 'ORD-004',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: hoursAgo(0.5),
  },
  {
    id: 'notif-017',
    type: 'warehouse_ready',
    title: { ru: 'Подготовка склада', en: 'Warehouse ready', lt: 'Sandėlio paruošimas' },
    message: {
      ru: 'Кладовщику: подготовить металл для заказа ORD-009',
      en: 'Warehouse: prepare metal for order ORD-009',
      lt: 'Sandininkui: paruošti metalą užsakymui ORD-009',
    },
    entityType: 'order',
    entityId: 'ORD-009',
    entityRouteName: 'admin-order-card',
    isRead: false,
    createdAt: hoursAgo(10),
  },
]

// In-memory mutable copy for read/unread toggling
let notifications = [...MOCK_NOTIFICATIONS]

// ─── Helper: apply filters ────────────────────────────────────────────────────

function applyFilters(items: Notification[], filters: NotificationFilters): Notification[] {
  let result = [...items]

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (n) =>
        n.message.ru.toLowerCase().includes(q) ||
        n.message.en.toLowerCase().includes(q) ||
        n.message.lt.toLowerCase().includes(q) ||
        n.title.ru.toLowerCase().includes(q) ||
        n.title.en.toLowerCase().includes(q) ||
        n.title.lt.toLowerCase().includes(q),
    )
  }

  // Type filter
  if (filters.type && filters.type !== 'all') {
    result = result.filter((n) => n.type === filters.type)
  }

  // Read status filter
  if (filters.isRead === true) {
    result = result.filter((n) => n.isRead)
  } else if (filters.isRead === false) {
    result = result.filter((n) => !n.isRead)
  }

  // Sort
  if (filters.sortBy === 'createdAt') {
    result.sort((a, b) => {
      const cmp = a.createdAt.localeCompare(b.createdAt)
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  } else if (filters.sortBy === 'type') {
    result.sort((a, b) => {
      const cmp = a.type.localeCompare(b.type)
      return filters.sortDir === 'desc' ? -cmp : cmp
    })
  }

  return result
}

// ─── Mock API functions ───────────────────────────────────────────────────────

export function mockGetNotifications(
  filters: NotificationFilters,
  pagination: PaginationParams,
): PaginatedResponse<Notification> {
  // Lets an E2E test force an error. The flag STAYS set until the test clears it:
  // it used to remove itself on the first read, which made the failure land on
  // whichever caller reached this mock first. `useNotifications` is a module-level
  // singleton shared with the bell in the topbar, so "first caller" is not something
  // a test can name — and a competing success afterwards would clear `error` again.
  // A one-shot fault is a race by construction; a latched one is a state.
  if (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('test_mock_force_error') === 'true'
  ) {
    throw new Error('SIMULATED_MOCK_ERROR')
  }
  const filtered = applyFilters(notifications, filters)
  const start = (pagination.page - 1) * pagination.pageSize
  const items = filtered.slice(start, start + pagination.pageSize)
  return {
    items: structuredClone(items),
    total: filtered.length,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(filtered.length / pagination.pageSize),
  }
}

export function mockGetUnreadCount(): number {
  return notifications.filter((n) => !n.isRead).length
}

export function mockMarkAsRead(id: string): void {
  const notification = notifications.find((n) => n.id === id)
  if (notification) {
    notification.isRead = true
  }
}

export function mockMarkAllAsRead(): void {
  notifications = notifications.map((n) => ({ ...n, isRead: true }))
}

/**
 * Reset all notifications to unread — useful for dev/testing.
 *
 * The event counter goes back with them: the records it numbered are gone, and
 * a counter that kept climbing would leave gaps that read like lost events.
 */
export function mockResetNotifications(): void {
  notifications = MOCK_NOTIFICATIONS.map((n) => ({ ...n }))
  eventSeq = 1
}

// ─── Events that create notifications ─────────────────────────────────────────
//
// Until now the twenty-one records above were the entire history the app could
// ever show: the eight notification types existed on the front end, the bell
// polled every thirty seconds, and nothing ever wrote a new record. The feed was
// seeded, not fed.
//
// The rules for what a notification SAYS live here and nowhere else — the module
// that owns the event calls a function of this file and passes the facts. A
// caller that builds its own title and message would be the second copy of the
// same rule, and the feed would drift apart one event type at a time.
//
// Every emitter below is called on a STATE TRANSITION, never on a repeated
// moment: a status that did not change, a shortage already on file, a
// reservation that was already complete write nothing. Otherwise the same fact
// lands in the feed once per call, and the bell ends up counting calls.

/** Continues past the seeded ids so a generated record can never collide. */
let eventSeq = 1

function emit(input: Omit<Notification, 'id' | 'isRead' | 'createdAt'>): void {
  notifications.unshift({
    ...input,
    id: `notif-ev-${String(eventSeq++).padStart(3, '0')}`,
    isRead: false,
    createdAt: new Date().toISOString(),
  })
}

/**
 * The status caption, taken from the one place that has all three languages.
 *
 * Writing the captions out here would be the fifth copy of a list that already
 * cost this project four (see `domain/orderStatus.ts`): a status renamed in the
 * dictionary would keep its old name in the feed for as long as nobody looked.
 * The index is typed, so a status without a caption fails typecheck.
 */
function statusLabel(status: OrderStatus): TranslatedString {
  const key = `status_${status}` as const
  return {
    ru: adminOrders.ru.orders[key],
    en: adminOrders.en.orders[key],
    lt: adminOrders.lt.orders[key],
  }
}

/** `order_status` — the order moved to another status. */
export function notifyOrderStatusChanged(
  order: { id: string; orderNumber: string },
  status: OrderStatus,
): void {
  const label = statusLabel(status)
  emit({
    type: 'order_status',
    title: {
      ru: 'Статус заказа изменён',
      en: 'Order status changed',
      lt: 'Užsakymo būsena pakeista',
    },
    message: {
      ru: `Заказ ${order.orderNumber} перешёл в статус «${label.ru}»`,
      en: `Order ${order.orderNumber} has moved to "${label.en}"`,
      lt: `Užsakymas ${order.orderNumber} perėjo į "${label.lt}" būseną`,
    },
    entityType: 'order',
    entityId: order.id,
    entityRouteName: 'admin-order-card',
  })
}

/** `warehouse_ready` — every unshipped line of the order is now held on the shelf. */
export function notifyWarehouseReady(order: { id: string; orderNumber: string }): void {
  emit({
    type: 'warehouse_ready',
    title: {
      ru: 'Подготовка склада',
      en: 'Warehouse ready',
      lt: 'Sandėlio paruošimas',
    },
    message: {
      ru: `Кладовщику: подготовить металл для заказа ${order.orderNumber}`,
      en: `Warehouse: prepare metal for order ${order.orderNumber}`,
      lt: `Sandininkui: paruošti metalą užsakymui ${order.orderNumber}`,
    },
    entityType: 'order',
    entityId: order.id,
    entityRouteName: 'admin-order-card',
  })
}

/**
 * `payment_received` — money came in against the order.
 *
 * The sum is written with the code of the currency it arrived in and never
 * converted: this system has no rates anywhere, and a notification is not the
 * place to invent the first one.
 */
export function notifyPaymentReceived(
  order: { id: string; orderNumber: string; currency: string },
  amount: number,
): void {
  const sum = `${amount.toFixed(2)} ${order.currency}`
  emit({
    type: 'payment_received',
    title: {
      ru: 'Поступление оплаты',
      en: 'Payment received',
      lt: 'Mokėjimas gautas',
    },
    message: {
      ru: `Поступила оплата по заказу ${order.orderNumber} на сумму ${sum}`,
      en: `Payment received for order ${order.orderNumber} in the amount of ${sum}`,
      lt: `Gautas mokėjimas už užsakymą ${order.orderNumber}, suma ${sum}`,
    },
    entityType: 'order',
    entityId: order.id,
    entityRouteName: 'admin-order-card',
  })
}

/** `batch_received` — a batch was taken onto the shelf. */
export function notifyBatchReceived(batch: {
  id: string
  batchNumber: string
  location: string | null
}): void {
  const where = batch.location ? batch.location.split('\n')[0] : null
  emit({
    type: 'batch_received',
    title: { ru: 'Приёмка партии', en: 'Batch received', lt: 'Partija gauta' },
    message: {
      ru: `Партия ${batch.batchNumber} принята на склад${where ? ` (${where})` : ''}`,
      en: `Batch ${batch.batchNumber} has been received${where ? ` (${where})` : ''}`,
      lt: `Partija ${batch.batchNumber} priimta į sandėlį${where ? ` (${where})` : ''}`,
    },
    entityType: 'batch',
    entityId: batch.id,
    entityRouteName: 'admin-warehouse-batch',
  })
}

/** `stock_deficit` — an order asked for more than the shelf holds. */
export function notifyStockDeficit(deficit: {
  productId: string
  productName: TranslatedString
}): void {
  const name = deficit.productName
  emit({
    type: 'stock_deficit',
    title: { ru: 'Дефицит склада', en: 'Stock deficit', lt: 'Sandėlio trūkumas' },
    message: {
      ru: `[${name.ru}] достиг нижнего лимита остатка`,
      en: `[${name.en}] has reached minimum stock level`,
      lt: `[${name.lt}] pasiekė minimalų atsargų lygį`,
    },
    entityType: 'product',
    entityId: deficit.productId,
    entityRouteName: 'admin-product-card',
  })
}

/** `supplier_response` — a supplier answered a BCC request. */
export function notifySupplierResponse(supplier: { id: string; name: TranslatedString }): void {
  const name = supplier.name
  emit({
    type: 'supplier_response',
    title: { ru: 'Ответ поставщика', en: 'Supplier response', lt: 'Tiekėjo atsakymas' },
    message: {
      ru: `Пришёл ответ от поставщика «${name.ru}» на BCC-запрос`,
      en: `Response received from supplier "${name.en}" for BCC request`,
      lt: `Gautas tiekėjo "${name.lt}" atsakymas į BCC užklausą`,
    },
    entityType: 'supplier',
    entityId: supplier.id,
    entityRouteName: 'admin-supplier-card',
  })
}

/**
 * `payment_overdue` — платёж перешёл в статус «просрочен».
 *
 * Просрочка в этой системе — не событие часов, а состояние платежа: своего
 * будильника у мока нет, и единственный момент, когда факт становится известен,
 * — это переход статуса. Отсюда и точка вызова.
 *
 * Срок назван датой, а не числом дней. Текст уведомления хранится таким, каким
 * его записали: «просрочена на 1 день» через месяц превратится в неправду —
 * ровно так, как это уже случилось с сидами выше. Дата не стареет.
 */
export function notifyPaymentOverdue(
  payment: Pick<
    FinancePayment,
    | 'paymentNumber'
    | 'direction'
    | 'dueDate'
    | 'orderId'
    | 'orderNumber'
    | 'counterpartyId'
    | 'counterpartyName'
  >,
): void {
  const due = payment.dueDate.slice(0, 10)
  // Счёт поставщика живёт без заказа — тогда уведомление ведёт к контрагенту,
  // а не в никуда: `entityId` заказа, которого нет, открыл бы пустую карточку.
  const order =
    payment.orderId && payment.orderNumber
      ? { id: payment.orderId, number: payment.orderNumber }
      : null
  const subject: TranslatedString = order
    ? {
        ru: `Оплата по заказу ${order.number}`,
        en: `Payment for order ${order.number}`,
        lt: `Mokėjimas už užsakymą ${order.number}`,
      }
    : {
        ru: `Оплата ${payment.paymentNumber} (${payment.counterpartyName})`,
        en: `Payment ${payment.paymentNumber} (${payment.counterpartyName})`,
        lt: `Mokėjimas ${payment.paymentNumber} (${payment.counterpartyName})`,
      }
  const link: Pick<Notification, 'entityType' | 'entityId' | 'entityRouteName'> = order
    ? { entityType: 'order', entityId: order.id, entityRouteName: 'admin-order-card' }
    : payment.direction === 'outgoing'
      ? {
          entityType: 'supplier',
          entityId: payment.counterpartyId,
          entityRouteName: 'admin-supplier-card',
        }
      : {
          entityType: 'client',
          entityId: payment.counterpartyId,
          entityRouteName: 'admin-client-card',
        }
  emit({
    type: 'payment_overdue',
    title: { ru: 'Просрочка оплаты', en: 'Payment overdue', lt: 'Mokėjimo vėlavimas' },
    message: {
      ru: `${subject.ru} просрочена — срок был ${due}`,
      en: `${subject.en} is overdue — due ${due}`,
      lt: `${subject.lt} vėluoja — terminas ${due}`,
    },
    ...link,
  })
}

// `reserve_expiring` — восьмой тип с фронта, и единственный, которому здесь
// нечего вызвать. У `StockReservation` (`types/warehouse.ts`) нет ни срока, ни
// даты окончания, а в настройках нет срока резерва: `Batch.expiresAt` — это
// годность металла, а не граница брони. Сид «резерв по заказу истекает через
// 2 дня» называет дату, которой в модели не существует.
//
// Написать эмиттер можно только выдумав срок резерва — то есть добавив в мок
// данные, которых нет в приложении. Это ровно то, что запрещает «мок = правда».
// Тип останется без триггера, пока у брони не появится срок; тогда событие —
// переход через порог, и место ему рядом с остальными эмиттерами выше.
