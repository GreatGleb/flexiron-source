# Рефакторинг переводов: SupplierCreatePage.vue

## Цель
Перевести страницу создания поставщика на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `createSupplierTranslated()` рядом со старой `createSupplier()`
4. Композаблы: добавить `useSupplierCreateTranslated()` рядом со старым `useSupplierCreate()`
5. Страница: использовать `useSupplierCreateTranslated()` + `tf()` для динамических данных
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
```

**Какие поля меняются:**
- `Supplier.company` → `TranslatedString`
- `Supplier.contactPerson` → `TranslatedString`
- `SupplierCardData.statusReason` → `TranslatedString`

**Какие поля НЕ меняются** (технические/не отображаются пользователю напрямую):
- `Supplier.email`, `phone`, `status`, `categories`, `rating`, `country`, `city`, `tags`, `notes`, `leadTime`, `lastBccDate`, `hasDeficit`, `createdAt`, `updatedAt`
- `SupplierCardData.contractDate`, `vatCode`, `currency`, `paymentTerms`, `minOrder`, `bccEmails`
- `SupplierAddress`, `SupplierContact`, `SupplierFile`, `SupplierHistoryItem`, `SupplierPriceEntry`, `SupplierAuditEntry` — внутренние структуры, не содержат пользовательских строк

---

### 2. `frontend_vue/src/services/suppliersService.ts`

Добавить новый метод рядом со старым:

```typescript
import type { SupplierCardData } from '@/types/supplier'

// Старый (остаётся для обратной совместимости)
export async function createSupplier(
  payload: Partial<SupplierCardData>,
): Promise<SupplierCardData> {
  return apiPost<SupplierCardData>('/api/suppliers', payload)
}

// Новый — возвращает TranslatedString-поля
export async function createSupplierTranslated(
  payload: Partial<SupplierCardData>,
): Promise<SupplierCardData> {
  return apiPost<SupplierCardData>('/api/suppliers', payload)
}
```

> Примечание: эндпоинт тот же (`POST /api/suppliers`). Разница только в том, что ответ теперь содержит `TranslatedString` вместо `string` для указанных полей. Если API уже возвращает переводы — метод просто переименовывается для ясности.

---

### 3. `frontend_vue/src/services/mocks/suppliers.ts`

Обновить мок-данные: поля `company`, `contactPerson`, `statusReason` → `{ ru, en, lt }`.

```typescript
export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: '1',
    company: { ru: 'МеталПром ООО', en: 'MetalProm LLC', lt: 'MetalProm UAB' },
    contactPerson: { ru: 'Иван Петров', en: 'Ivan Petrov', lt: 'Ivan Petrov' },
    email: 'info@metalprom.ru',
    phone: '+7 495 123-45-67',
    status: 'active',
    categories: ['Sheets', 'Beams', 'Profiles'],
    rating: 5,
    country: 'Russia',
    city: 'Moscow',
    tags: ['certified', 'premium'],
    notes: 'Reliable supplier, consistent quality.',
    leadTime: 10,
    lastBccDate: '2026-04-05',
    hasDeficit: false,
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2026-04-05T14:30:00Z',
  },
  // ... остальные поставщики — аналогично
]
```

Обновить `MOCK_CARD` — поле `statusReason`:

```typescript
export const MOCK_CARD: Record<string, SupplierCardData> = {
  '1': {
    ...supplier1,
    statusReason: {
      ru: 'Аудит пройден. Надёжность повышена до 5 звёзд.',
      en: 'Audit passed. Reliability rating upgraded to 5 stars.',
      lt: 'Auditas išlaikytas. Patikimumo reitingas padidintas iki 5 žvaigždučių.',
    },
    // ... остальные поля
  },
}
```

Обновить `mockCreateSupplier` — возвращать `TranslatedString` для соответствующих полей:

```typescript
export function mockCreateSupplier(body: Partial<SupplierCardData>): SupplierCardData {
  const now = new Date().toISOString()
  return {
    id: String(Date.now()),
    company: body.company ?? { ru: '', en: '', lt: '' },
    contactPerson: body.contactPerson ?? { ru: '', en: '', lt: '' },
    statusReason: body.statusReason ?? { ru: '', en: '', lt: '' },
    // ... остальные поля как в emptyCard()
  }
}
```

---

### 4. `frontend_vue/src/composables/useSupplierCreate.ts`

Создать новый композабл `useSupplierCreateTranslated()` рядом со старым `useSupplierCreate()`:

```typescript
import { ref } from 'vue'
import { createSupplierTranslated } from '@/services/suppliersService'
import type { SupplierCardData } from '@/types/supplier'

function emptyCard(): SupplierCardData {
  return {
    id: '',
    company: { ru: '', en: '', lt: '' },
    contactPerson: { ru: '', en: '', lt: '' },
    email: '',
    phone: '',
    status: 'new',
    categories: [],
    rating: 0,
    country: '',
    city: '',
    tags: [],
    notes: '',
    leadTime: 0,
    lastBccDate: null,
    hasDeficit: false,
    createdAt: '',
    updatedAt: '',
    statusReason: { ru: '', en: '', lt: '' },
    contractDate: '',
    vatCode: '',
    currency: 'EUR',
    paymentTerms: '30 Days Net',
    minOrder: null,
    bccEmails: [],
    addresses: [{ type: 'Legal', line1: '', city: '', country: '', zip: '' }],
    contacts: [],
    files: [],
    history: [],
    priceHistory: [],
    auditLog: [],
  }
}

export function useSupplierCreateTranslated() {
  const supplier = ref<SupplierCardData>(emptyCard())
  const saving = ref(false)
  const error = ref<string | null>(null)

  function validate(): string | null {
    if (!supplier.value.company?.ru?.trim() && !supplier.value.company?.en?.trim()) {
      return 'company_required'
    }
    if (!supplier.value.email.trim()) return 'email_required'
    return null
  }

  async function save(): Promise<SupplierCardData | null> {
    const validationError = validate()
    if (validationError) {
      error.value = validationError
      return null
    }
    saving.value = true
    error.value = null
    try {
      const created = await createSupplierTranslated(supplier.value)
      return created
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create supplier'
      return null
    } finally {
      saving.value = false
    }
  }

  function reset() {
    supplier.value = emptyCard()
    error.value = null
  }

  return { supplier, saving, error, save, validate, reset }
}
```

---

### 5. `frontend_vue/src/components/admin/SupplierFormSections.vue`

Этот компонент используется и `SupplierCreatePage`, и `SupplierCardPage`. Он отображает поля поставщика в форме.

**Что нужно изменить:**
- Поля `company`, `contactPerson` — сейчас это `<input v-model="supplier.company">` (строка). После рефакторинга нужно отображать 3 инпута (ru/en/lt) или использовать `tf()` для отображения + отдельный редактор переводов.

**Вариант A (простой):** Показывать только текущий язык через `tf()`:
```vue
<input v-model="tf(supplier.company)" />
```
Но это не позволит редактировать переводы на всех языках.

**Вариант B (полный):** Добавить переключатель языка для формы или показывать все 3 языка:
```vue
<div class="translated-field">
  <label>{{ t('supplier.company') }}</label>
  <div class="lang-input-group">
    <div class="lang-input">
      <span class="lang-label">RU</span>
      <input v-model="supplier.company.ru" />
    </div>
    <div class="lang-input">
      <span class="lang-label">EN</span>
      <input v-model="supplier.company.en" />
    </div>
    <div class="lang-input">
      <span class="lang-label">LT</span>
      <input v-model="supplier.company.lt" />
    </div>
  </div>
</div>
```

**Рекомендуется Вариант B**, так как форма создания/редактирования должна позволять вводить переводы на всех языках.

Аналогично для `contactPerson` и `statusReason` (если `statusReason` редактируется в форме).

---

### 6. `frontend_vue/src/views/admin/suppliers/SupplierCreatePage.vue`

Заменить импорт и использование:

```vue
<script setup lang="ts">
// Было:
// import { useSupplierCreate } from '@/composables/useSupplierCreate'
// const { supplier, saving, error, save } = useSupplierCreate()

// Стало:
import { useSupplierCreateTranslated } from '@/composables/useSupplierCreateTranslated'
const { supplier, saving, error, save } = useSupplierCreateTranslated()
</script>
```

Шаблон не требует изменений — `SupplierFormSections` уже привязан через `v-model="supplier"`.

---

### 7. `frontend_vue/src/services/mocks/index.ts`

Обновить `mockCreateSupplier` в маршрутизации моков — убедиться, что возвращаются `TranslatedString`:

```typescript
if (path === '/api/suppliers' && method === 'POST') {
  return delay(mockCreateSupplier(body as Parameters<typeof mockCreateSupplier>[0]) as T)
}
```

Метод уже существует, нужно только убедиться, что `mockCreateSupplier` возвращает `TranslatedString` (изменение из п.3).

---

## Порядок выполнения

1. Типы (`supplier.ts`) — изменить `company`, `contactPerson`, `statusReason` на `TranslatedString`
2. Моки (`suppliers.ts`) — обновить `MOCK_SUPPLIERS`, `MOCK_CARD`, `mockCreateSupplier`
3. Сервисы (`suppliersService.ts`) — добавить `createSupplierTranslated()`
4. Композабл (`useSupplierCreate.ts`) — добавить `useSupplierCreateTranslated()`
5. Компонент формы (`SupplierFormSections.vue`) — обновить поля для работы с `TranslatedString`
6. Страница (`SupplierCreatePage.vue`) — переключиться на новый композабл
7. Мок-индекс (`mocks/index.ts`) — проверить маршрутизацию
