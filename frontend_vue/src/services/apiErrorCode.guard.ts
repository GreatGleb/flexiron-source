import ts from 'typescript'

/**
 * Сторож правила §2 «отказ несёт код, а не текст»: машинный код нельзя доставать из
 * текста исключения.
 *
 * **Разбор идёт по синтаксическому дереву, а не по регулярным выражениям — и это решение
 * куплено тремя провалами подряд.** Первая версия искала литерал по файлу и требовала
 * подчёркивания, из-за чего не видела `CONFLICT`. Вторая сузилась до тела `catch` и
 * оказалась слепа к семи формам обработчика из восьми, а проверкой «в теле есть
 * `errorCode(`» вдобавок иммунизировала всё тело. Третья перешла на операнд и пропускала
 * деструктуризацию, присваивание без объявления, `e['message']`, `includes` по массиву,
 * `startsWith`, регулярку и обёртку-функцию.
 *
 * Закономерность тут не в невезении: каждая заплатка закрывала **запись** дефекта, а
 * записей у одной мысли бесконечно много. Дерево разбирает смысл — «что с чем сравнили»
 * и «откуда взялся операнд», — поэтому форма записи перестаёт иметь значение.
 *
 * **Чего сторож по-прежнему не умеет** (написано здесь, чтобы зелёный прогон не читался
 * как доказательство отсутствия — питфолл #66):
 * - межмодульный поток: текст, уехавший в другой файл и вернувшийся оттуда;
 * - область видимости не учитывается — одноимённые переменные в разных функциях
 *   считаются одной. Это даёт ложные срабатывания, но не пропуски;
 * - сравнение, собранное во время работы (`new RegExp(переменная)`);
 * - `String(e.какоеТоПоле)` — текстом исключения считается стрингификация целого
 *   значения, а не поля.
 */

/** Литерал кода отказа: `CONFLICT`, `ORDER_NOT_FOUND`. Подчёркивание не обязательно. */
const CODE_LITERAL = /^[A-Z][A-Z0-9_]{4,}$/

/** Методы, которыми код ищут в строке. */
const STRING_PROBES = new Set(['includes', 'startsWith', 'endsWith', 'match', 'search'])

/** Вызовы, дающие законный ответ на вопрос «какой это код». */
const SOURCES_OF_TRUTH = new Set(['errorCode', 'errorMessageKey'])

export interface Offence {
  /** Текст операнда, который сравнили с кодом. */
  operand: string
  /** Литерал кода. */
  code: string
  /** Строка в файле, 1-based. */
  line: number
}

/**
 * Происхождения каждого имени в файле: объявления, присваивания, деструктуризация.
 *
 * Область видимости намеренно не учитывается. Огрубление работает в безопасную сторону:
 * одноимённые переменные сливаются, и сторож скорее заругается зря, чем промолчит.
 */
function originsOfNames(source: ts.SourceFile): Map<string, ts.Node[]> {
  const origins = new Map<string, ts.Node[]>()
  const add = (name: string, node: ts.Node) => {
    const list = origins.get(name) ?? []
    list.push(node)
    origins.set(name, list)
  }

  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      if (ts.isIdentifier(node.name)) add(node.name.text, node.initializer)
      // `const { message } = e` — имя поля и есть происхождение.
      else if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (ts.isIdentifier(element.name)) add(element.name.text, element)
        }
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.left)
    ) {
      add(node.left.text, node.right)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return origins
}

/** Достаёт ли выражение текст исключения — прямо или через цепочку имён. */
function isErrorText(
  node: ts.Node,
  origins: Map<string, ts.Node[]>,
  seen = new Set<string>(),
): boolean {
  // `e.message`
  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'message'
  // `e['message']`
  if (ts.isElementAccessExpression(node)) {
    const arg = node.argumentExpression
    return ts.isStringLiteral(arg) && arg.text === 'message'
  }
  // `const { message } = e`
  if (ts.isBindingElement(node)) {
    const name = node.propertyName ?? node.name
    return ts.isIdentifier(name) && name.text === 'message'
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression
    // `errorCode(e)` — законный ответ, дальше не идём.
    if (ts.isIdentifier(callee) && SOURCES_OF_TRUTH.has(callee.text)) return false
    // `String(e)` — стрингификация ЦЕЛОГО значения, то есть исключения. `String(b.code)`
    // сюда не попадает намеренно: это стрингификация поля, и разбор тела ответа в
    // `api.ts` иначе оказывался нарушителем — сторож поймал собственное огрубление.
    if (ts.isIdentifier(callee) && callee.text === 'String') {
      const arg = node.arguments[0]
      return arg !== undefined && ts.isIdentifier(arg)
    }
    // Обёртка вида `txt(e)` — смотрим, что возвращает одноимённое объявление.
    if (ts.isIdentifier(callee)) {
      return (origins.get(callee.text) ?? []).some((o) => isErrorText(o, origins, seen))
    }
    return false
  }
  if (ts.isArrowFunction(node)) {
    return !ts.isBlock(node.body) && isErrorText(node.body, origins, seen)
  }
  if (ts.isConditionalExpression(node)) {
    return isErrorText(node.whenTrue, origins, seen) || isErrorText(node.whenFalse, origins, seen)
  }
  if (ts.isParenthesizedExpression(node)) return isErrorText(node.expression, origins, seen)
  if (ts.isNonNullExpression(node)) return isErrorText(node.expression, origins, seen)
  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) return false
    seen.add(node.text)
    return (origins.get(node.text) ?? []).some((o) => isErrorText(o, origins, seen))
  }
  return false
}

function codeOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) && CODE_LITERAL.test(node.text)) return node.text
  if (ts.isRegularExpressionLiteral(node)) {
    const body = node.text.replace(/^\/|\/[a-z]*$/g, '')
    return CODE_LITERAL.test(body) ? body : null
  }
  return null
}

/** Сравнения кода отказа с текстом исключения — по смыслу, а не по записи. */
export function findOffences(code: string, fileName = 'probe.ts'): Offence[] {
  const source = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true)
  const origins = originsOfNames(source)
  const found: Offence[] = []

  const report = (operandNode: ts.Node, literal: string) => {
    found.push({
      operand: operandNode.getText(source),
      code: literal,
      line: source.getLineAndCharacterOfPosition(operandNode.getStart(source)).line + 1,
    })
  }

  const visit = (node: ts.Node): void => {
    // `x === 'CODE'` и `'CODE' === x`
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind
      if (
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsEqualsToken
      ) {
        for (const [a, b] of [
          [node.left, node.right],
          [node.right, node.left],
        ] as const) {
          const literal = codeOf(b)
          if (literal && isErrorText(a, origins)) report(a, literal)
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      const receiver = node.expression.expression
      const arg = node.arguments[0]

      // `текст.includes('CODE')`, `.startsWith`, `.match(/CODE/)`
      if (STRING_PROBES.has(method) && arg) {
        const literal = codeOf(arg)
        if (literal && isErrorText(receiver, origins)) report(receiver, literal)
      }

      // `['CODE', …].includes(текст)` — приёмник массив, операнд в аргументе
      if (method === 'includes' && ts.isArrayLiteralExpression(receiver) && arg) {
        const literal = receiver.elements.map(codeOf).find((c): c is string => c !== null)
        if (literal && isErrorText(arg, origins)) report(arg, literal)
      }

      // `/CODE/.test(текст)`
      if (method === 'test' && arg) {
        const literal = codeOf(receiver)
        if (literal && isErrorText(arg, origins)) report(arg, literal)
      }
    }

    // `switch (текст) { case 'CODE': }`
    if (ts.isSwitchStatement(node) && isErrorText(node.expression, origins)) {
      for (const clause of node.caseBlock.clauses) {
        if (!ts.isCaseClause(clause)) continue
        const literal = codeOf(clause.expression)
        if (literal) report(node.expression, literal)
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
