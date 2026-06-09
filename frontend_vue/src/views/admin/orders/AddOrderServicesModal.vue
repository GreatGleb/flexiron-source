<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServices } from '@/services/servicesService'
import { useToast } from '@/composables/useToast'
import { useTranslatedField } from '@/composables/useTranslatedData'
import type { ServiceListItem } from '@/types/service'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t } = useI18n()
const toast = useToast()
const { tf } = useTranslatedField()

const props = defineProps<{
  show: boolean
  orderId: string
}>()

const emit = defineEmits<{
  close: []
  add: [items: Array<{ serviceId: string; serviceName: string; quantity: number; price: number }>]
}>()

// ─── Services data ──────────────────────────────────────────────────────
const services = ref<ServiceListItem[]>([])
const servicesLoading = ref(false)
const saving = ref(false)

const serviceSearch = ref('')

// ─── Price unit display ─────────────────────────────────────────────────
function displayUnit(priceUnit: string | null): string {
  if (!priceUnit) return '—'
  const unitMap: Record<string, string> = {
    'EUR/vnt': 'pcs',
    'EUR/kg': 'kg',
    'EUR/m': 'm',
    'EUR/h': 'h',
  }
  const stockUnit = unitMap[priceUnit] ?? priceUnit.replace('EUR/', '')
  return t('orders.unit_' + stockUnit, stockUnit)
}

// ─── Filtered services ──────────────────────────────────────────────────
const filteredServices = computed(() => {
  const q = serviceSearch.value.trim().toLowerCase()
  if (!q) return services.value
  return services.value.filter((s) => {
    const name = tf(s.name).toLowerCase()
    return name.includes(q)
  })
})

// ─── Selected services ──────────────────────────────────────────────────
interface SelectedServiceItem {
  serviceId: string
  serviceName: string
  quantity: number
  price: number
}

const selectedItems = ref<SelectedServiceItem[]>([])

function toggleService(id: string) {
  const idx = selectedItems.value.findIndex((item) => item.serviceId === id)
  if (idx === -1) {
    // Add new service with default quantity=1
    const svc = services.value.find((s) => s.id === id)
    if (!svc) return
    selectedItems.value = [
      ...selectedItems.value,
      {
        serviceId: svc.id,
        serviceName: tf(svc.name),
        quantity: 1,
        price: svc.sellingPrice ?? 0,
      },
    ]
  } else {
    selectedItems.value = selectedItems.value.filter((v) => v.serviceId !== id)
  }
}

function removeService(id: string) {
  selectedItems.value = selectedItems.value.filter((v) => v.serviceId !== id)
}

// Helper to check if a service is selected (used in template)
function isSelected(id: string): boolean {
  return selectedItems.value.some((item) => item.serviceId === id)
}

// ─── Pagination ─────────────────────────────────────────────────────────
const servicePage = ref(1)
const servicePageSize = ref(5)
const PAGE_SIZE_OPTIONS: SelectOption[] = [
  { value: '5', label: '5' },
  { value: '15', label: '15' },
  { value: '30', label: '30' },
  { value: '50', label: '50' },
]
const servicePageSizeStr = computed({
  get: () => String(servicePageSize.value),
  set: (v: string) => {
    servicePageSize.value = Number(v)
    servicePage.value = 1
  },
})
const serviceTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredServices.value.length / servicePageSize.value)),
)
watch([filteredServices, servicePageSize], () => {
  if (servicePage.value > serviceTotalPages.value) servicePage.value = serviceTotalPages.value
})

const pagedServices = computed(() => {
  const start = (servicePage.value - 1) * servicePageSize.value
  return filteredServices.value.slice(start, start + servicePageSize.value)
})

function pageNumbers(): (number | '...')[] {
  const n = serviceTotalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const p = servicePage.value
  if (p <= 3) return [1, 2, 3, 4, '...', n]
  if (p >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
  return [1, '...', p - 1, p, p + 1, '...', n]
}

// ─── Load services ──────────────────────────────────────────────────────
async function loadServices() {
  servicesLoading.value = true
  try {
    const res = await getServices(
      { search: '', sortBy: 'name', sortDir: 'asc' },
      { page: 1, pageSize: 1000 },
    )
    services.value = res.items
  } catch {
    toast.error(t('orders.toast_error_save'))
  } finally {
    servicesLoading.value = false
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      selectedItems.value = []
      serviceSearch.value = ''
      servicePage.value = 1
      loadServices()
    }
  },
)

// ─── Save ───────────────────────────────────────────────────────────────
function onSave() {
  if (selectedItems.value.length === 0) return
  const items = selectedItems.value
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      quantity: item.quantity,
      price: item.price,
    }))
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
    :title="t('orders.add_service_modal_title')"
    size="large"
    data-test="add-order-services-modal"
    @update:model-value="(v: boolean) => { if (!v) emit('close') }"
  >
    <div class="modal-form" data-test="add-order-services-form">
      <div class="add-items-section">
        <div class="services-filters" data-test="add-services-filters">
          <div class="filter-search">
            <SearchInput
              v-model="serviceSearch"
              :placeholder="t('orders.add_service_modal_search')"
            />
          </div>
        </div>

        <div class="data-table-wrapper">
          <table class="data-table services-table" data-test="add-services-table">
            <thead>
              <tr>
                <th class="col-checkbox"></th>
                <th>{{ t('orders.col_service') }}</th>
                <th>{{ t('orders.add_service_modal_col_unit') }}</th>
                <th class="col-price-header">{{ t('orders.col_price') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-if="filteredServices.length === 0 && !servicesLoading">
                <tr>
                  <td :colspan="4" class="empty-cell">
                    {{ t('orders.add_service_modal_no_services') }}
                  </td>
                </tr>
              </template>
              <tr
                v-for="s in pagedServices"
                :key="s.id"
                :data-service-id="s.id"
                class="service-row"
                :class="{ 'row-selected': isSelected(s.id) }"
                data-test="add-services-row"
                @click="toggleService(s.id)"
              >
                <td class="col-checkbox">
                  <input
                    type="checkbox"
                    :checked="isSelected(s.id)"
                    data-test="add-services-checkbox"
                    tabindex="-1"
                    @click.stop
                    @change.stop="toggleService(s.id)"
                  />
                </td>
                <td class="col-service-name">{{ tf(s.name) }}</td>
                <td class="col-unit-cell">{{ displayUnit(s.priceUnit) }}</td>
                <td class="col-price-cell">{{ s.sellingPrice != null ? s.sellingPrice.toFixed(2) + ' EUR' : '—' }}</td>
              </tr>
            </tbody>
            <tfoot v-if="filteredServices.length > 0">
              <tr>
                <td :colspan="4" class="pagination-cell">
                  <div class="pagination-bar">
                    <div class="page-size">
                      <span>{{ t('orders.page_size') }}</span>
                      <CustomSelect
                        v-model="servicePageSizeStr"
                        :options="PAGE_SIZE_OPTIONS"
                        :open-up="true"
                        class="custom-select-sm"
                      />
                    </div>
                    <div class="pagination-nav">
                      <button
                        class="btn btn-icon btn-sm page-nav-btn"
                        :disabled="servicePage <= 1"
                        @click="servicePage = Math.max(1, servicePage - 1)"
                      >
                        <SvgIcon
                          name="chevron-right"
                          :width="14"
                          :height="14"
                          style="transform: rotate(180deg)"
                        />
                      </button>
                      <div class="pagination-pages">
                        <template v-for="(p, i) in pageNumbers()" :key="i">
                          <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                          <button
                            v-else
                            class="page-btn"
                            :class="{ active: p === servicePage }"
                            @click="servicePage = p as number"
                          >
                            {{ p }}
                          </button>
                        </template>
                      </div>
                      <button
                        class="btn btn-icon btn-sm page-nav-btn"
                        :disabled="servicePage >= serviceTotalPages"
                        @click="servicePage = Math.min(serviceTotalPages, servicePage + 1)"
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
          {{ t('orders.add_service_modal_selected_title') }}
          <span class="selected-count-badge">{{ selectedItems.length }}</span>
        </h3>
        <div class="data-table-wrapper">
          <table class="data-table selected-table" data-test="add-services-selected-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_service') }}</th>
                <th class="col-qty-header">{{ t('orders.col_quantity') }}</th>
                <th class="col-price-ro-header">{{ t('orders.col_price') }}</th>
                <th class="col-total-header">{{ t('orders.col_total_price') }}</th>
                <th class="col-action-header"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in selectedItems" :key="item.serviceId" class="selected-row" data-test="add-services-selected-row">
                <td class="col-service-name">{{ item.serviceName }}</td>
                <td class="col-qty-cell">
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="0"
                    step="1"
                    class="glass-input qty-input"
                    data-test="add-services-selected-qty"
                  />
                </td>
                <td class="col-price-ro-cell">
                  <span class="price-display">{{ item.price.toFixed(2) }} EUR</span>
                </td>
                <td class="col-total-cell">
                  <span class="item-total">{{ (item.quantity * item.price).toFixed(2) }} EUR</span>
                </td>
                <td class="col-action-cell">
                  <button
                    v-tooltip="t('orders.btn_remove_service')"
                    class="action-icon-btn action-danger"
                    data-test="add-services-remove-btn"
                    @click="removeService(item.serviceId)"
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
        data-test="add-services-cancel-btn"
        @click="onCancel"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving || selectedItems.length === 0"
        data-test="add-services-save-btn"
        @click="onSave"
      >
        <SvgIcon v-if="saving" name="loader" :width="16" :height="16" class="spin" />
        {{ t('orders.add_service_modal_save_btn', { count: selectedItems.length }) }}
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
.services-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.filter-search {
  flex: 1 1 240px;
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

/* ─── Services table ───────────────────────────────────── */

/* Checkbox column */
.services-table .col-checkbox {
  width: 32px;
  text-align: center;
  vertical-align: middle;
}

.services-table input[type='checkbox'] {
  width: 14px;
  height: 14px;
  accent-color: var(--primary);
  cursor: pointer;
  display: block;
  margin: 0 auto;
}

/* Price column */
.col-price-header,
.col-price-cell {
  width: 110px;
  text-align: right;
  white-space: nowrap;
}

/* Service name column */
.services-table .col-service-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Unit column */
.services-table .col-unit-cell {
  width: 60px;
  text-align: center;
}

/* Service row hover / selected */
.services-table .service-row {
  cursor: pointer;
  transition: background 0.15s;
}
.services-table .service-row:hover {
  background: rgba(255, 255, 255, 0.05);
}
.services-table .service-row.row-selected {
  background: rgba(24, 144, 255, 0.08);
}

.empty-cell {
  text-align: center;
  opacity: 0.5;
  padding: 24px 0;
}

/* ─── Pagination ───────────────────────────────────────── */
.services-table tfoot td {
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
.col-price-ro-header,
.col-price-ro-cell {
  width: 130px;
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

/* Total display */
.item-total {
  display: inline-block;
  padding: 4px 8px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
}

/* ─── Data table overrides for proper vertical alignment ── */
.services-table tbody td {
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
