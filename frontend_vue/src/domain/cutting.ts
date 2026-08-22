import type { StockUnit } from '@/types/warehouse'
import { roundQuantity } from './quantity'

/**
 * Арифметика резки: сколько металла уходит с партии, когда из неё режут куски.
 *
 * Требование ТЗ (Process 2.2 §2): клиент купил 2500 мм — со склада ушло 2503 мм.
 * Три миллиметра съело полотно, и без них остатки расходятся с физическими
 * постепенно и незаметно.
 *
 * Здесь же живёт резолвер размера куска, и он ОДИН на оба пути — резку и ручное
 * создание обрезка. Вторая реализация означала бы две схемы списания с партии.
 */

/**
 * Единицы партии, для которых ширина реза имеет смысл.
 *
 * ЯВНЫЙ СПИСОК, А НЕ СПРАВОЧНИК — и это не лень. `batch.unit` имеет тип
 * `StockUnit = string`: в партиях лежат `'m'`, `'kg'`, `'pcs'`, `'m2'`, `'t'`, и это
 * не `uomId`. Коды справочника переведены (`TranslatedString`), поэтому `'m2'` не
 * совпадает с кодом `uom-m2` («м²» / «m²» / «m²») ни на одном языке, а `'pcs'`
 * совпадает только с английским. Любая проверка «по справочнику» на деле свелась бы
 * к сравнению с `code.en` — ровно тот дефект, что записан в п. 4b плана, только
 * заведённый сознательно, и молча ломающийся на первой партии в м².
 *
 * Маленький честный список лучше правила, которое ВЫГЛЯДИТ выведенным из данных.
 * Он исчезнет, когда партии переедут с `StockUnit` на `uomId` — п. 4d плана.
 */
export const LINEAR_BATCH_UNITS: readonly StockUnit[] = ['m', 'mm']

/** Меряется ли партия по длине — то есть имеет ли смысл ширина реза. */
export function isLinearBatchUnit(unit: StockUnit): boolean {
  return LINEAR_BATCH_UNITS.includes(unit)
}

/**
 * Ширина реза, переведённая в единицу партии.
 *
 * Ввод всегда в миллиметрах — полотно меряют в них, а не в метрах партии.
 * Для нелинейной партии — ноль: 3 мм в килограммы переводятся только через вес
 * погонного метра товара, в м² — только через ширину, и выдумывать здесь
 * коэффициент мы не будем (та же причина, по которой у `uom-h` нет ни одного
 * правила пересчёта).
 */
export function kerfInBatchUnit(kerfMm: number, unit: StockUnit): number {
  if (!isLinearBatchUnit(unit)) return 0
  return unit === 'mm' ? kerfMm : kerfMm / 1000
}

// ─── Резолвер размера куска ─────────────────────────────────────────────────

/**
 * Что нужно знать про обрезок, чтобы посчитать, сколько материала он забрал.
 *
 * `quantity` — СЧЁТЧИК КУСКОВ, а не количество материала. В сидах у всех тринадцати
 * обрезков `quantity: 1` и `unit: 'pcs'`, а настоящий размер лежит в `lengthMm` /
 * `widthMm` / `weightKg`. Единица обрезка и единица партии — разные величины, и
 * вычитать одну из другой (как делал `mockCreateOffcut`) значит списать один метр
 * с 35-метровой партии за «1 шт».
 */
export interface OffcutMaterialInput {
  quantity: number
  lengthMm?: number | null
  widthMm?: number | null
  weightKg?: number | null
}

/** Почему размер посчитать нельзя. Отказ, а не значение по умолчанию. */
export type MaterialFailureReason =
  | 'unit_not_supported'
  | 'dimension_missing'
  | 'pieces_not_integer'

/** Код ошибки для мока — один источник, чтобы тест и обработчик не разошлись. */
export const MATERIAL_ERROR_CODE: Record<MaterialFailureReason, string> = {
  unit_not_supported: 'BATCH_UNIT_NOT_SUPPORTED',
  dimension_missing: 'OFFCUT_DIMENSION_MISSING',
  pieces_not_integer: 'OFFCUT_PIECES_NOT_INTEGER',
}

export type MaterialFailure = {
  ok: false
  reason: MaterialFailureReason
  /** Единица, имя недостающего размера или присланный счётчик — для сообщения */
  detail: string
}

export type PieceSizeResult = { ok: true; pieceSize: number } | MaterialFailure

/** Какой размер обрезка нужен, чтобы выразить его в единице партии. */
const REQUIRED_DIMENSION: Record<string, readonly (keyof OffcutMaterialInput)[]> = {
  m: ['lengthMm'],
  mm: ['lengthMm'],
  m2: ['lengthMm', 'widthMm'],
  kg: ['weightKg'],
  t: ['weightKg'],
  pcs: [],
}

/** Размер одного куска, выраженный в единице партии. */
const PIECE_SIZE: Record<string, (offcut: OffcutMaterialInput) => number> = {
  m: (o) => o.lengthMm! / 1000,
  mm: (o) => o.lengthMm!,
  m2: (o) => (o.lengthMm! * o.widthMm!) / 1_000_000,
  kg: (o) => o.weightKg!,
  t: (o) => o.weightKg! / 1000,
  pcs: () => 1,
}

/** Единицы партии, для которых размер куска вообще выразим. */
export const SUPPORTED_BATCH_UNITS: readonly StockUnit[] = Object.keys(PIECE_SIZE)

/**
 * Размер ОДНОГО куска в единице партии.
 *
 * Пять строк из шести — чистая геометрия из размеров, которые форма и так спрашивает.
 * На весе стоят только `kg` и `t`, и вес сегодня вводится руками (п. 5.3 плана
 * собирается считать его из размеров по формулам товара).
 *
 * Ни одного значения по умолчанию: неизвестная единица партии, недостающий размер и
 * дробный счётчик кусков — это ОТКАЗЫ. Молчаливый ноль списал бы с партии ничего и
 * оставил металл в системе навсегда, а «считать как штуки» — списал бы метр за кусок.
 */
export function resolvePieceSize(offcut: OffcutMaterialInput, unit: StockUnit): PieceSizeResult {
  const formula = PIECE_SIZE[unit]
  if (!formula) return { ok: false, reason: 'unit_not_supported', detail: unit }

  if (!Number.isInteger(offcut.quantity) || offcut.quantity < 1) {
    return { ok: false, reason: 'pieces_not_integer', detail: String(offcut.quantity) }
  }

  for (const dimension of REQUIRED_DIMENSION[unit] ?? []) {
    const value = offcut[dimension]
    // Ноль здесь так же непригоден, как null: кусок нулевой длины не забирает
    // с партии ничего, а «ничего» — это не ответ, это тот же молчаливый ноль.
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return { ok: false, reason: 'dimension_missing', detail: dimension }
    }
  }

  return { ok: true, pieceSize: formula(offcut) }
}

/**
 * Площадь одного куска в м² — или `null`, если её нельзя выразить.
 *
 * Живёт здесь, рядом с резолвером, и СПРАШИВАЕТ его, а не повторяет условие: требование
 * «нужны и длина, и ширина» уже записано данными в `REQUIRED_DIMENSION.m2`, и второе
 * выражение того же требования в шаблоне разошлось бы с первым на первой же правке.
 *
 * `null` — это «невыразима», а не ноль: у трубы ширины нет, и площади у неё не ноль, её
 * попросту нет (то же различие, что у пропила на нелинейной партии). Экран показывает
 * прочерк, а не 0 м².
 *
 * Счётчик кусков здесь не при чём — спрашивается площадь ОДНОГО куска, поэтому
 * `quantity` подменяется единицей: иначе дробное или нулевое количество отказало бы в
 * ответе на вопрос, к которому оно не относится.
 */
export function offcutAreaM2(offcut: Omit<OffcutMaterialInput, 'quantity'>): number | null {
  const resolved = resolvePieceSize({ ...offcut, quantity: 1 }, 'm2')
  return resolved.ok ? resolved.pieceSize : null
}

export type MaterialResult =
  | { ok: true; pieces: number; pieceSize: number; material: number }
  | MaterialFailure

/** Сколько материала забрал обрезок целиком: счётчик кусков × размер куска. */
export function resolveOffcutMaterial(
  offcut: OffcutMaterialInput,
  unit: StockUnit,
): MaterialResult {
  const size = resolvePieceSize(offcut, unit)
  if (!size.ok) return size
  return {
    ok: true,
    pieces: offcut.quantity,
    pieceSize: size.pieceSize,
    material: roundQuantity(offcut.quantity * size.pieceSize),
  }
}

// ─── Списание с партии ──────────────────────────────────────────────────────

/**
 * Число резов — по одному на каждый физический кусок.
 *
 * НАПРАВЛЕНИЕ ОШИБКИ ВЫБРАНО СОЗНАТЕЛЬНО, не чините это на `N−1`.
 *
 * Формула переоценивает на один рез там, где партия расходуется ровно: пруток 6000
 * распустили на два по 3000 — физически рез один, здесь получится два. Оставлено
 * так, потому что две стороны ошибки стоят по-разному:
 *
 * - переоценка — списали на 3 мм больше, чем ушло. Система показывает МЕНЬШЕ
 *   металла, чем лежит; лишнее найдётся при инвентаризации
 * - недооценка — система показывает БОЛЬШЕ, чем лежит. Металл пообещали клиенту,
 *   а его нет
 *
 * Второе дороже, а ровный расход редок: партии крупные, резы идут под заказ.
 *
 * Считается по КУСКАМ, а не по строкам и не по материалу: строка «3 шт по 500 мм» —
 * это три куска и три реза, а не полтора метра резов.
 */
export function cutCount(offcuts: readonly { quantity: number }[]): number {
  return offcuts.reduce((sum, offcut) => sum + offcut.quantity, 0)
}

/** Из чего сложилось списание — каждое слагаемое видно отдельно. */
export interface CuttingConsumption {
  /** Число резов = число кусков */
  cuts: number
  /** Материал, ушедший в куски, в единице партии */
  offcutTotal: number
  /** Пропилы: `cuts × kerf` в единице партии */
  kerfTotal: number
  /** Отходы, как их назвал оператор */
  waste: number
  /** Итого с партии */
  consumed: number
}

export type ConsumptionResult =
  | ({ ok: true } & CuttingConsumption)
  | (MaterialFailure & { offcutIndex: number })

/**
 * Списание с партии: материал кусков + пропилы + отходы.
 *
 * Пропил и отход — разные вещи, и в расчёте они отдельными слагаемыми: пропил это
 * металл, уничтоженный полотном (после реза его нет нигде), отход — металл, который
 * существует, но негоден (короткий хвост, испорченный рез).
 *
 * Отказ одного куска отказывает всей операции и называет его номер: резка — одна
 * проводка, и списать половину заявленного хуже, чем не списать ничего.
 */
export function computeCuttingConsumption(input: {
  offcuts: readonly OffcutMaterialInput[]
  kerfMm: number
  wasteQuantity: number
  unit: StockUnit
}): ConsumptionResult {
  let offcutTotal = 0
  for (const [index, offcut] of input.offcuts.entries()) {
    const resolved = resolveOffcutMaterial(offcut, input.unit)
    if (!resolved.ok) return { ...resolved, offcutIndex: index }
    offcutTotal += resolved.material
  }

  // Единица без формулы отказывает и на пустом списке: «нечего резать» — это не
  // повод согласиться с партией, которую мы не умеем считать.
  if (!PIECE_SIZE[input.unit]) {
    return { ok: false, reason: 'unit_not_supported', detail: input.unit, offcutIndex: -1 }
  }

  const cuts = cutCount(input.offcuts)
  const kerfTotal = roundQuantity(cuts * kerfInBatchUnit(input.kerfMm, input.unit))
  const waste = input.wasteQuantity
  return {
    ok: true,
    cuts,
    offcutTotal: roundQuantity(offcutTotal),
    kerfTotal,
    waste,
    consumed: roundQuantity(roundQuantity(offcutTotal) + kerfTotal + waste),
  }
}
