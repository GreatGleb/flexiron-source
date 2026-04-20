<template>
  <BackButton />

  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('support.title') }}</h1>

      <p class="subtitle">{{ t('support.subtitle') }}</p>

      <div class="contacts-grid">
        <a href="https://t.me/flexiron_support" target="_blank" class="contact-item">
          <svg
            class="contact-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.6.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.18-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.2 3.45-.49.34-.94.5-1.33.49-.44-.01-1.28-.24-1.9-.44-.76-.24-1.36-.37-1.31-.78.03-.21.32-.43.88-.66 3.46-1.51 5.77-2.5 6.94-2.99 3.29-1.37 3.97-1.6 4.41-1.61.1 0 .31.02.45.13.11.08.15.2.16.32.01.07.01.16 0 .2z"
            />
          </svg>
          <span class="contact-title">{{ t('support.telegram') }}</span>
          <span class="contact-value">@flexiron_support</span>
        </a>

        <a href="mailto:support@flexiron.com" class="contact-item">
          <svg
            class="contact-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
            />
          </svg>
          <span class="contact-title">{{ t('support.email') }}</span>
          <span class="contact-value">support@flexiron.com</span>
        </a>

        <a href="tel:+37060000000" class="contact-item">
          <svg
            class="contact-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
            />
          </svg>
          <span class="contact-title">{{ t('support.phone') }}</span>
          <span class="contact-value">+370 600 00000</span>
        </a>
      </div>

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
        <span>{{ t('support.backBtn') }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import BackButton from '@/components/BackButton.vue'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/support.css'

const { t } = useI18n()

useHead({
  title: () => t('support.seo.title'),
  description: () => t('support.seo.description'),
})
</script>
