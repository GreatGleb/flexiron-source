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

/** Идентификатор формулы для динамического пересчёта */
export type ConversionFormulaType = 'weight_per_meter' | 'area_to_weight' | 'pcs_to_weight'

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
