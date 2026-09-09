/**
 * Сторож резолвера ссылок и он же инструмент прогона.
 *
 * Две роли, и обе нужны:
 *   1. ПОЛ резолвера — инверсии на каждый класс дефекта. Экстрактор, который считает не то,
 *      хуже отсутствующего: он выдаёт зелёный отчёт. Проверка «ссылок 475, битых 0» ничего не
 *      стоит, пока не доказано, что битую он бы увидел.
 *   2. ОТЧЁТ по документам домена — им отчитываются автор и приёмщик:
 *        cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/orders.md \
 *          npx vitest run src/services/contractRefs.spec.ts
 *      Без переменной берёт все написанные разделы, аудиты и баг-файлы.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkDoc,
  extractRefs,
  formatReport,
  resolvePath,
  resolveRef,
  type Ref,
} from './contractRefs'

const ROOT = resolve(process.cwd(), '..')

function ref(over: Partial<Ref> = {}): Ref {
  return {
    raw: '',
    path: '',
    carried: false,
    from: 1,
    to: 1,
    docLine: 1,
    tokens: [],
    sole: true,
    ...over,
  }
}

describe('экстрактор ссылок', () => {
  it('берёт полный путь, диапазон и голое продолжение абзаца', () => {
    const refs = extractRefs(
      'Правило (`backend/app/modules/products/shared/models.py:26-31`), и рядом `:32`.',
    )
    expect(refs.map((r) => [r.path, r.from, r.to, r.carried])).toEqual([
      ['backend/app/modules/products/shared/models.py', 26, 31, false],
      ['backend/app/modules/products/shared/models.py', 32, 32, true],
    ])
  })

  it('пустая строка обрывает наследование пути — иначе продолжение приклеится к чужому файлу', () => {
    expect(extractRefs('Смотри `a/b/c.ts:10`.\n\nА тут просто `:20`.')).toHaveLength(1)
  })

  it('не считает ссылками содержимое блоков кода', () => {
    expect(extractRefs("```bash\nsed -n '26,31p' models.py:26-31\n```")).toHaveLength(0)
  })

  it('утверждаемым токеном не берёт русскую прозу', () => {
    const refs = extractRefs('Здесь `ondelete="RESTRICT"` и `какое-то правило` (`x/y.py:1`)')
    expect(refs).toHaveLength(1)
    expect(refs[0]?.tokens).toContain('ondelete="RESTRICT"')
    expect(refs[0]?.tokens).not.toContain('какое-то правило')
  })
})

describe('инверсии — по одной на класс дефекта', () => {
  const real = 'backend/app/modules/products/shared/models.py'

  it('верный диапазон с утверждаемым токеном проходит', () => {
    const v = resolveRef(ref({ path: real, from: 26, to: 31, tokens: ['ondelete="RESTRICT"'] }))
    expect(v.ok).toBe(true)
  })

  it('сдвиг на строку краснеет — это дефект, убивший домены прогона 2026-09-04', () => {
    const v = resolveRef(ref({ path: real, from: 29, to: 33, tokens: ['ondelete="RESTRICT"'] }))
    expect(v.ok).toBe(false)
    expect(v.problem).toBe('нет токена в диапазоне')
  })

  it('несуществующий файл краснеет', () => {
    const v = resolveRef(ref({ path: 'нет/такого/файла.ts', from: 1, to: 1, tokens: ['x'] }))
    expect(v.problem).toBe('нет файла')
  })

  it('строка за концом файла краснеет', () => {
    const v = resolveRef(ref({ path: real, from: 99999, to: 99999, tokens: ['class'] }))
    expect(v.problem).toBe('вне границ')
  })

  it('ссылка без утверждаемого токена не выдаётся за проверенную', () => {
    const v = resolveRef(ref({ path: real, from: 26, to: 31 }))
    expect(v.ok).toBe(true)
    expect(v.unchecked).toBe(true)
  })

  it('путь резолвится и неполным, как его пишут в документах', () => {
    expect(resolvePath('src/services/contractRefs.ts')).not.toBeNull()
    expect(resolvePath('contractInventory.ts')).not.toBeNull()
  })
})

/** Документы, по которым отчитываются автор и приёмщик. */
function targets(): string[] {
  const env = process.env.CONTRACT_REFS
  if (env)
    return env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  const out: string[] = []
  for (const dir of [
    'roo_code/roo-context/api',
    'roo_code/plans/api/audit',
    'roo_code/plans/bugs',
  ]) {
    const abs = resolve(ROOT, dir)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs)) if (f.endsWith('.md')) out.push(`${dir}/${f}`)
  }
  return out
}

describe('ссылки документов контракта', () => {
  it('отчёт по каждому документу; экстрактор обязан что-то находить', () => {
    const reports = targets()
      .filter((t) => existsSync(resolve(ROOT, t)))
      .map(checkDoc)
    const total = reports.reduce((s, r) => s + r.total, 0)
    const broken = reports.reduce((s, r) => s + r.broken.length, 0)

    // Пишем в stdout напрямую: console.log в vitest перехватывается, а этот отчёт обязан
    // дойти до ответа агента целиком — «битых 0» без вывода не принимается.
    const say = (s: string): void => void process.stdout.write(`${s}\n`)
    for (const r of reports) if (r.broken.length) say(formatReport(r).join('\n'))
    say(`[ссылки] документов ${reports.length} · ссылок ${total} · битых ${broken}`)

    // Пол: заполненный документ контракта заведомо полон ссылок. Ноль у него означает
    // сломанный экстрактор, а не чистый документ — ровно та ошибка, из-за которой инвентарь
    // моков мерился трижды и две первые версии врали молча.
    const filled = reports.filter(
      (r) =>
        /\/(api|audit)\//.test(r.file) && readFileSync(resolve(ROOT, r.file), 'utf8').length > 8000,
    )
    for (const r of filled)
      expect(r.total, `${r.file}: ссылок не найдено вовсе`).toBeGreaterThan(20)

    if (process.env.CONTRACT_REFS_STRICT === '1') expect(broken).toBe(0)
    // Таймаут задан явно и с запасом: тест читает весь набор документов контракта (63 файла,
    // 15 тысяч ссылок на 2026-09-09) и резолвит каждую ссылку по диску. Он растёт вместе с
    // контрактом, и дефолтные 5 с он перерос — падение по времени читалось бы как падение по
    // содержанию, то есть как ложная тревога о битых ссылках.
  }, 60_000)
})
