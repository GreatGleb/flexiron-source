<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useClientCard } from '@/composables/useClientCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'
import '@styles/admin/client_card.css'

const { t } = useI18n()
const route = useRoute()

const id = route.params.id as string
const { client, loading, saving, isDirty, error, load, save, discard, tf, auditLog, auditLoading, loadAudit, deleteAuditEntry } = useClientCard(id)

const pageTitle = computed(() =>
  client.value
    ? `${t('clients.card_title')} ${client.value.id} — ${client.value.name}`
    : t('clients.title'),
)

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
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
            { label: client ? `${t('clients.card_title')} ${client.id} — ${client.name}` : '...' },
          ]"
        />
        <div class="client-card-header-row">
          <div class="client-card-header-left">
            <h1 class="page-title">{{ client ? `${t('clients.card_title')} ${client.id} — ${client.name}` : '...' }}</h1>
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
                          @click="deleteAuditEntry(i)"
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
  </template>
</template>

<style>
@import '@styles/admin/client_card.css';

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
