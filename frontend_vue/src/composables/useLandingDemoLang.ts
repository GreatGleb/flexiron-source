import { useI18n } from 'vue-i18n'

/**
 * Решение 3 плана лендинга (roo_code/plans/landing/landing-plan.md): демо открывается
 * по-русски. Перед переходом на `/admin` ставится `flexiron_lang = 'ru'` — только если
 * человек язык ещё не выбирал (ключа нет); выбор, сделанный человеком, не перетирается.
 *
 * Локаль i18n меняется вместе с ключом: i18n читает ключ один раз, при старте приложения
 * (src/i18n/index.ts), а переход в демо — внутри SPA, без перезагрузки. Один ключ без
 * локали оставил бы демо на языке старта, то есть английским.
 *
 * Один механизм на обе кнопки «Открыть демо» — hero (L-04) и полоса демо (L-06).
 */
const LANG_STORAGE_KEY = 'flexiron_lang'
const DEMO_LANG = 'ru'

export function useLandingDemoLang() {
  const { locale } = useI18n()

  function prepareDemoLang() {
    if (localStorage.getItem(LANG_STORAGE_KEY) !== null) return
    localStorage.setItem(LANG_STORAGE_KEY, DEMO_LANG)
    locale.value = DEMO_LANG
  }

  return { prepareDemoLang }
}
