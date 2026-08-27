import type { OrderDocumentType } from '@/types/order'

/**
 * Справочник стран — ISO 3166-1 alpha-2, 249 официально присвоенных кодов.
 *
 * Страна у клиента хранится КОДОМ, а не строкой, и вот почему. По ней система
 * предлагает тип комплекта документов (`suggestedDocumentType` ниже), а правило
 * такого рода живёт ровно столько, сколько живёт однозначность значения: у
 * свободного текста «Литва», «Lietuva», «LT», «lt.» — четыре разных значения и
 * одна страна, и первое же сравнение промахивается. У поставщика поле `country`
 * до сих пор текстовое (`services/mocks/suppliers.ts`: `'UK'`, `'Estonia'`) —
 * ровно та разнопись, которой здесь быть не должно.
 *
 * Список закрытый и не редактируется из настроек — в отличие от валют и единиц.
 * Это не упущение: у валюты и единицы состав задаёт компания, а состав стран
 * задаёт ISO, и возможность завести двести пятидесятую строку руками вернула бы
 * ту самую разнопись, ради ухода от которой поле и стало ссылкой.
 */
export const COUNTRY_CODES = [
  'AD',
  'AE',
  'AF',
  'AG',
  'AI',
  'AL',
  'AM',
  'AO',
  'AQ',
  'AR',
  'AS',
  'AT',
  'AU',
  'AW',
  'AX',
  'AZ',
  'BA',
  'BB',
  'BD',
  'BE',
  'BF',
  'BG',
  'BH',
  'BI',
  'BJ',
  'BL',
  'BM',
  'BN',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BT',
  'BV',
  'BW',
  'BY',
  'BZ',
  'CA',
  'CC',
  'CD',
  'CF',
  'CG',
  'CH',
  'CI',
  'CK',
  'CL',
  'CM',
  'CN',
  'CO',
  'CR',
  'CU',
  'CV',
  'CW',
  'CX',
  'CY',
  'CZ',
  'DE',
  'DJ',
  'DK',
  'DM',
  'DO',
  'DZ',
  'EC',
  'EE',
  'EG',
  'EH',
  'ER',
  'ES',
  'ET',
  'FI',
  'FJ',
  'FK',
  'FM',
  'FO',
  'FR',
  'GA',
  'GB',
  'GD',
  'GE',
  'GF',
  'GG',
  'GH',
  'GI',
  'GL',
  'GM',
  'GN',
  'GP',
  'GQ',
  'GR',
  'GS',
  'GT',
  'GU',
  'GW',
  'GY',
  'HK',
  'HM',
  'HN',
  'HR',
  'HT',
  'HU',
  'ID',
  'IE',
  'IL',
  'IM',
  'IN',
  'IO',
  'IQ',
  'IR',
  'IS',
  'IT',
  'JE',
  'JM',
  'JO',
  'JP',
  'KE',
  'KG',
  'KH',
  'KI',
  'KM',
  'KN',
  'KP',
  'KR',
  'KW',
  'KY',
  'KZ',
  'LA',
  'LB',
  'LC',
  'LI',
  'LK',
  'LR',
  'LS',
  'LT',
  'LU',
  'LV',
  'LY',
  'MA',
  'MC',
  'MD',
  'ME',
  'MF',
  'MG',
  'MH',
  'MK',
  'ML',
  'MM',
  'MN',
  'MO',
  'MP',
  'MQ',
  'MR',
  'MS',
  'MT',
  'MU',
  'MV',
  'MW',
  'MX',
  'MY',
  'MZ',
  'NA',
  'NC',
  'NE',
  'NF',
  'NG',
  'NI',
  'NL',
  'NO',
  'NP',
  'NR',
  'NU',
  'NZ',
  'OM',
  'PA',
  'PE',
  'PF',
  'PG',
  'PH',
  'PK',
  'PL',
  'PM',
  'PN',
  'PR',
  'PS',
  'PT',
  'PW',
  'PY',
  'QA',
  'RE',
  'RO',
  'RS',
  'RU',
  'RW',
  'SA',
  'SB',
  'SC',
  'SD',
  'SE',
  'SG',
  'SH',
  'SI',
  'SJ',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SR',
  'SS',
  'ST',
  'SV',
  'SX',
  'SY',
  'SZ',
  'TC',
  'TD',
  'TF',
  'TG',
  'TH',
  'TJ',
  'TK',
  'TL',
  'TM',
  'TN',
  'TO',
  'TR',
  'TT',
  'TV',
  'TW',
  'TZ',
  'UA',
  'UG',
  'UM',
  'US',
  'UY',
  'UZ',
  'VA',
  'VC',
  'VE',
  'VG',
  'VI',
  'VN',
  'VU',
  'WF',
  'WS',
  'YE',
  'YT',
  'ZA',
  'ZM',
  'ZW',
] as const

export type CountryCode = (typeof COUNTRY_CODES)[number]

const CODE_SET: ReadonlySet<string> = new Set(COUNTRY_CODES)

export function isCountryCode(value: string): value is CountryCode {
  return CODE_SET.has(value)
}

/**
 * Подпись страны на текущем языке.
 *
 * Названия берутся у платформы (`Intl.DisplayNames`), а не из `src/i18n/`, и это
 * тот же выбор, что в `uom.ts`: словарь на 249 строк × 3 языка, набранный руками,
 * расходится с реальностью молча — пропущенная строка нарисовалась бы кодом. У
 * ICU все три наших языка есть: LT → Lithuania / Литва / Lietuva.
 *
 * Кэш по локали — потому что `Intl.DisplayNames` строится небесплатно, а список
 * стран перерисовывается на каждое открытие выпадающего списка.
 */
const displayNamesCache = new Map<string, Intl.DisplayNames | null>()

function displayNamesFor(locale: string): Intl.DisplayNames | null {
  if (!displayNamesCache.has(locale)) {
    let instance: Intl.DisplayNames | null
    try {
      instance = new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      instance = null
    }
    displayNamesCache.set(locale, instance)
  }
  return displayNamesCache.get(locale) ?? null
}

/**
 * Код без названия подписывается самим кодом: `LT` читается, а прочерк на месте
 * страны читается как «страны нет», что неправда.
 */
export function countryLabel(code: string, locale: string): string {
  try {
    return displayNamesFor(locale)?.of(code) ?? code
  } catch {
    return code
  }
}

/**
 * Страна, чьи документы считаются локальным комплектом.
 *
 * Одно значение, одно место: ТЗ (Process 2.1 §2) говорит «Локальный (Литва) —
 * накладные и счета-фактуры LT», и сравнение с ним не должно быть записано
 * литералом там, где им пользуются.
 */
export const LOCAL_DOCUMENT_COUNTRY: CountryCode = 'LT'

/**
 * Тип комплекта документов, который система ПРЕДЛАГАЕТ по стране клиента:
 * Литва — локальный, любая другая страна — экспорт.
 *
 * `null` означает «предложить нечего»: у клиента страна не заполнена. Это не то
 * же самое, что «предложить локальный» — подставленное по умолчанию значение
 * менеджер прочитает как решение системы, а система в этом случае ничего не
 * знает. Вызывающий обязан в этом случае оставить выбор менеджера как есть.
 */
export function suggestedDocumentType(
  country: string | null | undefined,
): OrderDocumentType | null {
  if (!country) return null
  return country === LOCAL_DOCUMENT_COUNTRY ? 'local' : 'export'
}

/**
 * Справочник в виде списка для выпадающего меню — собирается ЗДЕСЬ, а не на
 * каждой странице, где страну выбирают.
 *
 * Сортировка по названию, а не по коду: список читают глазами, и «Австрия»
 * между «Австралией» и «Азербайджаном» ищется, а `AT` между `AS` и `AU` — нет.
 * Порядок зависит от языка, поэтому и сравнение локальное.
 */
export function countryOptions(locale: string): Array<{ value: string; label: string }> {
  return COUNTRY_CODES.map((code) => ({ value: code, label: countryLabel(code, locale) })).sort(
    (a, b) => a.label.localeCompare(b.label, locale),
  )
}
