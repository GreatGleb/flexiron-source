import type { TranslatedString } from './i18n'

/**
 * Цена услуги — сумма, валюта и единица, тремя отдельными полями.
 *
 * Раньше единица была строковым союзом `'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'`, то
 * есть валюта была вварена в единицу измерения. Следствие: услуга в валюте, отличной
 * от евро, была невыразима в принципе — при том что строка заказа в другой валюте
 * возможна, а у товара уже есть `currencyId` и единица из справочника.
 * Насколько глубоко это въелось, видно по тому, как модалка заказа доставала единицу:
 * `priceUnit.replace('EUR/', '')`.
 *
 * Выведенного поля-подписи здесь намеренно нет. Подпись «EUR/шт» собирается там, где
 * её показывают: хранить её рядом значит завести вторую правду об одной величине —
 * ровно то, что чинилось в оплатах и в ленте логов. У товара такое поле осталось
 * (`Product.priceUnit`, помечено legacy) и держится ради одного места; повторять это
 * незачем — бэкенда нет, совместимость держать не для кого.
 */
export interface Service {
  id: string
  name: TranslatedString
  costPrice: number
  sellingPrice: number
  /** Валюта цены — id из справочника валют. */
  currencyId: string
  /** За что берётся цена — id единицы из справочника (`uom-pcs`, `uom-h`, …). */
  uomId: string
  description?: TranslatedString
  createdAt: string
  updatedAt: string
}

/** @deprecated Use Service instead — both types are identical */
export type ServiceListItem = Service

export interface ServiceFilters {
  search: string
  sortBy: 'name' | 'costPrice' | 'sellingPrice' | 'createdAt'
  sortDir: 'asc' | 'desc'
}

export type ServiceCreatePayload = {
  name: string
  costPrice: number
  sellingPrice: number
  currencyId: string
  uomId: string
  description?: string
}

export type ServicePatchPayload = Partial<ServiceCreatePayload>
