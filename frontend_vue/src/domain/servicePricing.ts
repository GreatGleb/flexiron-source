import type { Currency, Uom } from '@/types/settings'
import type { TranslatedString } from '@/types/i18n'

/**
 * Подпись цены услуги — «EUR/шт», собранная там, где её показывают.
 *
 * Поля-подписи в типе услуги намеренно нет: хранить выведенную величину рядом с
 * теми, из которых она выводится, — это вторая правда об одном и том же. Поэтому
 * функция, а не поле.
 *
 * Код единицы берётся В ТЕКУЩЕМ ЯЗЫКЕ. У `uom-pcs` коды разные — `шт` / `pcs` /
 * `vnt`, — и сегодняшняя литовская подпись услуги это именно `EUR/vnt`. Собрать её
 * из `code.en`, как это делает карточка товара, значило бы показать литовцу
 * `EUR/pcs`: регресс, оплаченный «единообразием».
 */
export function serviceUnitLabel(
  currencyId: string,
  uomId: string,
  currencies: Currency[],
  uoms: Uom[],
  locale: string,
): string {
  const currency = currencies.find((c) => c.id === currencyId)
  const uom = uoms.find((u) => u.id === uomId)
  if (!currency || !uom) return '—'
  const key = locale as keyof TranslatedString
  const unitCode = uom.code[key] || uom.code.en || uom.code.ru
  return `${currency.code}/${unitCode}`
}

/**
 * Суффикс ключа `orders.unit_*` для единицы.
 *
 * В модуле заказов единицы подписываются своими ключами (`orders.unit_kg`, …), и
 * строка услуги стоит в одной таблице со строками товаров: подпиши её кодом из
 * справочника — и одна таблица заговорит на двух диалектах. Ключей четыре на восемь
 * единиц, поэтому у `t()` есть дефолт; про это расхождение — пункт 4c плана.
 */
export function uomKeySuffix(uomId: string): string {
  return uomId.replace(/^uom-/, '')
}
