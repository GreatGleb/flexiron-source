// @vitest-environment happy-dom
/**
 * `AUDIT_ENUM_MAP` и `translateAuditValue` жили дословной копией в пяти карточках
 * склада. Композабл `useAuditValueLabel` — единственное место, где они теперь
 * определены; эта спека доказывает и поведение (перевод / откат к исходному
 * значению), и то, что копия не вернулась ни в один из пяти экранов.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { translations } from '@/i18n/translations'
import { useAuditValueLabel } from './useAuditValueLabel'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: translations,
})

/** Композабл зовёт `useI18n()`, а тот требует setup — отсюда обёртка, а не прямой вызов. */
function inSetup<T>(factory: () => T): T {
  let result!: T
  mount(
    {
      setup() {
        result = factory()
        return () => null
      },
    },
    { global: { plugins: [i18n] } },
  )
  return result
}

describe('useAuditValueLabel — поведение', () => {
  it('значение из набора с переводом — переводится', () => {
    const translateAuditValue = inSetup(() => useAuditValueLabel())
    // 'write_off' лежит в movement_type_, и перевод warehouse.movement_type_write_off есть
    expect(translateAuditValue('write_off')).toBe(
      i18n.global.t('warehouse.movement_type_write_off'),
    )
    expect(translateAuditValue('write_off')).not.toBe('write_off')
  })

  it('значение из набора без перевода — возвращается как есть', () => {
    const translateAuditValue = inSetup(() => useAuditValueLabel())
    // 'used' лежит только в наборе status_, а перевода warehouse.status_used нет
    expect(translateAuditValue('used')).toBe('used')
  })

  it('значение вне всех наборов — возвращается как есть', () => {
    const translateAuditValue = inSetup(() => useAuditValueLabel())
    expect(translateAuditValue('not_a_real_audit_value')).toBe('not_a_real_audit_value')
  })
})

describe('useAuditValueLabel — копия не вернулась', () => {
  const VIEWS_DIR = join(__dirname, '..', 'views')

  function walk(dir: string): string[] {
    const out: string[] = []
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        out.push(...walk(full))
      } else if (/\.(vue|ts)$/.test(name)) {
        out.push(full)
      }
    }
    return out
  }

  it('обход src/views не находит AUDIT_ENUM_MAP ни в одном файле', () => {
    const files = walk(VIEWS_DIR)
    // пустой обход провалил бы утверждения ниже незаметно — считать файлы отдельно
    expect(files.length).toBeGreaterThanOrEqual(10)

    const withCopy = files.filter((f) => readFileSync(f, 'utf-8').includes('AUDIT_ENUM_MAP'))
    expect(withCopy).toEqual([])
  })
})
