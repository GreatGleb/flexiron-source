<script setup lang="ts">
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { AppSettings } from '@/types/settings'

const { t } = useI18n()

const settings = inject<AppSettings>('settings')!
const updateCompany = inject<(patch: Partial<AppSettings['company']>) => void>('updateCompany')!
const handleLogoDrop = inject<(files: File[]) => void>('handleLogoDrop')!
const handleLogoUploaded = inject<(files: { url: string }[]) => void>('handleLogoUploaded')!
</script>

<template>
  <GlassPanel class="settings-panel">
    <div class="settings-form">
      <InputGroup :label="t('settingsCompany.name')">
        <input
          :value="settings.company.name"
          class="glass-input"
          type="text"
          data-test="settings-company-name"
          @input="updateCompany({ name: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsCompany.legalAddress')">
        <input
          :value="settings.company.legalAddress"
          class="glass-input"
          type="text"
          data-test="settings-company-legal-address"
          @input="updateCompany({ legalAddress: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsCompany.vatCode')">
        <input
          :value="settings.company.vatCode"
          class="glass-input"
          type="text"
          data-test="settings-company-vat-code"
          @input="updateCompany({ vatCode: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsCompany.bankName')">
        <input
          :value="settings.company.bankName"
          class="glass-input"
          type="text"
          data-test="settings-company-bank-name"
          @input="updateCompany({ bankName: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsCompany.bankAccount')">
        <input
          :value="settings.company.bankAccount"
          class="glass-input"
          type="text"
          data-test="settings-company-bank-account"
          @input="updateCompany({ bankAccount: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <div class="settings-field">
        <label class="field-label">{{ t('settingsCompany.logo') }}</label>
        <DropZone
          hint="PNG, JPG or SVG"
          :accept="'image/png,image/jpeg,image/svg+xml'"
          @files="handleLogoDrop"
          @uploaded="handleLogoUploaded"
        />
        <div v-if="settings.company.logoUrl" class="settings-logo-preview">
          <img :src="settings.company.logoUrl" alt="Logo" class="settings-logo-img" />
        </div>
      </div>
    </div>
  </GlassPanel>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
}

.settings-logo-preview {
  margin-top: 8px;
}

.settings-logo-img {
  max-height: 80px;
  border-radius: 4px;
}
</style>
