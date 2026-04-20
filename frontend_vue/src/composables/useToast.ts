import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  message: string
  type: ToastType
  /** Drives the .show class — off initially and after duration expires, on in between, so CSS transitions animate enter/exit. */
  visible: boolean
}

const state = reactive<{ toasts: Toast[] }>({ toasts: [] })
let nextId = 1

const ENTER_DELAY_MS = 50 // gives the browser a frame to paint with .toast offscreen before .show slides it in
const EXIT_DURATION_MS = 500 // must match the CSS transition on .toast

export function useToast() {
  function show(message: string, type: ToastType = 'success', duration = 3000) {
    const id = nextId++
    const toast: Toast = reactive({ id, message, type, visible: false })
    state.toasts.push(toast)

    // Enter: flip visible=true after a tick so transition runs
    setTimeout(() => {
      toast.visible = true
    }, ENTER_DELAY_MS)

    // Exit: unset visible, wait for transition, then remove from list
    setTimeout(() => {
      toast.visible = false
      setTimeout(() => {
        const idx = state.toasts.findIndex((t) => t.id === id)
        if (idx !== -1) state.toasts.splice(idx, 1)
      }, EXIT_DURATION_MS)
    }, duration)
  }

  function success(message: string) {
    show(message, 'success')
  }

  function error(message: string) {
    show(message, 'error')
  }

  function info(message: string) {
    show(message, 'info')
  }

  function dismiss(id: number) {
    const toast = state.toasts.find((t) => t.id === id)
    if (!toast) return
    toast.visible = false
    setTimeout(() => {
      const idx = state.toasts.findIndex((t) => t.id === id)
      if (idx !== -1) state.toasts.splice(idx, 1)
    }, EXIT_DURATION_MS)
  }

  return { toasts: state.toasts, show, success, error, info, dismiss }
}
