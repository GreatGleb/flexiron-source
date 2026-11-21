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
      captcha: '',
    })
  })

  it('токен капчи уходит как есть', () => {
    expect(toPayload(draft(), '', '', 'tok-1').captcha).toBe('tok-1')
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

interface FakeFetch {
  url: string
  options: {
    method?: string
    payload?: unknown
    contentType?: string
    muteHttpExceptions?: boolean
  }
}

/** Ответ UrlFetchApp: код и тело; `throw` — сеть упала. */
type FetchReply = { code: number; body: string } | 'throw'

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TG_TOKEN = '123456:SECRET-bot-token'
const BOT_URL = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`
/** Свойства по умолчанию: капча настроена, бот — нет. */
const BASE_PROPS = { TURNSTILE_SECRET: 'ts-secret' }
const WITH_BOT = { ...BASE_PROPS, TG_BOT_TOKEN: TG_TOKEN, TG_CHAT_ID: '42' }

/** Заглушки сервисов Google ровно в том объёме, в каком их зовёт Code.gs. */
function loadCodeGs(
  opts: {
    sheets?: FakeSheet[]
    mailFails?: boolean
    props?: Record<string, string>
    /** Ответ на siteverify; по умолчанию — успех. */
    captcha?: FetchReply
    /** Ответ Telegram; по умолчанию — 200. */
    telegram?: FetchReply
  } = {},
) {
  const sheets = opts.sheets ?? []
  const props: Record<string, string> = opts.props ?? BASE_PROPS
  const fetches: FakeFetch[] = []
  const reply = (r: FetchReply) => {
    if (r === 'throw') throw new Error(`Address unavailable: ${fetches.at(-1)?.url ?? ''}`)
    return { getResponseCode: () => r.code, getContentText: () => r.body }
  }
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
        getProperty: (key: string) => props[key] ?? null,
      }),
    },
    UrlFetchApp: {
      fetch: (url: string, options: FakeFetch['options']) => {
        fetches.push({ url, options })
        if (url === TURNSTILE_URL)
          return reply(opts.captcha ?? { code: 200, body: '{"success":true}' })
        if (url === BOT_URL) return reply(opts.telegram ?? { code: 200, body: '{"ok":true}' })
        throw new Error(`неожиданный адрес ${url}`)
      },
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
    fetches,
    lock,
    errors,
    get: () => call('doGet'),
    post: (body: unknown) =>
      call('doPost', {
        postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) },
      }),
  }
}

const payloadOf = (patch: Partial<LeadDraft> = {}, captcha = 'tok-ok') =>
  toPayload(draft(patch), 'https://example.test/', 'UA/1.0', captcha)

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
      'Telegram',
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
    expect(row).toHaveLength(8)
    expect(row.every((v) => v.startsWith("'"))).toBe(true)
    expect(row.slice(1)).toEqual([
      `'=HYPERLINK("x")`,
      "'+1",
      "'+370 600 00000",
      "'",
      "'https://example.test/",
      "'UA/1.0",
      "'off",
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
    const gs = loadCodeGs({ props: { ...BASE_PROPS, NOTIFY_EMAIL: 'owner@example.test' } })
    gs.post(payloadOf({ contact: 'ivan@mail.ru' }))
    expect(gs.mails).toHaveLength(1)
    expect(at(gs.mails, 0).to).toBe('owner@example.test')
    expect(at(gs.mails, 0).body).toContain('Контакт: ivan@mail.ru')
  })

  it('сбой почты не отменяет заявку и ответ', () => {
    const gs = loadCodeGs({
      props: { ...BASE_PROPS, NOTIFY_EMAIL: 'owner@example.test' },
      mailFails: true,
    })
    expect(gs.post(payloadOf()).ok).toBe(true)
    expect(at(gs.sheets, 0).rows).toHaveLength(2)
    expect(gs.errors).toEqual(['NOTIFY_EMAIL: Error: quota'])
  })

  it('отвергнутая заявка письма не порождает', () => {
    const gs = loadCodeGs({ props: { ...BASE_PROPS, NOTIFY_EMAIL: 'owner@example.test' } })
    gs.post(payloadOf({ name: '' }))
    expect(gs.mails).toEqual([])
  })
})

describe('Code.gs — капча Turnstile', () => {
  it('токен уходит на siteverify методом POST вместе с секретом из свойств', () => {
    const gs = loadCodeGs()
    expect(gs.post(payloadOf({}, 'tok-7')).ok).toBe(true)
    const call = at(gs.fetches, 0)
    expect(call.url).toBe(TURNSTILE_URL)
    expect(call.options.method).toBe('post')
    expect(call.options.payload).toEqual({ secret: 'ts-secret', response: 'tok-7' })
    expect(call.options.muteHttpExceptions).toBe(true)
  })

  it.each([
    ['secret не задан', { props: {} }, '', 'captcha not configured'],
    ['токена нет', {}, '', 'captcha required'],
    [
      'Cloudflare сказал «нет»',
      { captcha: { code: 200, body: '{"success":false}' } },
      'tok',
      'captcha failed',
    ],
    ['ответ не JSON', { captcha: { code: 502, body: '<html>' } }, 'tok', 'captcha unavailable'],
    ['сеть упала', { captcha: 'throw' as const }, 'tok', 'captcha unavailable'],
  ])('%s → { ok: false }, строки и сообщения нет', (_label, opts, token, error) => {
    const gs = loadCodeGs({ ...opts, telegram: { code: 200, body: '' } })
    const answer = gs.post(payloadOf({}, token))
    expect(answer).toEqual({ ok: false, error })
    expect(gs.sheets).toEqual([])
    expect(gs.fetches.filter((f) => f.url === BOT_URL)).toEqual([])
  })

  it('без secret заявка не принимается даже с токеном — и это видно в журнале', () => {
    const gs = loadCodeGs({ props: {} })
    expect(gs.post(payloadOf({}, 'tok')).ok).toBe(false)
    expect(gs.fetches).toEqual([])
    expect(gs.errors).toEqual(['TURNSTILE_SECRET не задан — заявка отклонена'])
  })

  it('неверная заявка до Cloudflare не доходит', () => {
    const gs = loadCodeGs()
    gs.post(payloadOf({ name: '' }))
    expect(gs.fetches).toEqual([])
  })
})

describe('Code.gs — сообщение в Telegram', () => {
  it('бот настроен — сообщение в чат из свойств, с полями заявки, без превью ссылок', () => {
    const gs = loadCodeGs({ props: WITH_BOT })
    expect(gs.post(payloadOf({ company: '', contact: 'ivan@mail.ru' })).ok).toBe(true)
    const call = at(gs.fetches, 1)
    expect(call.url).toBe(BOT_URL)
    expect(call.options.method).toBe('post')
    expect(call.options.contentType).toBe('application/json')
    const message = JSON.parse(String(call.options.payload)) as Record<string, unknown>
    expect(message.chat_id).toBe('42')
    expect(message.disable_web_page_preview).toBe(true)
    expect(message.text).toContain('Контакт: ivan@mail.ru')
    expect(message.text).toContain('Компания: —')
    expect(message.text).toContain('Страница: https://example.test/')
    expect(at(at(gs.sheets, 0).rows, 1).at(-1)).toBe("'ok")
  })

  it('самая длинная допустимая заявка влезает в одно сообщение Telegram (4096)', () => {
    const gs = loadCodeGs({ props: WITH_BOT })
    const longest = payloadOf({
      name: 'я'.repeat(LIMITS.name),
      company: 'к'.repeat(LIMITS.company),
      contact: `${'a'.repeat(LIMITS.contact - 8)}@mail.ru`,
      message: 'м'.repeat(LIMITS.message),
    })
    // Страница от формы приходит без лимита — сервер режет её сам (META_MAX).
    expect(gs.post({ ...longest, page: 'p'.repeat(5000) }).ok).toBe(true)
    const message = JSON.parse(String(at(gs.fetches, 1).options.payload)) as { text: string }
    expect(message.text).toContain('м'.repeat(LIMITS.message))
    expect(message.text.split('Страница: ')[1]).toBe('p'.repeat(Number(gsConst('META_MAX'))))
    expect(message.text.length).toBeLessThanOrEqual(4096)
  })

  it('бот не настроен — запроса нет, в строке «off»', () => {
    const gs = loadCodeGs()
    gs.post(payloadOf())
    expect(gs.fetches.map((f) => f.url)).toEqual([TURNSTILE_URL])
    expect(at(at(gs.sheets, 0).rows, 1).at(-1)).toBe("'off")
  })

  it('Telegram ответил ошибкой — заявка записана и принята, код в строке', () => {
    const gs = loadCodeGs({ props: WITH_BOT, telegram: { code: 403, body: '{}' } })
    expect(gs.post(payloadOf()).ok).toBe(true)
    expect(at(at(gs.sheets, 0).rows, 1).at(-1)).toBe("'http 403")
  })

  it('сеть упала — заявка записана, токен бота в журнал не попадает', () => {
    const gs = loadCodeGs({ props: WITH_BOT, telegram: 'throw' })
    expect(gs.post(payloadOf()).ok).toBe(true)
    expect(at(at(gs.sheets, 0).rows, 1).at(-1)).toBe("'error")
    expect(gs.errors).toHaveLength(1)
    expect(at(gs.errors, 0)).toContain('TELEGRAM:')
    expect(at(gs.errors, 0)).toContain('***')
    expect(gs.errors.join()).not.toContain(TG_TOKEN)
  })

  it('отправка в Telegram — вне замка таблицы', () => {
    const gs = loadCodeGs({ props: WITH_BOT })
    gs.post(payloadOf())
    expect(gs.lock).toEqual({ waits: 1, releases: 1 })
    expect(gs.fetches).toHaveLength(2)
  })
})
