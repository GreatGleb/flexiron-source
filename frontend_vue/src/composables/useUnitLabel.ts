import { useI18n } from 'vue-i18n'
import { useSettings } from '@/composables/useSettings'
import { unitLabel } from '@/domain/uom'

/**
 * Подпись единицы в текущем языке — обёртка над `unitLabel` из домена, которая
 * приносит справочник и локаль. Возвращается функция, а не computed: единиц на
 * странице заказа много и все разные.
 *
 * Справочник тянет `AdminSidebar` на каждой админской странице, отдельного
 * `load()` здесь нет намеренно — второй вызов означал бы второй запрос за теми
 * же восемью разделами.
 */
export function useUnitLabel() {
  const { locale } = useI18n()
  const { settings } = useSettings()
  return (unit: string | null | undefined): string => unitLabel(unit, settings.uoms, locale.value)
}
