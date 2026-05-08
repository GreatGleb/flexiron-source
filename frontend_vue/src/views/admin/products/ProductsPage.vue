<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useProducts } from '@/composables/useProducts'
import { useCategories } from '@/composables/useCategories'
import { useToast } from '@/composables/useToast'
import { createProduct } from '@/services/productsService'
import type { CategoryListItem } from '@/types/category'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import MultiSelect from '@/components/admin/ui/MultiSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/products_list.css'

const { t, locale } = useI18n()
const router = useRouter()
const toast = useToast()

useHead({ title: () => `Flexiron — ${t('products.header_title')}`, description: () => t('products.title') })

const { items, loading, error, filters, load, deleteProduct, pagination, toggleSort, tf } = useProducts()

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

const { items: catItems, load: loadCats } = useCategories()

function getCategoryPath(cat: CategoryListItem): string {
  const parts: string[] = [tf(cat.name)]
  let current = cat
  // Build path upwards using parentId — catItems is a flat list with parentName
  while (current.parentId) {
    const parent = catItems.value.find((c) => c.id === current.parentId)
    if (!parent) break
    parts.unshift(tf(parent.name))
    current = parent
  }
  return parts.join(' → ')
}

const categoryOptions = computed(() => [
  { value: '', label: t('products.filter_category_all') },
  ...catItems.value.map((c) => ({ value: c.id, label: getCategoryPath(c) })),
])

const categoryFilterOptions = computed(() =>
  catItems.value.map((c) => ({ value: c.id, label: getCategoryPath(c) })),
)

const newProductCategoryStr = computed({
  get: () => newProduct.value.categoryId ?? '',
  set: (v: string) => { newProduct.value.categoryId = v || null },
})

const PREFS_KEY = 'products_list_prefs'

function saveView() {
  const prefs = {
    filters: {
      search: filters.search,
      categoryIds: [...filters.categoryIds],
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    },
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const prefs = JSON.parse(raw) as { filters?: { search?: string; categoryIds?: string[]; sortBy?: string; sortDir?: string } }
    if (prefs.filters) {
      if (typeof prefs.filters.search === 'string') filters.search = prefs.filters.search
      if (Array.isArray(prefs.filters.categoryIds)) filters.categoryIds = prefs.filters.categoryIds
      if (prefs.filters.sortBy) filters.sortBy = prefs.filters.sortBy as typeof filters.sortBy
      if (prefs.filters.sortDir) filters.sortDir = prefs.filters.sortDir as typeof filters.sortDir
    }
  } catch {
    /* ignore malformed prefs */
  }
}

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const deletingId = ref<string | null>(null)
const newProduct = ref({ name: '', categoryId: null as string | null })
const creating = ref(false)

onMounted(() => {
  loadPrefs()
  loadCats()
  load()
})

function openDeleteModal(id: string) {
  deletingId.value = id
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deletingId.value) return
  await deleteProduct(deletingId.value)
  showDeleteModal.value = false
  deletingId.value = null
}

async function handleCreate() {
  if (!newProduct.value.name.trim()) return
  creating.value = true
  try {
    const created = await createProduct({
      name: newProduct.value.name.trim(),
      categoryId: newProduct.value.categoryId,
    }, locale.value)
    showCreateModal.value = false
    newProduct.value = { name: '', categoryId: null }
    await router.push({ name: 'admin-product-card', params: { id: created.id } })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="page-products" data-test="page-products">
    <div class="products-header" data-test="products-header">
      <h1 class="page-title">{{ t('products.header_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <button
          class="btn btn-primary"
          data-test="products-btn-create"
          @click="showCreateModal = true"
        >
          <SvgIcon name="plus-add" :width="18" :height="18" />
          <span>{{ t('products.btn_create') }}</span>
        </button>
        <router-link
          :to="{ name: 'admin-categories' }"
          class="btn btn-secondary"
          data-test="products-link-categories"
        >
          <SvgIcon name="folder" :width="18" :height="18" />
          <span>{{ t('categories.title') }}</span>
        </router-link>
        <router-link
          :to="{ name: 'admin-services' }"
          class="btn btn-secondary"
          data-test="products-link-services"
        >
          <SvgIcon name="tool" :width="18" :height="18" />
          <span>{{ t('services.title') }}</span>
        </router-link>
      </div>
    </div>

    <div class="filters-bar" data-test="products-filters">
      <div class="filters-bar-header">
        <span>{{ t('products.filters') }}</span>
      </div>
      <div class="filters-bar-content">
        <div class="filter-group" data-test="products-filter-search">
          <label class="field-label">{{ t('products.col_name') }}</label>
          <SearchInput
            v-model="filters.search"
            :placeholder="t('products.search_placeholder')"
            data-test="products-search"
          />
        </div>
        <div class="filter-group" data-test="products-filter-category">
          <label class="field-label">{{ t('products.col_category') }}</label>
          <MultiSelect
            v-model="filters.categoryIds"
            :options="categoryFilterOptions"
            :placeholder="t('products.select_categories')"
            data-test="products-filter-categories"
          />
        </div>
        <button class="btn btn-primary" data-test="products-save-view-btn" @click="saveView">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>{{ t('btn.save_view') }}</span>
        </button>
      </div>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="products-table">
      <div
        v-if="error"
        class="error-state"
        data-test="products-error"
      >
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>

      <div
        v-else-if="!loading && items.length === 0"
        class="empty-state"
        data-test="products-empty"
      >
        <SvgIcon name="tag" :width="48" :height="48" />
        <p>{{ t('products.empty') }}</p>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>
                <button class="th-sort-btn" @click="toggleSort('name')">
                  {{ t('products.col_name') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'name' && filters.sortDir === 'asc' }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'name' && filters.sortDir === 'desc' }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('category')">
                  {{ t('products.col_category') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'category' && filters.sortDir === 'asc' }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'category' && filters.sortDir === 'desc' }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('price')">
                  {{ t('products.col_price') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'price' && filters.sortDir === 'asc' }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{ active: filters.sortBy === 'price' && filters.sortDir === 'desc' }"
                    />
                  </span>
                </button>
              </th>
              <th>{{ t('products.col_unit') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              class="products-row"
              data-test="products-row"
            >
              <td>
                <router-link
                  v-if="item.name"
                  :to="{ name: 'admin-product-card', params: { id: item.id } }"
                  class="name-link"
                >
                  {{ tf(item.name) }}
                </router-link>
                <span v-else>—</span>
              </td>
              <td>{{ item.categoryName ? tf(item.categoryName) : '—' }}</td>
              <td>{{ item.price != null ? item.price : '—' }}</td>
              <td>{{ item.priceUnit ?? '—' }}</td>
              <td>
                <div class="products-row-actions">
                  <router-link
                    v-tooltip="t('tooltip.view_details')"
                    :to="{ name: 'admin-product-card', params: { id: item.id } }"
                    class="action-icon-btn"
                    data-test="products-view-btn"
                    @click.stop
                  >
                    <SvgIcon name="external-link" :width="16" :height="16" />
                  </router-link>
                  <button
                    v-tooltip="t('products.btn_delete')"
                    class="action-icon-btn action-danger"
                    data-test="products-delete-btn"
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
                <div class="pagination-bar" data-test="products-pagination">
                  <div class="page-size" data-test="products-page-size">
                    <span>{{ t('products.page_size') }}</span>
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
                      <SvgIcon
                        name="chevron-right"
                        :width="14"
                        :height="14"
                        style="transform: rotate(180deg)"
                      />
                    </button>
                    <div class="pagination-pages">
                      <template v-for="(p, i) in pagination.pageNumbers()" :key="i">
                        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                        <button
                          v-else
                          class="page-btn"
                          :class="{ active: p === pagination.page.value }"
                          @click="pagination.goTo(p as number)"
                        >
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
                    <span>&nbsp;{{ t('products.of') }}&nbsp;</span>
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
      :title="t('products.modal_create_title')"
      size="small"
      data-test="modal-create-product"
    >
      <InputGroup :label="t('products.field_name')" :required="true">
        <input
          v-model="newProduct.name"
          class="glass-input"
          type="text"
          data-test="create-product-name"
        />
      </InputGroup>
      <InputGroup :label="t('products.field_category')" :required="false">
        <CustomSelect
          v-model="newProductCategoryStr"
          :options="categoryOptions"
          data-test="create-product-category"
        />
      </InputGroup>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="showCreateModal = false"
        >
          {{ t('products.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!newProduct.name.trim() || creating"
          data-test="create-product-submit"
          @click="handleCreate"
        >
          {{ t('products.btn_create') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteModal"
      :title="t('products.btn_delete')"
      size="small"
      data-test="modal-delete-product"
    >
      <p>{{ t('products.confirm_delete') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="showDeleteModal = false"
        >
          {{ t('products.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="confirm-delete-submit"
          @click="confirmDelete"
        >
          {{ t('products.btn_delete') }}
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

/* Make sure the table wrapper doesn't clip upward-opening dropdowns */
.data-table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
}
.data-table tfoot td {
  position: relative;
}
</style>
