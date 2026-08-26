export const meta = {
  name: 'implement-followups',
  description: 'Ночной прогон по открытым пунктам review-followups.md: реализация, независимая приёмка, коммит на пункт',
  whenToUse: 'Когда нужно закрыть список пунктов без человека — за ночь, с остановкой при двух подряд провалах',
  phases: [
    { title: 'Подготовка', detail: 'чистое дерево, зелёная приёмка, своя ветка' },
    { title: 'Работа', detail: 'пункт за пунктом: реализация → скептик → коммит' },
    { title: 'Финал', detail: 'полная приёмка и отчёт' },
  ],
}

// Политика прогона: roo_code/plans/general/autonomous-run-policy-plan.md
// Цикл проверок: roo_code/skills/verify.md
// Режим автономный: вопросов не задают, неясность = провал задачи с указанием, чего нет в плане.

const PLAN = 'roo_code/plans/general/review-followups.md'
const DEFAULT_ITEMS = ['1b', '2', '2b', '4b', '4c', '4d', '4e', '4f', '4g', '7', '8', '9', '10', '11', '12', '13']
const items = args && Array.isArray(args.items) && args.items.length > 0 ? args.items : DEFAULT_ITEMS

const PREP = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    treeClean: { type: 'boolean' },
    gateGreen: { type: 'boolean' },
    baseBranch: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['branch', 'treeClean', 'gateGreen', 'notes'],
  additionalProperties: false,
}

const WORK = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    status: { type: 'string', enum: ['сделано', 'устарело', 'провалено'] },
    commit: { type: 'string', description: 'SHA коммита или пусто' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    gate: { type: 'string', description: 'Команды приёмки и их итог' },
    lenses: { type: 'string', description: 'Какие линзы прогнаны и с каким результатом' },
    journal: { type: 'string', description: 'Путь журнала пункта' },
    notes: { type: 'string' },
  },
  required: ['item', 'status', 'notes'],
  additionalProperties: false,
}

const JUDGE = {
  type: 'object',
  properties: {
    item: { type: 'string' },
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
    checked: { type: 'string', description: 'Что именно проверял: команды и их вывод' },
  },
  required: ['item', 'refuted', 'reason', 'checked'],
  additionalProperties: false,
}

phase('Подготовка')

const prep = await agent(
  [
    'Автономный ночной прогон. Подготовь дерево — код пока не меняй.',
    '',
    '1. git status --short — дерево ОБЯЗАНО быть пустым. Не пусто → treeClean = false и остановись:',
    '   в занятом дереве коммит на задачу заберёт чужую работу, а stash спрячет её.',
    '2. Машинная приёмка ДО работы (raздел «Машинная приёмка» в roo_code/skills/verify.md):',
    '     cd frontend_vue && npm run typecheck',
    '     cd frontend_vue && npm run lint',
    '     cd frontend_vue && npx prettier --check src/',
    '     cd frontend_vue && npm run test:unit',
    '   Красная приёмка до правок → gateGreen = false и остановись: ветка нездорова.',
    '3. Запомни текущую ветку в baseBranch, узнай дату (date +%F) и создай ветку',
    '   auto/followups-<дата> от текущей. Не пушь.',
    '',
    'Верни branch, treeClean, gateGreen, baseBranch и notes с фактическим выводом команд.',
  ].join('\n'),
  { schema: PREP, label: 'подготовка', phase: 'Подготовка' },
)

if (!prep || !prep.treeClean || !prep.gateGreen) {
  return {
    вердикт: 'ПРОГОН НЕ НАЧАТ',
    причина: !prep ? 'агент подготовки не вернул результат' : prep.treeClean ? 'машинная приёмка красная до работы' : 'дерево занято чужими правками',
    подготовка: prep,
  }
}

log(`Ветка ${prep.branch} от ${prep.baseBranch || 'текущей'}. Пунктов в очереди: ${items.length}`)

function workPrompt(item, fixReason) {
  return [
    'АВТОНОМНЫЙ РЕЖИМ. Вопросов задавать некому: неясность в пункте — это провал задачи',
    'с указанием, чего именно не хватает, а не догадка. Догадку никто не увидит.',
    '',
    'Прочитай ДО кода:',
    '  roo_code/skills/vue-rules.md — целиком, все питфоллы',
    '  roo_code/skills/verify.md — цикл проверок, линзы Л1–Л10 и Б1–Б5',
    '  roo_code/skills/fix-bugs.md — порядок: прочитать → воспроизвести → план → правка → проверка',
    '',
    `Задача: пункт ${item} в ${PLAN}. Найди его раздел (заголовок вида "## ${item}.") и прочитай целиком.`,
    fixReason
      ? `\nЭто ВТОРАЯ попытка. Скептик отклонил первую: ${fixReason}\nПочини именно это, не переделывая остальное.\n`
      : '',
    'Порядок:',
    '1. **Воспроизведи.** Докажи грепом или чтением, что описанное в пункте всё ещё в коде.',
    '   Не воспроизводится → status = "устарело", ничего не меняй, в notes команда и её вывод.',
    '2. Реализуй. Минимальные изменения по существу пункта, без «раз уж открыли файл».',
    '3. Приёмка: typecheck, lint, prettier --check, test:unit — все четыре.',
    '   Плюс линзы из verify.md по области правки (какие именно — назови в lenses).',
    '   Тронул тесты → инверсия по Л9 обязательна: сломай поведение, убедись, что тест краснеет.',
    '4. Журнал: roo_code/roo-context/verify-runs/followups-' + item + '.md — что сделано, чем проверено,',
    '   команды с выводом. Только этот файл, чужие журналы не трогай.',
    '5. Приёмка зелёная → закоммить (git add только свои файлы, заголовок с номером пункта,',
    '   без пуша) и верни SHA. Красная и не починил → status = "провалено", несохранённое в',
    '   git stash push -u -m "провал пункта ' + item + '", коммита нет.',
    '',
    'Запрещено: git push, git restore, git checkout -- <файл>, git reset --hard, правка чужих журналов,',
    'отметки ✅ в плане (их ставит не автор правки), переключение ветки.',
  ].join('\n')
}

function judgePrompt(item, w) {
  return [
    `Ты принимаешь работу по пункту ${item}. Ты её не делал и автору не веришь.`,
    'Твоя задача — ОПРОВЕРГНУТЬ, а не подтвердить. Ничего не исправляй сам.',
    '',
    `Заявлено: ${w.status}. Коммит: ${w.commit || '(нет)'}`,
    `Автор пишет: ${w.notes}`,
    `Приёмка по его словам: ${w.gate || '(не указана)'}`,
    `Линзы по его словам: ${w.lenses || '(не указаны)'}`,
    '',
    'Проверь сам:',
    `1. Прочитай пункт ${item} в ${PLAN} — что там требовалось на самом деле.`,
    '2. Прочитай диff коммита: git show --stat <SHA> и git show <SHA>.',
    '3. Перезапусти приёмку сам: typecheck, lint, prettier --check, test:unit. Чужому слову «зелено» не верь.',
    '4. Найди в пункте хотя бы одно требование, которого в правке нет. Нашёл — refuted = true.',
    '5. Если пункт касался тестов — проверь инверсию: сломай поведение, убедись, что тест краснеет.',
    '   Тест, не покрасневший на сломанном коде, не тест, и правка не принята.',
    '6. Заявлено "устарело"? Проверь это сам: если проблема в коде есть — refuted = true.',
    '',
    'refuted = true, если сделано не то, ИЛИ сделано не полностью, ИЛИ приёмка у тебя не зелёная,',
    'ИЛИ ты не смог убедиться. Сомневаешься — отклоняй: пункт вернётся в работу, это дешёвая ошибка.',
    'В checked обязательно перечисли команды и их вывод — без них твой вердикт не считается.',
  ].join('\n')
}

phase('Работа')

const results = []
let failStreak = 0
let stopped = null

for (const item of items) {
  let w = await agent(workPrompt(item, null), { schema: WORK, label: `пункт ${item}`, phase: 'Работа' })

  if (!w) {
    // Упавший агент — это провал пункта, а не «сделано». Молчание не подтверждение.
    results.push({ item, status: 'провалено', notes: 'агент реализации не вернул результат (падение или таймаут)' })
    failStreak++
    if (failStreak >= 2) {
      stopped = `два пункта подряд провалены (последний ${item})`
      break
    }
    continue
  }

  let judge = await agent(judgePrompt(item, w), { schema: JUDGE, label: `приёмка ${item}`, phase: 'Работа' })

  // Вторая попытка — ровно одна, и только если скептик сказал, что именно не так.
  if (judge && judge.refuted) {
    const w2 = await agent(workPrompt(item, judge.reason), { schema: WORK, label: `пункт ${item} — вторая попытка`, phase: 'Работа' })
    if (w2) {
      w = w2
      judge = await agent(judgePrompt(item, w2), { schema: JUDGE, label: `приёмка ${item} — повтор`, phase: 'Работа' })
    }
  }

  const judgeMissing = !judge
  const refuted = judgeMissing || judge.refuted
  const status = refuted ? 'провалено' : w.status

  if (refuted && w.commit) {
    // Отклонённая правка не остаётся в истории как принятая: откатываем её коммитом,
    // а не стиранием — работа остаётся достаётся, и наутро видно, что пробовали.
    await agent(
      [
        `Пункт ${item} отклонён приёмкой. Откати его коммит и ничего больше не меняй.`,
        `Причина отклонения: ${judgeMissing ? 'приёмщик не вернул вердикт' : judge.reason}`,
        '',
        `1. git revert --no-edit ${w.commit}`,
        '2. Конфликт при откате → git revert --abort, и напиши это в ответе.',
        '3. git status --short обязан стать пустым: следующий пункт стартует с чистого дерева.',
        `4. Допиши причину отклонения в roo_code/roo-context/verify-runs/followups-${item}.md`,
        '',
        'Не пушь. Ветку не переключай.',
      ].join('\n'),
      { label: `откат ${item}`, phase: 'Работа' },
    )
  }

  results.push({
    item,
    status,
    commit: refuted ? '' : w.commit || '',
    gate: w.gate || '',
    lenses: w.lenses || '',
    journal: w.journal || '',
    notes: refuted ? `[отклонено приёмкой] ${judgeMissing ? 'приёмщик не вернул вердикт' : judge.reason}` : w.notes,
    checked: judgeMissing ? '' : judge.checked,
  })

  if (status === 'провалено') {
    failStreak++
    log(`Пункт ${item}: провален (${failStreak} подряд)`)
    if (failStreak >= 2) {
      stopped = `два пункта подряд провалены (последний ${item})`
      break
    }
  } else {
    failStreak = 0
    log(`Пункт ${item}: ${status}${w.commit ? ` — ${w.commit.slice(0, 7)}` : ''}`)
  }
}

if (stopped) log(`ПРОГОН ОСТАНОВЛЕН: ${stopped}. Остальные пункты не тронуты.`)

phase('Финал')

const done = results.filter((r) => r.status === 'сделано')
const stale = results.filter((r) => r.status === 'устарело')
const failed = results.filter((r) => r.status === 'провалено')
const untouched = items.filter((i) => !results.some((r) => r.item === i))

const final = await agent(
  [
    'Финальная приёмка ночного прогона. Код не меняй, только проверяй и пиши отчёт.',
    '',
    '1. Полная машинная приёмка на кончике ветки:',
    '     cd frontend_vue && npm run typecheck && npm run lint && npx prettier --check src/ && npm run test:unit',
    '2. Полный e2e: cd frontend_vue && npm run test:e2e',
    '   Вердикт по КОДУ ВОЗВРАТА, не по последней строке вывода. Не пиши через tail.',
    '   Упало — разбери до причины и назови её; перезапускать «на удачу» нельзя.',
    '3. git log --oneline — перечисли коммиты прогона.',
    '4. Отчёт: roo_code/roo-context/verify-runs/followups-run-<дата>.md (дату возьми date +%F):',
    '   по каждому пункту — статус, коммит, чем проверено, причина провала если провален;',
    '   в конце — итог полной приёмки и e2e.',
    '',
    'Отметки ✅ в review-followups.md ставь ТОЛЬКО тем пунктам, что приняты приёмщиком',
    'и подтверждены зелёным e2e. Провалённым и остановленным — не ставь.',
    '',
    'Ветку НЕ мержь и не пушь: мерж решает человек утром.',
    '',
    'Итоги прогона:',
    JSON.stringify({ сделано: done.map((r) => r.item), устарело: stale.map((r) => r.item), провалено: failed.map((r) => ({ item: r.item, notes: r.notes })), не_тронуто: untouched, остановлен: stopped }),
  ].join('\n'),
  { label: 'финальная приёмка', phase: 'Финал' },
)

return {
  вердикт: stopped ? 'ОСТАНОВЛЕН' : failed.length === 0 ? 'прогон закончен' : 'закончен с провалами',
  ветка: prep.branch,
  сделано: done.map((r) => r.item),
  устарело: stale.map((r) => r.item),
  провалено: failed.map((r) => ({ пункт: r.item, причина: r.notes })),
  не_тронуто: untouched,
  остановлен: stopped,
  финал: final,
  подробно: results,
}
