<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import FinanceSubNav from './FinanceSubNav.vue'
import FileItem from '@/components/admin/FileItem.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import { getPayment, patchPayment, addPaymentDocument, removePaymentDocument } from '@/services/financeService'
import { uploadFile, type UploadedFile } from '@/services/uploadsService'
import { useHead } from '@/composables/useHead'
import type { FinancePayment, PaymentDocument } from '@/types/finance'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_status-pills.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const payment = ref<FinancePayment | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref(false)
const notesDraft = ref('')

// Tracks document changes that haven't been saved yet
const pendingUploads = ref<PaymentDocument[]>([])
const pendingDeletes = ref<string[]>([])

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
  const hasPendingUploads = pendingUploads.value.length > 0
  const hasPendingDeletes = pendingDeletes.value.length > 0
  return notesChanged || hasPendingUploads || hasPendingDeletes
})

function load() {
  loading.value = true
  error.value = false
  getPayment(route.params.id as string)
    .then((res) => {
      payment.value = res
      notesDraft.value = res.notes ?? ''
      pendingUploads.value = []
      pendingDeletes.value = []
    })
    .catch(() => { error.value = true })
    .finally(() => { loading.value = false })
}

async function saveChanges() {
  if (!payment.value || !isDirty.value) return
  saving.value = true
  try {
    // 1. Save notes — only update notes field, don't replace entire payment
    const updated = await patchPayment(payment.value.id, { notes: notesDraft.value || null })
    payment.value.notes = updated.notes
    notesDraft.value = updated.notes ?? ''

    // 2. Process pending uploads
    for (const doc of pendingUploads.value) {
      try {
        await addPaymentDocument(payment.value.id, doc)
      } catch {
        // Revert — remove from local array
        const idx = payment.value.documents.findIndex((d) => d.id === doc.id)
        if (idx !== -1) payment.value.documents.splice(idx, 1)
      }
    }

    // 3. Process pending deletes
    for (const docId of pendingDeletes.value) {
      try {
        await removePaymentDocument(payment.value.id, docId)
      } catch {
        // Revert — reload to get consistent server state
        load()
        return
      }
    }

    // 4. Clear pending state
    pendingUploads.value = []
    pendingDeletes.value = []
  } catch {
    // Error handled by service
  } finally {
    saving.value = false
  }
}

function confirmDeleteDocument(docId: string) {
  if (!payment.value) return
  const docIndex = payment.value.documents.findIndex((d) => d.id === docId)
  if (docIndex === -1) return
  const removed = payment.value.documents.splice(docIndex, 1)[0]
  if (!removed) return

  // If this doc was just uploaded (not yet saved), remove from pendingUploads instead
  const uploadIdx = pendingUploads.value.findIndex((d) => d.id === docId)
  if (uploadIdx !== -1) {
    pendingUploads.value.splice(uploadIdx, 1)
    return
  }

  // Otherwise track for deletion on save
  pendingDeletes.value.push(docId)
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
    // Add to local state immediately
    payment.value.documents.push(newDoc)
    // Track for persistence on save
    pendingUploads.value.push(newDoc)
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
        @click="saveChanges"
        data-test="payment-card-save-btn"
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
              <div class="glass-input" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px;">
                <span class="status-pill" :class="STATUS_PILL[payment.status]" data-test="payment-field-status">
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
    <GlassPanel :title="t('financePayment.section_documents')" data-test="payment-documents-section">
      <template v-if="payment">
        <div v-if="payment.documents.length === 0" class="text-muted" style="padding: 12px 0;">
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
          :hint="t('financePayment.document_upload_hint') || 'Перетащите файлы сюда или нажмите для выбора'"
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
