// @vitest-environment happy-dom

/**
 * Поведение `useFontRemeasure`, а не его наличие.
 *
 * До 2026-09-25 за этой подпиской не стояло ни одного красного теста: правка
 * `MultiSelect` была внесена по правилу, потому что заставить счётчик тегов
 * разойтись на реальных данных проекта не удалось (БАГ-04, половина ✅). Краевого
 * случая в сегодняшних категориях нет — но это говорит о ДАННЫХ, а не о механизме.
 * Сам механизм проверяем: он либо зовёт замер заново, когда шрифт доехал, либо нет.
 *
 * `document.fonts` в happy-dom нет, поэтому подставляется минимальный двойник
 * `FontFaceSet`: `EventTarget` плюс `ready`. Это не ослабление — композабл ровно
 * этих двух вещей и просит, и подменять больше нечего.
 */

import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useFontRemeasure } from './useFontRemeasure'

class FakeFontFaceSet extends EventTarget {
  ready: Promise<unknown>
  private resolveReady!: (value: unknown) => void

  constructor() {
    super()
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve
    })
  }

  /** Шрифты этого монтирования доехали. */
  settle(): void {
    this.resolveReady(this)
  }

  /** Доехало начертание, о котором в момент монтирования ещё не знали. */
  loadingDone(): void {
    this.dispatchEvent(new Event('loadingdone'))
  }
}

function install(): FakeFontFaceSet {
  const fonts = new FakeFontFaceSet()
  Object.defineProperty(document, 'fonts', { value: fonts, configurable: true })
  return fonts
}

function subscriber(remeasure: () => void) {
  return defineComponent({
    setup() {
      useFontRemeasure(remeasure)
      return () => h('div')
    },
  })
}

/** Дать разрешиться `nextTick` + `ready.then(...)` — два звена микрозадач. */
async function settleMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  Reflect.deleteProperty(document, 'fonts')
})

describe('useFontRemeasure', () => {
  it('не зовёт замер сам по себе — до шрифтов поводу неоткуда взяться', async () => {
    const fonts = install()
    const remeasure = vi.fn()
    mount(subscriber(remeasure))

    await settleMicrotasks()

    expect(remeasure).not.toHaveBeenCalled()
    expect(fonts).toBeInstanceOf(FakeFontFaceSet)
  })

  it('зовёт замер, когда разрешился `fonts.ready`', async () => {
    const fonts = install()
    const remeasure = vi.fn()
    mount(subscriber(remeasure))

    fonts.settle()
    await settleMicrotasks()

    expect(remeasure).toHaveBeenCalledTimes(1)
  })

  it('зовёт замер на каждое `loadingdone` — начертание может доехать и позже', async () => {
    const fonts = install()
    const remeasure = vi.fn()
    mount(subscriber(remeasure))
    await settleMicrotasks()

    fonts.loadingDone()
    fonts.loadingDone()

    // `ready` этого монтирования ещё не разрешался: оба вызова — от события.
    expect(remeasure).toHaveBeenCalledTimes(2)
  })

  it('после размонтирования не зовёт ничего — подписка снята', async () => {
    const fonts = install()
    const remeasure = vi.fn()
    const wrapper = mount(subscriber(remeasure))
    await settleMicrotasks()

    wrapper.unmount()
    fonts.loadingDone()

    expect(remeasure).not.toHaveBeenCalled()
  })

  it('не падает там, где `document.fonts` нет вовсе', async () => {
    Reflect.deleteProperty(document, 'fonts')
    const remeasure = vi.fn()

    const wrapper = mount(subscriber(remeasure))
    await settleMicrotasks()
    wrapper.unmount()

    expect(remeasure).not.toHaveBeenCalled()
  })
})
