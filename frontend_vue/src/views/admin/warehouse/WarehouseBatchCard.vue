<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseBatch } from '@/composables/useWarehouseBatch'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'

const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string
const {
  batch, loading, saving, error,
  form, isAnythingDirty,
  movements, movementsLoading,
  offcuts, offcutsLoading,
  load, save, discard, remove,
  tf,
} = useWarehouseBatch(id)

const isEditing = ref(false)
const showDeleteModal = ref(false)

const BATCH_STATUS_PILL: Record<string, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  partial: 'pill-warning',
  depleted: 'pill-muted',
  quarantine: 'pill-danger',
}

function onSave() {
  save().then(() => {
    isEditing.value = false
  })
}

function onDiscard() {
  discard()
  isEditing.value = false
}

function onDeleteConfirm() {
  showDeleteModal.value = false
  remove()
}

useHead({
  title: () => `Flexiron — ${t('warehouse.batch_card_title', { batchNumber: batch.value?.batchNumber ?? '...' })}`,
  description: () => t('warehouse.batch_card_title', { batchNumber: batch.value?.batchNumber ?? '...' }),
})

onMounted(load)
</script>

<template>
  <div class="page-batch-card" data-test="page-batch-card">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        { label: batch ? tf(batch.productName) : '...' },
      ]"
    />

    <GlassPanel :loading="loading" :skeleton-rows="12" data-test="batch-card-panel">
      <!-- Error state -->
      <div v-if="error" class="error-state" data-test="batch-card-error">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>

      <div v-else-if="batch" class="batch-card-content" data-test="batch-card-content">
        <!-- Header: title + status pill + mode toggle -->
        <div class="batch-card-header">
          <h1 class="page-title">{{ tf(batch.productName) }}</h1>
          <span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]">
            {{ t(`warehouse.batch_status_${batch.status}`) }}
          </span>
          <div class="batch-card-mode-toggle">
            <!-- View mode: Edit + Delete buttons -->
            <template v-if="!isEditing">
              <button
                class="btn btn-ghost"
                data-test="batch-card-edit-btn"
                @click="isEditing = true"
              >
                <SvgIcon name="edit" :width="16" :height="16" />
                {{ t('warehouse.btn_edit_batch') }}
              </button>
              <button
                class="btn btn-ghost btn-danger"
                data-test="batch-card-delete-btn"
                @click="showDeleteModal = true"
              >
                <SvgIcon name="trash-2" :width="16" :height="16" />
                {{ t('warehouse.btn_delete_batch') }}
              </button>
            </template>
            <!-- Edit mode: Save + Discard buttons -->
            <template v-else>
              <button
                class="btn btn-primary"
                :disabled="saving || !isAnythingDirty"
                data-test="batch-card-save-btn"
                @click="onSave"
              >
                <SvgIcon name="check" :width="16" :height="16" />
                {{ saving ? t('warehouse.btn_save') + '...' : t('warehouse.btn_save') }}
              </button>
              <button
                class="btn btn-ghost"
                :disabled="saving"
                data-test="batch-card-discard-btn"
                @click="onDiscard"
              >
                <SvgIcon name="x" :width="16" :height="16" />
                {{ t('warehouse.btn_discard_changes') }}
              </button>
            </template>
          </div>
        </div>

        <!-- View mode: grid of sections -->
        <template v-if="!isEditing">
          <div class="batch-card-grid">
            <!-- Batch info section -->
            <div class="batch-card-section">
              <h3>{{ t('warehouse.section_batch_info') }}</h3>
              <dl class="batch-card-dl">
                <dt>{{ t('warehouse.col_batch_number') }}</dt>
                <dd><code>{{ batch.batchNumber }}</code></dd>
                <dt>{{ t('warehouse.col_lot_code') }}</dt>
                <dd><code>{{ batch.lotCode }}</code></dd>
                <dt>{{ t('warehouse.col_supplier') }}</dt>
                <dd>{{ batch.supplierName ? tf(batch.supplierName) : '—' }}</dd>
                <dt>{{ t('warehouse.col_location') }}</dt>
                <dd>{{ batch.location ?? '—' }}</dd>
              </dl>
            </div>

            <!-- Quantities section -->
            <div class="batch-card-section">
              <h3>{{ t('warehouse.batch_section_quantities') }}</h3>
              <dl class="batch-card-dl">
                <dt>{{ t('warehouse.col_quantity') }}</dt>
                <dd>{{ batch.quantity }} {{ t(`warehouse.unit_${batch.unit}`) }}</dd>
                <dt>{{ t('warehouse.col_remaining') }}</dt>
                <dd :class="{ 'text-danger': batch.quantityRemaining <= 0 }">
                  {{ batch.quantityRemaining }} {{ t(`warehouse.unit_${batch.unit}`) }}
                </dd>
                <dt>{{ t('warehouse.col_unit_price') }}</dt>
                <dd>{{ batch.unitPrice.toFixed(2) }} €</dd>
                <dt>{{ t('warehouse.field_total_cost') }}</dt>
                <dd>{{ batch.totalCost.toFixed(2) }} €</dd>
              </dl>
            </div>

            <!-- Dates section -->
            <div class="batch-card-section">
              <h3>{{ t('warehouse.batch_section_dates') }}</h3>
              <dl class="batch-card-dl">
                <dt>{{ t('warehouse.col_received') }}</dt>
                <dd>{{ batch.receivedAt.slice(0, 10) }}</dd>
                <dt>{{ t('warehouse.field_expires_at') }}</dt>
                <dd>{{ batch.expiresAt ? batch.expiresAt.slice(0, 10) : '—' }}</dd>
                <dt>{{ t('warehouse.field_certificate') }}</dt>
                <dd>{{ batch.certificateRef ?? '—' }}</dd>
              </dl>
            </div>

            <!-- Notes section (full width) -->
            <div v-if="batch.notes" class="batch-card-section batch-card-section-full">
              <h3>{{ t('warehouse.field_notes') }}</h3>
              <p class="batch-notes">{{ batch.notes }}</p>
            </div>
          </div>
        </template>

        <!-- Edit mode: form -->
        <div v-else class="batch-card-edit-form" data-test="batch-card-form">
          <div class="batch-card-form-row">
            <label for="edit-batch-number">{{ t('warehouse.field_batch_number') }}</label>
            <input
              id="edit-batch-number"
              v-model="form.batchNumber"
              type="text"
            />
          </div>
          <div class="batch-card-form-row">
            <label for="edit-lot-code">{{ t('warehouse.field_lot_code') }}</label>
            <input
              id="edit-lot-code"
              v-model="form.lotCode"
              type="text"
            />
          </div>
          <div class="batch-card-form-row">
            <label for="edit-quantity">{{ t('warehouse.col_quantity') }}</label>
            <input
              id="edit-quantity"
              v-model.number="form.quantity"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
          <div class="batch-card-form-row">
            <label for="edit-unit-price">{{ t('warehouse.col_unit_price') }}</label>
            <input
              id="edit-unit-price"
              v-model.number="form.unitPrice"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
          <div class="batch-card-form-row">
            <label for="edit-location">{{ t('warehouse.col_location') }}</label>
            <input
              id="edit-location"
              v-model="form.location"
              type="text"
            />
          </div>
          <div class="batch-card-form-row">
            <label for="edit-certificate">{{ t('warehouse.field_certificate') }}</label>
            <input
              id="edit-certificate"
              v-model="form.certificateRef"
              type="text"
            />
          </div>
          <div class="batch-card-form-row">
            <label for="edit-status">{{ t('warehouse.col_status') }}</label>
            <select id="edit-status" v-model="form.status">
              <option value="available">{{ t('warehouse.batch_status_available') }}</option>
              <option value="reserved">{{ t('warehouse.batch_status_reserved') }}</option>
              <option value="partial">{{ t('warehouse.batch_status_partial') }}</option>
              <option value="depleted">{{ t('warehouse.batch_status_depleted') }}</option>
              <option value="quarantine">{{ t('warehouse.batch_status_quarantine') }}</option>
            </select>
          </div>
          <div class="batch-card-form-row">
            <label for="edit-notes">{{ t('warehouse.field_notes') }}</label>
            <textarea
              id="edit-notes"
              v-model="form.notes"
            />
          </div>
        </div>

        <!-- Movements section -->
        <div class="batch-card-section batch-card-section-full" data-test="batch-card-movements-section">
          <h3>{{ t('warehouse.section_batch_movements') }}</h3>
          <div v-if="movementsLoading" class="text-muted" style="padding: 12px 0;">
            {{ t('btn.loading') }}...
          </div>
          <table v-else-if="movements.length" class="batch-card-mini-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_date') }}</th>
                <th>{{ t('warehouse.col_type') }}</th>
                <th>{{ t('warehouse.col_quantity') }}</th>
                <th>{{ t('warehouse.col_reference') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="movement in movements" :key="movement.id">
                <td>{{ movement.movedAt.slice(0, 10) }}</td>
                <td>{{ t(`warehouse.movement_type_${movement.type}`) }}</td>
                <td>{{ movement.quantity }} {{ t(`warehouse.unit_${movement.unit}`) }}</td>
                <td>{{ movement.referenceId ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-muted" style="padding: 12px 0;">{{ t('warehouse.empty_movements') }}</p>
        </div>

        <!-- Offcuts section -->
        <div class="batch-card-section batch-card-section-full" data-test="batch-card-offcuts-section">
          <h3>{{ t('warehouse.section_batch_offcuts') }}</h3>
          <div v-if="offcutsLoading" class="text-muted" style="padding: 12px 0;">
            {{ t('btn.loading') }}...
          </div>
          <table v-else-if="offcuts.length" class="batch-card-mini-table">
            <thead>
              <tr>
                <th>{{ t('warehouse.col_dimensions') }}</th>
                <th>{{ t('warehouse.col_weight') }}</th>
                <th>{{ t('warehouse.col_quantity') }}</th>
                <th>{{ t('warehouse.col_status') }}</th>
                <th>{{ t('warehouse.col_location') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="offcut in offcuts" :key="offcut.id">
                <td>
                  <template v-if="offcut.lengthMm && offcut.widthMm">
                    {{ offcut.lengthMm }} × {{ offcut.widthMm }} мм
                  </template>
                  <span v-else>—</span>
                </td>
                <td>{{ offcut.weightKg ?? '—' }} кг</td>
                <td>{{ offcut.quantity }} {{ t(`warehouse.unit_${offcut.unit}`) }}</td>
                <td>
                  <span class="pill pill-sm" :class="`pill-${offcut.status}`">
                    {{ t(`warehouse.offcut_status_${offcut.status}`) }}
                  </span>
                </td>
                <td>{{ offcut.location ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-muted" style="padding: 12px 0;">{{ t('warehouse.empty_offcuts') }}</p>
        </div>

        <!-- Files section -->
        <div class="batch-card-section batch-card-section-full" data-test="batch-card-files-section">
          <h3>{{ t('warehouse.section_batch_files') }}</h3>
          <div class="batch-card-files">
            <p>{{ t('warehouse.no_files') }}</p>
            <p class="text-muted">{{ t('warehouse.files_coming_soon') }}</p>
          </div>
        </div>

        <!-- Audit section -->
        <div class="batch-card-section batch-card-section-full" data-test="batch-card-audit-section">
          <h3>{{ t('warehouse.section_batch_audit') }}</h3>
          <dl class="batch-card-audit">
            <dt>{{ t('warehouse.field_created_at') }}</dt>
            <dd>{{ batch.createdAt ? batch.createdAt.slice(0, 19).replace('T', ' ') : '—' }}</dd>
            <dt>{{ t('warehouse.field_updated_at') }}</dt>
            <dd>{{ batch.updatedAt ? batch.updatedAt.slice(0, 19).replace('T', ' ') : '—' }}</dd>
          </dl>
        </div>

        <!-- Back button -->
        <div class="batch-card-actions">
          <button class="btn btn-ghost" @click="$router.back()">
            <SvgIcon name="arrow-left" :width="18" :height="18" />
            {{ t('btn.back') }}
          </button>
        </div>
      </div>
    </GlassPanel>

    <!-- Delete confirmation modal -->
    <AppModal
      v-model="showDeleteModal"
      :title="t('warehouse.delete_title')"
      size="small"
      data-test="batch-card-delete-modal"
    >
      <p>{{ t('warehouse.confirm_delete_batch') }}</p>
      <template #footer>
        <button
          class="btn btn-ghost"
          :disabled="saving"
          @click="showDeleteModal = false"
        >
          {{ t('warehouse.btn_cancel') }}
        </button>
        <button
          class="btn btn-danger"
          :disabled="saving"
          @click="onDeleteConfirm"
        >
          {{ saving ? t('warehouse.btn_delete') + '...' : t('warehouse.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
