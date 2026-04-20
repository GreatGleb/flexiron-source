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

<script setup>
import { useI18n } from 'vue-i18n'

const { locale, availableLocales } = useI18n()
const locales = availableLocales

function switchTo(code) {
  locale.value = code
  localStorage.setItem('flexiron_lang', code)
  document.documentElement.lang = code
}
</script>
