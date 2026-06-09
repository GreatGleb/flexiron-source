<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseBatchCreate } from '@/composables/useWarehouseBatchCreate'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/components/_status-pills.css'
import type { UploadedFile } from '@/services/uploadsService'

const { t } = useI18n()
const router = useRouter()

const {
  form, saving, errors,
  productsLoading, productSearch, productCategoryFilter, categoryFilterOptions,
  filteredProducts, selectedProductId, selectedProduct,
  productSupplierOptions,
  CURRENCY_OPTIONS,
  quantityStep,
  loadOptions, loadProducts, save, tf, clearError,
} = useWarehouseBatchCreate()

useHead({
  title: () => `Flexiron — ${t('warehouse.batch_create_title')}`,
  description: () => t('warehouse.batch_create_title'),
})

onMounted(() => {
  loadProducts()
  loadOptions()
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

// Group products by category and slice for current page
const pagedProductGroups = computed(() => {
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
  const allGrouped: { categoryName: string; products: typeof filteredProducts.value }[] = []
  for (const [catName, products] of catMap) {
    allGrouped.push({ categoryName: catName, products })
  }
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
  uploadedFiles.value = uploadedFiles.value.filter(f => f.id !== fileId)
  fileIdsToAttach.value = fileIdsToAttach.value.filter(id => id !== fileId)
}

async function handleSave() {
  const batchId = await save(fileIdsToAttach.value.length > 0 ? fileIdsToAttach.value : undefined)
  if (batchId) {
    router.push({ name: 'admin-warehouse-batch', params: { id: batchId } })
  }
}

function handleCancel() {
  router.push({ name: 'admin-warehouse', params: { tab: 'batches' } })
}

function selectProduct(id: string) {
  selectedProductId.value = selectedProductId.value === id ? null : id
}

// ─── Currency selector for unit price ───────────────────────────────────
const currencyOpen = ref(false)

function selectCurrency(c: string) {
  form.currency = c
  currencyOpen.value = false
}

function onDocClickCloseCurrency(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.('.input-with-suffix')
  if (!el) currencyOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClickCloseCurrency))
onBeforeUnmount(() => document.removeEventListener('click', onDocClickCloseCurrency))
</script>

<template>
  <div class="page-batch-create" data-test="batch-create-page">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        { label: t('warehouse.tab_batches'), to: { name: 'admin-warehouse', params: { tab: 'batches' } } },
        { label: t('warehouse.batch_create_title') },
      ]"
    />

    <div class="offcut-card-header">
      <h1 class="page-title">{{ t('warehouse.batch_create_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static" data-test="batch-create-action-bar">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="batch-create-cancel-btn"
          @click="handleCancel"
        >
          {{ t('warehouse.batch_create_cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-save dirty"
          :class="{ loading: saving }"
          :disabled="saving"
          data-test="batch-create-save-btn"
          @click="handleSave"
        >
          <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
          <span>{{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.batch_create_save') }}</span>
        </button>
      </div>
    </div>

    <div class="main-card-content" data-test="batch-create-content">
      <!-- ════════════════════════════════════════════════════════════════════════
           Product Selection Section (full width)
           ════════════════════════════════════════════════════════════════════════ -->
      <GlassPanel
        :loading="productsLoading"
        :skeleton-rows="4"
        data-test="batch-create-product-panel"
      >
        <template #header>
          <span class="panel-title">{{ t('warehouse.batch_create_select_product_title') }} <span class="required-star">*</span></span>
          <span
            v-if="selectedProduct"
            class="selected-product-badge"
            data-test="batch-create-selected-product-badge"
          >
            {{ tf(selectedProduct.name) }}
          </span>
        </template>

        <!-- Product filters -->
        <div class="products-filters" style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap">
          <div style="flex: 1 1 180px">
            <SearchInput
              v-model="productSearch"
              :placeholder="t('warehouse.batch_create_search_product')"
            />
          </div>
          <div style="min-width: 160px">
            <CustomSelect
              v-model="productCategoryFilter"
              :options="categoryFilterOptions"
            />
          </div>
        </div>

        <!-- Product list with radio buttons -->
        <div class="data-table-wrapper">
          <table class="data-table products-table" data-test="batch-create-products-table">
            <thead>
              <tr>
                <th style="width: 32px"></th>
                <th>{{ t('warehouse.col_product') }}</th>
                <th>{{ t('warehouse.col_category') }}</th>
                <th>{{ t('warehouse.col_unit') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredProducts.length === 0 && !productsLoading">
                <tr>
                  <td :colspan="4" style="text-align: center; opacity: 0.5; padding: 24px 0">
                    {{ t('warehouse.batch_create_no_products') }}
                  </td>
                </tr>
              </template>
              <template v-for="group in pagedProductGroups" :key="group.categoryName">
                <tr class="product-group-header">
                  <td
                    :colspan="4"
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
                  data-test="batch-create-product-row"
                  @click="selectProduct(p.id)"
                >
                  <td>
                    <input
                      type="radio"
                      :checked="selectedProductId === p.id"
                      :value="p.id"
                      name="batch-product"
                      data-test="batch-create-product-radio"
                      tabindex="-1"
                      @click.stop
                      @change.stop="selectProduct(p.id)"
                    />
                  </td>
                  <td>{{ tf(p.name) }}</td>
                  <td>{{ p.categoryName ? tf(p.categoryName) : '—' }}</td>
                  <td>{{ (p as { unit?: string }).unit ? t(`warehouse.unit_${(p as { unit?: string }).unit}`) : '—' }}</td>
                </tr>
              </template>
            </tbody>
            <tfoot v-if="filteredProducts.length > 0">
              <tr>
                <td :colspan="4">
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

      <!-- ════════════════════════════════════════════════════════════════════════
           Form Fields (3-column grid)
           ════════════════════════════════════════════════════════════════════════ -->
      <div class="entity-card-grid" style="margin-top: 16px">
        <!-- Left column: Supplier -->
        <div class="entity-col-left">
          <GlassPanel :skeleton-rows="1" data-test="batch-create-left-panel">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_supplier') }}</span>
                <span v-tooltip="t('warehouse.col_supplier_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <CustomSelect
                v-model="form.supplierId"
                :options="productSupplierOptions"
                :placeholder="t('warehouse.col_supplier')"
                :disabled="!selectedProductId"
                data-test="field-supplier"
              />
              <span
                v-if="!selectedProductId"
                class="field-hint"
                data-test="supplier-hint"
              >
                {{ t('warehouse.batch_create_select_supplier_hint') }}
              </span>
            </div>
          </GlassPanel>
        </div>

        <!-- Center column: Batch details -->
        <div class="entity-col-center">
          <GlassPanel :skeleton-rows="4" data-test="batch-create-center-panel">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_batch_number') }} <span class="required-star">*</span></span>
                <span v-tooltip="t('warehouse.col_batch_number_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                <span v-if="errors.batchNumber" class="field-error">{{ errors.batchNumber }}</span>
              </label>
              <input
                v-model="form.batchNumber"
                class="glass-input"
                :class="{ 'has-error': errors.batchNumber }"
                type="text"
                data-test="field-batch-number"
                @input="clearError('batchNumber')"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_lot_code') }} <span class="required-star">*</span></span>
                <span v-tooltip="t('warehouse.col_lot_code_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                <span v-if="errors.lotCode" class="field-error">{{ errors.lotCode }}</span>
              </label>
              <input
                v-model="form.lotCode"
                class="glass-input"
                :class="{ 'has-error': errors.lotCode }"
                type="text"
                data-test="field-lot-code"
                @input="clearError('lotCode')"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_quantity') }} <span class="required-star">*</span></span>
                <span v-tooltip="t('warehouse.col_quantity_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                <span v-if="errors.quantity" class="field-error">{{ errors.quantity }}</span>
              </label>
              <input
                v-model.number="form.quantity"
                class="glass-input"
                :class="{ 'has-error': errors.quantity }"
                type="number"
                min="0"
                :step="quantityStep"
                data-test="field-quantity"
                @input="clearError('quantity')"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_unit') }} <span class="required-star">*</span></span>
                <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <div class="glass-input" style="display: flex; align-items: center; opacity: 0.7; cursor: default;">
                <span v-if="form.unit">
                  {{ t(`warehouse.unit_${form.unit}`) }}
                </span>
                <span v-else style="color: var(--text-dim);">
                  {{ t('warehouse.offcut_create_unit_placeholder') }}
                </span>
              </div>
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
          </GlassPanel>
        </div>

        <!-- Right column: Pricing + Dates + Notes -->
        <div class="entity-col-right">
          <GlassPanel :skeleton-rows="4" data-test="batch-create-right-panel">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_unit_price') }} <span class="required-star">*</span></span>
                <span v-tooltip="t('warehouse.col_unit_price_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                <span v-if="errors.unitPrice" class="field-error">{{ errors.unitPrice }}</span>
              </label>
              <div class="input-with-suffix custom-select-wrap">
                <input
                  v-model.number="form.unitPrice"
                  class="glass-input"
                  :class="{ 'has-error': errors.unitPrice }"
                  type="number"
                  min="0"
                  step="0.01"
                  data-test="field-unit-price"
                  @input="clearError('unitPrice')"
                />
                <div
                  class="input-suffix custom-select-trigger"
                  data-test="field-currency-trigger"
                  @click.stop="currencyOpen = !currencyOpen"
                >
                  <span class="curr-val">{{ form.currency }}</span>
                </div>
                <div class="custom-select-list" :class="{ open: currencyOpen }">
                  <div
                    v-for="c in CURRENCY_OPTIONS"
                    :key="c"
                    class="custom-select-option"
                    data-test="field-currency-option"
                    :data-currency="c"
                    @click="selectCurrency(c)"
                  >
                    {{ c }}
                  </div>
                </div>
              </div>
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.col_received') }} <span class="required-star">*</span></span>
                <span v-tooltip="t('warehouse.col_received_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                <span v-if="errors.receivedAt" class="field-error">{{ errors.receivedAt }}</span>
              </label>
              <DatePicker
                v-model="form.receivedAt"
                :class="{ 'has-error': errors.receivedAt }"
                data-test="field-received-at"
                @update:model-value="clearError('receivedAt')"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.field_expires_at') }}</span>
                <span v-tooltip="t('warehouse.field_expires_at_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <DatePicker
                v-model="form.expiresAt"
                data-test="field-expires-at"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.field_certificate') }}</span>
                <span v-tooltip="t('warehouse.field_certificate_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
              </label>
              <input
                v-model="form.certificateRef"
                class="glass-input"
                type="text"
                data-test="field-certificate-ref"
              />
            </div>
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.field_notes') }}</span>
                <span v-tooltip="t('warehouse.field_notes_hint')" class="info-hint">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
      <GlassPanel :title="t('warehouse.section_batch_location')" data-test="batch-create-location-section" style="margin-top: 16px">
        <div class="location-grid">
          <div class="input-group">
            <label class="field-label">
              <span>{{ t('warehouse.field_location_rack') }}</span>
              <span v-tooltip="t('warehouse.field_location_rack_hint')" class="info-hint">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
        <div class="input-group" style="margin-top: 12px;">
          <label class="field-label">
            <span>{{ t('warehouse.field_location_notes') }}</span>
            <span v-tooltip="t('warehouse.field_location_notes_hint')" class="info-hint">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
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
      <GlassPanel :title="t('warehouse.section_batch_files')" data-test="batch-create-files-section" style="margin-top: 16px">
        <div class="file-list" data-test="batch-create-file-list" style="margin-bottom: 15px">
          <FileItem
            v-for="f in uploadedFiles"
            :key="f.id"
            :name="f.name"
            download-url="#"
            data-test="batch-create-file-item"
            @delete="removeFile(f.id)"
          />
        </div>
        <p v-if="uploadedFiles.length === 0" class="text-muted" style="padding: 12px 0;">
          {{ t('warehouse.no_files') }}
        </p>
        <DropZone
          data-test="batch-create-file-dropzone"
          :hint="t('warehouse.dropzone_hint')"
          :multiple="true"
          @uploaded="onFilesUploaded"
        />
      </GlassPanel>
    </div>
  </div>
</template>

<style scoped>
.side-by-side-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
}
.side-by-side-inputs > .glass-input {
  flex: 1;
}
.side-by-side-inputs > .custom-select {
  flex: 0 0 100px;
}
.currency-dropdown-wrapper {
  flex: 0 0 90px;
}
.currency-select {
  appearance: auto;
  height: 36px;
}
.field-error {
  color: var(--danger, #e74c3c);
  font-size: 11px;
  margin-left: 4px;
}
.input-group {
  margin-bottom: 12px;
}
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
.selected-product-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: 500;
  background: rgba(24, 144, 255, 0.15);
  color: var(--accent, #1890ff);
  max-width: 220px;
  overflow-wrap: break-word;
  word-break: break-word;
}
.has-error {
  border-color: var(--danger, #e74c3c) !important;
  box-shadow: 0 0 0 1px var(--danger, #e74c3c) !important;
}
.required-star {
  color: var(--danger, #e74c3c);
  margin-left: 2px;
}
</style>
