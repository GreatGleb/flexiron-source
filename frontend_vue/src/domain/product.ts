import type { TranslatedString } from '@/types/i18n'

/**
 * Плоская строка справочника товаров — ровно то, что отдаёт `GET /api/products/list`.
 */
export interface ProductRef {
  id: string
  name: TranslatedString
}

/**
 * Имя товара — единственное место, где оно собирается для показа.
 *
 * До 2026-08-27 (пункт 4e плана `review-followups.md`) его хранили копией сразу в
 * трёх складских записях — партии, обрезке и движении, — и копии разошлись: prod-012
 * звался «Стальной лист S235 2мм» в каталоге, «Арматура 12мм» в партии и «Труба
 * стальная 50мм» в обрезке. Девяносто две партии из ста называли себя не тем товаром,
 * на который ссылались. Владелец имени один — карточка товара, поэтому склад хранит
 * только `productId`, а подпись собирается здесь, тем же правилом, что `unitLabel`
 * собирает подпись единицы.
 *
 * Товара нет в справочнике или справочник ещё не ответил — прочерк. Показать вместо
 * имени сам `productId` нельзя: `prod-012` в колонке «Товар» читается как название.
 */
export function productLabel(
  productId: string | null | undefined,
  products: ProductRef[],
  locale: string,
): string {
  if (!productId) return '—'
  const product = products.find((p) => p.id === productId)
  if (!product) return '—'
  const key = locale as keyof TranslatedString
  return product.name[key] || product.name.en || product.name.ru || '—'
}
