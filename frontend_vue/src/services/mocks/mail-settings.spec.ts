import { describe, it, expect, beforeEach } from 'vitest'
import {
  mockGetMail,
  mockPatchMail,
  mockGetSettings,
  mockIsMailConfigured,
  mockSendMailTest,
} from './settings'

/**
 * Пароль от почты пишется и не читается.
 *
 * Это единственное требование пункта 12, которое нельзя проверить глазами по
 * форме: ответ сервера выглядит корректным и с паролем внутри. Поэтому проверка
 * идёт по всем путям чтения сразу — точечному и через полный срез настроек.
 */

const { passwordSet: _seedPasswordSet, ...SEED } = mockGetMail()

beforeEach(() => {
  mockPatchMail({ ...SEED, password: 'seed-smtp-token' })
})

describe('mail server settings', () => {
  it('never returns the password — on either read path', () => {
    mockPatchMail({ password: 'super-secret' })

    const direct = JSON.stringify(mockGetMail())
    const viaSettings = JSON.stringify(mockGetSettings())

    expect(direct).not.toContain('super-secret')
    expect(viaSettings).not.toContain('super-secret')
    expect(Object.keys(mockGetMail())).not.toContain('password')
  })

  it('reports that a password is set without revealing it', () => {
    mockPatchMail({ password: 'another-secret' })

    expect(mockGetMail().passwordSet).toBe(true)
  })

  it('keeps the stored password when the field is left empty', () => {
    mockPatchMail({ password: 'kept-secret' })
    mockPatchMail({ host: 'smtp.other.lt', password: '' })

    // Пустое поле — это «не менять», а не «стереть»: иначе правка порта
    // молча выключала бы отправку.
    expect(mockGetMail().passwordSet).toBe(true)
    expect(mockGetMail().host).toBe('smtp.other.lt')
  })

  it('merges only the fields it was given', () => {
    mockPatchMail({ port: 2525 })

    const mail = mockGetMail()
    expect(mail.port).toBe(2525)
    expect(mail.fromEmail).toBe(SEED.fromEmail)
  })

  it('reads the same mail settings from the full settings slice', () => {
    mockPatchMail({ fromName: 'Flexiron Sales' })

    expect(mockGetSettings().mail).toEqual(mockGetMail())
  })

  it('refuses the test email while the server is not fully configured', () => {
    mockPatchMail({ host: '' })

    expect(mockIsMailConfigured()).toBe(false)
    expect(() => mockSendMailTest()).toThrow('MAIL_NOT_CONFIGURED')
  })

  it('sends the test email to the sender address itself', () => {
    expect(mockSendMailTest()).toEqual({ deliveredTo: SEED.fromEmail })
  })
})
