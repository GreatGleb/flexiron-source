import { onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { LandingLang } from '@/types/landing'
import { setRuVisible } from '@/i18n/ruVisibility'

/**
 * Язык программы — по языку лендинга, с которого в неё пришли (решение владельца 2026-11-21,
 * roo_code/plans/landing/landing-stage-2-plan.md, пункт 4): с `/ru` демо и вход открываются
 * по-русски, с `/lt` — по-литовски, с `/en` — по-английски. Выбор, сделанный раньше в самой
 * программе, при этом заменяется: человек только что показал, на каком языке читает.
 *
 * Один механизм на все выходы со страницы — «Открыть демо» (hero и полоса демо), «Войти»,
 * ссылки подвала: страница ловит уход, а не каждую кнопку. Переход между языками лендинга
 * (`/lt` → `/en`) — не уход в программу, язык программы он не трогает.
 *
 * С `/lt` и `/en` русский в программе скрывается, с `/ru` — открывается (src/i18n/ruVisibility.ts).
 *
 * Локаль i18n меняется вместе с ключом: i18n читает `flexiron_lang` один раз, при старте
 * (src/i18n/index.ts), а переход — внутри SPA, без перезагрузки.
 *
 * Охранник — общий (`router.beforeEach`), язык берётся из маршрута, с которого уходят, а не из
 * `onBeforeRouteLeave`: `/lt` и `/en` — одна страница, Vue её не пересоздаёт, и охранник ухода
 * остался бы привязан к первому маршруту — после переключения на EN уход в демо его не вызвал бы.
 */
const LANG_STORAGE_KEY = 'flexiron_lang'

export function useLandingAppLang() {
  const { locale } = useI18n()
  const router = useRouter()

  const remove = router.beforeEach((to, from) => {
    const lang = from.meta.landingLang as LandingLang | undefined
    if (lang === undefined || to.meta.landingLang !== undefined) return
    localStorage.setItem(LANG_STORAGE_KEY, lang)
    locale.value = lang
    // Русский в программе виден только пришедшим с /ru (src/i18n/ruVisibility.ts).
    setRuVisible(lang === 'ru')
  })
  onUnmounted(remove)
}
