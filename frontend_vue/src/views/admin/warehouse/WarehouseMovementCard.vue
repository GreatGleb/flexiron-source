<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseMovementCard } from '@/composables/useWarehouseMovementCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import '@styles/admin/warehouse_list.css'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'

const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string
const { movement, loading, error, load, tf, auditLog, auditLoading, deleteAuditEntry } =
  useWarehouseMovementCard(id)

const showAuditDeleteModal = ref(false)
const auditDeleteIndex = ref<number | null>(null)
const deletingAudit = ref(false)

const pageTitle = computed(() =>
  movement.value
    ? t('warehouse.movement_card_title', {
        id: movement.value.id,
        productName: tf(movement.value.productName),
      })
    : t('warehouse.header_title'),
)

function onAuditDeleteClick(index: number) {
  auditDeleteIndex.value = index
  showAuditDeleteModal.value = true
}

async function onAuditDeleteConfirm() {
  if (auditDeleteIndex.value === null || deletingAudit.value) return
  deletingAudit.value = true
  await deleteAuditEntry(auditDeleteIndex.value)
  showAuditDeleteModal.value = false
  auditDeleteIndex.value = null
  deletingAudit.value = false
}

/**
 * Known enum-like codes that may appear in audit oldValue/newValue.
 * Each entry maps a code prefix to the set of known values for that prefix.
 * The function tries each prefix; if the value is found in the set, it
 * returns the translated label via t(`warehouse.${prefix}${value}`).
 * If no prefix matches, the raw value is returned unchanged.
 */
const AUDIT_ENUM_MAP: Record<string, string[]> = {
  deficit_status_: ['open', 'in_progress', 'ordered', 'resolved', 'cancelled'],
  deficit_priority_: ['low', 'medium', 'high', 'critical'],
  offcut_status_: [
    'available',
    'reserved',
    'in_production',
    'sold',
    'scrapped',
    'expensed',
    'returned_to_supplier',
    'in_storage',
  ],
  movement_type_: ['receipt', 'expense', 'transfer', 'write_off', 'return', 'inbound', 'outbound'],
  batch_status_: [
    'active',
    'completed',
    'expired',
    'archived',
    'partial',
    'available',
    'reserved',
    'depleted',
    'quarantine',
  ],
  status_: [
    'available',
    'reserved',
    'partial',
    'depleted',
    'quarantine',
    'used',
    'scrap',
    'open',
    'in_progress',
    'ordered',
    'resolved',
    'cancelled',
  ],
}

function translateAuditValue(value: string): string {
  for (const [prefix, codes] of Object.entries(AUDIT_ENUM_MAP)) {
    if (codes.includes(value)) {
      const translated = t(`warehouse.${prefix}${value}`)
      if (translated && translated !== `warehouse.${prefix}${value}`) {
        return translated
      }
    }
  }
  return value
}

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => pageTitle.value,
})

onMounted(load)

// ─── Auto-resize notes textarea ──────────────────────────────────────
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

watch(
  () => movement.value?.notes,
  () => {
    nextTick(autoResizeNotes)
  },
)
</script>

<template>
  <!-- Error / Not found state (like ProductCardPage) -->
  <template v-if="error">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found" data-test="movement-card-error">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link
        :to="{ name: 'admin-warehouse', params: { tab: 'movements' } }"
        class="btn btn-primary"
      >
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>

  <template v-else>
    <div class="page-movement-card" data-test="movement-card-page">
      <div v-if="movement" class="movement-card-header" data-test="movement-card-header">
        <Breadcrumb
          :items="[
            {
              label: t('warehouse.header_title'),
              to: { name: 'admin-warehouse', params: { tab: 'movements' } },
            },
            {
              label: t('warehouse.tab_movements'),
              to: { name: 'admin-warehouse', params: { tab: 'movements' } },
            },
            {
              label: t('warehouse.movement_card_title', {
                id: movement?.id ?? id,
                productName: movement ? tf(movement.productName) : '',
              }),
            },
          ]"
        />
        <div class="movement-card-header-row">
          <h1 class="page-title">
            {{
              t('warehouse.movement_card_title', {
                id: movement?.id ?? id,
                productName: movement ? tf(movement.productName) : '',
              })
            }}
            <router-link
              v-tooltip="t('warehouse.open_product_card')"
              :to="{ name: 'admin-product-card', params: { id: movement.productId } }"
              class="action-icon-btn"
              data-test="movement-card-product-link"
            >
              <SvgIcon name="external-link" :width="16" :height="16" />
            </router-link>
          </h1>
          <span v-if="movement" class="batch-status-wrapper">
            <span
              :class="[
                'pill',
                movement.type === 'expense'
                  ? 'pill-danger'
                  : movement.type === 'receipt'
                    ? 'pill-success'
                    : 'pill-info',
              ]"
              data-test="movement-card-type-pill"
            >
              {{ t(`warehouse.movement_type_${movement.type}`) }}
            </span>
            <span
              v-tooltip="t(`warehouse.movement_type_hint_${movement.type}`)"
              class="info-hint"
              data-test="movement-card-type-hint"
            >
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
          </span>
          <div
            class="entity-action-bar no-margin pos-static"
            data-test="movement-card-save-bar"
          ></div>
        </div>
      </div>

      <div v-if="movement || loading" class="main-card-content" data-test="movement-card-content">
        <!-- View mode: entity-card-grid with 3 columns -->
        <div class="entity-card-grid">
          <!-- Left column: batchNumber, productName, movementType -->
          <div class="entity-col-left">
            <GlassPanel :loading="loading" :skeleton-rows="3" data-test="movement-card-left-panel">
              <template v-if="movement">
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_batch') }}</span>
                    <span v-tooltip="t('warehouse.col_batch_hint')" class="info-hint">
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
                  <router-link
                    :to="{ name: 'admin-warehouse-batch', params: { id: movement.batchId } }"
                    class="batch-link-row"
                    data-test="field-batch-link"
                  >
                    <span>{{ t('warehouse.open_batch_card') }}</span>
                    <SvgIcon name="external-link" :width="14" :height="14" />
                  </router-link>
                  <input
                    :value="movement.batchNumber"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-batch-number"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div v-if="movement.offcutId" class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_offcut') }}</span>
                    <span v-tooltip="t('warehouse.col_offcut_hint')" class="info-hint">
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
                  <router-link
                    :to="{ name: 'admin-warehouse-offcut', params: { id: movement.offcutId } }"
                    class="batch-link-row"
                    data-test="field-offcut-link"
                  >
                    <span>{{ t('warehouse.open_offcut_card') }}</span>
                    <SvgIcon name="external-link" :width="14" :height="14" />
                  </router-link>
                  <input
                    :value="movement.offcutId"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-offcut-id"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_product') }}</span>
                    <span v-tooltip="t('warehouse.field_product_hint')" class="info-hint">
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
                    :value="tf(movement.productName)"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-product-name"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_movement_type') }}</span>
                    <span v-tooltip="t('warehouse.col_movement_type_hint')" class="info-hint">
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
                    :value="t(`warehouse.movement_type_${movement.type}`)"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-movement-type"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Center column: unitPrice, totalCost, referenceId, performedBy -->
          <div class="entity-col-center">
            <GlassPanel
              :loading="loading"
              :skeleton-rows="4"
              data-test="movement-card-center-panel"
            >
              <template v-if="movement">
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_unit_price') }}</span>
                    <span v-tooltip="t('warehouse.col_unit_price_hint')" class="info-hint">
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
                    :value="movement.unitPrice != null ? `${movement.unitPrice.toFixed(2)} €` : '—'"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-unit-price"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_total_cost') }}</span>
                    <span v-tooltip="t('warehouse.col_total_cost_hint')" class="info-hint">
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
                    :value="movement.totalCost != null ? `${movement.totalCost.toFixed(2)} €` : '—'"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-total-cost"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_reference') }}</span>
                    <span v-tooltip="t('warehouse.col_reference_hint')" class="info-hint">
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
                  <template
                    v-if="
                      movement.referenceType &&
                      movement.referenceType.startsWith('offcut_') &&
                      movement.referenceId
                    "
                  >
                    <router-link
                      :to="{ name: 'admin-warehouse-offcut', params: { id: movement.referenceId } }"
                      class="batch-link-row"
                      data-test="field-offcut-link"
                    >
                      <span>{{ t('warehouse.open_offcut_card') }}</span>
                      <SvgIcon name="external-link" :width="14" :height="14" />
                    </router-link>
                  </template>
                  <input
                    :value="movement.referenceId ?? '—'"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-reference"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_performed_by') }}</span>
                    <span v-tooltip="t('warehouse.col_performed_by_hint')" class="info-hint">
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
                    :value="movement.performedBy ?? '—'"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-performed-by"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
              </template>
            </GlassPanel>
          </div>

          <!-- Right column: quantity, unit, fromLocation, toLocation -->
          <div class="entity-col-right">
            <GlassPanel :loading="loading" :skeleton-rows="4" data-test="movement-card-right-panel">
              <template v-if="movement">
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.col_quantity') }}</span>
                    <span v-tooltip="t('warehouse.col_quantity_hint')" class="info-hint">
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
                    :value="`${movement.quantity} ${t(`warehouse.unit_${movement.unit}`)}`"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-quantity"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.field_unit') }}</span>
                    <span v-tooltip="t('warehouse.movement_field_unit_hint')" class="info-hint">
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
                    :value="t(`warehouse.unit_${movement.unit}`)"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-unit"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.field_from_location') }}</span>
                    <span
                      v-tooltip="t('warehouse.movement_field_from_location_hint')"
                      class="info-hint"
                    >
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
                    :value="movement.fromLocation ?? '—'"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-from-location"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
                <div class="input-group">
                  <label class="field-label">
                    <span>{{ t('warehouse.field_to_location') }}</span>
                    <span
                      v-tooltip="t('warehouse.movement_field_to_location_hint')"
                      class="info-hint"
                    >
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
                    :value="movement.toLocation ?? '—'"
                    class="glass-input"
                    type="text"
                    readonly
                    data-test="field-to-location"
                  />
                  <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
                </div>
              </template>
            </GlassPanel>
          </div>
        </div>

        <!-- FULL WIDTH: Notes -->
        <template v-if="movement">
          <GlassPanel :title="t('warehouse.field_notes')" data-test="movement-card-notes-section">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('warehouse.field_notes') }}</span>
                <span v-tooltip="t('warehouse.movement_field_notes_hint')" class="info-hint">
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
                ref="notesTextarea"
                :value="movement.notes ?? ''"
                class="glass-input batch-notes-input"
                readonly
                data-test="field-notes"
              />
              <span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
            </div>
          </GlassPanel>
        </template>

        <!-- FULL WIDTH: Audit section -->
        <div class="audit-panel-wide" data-test="movement-card-audit-section">
          <GlassPanel :title="t('warehouse.section_batch_audit')">
            <template v-if="auditLoading">
              <p class="text-muted">{{ t('warehouse.loading') }}</p>
            </template>
            <template v-else-if="auditLog.length === 0">
              <p class="text-muted">{{ t('warehouse.no_audit_entries') }}</p>
            </template>
            <template v-else>
              <table class="audit-log-table" data-test="movement-card-audit-table">
                <thead>
                  <tr>
                    <th>{{ t('warehouse.audit_col_date') }}</th>
                    <th>{{ t('warehouse.audit_col_user') }}</th>
                    <th>{{ t('warehouse.audit_col_property') }}</th>
                    <th>{{ t('warehouse.audit_col_old_value') }}</th>
                    <th>{{ t('warehouse.audit_col_new_value') }}</th>
                    <th class="audit-col-actions"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(entry, index) in auditLog"
                    :key="index"
                    data-test="movement-card-audit-row"
                  >
                    <td class="audit-log-ts">{{ entry.timestamp }}</td>
                    <td>
                      <div class="audit-log-user">
                        <div class="audit-log-avatar">{{ entry.userInitials }}</div>
                        <span>{{ tf(entry.user) }}</span>
                      </div>
                    </td>
                    <td>{{ tf(entry.property) }}</td>
                    <td>
                      <span class="audit-diff-old">{{ translateAuditValue(entry.oldValue) }}</span>
                    </td>
                    <td>
                      <span class="audit-diff-new">{{ translateAuditValue(entry.newValue) }}</span>
                    </td>
                    <td style="text-align: right">
                      <button
                        v-tooltip="t('btn.delete')"
                        type="button"
                        class="action-icon-btn action-danger"
                        data-test="movement-card-audit-delete-btn"
                        @click="onAuditDeleteClick(index)"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
          </GlassPanel>
        </div>
      </div>

      <!-- Audit delete confirmation modal -->
      <AppModal
        v-model="showAuditDeleteModal"
        :title="t('modal.confirm_delete')"
        size="small"
        data-test="movement-card-audit-delete-modal"
      >
        <p>{{ t('modal.delete_audit_warning') }}</p>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            data-test="movement-card-audit-modal-cancel"
            @click="showAuditDeleteModal = false"
          >
            {{ t('btn.cancel') }}
          </button>
          <button
            class="btn btn-danger"
            data-test="movement-card-audit-modal-confirm"
            @click="onAuditDeleteConfirm"
          >
            {{ t('btn.delete') }}
          </button>
        </template>
      </AppModal>
    </div>
  </template>
</template>
