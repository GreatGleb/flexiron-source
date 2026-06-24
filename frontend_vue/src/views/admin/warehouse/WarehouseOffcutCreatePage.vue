<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseOffcutCreate } from '@/composables/useWarehouseOffcutCreate'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { BatchStatus } from '@/types/warehouse'
import type { UploadedFile } from '@/services/uploadsService'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/components/_status-pills.css'

// ─── Batch status pill mapping ──────────────────────────────────────────
const BATCH_STATUS_PILL: Record<BatchStatus, string> = {
  available: 'pill-success',
  in_storage: 'pill-info',
  in_production: 'pill-warning',
  sold: 'pill-mint',
  scrapped: 'pill-danger',
  expensed: 'pill-expensed',
  returned_to_supplier: 'pill-returned',
  partial: 'pill-warning',
  depleted: 'pill-consumed',
  reserved: 'pill-info',
  converted_to_offcuts: 'pill-offcut',
}

const { t } = useI18n()
const router = useRouter()

const {
  form,
  saving,
  save,
  productsLoading,
  productSearch,
  productCategoryFilter,
  categoryFilterOptions,
  filteredProducts,
  selectedProductId,
  selectedProduct,
  loadProducts,
  batchesLoading,
  batchSearch,
  filteredBatches,
  selectedBatchId,
  selectedBatch,
  noBatchesMessage,
  tf,
} = useWarehouseOffcutCreate()

useHead({
  title: () => `Flexiron — ${t('warehouse.offcut_create_title')}`,
  description: () => t('warehouse.offcut_create_title'),
})

onMounted(() => {
  loadProducts()
})

// ─── Products table: pagination ───────────────────────────────────────
const productPage = ref(1)
const productPageSize = ref(5)

const PAGE_SIZE_OPTIONS_PRODUCTS = [
  { value: '5', label: '5' },
  { value: '15', label: '15' },
  { value: '30', label: '30' },
  { value: '50', label: '50' },
]

const productPageSizeStr = computed({
  get: () => String(productPageSize.value),
  set: (v: string) => {
    productPageSize.value = Number(v)
    productPage.value = 1
  },
})

const productTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredProducts.value.length / productPageSize.value)),
)

watch([filteredProducts, productPageSize], () => {
  if (productPage.value > productTotalPages.value) productPage.value = productTotalPages.value
})

// First group ALL filtered products by category, then slice for current page
const pagedProductGroups = computed(() => {
  // Build category → products map from all filtered products
  const catMap = new Map<string, typeof filteredProducts.value>()
  for (const p of filteredProducts.value) {
    const catName = p.categoryName ? tf(p.categoryName) : t('warehouse.offcut_create_uncategorized')
    const list = catMap.get(catName)
    if (list) {
      list.push(p)
    } else {
      catMap.set(catName, [p])
    }
  }
  // Flatten grouped products into ordered array
  const allGrouped: { categoryName: string; products: typeof filteredProducts.value }[] = []
  for (const [catName, products] of catMap) {
    allGrouped.push({ categoryName: catName, products })
  }
  // Slice groups for current page
  const start = (productPage.value - 1) * productPageSize.value
  let count = 0
  const result: typeof allGrouped = []
  for (const group of allGrouped) {
    const groupSize = group.products.length
    if (count + groupSize <= start) {
      count += groupSize
      continue
    }
    if (count >= start + productPageSize.value) break
    const localStart = Math.max(0, start - count)
    const localEnd = Math.min(groupSize, start + productPageSize.value - count)
    result.push({
      categoryName: group.categoryName,
      products: group.products.slice(localStart, localEnd),
    })
    count += groupSize
  }
  return result
})

function productPageNumbers(): (number | '...')[] {
  const n = productTotalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const p = productPage.value
  if (p <= 3) return [1, 2, 3, 4, '...', n]
  if (p >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
  return [1, '...', p - 1, p, p + 1, '...', n]
}

// ─── File management ─────────────────────────────────────────────────────
const uploadedFiles = ref<Array<{ id: string; name: string; size: number }>>([])
const fileIdsToAttach = ref<string[]>([])

function onFilesUploaded(files: UploadedFile[]) {
  for (const f of files) {
    uploadedFiles.value.push({ id: f.fileId, name: f.name, size: f.size })
    fileIdsToAttach.value.push(f.fileId)
  }
}

function removeFile(fileId: string) {
  uploadedFiles.value = uploadedFiles.value.filter((f) => f.id !== fileId)
  fileIdsToAttach.value = fileIdsToAttach.value.filter((id) => id !== fileId)
}

async function handleSave() {
  const created = await save(fileIdsToAttach.value)
  if (created) {
    router.push({ name: 'admin-warehouse-offcut', params: { id: created.id } })
  }
}

function handleCancel() {
  router.push({ name: 'admin-warehouse', params: { tab: 'offcuts' } })
}

function selectProduct(id: string) {
  selectedProductId.value = selectedProductId.value === id ? null : id
}

function selectBatch(id: string) {
  selectedBatchId.value = selectedBatchId.value === id ? null : id
}
</script>

<template>
  <div class="page-offcut-create" data-test="offcut-create-page">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        {
          label: t('warehouse.tab_offcuts'),
          to: { name: 'admin-warehouse', params: { tab: 'offcuts' } },
        },
        { label: t('warehouse.offcut_create_title') },
      ]"
    />

    <div class="offcut-card-header">
      <h1 class="page-title">{{ t('warehouse.offcut_create_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static" data-test="offcut-create-action-bar">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="offcut-create-cancel-btn"
          @click="handleCancel"
        >
          {{ t('warehouse.offcut_create_cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-save dirty"
          :class="{ loading: saving }"
          :disabled="saving"
          data-test="offcut-create-save-btn"
          @click="handleSave"
        >
          <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
          <span>{{
            saving ? t('warehouse.btn_save') + '...' : t('warehouse.offcut_create_save')
          }}</span>
        </button>
      </div>
    </div>

    <div class="main-card-content" data-test="offcut-create-content">
      <!-- ════════════════════════════════════════════════════════════════════════
           Product & Batch Selection Section
           ════════════════════════════════════════════════════════════════════════ -->
      <GlassPanel
        :title="t('warehouse.offcut_create_select_product')"
        :loading="productsLoading"
        :skeleton-rows="4"
        data-test="offcut-create-product-panel"
      >
        <!-- Product filters -->
        <div
          class="products-filters"
          style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap"
        >
          <div style="flex: 1 1 180px">
            <SearchInput
              v-model="productSearch"
              :placeholder="t('warehouse.offcut_create_search_product')"
            />
          </div>
          <div style="min-width: 160px">
            <CustomSelect v-model="productCategoryFilter" :options="categoryFilterOptions" />
          </div>
        </div>

        <!-- Product list with radio buttons -->
        <div class="data-table-wrapper">
          <table class="data-table products-table" data-test="offcut-create-products-table">
            <thead>
              <tr>
                <th style="width: 32px"></th>
                <th>{{ t('warehouse.col_product') }}</th>
                <th v-if="false"></th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredProducts.length === 0 && !productsLoading">
                <tr>
                  <td colspan="2" style="text-align: center; opacity: 0.5; padding: 24px 0">
                    {{ t('warehouse.offcut_create_no_products_found') }}
                  </td>
                </tr>
              </template>
              <template v-for="group in pagedProductGroups" :key="group.categoryName">
                <tr class="product-group-header">
                  <td
                    colspan="2"
                    style="
                      font-weight: 700;
                      font-size: 11px;
                      text-transform: uppercase;
                      letter-spacing: 0.05em;
                      opacity: 0.5;
                      padding-top: 12px;
                    "
                  >
                    {{ group.categoryName }}
                  </td>
                </tr>
                <tr
                  v-for="p in group.products"
                  :key="p.id"
                  :data-product-id="p.id"
                  class="product-row"
                  :class="{ 'row-selected': selectedProductId === p.id }"
                  data-test="offcut-create-product-row"
                  @click="selectProduct(p.id)"
                >
                  <td>
                    <input
                      type="radio"
                      :checked="selectedProductId === p.id"
                      :value="p.id"
                      name="offcut-product"
                      data-test="offcut-create-product-radio"
                      tabindex="-1"
                      @click.stop
                      @change.stop="selectProduct(p.id)"
                    />
                  </td>
                  <td>{{ tf(p.name) }}</td>
                </tr>
              </template>
            </tbody>
            <tfoot v-if="filteredProducts.length > 0">
              <tr>
                <td colspan="2">
                  <div class="pagination-bar">
                    <div class="page-size">
                      <span>{{ t('warehouse.page_size') }}</span>
                      <CustomSelect
                        v-model="productPageSizeStr"
                        :options="PAGE_SIZE_OPTIONS_PRODUCTS"
                        :open-up="true"
                        class="custom-select-sm"
                      />
                    </div>
                    <div class="pagination-nav">
                      <button
                        class="btn btn-icon btn-sm"
                        :disabled="productPage <= 1"
                        @click="productPage = Math.max(1, productPage - 1)"
                      >
                        <SvgIcon
                          name="chevron-right"
                          :width="14"
                          :height="14"
                          style="transform: rotate(180deg)"
                        />
                      </button>
                      <div class="pagination-pages">
                        <template v-for="(p, i) in productPageNumbers()" :key="i">
                          <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                          <button
                            v-else
                            class="page-btn"
                            :class="{ active: p === productPage }"
                            @click="productPage = p as number"
                          >
                            {{ p }}
                          </button>
                        </template>
                      </div>
                      <button
                        class="btn btn-icon btn-sm"
                        :disabled="productPage >= productTotalPages"
                        @click="productPage = Math.min(productTotalPages, productPage + 1)"
                      >
                        <SvgIcon name="chevron-right" :width="14" :height="14" />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </GlassPanel>

      <!-- Batch selection (visible only when a product is selected) -->
      <GlassPanel
        v-if="selectedProductId"
        :title="t('warehouse.offcut_create_select_batch')"
        :loading="batchesLoading"
        :skeleton-rows="3"
        style="margin-top: 16px"
        data-test="offcut-create-batch-panel"
      >
        <!-- No batches message -->
        <template v-if="noBatchesMessage">
          <div class="no-batches-message" style="text-align: center; padding: 24px 0; opacity: 0.6">
            <SvgIcon name="search" :width="32" :height="32" style="margin-bottom: 8px" />
            <p>{{ noBatchesMessage }}</p>
            <p style="font-size: 12px; margin-top: 4px">
              {{ t('warehouse.offcut_create_no_batches_hint') }}
            </p>
          </div>
        </template>

        <!-- Batch list -->
        <template v-else>
          <div style="margin-bottom: 12px">
            <SearchInput
              v-model="batchSearch"
              :placeholder="t('warehouse.offcut_create_search_batch')"
            />
          </div>
          <div class="data-table-wrapper">
            <table class="data-table" data-test="offcut-create-batches-table">
              <thead>
                <tr>
                  <th style="width: 32px"></th>
                  <th>{{ t('warehouse.col_batch_number') }}</th>
                  <th>{{ t('warehouse.col_quantity') }}</th>
                  <th>{{ t('warehouse.col_remaining') }}</th>
                  <th>{{ t('warehouse.col_status') }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="filteredBatches.length === 0 && !batchesLoading">
                  <tr>
                    <td colspan="5" style="text-align: center; opacity: 0.5; padding: 24px 0">
                      {{ t('warehouse.empty_filtered_offcuts') }}
                    </td>
                  </tr>
                </template>
                <tr
                  v-for="b in filteredBatches"
                  :key="b.id"
                  :data-batch-id="b.id"
                  class="product-row"
                  :class="{ 'row-selected': selectedBatchId === b.id }"
                  data-test="offcut-create-batch-row"
                  @click="selectBatch(b.id)"
                >
                  <td>
                    <input
                      type="radio"
                      :checked="selectedBatchId === b.id"
                      :value="b.id"
                      name="offcut-batch"
                      data-test="offcut-create-batch-radio"
                      tabindex="-1"
                      @click.stop
                      @change.stop="selectBatch(b.id)"
                    />
                  </td>
                  <td>{{ b.batchNumber }}</td>
                  <td>{{ b.quantity }} {{ t(`warehouse.unit_${b.unit}`) }}</td>
                  <td>{{ b.quantityRemaining }} {{ t(`warehouse.unit_${b.unit}`) }}</td>
                  <td>
                    <span class="status-pill" :class="BATCH_STATUS_PILL[b.status]">
                      {{ t(`warehouse.batch_status_${b.status}`) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </GlassPanel>

      <!-- ════════════════════════════════════════════════════════════════════════
           Dimensions & Details Section (3-column grid)
           ════════════════════════════════════════════════════════════════════════ -->
      <div class="entity-card-grid" style="margin-top: 16px">
        <!-- Left column: offcut type -->
        <div class="entity-col-left">
          <GlassPanel :skeleton-rows="2" data-test="offcut-create-left-panel">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_offcut_type') }}</span>
                <span v-tooltip="t('warehouse.col_offcut_type_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <div
                class="glass-input"
                style="display: flex; align-items: center; opacity: 0.7; cursor: default"
              >
                <span v-if="form.offcutType">
                  {{ t(`warehouse.offcut_type_${form.offcutType}`) }}
                </span>
                <span v-else style="color: var(--text-dim)">
                  {{ t('warehouse.offcut_create_select_type') }}
                </span>
              </div>
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_category') }}</span>
                <span v-tooltip="t('warehouse.offcut_create_category_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <div
                class="glass-input"
                style="display: flex; align-items: center; opacity: 0.7; cursor: default"
              >
                <span v-if="selectedProduct && selectedProduct.categoryName">
                  {{ tf(selectedProduct.categoryName) }}
                </span>
                <span v-else-if="selectedProduct" style="color: var(--text-dim)">
                  {{ t('warehouse.offcut_create_uncategorized') }}
                </span>
                <span v-else style="color: var(--text-dim)">
                  {{ t('warehouse.offcut_create_category_placeholder') }}
                </span>
              </div>
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
          </GlassPanel>
        </div>

        <!-- Center column: dimensions -->
        <div class="entity-col-center">
          <GlassPanel :skeleton-rows="4" data-test="offcut-create-center-panel">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_length') }}</span>
                <span v-tooltip="t('warehouse.col_length_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                v-model.number="form.lengthMm"
                class="glass-input"
                type="number"
                min="0"
                step="1"
                :placeholder="t('warehouse.field_length_placeholder')"
                data-test="field-length"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_width') }}</span>
                <span v-tooltip="t('warehouse.col_width_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                v-model.number="form.widthMm"
                class="glass-input"
                type="number"
                min="0"
                step="1"
                :placeholder="t('warehouse.field_width_placeholder')"
                data-test="field-width"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_thickness') }}</span>
                <span v-tooltip="t('warehouse.col_thickness_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                v-model.number="form.thicknessMm"
                class="glass-input"
                type="number"
                min="0"
                step="1"
                :placeholder="t('warehouse.field_thickness_placeholder')"
                data-test="field-thickness"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_weight') }}</span>
                <span v-tooltip="t('warehouse.col_weight_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                v-model.number="form.weightKg"
                class="glass-input"
                type="number"
                min="0"
                step="0.1"
                :placeholder="t('warehouse.field_weight_placeholder')"
                data-test="field-weight"
              />
            </div>
          </GlassPanel>
        </div>

        <!-- Right column: quantity, unit, location, notes -->
        <div class="entity-col-right">
          <GlassPanel :skeleton-rows="4" data-test="offcut-create-right-panel">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_quantity') }}</span>
                <span v-tooltip="t('warehouse.offcut_col_quantity_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                v-model.number="form.quantity"
                class="glass-input"
                type="number"
                min="1"
                step="1"
                :placeholder="t('warehouse.field_quantity_placeholder')"
                data-test="field-quantity"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.field_unit') }}</span>
                <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <div
                class="glass-input"
                style="display: flex; align-items: center; opacity: 0.7; cursor: default"
              >
                <span v-if="selectedBatch">
                  {{ t(`warehouse.unit_${form.unit}`) }}
                </span>
                <span v-else style="color: var(--text-dim)">
                  {{ t('warehouse.offcut_create_unit_placeholder') }}
                </span>
              </div>
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.field_notes') }}</span>
                <span v-tooltip="t('warehouse.offcut_field_notes_hint')" class="info-hint">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <textarea
                v-model="form.notes"
                class="glass-input batch-notes-input"
                :placeholder="t('warehouse.field_notes_placeholder')"
                data-test="field-notes"
              />
            </div>
          </GlassPanel>
        </div>
      </div>

      <!-- FULL WIDTH: Location section -->
      <GlassPanel
        :title="t('warehouse.section_batch_location')"
        data-test="offcut-create-location-section"
      >
        <div class="location-grid">
          <div class="input-group">
            <label class="field-label">
              <span>{{ t('warehouse.field_location_rack') }}</span>
              <span v-tooltip="t('warehouse.field_location_rack_hint')" class="info-hint">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </label>
            <input
              v-model="form.locationRack"
              class="glass-input"
              type="text"
              data-test="field-location-rack"
            />
          </div>
          <div class="input-group">
            <label class="field-label">
              <span>{{ t('warehouse.field_location_row') }}</span>
              <span v-tooltip="t('warehouse.field_location_row_hint')" class="info-hint">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </label>
            <input
              v-model="form.locationRow"
              class="glass-input"
              type="text"
              data-test="field-location-row"
            />
          </div>
          <div class="input-group">
            <label class="field-label">
              <span>{{ t('warehouse.field_location_cell') }}</span>
              <span v-tooltip="t('warehouse.field_location_cell_hint')" class="info-hint">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </label>
            <input
              v-model="form.locationCell"
              class="glass-input"
              type="text"
              data-test="field-location-cell"
            />
          </div>
        </div>
        <div class="input-group" style="margin-top: 12px">
          <label class="field-label">
            <span>{{ t('warehouse.field_location_notes') }}</span>
            <span v-tooltip="t('warehouse.field_location_notes_hint')" class="info-hint">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </span>
          </label>
          <textarea
            v-model="form.locationNotes"
            class="glass-input"
            data-test="field-location-notes"
          />
        </div>
      </GlassPanel>

      <!-- FULL WIDTH: Files section -->
      <GlassPanel
        :title="t('warehouse.section_batch_files')"
        data-test="offcut-create-files-section"
        style="margin-top: 16px"
      >
        <div class="file-list" data-test="offcut-create-file-list" style="margin-bottom: 15px">
          <FileItem
            v-for="f in uploadedFiles"
            :key="f.id"
            :name="f.name"
            download-url="#"
            data-test="offcut-create-file-item"
            @delete="removeFile(f.id)"
          />
        </div>
        <p v-if="uploadedFiles.length === 0" class="text-muted" style="padding: 12px 0">
          {{ t('warehouse.no_files') }}
        </p>
        <DropZone
          data-test="offcut-create-file-dropzone"
          :hint="t('warehouse.dropzone_hint')"
          :multiple="true"
          @uploaded="onFilesUploaded"
        />
      </GlassPanel>
    </div>
  </div>
</template>

<style scoped>
.products-table .product-row {
  cursor: pointer;
  transition: background 0.15s;
}
.products-table .product-row:hover {
  background: rgba(255, 255, 255, 0.05);
}
.products-table .product-row.row-selected {
  background: rgba(24, 144, 255, 0.08);
}
.products-table .product-group-header td {
  border-bottom: none;
}
.products-table tfoot td {
  overflow: visible;
}
.no-batches-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-dim);
}
</style>
