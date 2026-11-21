// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import {
  useReveal,
  REVEAL_DURATION_MS,
  REVEAL_EASING,
  REVEAL_PENDING_CLASS,
  REVEAL_ROOT_MARGIN,
  REVEAL_SHIFT_PX,
  REVEAL_SHIFT_VAR,
  REVEAL_STAGGER_MS,
} from './useReveal'

/**
 * useReveal (L-07, план лендинга, «Движение»). IntersectionObserver, matchMedia и
 * Element.animate подменены: проверяется, что композабл с ними делает, — какие элементы
 * скрывает, с какими параметрами анимирует и что снимает при размонтировании.
 * Поведение в настоящем браузере — e2e tests/e2e/public/landing-reveal.spec.ts.
 */

type IoCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void

const observers: FakeObserver[] = []
class FakeObserver {
  observed = new Set<Element>()
  disconnected = false
  constructor(
    public callback: IoCallback,
    public options: IntersectionObserverInit,
  ) {
    observers.push(this)
  }
  observe(el: Element) {
    this.observed.add(el)
  }
  unobserve(el: Element) {
    this.observed.delete(el)
  }
  disconnect() {
    this.disconnected = true
    this.observed.clear()
  }
}

let reduced = false
const animateCalls: Array<{
  el: Element
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
}> = []
const cancelSpy = vi.fn()

/** top элемента по data-id: выше 600 (высота окна) — видим при загрузке. */
const TOPS: Record<string, number> = {
  load: 10,
  above: 100,
  edge: 599,
  below1: 600,
  below2: 900,
  below3: 1500,
}

const Host = defineComponent({
  setup() {
    const root = ref<HTMLElement | null>(null)
    useReveal(root)
    return () =>
      h('div', { ref: root }, [
        h('h1', { 'data-reveal': 'load', 'data-id': 'load' }),
        h('h2', { 'data-reveal': '', 'data-id': 'above' }),
        h('h2', { 'data-reveal': '', 'data-id': 'edge' }),
        h('h2', { 'data-reveal': '', 'data-id': 'below1' }),
        h('h2', { 'data-reveal': '', 'data-id': 'below2' }),
        h('h2', { 'data-reveal': '', 'data-id': 'below3' }),
        h('p', { 'data-id': 'plain' }),
      ])
  },
})

const byId = (wrapper: ReturnType<typeof mount>, id: string) =>
  wrapper.find(`[data-id="${id}"]`).element as HTMLElement

describe('useReveal', () => {
  beforeEach(() => {
    observers.length = 0
    animateCalls.length = 0
    cancelSpy.mockReset()
    reduced = false
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    vi.stubGlobal('innerHeight', 600)
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: reduced && query.includes('reduce') }) as MediaQueryList,
    )
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return { top: TOPS[this.dataset.id ?? ''] ?? 0 } as DOMRect
    })
    HTMLElement.prototype.animate = function (keyframes, options) {
      animateCalls.push({
        el: this,
        keyframes: keyframes as Keyframe[],
        options: options as KeyframeAnimationOptions,
      })
      return { finished: new Promise(() => {}), cancel: cancelSpy } as unknown as Animation
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('параметры — ровно из плана: 1.8s, 64px, cubic-bezier(.4,0,.2,1), шаг 160 мс, 78 % окна', () => {
    expect(REVEAL_DURATION_MS).toBe(1800)
    expect(REVEAL_SHIFT_PX).toBe(64)
    expect(REVEAL_EASING).toBe('cubic-bezier(.4,0,.2,1)')
    expect(REVEAL_STAGGER_MS).toBe(160)
    expect(REVEAL_ROOT_MARGIN).toBe('0px 0px -22% 0px')
  })

  it('скрывает только элементы ниже окна, видимые при загрузке не трогает', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const pending = ['load', 'above', 'edge', 'below1', 'below2', 'below3'].filter((id) =>
      byId(wrapper, id).classList.contains(REVEAL_PENDING_CLASS),
    )
    expect(pending).toEqual(['below1', 'below2', 'below3'])
    expect([...observers[0]!.observed].map((el) => (el as HTMLElement).dataset.id)).toEqual([
      'below1',
      'below2',
      'below3',
    ])
    expect(observers[0]!.options.rootMargin).toBe(REVEAL_ROOT_MARGIN)
    wrapper.unmount()
  })

  it('hero (data-reveal="load") анимируется при загрузке, без ожидания прокрутки', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    expect(animateCalls.map((c) => (c.el as HTMLElement).dataset.id)).toEqual(['load'])
    expect(byId(wrapper, 'load').classList.contains(REVEAL_PENDING_CLASS)).toBe(false)
    wrapper.unmount()
  })

  it('вход в зону — анимация с параметрами плана, задержки соседей 0/160/320, один раз', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const io = observers[0]!
    const below = ['below1', 'below2', 'below3'].map((id) => byId(wrapper, id))
    io.callback(below.map((target) => ({ isIntersecting: true, target })))

    const scrolled = animateCalls.slice(1)
    expect(scrolled.map((c) => c.el)).toEqual(below)
    expect(scrolled[0]!.keyframes).toEqual([
      { opacity: 0, transform: `translateY(${REVEAL_SHIFT_PX}px)` },
      { opacity: 1, transform: 'translateY(0)' },
    ])
    expect(scrolled[0]!.options).toMatchObject({
      duration: REVEAL_DURATION_MS,
      easing: REVEAL_EASING,
      fill: 'both',
    })
    // above=0, edge=1, below1=2, below2=0, below3=1 — порядок в документе среди data-reveal
    expect(scrolled.map((c) => c.options.delay)).toEqual([
      2 * REVEAL_STAGGER_MS,
      0,
      REVEAL_STAGGER_MS,
    ])
    expect(io.observed.size).toBe(0)

    io.callback([{ isIntersecting: true, target: below[0]! }])
    expect(animateCalls).toHaveLength(4)
    wrapper.unmount()
  })

  it('элемент вне зоны не анимируется', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    observers[0]!.callback([{ isIntersecting: false, target: byId(wrapper, 'below1') }])
    expect(animateCalls).toHaveLength(1)
    expect(byId(wrapper, 'below1').classList.contains(REVEAL_PENDING_CLASS)).toBe(true)
    wrapper.unmount()
  })

  it('сдвиг скрытого состояния ставится на корень из REVEAL_SHIFT_PX', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    expect((wrapper.element as HTMLElement).style.getPropertyValue(REVEAL_SHIFT_VAR)).toBe(
      `${REVEAL_SHIFT_PX}px`,
    )
    wrapper.unmount()
  })

  it('фокус внутри скрытого элемента показывает его сразу', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const el = byId(wrapper, 'below2')
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(el.classList.contains(REVEAL_PENDING_CLASS)).toBe(false)
    expect(byId(wrapper, 'below1').classList.contains(REVEAL_PENDING_CLASS)).toBe(true)
    wrapper.unmount()
  })

  it('prefers-reduced-motion: reduce — ничего не скрыто и не анимировано', () => {
    reduced = true
    const wrapper = mount(Host, { attachTo: document.body })
    expect(wrapper.findAll(`.${REVEAL_PENDING_CLASS}`)).toHaveLength(0)
    expect(animateCalls).toHaveLength(0)
    expect(observers).toHaveLength(0)
    wrapper.unmount()
  })

  it('размонтирование отключает наблюдатель и останавливает анимации', () => {
    const wrapper = mount(Host, { attachTo: document.body })
    const io = observers[0]!
    wrapper.unmount()
    expect(io.disconnected).toBe(true)
    expect(cancelSpy).toHaveBeenCalled()
  })
})
