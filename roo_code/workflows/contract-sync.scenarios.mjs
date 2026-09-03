/**
 * Сценарии воркфлоу contract-sync — проверка логики прогона без живых агентов.
 *
 * Воркфлоу нельзя «прогнать разок и посмотреть»: один настоящий прогон это полсотни агентов и
 * часы. Поэтому его управляющая логика — очередь, попытки, откаты, правила остановки —
 * проверяется здесь: скрипт грузится как есть, а `agent()` подменяется функцией, которая
 * отвечает по сценарию.
 *
 * Запуск из корня репозитория:
 *     node roo_code/workflows/contract-sync.scenarios.mjs
 *
 * Каждая строка вывода — отдельный сценарий. Сценарии 9–11 не проверяют «работает», они
 * проверяют, что защиты РАЗЛИЧАЮТ случаи: страж среды не срабатывает на двух провалах из трёх,
 * а старое поведение возвращается флагом. Без них было бы неизвестно, стражи это или заглушки.
 */
import { readFileSync } from 'node:fs'

const src = readFileSync('roo_code/workflows/contract-sync.js', 'utf8').replace(/^export const meta/m, 'const meta')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const run = new AsyncFunction('agent', 'phase', 'log', 'parallel', 'pipeline', 'args', src)

function harness(behaviour, args = {}) {
  const calls = []
  const agent = async (prompt, opts = {}) => {
    const label = opts.label || '(без метки)'
    calls.push(label)
    return behaviour(label, prompt, calls)
  }
  return run(agent, () => {}, () => {}, null, null, args).then((r) => ({ result: r, calls }))
}

const ok = (extra = {}) => ({ status: 'сделано', notes: 'ok', ...extra })

function domainOf(label) {
  return label.replace(/^(аудит|контракт|приёмка|откат) /, '').replace(/ \(попытка \d+\)$/, '')
}

// ── 1. Happy path
{
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'auto/contract-x', treeClean: true, gateGreen: true, skeletons: 17, inventory: 175, baseBranch: 'main' })
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 5, emptyFields: 0, commit: 'aaa' })
    if (label.startsWith('соглашения')) return ok({ commit: 'ccc' })
    if (label.startsWith('контракт')) return ok({ domain: domainOf(label), documented: 5, commit: 'bbb' })
    if (label.startsWith('приёмка')) return { domain: domainOf(label), refuted: false, reason: '', checked: 'проверил' }
    if (label === 'финал') return ok({ notes: '175 из 175' })
    throw new Error('неизвестная метка ' + label)
  })
  console.log('1 happy:', result.вердикт, '| написано', result.написано.length, '| не сведено', result.не_сведено.length, '| агентов', calls.length)
}

// ── 2. Один домен валится на аудите — остальные должны пройти
{
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (label.startsWith('аудит')) {
      const d = domainOf(label)
      return d === 'orders' ? ok({ domain: d, endpoints: 33, emptyFields: 2, notes: 'не дозаполнил' }) : ok({ domain: d, endpoints: 5, emptyFields: 0 })
    }
    if (label.startsWith('соглашения')) return ok({})
    if (label.startsWith('контракт')) return ok({ domain: domainOf(label), documented: 5, commit: 'c' })
    if (label.startsWith('приёмка')) return { domain: domainOf(label), refuted: false, reason: '', checked: 'x' }
    if (label === 'финал') return ok({})
  })
  const ordersTries = calls.filter((c) => c.startsWith('аудит orders')).length
  console.log('2 один провал:', result.вердикт, '| аудитов', result.аудитов.length, '| попыток по orders', ordersTries, '| не сведено:', result.не_сведено.join(','))
}

// ── 3. Скептик отклоняет дважды, принимает с третьей
{
  let refusals = 0
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 5, emptyFields: 0 })
    if (label.startsWith('соглашения')) return ok({})
    if (label.startsWith('контракт')) return ok({ domain: domainOf(label), documented: 5, commit: 'c' + Math.random().toString(16).slice(2, 8) })
    if (label.startsWith('приёмка')) {
      const d = domainOf(label)
      if (d === 'warehouse' && refusals < 2) { refusals += 1; return { domain: d, refuted: true, reason: 'нет раздела обязанностей', checked: 'смотрел' } }
      return { domain: d, refuted: false, reason: '', checked: 'x' }
    }
    if (label.startsWith('откат')) return ok({})
    if (label === 'финал') return ok({})
  })
  const tries = calls.filter((c) => c.startsWith('контракт warehouse')).length
  const reverts = calls.filter((c) => c.startsWith('откат warehouse')).length
  const wh = result.задачи.find((t) => t.фаза === 'написание' && t.домен === 'warehouse')
  console.log('3 скептик:', result.вердикт, '| попыток', tries, '| откатов', reverts, '| итог warehouse:', wh.статус, 'с', wh.попыток, 'попытки')
}

// ── 4. Первые три домена валятся — среда сломана
{
  const { result } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 1, emptyFields: 9, notes: 'скелета нет' })
    return ok({})
  })
  console.log('4 сломанная среда:', result.вердикт, '|', result.причина)
}

// ── 5. Молчание не расходует попытку
{
  const silence = {}
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (label.startsWith('аудит')) {
      const d = domainOf(label)
      if (d === 'clients') { silence[d] = (silence[d] || 0) + 1; if (silence[d] <= 2) return null }
      return ok({ domain: d, endpoints: 5, emptyFields: 0 })
    }
    if (label.startsWith('соглашения')) return ok({})
    if (label.startsWith('контракт')) return ok({ domain: domainOf(label), documented: 5, commit: 'c' })
    if (label.startsWith('приёмка')) return { domain: domainOf(label), refuted: false, reason: '', checked: 'x' }
    if (label === 'финал') return ok({})
  })
  const clientCalls = calls.filter((c) => c.startsWith('аудит clients'))
  console.log('5 молчание:', result.вердикт, '| вызовов по clients', clientCalls.length, '| метки:', clientCalls.join(' / '), '| clients сведён:', result.аудитов.includes('clients'))
}

// ── 6. Соглашения не сошлись — фаза C не запускается, аудиты сохранены
{
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 5, emptyFields: 0 })
    if (label.startsWith('соглашения')) return { status: 'провалено', notes: 'гейт красный' }
    return ok({})
  })
  console.log('6 соглашения:', result.вердикт, '| попыток', calls.filter((c) => c.startsWith('соглашения')).length, '| аудитов сохранено', result.аудитов.length, '| контрактов писали:', calls.filter((c) => c.startsWith('контракт')).length)
}

// ── 7. Дерево занято — прогон не начинается
{
  const { result, calls } = await harness(() => ok({ branch: 'b', treeClean: false, gateGreen: true }))
  console.log('7 грязное дерево:', result.вердикт, '|', result.причина, '| агентов всего', calls.length)
}

// ── 8. Недоступность API
{
  const { result } = await harness((label) => (label === 'подготовка' ? ok({ branch: 'b', treeClean: true, gateGreen: true }) : null))
  console.log('8 молчит всё:', result.вердикт, '|', result.причина)
}

// ── Сценарии 9–13: различают ли защиты случаи ──
const dom = domainOf
// ── 9. Первые ДВА домена валятся, третий проходит — защита среды НЕ должна срабатывать
{
  const bad = new Set(['warehouse', 'orders'])
  const { result } = await harness((l) => {
    if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) { const d = dom(l); return bad.has(d) ? ok({ domain: d, endpoints: 1, emptyFields: 3, notes: 'недозаполнен' }) : ok({ domain: d, endpoints: 5, emptyFields: 0 }) }
    if (l.startsWith('соглашения')) return ok({})
    if (l.startsWith('контракт')) return ok({ domain: dom(l), documented: 5, commit: 'c' })
    if (l.startsWith('приёмка')) return { domain: dom(l), refuted: false, reason: '', checked: 'x' }
    if (l === 'финал') return ok({})
  })
  console.log('9 два из трёх:', result.вердикт, '| остановка:', result.причина_остановки ?? 'нет', '| написано', result.написано.length, '| не сведено:', result.не_сведено.join(','))
}

// ── 10. Пять провалов вразброс — прогон обязан дойти до конца
{
  const bad = new Set(['config', 'clients', 'bcc', 'finance', 'analytics'])
  const { result } = await harness((l) => {
    if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) { const d = dom(l); return bad.has(d) ? ok({ domain: d, endpoints: 1, emptyFields: 1, notes: 'не сошлось' }) : ok({ domain: d, endpoints: 5, emptyFields: 0 }) }
    if (l.startsWith('соглашения')) return ok({})
    if (l.startsWith('контракт')) return ok({ domain: dom(l), documented: 5, commit: 'c' })
    if (l.startsWith('приёмка')) return { domain: dom(l), refuted: false, reason: '', checked: 'x' }
    if (l === 'финал') return ok({})
  })
  console.log('10 пять провалов:', result.вердикт, '| остановка:', result.причина_остановки ?? 'нет', '| написано', result.написано.length, '| не сведено', result.не_сведено.length)
}

// ── 11. Старое поведение возвращается флагом: stopAfterFailures=2
{
  const bad = new Set(['warehouse', 'orders'])
  const { result } = await harness((l) => {
    if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) { const d = dom(l); return bad.has(d) ? ok({ domain: d, endpoints: 1, emptyFields: 3, notes: 'x' }) : ok({ domain: d, endpoints: 5, emptyFields: 0 }) }
    return ok({})
  }, { stopAfterFailures: 2 })
  console.log('11 флаг stopAfterFailures=2:', result.вердикт, '|', result.причина)
}

// ── 12. auditOnly: за ночь только аудит
{
  const { result, calls } = await harness((l) => {
    if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) return ok({ domain: dom(l), endpoints: 5, emptyFields: 0 })
    return ok({})
  }, { auditOnly: true })
  console.log('12 auditOnly:', result.вердикт, '| аудитов', result.аудитов.length, '| писали контрактов', calls.filter((c) => c.startsWith('контракт')).length)
}

// ── 13. Ограниченный список доменов
{
  const { result } = await harness((l) => {
    if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) return ok({ domain: dom(l), endpoints: 5, emptyFields: 0 })
    if (l.startsWith('соглашения')) return ok({})
    if (l.startsWith('контракт')) return ok({ domain: dom(l), documented: 5, commit: 'c' })
    if (l.startsWith('приёмка')) return { domain: dom(l), refuted: false, reason: '', checked: 'x' }
    if (l === 'финал') return ok({})
  }, { domains: ['auth', 'uploads'] })
  console.log('13 два домена:', result.вердикт, '| написано:', result.написано.join(','))
}
