<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useClientCard } from '@/composables/useClientCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'
import '@styles/admin/client_card.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const id = route.params.id as string
const {
  client, loading, saving, isDirty, error,
  load, save, discard, tf,
  auditLog, auditLoading, loadAudit, deleteAuditEntry,
  handleDeleteInteraction,
  newInteraction, inlineAddInteraction, resetNewInteraction,
} = useClientCard(id)

const pageTitle = computed(() =>
  client.value
    ? `${t('clients.card_title')} ${client.value.id} - ${client.value.name}`
    : t('clients.title'),
)

useHead({
  title: () => `Flexiron - ${pageTitle.value}`,
  description: () => t('clients.card_title'),
})

const STATUS_OPTIONS = [
  { value: 'active', label: t('clients.status_active') },
  { value: 'inactive', label: t('clients.status_inactive') },
]

const statusStr = computed({
  get: () => client.value?.status ?? 'active',
  set: (v: string) => {
    if (client.value) client.value.status = v as 'active' | 'inactive'
  },
})

const ORDER_STATUS_PILL: Record<string, string> = {
  completed: 'pill-success',
  shipped: 'pill-info',
  processing: 'pill-warning',
  pending: 'pill-warning',
  cancelled: 'pill-danger',
  new: 'pill-secondary',
  confirmed: 'pill-info',
  picking: 'pill-warning',
  packing: 'pill-warning',
  delivered: 'pill-success',
  paid: 'pill-success',
}

function orderStatusLabel(status: string): string {
  const key = `orders.status_${status}`
  const translated = t(key)
  return translated !== key ? translated : status.charAt(0).toUpperCase() + status.slice(1)
}

const INTERACTION_TYPE_LABEL: Record<string, string> = {
  call: t('clients.history_type_call'),
  email: t('clients.history_type_email'),
  note: t('clients.history_type_note'),
  meeting: t('clients.history_type_meeting'),
}

const INTERACTION_TYPE_OPTIONS = [
  { value: 'call', label: t('clients.interaction_type_call') },
  { value: 'email', label: t('clients.interaction_type_email') },
  { value: 'note', label: t('clients.interaction_type_note') },
  { value: 'meeting', label: t('clients.interaction_type_meeting') },
]

const canAddInteraction = computed(() => {
  return (newInteraction.summary ?? '').trim().length > 0
})

/** Interaction history sorted newest-first by date */
const sortedInteractions = computed(() => {
  if (!client.value?.interactionHistory) return []
  return [...client.value.interactionHistory].sort((a, b) => b.date.localeCompare(a.date))
})

function goToOrder(orderId: string) {
  router.push({ name: 'admin-order-card', params: { id: orderId } })
}

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Audit log entry deletion (with confirm modal) ───
const deleteAuditOpen = ref(false)
const auditToDeleteIdx = ref<number | null>(null)
const deletingAudit = ref(false)

function askDeleteAudit(index: number) {
  auditToDeleteIdx.value = index
  deleteAuditOpen.value = true
}

async function confirmDeleteAudit() {
  const idx = auditToDeleteIdx.value
  if (idx === null || deletingAudit.value) return
  deletingAudit.value = true
  try {
    await deleteAuditEntry(idx)
    auditToDeleteIdx.value = null
    deleteAuditOpen.value = false
  } finally {
    deletingAudit.value = false
  }
}

onMounted(() => {
  load()
  loadAudit()
})
</script>

<template>
  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="page-client-card" data-test="client-card-page">
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

  <!-- Error state -->
  <template v-else-if="error && !client">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('clients.title'), to: { name: 'admin-clients' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found" data-test="client-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-clients' }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <!-- Loaded state -->
  <template v-else>
    <div class="page-client-card" data-test="client-card-page">
      <div class="client-card-header" data-test="client-card-header">
        <Breadcrumb
          :items="[
            { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
            { label: t('clients.title'), to: { name: 'admin-clients' } },
            { label: client ? `${t('clients.card_title')} ${client.id} - ${client.name}` : '...' },
          ]"
        />
        <div class="client-card-header-row">
          <div class="client-card-header-left">
            <h1 class="page-title">{{ client ? `${t('clients.card_title')} ${client.id} - ${client.name}` : '...' }}</h1>
            <span v-if="client" class="client-status-wrapper">
              <span
                class="pill pill-lg"
                :class="client.status === 'active' ? 'pill-success' : 'pill-secondary'"
                data-test="client-card-status-pill"
              >
                {{ client.status === 'active' ? t('clients.status_active') : t('clients.status_inactive') }}
              </span>
              <span
                v-tooltip="client.status === 'active' ? t('clients.status_active_hint') : t('clients.status_inactive_hint')"
                class="info-hint"
                data-test="client-card-status-hint"
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
            data-test="client-card-save-bar"
          >
            <button
              class="btn btn-secondary"
              @click="discard"
            >
              {{ t('clients.btn_discard_changes') }}
            </button>
            <button
              class="btn btn-save"
              :class="{ dirty: isDirty, loading: saving }"
              :disabled="!client || !isDirty || saving"
              @click="save"
            >
              {{ t('clients.btn_save') }}
            </button>
          </div>
        </div>
      </div>

      <div class="main-card-content">
        <div class="entity-card-grid">

          <!-- LEFT: General Information -->
          <div class="entity-col-left">
            <GlassPanel :title="t('clients.section_general')" :loading="loading" :skeleton-rows="4" data-test="client-card-general">
              <template v-if="client">
                <InputGroup :label="t('clients.field_name')">
                  <input v-model="client.name" class="glass-input" type="text" data-test="field-name" />
                </InputGroup>

                <InputGroup :label="t('clients.field_company_code')">
                  <input v-model="client.companyCode" class="glass-input" type="text" data-test="field-company-code" />
                </InputGroup>

                <InputGroup :label="t('clients.field_vat')">
                  <input v-model="client.vatCode" class="glass-input" type="text" data-test="field-vat" />
                </InputGroup>

                <InputGroup :label="t('clients.field_notes')">
                  <textarea
                    v-model="client.notes"
                    class="glass-input glass-textarea"
                    rows="3"
                    data-test="field-notes"
                  />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <!-- CENTER: Contact Information -->
          <div class="entity-col-center">
            <GlassPanel :title="t('clients.section_contact')" :loading="loading" :skeleton-rows="3" data-test="client-card-contact">
              <template v-if="client">
                <InputGroup :label="t('clients.field_address')">
                  <input v-model="client.address" class="glass-input" type="text" data-test="field-address" />
                </InputGroup>

                <InputGroup :label="t('clients.field_phone')">
                  <input v-model="client.phone" class="glass-input" type="text" data-test="field-phone" />
                </InputGroup>

                <InputGroup :label="t('clients.field_email')">
                  <input v-model="client.email" class="glass-input" type="email" data-test="field-email" />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <!-- RIGHT: Status -->
          <div class="entity-col-right">
            <GlassPanel :title="t('clients.field_status')" :loading="loading" :skeleton-rows="1" data-test="client-card-status">
              <template v-if="client">
                <InputGroup :label="t('clients.col_status')">
                  <CustomSelect v-model="statusStr" :options="STATUS_OPTIONS" data-test="field-status" />
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

        </div>

        <!-- Order History -->
        <div class="audit-panel-wide" data-test="client-card-order-history">
          <GlassPanel :title="t('clients.section_order_history')">
            <template v-if="client && client.orderHistory && client.orderHistory.length > 0">
              <div class="table-responsive">
                <table class="audit-log-table" data-test="client-card-order-table">
                  <thead>
                    <tr>
                      <th>{{ t('clients.order_col_id') }}</th>
                      <th>{{ t('clients.order_col_date') }}</th>
                      <th>{{ t('clients.order_col_total') }}</th>
                      <th>{{ t('clients.order_col_status') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="order in client.orderHistory"
                      :key="order.id"
                      class="clickable-row"
                      data-test="client-card-order-row"
                      @click="goToOrder(order.id)"
                    >
                      <td>
                        <router-link
                          :to="{ name: 'admin-order-card', params: { id: order.id } }"
                          class="order-link"
                          @click.stop
                        >
                          {{ order.id }}
                        </router-link>
                      </td>
                      <td class="audit-log-ts">{{ order.date }}</td>
                      <td>
                        <span class="order-total">{{ order.currency }} {{ formatPrice(order.total) }}</span>
                      </td>
                      <td>
                        <span
                          class="status-pill"
                          :class="ORDER_STATUS_PILL[order.status] || 'pill-secondary'"
                        >
                          {{ orderStatusLabel(order.status) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
            <div v-else class="audit-empty">
              <SvgIcon name="warehouse-box" :width="32" :height="32" />
              <p>{{ t('clients.no_orders') }}</p>
            </div>
          </GlassPanel>
        </div>

        <!-- Internal Notes & Interaction History -->
        <div class="audit-panel-wide" data-test="client-card-notes-history">
          <GlassPanel :title="t('clients.section_notes_history')">
            <template v-if="client">
              <!-- Inline Interaction Form -->
              <div class="interaction-form-inline">
                <div class="interaction-form-row">
                  <InputGroup :label="t('clients.interaction_field_type')" class="interaction-form-type">
                    <CustomSelect v-model="newInteraction.type" :options="INTERACTION_TYPE_OPTIONS" data-test="field-interaction-type-inline" />
                  </InputGroup>

                  <InputGroup :label="t('clients.interaction_field_date')" class="interaction-form-date">
                    <DatePicker v-model="newInteraction.date" align-right data-test="field-interaction-date-inline" />
                  </InputGroup>
                </div>

                <InputGroup :label="t('clients.interaction_field_summary')">
                  <textarea
                    v-model="newInteraction.summary"
                    class="glass-input glass-textarea"
                    rows="3"
                    :placeholder="t('clients.notes_placeholder')"
                    data-test="field-interaction-summary-inline"
                  />
                </InputGroup>

                <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
                  <button class="btn btn-secondary btn-sm" data-test="client-card-reset-interaction-btn" @click="resetNewInteraction">
                    {{ t('clients.btn_discard') }}
                  </button>
                  <button
                    class="btn btn-primary btn-sm"
                    data-test="client-card-add-interaction-btn"
                    :disabled="!canAddInteraction"
                    @click="inlineAddInteraction"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    {{ t('clients.btn_add_interaction') }}
                  </button>
                </div>
              </div>

              <!-- Interaction History (newest first) -->
              <div v-if="sortedInteractions.length > 0" class="table-responsive" style="margin-top: 16px;">
                <table class="audit-log-table" data-test="client-card-interaction-table">
                  <thead>
                    <tr>
                      <th>{{ t('clients.history_col_date') }}</th>
                      <th>{{ t('clients.history_col_type') }}</th>
                      <th>{{ t('clients.history_col_summary') }}</th>
                      <th>{{ t('clients.history_col_user') }}</th>
                      <th style="width: 40px" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(entry, i) in sortedInteractions" :key="i" data-test="client-card-interaction-row">
                      <td class="audit-log-ts">{{ entry.date }}</td>
                      <td>
                        <span class="interaction-type-pill">{{ INTERACTION_TYPE_LABEL[entry.type] || entry.type }}</span>
                      </td>
                      <td>{{ entry.summary }}</td>
                      <td>{{ entry.user }}</td>
                      <td style="text-align: right">
                        <button
                          v-tooltip="t('clients.btn_delete_interaction')"
                          type="button"
                          data-test="client-card-interaction-delete-btn"
                          class="action-icon-btn action-danger"
                          @click="handleDeleteInteraction(i)"
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
              <div v-else class="audit-empty" style="margin-top: 16px;">
                <SvgIcon name="warehouse-box" :width="32" :height="32" />
                <p>{{ t('clients.no_interactions') }}</p>
              </div>
            </template>
          </GlassPanel>
        </div>

        <!-- Audit section -->
        <div class="audit-panel-wide" data-test="client-card-audit">
          <GlassPanel :title="t('clients.section_audit')">
            <div v-if="auditLoading" class="text-muted" style="padding: 12px 0;">
              {{ t('clients.loading') }}...
            </div>
            <template v-else-if="auditLog.length > 0">
              <div class="table-responsive">
                <table class="audit-log-table" data-test="client-card-audit-table">
                  <thead>
                    <tr>
                      <th>{{ t('clients.audit_col_date') }}</th>
                      <th>{{ t('clients.audit_col_user') }}</th>
                      <th>{{ t('clients.audit_col_property') }}</th>
                      <th>{{ t('clients.audit_col_old_value') }}</th>
                      <th>{{ t('clients.audit_col_new_value') }}</th>
                      <th style="width: 40px" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(a, i) in auditLog" :key="i" data-test="client-card-audit-row">
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
                          v-tooltip="t('clients.btn_delete')"
                          type="button"
                          class="action-icon-btn action-danger"
                          data-test="client-card-audit-delete-btn"
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
              <p>{{ t('clients.no_audit_entries') }}</p>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>

    <!-- Audit delete confirmation modal -->
    <AppModal
      v-model="deleteAuditOpen"
      :title="t('modal.confirm_delete')"
      size="small"
      data-test="client-card-audit-delete-modal"
    >
      <p>{{ t('modal.delete_audit_warning') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          data-test="client-card-audit-modal-cancel"
          @click="deleteAuditOpen = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="client-card-audit-modal-confirm"
          @click="confirmDeleteAudit"
        >
          {{ t('btn.delete') }}
        </button>
      </template>
    </AppModal>

  </template>
</template>

<style>
@import '@styles/admin/client_card.css';

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
