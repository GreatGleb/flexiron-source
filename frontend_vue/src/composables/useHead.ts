import { watchEffect } from 'vue'

/** Заголовок и описание страницы: либо значение, либо геттер для реактивного. */
type HeadSource = string | (() => string)

export function useHead({ title, description }: { title?: HeadSource; description?: HeadSource }) {
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
