import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { LandingContent, LandingLang } from '@/types/landing'
import { landingLt } from '@/content/landing.lt'
import { landingEn } from '@/content/landing.en'
import { landingRu } from '@/content/landing.ru'

/**
 * Язык и тексты лендинга по адресу (этап 2, пункт 4 — roo_code/plans/landing/landing-stage-2-plan.md).
 *
 * Язык задаёт маршрут (`meta.landingLang`: `/lt`, `/en`, `/ru`), а не настройка браузера:
 * у каждого языка свой адрес. Компоненты лендинга берут тексты только отсюда — так переход
 * `/lt` → `/en` (тот же компонент страницы, Vue его не пересоздаёт) меняет все тексты разом.
 */

export const DEFAULT_LANDING_LANG: LandingLang = 'lt'

export const LANDING_CONTENT: Readonly<Record<LandingLang, LandingContent>> = {
  lt: landingLt,
  en: landingEn,
  ru: landingRu,
}

/** Адрес каждого языка. */
export const LANDING_PATH: Readonly<Record<LandingLang, string>> = {
  lt: '/lt',
  en: '/en',
  ru: '/ru',
}

/** Языки в переключателе шапки; русского там нет — `/ru` открывают по ссылке. */
export const SWITCHER_LANGS: readonly LandingLang[] = ['lt', 'en']

function isLandingLang(value: unknown): value is LandingLang {
  return typeof value === 'string' && value in LANDING_CONTENT
}

export function useLandingLang() {
  // Без роутера (компонентные тесты) — язык по умолчанию.
  const route = useRoute() as ReturnType<typeof useRoute> | undefined
  return computed<LandingLang>(() => {
    const meta = route?.meta.landingLang
    return isLandingLang(meta) ? meta : DEFAULT_LANDING_LANG
  })
}

export function useLandingContent() {
  const lang = useLandingLang()
  return computed(() => LANDING_CONTENT[lang.value])
}
