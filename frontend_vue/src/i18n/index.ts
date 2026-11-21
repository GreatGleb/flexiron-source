import { createI18n } from 'vue-i18n'
import { translations } from './translations'
import { ruVisible, setRuVisible } from './ruVisibility'

const savedLang = localStorage.getItem('flexiron_lang') || 'en'

// Кто уже работал по-русски, тот русский и видит: язык у него сохранён как 'ru'.
if (savedLang === 'ru' && !ruVisible.value) setRuVisible(true)

if (typeof document !== 'undefined') {
  document.documentElement.lang = savedLang
}

export const i18n = createI18n({
  legacy: false,
  locale: savedLang,
  fallbackLocale: 'en',
  messages: translations,
  warnHtmlMessage: false,
})
