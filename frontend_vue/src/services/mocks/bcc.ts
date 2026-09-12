import type { BccCategory, BccRecipient, BccRequest } from '@/types/bcc'
import type { TranslatedString } from '@/types/i18n'
import { MOCK_SUPPLIERS } from './suppliers'
import { notifySupplierResponse } from './notifications'
import { mockGetMail, mockIsMailConfigured } from './settings'

export const MOCK_BCC_CATEGORIES: BccCategory[] = [
  {
    id: 'sheets',
    name: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    productCount: 4,
    children: [
      {
        id: 'sheet-2mm',
        name: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
        productCount: 0,
      },
      {
        id: 'sheet-3mm',
        name: { ru: 'Лист 3мм', en: 'Sheet 3mm', lt: 'Lakštas 3mm' },
        productCount: 0,
      },
      {
        id: 'sheet-5mm',
        name: { ru: 'Лист 5мм', en: 'Sheet 5mm', lt: 'Lakštas 5mm' },
        productCount: 0,
      },
      {
        id: 'sheet-10mm',
        name: { ru: 'Лист 10мм', en: 'Sheet 10mm', lt: 'Lakštas 10mm' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'lintels',
    name: { ru: 'Перемычки', en: 'Lintels', lt: 'Sąramos' },
    productCount: 2,
    children: [
      {
        id: 'lintel-100',
        name: { ru: 'Перемычка 100×100', en: 'Lintel 100×100', lt: 'Sąrama 100×100' },
        productCount: 0,
      },
      {
        id: 'lintel-150',
        name: { ru: 'Перемычка 150×150', en: 'Lintel 150×150', lt: 'Sąrama 150×150' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'beams',
    name: { ru: 'Балки', en: 'Beams', lt: 'Sijos' },
    productCount: 3,
    children: [
      {
        id: 'beam-i20',
        name: { ru: 'Двутавр 20', en: 'I-Beam 20', lt: 'Dvitėjis 20' },
        productCount: 0,
      },
      {
        id: 'beam-i30',
        name: { ru: 'Двутавр 30', en: 'I-Beam 30', lt: 'Dvitėjis 30' },
        productCount: 0,
      },
      {
        id: 'beam-heb',
        name: { ru: 'Балка HEB', en: 'HEB Beam', lt: 'HEB sija' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'pipes',
    name: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' },
    productCount: 3,
    children: [
      {
        id: 'pipe-50',
        name: { ru: 'Труба 50мм', en: 'Pipe 50mm', lt: 'Vamzdis 50mm' },
        productCount: 0,
      },
      {
        id: 'pipe-100',
        name: { ru: 'Труба 100мм', en: 'Pipe 100mm', lt: 'Vamzdis 100mm' },
        productCount: 0,
      },
      {
        id: 'pipe-150',
        name: { ru: 'Труба 150мм', en: 'Pipe 150mm', lt: 'Vamzdis 150mm' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'rebars',
    name: { ru: 'Арматура', en: 'Rebars', lt: 'Armatūra' },
    productCount: 3,
    children: [
      {
        id: 'rebar-12',
        name: { ru: 'Арматура 12мм', en: 'Rebar 12mm', lt: 'Armatūra 12mm' },
        productCount: 0,
      },
      {
        id: 'rebar-16',
        name: { ru: 'Арматура 16мм', en: 'Rebar 16mm', lt: 'Armatūra 16mm' },
        productCount: 0,
      },
      {
        id: 'rebar-20',
        name: { ru: 'Арматура 20мм', en: 'Rebar 20mm', lt: 'Armatūra 20mm' },
        productCount: 0,
      },
    ],
  },
]

// Product id → category name (matches MOCK_SUPPLIERS.categories entries).
// Auto-check logic: a supplier is "matching" if any of their categories covers at least one selected product.
const PRODUCT_CATEGORY: Record<string, string> = {
  'sheet-2mm': 'Sheets',
  'sheet-3mm': 'Sheets',
  'sheet-5mm': 'Sheets',
  'sheet-10mm': 'Sheets',
  'lintel-100': 'Lintels',
  'lintel-150': 'Lintels',
  'beam-i20': 'Beams',
  'beam-i30': 'Beams',
  'beam-heb': 'Beams',
  'pipe-50': 'Pipes',
  'pipe-100': 'Pipes',
  'pipe-150': 'Pipes',
  'rebar-12': 'Rebars',
  'rebar-16': 'Rebars',
  'rebar-20': 'Rebars',
}

export const MOCK_BCC_HISTORY: BccRequest[] = [
  // Request 001 — Sheet 2mm to 3 suppliers (all still pending)
  {
    id: 'evt-001',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-001',
    supplierName: { ru: 'MetalProm LLC', en: 'MetalProm LLC', lt: 'MetalProm LLC' },
    productId: 'sheet-2mm',
    productName: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
  {
    id: 'evt-002',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-002',
    supplierName: { ru: 'SteelWorks Inc', en: 'SteelWorks Inc', lt: 'SteelWorks Inc' },
    productId: 'sheet-2mm',
    productName: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
  {
    id: 'evt-003',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-004',
    supplierName: { ru: 'NordMetal Ltd', en: 'NordMetal Ltd', lt: 'NordMetal Ltd' },
    productId: 'sheet-2mm',
    productName: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
  // Request 002 — I-Beam 20 with mixed responses
  {
    id: 'evt-004',
    requestId: 'req-002',
    date: '2026-04-02',
    supplierId: 'sup-002',
    supplierName: { ru: 'SteelWorks Inc', en: 'SteelWorks Inc', lt: 'SteelWorks Inc' },
    productId: 'beam-i20',
    productName: { ru: 'Двутавр 20', en: 'I-Beam 20', lt: 'Dvitėjis 20' },
    source: { ru: 'Email', en: 'Email', lt: 'El. paštas' },
    status: 'responded',
    price: 85000,
    unit: 'ton',
  },
  {
    id: 'evt-005',
    requestId: 'req-002',
    date: '2026-04-02',
    supplierId: 'sup-004',
    supplierName: { ru: 'NordMetal Ltd', en: 'NordMetal Ltd', lt: 'NordMetal Ltd' },
    productId: 'beam-i20',
    productName: { ru: 'Двутавр 20', en: 'I-Beam 20', lt: 'Dvitėjis 20' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'no_response',
  },
  // Request 003 — Pipes Q1
  {
    id: 'evt-006',
    requestId: 'req-003',
    date: '2026-03-20',
    supplierId: 'sup-001',
    supplierName: { ru: 'MetalProm LLC', en: 'MetalProm LLC', lt: 'MetalProm LLC' },
    productId: 'pipe-100',
    productName: { ru: 'Труба 100мм', en: 'Pipe 100mm', lt: 'Vamzdis 100mm' },
    source: { ru: 'Телефон', en: 'Phone', lt: 'Telefonas' },
    status: 'sent',
  },
  {
    id: 'evt-007',
    requestId: 'req-003',
    date: '2026-03-20',
    supplierId: 'sup-004',
    supplierName: { ru: 'NordMetal Ltd', en: 'NordMetal Ltd', lt: 'NordMetal Ltd' },
    productId: 'pipe-100',
    productName: { ru: 'Труба 100мм', en: 'Pipe 100mm', lt: 'Vamzdis 100mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
]

export function mockGetBccCategories(): BccCategory[] {
  return MOCK_BCC_CATEGORIES
}

export function mockGetBccRecipients(productIds: string[]): BccRecipient[] {
  // Always return ALL suppliers (derived from the shared MOCK_SUPPLIERS, so ids/emails
  // align with the suppliers list & card pages). The `selected` flag indicates whether
  // this supplier covers any of the currently-selected products — so matches float to
  // the top without hiding anyone.
  const selectedCategories = new Set<string>()
  productIds.forEach((pid) => {
    const cat = PRODUCT_CATEGORY[pid]
    if (cat) selectedCategories.add(cat)
  })
  return MOCK_SUPPLIERS.map((s) => ({
    id: s.id,
    company: s.company,
    email: s.email,
    contactPerson: s.contactPerson,
    selected: selectedCategories.size > 0 && s.categories.some((c) => selectedCategories.has(c)),
  }))
}

export function mockGetBccHistory(
  page = 1,
  pageSize = 25,
): {
  items: BccRequest[]
  total: number
  page: number
  pageSize: number
  totalPages: number
} {
  const total = MOCK_BCC_HISTORY.length
  const start = (page - 1) * pageSize
  return {
    // Копия, а не срез ссылок: между настоящим сервером и клиентом стоит
    // сериализация, и мок обязан быть не слабее неё. Тот же приём у соседа —
    // `mocks/notifications.ts:424`.
    items: structuredClone(MOCK_BCC_HISTORY.slice(start, start + pageSize)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/**
 * Конверт отправленного письма — то, что «ушло с сервера».
 *
 * Раньше отправка не оставляла следа вовсе: мок принимал payload и возвращал
 * идентификатор. Проверить главное требование спеки (04.2 §4) было нечем —
 * рассылка циклом по одному письму снаружи выглядит точно так же, а стоит
 * раскрытием списка поставщиков при первой же ошибке.
 */
export interface SentEmail {
  /** Поле From — имя и адрес из почтовых настроек. */
  from: string
  /** Кому письмо адресовано в открытую. Сервер шлёт его самому себе. */
  to: string[]
  cc: string[]
  /** Все получатели рассылки — и только здесь. */
  bcc: string[]
  subject: string
  body: string
  fileIds: string[]
  sentAt: string
}

/** Журнал ушедших писем. Одна отправка — одна запись, иначе это не одна транзакция. */
export const MOCK_SENT_EMAILS: SentEmail[] = []

/** Сбросить журнал — нужен тестам, чтобы считать письма своего сценария. */
export function mockClearSentEmails(): void {
  MOCK_SENT_EMAILS.length = 0
}

function plainText(value: TranslatedString | string): string {
  return typeof value === 'string' ? value : value.en || value.ru || value.lt || ''
}

/**
 * Каталог источников запроса. Подпись строки ленты принадлежит серверу.
 *
 * Раньше каталог лежал константой страницы (`BccRequestPage.vue`,
 * `SOURCE_TRANSLATIONS`), и это работало только потому, что строки ленты
 * сочиняла та же страница. На проводе `source` приходит `TranslatedString`,
 * заполненный в ОДНОЙ локали (`bccService.ts` → `toTranslatedString`), поэтому
 * положить его в ленту как есть нельзя: в остальных двух локалях строка
 * отрисовалась бы пустой — питфолл #38. Отсюда сопоставление с каталогом по
 * любой из локалей.
 */
const SOURCE_LABELS: Record<string, TranslatedString> = {
  'BCC Tool': { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
  Email: { ru: 'Email', en: 'Email', lt: 'El. paštas' },
  Phone: { ru: 'Телефон', en: 'Phone', lt: 'Telefonas' },
  Messenger: { ru: 'Мессенджер', en: 'Messenger', lt: 'Messenger' },
  Other: { ru: 'Другое', en: 'Other', lt: 'Kita' },
}

function resolveSource(incoming: TranslatedString | string): TranslatedString {
  const value = plainText(incoming)
  const known = Object.values(SOURCE_LABELS).find(
    (label) => label.en === value || label.ru === value || label.lt === value,
  )
  if (known) return { ...known }
  // Отдельной проверки по КЛЮЧУ каталога здесь нет намеренно: у всех пяти
  // записей ключ совпадает со своим `en`, то есть поиск выше её уже покрывает.
  // Вторая такая же проверка была бы недостижимой ветвью.
  //
  // Источника нет в каталоге — сохраняем как пришло, но во всех трёх локалях,
  // иначе строка ленты будет пустой в двух из них.
  return { ru: value, en: value, lt: value }
}

/**
 * Счётчики монотонные: они не выводятся из длины массива и не уменьшаются от
 * удаления — тот же приём, что `nextSeq`/`nextId` в `mocks/orders.ts:1353-1357`.
 * Начальное значение снимается с сидов один раз при загрузке модуля, чтобы не
 * держать рядом с ними вторую копию их же последнего номера.
 */
function maxSeq(prefix: string, values: string[]): number {
  let max = 0
  for (const value of values) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(value)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

let nextRequestSeq =
  maxSeq(
    'req',
    MOCK_BCC_HISTORY.map((e) => e.requestId),
  ) + 1
let nextEventSeq =
  maxSeq(
    'evt',
    MOCK_BCC_HISTORY.map((e) => e.id),
  ) + 1

function findProductName(productId: string): TranslatedString {
  for (const root of MOCK_BCC_CATEGORIES) {
    if (root.id === productId) return { ...root.name }
    for (const leaf of root.children ?? []) {
      if (leaf.id === productId) return { ...leaf.name }
    }
  }
  return { ru: productId, en: productId, lt: productId }
}

/**
 * Строки события — обязанность сервера, и создаются они в той же транзакции, что
 * и отправка.
 *
 * Раньше их сочинял браузер: `BccRequestPage.vue` импортировала
 * `MOCK_BCC_HISTORY` напрямую и дописывала в него результат своих действий. Это
 * была единственная не-спека проекта, которая импортировала мок в `src/views`.
 * Против настоящего сервера письмо бы ушло, а истории не осталось ни у кого —
 * включая самого отправителя после перезагрузки.
 *
 * Одна строка на пару «получатель × позиция»: `requestId` общий, `id` у каждой
 * свой, и оба присваивает сервер — клиенту их считать больше не по чем.
 */
function createEventRows(
  productIds: string[],
  recipientIds: string[],
  source: TranslatedString | string,
): { requestId: string; events: BccRequest[] } {
  const requestId = `req-${String(nextRequestSeq++).padStart(3, '0')}`
  const date = new Date().toISOString().slice(0, 10)
  const label = resolveSource(source)
  const events: BccRequest[] = []
  for (const recipientId of recipientIds) {
    const supplier = MOCK_SUPPLIERS.find((s) => s.id === recipientId)
    if (!supplier) continue
    for (const productId of productIds) {
      events.push({
        id: `evt-${String(nextEventSeq++).padStart(3, '0')}`,
        requestId,
        date,
        supplierId: supplier.id,
        supplierName: { ...supplier.company },
        productId,
        productName: findProductName(productId),
        source: { ...label },
        status: 'sent',
      })
    }
  }
  MOCK_BCC_HISTORY.unshift(...events)
  return { requestId, events: structuredClone(events) }
}

/**
 * Отправка запроса цен. Письмо уходит ОДНОЙ транзакцией: один конверт, все адреса
 * поставщиков в BCC (спека 04.2 §4 — поставщики не должны видеть друг друга).
 *
 * Параметры отправителя берутся из почтовых настроек (спека 04.2 §6), и
 * ненастроенный сервер отказывает, а не делает вид, что отправил.
 */
export function mockSendBccRequest(payload: {
  productIds: string[]
  recipientIds: string[]
  subject: TranslatedString | string
  body: TranslatedString | string
  fileIds?: string[]
}): { requestId: string } {
  if (!mockIsMailConfigured()) throw new Error('MAIL_NOT_CONFIGURED')
  const mail = mockGetMail()
  const bcc = payload.recipientIds
    .map((id) => MOCK_SUPPLIERS.find((s) => s.id === id)?.email)
    .filter((email): email is string => Boolean(email))

  MOCK_SENT_EMAILS.push({
    from: mail.fromName ? `${mail.fromName} <${mail.fromEmail}>` : mail.fromEmail,
    to: [mail.fromEmail],
    cc: [],
    bcc,
    subject: plainText(payload.subject),
    body: plainText(payload.body),
    fileIds: payload.fileIds ?? [],
    sentAt: new Date().toISOString(),
  })

  // Строки события — в той же транзакции, что и конверт. Гейт
  // `MAIL_NOT_CONFIGURED` стоит выше, поэтому отказ не оставляет ни письма,
  // ни строк.
  const { requestId } = createEventRows(payload.productIds, payload.recipientIds, 'BCC Tool')
  return { requestId }
}

/**
 * Запрос, пришедший не через инструмент (телефон, письмо, мессенджер), — тот же
 * набор строк, только без конверта и с другим `source`. Раньше эта ветка
 * игнорировала payload целиком и возвращала один идентификатор, то есть не
 * делала того, ради чего эндпоинт существует.
 */
export function mockLogBccRequest(payload: {
  productIds: string[]
  recipientIds: string[]
  source: TranslatedString | string
}): { requestId: string } {
  const { requestId } = createEventRows(payload.productIds, payload.recipientIds, payload.source)
  return { requestId }
}

export function mockAcceptResponse(
  eventId: string,
  payload: { price: number; unit: string },
): BccRequest {
  const src = MOCK_BCC_HISTORY.find((e) => e.id === eventId)
  // An event nobody knows is refused by code, like `MAIL_NOT_CONFIGURED` above.
  // The `null` it used to return was handed to the page as a value of type
  // `BccRequest` and pushed straight into the feed, so a miss was indistinguishable
  // from a success until the row failed to render. The domain had no code for this
  // case at all — this is it, and it is not a substring of either existing code.
  if (!src) throw new Error('BCC_EVENT_NOT_FOUND')
  const next: BccRequest = {
    id: `evt-${Date.now()}`,
    requestId: src.requestId,
    date: new Date().toISOString().slice(0, 10),
    supplierId: src.supplierId,
    supplierName: src.supplierName,
    productId: src.productId,
    productName: src.productName,
    source: src.source,
    status: 'responded',
    price: payload.price,
    unit: payload.unit,
  }
  MOCK_BCC_HISTORY.unshift(next)
  // The supplier answering is the event. `mockMarkNoResponse` below is the
  // opposite fact — nobody answered — and files nothing: a feed that reports
  // silence as news would fill up with things that did not happen.
  notifySupplierResponse({ id: next.supplierId, name: next.supplierName })
  return next
}

export function mockMarkNoResponse(eventId: string): BccRequest {
  const src = MOCK_BCC_HISTORY.find((e) => e.id === eventId)
  // Same refusal as its neighbour above, and for the same reason.
  if (!src) throw new Error('BCC_EVENT_NOT_FOUND')
  const next: BccRequest = {
    id: `evt-${Date.now()}`,
    requestId: src.requestId,
    date: new Date().toISOString().slice(0, 10),
    supplierId: src.supplierId,
    supplierName: src.supplierName,
    productId: src.productId,
    productName: src.productName,
    source: src.source,
    status: 'no_response',
  }
  MOCK_BCC_HISTORY.unshift(next)
  return next
}
