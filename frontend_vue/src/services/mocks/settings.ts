import type {
  AppSettings,
  CompanyInfo,
  GlobalConstants,
  OrderPermissions,
  Currency,
  Uom,
  UomConversion,
  OrderStatusSetting,
  WarehouseMapFile,
  SettingUser,
  UserProfile,
  MailServerSettings,
  MailServerPayload,
} from '@/types/settings'
import { isMailConfigured } from '@/types/settings'

// ─── Seed data ───────────────────────────────────────────────────────────

/**
 * Почтовый сервер — сид без пароля, и это не забывчивость.
 *
 * Пароль лежит отдельной константой и отдельной переменной стора: тип
 * `MailServerSettings` поля для него не имеет вовсе, потому что сервер его не
 * отдаёт. Держать секрет там, откуда его нельзя случайно прочитать, дешевле,
 * чем каждый раз помнить вычеркнуть его из ответа.
 */
const MOCK_MAIL_SEED: Omit<MailServerSettings, 'passwordSet'> = {
  host: 'smtp.flexiron.lt',
  port: 587,
  encryption: 'starttls',
  username: 'sales@flexiron.lt',
  fromEmail: 'sales@flexiron.lt',
  fromName: 'Flexiron UAB',
}

/** Пароль SMTP на стороне «сервера». Наружу не выходит ни одним путём. */
const MOCK_MAIL_PASSWORD = 'seed-smtp-token'

export const MOCK_SETTINGS: AppSettings = {
  mail: { ...MOCK_MAIL_SEED, passwordSet: MOCK_MAIL_PASSWORD.length > 0 },

  company: {
    name: 'Flexiron UAB',
    legalAddress: 'Verkių g. 25, Vilnius, Lietuva',
    vatCode: 'LT123456789',
    bankName: 'Swedbank',
    bankAccount: 'LT12 7300 0100 1234 5678',
    logoUrl: '',
  },

  constants: {
    vatRate: 21,
    defaultMargin: 15,
    defaultCurrency: 'EUR',
    defaultDiscountPercent: 0,
  },

  // Model section 12. Accounting sees cost because it reconciles it; only the
  // owner and the admin may type one by hand or correct a shipped line, because
  // both of those rewrite something a client or the warehouse already believes.
  orderPermissions: {
    seeCost: ['owner', 'admin', 'accounting'],
    manualCost: ['owner', 'admin'],
    correction: ['owner', 'admin'],
  },

  currencies: [
    {
      id: 'cur-eur',
      code: 'EUR',
      name: { ru: 'Евро', en: 'Euro', lt: 'Euras' },
      isDefault: true,
    },
    {
      id: 'cur-usd',
      code: 'USD',
      name: { ru: 'Доллар США', en: 'US Dollar', lt: 'JAV doleris' },
      isDefault: false,
    },
    {
      id: 'cur-gbp',
      code: 'GBP',
      name: { ru: 'Фунт стерлингов', en: 'British Pound', lt: 'Svaras sterlingų' },
      isDefault: false,
    },
  ] satisfies Currency[],

  uoms: [
    {
      id: 'uom-t',
      code: { ru: 'т', en: 't', lt: 't' },
      name: { ru: 'Тонна', en: 'Tonne', lt: 'Tona' },
      category: 'weight',
    },
    {
      id: 'uom-kg',
      code: { ru: 'кг', en: 'kg', lt: 'kg' },
      name: { ru: 'Килограмм', en: 'Kilogram', lt: 'Kilogramas' },
      category: 'weight',
    },
    {
      id: 'uom-pcs',
      code: { ru: 'шт', en: 'pcs', lt: 'vnt' },
      name: { ru: 'Штука', en: 'Piece', lt: 'Vienetas' },
      category: 'quantity',
    },
    {
      id: 'uom-m',
      code: { ru: 'м', en: 'm', lt: 'm' },
      name: { ru: 'Метр', en: 'Meter', lt: 'Metras' },
      category: 'length',
    },
    {
      id: 'uom-m2',
      code: { ru: 'м²', en: 'm²', lt: 'm²' },
      name: { ru: 'Квадратный метр', en: 'Square meter', lt: 'Kvadratinis metras' },
      category: 'area',
    },
    {
      id: 'uom-m3',
      code: { ru: 'м³', en: 'm³', lt: 'm³' },
      name: { ru: 'Кубический метр', en: 'Cubic meter', lt: 'Kubinis metras' },
      category: 'volume',
    },
    {
      id: 'uom-kg-m3',
      code: { ru: 'кг/м³', en: 'kg/m³', lt: 'kg/m³' },
      name: {
        ru: 'Килограмм на кубометр',
        en: 'Kilogram per cubic meter',
        lt: 'Kilogramas kubiniame metre',
      },
      category: 'density',
    },
    {
      id: 'uom-mm',
      code: { ru: 'мм', en: 'mm', lt: 'mm' },
      name: { ru: 'Миллиметр', en: 'Millimeter', lt: 'Milimetras' },
      category: 'thickness',
    },
    {
      // Услуги продаются за час. Ни одного правила пересчёта у часа нет и не будет:
      // час не переводится ни в килограммы, ни в метры, и пустая строка в матрице
      // честнее выдуманного коэффициента.
      id: 'uom-h',
      code: { ru: 'ч', en: 'h', lt: 'val.' },
      name: { ru: 'Час', en: 'Hour', lt: 'Valanda' },
      category: 'time',
    },
  ] satisfies Uom[],

  conversions: [
    // ── Static rules ──
    { id: 'conv-ton-kg', fromUomId: 'uom-t', toUomId: 'uom-kg', type: 'static', factor: 1000 },
    { id: 'conv-m-mm', fromUomId: 'uom-m', toUomId: 'uom-mm', type: 'static', factor: 1000 },

    // ── Dynamic rules ──
    {
      id: 'conv-m-kg',
      fromUomId: 'uom-m',
      toUomId: 'uom-kg',
      type: 'dynamic',
      formulaType: 'weight_per_meter',
    },
    {
      id: 'conv-m2-kg',
      fromUomId: 'uom-m2',
      toUomId: 'uom-kg',
      type: 'dynamic',
      formulaType: 'area_to_weight',
    },
    {
      id: 'conv-pcs-kg',
      fromUomId: 'uom-pcs',
      toUomId: 'uom-kg',
      type: 'dynamic',
      formulaType: 'pcs_to_weight',
    },
  ] satisfies UomConversion[],

  // Карты нет, пока её не загрузили. Демо-данные держатся тех же правил, что
  // приложение: нарисовать здесь ссылку на несуществующий файл — значит показать
  // пустому складу картинку, которой ни у кого нет.
  warehouseMap: null,

  users: [
    { id: 'usr-0', email: 'owner@flexiron.com', name: 'Миндаугас В.', role: 'owner', active: true },
    { id: 'usr-1', email: 'admin@flexiron.com', name: 'Максим В.', role: 'admin', active: true },
    { id: 'usr-2', email: 'manager@flexiron.com', name: 'Анна М.', role: 'manager', active: true },
    {
      id: 'usr-3',
      email: 'warehouse@flexiron.com',
      name: 'Петр К.',
      role: 'warehouse',
      active: true,
    },
    {
      id: 'usr-4',
      email: 'accounting@flexiron.com',
      name: 'Елена С.',
      role: 'accounting',
      active: true,
    },
    { id: 'usr-5', email: 'viewer@flexiron.com', name: 'Иван Д.', role: 'viewer', active: false },
  ] satisfies SettingUser[],

  orderStatuses: [
    {
      id: 'st-new',
      name: { ru: 'Новый', en: 'New', lt: 'Naujas' },
      color: '#6B7280',
      order: 0,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-confirmed',
      name: { ru: 'Подтверждён', en: 'Confirmed', lt: 'Patvirtintas' },
      color: '#3B82F6',
      order: 1,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-picking',
      name: { ru: 'Сборка', en: 'Picking', lt: 'Komplektavimas' },
      color: '#8B5CF6',
      order: 2,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-packing',
      name: { ru: 'Упаковка', en: 'Packing', lt: 'Pakavimas' },
      color: '#F59E0B',
      order: 3,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-shipped',
      name: { ru: 'Отгружен', en: 'Shipped', lt: 'Išsiųstas' },
      color: '#10B981',
      order: 4,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-delivered',
      name: { ru: 'Доставлен', en: 'Delivered', lt: 'Pristatytas' },
      color: '#059669',
      order: 5,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-paid',
      name: { ru: 'Оплачен', en: 'Paid', lt: 'Apmokėtas' },
      color: '#047857',
      order: 6,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-completed',
      name: { ru: 'Завершён', en: 'Completed', lt: 'Užbaigtas' },
      color: '#047857',
      order: 7,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    // The return statuses move nothing by themselves. Goods come back through a
    // return document; the status is the note that says it happened.
    {
      id: 'st-return_requested',
      name: { ru: 'Запрос на возврат', en: 'Return requested', lt: 'Prašomas grąžinimas' },
      color: '#F59E0B',
      order: 8,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-return_processing',
      name: { ru: 'Возврат в процессе', en: 'Return processing', lt: 'Grąžinimas vykdomas' },
      color: '#D97706',
      order: 9,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-returned',
      name: { ru: 'Возвращён', en: 'Returned', lt: 'Grąžintas' },
      color: '#DC2626',
      order: 10,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-cancelled',
      name: { ru: 'Отменён', en: 'Cancelled', lt: 'Atšauktas' },
      color: '#EF4444',
      order: 11,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-rejected',
      name: { ru: 'Отклонён продавцом', en: 'Rejected', lt: 'Atmestas' },
      color: '#B91C1C',
      order: 12,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-cancelled_by_customer',
      name: { ru: 'Отменён покупателем', en: 'Cancelled by customer', lt: 'Atšaukė pirkėjas' },
      color: '#EF4444',
      order: 13,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
    {
      id: 'st-refused',
      name: { ru: 'Отказ при получении', en: 'Refused on delivery', lt: 'Atsisakyta pristatant' },
      color: '#991B1B',
      order: 14,
      system: true,
      reserveOnTransition: false,
      writeOffOnTransition: false,
    },
  ] satisfies OrderStatusSetting[],

  profile: {
    firstName: 'Mindaugas',
    lastName: 'Volkovas',
    email: 'owner@flexiron.com',
    phone: '+37060000000',
    role: 'owner',
    secretLink: 'http://localhost:5173/auth/link?token=mock-secret-token-abc123',
  },
}

// ─── In-memory store ─────────────────────────────────────────────────────

/**
 * Стор настроек — без почтовой секции: она живёт в `mailStore` ниже вместе со своим
 * паролем, и второй копии у неё быть не должно (линза Л5 — один источник правила).
 */
let settingsStore: Omit<AppSettings, 'mail'> = structuredClone(MOCK_SETTINGS)
const mailStore: Omit<MailServerSettings, 'passwordSet'> = { ...MOCK_MAIL_SEED }
let mailPassword = MOCK_MAIL_PASSWORD
let nextCurrencySeq = 10
let nextUomSeq = 10
let nextConvSeq = 10
let nextStatusSeq = 10

// ─── Helpers ─────────────────────────────────────────────────────────────

function findCurrency(id: string): Currency | undefined {
  return settingsStore.currencies.find((c) => c.id === id)
}

function findUom(id: string): Uom | undefined {
  return settingsStore.uoms.find((u) => u.id === id)
}

function findConversion(id: string): UomConversion | undefined {
  return settingsStore.conversions.find((c) => c.id === id)
}

function findOrderStatus(id: string): OrderStatusSetting | undefined {
  return settingsStore.orderStatuses.find((s) => s.id === id)
}

// ─── Full settings ───────────────────────────────────────────────────────

export function mockGetSettings(): AppSettings {
  return { ...structuredClone(settingsStore), mail: mockGetMail() }
}

export function mockSaveSettings(settings: AppSettings): void {
  const { mail, ...rest } = JSON.parse(JSON.stringify(settings)) as AppSettings
  settingsStore = rest
  // Почта идёт своим путём — иначе `passwordSet` из ответа лёг бы в стор второй
  // копией правила «пароль задан», а правда о пароле одна и живёт в `mailPassword`.
  mockPatchMail({
    host: mail.host,
    port: mail.port,
    encryption: mail.encryption,
    username: mail.username,
    fromEmail: mail.fromEmail,
    fromName: mail.fromName,
  })
}

// ─── Company ─────────────────────────────────────────────────────────────

export function mockGetCompany(): CompanyInfo {
  return structuredClone(settingsStore.company)
}

export function mockSaveCompany(data: CompanyInfo): void {
  settingsStore.company = structuredClone(data)
}

/** Merge-patch company — only provided fields are updated */
export function mockPatchCompany(patch: Partial<CompanyInfo>): CompanyInfo {
  Object.assign(settingsStore.company, patch)
  return structuredClone(settingsStore.company)
}

// ─── Constants ───────────────────────────────────────────────────────────

export function mockGetConstants(): GlobalConstants {
  return structuredClone(settingsStore.constants)
}

/**
 * Who may see cost, type one by hand, or correct an issued document.
 *
 * Its own endpoint because it is its own decision: the constants are numbers the
 * business picks, this is who is allowed to do what — and the server has to have
 * an answer even when nothing else about the settings is on screen.
 */
export function mockGetOrderPermissions(): OrderPermissions {
  return structuredClone(settingsStore.orderPermissions)
}

export function mockSaveConstants(data: GlobalConstants): void {
  settingsStore.constants = structuredClone(data)
}

/** Merge-patch constants — only provided fields are updated */
export function mockPatchConstants(patch: Partial<GlobalConstants>): GlobalConstants {
  Object.assign(settingsStore.constants, patch)
  return structuredClone(settingsStore.constants)
}

// ─── Currencies ──────────────────────────────────────────────────────────

export function mockGetCurrencies(): Currency[] {
  return structuredClone(settingsStore.currencies)
}

export function mockCreateCurrency(data: Omit<Currency, 'id'>): Currency {
  const created: Currency = {
    ...data,
    id: `cur-${nextCurrencySeq++}`,
  }
  settingsStore.currencies.push(created)
  return structuredClone(created)
}

export function mockUpdateCurrency(id: string, data: Partial<Currency>): void {
  const cur = findCurrency(id)
  if (!cur) throw new Error('CURRENCY_NOT_FOUND')
  Object.assign(cur, data)
}

export function mockDeleteCurrency(id: string): void {
  const idx = settingsStore.currencies.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('CURRENCY_NOT_FOUND')
  settingsStore.currencies.splice(idx, 1)
}

// ─── UOMs ────────────────────────────────────────────────────────────────

export function mockGetUoms(): Uom[] {
  return structuredClone(settingsStore.uoms)
}

export function mockCreateUom(data: Omit<Uom, 'id'>): Uom {
  const created: Uom = {
    ...data,
    id: `uom-${nextUomSeq++}`,
  }
  settingsStore.uoms.push(created)
  return structuredClone(created)
}

export function mockUpdateUom(id: string, data: Partial<Uom>): void {
  const uom = findUom(id)
  if (!uom) throw new Error('UOM_NOT_FOUND')
  Object.assign(uom, data)
}

export function mockDeleteUom(id: string): void {
  const idx = settingsStore.uoms.findIndex((u) => u.id === id)
  if (idx === -1) throw new Error('UOM_NOT_FOUND')
  settingsStore.uoms.splice(idx, 1)
}

// ─── Conversions ─────────────────────────────────────────────────────────

export function mockGetConversions(): UomConversion[] {
  return structuredClone(settingsStore.conversions)
}

export function mockCreateConversion(data: Omit<UomConversion, 'id'>): UomConversion {
  const created: UomConversion = {
    ...data,
    id: `conv-${nextConvSeq++}`,
  }
  settingsStore.conversions.push(created)
  return structuredClone(created)
}

export function mockUpdateConversion(id: string, data: Partial<UomConversion>): void {
  const conv = findConversion(id)
  if (!conv) throw new Error('CONVERSION_NOT_FOUND')
  Object.assign(conv, data)
}

export function mockDeleteConversion(id: string): void {
  const idx = settingsStore.conversions.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error('CONVERSION_NOT_FOUND')
  settingsStore.conversions.splice(idx, 1)
}

// ─── Order Statuses ──────────────────────────────────────────────────────

export function mockGetOrderStatuses(): OrderStatusSetting[] {
  return structuredClone(settingsStore.orderStatuses)
}

export function mockCreateOrderStatus(data: Omit<OrderStatusSetting, 'id'>): OrderStatusSetting {
  const created: OrderStatusSetting = {
    ...data,
    id: `st-${nextStatusSeq++}`,
  }
  settingsStore.orderStatuses.push(created)
  created.order = settingsStore.orderStatuses.length - 1
  return structuredClone(created)
}

export function mockUpdateOrderStatus(id: string, data: Partial<OrderStatusSetting>): void {
  const st = findOrderStatus(id)
  if (!st) throw new Error('ORDER_STATUS_NOT_FOUND')
  Object.assign(st, data)
}

export function mockMoveOrderStatus(orderedIds: string[]): void {
  const reordered: OrderStatusSetting[] = []
  for (const id of orderedIds) {
    const st = findOrderStatus(id)
    if (st) {
      reordered.push(st)
    }
  }
  // Add any statuses not in the orderedIds list at the end
  for (const st of settingsStore.orderStatuses) {
    if (!reordered.find((r) => r.id === st.id)) {
      reordered.push(st)
    }
  }
  reordered.forEach((s, i) => (s.order = i))
  settingsStore.orderStatuses = reordered
}

export function mockDeleteOrderStatus(id: string): void {
  const idx = settingsStore.orderStatuses.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('ORDER_STATUS_NOT_FOUND')
  settingsStore.orderStatuses.splice(idx, 1)
  settingsStore.orderStatuses.forEach((s, i) => (s.order = i))
}

// ─── Mail server ─────────────────────────────────────────────────────────

/**
 * Чтение почтовых настроек. Пароля в ответе нет — только признак, что он задан.
 * Это не «забыли положить»: поля для него нет в типе, положить его некуда.
 */
export function mockGetMail(): MailServerSettings {
  return { ...mailStore, passwordSet: mailPassword.length > 0 }
}

/**
 * Merge-patch почтовых настроек. `password` — единственное поле, которое можно
 * записать и нельзя прочитать; пустая строка игнорируется, потому что «оставить
 * поле пустым» в форме означает «не менять пароль», а не «стереть его».
 */
export function mockPatchMail(patch: MailServerPayload): MailServerSettings {
  const { password, ...rest } = patch
  Object.assign(mailStore, rest)
  if (typeof password === 'string' && password.length > 0) mailPassword = password
  return mockGetMail()
}

/**
 * Настроен ли сервер настолько, чтобы через него можно было отправить письмо.
 *
 * Правило берётся из `isMailConfigured` — того же, по которому гаснут кнопки на
 * фронте. Своей формулировки у сервера нет: она была третьей записью одного правила
 * и разъехалась бы с двумя другими молча.
 */
export function mockIsMailConfigured(): boolean {
  return isMailConfigured(mockGetMail())
}

/**
 * Тестовое письмо: сервер отправляет его самому себе на адрес отправителя.
 * Недонастроенный сервер отвечает отказом, а не молчаливым успехом — иначе
 * кнопка «проверить» проверяла бы только саму себя.
 */
export function mockSendMailTest(): { deliveredTo: string } {
  if (!mockIsMailConfigured()) throw new Error('MAIL_NOT_CONFIGURED')
  return { deliveredTo: mailStore.fromEmail }
}

// ─── Profile ─────────────────────────────────────────────────────────────

export function mockGetProfile(): UserProfile {
  return structuredClone(settingsStore.profile)
}

export function mockSaveProfile(data: UserProfile): void {
  settingsStore.profile = structuredClone(data)
}

/** Merge-patch profile — only provided fields are updated */
export function mockPatchProfile(patch: Partial<UserProfile>): UserProfile {
  Object.assign(settingsStore.profile, patch)
  return structuredClone(settingsStore.profile)
}

// ─── Warehouse map ───────────────────────────────────────────────────────
//
// Одна карта, одно место хранения. PUT заменяет её целиком — версий нет, поэтому
// «обновить» и «загрузить новую» это одно и то же действие, и второго реестра карт
// (в складском моке или где-то ещё) быть не должно.

export function mockGetWarehouseMap(): WarehouseMapFile | null {
  return settingsStore.warehouseMap ? structuredClone(settingsStore.warehouseMap) : null
}

export function mockSaveWarehouseMap(data: WarehouseMapFile): WarehouseMapFile {
  // Карта — это картинка. Сервер не верит клиенту на слово о типе файла, потому что
  // страница показывает её через <img> и открывает как изображение.
  if (!data.mime.startsWith('image/')) throw new Error('MAP_NOT_AN_IMAGE')
  settingsStore.warehouseMap = structuredClone(data)
  return structuredClone(settingsStore.warehouseMap)
}

export function mockDeleteWarehouseMap(): void {
  settingsStore.warehouseMap = null
}
