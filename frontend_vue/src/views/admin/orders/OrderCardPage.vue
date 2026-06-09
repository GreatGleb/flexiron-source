<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useOrderCard } from '@/composables/useOrderCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import AddOrderItemsModal from './AddOrderItemsModal.vue'
import AddOrderServicesModal from './AddOrderServicesModal.vue'
import type { OrderStatus } from '@/types/order'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'
import '@styles/admin/orders_card.css'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = route.params.id as string

const {
  form,
  order, loading, saving, error, isDirty,
  load, save, discard, remove,
  auditLog, auditLoading, deleteAuditEntry,
  handleChangeStatus,
  handleAddItemDirect, handleDeleteItem,
  handleAddServiceDirect, handleDeleteService,
  onFilesUploaded, removeFile,
  tf,
  hasPendingChanges,
} = useOrderCard(id)

const pageTitle = computed(() =>
  order.value
    ? `${t('orders.card_title')} ${order.value.orderNumber}`
    : t('orders.title'),
)

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => t('orders.card_title'),
})

// ─── Document type options ─────────────────────────────────────
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'local', label: t('orders.create_option_local') },
  { value: 'export', label: t('orders.create_option_export') },
]

// ─── Status options ────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'new', label: t('orders.status_new') },
  { value: 'confirmed', label: t('orders.status_confirmed') },
  { value: 'picking', label: t('orders.status_picking') },
  { value: 'packing', label: t('orders.status_packing') },
  { value: 'shipped', label: t('orders.status_shipped') },
  { value: 'delivered', label: t('orders.status_delivered') },
  { value: 'paid', label: t('orders.status_paid') },
  { value: 'cancelled', label: t('orders.status_cancelled') },
]

const statusStr = computed({
  get: () => order.value?.status ?? 'new',
  set: (v: string) => {
    if (order.value) {
      handleChangeStatus(v as OrderStatus)
    }
  },
})

// ─── Order financial computed ────────────────────────────────
const orderTotalVatDisplay = computed(() => {
  return Math.round(discountedTotal.value * 0.21 * 100) / 100
})

const orderTotalWithVatDisplay = computed(() => {
  return discountedTotal.value + orderTotalVatDisplay.value
})

const orderTotalCost = computed(() => {
  if (!order.value) return 0
  const itemsCost = order.value.items.reduce((sum, i) => sum + (i.unitCost ?? 0) * i.quantity, 0)
  const servicesCost = order.value.services.reduce((sum, s) => sum + s.cost * s.quantity, 0)
  return itemsCost + servicesCost
})

const discountedTotal = computed(() => {
  if (!order.value) return 0
  const discount = form.value.orderDiscount ?? 0
  return form.value.totalAmount * (1 - discount / 100)
})

const orderTotalMargin = computed(() => {
  return discountedTotal.value - orderTotalCost.value
})

// ─── Status pill mapping ───────────────────────────────────────
const ORDER_STATUS_PILL: Record<string, string> = {
  new: 'pill-secondary',
  confirmed: 'pill-info',
  picking: 'pill-warning',
  packing: 'pill-warning',
  shipped: 'pill-info',
  delivered: 'pill-success',
  paid: 'pill-success',
  cancelled: 'pill-danger',
}

// ─── Delete order modal ────────────────────────────────────────
const showDeleteModal = ref(false)

function onDeleteClick() {
  showDeleteModal.value = true
}

async function onDeleteConfirm() {
  showDeleteModal.value = false
  const success = await remove()
  if (success) {
    await router.push({ name: 'admin-orders' })
  }
}

// ─── Audit delete modal ────────────────────────────────────────
const deleteAuditOpen = ref(false)
const auditToDeleteIdx = ref<number | null>(null)
const deletingAudit = ref(false)

function askDeleteAudit(index: number) {
  auditToDeleteIdx.value = index
  deleteAuditOpen.value = true
}

const showAddItemsModal = ref(false)
const showAddServicesModal = ref(false)

async function confirmDeleteAudit() {
  if (auditToDeleteIdx.value === null || deletingAudit.value) return
  deletingAudit.value = true
  const idx = auditToDeleteIdx.value
  await deleteAuditEntry(idx)
  auditToDeleteIdx.value = null
  deleteAuditOpen.value = false
  deletingAudit.value = false
}

// ─── Auto-resize notes textarea ─────────────────────────────────
const notesTextarea = ref<HTMLTextAreaElement | null>(null)
const MAX_NOTES_HEIGHT = 300

function autoResizeNotes() {
  const el = notesTextarea.value
  if (!el) return
  el.style.height = 'auto'
  if (el.scrollHeight > MAX_NOTES_HEIGHT) {
    el.style.height = MAX_NOTES_HEIGHT + 'px'
    el.style.overflowY = 'auto'
  } else {
    el.style.height = el.scrollHeight + 'px'
    el.style.overflowY = 'hidden'
  }
}

watch(() => form.value.notes, () => {
  nextTick(autoResizeNotes)
})

// ─── Currency selector for total amount ─────────────────────
const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'PLN']
const currencyOpen = ref(false)

function selectCurrency(c: string) {
  form.value.currency = c
  if (order.value) order.value.currency = c
  currencyOpen.value = false
}

function onDocClickCloseCurrency(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.('.input-with-suffix')
  if (!el) currencyOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClickCloseCurrency))
onBeforeUnmount(() => document.removeEventListener('click', onDocClickCloseCurrency))

onMounted(load)
</script>

<template>
  <template v-if="loading">
    <div class="page-order-card" data-test="page-order-card">
      <div class="main-card-content">
        <div class="entity-card-grid">
          <div class="entity-col-left">
            <GlassPanel :loading="true" :skeleton-rows="4" />
          </div>
          <div class="entity-col-center">
            <GlassPanel :loading="true" :skeleton-rows="3" />
          </div>
          <div class="entity-col-right">
            <GlassPanel :loading="true" :skeleton-rows="1" />
          </div>
        </div>
      </div>
    </div>
  </template>

  <template v-else-if="error && !order">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('orders.title'), to: { name: 'admin-orders' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found" data-test="order-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-orders' }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-order-card" data-test="page-order-card">
      <div class="order-card-header" data-test="order-card-header">
        <Breadcrumb
          :items="[
            { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
            { label: t('orders.title'), to: { name: 'admin-orders' } },
            { label: order ? `${t('orders.card_title')} ${order.orderNumber}` : '...' },
          ]"
        />
        <div class="order-card-header-row">
          <div class="order-card-header-left">
            <h1 class="page-title">{{ order ? `${t('orders.card_title')} ${order.orderNumber}` : '...' }}</h1>
            <span v-if="order" class="order-status-wrapper">
              <span
                class="pill pill-lg"
                :class="ORDER_STATUS_PILL[order.status] || 'pill-secondary'"
                data-test="order-card-status-pill"
              >
                {{ t(`orders.status_${order.status}`) }}
              </span>
              <span
                v-tooltip="t(`orders.status_hint_${order.status}`)"
                class="info-hint"
                data-test="order-card-status-hint"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
            </span>
          </div>
          <div
            class="entity-action-bar no-margin pos-static"
            data-test="order-card-save-bar"
          >
            <button
              class="btn btn-secondary"
              :disabled="(!isDirty && !hasPendingChanges) || saving"
              data-test="order-card-discard-btn"
              @click="discard"
            >
              {{ t('orders.btn_discard_changes') }}
            </button>
            <button
              class="btn btn-save"
              :class="{ dirty: isDirty || hasPendingChanges, loading: saving }"
              :disabled="(!isDirty && !hasPendingChanges) || saving"
              data-test="order-card-save-btn"
              @click="save"
            >
              {{ saving ? t('orders.btn_save') + '...' : t('orders.btn_save') }}
            </button>
            <button
              type="button"
              class="btn btn-danger"
              :disabled="saving"
              data-test="order-card-delete-btn"
              @click="onDeleteClick"
            >
              <SvgIcon name="trash" :width="16" :height="16" />
              {{ t('orders.btn_delete_order') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="error-state" data-test="order-card-error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('orders.btn_retry') }}</button>
      </div>

      <div class="main-card-content">

        <div class="entity-card-grid">

          <div class="entity-col-left">
            <GlassPanel :title="t('orders.section_header')" :loading="loading" :skeleton-rows="4" data-test="order-info-left">
              <template v-if="order">
                <InputGroup :label="t('orders.field_order_number')">
                  <span class="glass-input-static">{{ order.orderNumber }}</span>
                  <span class="field-hint">{{ t('orders.field_order_number_hint') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_client')">
                  <span class="glass-input-static">{{ order.clientName }}</span>
                  <span class="field-hint">{{ t('orders.field_client_hint') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_document_type')">
                  <CustomSelect
                    v-model="form.documentType"
                    :options="DOCUMENT_TYPE_OPTIONS"
                    data-test="field-document-type"
                  />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <div class="entity-col-center">
            <GlassPanel :title="t('orders.section_header')" :loading="loading" :skeleton-rows="3" data-test="order-info-center">
              <template v-if="order">
                <InputGroup :label="t('orders.field_total')">
                  <div class="input-with-suffix custom-select-wrap">
                    <input
                      v-model.number="form.totalAmount"
                      class="glass-input"
                      type="number"
                      min="0"
                      step="0.01"
                      data-test="field-total-amount"
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
                </InputGroup>
                <InputGroup :label="t('orders.field_order_discount')">
                  <div class="input-with-suffix">
                    <input
                      v-model.number="form.orderDiscount"
                      class="glass-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      data-test="field-order-discount"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      %
                    </span>
                  </div>
                </InputGroup>
                <InputGroup :label="t('orders.field_discounted_total')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="discountedTotal.toFixed(2)"
                      readonly
                      data-test="field-discounted-total"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      {{ form.currency }}
                    </span>
                  </div>
                  <span class="field-hint">{{ t('orders.hint_auto_calculated') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_total_weight')">
                  <div class="input-with-suffix">
                    <input
                      v-model.number="form.totalWeight"
                      class="glass-input"
                      type="number"
                      min="0"
                      step="0.01"
                      data-test="field-total-weight"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      kg
                    </span>
                  </div>
                </InputGroup>
                <InputGroup :label="t('orders.field_total_vat')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="orderTotalVatDisplay.toFixed(2)"
                      readonly
                      data-test="field-total-vat"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      {{ form.currency }}
                    </span>
                  </div>
                  <span class="field-hint">{{ t('orders.hint_auto_calculated') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_total_with_vat')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="orderTotalWithVatDisplay.toFixed(2)"
                      readonly
                      data-test="field-total-with-vat"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      {{ form.currency }}
                    </span>
                  </div>
                  <span class="field-hint">{{ t('orders.hint_auto_calculated') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_total_cost')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="orderTotalCost.toFixed(2)"
                      readonly
                      data-test="field-total-cost"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      {{ form.currency }}
                    </span>
                  </div>
                  <span class="field-hint">{{ t('orders.hint_auto_calculated') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_total_margin')">
                  <div class="input-with-suffix">
                    <input
                      class="glass-input"
                      type="text"
                      :value="orderTotalMargin.toFixed(2)"
                      readonly
                      data-test="field-total-margin"
                      :style="orderTotalMargin < 0 ? 'color: var(--danger, #dc3545)' : ''"
                    />
                    <span class="input-suffix" style="cursor: default; opacity: 0.7;">
                      {{ form.currency }}
                    </span>
                  </div>
                  <span class="field-hint">{{ t('orders.hint_auto_calculated') }}</span>
                </InputGroup>
                <InputGroup :label="t('orders.field_notes')">
                  <textarea
                    ref="notesTextarea"
                    v-model="form.notes"
                    class="glass-input"
                    data-test="field-notes"
                    @input="autoResizeNotes"
                  />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <div class="entity-col-right">
            <GlassPanel :title="t('orders.field_status')" :loading="loading" :skeleton-rows="1" data-test="order-info-right">
              <template v-if="order">
                <InputGroup :label="t('orders.col_status')">
                  <CustomSelect
                    v-model="statusStr"
                    :options="STATUS_OPTIONS"
                    data-test="order-card-status"
                  />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

        </div>

        <GlassPanel data-test="order-items">
          <template #header>
            <span class="panel-title">{{ t('orders.section_items') }}</span>
            <button
              class="btn btn-sm btn-primary"
              data-test="order-add-item-btn"
              @click="showAddItemsModal = true"
            >
              <SvgIcon name="plus-add" :width="14" :height="14" />
              {{ t('orders.btn_add_item') }}
            </button>
          </template>
          <div v-if="order && order.items.length === 0" class="empty-state-inline">
            <p>{{ t('orders.items_empty') }}</p>
          </div>
          <div v-else-if="order" class="data-table-wrapper">
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
                <tr v-for="item in order.items" :key="item.id" class="order-item-row">
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
                      @click="handleDeleteItem(item.id)"
                    >
                      <SvgIcon name="trash" :width="14" :height="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel data-test="order-services">
          <template #header>
            <span class="panel-title">{{ t('orders.section_services') }}</span>
            <button
              class="btn btn-sm btn-primary"
              data-test="order-add-service-btn"
              @click="showAddServicesModal = true"
            >
              <SvgIcon name="plus-add" :width="14" :height="14" />
              {{ t('orders.btn_add_service') }}
            </button>
          </template>
          <div v-if="order && order.services.length === 0" class="empty-state-inline">
            <p>{{ t('orders.services_empty') }}</p>
          </div>
          <div v-else-if="order" class="data-table-wrapper">
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
                <tr v-for="svc in order.services" :key="svc.id" class="order-service-row">
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
                      @click="handleDeleteService(svc.id)"
                    >
                      <SvgIcon name="trash" :width="14" :height="14" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel :title="t('orders.section_files')" data-test="order-files">
          <template v-if="order">
            <div data-test="order-file-list" style="margin-bottom: 15px">
              <FileItem
                v-for="f in order.files"
                :key="f.id"
                :name="f.name"
                download-url="#"
                data-test="order-file-item"
                @delete="removeFile(f.fileId)"
              />
            </div>
            <DropZone
              data-test="order-file-dropzone"
              :hint="t('orders.dropzone_hint')"
              :multiple="true"
              @uploaded="onFilesUploaded"
            />
          </template>
        </GlassPanel>

        <div class="audit-panel-wide" data-test="order-audit">
          <GlassPanel :title="t('orders.section_audit')">
            <div v-if="auditLoading" class="text-muted" style="padding: 12px 0;">
              {{ t('orders.loading') }}...
            </div>
            <template v-else-if="auditLog.length > 0">
              <div class="table-responsive">
                <table class="audit-log-table" data-test="order-audit-table">
                  <thead>
                    <tr>
                      <th>{{ t('orders.audit_col_date') }}</th>
                      <th>{{ t('orders.audit_col_user') }}</th>
                      <th>{{ t('orders.audit_col_property') }}</th>
                      <th>{{ t('orders.audit_col_old_value') }}</th>
                      <th>{{ t('orders.audit_col_new_value') }}</th>
                      <th style="width: 40px" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(a, i) in auditLog" :key="i" data-test="order-audit-row">
                      <td class="audit-log-ts">{{ a.timestamp }}</td>
                      <td>
                        <div class="audit-log-user">
                          <div class="audit-log-avatar">{{ a.userInitials }}</div>
                          <span>{{ tf(a.user) }}</span>
                        </div>
                      </td>
                      <td>{{ tf(a.property) }}</td>
                      <td>
                        <span class="audit-diff-old">{{ a.oldValue }}</span>
                      </td>
                      <td>
                        <span class="audit-diff-new">{{ a.newValue }}</span>
                      </td>
                      <td style="text-align: right">
                        <button
                          v-tooltip="t('btn.delete')"
                          type="button"
                          class="action-icon-btn action-danger"
                          data-test="order-audit-delete-btn"
                          @click="askDeleteAudit(i)"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
            <div v-else class="audit-empty">
              <SvgIcon name="warehouse-box" :width="32" :height="32" />
              <p>{{ t('orders.no_audit_entries') }}</p>
            </div>
          </GlassPanel>
        </div>

      </div>
    </div>

    <AppModal
      v-model="showDeleteModal"
      :title="t('orders.confirm_delete')"
      size="small"
      data-test="order-card-delete-modal"
    >
      <p>{{ t('orders.confirm_delete') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="order-card-delete-modal-cancel"
          @click="showDeleteModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="saving"
          data-test="order-card-delete-modal-confirm"
          @click="onDeleteConfirm"
        >
          {{ saving ? t('btn.delete') + '...' : t('btn.delete') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="deleteAuditOpen"
      :title="t('modal.confirm_delete')"
      size="small"
      data-test="order-audit-modal"
    >
      <p>{{ t('modal.delete_audit_warning') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="order-audit-modal-cancel"
          @click="deleteAuditOpen = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="order-audit-modal-confirm"
          @click="confirmDeleteAudit"
        >
          {{ t('btn.delete') }}
        </button>
      </template>
    </AppModal>

    <AddOrderItemsModal
      :show="showAddItemsModal"
      :order-id="id"
      @close="showAddItemsModal = false"
      @add="showAddItemsModal = false; handleAddItemDirect($event)"
    />

    <AddOrderServicesModal
      :show="showAddServicesModal"
      :order-id="id"
      @close="showAddServicesModal = false"
      @add="showAddServicesModal = false; handleAddServiceDirect($event)"
    />
  </template>
</template>

<style>
@import '@styles/admin/orders_card.css';

/* Audit log empty state — matches design system empty-state pattern */
.audit-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px 24px;
  color: var(--text-secondary, #8c8c8c);
  text-align: center;
}

.audit-empty svg {
  opacity: 0.4;
}

.audit-empty p {
  margin: 0;
  font-size: 13px;
}
</style>
