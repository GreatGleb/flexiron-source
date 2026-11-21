// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

/**
 * Состояние `disabled` формы заявки (решение 4 плана лендинга, задача L-06): адрес Apps Script
 * пуст → кнопки отправки нет, вместо неё «Напишите нам напрямую» и контакты из конфига.
 *
 * В e2e это не проверить: там адрес задан на весь dev-сервер (playwright.config.ts). Здесь
 * адрес подменяется пустым через мок модуля конфига — независимо от того, что лежит в .env.
 */
vi.mock('@/config/landing', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/config/landing')>()
  return { ...real, LEADS_URL: '' }
})

const { default: LandingLeadForm } = await import('./LandingLeadForm.vue')
const { CONTACTS } = await import('@/config/landing')
// Без роутера язык лендинга — по умолчанию, литовский (useLandingContent).
const { landingLt } = await import('@/content/landing.lt')

describe('LandingLeadForm без адреса Apps Script', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchSpy.mockReset()
  })

  it('состояние disabled: кнопки отправки нет, контакты есть', () => {
    const wrapper = mount(LandingLeadForm)
    const form = wrapper.get('[data-test="landing-lead-form"]')
    expect(form.attributes('data-state')).toBe('disabled')
    expect(wrapper.find('[data-test="landing-lead-submit"]').exists()).toBe(false)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)

    const direct = wrapper.get('[data-test="landing-lead-disabled"]')
    expect(direct.text()).toContain(landingLt.lead.disabled)
    expect(direct.get('a[href^="mailto:"]').text()).toBe(CONTACTS.email)
    expect(direct.text()).toContain(CONTACTS.phone)
  })

  it('submit формы в disabled ничего не отправляет и состояние не меняет', async () => {
    const wrapper = mount(LandingLeadForm)
    await wrapper.get('[data-test="landing-lead-name"]').setValue('Иван')
    await wrapper.get('[data-test="landing-lead-contact"]').setValue('ivan@metal.lt')
    await wrapper.get('[data-test="landing-lead-form"]').trigger('submit')
    await nextTick()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wrapper.get('[data-test="landing-lead-form"]').attributes('data-state')).toBe('disabled')
  })
})
