<script setup lang="ts">
import { ref, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import { changePassword } from '@/services/settingsService'
import type { AppSettings, UserProfile } from '@/types/settings'

const { t } = useI18n()
const toast = useToast()

const settings = inject<AppSettings>('settings')!
const updateProfile = inject<(patch: Partial<UserProfile>) => void>('updateProfile')!

// ─── Password change ──────────────────────────────────────────────────────
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const changingPassword = ref(false)

async function handleChangePassword() {
  // Validate
  if (!currentPassword.value) {
    toast.error(t('settingsProfile.password_required'))
    return
  }
  if (newPassword.value.length < 6) {
    toast.error(t('settingsProfile.password_too_short'))
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    toast.error(t('settingsProfile.password_mismatch'))
    return
  }

  changingPassword.value = true
  try {
    await changePassword({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
      confirmPassword: confirmPassword.value,
    })
    toast.success(t('settingsProfile.password_changed'))
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    toast.error(e instanceof Error ? e.message : t('settingsProfile.password_error'))
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <GlassPanel class="settings-panel">
    <h3 class="settings-section-title">{{ t('settingsProfile.personalData') }}</h3>
    <div class="settings-form">
      <InputGroup :label="t('settingsProfile.role')">
        <input
          :value="t('settingsUsers.role_' + settings.profile.role)"
          class="glass-input"
          type="text"
          readonly
          data-test="settings-profile-role"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.firstName')">
        <input
          :value="settings.profile.firstName"
          @input="updateProfile({ firstName: ($event.target as HTMLInputElement).value })"
          class="glass-input"
          type="text"
          data-test="settings-profile-first-name"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.lastName')">
        <input
          :value="settings.profile.lastName"
          @input="updateProfile({ lastName: ($event.target as HTMLInputElement).value })"
          class="glass-input"
          type="text"
          data-test="settings-profile-last-name"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.email')">
        <input
          :value="settings.profile.email"
          @input="updateProfile({ email: ($event.target as HTMLInputElement).value })"
          class="glass-input"
          type="email"
          data-test="settings-profile-email"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.phone')">
        <input
          :value="settings.profile.phone"
          @input="updateProfile({ phone: ($event.target as HTMLInputElement).value })"
          class="glass-input"
          type="tel"
          data-test="settings-profile-phone"
        />
      </InputGroup>

    </div>

    <h3 class="settings-section-title section-spacer">{{ t('settingsProfile.security') }}</h3>
    <div class="settings-form">
      <InputGroup :label="t('settingsProfile.currentPassword')">
        <input
          v-model="currentPassword"
          class="glass-input"
          type="password"
          data-test="settings-profile-current-password"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.newPassword')">
        <input
          v-model="newPassword"
          class="glass-input"
          type="password"
          data-test="settings-profile-new-password"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.confirmPassword')">
        <input
          v-model="confirmPassword"
          class="glass-input"
          type="password"
          data-test="settings-profile-confirm-password"
        />
      </InputGroup>

      <div class="password-actions">
        <button
          class="btn btn-primary"
          :disabled="changingPassword"
          @click="handleChangePassword"
          data-test="settings-profile-change-password"
        >
          {{ changingPassword ? t('settingsProfile.changing') : t('settingsProfile.change_password') }}
        </button>
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

.settings-section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 8px;
  margin-top: 0;
  color: rgba(255, 255, 255, 0.85);
}

.section-spacer {
  margin-top: 24px;
}

.password-actions {
  margin-top: 8px;
}
</style>
