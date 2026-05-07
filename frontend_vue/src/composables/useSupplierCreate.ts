import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { createSupplier } from '@/services/suppliersService'
import { useTranslatedField } from './useTranslatedData'
import type { SupplierCardData } from '@/types/supplier'

/** Empty-supplier factory — used as the starting state for the Create form. */
function emptyCard(): SupplierCardData {
  return {
    id: '',
    company: { ru: '', en: '', lt: '' },
    contactPerson: { ru: '', en: '', lt: '' },
    email: '',
    phone: '',
    status: 'new',
    categories: [],
    rating: 0,
    country: '',
    city: '',
    tags: [],
    notes: '',
    leadTime: 0,
    lastBccDate: null,
    hasDeficit: false,
    createdAt: '',
    updatedAt: '',
    statusReason: { ru: '', en: '', lt: '' },
    contractDate: '',
    vatCode: '',
    currency: 'EUR',
    paymentTerms: '30 Days Net',
    minOrder: null,
    bccEmails: [],
    addresses: [{ type: 'Legal', line1: '', city: '', country: '', zip: '' }],
    contacts: [],
    files: [],
    history: [],
    priceHistory: [],
    auditLog: [],
  }
}

export function useSupplierCreate() {
  const { locale } = useI18n()
  const { tf } = useTranslatedField()

  const supplier = ref<SupplierCardData>(emptyCard())
  const saving = ref(false)
  const error = ref<string | null>(null)

  function validate(): string | null {
    if (!tf(supplier.value.company).trim()) return 'company_required'
    if (!supplier.value.email.trim()) return 'email_required'
    return null
  }

  async function save(): Promise<SupplierCardData | null> {
    const validationError = validate()
    if (validationError) {
      error.value = validationError
      return null
    }
    saving.value = true
    error.value = null
    try {
      const created = await createSupplier(supplier.value, locale.value)
      return created
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create supplier'
      return null
    } finally {
      saving.value = false
    }
  }

  function reset() {
    supplier.value = emptyCard()
    error.value = null
  }

  return { supplier, saving, error, save, validate, reset, tf }
}
