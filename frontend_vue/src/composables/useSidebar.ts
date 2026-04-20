import { ref, onMounted, onUnmounted } from 'vue'

const MOBILE_BREAKPOINT = 860
const LS_KEY = 'sidebar-collapsed'

const collapsed = ref(false)
const active = ref(false)

function isMobile(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT
}

export function useSidebar() {
  function toggle() {
    if (isMobile()) {
      active.value = !active.value
    } else {
      collapsed.value = !collapsed.value
      localStorage.setItem(LS_KEY, String(collapsed.value))
    }
  }

  function close() {
    active.value = false
    collapsed.value = false
    localStorage.setItem(LS_KEY, 'false')
  }

  function closeMobileDrawer() {
    active.value = false
  }

  function handleBackdropClick(e: MouseEvent) {
    if (!isMobile() || !active.value) return
    const target = e.target as HTMLElement
    if (!target.closest('.sidebar') && !target.closest('.menu-toggle')) {
      active.value = false
    }
  }

  function handleResize() {
    if (!isMobile() && active.value) {
      active.value = false
    }
  }

  onMounted(() => {
    collapsed.value = localStorage.getItem(LS_KEY) === 'true' && !isMobile()
    document.addEventListener('click', handleBackdropClick)
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleBackdropClick)
    window.removeEventListener('resize', handleResize)
  })

  return {
    collapsed,
    active,
    toggle,
    close,
    closeMobileDrawer,
  }
}
