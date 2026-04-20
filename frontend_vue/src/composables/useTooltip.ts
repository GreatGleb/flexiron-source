import type { Directive, DirectiveBinding } from 'vue'

const TOOLTIP_CSS = `
.js-action-tooltip {
  position: fixed;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #fff;
  font-size: 12px;
  z-index: 10000;
  max-width: 200px;
  opacity: 0;
  transition: opacity 0.2s ease;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected) return
  const style = document.createElement('style')
  style.setAttribute('data-tooltip', '')
  style.textContent = TOOLTIP_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

let tooltipEl: HTMLDivElement | null = null

function showTooltip(el: HTMLElement, text: string) {
  hideTooltip()
  if (!text) return
  ensureStyles()

  tooltipEl = document.createElement('div')
  tooltipEl.className = 'js-action-tooltip'
  tooltipEl.textContent = text
  document.body.appendChild(tooltipEl)

  const rect = el.getBoundingClientRect()
  const tipW = tooltipEl.offsetWidth
  const tipH = tooltipEl.offsetHeight
  const vw = window.innerWidth

  let left = rect.left + rect.width / 2 - tipW / 2
  if (left < 10) left = rect.left
  if (left + tipW > vw - 10) left = rect.right - tipW

  let top = rect.top - tipH - 8
  if (top < 10) top = rect.bottom + 8

  tooltipEl.style.left = `${left}px`
  tooltipEl.style.top = `${top}px`

  requestAnimationFrame(() => {
    if (tooltipEl) tooltipEl.style.opacity = '1'
  })
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.remove()
    tooltipEl = null
  }
}

function attach(el: HTMLElement, text: string) {
  const onEnter = () => showTooltip(el, text)
  const onLeave = () => hideTooltip()
  const onTouchStart = (e: TouchEvent) => {
    e.preventDefault()
    showTooltip(el, text)
  }

  el.addEventListener('mouseenter', onEnter)
  el.addEventListener('mouseleave', onLeave)
  el.addEventListener('touchstart', onTouchStart)
  el.addEventListener('touchend', onLeave)
  ;(el as HTMLElement & { __tooltipCleanup__?: () => void }).__tooltipCleanup__ = () => {
    el.removeEventListener('mouseenter', onEnter)
    el.removeEventListener('mouseleave', onLeave)
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onLeave)
  }
}

function detach(el: HTMLElement) {
  const cleanup = (el as HTMLElement & { __tooltipCleanup__?: () => void }).__tooltipCleanup__
  if (cleanup) cleanup()
}

export const vTooltip: Directive<HTMLElement, string> = {
  mounted(el, binding: DirectiveBinding<string>) {
    if (binding.value) attach(el, binding.value)
  },
  updated(el, binding: DirectiveBinding<string>) {
    detach(el)
    if (binding.value) attach(el, binding.value)
  },
  beforeUnmount(el) {
    detach(el)
    hideTooltip()
  },
}
