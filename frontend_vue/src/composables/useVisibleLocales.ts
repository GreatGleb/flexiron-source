import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ruVisible } from '@/i18n/ruVisibility'

/**
 * Языки для переключателей программы: все доступные, кроме русского, пока он скрыт
 * (src/i18n/ruVisibility.ts). Один список на все три переключателя — публичную шапку,
 * верхнюю панель и боковое меню админки.
 */
export function useVisibleLocales() {
  const { availableLocales } = useI18n()
  return computed(() => availableLocales.filter((code) => code !== 'ru' || ruVisible.value))
}
