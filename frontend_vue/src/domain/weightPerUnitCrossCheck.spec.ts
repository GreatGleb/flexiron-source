import { describe, it, expect } from 'vitest'
import { mockGetProduct, mockGetProducts } from '@/services/mocks/products'
import { productDensityKgM3 } from './cutting'

/**
 * Постоянная сверка: заявленный каталогом кг/м против НЕЗАВИСИМОЙ геометрии.
 *
 * Независимость здесь — условие, а не пожелание. Сверять значение с формулой, в которую
 * входит то же самое значение, — это утверждение, которое устраивает бездействие
 * (питфолл #68): тест позеленеет всегда. Поэтому сверяются только те товары, у которых
 * геометрия считается из ДРУГИХ полей — диаметра, стенки и плотности, — а `Вес на метр`
 * у них удалён при миграции и в расчёт не входит.
 *
 * Допуск 5%. Обоснование замером: на круглых трубах расхождение ≤1% (11.71 против
 * 11.714 — 0.03%), у закрытых профилей радиусы скругления дают до 4% (реальное сечение
 * меньше формулы с острыми углами). Трёхкратные ошибки, за которыми охота, порог видит
 * с огромным запасом.
 */

const TOLERANCE = 0.05

/**
 * Товары, исключённые из сверки ЯВНО, со причиной.
 *
 * У них профиль не выражен в данных: сечение прямоугольное или квадратное, а поля несут
 * только «Диаметр» и «Толщина стенки» — второй размер живёт лишь в НАЗВАНИИ
 * («40x40x3», «80x40x3»). Считать их по круглой формуле нельзя (даёт 4% и 10%), а брать
 * размер из названия значит угадывать по подписи. Это дефект данных, записанный
 * пунктом плана, а не повод расширить допуск.
 */
const EXCLUDED: Record<string, string> = {
  'prod-025': 'квадратный профиль: сторона только в названии, поля дают лишь диаметр',
  'prod-026': 'прямоугольный профиль: вторая сторона только в названии',
}

describe('заявленный кг/м против независимой геометрии', () => {
  it('сходится в пределах 5% у всех, кто проверяем, и исключения названы', async () => {
    const list = await mockGetProducts({
      search: '',
      categoryIds: [],
      sortBy: null,
      sortDir: 'asc',
      page: 1,
      pageSize: 500,
    })

    const checked: string[] = []
    const skipped: string[] = []
    const failed: string[] = []

    for (const item of list.items) {
      const p = await mockGetProduct(item.id)
      const stated = p.weightPerWarehouseUnitKg
      if (stated == null) continue

      const f = new Map<string, number>()
      for (const fv of p.fieldValues ?? []) {
        const n = Number(fv.value)
        if (Number.isFinite(n)) f.set(fv.fieldName.ru, n)
      }
      const density = productDensityKgM3(p)
      const diameter = f.get('Диаметр (мм)')
      const wall = f.get('Толщина стенки (мм)')

      if (EXCLUDED[p.id]) {
        skipped.push(p.id)
        continue
      }
      if (!density || !diameter) {
        skipped.push(p.id)
        continue
      }

      // Труба: кольцо по среднему диаметру. Арматура: сплошной круг — стенки у неё нет
      // по природе, и это не «данных не хватает».
      const computed = wall
        ? (Math.PI * (diameter - wall) * wall * density) / 1e6
        : (Math.PI / 4) * (diameter / 1000) ** 2 * density

      const deviation = Math.abs(stated - computed) / computed
      checked.push(p.id)
      if (deviation > TOLERANCE) {
        failed.push(
          `${p.id} «${p.name.ru}»: заявлено ${stated}, геометрия ${computed.toFixed(3)}, расхождение ${(deviation * 100).toFixed(0)}%`,
        )
      }
    }

    // Расхождение больше порога — это найденный дефект ДАННЫХ, и тест называет товар.
    expect(failed, `кг/м расходится с геометрией:\n${failed.join('\n')}`).toEqual([])

    // Сверка обязана что-то сверять: пустой список проверенных прошёл бы молча.
    expect(checked.length).toBeGreaterThanOrEqual(11)
    // И исключения — ровно те, что объявлены, ни одного тихого.
    expect(skipped.sort()).toEqual(Object.keys(EXCLUDED).sort())
  })
})
