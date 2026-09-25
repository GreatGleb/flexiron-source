import { describe, it, expect } from 'vitest'
import { NOTIFICATION_TYPES, NOTIFICATION_TYPE_ICONS } from '@/types/notifications'
import { adminNotifications } from '@/i18n/admin/notifications'

/**
 * Перечень типов уведомления объявлен один раз в `types/notifications.ts`
 * (`NOTIFICATION_TYPES`). Эта спека держит остальные места, которые обязаны
 * быть его проекцией — переводы и иконки, — согласованными с ним в обе стороны:
 * тип без перевода/иконки, и перевод/иконка без типа в перечне.
 */

const LOCALES = ['ru', 'en', 'lt'] as const

function typeDict(locale: (typeof LOCALES)[number]): Record<string, string> {
  return adminNotifications[locale].notifications as Record<string, string>
}

describe('перечень типов уведомления — один источник', () => {
  it('у каждого типа есть непустой перевод type_<тип> в ru, en и lt', () => {
    for (const locale of LOCALES) {
      const dict = typeDict(locale)
      for (const type of NOTIFICATION_TYPES) {
        expect(dict[`type_${type}`], `${locale}.type_${type}`).toBeTruthy()
      }
    }
  })

  it('у каждого типа есть иконка в NOTIFICATION_TYPE_ICONS', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(NOTIFICATION_TYPE_ICONS[type], type).toBeTruthy()
    }
  })

  it('в блоке переводов каждой локали нет ключа type_*, которого нет в перечне', () => {
    const known = new Set(NOTIFICATION_TYPES.map((type) => `type_${type}`))
    for (const locale of LOCALES) {
      const dict = typeDict(locale)
      const extra = Object.keys(dict).filter((key) => key.startsWith('type_') && !known.has(key))
      expect(extra, locale).toEqual([])
    }
  })
})
