// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useTurnstile } from './useTurnstile'
import {
  loadTurnstile,
  TURNSTILE_SCRIPT_URL,
  type ScriptHost,
  type TurnstileApi,
  type TurnstileRenderOptions,
} from '@/services/turnstile'

/**
 * Капча формы заявки (этап 2 лендинга, пункт 1). Настоящий Turnstile — внешний скрипт; здесь он
 * заменён объектом `window.turnstile` с тем же API, а загрузчик — подставным документом:
 * happy-dom в сеть не ходит, и проверяется ровно наша часть — когда грузим, что рисуем,
 * как ведём статус и токен.
 */

interface FakeApi extends TurnstileApi {
  options: TurnstileRenderOptions[]
  resets: string[]
  removed: string[]
  hosts: HTMLElement[]
}

function fakeApi(): FakeApi {
  const api: FakeApi = {
    options: [],
    resets: [],
    removed: [],
    hosts: [],
    render: (el, options) => {
      api.hosts.push(el)
      api.options.push(options)
      return 'w1'
    },
    reset: (id) => {
      api.resets.push(id)
    },
    remove: (id) => {
      api.removed.push(id)
    },
  }
  return api
}

/** Опции последнего render; нет — тест падает с понятной причиной. */
function lastOptions(api: FakeApi): TurnstileRenderOptions {
  const options = api.options.at(-1)
  if (!options) throw new Error('render не вызывался')
  return options
}

/** Компонент с контейнером, как в форме: контейнер есть, пока капча активна. */
function host(siteKey: string) {
  let captcha!: ReturnType<typeof useTurnstile>
  const Comp = defineComponent({
    setup() {
      captcha = useTurnstile(siteKey)
      return () =>
        captcha.active.value ? h('div', { ref: captcha.container, 'data-test': 'box' }) : h('span')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, captcha: () => captcha }
}

afterEach(() => {
  delete window.turnstile
})

describe('useTurnstile', () => {
  it('ключа нет — off, start ничего не грузит', async () => {
    const { captcha } = host('')
    expect(captcha().status.value).toBe('off')
    await captcha().start()
    expect(captcha().status.value).toBe('off')
    expect(captcha().active.value).toBe(false)
  })

  it('до первого касания — waiting, контейнера нет', () => {
    const { wrapper, captcha } = host('site-key')
    expect(captcha().status.value).toBe('waiting')
    expect(wrapper.find('[data-test="box"]').exists()).toBe(false)
  })

  it('start рисует виджет в контейнер с нашим ключом, тёмной темой и языком страницы', async () => {
    const api = fakeApi()
    window.turnstile = api
    document.documentElement.lang = 'ru'
    const { wrapper, captcha } = host('site-key')
    await captcha().start()
    expect(captcha().status.value).toBe('ready')
    expect(api.hosts).toEqual([wrapper.get('[data-test="box"]').element])
    const options = lastOptions(api)
    expect(options.sitekey).toBe('site-key')
    expect(options.theme).toBe('dark')
    expect(options.language).toBe('ru')
    // Повторное касание — второго виджета нет.
    await captcha().start()
    expect(api.options).toHaveLength(1)
  })

  it('токен → solved; истёк → ready и пустой токен; ошибка → failed', async () => {
    const api = fakeApi()
    window.turnstile = api
    const { captcha } = host('site-key')
    await captcha().start()
    const options = lastOptions(api)
    options.callback('tok-1')
    expect(captcha().token.value).toBe('tok-1')
    expect(captcha().status.value).toBe('solved')
    options['expired-callback']()
    expect(captcha().token.value).toBe('')
    expect(captcha().status.value).toBe('ready')
    options['error-callback']()
    expect(captcha().status.value).toBe('failed')
    // Виджет сам оправился — снова solved.
    options.callback('tok-2')
    expect(captcha().status.value).toBe('solved')
  })

  it('reset: токен пуст, виджет сброшен, статус ready', async () => {
    const api = fakeApi()
    window.turnstile = api
    const { captcha } = host('site-key')
    await captcha().start()
    lastOptions(api).callback('tok')
    captcha().reset()
    expect(captcha().token.value).toBe('')
    expect(api.resets).toEqual(['w1'])
    expect(captcha().status.value).toBe('ready')
  })

  it('уход со страницы убирает виджет', async () => {
    const api = fakeApi()
    window.turnstile = api
    const { wrapper, captcha } = host('site-key')
    await captcha().start()
    wrapper.unmount()
    expect(api.removed).toEqual(['w1'])
  })

  it('скрипт не загрузился → failed', async () => {
    const appendChild = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      ;(node as HTMLScriptElement).onerror?.(new Event('error'))
      return node
    })
    const { captcha } = host('site-key')
    await captcha().start()
    expect(captcha().status.value).toBe('failed')
    appendChild.mockRestore()
  })
})

/** Подставной документ: скрипт не исполняется, тест сам решает, загрузился ли он. */
function scriptHost() {
  const scripts: HTMLScriptElement[] = []
  const host: ScriptHost = {
    createElement: () => ({}) as HTMLScriptElement,
    head: {
      appendChild: (node) => {
        scripts.push(node)
        return node
      },
    },
  }
  return { host, scripts }
}

function only<T>(list: T[]): T {
  if (list.length !== 1) throw new Error(`ожидался один элемент, а их ${list.length}`)
  return list[0] as T
}

describe('loadTurnstile', () => {
  it('API уже на странице — скрипт не добавляется', async () => {
    const api = fakeApi()
    window.turnstile = api
    const { host, scripts } = scriptHost()
    await expect(loadTurnstile(host)).resolves.toBe(api)
    expect(scripts).toEqual([])
  })

  it('один скрипт на несколько вызовов, с адреса Cloudflare в явном режиме', async () => {
    const { host, scripts } = scriptHost()
    const first = loadTurnstile(host)
    const second = loadTurnstile(host)
    const script = only(scripts)
    expect(script.src).toBe(TURNSTILE_SCRIPT_URL)
    expect(script.src).toContain('render=explicit')
    expect(script.async).toBe(true)
    const api = fakeApi()
    window.turnstile = api
    script.onload?.(new Event('load'))
    await expect(first).resolves.toBe(api)
    await expect(second).resolves.toBe(api)
  })

  it('не загрузился — отказ, и следующий вызов пробует снова', async () => {
    const { host, scripts } = scriptHost()
    const first = loadTurnstile(host)
    only(scripts).onerror?.(new Event('error'))
    await expect(first).rejects.toThrow('не загрузился')
    const second = loadTurnstile(host)
    expect(scripts).toHaveLength(2)
    window.turnstile = fakeApi()
    scripts[1]?.onload?.(new Event('load'))
    await expect(second).resolves.toBe(window.turnstile)
  })

  it('скрипт загрузился, а API нет — отказ', async () => {
    const { host, scripts } = scriptHost()
    const pending = loadTurnstile(host)
    only(scripts).onload?.(new Event('load'))
    await expect(pending).rejects.toThrow('API нет')
    await nextTick()
  })
})
