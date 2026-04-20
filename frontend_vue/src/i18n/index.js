import { createI18n } from 'vue-i18n'
import { translations } from './translations.js'

const savedLang = localStorage.getItem('flexiron_lang') || 'en'

if (typeof document !== 'undefined') {
  document.documentElement.lang = savedLang
}

export const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: translations,
})
