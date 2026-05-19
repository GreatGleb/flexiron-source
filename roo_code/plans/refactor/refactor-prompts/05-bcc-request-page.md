# Рефакторинг переводов: BccRequestPage.vue

## Цель
Перевести страницу BCC-запросов на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getBccCategoriesTranslated()` рядом со старой `getBccCategories()`
4. Композаблы: добавить `useBccRequestTranslated()` рядом со старой `useBccRequest()`
5. Страница: использовать `useBccRequestTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/bcc.ts`

Изменить поля, которые отображаются пользователю:

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface BccCategory {
  id: string
  name: TranslatedString        // было: string
  productCount: number
  children?: BccCategory[]
}

export interface BccRecipient {
  id: string
  company: TranslatedString     // было: string
  email: string
  contactPerson: TranslatedString  // было: string
  selected: boolean
}

export interface BccRequest {
  id: string
  requestId: string
  date: string
  supplierId: string
  supplierName: TranslatedString    // было: string
  productId: string
  productName: TranslatedString     // было: string
  source: TranslatedString          // было: string
  status: BccEventStatus
  price?: number
  unit?: string
}

export interface BccEmailTemplate {
  subject: TranslatedString     // было: string
  body: TranslatedString        // было: string
  attachments: BccAttachment[]
}

export interface BccAttachment {
  id: string
  name: TranslatedString        // было: string
  size: number
  type: string
}
```

### 2. `frontend_vue/src/services/mocks/bcc.ts`

Все `name`, `company`, `contactPerson`, `supplierName`, `productName`, `source`, `subject`, `body` — заменить на `{ ru, en, lt }`.

Пример:
```typescript
export const MOCK_BCC_CATEGORIES: BccCategory[] = [
  {
    id: 'sheets',
    name: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    productCount: 4,
    children: [
      { id: 'sheet-2mm', name: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' }, productCount: 0 },
      // ...
    ],
  },
  // ...
]

export const MOCK_BCC_HISTORY: BccRequest[] = [
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
  // ...
]
```

### 3. `frontend_vue/src/services/bccService.ts`

Добавить новые функции рядом со старыми (старые НЕ удаляем):

```typescript
// ─── Translated variants (server-provided translations) ───

export async function getBccCategoriesTranslated(): Promise<BccCategory[]> {
  return apiGet<BccCategory[]>('/api/bcc/categories/translated')
}

export async function getBccRecipientsTranslated(productIds: string[]): Promise<BccRecipient[]> {
  return apiGet<BccRecipient[]>('/api/bcc/recipients/translated', { products: productIds.join(',') })
}

export async function getBccHistoryTranslated(
  pagination?: PaginationParams,
): Promise<PaginatedResponse<BccRequest>> {
  const params: Record<string, string> = {
    page: String(pagination?.page ?? 1),
    pageSize: String(pagination?.pageSize ?? 25),
  }
  return apiGet<PaginatedResponse<BccRequest>>('/api/bcc/history/translated', params)
}
```

### 4. `frontend_vue/src/composables/useBccRequest.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useBccRequestTranslated() {
  const { tf } = useTranslatedField()

  const categories = ref<BccCategory[]>([])
  const recipients = ref<BccRecipient[]>([])
  const history = ref<BccRequest[]>([])
  const selectedProductIds = ref<string[]>([])

  const template = reactive<BccEmailTemplate>({ ...DEFAULT_TEMPLATE, attachments: [] })

  const loading = ref(false)
  const sending = ref(false)
  const error = ref<string | null>(null)
  const recipientsLocked = ref(false)

  async function loadCategories() {
    loading.value = true
    error.value = null
    try {
      categories.value = await getBccCategoriesTranslated()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load categories'
    } finally {
      loading.value = false
    }
  }

  async function loadHistory() {
    try {
      const res = await getBccHistoryTranslated({ page: 1, pageSize: 25 })
      history.value = res.items
    } catch {
      // history is optional — silent fail
    }
  }

  async function refreshRecipients() {
    if (recipientsLocked.value) return
    try {
      recipients.value = await getBccRecipientsTranslated(selectedProductIds.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load recipients'
    }
  }

  watch(selectedProductIds, refreshRecipients, { deep: true })

  async function send(): Promise<string> {
    sending.value = true
    error.value = null
    try {
      const selectedRecipients = recipients.value.filter((r) => r.selected).map((r) => r.id)
      const fileIds = template.attachments.map((a) => a.id)
      const { requestId } = await sendBccRequest({
        productIds: selectedProductIds.value,
        recipientIds: selectedRecipients,
        template: { ...template },
        fileIds,
      })
      return requestId
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to send BCC request'
      throw e
    } finally {
      sending.value = false
    }
  }

  function resetForm() {
    selectedProductIds.value = []
    recipients.value = []
    Object.assign(template, { ...DEFAULT_TEMPLATE, attachments: [] })
  }

  return {
    categories,
    recipients,
    history,
    selectedProductIds,
    template,
    loading,
    sending,
    error,
    recipientsLocked,
    loadCategories,
    loadHistory,
    refreshRecipients,
    send,
    resetForm,
    tf,
  }
}
```

### 5. `frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useBccRequest } from '@/composables/useBccRequest'` на `import { useBccRequestTranslated } from '@/composables/useBccRequest'`
- Заменить `const { categories, recipients, ... } = useBccRequest()` на `const { categories, recipients, ..., tf } = useBccRequestTranslated()`

**В шаблоне:**
- `resolveLabel(prod.name)` → `tf(prod.name)`
- `resolveLabel(cat.name)` → `tf(cat.name)`
- `resolveLabel(group.categoryName)` → `tf(group.categoryName)`
- `resolveLabel(p.name)` → `tf(p.name)`
- `resolveLabel(evt.productName)` → `tf(evt.productName)`

**Добавить загрузочный скелетон:**
```vue
<template v-if="loading">
  <GlassPanel :loading="true" :skeleton-rows="8" />
</template>
<template v-else-if="error">
  <div class="error-state">{{ error }}</div>
</template>
<template v-else>
  <!-- существующий контент -->
</template>
```

### 6. Проверка

```bash
npx vue-tsc --noEmit
npm run build
```

---

## Как это работает

1. **Загрузка**: `useBccRequestTranslated()` вызывает `getBccCategoriesTranslated()` → `apiGet('/api/bcc/categories/translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(cat.name)` берёт `cat.name.ru` или `cat.name.en` или `cat.name.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
