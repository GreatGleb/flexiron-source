# План: страница 1.3 Услуги (Services)

**Маршрут:** `/admin/products/services`  
**Файлы:** `src/views/admin/products/ServicesPage.vue` (новый)  
**Скилл:** `/create-page` (`roo_code/skills/create-page.md`) — читать перед стартом

---

## ТЗ (из sitemap и контекста)

### Что такое Услуга

Услуга — сервис, который компания предлагает клиентам: резка металла, доставка, упаковка и т.д. У каждой услуги есть:
- **Название** (обязательное, TranslatedString)
- **Себестоимость** (cost price) — сколько компания тратит на выполнение услуги
- **Цена для клиента** (selling price) — сколько компания берёт с клиента
- **Единица измерения** — например, EUR/м, EUR/кг, EUR/шт, EUR/час
- **Описание** (опционально)

### Отличие от Товаров (1.1)

| Аспект | Товары (1.1) | Услуги (1.3) |
|--------|-------------|--------------|
| Сущность | Физический продукт (металл) | Сервис / работа |
| Категории | Да (дерево категорий с динамическими полями) | Нет (плоский список) |
| Динамические поля | Да (от категории) | Нет |
| Поставщики | Да (linkedSuppliers) | Нет |
| Себестоимость | Нет (только базовая цена) | Да (cost price + selling price) |
| SKU | Да | Нет |
| Минимальный остаток | Да | Нет |

### Страница списка (ServicesPage — новый файл)

Аналогична [`ProductsPage.vue`](frontend_vue/src/views/admin/products/ProductsPage.vue) по структуре:

- **Хедер:**
  - Заголовок страницы
  - Кнопка «Добавить услугу» → модал создания
  - Кнопка «Назад к товарам» → `/admin/products`

- **Фильтры** (внутри GlassPanel):
  - Поиск по названию (`SearchInput`)
  - Сортировка по колонкам (название, цена, себестоимость)

- **Таблица** (внутри GlassPanel):
  - Колонки: Название, Себестоимость, Цена, Единица, Действия
  - Клик по строке → пока не реализовано (в будущем — карточка услуги)
  - Кнопка удаления с confirm-модалом
  - Пагинация (аналогично ProductsPage)

- **Модал создания:**
  - Название (обязательное)
  - Себестоимость (число, опционально)
  - Цена (число, опционально)
  - Единица измерения (CustomSelect)

### API endpoints

```
GET    /api/services              → PaginatedResponse<ServiceListItem>  (filters: search)
GET    /api/services/:id          → Service
POST   /api/services              → Service
PATCH  /api/services/:id          → Service
DELETE /api/services/:id          → void
```

### Типы

```ts
// src/types/service.ts — новый файл

export type ServicePriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'

export interface ServiceListItem {
  id: string
  name: TranslatedString
  costPrice: number | null
  sellingPrice: number | null
  priceUnit: ServicePriceUnit | null
  createdAt: string
}

export interface Service {
  id: string
  name: TranslatedString
  description: TranslatedString | null
  costPrice: number | null
  sellingPrice: number | null
  priceUnit: ServicePriceUnit | null
  createdAt: string
  updatedAt: string
}

export interface ServiceFilters {
  search: string
  sortBy: 'name' | 'costPrice' | 'sellingPrice' | null
  sortDir: 'asc' | 'desc'
}
```

---

## Промпты (пошагово — выполнять строго по порядку)

---

### Промпт 0 — Контекст и Phase 0 Checkpoint

```
Читай полностью (в указанном порядке):

1. roo_code/skills/create-page.md  — CRITICAL RULES, все фазы (особенно Phase 2 mock rules, Phase 6 CSS checklist)
2. roo_code/skills/vue-rules.md    — все pitfalls #1–#23, save UX, HTTP-методы
3. roo_code/roo-context/frontend-vue-quickref.md — паттерны, SOLID, DRY, DDD, запреты, стек, архитектура, CSS-алиасы, feature flags, i18n, routing
4. roo_code/plans/services-page-plan.md — этот план (полностью)
6. frontend_vue/src/router/index.ts — существующие маршруты (admin-products, admin-categories, admin-services — новый)
7. frontend_vue/src/i18n/admin/layout.ts — page.services уже есть в layout
8. frontend_vue/src/i18n/admin/products.ts — паттерн переводов (ключи services будут в отдельном файле)
9. frontend_vue/src/i18n/admin/index.ts — как подключаются модули переводов
10. frontend_vue/src/types/product.ts — ProductListItem как референс для ServiceListItem
11. frontend_vue/src/config/featureFlags.ts — adminServices: false (нужно включить)
12. frontend_vue/src/types/features.ts — adminServices уже есть
12. frontend_vue/src/views/admin/products/ProductsPage.vue — референс для структуры страницы
13. frontend_vue/src/composables/useProducts.ts — референс для composable
14. frontend_vue/src/services/productsService.ts — референс для service layer
15. frontend_vue/src/styles/admin/products_list.css — референс для CSS

После прочтения — выдай Checkpoint 0:

Page goal: (1 предложение)
Sections (ServicesPage): (все визуальные блоки)
Key entities: (объекты + все поля + типы)
User actions: (кнопки, формы, фильтры, модалы)
Related pages: (ссылки ИЗ и В)
API endpoints: (METHOD /path — для каждой операции)
Save mode: (quick-action — модал создания, список без карточки)
Existing components to reuse: (список из src/components/admin/)
Existing types to reuse: (TranslatedString из types/i18n.ts)
Route path: /admin/products/services
Feature flag names: adminServices (page-level, уже есть в features.ts, сейчас false)

Если поле пустое — перечитай план. Не переходи дальше.
STOP. Не продолжай до подтверждения Checkpoint 0 пользователем.
```

---

### Промпт 1 — TypeScript типы

```
Задача: создай frontend_vue/src/types/service.ts.

import type { TranslatedString } from './i18n'

export type ServicePriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'

export interface ServiceListItem {
  id: string
  name: TranslatedString
  costPrice: number | null
  sellingPrice: number | null
  priceUnit: ServicePriceUnit | null
  createdAt: string
}

export interface Service {
  id: string
  name: TranslatedString
  description: TranslatedString | null
  costPrice: number | null
  sellingPrice: number | null
  priceUnit: ServicePriceUnit | null
  createdAt: string
  updatedAt: string
}

export interface ServiceFilters {
  search: string
  sortBy: 'name' | 'costPrice' | 'sellingPrice' | null
  sortDir: 'asc' | 'desc'
}

Правила: никаких any, string | null (не undefined) для опциональных ссылок.
TranslatedString — из types/i18n.ts (не string).

После создания: npm run typecheck.
Checkpoint: 0 ошибок.
```

---

### Промпт 2 — Mock данные

```
Задача: создай frontend_vue/src/services/mocks/services.ts.

STORE должен содержать 5–7 услуг покрывающих:
- Разные типы услуг: резка, доставка, упаковка, покраска, сварка, аренда оборудования
- Разные priceUnit: 'EUR/vnt', 'EUR/kg', 'EUR/m', 'EUR/h'
- Услуги с costPrice и sellingPrice
- Услуги с costPrice = null (себестоимость не указана)
- Услуги с sellingPrice = null (цена не указана)

Все строки в STORE — на английском (TranslatedString формат: { ru: '...', en: '...', lt: '...' }).

Экспортируй функции:
  mockGetServices(filters: ServiceFilters, pagination: { page: number, pageSize: number }): PaginatedResponse<ServiceListItem>
    — фильтрация по search (name)
    — сортировка по sortBy/sortDir
    — пагинация
    — возвращает structuredClone

  mockGetService(id: string): Service | undefined
    — возвращает structuredClone

  mockCreateService(data: { name: TranslatedString; costPrice?: number | null; sellingPrice?: number | null; priceUnit?: ServicePriceUnit | null; description?: TranslatedString | null }): Service
    — генерирует id ('serv-' + ++idSeq), createdAt = new Date().toISOString()
    — push в STORE, вернуть structuredClone нового сервиса

  mockPatchService(id: string, delta: Partial<Pick<Service, 'name'|'description'|'costPrice'|'sellingPrice'|'priceUnit'>>): Service | undefined
    — merge delta в STORE-запись, вернуть structuredClone

  mockDeleteService(id: string): boolean
    — splice из STORE, return true; false если не найден

Правила:
- Все чтения: structuredClone. Mutations — напрямую в STORE.
- structuredClone НЕ работает на Vue reactive proxy → используй JSON.parse(JSON.stringify(...)) если нужно клонировать reactive данные.

После создания: npm run typecheck.
Checkpoint: 0 ошибок.
```

---

### Промпт 3 — Mock router регистрация

```
Задача: открой frontend_vue/src/services/mocks/index.ts.

Зарегистрируй маршруты Services по паттерну существующих доменов:
  GET    /api/services              → mockGetServices
  GET    /api/services/:id          → mockGetService
  POST   /api/services              → mockCreateService
  PATCH  /api/services/:id          → mockPatchService
  DELETE /api/services/:id          → mockDeleteService

Следуй точно тому же паттерну path-matching и method-checking что уже есть в файле.

После: npm run typecheck.
Checkpoint: 0 ошибок.
```

---

### Промпт 4 — Service layer

```
Задача: создай frontend_vue/src/services/servicesService.ts.

Функции строго по типам из src/types/service.ts:

  getServices(filters: ServiceFilters, pagination: { page: number, pageSize: number }): Promise<PaginatedResponse<ServiceListItem>>
  getService(id: string): Promise<Service>
  createService(data: { name: TranslatedString; costPrice?: number | null; sellingPrice?: number | null; priceUnit?: ServicePriceUnit | null; description?: TranslatedString | null }): Promise<Service>
  patchService(id: string, delta: Partial<Pick<Service, 'name'|'description'|'costPrice'|'sellingPrice'|'priceUnit'>>): Promise<Service>
  deleteService(id: string): Promise<void>

Используй apiGet, apiPost, apiPatch, apiDelete из src/services/api.ts.

После создания: npm run typecheck.
Checkpoint: 0 ошибок.
```

---

### Промпт 5 — Composable: useServices

```
Задача: создай frontend_vue/src/composables/useServices.ts.

export function useServices() {
  items: ref<ServiceListItem[]>([])
  loading: ref<boolean>(false)
  error: ref<string | null>(null)
  filters: reactive<ServiceFilters>({ search: '', sortBy: null, sortDir: 'asc' })
  pagination: usePagination(25)

  let initialized = false   // ВАЖНО: pitfall #20 — скелетон только при первой загрузке

  load(): async
    — if (!initialized) loading.value = true
    — const res = await getServices(filters, { page: pagination.page.value, pageSize: pagination.pageSize.value })
    — items.value = res.items
    — pagination.total.value = res.total
    — initialized = true
    — finally: loading.value = false

  deleteService(id: string): async
    — await deleteService(id) из service
    — toast.success(t('services.toast_deleted'))
    — await load()
    — при ошибке: toast.error(t('services.toast_error'))

  toggleSort(col: 'name' | 'costPrice' | 'sellingPrice'):
    — если filters.sortBy === col, переключить sortDir
    — иначе: sortBy = col, sortDir = 'asc'

  watch(filters, () => { pagination.reset(); load() }, { deep: true })
  watch([pagination.page, pagination.pageSize], load)

  return { items, loading, error, filters, pagination, load, deleteService, toggleSort }
}

Использует useToast() и useI18n().
Импорты: getServices, deleteService из servicesService.

После создания: npm run typecheck.
Checkpoint: 0 ошибок.
```

---

### Промпт 6 — i18n переводы

```
Задача: создай frontend_vue/src/i18n/admin/services.ts.

// Admin services translations
export const adminServices = {
  ru: {
    services: {
      title: 'Услуги',
      header_title: 'Услуги',
      search_placeholder: 'Поиск по названию...',
      btn_create: 'Добавить услугу',
      btn_back: 'Назад к товарам',
      col_name: 'Название',
      col_cost_price: 'Себестоимость',
      col_selling_price: 'Цена',
      col_unit: 'Единица',
      empty: 'Услуги не найдены',
      confirm_delete: 'Вы уверены, что хотите удалить эту услугу?',
      modal_create_title: 'Добавить услугу',
      field_name: 'Название',
      field_cost_price: 'Себестоимость',
      field_selling_price: 'Цена для клиента',
      field_unit: 'Единица измерения',
      field_description: 'Описание',
      price_unit_vnt: 'EUR/vnt (штука)',
      price_unit_kg: 'EUR/kg (кг)',
      price_unit_m: 'EUR/m (метр)',
      price_unit_h: 'EUR/ч (час)',
      btn_delete: 'Удалить',
      btn_discard: 'Отмена',
      page_size: 'на странице',
      of: 'из',
      filters: 'Фильтры',
      toast_deleted: 'Услуга удалена',
      toast_error: 'Произошла ошибка',
      toast_error_delete: 'Ошибка при удалении услуги',
    },
  },
  en: {
    services: {
      title: 'Services',
      header_title: 'Services',
      search_placeholder: 'Search by name...',
      btn_create: 'Add service',
      btn_back: 'Back to products',
      col_name: 'Name',
      col_cost_price: 'Cost price',
      col_selling_price: 'Selling price',
      col_unit: 'Unit',
      empty: 'No services found',
      confirm_delete: 'Are you sure you want to delete this service?',
      modal_create_title: 'Add service',
      field_name: 'Name',
      field_cost_price: 'Cost price',
      field_selling_price: 'Selling price',
      field_unit: 'Unit of measure',
      field_description: 'Description',
      price_unit_vnt: 'EUR/pcs (piece)',
      price_unit_kg: 'EUR/kg (kg)',
      price_unit_m: 'EUR/m (metre)',
      price_unit_h: 'EUR/h (hour)',
      btn_delete: 'Delete',
      btn_discard: 'Cancel',
      page_size: 'per page',
      of: 'of',
      filters: 'Filters',
      toast_deleted: 'Service deleted',
      toast_error: 'An error occurred',
      toast_error_delete: 'Error deleting service',
    },
  },
  lt: {
    services: {
      title: 'Paslaugos',
      header_title: 'Paslaugos',
      search_placeholder: 'Ieškoti pagal pavadinimą...',
      btn_create: 'Pridėti paslaugą',
      btn_back: 'Atgal į prekes',
      col_name: 'Pavadinimas',
      col_cost_price: 'Savikaina',
      col_selling_price: 'Kaina',
      col_unit: 'Vienetas',
      empty: 'Paslaugų nerasta',
      confirm_delete: 'Ar tikrai norite ištrinti šią paslaugą?',
      modal_create_title: 'Pridėti paslaugą',
      field_name: 'Pavadinimas',
      field_cost_price: 'Savikaina',
      field_selling_price: 'Kaina klientui',
      field_unit: 'Matavimo vienetas',
      field_description: 'Aprašymas',
      price_unit_vnt: 'EUR/vnt (vienetas)',
      price_unit_kg: 'EUR/kg (kg)',
      price_unit_m: 'EUR/m (metras)',
      price_unit_h: 'EUR/val (valanda)',
      btn_delete: 'Ištrinti',
      btn_discard: 'Atšaukti',
      page_size: 'puslapyje',
      of: 'iš',
      filters: 'Filtrai',
      toast_deleted: 'Paslauga ištrinta',
      toast_error: 'Įvyko klaida',
      toast_error_delete: 'Klaida trinant paslaugą',
    },
  },
}

Затем открой frontend_vue/src/i18n/admin/index.ts и добавь:
  import { adminServices } from './services'
  ...adminServices в вызов mergeLocales(...)

Также добавь в frontend_vue/src/i18n/admin/layout.ts в секцию page:
  services: 'Услуги' / 'Services' / 'Paslaugos'

Checkpoint: посчитать ключи services в adminRu — RU === EN === LT.
```

---

### Промпт 7 — ServicesPage.vue (полный файл)

```
Задача: создай frontend_vue/src/views/admin/products/ServicesPage.vue.

Сначала прочитай:
  frontend_vue/src/views/admin/products/ProductsPage.vue — референс
  frontend_vue/src/styles/admin/products_list.css — референс для CSS

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useServices } from '@/composables/useServices'
import { createService } from '@/services/servicesService'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/services_list.css'

const { t } = useI18n()
const router = useRouter()

useHead({ title: () => `Flexiron — ${t('services.header_title')}`, description: () => t('services.title') })

const { items, loading, error, filters, pagination, load, deleteService, toggleSort } = useServices()

const PAGE_SIZE_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const pageSizeStr = computed({
  get: () => String(pagination.pageSize.value),
  set: (v: string) => {
    pagination.pageSize.value = Number(v)
    pagination.reset()
  },
})

const PRICE_UNIT_OPTIONS = [
  { value: 'EUR/vnt', label: t('services.price_unit_vnt') },
  { value: 'EUR/kg', label: t('services.price_unit_kg') },
  { value: 'EUR/m', label: t('services.price_unit_m') },
  { value: 'EUR/h', label: t('services.price_unit_h') },
]

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const deletingId = ref<string | null>(null)
const newService = ref({
  name: '',
  costPrice: null as number | null,
  sellingPrice: null as number | null,
  priceUnit: null as string | null,
})
const creating = ref(false)

onMounted(() => { load() })

function openDeleteModal(id: string) {
  deletingId.value = id
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deletingId.value) return
  await deleteService(deletingId.value)
  showDeleteModal.value = false
  deletingId.value = null
}

async function handleCreate() {
  if (!newService.value.name.trim()) return
  creating.value = true
  try {
    await createService({
      name: newService.value.name.trim(),
      costPrice: newService.value.costPrice,
      sellingPrice: newService.value.sellingPrice,
      priceUnit: newService.value.priceUnit as any,
    })
    showCreateModal.value = false
    newService.value = { name: '', costPrice: null, sellingPrice: null, priceUnit: null }
    await load()
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="page-services" data-test="page-services">
    <div class="services-header" data-test="services-header">
      <h1 class="page-title">{{ t('services.header_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <button
          class="btn btn-primary"
          data-test="services-btn-create"
          @click="showCreateModal = true"
        >
          <SvgIcon name="plus-add" :width="18" :height="18" />
          <span>{{ t('services.btn_create') }}</span>
        </button>
        <router-link
          :to="{ name: 'admin-products' }"
          class="btn btn-secondary"
          data-test="services-link-products"
        >
          <SvgIcon name="tag" :width="18" :height="18" />
          <span>{{ t('services.btn_back') }}</span>
        </router-link>
      </div>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="services-table">
      <div class="filters-bar" data-test="services-filters">
        <div class="filters-bar-header">
          <span>{{ t('services.filters') }}</span>
        </div>
        <div class="filters-bar-content">
          <div class="filter-group" data-test="services-filter-search">
            <label class="field-label">{{ t('services.col_name') }}</label>
            <SearchInput
              v-model="filters.search"
              :placeholder="t('services.search_placeholder')"
              data-test="services-search"
            />
          </div>
        </div>
      </div>

      <div
        v-if="error"
        class="error-state"
        data-test="services-error"
      >
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>

      <div
        v-else-if="!loading && items.length === 0"
        class="empty-state"
        data-test="services-empty"
      >
        <SvgIcon name="tool" :width="48" :height="48" />
        <p>{{ t('services.empty') }}</p>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                <button class="th-sort-btn" @click="toggleSort('name')">
                  {{ t('services.col_name') }}
                  <span class="sort-icon-group">
                    <SvgIcon name="chevron-up" :width="16" :height="16"
                      class="sort-icon" :class="{ active: filters.sortBy === 'name' && filters.sortDir === 'asc' }" />
                    <SvgIcon name="chevron-down" :width="16" :height="16"
                      class="sort-icon" :class="{ active: filters.sortBy === 'name' && filters.sortDir === 'desc' }" />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('costPrice')">
                  {{ t('services.col_cost_price') }}
                  <span class="sort-icon-group">
                    <SvgIcon name="chevron-up" :width="16" :height="16"
                      class="sort-icon" :class="{ active: filters.sortBy === 'costPrice' && filters.sortDir === 'asc' }" />
                    <SvgIcon name="chevron-down" :width="16" :height="16"
                      class="sort-icon" :class="{ active: filters.sortBy === 'costPrice' && filters.sortDir === 'desc' }" />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('sellingPrice')">
                  {{ t('services.col_selling_price') }}
                  <span class="sort-icon-group">
                    <SvgIcon name="chevron-up" :width="16" :height="16"
                      class="sort-icon" :class="{ active: filters.sortBy === 'sellingPrice' && filters.sortDir === 'asc' }" />
                    <SvgIcon name="chevron-down" :width="16" :height="16"
                      class="sort-icon" :class="{ active: filters.sortBy === 'sellingPrice' && filters.sortDir === 'desc' }" />
                  </span>
                </button>
              </th>
              <th>{{ t('services.col_unit') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              class="services-row"
              data-test="services-row"
            >
              <td>{{ item.name ? item.name : '—' }}</td>
              <td>{{ item.costPrice != null ? item.costPrice : '—' }}</td>
              <td>{{ item.sellingPrice != null ? item.sellingPrice : '—' }}</td>
              <td>{{ item.priceUnit ?? '—' }}</td>
              <td>
                <div class="services-row-actions">
                  <button
                    v-tooltip="t('services.btn_delete')"
                    class="action-icon-btn action-danger"
                    data-test="services-delete-btn"
                    @click.stop="openDeleteModal(item.id)"
                  >
                    <SvgIcon name="trash" :width="16" :height="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5">
                <div class="pagination-bar" data-test="services-pagination">
                  <div class="page-size" data-test="services-page-size">
                    <span>{{ t('services.page_size') }}</span>
                    <CustomSelect
                      v-model="pageSizeStr"
                      :options="PAGE_SIZE_OPTIONS"
                      :open-up="true"
                      class="custom-select-sm"
                    />
                  </div>
                  <div class="pagination-nav">
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="!pagination.hasPrev.value"
                      :style="{ display: pagination.totalPages.value <= 1 ? 'none' : 'flex' }"
                      @click="pagination.prev"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14"
                        style="transform: rotate(180deg)" />
                    </button>
                    <div class="pagination-pages">
                      <template v-for="(p, i) in pagination.pageNumbers()" :key="i">
                        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                        <button v-else
                          class="page-btn"
                          :class="{ active: p === pagination.page.value }"
                          @click="pagination.goTo(p as number)">
                          {{ p }}
                        </button>
                      </template>
                    </div>
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="!pagination.hasNext.value"
                      :style="{ display: pagination.totalPages.value <= 1 ? 'none' : 'flex' }"
                      @click="pagination.next"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14" />
                    </button>
                  </div>
                  <div class="pagination-info">
                    <span>{{ pagination.showingFrom.value }}-{{ pagination.showingTo.value }}</span>
                    <span>&nbsp;{{ t('services.of') }}&nbsp;</span>
                    <span>{{ pagination.total.value }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassPanel>

    <AppModal
      v-model="showCreateModal"
      :title="t('services.modal_create_title')"
      size="small"
      data-test="modal-create-service"
    >
      <InputGroup :label="t('services.field_name')" :required="true">
        <input
          v-model="newService.name"
          class="glass-input"
          type="text"
          data-test="create-service-name"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_cost_price')" :required="false">
        <input
          v-model.number="newService.costPrice"
          class="glass-input"
          type="number"
          step="0.01"
          data-test="create-service-cost-price"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_selling_price')" :required="false">
        <input
          v-model.number="newService.sellingPrice"
          class="glass-input"
          type="number"
          step="0.01"
          data-test="create-service-selling-price"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_unit')" :required="false">
        <CustomSelect
          v-model="newService.priceUnit"
          :options="PRICE_UNIT_OPTIONS"
          data-test="create-service-unit"
        />
      </InputGroup>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="showCreateModal = false"
        >
          {{ t('services.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!newService.name.trim() || creating"
          data-test="create-service-submit"
          @click="handleCreate"
        >
          {{ t('services.btn_create') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteModal"
      :title="t('services.btn_delete')"
      size="small"
      data-test="modal-delete-service"
    >
      <p>{{ t('services.confirm_delete') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="showDeleteModal = false"
        >
          {{ t('services.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="confirm-delete-submit"
          @click="confirmDelete"
        >
          {{ t('services.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style>
/* Pagination dropdown — open upward so it sits over the table, not below the panel */
.custom-select-list.open-up {
  top: auto;
  bottom: calc(100% + 8px);
  transform: translateY(10px);
}
.custom-select-list.open-up.open {
  transform: translateY(0);
}
.data-table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
}
.data-table tfoot td {
  position: relative;
}
</style>

После создания: npm run typecheck && npm run lint.
Checkpoint: 0 ошибок.
```

---

### Промпт 8 — CSS

```
Задача: создай frontend_vue/src/styles/admin/services_list.css.

Скопируй структуру из frontend_vue/src/styles/admin/products_list.css, адаптируя классы:
  .page-services → .services-header, .services-row, .services-row-actions, .services-filters

Убедись что:
  - .services-header имеет gap: 16px, flex-wrap: wrap
  - .services-row-actions имеет display: flex, gap: 8px
  - .empty-state имеет display: flex, flex-direction: column, align-items: center
  - responsive: filters переходят в column на 600px

После создания: npm run typecheck && npm run lint.
Checkpoint: 0 ошибок.
```

---

### Промпт 9 — Роуты, флаги, навигация

```
Задача: зарегистрировать ServicesPage и обновить конфиги.

Шаг А — frontend_vue/src/router/index.ts:
  Добавь новый маршрут в секцию Products (после admin-category-card):
  {
    path: 'products/services',
    name: 'admin-services',
    component: () => import('@/views/admin/products/ServicesPage.vue'),
    meta: { layout: 'admin', featureFlag: 'adminServices' as FeatureFlagKey },
  }

Шаг Б — frontend_vue/src/config/featureFlags.ts:
  Включи adminServices: true (сейчас false)

Шаг В — frontend_vue/src/views/admin/products/ProductsPage.vue:
  В хедере, рядом с кнопкой «Категории», добавь:
  <router-link
    :to="{ name: 'admin-services' }"
    class="btn btn-secondary"
    data-test="products-link-services"
  >
    <SvgIcon name="settings-gear" :width="18" :height="18" />
    <span>{{ t('services.title') }}</span>
  </router-link>

  (Иконка settings-gear уже существует в SvgIcon.vue — проверено)

Шаг Г — frontend_vue/src/views/public/ScreensPage.vue:
  Добавь карточку для ServicesPage в массив categoriesPages (секция Products, после { id: '1.2', ... }):
  { id: '1.3', to: { name: 'admin-services' }, titleKey: 'services.header_title' }

  (Шаг Д удалён — adminServices: true уже присутствует в tests/e2e/helpers/flags.ts на строке 27)

После всех шагов: npm run typecheck && npm run lint.
Браузер: /admin/products/services — список услуг с mock-данными.
Checkpoint: 0 ошиб