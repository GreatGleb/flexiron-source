import ts from 'typescript'

/**
 * Сторож правила §2 «отказ несёт код, а не текст»: машинный код нельзя доставать из
 * текста исключения.
 *
 * **История версий тут — не хроника, а объяснение устройства.** Четыре предыдущие были
 * слепы, и каждый раз по одной и той же причине: закрывалась ЗАПИСЬ дефекта, а записей у
 * одной мысли бесконечно много.
 *
 * | версия | предмет | чем оказалась слепа |
 * |---|---|---|
 * | 1 | литерал по файлу, подчёркивание обязательно | `CONFLICT`; `api.ts` в изъятиях |
 * | 2 | тело `catch` | 7 форм обработчика из 8; `errorCode(` в теле давало иммунитет |
 * | 3 | операнд, регулярками | 6 форм операнда из 9 |
 * | 4 | операнд по дереву | 10 форм ЛИТЕРАЛА и ОПЕРАЦИИ из 10 |
 *
 * Пятая версия существует потому, что четвёртая применила разбор по смыслу к **одной
 * стороне сравнения из трёх**. Операнд резолвился через объявления, а литерал и операция
 * по-прежнему перечислялись записями — отсюда `const C = 'SOME_CODE'`, `==` вместо `===`,
 * `indexOf`, регулярка в константе и словарь по тексту.
 *
 * Здесь по смыслу разбираются **все три**: и «что сравнивают», и «с чем», и «чем».
 *
 * **Области видимости учитываются.** Версия 4 сливала одноимённые переменные и обвиняла
 * `services/api.ts`: параметр `code` разбора тела ответа считался тем же `code`, что
 * чей-то `const code = e.message`. Ложное обвинение на правильном коде — худший исход,
 * чем пропуск: оно заставляет следующего автора отключить сторож.
 *
 * **Чего сторож не умеет** (названо, чтобы зелёное не читалось как доказательство
 * отсутствия — питфолл #66):
 * - **поток через параметр функции** — связка «аргумент на месте вызова → параметр» не
 *   моделируется вовсе, ни между файлами, ни внутри одного. `h(e.message)` при
 *   `function h(m){ if (m === 'КОД') }` проходит мимо. Исключение одно: параметр
 *   обратного вызова у перебора массива связывается с его элементами;
 * - межмодульный поток: текст, уехавший в другой файл и вернувшийся оттуда;
 * - значение, собранное во время работы (`new RegExp(переменная)`, склейка из кусков);
 * - блочная область видимости огрублена до функции: два `const` с одним именем в разных
 *   блоках одной функции сливаются.
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

export interface Offence {
  operand: string
  code: string
  line: number
}

const isScope = (node: ts.Node): boolean =>
  ts.isSourceFile(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isSetAccessorDeclaration(node)

interface Scope {
  /** Имя → выражения, из которых оно получило значение. */
  vars: Map<string, ts.Node[]>
  /** Параметры: имя объявлено, но происхождение неизвестно. */
  params: Set<string>
}

/** Таблицы имён по областям видимости. Функция — граница; блоки огрублены до функции. */
function buildScopes(source: ts.SourceFile): Map<ts.Node, Scope> {
  const scopes = new Map<ts.Node, Scope>()

  const enclosing = (node: ts.Node): ts.Node => {
    let current: ts.Node = node.parent
    while (!isScope(current)) current = current.parent
    return current
  }
  const scopeOf = (node: ts.Node): Scope => {
    const owner = isScope(node) ? node : enclosing(node)
    let scope = scopes.get(owner)
    if (!scope) {
      scope = { vars: new Map(), params: new Set() }
      scopes.set(owner, scope)
    }
    return scope
  }
  const bind = (node: ts.Node, name: string, origin: ts.Node) => {
    const vars = scopeOf(node).vars
    vars.set(name, [...(vars.get(name) ?? []), origin])
  }

  const visit = (node: ts.Node): void => {
    if (isScope(node)) scopeOf(node)
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      scopeOf(node).params.add(node.name.text)
    }
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) bind(node, node.name.text, node.initializer)
      else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (ts.isIdentifier(element.name)) bind(node, element.name.text, element)
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      bind(node, node.left.text, node.right)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return scopes
}

/** Происхождения имени, видимые из этой точки: ближайшая объявившая область побеждает. */
function originsOf(name: string, from: ts.Node, scopes: Map<ts.Node, Scope>): ts.Node[] | null {
  let current: ts.Node = from
  for (;;) {
    if (isScope(current)) {
      const scope = scopes.get(current)
      if (scope?.vars.has(name)) return scope.vars.get(name) ?? []
      // Параметр объявлен здесь и закрывает внешнее имя: происхождение неизвестно.
      if (scope?.params.has(name)) return null
    }
    // Область файла проверяется последней, а не пропускается: модульная константа
    // `const C = 'КОД'` живёт именно в ней.
    if (ts.isSourceFile(current)) return null
    current = current.parent
  }
}

/** Связка параметра обратного вызова с элементами массива: `CODES.some(c => … === c)`. */
type Bindings = Map<string, ts.Node[]>

function unwrap(node: ts.Node): ts.Node {
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))
    return unwrap(node.expression)
  if (ts.isAsExpression(node)) return unwrap(node.expression)
  return node
}

/** Достаёт ли выражение текст исключения. */
function isErrorText(
  raw: ts.Node,
  scopes: Map<ts.Node, Scope>,
  seen = new Set<ts.Node>(),
): boolean {
  const node = unwrap(raw)
  if (seen.has(node)) return false
  seen.add(node)

  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'message'
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression
    return ts.isStringLiteral(arg) && arg.text === 'message'
  }
  if (ts.isBindingElement(node)) {
    const name = node.propertyName ?? node.name
    return ts.isIdentifier(name) && name.text === 'message'
  }
  if (ts.isCallExpression(node)) {
    const callee = unwrap(node.expression)
    if (ts.isIdentifier(callee)) {
      if (SOURCES_OF_TRUTH.has(callee.text)) return false
      // `String(e)` — стрингификация ЦЕЛОГО значения; `String(b.code)` сюда не попадает.
      if (callee.text === 'String') {
        const arg = node.arguments[0]
        return arg !== undefined && ts.isIdentifier(arg)
      }
      const origins = originsOf(callee.text, node, scopes)
      return (origins ?? []).some((o) => isErrorText(o, scopes, seen))
    }
    // `текст.trim()` остаётся текстом.
    if (ts.isPropertyAccessExpression(callee) && STRING_TRANSFORMS.has(callee.name.text)) {
      return isErrorText(callee.expression, scopes, seen)
    }
    return false
  }
  if (ts.isArrowFunction(node))
    return !ts.isBlock(node.body) && isErrorText(node.body, scopes, seen)
  if (ts.isConditionalExpression(node)) {
    return isErrorText(node.whenTrue, scopes, seen) || isErrorText(node.whenFalse, scopes, seen)
  }
  if (ts.isReturnStatement(node) && node.expression)
    return isErrorText(node.expression, scopes, seen)
  if (ts.isBlock(node)) return node.statements.some((s) => isErrorText(s, scopes, seen))
  if (ts.isIdentifier(node)) {
    const origins = originsOf(node.text, node, scopes)
    return (origins ?? []).some((o) => isErrorText(o, scopes, seen))
  }
  return false
}

/** Код отказа, к которому сводится выражение: литерал, константа, шаблон, регулярка. */
function codeOf(
  raw: ts.Node,
  scopes: Map<ts.Node, Scope>,
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
      const code = codeOf(element, scopes, bindings, seen)
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
  if (ts.isIdentifier(node)) {
    const bound = bindings.get(node.text)
    if (bound) {
      for (const origin of bound) {
        const code = codeOf(origin, scopes, bindings, seen)
        if (code) return code
      }
    }
    const origins = originsOf(node.text, node, scopes)
    for (const origin of origins ?? []) {
      const code = codeOf(origin, scopes, bindings, seen)
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

/** Сравнения кода отказа с текстом исключения — по смыслу, а не по записи. */
export function findOffences(code: string, fileName = 'probe.ts'): Offence[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true)
  const scopes = buildScopes(source)
  const found: Offence[] = []
  const bindings: Bindings = new Map()

  const report = (operand: ts.Node, literal: string) => {
    const at = unwrap(operand)
    found.push({
      operand: at.getText(source),
      code: literal,
      line: source.getLineAndCharacterOfPosition(at.getStart(source)).line + 1,
    })
  }
  const check = (operand: ts.Node, against: ts.Node) => {
    const literal = codeOf(against, scopes, bindings)
    if (literal && isErrorText(operand, scopes)) report(operand, literal)
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

    // `MAP[текст]` — словарь, ключи которого коды.
    if (ts.isElementAccessExpression(node)) check(node.argumentExpression, node.expression)

    if (ts.isSwitchStatement(node)) {
      for (const clause of node.caseBlock.clauses) {
        if (ts.isCaseClause(clause)) check(node.expression, clause.expression)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return found
}

/** Содержимое `<script>` однофайлового компонента — остальное дереву не нужно. */
export function scriptOfVue(source: string): string {
  const blocks = source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)
  return [...blocks].map((m) => m[1] ?? '').join('\n')
}
