import type { Product, ProductListItem, ProductFieldValue, ProductFilters, PriceUnit } from '@/types/product'
import type { PaginatedResponse } from '@/types/api'
import { mockGetCategory } from './categories'

// fieldIds from categories.ts STORE:
// cat-2 Sheets: f-2-1 (number), f-2-2 (enum), f-2-3 (text) + inherited: f-1-1 (text), f-1-2 (text)
// cat-4 Pipes:  f-4-1 (number), f-4-2 (number)              + inherited: f-1-1 (text), f-1-2 (text)
// cat-5 Consumables: f-5-1 (enum), f-5-2 (boolean), f-5-3 (date)
// cat-6 Equipment:   f-6-1 (text), f-6-2 (number), f-6-3 (email), f-6-4 (file)

const STORE: Product[] = [
  {
    id: 'prod-001',
    name: 'Steel Sheet 3mm',
    categoryId: 'cat-2',
    categoryName: 'Sheets',
    sku: 'SS-3-1000',
    description: 'Hot-rolled steel sheet, 1000x2000mm',
    price: 120.50,
    minStock: 50,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-01-15',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: 'Steel grade', fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: 'Standard / GOST', fieldType: 'text', value: 'EN 10051', inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: 'Thickness (mm)', fieldType: 'number', value: 3, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: 'Sheet type', fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { fieldId: 'f-2-3', fieldName: 'Dimensions (mm)', fieldType: 'text', value: '1000x2000', inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: 115.00, priceUnit: 'EUR/vnt', leadDays: 7 },
      { id: '2', name: 'Metal Trade LT', price: 118.00, priceUnit: 'EUR/vnt', leadDays: 14 },
    ],
  },
  {
    id: 'prod-002',
    name: 'Aluminium Sheet 2mm',
    categoryId: 'cat-2',
    categoryName: 'Sheets',
    sku: 'AL-2-500',
    description: null,
    price: 85.00,
    minStock: 20,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-02-20',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: 'Steel grade', fieldType: 'text', value: 'AMg2', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: 'Standard / GOST', fieldType: 'text', value: 'GOST 21631', inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: 'Thickness (mm)', fieldType: 'number', value: 2, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: 'Sheet type', fieldType: 'enum', value: 'Cold-rolled', inherited: false, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { fieldId: 'f-2-3', fieldName: 'Dimensions (mm)', fieldType: 'text', value: '500x1000', inherited: false, options: [] },
    ],
    linkedSuppliers: [],
  },
  {
    id: 'prod-003',
    name: 'Steel Pipe 60x4',
    categoryId: 'cat-4',
    categoryName: 'Pipes',
    sku: 'SP-60-4',
    description: 'Round seamless steel pipe',
    price: 45.00,
    minStock: 100,
    priceUnit: 'EUR/m',
    createdAt: '2025-03-01',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: 'Steel grade', fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: 'Standard / GOST', fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: 'Diameter (mm)', fieldType: 'number', value: 60, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: 'Wall thickness (mm)', fieldType: 'number', value: 4, inherited: false, options: [] },
    ],
    linkedSuppliers: [
      { id: '3', name: 'Nordic Steel AB', price: 42.00, priceUnit: 'EUR/m', leadDays: 10 },
    ],
  },
  {
    id: 'prod-004',
    name: 'Steel Pipe 100x5',
    categoryId: 'cat-4',
    categoryName: 'Pipes',
    sku: 'SP-100-5',
    description: null,
    price: 78.00,
    minStock: null,
    priceUnit: 'EUR/m',
    createdAt: '2025-03-15',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: 'Steel grade', fieldType: 'text', value: 'S355JR', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: 'Standard / GOST', fieldType: 'text', value: 'EN 10210', inherited: true, options: [] },
      { fieldId: 'f-4-1', fieldName: 'Diameter (mm)', fieldType: 'number', value: 100, inherited: false, options: [] },
      { fieldId: 'f-4-2', fieldName: 'Wall thickness (mm)', fieldType: 'number', value: 5, inherited: false, options: [] },
    ],
    linkedSuppliers: [],
  },
  {
    id: 'prod-005',
    name: 'Welding Wire 1.2mm',
    categoryId: 'cat-5',
    categoryName: 'Consumables',
    sku: 'WW-1.2',
    description: 'MIG/MAG welding wire, copper coated',
    price: 12.50,
    minStock: 200,
    priceUnit: 'EUR/kg',
    createdAt: '2025-04-01',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: 'Unit of measure', fieldType: 'enum', value: 'kg', inherited: false, options: ['pcs', 'kg', 'm', 'l'] },
      { fieldId: 'f-5-2', fieldName: 'Hazardous material', fieldType: 'boolean', value: false, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: 'Expiry date', fieldType: 'date', value: '2027-12-31', inherited: false, options: [] },
    ],
    linkedSuppliers: [],
  },
  {
    id: 'prod-006',
    name: 'Cutting Oil',
    categoryId: 'cat-5',
    categoryName: 'Consumables',
    sku: null,
    description: 'Metalworking cutting fluid concentrate',
    price: null,
    minStock: 10,
    priceUnit: 'EUR/kg',
    createdAt: '2025-04-10',
    fieldValues: [
      { fieldId: 'f-5-1', fieldName: 'Unit of measure', fieldType: 'enum', value: 'l', inherited: false, options: ['pcs', 'kg', 'm', 'l'] },
      { fieldId: 'f-5-2', fieldName: 'Hazardous material', fieldType: 'boolean', value: true, inherited: false, options: [] },
      { fieldId: 'f-5-3', fieldName: 'Expiry date', fieldType: 'date', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [],
  },
  {
    id: 'prod-007',
    name: 'Angle Grinder 125mm',
    categoryId: 'cat-6',
    categoryName: 'Equipment',
    sku: 'AG-125',
    description: null,
    price: 89.00,
    minStock: 5,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-05-01',
    fieldValues: [
      { fieldId: 'f-6-1', fieldName: 'Manufacturer', fieldType: 'text', value: 'Bosch', inherited: false, options: [] },
      { fieldId: 'f-6-2', fieldName: 'Warranty (months)', fieldType: 'number', value: 24, inherited: false, options: [] },
      { fieldId: 'f-6-3', fieldName: 'Supplier email', fieldType: 'email', value: 'tools@bosch.com', inherited: false, options: [] },
      { fieldId: 'f-6-4', fieldName: 'Equipment passport', fieldType: 'file', value: null, inherited: false, options: [] },
    ],
    linkedSuppliers: [],
  },
  {
    id: 'prod-008',
    name: 'Galvanized Sheet 1.5mm',
    categoryId: 'cat-2',
    categoryName: 'Sheets',
    sku: 'GS-1.5',
    description: 'Galvanized steel sheet Z275',
    price: 95.00,
    minStock: 30,
    priceUnit: 'EUR/vnt',
    createdAt: '2025-05-15',
    fieldValues: [
      { fieldId: 'f-1-1', fieldName: 'Steel grade', fieldType: 'text', value: 'S320GD', inherited: true, options: [] },
      { fieldId: 'f-1-2', fieldName: 'Standard / GOST', fieldType: 'text', value: 'EN 10346', inherited: true, options: [] },
      { fieldId: 'f-2-1', fieldName: 'Thickness (mm)', fieldType: 'number', value: 1.5, inherited: false, options: [] },
      { fieldId: 'f-2-2', fieldName: 'Sheet type', fieldType: 'enum', value: 'Galvanized', inherited: false, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { fieldId: 'f-2-3', fieldName: 'Dimensions (mm)', fieldType: 'text', value: '1250x2500', inherited: false, options: [] },
    ],
    linkedSuppliers: [],
  },
  {
    id: 'prod-009',
    name: 'Uncategorized Material',
    categoryId: null,
    categoryName: null,
    sku: null,
    description: null,
    price: 55.00,
    minStock: null,
    priceUnit: 'EUR/kg',
    createdAt: '2025-06-01',
    fieldValues: [],
    linkedSuppliers: [],
  },
]

let idSeq = 100

function toListItem(p: Product): ProductListItem {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    sku: p.sku,
    price: p.price,
    minStock: p.minStock,
    priceUnit: p.priceUnit,
    createdAt: p.createdAt,
  }
}

export function mockGetProducts(filters: ProductFilters): PaginatedResponse<ProductListItem> {
  let filtered = STORE.filter((p) => {
    const matchSearch = filters.search
      ? p.name.toLowerCase().includes(filters.search.toLowerCase())
      : true
    const matchCat = filters.categoryId !== null ? p.categoryId === filters.categoryId : true
    return matchSearch && matchCat
  })
  filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))
  return {
    items: structuredClone(filtered.map(toListItem)),
    total: filtered.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  }
}

export function mockGetProduct(id: string): Product | undefined {
  const p = STORE.find((p) => p.id === id)
  return p ? structuredClone(p) : undefined
}

export function mockCreateProduct(data: {
  name: string
  categoryId?: string | null
  sku?: string | null
  description?: string | null
  price?: number | null
  minStock?: number | null
  priceUnit?: PriceUnit | null
}): Product {
  const newProduct: Product = {
    id: `prod-${++idSeq}`,
    name: data.name,
    categoryId: data.categoryId ?? null,
    categoryName: data.categoryId ? (mockGetCategory(data.categoryId)?.name ?? null) : null,
    sku: data.sku ?? null,
    description: data.description ?? null,
    price: data.price ?? null,
    minStock: data.minStock ?? null,
    priceUnit: data.priceUnit ?? null,
    createdAt: new Date().toISOString().split('T')[0] as string,
    fieldValues: [],
    linkedSuppliers: [],
  }
  STORE.push(newProduct)
  return structuredClone(newProduct)
}

export function mockPatchProduct(
  id: string,
  delta: Partial<Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit' | 'fieldValues'>>,
): Product | undefined {
  const p = STORE.find((p) => p.id === id)
  if (!p) return undefined
  if (delta.name !== undefined) p.name = delta.name
  if (delta.sku !== undefined) p.sku = delta.sku
  if (delta.description !== undefined) p.description = delta.description
  if (delta.price !== undefined) p.price = delta.price
  if (delta.minStock !== undefined) p.minStock = delta.minStock
  if (delta.priceUnit !== undefined) p.priceUnit = delta.priceUnit
  if (delta.fieldValues !== undefined) p.fieldValues = JSON.parse(JSON.stringify(delta.fieldValues)) as ProductFieldValue[]
  return structuredClone(p)
}

export function mockDeleteProduct(id: string): boolean {
  const idx = STORE.findIndex((p) => p.id === id)
  if (idx === -1) return false
  STORE.splice(idx, 1)
  return true
}
