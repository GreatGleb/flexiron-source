/**
 * Тексты лендинга `/` — типизированный модуль вместо vue-i18n (решение 1 плана
 * roo_code/plans/landing/landing-plan.md): переводов пока нет, а localeParity требует
 * одинаковый набор ключей во всех трёх локалях. Данные — src/content/landing.ru.ts.
 */

/** Иконки из презентации (react-icons/fa6 в presentation/build.js), имена без префикса Fa. */
export type LandingIcon =
  | 'scissors'
  | 'percent'
  | 'boxes-stacked'
  | 'envelopes-bulk'
  | 'warehouse'
  | 'cart-shopping'
  | 'truck'
  | 'money-bill-wave'
  | 'chart-line'
  | 'hammer'
  | 'clock-rotate-left'
  | 'users'
  | 'list-check'
  | 'ruler-horizontal'
  | 'language'

/** id секций-якорей страницы: на них ведут ссылки шапки и кнопки «Заказать показ». */
type LandingAnchor = 'features' | 'flow' | 'roadmap' | 'lead'

export interface LandingImage {
  /** URL после сборки Vite (импорт из src/assets/images/landing/). */
  src: string
  alt: string
  /** Натуральный размер файла — для атрибутов width/height у <img>. */
  width: number
  height: number
}

interface LandingPoint {
  title: string
  text: string
  icon?: LandingIcon
}

interface LandingLink {
  label: string
}

interface LandingAnchorLink extends LandingLink {
  anchor: LandingAnchor
}

interface LandingRouteLink extends LandingLink {
  to: string
}

type LandingFeatureId =
  | 'warehouse'
  | 'cutting'
  | 'order'
  | 'money'
  | 'suppliers'
  | 'analytics'
  | 'config'

export interface LandingFeature {
  id: LandingFeatureId
  title: string
  /** Пункты с заголовком (склад, заказ, деньги, закупка, аналитика, настройка). */
  points?: LandingPoint[]
  /** Нумерованные шаги (резка). */
  steps?: string[]
  /** Плашка или сноска под пунктами. */
  note?: string
  image: LandingImage
  /** С какой стороны скриншот на широком экране; у соседних секций — разная. */
  shotSide: 'left' | 'right'
  /** Тёмная акцентная секция (резка, слайд 5). */
  dark?: boolean
  /** Пункты карточками (деньги заказа, слайд 7). */
  pointsAsCards?: boolean
}

/** Коды ошибок поля формы заявки; правило валидации — src/domain/landingLead.ts (L-02). */
export type LandingLeadErrorCode = 'required' | 'invalidContact' | 'tooLong'

interface LandingFormField {
  label: string
  placeholder?: string
}

export interface LandingContent {
  seo: { title: string; description: string }
  header: {
    logoAlt: string
    nav: LandingAnchorLink[]
    login: LandingRouteLink
    cta: LandingAnchorLink
    menuLabel: string
  }
  hero: {
    eyebrow: string
    title: string
    subtitle: string
    ctaLead: LandingAnchorLink
    ctaDemo: LandingRouteLink
    image: LandingImage
    caption: string
  }
  pains: {
    title: string
    items: LandingPoint[]
    note: string
  }
  flow: {
    title: string
    steps: (LandingPoint & { accent?: boolean })[]
    note: { lead: string; text: string; icon: LandingIcon }
  }
  /** Секции 4–9, в порядке страницы. */
  features: LandingFeature[]
  /** Секция 10 — та же форма данных, что у фич, чередование сторон продолжается. */
  config: LandingFeature
  demo: {
    title: string
    text: string
    cta: LandingRouteLink
  }
  roadmap: {
    title: string
    done: { title: string; items: string[] }
    next: { title: string; items: string[] }
  }
  lead: {
    title: string
    text: string
    fields: {
      name: LandingFormField
      company: LandingFormField
      contact: LandingFormField
      message: LandingFormField
    }
    submit: string
    consent: string
    success: string
    error: string
    disabled: string
    errors: Record<LandingLeadErrorCode, string>
    captcha: {
      /** Заявка верна, а проверка от ботов ещё не пройдена. */
      required: string
      /** Скрипт капчи не загрузился — отправить нельзя, ниже контакты. */
      failed: string
    }
  }
  footer: {
    links: LandingRouteLink[]
    copyright: string
  }
}
