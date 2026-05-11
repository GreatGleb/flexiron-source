import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getService, patchService } from '@/services/servicesService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { Service, ServicePriceUnit } from '@/types/service'
import type { TranslatedString } from '@/types/i18n'

export function useServiceCard(id: string) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const service = ref<Service | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<{
    name: TranslatedString | null
    costPrice: number
    sellingPrice: number
    priceUnit: ServicePriceUnit
    description: TranslatedString | null
  }>({
    name: null,
    costPrice: 0,
    sellingPrice: 0,
    priceUnit: 'EUR/vnt',
    description: null,
  })

  const dirty = useDirtyCheck(form)

  const isAnythingDirty = computed(() => dirty.isDirty.value)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getService(id)
      service.value = data
      form.value = {
        name: data.name,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        priceUnit: data.priceUnit,
        description: data.description ?? null,
      }
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load service'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!service.value) return
    saving.value = true
    try {
      const updated = await patchService(
        id,
        {
          name: form.value.name ?? undefined,
          costPrice: form.value.costPrice,
          sellingPrice: form.value.sellingPrice,
          priceUnit: form.value.priceUnit,
          description: form.value.description ?? undefined,
        } as Parameters<typeof patchService>[1],
        locale.value,
      )
      service.value = updated
      form.value = {
        name: updated.name,
        costPrice: updated.costPrice,
        sellingPrice: updated.sellingPrice,
        priceUnit: updated.priceUnit,
        description: updated.description ?? null,
      }
      dirty.capture()
      toast.success(t('services.toast_saved'))
    } catch {
      toast.error(t('services.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!service.value) return
    form.value = {
      name: service.value.name,
      costPrice: service.value.costPrice,
      sellingPrice: service.value.sellingPrice,
      priceUnit: service.value.priceUnit,
      description: service.value.description ?? null,
    }
    dirty.capture()
  }

  return {
    service,
    loading,
    saving,
    error,
    form,
    isAnythingDirty,
    load,
    save,
    discard,
    tf,
  }
}
