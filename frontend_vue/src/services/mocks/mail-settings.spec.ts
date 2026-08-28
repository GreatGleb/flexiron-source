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

  /**
   * Вердикт сервера по состояниям, до которых стор доводится извне.
   *
   * Утверждение здесь одно и названо прямо: ожидаемый вердикт для каждого
   * состояния — литералом, а не сравнением с тем же правилом. Сравнение
   * `mockIsMailConfigured()` с `isMailConfigured(mockGetMail())` стояло тут
   * раньше и не проверяло ничего: после дедупликации это посимвольно одно и то
   * же выражение, то есть тавтология ровно на том случае, ради которого была
   * объявлена (питфолл #68 — утверждение, которое устраивает бездействие).
   *
   * Что этот кейс ловит: расхождение переписанного правила — своя формулировка
   * у сервера, потерявшая условие. Чего НЕ ловит: возврат исторического дубля
   * `Boolean(mailStore.host && mailStore.fromEmail && mailPassword)` — он
   * поведенчески тождествен `isMailConfigured(mockGetMail())`, потому что
   * `passwordSet === mailPassword.length > 0`. Такой возврат не ловится и не
   * может быть пойман никаким тестом; дедупликация покупает не сегодняшнее
   * поведение, а невозможность разъехаться завтра — журнал `followups-12.md`.
   */
  it('сервер отказывает ровно в тех состояниях, где отправлять нечем', () => {
    const states = [
      { patch: { host: 'smtp.flexiron.lt', fromEmail: 'sales@flexiron.lt' }, configured: true },
      { patch: { host: '', fromEmail: 'sales@flexiron.lt' }, configured: false },
      { patch: { host: 'smtp.flexiron.lt', fromEmail: '' }, configured: false },
      { patch: { host: '', fromEmail: '' }, configured: false },
    ]

    for (const { patch, configured } of states) {
      mockPatchMail(patch)
      expect(mockIsMailConfigured()).toBe(configured)
      // Вердикт виден снаружи, а не только через свой же предикат: отказ
      // тестового письма — то, что получает форма.
      if (configured) {
        expect(mockSendMailTest()).toEqual({ deliveredTo: patch.fromEmail })
      } else {
        expect(() => mockSendMailTest()).toThrow('MAIL_NOT_CONFIGURED')
      }
    }
  })
})
