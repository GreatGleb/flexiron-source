import ts from 'typescript'

/**
 * Сторож правила §2 «отказ несёт код, а не текст»: машинный код нельзя доставать из
 * текста исключения.
 *
 * **История версий тут — не хроника, а объяснение устройства.** Пять предыдущих были
 * слепы, и каждый раз по одной и той же причине: закрывалась ЗАПИСЬ дефекта, а записей у
 * одной мысли бесконечно много.
 *
 * | версия | предмет | чем оказалась слепа |
 * |---|---|---|
 * | 1 | литерал по файлу, подчёркивание обязательно | `CONFLICT`; `api.ts` в изъятиях |
 * | 2 | тело `catch` | 7 форм обработчика из 8; `errorCode(` в теле давало иммунитет |
 * | 3 | операнд, регулярками | 6 форм операнда из 9 |
 * | 4 | операнд по дереву | 10 форм ЛИТЕРАЛА и ОПЕРАЦИИ из 10 |
 * | 5 | все три стороны сравнения по смыслу | поток ЧЕРЕЗ ХРАНИЛИЩЕ: поле объекта, `.value` рефа, параметр функции, чужой файл |
 *
 * Шестая версия существует потому, что пятая разбирала по смыслу выражение, но не
 * **место, где значение полежало**. Текст исключения, положенный в `error.value`, в поле
 * посредника или переданный параметром, для неё исчезал. Скептик показал это на пробах:
 * ловилось прямое сравнение, `String(e)` и `includes`, пропускалось всё четыре формы
 * хранения.
 *
 * Здесь имя, под которым значение лежит, — это **путь**: `c`, `error.value`, `box.text`.
 * Присваивание в путь связывает его с выражением, чтение пути идёт по той же связи.
 * Параметр связывается с аргументами всех вызовов этой функции в файле. Межфайловый
 * поток моделируется фактами о соседнем модуле — их подаёт вызывающий (см. `FactsLookup`),
 * потому что файловой системы сторож не знает и знать не должен.
 *
 * **Области видимости учитываются.** Версия 4 сливала одноимённые переменные и обвиняла
 * `services/api.ts`: параметр `code` разбора тела ответа считался тем же `code`, что
 * чей-то `const code = e.message`. Ложное обвинение на правильном коде — худший исход,
 * чем пропуск: оно заставляет следующего автора отключить сторож. Поэтому происхождения
 * трёх сортов хранятся раздельно: объявления (`vars`), аргументы вызовов (`args`) и
 * «объявлен, происхождение неизвестно» (`params`) — и первое побеждает второе.
 *
 * **Чего сторож не умеет** (названо, чтобы зелёное не читалось как доказательство
 * отсутствия — питфолл #66):
 * - **межфайловый поток без фактов**: если вызывающий не подал `FactsLookup`, чужой
 *   модуль для сторожа пуст. Факты снимаются на один шаг — помощник помощника не виден;
 * - значение, собранное во время работы (`new RegExp(переменная)`, склейка из кусков);
 * - блочная область видимости огрублена до функции: два `const` с одним именем в разных
 *   блоках одной функции сливаются;
 * - поток через элемент массива или `Map`: `box[i]`, `map.get(k)` не моделируются;
 * - анализ нечувствителен к порядку: функция, вызванная где угодно с текстом исключения,
 *   считается получающей его во всех своих сравнениях.
 */

/** Литерал кода отказа: `CONFLICT`, `ORDER_NOT_FOUND`. Подчёркивание не обязательно. */
const CODE_LITERAL = /^[A-Z][A-Z0-9_]{4,}$/

/** Методы, которыми код ищут в строке. */
const STRING_PROBES = new Set(['includes', 'startsWith', 'endsWith', 'match', 'search', 'indexOf'])

/** Методы, возвращающие ту же строку: текст исключения остаётся текстом исключения. */
const STRING_TRANSFORMS = new Set([
  'trim',
  'toLowerCase',
  'toUpperCase',
  'slice',
  'replace',
  'substring',
  'normalize',
])

/** Перебор массива с обратным вызовом: параметр связывается с элементами. */
const ARRAY_PROBES = new Set(['some', 'every', 'find', 'findIndex', 'filter', 'includes'])

/** Вызовы, дающие законный ответ на вопрос «какой это код». */
const SOURCES_OF_TRUTH = new Set(['errorCode', 'errorMessageKey'])

/** Обёртки Vue: `ref(x).value` — это `x`. */
const REF_FACTORIES = new Set(['ref', 'shallowRef', 'computed', 'toRef', 'customRef'])

export interface Offence {
  operand: string
  code: string
  line: number
}

/**
 * Что сосед делает с текстом исключения — ровно те два факта, которых не хватает, чтобы
 * увидеть поток через границу файла.
 */
export interface ModuleFacts {
  /** Экспорт возвращает текст исключения: `export const txt = (e) => e.message`. */
  returnsErrorText: Set<string>
  /** Экспорт сравнивает свой параметр с кодом отказа: `export const isGone = (m) => m === 'GONE_CODE'`. */
  comparesParamToCode: Map<string, Array<{ index: number; code: string }>>
}

/** Факты о модуле по строке импорта. Резолвит пути вызывающий — сторож файлов не читает. */
export type FactsLookup = (specifier: string) => ModuleFacts | undefined

const isScope = (node: ts.Node): boolean =>
  ts.isSourceFile(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node)

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

const isFunctionLike = (node: ts.Node): node is FunctionLike =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node)

interface Scope {
  /** Путь → выражения, из которых он получил значение объявлением или присваиванием. */
  vars: Map<string, ts.Node[]>
  /** Параметры: имя объявлено, но происхождение неизвестно. */
  params: Set<string>
  /** Параметры, связанные с аргументами вызовов этой функции. Слабее объявления. */
  args: Map<string, ts.Node[]>
}

interface Ctx {
  source: ts.SourceFile
  scopes: Map<ts.Node, Scope>
  /** Локальное имя → откуда импортировано и под каким именем экспортировано. */
  imports: Map<string, { specifier: string; exported: string }>
  facts?: FactsLookup
}

function unwrap(node: ts.Node): ts.Node {
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))
    return unwrap(node.expression)
  if (ts.isAsExpression(node)) return unwrap(node.expression)
  return node
}

/** Имя поля у доступа к свойству: `x.message` и `x['message']` дают `message`. */
function fieldName(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression))
    return node.argumentExpression.text
  return null
}

/**
 * Путь, под которым значение лежит: `c`, `error.value`, `state.last.text`. Именно путь, а
 * не имя, — единица хранения: версия 5 знала только имена и потому теряла всё, что
 * положили в поле.
 */
function pathOf(raw: ts.Node): string | null {
  const node = unwrap(raw)
  if (ts.isIdentifier(node)) return node.text
  if (node.kind === ts.SyntaxKind.ThisKeyword) return 'this'
  const field = fieldName(node)
  if (field && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
    const base = pathOf(node.expression)
    return base ? `${base}.${field}` : null
  }
  return null
}

const rootOf = (path: string): string => path.split('.')[0] ?? path

/** Таблицы путей по областям видимости. Функция — граница; блоки огрублены до функции. */
function buildScopes(source: ts.SourceFile): Map<ts.Node, Scope> {
  const scopes = new Map<ts.Node, Scope>()
  /** Имя → функции с этим именем в файле: нужны, чтобы связать параметр с аргументом. */
  const functions = new Map<string, FunctionLike[]>()

  const enclosing = (node: ts.Node): ts.Node => {
    let current: ts.Node = node.parent
    while (!isScope(current)) current = current.parent
    return current
  }
  const scopeAt = (owner: ts.Node): Scope => {
    let scope = scopes.get(owner)
    if (!scope) {
      scope = { vars: new Map(), params: new Set(), args: new Map() }
      scopes.set(owner, scope)
    }
    return scope
  }
  const scopeOf = (node: ts.Node): Scope => scopeAt(isScope(node) ? node : enclosing(node))
  const push = (into: Map<string, ts.Node[]>, key: string, origin: ts.Node) => {
    into.set(key, [...(into.get(key) ?? []), origin])
  }

  /** Область, объявившая корень пути: `error.value` принадлежит тому, кто объявил `error`. */
  const ownerOf = (path: string, from: ts.Node): ts.Node => {
    const root = rootOf(path)
    let current: ts.Node = from
    for (;;) {
      if (isScope(current)) {
        const scope = scopes.get(current)
        if (scope && (scope.vars.has(root) || scope.params.has(root))) return current
      }
      if (ts.isSourceFile(current)) return current
      current = current.parent
    }
  }

  // Проход 1: объявления и параметры. Они должны быть известны раньше, чем разбираются
  // присваивания, иначе `error.value = …` не найдёт, чей это `error`.
  const declare = (node: ts.Node): void => {
    if (isScope(node)) scopeOf(node)
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      scopeOf(node).params.add(node.name.text)
    }
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        const vars = scopeOf(node).vars
        // Имя регистрируется даже без начального значения: `let c` закрывает одноимённое
        // внешнее, и искать его происхождение снаружи нельзя.
        if (!vars.has(node.name.text)) vars.set(node.name.text, [])
        const init = node.initializer ? unwrap(node.initializer) : null
        if (node.initializer) push(vars, node.name.text, node.initializer)
        if (init && isFunctionLike(init)) push(functions, node.name.text, init)
      } else if (ts.isObjectBindingPattern(node.name) && node.initializer) {
        for (const element of node.name.elements) {
          if (ts.isIdentifier(element.name)) push(scopeOf(node).vars, element.name.text, element)
        }
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) push(functions, node.name.text, node)
    ts.forEachChild(node, declare)
  }
  declare(source)

  // Проход 2: присваивания. Значение кладётся в ПУТЬ и в область, где живёт корень пути.
  const assign = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const path = pathOf(node.left)
      if (path) push(scopeAt(ownerOf(path, node)).vars, path, node.right)
    }
    ts.forEachChild(node, assign)
  }
  assign(source)

  // Проход 3: аргументы вызовов → параметры вызываемой функции. Связка слабее объявления:
  // локальный `const m = …` внутри функции побеждает аргумент.
  const call = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression)
      if (ts.isIdentifier(callee)) {
        for (const fn of functions.get(callee.text) ?? []) {
          fn.parameters.forEach((parameter, index) => {
            const argument = node.arguments[index]
            if (argument && ts.isIdentifier(parameter.name)) {
              push(scopeAt(fn).args, parameter.name.text, argument)
            }
          })
        }
      }
    }
    ts.forEachChild(node, call)
  }
  call(source)

  return scopes
}

/** Область, из которой видно это имя. `null` — имя нигде не объявлено. */
function declaringScope(name: string, from: ts.Node, scopes: Map<ts.Node, Scope>): ts.Node | null {
  let current: ts.Node = from
  for (;;) {
    if (isScope(current)) {
      const scope = scopes.get(current)
      if (scope && (scope.vars.has(name) || scope.params.has(name) || scope.args.has(name)))
        return current
    }
    if (ts.isSourceFile(current)) return null
    current = current.parent
  }
}

/** Происхождения пути, видимые из этой точки: ближайшая объявившая область побеждает. */
function originsOf(path: string, from: ts.Node, scopes: Map<ts.Node, Scope>): ts.Node[] | null {
  const root = rootOf(path)
  let current: ts.Node = from
  for (;;) {
    if (isScope(current)) {
      const scope = scopes.get(current)
      if (scope?.vars.has(path)) return scope.vars.get(path) ?? []
      if (scope?.args.has(path)) return scope.args.get(path) ?? []
      // Корень объявлен здесь, а этого поля у него нет: искать снаружи нечего — внешнее
      // одноимённое значение закрыто. Так версия 4 обвиняла `services/api.ts`.
      if (path !== root && (scope?.vars.has(root) || scope?.params.has(root))) return null
      // Параметр объявлен здесь и закрывает внешнее имя: происхождение неизвестно.
      if (scope?.params.has(path)) return null
    }
    // Область файла проверяется последней, а не пропускается: модульная константа
    // `const C = 'КОД'` живёт именно в ней.
    if (ts.isSourceFile(current)) return null
    current = current.parent
  }
}

/** Происхождения поля у известного значения: `{ text: … }.text`, `ref(…).value`. */
function memberOrigins(base: ts.Node, field: string): ts.Node[] {
  const node = unwrap(base)
  if (ts.isObjectLiteralExpression(node)) {
    const out: ts.Node[] = []
    for (const property of node.properties) {
      const name = property.name
      const matches =
        name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === field
      if (matches && ts.isPropertyAssignment(property)) out.push(property.initializer)
      if (ts.isShorthandPropertyAssignment(property) && property.name.text === field)
        out.push(property.name)
    }
    return out
  }
  if (ts.isCallExpression(node) && field === 'value') {
    const callee = unwrap(node.expression)
    if (ts.isIdentifier(callee) && REF_FACTORIES.has(callee.text) && node.arguments[0])
      return [node.arguments[0]]
  }
  return []
}

/** Всё, из чего это выражение могло получить значение: по пути и по полю носителя. */
function originsOfExpression(raw: ts.Node, ctx: Ctx, seen = new Set<ts.Node>()): ts.Node[] {
  const node = unwrap(raw)
  if (seen.has(node)) return []
  seen.add(node)

  const out: ts.Node[] = []
  const path = pathOf(node)
  if (path) out.push(...(originsOf(path, node, ctx.scopes) ?? []))

  const field = fieldName(node)
  if (field && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
    for (const base of originsOfExpression(node.expression, ctx, seen)) {
      out.push(...memberOrigins(base, field))
    }
  }
  return out
}

/** Признак «это выражение — искомый источник значения». */
type Taint = (node: ts.Node, ctx: Ctx) => boolean

/** Источник — текст исключения: `e.message`, `String(e)`, `const { message } = e`. */
const errorText: Taint = (node) => {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    return fieldName(node) === 'message'
  if (ts.isBindingElement(node)) {
    const name = node.propertyName ?? node.name
    return ts.isIdentifier(name) && name.text === 'message'
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrap(node.expression)
    // `String(e)` — стрингификация ЦЕЛОГО значения; `String(b.code)` сюда не попадает.
    if (ts.isIdentifier(callee) && callee.text === 'String') {
      const arg = node.arguments[0]
      return arg !== undefined && ts.isIdentifier(arg)
    }
  }
  return false
}

/**
 * Источник — этот параметр этой функции. Нужен, чтобы снять факт «экспорт сравнивает свой
 * параметр с кодом»: у соседа текста исключения ещё нет, он приедет снаружи.
 */
function parameterTaint(fn: FunctionLike, name: string): Taint {
  return (node, ctx) => {
    if (!ts.isIdentifier(node) || node.text !== name) return false
    const scope = ctx.scopes.get(fn)
    if (!scope?.params.has(name)) return false
    // Локальное объявление с тем же именем — уже не параметр.
    if (scope.vars.has(name)) return false
    return declaringScope(name, node, ctx.scopes) === fn
  }
}

/** Доходит ли до выражения значение, признанное источником. */
function flows(raw: ts.Node, ctx: Ctx, taint: Taint, seen = new Set<ts.Node>()): boolean {
  const node = unwrap(raw)
  if (seen.has(node)) return false
  seen.add(node)

  if (taint(node, ctx)) return true

  if (ts.isCallExpression(node)) {
    const callee = unwrap(node.expression)
    if (ts.isIdentifier(callee)) {
      if (SOURCES_OF_TRUTH.has(callee.text)) return false
      const imported = ctx.imports.get(callee.text)
      if (imported && ctx.facts?.(imported.specifier)?.returnsErrorText.has(imported.exported))
        return true
      return originsOfExpression(callee, ctx).some((o) => flows(o, ctx, taint, seen))
    }
    // `текст.trim()` остаётся текстом.
    if (ts.isPropertyAccessExpression(callee) && STRING_TRANSFORMS.has(callee.name.text))
      return flows(callee.expression, ctx, taint, seen)
    return false
  }
  if (isFunctionLike(node)) return node.body ? flows(node.body, ctx, taint, seen) : false
  if (ts.isConditionalExpression(node))
    return flows(node.whenTrue, ctx, taint, seen) || flows(node.whenFalse, ctx, taint, seen)
  if (ts.isReturnStatement(node))
    return node.expression ? flows(node.expression, ctx, taint, seen) : false
  if (ts.isIfStatement(node))
    return (
      flows(node.thenStatement, ctx, taint, seen) ||
      (node.elseStatement ? flows(node.elseStatement, ctx, taint, seen) : false)
    )
  if (ts.isBlock(node)) return node.statements.some((s) => flows(s, ctx, taint, seen))
  if (
    ts.isIdentifier(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isBindingElement(node)
  ) {
    return originsOfExpression(node, ctx).some((o) => flows(o, ctx, taint, seen))
  }
  return false
}

/** Связка параметра обратного вызова с элементами массива: `CODES.some(c => … === c)`. */
type Bindings = Map<string, ts.Node[]>

/** Код отказа, к которому сводится выражение: литерал, константа, шаблон, регулярка. */
function codeOf(
  raw: ts.Node,
  ctx: Ctx,
  bindings: Bindings,
  seen = new Set<ts.Node>(),
): string | null {
  const node = unwrap(raw)
  if (seen.has(node)) return null
  seen.add(node)

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return CODE_LITERAL.test(node.text) ? node.text : null
  }
  if (ts.isRegularExpressionLiteral(node)) {
    const body = node.text.replace(/^\//, '').replace(/\/[a-z]*$/, '')
    return CODE_LITERAL.test(body) ? body : null
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      const code = codeOf(element, ctx, bindings, seen)
      if (code) return code
    }
    return null
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      const name = property.name
      if (
        name &&
        (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
        CODE_LITERAL.test(name.text)
      ) {
        return name.text
      }
    }
    return null
  }
  if (
    ts.isIdentifier(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    if (ts.isIdentifier(node)) {
      for (const origin of bindings.get(node.text) ?? []) {
        const code = codeOf(origin, ctx, bindings, seen)
        if (code) return code
      }
    }
    for (const origin of originsOfExpression(node, ctx)) {
      const code = codeOf(origin, ctx, bindings, seen)
      if (code) return code
    }
    return null
  }
  return null
}

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
])

/** Сравнения кода отказа с помеченным значением — по смыслу, а не по записи. */
function scanComparisons(
  root: ts.Node,
  ctx: Ctx,
  taint: Taint,
  onFound: (operand: ts.Node, code: string) => void,
): void {
  const bindings: Bindings = new Map()

  const check = (operand: ts.Node, against: ts.Node) => {
    const literal = codeOf(against, ctx, bindings)
    if (literal && flows(operand, ctx, taint)) onFound(unwrap(operand), literal)
  }

  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node) && EQUALITY.has(node.operatorToken.kind)) {
      check(node.left, node.right)
      check(node.right, node.left)
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      const receiver = node.expression.expression
      const arg = node.arguments[0]

      if (arg && STRING_PROBES.has(method)) check(receiver, arg)
      if (arg && method === 'test') check(arg, receiver)

      // Перебор набора кодов: параметр обратного вызова — это элементы набора.
      if (arg && ARRAY_PROBES.has(method)) {
        check(arg, receiver)
        if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
          const parameter = arg.parameters[0]
          if (parameter && ts.isIdentifier(parameter.name)) {
            bindings.set(parameter.name.text, [receiver])
          }
        }
      }
    }

    // Вызов соседского помощника, который сравнивает свой параметр с кодом: сравнение
    // живёт в другом файле, но подсунуть туда текст исключения — то же нарушение.
    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression)
      if (ts.isIdentifier(callee)) {
        const imported = ctx.imports.get(callee.text)
        const compares = imported
          ? ctx.facts?.(imported.specifier)?.comparesParamToCode.get(imported.exported)
          : undefined
        for (const { index, code } of compares ?? []) {
          const argument = node.arguments[index]
          if (argument && flows(argument, ctx, taint)) onFound(unwrap(argument), code)
        }
      }
    }

    // `MAP[текст]` — словарь, ключи которого коды.
    if (ts.isElementAccessExpression(node)) check(node.argumentExpression, node.expression)

    if (ts.isSwitchStatement(node)) {
      for (const clause of node.caseBlock.clauses) {
        if (ts.isCaseClause(clause)) check(node.expression, clause.expression)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(root)
}

function contextOf(code: string, fileName: string, facts?: FactsLookup): Ctx {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true)
  const imports = new Map<string, { specifier: string; exported: string }>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    const clause = statement.importClause
    if (!clause) continue
    if (clause.name) imports.set(clause.name.text, { specifier, exported: 'default' })
    const bindings = clause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imports.set(element.name.text, {
          specifier,
          exported: (element.propertyName ?? element.name).text,
        })
      }
    }
  }
  return { source, scopes: buildScopes(source), imports, facts }
}

/**
 * Нарушения правила §2 в одном файле.
 *
 * `facts` — способ спросить, что делает соседний модуль. Без него межфайловый поток
 * невидим, и это не «чисто», а «не проверено»: подавать факты обязан тот, кто умеет
 * резолвить пути (спека сторожа умеет).
 */
export function findOffences(code: string, fileName = 'probe.ts', facts?: FactsLookup): Offence[] {
  const ctx = contextOf(code, fileName, facts)
  const found: Offence[] = []
  scanComparisons(ctx.source, ctx, errorText, (operand, literal) => {
    found.push({
      operand: operand.getText(ctx.source),
      code: literal,
      line: ctx.source.getLineAndCharacterOfPosition(operand.getStart(ctx.source)).line + 1,
    })
  })
  return found
}

/** Экспортируемые функции модуля: имя, под которым их импортируют, и само тело. */
function exportedFunctions(source: ts.SourceFile): Array<[string, FunctionLike]> {
  const out: Array<[string, FunctionLike]> = []
  const exported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && exported(statement)) {
      out.push([statement.name.text, statement])
    }
    if (ts.isVariableStatement(statement) && exported(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const init = declaration.initializer ? unwrap(declaration.initializer) : null
        if (init && isFunctionLike(init) && ts.isIdentifier(declaration.name)) {
          out.push([declaration.name.text, init])
        }
      }
    }
  }
  return out
}

/**
 * Факты о модуле для соседей: что его экспорт делает с текстом исключения.
 *
 * Снимается на один шаг и без чужих фактов — иначе разбор стал бы обходом всего графа
 * импортов, а сторож должен оставаться проверкой, которую можно прочитать глазами.
 */
export function moduleFacts(code: string, fileName = 'module.ts'): ModuleFacts {
  const ctx = contextOf(code, fileName)
  const returnsErrorText = new Set<string>()
  const comparesParamToCode = new Map<string, Array<{ index: number; code: string }>>()

  for (const [name, fn] of exportedFunctions(ctx.source)) {
    if (flows(fn, ctx, errorText)) returnsErrorText.add(name)

    const compares: Array<{ index: number; code: string }> = []
    const body = fn.body
    if (body) {
      fn.parameters.forEach((parameter, index) => {
        if (!ts.isIdentifier(parameter.name)) return
        scanComparisons(body, ctx, parameterTaint(fn, parameter.name.text), (_operand, code) =>
          compares.push({ index, code }),
        )
      })
    }
    if (compares.length > 0) comparesParamToCode.set(name, compares)
  }

  return { returnsErrorText, comparesParamToCode }
}

/** Содержимое `<script>` однофайлового компонента — остальное дереву не нужно. */
export function scriptOfVue(source: string): string {
  const blocks = source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)
  return [...blocks].map((m) => m[1] ?? '').join('\n')
}
