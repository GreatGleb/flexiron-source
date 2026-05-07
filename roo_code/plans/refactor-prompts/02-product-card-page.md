# Рефакторинг переводов: ProductCardPage.vue

## Цель
Перевести страницу карточки продукта на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getProductTranslated()` рядом со старой `getProduct()`
4. Композаблы: добавить `useProductCardTranslated()` рядом со старой `useProductCard()`
5. Страница: использовать `useProductCardTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/product.ts`

Уже должно быть изменено в рамках `01-products-page.md`. Если нет — изменить:

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface ProductFieldValue {
  fieldId: string
  fieldName: TranslatedString   // было: string
  fieldType: CategoryFieldType
  value: string | number | boolean | string[] | null
  inherited: boolean
  options?: TranslatedString[]  // было: string[]
}

export interface LinkedSupplier {
  id: string
  name: TranslatedString        // было: string
  price: number | null
  priceUnit: string | null
  leadDays: number | null
}

export interface Product {
  id: string
  name: TranslatedString        // было: string
  categoryId: string | null
  categoryName: TranslatedString | null  // было: string | null
  sku: string | null
  description: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
}
```

### 2. `frontend_vue/src/types/category.ts`

Поле `name` в `CategoryListItem` тоже должно стать `TranslatedString` (используется в `getCategoryPath()`):

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface CategoryListItem {
  id: string
  name: TranslatedString        // было: string
  parentId: string | null
  parentName: TranslatedString | null  // было: string | null
  fieldCount: number
  productCount: number
  level: number
}
```

### 3. `frontend_vue/src/services/mocks/products.ts`

Все `name`, `fieldName`, `categoryName`, `options[]` — заменить на `{ ru, en, lt }`.

Пример:
```typescript
{
  id: 'prod-001',
  name: { ru: 'Стальной лист 3мм', en: 'Steel Sheet 3mm', lt: 'Plieno lakštas 3mm' },
  categoryId: 'cat-2',
  categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
  // ...
  fieldValues: [
    { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
    { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
      { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
      { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
      { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
    ] },
  ],
  linkedSuppliers: [
    { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 115.00, priceUnit: 'EUR/vnt', leadDays: 7 },
  ],
}
```

### 4. `frontend_vue/src/services/mocks/categories.ts`

Все `name` в `CategoryListItem` и `CategoryField.name` — заменить на `{ ru, en, lt }`.

Пример:
```typescript
{
  id: 'cat-1',
  name: { ru: 'Металл', en: 'Metal', lt: 'Metalas' },
  parentId: null,
  description: { ru: 'Все виды металлопродукции', en: 'All types of metal products', lt: 'Visi metalo gaminių tipai' },
  // ...
  fields: [
    { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
  ],
}
```

### 5. `frontend_vue/src/services/productsService.ts`

Добавить новую функцию рядом со старой (старую НЕ удаляем):

```typescript
export async function getProductTranslated(id: string): Promise<Product> {
  return apiGet(`/api/products/${id}/translated`)
}
```

### 6. `frontend_vue/src/composables/useProductCard.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useProductCardTranslated(id: string) {
  const { t } = useI18n()
  const { tf } = useTranslatedField()
  const toast = useToast()

  const product = ref<Product | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const categories = ref<CategoryListItem[]>([])
  const suppliersList = ref<Supplier[]>([])

  const form = ref<BasicFields>({
    name: '',
    sku: null,
    description: null,
    price: null,
    minStock: null,
    priceUnit: null,
  })
  const dirty = useDirtyCheck(form)

  watch(
    form,
    (val) => {
      if (Number.isNaN(val.price as unknown)) form.value.price = null
      if (Number.isNaN(val.minStock as unknown)) form.value.minStock = null
    },
    { deep: true },
  )

  const fieldValues = ref<FieldValueMap>({})
  const originalFieldValues = ref<string>(JSON.stringify({}))

  const fieldValuesChanged = computed(() => {
    return JSON.stringify(fieldValues.value) !== originalFieldValues.value
  })

  const linkedSuppliers = ref<LinkedSupplier[]>([])
  const originalLinkedSuppliers = ref<string>('[]')

  const linkedSuppliersChanged = computed(() => {
    return JSON.stringify(linkedSuppliers.value) !== originalLinkedSuppliers.value
  })

  const isAnythingDirty = computed(
    () => dirty.isDirty.value || fieldValuesChanged.value || linkedSuppliersChanged.value,
  )

  function getCategoryPath(categoryId: string): string {
    const parts: string[] = []
    let current = categories.value.find((c) => c.id === categoryId)
    while (current) {
      parts.unshift(tf(current.name))
      current = current.parentId
        ? categories.value.find((c) => c.id === current!.parentId)
        : undefined
    }
    return parts.join(' → ')
  }

  function addLinkedSupplier(entry: LinkedSupplier) {
    if (linkedSuppliers.value.some((s) => s.id === entry.id)) return
    linkedSuppliers.value = [...linkedSuppliers.value, entry]
  }

  function removeLinkedSupplier(supplierId: string) {
    linkedSuppliers.value = linkedSuppliers.value.filter((s) => s.id !== supplierId)
  }

  async function loadCategories() {
    try {
      const res = await getCategories({ search: '' }, 1, 999)
      categories.value = res.items
    } catch {
      // non-critical
    }
  }

  async function loadSuppliers() {
    try {
      const res = await getSuppliers(
        { search: '', status: 'all', rating: 0, categories: [] },
        { page: 1, pageSize: 999 },
      )
      suppliersList.value = res.items
    } catch {
      // non-critical
    }
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getProductTranslated(id)
      product.value = data
      form.value = {
        name: data.name,
        sku: data.sku,
        description: data.description,
        price: data.price,
        minStock: data.minStock,
        priceUnit: data.priceUnit,
      }
      dirty.capture()
      const map: FieldValueMap = {}
      for (const fv of data.fieldValues) {
        if (fv.fieldType === 'file') {
          map[fv.fieldId] = Array.isArray(fv.value) ? fv.value : fv.value ? [fv.value as string] : []
        } else {
          map[fv.fieldId] = fv.value
        }
      }
      fieldValues.value = map
      originalFieldValues.value = JSON.stringify(map)
      linkedSuppliers.value = JSON.parse(JSON.stringify(data.linkedSuppliers)) as LinkedSupplier[]
      originalLinkedSuppliers.value = JSON.stringify(data.linkedSuppliers)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load product'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!isAnythingDirty.value) return
    saving.value = true
    try {
      const delta: Parameters<typeof patchProduct>[1] = {}
      if (dirty.isDirty.value) {
        Object.assign(delta, dirty.diff())
        if (delta.sku === '') delta.sku = null
        if (delta.description === '') delta.description = null
      }
      if (fieldValuesChanged.value && product.value) {
        delta.fieldValues = product.value.fieldValues.map((fv) => {
          const raw = fieldValues.value[fv.fieldId]
          const value =
            fv.fieldType === 'number' && Number.isNaN(raw as unknown) ? null : (raw ?? null)
          return { ...fv, value }
        })
      }
      if (linkedSuppliersChanged.value) {
        delta.linkedSuppliers = JSON.parse(JSON.stringify(linkedSuppliers.value)) as LinkedSupplier[]
      }
      await patchProduct(id, delta)
      toast.success(t('products.toast_saved'))
      await load()
    } catch {
      toast.error(t('products.toast_error'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    return load()
  }

  loadCategories()
  loadSuppliers()

  return {
    product,
    loading,
    saving,
    error,
    form,
    fieldValues,
    linkedSuppliers,
    suppliersList,
    isAnythingDirty,
    categories,
    getCategoryPath,
    addLinkedSupplier,
    removeLinkedSupplier,
    load,
    save,
    discard,
    tf,
  }
}
```

### 7. `frontend_vue/src/views/admin/products/ProductCardPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useProductCard } from '@/composables/useProductCard'` на `import { useProductCardTranslated } from '@/composables/useProductCard'`
- Заменить `const { product, loading, ... } = useProductCard(props.id)` на `const { product, loading, ..., tf } = useProductCardTranslated(props.id)`

**В шаблоне:**
- `resolveLabel(product.name)` → `tf(product.name)`
- `resolveLabel(product.value.name)` → `tf(product.value.name)`
- `resolveLabel(fv.fieldName)` → `tf(fv.fieldName)`
- `resolveLabel(o)` → `tf(o)` (для опций enum-полей)
- `resolveLabel(current.name)` → `tf(current.name)` (в `getCategoryPath()` — уже изменено в композабле)

**Добавить загрузочный скелетон:**
```vue
<template v-if="loading">
  <GlassPanel :loading="true" :skeleton-rows="6" />
</template>
<template v-else-if="error">
  <div class="error-state">{{ error }}</div>
</template>
<template v-else>
  <!-- существующий контент -->
</template>
```

### 8. Проверка

```bash
npx vue-tsc --noEmit
npm run build
```

---

## Как это работает

1. **Загрузка**: `useProductCardTranslated()` вызывает `getProductTranslated()` → `apiGet('/api/products/:id/translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(item.name)` берёт `item.name.ru` или `item.name.en` или `item.name.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
