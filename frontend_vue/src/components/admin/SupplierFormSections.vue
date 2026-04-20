<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import NoteItem from '@/components/admin/NoteItem.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import TagInput from '@/components/admin/ui/TagInput.vue'
import RatingSelect from '@/components/admin/ui/RatingSelect.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import type { SupplierCardData, SupplierStatus } from '@/types/supplier'

const { t } = useI18n()

const supplier = defineModel<SupplierCardData>({ required: true })

const STATUS_OPTIONS: { value: SupplierStatus; labelKey: string; pill: string }[] = [
  { value: 'active', labelKey: 'st.active', pill: 'pill-success' },
  { value: 'preferred', labelKey: 'st.preferred', pill: 'pill-info' },
  { value: 'new', labelKey: 'st.new', pill: 'pill-mint' },
  { value: 'under_review', labelKey: 'st.review', pill: 'pill-warning' },
  { value: 'suspended', labelKey: 'st.suspended', pill: 'pill-suspended' },
  { value: 'blocked', labelKey: 'st.blocked', pill: 'pill-danger' },
]

const statusSelectOptions = computed(() =>
  STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
)

const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'PLN', label: 'PLN' },
  { value: 'GBP', label: 'GBP' },
]

const PAYMENT_OPTIONS = [
  { value: '30 Days Net', label: '30 Days Net' },
  { value: 'Prepayment 100%', label: 'Prepayment 100%' },
  { value: '50/50 Terms', label: '50/50 Terms' },
]

const CATEGORY_OPTIONS = [
  'Sheets',
  'Pipes',
  'Beams',
  'Rebars',
  'Lintels',
  'Profiles',
  'Wire',
  'Fittings',
  'Hot-rolled Sheets',
  'Cold-rolled Sheets',
  'Seamless Pipes',
  'I-Beams',
  'Channels (U-bars)',
  'Stainless Plates',
  'Rebars A500C',
]

function statusPillFor(status: SupplierStatus): string {
  return STATUS_OPTIONS.find((o) => o.value === status)?.pill ?? 'pill-default'
}

const newNote = ref('')

function addNote() {
  if (!newNote.value.trim()) return
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  supplier.value.notes = supplier.value.notes
    ? `${stamp}\n${newNote.value}\n\n${supplier.value.notes}`
    : `${stamp}\n${newNote.value}`
  newNote.value = ''
}

function parsedNotes(): { date: string; text: string }[] {
  if (!supplier.value.notes) return []
  const blocks = supplier.value.notes.split(/\n\n+/)
  return blocks
    .map((block) => {
      const [first, ...rest] = block.split('\n')
      return { date: first ?? '', text: rest.join('\n') }
    })
    .filter((n) => n.text.trim())
}

function removeNoteAt(index: number) {
  const notes = parsedNotes()
  notes.splice(index, 1)
  supplier.value.notes = notes.map((n) => `${n.date}\n${n.text}`).join('\n\n')
}
</script>

<template>
  <!-- LEFT: Status + Requisites + Contact -->
  <div class="entity-col-left">
    <GlassPanel :title="t('sp.status_title')" data-test="supplier-form-status">
      <div class="input-group">
        <label class="field-label">{{ t('sp.status_label') }}</label>
        <CustomSelect
          v-model="supplier.status"
          :options="statusSelectOptions"
          data-test="supplier-form-status-select"
        >
          <template #selected="{ value }">
            <span :class="['status-pill', statusPillFor(value as SupplierStatus)]">
              {{ t(STATUS_OPTIONS.find((o) => o.value === value)!.labelKey) }}
            </span>
          </template>
          <template #option="{ option }">
            <span
              :class="['status-pill', STATUS_OPTIONS.find((o) => o.value === option.value)!.pill]"
            >
              {{ t(STATUS_OPTIONS.find((o) => o.value === option.value)!.labelKey) }}
            </span>
          </template>
        </CustomSelect>
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('sp.rating_label') }}</label>
        <RatingSelect v-model="supplier.rating" data-test="supplier-form-rating" />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('sp.status_reason') }}</label>
        <textarea
          v-model="supplier.statusReason"
          class="glass-input"
          rows="2"
          :placeholder="t('sp.status_placeholder')"
          style="font-size: 12px"
          data-test="supplier-form-status-reason"
        />
      </div>
      <div class="input-group" style="margin-bottom: 0">
        <label class="field-label">{{ t('sp.contract_date') }}</label>
        <DatePicker v-model="supplier.contractDate" data-test="supplier-form-contract-date" />
      </div>
    </GlassPanel>

    <GlassPanel :title="t('sp.requisites')" data-test="supplier-form-requisites">
      <div class="input-group">
        <label class="field-label">{{ t('sp.name') }}</label>
        <input
          v-model="supplier.company"
          type="text"
          class="glass-input"
          data-test="supplier-form-company"
        />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('sp.vat') }}</label>
        <input
          v-model="supplier.vatCode"
          type="text"
          class="glass-input"
          style="font-family: 'JetBrains Mono'"
          placeholder="LT100001234567"
          data-test="supplier-form-vat"
        />
      </div>
      <div v-if="supplier.addresses[0]" class="input-group" style="margin-bottom: 0">
        <label class="field-label">{{ t('sp.address') }}</label>
        <textarea
          v-model="supplier.addresses[0].line1"
          class="glass-input"
          rows="2"
          placeholder="Savanorių pr. 124, LT-03153 Vilnius, Lietuva"
          data-test="supplier-form-address"
        />
      </div>
    </GlassPanel>

    <GlassPanel :title="t('sp.contact')" data-test="supplier-form-contact">
      <div class="entity-contact-card">
        <div class="input-group">
          <label class="field-label">{{ t('sp.contact_name') }}</label>
          <input
            v-model="supplier.contactPerson"
            type="text"
            class="glass-input"
            data-test="supplier-form-contact-name"
          />
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 12px">
          <div class="input-group">
            <label class="field-label">{{ t('sp.contact_email') }}</label>
            <input
              v-model="supplier.email"
              type="email"
              class="glass-input"
              data-test="supplier-form-contact-email"
            />
          </div>
          <div class="input-group" style="margin-bottom: 0">
            <label class="field-label">{{ t('sp.contact_phone') }}</label>
            <input
              v-model="supplier.phone"
              type="text"
              class="glass-input"
              data-test="supplier-form-contact-phone"
            />
          </div>
        </div>
      </div>
    </GlassPanel>
  </div>

  <!-- CENTER: Procurement + Notes -->
  <div class="entity-col-center">
    <GlassPanel :title="t('sp.procurement')" data-test="supplier-form-procurement">
      <div class="input-group">
        <label class="field-label">{{ t('sp.spec') }}</label>
        <TagInput
          v-model="supplier.categories"
          :options="CATEGORY_OPTIONS"
          :placeholder="t('sp.spec_placeholder')"
          data-test="supplier-form-categories"
        />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('sp.bcc') }}</label>
        <TagInput
          v-model="supplier.bccEmails"
          :free-input="true"
          :placeholder="t('sp.bcc_placeholder')"
          data-test="supplier-form-bcc-emails"
        />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px">
        <div class="input-group">
          <label class="field-label">{{ t('sp.currency') }}</label>
          <CustomSelect
            v-model="supplier.currency"
            :options="CURRENCY_OPTIONS"
            data-test="supplier-form-currency"
          />
        </div>
        <div class="input-group">
          <label class="field-label">{{ t('sp.payment') }}</label>
          <CustomSelect
            v-model="supplier.paymentTerms"
            :options="PAYMENT_OPTIONS"
            data-test="supplier-form-payment"
          />
        </div>
        <div class="input-group">
          <label class="field-label">
            <span>{{ t('sp.lead') }}</span>
            <span class="info-hint" :data-tooltip="t('sp.lead_hint')">
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
            v-model.number="supplier.leadTime"
            type="number"
            class="glass-input"
            placeholder="14"
            data-test="supplier-form-lead-time"
          />
        </div>
        <div class="input-group">
          <label class="field-label">{{ t('sp.min') }}</label>
          <input
            v-model.number="supplier.minOrder"
            type="number"
            class="glass-input"
            placeholder="2500"
            data-test="supplier-form-min-order"
          />
        </div>
      </div>
    </GlassPanel>

    <GlassPanel :title="t('sp.notes_title')" data-test="supplier-form-notes">
      <div class="notes-input-area" style="margin-bottom: 20px">
        <textarea
          v-model="newNote"
          class="glass-input"
          rows="2"
          :placeholder="t('sp.notes_placeholder')"
          style="font-size: 12px; resize: vertical"
          data-test="supplier-form-notes-input"
        />
        <button class="btn-add-note" data-test="supplier-form-notes-add-btn" @click="addNote">
          {{ t('btn.add_note') }}
        </button>
      </div>
      <div>
        <NoteItem
          v-for="(n, i) in parsedNotes()"
          :key="i"
          :date="n.date"
          :text="n.text"
          data-test="supplier-form-note-item"
          @delete="removeNoteAt(i)"
        />
      </div>
    </GlassPanel>
  </div>
</template>
