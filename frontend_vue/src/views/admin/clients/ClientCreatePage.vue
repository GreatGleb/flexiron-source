<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useToast } from '@/composables/useToast'
import { createClient } from '@/services/clientsService'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import type { ClientFormData } from '@/types/client'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/client_card.css'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

useHead({
  title: () => `Flexiron — ${t('clients.create_title')}`,
  description: () => t('clients.create_title'),
})

const form = ref<ClientFormData>({
  name: '',
  companyCode: '',
  vatCode: '',
  address: '',
  phone: '',
  email: '',
  status: 'active',
  notes: '',
})

const errors = ref<{ name?: string }>({})
const saving = ref(false)

const STATUS_OPTIONS = [
  { value: 'active', label: t('clients.status_active') },
  { value: 'inactive', label: t('clients.status_inactive') },
]

function validate(): boolean {
  errors.value = {}
  if (!form.value.name.trim()) {
    errors.value.name = t('clients.validation_name_required')
    return false
  }
  return true
}

function clearError(field: 'name') {
  if (errors.value[field]) {
    const next = { ...errors.value }
    delete next[field]
    errors.value = next
  }
}

async function handleSave() {
  if (!validate()) {
    toast.error(t('clients.validation_name_required'))
    return
  }
  if (saving.value) return
  saving.value = true
  try {
    const created = await createClient(form.value)
    toast.success(t('clients.toast_created'))
    router.push({ name: 'admin-client-card', params: { id: created.id } })
  } catch {
    toast.error(t('clients.toast_error_create'))
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  router.push({ name: 'admin-clients' })
}
</script>

<template>
  <div class="page-client-card" data-test="client-create-page">
    <Breadcrumb
      :items="[
        { label: t('side.sales'), to: { name: 'admin-sales-crm' } },
        { label: t('clients.title'), to: { name: 'admin-clients' } },
        { label: t('clients.create_title') },
      ]"
    />

    <div class="client-card-header" data-test="client-create-header">
      <div class="client-card-header-row">
        <div class="client-card-header-left">
          <h1 class="page-title" data-test="client-create-title">{{ t('clients.create_title') }}</h1>
        </div>
        <div
          class="entity-action-bar no-margin pos-static"
          data-test="client-create-action-bar"
        >
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="saving"
            data-test="client-create-cancel-btn"
            @click="handleCancel"
          >
            {{ t('clients.btn_discard') }}
          </button>
          <button
            type="button"
            class="btn btn-save dirty"
            :class="{ loading: saving }"
            :disabled="saving"
            data-test="client-create-save-btn"
            @click="handleSave"
          >
            <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
            <span>{{ saving ? t('clients.btn_save') + '...' : t('clients.btn_create') }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="main-card-content" data-test="client-create-content">
      <div class="entity-card-grid">

        <!-- LEFT: General Information -->
        <div class="entity-col-left">
          <GlassPanel :title="t('clients.section_general')" data-test="client-create-general">
            <div class="input-group">
              <label class="field-label">
                <span>{{ t('clients.field_name') }} <span class="required-star">*</span></span>
                <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
              </label>
              <input
                v-model="form.name"
                class="glass-input"
                :class="{ 'has-error': errors.name }"
                type="text"
                @input="clearError('name')"
                data-test="field-name"
              />
            </div>

            <InputGroup :label="t('clients.field_company_code')">
              <input
                v-model="form.companyCode"
                class="glass-input"
                type="text"
                data-test="field-company-code"
              />
            </InputGroup>

            <InputGroup :label="t('clients.field_vat')">
              <input
                v-model="form.vatCode"
                class="glass-input"
                type="text"
                data-test="field-vat"
              />
            </InputGroup>

            <InputGroup :label="t('clients.field_notes')">
              <textarea
                v-model="form.notes"
                class="glass-input glass-textarea"
                rows="3"
                data-test="field-notes"
              />
            </InputGroup>
          </GlassPanel>
        </div>

        <!-- CENTER: Contact Information -->
        <div class="entity-col-center">
          <GlassPanel :title="t('clients.section_contact')" data-test="client-create-contact">
            <InputGroup :label="t('clients.field_address')">
              <input
                v-model="form.address"
                class="glass-input"
                type="text"
                data-test="field-address"
              />
            </InputGroup>

            <InputGroup :label="t('clients.field_phone')">
              <input
                v-model="form.phone"
                class="glass-input"
                type="text"
                data-test="field-phone"
              />
            </InputGroup>

            <InputGroup :label="t('clients.field_email')">
              <input
                v-model="form.email"
                class="glass-input"
                type="email"
                data-test="field-email"
              />
            </InputGroup>
          </GlassPanel>
        </div>

        <!-- RIGHT: Status -->
        <div class="entity-col-right">
          <GlassPanel :title="t('clients.field_status')" data-test="client-create-status">
            <InputGroup :label="t('clients.col_status')">
              <CustomSelect v-model="form.status" :options="STATUS_OPTIONS" data-test="field-status" />
            </InputGroup>
          </GlassPanel>
        </div>

      </div>
    </div>
  </div>
</template>

<style>
@import '@styles/admin/client_card.css';

.required-star {
  color: var(--danger, #e74c3c);
  margin-left: 2px;
}

.field-error {
  color: var(--danger, #e74c3c);
  font-size: 11px;
  margin-left: 4px;
}

.has-error {
  border-color: var(--danger, #e74c3c) !important;
  box-shadow: 0 0 0 1px var(--danger, #e74c3c) !important;
}

.input-group {
  margin-bottom: 12px;
}
</style>
