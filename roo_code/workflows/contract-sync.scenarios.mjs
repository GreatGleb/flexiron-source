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


// ── Сценарии 14–16: порядок по зависимостям и передача аудитов вперёд ──
//
// Порядок обхода — не косметика: аудитор домена, который опирается на чужой, обязан читать
// готовый аудит соседа, а не выводить те же правила заново своими словами. Зависимости
// замерены по импортам между моками; здесь проверяется, что порядок их не нарушает, что
// соседи действительно названы в промпте и что подмножество доменов не вешает сортировку.
{
  const runWf = (behaviour, args = {}) => run(behaviour, () => {}, () => {}, null, null, args)
  // Порядок аудита и то, какие соседи названы готовыми
  const order = []
  const promptFor = {}
  await runWf(async (prompt, opts = {}) => {
    const l = opts.label || '?'
    if (l === 'подготовка') return ok({ branch: 'auto/contract-x', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) { const d = dom(l); order.push(d); promptFor[d] = prompt; return ok({ domain: d, endpoints: 5, emptyFields: 0 }) }
    if (l.startsWith('соглашения')) return ok({})
    if (l.startsWith('контракт')) return ok({ domain: dom(l), documented: 5, commit: 'c' })
    if (l.startsWith('приёмка')) return { domain: dom(l), refuted: false, reason: '', checked: 'x' }
    return ok({})
  })

  console.log('14 порядок аудита:\n  ' + order.join(' → '))

  const DEPS = { products: ['categories'], services: ['settings'], warehouse: ['products','settings','notifications'],
    orders: ['clients','products','services','settings','warehouse','notifications'], finance: ['orders','notifications'],
    'audit-feed': ['orders','clients','products','suppliers','warehouse'], 'sales-crm': ['orders'], bcc: ['suppliers','settings','notifications'] }
  const pos = Object.fromEntries(order.map((d, i) => [d, i]))
  const broken = Object.entries(DEPS).flatMap(([d, ds]) => ds.filter((x) => pos[x] > pos[d]).map((x) => `${d} идёт раньше своей зависимости ${x}`))
  console.log('15 нарушений порядка:', broken.length ? '\n  ' + broken.join('\n  ') : 'нет')

  for (const d of ['orders', 'audit-feed', 'categories']) {
    const m = promptFor[d].match(/ЭТОТ ДОМЕН ОПИРАЕТСЯ НА УЖЕ СВЕДЁННЫЕ[\s\S]*?\n\n/)
    const files = m ? [...m[0].matchAll(/audit\/([a-z-]+)\.md/g)].map((x) => x[1]) : []
    console.log(`  ${d}: назван${files.length ? 'ы аудиты ' + files.join(', ') : 'о — соседей нет'}`)
  }

  // Инверсия: подмножество доменов не должно ломаться о зависимость вне прогона
  const order2 = []
  await runWf(async (prompt, opts = {}) => {
    const l = opts.label || '?'
    if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
    if (l.startsWith('аудит')) { const d = dom(l); order2.push(d); return ok({ domain: d, endpoints: 5, emptyFields: 0 }) }
    if (l.startsWith('соглашения')) return ok({})
    if (l.startsWith('контракт')) return ok({ domain: dom(l), documented: 5, commit: 'c' })
    if (l.startsWith('приёмка')) return { domain: dom(l), refuted: false, reason: '', checked: 'x' }
    return ok({})
  }, { domains: ['orders', 'finance'] })
  console.log('16 подмножество ["orders","finance"] →', order2.join(' → '), order2.length === 2 ? '(не зависло)' : '(ПРОБЛЕМА)')

}

// ── Сценарий 17: необратимые шаги финала ──
//
// Снос монолита, переезд ссылок и EXPECT_ALL_DOMAINS = true разрешены, только когда закрыты ВСЕ
// домены проекта. Проверка сравнивала с числом доменов ЭТОГО прогона — и прогон на подмножестве
// («закрыт один из одного») получал разрешение снести файл, от которого не переехали шестнадцать
// остальных. Найдено при подготовке смоук-прогона на домене uploads, до запуска.
{
  const finalPromptFor = async (args) => {
    let captured = ''
    await run(
      async (prompt, opts = {}) => {
        const l = opts.label || '?'
        if (l === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true })
        if (l.startsWith('аудит')) return ok({ domain: domainOf(l), endpoints: 5, emptyFields: 0 })
        if (l.startsWith('соглашения')) return ok({})
        if (l.startsWith('контракт')) return ok({ domain: domainOf(l), documented: 5, commit: 'c' })
        if (l.startsWith('приёмка')) return { domain: domainOf(l), refuted: false, reason: '', checked: 'x' }
        if (l === 'финал') { captured = prompt; return ok({}) }
        return ok({})
      },
      () => {}, () => {}, null, null, args,
    )
    return captured
  }
  const subset = await finalPromptFor({ domains: ['uploads'] })
  const full = await finalPromptFor({})
  console.log('17 необратимые шаги: подмножество —', /ЗАПРЕЩЕНЫ/.test(subset) ? 'запрещены ✓' : 'РАЗРЕШЕНЫ ✗',
    '| полный прогон —', /РАЗРЕШЕНЫ/.test(full) ? 'разрешены ✓' : 'ЗАПРЕЩЕНЫ ✗')
}

// ── 18. skipAudit: фаза аудита не запускается, аудиты берутся с диска
{
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true, skeletons: 17, inventory: 175, baseBranch: 'main' })
    if (label.startsWith('skipAudit')) {
      return { ready: ['settings', 'config', 'clients', 'suppliers', 'categories', 'services', 'notifications', 'analytics', 'uploads', 'auth', 'products', 'bcc', 'warehouse', 'orders', 'finance', 'audit-feed', 'sales-crm'].map((d) => ({ domain: d, endpoints: 5 })), notReady: [], notes: 'вывод grep по каждому' }
    }
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 5, emptyFields: 0, commit: 'a' })
    if (label.startsWith('соглашения')) return ok({ commit: 'c' })
    if (label.startsWith('контракт')) return ok({ domain: domainOf(label), documented: 5, commit: 'b' })
    if (label.startsWith('приёмка')) return { domain: domainOf(label), refuted: false, reason: '', checked: 'x' }
    if (label === 'финал') return ok({})
    throw new Error('неизвестная метка ' + label)
  }, { skipAudit: true })
  const auditAgents = calls.filter((c) => c.startsWith('аудит ')).length
  console.log('18 skipAudit:', result.вердикт, '| агентов аудита', auditAgents, '(ждём 0)',
    '| аудитов', result.аудитов.length, '| написано', result.написано.length)
}

// ── 19. skipAudit РАЗЛИЧАЕТ годный аудит и негодный: с пустыми графами домен переделывается
{
  const { result, calls } = await harness((label) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true, skeletons: 17, inventory: 175, baseBranch: 'main' })
    if (label.startsWith('skipAudit')) {
      return {
        ready: ['settings', 'config', 'clients', 'suppliers', 'categories', 'services', 'notifications', 'analytics', 'uploads', 'auth', 'products', 'bcc', 'orders', 'finance', 'audit-feed', 'sales-crm'].map((d) => ({ domain: d, endpoints: 5 })),
        notReady: [{ domain: 'warehouse', reason: 'пустых граф 231' }],
        notes: 'вывод grep',
      }
    }
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 37, emptyFields: 0, commit: 'a' })
    if (label.startsWith('соглашения')) return ok({ commit: 'c' })
    if (label.startsWith('контракт')) return ok({ domain: domainOf(label), documented: 5, commit: 'b' })
    if (label.startsWith('приёмка')) return { domain: domainOf(label), refuted: false, reason: '', checked: 'x' }
    if (label === 'финал') return ok({})
    throw new Error('неизвестная метка ' + label)
  }, { skipAudit: true })
  const audited = calls.filter((c) => c.startsWith('аудит '))
  console.log('19 skipAudit различает:', result.вердикт, '| переделан аудит:', audited.join(',') || '(никто) ✗',
    '| написано', result.написано.length)
}

// ── 20. Черновик переживает откат: откатчику назван путь, второй попытке — тоже
{
  let revertPrompt = ''
  let secondTry = ''
  await harness((label, prompt) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true, skeletons: 1, inventory: 1, baseBranch: 'main' })
    if (label.startsWith('аудит')) return ok({ domain: domainOf(label), endpoints: 1, emptyFields: 0 })
    if (label.startsWith('соглашения')) return ok({})
    if (label.startsWith('контракт')) {
      if (/попытка 2/.test(label)) secondTry = prompt
      return ok({ domain: domainOf(label), documented: 1, commit: 'deadbee' })
    }
    if (label.startsWith('приёмка')) {
      return { domain: domainOf(label), refuted: !/попытка 2/.test(label), reason: 'ссылка не резолвится', checked: 'x' }
    }
    if (label.startsWith('откат')) { revertPrompt = prompt; return ok({}) }
    if (label === 'финал') return ok({})
    throw new Error('неизвестная метка ' + label)
  }, { domains: ['uploads'] })
  const saves = /cp roo_code\/roo-context\/api\/uploads\.md/.test(revertPrompt)
  const restores = /cp \/tmp\/contract-drafts\/uploads\.md/.test(secondTry)
  const forbidsRewrite = /Писать домен заново запрещено/.test(secondTry)
  console.log('20 черновик:', 'откатчик сохраняет —', saves ? '✓' : '✗',
    '| вторая попытка восстанавливает —', restores ? '✓' : '✗',
    '| переписывание запрещено —', forbidsRewrite ? '✓' : '✗')
}

// ── 21. Резолвер ссылок и запрет номеров монолита названы всем трём: аудит, автор, приёмщик
{
  const seen = {}
  await harness((label, prompt) => {
    if (label === 'подготовка') return ok({ branch: 'b', treeClean: true, gateGreen: true, skeletons: 1, inventory: 1, baseBranch: 'main' })
    if (label.startsWith('аудит')) { seen.audit = prompt; return ok({ domain: domainOf(label), endpoints: 1, emptyFields: 0 }) }
    if (label.startsWith('соглашения')) return ok({})
    if (label.startsWith('контракт')) { seen.write = prompt; return ok({ domain: domainOf(label), documented: 1, commit: 'c' }) }
    if (label.startsWith('приёмка')) { seen.judge = prompt; return { domain: domainOf(label), refuted: false, reason: '', checked: 'x' } }
    if (label === 'финал') return ok({})
    throw new Error('неизвестная метка ' + label)
  }, { domains: ['uploads'] })
  const resolver = ['audit', 'write', 'judge'].filter((k) => /contractRefs\.spec\.ts/.test(seen[k] || ''))
  const banned = ['audit', 'write', 'judge'].filter((k) => /03-api-contract\.md/.test(seen[k] || '') && /ЗАПРЕЩЕН/i.test(seen[k] || ''))
  const noWordOnly = ['write', 'judge'].filter((k) =>
    /без\s+вывода\s+не\s+принимается|вывода\s+резолвера\s+в\s+его\s+ответе\s+нет/.test(seen[k] || ''),
  )
  console.log('21 резолвер: назван —', resolver.join(',') || '(никому) ✗',
    '| номера монолита запрещены —', banned.join(',') || '(никому) ✗',
    '| «провалов 0» без вывода не принято —', noWordOnly.join(',') || '(нигде) ✗')
}
