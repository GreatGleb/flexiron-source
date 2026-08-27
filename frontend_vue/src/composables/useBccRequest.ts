import { ref, reactive, computed, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getBccCategories,
  getBccRecipients,
  getBccHistory,
  sendBccRequest,
  logBccRequest,
} from '@/services/bccService'
import { useTranslatedField } from './useTranslatedData'
import { useSettings } from './useSettings'
import { buildBccBody, buildBccSubject, formatBccDate } from '@/domain/bccEmail'
import type { BccSender } from '@/domain/bccEmail'
import type { BccCategory, BccRecipient, BccRequest, BccEmailTemplate } from '@/types/bcc'
import type { TranslatedString } from '@/types/i18n'
import { isMailConfigured } from '@/types/settings'

const EMPTY_TEXT: TranslatedString = { ru: '', en: '', lt: '' }

export function useBccRequest() {
  const { locale } = useI18n()
  const { tf } = useTranslatedField()
  const { settings, settled: settingsSettled } = useSettings()

  const categories = ref<BccCategory[]>([])
  const recipients = ref<BccRecipient[]>([])
  const history = ref<BccRequest[]>([])
  const selectedProductIds = ref<string[]>([])

  const template = reactive<BccEmailTemplate>({
    subject: { ...EMPTY_TEXT },
    body: { ...EMPTY_TEXT },
    attachments: [],
  })

  /**
   * Подписи позиций, которые попадут в письмо. Их знает страница (она держит
   * дерево категорий), поэтому она их сюда и кладёт — а собирает письмо один
   * `domain/bccEmail.ts`, а не оба места по своей копии шаблона.
   */
  const emailItems = ref<string[]>([])

  const sender = computed<BccSender>(() => ({
    companyName: settings.company.name,
    companyAddress: settings.company.legalAddress,
    managerName: [settings.profile.firstName, settings.profile.lastName].filter(Boolean).join(' '),
    managerPhone: settings.profile.phone,
    managerEmail: settings.profile.email,
  }))

  /**
   * Тема и тело пересобираются, как только приходят настройки или меняется
   * набор позиций: на первом тике настроек ещё нет, и письмо без этого
   * осталось бы без подписи и без названия компании навсегда.
   *
   * `watchEffect`, а не `watch(..., { deep: true })` — питфоллы #36/#37:
   * deep-watch снимает снимок реактивного прокси и на нём падает.
   */
  watchEffect(() => {
    template.subject = buildBccSubject(sender.value, formatBccDate(new Date().toISOString()))
    template.body = buildBccBody(sender.value, emailItems.value)
  })

  /**
   * Через какой ящик уйдёт письмо. Параметры почтового сервера живут в настройках
   * (спека 04.2 §6), и BCC-инструмент их только читает — своей копии у него нет.
   */
  const mailFrom = computed(() => {
    const { fromName, fromEmail } = settings.mail
    if (!fromEmail) return ''
    return fromName ? `${fromName} <${fromEmail}>` : fromEmail
  })

  /**
   * Можно ли вообще отправлять. Правило одно на проект — `isMailConfigured` в
   * `@/types/settings`; здесь оно не решает за сервер, а объясняет пользователю,
   * почему кнопка неактивна, до того как он нажмёт.
   */
  const mailReady = computed(() => isMailConfigured(settings.mail))

  /** Настройки уже пришли — до этого «не настроено» означает «ещё не спросили». */
  const mailSettled = settingsSettled

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
      const { requestId } = await sendBccRequest(
        {
          productIds: selectedProductIds.value,
          recipientIds: selectedRecipients,
          subject: tf(template.subject),
          body: tf(template.body),
          fileIds,
        },
        locale.value,
      )
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
    const sourceStr =
      typeof source === 'object' && source !== null ? tf(source as TranslatedString) : source
    const selectedRecipients = recipients.value.filter((r) => r.selected).map((r) => r.id)
    const { requestId } = await logBccRequest(
      {
        productIds: selectedProductIds.value,
        recipientIds: selectedRecipients,
        source: sourceStr,
      },
      locale.value,
    )
    return requestId
  }

  function resetForm() {
    selectedProductIds.value = []
    recipients.value = []
    emailItems.value = []
    template.attachments = []
  }

  return {
    categories,
    recipients,
    history,
    selectedProductIds,
    template,
    emailItems,
    loading,
    sending,
    error,
    recipientsLocked,
    mailFrom,
    mailReady,
    mailSettled,
    loadCategories,
    loadHistory,
    refreshRecipients,
    send,
    log,
    resetForm,
    tf,
  }
}
