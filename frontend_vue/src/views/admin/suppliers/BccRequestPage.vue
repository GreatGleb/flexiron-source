<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import EmailTemplate from '@/components/admin/ui/EmailTemplate.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { UploadedFile } from '@/services/uploadsService'
import FileItem from '@/components/admin/FileItem.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import type { BccEventStatus, BccRequest } from '@/types/bcc'
import { useBccRequest } from '@/composables/useBccRequest'
import { acceptBccResponse, markBccNoResponse, logBccRequest } from '@/services/bccService'
import { useToast } from '@/composables/useToast'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { getSupplier } from '@/services/suppliersService'

import '@styles/admin/components/_checkbox-list.css'
import '@styles/admin/bcc_request.css'

const { t } = useI18n()
const route = useRoute()
const { show: showToast } = useToast()
const showBccHistory = useFeatureFlag('bccHistory')

useHead({
  title: () => `Flexiron — ${t('bcc.header_title')}`,
  description: () => t('bcc.header_title'),
})

const {
  categories,
  recipients,
  history,
  selectedProductIds,
  template,
  sending,
  loading,
  loadCategories,
  loadHistory,
  refreshRecipients,
  send,
} = useBccRequest()

const selectedRecipientIds = ref<string[]>([])

const productOptions = computed(() =>
  categories.value.flatMap((cat) =>
    (cat.children ?? []).map((prod) => ({
      value: prod.id,
      label: prod.name,
      group: cat.name,
    })),
  ),
)

// "Active" = recipients actually chosen to receive the request (by mock auto-check or manual toggle or preselect).
// Mirrors the badge count under Recipients — both reflect who will actually get the email.
const activeSupplierCount = computed(() => selectedRecipientIds.value.length)
const selectedCount = computed(() => selectedRecipientIds.value.length)

// ─── Products table: search + category filter + pagination, grouped rows ───
const productSearch = ref('')
const productCategoryFilter = ref<string>('all')
const productPage = ref(1)
const productPageSize = ref(10)

const categoryFilterOptions = computed(() => [
  { value: 'all', label: t('bcc.all_categories', 'All categories') },
  ...categories.value.map((c) => ({ value: c.id, label: c.name })),
])

// Flat list after search + category filter (still carries group info)
const filteredProducts = computed(() => {
  const q = productSearch.value.trim().toLowerCase()
  const cat = productCategoryFilter.value
  const out: { id: string; name: string; categoryId: string; categoryName: string }[] = []
  for (const c of categories.value) {
    if (cat !== 'all' && c.id !== cat) continue
    for (const p of c.children ?? []) {
      if (q && !p.name.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) continue
      out.push({ id: p.id, name: p.name, categoryId: c.id, categoryName: c.name })
    }
  }
  return out
})

const productTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredProducts.value.length / productPageSize.value)),
)

watch([filteredProducts, productPageSize], () => {
  if (productPage.value > productTotalPages.value) productPage.value = productTotalPages.value
})

// Slice current page and split into { categoryName, products[] } groups — preserving filtered order
const pagedProductGroups = computed(() => {
  const start = (productPage.value - 1) * productPageSize.value
  const slice = filteredProducts.value.slice(start, start + productPageSize.value)
  const groups: { categoryName: string; products: typeof slice }[] = []
  for (const p of slice) {
    const last = groups[groups.length - 1]
    if (last && last.categoryName === p.categoryName) last.products.push(p)
    else groups.push({ categoryName: p.categoryName, products: [p] })
  }
  return groups
})

function toggleProduct(id: string) {
  const idx = selectedProductIds.value.indexOf(id)
  if (idx === -1) selectedProductIds.value = [...selectedProductIds.value, id]
  else selectedProductIds.value = selectedProductIds.value.filter((v) => v !== id)
}

function isProductSelected(id: string): boolean {
  return selectedProductIds.value.includes(id)
}

function allVisibleSelected(): boolean {
  return (
    filteredProducts.value.length > 0 &&
    filteredProducts.value.every((p) => isProductSelected(p.id))
  )
}

function toggleSelectAllVisible() {
  if (allVisibleSelected()) {
    const visible = new Set(filteredProducts.value.map((p) => p.id))
    selectedProductIds.value = selectedProductIds.value.filter((id) => !visible.has(id))
  } else {
    const merged = new Set(selectedProductIds.value)
    for (const p of filteredProducts.value) merged.add(p.id)
    selectedProductIds.value = [...merged]
  }
}

const PAGE_SIZE_OPTIONS_PRODUCTS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
]
const productPageSizeStr = computed({
  get: () => String(productPageSize.value),
  set: (v: string) => {
    productPageSize.value = Number(v)
    productPage.value = 1
  },
})

function productPageNumbers(): (number | '...')[] {
  const n = productTotalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const p = productPage.value
  if (p <= 3) return [1, 2, 3, 4, '...', n]
  if (p >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
  return [1, '...', p - 1, p, p + 1, '...', n]
}

const recipientSearch = ref('')
const recipientPage = ref(1)
const recipientPageSize = ref(5)

const filteredRecipients = computed(() => {
  const q = recipientSearch.value.trim().toLowerCase()
  if (!q) return recipients.value
  return recipients.value.filter(
    (r) => r.company.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
  )
})

// Selected suppliers float to the top — but the full list stays visible/pageable
const sortedRecipients = computed(() => {
  const selSet = new Set(selectedRecipientIds.value)
  return [...filteredRecipients.value].sort((a, b) => {
    const aSel = selSet.has(a.id) ? 1 : 0
    const bSel = selSet.has(b.id) ? 1 : 0
    if (aSel !== bSel) return bSel - aSel
    return a.company.localeCompare(b.company)
  })
})

const recipientTotalPages = computed(() =>
  Math.max(1, Math.ceil(sortedRecipients.value.length / recipientPageSize.value)),
)

watch([sortedRecipients, recipientPageSize], () => {
  if (recipientPage.value > recipientTotalPages.value)
    recipientPage.value = recipientTotalPages.value
})

const pagedRecipients = computed(() => {
  const start = (recipientPage.value - 1) * recipientPageSize.value
  return sortedRecipients.value.slice(start, start + recipientPageSize.value)
})

const PAGE_SIZE_OPTIONS_RECIPIENTS = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
]
const recipientPageSizeStr = computed({
  get: () => String(recipientPageSize.value),
  set: (v: string) => {
    recipientPageSize.value = Number(v)
    recipientPage.value = 1
  },
})

function recipientPageNumbers(): (number | '...')[] {
  const n = recipientTotalPages.value
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const p = recipientPage.value
  if (p <= 3) return [1, 2, 3, 4, '...', n]
  if (p >= n - 2) return [1, '...', n - 3, n - 2, n - 1, n]
  return [1, '...', p - 1, p, p + 1, '...', n]
}

function toggleRecipient(id: string) {
  const idx = selectedRecipientIds.value.indexOf(id)
  if (idx === -1) selectedRecipientIds.value = [...selectedRecipientIds.value, id]
  else selectedRecipientIds.value = selectedRecipientIds.value.filter((v) => v !== id)
}

function selectAllRecipients() {
  selectedRecipientIds.value = recipients.value.map((r) => r.id)
}
function deselectAllRecipients() {
  selectedRecipientIds.value = []
}

function nextRequestId(): string {
  // Find max existing req-NNN and increment
  let max = 0
  for (const evt of history.value) {
    const m = evt.requestId.match(/^req-(\d+)$/)
    if (m) {
      const n = Number(m[1])
      if (n > max) max = n
    }
  }
  return `req-${String(max + 1).padStart(3, '0')}`
}

async function sendRequest() {
  if (!validateSelection()) return
  if (!template.subject.trim()) {
    showToast(t('msg.enter_subject'), 'error')
    return
  }
  // Sync selected flag on recipients (used by composable.send → mock API)
  recipients.value.forEach((r) => {
    r.selected = selectedRecipientIds.value.includes(r.id)
  })
  try {
    await send()
    const rows = createEventRows('BCC Tool')
    history.value = [...rows, ...history.value]
    showToast(t('msg.bcc_sent'))

    // Reset products; keep preselected recipient (via email) checked for the next batch
    selectedProductIds.value = []
    if (preselectEmail.value) {
      const match = recipients.value.find((r) => r.email === preselectEmail.value)
      selectedRecipientIds.value = match ? [match.id] : []
    } else {
      selectedRecipientIds.value = []
    }
  } catch {
    showToast(t('msg.status_error'), 'error')
  }
}

function onAttachmentsUploaded(uploaded: UploadedFile[]) {
  for (const u of uploaded) {
    template.attachments.push({
      id: u.fileId,
      name: u.name,
      size: u.size,
      type: u.mime,
    })
  }
}

function removeAttachment(id: string) {
  const idx = template.attachments.findIndex((a) => a.id === id)
  if (idx !== -1) template.attachments.splice(idx, 1)
}

// Accept / Edit response modal
const modalOpen = ref(false)
const modalEventId = ref<string | null>(null)
const responseSupplier = ref('')
const responseProducts = ref<string[]>([])
const responsePrice = ref('')
const responseUnit = ref('kg')
const responseUnitOpen = ref(false)

const UNIT_OPTIONS = ['kg', 'm', 'piece', 'ton']

function selectUnit(u: string) {
  responseUnit.value = u
  responseUnitOpen.value = false
}

function onDocClickCloseUnit(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.('.input-with-suffix')
  if (!el) responseUnitOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClickCloseUnit))
onBeforeUnmount(() => document.removeEventListener('click', onDocClickCloseUnit))

function openResponseModal(evt: BccRequest) {
  modalEventId.value = evt.id
  responseSupplier.value = evt.supplierName
  responseProducts.value = [evt.productName]
  responsePrice.value = evt.price ? String(evt.price) : ''
  responseUnit.value = evt.unit ?? 'kg'
  modalOpen.value = true
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

async function savePrice() {
  if (!responsePrice.value || Number.isNaN(Number(responsePrice.value))) {
    showToast(t('msg.enter_price'), 'error')
    return
  }
  if (!modalEventId.value) return
  try {
    const evt = await acceptBccResponse(modalEventId.value, {
      price: Number(responsePrice.value),
      unit: responseUnit.value,
    })
    history.value.unshift(evt)
    modalOpen.value = false
    showToast(t('msg.price_saved'))
  } catch {
    showToast(t('msg.status_error'), 'error')
  }
}

async function markNoResponse(evt: BccRequest) {
  try {
    const newEvt = await markBccNoResponse(evt.id)
    history.value.unshift(newEvt)
  } catch {
    showToast(t('msg.status_error'), 'error')
  }
}

// ─── Log Request (split button): create history entries without sending an email ───
const SOURCE_OPTIONS = ['BCC Tool', 'Email', 'Phone', 'Messenger', 'Other'] as const
type LogSource = (typeof SOURCE_OPTIONS)[number]
const logSource = ref<LogSource>('Email')
const logDropdownOpen = ref(false)

function createEventRows(source: string): BccRequest[] {
  const requestId = nextRequestId()
  const today = todayIso()
  const rows: BccRequest[] = []
  for (const recipientId of selectedRecipientIds.value) {
    const r = recipients.value.find((x) => x.id === recipientId)
    if (!r) continue
    for (const productId of selectedProductIds.value) {
      const p = productOptions.value.find((po) => po.value === productId)
      rows.push({
        id: `evt-${Date.now()}-${recipientId}-${productId}`,
        requestId,
        date: today,
        supplierId: r.id,
        supplierName: r.company,
        productId,
        productName: p?.label ?? productId,
        source,
        status: 'sent',
      })
    }
  }
  return rows
}

function validateSelection(): boolean {
  if (selectedProductIds.value.length === 0) {
    showToast(t('msg.select_product'), 'error')
    return false
  }
  if (selectedRecipientIds.value.length === 0) {
    showToast(t('msg.select_recipient'), 'error')
    return false
  }
  return true
}

async function logRequest(source: string) {
  if (!validateSelection()) return
  try {
    await logBccRequest({
      productIds: selectedProductIds.value,
      recipientIds: selectedRecipientIds.value,
      source,
    })
    const rows = createEventRows(source)
    history.value = [...rows, ...history.value]
    showToast(t('msg.bcc_logged'))

    // Reset products; keep preselected recipient if any
    selectedProductIds.value = []
    if (preselectEmail.value) {
      const match = recipients.value.find((r) => r.email === preselectEmail.value)
      selectedRecipientIds.value = match ? [match.id] : []
    } else {
      selectedRecipientIds.value = []
    }
  } catch {
    showToast(t('msg.status_error'), 'error')
  }
}

function onLogClick() {
  logRequest(logSource.value)
  logDropdownOpen.value = false
}

function onLogSourcePick(s: LogSource) {
  logSource.value = s
  logDropdownOpen.value = false
  logRequest(s)
}

function onDocClickCloseLog(e: MouseEvent) {
  const el = (e.target as HTMLElement | null)?.closest?.('.log-split-btn')
  if (!el) logDropdownOpen.value = false
}
onMounted(() => document.addEventListener('click', onDocClickCloseLog))
onBeforeUnmount(() => document.removeEventListener('click', onDocClickCloseLog))

const STATUS_LABEL_KEY: Record<BccEventStatus, string> = {
  sent: 'bcc.status_sent',
  responded: 'bcc.status_responded',
  no_response: 'bcc.status_no_response',
}

const STATUS_PILL: Record<BccEventStatus, string> = {
  sent: 'pill-info',
  responded: 'pill-success',
  no_response: 'pill-default',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

function formatReqId(requestId: string): string {
  return requestId.replace('req-', '#')
}

// An event is "latest" for its (requestId, supplierId, productId) key if it appears
// first in the history array (we always unshift — first = most recent).
function isLatestEvent(evt: BccRequest): boolean {
  const key = `${evt.requestId}::${evt.supplierId}::${evt.productId}`
  const first = history.value.find((e) => `${e.requestId}::${e.supplierId}::${e.productId}` === key)
  return first?.id === evt.id
}

// Auto-rebuild the email body whenever the product selection changes — mirrors original updateEmailTemplate()
function rebuildEmailBody() {
  const items = selectedProductIds.value
    .map((id) => productOptions.value.find((p) => p.value === id)?.label)
    .filter((s): s is string => !!s)
    .map((name) => `  - ${name}`)
    .join('\n')
  const itemsSection = items || 'All categories'
  template.body = `Hello!\n\nPlease provide current prices for the following items:\n\n${itemsSection}\n\nBest regards,\nInBox LT Team`
}

watch(selectedProductIds, rebuildEmailBody, { deep: true })
watch(productOptions, rebuildEmailBody, { deep: true })

// Auto-sync selectedRecipientIds with recipient.selected flags whenever the list reloads
// (e.g. after products change). Any preselect set via preselectEmail is merged in.
const preselectEmail = ref<string | null>(null)

watch(recipients, (list) => {
  const ids = list.filter((r) => r.selected).map((r) => r.id)
  if (preselectEmail.value) {
    const match = list.find((r) => r.email === preselectEmail.value)
    if (match && !ids.includes(match.id)) ids.push(match.id)
  }
  selectedRecipientIds.value = ids
})

onMounted(async () => {
  await loadCategories()
  await loadHistory()
  // Load the full supplier list up front so the user can always browse everyone
  await refreshRecipients()

  const preselect = route.query.supplier
  if (typeof preselect === 'string') {
    try {
      const supplier = await getSupplier(preselect)
      preselectEmail.value = supplier.email
      const match = recipients.value.find((r) => r.email === supplier.email)
      if (match) {
        // Mark preselected supplier as selected (list stays full, just floats to the top)
        if (!selectedRecipientIds.value.includes(match.id)) {
          selectedRecipientIds.value = [...selectedRecipientIds.value, match.id]
        }
        showToast(t('bcc.preselected', { company: supplier.company }))
      }
    } catch {
      /* supplier not found — ignore */
    }
  }
})
</script>

<template>
  <h1 class="page-title" data-test="bcc-request-title">{{ t('bcc.header_title') }}</h1>

  <div class="flex-end" style="--mb: 32px">
    <div class="action-bar no-margin pos-static flex-group" data-test="bcc-request-action-bar">
      <!-- Log Request (split button) — logs history without sending an email -->
      <div class="log-split-btn" data-test="bcc-request-log-split-btn">
        <button
          class="btn btn-secondary log-main"
          type="button"
          data-test="bcc-request-log-btn"
          @click="onLogClick"
        >
          <SvgIcon name="plus-add" :width="16" :height="16" />
          <span>{{ t('btn.log_request', 'Log') }}: {{ logSource }}</span>
        </button>
        <button
          class="btn btn-secondary log-caret"
          type="button"
          data-test="bcc-request-log-caret-btn"
          @click.stop="logDropdownOpen = !logDropdownOpen"
        >
          <SvgIcon name="chevron-down" :width="12" :height="12" />
        </button>
        <div v-if="logDropdownOpen" class="log-dropdown" data-test="bcc-request-log-dropdown">
          <div
            v-for="s in SOURCE_OPTIONS"
            :key="s"
            class="log-dropdown-item"
            data-test="bcc-request-log-dropdown-item"
            :data-source="s"
            @click="onLogSourcePick(s)"
          >
            {{ s }}
          </div>
        </div>
      </div>

      <button
        class="btn btn-primary"
        :disabled="sending"
        data-test="bcc-request-send-btn"
        @click="sendRequest"
      >
        <SvgIcon name="email" :width="18" :height="18" />
        <span>{{ t('btn.send_request') }}</span>
      </button>
    </div>
  </div>

  <div class="bcc-request-content" data-test="bcc-request-content">
    <div class="bcc-grid">
      <div class="col-left">
        <div data-test="bcc-request-categories-panel">
          <GlassPanel
            :title="t('bcc.categories')"
            :badge="`${selectedProductIds.length} ${t('bcc.badge_selected')}`"
            :loading="loading && categories.length === 0"
            :skeleton-rows="6"
          >
            <div
              class="products-filters"
              style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap"
              data-test="bcc-request-products-filters"
            >
              <div style="flex: 1 1 180px" data-test="bcc-request-products-search">
                <SearchInput
                  v-model="productSearch"
                  :placeholder="t('bcc.search_products', 'Search products...')"
                />
              </div>
              <div style="min-width: 160px" data-test="bcc-request-products-filter">
                <CustomSelect v-model="productCategoryFilter" :options="categoryFilterOptions" />
              </div>
            </div>

            <div class="data-table-wrapper">
              <table class="data-table products-table" data-test="bcc-request-products-table">
                <thead>
                  <tr>
                    <th style="width: 32px">
                      <input
                        type="checkbox"
                        data-test="bcc-request-products-select-all"
                        :checked="allVisibleSelected()"
                        @change="toggleSelectAllVisible"
                      />
                    </th>
                    <th>{{ t('bcc.categories_label') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-if="filteredProducts.length === 0">
                    <tr>
                      <td colspan="2" style="text-align: center; opacity: 0.5; padding: 24px 0">
                        {{ t('suppliers.empty_title') }}
                      </td>
                    </tr>
                  </template>
                  <template v-for="group in pagedProductGroups" :key="group.categoryName">
                    <tr
                      class="product-group-header"
                      data-test="bcc-request-product-group"
                      :data-category-name="group.categoryName"
                    >
                      <td
                        colspan="2"
                        style="
                          font-weight: 700;
                          font-size: 11px;
                          text-transform: uppercase;
                          letter-spacing: 0.05em;
                          opacity: 0.5;
                          padding-top: 12px;
                        "
                      >
                        {{ group.categoryName }}
                      </td>
                    </tr>
                    <tr
                      v-for="p in group.products"
                      :key="p.id"
                      :data-product="p.id"
                      :data-product-id="p.id"
                      data-test="bcc-request-product-row"
                      class="product-row"
                      @click="toggleProduct(p.id)"
                    >
                      <td>
                        <input
                          type="checkbox"
                          data-test="bcc-request-product-checkbox"
                          :checked="isProductSelected(p.id)"
                          tabindex="-1"
                          @click.stop
                          @change.stop="toggleProduct(p.id)"
                        />
                      </td>
                      <td>{{ p.name }}</td>
                    </tr>
                  </template>
                </tbody>
                <tfoot v-if="filteredProducts.length > 0">
                  <tr>
                    <td colspan="2">
                      <div class="pagination-bar">
                        <div class="page-size">
                          <span>{{ t('suppliers.page_size') }}</span>
                          <CustomSelect
                            v-model="productPageSizeStr"
                            :options="PAGE_SIZE_OPTIONS_PRODUCTS"
                            :open-up="true"
                            class="custom-select-sm"
                          />
                        </div>
                        <div class="pagination-nav">
                          <button
                            class="btn btn-icon btn-sm"
                            :disabled="productPage <= 1"
                            @click="productPage = Math.max(1, productPage - 1)"
                          >
                            <SvgIcon
                              name="chevron-right"
                              :width="14"
                              :height="14"
                              style="transform: rotate(180deg)"
                            />
                          </button>
                          <div class="pagination-pages">
                            <template v-for="(p, i) in productPageNumbers()" :key="i">
                              <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                              <button
                                v-else
                                class="page-btn"
                                :class="{ active: p === productPage }"
                                @click="productPage = p as number"
                              >
                                {{ p }}
                              </button>
                            </template>
                          </div>
                          <button
                            class="btn btn-icon btn-sm"
                            :disabled="productPage >= productTotalPages"
                            @click="productPage = Math.min(productTotalPages, productPage + 1)"
                          >
                            <SvgIcon name="chevron-right" :width="14" :height="14" />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div
              class="supplier-count-display"
              style="margin-top: 12px"
              data-test="bcc-request-products-count"
            >
              <SvgIcon name="grid-products" :width="14" :height="14" />
              <span class="count-text">
                {{ selectedProductIds.length }} {{ t('bcc.selected_products') }}
              </span>
            </div>
          </GlassPanel>
        </div>

        <div data-test="bcc-request-recipients-panel">
          <GlassPanel
            :title="t('bcc.recipients')"
            :badge="`${selectedCount} ${t('bcc.badge_selected')}`"
            :loading="loading && recipients.length === 0"
            :skeleton-rows="4"
          >
            <div class="checkbox-list searchable">
              <div class="checkbox-list-controls">
                <button
                  type="button"
                  class="text-btn select-all-btn"
                  data-test="bcc-request-recipients-select-all"
                  @click="selectAllRecipients"
                >
                  {{ t('btn.select_all') }}
                </button>
                <button
                  type="button"
                  class="text-btn deselect-all-btn"
                  data-test="bcc-request-recipients-deselect-all"
                  @click="deselectAllRecipients"
                >
                  {{ t('btn.deselect_all') }}
                </button>
                <span class="selected-count" data-test="bcc-request-recipients-count">
                  <span class="count">{{ selectedCount }}</span>
                  {{ t('bcc.selected_text') }}
                </span>
              </div>
              <div data-test="bcc-request-recipients-search">
                <SearchInput v-model="recipientSearch" :placeholder="t('bcc.search_suppliers')" />
              </div>
              <div class="checkbox-list-items" data-test="bcc-request-recipients-list">
                <label
                  v-for="r in pagedRecipients"
                  :key="r.id"
                  class="checkbox-item"
                  data-test="bcc-request-recipient-item"
                  :data-recipient-id="r.id"
                >
                  <input
                    type="checkbox"
                    data-test="bcc-request-recipient-checkbox"
                    :checked="selectedRecipientIds.includes(r.id)"
                    @change="toggleRecipient(r.id)"
                  />
                  <span class="checkbox-label">{{ r.company }}</span>
                  <span class="checkbox-email">{{ r.email }}</span>
                </label>
                <div
                  v-if="filteredRecipients.length === 0"
                  style="text-align: center; opacity: 0.5; padding: 16px 0"
                >
                  {{ t('suppliers.empty_title') }}
                </div>
              </div>
              <div v-if="filteredRecipients.length > 0" class="recipients-pagination">
                <div class="pagination-bar">
                  <div class="page-size">
                    <span>{{ t('suppliers.page_size') }}</span>
                    <CustomSelect
                      v-model="recipientPageSizeStr"
                      :options="PAGE_SIZE_OPTIONS_RECIPIENTS"
                      :open-up="true"
                      class="custom-select-sm"
                    />
                  </div>
                  <div class="pagination-nav">
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="recipientPage <= 1"
                      @click="recipientPage = Math.max(1, recipientPage - 1)"
                    >
                      <SvgIcon
                        name="chevron-right"
                        :width="14"
                        :height="14"
                        style="transform: rotate(180deg)"
                      />
                    </button>
                    <div class="pagination-pages">
                      <template v-for="(p, i) in recipientPageNumbers()" :key="i">
                        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                        <button
                          v-else
                          class="page-btn"
                          :class="{ active: p === recipientPage }"
                          @click="recipientPage = p as number"
                        >
                          {{ p }}
                        </button>
                      </template>
                    </div>
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="recipientPage >= recipientTotalPages"
                      @click="recipientPage = Math.min(recipientTotalPages, recipientPage + 1)"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div
              class="supplier-count-display"
              style="margin-top: 12px"
              data-test="bcc-request-recipients-active-count"
            >
              <SvgIcon name="warehouse-box" :width="14" :height="14" />
              <span class="count-text">
                {{ activeSupplierCount }} {{ t('bcc.active_suppliers') }}
              </span>
            </div>
          </GlassPanel>
        </div>
      </div>

      <div class="col-center" data-test="bcc-request-template-panel">
        <GlassPanel :title="t('bcc.email_template')" :loading="loading" :skeleton-rows="5">
          <EmailTemplate
            :subject="template.subject"
            :body="template.body"
            :subject-label="t('bcc.subject_label')"
            :body-label="t('bcc.body_label')"
            :subject-placeholder="t('bcc.subject_placeholder')"
            :body-placeholder="t('bcc.body_placeholder')"
            @update:subject="template.subject = $event"
            @update:body="template.body = $event"
          >
            <div class="email-attachments" data-test="bcc-request-attachments">
              <label class="field-label">{{ t('bcc.attachments') }}</label>
              <div
                v-if="template.attachments.length"
                class="file-list"
                style="margin-bottom: 12px"
                data-test="bcc-request-attachments-list"
              >
                <div
                  v-for="a in template.attachments"
                  :key="a.id"
                  data-test="bcc-request-attachment-item"
                  :data-attachment-id="a.id"
                >
                  <FileItem :name="a.name" download-url="#" @delete="removeAttachment(a.id)" />
                </div>
              </div>
              <div data-test="bcc-request-dropzone">
                <DropZone
                  :hint="t('bcc.dropzone_hint')"
                  :multiple="true"
                  @uploaded="onAttachmentsUploaded"
                />
              </div>
            </div>
          </EmailTemplate>
        </GlassPanel>
      </div>

      <div v-if="showBccHistory" class="col-right" data-test="bcc-request-history-panel">
        <GlassPanel
          :title="t('bcc.history')"
          :loading="loading && history.length === 0"
          :skeleton-rows="5"
        >
          <div class="request-history-table">
            <table class="data-table" data-test="bcc-request-history-table">
              <thead>
                <tr>
                  <th>{{ t('th.date') }}</th>
                  <th>{{ t('th.request_id') }}</th>
                  <th>{{ t('th.product') }}</th>
                  <th>{{ t('th.supplier') }}</th>
                  <th>{{ t('th.source') }}</th>
                  <th>{{ t('th.status') }}</th>
                  <th>{{ t('th.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="evt in history"
                  :key="evt.id"
                  data-test="bcc-request-history-row"
                  :data-event-id="evt.id"
                  :data-request-id="evt.requestId"
                  :data-status="evt.status"
                >
                  <td class="date-cell">{{ formatDate(evt.date) }}</td>
                  <td class="request-id-cell">
                    <span class="request-id-badge">{{ formatReqId(evt.requestId) }}</span>
                  </td>
                  <td class="product-cell">{{ evt.productName }}</td>
                  <td class="recipients-cell">{{ evt.supplierName }}</td>
                  <td class="source-cell">{{ evt.source }}</td>
                  <td class="status-cell">
                    <span :class="['status-pill', STATUS_PILL[evt.status]]">
                      {{ t(STATUS_LABEL_KEY[evt.status]) }}
                    </span>
                    <span
                      v-if="evt.status === 'responded' && evt.price"
                      class="response-price"
                      style="margin-left: 6px; font-size: 11px; opacity: 0.7"
                    >
                      {{ evt.price }} {{ evt.unit }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <div
                      style="
                        display: flex;
                        gap: 10px;
                        justify-content: flex-end;
                        align-items: center;
                      "
                    >
                      <template v-if="isLatestEvent(evt)">
                        <template v-if="evt.status === 'sent'">
                          <button
                            v-tooltip="t('bcc.record_response')"
                            type="button"
                            class="action-icon-btn action-success"
                            data-test="bcc-request-history-accept-btn"
                            @click="openResponseModal(evt)"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <button
                            v-tooltip="t('bcc.cancel_request')"
                            type="button"
                            class="action-icon-btn action-danger"
                            data-test="bcc-request-history-cancel-btn"
                            @click="markNoResponse(evt)"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="15" y1="9" x2="9" y2="15" />
                              <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                          </button>
                        </template>
                        <template v-if="evt.status === 'no_response'">
                          <button
                            v-tooltip="t('bcc.record_response')"
                            type="button"
                            class="action-icon-btn action-success"
                            data-test="bcc-request-history-accept-btn"
                            @click="openResponseModal(evt)"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                        </template>
                        <template v-if="evt.status === 'responded'">
                          <button
                            v-tooltip="t('bcc.edit_response')"
                            type="button"
                            class="action-icon-btn action-edit"
                            data-test="bcc-request-history-edit-btn"
                            @click="openResponseModal(evt)"
                          >
                            <SvgIcon name="edit-pencil" :width="14" :height="14" />
                          </button>
                        </template>
                      </template>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>
    </div>
  </div>

  <AppModal v-model="modalOpen" :title="t('bcc.accept_response')" size="small">
    <div class="modal-form" data-test="bcc-request-response-modal">
      <div class="input-group">
        <label class="field-label">{{ t('bcc.supplier') }}</label>
        <input
          type="text"
          class="glass-input"
          data-test="bcc-request-response-supplier"
          :value="responseSupplier"
          readonly
        />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('bcc.items_requested') }}</label>
        <div class="requested-items-list" data-test="bcc-request-response-items">
          <div
            v-for="item in responseProducts"
            :key="item"
            class="tag tag-sm"
            data-test="bcc-request-response-item"
            style="margin-right: 4px"
          >
            {{ item }}
          </div>
          <span v-if="responseProducts.length === 0" style="opacity: 0.5">—</span>
        </div>
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('bcc.price') }}</label>
        <div class="input-with-suffix custom-select-wrap">
          <input
            v-model="responsePrice"
            type="number"
            class="glass-input"
            data-test="bcc-request-response-price"
            placeholder="0.00"
          />
          <div
            class="input-suffix custom-select-trigger"
            data-test="bcc-request-response-unit-trigger"
            @click.stop="responseUnitOpen = !responseUnitOpen"
          >
            <span class="curr-val">{{ responseUnit }}</span>
          </div>
          <div class="custom-select-list" :class="{ open: responseUnitOpen }">
            <div
              v-for="u in UNIT_OPTIONS"
              :key="u"
              class="custom-select-option"
              data-test="bcc-request-response-unit-option"
              :data-unit="u"
              @click="selectUnit(u)"
            >
              {{ u }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="bcc-request-response-cancel-btn"
        @click="modalOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        data-test="bcc-request-response-save-btn"
        @click="savePrice"
      >
        {{ t('bcc.save_price') }}
      </button>
    </template>
  </AppModal>
</template>

<style>
/* Log Request split button */
.log-split-btn {
  position: relative;
  display: inline-flex;
  align-items: stretch;
}
.log-split-btn .log-main {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
}
.log-split-btn .log-caret {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  padding: 0 8px;
}
.log-split-btn .log-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 160px;
  background: rgba(30, 34, 40, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  z-index: 100;
  padding: 4px;
}
.log-split-btn .log-dropdown-item {
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}
.log-split-btn .log-dropdown-item:hover {
  background: rgba(24, 144, 255, 0.2);
  color: #fff;
}

/* Compact products table in the left column — narrow panel, no horizontal scroll */
.products-table {
  font-size: 13px;
}
.products-table thead th {
  padding: 6px 8px;
  font-size: 10px;
}
.products-table tbody td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.products-table tbody tr.product-group-header td {
  padding: 10px 8px 4px !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.products-table tbody tr.product-row {
  cursor: pointer;
  transition: background 0.15s;
}
.products-table tbody tr.product-row:hover {
  background: rgba(255, 255, 255, 0.04);
}
.products-table input[type='checkbox'] {
  width: 14px;
  height: 14px;
  accent-color: var(--primary);
  cursor: pointer;
}
.products-table tfoot td {
  padding: 10px 0 0;
  position: relative;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
.products-table tfoot .pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  row-gap: 10px;
}
.products-table tfoot .page-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}
.products-table tfoot .pagination-nav {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}
.products-table tfoot .pagination-pages {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}
.products-table tfoot .page-btn {
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}
.products-table tfoot .page-btn:hover {
  background: rgba(24, 144, 255, 0.2);
  border-color: var(--primary);
}
.products-table tfoot .page-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.products-table tfoot .btn-sm {
  width: 24px;
  height: 24px;
  padding: 0;
}
.products-table tfoot .pagination-ellipsis {
  padding: 0 4px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}
.products-table tfoot .custom-select-sm .custom-select-trigger {
  min-height: 26px;
  padding: 2px 24px 2px 8px;
  font-size: 11px;
}

/* Recipients pagination — same compact style */
.recipients-pagination {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}
.recipients-pagination .pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  row-gap: 10px;
}
.recipients-pagination .page-size {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}
.recipients-pagination .pagination-nav,
.recipients-pagination .pagination-pages {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
}
.recipients-pagination .page-btn {
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}
.recipients-pagination .page-btn:hover {
  background: rgba(24, 144, 255, 0.2);
  border-color: var(--primary);
}
.recipients-pagination .page-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.recipients-pagination .btn-sm {
  width: 24px;
  height: 24px;
  padding: 0;
}
.recipients-pagination .pagination-ellipsis {
  padding: 0 4px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}
.recipients-pagination .custom-select-sm .custom-select-trigger {
  min-height: 26px;
  padding: 2px 24px 2px 8px;
  font-size: 11px;
}
.products-table + .supplier-count-display {
  margin-top: 8px;
}

/* Pagination dropdown opens upward (table sits near the bottom of its panel) */
.col-left .custom-select-list.open-up {
  top: auto;
  bottom: calc(100% + 4px);
  transform: translateY(10px);
}
.col-left .custom-select-list.open-up.open {
  transform: translateY(0);
}

/* Let the left panel grow above neighbours when dropdowns are open inside */
.col-left .glass-panel:has(.custom-select-list.open),
.col-left .glass-panel:has(.multi-select-list.open) {
  z-index: 100;
}

/* Don't clip upward dropdowns in the table wrapper */
.products-table-wrapper,
.col-left .data-table-wrapper {
  overflow-x: auto;
  overflow-y: visible;
}
</style>
