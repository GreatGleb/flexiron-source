/*
 * Появление блоков лендинга (план roo_code/plans/landing/landing-plan.md, раздел «Движение»;
 * образец — AIQME V2, legacy-landing/github-pages/assets/motion-v2/motion.js).
 *
 * Единственный механизм появления на странице. Элемент помечается атрибутом:
 *   data-reveal         — появится при входе в верхние 78 % окна, один раз;
 *   data-reveal="load"  — появится сразу при загрузке, без ожидания прокрутки (hero).
 *
 * Параметры: opacity 0→1, подъём 64px→0, 1.8s, cubic-bezier(.4,0,.2,1), задержки соседей
 * 0/160/320 мс по порядку в документе (i % 3), запуск по rootMargin '0px 0px -22% 0px'.
 *
 * Без мигания: класс .reveal-pending (скрытое начальное состояние, landing.css) получают только
 * элементы ниже окна на момент монтирования; уже видимые не трогаются. WAAPI держит начальный
 * кадр во время задержки (fill: 'both'); по окончании сначала снимается .reveal-pending, потом
 * анимация. prefers-reduced-motion: reduce — ничего не скрывается и не анимируется.
 * Фокус внутри скрытого элемента показывает его сразу (клавиатура не попадает в невидимое).
 */
import { onMounted, onUnmounted, type Ref } from 'vue'

export const REVEAL_DURATION_MS = 1800
export const REVEAL_SHIFT_PX = 64
export const REVEAL_EASING = 'cubic-bezier(.4,0,.2,1)'
/** Задержки соседей 0/160/320 мс: (i % 3) * 160. */
export const REVEAL_STAGGER_MS = 160
/** Запуск при входе в верхние 78 % окна. */
export const REVEAL_ROOT_MARGIN = '0px 0px -22% 0px'
export const REVEAL_PENDING_CLASS = 'reveal-pending'
/** Сдвиг скрытого состояния берёт .reveal-pending в landing.css — число живёт только здесь. */
export const REVEAL_SHIFT_VAR = '--landing-reveal-shift'

const KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: `translateY(${REVEAL_SHIFT_PX}px)` },
  { opacity: 1, transform: 'translateY(0)' },
]

export function useReveal(root: Ref<HTMLElement | null>) {
  let observer: IntersectionObserver | null = null
  const animations = new Map<Element, Animation>()
  const delays = new Map<Element, number>()
  const pending = new Set<Element>()

  function settle(el: Element) {
    pending.delete(el)
    observer?.unobserve(el)
    el.classList.remove(REVEAL_PENDING_CLASS)
    animations.get(el)?.cancel()
    animations.delete(el)
  }

  function play(el: Element) {
    const animation = el.animate(KEYFRAMES, {
      duration: REVEAL_DURATION_MS,
      delay: delays.get(el) ?? 0,
      easing: REVEAL_EASING,
      fill: 'both',
    })
    animations.set(el, animation)
    animation.finished.then(
      () => settle(el),
      () => el.classList.remove(REVEAL_PENDING_CLASS),
    )
  }

  function onFocusIn(event: FocusEvent) {
    for (const el of pending) {
      if (el.contains(event.target as Node)) settle(el)
    }
  }

  onMounted(() => {
    const host = root.value
    if (!host) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    host.style.setProperty(REVEAL_SHIFT_VAR, `${REVEAL_SHIFT_PX}px`)

    const onLoad = [...host.querySelectorAll<HTMLElement>('[data-reveal="load"]')]
    onLoad.forEach((el, i) => delays.set(el, (i % 3) * REVEAL_STAGGER_MS))
    const onScroll = [
      ...host.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal="load"])'),
    ]
    onScroll.forEach((el, i) => delays.set(el, (i % 3) * REVEAL_STAGGER_MS))

    onLoad.forEach(play)

    for (const el of onScroll) {
      if (el.getBoundingClientRect().top >= window.innerHeight) {
        el.classList.add(REVEAL_PENDING_CLASS)
        pending.add(el)
      }
    }
    if (pending.size === 0) return

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !pending.has(entry.target)) continue
          pending.delete(entry.target)
          observer?.unobserve(entry.target)
          play(entry.target)
        }
      },
      { rootMargin: REVEAL_ROOT_MARGIN, threshold: 0 },
    )
    pending.forEach((el) => observer?.observe(el))
    document.addEventListener('focusin', onFocusIn)
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
    document.removeEventListener('focusin', onFocusIn)
    animations.forEach((animation) => animation.cancel())
    animations.clear()
  })
}
