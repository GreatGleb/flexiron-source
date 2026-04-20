import { ref, reactive, watch } from 'vue'
import {
  getBccCategories,
  getBccRecipients,
  getBccHistory,
  sendBccRequest,
} from '@/services/bccService'
import type { BccCategory, BccRecipient, BccRequest, BccEmailTemplate } from '@/types/bcc'

const DEFAULT_TEMPLATE: BccEmailTemplate = {
  subject: 'Price Request — InBox LT',
  body: 'Hello!\n\nPlease provide current prices for the following items:\n\n\nBest regards,\nInBox LT Team',
  attachments: [],
}

export function useBccRequest() {
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
        template: { ...template },
        fileIds,
      })
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
    resetForm,
  }
}
