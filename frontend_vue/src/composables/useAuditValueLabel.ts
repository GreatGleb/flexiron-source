import { useI18n } from 'vue-i18n'

/**
 * Known enum-like codes that may appear in audit oldValue/newValue.
 * Each entry maps a code prefix to the set of known values for that prefix.
 * The function tries each prefix; if the value is found in the set, it
 * returns the translated label via t(`warehouse.${prefix}${value}`).
 * If no prefix matches, the raw value is returned unchanged.
 */
const AUDIT_ENUM_MAP: Record<string, string[]> = {
  deficit_status_: ['open', 'in_progress', 'ordered', 'resolved', 'cancelled'],
  deficit_priority_: ['low', 'medium', 'high', 'critical'],
  offcut_status_: [
    'available',
    'reserved',
    'in_production',
    'sold',
    'scrapped',
    'expensed',
    'returned_to_supplier',
    'in_storage',
  ],
  movement_type_: ['receipt', 'expense', 'transfer', 'write_off', 'return', 'inbound', 'outbound'],
  batch_status_: [
    'active',
    'completed',
    'expired',
    'archived',
    'partial',
    'available',
    'reserved',
    'depleted',
    'quarantine',
  ],
  status_: [
    'available',
    'reserved',
    'partial',
    'depleted',
    'quarantine',
    'used',
    'scrap',
    'open',
    'in_progress',
    'ordered',
    'resolved',
    'cancelled',
  ],
}

/**
 * Подпись значения из audit-лога склада — тот же `translateAuditValue`, что раньше
 * лежал дословной копией в пяти карточках склада (batch/stock/movement/deficit/offcut).
 * Возвращается функция, а не computed: значений в ленте аудита много и все разные.
 */
export function useAuditValueLabel() {
  const { t } = useI18n()
  return (value: string): string => {
    for (const [prefix, codes] of Object.entries(AUDIT_ENUM_MAP)) {
      if (codes.includes(value)) {
        const translated = t(`warehouse.${prefix}${value}`)
        if (translated && translated !== `warehouse.${prefix}${value}`) {
          return translated
        }
      }
    }
    return value
  }
}
