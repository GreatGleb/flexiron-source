import { describe, it, expect } from 'vitest'
import {
  buildBccBody,
  buildBccSignature,
  buildBccSubject,
  formatBccDate,
  type BccSender,
} from './bccEmail'

const SENDER: BccSender = {
  companyName: 'Flexiron UAB',
  companyAddress: 'Verkių g. 25, Vilnius, Lietuva',
  managerName: 'Mindaugas Volkovas',
  managerPhone: '+37060000000',
  managerEmail: 'owner@flexiron.com',
}

/** Настройки ещё не пришли — у отправителя нет ни одного поля. */
const NOBODY: BccSender = {
  companyName: '',
  companyAddress: '',
  managerName: '',
  managerPhone: '',
  managerEmail: '',
}

describe('formatBccDate', () => {
  it('дд.мм.гггг с ведущими нулями', () => {
    expect(formatBccDate('2026-01-05T10:00:00.000Z')).toBe('05.01.2026')
  })

  it('двузначные день и месяц не дополняются', () => {
    expect(formatBccDate('2026-12-28T10:00:00.000Z')).toBe('28.12.2026')
  })

  it('неразобранная дата возвращается как есть, а не как NaN.NaN.NaN', () => {
    expect(formatBccDate('не дата')).toBe('не дата')
  })
})

describe('buildBccSubject', () => {
  it('тема — из названия компании и даты (спека 04.2 §3)', () => {
    const subject = buildBccSubject(SENDER, '28.08.2026')
    expect(subject.ru).toBe('Запрос цен на металл 28.08.2026 — Flexiron UAB')
    expect(subject.en).toBe('Metal price request 28.08.2026 — Flexiron UAB')
    expect(subject.lt).toBe('Metalo kainų užklausa 28.08.2026 — Flexiron UAB')
  })

  it('без названия компании тема остаётся без висящего тире', () => {
    const subject = buildBccSubject({ ...SENDER, companyName: '' }, '28.08.2026')
    expect(subject.en).toBe('Metal price request 28.08.2026')
    expect(subject.ru).not.toContain('—')
  })
})

describe('buildBccSignature', () => {
  it('менеджер, его компания, её адрес и контакты для ответа', () => {
    expect(buildBccSignature(SENDER)).toEqual([
      'Mindaugas Volkovas',
      'Flexiron UAB',
      'Verkių g. 25, Vilnius, Lietuva',
      '+37060000000 · owner@flexiron.com',
    ])
  })

  it('единственный контакт идёт без разделителя', () => {
    expect(buildBccSignature({ ...SENDER, managerPhone: '' })).toContain('owner@flexiron.com')
    expect(buildBccSignature({ ...SENDER, managerEmail: '' })).toContain('+37060000000')
  })

  it('пустые поля не оставляют пустых строк', () => {
    expect(buildBccSignature({ ...SENDER, companyAddress: '', managerName: '' })).toEqual([
      'Flexiron UAB',
      '+37060000000 · owner@flexiron.com',
    ])
    expect(buildBccSignature(NOBODY)).toEqual([])
  })
})

describe('buildBccBody', () => {
  it('позиции идут списком, подпись — текущего менеджера', () => {
    const body = buildBccBody(SENDER, ['Sheet 2mm', 'Pipe 50mm'])
    expect(body.en).toBe(
      'Hello!\n\n' +
        'Please provide current prices for the following items:\n\n' +
        '  - Sheet 2mm\n  - Pipe 50mm\n\n' +
        'Best regards,\nMindaugas Volkovas\nFlexiron UAB\n' +
        'Verkių g. 25, Vilnius, Lietuva\n+37060000000 · owner@flexiron.com',
    )
  })

  it('без выбранных позиций — «все категории» на языке письма, а не по-английски во всех трёх', () => {
    const body = buildBccBody(SENDER, [])
    expect(body.ru).toContain('Все категории')
    expect(body.en).toContain('All categories')
    expect(body.lt).toContain('Visos kategorijos')
  })

  it('без подписи уходит и прощание — висящее «С уважением,» хуже пустоты', () => {
    const body = buildBccBody(NOBODY, ['Sheet 2mm'])
    expect(body.ru).not.toContain('С уважением')
    expect(body.en).not.toContain('Best regards')
    expect(body.lt).not.toContain('Pagarbiai')
    expect(body.en.endsWith('  - Sheet 2mm')).toBe(true)
  })

  it('ни в одной локали письма нет постороннего юрлица', () => {
    const letter = [
      buildBccSubject(SENDER, '28.08.2026'),
      buildBccBody(SENDER, ['Sheet 2mm']),
    ].flatMap((part) => [part.ru, part.en, part.lt])
    for (const text of letter) expect(text).not.toContain('InBox')
  })
})
