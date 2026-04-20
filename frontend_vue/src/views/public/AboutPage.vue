<template>
  <BackButton />

  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('about.title') }}</h1>

      <p class="subtitle">{{ t('about.subtitle') }}</p>

      <div class="features-grid">
        <div class="feature-item">
          <svg
            class="feature-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
            />
          </svg>
          <h3 class="feature-title">{{ t('about.f1Title') }}</h3>
          <p class="feature-desc">{{ t('about.f1Desc') }}</p>
        </div>

        <div class="feature-item">
          <svg
            class="feature-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <h3 class="feature-title">{{ t('about.f2Title') }}</h3>
          <p class="feature-desc">{{ t('about.f2Desc') }}</p>
        </div>

        <div class="feature-item">
          <svg
            class="feature-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          <h3 class="feature-title">{{ t('about.f3Title') }}</h3>
          <p class="feature-desc">{{ t('about.f3Desc') }}</p>
        </div>

        <div class="feature-item">
          <svg
            class="feature-icon"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12"
            />
          </svg>
          <h3 class="feature-title">{{ t('about.f4Title') }}</h3>
          <p class="feature-desc">{{ t('about.f4Desc') }}</p>
        </div>
      </div>

      <router-link to="/register" class="cta-button">{{ t('about.btnTrial') }}</router-link>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import BackButton from '@/components/BackButton.vue'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/about.css'

const { t } = useI18n()

useHead({
  title: () => t('about.seo.title'),
  description: () => t('about.seo.description'),
})
</script>
