import { onUnmounted, watchEffect, type Ref } from 'vue'
import type { LandingContent, LandingLang } from '@/types/landing'
import { GSC_VERIFICATION, SITE_URL } from '@/config/landing'
import { DEFAULT_LANDING_LANG, LANDING_PATH, SWITCHER_LANGS } from './useLandingContent'

/**
 * Голова страницы лендинга для поисковиков и соцсетей (этап 2, SEO — landing-stage-2-plan.md, пункт 3).
 *
 * - `canonical` — адрес этой языковой версии со слэшем на конце (так его отдаёт GitHub Pages);
 * - `hreflang` — только литовский и английский, `x-default` — литовский. Русского нет: его не
 *   показывают литовским и английским посетителям (src/i18n/ruVisibility.ts);
 * - `/ru` — `noindex`: в поиск не попадает, по ссылке открывается;
 * - Open Graph и Twitter — заголовок, описание, адрес, картинка превью своего языка;
 * - JSON-LD — что это за программа, без цен, оценок и отзывов, которых нет.
 *
 * Теги помечены `data-landing-seo` и снимаются при уходе со страницы: у программы своя голова.
 * Заранее отрисованный HTML (scripts/prerender-landing.mjs) сохраняет их такими, какие они здесь.
 */
const MARK = 'data-landing-seo'

const OG_LOCALE: Record<LandingLang, string> = { lt: 'lt_LT', en: 'en_GB', ru: 'ru_RU' }

/** Адрес языковой версии — со слэшем, как его отдаёт GitHub Pages для папки с index.html. */
export function landingUrl(lang: LandingLang): string {
  return `${SITE_URL}${LANDING_PATH[lang]}/`
}

function add(tag: 'link' | 'meta' | 'script', attrs: Record<string, string>, text?: string) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.setAttribute(MARK, '')
  if (text !== undefined) el.textContent = text
  document.head.appendChild(el)
}

function clear() {
  document.head.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove())
}

export function useLandingSeo(lang: Ref<LandingLang>, content: Ref<LandingContent>) {
  watchEffect(() => {
    clear()
    const code = lang.value
    const { title, description } = content.value.seo
    const url = landingUrl(code)

    add('link', { rel: 'canonical', href: url })
    for (const alt of SWITCHER_LANGS) {
      add('link', { rel: 'alternate', hreflang: alt, href: landingUrl(alt) })
    }
    add('link', { rel: 'alternate', hreflang: 'x-default', href: landingUrl(DEFAULT_LANDING_LANG) })
    if (!SWITCHER_LANGS.includes(code)) add('meta', { name: 'robots', content: 'noindex, follow' })
    if (GSC_VERIFICATION)
      add('meta', { name: 'google-site-verification', content: GSC_VERIFICATION })

    const image = `${SITE_URL}/og/${code}.jpg`
    const og: [string, string][] = [
      ['og:type', 'website'],
      ['og:site_name', 'Flexiron'],
      ['og:title', title],
      ['og:description', description],
      ['og:url', url],
      ['og:image', image],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:locale', OG_LOCALE[code]],
    ]
    for (const [property, value] of og) add('meta', { property, content: value })
    add('meta', { name: 'twitter:card', content: 'summary_large_image' })
    add('meta', { name: 'twitter:title', content: title })
    add('meta', { name: 'twitter:description', content: description })
    add('meta', { name: 'twitter:image', content: image })

    add(
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'Organization', name: 'Flexiron', url: SITE_URL },
          {
            '@type': 'SoftwareApplication',
            name: 'Flexiron',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            inLanguage: code,
            description,
            url,
          },
        ],
      }),
    )
  })
  onUnmounted(clear)
}
