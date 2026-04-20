import { watchEffect } from 'vue'

export function useHead({ title, description }) {
  watchEffect(() => {
    const t = typeof title === 'function' ? title() : title
    if (t) document.title = t
  })

  watchEffect(() => {
    const d = typeof description === 'function' ? description() : description
    if (d) {
      const meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', d)
    }
  })
}
