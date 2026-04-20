<template>
  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img
          :src="logoUrl"
          alt="Flexiron Logo"
          class="logo-icon"
          style="width: auto; height: 48px"
        />
      </div>

      <h1>{{ t('landing.title') }}</h1>

      <p class="subtitle" v-html="t('landing.subtitle')"></p>

      <div class="cta-group">
        <router-link to="/register" class="cta-button">{{ t('landing.btnReg') }}</router-link>
        <router-link to="/admin" class="cta-button secondary">{{
          t('landing.btnDemo')
        }}</router-link>
      </div>
    </div>
  </div>

  <footer class="footer">
    <router-link to="/support" class="footer-link">{{ t('landing.support') }}</router-link>
    <router-link to="/about" class="footer-link">{{ t('landing.about') }}</router-link>
    <router-link to="/terms" class="footer-link">{{ t('landing.terms') }}</router-link>
    <router-link to="/screens" class="footer-link">{{ t('landing.indexMap') }}</router-link>
  </footer>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import logoUrl from '@images/Flexiron_Logo_White.svg'

const { t } = useI18n()

useHead({
  title: () => t('landing.seo.title'),
  description: () => t('landing.seo.description'),
})
</script>
