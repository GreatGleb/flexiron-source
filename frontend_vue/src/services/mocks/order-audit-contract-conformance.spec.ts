/**
 * Contract ↔ mock conformance, checked mechanically.
 *
 * The mock is the reference implementation the backend gets written from
 * (contract, preamble). So every code it throws has to be in the catalogue the
 * backend author implements, every code in that catalogue has to reach a human
 * message, and no code may be a substring of another — the frontend matches by
 * substring and the contract says so itself (§6).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCES = [
  'src/services/mocks/orders.ts',
  'src/services/mocks/reservations.ts',
  'src/services/orderLineEdits.ts',
  'src/domain/orderPricing.ts',
  'src/services/orderLines.ts',
]

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8')
}

/** Codes the mock can actually throw. */
function thrownCodes(): Set<string> {
  const codes = new Set<string>()
  for (const file of SOURCES) {
    const src = read(file)
    // Whole statement, so a ternary — `throw new Error(a ? 'X' : 'Y')` — yields both.
    for (const stmt of src.matchAll(/throw new Error\(([^)]*)\)/g)) {
      for (const tok of stmt[1]!.matchAll(/['`]([A-Z_0-9]{4,})/g)) codes.add(tok[1]!)
    }
  }
  // `throw new Error('FORBIDDEN_' + right.toUpperCase())` — a prefix, not a code.
  codes.delete('FORBIDDEN_')
  codes.add('FORBIDDEN_MANUALCOST')
  codes.add('FORBIDDEN_CORRECTION')
  return codes
}

/** Codes §6 of the contract lists. */
function documentedCodes(): Set<string> {
  const doc = read('../plans/orders-backend-contract.md')
  const section = doc.split('## 6. Коды ошибок')[1] ?? ''
  return new Set([...section.matchAll(/`([A-Z_0-9]{4,})`/g)].map((m) => m[1]!))
}

/** Codes the frontend can turn into a sentence a human can act on. */
function mappedCodes(): Set<string> {
  const src = read('src/services/orderLineEdits.ts')
  const table = src.split('const ERROR_KEYS')[1] ?? ''
  return new Set([...table.matchAll(/\[\s*'([A-Z_0-9]{4,})',/g)].map((m) => m[1]!))
}

describe('contract §6 — the error catalogue', () => {
  const thrown = thrownCodes()
  const documented = documentedCodes()
  const mapped = mappedCodes()

  it('no code is a substring of another', () => {
    const all = [...new Set([...thrown, ...documented])].sort()
    const collisions: string[] = []
    for (const a of all) {
      for (const b of all) if (a !== b && b.includes(a)) collisions.push(`${a} ⊂ ${b}`)
    }
    expect(collisions, 'the frontend matches by substring — §6').toEqual([])
  })

  it('every code the mock throws is in the catalogue', () => {
    const missing = [...thrown].filter((c) => !documented.has(c)).sort()
    expect(missing, 'thrown by the reference implementation, absent from §6').toEqual([])
  })

  it('every documented code reaches a human message', () => {
    const silent = [...documented].filter((c) => !mapped.has(c)).sort()
    expect(silent, '§3: an unknown code becomes "could not save", which explains nothing').toEqual(
      [],
    )
  })

  it('every code the frontend can show is one the server can send', () => {
    const orphans = [...mapped].filter((c) => !thrown.has(c) && !documented.has(c)).sort()
    expect(orphans, 'a message wired to a code nobody throws').toEqual([])
  })
})

describe('contract §3 — idempotency', () => {
  it('the operations §3 calls mandatory go through the idempotency guard', () => {
    const router = read('src/services/mocks/index.ts')
    const guarded = [...router.matchAll(/if \(path[^)]*\)[^]*?withIdempotency/g)].length
    // Which routes actually use it.
    const routes = [
      ...router.matchAll(/path === '([^']+)'\)\s*\{\s*return delay\(\s*withIdempotency/g),
    ].map((m) => m[1]!)
    const service = read('src/services/ordersService.ts')
    const sendsKey = /Idempotency-Key|newIdempotencyKey/.test(service)

    expect(
      {
        guardedRoutes: routes,
        anyOrderRouteGuarded: routes.some((p) => p.includes('/orders')),
        ordersServiceSendsAKey: sendsKey,
        guardUsedTimes: guarded,
      },
      '§3: "для отгрузок и платежей это обязательно"',
    ).toEqual({
      guardedRoutes: expect.arrayContaining([expect.stringContaining('/orders')]),
      anyOrderRouteGuarded: true,
      ordersServiceSendsAKey: true,
      guardUsedTimes: expect.any(Number),
    })
  })
})

describe('contract §1 — the server computes, the client does not dictate', () => {
  it('POST /items does not take a cost from the client', () => {
    const src = read('src/services/mocks/orders.ts')
    const addItem = src.split('export function mockAddOrderItem')[1]?.split('\nexport ')[0] ?? ''
    expect(
      /data\.unitCost/.test(addItem),
      '§4.2: "Добавление строки не берёт себестоимость от клиента как истину"',
    ).toBe(false)
  })

  it('PATCH /items does not take the batch breakdown from the client', () => {
    const src = read('src/services/mocks/orders.ts')
    const update = src.split('export function mockUpdateOrderItem')[1]?.split('\nexport ')[0] ?? ''
    expect(
      /delta\.allocations/.test(update),
      '§2: the breakdown is the warehouse’s, computed FIFO by the server',
    ).toBe(false)
  })
})
