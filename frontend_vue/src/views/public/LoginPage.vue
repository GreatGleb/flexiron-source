<template>
  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('login.title') }}</h1>

      <!-- Email pre-filled from secret link: show login form -->
      <template v-if="prefilledEmail">
        <p class="subtitle">{{ t('login.subtitle') }}</p>

        <form class="auth-form" @submit.prevent="onSubmit">
          <div class="form-group">
            <label class="form-label">{{ t('login.emailLabel') }}</label>
            <input v-model="email" type="email" class="form-input" readonly />
          </div>

          <div class="form-group">
            <label class="form-label">{{ t('login.pwdLabel') }}</label>
            <div class="input-icon-wrapper">
              <input
                ref="passwordInput"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                :placeholder="t('common.pwdPlaceholder')"
                required
                autofocus
              />
              <div
                class="input-action-icon"
                :title="t('reg.showPassword')"
                @click="showPassword = !showPassword"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <!-- Error message -->
          <div v-if="submitError" class="form-error">
            {{ submitError }}
          </div>

          <div class="form-options">
            <label class="checkbox-label">
              <input v-model="rememberMe" type="checkbox" class="custom-checkbox" />
              <span>{{ t('login.remember') }}</span>
            </label>
            <router-link to="/support" class="forgot-link">{{ t('login.forgot') }}</router-link>
          </div>

          <button type="submit" class="cta-button" :disabled="isLoading">
            {{ isLoading ? t('login.loading') : t('login.btnSubmit') }}
          </button>
        </form>
      </template>

      <!-- No email pre-filled: show secret link info (default) -->
      <template v-else>
        <div class="secret-link-info">
          <div class="secret-link-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              width="48"
              height="48"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <p class="secret-link-msg">{{ t('login.secretLinkMsg') }}</p>
          <p class="secret-link-hint">{{ t('login.secretLinkHint') }}</p>
          <p class="secret-link-support">
            {{ t('login.secretLinkSupport') }}
            <a href="mailto:support@flexiron.com" class="support-email">support@flexiron.com</a>
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useAuth } from '@/composables/useAuth'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/login.css'

const { t } = useI18n()
const { login, isLoading } = useAuth()

const showPassword = ref(false)
const passwordInput = ref(null)
const submitError = ref(null)

const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const prefilledEmail = ref(false)

const PREFILLED_EMAIL_KEY = 'prefilled_email'

onMounted(() => {
  // Check if email was pre-filled from a secret link (via sessionStorage)
  const storedEmail = sessionStorage.getItem(PREFILLED_EMAIL_KEY)
  // Validate email — reject "undefined", "null", empty, or obviously invalid values
  if (
    storedEmail &&
    storedEmail !== 'undefined' &&
    storedEmail !== 'null' &&
    storedEmail.includes('@')
  ) {
    email.value = storedEmail
    prefilledEmail.value = true
    // Clean up so the pre-fill only works once
    sessionStorage.removeItem(PREFILLED_EMAIL_KEY)
  } else if (storedEmail) {
    // Clean up any stale/invalid values from sessionStorage
    sessionStorage.removeItem(PREFILLED_EMAIL_KEY)
  }
})

useHead({
  title: () => t('login.seo.title'),
  description: () => t('login.seo.description'),
})

async function onSubmit() {
  submitError.value = null

  if (!email.value) {
    submitError.value = t('login.errorRequired')
    return
  }

  if (!password.value) {
    submitError.value = t('login.errorRequired')
    return
  }

  try {
    await login({
      email: email.value,
      password: password.value,
      rememberMe: rememberMe.value,
    })
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : t('login.errorFailed')
  }
}
</script>
