import type { TranslatedString } from '@/types/i18n'

/** Реквизиты компании */
export interface CompanyInfo {
  name: string
  legalAddress: string
  vatCode: string
  bankName: string
  bankAccount: string
  logoUrl?: string
}

/** Глобальные финансовые константы */
export interface GlobalConstants {
  vatRate: number
  defaultMargin: number
  defaultCurrency: string
  defaultDiscountPercent: number
}

/** Валюта */
export interface Currency {
  id: string
  code: string
  name: TranslatedString
  isDefault: boolean
  updatedAt?: string
}

/** Категория единицы измерения */
export type UomCategory =
  | 'weight'
  | 'length'
  | 'area'
  | 'volume'
  | 'quantity'
  | 'density'
  | 'thickness'
  /** Час у услуги. Во времени ничего не взвешивают — правил пересчёта у него нет. */
  | 'time'

/** Тип правила пересчёта */
export type ConversionType = 'static' | 'dynamic'

/**
 * Идентификаторы формул динамического пересчёта — единственный список в проекте.
 *
 * Список рантаймовый, а тип выводится из него: опции селекта и подписи
 * (`settingsUom.formula_<имя>`) собираются из этого же массива, поэтому
 * добавленная формула не может остаться без варианта в форме. Поля товара
 * (`purchaseToWarehouseFormulaType`, `warehouseToSaleFormulaType`) ссылаются
 * сюда же: раньше они были `string`, и в сидах лежали имена, которых нет
 * ни в одном справочнике.
 */
export const CONVERSION_FORMULA_TYPES = [
  'weight_per_meter',
  'area_to_weight',
  'pcs_to_weight',
] as const

/** Идентификатор формулы для динамического пересчёта */
export type ConversionFormulaType = (typeof CONVERSION_FORMULA_TYPES)[number]

/** Строка пришла извне (форма, payload) — проверить, что это имя формулы, а не любой текст */
export function isConversionFormulaType(value: string): value is ConversionFormulaType {
  return (CONVERSION_FORMULA_TYPES as readonly string[]).includes(value)
}

/** Единица измерения */
export interface Uom {
  id: string
  code: TranslatedString
  name: TranslatedString
  category: UomCategory
}

/** Правило пересчёта единиц */
export interface UomConversion {
  id: string
  fromUomId: string
  toUomId: string
  type: ConversionType
  factor?: number
  formulaType?: ConversionFormulaType
}

/** Статус заказа */
export interface OrderStatusSetting {
  id: string
  name: TranslatedString
  color: string
  order: number
  system?: boolean
  /** Резервировать остаток при переходе в этот статус */
  reserveOnTransition?: boolean
  /** Списывать остаток при переходе в этот статус */
  writeOffOnTransition?: boolean
}

/**
 * Карта склада — картинка, и только одна.
 *
 * Место хранения партии осталось свободным текстом, справочника секторов не будет
 * (решение ревью, п. 3), поэтому карта — это фотография, которую открывают глазами,
 * а не структура, по которой что-то ищут. Хранится только текущая: истории версий
 * нет, загрузка новой заменяет прежнюю.
 *
 * Поля повторяют ответ `POST /api/uploads` (`UploadedFile`): страница загружает файл
 * штатным путём и кладёт сюда то, что вернул сервер, ничего не пересобирая.
 */
export interface WarehouseMapFile {
  fileId: string
  name: string
  mime: string
  size: number
  /** Прямая ссылка на файл — по ней он и открывается в новой вкладке. */
  url: string
  uploadedAt: string
}

/** Шифрование SMTP-соединения */
export const MAIL_ENCRYPTIONS = ['none', 'ssl', 'starttls'] as const

/** Идентификатор шифрования — список и тип живут в одном месте */
export type MailEncryption = (typeof MAIL_ENCRYPTIONS)[number]

/** Строка пришла извне (форма, payload) — проверить, что это способ шифрования, а не любой текст */
export function isMailEncryption(value: string): value is MailEncryption {
  return (MAIL_ENCRYPTIONS as readonly string[]).includes(value)
}

/**
 * Почтовый сервер: через него уходят письма поставщикам (BCC-инструмент, спека 04.2 §6).
 *
 * **Пароля здесь нет и не будет.** Сервер его не отдаёт при чтении настроек — только
 * принимает при записи, — а раз поля нет в типе, пароль физически некуда положить: ни в
 * стор `useSettings`, ни в его кэш в localStorage. Признак «пароль задан» приходит
 * отдельным булевым полем: форме надо знать, есть он или нет, а не какой он.
 */
export interface MailServerSettings {
  host: string
  port: number
  encryption: MailEncryption
  /** Логин SMTP. Часто совпадает с адресом отправителя, но не обязан. */
  username: string
  /** Пароль/токен задан на сервере. Сам он не приходит никогда. */
  passwordSet: boolean
  /** Адрес в поле From — от него уходит письмо. */
  fromEmail: string
  /** Имя в поле From — его видит получатель рядом с адресом. */
  fromName: string
}

/**
 * Что уходит на сервер при сохранении почтовых настроек.
 *
 * `passwordSet` сюда не входит: это ответ сервера о своём состоянии, а не поле формы.
 * `password` — наоборот, только здесь: он пишется и не читается.
 */
export interface MailServerPayload extends Partial<Omit<MailServerSettings, 'passwordSet'>> {
  /** Новый пароль/токен. Пустая строка не отправляется — она означала бы «стереть». */
  password?: string
}

/** Роль пользователя */
export type UserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'warehouse'
  | 'accounting'
  | 'viewer'
  | 'user'

/** Пользователь системы */
export interface SettingUser {
  id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  lastLogin?: string
}

/** Профиль текущего пользователя */
export interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  role: UserRole
  secretLink?: string
}

/** Полный срез настроек системы */
/**
 * The three things the pricing model puts behind a right (model section 12), as
 * lists of roles.
 *
 * Roles are the ones the users list uses — owner, admin, manager, warehouse,
 * accounting — not the role names in the supplier card's permission matrix, which
 * is a different vocabulary for a different purpose (which fields of that card a
 * role may see).
 */
export interface OrderPermissions {
  /** See cost and margin. Without it the card shows only what the client pays. */
  seeCost: string[]
  /** Type a cost by hand, with a mandatory reason. */
  manualCost: string[]
  /** Correct what has already been shipped or invoiced. */
  correction: string[]
}

export interface AppSettings {
  company: CompanyInfo
  constants: GlobalConstants
  /** Почтовый сервер — один на арендатора, без пароля (см. `MailServerSettings`). */
  mail: MailServerSettings
  orderPermissions: OrderPermissions
  currencies: Currency[]
  uoms: Uom[]
  conversions: UomConversion[]
  orderStatuses: OrderStatusSetting[]
  /** Текущая карта склада, или её нет. Единственное место хранения — второго реестра быть не должно. */
  warehouseMap: WarehouseMapFile | null
  users: SettingUser[]
  profile: UserProfile
}
