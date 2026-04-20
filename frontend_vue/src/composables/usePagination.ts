import { ref, computed } from 'vue'

export function usePagination(defaultPageSize = 25) {
  const page = ref(1)
  const pageSize = ref(defaultPageSize)
  const total = ref(0)

  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const hasPrev = computed(() => page.value > 1)
  const hasNext = computed(() => page.value < totalPages.value)

  const showingFrom = computed(() => Math.min((page.value - 1) * pageSize.value + 1, total.value))
  const showingTo = computed(() => Math.min(page.value * pageSize.value, total.value))

  function pageNumbers(): (number | '...')[] {
    const n = totalPages.value
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)

    if (page.value <= 3) return [1, 2, 3, 4, '...', n]
    if (page.value >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
    return [1, '...', page.value - 1, page.value, page.value + 1, '...', n]
  }

  function goTo(p: number) {
    page.value = Math.max(1, Math.min(p, totalPages.value))
  }

  function prev() {
    if (hasPrev.value) page.value--
  }

  function next() {
    if (hasNext.value) page.value++
  }

  function reset() {
    page.value = 1
  }

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrev,
    hasNext,
    showingFrom,
    showingTo,
    pageNumbers,
    goTo,
    prev,
    next,
    reset,
  }
}
