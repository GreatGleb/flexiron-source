<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import FinanceSubNav from './FinanceSubNav.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import { getPayment, patchPayment } from '@/services/financeService'
import type { UploadedFile } from '@/services/uploadsService'
import { useHead } from '@/composables/useHead'
import type { FinancePayment, PaymentDocument } from '@/types/finance'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_status-pills.css'

const { t } = useI18n()
const route = useRoute()

const payment = ref<FinancePayment | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref(false)
const notesDraft = ref('')

useHead({
  title: () => `Flexiron — ${t('financePayment.header')}`,
  description: () => t('financePayment.header'),
})

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-warning',
  completed: 'pill-success',
  overdue: 'pill-danger',
  cancelled: 'pill-suspended',
}

const isDirty = computed(() => {
  const notesChanged = notesDraft.value !== (payment.value?.notes ?? '')
  // File changes are tracked by comparing current fileIds vs original
  const originalFileIds =
    payment.value?.documents
      .map((d) => d.fileId)
      .sort()
      .join(',') ?? ''
  const currentFileIds = [...documentFileIds.value].sort().join(',')
  const filesChanged = originalFileIds !== currentFileIds
  return notesChanged || filesChanged
})

/** Reactive snapshot of current document fileIds for dirty tracking */
const documentFileIds = computed(() => payment.value?.documents.map((d) => d.fileId) ?? [])

function load() {
  loading.value = true
  error.value = false
  getPayment(route.params.id as string)
    .then((res) => {
      payment.value = res
      notesDraft.value = res.notes ?? ''
    })
    .catch(() => {
      error.value = true
    })
    .finally(() => {
      loading.value = false
    })
}

async function saveChanges() {
  if (!payment.value || !isDirty.value) return
  saving.value = true
  try {
    // Single PATCH with notes + fileIds (replace-semantics for docs)
    const updated = await patchPayment(payment.value.id, {
      notes: notesDraft.value || null,
      fileIds: payment.value.documents.map((d) => d.fileId),
    })
    payment.value = updated
    notesDraft.value = updated.notes ?? ''
  } catch {
    load() // Reload to get consistent server state
  } finally {
    saving.value = false
  }
}

function confirmDeleteDocument(docId: string) {
  if (!payment.value) return
  const docIndex = payment.value.documents.findIndex((d) => d.id === docId)
  if (docIndex === -1) return
  payment.value.documents.splice(docIndex, 1)
}

function onFilesUploaded(uploaded: UploadedFile[]) {
  if (!payment.value) return
  for (const u of uploaded) {
    const newDoc: PaymentDocument = {
      id: u.fileId,
      name: u.name,
      fileId: u.fileId,
      url: u.url,
      size: u.size,
      mime: u.mime,
      uploadedAt: u.uploadedAt,
    }
    payment.value.documents.push(newDoc)
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

onMounted(() => load())
</script>

<template>
  <h1 class="page-title" data-test="finance-payment-card-title">
    {{ t('financePayment.header') }}: {{ payment?.paymentNumber ?? '' }}
  </h1>

  <FinanceSubNav />

  <!-- ─── Error State ─── -->
  <template v-if="error">
    <div class="entity-not-found" data-test="payment-card-error">
      <SvgIcon name="alert-triangle" :width="48" :height="48" />
      <h2>{{ t('common.error_title') }}</h2>
      <p>{{ t('common.error_description') }}</p>
      <button class="btn btn-primary" @click="load">
        {{ t('common.error_btn') }}
      </button>
    </div>
  </template>

  <template v-else-if="payment">
    <!-- ─── Action Bar ─── -->
    <div class="entity-action-bar no-margin pos-static" data-test="payment-card-action-bar">
      <button
        class="btn btn-save"
        :class="{ dirty: isDirty, loading: saving }"
        :disabled="!isDirty || saving"
        data-test="payment-card-save-btn"
        @click="saveChanges"
      >
        <SvgIcon v-if="!saving" name="save-floppy" :width="16" :height="16" />
        {{ saving ? t('financePayment.saving') || 'Сохранение...' : t('financePayment.btn_save') }}
      </button>
    </div>

    <!-- ─── 3-Column Entity Card Grid ─── -->
    <div class="entity-card-grid">
      <!-- LEFT: Counterparty, status, description -->
      <div class="entity-col-left">
        <GlassPanel :loading="loading" :skeleton-rows="4" data-test="payment-card-left-panel">
          <template v-if="payment">
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.payment_number') }}</label>
              <input
                class="glass-input"
                :value="payment.paymentNumber"
                type="text"
                readonly
                data-test="payment-field-number"
              />
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.status') }}</label>
              <div
                class="glass-input"
                style="display: flex; align-items: center; gap: 8px; padding: 6px 12px"
              >
                <span
                  class="status-pill"
                  :class="STATUS_PILL[payment.status]"
                  data-test="payment-field-status"
                >
                  {{ t(`financeList.status_${payment.status}`) }}
                </span>
              </div>
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.counterparty') }}</label>
              <input
                class="glass-input"
                :value="payment.counterpartyName"
                type="text"
                readonly
                data-test="payment-field-counterparty"
              />
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.description') }}</label>
              <input
                class="glass-input"
                :value="payment.description ?? '—'"
                type="text"
                readonly
                data-test="payment-field-description"
              />
            </div>
          </template>
        </GlassPanel>
      </div>

      <!-- CENTER: Amount, dates, linked order -->
      <div class="entity-col-center">
        <GlassPanel :loading="loading" :skeleton-rows="4" data-test="payment-card-center-panel">
          <template v-if="payment">
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.amount') }}</label>
              <input
                class="glass-input"
                :value="`${payment.amount.toFixed(2)} ${payment.currency}`"
                type="text"
                readonly
                data-test="payment-field-amount"
              />
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.due_date') }}</label>
              <input
                class="glass-input"
                :value="formatDate(payment.dueDate)"
                type="text"
                readonly
                data-test="payment-field-due-date"
              />
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.paid_at') }}</label>
              <input
                class="glass-input"
                :value="formatDate(payment.paidAt)"
                type="text"
                readonly
                data-test="payment-field-paid-at"
              />
            </div>
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.linked_order') }}</label>
              <input
                class="glass-input"
                :value="payment.orderNumber ?? '—'"
                type="text"
                readonly
                data-test="payment-field-order"
              />
            </div>
          </template>
        </GlassPanel>
      </div>

      <!-- RIGHT: Notes (always editable) -->
      <div class="entity-col-right">
        <GlassPanel :loading="loading" :skeleton-rows="2" data-test="payment-card-right-panel">
          <template v-if="payment">
            <div class="input-group">
              <label class="field-label">{{ t('financePayment.section_notes') }}</label>
              <textarea
                v-model="notesDraft"
                class="glass-input"
                rows="4"
                data-test="payment-notes-input"
              />
            </div>
          </template>
        </GlassPanel>
      </div>
    </div>

    <!-- ─── Documents Section (full width) ─── -->
    <GlassPanel
      :title="t('financePayment.section_documents')"
      data-test="payment-documents-section"
    >
      <template v-if="payment">
        <div v-if="payment.documents.length === 0" class="text-muted" style="padding: 12px 0">
          <p>{{ t('financePayment.no_documents') }}</p>
        </div>
        <div v-else class="file-list" data-test="payment-document-list">
          <FileItem
            v-for="doc in payment.documents"
            :key="doc.id"
            :name="`${doc.name} — ${formatSize(doc.size)}`"
            :download-url="doc.url"
            data-test="payment-document-item"
            @delete="confirmDeleteDocument(doc.id)"
          />
        </div>
        <DropZone
          data-test="payment-document-dropzone"
          :hint="
            t('financePayment.document_upload_hint') ||
            'Перетащите файлы сюда или нажмите для выбора'
          "
          :multiple="true"
          @uploaded="onFilesUploaded"
        />
      </template>
    </GlassPanel>
  </template>
</template>

<style scoped>
.text-muted {
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.875rem;
}
.text-muted p {
  margin: 0;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
