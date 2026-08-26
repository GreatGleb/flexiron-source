export const meta = {
  name: 'inventory-plans',
  description: 'Инвентаризация планов: что из них уже сделано в коде, что нет. Код не меняется.',
  whenToUse: 'Перед автономным прогоном реализации — чтобы знать настоящий объём работы, а не завышенный счёт по чекбоксам',
  phases: [
    { title: 'Разведка', detail: 'планы с размерами и числом пунктов, занятые файлы' },
    { title: 'Инвентаризация', detail: 'пачка планов на агента, вердикты и частичный отчёт' },
    { title: 'Проверка сделанного', detail: 'скептик опровергает вердикты «сделано»' },
    { title: 'Добор упавшего', detail: 'повтор упавших пачек по одному плану' },
    { title: 'Сборка', detail: 'сводный отчёт из частей' },
    { title: 'Приёмка', detail: 'независимый счёт планов и полнота отчёта' },
  ],
}

// Политика: roo_code/plans/general/autonomous-run-policy-plan.md, раздел 7.
// Прогон ничего не пишет в код, не коммитит и не стешит. Пишутся только файлы отчёта.

const VERDICT = ['сделано', 'частично', 'не начато', 'непонятно']
const PART_DIR = 'roo_code/plans/general/inventory-parts'

const DISCOVERY = {
  type: 'object',
  properties: {
    total: { type: 'number', description: 'Итог find ... | wc -l — независимо от длины списка ниже' },
    plans: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          bytes: { type: 'number' },
          items: { type: 'number', description: 'Число незакрытых чекбоксов в плане' },
        },
        required: ['path', 'bytes', 'items'],
        additionalProperties: false,
      },
    },
    dirtyFiles: { type: 'array', items: { type: 'string' } },
  },
  required: ['total', 'plans', 'dirtyFiles'],
  additionalProperties: false,
}

const BATCH = {
  type: 'object',
  properties: {
    partFile: { type: 'string', description: 'Путь записанного частичного отчёта' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          verdict: { type: 'string', enum: VERDICT },
          evidence: { type: 'string', description: 'Команда и её вывод. Для «сделано» обязательна.' },
          detail: { type: 'string' },
          filesMentioned: {
            type: 'array',
            description: 'Пути файлов кода, упомянутые в плане — как они написаны в плане',
            items: { type: 'string' },
          },
          itemsTotal: { type: 'number', description: 'Сколько незакрытых чекбоксов в плане (grep -c)' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                verdict: { type: 'string', enum: VERDICT },
                evidence: { type: 'string' },
              },
              required: ['item', 'verdict'],
              additionalProperties: false,
            },
          },
        },
        required: ['path', 'verdict', 'evidence', 'itemsTotal'],
        additionalProperties: false,
      },
    },
  },
  required: ['results'],
  additionalProperties: false,
}

const SKEPTIC = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          refuted: { type: 'boolean' },
          newVerdict: { type: 'string', enum: VERDICT },
          reason: { type: 'string' },
        },
        required: ['path', 'refuted', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
}

const ACCEPT = {
  type: 'object',
  properties: {
    reportPath: { type: 'string' },
    plansOnDisk: { type: 'number', description: 'Свой, независимый счёт: find roo_code/plans -name "*.md" | wc -l' },
    pathsInReport: { type: 'number', description: 'Сколько разных путей планов перечислено в отчёте' },
    sectionsPresent: { type: 'boolean' },
    missingFromReport: { type: 'array', items: { type: 'string' } },
    partsFound: { type: 'number' },
    partsMissing: { type: 'array', items: { type: 'string' } },
    problems: { type: 'array', items: { type: 'string' } },
    ok: { type: 'boolean' },
  },
  required: ['plansOnDisk', 'pathsInReport', 'ok', 'problems'],
  additionalProperties: false,
}

phase('Разведка')

const disc = await agent(
  [
    'Собери данные о планах. НИЧЕГО НЕ МЕНЯЙ.',
    '',
    'ВАЖНО: сам этот прогон пишет свои файлы в roo_code/plans/general/ — отчёты inventory-*.md',
    'и части inventory-parts/. Они НЕ планы. Исключай их везде фильтром:',
    '  FIND=\'find roo_code/plans -name "*.md" -not -name "inventory-*.md" -not -path "*inventory-parts*"\'',
    'Иначе на повторном прогоне прошлый отчёт будет посчитан планом.',
    '',
    '1. total — просто число: <FIND> | wc -l',
    '2. plans — по каждому файлу: path, bytes (wc -c), items (число строк "- [ ]").',
    '   Считай командами, например:',
    '     <FIND> | sort',
    '     wc -c $(<FIND> | sort)',
    '     grep -c "^[[:space:]]*- \\[ \\]" по каждому файлу (или grep -rc с тем же исключением)',
    '   grep -c печатает 0 не для всех файлов — у отсутствующих в выводе items = 0.',
    '3. dirtyFiles — пути с незакоммиченными правками: git status --short, только пути без буквы статуса.',
    '',
    'plans должен содержать ВСЕ файлы, найденные find. Если список получается короче total —',
    'не обрезай и не выбирай «важные»: верни всё, иначе прогон посчитает недостачу полным набором.',
  ].join('\n'),
  { schema: DISCOVERY, label: 'разведка', phase: 'Разведка' },
)

if (!disc || !disc.plans || disc.plans.length === 0) {
  return { вердикт: 'ПРИЁМКА НЕ ПРОЙДЕНА', error: 'Разведка не вернула ни одного плана' }
}

// Резать прогон: {offset, limit} в args. По умолчанию — все планы, чтобы промпты судей
// совпадали с прошлым прогоном и отдавались из кеша при resumeFromRunId.
const slice = args && typeof args === 'object' ? args : {}
const offset = Number(slice.offset) > 0 ? Number(slice.offset) : 0
const limit = Number(slice.limit) > 0 ? Number(slice.limit) : 0

const CAP = 250
let plans = disc.plans
if (offset > 0 || limit > 0) {
  plans = plans.slice(offset, limit > 0 ? offset + limit : undefined)
  log(`Кусок: планы с ${offset + 1} по ${offset + plans.length} из ${disc.plans.length}`)
}
let dropped = 0
if (plans.length > CAP) {
  dropped = plans.length - CAP
  plans = plans.slice(0, CAP)
}
if (dropped > 0) log(`Планов ${plans.length + dropped}, взято ${CAP}, отброшено ${dropped} — остаток следующим прогоном`)

const discItems = new Map(disc.plans.map((p) => [p.path, p.items || 0]))
const discoveryMismatch = disc.total !== disc.plans.length
if (discoveryMismatch) {
  log(`РАЗВЕДКА НЕПОЛНА: find видит ${disc.total} планов, в списке ${disc.plans.length}. Приёмка будет провалена.`)
}

// Пачки: сначала по каталогу — связанные планы (phase3-subtask1/2/3) к одному агенту,
// внутри каталога — по суммарному объёму, а не по счёту: 35 КБ и 2 КБ читаются по-разному.
const BYTES_PER_AGENT = 40000
const MAX_PER_AGENT = 6
const byDir = new Map()
for (const p of plans) {
  const cut = p.path.lastIndexOf('/')
  const dir = cut > 0 ? p.path.slice(0, cut) : '.'
  if (!byDir.has(dir)) byDir.set(dir, [])
  byDir.get(dir).push(p)
}
const batches = []
for (const [dir, list] of byDir) {
  let cur = []
  let sum = 0
  for (const p of list) {
    if (cur.length > 0 && (sum + p.bytes > BYTES_PER_AGENT || cur.length >= MAX_PER_AGENT)) {
      batches.push({ dir, plans: cur })
      cur = []
      sum = 0
    }
    cur.push(p)
    sum += p.bytes
  }
  if (cur.length > 0) batches.push({ dir, plans: cur })
}
batches.forEach((b, i) => {
  b.index = i
  // Путь части задаёт скрипт: он же потом отдаёт сборщику точный список.
  // Читать каталог сборщику нельзя — там могут лежать части прошлого прогона.
  b.partFile = `${PART_DIR}/part-${String(i + 1).padStart(3, '0')}.md`
})

log(`Планов ${plans.length}, пачек ${batches.length} (по каталогам, до ${Math.round(BYTES_PER_AGENT / 1000)} КБ на агента), занято чужой правкой файлов: ${disc.dirtyFiles.length}`)

function judgePrompt(b, partFile) {
  return [
    'Ты инвентаризуешь планы проекта. НИЧЕГО НЕ МЕНЯЙ: ни кода, ни планов, ни гита.',
    'Задача — по каждому плану сказать, сделано ли уже то, что в нём написано.',
    '',
    `Каталог: ${b.dir}. Планы этой пачки (связаны между собой, читай с учётом соседей):`,
    ...b.plans.map((p) => `  ${p.path}  (${p.bytes} байт, чекбоксов ${p.items})`),
    '',
    'По каждому плану:',
    '1. Прочитай план целиком.',
    '2. Пойми, какое состояние кода он утверждает и чего требует.',
    '3. Проверь состояние в коде — grep или чтение. Утверждениям плана о коде НЕ верь:',
    '   планы этого проекта частично описывают прошлое. Пример: warehouse/fix-offcuts-type-column.md',
    '   утверждает, что у .offcut-type-badge нет ни одного CSS-правила нигде в проекте — правила есть,',
    '   src/styles/admin/warehouse_list.css:1076, а выделенной колонки типа действительно нет.',
    '   Такой план — «частично».',
    '4. Вердикт:',
    '   сделано    — код соответствует плану ЦЕЛИКОМ. evidence: команда и её вывод. Нет команды — «непонятно».',
    '   частично   — часть есть, часть нет. detail: что есть, чего нет.',
    '   не начато  — проверено, что в коде нет ничего из плана.',
    '   непонятно  — план не сопоставляется с кодом. detail: причина одной строкой.',
    '5. itemsTotal — число незакрытых чекбоксов в плане, посчитай командой:',
    '   grep -c "^[[:space:]]*- \\[ \\]" <план>',
    '   Если itemsTotal > 0 — заполни items вердиктом на КАЖДЫЙ пункт, без пропусков.',
    '   Вернуть 12 пунктов там, где их 33, — та же потеря работы, что потерянный план.',
    '6. filesMentioned — пути файлов кода, упомянутые в плане, как они там написаны. Не додумывай.',
    '',
    `7. Запиши частичный отчёт в ${partFile} (каталог создай, если нет: mkdir -p ${PART_DIR}).`,
    '   По плану: путь, вердикт, доказательство целиком, что осталось, список пунктов с вердиктами.',
    '   Это единственный файл, который тебе разрешено создавать. Чужие части не трогай.',
    '   В partFile верни его путь.',
    '',
    'Смещение в сомнительных случаях: лучше «частично» или «непонятно», чем «сделано».',
    'Ошибочное «не начато» стоит одной лишней задачи. Ошибочное «сделано» выбрасывает работу молча.',
  ].join('\n')
}

function skepticPrompt(done) {
  return [
    'Тебе дали вердикты «сделано». Твоя задача — ОПРОВЕРГНУТЬ их, а не подтвердить.',
    'Ты их не выносил и выводам предыдущего агента не обязан верить.',
    '',
    ...done.map((r) => `План: ${r.path}\n  Заявлено: сделано\n  Доказательство: ${r.evidence}`),
    '',
    'По каждому:',
    '1. Прочитай план сам.',
    '2. Команда из доказательства действительно даёт такой вывод? Вывод действительно означает,',
    '   что план выполнен ЦЕЛИКОМ, а не в одной своей части?',
    '3. Найди в плане хотя бы одно требование, которого в коде нет. Нашёл — вердикт опровергнут.',
    '',
    'refuted = true, если план выполнен не целиком, ИЛИ доказательство не доказывает заявленного,',
    'ИЛИ ты не смог убедиться. Сомневаешься — опровергай: план вернётся в работу, это дешёвая ошибка.',
    'Ошибочное подтверждение выбрасывает работу молча. При refuted = true дай newVerdict.',
    'Ничего в коде и в частичных отчётах не меняй.',
  ].join('\n')
}

phase('Инвентаризация')

const judged = await pipeline(
  batches,
  (b) =>
    agent(judgePrompt(b, b.partFile), {
      schema: BATCH,
      label: `${b.dir.replace('roo_code/plans/', '')} ${b.index + 1}/${batches.length}`,
      phase: 'Инвентаризация',
    }),
  (res, b) => {
    if (!res || !res.results) return { batch: b, failed: true, results: [], refutations: [], partFile: null }
    const done = res.results.filter((r) => r.verdict === 'сделано')
    if (done.length === 0) return { batch: b, failed: false, results: res.results, refutations: [], skepticFailed: false, partFile: res.partFile }
    return agent(skepticPrompt(done), {
      schema: SKEPTIC,
      label: `скептик ${b.index + 1}`,
      phase: 'Проверка сделанного',
    }).then((v) => ({
      batch: b,
      failed: false,
      results: res.results,
      refutations: v && v.verdicts ? v.verdicts : [],
      // Скептик мог умереть (таймаут, обрыв). Пустой список опровержений тогда НЕ значит
      // «всё подтверждено»: в первом прогоне так прошли 38 групп из 39, и 80 вердиктов
      // «сделано» оказались непроверенными, хотя выглядели проверенными.
      skepticFailed: !v || !v.verdicts,
      partFile: res.partFile,
    }))
  },
)

// Добор: упавшая пачка — это до шести планов сразу. Повторяем по одному.
const chunks = judged.filter(Boolean)
const failedBatches = chunks.filter((c) => c.failed).map((c) => c.batch)
const nullBatches = batches.filter((b) => !chunks.some((c) => c.batch && c.batch.index === b.index))
const toRetry = [...failedBatches, ...nullBatches].flatMap((b) => b.plans.map((p) => ({ plan: p, dir: b.dir })))

const RETRY_CAP = 12
let retryDropped = 0
let retryList = toRetry
if (retryList.length > RETRY_CAP) {
  retryDropped = retryList.length - RETRY_CAP
  retryList = retryList.slice(0, RETRY_CAP)
}
retryList.forEach((item, i) => {
  item.partFile = `${PART_DIR}/part-retry-${String(i + 1).padStart(3, '0')}.md`
})

let retried = []
if (retryList.length > 0) {
  phase('Добор упавшего')
  log(`Упало пачек: ${failedBatches.length + nullBatches.length}. Добираю ${retryList.length} планов по одному${retryDropped > 0 ? `, ${retryDropped} не добираю — останутся работой` : ''}`)
  retried = await parallel(
    retryList.map((item, i) => () =>
      agent(judgePrompt({ dir: item.dir, plans: [item.plan], index: 900 + i }, item.partFile), {
        schema: BATCH,
        label: `добор ${item.plan.path.split('/').pop()}`,
        phase: 'Добор упавшего',
      }),
    ),
  )
}

// Части, которых мы ВПРАВЕ ожидать на диске: только от агентов, вернувших результат.
const expectedParts = []
const partMismatch = []
let skepticMissing = 0
let skepticSilent = 0
// Сведение результатов
const rows = []
for (const c of chunks) {
  if (c.failed) continue
  if (c.batch && c.batch.partFile) {
    expectedParts.push(c.batch.partFile)
    if (c.partFile && c.partFile !== c.batch.partFile) partMismatch.push(`${c.batch.partFile} → агент вернул ${c.partFile}`)
  }
  const byPath = new Map(c.refutations.map((v) => [v.path, v]))
  for (const r of c.results) {
    const ref = byPath.get(r.path)
    if (ref && ref.refuted) {
      rows.push({ ...r, verdict: ref.newVerdict || 'непонятно', detail: `[скептик опроверг «сделано»] ${ref.reason}` })
    } else if (r.verdict === 'сделано' && c.skepticFailed) {
      skepticMissing++
      rows.push({ ...r, verdict: 'непонятно', detail: `[скептик не отработал, «сделано» не подтверждено] ${r.detail || ''}`.trim() })
    } else if (r.verdict === 'сделано' && !byPath.has(r.path)) {
      skepticSilent++
      rows.push({ ...r, detail: `[скептик не высказался по этому плану] ${r.detail || ''}`.trim() })
    } else {
      rows.push(r)
    }
  }
}
let refutedCount = chunks.reduce((n, c) => n + c.refutations.filter((v) => v.refuted).length, 0)
// Добранные планы скептик не смотрел: их вердикт «сделано» держится только на машинной
// проверке доказательства. Помечаем, чтобы это было видно в отчёте, а не только здесь.
retried.forEach((r, i) => {
  if (r && retryList[i] && retryList[i].partFile) expectedParts.push(retryList[i].partFile)
})
for (const r of retried.filter(Boolean)) {
  for (const one of r.results || []) {
    if (one.verdict === 'сделано') one.detail = `[добор, скептик не проверял] ${one.detail || ''}`.trim()
    rows.push(one)
  }
}

// Приёмка доказательств — машинная. Правило «команда и её вывод» иначе держится
// только на добросовестности агента.
const CMD_MARKERS = ['grep', 'rg ', 'sed ', 'cat ', 'ls ', 'find ', 'wc ', 'git ', 'npm ', 'npx ', 'test -']
function evidenceLooksReal(e) {
  const t = String(e || '')
  return t.length >= 20 && CMD_MARKERS.some((m) => t.includes(m))
}
let demoted = 0
for (const r of rows) {
  if (r.verdict === 'сделано' && !evidenceLooksReal(r.evidence)) {
    r.detail = `[разжалован: доказательство без команды] ${r.detail || ''}`.trim()
    r.verdict = 'непонятно'
    demoted++
  }
}

// touchesDirty считается, а не оценивается на глазок
const dirty = disc.dirtyFiles || []
for (const r of rows) {
  const mentioned = r.filesMentioned || []
  r.touchesDirty = mentioned.some((m) => m.length > 6 && dirty.some((d) => d.includes(m) || m.includes(d)))
}

// Полнота: план ровно один раз; пункты не потеряны
const seen = new Map()
for (const r of rows) seen.set(r.path, (seen.get(r.path) || 0) + 1)
const missing = plans.map((p) => p.path).filter((p) => !seen.has(p))
const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p)
// Число пунктов измерено дважды — разведкой и судьёй. Расхождение значит, что один из двоих
// читал файл невнимательно, поэтому для проверки полноты берём строгое из двух.
const itemsDisagree = []
const itemsIncomplete = []
for (const r of rows) {
  const fromDisc = discItems.has(r.path) ? discItems.get(r.path) : 0
  const fromJudge = r.itemsTotal || 0
  if (fromDisc !== fromJudge) itemsDisagree.push(`${r.path}: разведка ${fromDisc}, судья ${fromJudge}`)
  const expected = Math.max(fromDisc, fromJudge)
  const got = r.items ? r.items.length : 0
  if (expected > 0 && got < expected) itemsIncomplete.push(`${r.path}: пунктов ${expected}, вердиктов ${got}`)
}

const counts = { сделано: 0, частично: 0, 'не начато': 0, непонятно: 0 }
for (const r of rows) if (counts[r.verdict] !== undefined) counts[r.verdict]++

log(`Разобрано ${rows.length} из ${plans.length}. Сделано ${counts['сделано']}, частично ${counts['частично']}, не начато ${counts['не начато']}, непонятно ${counts['непонятно']}. Скептик опроверг ${refutedCount}, разжаловано ${demoted}.`)
if (missing.length > 0) log(`НЕ РАЗОБРАНО ${missing.length}: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`)
if (duplicated.length > 0) log(`Дубли вердиктов: ${duplicated.join(', ')}`)
if (itemsIncomplete.length > 0) log(`Пункты потеряны у ${itemsIncomplete.length} планов: ${itemsIncomplete.slice(0, 5).join(' | ')}`)
if (itemsDisagree.length > 0) log(`Число пунктов разошлось у ${itemsDisagree.length} планов: ${itemsDisagree.slice(0, 5).join(' | ')}`)
if (partMismatch.length > 0) log(`Часть записана не туда, куда просили: ${partMismatch.join('; ')}`)
if (skepticMissing > 0) log(`«Сделано» разжаловано из-за упавшего скептика: ${skepticMissing}`)
if (skepticSilent > 0) log(`«Сделано», по которым скептик не высказался: ${skepticSilent}`)

phase('Сборка')

const index = rows.map((r) => ({
  path: r.path,
  verdict: r.verdict,
  dirty: r.touchesDirty ? 1 : 0,
  items: r.itemsTotal || 0,
  short: String(r.detail || r.evidence || '').slice(0, 160),
}))

// Разделы пишутся параллельно, по ~40 планов на агента: один агент в конце часового
// прогона — это одна точка отказа, и в первом прогоне она отказала.
const SECTION_SIZE = 40
const sectionGroups = []
for (let i = 0; i < index.length; i += SECTION_SIZE) {
  sectionGroups.push({ n: sectionGroups.length + 1, rows: index.slice(i, i + SECTION_SIZE) })
}
const sectionFiles = sectionGroups.map((g) => `${PART_DIR}/section-${String(g.n).padStart(2, '0')}.md`)

const sections = await parallel(
  sectionGroups.map((g) => () =>
    agent(
      [
        `Запиши раздел сводного отчёта в ${sectionFiles[g.n - 1]}. В коде ничего не меняй.`,
        '',
        'По каждому плану — ОДНА строка: путь, вердикт, коротко что осталось.',
        'Подробности не дублируй: они в частях inventory-parts/part-*.md.',
        'Перечисли ВСЕ планы из списка ниже, без исключений и без «самого важного».',
        '',
        JSON.stringify(g.rows),
      ].join('\n'),
      { label: `раздел ${g.n}/${sectionGroups.length}`, phase: 'Сборка' },
    ),
  ),
)
const sectionsFailed = sections.filter((x) => !x).length
if (sectionsFailed > 0) log(`Разделов не записано: ${sectionsFailed} из ${sectionGroups.length}`)

const report = await agent(
  [
    'Собери ГОЛОВУ сводного отчёта инвентаризации. В коде ничего не меняй.',
    'Разделы с перечнем планов уже записаны другими агентами — не переписывай их и не дублируй:',
    ...sectionFiles.map((f) => '  ' + f),
    '',
    '',
    '1. Узнай дату: date +%F',
    '2. Частичные отчёты этого прогона перечислены ниже — там доказательства целиком.',
    '   Читай ТОЛЬКО их, по списку. Каталог целиком не читай: в нём могут лежать части',
    '   прошлых прогонов с устаревшими вердиктами, и они попадут в отчёт как свежие.',
    '   Файла из списка нет — так и напиши в отчёте у соответствующих планов, не выдумывай подробностей.',
    '   Ничего в частях не переписывай и не удаляй.',
    '',
    'Части этого прогона:',
    expectedParts.map((f) => '  ' + f).join('\n'),
    '3. Запиши голову отчёта в roo_code/plans/general/inventory-<дата>.md:',
    '   шапка с датой и сводкой, объяснение вердиктов, ссылки на разделы и на части.',
    '   Затем ПРИСОЕДИНИ содержимое разделов к этому файлу (cat разделов в конец),',
    '   чтобы отчёт был полным одним файлом, а не оглавлением без содержания.',
    '',
    'Структура: шапка (дата, сколько планов, сводка по вердиктам, сколько опроверг скептик),',
    'затем четыре раздела — «Работа» (не начато и частично), «Можно закрыть» (сделано),',
    '«Непонятно», «Вердикт не окончателен» (dirty = 1: файл был занят чужой незакоммиченной правкой).',
    '',
    'На каждый план — ОДНА строка: путь, вердикт, коротко что осталось, ссылка на part-файл с подробностями.',
    'Подробности не дублируй — они в частях. Но перечислены должны быть ВСЕ планы до последнего:',
    'отчёт, где планов меньше, чем в списке ниже, — это молча выброшенная работа.',
    '',
    'Данные (по строке на план):',
    JSON.stringify(index),
  ].join('\n'),
  { label: 'сборка отчёта', phase: 'Сборка' },
)

phase('Приёмка')

const accept = await agent(
  [
    'Прими работу. Отчёт инвентаризации должен лежать в roo_code/plans/general/inventory-<дата>.md.',
    'Ты его не писал и словам предыдущих агентов не веришь. Ничего не исправляй — только вердикт.',
    '',
    'Проверь:',
    '1. plansOnDisk — посчитай САМ, независимо и с исключением файлов ЭТОГО прогона:',
    '   find roo_code/plans -name "*.md" -not -name "inventory-*.md" -not -path "*inventory-parts*" | wc -l',
    '   Без исключения ты посчитаешь свой же отчёт и десятки частей — число не сойдётся никогда.',
    '   Это главная проверка: если разведка потеряла часть планов, все прочие числа сойдутся между собой',
    '   и обманут. Сверять надо с диском, а не с тем, что тебе передали.',
    '2. Файл отчёта существует, верни его путь.',
    '3. pathsInReport — сколько РАЗНЫХ путей планов в нём перечислено, командой:',
    '   grep -o "roo_code/plans/[^ )`|]*\\.md" <файл> | grep -vE "inventory-parts|/inventory-[0-9]" | sort -u | wc -l',
    '   Исключение обязательно: сам отчёт ссылается на свои части и на себя, и без фильтра ты',
    '   посчитаешь их планами. Фильтруй по ПРЕФИКСУ пути, а не по подстроке «inventory»:',
    '   план warehouse-full-inventory.md содержит это слово в имени и планом быть не перестаёт.',
    '4. sectionsPresent — все четыре раздела на месте: Работа, Можно закрыть, Непонятно, Вердикт не окончателен.',
    '5. missingFromReport — какие из путей ниже в отчёте отсутствуют.',
    '6. Части и разделы прогона: проверь существование КАЖДОГО файла из списков ниже (ls или test -f).',
    '   partsFound — сколько нашлось, partsMissing — чего нет. Отсутствующая часть означает, что',
    '   агент вернул вердикты, но подробностей не записал: сводный отчёт выглядит полным, а доказательств нет.',
    '',
    `Ожидается ${rows.length} планов. Разведка насчитала ${disc.total}. Частей ожидается ${expectedParts.length}.`,
    'ok = true только если: файл есть, разделы на месте, pathsInReport совпадает с ожидаемым числом,',
    'missingFromReport пуст, partsMissing пуст И plansOnDisk совпадает с ожидаемым числом. Любое расхождение — ok = false,',
    'и напиши в problems, какое именно: расхождение с диском и неполный отчёт — разные болезни.',
    '',
    'Пути планов:',
    rows.map((r) => r.path).join('\n'),
    '',
    'Части:',
    expectedParts.map((f) => '  ' + f).join('\n'),
    '',
    'Разделы отчёта:',
    sectionFiles.map((f) => '  ' + f).join('\n'),
  ].join('\n'),
  { schema: ACCEPT, label: 'приёмка отчёта', phase: 'Приёмка' },
)

const accepted =
  Boolean(accept && accept.ok) &&
  !discoveryMismatch &&
  missing.length === 0 &&
  duplicated.length === 0 &&
  itemsIncomplete.length === 0 &&
  (accept && accept.partsMissing ? accept.partsMissing.length === 0 : true) &&
  (accept ? accept.plansOnDisk === rows.length + dropped : false)

if (!accepted) {
  log('ПРИЁМКА НЕ ПРОЙДЕНА — считать инвентаризацию законченной нельзя. Причины в полях ниже.')
}

return {
  вердикт: accepted ? 'приёмка пройдена' : 'ПРИЁМКА НЕ ПРОЙДЕНА',
  планов_по_разведке: disc.total,
  разобрано: rows.length,
  вердикты: counts,
  опроверг_скептик: refutedCount,
  разжаловано_за_доказательство: demoted,
  не_разобрано: missing,
  дубли: duplicated,
  пункты_потеряны: itemsIncomplete,
  пункты_разошлись: itemsDisagree,
  скептик_не_отработал: skepticMissing,
  скептик_молчал: skepticSilent,
  разделов_не_записано: sectionsFailed,
  части_ожидалось: expectedParts.length,
  часть_записана_не_туда: partMismatch,
  разведка_неполна: discoveryMismatch,
  добор: { повторено: retryList.length, не_добрано: retryDropped },
  отброшено_по_лимиту: dropped,
  приёмка: accept,
  отчёт: report,
  части: PART_DIR,
}
