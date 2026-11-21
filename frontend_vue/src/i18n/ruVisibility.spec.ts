// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { RU_VISIBLE_KEY, ruVisible, setRuVisible } from './ruVisibility'
import { useVisibleLocales } from '@/composables/useVisibleLocales'
import { useTranslatedField } from '@/composables/useTranslatedData'

/**
 * Скрытый русский (этап 2 лендинга, пункт 4): пока флаг не стоит, русского нет ни в
 * переключателях, ни запасным вариантом перевода. Флаг ставит уход с `/ru` лендинга.
 */

function host(locale: string) {
  const i18n = createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: { ru: {}, en: {}, lt: {} },
  })
  let api!: {
    locales: ReturnType<typeof useVisibleLocales>
    tf: ReturnType<typeof useTranslatedField>['tf']
  }
  mount(
    defineComponent({
      setup() {
        api = { locales: useVisibleLocales(), tf: useTranslatedField().tf }
        return () => h('i')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return api
}

beforeEach(() => {
  setRuVisible(false)
})

describe('ruVisibility', () => {
  it('флаг пишется в хранилище и снимается из него', () => {
    setRuVisible(true)
    expect(ruVisible.value).toBe(true)
    expect(localStorage.getItem(RU_VISIBLE_KEY)).toBe('1')
    setRuVisible(false)
    expect(ruVisible.value).toBe(false)
    expect(localStorage.getItem(RU_VISIBLE_KEY)).toBeNull()
  })
})

describe('useVisibleLocales', () => {
  it('русский скрыт — его нет в списке; открыт — есть, и список перестраивается сразу', async () => {
    const { locales } = host('lt')
    expect(locales.value).toEqual(['en', 'lt'])
    setRuVisible(true)
    await nextTick()
    expect(locales.value).toEqual(['en', 'lt', 'ru'])
  })
})

describe('tf — запасной перевод', () => {
  const field = { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }

  it('перевод на текущий язык есть — он', () => {
    expect(host('lt').tf(field)).toBe('Vamzdžiai')
  })

  it('русский скрыт: нет литовского — английский, нет обоих — пусто, но не русский', () => {
    const { tf } = host('lt')
    expect(tf({ ...field, lt: '' })).toBe('Pipes')
    expect(tf({ ru: 'Трубы', en: '', lt: '' })).toBe('')
  })

  it('русский скрыт, язык en: нет английского — литовский', () => {
    expect(host('en').tf({ ...field, en: '' })).toBe('Vamzdžiai')
  })

  it('русский открыт — прежний порядок: сначала русский', () => {
    setRuVisible(true)
    expect(host('lt').tf({ ...field, lt: '' })).toBe('Трубы')
  })
})
