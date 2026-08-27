import type { TranslatedString } from '@/types/i18n'

/**
 * Кто отправляет запрос цен поставщику.
 *
 * Спека 04.2 §3 требует тему из названия компании и даты, а в теле —
 * `{{company_signature}}`, подпись ТЕКУЩЕГО менеджера. И то, и другое живёт в
 * настройках (`AppSettings.company`, `AppSettings.profile`), поэтому здесь
 * только поля, а не источник: письмо не должно знать, откуда они пришли.
 *
 * До 2026-08-28 на их месте стояла константа с именем постороннего юрлица —
 * письмо уходило живому поставщику от лица чужой компании.
 */
export interface BccSender {
  companyName: string
  companyAddress: string
  managerName: string
  managerPhone: string
  managerEmail: string
}

type EmailLocale = keyof TranslatedString

interface EmailPhrases {
  /** Начало темы: «Запрос цен на металл» + дата + название компании. */
  subject: string
  greeting: string
  intro: string
  /** Что стоит вместо списка позиций, когда не выбрано ничего. */
  allItems: string
  regards: string
}

const PHRASES: Record<EmailLocale, EmailPhrases> = {
  ru: {
    subject: 'Запрос цен на металл',
    greeting: 'Здравствуйте!',
    intro: 'Пожалуйста, предоставьте текущие цены на следующие позиции:',
    allItems: 'Все категории',
    regards: 'С уважением,',
  },
  en: {
    subject: 'Metal price request',
    greeting: 'Hello!',
    intro: 'Please provide current prices for the following items:',
    allItems: 'All categories',
    regards: 'Best regards,',
  },
  lt: {
    subject: 'Metalo kainų užklausa',
    greeting: 'Sveiki!',
    intro: 'Prašome pateikti dabartines kainas šioms prekėms:',
    allItems: 'Visos kategorijos',
    regards: 'Pagarbiai,',
  },
}

/**
 * Дата в письме и в истории запросов — одна и та же запись, дд.мм.гггг.
 *
 * Живёт здесь, а не в странице, чтобы у BCC-инструмента не завелось двух
 * форматов даты: тема письма и таблица истории читают один и тот же формат.
 */
export function formatBccDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

/**
 * Подпись менеджера: он сам, компания, от лица которой пишет, её адрес и
 * контакты для ответа. Пустые поля выпадают — недозаполненные настройки не
 * должны оставлять в письме пустую строку.
 */
export function buildBccSignature(sender: BccSender): string[] {
  const contacts = [sender.managerPhone, sender.managerEmail].filter(Boolean).join(' · ')
  return [sender.managerName, sender.companyName, sender.companyAddress, contacts].filter(Boolean)
}

/** Тема: «Запрос цен на металл 28.08.2026 — Flexiron UAB» (спека 04.2 §3). */
export function buildBccSubject(sender: BccSender, date: string): TranslatedString {
  const build = (locale: EmailLocale) => {
    const head = `${PHRASES[locale].subject} ${date}`.trim()
    return sender.companyName ? `${head} — ${sender.companyName}` : head
  }
  return { ru: build('ru'), en: build('en'), lt: build('lt') }
}

/**
 * Тело письма: приветствие, список позиций и подпись.
 *
 * Подписи нет (настройки ещё не пришли или пусты) — вместе с ней уходит и
 * «С уважением,»: висящее прощание без имени хуже, чем его отсутствие.
 */
export function buildBccBody(sender: BccSender, items: string[]): TranslatedString {
  const signature = buildBccSignature(sender)
  const build = (locale: EmailLocale) => {
    const phrases = PHRASES[locale]
    const itemsBlock = items.length
      ? items.map((name) => `  - ${name}`).join('\n')
      : phrases.allItems
    const parts = [phrases.greeting, phrases.intro, itemsBlock]
    if (signature.length) parts.push([phrases.regards, ...signature].join('\n'))
    return parts.join('\n\n')
  }
  return { ru: build('ru'), en: build('en'), lt: build('lt') }
}
