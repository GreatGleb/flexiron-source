import { describe, it, expect } from 'vitest'
import { isMailConfigured } from './settings'
import type { MailServerSettings } from './settings'

/**
 * «Почтовый сервер настроен» — одно правило на весь проект.
 *
 * Раньше оно было записано трижды: гейт кнопки теста в `MailSettings.vue`, гейт
 * кнопки Send в `useBccRequest.ts` (две записи посимвольно одинаковы) и отказ
 * сервера в `mockIsMailConfigured` (третья формулировка, по самому паролю). Ни
 * typecheck, ни jscpd, ни sonarjs такого выражения не видят — разъехались бы они
 * молча. Здесь правило проверяется там же, где теперь живёт: по одному факту на
 * каждое условие, чтобы выпавшее условие роняло свой тест, а не «какой-нибудь».
 */

const CONFIGURED: MailServerSettings = {
  host: 'smtp.flexiron.lt',
  port: 587,
  encryption: 'starttls',
  username: 'sales@flexiron.lt',
  passwordSet: true,
  fromEmail: 'sales@flexiron.lt',
  fromName: 'Flexiron Sales',
}

describe('isMailConfigured', () => {
  it('полностью заполненный сервер настроен', () => {
    expect(isMailConfigured(CONFIGURED)).toBe(true)
  })

  it('без хоста слать некуда', () => {
    expect(isMailConfigured({ ...CONFIGURED, host: '' })).toBe(false)
  })

  it('без адреса отправителя слать не от кого', () => {
    expect(isMailConfigured({ ...CONFIGURED, fromEmail: '' })).toBe(false)
  })

  it('без заданного пароля сервер не пустит', () => {
    expect(isMailConfigured({ ...CONFIGURED, passwordSet: false })).toBe(false)
  })

  it('поля, от которых правило не зависит, на ответ не влияют', () => {
    // Логин и имя отправителя обязательными не объявлялись: спека 04.2 §6 требует
    // их в форме, но письмо уходит и без них. Тест фиксирует именно это решение —
    // если условие добавят, он покраснеет здесь, а не разъедется по трём файлам.
    const withoutOptional: MailServerSettings = { ...CONFIGURED, username: '', fromName: '' }
    expect(isMailConfigured(withoutOptional)).toBe(true)
  })
})
