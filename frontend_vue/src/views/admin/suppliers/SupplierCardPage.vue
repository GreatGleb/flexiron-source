<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { UploadedFile } from '@/services/uploadsService'
import AppModal from '@/components/admin/ui/AppModal.vue'
import SupplierFormSections from '@/components/admin/SupplierFormSections.vue'
import { useSupplierCard } from '@/composables/useSupplierCard'
import { deleteAuditEntry } from '@/services/suppliersService'
import { useToast } from '@/composables/useToast'
import { useHead } from '@/composables/useHead'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'
import '@styles/admin/supplier_card.css'

const { t } = useI18n()
const route = useRoute()
const toast = useToast()

const id = computed(() => String(route.params.id))
const { supplier, loading, saving, isDirty, load, save } = useSupplierCard(id.value)

useHead({
  title: () => `Flexiron — ${t('supplier.card_title')}`,
  description: () => t('supplier.card_title'),
})

const BCC_LOG_STATUS_PILL: Record<string, string> = {
  replied: 'pill-success',
  pending: 'pill-warning',
  sent: 'pill-info',
}

function onFilesUploaded(uploaded: UploadedFile[]) {
  if (!supplier.value) return
  for (const u of uploaded) {
    supplier.value.files.push({
      id: u.fileId,
      name: u.name,
      size: u.size,
      type: u.mime,
      uploadedAt: u.uploadedAt.slice(0, 10),
    })
  }
}

function removeFile(fileId: string) {
  if (!supplier.value) return
  supplier.value.files = supplier.value.files.filter((f) => f.id !== fileId)
}

// ─── Audit log entry deletion (with confirm modal) ───
const deleteAuditOpen = ref(false)
const auditToDeleteIdx = ref<number | null>(null)

function askDeleteAudit(index: number) {
  auditToDeleteIdx.value = index
  deleteAuditOpen.value = true
}

async function confirmDeleteAudit() {
  if (auditToDeleteIdx.value === null || !supplier.value) return
  const idx = auditToDeleteIdx.value
  try {
    // Quick-action: server-side delete applies immediately (no batched Save)
    await deleteAuditEntry(id.value, idx)
    supplier.value.auditLog.splice(idx, 1)
    toast.show(t('msg.audit_deleted'))
  } catch {
    toast.show(t('msg.status_error'), 'error')
  } finally {
    auditToDeleteIdx.value = null
    deleteAuditOpen.value = false
  }
}

async function handleSave() {
  try {
    await save()
    toast.show(t('msg.save_success'))
  } catch {
    toast.show(t('msg.status_error'), 'error')
  }
}

onMounted(load)
</script>

<template>
  <h1 class="page-title" data-test="supplier-card-title">{{ t('supplier.header_title') }}</h1>

  <div class="flex-end" style="margin-bottom: 32px">
    <div
      data-test="supplier-card-action-bar"
      class="entity-action-bar no-margin pos-static flex-group"
    >
      <router-link
        :to="{ name: 'admin-bcc-request', query: { supplier: id } }"
        class="btn btn-secondary"
        data-test="supplier-card-bcc-link"
      >
        <SvgIcon name="email" :width="18" :height="18" />
        <span>{{ t('btn.bcc_tool') }}</span>
      </router-link>
      <router-link
        :to="{ name: 'admin-supplier-config' }"
        class="btn btn-secondary"
        data-test="supplier-card-config-link"
      >
        <SvgIcon name="settings-gear" :width="18" :height="18" />
        <span>{{ t('btn.config_card') }}</span>
      </router-link>
      <button
        class="btn btn-save"
        :class="{ dirty: isDirty, loading: saving }"
        :disabled="!isDirty || saving"
        data-test="supplier-card-save-btn"
        @click="handleSave"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{{ t('btn.save') }}</span>
      </button>
    </div>
  </div>

  <div v-if="loading && !supplier" class="main-card-content" data-test="supplier-card-loading">
    <div class="entity-card-grid">
      <div class="entity-col-left">
        <GlassPanel :title="t('sp.status_title')" :loading="true" :skeleton-rows="3" />
        <GlassPanel :title="t('sp.requisites')" :loading="true" :skeleton-rows="2" />
        <GlassPanel :title="t('sp.contact')" :loading="true" :skeleton-rows="2" />
      </div>
      <div class="entity-col-center">
        <GlassPanel :title="t('sp.procurement')" :loading="true" :skeleton-rows="3" />
        <GlassPanel :title="t('sp.notes_title')" :loading="true" :skeleton-rows="3" />
      </div>
      <div class="entity-col-right">
        <GlassPanel :title="t('sp.pricing_hist')" :loading="true" :skeleton-rows="5" />
        <GlassPanel :title="t('sp.files_title')" :loading="true" :skeleton-rows="2" />
      </div>
    </div>
  </div>

  <div v-else-if="supplier" class="main-card-content" data-test="supplier-card-content">
    <div class="entity-card-grid">
      <SupplierFormSections v-model="supplier" />

      <!-- RIGHT: Pricing + BCC Logs + Files -->
      <div class="entity-col-right">
        <GlassPanel :title="t('sp.pricing_hist')" data-test="supplier-card-pricing">
          <template #header>
            <router-link
              :to="{ name: 'admin-bcc-request', query: { supplier: id } }"
              class="nav-btn"
              style="
                width: auto;
                padding: 0 10px;
                font-size: 10px;
                height: 22px;
                gap: 5px;
                opacity: 0.8;
                background: rgba(24, 144, 255, 0.1);
                border-color: rgba(24, 144, 255, 0.2);
                margin-left: auto;
                text-decoration: none;
              "
            >
              <SvgIcon name="email" :width="10" :height="10" stroke-width="3" />
              <span>{{ t('btn.bcc_tool') }}</span>
            </router-link>
          </template>
          <div class="table-responsive">
            <table class="history-table" data-test="supplier-card-pricing-table">
              <thead>
                <tr>
                  <th style="width: 60px; padding: 4px 0">{{ t('th.date') }}</th>
                  <th style="padding: 4px 0">{{ t('th.product') }}</th>
                  <th style="padding: 4px 0">{{ t('th.stock') }}</th>
                  <th style="padding: 4px 0">{{ t('th.price') }}</th>
                  <th style="padding: 4px 0">{{ t('th.unit') }}</th>
                  <th style="padding: 4px 0">{{ t('th.source') }}</th>
                  <th style="padding: 4px 0">{{ t('th.status') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(p, i) in supplier.priceHistory"
                  :key="i"
                  data-test="supplier-card-pricing-row"
                >
                  <td>
                    <span class="audit-log-ts">{{ p.date }}</span>
                  </td>
                  <td class="product-cell">{{ p.product }}</td>
                  <td class="stock-cell">
                    <strong>{{ p.stock }}</strong>
                  </td>
                  <td class="price-cell">{{ p.price !== null ? p.price.toFixed(2) : '—' }}</td>
                  <td class="unit-cell">{{ p.unit ?? '—' }}</td>
                  <td class="log-source-cell">{{ p.source }}</td>
                  <td class="log-status-cell">
                    <span
                      :class="['status-pill', BCC_LOG_STATUS_PILL[p.status]]"
                      style="font-size: 9px"
                    >
                      {{ t(`st.${p.status}`) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>

        <GlassPanel :title="t('sp.files_title')" data-test="supplier-card-files">
          <div class="file-list" data-test="supplier-card-file-list" style="margin-bottom: 15px">
            <FileItem
              v-for="f in supplier.files"
              :key="f.id"
              :name="f.name"
              download-url="#"
              data-test="supplier-card-file-item"
              @delete="removeFile(f.id)"
            />
          </div>
          <DropZone
            data-test="supplier-card-file-dropzone"
            :hint="t('sp.dropzone_hint')"
            :multiple="true"
            @uploaded="onFilesUploaded"
          />
        </GlassPanel>
      </div>
    </div>

    <!-- FULL WIDTH: Audit History -->
    <div class="audit-panel-wide" data-test="supplier-card-audit">
      <GlassPanel :title="t('sp.audit')">
        <div class="table-responsive">
          <table class="audit-log-table" data-test="supplier-card-audit-table">
            <thead>
              <tr>
                <th>{{ t('th.timestamp') }}</th>
                <th>{{ t('th.user') }}</th>
                <th>{{ t('th.prop') }}</th>
                <th>{{ t('th.diff') }}</th>
                <th style="width: 40px" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="(a, i) in supplier.auditLog" :key="i" data-test="supplier-card-audit-row">
                <td class="audit-log-ts">{{ a.timestamp }}</td>
                <td>
                  <div class="audit-log-user">
                    <div class="audit-log-avatar">{{ a.userInitials }}</div>
                    <span>{{ a.user }}</span>
                  </div>
                </td>
                <td>{{ a.property }}</td>
                <td>
                  <span class="audit-diff-old">{{ a.oldValue }}</span>
                  &nbsp;→&nbsp;
                  <span class="audit-diff-new">{{ a.newValue }}</span>
                </td>
                <td style="text-align: right">
                  <button
                    v-tooltip="t('btn.delete')"
                    type="button"
                    class="action-icon-btn action-danger"
                    data-test="supplier-card-audit-delete-btn"
                    @click="askDeleteAudit(i)"
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
        </div>
      </GlassPanel>
    </div>
  </div>

  <AppModal
    v-model="deleteAuditOpen"
    :title="t('modal.confirm_delete')"
    size="small"
    data-test="supplier-card-audit-modal"
  >
    <p>{{ t('modal.delete_audit_warning') }}</p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-audit-modal-cancel"
        @click="deleteAuditOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        data-test="supplier-card-audit-modal-confirm"
        @click="confirmDeleteAudit"
      >
        {{ t('btn.delete') }}
      </button>
    </template>
  </AppModal>
</template>
