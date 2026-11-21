import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { TURNSTILE_SITE_KEY } from '@/config/landing'
import { loadTurnstile, type TurnstileApi } from '@/services/turnstile'

/**
 * Виджет Turnstile формы заявки (roo_code/plans/landing/landing-stage-2-plan.md, пункт 1).
 *
 * Статусы:
 * - `off` — site key пуст: капчи нет, токен не нужен;
 * - `waiting` — ключ есть, скрипт ещё не просили (форму не трогали);
 * - `loading` → `ready` (виджет на месте, токена нет) → `solved` (токен есть);
 * - `failed` — скрипт не загрузился или виджет сообщил об ошибке. Заявку тогда не отправить —
 *   форма показывает контакты. Если виджет сам оправился и выдал токен, статус снова `solved`.
 *
 * Токен одноразовый: сервер проверяет его один раз, поэтому после неудачной отправки — `reset()`.
 */
export type CaptchaStatus = 'off' | 'waiting' | 'loading' | 'ready' | 'solved' | 'failed'

export function useTurnstile(siteKey: string = TURNSTILE_SITE_KEY) {
  const status = ref<CaptchaStatus>(siteKey ? 'waiting' : 'off')
  const token = ref('')
  /** Куда рисовать виджет; в шаблоне — `ref` на контейнер. */
  const container = ref<HTMLElement | null>(null)
  /** Контейнер виджета нужен на странице, начиная с загрузки скрипта. */
  const active = computed(() => status.value !== 'off' && status.value !== 'waiting')

  let api: TurnstileApi | null = null
  let widgetId: string | null = null
  let disposed = false

  /** Первое касание формы: загрузить скрипт и нарисовать виджет. Повторные вызовы — без действия. */
  async function start() {
    if (status.value !== 'waiting') return
    status.value = 'loading'
    try {
      api = await loadTurnstile()
    } catch {
      status.value = 'failed'
      return
    }
    await nextTick()
    if (disposed) return
    if (!container.value) {
      status.value = 'failed'
      return
    }
    widgetId = api.render(container.value, {
      sitekey: siteKey,
      theme: 'dark',
      size: 'flexible',
      language: document.documentElement.lang || 'auto',
      callback: (value) => {
        token.value = value
        status.value = 'solved'
      },
      'expired-callback': () => {
        token.value = ''
        status.value = 'ready'
      },
      'error-callback': () => {
        token.value = ''
        status.value = 'failed'
      },
    })
    // Виджет мог выдать токен прямо внутри render — тогда статус уже `solved`.
    if (status.value === 'loading') status.value = 'ready'
  }

  /** Новый токен взамен израсходованного. */
  function reset() {
    token.value = ''
    if (!api || widgetId === null) return
    api.reset(widgetId)
    if (status.value === 'solved') status.value = 'ready'
  }

  onBeforeUnmount(() => {
    disposed = true
    if (api && widgetId !== null) api.remove(widgetId)
  })

  return { status, token, container, active, start, reset }
}
