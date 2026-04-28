<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useProducts } from '@/composables/useProducts'
import { useCategories } from '@/composables/useCategories'
import { createProduct } from '@/services/productsService'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/products_list.css'

const { t } = useI18n()
const router = useRouter()

useHead({ title: () => t('products.title'), description: () => t('products.title') })

const showAdminServices = useFeatureFlag('adminServices')

const { items, loading, filters, load, deleteProduct } = useProducts()
const { items: catItems, load: loadCats } = useCategories()

const categoryOptions = computed(() => [
  { value: '', label: t('products.filter_category_all') },
  ...catItems.value.map((c) => ({ value: c.id, label: c.name })),
])

const categoryFilterStr = computed({
  get: () => filters.categoryId ?? '',
  set: (v: string) => { filters.categoryId = v || null },
})

const newProductCategoryStr = computed({
  get: () => newProduct.value.categoryId ?? '',
  set: (v: string) => { newProduct.value.categoryId = v || null },
})

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const deletingId = ref<string | null>(null)
const newProduct = ref({ name: '', categoryId: null as string | null })
const creating = ref(false)

onMounted(() => {
  load()
  loadCats()
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
    })
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
          v-if="showAdminServices"
          :to="{ name: 'admin-services' }"
          class="btn btn-secondary"
          data-test="products-link-services"
        >
          <span>{{ t('products.title') }}</span>
        </router-link>
      </div>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="products-table">
      <div class="products-filters">
        <SearchInput
          v-model="filters.search"
          :placeholder="t('products.search_placeholder')"
          data-test="products-search"
        />
        <CustomSelect
          v-model="categoryFilterStr"
          :options="categoryOptions"
          data-test="products-filter-category"
        />
      </div>

      <div
        v-if="!loading && items.length === 0"
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
              <th>{{ t('products.col_name') }}</th>
              <th>{{ t('products.col_category') }}</th>
              <th>{{ t('products.col_price') }}</th>
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
              @click="router.push({ name: 'admin-product-card', params: { id: item.id } })"
            >
              <td>{{ item.name }}</td>
              <td>{{ item.categoryName ?? '—' }}</td>
              <td>{{ item.price != null ? item.price : '—' }}</td>
              <td>{{ item.priceUnit ?? '—' }}</td>
              <td>
                <div class="products-row-actions">
                  <button
                    class="action-icon-btn action-danger"
                    :title="t('products.btn_delete')"
                    data-test="products-delete-btn"
                    @click.stop="openDeleteModal(item.id)"
                  >
                    <SvgIcon name="trash" :width="16" :height="16" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
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
