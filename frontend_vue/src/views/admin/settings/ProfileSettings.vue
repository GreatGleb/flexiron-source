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

const copied = ref(false)

async function copySecretLink() {
  const link = settings.profile.secretLink
  if (!link) return
  try {
    await navigator.clipboard.writeText(link)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
    toast.success(t('settingsProfile.copied'))
  } catch {
    toast.error(t('settingsProfile.copyFailed'))
  }
}

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
          class="glass-input"
          type="text"
          data-test="settings-profile-first-name"
          @input="updateProfile({ firstName: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.lastName')">
        <input
          :value="settings.profile.lastName"
          class="glass-input"
          type="text"
          data-test="settings-profile-last-name"
          @input="updateProfile({ lastName: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.email')">
        <input
          :value="settings.profile.email"
          class="glass-input"
          type="email"
          data-test="settings-profile-email"
          @input="updateProfile({ email: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsProfile.phone')">
        <input
          :value="settings.profile.phone"
          class="glass-input"
          type="tel"
          data-test="settings-profile-phone"
          @input="updateProfile({ phone: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>
    </div>

    <!-- Secret Link Section -->
    <h3 class="settings-section-title section-spacer">{{ t('settingsProfile.secretLink') }}</h3>
    <div class="settings-form">
      <div class="secret-link-info">
        <p class="secret-link-desc">{{ t('settingsProfile.secretLinkDesc') }}</p>
        <div v-if="settings.profile.secretLink" class="secret-link-field">
          <input
            :value="settings.profile.secretLink"
            class="glass-input secret-link-input"
            type="text"
            readonly
          />
          <button class="btn btn-secondary secret-link-btn" @click="copySecretLink">
            {{ copied ? t('settingsProfile.copied') : t('settingsProfile.copy') }}
          </button>
        </div>
        <p v-else class="secret-link-missing">{{ t('settingsProfile.secretLinkMissing') }}</p>
        <p class="secret-link-warning">{{ t('settingsProfile.secretLinkWarning') }}</p>
      </div>
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
          data-test="settings-profile-change-password"
          @click="handleChangePassword"
        >
          {{
            changingPassword ? t('settingsProfile.changing') : t('settingsProfile.change_password')
          }}
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

.secret-link-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.secret-link-desc {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.secret-link-field {
  display: flex;
  gap: 8px;
  align-items: center;
}

.secret-link-input {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem !important;
  color: #1890ff !important;
}

.secret-link-btn {
  white-space: nowrap;
}

.secret-link-missing {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.secret-link-warning {
  font-size: 0.75rem;
  color: rgba(255, 107, 107, 0.7);
  margin: 0;
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
