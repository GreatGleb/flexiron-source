<template>
  <div class="lang-switcher">
    <a
      v-for="code in locales"
      :key="code"
      href="#"
      class="lang-btn"
      :class="{ active: locale === code }"
      @click.prevent="switchTo(code)"
    >
      {{ code.toUpperCase() }}
    </a>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useVisibleLocales } from '@/composables/useVisibleLocales'

const { locale } = useI18n()
// Русский — только если он не скрыт (src/i18n/ruVisibility.ts).
const locales = useVisibleLocales()

function switchTo(code: string) {
  locale.value = code
  localStorage.setItem('flexiron_lang', code)
  document.documentElement.lang = code
}
</script>
