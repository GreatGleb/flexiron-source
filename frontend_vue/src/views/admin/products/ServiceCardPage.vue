<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { mergeLocaleValue } from '@/types/i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import { useHead } from '@/composables/useHead'
import { useServiceCard } from '@/composables/useServiceCard'

import '@styles/admin/components/_entity-card-layout.css'

const { t, locale } = useI18n()
const route = useRoute()

const id = route.params.id as string

const { service, loading, saving, error, form, isAnythingDirty, load, save, discard, tf } =
  useServiceCard(id)

const formName = computed({
  get: () => (form.value.name ? tf(form.value.name) : ''),
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

useHead({
  title: () => (service.value?.name ? tf(service.value.name) : t('services.title')),
  description: () => t('services.title'),
})

const priceUnitOptions = [
  { value: 'EUR/vnt', label: t('services.price_unit_eur_vnt') },
  { value: 'EUR/kg', label: t('services.price_unit_eur_kg') },
  { value: 'EUR/m', label: t('services.price_unit_eur_m') },
  { value: 'EUR/h', label: t('services.price_unit_eur_h') },
]

onMounted(() => {
  load()
})
</script>

<template>
  <template v-if="loading">
    <GlassPanel :loading="true" :skeleton-rows="6" />
  </template>
  <template v-else-if="error">
    <Breadcrumb
      :items="[
        { label: t('products.header_title'), to: { name: 'admin-products' } },
        { label: t('services.header_title'), to: { name: 'admin-services' } },
        { label: t('common.entity_not_found') },
      ]"
    />
    <div class="entity-not-found">
      <SvgIcon name="search" :width="48" :height="48" />
      <h2>{{ t('common.entity_not_found') }}</h2>
      <p>{{ t('common.entity_not_found_id', { id }) }}</p>
      <router-link :to="{ name: 'admin-services' }" class="btn btn-primary">
        {{ t('common.back_to_list') }}
      </router-link>
    </div>
  </template>
  <template v-else>
    <div class="page-service-card" data-test="page-service-card">
      <div class="service-card-header" data-test="service-card-header">
        <Breadcrumb
          :items="[
            { label: t('products.header_title'), to: { name: 'admin-products' } },
            { label: t('services.header_title'), to: { name: 'admin-services' } },
            { label: service?.name ? tf(service.name) : '...' },
          ]"
        />
        <div class="service-card-header-row">
          <h1 class="page-title">{{ service?.name ? tf(service.name) : t('services.title') }}</h1>
          <div class="entity-action-bar no-margin pos-static" data-test="service-save-bar">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!isAnythingDirty || saving"
              @click="discard"
            >
              {{ t('services.btn_discard_changes') }}
            </button>
            <button
              type="button"
              class="btn btn-save"
              :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!isAnythingDirty || saving"
              @click="save"
            >
              {{ t('services.btn_save') }}
            </button>
          </div>
        </div>
      </div>

      <div class="entity-card-grid">
        <div class="entity-col-left">
          <GlassPanel
            :title="t('services.section_info')"
            :loading="loading"
            :skeleton-rows="5"
            data-test="service-card-info"
          >
            <InputGroup :label="t('services.field_name')">
              <input
                v-model="formName"
                type="text"
                class="glass-input"
                data-test="service-name-input"
              />
            </InputGroup>
            <InputGroup :label="t('services.field_cost_price')">
              <input
                v-model.number="form.costPrice"
                type="number"
                step="0.01"
                class="glass-input"
                data-test="service-cost-input"
              />
            </InputGroup>
            <InputGroup :label="t('services.field_selling_price')">
              <input
                v-model.number="form.sellingPrice"
                type="number"
                step="0.01"
                class="glass-input"
                data-test="service-selling-input"
              />
            </InputGroup>
            <InputGroup :label="t('services.field_price_unit')">
              <CustomSelect
                v-model="form.priceUnit"
                :options="priceUnitOptions"
                data-test="service-unit-select"
              />
            </InputGroup>
            <InputGroup :label="t('services.field_description')">
              <textarea
                v-model="formDescription"
                class="glass-input"
                rows="3"
                data-test="service-description-input"
              />
            </InputGroup>
          </GlassPanel>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.page-service-card {
  padding: 0;
}

.service-card-header {
  margin-bottom: 24px;
}

.service-card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
}

.entity-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
  gap: 16px;
}
</style>
