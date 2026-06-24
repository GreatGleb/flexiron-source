<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProducts } from '@/services/productsService'
import { getStockOverview, getBatchCostBreakdown } from '@/services/warehouseService'
import { useToast } from '@/composables/useToast'
import { useSettings } from '@/composables/useSettings'
import { useTranslatedField } from '@/composables/useTranslatedData'
import type { ProductListItem } from '@/types/product'
import type { StockOverviewItem } from '@/types/warehouse'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t, locale } = useI18n()
const toast = useToast()
const { settings } = useSettings()
const { tf } = useTranslatedField()

const props = defineProps<{
  show: boolean
  orderId: string
}>()

const emit = defineEmits<{
  close: []
  add: [
    items: Array<{
      productId: string
      productName: string
      quantity: number
      unit: string
      unitPrice: number
      unitCost?: number
      /** Quantity in warehouse UoM (converted from sale qty if UoMs differ) */
      warehouseQty?: number
    }>,
  ]
}>()

// ─── Product data ─────────────────────────────────────────────────────────
const products = ref<ProductListItem[]>([])
const productsLoading = ref(false)
const saving = ref(false)

// ─── Stock overview data (for showing availability in saleUoM) ────────────
const stockMap = ref<Map<string, StockOverviewItem>>(new Map())
const stockLoading = ref(false)

/** Resolve locale-aware UoM code from settings by UoM id */
function resolveUomCode(uomId: string | null): string {
  if (!uomId) return '—'
  const uom = settings.uoms.find((u: { id: string }) => u.id === uomId)
  if (!uom) return uomId.slice(0, 8) + '…'
  const currentLocale = locale.value as keyof typeof uom.code
  return (
    uom.code[currentLocale] || uom.code.en || uom.code.ru || uom.code.lt || uomId.slice(0, 8) + '…'
  )
}

/**
 * Calculate available stock for a product in sale UoM.
 * If warehouseUoM !== saleUoM, applies warehouseToSaleFactor conversion.
 */
function getAvailableInSaleUoM(product: ProductListItem): { qty: number; label: string } | null {
  const stock = stockMap.value.get(product.id)
  if (!stock) return null
  const warehouseQty = stock.availableQuantity ?? stock.totalQuantity
  if (
    product.warehouseUomId &&
    product.saleUomId &&
    product.warehouseUomId !== product.saleUomId &&
    product.warehouseToSaleFactor
  ) {
    const saleQty = warehouseQty * product.warehouseToSaleFactor
    const warehouseUomCode = resolveUomCode(product.warehouseUomId)
    const saleUomCode = resolveUomCode(product.saleUomId)
    return {
      qty: saleQty,
      label: `${saleQty.toFixed(2)} ${saleUomCode} (${warehouseQty.toFixed(2)} ${warehouseUomCode} × ${product.warehouseToSaleFactor})`,
    }
  }
  // Same UoM — no conversion needed
  const saleUomCode = resolveUomCode(product.saleUomId)
  return {
    qty: warehouseQty,
    label: `${warehouseQty.toFixed(2)} ${saleUomCode}`,
  }
}

/** Convert a sale qty back to warehouse qty for the given product */
function saleQtyToWarehouseQty(product: ProductListItem, saleQty: number): number {
  if (
    product.warehouseUomId &&
    product.saleUomId &&
    product.warehouseUomId !== product.saleUomId &&
    product.warehouseToSaleFactor
  ) {
    return saleQty / product.warehouseToSaleFactor
  }
  return saleQty
}

const productSearch = ref('')
const productCategoryFilter = ref('all')

/** Derive display unit from product's saleUomId (looked up from settings) */
function getProductUnit(product: ProductListItem): string {
  if (product.saleUomId) {
    const uom = settings.uoms.find((u: { id: string }) => u.id === product.saleUomId)
    if (uom) {
      const currentLocale = locale.value as keyof typeof uom.code
      return uom.code[currentLocale] || uom.code.en || uom.code.ru || uom.code.lt || 'pcs'
    }
  }
  return 'pcs'
}

// ─── Categories ───────────────────────────────────────────────────────────
const categories = computed(() => {
  const map = new Map<string, string>()
  for (const p of products.value) {
    if (p.categoryId && p.categoryName) {
      const name = tf(p.categoryName)
      if (!map.has(p.categoryId)) {
        map.set(p.categoryId, name)
      }
    }
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
})

const categoryFilterOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: t('orders.add_item_modal_all_categories') },
  ...categories.value.map((c) => ({ value: c.id, label: c.name })),
])

// ─── Filtered products ────────────────────────────────────────────────────
const filteredProducts = computed(() => {
  const q = productSearch.value.trim().toLowerCase()
  const cat = productCategoryFilter.value
  return products.value.filter((p) => {
    if (cat !== 'all' && p.categoryId !== cat) return false
    if (q) {
      const name = tf(p.name).toLowerCase()
      if (!name.includes(q)) return false
    }
    return true
  })
})

// ─── Selected products (checkboxes) ──────────────────────────────────────
interface SelectedOrderItem {
  productId: string
  productName: string
  quantity: number
  unit: string
  unitPrice: number
  /** Quantity in warehouse UoM (computed from sale qty via factor) */
  warehouseQty: number
}

const selectedItems = ref<SelectedOrderItem[]>([])

/** FIFO batch cost breakdown per selected product (unitPrice + totalCost) */
const selectedItemsCosts = ref<Map<string, { unitPrice: number; totalCost: number }>>(new Map())

function toggleProduct(id: string) {
  const idx = selectedItems.value.findIndex((item) => item.productId === id)
  if (idx === -1) {
    // Add new item with default quantity=1
    const product = products.value.find((p) => p.id === id)
    if (!product) return
    const unit = getProductUnit(product)
    const saleQty = 1
    // Use FIFO cost as unitPrice if available, fallback to product price
    const fifoCost = selectedItemsCosts.value.get(product.id)?.unitPrice
    const unitPrice = fifoCost ?? (product.price ?? 0)
    selectedItems.value = [
      ...selectedItems.value,
      {
        productId: product.id,
        productName: tf(product.name),
        quantity: saleQty,
        unit,
        unitPrice,
        warehouseQty: saleQtyToWarehouseQty(product, saleQty),
      },
    ]
    // Trigger FIFO cost calculation and update unitPrice when ready
    recalcFifoCost(product.id, saleQty)
  } else {
    selectedItems.value = selectedItems.value.filter((v) => v.productId !== id)
  }
}

function removeProduct(id: string) {
  selectedItems.value = selectedItems.value.filter((v) => v.productId !== id)
}

/** Resolve display unit for a product: use saleUomId + settings */
function getProductDisplayUnit(product: ProductListItem): string {
  if (product.saleUomId) {
    const uom = settings.uoms.find((u: { id: string }) => u.id === product.saleUomId)
    if (uom) {
      const currentLocale = locale.value as keyof typeof uom.code
      const code = uom.code[currentLocale] || uom.code.en || uom.code.ru || uom.code.lt
      if (code) return code
    }
  }
  return '—'
}

// Helper to check if a product is selected (used in template)
function isSelected(id: string): boolean {
  return selectedItems.value.some((item) => item.productId === id)
}

// ─── Pagination ───────────────────────────────────────────────────────────
const productPage = ref(1)
const productPageSize = ref(5)
const PAGE_SIZE_OPTIONS_PRODUCTS: SelectOption[] = [
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
  const catMap = new Map<string, ProductListItem[]>()
  for (const p of filteredProducts.value) {
    const catName = p.categoryName ? tf(p.categoryName) : t('orders.add_item_modal_uncategorized')
    const list = catMap.get(catName)
    if (list) {
      list.push(p)
    } else {
      catMap.set(catName, [p])
    }
  }
  const allGrouped: { categoryName: string; products: ProductListItem[] }[] = []
  for (const [catName, prods] of catMap) {
    allGrouped.push({ categoryName: catName, products: prods })
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

// ─── Load products + stock overview ──────────────────────────────────────
async function loadProducts() {
  productsLoading.value = true
  stockLoading.value = true
  try {
    const [prodRes, stockRes] = await Promise.all([
      getProducts(
        { search: '', categoryIds: [], sortBy: 'name', sortDir: 'asc' },
        { page: 1, pageSize: 1000 },
      ),
      getStockOverview(
        {
          search: '',
          categoryIds: [],
          unit: '',
          showDeficitOnly: false,
          showInStockOnly: false,
          sortBy: 'name',
          sortDir: 'asc',
        },
        { page: 1, pageSize: 1000 },
      ),
    ])
    products.value = prodRes.items
    // Build stock map keyed by productId
    const map = new Map<string, import('@/types/warehouse').StockOverviewItem>()
    for (const item of stockRes.items) {
      map.set(item.productId, item)
    }
    stockMap.value = map
  } catch {
    toast.error(t('orders.toast_error_save'))
  } finally {
    productsLoading.value = false
    stockLoading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      selectedItems.value = []
      productSearch.value = ''
      productCategoryFilter.value = 'all'
      productPage.value = 1
      loadProducts()
    }
  },
)

// ─── Recalc FIFO cost for a product when quantity changes ──────────────
async function recalcFifoCost(productId: string, quantity: number) {
  try {
    const cost = await getBatchCostBreakdown(productId, quantity)
    selectedItemsCosts.value.set(productId, cost)
    // Update unitPrice on the selected item to use FIFO cost
    const item = selectedItems.value.find((i) => i.productId === productId)
    if (item && cost.unitPrice > 0) {
      item.unitPrice = cost.unitPrice
    }
  } catch {
    selectedItemsCosts.value.delete(productId)
  }
}

// ─── Watch quantity changes → recalculate warehouseQty + FIFO cost ─────
watch(
  () => selectedItems.value.map((item) => ({ id: item.productId, qty: item.quantity })),
  (newVals) => {
    for (const { id, qty } of newVals) {
      const item = selectedItems.value.find((i) => i.productId === id)
      const product = products.value.find((p) => p.id === id)
      if (item && product) {
        item.warehouseQty = saleQtyToWarehouseQty(product, qty)
        recalcFifoCost(id, qty)
      }
    }
  },
  { deep: true },
)

// ─── Save ─────────────────────────────────────────────────────────────────
function onSave() {
  if (selectedItems.value.length === 0) return
  const items = selectedItems.value
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const fifoCost = selectedItemsCosts.value.get(item.productId)?.unitPrice
      return {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        // Use FIFO cost as unitPrice (matches the displayed value)
        unitPrice: fifoCost ?? item.unitPrice,
        unitCost: fifoCost ?? item.unitPrice,
        warehouseQty: item.warehouseQty,
      }
    })
  if (items.length > 0) {
    emit('add', items)
    emit('close')
  }
}

function onCancel() {
  emit('close')
}
</script>

<template>
  <AppModal
    :model-value="show"
    :title="t('orders.add_item_modal_title')"
    size="large"
    data-test="add-order-items-modal"
    @update:model-value="
      (v: boolean) => {
        if (!v) emit('close')
      }
    "
  >
    <div class="modal-form" data-test="add-order-items-form">
      <div class="add-items-section">
        <div class="products-filters" data-test="add-items-filters">
          <div class="filter-search">
            <SearchInput v-model="productSearch" :placeholder="t('orders.add_item_modal_search')" />
          </div>
          <div class="filter-category">
            <CustomSelect v-model="productCategoryFilter" :options="categoryFilterOptions" />
          </div>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table products-table" data-test="add-items-products-table">
            <thead>
              <tr>
                <th class="col-checkbox"></th>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.add_item_modal_col_category') }}</th>
                <th>{{ t('orders.col_unit') }}</th>
                <th class="col-avail-header">{{ t('orders.col_available') }}</th>
                <th class="col-price-header">{{ t('orders.col_unit_price') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredProducts.length === 0 && !productsLoading">
                <tr>
                  <td :colspan="6" class="empty-cell">
                    {{ t('orders.add_item_modal_no_products') }}
                  </td>
                </tr>
              </template>
              <template v-for="group in pagedProductGroups" :key="group.categoryName">
                <tr class="product-group-header">
                  <td :colspan="6" class="group-header-cell">
                    {{ group.categoryName }}
                  </td>
                </tr>
                <tr
                  v-for="p in group.products"
                  :key="p.id"
                  :data-product-id="p.id"
                  class="product-row"
                  :class="{ 'row-selected': isSelected(p.id) }"
                  data-test="add-items-product-row"
                  @click="toggleProduct(p.id)"
                >
                  <td class="col-checkbox">
                    <input
                      type="checkbox"
                      :checked="isSelected(p.id)"
                      data-test="add-items-product-checkbox"
                      tabindex="-1"
                      @click.stop
                      @change.stop="toggleProduct(p.id)"
                    />
                  </td>
                  <td class="col-product-name">{{ tf(p.name) }}</td>
                  <td class="col-category">{{ p.categoryName ? tf(p.categoryName) : '—' }}</td>
                  <td class="col-unit-cell">{{ getProductDisplayUnit(p) }}</td>
                  <td class="col-avail-cell">
                    <template v-if="stockLoading">
                      <span class="stock-loading">…</span>
                    </template>
                    <template v-else>
                      <span
                        v-if="getAvailableInSaleUoM(p)"
                        v-tooltip="getAvailableInSaleUoM(p)!.label"
                        class="stock-value"
                        :class="{ 'stock-low': getAvailableInSaleUoM(p)!.qty < (p.minStock ?? 0) }"
                      >
                        {{ Number(getAvailableInSaleUoM(p)!.qty.toFixed(2)).toLocaleString() }}
                      </span>
                      <span v-else class="stock-na">—</span>
                    </template>
                  </td>
                  <td class="col-price-cell">
                    <template v-if="stockLoading">
                      <span class="stock-loading">…</span>
                    </template>
                    <template v-else>
                      <span
                        v-if="stockMap.get(p.id)"
                        v-tooltip="'Avg cost: ' + stockMap.get(p.id)!.avgUnitPrice.toFixed(2) + ' ' + settings.constants.defaultCurrency"
                        class="stock-value"
                      >
                        {{ Number(stockMap.get(p.id)!.avgUnitPrice.toFixed(2)).toLocaleString() }}
                      </span>
                      <span v-else>
                        {{ p.price != null ? p.price.toFixed(2) + ' ' + settings.constants.defaultCurrency : '—' }}
                      </span>
                    </template>
                  </td>
                </tr>
              </template>
            </tbody>
            <tfoot v-if="filteredProducts.length > 0">
              <tr>
                <td :colspan="6" class="pagination-cell">
                  <div class="pagination-bar">
                    <div class="page-size">
                      <span>{{ t('orders.page_size') }}</span>
                      <CustomSelect
                        v-model="productPageSizeStr"
                        :options="PAGE_SIZE_OPTIONS_PRODUCTS"
                        :open-up="true"
                        class="custom-select-sm"
                      />
                    </div>
                    <div class="pagination-nav">
                      <button
                        class="btn btn-icon btn-sm page-nav-btn"
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
                        class="btn btn-icon btn-sm page-nav-btn"
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
      </div>

      <div v-if="selectedItems.length > 0" class="add-items-section">
        <div class="section-divider"></div>
        <h3 class="selected-items-title">
          {{ t('orders.add_item_modal_selected_title') }}
          <span class="selected-count-badge">{{ selectedItems.length }}</span>
        </h3>
        <div class="data-table-wrapper">
          <table class="data-table selected-table" data-test="add-items-selected-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_product') }}</th>
                <th class="col-qty-header">{{ t('orders.col_quantity') }}</th>
                <th class="col-unit-header">{{ t('orders.col_unit') }}</th>
                <th class="col-price-ro-header">{{ t('orders.col_unit_price') }}</th>
                <th class="col-cost-header">{{ t('orders.col_avg_cost') }}</th>
                <th class="col-total-header">{{ t('orders.col_total_price') }}</th>
                <th class="col-action-header"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in selectedItems"
                :key="item.productId"
                class="selected-row"
                data-test="add-items-selected-row"
              >
                <td class="col-product-name">{{ item.productName }}</td>
                <td class="col-qty-cell">
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="0"
                    step="1"
                    class="glass-input qty-input"
                    data-test="add-items-selected-qty"
                  />
                </td>
                <td class="col-unit-cell">
                  <span class="unit-label">{{ t('orders.unit_' + item.unit, item.unit) }}</span>
                </td>
                <td class="col-price-ro-cell">
                  <span class="price-display">{{ item.unitPrice.toFixed(2) }} {{ settings.constants.defaultCurrency }}</span>
                </td>
                <td class="col-cost-cell">
                  <span class="cost-display"
                    >{{ selectedItemsCosts.get(item.productId)?.unitPrice
                      ? selectedItemsCosts.get(item.productId)!.unitPrice.toFixed(2) + ' ' + settings.constants.defaultCurrency
                      : '—' }}</span
                  >
                </td>
                <td class="col-total-cell">
                  <span class="item-total"
                    >{{ (item.quantity * item.unitPrice).toFixed(2) }} {{ settings.constants.defaultCurrency }}</span
                  >
                </td>
                <td class="col-action-cell">
                  <button
                    v-tooltip="t('orders.btn_remove_item')"
                    class="action-icon-btn action-danger"
                    data-test="add-items-remove-btn"
                    @click="removeProduct(item.productId)"
                  >
                    <SvgIcon name="trash" :width="14" :height="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        :disabled="saving"
        data-test="add-items-cancel-btn"
        @click="onCancel"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving || selectedItems.length === 0"
        data-test="add-items-save-btn"
        @click="onSave"
      >
        <SvgIcon v-if="saving" name="loader" :width="16" :height="16" class="spin" />
        {{ t('orders.add_item_modal_save_btn', { count: selectedItems.length }) }}
      </button>
    </template>
  </AppModal>
</template>

<style scoped>
/* ─── Section spacing ──────────────────────────────────── */
.add-items-section {
  margin-bottom: 20px;
}

.section-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin-bottom: 16px;
}

/* ─── Filters row ──────────────────────────────────────── */
.products-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.filter-search {
  flex: 1 1 180px;
}
.filter-category {
  min-width: 160px;
}

/* ─── Selected items header ────────────────────────────── */
.selected-items-title {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 10px 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
}

.selected-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(24, 144, 255, 0.2);
  color: #1890ff;
  font-size: 11px;
  font-weight: 700;
}

/* ─── Product table ────────────────────────────────────── */

/* Checkbox column */
.products-table .col-checkbox {
  width: 32px;
  text-align: center;
  vertical-align: middle;
}

.products-table input[type='checkbox'] {
  width: 14px;
  height: 14px;
  accent-color: var(--primary);
  cursor: pointer;
  display: block;
  margin: 0 auto;
}

/* Price column in products table */
.col-price-header,
.col-price-cell {
  width: 110px;
  text-align: right;
  white-space: nowrap;
}

/* Product name column */
.products-table .col-product-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Category column */
.products-table .col-category {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Unit column */
.products-table .col-unit-cell {
  width: 60px;
  text-align: center;
}

/* Available stock column */
.col-avail-header,
.col-avail-cell {
  width: 100px;
  text-align: right;
  white-space: nowrap;
}
.stock-loading {
  opacity: 0.4;
}
.stock-na {
  opacity: 0.4;
}
.stock-value {
  cursor: help;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
  padding-bottom: 1px;
}
.stock-low {
  color: #ff6b6b;
}

/* Product row hover / selected */
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
  padding-top: 14px;
  padding-bottom: 4px;
}

.group-header-cell {
  font-weight: 700;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
  padding-top: 14px !important;
}

.empty-cell {
  text-align: center;
  opacity: 0.5;
  padding: 24px 0;
}

/* ─── Pagination ───────────────────────────────────────── */
.products-table tfoot td {
  overflow: visible;
  padding-top: 12px;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  row-gap: 10px;
}

.page-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.pagination-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-pages {
  display: flex;
  align-items: center;
  gap: 4px;
}

.page-btn {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.page-btn:hover {
  background: rgba(24, 144, 255, 0.2);
  border-color: var(--primary);
}
.page-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.page-nav-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pagination-ellipsis {
  padding: 0 4px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}

/* ─── Selected items table ─────────────────────────────── */
.selected-table {
  width: 100%;
}

/* Column widths for selected items */
.col-qty-header,
.col-qty-cell {
  width: 100px;
  text-align: center;
}
.col-unit-header,
.col-unit-cell {
  width: 60px;
  text-align: center;
}
.col-price-ro-header,
.col-price-ro-cell {
  width: 130px;
  text-align: right;
}
.col-cost-header,
.col-cost-cell {
  width: 110px;
  text-align: right;
}
.col-total-header,
.col-total-cell {
  width: 130px;
  text-align: right;
}
.col-action-header,
.col-action-cell {
  width: 32px;
  text-align: center;
}

/* Quantity input */
.qty-input {
  width: 80px;
  padding: 4px 8px;
  font-size: 13px;
  text-align: center;
}

/* Unit label */
.unit-label {
  display: inline-block;
  padding: 4px 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

/* Price display (read-only) */
.price-display {
  display: inline-block;
  padding: 4px 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

/* Cost display (FIFO avg unit cost) */
.cost-display {
  display: inline-block;
  padding: 4px 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

/* Total display */
.item-total {
  display: inline-block;
  padding: 4px 8px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
}

/* ─── Data table overrides for proper vertical alignment ── */
.products-table tbody td {
  vertical-align: middle;
}

.selected-table tbody td {
  vertical-align: middle;
}

/* Remove even-row and hover background for selected items table */
.selected-table tbody tr:nth-child(even) td {
  background: transparent;
}
.selected-table tbody tr:hover td {
  background: transparent;
}
</style>
