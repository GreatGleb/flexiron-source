import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProductList } from '@/services/productsService'
import { productLabel, type ProductRef } from '@/domain/product'

// ─── Module-level singleton state ────────────────────────────────────────
//
// Справочник товаров один на сессию: его спрашивают три вкладки склада, три
// карточки и страница резки, и каждая из них показывает имя одного и того же
// товара. Второй запрос за тем же списком означал бы второй ответ, который может
// прийти другим — то есть ту же болезнь копии, от которой пункт 4e и избавляется.
const products = ref<ProductRef[]>([])
let inflight: Promise<void> | null = null

/**
 * Тянет справочник, если его ещё нет, и отдаёт обещание, которое можно дождаться.
 *
 * Дожидаться обязательно: имя рисуется рядом со строкой склада, и строка,
 * появившаяся раньше справочника, покажет прочерк, а потом дёрнется. Поэтому
 * загрузчики склада ждут список товаров ВМЕСТЕ со своими данными, а не после.
 *
 * Запрос упал — обещание снимается, и следующий вызов попробует снова: пустой
 * справочник, запомненный навсегда, оставил бы прочерки до перезагрузки страницы.
 */
export function ensureProductNames(): Promise<void> {
  if (!inflight) {
    inflight = getProductList()
      .then((list) => {
        products.value = list
      })
      .catch(() => {
        inflight = null
      })
  }
  return inflight
}

/**
 * Подпись товара в текущем языке — обёртка над `productLabel` из домена, которая
 * приносит справочник и локаль. Возвращается функция, а не computed: товаров на
 * странице склада двадцать пять и все разные.
 */
export function useProductNames() {
  const { locale } = useI18n()
  return {
    ensureProductNames,
    productName: (productId: string | null | undefined): string =>
      productLabel(productId, products.value, locale.value),
  }
}
