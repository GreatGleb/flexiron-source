<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useOrderCreate } from '@/composables/useOrderCreate'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import AddOrderItemsModal from './AddOrderItemsModal.vue'
import AddOrderServicesModal from './AddOrderServicesModal.vue'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_checkbox-list.css'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/orders_card.css'
import '@styles/admin/orders_create.css'

const router = useRouter()
const { t } = useI18n()

useHead({
  title: () => `Flexiron — ${t('orders.create_title')}`,
  description: () => t('orders.create_title'),
})

const {
  form,
  errors,
  saving,
  clearError,
  clients,
  loadingClients,
  loadClients,
  localOrder,
  addItem,
  removeItem,
  addService,
  removeService,
  onFilesUploaded,
  removeFile,
  handleSave,
} = useOrderCreate()

// ─── Document type options ─────────────────────────────────────
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'local', label: t('orders.create_option_local') },
  { value: 'export', label: t('orders.create_option_export') },
]

// ─── Client selector (radio list with search & pagination) ─────
const clientSearch = ref('')
const clientPage = ref(1)
const clientPageSize = ref(5)

const filteredClients = computed(() => {
  const q = clientSearch.value.trim().toLowerCase()
  if (!q) return clients.value
  return clients.value.filter(
    (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
  )
})

const clientTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredClients.value.length / clientPageSize.value)),
)

const pagedClients = computed(() => {
  const start = (clientPage.value - 1) * clientPageSize.value
  return filteredClients.value.slice(start, start + clientPageSize.value)
})

const PAGE_SIZE_OPTIONS_CLIENTS = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
]

const clientPageSizeStr = computed({
  get: () => String(clientPageSize.value),
  set: (v: string) => {
    clientPageSize.value = Number(v)
    clientPage.value = 1
  },
})

function clientPageNumbers(): (number | '...')[] {
  const n = clientTotalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const p = clientPage.value
  if (p <= 3) return [1, 2, 3, 4, '...', n]
  if (p >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
  return [1, '...', p - 1, p, p + 1, '...', n]
}

function selectClient(id: string) {
  form.value.clientId = id
  clearError('clientId')
}

function isClientSelected(id: string): boolean {
  return form.value.clientId === id
}

// Reset page when search changes
watch(clientSearch, () => {
  clientPage.value = 1
})

// ─── Items modals ──────────────────────────────────────────────
const showAddItemsModal = ref(false)
const showAddServicesModal = ref(false)

// ─── Create action ─────────────────────────────────────────────
async function onCreate() {
  const order = await handleSave()
  if (order) {
    router.push({ name: 'admin-order-card', params: { id: order.id } })
  }
}

function handleCancel() {
  router.push({ name: 'admin-orders' })
}

onMounted(loadClients)
</script>

<template>
  <div class="page-order-create" data-test="page-order-create">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('orders.title'), to: { name: 'admin-orders' } },
        { label: t('orders.create_title') },
      ]"
    />

    <div class="order-create-header" data-test="order-create-header">
      <div class="order-create-header-row">
        <div class="order-create-header-left">
          <h1 class="page-title">{{ t('orders.create_title') }}</h1>
        </div>
        <div class="entity-action-bar no-margin pos-static" data-test="order-create-action-bar">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            data-test="order-create-cancel-btn"
            @click="handleCancel"
          >
            {{ t('orders.create_btn_cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-save dirty"
            :class="{ loading: saving }"
            :disabled="saving"
            data-test="order-create-save-btn"
            @click="onCreate"
          >
            <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
            <span>{{
              saving ? t('orders.create_btn_saving') : t('orders.create_btn_create')
            }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="main-card-content">
      <div class="entity-card-grid">
        <div class="entity-col-left">
          <GlassPanel
            :title="t('orders.create_section_client')"
            :loading="loadingClients"
            :skeleton-rows="4"
            data-test="order-create-client-panel"
          >
            <div
              class="checkbox-list searchable"
              :class="{ 'has-error': errors.clientId }"
              data-test="order-create-client-section"
            >
              <div class="checkbox-list-controls">
                <span
                  style="
                    font-size: 13px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.7);
                    margin-left: 0;
                  "
                >
                  <span
                    >{{ t('orders.create_field_client') }}
                    <span class="required-star">*</span></span
                  >
                  <span v-if="errors.clientId" class="field-error" style="margin-left: 6px">{{
                    errors.clientId
                  }}</span>
                </span>
                <span
                  v-if="form.clientId"
                  class="selected-count"
                  data-test="order-create-client-selected"
                >
                  <span class="count">1</span>
                  {{ t('orders.selected_text') }}
                </span>
              </div>

              <div data-test="order-create-client-search">
                <SearchInput
                  v-model="clientSearch"
                  :placeholder="t('orders.create_search_client')"
                />
              </div>

              <div class="checkbox-list-items" data-test="order-create-client-list">
                <label
                  v-for="c in pagedClients"
                  :key="c.id"
                  class="checkbox-item"
                  data-test="order-create-client-item"
                  :data-client-id="c.id"
                >
                  <input
                    type="radio"
                    name="order-client"
                    class="client-radio-input"
                    :checked="isClientSelected(c.id)"
                    @change="selectClient(c.id)"
                  />
                  <span class="client-radio-custom"></span>
                  <span class="checkbox-label">{{ c.name }}</span>
                  <span class="checkbox-email">{{ c.email }}</span>
                </label>
                <div
                  v-if="filteredClients.length === 0"
                  style="text-align: center; color: rgba(255, 255, 255, 0.8); padding: 16px 0"
                  data-test="order-create-client-empty"
                >
                  {{ t('orders.create_no_clients') }}
                </div>
              </div>

              <div
                v-if="filteredClients.length > 0"
                class="recipients-pagination"
                data-test="order-create-client-pagination"
              >
                <div class="pagination-bar">
                  <div class="page-size">
                    <span>{{ t('suppliers.page_size') }}</span>
                    <CustomSelect
                      v-model="clientPageSizeStr"
                      :options="PAGE_SIZE_OPTIONS_CLIENTS"
                      :open-up="true"
                      class="custom-select-sm"
                    />
                  </div>
                  <div class="pagination-nav">
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="clientPage <= 1"
                      @click="clientPage = Math.max(1, clientPage - 1)"
                    >
                      <SvgIcon
                        name="chevron-right"
                        :width="14"
                        :height="14"
                        style="transform: rotate(180deg)"
                      />
                    </button>
                    <div class="pagination-pages">
                      <template v-for="(p, i) in clientPageNumbers()" :key="i">
                        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                        <button
                          v-else
                          class="page-btn"
                          :class="{ active: p === clientPage }"
                          @click="clientPage = p as number"
                        >
                          {{ p }}
                        </button>
                      </template>
                    </div>
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="clientPage >= clientTotalPages"
                      @click="clientPage = Math.min(clientTotalPages, clientPage + 1)"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>
        </div>

        <div class="entity-col-center">
          <GlassPanel :title="t('orders.field_notes')" data-test="order-create-notes-panel">
            <InputGroup :label="t('orders.field_notes')">
              <textarea
                v-model="form.notes"
                class="glass-input glass-textarea"
                rows="4"
                data-test="order-create-notes"
              />
            </InputGroup>
          </GlassPanel>
        </div>

        <div class="entity-col-right">
          <GlassPanel
            :title="t('orders.create_field_document_type')"
            data-test="order-create-doctype-panel"
          >
            <InputGroup :label="t('orders.create_field_document_type')">
              <CustomSelect
                v-model="form.documentType"
                :options="DOCUMENT_TYPE_OPTIONS"
                data-test="order-create-doctype"
              />
            </InputGroup>
          </GlassPanel>
        </div>
      </div>

      <GlassPanel data-test="order-create-items">
        <template #header>
          <span class="panel-title">{{ t('orders.section_items') }}</span>
          <button
            class="btn btn-sm btn-primary"
            data-test="order-create-add-item-btn"
            @click="showAddItemsModal = true"
          >
            <SvgIcon name="plus-add" :width="14" :height="14" />
            {{ t('orders.btn_add_item') }}
          </button>
        </template>
        <div v-if="localOrder.items.length === 0" class="empty-state-inline">
          <p>{{ t('orders.items_empty') }}</p>
        </div>
        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_line') }}</th>
                <th>{{ t('orders.col_product') }}</th>
                <th>{{ t('orders.col_quantity') }}</th>
                <th>{{ t('orders.col_unit') }}</th>
                <th>{{ t('orders.col_unit_price') }}</th>
                <th>{{ t('orders.col_total_price') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in localOrder.items" :key="item.id" class="order-item-row">
                <td>{{ item.lineNumber }}</td>
                <td>{{ item.productName }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ t('orders.unit_' + item.unit, item.unit) }}</td>
                <td>{{ item.unitPrice.toFixed(2) }}</td>
                <td>{{ item.totalPrice.toFixed(2) }}</td>
                <td>
                  <button
                    v-tooltip="t('orders.btn_remove_item')"
                    class="action-icon-btn action-danger"
                    @click="removeItem(item.id)"
                  >
                    <SvgIcon name="trash" :width="14" :height="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <GlassPanel data-test="order-create-services">
        <template #header>
          <span class="panel-title">{{ t('orders.section_services') }}</span>
          <button
            class="btn btn-sm btn-primary"
            data-test="order-create-add-service-btn"
            @click="showAddServicesModal = true"
          >
            <SvgIcon name="plus-add" :width="14" :height="14" />
            {{ t('orders.btn_add_service') }}
          </button>
        </template>
        <div v-if="localOrder.services.length === 0" class="empty-state-inline">
          <p>{{ t('orders.services_empty') }}</p>
        </div>
        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t('orders.col_service') }}</th>
                <th>{{ t('orders.col_quantity') }}</th>
                <th>{{ t('orders.col_cost') }}</th>
                <th>{{ t('orders.col_price') }}</th>
                <th>{{ t('orders.col_margin') }}</th>
                <th>{{ t('orders.col_total_price') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="svc in localOrder.services" :key="svc.id" class="order-service-row">
                <td>{{ svc.serviceName }}</td>
                <td>{{ svc.quantity }}</td>
                <td>{{ (svc.cost * svc.quantity).toFixed(2) }}</td>
                <td>{{ svc.price.toFixed(2) }}</td>
                <td>{{ (svc.margin * svc.quantity).toFixed(2) }}</td>
                <td>{{ (svc.price * svc.quantity).toFixed(2) }}</td>
                <td>
                  <button
                    v-tooltip="t('orders.btn_remove_service')"
                    class="action-icon-btn action-danger"
                    @click="removeService(svc.id)"
                  >
                    <SvgIcon name="trash" :width="14" :height="14" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassPanel>

      <GlassPanel :title="t('orders.section_files')" data-test="order-create-files">
        <div data-test="order-create-file-list" style="margin-bottom: 15px">
          <FileItem
            v-for="f in localOrder.files"
            :key="f.id"
            :name="f.name"
            download-url="#"
            data-test="order-create-file-item"
            @delete="removeFile(f.fileId)"
          />
        </div>
        <DropZone
          data-test="order-create-file-dropzone"
          :hint="t('orders.dropzone_hint')"
          :multiple="true"
          @uploaded="onFilesUploaded"
        />
      </GlassPanel>
    </div>

    <AddOrderItemsModal
      :show="showAddItemsModal"
      :order-id="''"
      @close="showAddItemsModal = false"
      @add="showAddItemsModal = false; addItem($event)"
    />

    <AddOrderServicesModal
      :show="showAddServicesModal"
      :order-id="''"
      @close="showAddServicesModal = false"
      @add="showAddServicesModal = false; addService($event)"
    />
  </div>
</template>

<style>
@import '@styles/admin/orders_card.css';
@import '@styles/admin/orders_create.css';
</style>
