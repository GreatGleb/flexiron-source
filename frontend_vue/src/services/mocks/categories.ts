import type { Category, CategoryField, CategoryListItem, CategoryFilters } from '@/types/category'
import type { LinkedSupplier } from '@/types/product'
import type { PaginatedResponse } from '@/types/api'

// ─── STORE ───────────────────────────────────────────────────────────────────

const STORE: Category[] = [
  {
    id: 'cat-1',
    name: 'Metal',
    parentId: null,
    description: 'All types of metal products',
    fieldCount: 3,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '2', name: 'Metal Trade LT', price: null, priceUnit: null, leadDays: 14 },
      { id: '6', name: 'EuroSteel GmbH', price: null, priceUnit: null, leadDays: 14 },
    ],
  },
  {
    id: 'cat-2',
    name: 'Sheets',
    parentId: 'cat-1',
    description: 'Flat-rolled metal sheets',
    fieldCount: 5,
    productCount: 12,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-2-1', name: 'Thickness (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-2-2', name: 'Sheet type', type: 'enum', required: false, order: 1, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { id: 'f-2-3', name: 'Width (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-2-4', name: 'Length (mm)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-2-5', name: 'Weight per m² (kg)', type: 'number', required: false, order: 4, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '2', name: 'Metal Trade LT', price: null, priceUnit: null, leadDays: 14 },
      { id: '3', name: 'Nordic Steel AB', price: null, priceUnit: null, leadDays: 10 },
    ],
  },
  {
    id: 'cat-3',
    name: 'Aluminium sheets',
    parentId: 'cat-2',
    description: null,
    fieldCount: 1,
    productCount: 4,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-2-1', name: 'Thickness (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-2-2', name: 'Sheet type', type: 'enum', required: false, order: 1, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { id: 'f-2-3', name: 'Width (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-2-4', name: 'Length (mm)', type: 'number', required: false, order: 3, options: [] },
    ],
    fields: [
      { id: 'f-3-1', name: 'Alloy', type: 'enum', required: true, order: 0, options: ['AMts', 'AMg2', 'AMg3', 'D16', '1561'] },
    ],
    linkedSuppliers: [
      { id: '3', name: 'Nordic Steel AB', price: null, priceUnit: null, leadDays: 10 },
    ],
  },
  {
    id: 'cat-4',
    name: 'Pipes',
    parentId: 'cat-1',
    description: 'Tubular metal products',
    fieldCount: 7,
    productCount: 8,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-4-1', name: 'Diameter (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-4-2', name: 'Wall thickness (mm)', type: 'number', required: true, order: 1, options: [] },
      { id: 'f-4-3', name: 'Length (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-4-4', name: 'Pipe type', type: 'enum', required: false, order: 3, options: ['Round', 'Square', 'Rectangular'] },
      { id: 'f-4-5', name: 'Bend radius (mm)', type: 'number', required: false, order: 4, options: [] },
      { id: 'f-4-6', name: 'Width (mm)', type: 'number', required: false, order: 5, options: [] },
      { id: 'f-4-7', name: 'Weight per meter (kg)', type: 'number', required: false, order: 6, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '4', name: 'Baltic Metals SIA', price: null, priceUnit: null, leadDays: 10 },
    ],
  },
  {
    id: 'cat-5',
    name: 'Consumables',
    parentId: null,
    description: null,
    fieldCount: 3,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-5-1', name: 'Unit of measure', type: 'enum', required: true, order: 0, options: ['pcs', 'kg', 'm', 'l'] },
      { id: 'f-5-2', name: 'Hazardous material', type: 'boolean', required: false, order: 1, options: [] },
      { id: 'f-5-3', name: 'Expiry date', type: 'date', required: false, order: 2, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: 'Euro Metal GmbH', price: null, priceUnit: null, leadDays: 21 },
    ],
  },
  {
    id: 'cat-6',
    name: 'Equipment',
    parentId: null,
    description: 'Industrial equipment',
    fieldCount: 4,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-6-1', name: 'Manufacturer', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-6-2', name: 'Warranty (months)', type: 'number', required: false, order: 1, options: [] },
      { id: 'f-6-3', name: 'Supplier email', type: 'email', required: false, order: 2, options: [] },
      { id: 'f-6-4', name: 'Equipment passport', type: 'file', required: false, order: 3, options: [] },
    ],
    linkedSuppliers: [
      { id: '5', name: 'Euro Metal GmbH', price: null, priceUnit: null, leadDays: 21 },
      { id: '6', name: 'IronBridge Corp', price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-7',
    name: 'Beams',
    parentId: 'cat-1',
    description: 'IPE/HEA/HEB structural steel beams',
    fieldCount: 7,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-7-1', name: 'Profile type', type: 'enum', required: true, order: 0, options: ['IPE', 'HEA', 'HEB', 'IPN', 'UPN'] },
      { id: 'f-7-2', name: 'Height (mm)', type: 'number', required: true, order: 1, options: [] },
      { id: 'f-7-3', name: 'Flange width (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-7-4', name: 'Flange thickness (mm)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-7-5', name: 'Web thickness (mm)', type: 'number', required: false, order: 4, options: [] },
      { id: 'f-7-6', name: 'Length (mm)', type: 'number', required: false, order: 5, options: [] },
      { id: 'f-7-7', name: 'Weight per meter (kg/m)', type: 'number', required: false, order: 6, options: [] },
    ],
    linkedSuppliers: [
      { id: '2', name: 'Metal Trade LT', price: null, priceUnit: null, leadDays: 5 },
      { id: '6', name: 'IronBridge Corp', price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-8',
    name: 'Channels',
    parentId: 'cat-1',
    description: 'Steel channel sections (UPN/UPE)',
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-8-1', name: 'Height (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-8-2', name: 'Flange width (mm)', type: 'number', required: false, order: 1, options: [] },
      { id: 'f-8-3', name: 'Wall thickness (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-8-4', name: 'Flange thickness (mm)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-8-5', name: 'Length (mm)', type: 'number', required: false, order: 4, options: [] },
      { id: 'f-8-6', name: 'Weight per meter (kg/m)', type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '6', name: 'IronBridge Corp', price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-9',
    name: 'Angles',
    parentId: 'cat-1',
    description: 'Equal and unequal steel angle bars',
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-9-1', name: 'Side width (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-9-2', name: 'Thickness (mm)', type: 'number', required: true, order: 1, options: [] },
      { id: 'f-9-3', name: 'Second side width (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-9-4', name: 'Length (mm)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-9-5', name: 'Type', type: 'enum', required: false, order: 4, options: ['Equal', 'Unequal'] },
      { id: 'f-9-6', name: 'Weight per meter (kg/m)', type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '2', name: 'Metal Trade LT', price: null, priceUnit: null, leadDays: 5 },
    ],
  },
  {
    id: 'cat-10',
    name: 'Rebars',
    parentId: 'cat-1',
    description: 'Reinforcement steel bars',
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-10-1', name: 'Diameter (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-10-2', name: 'Length (mm)', type: 'number', required: false, order: 1, options: [] },
      { id: 'f-10-3', name: 'Class', type: 'enum', required: false, order: 2, options: ['A240', 'A400', 'A500C', 'B500C'] },
      { id: 'f-10-4', name: 'Weight per meter (kg/m)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-10-5', name: 'Tensile strength (MPa)', type: 'number', required: false, order: 4, options: [] },
      { id: 'f-10-6', name: 'Yield strength (MPa)', type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '4', name: 'Baltic Metal Group', price: null, priceUnit: null, leadDays: 14 },
      { id: '6', name: 'IronBridge Corp', price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-11',
    name: 'Profiles',
    parentId: 'cat-1',
    description: 'Square and rectangular hollow sections, flat and round bars',
    fieldCount: 6,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-11-1', name: 'Profile type', type: 'enum', required: true, order: 0, options: ['Square tube', 'Rectangular tube', 'Flat bar', 'Round bar'] },
      { id: 'f-11-2', name: 'Height (mm)', type: 'number', required: true, order: 1, options: [] },
      { id: 'f-11-3', name: 'Width (mm)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-11-4', name: 'Wall thickness (mm)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-11-5', name: 'Length (mm)', type: 'number', required: false, order: 4, options: [] },
      { id: 'f-11-6', name: 'Weight per meter (kg/m)', type: 'number', required: false, order: 5, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '4', name: 'Baltic Metal Group', price: null, priceUnit: null, leadDays: 14 },
    ],
  },
  {
    id: 'cat-12',
    name: 'Wire',
    parentId: 'cat-1',
    description: 'Steel wire in coils and spools',
    fieldCount: 5,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-12-1', name: 'Diameter (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-12-2', name: 'Coating', type: 'enum', required: false, order: 1, options: ['Bare', 'Galvanized', 'Zinc-coated', 'Copper-coated'] },
      { id: 'f-12-3', name: 'Spool weight (kg)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-12-4', name: 'Tensile strength (MPa)', type: 'number', required: false, order: 3, options: [] },
      { id: 'f-12-5', name: 'Weight per meter (kg/m)', type: 'number', required: false, order: 4, options: [] },
    ],
    linkedSuppliers: [
      { id: '1', name: 'Steel Plus OÜ', price: null, priceUnit: null, leadDays: 7 },
      { id: '6', name: 'IronBridge Corp', price: null, priceUnit: null, leadDays: 9 },
    ],
  },
  {
    id: 'cat-13',
    name: 'Fittings',
    parentId: 'cat-1',
    description: 'Pipe fittings and connectors',
    fieldCount: 5,
    productCount: 0,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
      { id: 'f-1-3', name: 'Density (kg/m³)', type: 'number', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-13-1', name: 'Type', type: 'enum', required: true, order: 0, options: ['Elbow 90°', 'Elbow 45°', 'Tee', 'Reducer', 'Flange', 'Coupling', 'Cap'] },
      { id: 'f-13-2', name: 'Size DN (mm)', type: 'number', required: true, order: 1, options: [] },
      { id: 'f-13-3', name: 'Pressure rating (bar)', type: 'number', required: false, order: 2, options: [] },
      { id: 'f-13-4', name: 'Connection type', type: 'enum', required: false, order: 3, options: ['Threaded', 'Welded', 'Flanged'] },
      { id: 'f-13-5', name: 'Weight (kg)', type: 'number', required: false, order: 4, options: [] },
    ],
    linkedSuppliers: [
      { id: '4', name: 'Baltic Metal Group', price: null, priceUnit: null, leadDays: 14 },
      { id: '5', name: 'Euro Metal GmbH', price: null, priceUnit: null, leadDays: 21 },
    ],
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLevel(id: string): number {
  let level = 0
  let current = STORE.find((c) => c.id === id)
  while (current?.parentId) {
    level++
    current = STORE.find((c) => c.id === current!.parentId)
  }
  return level
}

function getParentName(parentId: string | null): string | null {
  if (!parentId) return null
  return STORE.find((c) => c.id === parentId)?.name ?? null
}

function hasChildren(id: string): boolean {
  return STORE.some((c) => c.parentId === id)
}

function toListItem(cat: Category): CategoryListItem {
  return {
    id: cat.id,
    name: cat.name,
    parentId: cat.parentId,
    parentName: getParentName(cat.parentId),
    fieldCount: cat.fieldCount,
    productCount: cat.productCount,
    level: getLevel(cat.id),
  }
}

function depthFirstSort(items: Category[]): Category[] {
  const result: Category[] = []
  function visit(parentId: string | null) {
    items
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
      .forEach((c) => { result.push(c); visit(c.id) })
  }
  visit(null)
  return result
}

function cascadeInheritedFields(parentId: string): void {
  const parent = STORE.find((c) => c.id === parentId)
  if (!parent) return
  STORE.filter((c) => c.parentId === parentId).forEach((child) => {
    child.inheritedFields = [...parent.inheritedFields, ...parent.fields]
    cascadeInheritedFields(child.id)
  })
}

let idSeq = 100
let fieldSeq = 1000

// ─── Mock functions ───────────────────────────────────────────────────────────

export function mockGetCategories(
  filters: CategoryFilters,
  page = 1,
  pageSize = 25,
): PaginatedResponse<CategoryListItem> {
  const filtered = STORE.filter((c) =>
    filters.search ? c.name.toLowerCase().includes(filters.search.toLowerCase()) : true,
  )
  const sorted = filters.search
    ? filtered.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'))
    : depthFirstSort(STORE)
  const total = sorted.length
  const totalPages = Math.ceil(total / pageSize)
  const page_items = sorted.slice((page - 1) * pageSize, page * pageSize)
  return {
    items: page_items.map(toListItem),
    total,
    page,
    pageSize,
    totalPages,
  }
}

export function mockGetCategory(id: string): Category | undefined {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return undefined
  return structuredClone(cat)
}

export function mockCreateCategory(data: {
  name: string
  parentId?: string | null
  description?: string | null
}): Category {
  const parentId = data.parentId ?? null

  // прямой родитель уже хранит накопленную цепочку inheritedFields + свои fields
  const parent = STORE.find((c) => c.id === parentId)
  const inheritedFields: CategoryField[] = parent
    ? [...parent.inheritedFields, ...parent.fields]
    : []

  const newCat: Category = {
    id: `cat-${++idSeq}`,
    name: data.name,
    parentId,
    description: data.description ?? null,
    fieldCount: 0,
    productCount: 0,
    inheritedFields,
    fields: [],
    linkedSuppliers: [],
  }
  STORE.push(newCat)
  return structuredClone(newCat)
}

export function mockPatchCategory(
  id: string,
  delta: Partial<Pick<Category, 'name' | 'parentId' | 'description'>> & { linkedSuppliers?: LinkedSupplier[] },
): Category | undefined {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return undefined
  if (delta.name !== undefined) cat.name = delta.name
  if (delta.description !== undefined) cat.description = delta.description
  if (delta.linkedSuppliers !== undefined)
    cat.linkedSuppliers = JSON.parse(JSON.stringify(delta.linkedSuppliers)) as LinkedSupplier[]
  if (delta.parentId !== undefined) {
    cat.parentId = delta.parentId
    const parent = STORE.find((c) => c.id === delta.parentId)
    cat.inheritedFields = parent ? [...parent.inheritedFields, ...parent.fields] : []
    cascadeInheritedFields(cat.id)
  }
  return structuredClone(cat)
}

export function mockDeleteCategory(id: string): { ok: boolean; code?: string } {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return { ok: false, code: 'CATEGORY_NOT_FOUND' }
  if (cat.productCount > 0) return { ok: false, code: 'CATEGORY_HAS_PRODUCTS' }
  if (hasChildren(id)) return { ok: false, code: 'CATEGORY_HAS_CHILDREN' }
  const idx = STORE.findIndex((c) => c.id === id)
  STORE.splice(idx, 1)
  return { ok: true }
}

export function mockPutCategoryFields(
  id: string,
  fields: CategoryField[],
): CategoryField[] | undefined {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return undefined
  // ВАЖНО: JSON.parse/stringify чтобы избежать DataCloneError на reactive данных
  // tmp-* id заменяются постоянными (имитирует поведение сервера)
  cat.fields = JSON.parse(JSON.stringify(fields)).map(
    (f: CategoryField, i: number) => ({
      ...f,
      id: f.id.startsWith('tmp-') ? `f-perm-${++fieldSeq}` : f.id,
      order: i,
    }),
  )
  cat.fieldCount = cat.fields.length
  // каскадируем изменение полей на всех потомков
  cascadeInheritedFields(id)
  return structuredClone(cat.fields)
}
