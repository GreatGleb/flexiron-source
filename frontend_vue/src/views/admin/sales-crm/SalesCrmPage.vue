<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useRouter } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

import '@styles/admin/sales_crm.css'

const { t } = useI18n()
const router = useRouter()

useHead({
  title: () => `Flexiron — ${t('salesCrm.title')}`,
  description: () => t('salesCrm.header_title'),
})

function goToClients() {
  router.push({ name: 'admin-clients' })
}
</script>

<template>
  <div class="page-sales-crm" data-test="page-sales-crm">
    <div class="page-header" data-test="sales-crm-header">
      <h1 class="page-title">{{ t('salesCrm.header_title') }}</h1>
    </div>

    <!-- Module navigation cards -->
    <div class="sales-crm-grid" data-test="sales-crm-grid">
      <!-- Clients card -->
      <GlassPanel class="sales-crm-card" data-test="sales-crm-card-clients" @click="goToClients">
        <div class="sales-crm-card-icon">
          <SvgIcon name="staff-user" :width="24" :height="24" />
        </div>
        <div class="sales-crm-card-body">
          <h3 class="sales-crm-card-title">{{ t('salesCrm.clients_link') }}</h3>
          <p class="sales-crm-card-desc">{{ t('salesCrm.clients_desc') }}</p>
        </div>
        <div class="sales-crm-card-action">
          <span>{{ t('clients.title') }}</span>
          <SvgIcon name="chevron-right" :width="16" :height="16" />
        </div>
      </GlassPanel>

      <!-- Orders card (placeholder / coming soon) -->
      <GlassPanel class="sales-crm-card disabled" data-test="sales-crm-card-orders">
        <div class="sales-crm-card-icon" style="background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.35);">
          <SvgIcon name="shopping-cart" :width="24" :height="24" />
        </div>
        <div class="sales-crm-card-body">
          <h3 class="sales-crm-card-title">{{ t('salesCrm.orders_link') }}</h3>
          <p class="sales-crm-card-desc">{{ t('salesCrm.orders_desc') }}</p>
        </div>
        <div class="sales-crm-card-action">
          <span class="sales-crm-card-badge">{{ t('salesCrm.orders_coming_soon') }}</span>
        </div>
      </GlassPanel>
    </div>
  </div>
</template>
