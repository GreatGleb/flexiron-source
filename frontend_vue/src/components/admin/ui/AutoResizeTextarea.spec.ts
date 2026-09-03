// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutoResizeTextarea from './AutoResizeTextarea.vue'

/**
 * Пункт 8 `review-followups.md`: базовый класс носит компонент, а не 28 вызывающих.
 *
 * Проверять это дальше по вызывающим бессмысленно — их число меняется, а забытый
 * класс не роняет ни typecheck, ни lint, ни один e2e: поле просто выглядит чужим.
 * Здесь проверяется само правило, в одном месте, где оно теперь и живёт.
 */
describe('AutoResizeTextarea', () => {
  it('несёт базовый класс сам, без участия вызывающего', () => {
    const wrapper = mount(AutoResizeTextarea, { props: { modelValue: '' } })
    expect(wrapper.element.tagName).toBe('TEXTAREA')
    expect(wrapper.classes()).toContain('glass-input')
  })

  it('не съедает класс, дописанный вызывающим', () => {
    const wrapper = mount(AutoResizeTextarea, {
      props: { modelValue: '' },
      attrs: { class: 'batch-notes-input' },
    })
    expect(wrapper.classes()).toContain('glass-input')
    expect(wrapper.classes()).toContain('batch-notes-input')
  })
})
