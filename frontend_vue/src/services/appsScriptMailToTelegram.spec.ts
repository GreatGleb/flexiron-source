import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'

/**
 * Пересылка почты в Telegram — apps-script/mail-to-telegram/Code.gs (этап 2 лендинга, пункт 2).
 *
 * Скрипт живёт в Apps Script, а не во фронтенде; здесь он исполняется в `node:vm` с заглушками
 * GmailApp, UrlFetchApp, PropertiesService и ScriptApp — ровно в том объёме, в каком он их зовёт.
 * Держит: какие письма считаются новыми, что граница не двигается при сбое Telegram (письмо не
 * теряется и не приходит дважды), формат сообщения, вложения, и что токен бота не попадает в журнал.
 */

const CODE_PATH = resolve(__dirname, '..', '..', '..', 'apps-script', 'mail-to-telegram', 'Code.gs')
const CODE = readFileSync(CODE_PATH, 'utf8')

const TOKEN = '123456:SECRET-mail-token'
const API = `https://api.telegram.org/bot${TOKEN}/`
const T0 = Date.UTC(2026, 10, 21, 10, 0, 0)

interface Mail {
  id: string
  ts: number
  from?: string
  subject?: string
  body?: string
  inbox?: boolean
  thread?: string
  files?: { name: string; size: number }[]
}

interface Sent {
  method: string
  /** JSON-тело для текста; объект (с blob) — для файла. */
  body: Record<string, unknown>
  contentType?: string
}

interface Trigger {
  handler: string
  minutes?: number
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index]
  if (item === undefined) throw new Error(`нет элемента ${index} из ${list.length}`)
  return item
}

function load(
  opts: {
    mails?: Mail[]
    props?: Record<string, string>
    /** Номера вызовов Telegram (с 0), на которых он отвечает ошибкой. */
    failOn?: number[]
    throwOn?: number[]
    triggers?: Trigger[]
  } = {},
) {
  const mails = opts.mails ?? []
  const props: Record<string, string> = {
    TG_BOT_TOKEN: TOKEN,
    TG_CHAT_ID: '42',
    ...opts.props,
  }
  const sent: Sent[] = []
  const queries: string[] = []
  const errors: string[] = []
  const attachmentOptions: unknown[] = []
  const triggers: Trigger[] = opts.triggers ?? []
  let calls = 0

  const message = (m: Mail) => ({
    getId: () => m.id,
    getDate: () => new Date(m.ts),
    getFrom: () => m.from ?? 'Иван <ivan@metal.lt>',
    getSubject: () => m.subject ?? 'Вопрос',
    getPlainBody: () => m.body ?? 'Текст письма',
    isInInbox: () => m.inbox ?? true,
    getThread: () => ({ getId: () => m.thread ?? `t-${m.id}` }),
    getAttachments: (o: unknown) => {
      attachmentOptions.push(o)
      return (m.files ?? []).map((f) => ({
        getName: () => f.name,
        getSize: () => f.size,
        copyBlob: () => ({ blob: f.name }),
      }))
    },
  })

  const context = createContext({
    console: { error: (msg: string) => errors.push(msg) },
    Date,
    JSON,
    Math,
    String,
    Number,
    encodeURIComponent,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props[k] ?? null,
        setProperty: (k: string, v: string) => {
          props[k] = v
        },
      }),
    },
    GmailApp: {
      search: (query: string) => {
        queries.push(query)
        // Поиск Gmail по after:<секунды> — письма не раньше этой секунды; группы — по треду.
        const after = Number(/after:(\d+)/.exec(query)?.[1] ?? 0) * 1000
        const threads = new Map<string, Mail[]>()
        for (const m of mails.filter((x) => x.ts >= after)) {
          const key = m.thread ?? `t-${m.id}`
          threads.set(key, [...(threads.get(key) ?? []), m])
        }
        return [...threads.values()].map((list) => ({ getMessages: () => list.map(message) }))
      },
    },
    UrlFetchApp: {
      fetch: (
        url: string,
        o: { method: string; payload: unknown; contentType?: string; muteHttpExceptions: boolean },
      ) => {
        const n = calls++
        expect(o.method).toBe('post')
        expect(o.muteHttpExceptions).toBe(true)
        if (opts.throwOn?.includes(n)) throw new Error(`Address unavailable: ${url}`)
        const method = url.replace(API, '')
        const body =
          typeof o.payload === 'string'
            ? (JSON.parse(o.payload) as Record<string, unknown>)
            : (o.payload as Record<string, unknown>)
        sent.push({ method, body, contentType: o.contentType })
        return { getResponseCode: () => (opts.failOn?.includes(n) ? 502 : 200) }
      },
    },
    ScriptApp: {
      getProjectTriggers: () =>
        triggers.map((t) => ({ getHandlerFunction: () => t.handler, raw: t })),
      deleteTrigger: (t: { raw: Trigger }) => {
        triggers.splice(triggers.indexOf(t.raw), 1)
      },
      newTrigger: (handler: string) => ({
        timeBased: () => ({
          everyMinutes: (minutes: number) => ({
            create: () => triggers.push({ handler, minutes }),
          }),
        }),
      }),
    },
  })
  // Исполняется файл из этого же репозитория — ради этого спека и есть.
  // eslint-disable-next-line sonarjs/code-eval
  runInContext(CODE, context)
  const fn = context as Record<'setup' | 'stop' | 'forwardNewMail', () => void>
  const texts = () => sent.filter((s) => s.method === 'sendMessage').map((s) => String(s.body.text))
  return { fn, props, sent, texts, queries, errors, triggers, attachmentOptions }
}

const START = { LAST_TS: String(T0), SEEN_AT_TS: '[]' }

describe('mail-to-telegram — какие письма новые', () => {
  it('setup не запускали — ничего не ищет и не шлёт', () => {
    const gs = load({ mails: [{ id: 'a', ts: T0 + 1000 }] })
    gs.fn.forwardNewMail()
    expect(gs.queries).toEqual([])
    expect(gs.sent).toEqual([])
  })

  it('поиск — во «Входящих» с секунды границы; письмо раньше границы не уходит', () => {
    const gs = load({
      props: { ...START, LAST_TS: String(T0 + 500) },
      mails: [
        { id: 'old', ts: T0 },
        { id: 'new', ts: T0 + 2000 },
      ],
    })
    gs.fn.forwardNewMail()
    expect(gs.queries).toEqual([`in:inbox after:${Math.floor((T0 + 500) / 1000)}`])
    expect(gs.texts()).toHaveLength(1)
    expect(at(gs.texts(), 0)).toContain('Тема: Вопрос')
    expect(gs.props.LAST_TS).toBe(String(T0 + 2000))
    expect(gs.props.SEEN_AT_TS).toBe('["new"]')
  })

  it('та же секунда: уже пересланное пропускается, другое письмо с тем же временем уходит', () => {
    const gs = load({
      props: { LAST_TS: String(T0), SEEN_AT_TS: '["a"]' },
      mails: [
        { id: 'a', ts: T0, subject: 'A' },
        { id: 'b', ts: T0, subject: 'B' },
      ],
    })
    gs.fn.forwardNewMail()
    expect(gs.texts().map((t) => /Тема: (\w)/.exec(t)?.[1])).toEqual(['B'])
    expect(JSON.parse(gs.props.SEEN_AT_TS ?? '')).toEqual(['a', 'b'])
  })

  it('письмо не во «Входящих» (архив, спам) не пересылается', () => {
    const gs = load({ props: START, mails: [{ id: 'a', ts: T0 + 1000, inbox: false }] })
    gs.fn.forwardNewMail()
    expect(gs.sent).toEqual([])
    expect(gs.props.LAST_TS).toBe(String(T0))
  })

  it('письма уходят по времени, не по порядку тредов', () => {
    const gs = load({
      props: START,
      mails: [
        { id: 'late', ts: T0 + 3000, subject: 'Поздно', thread: 't1' },
        { id: 'early', ts: T0 + 1000, subject: 'Рано', thread: 't2' },
        { id: 'mid', ts: T0 + 2000, subject: 'Средне', thread: 't1' },
      ],
    })
    gs.fn.forwardNewMail()
    expect(gs.texts().map((t) => /Тема: (\S+)/.exec(t)?.[1])).toEqual(['Рано', 'Средне', 'Поздно'])
  })
})

describe('mail-to-telegram — сбой Telegram', () => {
  const two: Mail[] = [
    { id: 'a', ts: T0 + 1000, subject: 'A' },
    { id: 'b', ts: T0 + 2000, subject: 'B' },
  ]

  it('второе письмо не принято — граница на первом; следующий запуск шлёт только второе', () => {
    const gs = load({ props: START, mails: two, failOn: [1] })
    gs.fn.forwardNewMail()
    expect(gs.props.LAST_TS).toBe(String(T0 + 1000))
    expect(gs.props.SEEN_AT_TS).toBe('["a"]')

    const again = load({ props: { ...gs.props }, mails: two })
    again.fn.forwardNewMail()
    expect(again.texts().map((t) => /Тема: (\w)/.exec(t)?.[1])).toEqual(['B'])
    expect(again.props.LAST_TS).toBe(String(T0 + 2000))
  })

  it('сеть упала — граница на месте, токен бота в журнал не попадает', () => {
    const gs = load({ props: START, mails: two, throwOn: [0] })
    gs.fn.forwardNewMail()
    expect(gs.props.LAST_TS).toBe(String(T0))
    expect(gs.errors).toHaveLength(1)
    expect(at(gs.errors, 0)).toContain('***')
    expect(gs.errors.join()).not.toContain(TOKEN)
  })

  it('бот не настроен — ничего не шлёт и границу не двигает', () => {
    const gs = load({ props: { ...START, TG_BOT_TOKEN: '' }, mails: two })
    gs.fn.forwardNewMail()
    expect(gs.sent).toEqual([])
    expect(gs.props.LAST_TS).toBe(String(T0))
    expect(gs.errors).toEqual(['TG_BOT_TOKEN или TG_CHAT_ID не заданы'])
  })

  it('за запуск не больше 20 писем, остальные — в следующий', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, ts: T0 + 1000 * (i + 1) }))
    const gs = load({ props: START, mails: many })
    gs.fn.forwardNewMail()
    expect(gs.texts()).toHaveLength(20)
    const again = load({ props: { ...gs.props }, mails: many })
    again.fn.forwardNewMail()
    expect(again.texts()).toHaveLength(5)
  })
})

describe('mail-to-telegram — сообщение', () => {
  it('от кого, тема, текст и ссылка на тред в Gmail нужного ящика; JSON в чат из свойств', () => {
    const gs = load({
      props: START,
      mails: [
        { id: 'a', ts: T0 + 1000, from: 'Пётр <p@x.lt>', body: '  Нужна резка  ', thread: 'T9' },
      ],
    })
    gs.fn.forwardNewMail()
    const message = at(gs.sent, 0)
    expect(message.contentType).toBe('application/json')
    expect(message.body.chat_id).toBe('42')
    expect(message.body.disable_web_page_preview).toBe(true)
    expect(message.body.text).toBe(
      [
        '✉️ Письмо на flexiron.erp@gmail.com',
        'От: Пётр <p@x.lt>',
        'Тема: Вопрос',
        '',
        'Нужна резка',
        '',
        'Открыть в Gmail: https://mail.google.com/mail/?authuser=flexiron.erp%40gmail.com#all/T9',
      ].join('\n'),
    )
  })

  it('без темы и без текста — пометки вместо пустоты', () => {
    const gs = load({ props: START, mails: [{ id: 'a', ts: T0 + 1000, subject: '', body: ' ' }] })
    gs.fn.forwardNewMail()
    expect(at(gs.texts(), 0)).toContain('Тема: (без темы)')
    expect(at(gs.texts(), 0)).toContain('(пустое письмо)')
  })

  it('длинное письмо обрезается до 4096 с пометкой, ссылка остаётся', () => {
    const gs = load({ props: START, mails: [{ id: 'a', ts: T0 + 1000, body: 'ж'.repeat(10000) }] })
    gs.fn.forwardNewMail()
    const text = at(gs.texts(), 0)
    expect(text).toHaveLength(4096)
    expect(text).toContain('…(письмо обрезано — целиком в Gmail)')
    expect(text.endsWith('#all/t-a')).toBe(true)
  })

  it('письмо ровно по пределу не обрезается', () => {
    const probe = load({ props: START, mails: [{ id: 'a', ts: T0 + 1000, body: 'x' }] })
    probe.fn.forwardNewMail()
    const room = 4096 - at(probe.texts(), 0).length + 1
    const gs = load({ props: START, mails: [{ id: 'a', ts: T0 + 1000, body: 'ж'.repeat(room) }] })
    gs.fn.forwardNewMail()
    expect(at(gs.texts(), 0)).toHaveLength(4096)
    expect(at(gs.texts(), 0)).not.toContain('обрезано')
  })
})

describe('mail-to-telegram — вложения', () => {
  it('файлы — следом за текстом, multipart (без contentType), встроенные картинки не берутся', () => {
    const gs = load({
      props: START,
      mails: [{ id: 'a', ts: T0 + 1000, files: [{ name: 'счёт.pdf', size: 1000 }] }],
    })
    gs.fn.forwardNewMail()
    expect(gs.sent.map((s) => s.method)).toEqual(['sendMessage', 'sendDocument'])
    const file = at(gs.sent, 1)
    expect(file.contentType).toBeUndefined()
    expect(file.body).toEqual({ chat_id: '42', document: { blob: 'счёт.pdf' } })
    expect(gs.attachmentOptions).toEqual([{ includeInlineImages: false }])
  })

  it('файл больше 50 МБ не отправляется — вместо него строка', () => {
    const gs = load({
      props: START,
      mails: [{ id: 'a', ts: T0 + 1000, files: [{ name: 'big.zip', size: 50 * 1024 * 1024 + 1 }] }],
    })
    gs.fn.forwardNewMail()
    expect(gs.sent.map((s) => s.method)).toEqual(['sendMessage', 'sendMessage'])
    expect(at(gs.texts(), 1)).toBe('📎 big.zip — больше 50 МБ, только в Gmail')
  })

  it('сбой вложения письмо в очередь не возвращает — текст не придёт второй раз', () => {
    const gs = load({
      props: START,
      mails: [{ id: 'a', ts: T0 + 1000, files: [{ name: 'f.pdf', size: 10 }] }],
      failOn: [1],
    })
    gs.fn.forwardNewMail()
    expect(gs.props.LAST_TS).toBe(String(T0 + 1000))
  })
})

describe('mail-to-telegram — setup и stop', () => {
  it('setup: граница — сейчас, триггер раз в минуту (старый заменён, чужие целы), проверочное сообщение', () => {
    const before = Date.now()
    const gs = load({
      mails: [{ id: 'old', ts: before - 1000 }],
      triggers: [{ handler: 'forwardNewMail', minutes: 5 }, { handler: 'other' }],
    })
    gs.fn.setup()
    expect(Number(gs.props.LAST_TS)).toBeGreaterThanOrEqual(before)
    expect(gs.props.SEEN_AT_TS).toBe('[]')
    expect(gs.triggers).toEqual([{ handler: 'other' }, { handler: 'forwardNewMail', minutes: 1 }])
    expect(gs.texts()).toEqual([
      '✅ Пересылка почты flexiron.erp@gmail.com включена. Новые письма будут приходить сюда.',
    ])
    // Письмо до setup не уходит.
    gs.fn.forwardNewMail()
    expect(gs.texts()).toHaveLength(1)
  })

  it('setup: Telegram не ответил — ошибка с подсказкой', () => {
    const gs = load({ failOn: [0] })
    expect(() => gs.fn.setup()).toThrow('проверьте TG_BOT_TOKEN и TG_CHAT_ID')
  })

  it('stop снимает только свой триггер', () => {
    const gs = load({ triggers: [{ handler: 'forwardNewMail', minutes: 1 }, { handler: 'other' }] })
    gs.fn.stop()
    expect(gs.triggers).toEqual([{ handler: 'other' }])
  })
})
