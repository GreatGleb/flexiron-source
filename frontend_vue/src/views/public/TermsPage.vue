<template>
  <BackButton />

  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('terms.title') }}</h1>
      <p class="subtitle">{{ t('terms.subtitle') }}</p>

      <div class="terms-content">
        <template v-for="n in 6" :key="n">
          <h2>{{ t(`terms.t${n}Title`) }}</h2>
          <p v-html="t(`terms.t${n}Desc`)"></p>
        </template>
      </div>

      <router-link to="/" class="cta-button">{{ t('terms.btnAccept') }}</router-link>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import BackButton from '@/components/BackButton.vue'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/terms.css'

const { t } = useI18n()

useHead({
  title: () => t('terms.seo.title'),
  description: () => t('terms.seo.description'),
})
</script>
