<template>
  <BackButton />

  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('reg.title') }}</h1>

      <div class="trial-banner">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ t('reg.trial') }}</span>
      </div>

      <form class="form-grid" @submit.prevent="onSubmit">
        <h2 class="form-section-title">{{ t('reg.contactsTitle') }}</h2>

        <div class="form-group col-span-2">
          <label class="form-label">{{ t('reg.nameLabel') }}</label>
          <input type="text" class="form-input" :placeholder="t('reg.namePlaceholder')" required />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('reg.emailLabel') }}</label>
          <input
            type="email"
            class="form-input"
            :placeholder="t('common.emailPlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('reg.phoneLabel') }}</label>
          <input
            type="tel"
            class="form-input"
            :placeholder="t('common.phonePlaceholder')"
            required
          />
        </div>

        <div class="form-group col-span-2">
          <label class="form-label">{{ t('reg.pwdLabel') }}</label>
          <div class="input-icon-wrapper">
            <input
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :placeholder="t('common.pwdPlaceholder')"
              required
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

        <h2 class="form-section-title" style="margin-top: 0.5rem">{{ t('reg.companyTitle') }}</h2>

        <div class="form-group col-span-2">
          <label class="form-label">{{ t('reg.companyLabel') }}</label>
          <input
            type="text"
            class="form-input"
            :placeholder="t('reg.companyPlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('reg.vatLabel') }}</label>
          <input type="text" class="form-input" :placeholder="t('reg.vatPlaceholder')" required />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('reg.countryLabel') }}</label>
          <input
            type="text"
            class="form-input"
            :placeholder="t('reg.countryPlaceholder')"
            required
          />
        </div>

        <div class="col-span-2">
          <button type="submit" class="cta-button">{{ t('reg.btnSubmit') }}</button>
          <p class="terms-note">
            {{ t('reg.terms') }}
            <router-link to="/terms" target="_blank">{{ t('reg.termsLink') }}</router-link
            >.
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import BackButton from '@/components/BackButton.vue'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/register.css'

const { t } = useI18n()
const showPassword = ref(false)

useHead({
  title: () => t('reg.seo.title'),
  description: () => t('reg.seo.description'),
})

function onSubmit() {
  // TODO: registration logic
}
</script>

<style scoped>
.container {
  align-items: flex-start;
}
.hero-card {
  margin: auto;
}
</style>
