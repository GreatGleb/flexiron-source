<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useOrderCreate } from '@/composables/useOrderCreate'
import { useUnitLabel } from '@/composables/useUnitLabel'
import { useOrderPermissions } from '@/composables/useOrderPermissions'
import { formatCents as money } from '@/domain/orderPricing'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import AutoResizeTextarea from '@/components/admin/ui/AutoResizeTextarea.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import Pagination from '@/components/admin/ui/Pagination.vue'
import AddOrderItemsModal from './AddOrderItemsModal.vue'
import AddOrderServicesModal from './AddOrderServicesModal.vue'
import type { Client } from '@/types/client'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_checkbox-list.css'
import '@styles/admin/components/_radio.css'
import '@styles/admin/components/_input-suffix.css'
import '@styles/admin/components/_pagination.css'
import '@styles/admin/orders_card.css'
import '@styles/admin/orders_create.css'

const router = useRouter()
const { t } = useI18n()
const unitLabel = useUnitLabel()

useHead({
  title: () => `Flexiron — ${t('orders.create_title')}`,
  description: () => t('orders.create_title'),
})

const {
  form,
  errors,
  saving,
  settings,
  clients,
  loadingClients,
  clientsError,
  clientSearch,
  clientPagination,
  selectedClient,
  selectClient,
  loadClients,
  localOrder,
  hasPendingChanges,
  addItem,
  removeItem,
  addService,
  removeService,
  onFilesUploaded,
  removeFile,
  handleSave,
} = useOrderCreate()

// Cost and margin are a right, not a layout decision — the card hides both
// behind it in seven places, and an order being created is no less an order.
// `ready` matters because the rights arrive a moment after the page: rendering
// once without the columns and again with them is a visible flicker.
const { ready: rightsReady, canSeeCost } = useOrderPermissions()
const showCost = computed(() => rightsReady.value && canSeeCost.value)

// ─── Document type options ─────────────────────────────────────
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'local', label: t('orders.create_option_local') },
  { value: 'export', label: t('orders.create_option_export') },
]

// ─── Client selector (radio list, searched and paged by the server) ─────
const {
  page: clientPage,
  pageSize: clientPageSize,
  totalPages: clientTotalPages,
} = clientPagination

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

function isClientSelected(id: string): boolean {
  return form.value.clientId === id
}

function onClientPicked(client: Client) {
  selectClient(client)
}

// ─── Items modals ──────────────────────────────────────────────
const showAddItemsModal = ref(false)
const showAddServicesModal = ref(false)

// Named handlers rather than two statements inline: Prettier reformats an inline
// "a = false; b($event)" onto separate lines, which Vue's expression parser
// rejects — and this page is loaded lazily, so the build stays green while the
// route fails in the browser.
// The draft has no saved lines to reprice, so the dialog asks nothing here and
// the mode it emits is ignored.
function onItemsAdded(payload: Parameters<typeof addItem>[0]) {
  showAddItemsModal.value = false
  addItem(payload)
}

function onServicesAdded(payload: Parameters<typeof addService>[0]) {
  showAddServicesModal.value = false
  addService(payload)
}

// ─── Create action ─────────────────────────────────────────────
/**
 * Set for the one navigation that follows a successful create.
 *
 * `saving` cannot stand in for it: it is already back to false by the time the
 * redirect runs, so the guard below would ask the admin whether to discard the
 * order it had just saved — and a dismissed dialog cancels the redirect, leaving
 * them on the form of an order that exists.
 */
const leavingAfterCreate = ref(false)

async function onCreate() {
  const order = await handleSave()
  if (order) {
    leavingAfterCreate.value = true
    router.push({ name: 'admin-order-card', params: { id: order.id } })
  }
}

/**
 * Nothing typed is worth losing to a mis-click on a breadcrumb.
 *
 * This was the one `window.confirm` in the admin — a grey system box in front of
 * a dark page. The router guard may answer with a promise, so the question can
 * be an `AppModal` like every other question the app asks.
 */
const leaveConfirmOpen = ref(false)
let answerLeave: ((leave: boolean) => void) | null = null

function askLeave(): boolean | Promise<boolean> {
  if (!hasPendingChanges.value) return true
  leaveConfirmOpen.value = true
  return new Promise<boolean>((resolve) => {
    answerLeave = resolve
  })
}

function closeLeaveConfirm(leave: boolean) {
  leaveConfirmOpen.value = false
  answerLeave?.(leave)
  answerLeave = null
}

/**
 * Only navigates. The guard below is what asks — routing through it means the
 * question is asked once, however the reader chose to leave. Asking here as
 * well is what the old code did, and it put the box up twice.
 */
function handleCancel() {
  router.push({ name: 'admin-orders' })
}

onBeforeRouteLeave(() => {
  if (leavingAfterCreate.value) return true
  return askLeave()
})

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
              class="checkbox-list"
              :class="{ 'has-error': errors.clientId }"
              data-test="order-create-client-section"
            >
              <div class="checkbox-list-controls">
                <span class="client-field-label">
                  <span
                    >{{ t('orders.create_field_client') }}
                    <span class="required-star">*</span></span
                  >
                  <span v-if="errors.clientId" class="field-error">{{ errors.clientId }}</span>
                </span>
                <span
                  v-if="selectedClient"
                  class="selected-count"
                  data-test="order-create-client-selected"
                >
                  <span class="count">1</span>
                  {{ t('orders.selected_text') }}
                </span>
              </div>

              <p
                v-if="selectedClient"
                class="client-selected-name"
                data-test="order-create-client-selected-name"
              >
                {{ t('orders.create_selected_client', { name: selectedClient.name }) }}
              </p>

              <!-- ТЗ Process 2.1 §1: выбрали клиента — условия оплаты видны сразу,
                   не после сохранения заказа. -->
              <p
                v-if="selectedClient"
                class="client-selected-terms"
                data-test="order-create-client-payment-terms"
              >
                {{
                  t('orders.create_client_payment_terms', {
                    terms: t('clients.payment_terms_days', {
                      days: selectedClient.paymentTermsDays,
                    }),
                  })
                }}
              </p>

              <div data-test="order-create-client-search">
                <SearchInput
                  v-model="clientSearch"
                  :placeholder="t('orders.create_search_client')"
                />
              </div>

              <div
                v-if="clientsError"
                class="client-list-error"
                data-test="order-create-client-error"
              >
                <p>{{ t('orders.create_clients_error') }}</p>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-test="order-create-client-retry"
                  @click="loadClients"
                >
                  {{ t('orders.create_btn_retry') }}
                </button>
              </div>

              <template v-else>
                <div class="checkbox-list-items" data-test="order-create-client-list">
                  <label
                    v-for="c in clients"
                    :key="c.id"
                    class="checkbox-item"
                    data-test="order-create-client-item"
                    :data-client-id="c.id"
                  >
                    <input
                      type="radio"
                      name="order-client"
                      class="radio-input"
                      :checked="isClientSelected(c.id)"
                      @change="onClientPicked(c)"
                    />
                    <span class="radio-custom"></span>
                    <span class="checkbox-label">{{ c.name }}</span>
                    <span class="checkbox-email">{{ c.email }}</span>
                  </label>
                  <div
                    v-if="clients.length === 0"
                    class="client-list-empty"
                    data-test="order-create-client-empty"
                  >
                    {{ t('orders.create_no_clients') }}
                  </div>
                </div>

                <div
                  v-if="clients.length > 0"
                  class="client-pagination"
                  data-test="order-create-client-pagination"
                >
                  <Pagination
                    v-model:page="clientPagination.page.value"
                    v-model:size="clientPageSizeStr"
                    :total-pages="clientTotalPages"
                    :pages="clientPagination.pageNumbers()"
                    :page-size-options="PAGE_SIZE_OPTIONS_CLIENTS"
                    :size-label="t('suppliers.page_size')"
                  />
                </div>
              </template>
            </div>
          </GlassPanel>
        </div>

        <div class="entity-col-center">
          <GlassPanel :title="t('orders.field_notes')" data-test="order-create-notes-panel">
            <InputGroup :label="t('orders.field_notes')">
              <AutoResizeTextarea
                v-model="form.notes"
                class="glass-input"
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
              <tr
                v-for="item in localOrder.items"
                :key="item.id"
                class="order-item-row"
                data-test="order-create-item-row"
              >
                <td>{{ item.lineNumber }}</td>
                <td>{{ item.productName }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ unitLabel(item.unit) }}</td>
                <td>{{ money(item.unitPrice) }}</td>
                <td>{{ money(item.totalPrice) }}</td>
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
                <th v-if="showCost">{{ t('orders.col_cost') }}</th>
                <th>{{ t('orders.col_price') }}</th>
                <th v-if="showCost">{{ t('orders.col_margin_amount') }}</th>
                <th>{{ t('orders.col_total_price') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="svc in localOrder.services"
                :key="svc.id"
                class="order-service-row"
                data-test="order-create-service-row"
              >
                <td>{{ svc.serviceName }}</td>
                <td>{{ svc.quantity }}</td>
                <td v-if="showCost">{{ money(svc.cost * svc.quantity) }}</td>
                <td>{{ money(svc.price) }}</td>
                <td v-if="showCost">{{ money(svc.marginAmount) }}</td>
                <td>{{ money(svc.totalPrice) }}</td>
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

      <GlassPanel :title="t('orders.section_totals')" data-test="order-create-totals">
        <div class="order-create-totals">
          <InputGroup v-if="showCost" :label="t('orders.field_total_cost')">
            <div class="input-with-suffix">
              <input
                :value="money(localOrder.totalCost)"
                class="glass-input"
                readonly
                data-test="order-create-total-cost"
              />
              <span class="input-suffix static-suffix">{{
                settings.constants.defaultCurrency
              }}</span>
            </div>
          </InputGroup>
          <InputGroup :label="t('orders.field_net_total')">
            <div class="input-with-suffix">
              <input
                :value="money(localOrder.totalAmount)"
                class="glass-input"
                readonly
                data-test="order-create-total-net"
              />
              <span class="input-suffix static-suffix">{{
                settings.constants.defaultCurrency
              }}</span>
            </div>
          </InputGroup>
          <InputGroup :label="t('orders.field_vat_amount')">
            <div class="input-with-suffix">
              <input
                :value="money(localOrder.totalVat)"
                class="glass-input"
                readonly
                data-test="order-create-total-vat"
              />
              <span class="input-suffix static-suffix">{{
                settings.constants.defaultCurrency
              }}</span>
            </div>
          </InputGroup>
          <InputGroup :label="t('orders.field_gross_total')">
            <div class="input-with-suffix">
              <input
                :value="money(localOrder.totalWithVat)"
                class="glass-input"
                readonly
                data-test="order-create-total-gross"
              />
              <span class="input-suffix static-suffix">{{
                settings.constants.defaultCurrency
              }}</span>
            </div>
          </InputGroup>
        </div>
      </GlassPanel>

      <GlassPanel :title="t('orders.section_files')" data-test="order-create-files">
        <div class="order-create-file-list" data-test="order-create-file-list">
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
      :default-margin-percent="settings.constants.defaultMargin"
      :default-discount-percent="settings.constants.defaultDiscountPercent"
      @close="showAddItemsModal = false"
      @add="onItemsAdded($event)"
    />

    <AddOrderServicesModal
      :show="showAddServicesModal"
      :default-discount-percent="settings.constants.defaultDiscountPercent"
      @close="showAddServicesModal = false"
      @add="onServicesAdded($event)"
    />

    <AppModal
      :model-value="leaveConfirmOpen"
      :title="t('orders.confirm_leave_title')"
      size="small"
      data-test="order-create-leave-modal"
      @update:model-value="closeLeaveConfirm(false)"
    >
      <p>{{ t('orders.confirm_leave') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="order-create-leave-stay"
          @click="closeLeaveConfirm(false)"
        >
          {{ t('orders.confirm_leave_stay') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="order-create-leave-discard"
          @click="closeLeaveConfirm(true)"
        >
          {{ t('orders.confirm_leave_discard') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<style>
@import '@styles/admin/orders_card.css';
@import '@styles/admin/orders_create.css';
</style>
