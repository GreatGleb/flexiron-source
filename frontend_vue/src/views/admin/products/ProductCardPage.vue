<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useSettings } from '@/composables/useSettings'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useProductCard } from '@/composables/useProductCard'
import { mergeLocaleValue } from '@/types/i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import FileItem from '@/components/admin/FileItem.vue'
import type { UploadedFile } from '@/services/uploadsService'
import type { LinkedSupplier } from '@/types/product'
import type { TranslatedString } from '@/types/i18n'
import { deleteProductAuditEntry } from '@/services/productsService'
import { useToast } from '@/composables/useToast'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/components/_audit-log.css'
import '@styles/admin/products_card.css'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const id = route.params.id as string

const showSupplierLinks = useFeatureFlag('productSupplierLinks')

const {
  product,
  loading,
  saving,
  error,
  form,
  fieldValues,
  linkedSuppliers,
  suppliersList,
  isAnythingDirty,
  getCategoryPath,
  addLinkedSupplier,
  removeLinkedSupplier,
  load,
  save,
  discard,
  tf,
} = useProductCard(id)

// ─── Audit log entry deletion (with confirm modal) ───
const deleteAuditOpen = ref(false)
const auditToDeleteIdx = ref<number | null>(null)

function askDeleteAudit(index: number) {
  auditToDeleteIdx.value = index
  deleteAuditOpen.value = true
}

async function confirmDeleteAudit() {
  if (auditToDeleteIdx.value === null || !product.value) return
  const idx = auditToDeleteIdx.value
  try {
    await deleteProductAuditEntry(id, idx)
    product.value.auditLog.splice(idx, 1)
    toast.show(t('msg.audit_deleted'))
  } catch {
    toast.show(t('msg.status_error'), 'error')
  } finally {
    auditToDeleteIdx.value = null
    deleteAuditOpen.value = false
  }
}

const formName = computed({
  get: () => (form.value.name ? tf(form.value.name as TranslatedString) : ''),
  set: (v: string) => {
    form.value.name = v ? mergeLocaleValue(form.value.name, v, locale.value) : null
  },
})

const formDescription = computed({
  get: () => (form.value.description ? tf(form.value.description) : ''),
  set: (v: string) => {
    form.value.description = v ? mergeLocaleValue(form.value.description, v, locale.value) : null
  },
})

const pageTitle = computed(() =>
  product.value?.name ? tf(product.value.name) : t('products.title'),
)

useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  description: () => pageTitle.value,
})

// Dynamic UoM options from settings
const { settings, load: loadSettings } = useSettings()

// Show conversion sections when UoMs differ
const needsPurchaseConversion = computed(() => {
  return (
    form.value.purchaseUomId &&
    form.value.warehouseUomId &&
    form.value.purchaseUomId !== form.value.warehouseUomId
  )
})

const needsSaleConversion = computed(() => {
  return (
    form.value.warehouseUomId &&
    form.value.saleUomId &&
    form.value.warehouseUomId !== form.value.saleUomId
  )
})

/** Look up UoM code by id from settings, respecting current locale */
function uomCode(id: string | null): string {
  if (!id) return '?'
  const uom = settings.uoms.find((u: { id: string }) => u.id === id)
  if (!uom) return '?'
  const currentLocale = locale.value as keyof typeof uom.code
  return uom.code[currentLocale] || uom.code.en || uom.code.ru || uom.code.lt || '?'
}

const currentLocale = computed(() => locale.value as string)

const saleUomOptions = computed(() => {
  const uoms = settings.uoms ?? []
  const cl = currentLocale.value
  return [
    { value: '', label: '—' },
    ...uoms.map((u: { id: string; code: Record<string, string | undefined> }) => ({
      value: u.id,
      label: u.code[cl] || u.code.en || u.code.ru || u.code.lt || '?',
    })),
  ]
})

const warehouseUomOptions = computed(() => {
  const uoms = settings.uoms ?? []
  const cl = currentLocale.value
  return [
    { value: '', label: '—' },
    ...uoms.map((u: { id: string; code: Record<string, string | undefined> }) => ({
      value: u.id,
      label: u.code[cl] || u.code.en || u.code.ru || u.code.lt || '?',
    })),
  ]
})

const purchaseUomOptions = computed(() => {
  const uoms = settings.uoms ?? []
  const cl = currentLocale.value
  return [
    { value: '', label: '—' },
    ...uoms.map((u: { id: string; code: Record<string, string | undefined> }) => ({
      value: u.id,
      label: u.code[cl] || u.code.en || u.code.ru || u.code.lt || '?',
    })),
  ]
})

const currencyOptions = computed(() => {
  const currencies = settings.currencies ?? []
  return [
    { value: '', label: '—' },
    ...currencies.map((c: { id: string; code: string }) => ({ value: c.id, label: c.code })),
  ]
})

const currencySymbol = computed(() => {
  if (!form.value.currencyId) return ''
  const c = settings.currencies?.find((cur: { id: string; code: string }) => cur.id === form.value.currencyId)
  return c?.code ?? ''
})

const addSupplierForm = ref<{ supplierId: string; price: string; leadDays: string }>({
  supplierId: '',
  price: '',
  leadDays: '',
})
const showAddSupplier = ref(false)
const supplierToRemove = ref<LinkedSupplier | null>(null)
const showRemoveModal = computed({
  get: () => supplierToRemove.value !== null,
  set: (v: boolean) => {
    if (!v) supplierToRemove.value = null
  },
})

function submitAddSupplier() {
  const s = suppliersList.value.find((s) => s.id === addSupplierForm.value.supplierId)
  if (!s) return
  // Use product's priceUnit (reconstructed by backend) or build from currency + saleUom
  const unit =
    product.value?.priceUnit ||
    (form.value.currencyId && form.value.saleUomId
      ? `${settings.currencies.find((c: { id: string }) => c.id === form.value.currencyId)?.code ?? ''}/${settings.uoms.find((u: { id: string }) => u.id === form.value.saleUomId)?.code.en ?? ''}`
      : null)
  const entry: LinkedSupplier = {
    id: s.id,
    name: s.company,
    price: addSupplierForm.value.price !== '' ? Number(addSupplierForm.value.price) : null,
    priceUnit: unit,
    leadDays: addSupplierForm.value.leadDays !== '' ? Number(addSupplierForm.value.leadDays) : null,
    currency: s.currency ?? null,
  }
  addLinkedSupplier(entry)
  addSupplierForm.value = { supplierId: '', price: '', leadDays: '' }
  showAddSupplier.value = false
}

function removeFieldFile(fieldId: string, fname: string) {
  const arr = fieldValues.value[fieldId] as string[]
  fieldValues.value[fieldId] = arr.filter((f) => f !== fname)
}

function addFieldFiles(fieldId: string, files: UploadedFile[]) {
  const arr = fieldValues.value[fieldId] as string[]
  for (const f of files) arr.push(f.name)
}

onMounted(() => {
  load()
  loadSettings()
})
</script>

<template>
  <template v-if="loading">
    <div class="main-card-content">
      <div class="entity-card-grid">
        <div class="entity-col-left">
          <GlassPanel :loading="true" :skeleton-rows="4" />
          <GlassPanel :loading="true" :skeleton-rows="3" />
        </div>
        <div class="entity-col-center">
          <GlassPanel :loading="true" :skeleton-rows="4" />
        </div>
        <div class="entity-col-right">
          <GlassPanel :loading="true" :skeleton-rows="3" />
        </div>
      </div>
    </div>
  </template>
  <template v-else-if="error">
    <Breadcrumb
      :items="[
        { label: t('products.header_title'), to: { name: 'admin-products' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-products' }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>
  <template v-else>
    <div class="page-product-card" data-test="page-product-card">
      <div class="product-card-header" data-test="product-card-header">
        <Breadcrumb
          :items="[
            { label: t('products.header_title'), to: { name: 'admin-products' } },
            { label: product?.name ? tf(product.name) : '...' },
          ]"
        />
        <div class="product-card-header-row">
          <h1 class="page-title">{{ product?.name ? tf(product.name) : '...' }}</h1>
          <div class="entity-action-bar no-margin pos-static" data-test="product-save-bar">
            <button class="btn btn-secondary" @click="discard">
              {{ t('products.btn_discard_changes') }}
            </button>
            <button
              class="btn btn-save"
              :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!product || !isAnythingDirty || saving"
              @click="save"
            >
              {{ t('products.btn_save') }}
            </button>
          </div>
        </div>
      </div>

      <div class="main-card-content">
        <div class="entity-card-grid">
          <!-- LEFT: Info + Price -->
          <div class="entity-col-left">
            <GlassPanel
              :title="t('products.section_info')"
              :loading="loading"
              :skeleton-rows="4"
              data-test="product-card-info"
            >
              <InputGroup :label="t('products.field_name')" :required="true">
                <input v-model="formName" class="glass-input" type="text" data-test="field-name" />
              </InputGroup>

              <InputGroup :label="t('products.field_category')" :required="false">
                <input
                  :value="product?.categoryId ? getCategoryPath(product.categoryId) : '—'"
                  class="glass-input"
                  type="text"
                  readonly
                  data-test="field-category"
                />
                <span class="field-hint">{{ t('products.field_category_hint') }}</span>
              </InputGroup>

              <InputGroup :label="t('products.field_sku')" :required="false">
                <input v-model="form.sku" class="glass-input" type="text" data-test="field-sku" />
              </InputGroup>

              <InputGroup :label="t('products.field_description')" :required="false">
                <textarea
                  v-model="formDescription"
                  class="glass-input"
                  rows="3"
                  data-test="field-description"
                />
              </InputGroup>

              <InputGroup :label="t('products.field_min_stock')" :required="false">
                <input
                  v-model.number="form.minStock"
                  class="glass-input"
                  type="number"
                  data-test="field-min-stock"
                />
              </InputGroup>
            </GlassPanel>

            <GlassPanel
              :title="t('products.section_price')"
              :loading="loading"
              :skeleton-rows="4"
              data-test="product-card-price"
            >
              <InputGroup :label="t('products.field_price')" :required="false">
                <input
                  v-model.number="form.price"
                  class="glass-input"
                  type="number"
                  data-test="field-price"
                />
              </InputGroup>

              <div class="inline-group">
                <InputGroup
                  :label="t('products.field_price_quantity')"
                  :required="false"
                  class="inline-short"
                >
                  <input
                    v-model.number="form.priceQuantity"
                    class="glass-input"
                    type="number"
                    min="1"
                    data-test="field-price-quantity"
                  />
                </InputGroup>

                <InputGroup
                  :label="t('products.field_sale_uom')"
                  :required="false"
                  class="inline-wide"
                >
                  <CustomSelect
                    v-model="form.saleUomId"
                    :options="saleUomOptions"
                    data-test="field-sale-uom"
                  />
                </InputGroup>
              </div>

              <InputGroup :label="t('products.field_currency')" :required="false">
                <CustomSelect
                  v-model="form.currencyId"
                  :options="currencyOptions"
                  data-test="field-currency"
                />
              </InputGroup>

              <InputGroup :label="t('products.field_avg_cost_price')">
                <span class="glass-input readonly">
                  {{ product?.avgCostPrice != null ? currencySymbol + product.avgCostPrice.toFixed(2) : '—' }}
                </span>
              </InputGroup>

              <InputGroup :label="t('products.field_avg_sale_price')">
                <span class="glass-input readonly">
                  {{ product?.avgSalePrice != null ? currencySymbol + product.avgSalePrice.toFixed(2) : '—' }}
                </span>
              </InputGroup>
            </GlassPanel>

            <!-- UoM Settings Panel -->
            <GlassPanel
              :title="t('products.section_uom')"
              :loading="loading"
              :skeleton-rows="3"
              data-test="product-card-uom"
            >
              <InputGroup :label="t('products.field_purchase_uom')" :required="false">
                <CustomSelect
                  v-model="form.purchaseUomId"
                  :options="purchaseUomOptions"
                  data-test="field-purchase-uom"
                />
              </InputGroup>

              <InputGroup :label="t('products.field_warehouse_uom')" :required="false">
                <CustomSelect
                  v-model="form.warehouseUomId"
                  :options="warehouseUomOptions"
                  data-test="field-warehouse-uom"
                />
              </InputGroup>

              <InputGroup :label="t('products.field_sale_uom')" :required="false">
                <CustomSelect
                  v-model="form.saleUomId"
                  :options="saleUomOptions"
                  data-test="field-sale-uom-2"
                />
              </InputGroup>

              <!-- Conditional: conversion settings (shown when UoMs differ) -->
              <template v-if="needsPurchaseConversion">
                <div class="section-divider" />
                <h4 class="subsection-title">
                  {{ t('products.conversion_purchase_to_warehouse') }}
                </h4>
                <InputGroup :label="t('products.conversion_factor')" :required="false">
                  <input
                    v-model.number="form.purchaseToWarehouseFactor"
                    class="glass-input"
                    type="number"
                    data-test="field-p2w-factor"
                  />
                  <span class="field-hint">
                    1 {{ uomCode(form.purchaseUomId) }} ×
                    {{ form.purchaseToWarehouseFactor ?? '?' }} =
                    {{
                      form.purchaseToWarehouseFactor
                        ? (1 * form.purchaseToWarehouseFactor).toFixed(4)
                        : '?'
                    }}
                    {{ uomCode(form.warehouseUomId) }}
                  </span>
                </InputGroup>
              </template>

              <template v-if="needsSaleConversion">
                <div class="section-divider" />
                <h4 class="subsection-title">{{ t('products.conversion_warehouse_to_sale') }}</h4>
                <InputGroup :label="t('products.conversion_factor')" :required="false">
                  <input
                    v-model.number="form.warehouseToSaleFactor"
                    class="glass-input"
                    type="number"
                    data-test="field-w2s-factor"
                  />
                  <span class="field-hint">
                    1 {{ uomCode(form.warehouseUomId) }} ÷ {{ form.warehouseToSaleFactor ?? '?' }} =
                    {{
                      form.warehouseToSaleFactor ? (1 / form.warehouseToSaleFactor).toFixed(4) : '?'
                    }}
                    {{ uomCode(form.saleUomId) }}
                  </span>
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <!-- CENTER: Dynamic Fields -->
          <div class="entity-col-center">
            <GlassPanel
              v-if="product && product.fieldValues.length > 0"
              :title="
                product && product.categoryId
                  ? t('products.section_fields_title', {
                      path: getCategoryPath(product.categoryId),
                    })
                  : t('products.section_fields')
              "
              :loading="loading"
              :skeleton-rows="4"
              data-test="product-card-fields"
            >
              <template v-for="fv in product.fieldValues" :key="fv.fieldId">
                <InputGroup :label="tf(fv.fieldName)" :required="false">
                  <span v-if="fv.inherited" class="field-inherited-badge">
                    {{ t('products.field_inherited_badge') }}
                  </span>

                  <div>
                    <input
                      v-if="fv.fieldType === 'text'"
                      v-model="(fieldValues as Record<string, unknown>)[fv.fieldId] as string"
                      class="glass-input"
                      type="text"
                    />
                    <input
                      v-else-if="fv.fieldType === 'number'"
                      v-model.number="(fieldValues as Record<string, unknown>)[fv.fieldId]"
                      class="glass-input"
                      type="number"
                    />
                    <input
                      v-else-if="fv.fieldType === 'email'"
                      v-model="(fieldValues as Record<string, unknown>)[fv.fieldId] as string"
                      class="glass-input"
                      type="email"
                    />
                    <DatePicker
                      v-else-if="fv.fieldType === 'date'"
                      v-model="(fieldValues as Record<string, unknown>)[fv.fieldId] as string"
                    />
                    <label v-else-if="fv.fieldType === 'boolean'" class="checkbox-label">
                      <input
                        v-model="(fieldValues as Record<string, unknown>)[fv.fieldId]"
                        type="checkbox"
                      />
                    </label>
                    <CustomSelect
                      v-else-if="fv.fieldType === 'enum'"
                      v-model="(fieldValues as Record<string, unknown>)[fv.fieldId] as string"
                      :options="
                        (fv.options ?? []).map((o) => ({ value: o.en ?? o.ru, label: tf(o) }))
                      "
                    />
                    <template v-else-if="fv.fieldType === 'file'">
                      <div class="file-list" style="margin-bottom: 12px">
                        <FileItem
                          v-for="fname in fieldValues[fv.fieldId] as string[]"
                          :key="fname"
                          :name="fname"
                          download-url="#"
                          @delete="removeFieldFile(fv.fieldId, fname)"
                        />
                      </div>
                      <DropZone
                        :hint="t('products.dropzone_hint')"
                        :multiple="true"
                        @uploaded="(files) => addFieldFiles(fv.fieldId, files)"
                      />
                    </template>
                  </div>
                </InputGroup>
              </template>
            </GlassPanel>
          </div>

          <!-- RIGHT: Suppliers -->
          <div class="entity-col-right">
            <GlassPanel
              v-if="showSupplierLinks"
              :title="t('products.section_suppliers')"
              :loading="loading"
              :skeleton-rows="3"
              data-test="product-card-suppliers"
            >
              <template #header>
                <button
                  class="btn btn-primary"
                  type="button"
                  data-test="add-supplier-open"
                  @click="showAddSupplier = true"
                >
                  <SvgIcon name="plus-add" :width="16" :height="16" />
                  <span>{{ t('products.btn_add_supplier') }}</span>
                </button>
              </template>

              <div v-if="linkedSuppliers.length === 0" class="empty-state">
                <p>{{ t('products.suppliers_empty') }}</p>
              </div>
              <div v-if="linkedSuppliers.length > 0" class="data-table-wrapper">
                <table class="data-table product-suppliers-table">
                  <thead>
                    <tr>
                      <th>{{ t('suppliers.list') }}</th>
                      <th>{{ t('products.field_supplier_price') }}</th>
                      <th>{{ t('suppliers.th_lead_time') }}</th>
                      <th>{{ t('products.field_currency') }}</th>
                      <th style="width: 32px"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="s in linkedSuppliers" :key="s.id">
                      <td
                        style="cursor: pointer"
                        @click="router.push({ name: 'admin-supplier-card', params: { id: s.id } })"
                      >
                        {{ tf(s.name) }}
                      </td>
                      <td>{{ s.price != null ? `${s.price} ${s.currency ?? ''}` : '—' }}</td>
                      <td>{{ s.leadDays != null ? `${s.leadDays} d.` : '—' }}</td>
                      <td>{{ s.currency ?? '—' }}</td>
                      <td>
                        <button
                          class="supplier-remove-btn"
                          type="button"
                          @click="supplierToRemove = s"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>

      <!-- FULL WIDTH: Audit History -->
      <div class="audit-panel-wide" data-test="product-card-audit">
        <GlassPanel :title="t('products.section_audit')">
          <div class="table-responsive">
            <table class="audit-log-table" data-test="product-card-audit-table">
              <thead>
                <tr>
                  <th>{{ t('th.timestamp') }}</th>
                  <th>{{ t('th.user') }}</th>
                  <th>{{ t('th.prop') }}</th>
                  <th>{{ t('th.diff') }}</th>
                  <th style="width: 40px" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(a, i) in product?.auditLog ?? []"
                  :key="i"
                  data-test="product-card-audit-row"
                >
                  <td class="audit-log-ts">{{ a.timestamp }}</td>
                  <td>
                    <div class="audit-log-user">
                      <div class="audit-log-avatar">{{ a.userInitials }}</div>
                      <span>{{ tf(a.user) }}</span>
                    </div>
                  </td>
                  <td>{{ tf(a.property) }}</td>
                  <td>
                    <span class="audit-diff-old">{{ a.oldValue }}</span>
                    &nbsp;→&nbsp;
                    <span class="audit-diff-new">{{ a.newValue }}</span>
                  </td>
                  <td style="text-align: right">
                    <button
                      v-tooltip="t('btn.delete')"
                      type="button"
                      class="action-icon-btn action-danger"
                      data-test="product-card-audit-delete-btn"
                      @click="askDeleteAudit(i)"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassPanel>
      </div>

      <AppModal
        v-model="showAddSupplier"
        :title="t('products.btn_add_supplier')"
        size="small"
        data-test="add-supplier-form"
      >
        <InputGroup :label="t('suppliers.list')" :required="true">
          <CustomSelect
            v-model="addSupplierForm.supplierId"
            :options="
              suppliersList
                .filter((s) => !linkedSuppliers.some((ls) => ls.id === s.id))
                .map((s) => ({ value: s.id, label: tf(s.company) }))
            "
            data-test="add-supplier-select"
          />
        </InputGroup>
        <InputGroup :label="t('products.field_supplier_price')" :required="false">
          <input
            v-model="addSupplierForm.price"
            class="glass-input"
            type="number"
            data-test="add-supplier-price"
          />
        </InputGroup>
        <InputGroup :label="t('products.th_lead_days')" :required="false">
          <input
            v-model="addSupplierForm.leadDays"
            class="glass-input"
            type="number"
            data-test="add-supplier-lead"
          />
        </InputGroup>
        <template #footer>
          <button type="button" class="btn btn-secondary" @click="showAddSupplier = false">
            {{ t('products.btn_discard') }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!addSupplierForm.supplierId"
            data-test="add-supplier-confirm"
            @click="submitAddSupplier"
          >
            {{ t('products.btn_add_supplier') }}
          </button>
        </template>
      </AppModal>

      <AppModal
        v-model="showRemoveModal"
        :title="t('products.modal_remove_supplier')"
        size="small"
        data-test="modal-remove-supplier"
      >
        <p>{{ t('products.confirm_remove_supplier') }}</p>
        <template #footer>
          <button type="button" class="btn btn-secondary" @click="supplierToRemove = null">
            {{ t('products.btn_discard') }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            data-test="confirm-remove-supplier"
            @click="
              () => {
                removeLinkedSupplier(supplierToRemove!.id)
                supplierToRemove = null
              }
            "
          >
            {{ t('products.btn_delete') }}
          </button>
        </template>
      </AppModal>

      <AppModal
        v-model="deleteAuditOpen"
        :title="t('modal.confirm_delete')"
        size="small"
        data-test="product-card-audit-modal"
      >
        <p>{{ t('modal.delete_audit_warning') }}</p>
        <template #footer>
          <button
            type="button"
            class="btn btn-secondary"
            data-test="product-card-audit-modal-cancel"
            @click="deleteAuditOpen = false"
          >
            {{ t('btn.cancel') }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            data-test="product-card-audit-modal-confirm"
            @click="confirmDeleteAudit"
          >
            {{ t('btn.delete') }}
          </button>
        </template>
      </AppModal>
    </div>
  </template>
</template>
