import type { Currency, Uom } from '@/types/settings'
import { uomCode } from '@/domain/uom'

/**
 * Подпись цены услуги — «EUR/шт», собранная там, где её показывают.
 *
 * Поля-подписи в типе услуги намеренно нет: хранить выведенную величину рядом с
 * теми, из которых она выводится, — это вторая правда об одном и том же. Поэтому
 * функция, а не поле.
 *
 * Код единицы берётся В ТЕКУЩЕМ ЯЗЫКЕ. У `uom-pcs` коды разные — `шт` / `pcs` /
 * `vnt`, — и сегодняшняя литовская подпись услуги это именно `EUR/vnt`. Собрать её
 * из `code.en`, как делала карточка товара до п. 4b плана, значило бы показать
 * литовцу `EUR/pcs`: регресс, оплаченный «единообразием».
 */
export function serviceUnitLabel(
  currencyId: string,
  uomId: string,
  currencies: Currency[],
  uoms: Uom[],
  locale: string,
): string {
  const currency = currencies.find((c) => c.id === currencyId)
  const unitCode = uomCode(uomId, uoms, locale)
  if (!currency || !unitCode) return '—'
  return `${currency.code}/${unitCode}`
}
