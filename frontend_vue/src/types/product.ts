import type { CategoryFieldType } from './category'
import type { TranslatedString } from './i18n'
import type { SupplierAuditEntry } from './supplier'

// PriceUnit is now dynamic from settings; keep as string alias for backward compat
export type PriceUnit = string

export interface ProductFieldValue {
  fieldId: string
  fieldName: TranslatedString
  fieldType: CategoryFieldType
  value: string | number | boolean | string[] | null
  inherited: boolean
  options?: TranslatedString[]
}

export interface LinkedSupplier {
  id: string
  name: TranslatedString
  price: number | null
  /**
   * За что берётся цена поставщика — id единицы из справочника (`uom-kg`, `uom-pcs`, …).
   *
   * Здесь стояла собранная подпись вида `EUR/pcs`, и код единицы в ней был всегда
   * английским: `uom.code.en`. То есть литовский пользователь, добавив поставщика,
   * записывал в данные `pcs` вместо `vnt` — «показали не на том языке» чинится в
   * шаблоне, «сохранили не на том языке» читает потом кто-то другой. Валюта цены
   * лежит в `currency` рядом, второй раз её хранить незачем; подпись собирается там,
   * где её показывают.
   */
  priceUomId: string | null
  leadDays: number | null
  currency: string | null // snapshot of supplier's currency at time of linking
}

export interface ProductListItem {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  price: number | null
  minStock: number | null
  avgCostPrice: number | null
  /** Average price actually achieved on shipped sales; `null` when nothing sold. */
  avgSalePrice?: number | null
  createdAt: string

  // UoM references for unit display in order modals
  saleUomId: string | null
  warehouseUomId: string | null
  warehouseToSaleFactor: number | null
}

export interface Product {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  description: TranslatedString | null

  // === Pricing ===
  price: number | null
  priceQuantity: number // price per N sale units (default 1)
  currencyId: string | null
  minStock: number | null
  avgCostPrice: number | null
  avgSalePrice: number | null

  // === UoM references (3 separate) ===
  purchaseUomId: string | null
  warehouseUomId: string | null
  saleUomId: string | null

  // === Conversion overrides (optional) ===
  purchaseToWarehouseFormulaType: string | null
  purchaseToWarehouseFactor: number | null
  warehouseToSaleFormulaType: string | null
  warehouseToSaleFactor: number | null

  /**
   * Килограммов в ОДНОЙ складской единице этого товара.
   *
   * Знаменатель не хранится, потому что он и есть `warehouseUomId`: у метрового товара
   * это кг/м, у площадного кг/м², у штучного кг/шт. Одна величина, а не три — в
   * кастомных полях каталога она лежала под тремя написаниями («Вес на метр (кг)» 26
   * товаров, «Вес на метр (кг/м)» 12, «Вес на м² (кг)» 30), то есть два написания
   * одного и того же плюс площадной вариант.
   *
   * НЕ переиспользует `purchaseToWarehouseFactor` / `warehouseToSaleFactor`: те отвечают
   * на конкретные пары единиц (закупка→склад, склад→продажа) и совпали бы с этим числом
   * только там, где одна из сторон случайно килограммы. Вывод «когда получится» — это
   * выдуманный коэффициент, замаскированный под существующее поле.
   *
   * `null` у килограммовых и тонных товаров СОЗНАТЕЛЬНО: там это 1 и 1000, то есть
   * пересказ единицы, а выведенная константа рядом с тем, из чего она выводится, —
   * вторая правда об одном числе.
   */
  weightPerWarehouseUnitKg: number | null

  createdAt: string
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
  auditLog: SupplierAuditEntry[]
}

export interface ProductFilters {
  search: string
  categoryIds: string[]
  sortBy: 'name' | 'category' | 'price' | null
  sortDir: 'asc' | 'desc'
}
