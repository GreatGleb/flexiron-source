<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useProductCard } from '@/composables/useProductCard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/products_card.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const showSupplierLinks = useFeatureFlag('productSupplierLinks')

const { product, loading, saving, form, fieldValues, isAnythingDirty, load, save, discard } =
  useProductCard(id)

useHead({
  title: computed(() => product.value?.name ?? t('products.title')),
  description: computed(() => product.value?.name ?? t('products.title')),
})

const priceUnitOptions = computed(() => [
  { value: '', label: '—' },
  { value: 'EUR/vnt', label: t('products.price_unit_vnt') },
  { value: 'EUR/kg', label: t('products.price_unit_kg') },
  { value: 'EUR/m', label: t('products.price_unit_m') },
])

const priceUnitStr = computed({
  get: () => form.value.priceUnit ?? '',
  set: (v: string) => {
    form.value.priceUnit = (v || null) as typeof form.value.priceUnit
  },
})

onMounted(load)
</script>

<template>
  <div class="page-product-card" data-test="page-product-card">
    <div class="product-card-header" data-test="product-card-header">
      <router-link :to="{ name: 'admin-products' }" class="btn btn-secondary">
        ← {{ t('products.btn_back') }}
      </router-link>
      <h1 class="page-title">{{ product?.name ?? '...' }}</h1>
      <div
        v-if="isAnythingDirty"
        class="entity-action-bar no-margin pos-static"
        data-test="product-save-bar"
      >
        <button class="btn btn-secondary" :disabled="saving" @click="discard">
          {{ t('products.btn_discard_changes') }}
        </button>
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ t('products.btn_save') }}
        </button>
      </div>
    </div>

    <GlassPanel :title="t('products.section_info')" :loading="loading" :skeleton-rows="4" data-test="product-card-info">

      <InputGroup :label="t('products.field_name')" :required="true">
        <input v-model="form.name" class="glass-input" type="text" data-test="field-name" />
      </InputGroup>

      <InputGroup :label="t('products.field_category')" :required="false">
        <input
          :value="product?.categoryName ?? '—'"
          class="glass-input"
          type="text"
          readonly
          data-test="field-category"
        />
      </InputGroup>

      <InputGroup :label="t('products.field_sku')" :required="false">
        <input v-model="form.sku" class="glass-input" type="text" data-test="field-sku" />
      </InputGroup>

      <InputGroup :label="t('products.field_description')" :required="false">
        <textarea
          v-model="form.description"
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

    <GlassPanel :title="t('products.section_price')" :loading="loading" :skeleton-rows="3" data-test="product-card-price">

      <InputGroup :label="t('products.field_price')" :required="false">
        <input
          v-model.number="form.price"
          class="glass-input"
          type="number"
          data-test="field-price"
        />
      </InputGroup>

      <InputGroup :label="t('products.field_price_unit')" :required="false">
        <CustomSelect
          v-model="priceUnitStr"
          :options="priceUnitOptions"
          data-test="field-price-unit"
        />
      </InputGroup>
    </GlassPanel>

    <GlassPanel
      v-if="product && product.fieldValues.length > 0"
      :title="t('products.section_fields')"
      :loading="loading"
      :skeleton-rows="4"
      data-test="product-card-fields"
    >

      <template v-for="fv in product.fieldValues" :key="fv.fieldId">
        <InputGroup :label="fv.fieldName" :required="false">
          <span v-if="fv.inherited" class="field-inherited-badge">
            {{ t('products.field_inherited_badge') }}
          </span>

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
          <input
            v-else-if="fv.fieldType === 'date'"
            v-model="(fieldValues as Record<string, unknown>)[fv.fieldId] as string"
            class="glass-input"
            type="date"
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
            :options="(fv.options ?? []).map((o) => ({ value: o, label: o }))"
          />
          <template v-else-if="fv.fieldType === 'file'">
            <DropZone
              hint="PDF / image"
              @uploaded="(files) => ((fieldValues as Record<string, unknown>)[fv.fieldId] = files[0]?.fileId ?? null)"
            />
            <span v-if="fieldValues[fv.fieldId]" class="field-inherited-badge">
              {{ fieldValues[fv.fieldId] }}
            </span>
          </template>
        </InputGroup>
      </template>
    </GlassPanel>

    <GlassPanel
      v-if="showSupplierLinks"
      :title="t('products.section_suppliers')"
      :loading="loading"
      :skeleton-rows="3"
      data-test="product-card-suppliers"
    >

      <div v-if="!product || product.linkedSuppliers.length === 0" class="empty-state">
        <p>{{ t('products.suppliers_empty') }}</p>
      </div>
      <div v-else class="data-table-wrapper">
        <table class="data-table product-suppliers-table">
          <thead>
            <tr>
              <th>{{ t('suppliers.list') }}</th>
              <th>{{ t('products.field_price') }}</th>
              <th>{{ t('suppliers.th_lead_time') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="s in product.linkedSuppliers"
              :key="s.id"
              @click="router.push({ name: 'admin-supplier-card', params: { id: s.id } })"
            >
              <td>{{ s.name }}</td>
              <td>{{ s.price != null ? `${s.price} ${s.priceUnit ?? ''}` : '—' }}</td>
              <td>{{ s.leadDays != null ? `${s.leadDays} d.` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassPanel>
  </div>
</template>
