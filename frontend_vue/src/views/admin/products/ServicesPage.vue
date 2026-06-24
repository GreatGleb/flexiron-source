<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useServices } from '@/composables/useServices'
import { createService } from '@/services/servicesService'
import { useToast } from '@/composables/useToast'
import type { ServicePriceUnit, ServiceListItem } from '@/types/service'
import type { TranslatedString } from '@/types/i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/services_list.css'

const { t, locale } = useI18n()
const toast = useToast()

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
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

const { items, loading, error, filters, pagination, load, deleteService, toggleSort, tf } =
  useServices()

useHead({
  title: () => `Flexiron — ${t('services.header_title')}`,
  description: () => t('services.title'),
})

const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const deletingItem = ref<{ id: string; name: TranslatedString } | null>(null)

const createForm = reactive({
  name: '',
  costPrice: 0,
  sellingPrice: 0,
  priceUnit: 'EUR/vnt' as ServicePriceUnit,
  description: '',
})

const priceUnitOptions = [
  { value: 'EUR/vnt', label: t('services.price_unit_eur_vnt') },
  { value: 'EUR/kg', label: t('services.price_unit_eur_kg') },
  { value: 'EUR/m', label: t('services.price_unit_eur_m') },
  { value: 'EUR/h', label: t('services.price_unit_eur_h') },
]

async function handleCreate() {
  if (!createForm.name.trim()) return
  try {
    await createService(
      {
        name: createForm.name.trim(),
        costPrice: createForm.costPrice,
        sellingPrice: createForm.sellingPrice,
        priceUnit: createForm.priceUnit,
        description: createForm.description.trim() || undefined,
      },
      locale.value,
    )
    showCreateModal.value = false
    createForm.name = ''
    createForm.costPrice = 0
    createForm.sellingPrice = 0
    createForm.priceUnit = 'EUR/vnt'
    createForm.description = ''
    toast.success(t('services.toast_created'))
    await load()
  } catch {
    toast.error(t('services.toast_error'))
  }
}

function confirmDelete(item: ServiceListItem) {
  deletingItem.value = { id: item.id, name: item.name }
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  await deleteService(deletingItem.value.id)
  showDeleteModal.value = false
  deletingItem.value = null
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="page-services" data-test="page-services">
    <Breadcrumb
      :items="[
        { label: t('products.header_title'), to: { name: 'admin-products' } },
        { label: t('services.header_title') },
      ]"
    />
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
      </div>
    </div>

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

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="services-table">
      <div v-if="error" class="error-state" data-test="services-error">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>

      <div
        v-else-if="!loading && items.length === 0"
        class="empty-state"
        data-test="services-empty"
      >
        <SvgIcon name="package" :width="48" :height="48" />
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
                <button class="th-sort-btn" @click="toggleSort('costPrice')">
                  {{ t('services.col_cost_price') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'costPrice' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'costPrice' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>
                <button class="th-sort-btn" @click="toggleSort('sellingPrice')">
                  {{ t('services.col_selling_price') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'sellingPrice' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'sellingPrice' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>{{ t('services.col_price_unit') }}</th>
              <th>{{ t('services.col_actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" class="services-row" data-test="services-row">
              <td>
                <router-link
                  v-if="item.name"
                  :to="{ name: 'admin-service-card', params: { id: item.id } }"
                  class="name-link"
                >
                  {{ tf(item.name) }}
                </router-link>
                <span v-else>—</span>
              </td>
              <td>{{ item.costPrice != null ? `${item.costPrice.toFixed(2)} €` : '—' }}</td>
              <td>{{ item.sellingPrice != null ? `${item.sellingPrice.toFixed(2)} €` : '—' }}</td>
              <td>
                {{
                  t('services.price_unit_' + item.priceUnit.replace('EUR/', 'eur_').toLowerCase())
                }}
              </td>
              <td>
                <div class="services-row-actions">
                  <router-link
                    v-tooltip="t('services.btn_open')"
                    :to="{ name: 'admin-service-card', params: { id: item.id } }"
                    class="action-icon-btn"
                    data-test="services-btn-open"
                  >
                    <SvgIcon name="external-link" :width="16" :height="16" />
                  </router-link>
                  <button
                    v-tooltip="t('services.btn_delete')"
                    class="action-icon-btn action-danger"
                    data-test="services-btn-delete"
                    @click.stop="confirmDelete(item)"
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
      data-test="services-create-modal"
    >
      <InputGroup :label="t('services.field_name')" :required="true">
        <input
          v-model="createForm.name"
          class="glass-input"
          type="text"
          data-test="create-service-name"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_cost_price')" :required="false">
        <input
          v-model.number="createForm.costPrice"
          class="glass-input"
          type="number"
          step="0.01"
          data-test="create-service-cost-price"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_selling_price')" :required="false">
        <input
          v-model.number="createForm.sellingPrice"
          class="glass-input"
          type="number"
          step="0.01"
          data-test="create-service-selling-price"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_price_unit')" :required="false">
        <CustomSelect
          v-model="createForm.priceUnit"
          :options="priceUnitOptions"
          data-test="create-service-price-unit"
        />
      </InputGroup>
      <InputGroup :label="t('services.field_description')" :required="false">
        <textarea
          v-model="createForm.description"
          class="glass-input"
          data-test="create-service-description"
        />
      </InputGroup>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showCreateModal = false">
          {{ t('services.btn_cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!createForm.name.trim()"
          data-test="create-service-submit"
          @click="handleCreate"
        >
          {{ t('services.btn_create') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteModal"
      :title="t('services.modal_delete_title')"
      size="small"
      data-test="services-delete-modal"
    >
      <p>
        {{ t('services.modal_delete_text', { name: deletingItem ? tf(deletingItem.name) : '' }) }}
      </p>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showDeleteModal = false">
          {{ t('services.btn_cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="confirm-delete-submit"
          @click="handleDelete"
        >
          {{ t('services.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style>
.page-services {
  /* minimal — main styles in separate CSS file */
}
.services-header {
  /* minimal — main styles in separate CSS file */
}
.services-row-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
