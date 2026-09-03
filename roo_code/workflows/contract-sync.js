export const meta = {
  name: 'contract-sync',
  description: 'Ночной прогон сверки API-контракта: аудит доменов по коду, общие соглашения, написание контракта, коммит на домен. Три попытки на домен, провал останавливает только свой домен',
  whenToUse: 'Когда нужно свести контракт с кодом по всем доменам без человека — за ночь, до конца очереди',
  phases: [
    { title: 'Подготовка', detail: 'чистое дерево, зелёная приёмка, своя ветка, скелеты аудита' },
    { title: 'Аудит', detail: 'домен за доменом: что в коде на самом деле, с файл:строка' },
    { title: 'Соглашения', detail: '00-conventions.md из повторяющихся правил аудитов' },
    { title: 'Написание', detail: 'контракт домена, скептик, откат отклонённого, до трёх попыток' },
    { title: 'Финал', detail: 'индекс находок, карта, ссылки, полный гейт, отчёт' },
  ],
}

// Скил задачи: roo_code/skills/api-contract.md — читать целиком, он задаёт формат и линзы К1–К7.
// План и порядок фаз: roo_code/plans/api/contract-sync-plan.md
// Политика прогона: roo_code/plans/general/autonomous-run-policy-plan.md
// Режим автономный: вопросов не задают. Неясность — не догадка, а строка в
// plans/api/audit/00-решения-владельца.md; решения «как должно быть» принимает владелец утром.
//
// Прогон СЕРИЙНЫЙ, хотя файлы доменов не пересекаются и параллельность была бы безопасна.
// Две причины, обе про исход, а не про скорость: правило остановки «две задачи подряд не сошлись»
// требует последовательности — у параллельных задач нет «подряд»; и откат отклонённого коммита
// (git revert) в общей ветке конфликтует с чужими коммитами, ложащимися в тот же момент.

const SKILL = 'roo_code/skills/api-contract.md'
const PLAN = 'roo_code/plans/api/contract-sync-plan.md'
const DECISIONS = 'roo_code/plans/api/audit/00-решения-владельца.md'

// Порядок — по убыванию гнили: сперва домены, которых в контракте нет вовсе или почти нет.
const DEFAULT_DOMAINS = [
  'warehouse', 'orders', 'settings', 'config', 'clients', 'suppliers', 'products', 'bcc',
  'categories', 'finance', 'services', 'notifications', 'audit-feed', 'analytics', 'sales-crm',
  'uploads', 'auth',
]
const domains = args && Array.isArray(args.domains) && args.domains.length ? args.domains : DEFAULT_DOMAINS
// auth написан до этого прогона: у него аудит постфактум и сверка с соглашениями, а не написание
// с нуля. Список — данные, а не исключение в коде фазы.
const WRITTEN_ALREADY = ['auth']
// **Провал домена останавливает только этот домен.** Ноль по умолчанию: ночь, отданная списку,
// не должна пропадать из-за двух трудных доменов подряд — остальные пятнадцать к ним отношения
// не имеют. Провал остаётся провалом и попадает в отчёт, но очередь идёт до конца.
const MAX_FAIL_STREAK = args && args.stopAfterFailures !== undefined ? args.stopAfterFailures : 0
// Сколько раз домен пробуют, прежде чем признать провал. Каждая следующая попытка получает
// разбор предыдущей — иначе она повторит ту же ошибку и сожжёт вдвое больше без толку.
const MAX_ATTEMPTS = args && args.attemptsPerDomain !== undefined ? args.attemptsPerDomain : 3
// Молчание агента (обрыв связи, 529) — не провал и НЕ попытка: домен уходит в конец очереди.
const MAX_SILENT = args && args.maxSilentRetries !== undefined ? args.maxSilentRetries : 2
// Столько молчаний подряд — это недоступность API, а не свойство доменов. 0 = не обрывать.
const API_OUTAGE_STOP = args && args.apiOutageStop !== undefined ? args.apiOutageStop : 6
// Единственная защита от сломанной среды: если провалились первые N доменов фазы — дело не в
// доменах. Дальше в этой фазе идти незачем: то же самое повторится семнадцать раз.
const START_GUARD = args && args.startGuard !== undefined ? args.startGuard : 3
// Соглашения — одна серийная задача, и без неё фаза C напишет общее правило семнадцать раз
// по-своему. Поэтому у неё свои попытки, а не общий счётчик.
const CONVENTIONS_ATTEMPTS = args && args.conventionsAttempts !== undefined ? args.conventionsAttempts : 3
// Фаза C может не запускаться вовсе: тогда за ночь делается только аудит, а контракт пишет человек.
const AUDIT_ONLY = Boolean(args && args.auditOnly)

const PREP = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    treeClean: { type: 'boolean' },
    gateGreen: { type: 'boolean' },
    skeletons: { type: 'number', description: 'Сколько файлов audit/<домен>.md создано' },
    inventory: { type: 'number', description: 'Эндпоинтов в инвентаре по scanCode()' },
    baseBranch: { type: 'string' },
    commit: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['branch', 'treeClean', 'gateGreen', 'notes'],
  additionalProperties: false,
}

const AUDIT = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    status: { type: 'string', enum: ['сделано', 'провалено'] },
    endpoints: { type: 'number', description: 'Разделов заполнено' },
    emptyFields: { type: 'number', description: 'Пустых граф осталось — обязан быть 0' },
    backendBacked: { type: 'number', description: 'Эндпоинтов, у которых источник истины — бэкенд' },
    ownerDecisions: { type: 'number', description: 'Строк, вынесенных в 00-решения-владельца.md' },
    codeFindings: { type: 'number', description: 'Находок в contract-sync-<домен>-bugs.md' },
    commit: { type: 'string' },
    notes: { type: 'string' },
  },
  // emptyFields обязателен: необязательное поле агент опустит, и «ноль пустых граф» станет
  // утверждением, которое устраивает молчание (питфолл #68).
  required: ['domain', 'status', 'endpoints', 'emptyFields', 'notes'],
  additionalProperties: false,
}

const WRITE = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    status: { type: 'string', enum: ['сделано', 'провалено'] },
    documented: { type: 'number', description: 'Разделов ### в файле домена' },
    planned: { type: 'number', description: 'Разделов со Статус: спроектировано' },
    gaps: { type: 'number', description: 'Пробелов аудита, помеченных «осталось»' },
    gate: { type: 'string', description: 'Команды приёмки и их итог' },
    lenses: { type: 'string', description: 'Какие линзы К прогнаны и с каким результатом' },
    journal: { type: 'string' },
    commit: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['domain', 'status', 'documented', 'notes'],
  additionalProperties: false,
}

// Отдельная схема: у соглашений и финала нет домена, а обязательное поле пришлось бы выдумывать.
const STEP = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['сделано', 'провалено'] },
    commit: { type: 'string' },
    gate: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['status', 'notes'],
  additionalProperties: false,
}

const JUDGE = {
  type: 'object',
  properties: {
    domain: { type: 'string' },
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    checked: { type: 'string', description: 'Что именно проверял: команды и их вывод' },
  },
  required: ['domain', 'refuted', 'reason', 'checked'],
  additionalProperties: false,
}

// Агент, который ничего не меняет, от молчания лечится повтором.
async function tryAgent(prompt, opts, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    const r = await agent(prompt, opts)
    if (r) return r
    if (i + 1 < attempts) log(`${opts.label}: пустой ответ, повтор ${i + 2}/${attempts}`)
  }
  return null
}

phase('Подготовка')

const prep = await agent(
  [
    'Автономный ночной прогон сверки API-контракта. Код приложения не меняй ни на этом шаге, ни дальше.',
    '',
    `Прочитай целиком: ${SKILL} и ${PLAN}.`,
    '',
    '1. git status --short — дерево ОБЯЗАНО быть пустым. Не пусто → treeClean = false, остановись:',
    '   в занятом дереве коммит на домен заберёт чужую работу, а stash спрячет её.',
    '2. Машинная приёмка ДО работы: cd frontend_vue && npm run verify.',
    '   Красная → gateGreen = false, остановись: ветка нездорова, гнать по ней нечего.',
    '3. Запомни ветку в baseBranch, узнай дату (date +%F), создай auto/contract-<дата>. Не пушь.',
    '4. Задача 1 плана: напиши frontend_vue/src/services/contractAudit.spec.ts — генератор скелетов',
    '   roo_code/plans/api/audit/<домен>.md из scanCode() (см. contractInventory.ts).',
    '   Файлы пишет только при CONTRACT_AUDIT_WRITE=1; без переменной — ПРОВЕРЯЕТ, что скелеты не',
    '   разошлись с инвентарём, и это его роль в гейте.',
    '   Формат скелета — раздел «Задача 1» плана: на каждый эндпоинт домена графы (вызывающий и',
    '   наличие роута бэкенда заполняет генератор), плюс девять граф «Обязанности сервера».',
    `5. Создай ${DECISIONS} с шапкой: сюда фазы сносят строки, которые прогон не решает.`,
    '6. Прогони генератор с CONTRACT_AUDIT_WRITE=1, затем npm run verify целиком.',
    '   Инверсия обязательна: удали один раздел из любого скелета и убедись, что спека генератора',
    '   краснеет. Не покраснела — спека не проверяет ничего, починить до коммита.',
    '7. Зелёный гейт → закоммить (без пуша) и верни SHA.',
    '',
    'Верни branch, treeClean, gateGreen, skeletons, inventory, baseBranch, commit и notes с',
    'фактическим выводом команд.',
  ].join('\n'),
  { schema: PREP, label: 'подготовка', phase: 'Подготовка' },
)

if (!prep || !prep.treeClean || !prep.gateGreen) {
  return {
    вердикт: 'ПРОГОН НЕ НАЧАТ',
    причина: !prep
      ? 'агент подготовки не вернул результат'
      : !prep.treeClean
        ? 'дерево занято чужими правками'
        : 'машинная приёмка красная до работы',
    подготовка: prep,
  }
}

log(`Ветка ${prep.branch}. Доменов: ${domains.length}. Инвентарь: ${prep.inventory || '?'} эндпоинтов`)

function auditPrompt(domain, afterCrash, attempt, lastReason) {
  return [
    'АВТОНОМНЫЙ РЕЖИМ. Спрашивать некого. Неясность — НЕ догадка: строка уходит в',
    `${DECISIONS} с указанием домена и того, чего именно не хватает.`,
    '',
    `Прочитай целиком ДО работы: ${SKILL}. Он задаёт порядок чтения кода, формат и линзы К1–К7.`,
    '',
    `Задача: аудит домена ${domain}. Заполни roo_code/plans/api/audit/${domain}.md — скелет создан,`,
    'перечень эндпоинтов в нём готов, составлять его руками не надо и нельзя.',
    afterCrash
      ? '\nПРЕДЫДУЩАЯ ПОПЫТКА ОБОРВАЛАСЬ НА ПОЛУСЛОВЕ — это была потеря связи, а не отказ.\nНачни с git status --short и git log --oneline -3: могли остаться незакоммиченные следы.\nПриведи дерево в порядок и продолжи с того, что уже заполнено.\n'
      : '',
    attempt > 1
      ? `\nПОПЫТКА ${attempt} из ${MAX_ATTEMPTS}. Прошлая закончилась так: ${lastReason || '(причина не записана)'}\nЭто не чистый лист: часть файла уже заполнена тобой же. Не переписывай заполненное —\nдоделай названное. И не считай уже заполненное «чужим» или «устаревшим».\n`
      : '',
    'Порядок — шаг 2 скила, и первым делом ПОИСК файлов, а не подстановка имён: шаблон',
    '<домен>Service.ts неверен для трёх доменов, mocks/<домен>.ts — для четырёх, types/<домен>.ts',
    'совпадает лишь у восьми из семнадцати. В скиле есть замеренная таблица раскладки — сверь с ней,',
    'но авторитет у команды поиска, а не у таблицы.',
    '',
    'Правила, нарушение которых делает аудит бесполезным:',
    '1. Каждое утверждение имеет файл:строка. Утверждение без ссылки не записывается.',
    '2. Если у домена ЕСТЬ модуль бэкенда — источник истины он, а не мок и не типы фронта.',
    '   Формы снимаются со схем бэкенда, расхождение фронта с ними — находка про фронт.',
    '3. Старый раздел roo_code/roo-context/03-api-contract.md — ГИПОТЕЗА. Не переносить.',
    '   Каждое его утверждение либо подтверждается кодом, либо идёт в графу «Пробел контракта».',
    '4. Девять граф «Обязанности сервера» заполняются как НАБЛЮДЕНИЕ: что знает мок, что знает',
    '   бэкенд, где во фронте стоит константа на месте серверного значения. Ответ «нигде» —',
    `   строкой в ${DECISIONS}, а не решением от себя.`,
    '5. Код при чтении выглядит неверным → находка в',
    `   roo_code/plans/bugs/contract-sync-${domain}-bugs.md по формату roo_code/skills/add-bug.md.`,
    '   КОД НЕ ПРАВИТЬ ни в каком случае — ни строки в frontend_vue/src, ни в backend/.',
    '6. Пустых граф остаться не должно. emptyFields в ответе — их фактическое число, посчитанное',
    '   грепом по файлу, а не на глаз.',
    '7. МАШИННАЯ ПРИЁМКА АУДИТА, обязательна перед коммитом:',
    '     cd frontend_vue && npx vitest run src/services/contractAudit.spec.ts',
    '   Эта спека сверяет скелет с инвентарём: раздел, который ты случайно удалил или переименовал,',
    '   краснеет здесь. Своему счёту разделов не верь — верь ей. Красная → починить до коммита.',
    '',
    `Файлы, которые тебе разрешено менять: audit/${domain}.md, contract-sync-${domain}-bugs.md,`,
    `и добавление строк в КОНЕЦ ${DECISIONS}. Ничего больше.`,
    '',
    'Закончил — закоммить эти файлы (заголовок с именем домена, без пуша) и верни SHA.',
    'Запрещено: git push, git restore, git checkout -- <файл>, git reset --hard, смена ветки.',
  ].join('\n')
}

function writePrompt(domain, audit, fixReason, afterCrash, attempt) {
  const already = WRITTEN_ALREADY.includes(domain)
  return [
    'АВТОНОМНЫЙ РЕЖИМ. Решения «как должно быть» не принимаются: расхождение решается по',
    'старшинству источников (бэкенд → мок+клиент → замысел), спорное остаётся пробелом.',
    '',
    `Прочитай целиком ДО работы: ${SKILL}, затем roo_code/roo-context/api/00-conventions.md,`,
    `затем свой аудит roo_code/plans/api/audit/${domain}.md.`,
    '',
    already
      ? `Домен ${domain} написан ранее. Задача — привести roo-context/api/${domain}.md в соответствие\nс 00-conventions.md и со своим аудитом: общие правила заменить ссылкой на соглашения,\nрасхождения устранить. Переписывать заново не надо.`
      : `Задача: написать roo_code/roo-context/api/${domain}.md по аудиту. Код заново не перечитывай —\nаудит уже проверен; перечитывай только то, где аудит оставил вопрос.`,
    afterCrash
      ? '\nПРЕДЫДУЩАЯ ПОПЫТКА ПО ЭТОМУ ДОМЕНУ ОБОРВАЛАСЬ НА ПОЛУСЛОВЕ — это была потеря связи,\nа не отказ. Начни с git status --short и git log --oneline -3: могли остаться незакоммиченные\nследы или коммит без приёмки. Приведи дерево в порядок и продолжи, а уже написанное собой\nне считай чужим.\n'
      : '',
    fixReason
      ? `\nРАБОТА НАД ОШИБКАМИ — попытка ${attempt} из ${MAX_ATTEMPTS}, а не чистый лист. Предыдущая\nверсия отклонена приёмкой и ОТКАЧЕНА коммитом: файла на ветке снова нет. Разбор приёмщика\nпроверен, ему верить больше, чем своему первому впечатлению:\n\n${fixReason}\n\nЧини именно названное, остального не изобретай: подтверждённое приёмщиком воспроизведи как\nбыло — переписывание принятого само по себе основание для отказа.\n`
      : '',
    'Требования:',
    '1. По разделу на каждый эндпоинт инвентаря, формат жёсткий (шаг 3 скила): заголовок ровно',
    '   `### <МЕТОД> <путь>`, строка `Реализация:` с файлом и символом.',
    '2. Есть модуль бэкенда → у каждого раздела ещё строка `Бэкенд:` — файл со строкой или слово',
    '   «не реализован». Метка «Статус: спроектировано» тут НЕ подходит: она про отсутствие кода',
    '   вообще, а не про отсутствие серверной части у эндпоинта, который клиент уже зовёт.',
    '3. Динамический сегмент — один раздел, значения списком внутри. НЕ разворачивать в заголовки.',
    '4. Общие правила — ссылкой на 00-conventions.md, не копией (второй экземпляр правила).',
    '5. Раздел, написанный вперёд (кода нет нигде), помечается `**Статус:** спроектировано`.',
    '6. Удаляемое из старого контракта оставляет строку в разделе «Чего в домене нет»: что было',
    '   описано и чем доказано отсутствие.',
    '7. Раздел «Обязанности сервера» — из граф аудита, со ссылками на код. Непустой.',
    '8. Каждый пробел аудита либо закрыт в тексте, либо помечен строкой «осталось».',
    '',
    `Аудит сообщил: эндпоинтов ${audit.endpoints}, источник истины бэкенд у ${audit.backendBacked || 0},`,
    `решений владельцу ${audit.ownerDecisions || 0}, находок про код ${audit.codeFindings || 0}.`,
    '',
    'Приёмка: cd frontend_vue && npm run verify. Спека contract-conformance включит домен',
    'автоматически, как только файл появится, и покажет пропущенные эндпоинты. Плюс свип линз',
    'К1–К7 из скила — в lenses назови по каждой, чем проверял и что вернулось. «К3 — чисто» не',
    'считается ответом.',
    `Журнал: roo_code/roo-context/verify-runs/contract-${domain}.md — только свой файл.`,
    '',
    `Разрешено менять: roo-context/api/${domain}.md, свой журнал, свой bugs-файл.`,
    'Приёмка зелёная → коммит (без пуша), верни SHA. Красная и не починил → status = провалено,',
    'несохранённое в git stash push -u, коммита нет.',
    'Запрещено: git push, git restore, git checkout -- <файл>, правка чужих файлов, смена ветки,',
    'любая правка frontend_vue/src кроме спек контракта.',
  ].join('\n')
}

function judgePrompt(domain, w) {
  return [
    `Ты принимаешь контракт домена ${domain}. Ты его не писал и автору не веришь.`,
    'Твоя задача — ОПРОВЕРГНУТЬ, а не подтвердить. Сам ничего не исправляй.',
    '',
    `Автор заявил: ${w.status}, разделов ${w.documented}, спроектировано ${w.planned || 0},`,
    `пробелов «осталось» ${w.gaps || 0}. Коммит: ${w.commit || '(нет)'}`,
    `Линзы по его словам: ${w.lenses || '(не указаны)'}`,
    '',
    'Проверь сам:',
    '1. git show <SHA> — что реально написано.',
    '2. Перезапусти приёмку: cd frontend_vue && npm run verify. Чужому «зелено» не верь.',
    `3. Возьми 5 случайных разделов api/${domain}.md и сверь КАЖДЫЙ с кодом: форма запроса и`,
    '   ответа против types/*.ts (а если у домена есть модуль бэкенда — против его schemas.py),',
    '   коды ошибок против throw в моке домена, строка «Реализация:» — файл существует и символ',
    '   находится грепом. Хоть одно расхождение — refuted = true.',
    `4. Возьми 2 утверждения из audit/${domain}.md и проверь их по коду сам. Аудит — вход всего`,
    '   остального: если он врёт, контракт врёт вслед за ним, и приёмка контракта этого не увидит.',
    '5. Раздел «Обязанности сервера» есть и непуст? Каждая графа — наблюдение с файл:строка, а не',
    '   пересказ? Графа, заполненная общими словами без ссылки, — refuted = true.',
    `6. Сверь с аудитом: каждый пробел закрыт в тексте или помечен «осталось». Пробел, молча`,
    '   исчезнувший, — refuted = true.',
    '7. Метка «Статус: спроектировано» стоит только там, где кода нет? Проверь грепом по коду.',
    '   Стоит на эндпоинте, который зовёт клиент, — refuted = true.',
    '8. Удалённое из старого контракта оставило след в «Чего в домене нет»? Молча вычеркнутое —',
    '   refuted = true: так теряются решения.',
    '',
    'refuted = true, если написано не то, ИЛИ не полностью, ИЛИ приёмка у тебя не зелёная,',
    'ИЛИ ты не смог убедиться. Сомневаешься — отклоняй: домен вернётся в работу, это дешёвая ошибка.',
    'В checked обязательно перечисли команды и их вывод — без них твой вердикт не считается.',
  ].join('\n')
}

phase('Аудит')

const audits = {}
const results = []
let stopped = null
const silentCount = {}
let silentInARow = 0
// Попытки и разбор прошлой — по домену. Молчание агента попытку НЕ расходует.
const attempts = {}
const lastReason = {}

const auditQueue = [...domains]
let resolvedInPhase = 0
let failedInPhase = 0
let failStreak = 0

while (auditQueue.length) {
  const domain = auditQueue.shift()
  const attempt = (attempts[domain] || 0) + 1

  const a = await agent(auditPrompt(domain, (silentCount[domain] || 0) > 0, attempt, lastReason[domain]), {
    schema: AUDIT,
    label: `аудит ${domain}${attempt > 1 ? ` (попытка ${attempt})` : ''}`,
    phase: 'Аудит',
  })

  if (!a) {
    silentCount[domain] = (silentCount[domain] || 0) + 1
    silentInARow += 1
    if (API_OUTAGE_STOP > 0 && silentInARow >= API_OUTAGE_STOP) {
      stopped = `${API_OUTAGE_STOP} агентов подряд не вернули результат — недоступность API, а не свойство доменов`
      auditQueue.unshift(domain)
      break
    }
    if (silentCount[domain] <= MAX_SILENT) {
      log(`аудит ${domain}: молчание (${silentCount[domain]}/${MAX_SILENT}) — в конец очереди, попытка не израсходована`)
      auditQueue.push(domain)
      continue
    }
    // Молчал столько раз, что это уже не связь. Считаем попыткой.
    attempts[domain] = attempt
    lastReason[domain] = `агент молчал ${silentCount[domain]} раза подряд`
    silentCount[domain] = 0
  } else {
    silentInARow = 0
    attempts[domain] = attempt
    if (a.status === 'сделано' && a.emptyFields === 0) {
      audits[domain] = a
      results.push({ фаза: 'аудит', домен: domain, статус: 'сделано', попыток: attempt, коммит: a.commit || '' })
      resolvedInPhase += 1
      failStreak = 0
      log(`аудит ${domain}: ${a.endpoints} эндпоинтов, решений владельцу ${a.ownerDecisions || 0}${attempt > 1 ? ` (с ${attempt}-й попытки)` : ''}`)
      continue
    }
    lastReason[domain] = a.emptyFields > 0 ? `осталось пустых граф: ${a.emptyFields}` : a.notes
  }

  // Сюда попадаем только при неудаче — своей или молчаливой.
  if (attempt < MAX_ATTEMPTS) {
    log(`аудит ${domain}: попытка ${attempt} не сошлась (${lastReason[domain]}) — вернул в очередь`)
    auditQueue.push(domain)
    continue
  }

  // Провал домена останавливает ТОЛЬКО этот домен: остальные к нему отношения не имеют.
  // Частично заполненный audit/<домен>.md не откатывается — это данные для человека,
  // а не непроверенный код на ветке.
  results.push({ фаза: 'аудит', домен: domain, статус: 'провалено', попыток: attempt, причина: lastReason[domain] })
  resolvedInPhase += 1
  failedInPhase += 1
  failStreak += 1
  log(`аудит ${domain}: ПРОВАЛЕН после ${attempt} попыток — ${lastReason[domain]}`)

  // Единственная защита от сломанной среды: первые N доменов фазы провалились все.
  // Дело не в доменах, и повторять это пятнадцать раз незачем.
  if (START_GUARD > 0 && resolvedInPhase === START_GUARD && failedInPhase === START_GUARD) {
    stopped = `первые ${START_GUARD} домена фазы аудита провалились все — дело не в доменах, а в среде`
    break
  }
  if (MAX_FAIL_STREAK > 0 && failStreak >= MAX_FAIL_STREAK) {
    stopped = `${MAX_FAIL_STREAK} домена подряд провалены на аудите (последний — ${domain})`
    break
  }
}

const audited = Object.keys(audits)
const notAudited = domains.filter((d) => !audits[d])

if (stopped || audited.length === 0) {
  return {
    вердикт: 'ПРОГОН ОСТАНОВЛЕН НА АУДИТЕ',
    причина: stopped || 'ни один домен не прошёл аудит',
    ветка: prep.branch,
    сделано: results,
    не_сведено: notAudited,
    дальше: 'фаза соглашений не запускалась: выводить их не из чего',
    утром_человеку: [DECISIONS, 'git log --oneline ' + (prep.baseBranch || 'main') + '..' + prep.branch],
  }
}

if (AUDIT_ONLY) {
  return {
    вердикт: 'АУДИТ ЗАКОНЧЕН, НАПИСАНИЕ НЕ ЗАПУСКАЛОСЬ (auditOnly)',
    ветка: prep.branch,
    аудитов: audited,
    не_сведено: notAudited,
    задачи: results,
    утром_человеку: [DECISIONS, 'roo_code/plans/api/audit/'],
  }
}

phase('Соглашения')

function conventionsPrompt(attempt, lastFail) {
  return [
    'АВТОНОМНЫЙ РЕЖИМ. Решений не принимать.',
    '',
    `Прочитай ${SKILL}, затем аудиты ТОЛЬКО закрытых доменов: ${audited.join(', ')}.`,
    notAudited.length
      ? `НЕ читай как источник аудиты ${notAudited.join(', ')} — они не закрыты, там пустые скелеты,\nи правило, выведенное из пустой графы, будет выдумкой.`
      : '',
    attempt > 1
      ? `\nПОПЫТКА ${attempt} из ${CONVENTIONS_ATTEMPTS}. Прошлая закончилась так: ${lastFail || '(причина не записана)'}\nФайл мог остаться недописанным — доделай, а не начинай с нуля.\n`
      : '',
    '',
    'Задача 19 плана: написать roo_code/roo-context/api/00-conventions.md. Соглашения ВЫВОДЯТСЯ из',
    'аудитов: правило, встретившееся в двух и более, переезжает сюда, и в доменных файлах остаётся',
    'ссылкой. Правило из одного домена остаётся в его файле.',
    '',
    'Проверить обязательно, потому что прежний текст здесь уже расходится с кодом:',
    '- envelope: services/api.ts:unwrap принимает И обёртку ApiResponse<T>, И голое тело,',
    '  И ошибку FastAPI detail. Прежний контракт описывал только первое;',
    '- PATCH против PUT: в коде PATCH в 27 местах, PUT в 6. Правило плюс ссылка на карту,',
    '  а не перечисление путей, которое устареет к следующей странице;',
    '- TranslatedString против types/i18n.ts; аудит по id против девяти сущностей инвентаря;',
    '- Idempotency-Key против newIdempotencyKey(); Feature Flags против 52 флагов;',
    '- примеры в этом файле НЕ оформлять заголовком `### <МЕТОД> /api/...` — спека прочитает их',
    '  как описание не своего домена и покраснеет.',
    '',
    `Строки из ${DECISIONS} НЕ решать: они остаются владельцу. Перечисли их в notes.`,
    '',
    'Приёмка: cd frontend_vue && npm run verify. Зелёная → коммит, верни SHA.',
  ].join('\n')
}

let conventions = null
let convFail = null
for (let attempt = 1; attempt <= CONVENTIONS_ATTEMPTS; attempt += 1) {
  const c = await agent(conventionsPrompt(attempt, convFail), {
    schema: STEP,
    label: `соглашения${attempt > 1 ? ` (попытка ${attempt})` : ''}`,
    phase: 'Соглашения',
  })
  if (c && c.status === 'сделано') {
    conventions = c
    log(`соглашения: сделано${attempt > 1 ? ` (с ${attempt}-й попытки)` : ''}`)
    break
  }
  convFail = c ? c.notes : 'агент не вернул результат'
  log(`соглашения: попытка ${attempt} не сошлась — ${convFail}`)
}

if (!conventions) {
  // Здесь прогон действительно останавливается, и это не «провал одного домена»: без
  // соглашений семнадцать авторов сформулируют общее правило семнадцатью разными способами,
  // и разгребать это дороже, чем написать контракт заново. Аудиты при этом сделаны и
  // закоммичены — ночь не пропала.
  return {
    вердикт: 'ПРОГОН ОСТАНОВЛЕН НА СОГЛАШЕНИЯХ',
    причина: `${CONVENTIONS_ATTEMPTS} попытки не сошлись; последняя: ${convFail}`,
    ветка: prep.branch,
    аудитов: audited,
    не_сведено: notAudited,
    задачи: results,
    дальше: 'фаза написания не запускалась намеренно: без соглашений каждый домен переписал бы общие правила по-своему',
    утром_человеку: [DECISIONS, 'roo_code/plans/api/audit/'],
  }
}
results.push({ фаза: 'соглашения', статус: 'сделано', коммит: conventions.commit || '' })

phase('Написание')

const wAttempts = {}
const wReason = {}
const wSilent = {}
silentInARow = 0
resolvedInPhase = 0
failedInPhase = 0
failStreak = 0

const writeQueue = [...audited]
while (writeQueue.length) {
  const domain = writeQueue.shift()
  const attempt = (wAttempts[domain] || 0) + 1
  const commits = []

  let w = await agent(writePrompt(domain, audits[domain], wReason[domain] || null, (wSilent[domain] || 0) > 0, attempt), {
    schema: WRITE,
    label: `контракт ${domain}${attempt > 1 ? ` (попытка ${attempt})` : ''}`,
    phase: 'Написание',
  })

  // Молчание автора — не провал и не попытка: обрыв связи выглядит как «не справился».
  if (!w) {
    wSilent[domain] = (wSilent[domain] || 0) + 1
    silentInARow += 1
    if (API_OUTAGE_STOP > 0 && silentInARow >= API_OUTAGE_STOP) {
      stopped = `${API_OUTAGE_STOP} агентов подряд не вернули результат — недоступность API, а не свойство доменов`
      writeQueue.unshift(domain)
      break
    }
    if (wSilent[domain] <= MAX_SILENT) {
      log(`контракт ${domain}: молчание (${wSilent[domain]}/${MAX_SILENT}) — в конец очереди, попытка не израсходована`)
      writeQueue.push(domain)
      continue
    }
    wAttempts[domain] = attempt
    wReason[domain] = `агент молчал ${wSilent[domain]} раза подряд`
    wSilent[domain] = 0
  } else {
    silentInARow = 0
    wAttempts[domain] = attempt
    if (w.commit) commits.push(w.commit)
  }

  // Закрывает домен не тот, кто его писал (правило автономного режима из ROO.md).
  let judge = null
  if (w && w.status === 'сделано') {
    judge = await tryAgent(judgePrompt(domain, w), {
      schema: JUDGE,
      label: `приёмка ${domain}${attempt > 1 ? ` (попытка ${attempt})` : ''}`,
      phase: 'Написание',
    })
  }

  const judgeMissing = Boolean(w && w.status === 'сделано' && !judge)
  const refuted = !w || w.status !== 'сделано' || judgeMissing || judge.refuted

  if (!refuted) {
    results.push({
      фаза: 'написание',
      домен: domain,
      статус: 'сделано',
      попыток: attempt,
      коммит: w.commit || '',
      линзы: w.lenses || '',
      приёмка: judge.checked,
    })
    resolvedInPhase += 1
    failStreak = 0
    log(`контракт ${domain}: сделано${w.commit ? ` — ${w.commit.slice(0, 7)}` : ''}${attempt > 1 ? ` (с ${attempt}-й попытки)` : ''}`)
    continue
  }

  const reason = judgeMissing
    ? 'приёмщик не вернул вердикт'
    : judge
      ? judge.reason
      : w
        ? w.notes
        : wReason[domain]
  wReason[domain] = reason

  // Отклонённое не остаётся в истории как принятое — и следующая попытка стартует с чистого
  // дерева, иначе она будет править файл, которого приёмщик не видел.
  if (commits.length) {
    await agent(
      [
        `Контракт домена ${domain} отклонён приёмкой (попытка ${attempt}). Откати его коммиты и ничего больше не меняй.`,
        `Причина: ${reason}`,
        '',
        `1. Откати ВСЕ коммиты этой попытки, новейший первым: ${commits.slice().reverse().join(', ')}`,
        `   То есть: ${commits.slice().reverse().map((c) => `git revert --no-edit ${c}`).join(' && ')}`,
        '   Порядок важен: откат старого раньше нового даст конфликт на ровном месте.',
        '2. Конфликт → git revert --abort, и напиши в ответе, какие коммиты остались.',
        '3. git status --short обязан стать пустым: следующая попытка стартует с чистого дерева.',
        `4. Допиши причину отклонения в roo_code/roo-context/verify-runs/contract-${domain}.md`,
        '',
        'Не пушь. Ветку не переключай.',
      ].join('\n'),
      { label: `откат ${domain} (попытка ${attempt})`, phase: 'Написание', effort: 'low' },
    )
  }

  if (attempt < MAX_ATTEMPTS) {
    log(`контракт ${domain}: попытка ${attempt} отклонена (${reason}) — вернул в очередь`)
    writeQueue.push(domain)
    continue
  }

  results.push({
    фаза: 'написание',
    домен: domain,
    статус: 'провалено',
    попыток: attempt,
    причина: `[отклонено] ${reason}`,
    линзы: w ? w.lenses || '' : '',
    приёмка: judge ? judge.checked : '',
  })
  resolvedInPhase += 1
  failedInPhase += 1
  failStreak += 1
  log(`контракт ${domain}: ПРОВАЛЕН после ${attempt} попыток — ${reason}`)

  if (START_GUARD > 0 && resolvedInPhase === START_GUARD && failedInPhase === START_GUARD) {
    stopped = `первые ${START_GUARD} домена фазы написания провалились все — дело не в доменах, а в среде`
    break
  }
  if (MAX_FAIL_STREAK > 0 && failStreak >= MAX_FAIL_STREAK) {
    stopped = `${MAX_FAIL_STREAK} домена подряд провалены на написании (последний — ${domain})`
    break
  }
}

const written = results.filter((r) => r.фаза === 'написание' && r.статус === 'сделано').map((r) => r.домен)
const notWritten = domains.filter((d) => !written.includes(d))

phase('Финал')

const final = await tryAgent(
  [
    'Финал прогона сверки контракта. Ничего не переписывай — собери, замерь, отчитайся.',
    '',
    `Прочитай ${PLAN}, задача 38.`,
    '',
    '1. Сводный индекс: roo_code/plans/bugs/contract-sync-bugs.md — таблица из всех',
    '   contract-sync-<домен>-bugs.md, строка на находку, со ссылкой на файл домена.',
    '   Файл-индекс сам находок не содержит: они живут в доменных файлах.',
    '2. README.md в roo-context/api/ — индекс файлов плюс карта «метод путь → файл»,',
    '   СГЕНЕРИРОВАННАЯ contractInventory.ts. Рукописная карта разойдётся первой.',
    '   Заголовки `### <МЕТОД> /api/...` в README не ставить: спека прочитает их как чужой домен.',
    '3. Замерь: cd frontend_vue && npx vitest run src/services/contract-conformance.spec.ts',
    // Разрешение на три необратимых шага считает скрипт, а не агент: «описано всё» — это
    // сравнение чисел, и отдавать его на усмотрение агента значит однажды снести монолит
    // на половине работы.
    `   Прогон закрыл доменов: ${written.length} из ${domains.length}.` +
      (written.length === domains.length
        ? ' Все — три шага ниже РАЗРЕШЕНЫ, если спека подтвердит 175 из 175.'
        : ' НЕ все — три шага ниже ЗАПРЕЩЕНЫ, только назови в notes, что осталось.'),
    '   Описано ВСЁ (175 из 175, у всех 17 доменов есть файл) → и только тогда:',
    '     - переезд живых ссылок с 03-api-contract.md на api/<домен>.md (задача 37: ROO.md,',
    '       пять скилов, два живых плана; архив и verify-runs НЕ трогать — это журналы прошедших',
    '       прогонов, и запись в них была правдой на своей дате);',
    '     - EXPECT_ALL_DOMAINS = true в contract-conformance.spec.ts;',
    '     - git rm roo_code/roo-context/03-api-contract.md.',
    '   Описано не всё → эти три шага НЕ делать и назвать в notes, что осталось.',
    '4. Полная приёмка на кончике ветки: cd frontend_vue && npm run verify.',
    '   Плюс снять числа npm run audit и npm run deadcode — зелёными быть не обязаны, но идут в',
    '   отчёт: прогон, добавивший мёртвый файл, должен быть виден сразу, а не через месяц.',
    '5. Отчёт: roo_code/roo-context/verify-runs/contract-run-<дата>.md (дата = date +%F):',
    '   по каждому домену статус, коммит, чем проверено, причина провала; в конце — итог приёмки,',
    `   и отдельным списком всё содержимое ${DECISIONS}.`,
    '6. Коммит. Пуша нет ни при каком исходе. Ветку НЕ мержить — это решает человек утром.',
    '',
    'Итоги прогона:',
    JSON.stringify({ аудит: audited, написано: written, не_сведено: notWritten, остановлен: stopped }),
  ].join('\n'),
  { schema: STEP, label: 'финал', phase: 'Финал' },
)

return {
  вердикт: stopped ? 'ОСТАНОВЛЕН' : notWritten.length === 0 ? 'ПРОГОН ЗАКОНЧЕН' : 'закончен с провалами',
  причина_остановки: stopped || null,
  ветка: prep.branch,
  аудитов: audited,
  написано: written,
  не_сведено: notWritten,
  соглашения: conventions.commit || null,
  финал: final ? final.notes : 'агент финала молчит',
  задачи: results,
  утром_человеку: [
    DECISIONS + ' — строки, которые прогон не решал',
    'roo_code/plans/bugs/contract-sync-bugs.md — сводный индекс находок про код',
    'git log --oneline ' + (prep.baseBranch || 'main') + '..' + prep.branch,
  ],
}
