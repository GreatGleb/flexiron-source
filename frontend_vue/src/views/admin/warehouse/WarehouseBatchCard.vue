<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { getBatch } from '@/services/warehouseService'
import { useTranslatedField } from '@/composables/useTranslatedData'
import type { WarehouseBatch } from '@/types/warehouse'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { tf } = useTranslatedField()

const batch = ref<WarehouseBatch | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const BATCH_STATUS_PILL: Record<string, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  partial: 'pill-warning',
  depleted: 'pill-muted',
  quarantine: 'pill-danger',
}

async function load() {
  const id = route.params.id as string
  loading.value = true
  error.value = null
  try {
    batch.value = await getBatch(id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load batch'
  } finally {
    loading.value = false
  }
}

useHead({
  title: () => `Flexiron — ${t('warehouse.batch_card_title')}`,
  description: () => t('warehouse.batch_card_title'),
})

onMounted(load)
</script>

<template>
  <div class="page-batch-card" data-test="page-batch-card">
    <Breadcrumb
      :items="[
        { label: t('warehouse.header_title'), to: { name: 'admin-warehouse' } },
        { label: batch ? tf(batch.productName) : '...' },
      ]"
    />

    <GlassPanel :loading="loading" :skeleton-rows="12" data-test="batch-card-panel">
      <div v-if="error" class="error-state" data-test="batch-card-error">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>

      <div v-else-if="batch" class="batch-card-content" data-test="batch-card-content">
        <div class="batch-card-header">
          <h1 class="page-title">{{ tf(batch.productName) }}</h1>
          <span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]">
            {{ t(`warehouse.batch_status_${batch.status}`) }}
          </span>
        </div>

        <div class="batch-card-grid">
          <div class="batch-card-section">
            <h3>{{ t('warehouse.batch_section_general') }}</h3>
            <dl class="batch-card-dl">
              <dt>{{ t('warehouse.col_batch_number') }}</dt>
              <dd><code>{{ batch.batchNumber }}</code></dd>
              <dt>{{ t('warehouse.col_lot_code') }}</dt>
              <dd><code>{{ batch.lotCode }}</code></dd>
              <dt>{{ t('warehouse.col_supplier') }}</dt>
              <dd>{{ batch.supplierName ? tf(batch.supplierName) : '—' }}</dd>
              <dt>{{ t('warehouse.col_location') }}</dt>
              <dd>{{ batch.location ?? '—' }}</dd>
            </dl>
          </div>

          <div class="batch-card-section">
            <h3>{{ t('warehouse.batch_section_quantities') }}</h3>
            <dl class="batch-card-dl">
              <dt>{{ t('warehouse.col_quantity') }}</dt>
              <dd>{{ batch.quantity }} {{ t(`warehouse.unit_${batch.unit}`) }}</dd>
              <dt>{{ t('warehouse.col_remaining') }}</dt>
              <dd :class="{ 'text-danger': batch.quantityRemaining <= 0 }">
                {{ batch.quantityRemaining }} {{ t(`warehouse.unit_${batch.unit}`) }}
              </dd>
              <dt>{{ t('warehouse.col_unit_price') }}</dt>
              <dd>{{ batch.unitPrice.toFixed(2) }} €</dd>
              <dt>{{ t('warehouse.col_total_cost') }}</dt>
              <dd>{{ batch.totalCost.toFixed(2) }} €</dd>
            </dl>
          </div>

          <div class="batch-card-section">
            <h3>{{ t('warehouse.batch_section_dates') }}</h3>
            <dl class="batch-card-dl">
              <dt>{{ t('warehouse.col_received') }}</dt>
              <dd>{{ batch.receivedAt.slice(0, 10) }}</dd>
              <dt>{{ t('warehouse.col_expires') }}</dt>
              <dd>{{ batch.expiresAt ? batch.expiresAt.slice(0, 10) : '—' }}</dd>
              <dt>{{ t('warehouse.col_certificate') }}</dt>
              <dd>{{ batch.certificateRef ?? '—' }}</dd>
            </dl>
          </div>

          <div v-if="batch.notes" class="batch-card-section batch-card-section-full">
            <h3>{{ t('warehouse.batch_section_notes') }}</h3>
            <p class="batch-notes">{{ batch.notes }}</p>
          </div>
        </div>

        <div class="batch-card-actions">
          <button class="btn btn-ghost" @click="router.back()">
            <SvgIcon name="arrow-left" :width="18" :height="18" />
            {{ t('btn.back') }}
          </button>
        </div>
      </div>
    </GlassPanel>
  </div>
</template>
