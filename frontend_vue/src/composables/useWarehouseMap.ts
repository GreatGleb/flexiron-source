import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getWarehouseMap, saveWarehouseMap, deleteWarehouseMap } from '@/services/settingsService'
import { useToast } from '@/composables/useToast'
import type { UploadedFile } from '@/services/uploadsService'
import type { WarehouseMapFile } from '@/types/settings'

/**
 * Карта склада — одна картинка, которую смотрят глазами.
 *
 * Все три действия немедленные (quick-action), а не clean-slate: здесь нечего
 * редактировать и нечего копить до кнопки «Сохранить» — файл либо загружен, либо нет.
 * Замена и удаление подтверждаются в интерфейсе, потому что прежняя карта пропадает
 * безвозвратно: истории версий у нас нет.
 */
export function useWarehouseMap() {
  const { t } = useI18n()
  const toast = useToast()

  const map = ref<WarehouseMapFile | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      map.value = await getWarehouseMap()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load warehouse map'
    } finally {
      loading.value = false
    }
  }

  /**
   * Принимает то, что вернул `POST /api/uploads`, и делает это текущей картой.
   *
   * Тип проверяется здесь, а не только атрибутом `accept`: `accept` фильтрует диалог
   * выбора файла и ничего не значит для перетаскивания — в дропзону можно бросить PDF.
   * Сервер проверяет то же самое ещё раз, потому что клиенту верить нельзя.
   */
  async function replaceWith(file: UploadedFile): Promise<boolean> {
    if (!file.mime.startsWith('image/')) {
      toast.error(t('warehouse.map_toast_not_image'))
      return false
    }
    saving.value = true
    try {
      map.value = await saveWarehouseMap({
        fileId: file.fileId,
        name: file.name,
        mime: file.mime,
        size: file.size,
        url: file.url,
        uploadedAt: file.uploadedAt,
      })
      toast.success(t('warehouse.map_toast_saved'))
      return true
    } catch {
      toast.error(t('warehouse.map_toast_error_save'))
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(): Promise<boolean> {
    saving.value = true
    try {
      await deleteWarehouseMap()
      map.value = null
      toast.success(t('warehouse.map_toast_deleted'))
      return true
    } catch {
      toast.error(t('warehouse.map_toast_error_delete'))
      return false
    } finally {
      saving.value = false
    }
  }

  return { map, loading, saving, error, load, replaceWith, remove }
}
