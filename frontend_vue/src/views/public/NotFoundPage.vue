<template>
  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <div class="error-code">404</div>
      <h1>{{ t('error.title') }}</h1>

      <p class="subtitle">{{ t('error.subtitle') }}</p>

      <router-link to="/" class="cta-button">
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
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        <span>{{ t('error.btnHome') }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/404.css'

const { t } = useI18n()

useHead({
  title: () => t('error.seo.title'),
  description: () => t('error.seo.description'),
})
</script>
