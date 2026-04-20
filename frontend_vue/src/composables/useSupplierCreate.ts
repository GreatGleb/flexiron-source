import { ref } from 'vue'
import { createSupplier } from '@/services/suppliersService'
import type { SupplierCardData } from '@/types/supplier'

/** Empty-supplier factory — used as the starting state for the Create form. */
function emptyCard(): SupplierCardData {
  return {
    id: '',
    company: '',
    contactPerson: '',
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
    statusReason: '',
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
  const supplier = ref<SupplierCardData>(emptyCard())
  const saving = ref(false)
  const error = ref<string | null>(null)

  function validate(): string | null {
    if (!supplier.value.company.trim()) return 'company_required'
    if (!supplier.value.email.trim()) return 'email_required'
    return null
  }

  /** POST /api/suppliers — returns the newly created card (with server-assigned id). */
  async function save(): Promise<SupplierCardData | null> {
    const validationError = validate()
    if (validationError) {
      error.value = validationError
      return null
    }
    saving.value = true
    error.value = null
    try {
      const created = await createSupplier(supplier.value)
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

  return { supplier, saving, error, save, validate, reset }
}
