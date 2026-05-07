# Рефакторинг переводов: SupplierCardPage.vue

## Цель
Перевести страницу карточки поставщика на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getSupplierTranslated()` рядом со старой `getSupplier()`
4. Композаблы: добавить `useSupplierCardTranslated()` рядом со старой `useSupplierCard()`
5. Страница: использовать `useSupplierCardTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/supplier.ts`

Изменить поля, которые отображаются пользователю:

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface Supplier {
  id: string
  company: TranslatedString        // было: string
  contactPerson: TranslatedString  // было: string
  email: string
  phone: string
  status: SupplierStatus
  categories: string[]
  rating: number
  country: string
  city: string
  tags: string[]
  notes: string
  leadTime: number
  lastBccDate: string | null
  hasDeficit: boolean
  createdAt: string
  updatedAt: string
}

export interface SupplierCardData extends Supplier {
  statusReason: TranslatedString   // было: string
  contractDate: string
  vatCode: string
  currency: string
  paymentTerms: string
  minOrder: number | null
  bccEmails: string[]
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
  files: SupplierFile[]
  history: SupplierHistoryItem[]
  priceHistory: SupplierPriceEntry[]
  auditLog: SupplierAuditEntry[]
}

export interface SupplierPriceEntry {
  date: string
  product: TranslatedString        // было: string
  stock: string
  price: number | null
  unit: TranslatedString | null    // было: string | null
  source: TranslatedString         // было: string
  status: 'replied' | 'pending' | 'sent'
}

export interface SupplierAuditEntry {
  timestamp: string
  user: TranslatedString           // было: string
  userInitials: string
  property: TranslatedString       // было: string
  oldValue: string
  newValue: string
}

export interface SupplierContact {
  name: TranslatedString           // было: string
  role: TranslatedString           // было: string
  email: string
  phone: string
}

export interface SupplierFile {
  id: string
  name: TranslatedString           // было: string
  size: number
  type: string
  uploadedAt: string
}

export interface SupplierHistoryItem {
  date: string
  action: TranslatedString         // было: string
  user: TranslatedString           // было: string
  details: TranslatedString        // было: string
}
```

**Примечание**: Поля `email`, `phone`, `country`, `city`, `tags`, `notes`, `leadTime`, `lastBccDate`, `hasDeficit`, `createdAt`, `updatedAt`, `contractDate`, `vatCode`, `currency`, `paymentTerms`, `minOrder`, `bccEmails`, `stock`, `price`, `status`, `userInitials`, `oldValue`, `newValue`, `size`, `type`, `uploadedAt`, `date` — технические данные, НЕ переводим.

### 2. `frontend_vue/src/services/mocks/suppliers.ts`

Все `company`, `contactPerson`, `statusReason`, `product`, `unit`, `source`, `user`, `property`, `name` (в контактах, файлах), `action`, `details`, `role` — заменить на `{ ru, en, lt }`.

Пример:
```typescript
export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: '1',
    company: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' },
    contactPerson: { ru: 'Андрес Тамм', en: 'Andres Tamm', lt: 'Andres Tamm' },
    email: 'info@steelplus.ee',
    phone: '+372 51234567',
    status: 'active',
    categories: ['Sheets', 'Pipes'],
    rating: 5,
    country: 'Estonia',
    city: 'Tallinn',
    tags: ['certified', 'fast'],
    notes: 'Reliable partner since 2020',
    leadTime: 7,
    lastBccDate: '2026-01-15',
    hasDeficit: false,
    createdAt: '2020-03-15',
    updatedAt: '2026-04-01',
  },
  // ...
]
```

Для `SupplierCardData` (расширенные поля):
```typescript
const MOCK_SUPPLIER_CARDS: Record<string, SupplierCardData> = {
  '1': {
    ...MOCK_SUPPLIERS[0],
    statusReason: { ru: 'Надёжный поставщик', en: 'Reliable supplier', lt: 'Patikimas tiekėjas' },
    contractDate: '2020-04-01',
    vatCode: 'EE123456789',
    currency: 'EUR',
    paymentTerms: 'Net 30',
    minOrder: 100,
    bccEmails: ['bcc@steelplus.ee'],
    addresses: [],
    contacts: [
      { name: { ru: 'Андрес Тамм', en: 'Andres Tamm', lt: 'Andres Tamm' }, role: { ru: 'Менеджер по продажам', en: 'Sales Manager', lt: 'Pardavimų vadybininkas' }, email: 'andres@steelplus.ee', phone: '+372 51234567' },
    ],
    files: [
      { id: 'f-1', name: { ru: 'Сертификат качества', en: 'Quality Certificate', lt: 'Kokybės sertifikatas' }, size: 245760, type: 'application/pdf', uploadedAt: '2025-06-01' },
    ],
    history: [
      { date: '2026-04-01', action: { ru: 'Обновлён статус', en: 'Status updated', lt: 'Būsena atnaujinta' }, user: { ru: 'Иван Иванов', en: 'Ivan Ivanov', lt: 'Ivan Ivanov' }, details: { ru: 'Статус изменён на active', en: 'Status changed to active', lt: 'Būsena pakeista į active' } },
    ],
    priceHistory: [
      { date: '2026-04-01', product: { ru: 'Стальной лист 3мм', en: 'Steel Sheet 3mm', lt: 'Plieno lakštas 3mm' }, stock: 'In stock', price: 115.00, unit: { ru: 'EUR/шт', en: 'EUR/pcs', lt: 'EUR/vnt' }, source: { ru: 'BCC Запрос', en: 'BCC Request', lt: 'BCC Užklausa' }, status: 'replied' },
    ],
    auditLog: [
      { timestamp: '2026-04-01T10:00:00Z', user: { ru: 'Иван Иванов', en: 'Ivan Ivanov', lt: 'Ivan Ivanov' }, userInitials: 'II', property: { ru: 'Статус', en: 'Status', lt: 'Būsena' }, oldValue: 'new', newValue: 'active' },
    ],
  },
}
```

### 3. `frontend_vue/src/services/suppliersService.ts`

Добавить новую функцию рядом со старой (старую НЕ удаляем):

```typescript
// ─── Translated variants (server-provided translations) ───

export async function getSupplierTranslated(id: string): Promise<SupplierCardData> {
  return apiGet<SupplierCardData>(`/api/suppliers/${id}/translated`)
}
```

### 4. `frontend_vue/src/composables/useSupplierCard.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useSupplierCardTranslated(id: string) {
  const { tf } = useTranslatedField()

  const supplier = ref<SupplierCardData | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const dirty = useDirtyCheck(supplier)

  async function load() {
    loading.value = true
    error.value = null
    try {
      supplier.value = await getSupplierTranslated(id)
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load supplier'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!supplier.value || !dirty.isDirty.value) return
    saving.value = true
    error.value = null
    try {
      const patch = dirty.diff() as Partial<SupplierCardData>
      if (Object.keys(patch).length === 0) return
      supplier.value = await patchSupplier(id, patch)
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save supplier'
    } finally {
      saving.value = false
    }
  }

  return { supplier, loading, saving, error, isDirty: dirty.isDirty, load, save, tf }
}
```

### 5. `frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useSupplierCard } from '@/composables/useSupplierCard'` на `import { useSupplierCardTranslated } from '@/composables/useSupplierCard'`
- Заменить `const { supplier, loading, ... } = useSupplierCard(props.id)` на `const { supplier, loading, ..., tf } = useSupplierCardTranslated(props.id)`

**В шаблоне:**
- `resolveLabel(p.product)` → `tf(p.product)`

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

### 6. Проверка

```bash
npx vue-tsc --noEmit
npm run build
```

---

## Как это работает

1. **Загрузка**: `useSupplierCardTranslated()` вызывает `getSupplierTranslated()` → `apiGet('/api/suppliers/:id/translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(p.product)` берёт `p.product.ru` или `p.product.en` или `p.product.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
