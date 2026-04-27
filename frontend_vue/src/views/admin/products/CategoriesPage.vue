<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useCategories } from '@/composables/useCategories'
import { createCategory } from '@/services/categoriesService'

import '@styles/admin/categories_list.css'

const { t } = useI18n()
const router = useRouter()

useHead({ title: t('categories.title'), description: t('categories.title') })
const showCategories = useFeatureFlag('adminCategories')

const { items, loading, filters, load, deleteCategory } = useCategories()

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const deletingId = ref<string | null>(null)
const newCatName = ref('')
const newCatParentId = ref('')
const newCatDescription = ref('')

const parentOptions = computed(() => [
  { value: '', label: t('categories.field_parent_none') },
  ...items.value.map((item) => ({ value: item.id, label: item.name })),
])

onMounted(load)

function openDeleteModal(id: string) {
  deletingId.value = id
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deletingId.value) return
  await deleteCategory(deletingId.value)
  showDeleteModal.value = false
  deletingId.value = null
}

async function handleCreate() {
  if (!newCatName.value.trim()) return
  await createCategory({
    name: newCatName.value.trim(),
    parentId: newCatParentId.value || null,
    description: newCatDescription.value.trim() || null,
  })
  showCreateModal.value = false
  newCatName.value = ''
  newCatParentId.value = ''
  newCatDescription.value = ''
  await load()
}
</script>

<template>
  <div v-if="showCategories" class="page-categories" data-test="page-categories">
    <div class="categories-header" data-test="categories-header">
      <h1 class="page-title">{{ t('categories.header_title') }}</h1>
      <button class="btn btn-primary" data-test="categories-create-btn" @click="showCreateModal = true">
        <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
        <span>{{ t('categories.btn_create') }}</span>
      </button>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="categories-table">
      <div class="categories-search" data-test="categories-filters">
        <SearchInput
          v-model="filters.search"
          :placeholder="t('categories.search_placeholder')"
          data-test="categories-search"
        />
      </div>

      <div v-if="!loading && items.length === 0" class="empty-state" data-test="categories-empty">
        <SvgIcon name="folder" :width="48" :height="48" />
        <p>{{ t('categories.empty') }}</p>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('categories.col_name') }}</th>
              <th>{{ t('categories.col_parent') }}</th>
              <th>{{ t('categories.col_fields') }}</th>
              <th>{{ t('categories.col_products') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              data-test="categories-row"
              @click="router.push({ name: 'admin-category-card', params: { id: item.id } })"
            >
              <td>
                <div
                  class="categories-level-indent"
                  :style="{ paddingLeft: `calc(${item.level} * 16px + 12px)` }"
                >
                  {{ item.name }}
                </div>
              </td>
              <td>{{ item.parentName ?? '—' }}</td>
              <td>{{ item.fieldCount }}</td>
              <td>{{ item.productCount }}</td>
              <td>
                <div class="categories-row-actions">
                  <button
                    class="action-icon-btn action-danger"
                    :title="t('categories.btn_delete')"
                    data-test="categories-delete-btn"
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
      :title="t('categories.modal_create_title')"
      size="medium"
      data-test="modal-create-category"
    >
      <InputGroup :label="t('categories.field_name')">
        <input
          v-model="newCatName"
          type="text"
          class="glass-input"
          data-test="create-cat-name"
        />
      </InputGroup>
      <InputGroup :label="t('categories.field_parent')">
        <CustomSelect
          v-model="newCatParentId"
          :options="parentOptions"
          data-test="create-cat-parent"
        />
      </InputGroup>
      <InputGroup :label="t('categories.field_description')">
        <textarea
          v-model="newCatDescription"
          class="glass-input"
          rows="3"
          data-test="create-cat-description"
        />
      </InputGroup>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showCreateModal = false">
          {{ t('categories.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-test="create-cat-submit"
          @click="handleCreate"
        >
          {{ t('categories.btn_create') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteModal"
      :title="t('categories.btn_delete')"
      size="small"
      data-test="modal-delete-category"
    >
      <p>{{ t('categories.confirm_delete') }}</p>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">
          {{ t('categories.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="categories-confirm-delete-btn"
          @click="confirmDelete"
        >
          {{ t('categories.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
