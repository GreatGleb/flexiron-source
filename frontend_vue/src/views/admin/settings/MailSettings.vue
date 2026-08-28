<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import { sendMailServerTest } from '@/services/settingsService'
import { MAIL_ENCRYPTIONS, isMailEncryption, isMailConfigured } from '@/types/settings'
import type { AppSettings, MailServerSettings } from '@/types/settings'

const { t } = useI18n()
const toast = useToast()

const settings = inject<AppSettings>('settings')!
const updateMail =
  inject<(patch: Partial<Omit<MailServerSettings, 'passwordSet'>>) => void>('updateMail')!
const mailPassword = inject<Ref<string>>('mailPassword')!
const setMailPassword = inject<(value: string) => void>('setMailPassword')!

const encryptionOptions = computed(() =>
  MAIL_ENCRYPTIONS.map((value) => ({ value, label: t(`settingsMail.encryption_${value}`) })),
)

function onEncryptionChange(value: string) {
  if (isMailEncryption(value)) updateMail({ encryption: value })
}

/**
 * Порт — число, и пустое поле обязано стать не NaN, а прежним значением: питфолл #25.
 * Порт без значения — это не «нулевой порт», а «пользователь стирает и печатает заново».
 */
function onPortInput(raw: string) {
  const port = Number.parseInt(raw, 10)
  if (Number.isFinite(port)) updateMail({ port })
}

/**
 * Отправить письмо не через что, пока сервер не настроен. Само правило — одно на
 * проект, `isMailConfigured` в `@/types/settings`; здесь оно объясняет пользователю,
 * почему кнопка неактивна, а не решает за сервер.
 *
 * На вход идёт `settings.mail` — состояние СЕРВЕРА, а не только что введённый пароль:
 * тест проверяет то, что на сервере, и кнопка, включённая несохранённым паролем,
 * обещала бы проверку того, чего сервер ещё не видел.
 */
const configured = computed(() => isMailConfigured(settings.mail))

const testing = ref(false)

async function handleTest() {
  testing.value = true
  try {
    const { deliveredTo } = await sendMailServerTest()
    toast.success(t('settingsMail.test_sent', { email: deliveredTo }))
  } catch (e) {
    const code = e instanceof Error ? e.message : ''
    toast.error(
      code === 'MAIL_NOT_CONFIGURED'
        ? t('settingsMail.test_not_configured')
        : t('settingsMail.test_failed'),
    )
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <GlassPanel class="settings-panel">
    <h3 class="settings-section-title">{{ t('settingsMail.server') }}</h3>
    <p class="settings-mail-note">{{ t('settingsMail.note') }}</p>

    <div class="settings-form">
      <InputGroup :label="t('settingsMail.host')">
        <input
          :value="settings.mail.host"
          class="glass-input"
          type="text"
          placeholder="smtp.example.com"
          data-test="settings-mail-host"
          @input="updateMail({ host: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsMail.port')">
        <input
          :value="settings.mail.port"
          class="glass-input"
          type="number"
          min="1"
          max="65535"
          data-test="settings-mail-port"
          @input="onPortInput(($event.target as HTMLInputElement).value)"
        />
      </InputGroup>

      <InputGroup :label="t('settingsMail.encryption')">
        <CustomSelect
          :model-value="settings.mail.encryption"
          :options="encryptionOptions"
          data-test="settings-mail-encryption"
          @update:model-value="onEncryptionChange"
        />
      </InputGroup>

      <InputGroup :label="t('settingsMail.username')">
        <input
          :value="settings.mail.username"
          class="glass-input"
          type="text"
          autocomplete="off"
          data-test="settings-mail-username"
          @input="updateMail({ username: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsMail.password')">
        <input
          :value="mailPassword"
          class="glass-input"
          type="password"
          autocomplete="new-password"
          :placeholder="
            settings.mail.passwordSet
              ? t('settingsMail.password_set')
              : t('settingsMail.password_empty')
          "
          data-test="settings-mail-password"
          @input="setMailPassword(($event.target as HTMLInputElement).value)"
        />
        <p class="settings-mail-hint">{{ t('settingsMail.password_hint') }}</p>
      </InputGroup>
    </div>

    <h3 class="settings-section-title section-spacer">{{ t('settingsMail.sender') }}</h3>
    <div class="settings-form">
      <InputGroup :label="t('settingsMail.fromEmail')">
        <input
          :value="settings.mail.fromEmail"
          class="glass-input"
          type="email"
          data-test="settings-mail-from-email"
          @input="updateMail({ fromEmail: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsMail.fromName')">
        <input
          :value="settings.mail.fromName"
          class="glass-input"
          type="text"
          data-test="settings-mail-from-name"
          @input="updateMail({ fromName: ($event.target as HTMLInputElement).value })"
        />
      </InputGroup>

      <div class="settings-mail-actions">
        <button
          class="btn btn-secondary"
          type="button"
          :disabled="testing || !configured"
          data-test="settings-mail-test-btn"
          @click="handleTest"
        >
          {{ testing ? t('settingsMail.testing') : t('settingsMail.test') }}
        </button>
        <p v-if="!configured" class="settings-mail-hint" data-test="settings-mail-not-configured">
          {{ t('settingsMail.not_configured') }}
        </p>
      </div>
    </div>
  </GlassPanel>
</template>

<style scoped>
/*
 * Заголовки секций: те же значения, что у соседних табов настроек.
 * Правило #63 — класс из чужого файла страницы недоступен, поэтому он объявлен
 * здесь, а не взят у ProfileSettings по соседству.
 */
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

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
}

.settings-mail-note {
  margin: 0 0 16px;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  max-width: 480px;
}

.settings-mail-hint {
  margin: 6px 0 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.settings-mail-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}
</style>
