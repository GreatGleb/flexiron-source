/**
 * Заявка лендинга (L-02, roo_code/plans/landing/tasks.json).
 *
 * Что держит спека: правило валидации формы (лимиты, обязательность, телефон/e-mail,
 * trim), ловушку и тело запроса; и то, что Code.gs — вторая среда исполнения того же
 * правила — несёт те же лимиты и выражения (Л5) и на тех же входах решает так же.
 * Code.gs не только разбирается, но и исполняется в `node:vm` с заглушками сервисов
 * Google — так проверяются лист `Leads`, апостроф, LockService и doGet.
 * Инверсия каждого утверждения — в roo_code/plans/landing/progress.md, раздел L-02.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { EMAIL_RE, LIMITS, PHONE_RE, isHoneypot, toPayload, validateLead } from './landingLead'
import type { LeadDraft } from './landingLead'

const draft = (patch: Partial<LeadDraft> = {}): LeadDraft => ({
  name: 'Иван',
  company: '',
  contact: '+370 600 00000',
  message: '',
  website: '',
  ...patch,
})

describe('validateLead — имя', () => {
  it('корректная заявка проходит, ошибок нет', () => {
    expect(validateLead(draft())).toEqual({ ok: true, errors: {} })
  })

  it('пустое имя — required', () => {
    expect(validateLead(draft({ name: '' }))).toEqual({ ok: false, errors: { name: 'required' } })
  })

  it('имя из одних пробелов — required (сначала trim)', () => {
    expect(validateLead(draft({ name: '  \t ' })).errors).toEqual({ name: 'required' })
  })

  it('100 символов — можно, 101 — tooLong', () => {
    expect(validateLead(draft({ name: 'я'.repeat(100) })).ok).toBe(true)
    expect(validateLead(draft({ name: 'я'.repeat(101) })).errors).toEqual({ name: 'tooLong' })
  })

  it('длина считается после trim: 100 символов в пробелах — можно', () => {
    expect(validateLead(draft({ name: `  ${'я'.repeat(100)}  ` })).ok).toBe(true)
  })
})

describe('validateLead — компания', () => {
  it('необязательна: пустая не даёт ошибки', () => {
    expect(validateLead(draft({ company: '   ' })).errors).toEqual({})
  })

  it('150 — можно, 151 — tooLong', () => {
    expect(validateLead(draft({ company: 'к'.repeat(150) })).ok).toBe(true)
    expect(validateLead(draft({ company: 'к'.repeat(151) })).errors).toEqual({
      company: 'tooLong',
    })
  })
})

describe('validateLead — телефон или e-mail', () => {
  it('пустой контакт — required', () => {
    expect(validateLead(draft({ contact: ' ' })).errors).toEqual({ contact: 'required' })
  })

  it('телефон из 6 цифр — invalidContact, из 7 — можно', () => {
    expect(validateLead(draft({ contact: '12-34-56' })).errors).toEqual({
      contact: 'invalidContact',
    })
    expect(validateLead(draft({ contact: '123-45-67' })).ok).toBe(true)
  })

  it('телефон с привычными разделителями проходит', () => {
    expect(validateLead(draft({ contact: '+7 (912) 345-67.89' })).ok).toBe(true)
  })

  it('цифры среди букв — не телефон', () => {
    expect(validateLead(draft({ contact: 'звоните 1234567' })).errors).toEqual({
      contact: 'invalidContact',
    })
  })

  it('e-mail без точки в домене — invalidContact', () => {
    expect(validateLead(draft({ contact: 'ivan@mail' })).errors).toEqual({
      contact: 'invalidContact',
    })
  })

  it('e-mail с пустой частью домена — invalidContact', () => {
    for (const contact of [
      'ivan@.ru',
      'ivan@mail.',
      'ivan@mail..ru',
      '@mail.ru',
      'iv an@mail.ru',
    ]) {
      expect(validateLead(draft({ contact })).errors, contact).toEqual({
        contact: 'invalidContact',
      })
    }
  })

  it('валидный e-mail проходит, и пробелы вокруг него не мешают', () => {
    expect(validateLead(draft({ contact: 'ivan.petrov@metal-baza.lt' })).ok).toBe(true)
    expect(validateLead(draft({ contact: '  ivan@mail.ru  ' })).ok).toBe(true)
  })

  it('150 — можно, 151 — tooLong (а не invalidContact)', () => {
    const at = (n: number) => `${'a'.repeat(n - '@mail.ru'.length)}@mail.ru`
    expect(validateLead(draft({ contact: at(150) })).ok).toBe(true)
    expect(validateLead(draft({ contact: at(151) })).errors).toEqual({ contact: 'tooLong' })
  })
})

describe('validateLead — комментарий', () => {
  it('необязателен', () => {
    expect(validateLead(draft({ message: '' })).ok).toBe(true)
  })

  it('1000 — можно, 1001 — tooLong', () => {
    expect(validateLead(draft({ message: 'м'.repeat(1000) })).ok).toBe(true)
    expect(validateLead(draft({ message: 'м'.repeat(1001) })).errors).toEqual({
      message: 'tooLong',
    })
  })
})

describe('validateLead — несколько ошибок', () => {
  it('ошибка у каждого неверного поля, ok = false', () => {
    expect(validateLead(draft({ name: '', contact: 'x@y', message: 'м'.repeat(1001) }))).toEqual({
      ok: false,
      errors: { name: 'required', contact: 'invalidContact', message: 'tooLong' },
    })
  })
})

describe('isHoneypot', () => {
  it('пустая ловушка — человек', () => {
    expect(isHoneypot(draft())).toBe(false)
    expect(isHoneypot(draft({ website: '  ' }))).toBe(false)
  })

  it('заполненная ловушка — бот', () => {
    expect(isHoneypot(draft({ website: 'http://spam.example' }))).toBe(true)
  })
})

describe('toPayload', () => {
  it('строки постриженные, ловушка не уходит, page и userAgent как есть', () => {
    const payload = toPayload(
      draft({
        name: '  Иван ',
        company: ' ООО Металл ',
        contact: ' ivan@mail.ru ',
        message: '\n Два склада \n',
        website: 'бот',
      }),
      'https://example.test/#lead',
      'UA/1.0',
    )
    expect(payload).toEqual({
      name: 'Иван',
      company: 'ООО Металл',
      contact: 'ivan@mail.ru',
      message: 'Два склада',
      page: 'https://example.test/#lead',
      userAgent: 'UA/1.0',
    })
  })

  it('пустые и пробельные поля → пустая строка', () => {
    const payload = toPayload(draft({ company: '   ', message: '' }), '', '')
    expect(payload.company).toBe('')
    expect(payload.message).toBe('')
  })
})

// ─── Code.gs — вторая среда исполнения того же правила (Л5) ─────────────────────────────

const CODE_GS_PATH = resolve(__dirname, '..', '..', '..', 'apps-script', 'landing-leads', 'Code.gs')
const CODE_GS = readFileSync(CODE_GS_PATH, 'utf8')

function gsConst(name: string): string {
  const match = new RegExp(`^const ${name} = (.+);$`, 'm').exec(CODE_GS)
  if (!match?.[1]) throw new Error(`в Code.gs нет строки «const ${name} = …;»`)
  return match[1]
}

describe('Code.gs — лимиты и выражения совпадают с доменом', () => {
  it.each([
    ['NAME_MAX', LIMITS.name],
    ['COMPANY_MAX', LIMITS.company],
    ['CONTACT_MAX', LIMITS.contact],
    ['MESSAGE_MAX', LIMITS.message],
    ['PHONE_MIN_DIGITS', LIMITS.phoneMinDigits],
  ])('%s = LIMITS', (name, value) => {
    expect(Number(gsConst(name))).toBe(value)
  })

  it.each([
    ['EMAIL_RE', EMAIL_RE],
    ['PHONE_RE', PHONE_RE],
  ])('%s совпадает с доменом', (name, re) => {
    expect(gsConst(name)).toBe(re.toString())
  })
})

/** Элемент по индексу; нет его — тест падает с понятной причиной, а не на `undefined`. */
function at<T>(list: readonly T[], index: number): T {
  const item = list[index]
  if (item === undefined) throw new Error(`нет элемента ${index} из ${list.length}`)
  return item
}

interface FakeSheet {
  name: string
  rows: string[][]
  frozen: number
}

/** Заглушки сервисов Google ровно в том объёме, в каком их зовёт Code.gs. */
function loadCodeGs(
  opts: { sheets?: FakeSheet[]; notifyEmail?: string; mailFails?: boolean } = {},
) {
  const sheets = opts.sheets ?? []
  const mails: { to: string; subject: string; body: string }[] = []
  const lock = { waits: 0, releases: 0 }
  const sheetApi = (sheet: FakeSheet) => ({
    getLastRow: () => sheet.rows.length,
    getRange: (row: number, _col: number, _nr: number, ncol: number) => ({
      setValues: (values: string[][]) => {
        sheet.rows[row - 1] = at(values, 0).slice(0, ncol)
      },
    }),
    setFrozenRows: (n: number) => {
      sheet.frozen = n
    },
    appendRow: (row: string[]) => {
      sheet.rows.push(row)
    },
  })
  const errors: string[] = []
  const context = createContext({
    console: { error: (msg: string) => errors.push(msg) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => {
          const found = sheets.find((s) => s.name === name)
          return found ? sheetApi(found) : null
        },
        insertSheet: (name: string) => {
          const sheet: FakeSheet = { name, rows: [], frozen: 0 }
          sheets.push(sheet)
          return sheetApi(sheet)
        },
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          lock.waits++
        },
        releaseLock: () => {
          lock.releases++
        },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => (key === 'NOTIFY_EMAIL' ? (opts.notifyEmail ?? null) : null),
      }),
    },
    MailApp: {
      sendEmail: (to: string, subject: string, body: string) => {
        if (opts.mailFails) throw new Error('quota')
        mails.push({ to, subject, body })
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => ({
        setMimeType: (mime: string) => ({ text, mime }),
      }),
    },
  })
  // Исполняется файл из этого же репозитория, а не пришедший извне ввод — ради этого спека и есть.
  // eslint-disable-next-line sonarjs/code-eval
  runInContext(CODE_GS, context)
  // Объявления `function` в Code.gs становятся свойствами глобального объекта контекста.
  const entry = context as Record<'doGet' | 'doPost', (arg?: unknown) => unknown>
  const call = (fn: 'doGet' | 'doPost', arg?: unknown) => {
    const out = entry[fn](arg) as { text: string; mime: string }
    expect(out.mime).toBe('application/json')
    return JSON.parse(out.text) as { ok: boolean; error?: string }
  }
  return {
    sheets,
    mails,
    lock,
    errors,
    get: () => call('doGet'),
    post: (body: unknown) =>
      call('doPost', {
        postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) },
      }),
  }
}

const payloadOf = (patch: Partial<LeadDraft> = {}) =>
  toPayload(draft(patch), 'https://example.test/', 'UA/1.0')

describe('Code.gs — исполнение', () => {
  it('doGet → { ok: true }', () => {
    expect(loadCodeGs().get()).toEqual({ ok: true })
  })

  it('первая заявка создаёт лист Leads с шапкой и закреплённой первой строкой', () => {
    const gs = loadCodeGs()
    expect(gs.post(payloadOf())).toEqual({ ok: true })
    expect(gs.sheets.map((s) => s.name)).toEqual(['Leads'])
    const sheet = at(gs.sheets, 0)
    expect(sheet.rows[0]).toEqual([
      'Дата',
      'Имя',
      'Компания',
      'Контакт',
      'Комментарий',
      'Страница',
      'Браузер',
    ])
    expect(sheet.frozen).toBe(1)
    expect(sheet.rows).toHaveLength(2)
  })

  it('существующий лист: шапка не пишется заново, заявка дописывается строкой', () => {
    const existing: FakeSheet = {
      name: 'Leads',
      rows: [['шапка владельца'], ['старая']],
      frozen: 1,
    }
    const gs = loadCodeGs({ sheets: [existing] })
    expect(gs.post(payloadOf())).toEqual({ ok: true })
    expect(existing.rows.slice(0, 2)).toEqual([['шапка владельца'], ['старая']])
    expect(existing.rows).toHaveLength(3)
  })

  it('каждое значение строки — с ведущим апострофом, формула остаётся текстом', () => {
    const gs = loadCodeGs()
    gs.post(payloadOf({ name: '=HYPERLINK("x")', company: '+1', message: '' }))
    const row = at(at(gs.sheets, 0).rows, 1)
    const date = at(row, 0).slice(1)
    expect(row).toHaveLength(7)
    expect(row.every((v) => v.startsWith("'"))).toBe(true)
    expect(row.slice(1)).toEqual([
      `'=HYPERLINK("x")`,
      "'+1",
      "'+370 600 00000",
      "'",
      "'https://example.test/",
      "'UA/1.0",
    ])
    expect(new Date(date).toISOString()).toBe(date)
  })

  it('запись идёт под LockService, замок отпускается', () => {
    const gs = loadCodeGs()
    gs.post(payloadOf())
    expect(gs.lock).toEqual({ waits: 1, releases: 1 })
  })

  it('сервер стрижёт строки, как форма', () => {
    const gs = loadCodeGs()
    gs.post({ ...payloadOf(), name: '  Иван  ' })
    expect(at(at(gs.sheets, 0).rows, 1)[1]).toBe("'Иван")
  })

  it('не JSON и не объект → { ok: false }, лист не создаётся', () => {
    const gs = loadCodeGs()
    expect(gs.post('{не json').ok).toBe(false)
    expect(gs.post('null').ok).toBe(false)
    expect(gs.sheets).toEqual([])
  })

  it('неверная заявка → { ok: false, error }, ничего не пишется и замок не берётся', () => {
    const gs = loadCodeGs()
    const answer = gs.post(payloadOf({ name: '' }))
    expect(answer.ok).toBe(false)
    expect(answer.error).toBeTruthy()
    expect(gs.sheets).toEqual([])
    expect(gs.lock.waits).toBe(0)
  })

  // Те же входы, что выше у домена, — сервер обязан решать так же (одно правило, две среды).
  const CASES: [string, Partial<LeadDraft>][] = [
    ['корректная', {}],
    ['имя пустое', { name: '' }],
    ['имя из пробелов', { name: '   ' }],
    ['имя 100', { name: 'я'.repeat(100) }],
    ['имя 101', { name: 'я'.repeat(101) }],
    ['компания 150', { company: 'к'.repeat(150) }],
    ['компания 151', { company: 'к'.repeat(151) }],
    ['контакт пустой', { contact: '' }],
    ['телефон 6 цифр', { contact: '12-34-56' }],
    ['телефон 7 цифр', { contact: '123-45-67' }],
    ['цифры среди букв', { contact: 'звоните 1234567' }],
    ['e-mail без точки в домене', { contact: 'ivan@mail' }],
    ['e-mail с пустой частью домена', { contact: 'ivan@mail..ru' }],
    ['валидный e-mail', { contact: 'ivan@mail.ru' }],
    ['контакт 151', { contact: `${'a'.repeat(143)}@mail.ru` }],
    ['комментарий 1000', { message: 'м'.repeat(1000) }],
    ['комментарий 1001', { message: 'м'.repeat(1001) }],
  ]

  it.each(CASES)('«%s»: сервер решает так же, как validateLead', (_label, patch) => {
    const gs = loadCodeGs()
    expect(gs.post(payloadOf(patch)).ok).toBe(validateLead(draft(patch)).ok)
  })

  it('набор случаев содержит и принятые, и отвергнутые заявки', () => {
    const verdicts = new Set(CASES.map(([, patch]) => validateLead(draft(patch)).ok))
    expect(verdicts).toEqual(new Set([true, false]))
  })
})

describe('Code.gs — уведомление на почту', () => {
  it('NOTIFY_EMAIL не задан — писем нет, заявка записана', () => {
    const gs = loadCodeGs()
    expect(gs.post(payloadOf()).ok).toBe(true)
    expect(gs.mails).toEqual([])
  })

  it('NOTIFY_EMAIL задан — письмо на этот адрес с контактом заявки', () => {
    const gs = loadCodeGs({ notifyEmail: 'owner@example.test' })
    gs.post(payloadOf({ contact: 'ivan@mail.ru' }))
    expect(gs.mails).toHaveLength(1)
    expect(at(gs.mails, 0).to).toBe('owner@example.test')
    expect(at(gs.mails, 0).body).toContain('Контакт: ivan@mail.ru')
  })

  it('сбой почты не отменяет заявку и ответ', () => {
    const gs = loadCodeGs({ notifyEmail: 'owner@example.test', mailFails: true })
    expect(gs.post(payloadOf()).ok).toBe(true)
    expect(at(gs.sheets, 0).rows).toHaveLength(2)
    expect(gs.errors).toEqual(['NOTIFY_EMAIL: Error: quota'])
  })

  it('отвергнутая заявка письма не порождает', () => {
    const gs = loadCodeGs({ notifyEmail: 'owner@example.test' })
    gs.post(payloadOf({ name: '' }))
    expect(gs.mails).toEqual([])
  })
})
