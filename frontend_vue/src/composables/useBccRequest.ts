import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getBccCategories,
  getBccRecipients,
  getBccHistory,
  sendBccRequest,
  logBccRequest,
} from '@/services/bccService'
import { useTranslatedField } from './useTranslatedData'
import type { BccCategory, BccRecipient, BccRequest, BccEmailTemplate } from '@/types/bcc'
import type { TranslatedString } from '@/types/i18n'

const DEFAULT_TEMPLATE: BccEmailTemplate = {
  subject: { ru: 'Запрос цен — InBox LT', en: 'Price Request — InBox LT', lt: 'Kainų užklausa — InBox LT' },
  body: {
    ru: 'Здравствуйте!\n\nПожалуйста, предоставьте текущие цены на следующие позиции:\n\n\nС уважением,\nКоманда InBox LT',
    en: 'Hello!\n\nPlease provide current prices for the following items:\n\n\nBest regards,\nInBox LT Team',
    lt: 'Sveiki!\n\nPrašome pateikti dabartines kainas šioms prekėms:\n\n\nPagarbiai,\nInBox LT komanda',
  },
  attachments: [],
}

export function useBccRequest() {
  const { locale } = useI18n()
  const { tf } = useTranslatedField()

  const categories = ref<BccCategory[]>([])
  const recipients = ref<BccRecipient[]>([])
  const history = ref<BccRequest[]>([])
  const selectedProductIds = ref<string[]>([])

  const template = reactive<BccEmailTemplate>({ ...DEFAULT_TEMPLATE, attachments: [] })

  const loading = ref(false)
  const sending = ref(false)
  const error = ref<string | null>(null)

  // When true, recipients are managed externally (e.g. preselected single supplier
  // from ?supplier= query) and the watcher below must not overwrite them.
  const recipientsLocked = ref(false)

  async function loadCategories() {
    loading.value = true
    error.value = null
    try {
      categories.value = await getBccCategories()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load categories'
    } finally {
      loading.value = false
    }
  }

  async function loadHistory() {
    try {
      const res = await getBccHistory({ page: 1, pageSize: 25 })
      history.value = res.items
    } catch {
      // history is optional — silent fail
    }
  }

  async function refreshRecipients() {
    if (recipientsLocked.value) return
    try {
      // Always ask the backend — even with no products selected, return ALL suppliers
      // so the user can browse/pick recipients manually.
      recipients.value = await getBccRecipients(selectedProductIds.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load recipients'
    }
  }

  watch(selectedProductIds, refreshRecipients, { deep: true })

  async function send(): Promise<string> {
    sending.value = true
    error.value = null
    try {
      const selectedRecipients = recipients.value.filter((r) => r.selected).map((r) => r.id)
      const fileIds = template.attachments.map((a) => a.id)
      const { requestId } = await sendBccRequest({
        productIds: selectedProductIds.value,
        recipientIds: selectedRecipients,
        subject: tf(template.subject),
        body: tf(template.body),
        fileIds,
      }, locale.value)
      // NOTE: history reloading is intentionally skipped — callers manage history locally
      // (event-sourcing new rows per product × recipient) and a reload would wipe those events.
      return requestId
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to send BCC request'
      throw e
    } finally {
      sending.value = false
    }
  }

  async function log(source: string): Promise<string> {
    // If source is a TranslatedString object (e.g. from a dropdown selection),
    // extract the current locale's value to avoid "[object Object]" in the log
    const sourceStr = typeof source === 'object' && source !== null
      ? tf(source as TranslatedString)
      : source
    const selectedRecipients = recipients.value.filter((r) => r.selected).map((r) => r.id)
    const { requestId } = await logBccRequest({
      productIds: selectedProductIds.value,
      recipientIds: selectedRecipients,
      source: sourceStr,
    }, locale.value)
    return requestId
  }

  function resetForm() {
    selectedProductIds.value = []
    recipients.value = []
    Object.assign(template, { ...DEFAULT_TEMPLATE, attachments: [] })
  }

  return {
    categories,
    recipients,
    history,
    selectedProductIds,
    template,
    loading,
    sending,
    error,
    recipientsLocked,
    loadCategories,
    loadHistory,
    refreshRecipients,
    send,
    log,
    resetForm,
    tf,
  }
}
