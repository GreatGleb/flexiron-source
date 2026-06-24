<script setup lang="ts">
import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@/composables/useHead'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import { useSettings } from '@/composables/useSettings'
import { useToast } from '@/composables/useToast'
import type { UomCategory, UomConversion } from '@/types/settings'
import type { TranslatedString } from '@/types/i18n'

import '@styles/admin/components/_entity-card-layout.css'

import '@styles/admin/warehouse_list.css'

const { t, locale } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const VALID_TABS = ['profile', 'company', 'finance', 'units', 'order-statuses'] as const

useHead({
  title: () => `Flexiron — ${t('settings.title')}`,
  description: () => t('settings.title'),
})

const {
  settings,
  loading,
  saving,
  error,
  isDirty,
  load,
  save,
  discard,
  updateCompany,
  updateConstants,
  addCurrency,
  removeCurrency,
  updateCurrency,
  addUom,
  removeUom,
  addConversion,
  removeConversion,
  updateConversion,
  addOrderStatus,
  removeOrderStatus,
  updateOrderStatus,
  moveOrderStatus,
  updateProfile,
} = useSettings()

const SETTINGS_TABS: { key: string; path: string; labelKey: string; icon: string }[] = [
  {
    key: 'profile',
    path: '/admin/settings/profile',
    labelKey: 'settingsTabs.profile',
    icon: 'staff-user',
  },
  {
    key: 'company',
    path: '/admin/settings/company',
    labelKey: 'settingsTabs.company',
    icon: 'building',
  },
  {
    key: 'finance',
    path: '/admin/settings/finance',
    labelKey: 'settingsTabs.finance',
    icon: 'profit-coin',
  },
  { key: 'units', path: '/admin/settings/units', labelKey: 'settingsTabs.uom', icon: 'ruler' },
  {
    key: 'order-statuses',
    path: '/admin/settings/order-statuses',
    labelKey: 'settingsTabs.statuses',
    icon: 'list-status',
  },
]

const activeTab = computed(() => {
  const match = route.path.match(/\/admin\/settings\/(.+)/)
  return match?.[1] ?? 'profile'
})

function onTabClick(tabPath: string) {
  router.push(tabPath)
}

// ─── Provide settings + helpers to child routes ──────────────────────────────
provide('settings', settings)
provide('loading', loading)
provide('saving', saving)
provide('save', save)
provide('updateProfile', updateProfile)
provide('updateCompany', updateCompany)
provide('updateConstants', updateConstants)
provide('addCurrency', addCurrency)
provide('removeCurrency', removeCurrency)
provide('updateCurrency', updateCurrency)
provide('addUom', addUom)
provide('removeUom', removeUom)
provide('addConversion', addConversion)
provide('removeConversion', removeConversion)
provide('updateConversion', updateConversion)
provide('addOrderStatus', addOrderStatus)
provide('removeOrderStatus', removeOrderStatus)
provide('updateOrderStatus', updateOrderStatus)
provide('moveOrderStatus', moveOrderStatus)

// ─── Modal state (v-model compatible) ───
const currencyModal = ref(false)
const uomModal = ref(false)
const conversionModal = ref(false)
const statusModal = ref(false)
const currencyChangeConfirmModal = ref(false)
const pendingCurrencyId = ref<string | null>(null)

const newCurrency = ref<{ code: string; name: string; rate: number }>({
  code: '',
  name: '',
  rate: 0,
})

/** Normalize comma → dot for rate input in the currency modal */
function handleCurrencyRateInput(event: Event) {
  const target = event.target as HTMLInputElement
  const raw = target.value.replace(',', '.')
  target.value = raw
  const num = Number(raw)
  if (!isNaN(num)) {
    newCurrency.value.rate = num
  }
}

const isCurrencyFormValid = computed(() => {
  return (
    newCurrency.value.code.trim().length > 0 &&
    newCurrency.value.name.trim().length > 0 &&
    newCurrency.value.rate > 0
  )
})
const newUom = ref<{ code: string; name: string; category: UomCategory }>({
  code: '',
  name: '',
  category: 'weight',
})

const isUomFormValid = computed(() => {
  return newUom.value.code.trim().length > 0 && newUom.value.name.trim().length > 0
})

const isUomCodeDuplicate = computed(() => {
  if (!newUom.value.code.trim()) return false
  const currentLocale = locale.value as keyof TranslatedString
  const raw = newUom.value.code.trim().toLowerCase()
  return settings.uoms.some((u) => {
    const codeVal = (u.code as TranslatedString)[currentLocale] ?? u.code.en ?? u.code.ru ?? ''
    return codeVal.toLowerCase() === raw
  })
})

/** Category-specific code input placeholder */
const codePlaceholder = computed(() => {
  const key = `settingsUom.code_placeholder_${newUom.value.category}`
  const fallback = t('settingsUom.code_placeholder')
  const translated = t(key)
  return translated !== key ? translated : fallback
})

/** Category-specific name input placeholder */
const namePlaceholder = computed(() => {
  const key = `settingsUom.name_placeholder_${newUom.value.category}`
  const fallback = t('settingsUom.name_placeholder')
  const translated = t(key)
  return translated !== key ? translated : fallback
})

/** Sanitize code input based on selected category */
function sanitizeUomCode(raw: string, category: UomCategory): string {
  const lower = raw.toLowerCase()
  if (category === 'density') {
    // Density units: kg/m³, g/cm³ — allow alphanumeric + slash
    return lower.replace(/[^a-z0-9/]/g, '')
  }
  if (category === 'thickness') {
    // Thickness / Section units: mm, cm, µm — pure alphanumeric only
    return lower.replace(/[^a-z0-9]/g, '')
  }
  // Default: lowercase + common unit superscripts
  return lower.replace(/[^a-z0-9²³µ]/g, '')
}

function handleUomCodeInput(event: Event) {
  const target = event.target as HTMLInputElement
  const sanitized = sanitizeUomCode(target.value, newUom.value.category)
  target.value = sanitized
  newUom.value.code = sanitized
}

const newConversion = ref<{
  fromUomId: string
  toUomId: string
  type: 'static' | 'dynamic'
  factor: number
  formulaType: string
}>({ fromUomId: '', toUomId: '', type: 'static', factor: 1, formulaType: '' })
const newStatus = ref<{
  name: string
  color: string
  reserveOnTransition: boolean
  writeOffOnTransition: boolean
}>({
  name: '',
  color: '#6B7280',
  reserveOnTransition: false,
  writeOffOnTransition: false,
})

// ─── Add Status modal state ─────────────────────────────────────────────────
const showStatusColorPicker = ref(false)

const isStatusFormValid = computed(() => newStatus.value.name.trim().length > 0)

function handleModalHexInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
    newStatus.value.color = raw
  }
}

const UOM_CATEGORIES: { value: UomCategory; label: string }[] = [
  { value: 'weight', label: t('settingsUom.category_weight') },
  { value: 'length', label: t('settingsUom.category_length') },
  { value: 'area', label: t('settingsUom.category_area') },
  { value: 'volume', label: t('settingsUom.category_volume') },
  { value: 'quantity', label: t('settingsUom.category_quantity') },
  { value: 'density', label: t('settingsUom.category_density') },
  { value: 'thickness', label: t('settingsUom.category_thickness') },
]

const uomOptions = computed(() =>
  settings.uoms.map((u) => {
    const currentLocale = locale.value as keyof TranslatedString
    const codeVal = (u.code as TranslatedString)[currentLocale] ?? u.code.en ?? u.code.ru ?? ''
    const nameVal = (u.name as TranslatedString)[currentLocale] ?? u.name.en ?? u.name.ru ?? ''
    return { value: u.id, label: `${codeVal} — ${nameVal}` }
  }),
)

const FORMULA_TYPE_OPTIONS = computed(() => [
  { value: 'weight_per_meter', label: t('settingsUom.formula_weight_per_meter') },
  { value: 'area_to_weight', label: t('settingsUom.formula_area_to_weight') },
  { value: 'pcs_to_weight', label: t('settingsUom.formula_pcs_to_weight') },
])

// ─── Lifecycle ───
onMounted(() => {
  load()
  // Ensure we always land on a valid tab route
  const currentTab = route.path.match(/\/admin\/settings\/(.+)/)?.[1]
  if (!currentTab || !(VALID_TABS as readonly string[]).includes(currentTab)) {
    router.replace('/admin/settings/profile')
  }
  document.addEventListener('click', handleStatusColorClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleStatusColorClickOutside)
})

// ─── Handlers ───
async function handleSave() {
  await save()
  if (!saving.value) {
    toast.success(t('settings.saved'))
  }
}

/**
 * Handle file drop for logo — local preview only.
 * The actual upload is handled by DropZone's internal @uploaded event
 * (via uploadsService.uploadFile which now passes auth headers).
 */
function handleLogoDrop(files: File[]) {
  const file = files[0]
  if (!file) return

  // Immediate local preview — read file as data URL
  const reader = new FileReader()
  reader.onload = (e: ProgressEvent<FileReader>) => {
    updateCompany({ logoUrl: e.target?.result as string })
  }
  reader.readAsDataURL(file)
}

/**
 * Handle completed server upload for logo.
 * Replaces the local data URL preview with the real server URL.
 */
function handleLogoUploaded(files: { url: string }[]) {
  const meta = files[0]
  if (meta?.url && !meta.url.startsWith('data:')) {
    updateCompany({ logoUrl: meta.url })
  }
}
provide('handleLogoDrop', handleLogoDrop)
provide('handleLogoUploaded', handleLogoUploaded)

function confirmAddCurrency() {
  if (!isCurrencyFormValid.value) return
  addCurrency({
    code: newCurrency.value.code.toUpperCase(),
    name: { ru: newCurrency.value.name, en: newCurrency.value.name, lt: newCurrency.value.name },
    exchangeRate: newCurrency.value.rate,
    isDefault: false,
  })
  newCurrency.value = { code: '', name: '', rate: 0 }
  currencyModal.value = false
}

function confirmAddUom() {
  if (!isUomFormValid.value || isUomCodeDuplicate.value) return
  const codeVal = newUom.value.code
  addUom({
    code: { ru: codeVal, en: codeVal, lt: codeVal },
    name: { ru: newUom.value.name, en: newUom.value.name, lt: newUom.value.name },
    category: newUom.value.category,
  })
  newUom.value = { code: '', name: '', category: 'weight' }
  uomModal.value = false
}

function confirmAddConversion() {
  if (!newConversion.value.fromUomId || !newConversion.value.toUomId) return
  if (newConversion.value.type === 'dynamic' && !newConversion.value.formulaType) return

  if (newConversion.value.type === 'static') {
    addConversion({
      fromUomId: newConversion.value.fromUomId,
      toUomId: newConversion.value.toUomId,
      type: newConversion.value.type,
      factor: newConversion.value.factor,
    })
  } else {
    addConversion({
      fromUomId: newConversion.value.fromUomId,
      toUomId: newConversion.value.toUomId,
      type: newConversion.value.type,
      formulaType: newConversion.value.formulaType as UomConversion['formulaType'],
    })
  }

  newConversion.value = { fromUomId: '', toUomId: '', type: 'static', factor: 1, formulaType: '' }
  conversionModal.value = false
}

function resetAndCloseStatusModal() {
  newStatus.value = {
    name: '',
    color: '#6B7280',
    reserveOnTransition: false,
    writeOffOnTransition: false,
  }
  showStatusColorPicker.value = false
  statusModal.value = false
}

function confirmAddStatus() {
  if (!newStatus.value.name.trim()) return
  addOrderStatus({
    name: { ru: newStatus.value.name, en: newStatus.value.name, lt: newStatus.value.name },
    color: newStatus.value.color,
    order: settings.orderStatuses.length,
    reserveOnTransition: newStatus.value.reserveOnTransition,
    writeOffOnTransition: newStatus.value.writeOffOnTransition,
  })
  resetAndCloseStatusModal()
}

function handleStatusColorClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.color-popup') && !target.closest('.color-swatch-btn')) {
    showStatusColorPicker.value = false
  }
}

function handleSetDefaultCurrency(id: string) {
  // Show confirmation warning — existing products/batches keep their original currency
  pendingCurrencyId.value = id
  currencyChangeConfirmModal.value = true
}

function confirmSetDefaultCurrency() {
  const id = pendingCurrencyId.value
  if (!id) return
  for (const c of settings.currencies) {
    c.isDefault = c.id === id
  }
  const cur = settings.currencies.find((c) => c.id === id)
  if (cur) updateConstants({ defaultCurrency: cur.code })
  currencyChangeConfirmModal.value = false
  pendingCurrencyId.value = null
}

function cancelSetDefaultCurrency() {
  currencyChangeConfirmModal.value = false
  pendingCurrencyId.value = null
}
provide('handleSetDefaultCurrency', handleSetDefaultCurrency)

function handleStatusColorChange(id: string, color: string) {
  updateOrderStatus(id, { color })
}
provide('handleStatusColorChange', handleStatusColorChange)

// Drag state for status reorder
const dragStatusId = ref<string | null>(null)
function onStatusDragStart(id: string) {
  dragStatusId.value = id
}
function onStatusDrop(targetId: string) {
  if (!dragStatusId.value || dragStatusId.value === targetId) return
  const fromIdx = settings.orderStatuses.findIndex((s) => s.id === dragStatusId.value)
  const toIdx = settings.orderStatuses.findIndex((s) => s.id === targetId)
  if (fromIdx !== -1 && toIdx !== -1) {
    moveOrderStatus(fromIdx, toIdx)
  }
  dragStatusId.value = null
}
provide('onStatusDragStart', onStatusDragStart)
provide('onStatusDrop', onStatusDrop)
provide('dragStatusId', dragStatusId)

// Provide modal controls for child components
provide('currencyModal', currencyModal)
provide('uomModal', uomModal)
provide('conversionModal', conversionModal)
provide('statusModal', statusModal)
provide('newCurrency', newCurrency)
provide('newUom', newUom)
provide('newConversion', newConversion)
provide('newStatus', newStatus)
provide('UOM_CATEGORIES', UOM_CATEGORIES)
provide('uomOptions', uomOptions)
provide('confirmAddCurrency', confirmAddCurrency)
provide('confirmAddUom', confirmAddUom)
provide('confirmAddConversion', confirmAddConversion)
provide('confirmAddStatus', confirmAddStatus)
provide('resetAndCloseStatusModal', resetAndCloseStatusModal)
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1 class="settings-title">{{ t('settings.title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <button class="btn btn-secondary" @click="discard">
          {{ t('settings.cancel_changes') }}
        </button>
        <button
          class="btn btn-save"
          :class="{ dirty: isDirty, loading: saving }"
          :disabled="!isDirty || saving"
          @click="handleSave"
        >
          <SvgIcon v-if="saving" name="spinner" width="16" height="16" />
          {{ saving ? t('settings.saving') : t('settings.save') }}
        </button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="settings-loading" data-test="settings-loading">
      <GlassPanel :loading="true" :skeleton-rows="6" />
    </div>

    <!-- Error state -->
    <div v-else-if="error && !loading" class="settings-error" data-test="settings-error">
      <div class="error-state">
        <SvgIcon name="alert-triangle" width="48" height="48" />
        <h3>{{ t('settings.loadError') }}</h3>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">
          {{ t('settings.retry') }}
        </button>
      </div>
    </div>

    <template v-else>
      <div class="warehouse-tabs" data-test="settings-tabs">
        <button
          v-for="tab in SETTINGS_TABS"
          :key="tab.key"
          class="warehouse-tab"
          :class="{ active: activeTab === tab.key }"
          @click="onTabClick(tab.path)"
        >
          <SvgIcon :name="tab.icon" width="18" height="18" />
          <span>{{ t(tab.labelKey) }}</span>
        </button>
      </div>

      <router-view />
    </template>

    <AppModal v-model="currencyModal" :title="t('settingsModal.add_currency')">
      <div class="modal-form">
        <InputGroup :label="t('settingsFinance.currency_code')">
          <input
            class="glass-input"
            type="text"
            maxlength="3"
            :value="newCurrency.code"
            :placeholder="t('settingsFinance.currency_code')"
            data-test="settings-modal-currency-code"
            @input="newCurrency.code = ($event.target as HTMLInputElement).value.toUpperCase()"
          />
        </InputGroup>
        <InputGroup :label="t('settingsFinance.currency_name')">
          <input
            class="glass-input"
            type="text"
            :value="newCurrency.name"
            :placeholder="t('settingsFinance.currency_name')"
            data-test="settings-modal-currency-name"
            @input="newCurrency.name = ($event.target as HTMLInputElement).value"
          />
        </InputGroup>
        <InputGroup :label="t('settingsFinance.exchange_rate')">
          <input
            class="glass-input"
            type="text"
            inputmode="decimal"
            :value="String(newCurrency.rate)"
            :placeholder="t('settingsFinance.exchange_rate')"
            data-test="settings-modal-currency-rate"
            @input="handleCurrencyRateInput($event)"
          />
        </InputGroup>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="currencyModal = false">
            {{ t('settingsModal.cancel') }}
          </button>
          <button
            class="btn btn-primary"
            :disabled="!isCurrencyFormValid"
            @click="confirmAddCurrency"
          >
            {{ t('settingsModal.save') }}
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal v-model="uomModal" :title="t('settingsModal.add_uom')">
      <div class="modal-form">
        <InputGroup :label="t('settingsUom.code')">
          <input
            class="glass-input"
            :class="{ 'input-error': isUomCodeDuplicate && newUom.code.trim() }"
            type="text"
            maxlength="10"
            :value="newUom.code"
            :placeholder="codePlaceholder"
            data-test="settings-modal-uom-code"
            @input="handleUomCodeInput($event)"
          />
          <p v-if="isUomCodeDuplicate && newUom.code.trim()" class="field-error">
            {{ t('settingsModal.uom_code_exists') }}
          </p>
        </InputGroup>
        <InputGroup :label="t('settingsUom.name')">
          <input
            class="glass-input"
            type="text"
            :value="newUom.name"
            :placeholder="namePlaceholder"
            data-test="settings-modal-uom-name"
            @input="newUom.name = ($event.target as HTMLInputElement).value"
          />
        </InputGroup>
        <InputGroup :label="t('settingsUom.category')">
          <CustomSelect
            :model-value="newUom.category"
            :options="UOM_CATEGORIES"
            @update:model-value="newUom.category = $event as UomCategory"
          />
        </InputGroup>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="uomModal = false">
            {{ t('settingsModal.cancel') }}
          </button>
          <button
            class="btn btn-primary"
            :disabled="!isUomFormValid || isUomCodeDuplicate"
            @click="confirmAddUom"
          >
            {{ t('settingsModal.save') }}
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal v-model="conversionModal" :title="t('settingsModal.add_conversion')">
      <div class="modal-form">
        <InputGroup :label="t('settingsUom.from')">
          <CustomSelect
            :model-value="newConversion.fromUomId"
            :options="uomOptions"
            :placeholder="t('settingsUom.from_placeholder')"
            @update:model-value="newConversion.fromUomId = $event as string"
          />
        </InputGroup>
        <InputGroup :label="t('settingsUom.to')">
          <CustomSelect
            :model-value="newConversion.toUomId"
            :options="uomOptions"
            :placeholder="t('settingsUom.to_placeholder')"
            @update:model-value="newConversion.toUomId = $event as string"
          />
        </InputGroup>

        <InputGroup :label="t('settingsUom.conversion_type')">
          <div class="conversion-type-toggle">
            <button
              class="toggle-btn"
              :class="{ active: newConversion.type === 'static' }"
              @click="newConversion.type = 'static'"
            >
              {{ t('settingsUom.conversion_type_static') }}
            </button>
            <button
              class="toggle-btn"
              :class="{ active: newConversion.type === 'dynamic' }"
              @click="newConversion.type = 'dynamic'"
            >
              {{ t('settingsUom.conversion_type_dynamic') }}
            </button>
          </div>
        </InputGroup>

        <InputGroup v-if="newConversion.type === 'static'" :label="t('settingsUom.factor')">
          <input
            class="glass-input"
            type="number"
            step="0.001"
            :value="newConversion.factor"
            @input="newConversion.factor = Number(($event.target as HTMLInputElement).value)"
          />
        </InputGroup>

        <InputGroup v-else :label="t('settingsUom.formula_type')">
          <CustomSelect
            :model-value="newConversion.formulaType"
            :options="FORMULA_TYPE_OPTIONS"
            :placeholder="t('settingsUom.formula_placeholder')"
            @update:model-value="newConversion.formulaType = $event as string"
          />
        </InputGroup>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="conversionModal = false">
            {{ t('settingsModal.cancel') }}
          </button>
          <button class="btn btn-primary" @click="confirmAddConversion">
            {{ t('settingsModal.save') }}
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal v-model="statusModal" :title="t('settingsModal.add_status')">
      <div class="modal-form">
        <InputGroup :label="t('settingsStatuses.name')">
          <input
            class="glass-input"
            type="text"
            :value="newStatus.name"
            :placeholder="t('settingsStatuses.edit_name')"
            data-test="settings-status-modal-name"
            @input="newStatus.name = ($event.target as HTMLInputElement).value"
          />
        </InputGroup>

        <div class="settings-field">
          <label class="settings-label">{{ t('settingsStatuses.color') }}</label>
          <div class="color-picker-trigger-wrap">
            <button
              class="color-swatch-btn"
              @click="showStatusColorPicker = !showStatusColorPicker"
            >
              <span class="color-swatch" :style="{ backgroundColor: newStatus.color }"></span>
            </button>

            <div v-if="showStatusColorPicker" class="color-popup status-color-popup" @click.stop>
              <div class="color-popup-header">
                <span>{{ t('settingsStatuses.edit_color') }}</span>
                <button class="color-popup-close" @click="showStatusColorPicker = false">
                  <SvgIcon name="x-close" width="12" height="12" />
                </button>
              </div>

              <div class="spectral-picker-row">
                <input
                  type="color"
                  class="color-input-native"
                  :value="newStatus.color"
                  @input="newStatus.color = ($event.target as HTMLInputElement).value"
                />
                <div class="hex-input-wrap">
                  <input
                    class="glass-input hex-input"
                    type="text"
                    maxlength="7"
                    :value="newStatus.color"
                    :placeholder="t('settingsStatuses.color_hex_placeholder')"
                    @input="handleModalHexInput($event)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" @click="resetAndCloseStatusModal">
            {{ t('settingsModal.cancel') }}
          </button>
          <button class="btn btn-primary" :disabled="!isStatusFormValid" @click="confirmAddStatus">
            {{ t('settingsModal.save') }}
          </button>
        </div>
      </div>
    </AppModal>

    <!-- ─── Confirm default currency change ─── -->
    <AppModal
      v-model="currencyChangeConfirmModal"
      :title="t('settingsFinance.confirm_currency_change_title')"
      size="small"
    >
      <div class="modal-form">
        <p style="line-height: 1.6; color: rgba(255, 255, 255, 0.8)">
          {{ t('settingsFinance.confirm_currency_change_message') }}
        </p>
        <div
          v-if="pendingCurrencyId"
          class="currency-change-detail"
          style="
            margin-top: 8px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
          "
        >
          <span style="font-weight: 600; color: #fff">
            {{ settings.currencies.find((c) => c.id === pendingCurrencyId)?.code }}
          </span>
          <span style="color: rgba(255, 255, 255, 0.5); margin-left: 8px">
            → {{ t('settingsFinance.confirm_currency_change_default') }}
          </span>
        </div>
        <p style="margin-top: 12px; font-size: 0.85rem; color: #ff6b6b; line-height: 1.5">
          {{ t('settingsFinance.confirm_currency_change_warning') }}
        </p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="cancelSetDefaultCurrency">
            {{ t('btn.cancel') }}
          </button>
          <button class="btn btn-primary" @click="confirmSetDefaultCurrency">
            {{ t('settingsFinance.confirm_currency_change_confirm') }}
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.settings-page {
  padding: 24px;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.settings-loading {
  padding: 24px;
}

.settings-error {
  padding: 48px 24px;
}

.settings-error .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px;
  text-align: center;
  color: var(--text-muted, #9ca3af);
}

.settings-error .error-state h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.settings-error .error-state p {
  margin: 0;
  font-size: 0.875rem;
  max-width: 400px;
  line-height: 1.5;
}

.settings-page .warehouse-tabs {
  margin-bottom: 24px;
}

.settings-panel {
  padding: 24px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
}

.settings-section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-label, #9ca3af);
}

.settings-logo-preview {
  margin-top: 8px;
}

.settings-logo-img {
  max-height: 80px;
  border-radius: 4px;
}

.settings-table-section {
  margin-top: 24px;
}

.settings-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.settings-table-header h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.settings-table {
  width: 100%;
  border-collapse: collapse;
}

.settings-table th,
.settings-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  font-size: 0.875rem;
}

.settings-table th {
  font-weight: 500;
  color: var(--text-muted, #9ca3af);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.table-input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 0.875rem;
}

.settings-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #6b7280);
  font-size: 0.875rem;
}

.text-danger {
  color: #ef4444;
}

.text-danger:hover {
  color: #dc2626;
}

.draggable-row {
  cursor: grab;
}

.draggable-row:active {
  cursor: grabbing;
}

.drag-handle {
  width: 30px;
  color: var(--text-muted, #6b7280);
  cursor: grab;
}

.status-badge {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
}

.system-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--bg-muted, rgba(255, 255, 255, 0.08));
  font-size: 0.625rem;
  font-weight: 700;
  margin-left: 6px;
  vertical-align: middle;
  cursor: help;
}

/* ─── Color picker trigger wrap (modal) ─── */
.color-picker-trigger-wrap {
  position: relative;
}

/* ─── Color swatch button ─── */
.color-swatch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
}

.color-swatch-btn:hover {
  border-color: rgba(255, 255, 255, 0.35);
}

.color-swatch {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ─── Status color popup inside modal ─── */
.status-color-popup {
  position: absolute;
  z-index: 200;
  top: calc(100% + 8px);
  left: 0;
  padding: 12px;
  background: rgba(30, 30, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 180px;
}

.status-color-popup .color-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.status-color-popup .color-popup-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  border-radius: 4px;
}

.status-color-popup .color-popup-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* ─── Spectral picker row: native color input + HEX text ─── */
.spectral-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.color-input-native {
  width: 44px;
  height: 44px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border-radius: 50%;
  flex-shrink: 0;
}

.color-input-native::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input-native::-webkit-color-swatch {
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
}

.hex-input-wrap {
  flex: 1;
}

.hex-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 0.8125rem;
  font-family: 'JetBrains Mono', monospace;
  height: 36px;
  color: #ffffff !important;
}

/* ─── Error state for glass-input (duplicate code highlight) ─── */
.glass-input.input-error {
  border-color: #cf3e3e;
  box-shadow: 0 0 10px rgba(207, 62, 62, 0.3);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

/* ─── Conversion type toggle (Static / Dynamic) ─── */
.conversion-type-toggle {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.toggle-btn.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #ffffff;
}
</style>
