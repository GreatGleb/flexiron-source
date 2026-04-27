import type { Category, CategoryField, CategoryListItem, CategoryFilters } from '@/types/category'
import type { PaginatedResponse } from '@/types/api'

// ─── STORE ───────────────────────────────────────────────────────────────────

const STORE: Category[] = [
  {
    id: 'cat-1',
    name: 'Metal',
    parentId: null,
    description: 'All types of metal products',
    fieldCount: 2,
    productCount: 0,
    inheritedFields: [],
    fields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
    ],
  },
  {
    id: 'cat-2',
    name: 'Sheets',
    parentId: 'cat-1',
    description: 'Flat-rolled metal sheets',
    fieldCount: 3,
    productCount: 12,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
    ],
    fields: [
      { id: 'f-2-1', name: 'Thickness (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-2-2', name: 'Sheet type', type: 'enum', required: false, order: 1, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { id: 'f-2-3', name: 'Dimensions (mm)', type: 'text', required: false, order: 2, options: [] },
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
      { id: 'f-2-1', name: 'Thickness (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-2-2', name: 'Sheet type', type: 'enum', required: false, order: 1, options: ['Hot-rolled', 'Cold-rolled', 'Galvanized'] },
      { id: 'f-2-3', name: 'Dimensions (mm)', type: 'text', required: false, order: 2, options: [] },
    ],
    fields: [
      { id: 'f-3-1', name: 'Alloy', type: 'enum', required: true, order: 0, options: ['AMts', 'AMg2', 'AMg3', 'D16', '1561'] },
    ],
  },
  {
    id: 'cat-4',
    name: 'Pipes',
    parentId: 'cat-1',
    description: 'Tubular metal products',
    fieldCount: 2,
    productCount: 8,
    inheritedFields: [
      { id: 'f-1-1', name: 'Steel grade', type: 'text', required: true, order: 0, options: [] },
      { id: 'f-1-2', name: 'Standard / GOST', type: 'text', required: false, order: 1, options: [] },
    ],
    fields: [
      { id: 'f-4-1', name: 'Diameter (mm)', type: 'number', required: true, order: 0, options: [] },
      { id: 'f-4-2', name: 'Wall thickness (mm)', type: 'number', required: true, order: 1, options: [] },
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
  }
  STORE.push(newCat)
  return structuredClone(newCat)
}

export function mockPatchCategory(
  id: string,
  delta: Partial<Pick<Category, 'name' | 'parentId' | 'description'>>,
): Category | undefined {
  const cat = STORE.find((c) => c.id === id)
  if (!cat) return undefined
  if (delta.name !== undefined) cat.name = delta.name
  if (delta.description !== undefined) cat.description = delta.description
  if (delta.parentId !== undefined) {
    cat.parentId = delta.parentId
    // прямой родитель уже хранит накопленную цепочку
    const parent = STORE.find((c) => c.id === delta.parentId)
    cat.inheritedFields = parent ? [...parent.inheritedFields, ...parent.fields] : []
    // каскадируем изменение на всех потомков
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
