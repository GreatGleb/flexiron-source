<template>
  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('login.title') }}</h1>

      <p class="subtitle">{{ t('login.subtitle') }}</p>

      <form class="auth-form" @submit.prevent="onSubmit">
        <div class="form-group">
          <label class="form-label">{{ t('login.emailLabel') }}</label>
          <input type="email" class="form-input" value="director@metalltorg.com" disabled />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('login.pwdLabel') }}</label>
          <div class="input-icon-wrapper">
            <input
              ref="passwordInput"
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

        <div class="form-options">
          <label class="checkbox-label">
            <input type="checkbox" class="custom-checkbox" checked />
            <span>{{ t('login.remember') }}</span>
          </label>
          <router-link to="/support" class="forgot-link">{{ t('login.forgot') }}</router-link>
        </div>

        <button type="submit" class="cta-button">{{ t('login.btnSubmit') }}</button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/login.css'

const { t } = useI18n()
const showPassword = ref(false)

useHead({
  title: () => t('login.seo.title'),
  description: () => t('login.seo.description'),
})

function onSubmit() {
  // TODO: auth logic
}
</script>
