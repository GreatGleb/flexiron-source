<template>
  <div class="screens-page">
    <div class="ambient-glow"></div>

    <div class="header">
      <img :src="logoUrl" alt="Flexiron" class="logo-icon" />
      <div>
        <h1>{{ t('screens.title') }}</h1>
        <p class="subtitle">{{ t('screens.subtitle') }}</p>
      </div>
    </div>

    <h2 class="section-title">{{ t('screens.sectionPublic') }}</h2>
    <div class="pages-grid">
      <router-link
        v-for="page in publicPages"
        :key="page.id"
        :to="page.to"
        class="page-card"
        target="_blank"
      >
        <span class="page-id">{{ page.id }}</span>
        <span class="page-title">{{ t(page.titleKey) }}</span>
        <span class="page-status">
          <span class="status-dot"></span>
          {{ t('screens.statusReady') }}
        </span>
      </router-link>
    </div>

    <h2 class="section-title">{{ t('screens.sectionAnalytics') }}</h2>
    <div class="grid">
      <router-link
        v-for="page in analyticsPages"
        :key="page.id"
        :to="{ name: page.routeName }"
        class="page-card"
        target="_blank"
      >
        <span class="page-id">{{ page.id }}</span>
        <span class="page-title">{{ t(page.titleKey) }}</span>
        <span class="page-status">
          <span class="status-dot"></span>
          {{ t('screens.statusReady') }}
        </span>
      </router-link>
    </div>

    <h2 class="section-title">{{ t('categories.title') }}</h2>
    <div class="grid">
      <router-link
        v-for="page in categoriesPages"
        :key="page.id"
        :to="page.to"
        class="page-card"
        target="_blank"
      >
        <span class="page-id">{{ page.id }}</span>
        <span class="page-title">{{ t(page.titleKey) }}</span>
        <span class="page-status">
          <span class="status-dot"></span>
          {{ t('screens.statusReady') }}
        </span>
      </router-link>
    </div>

    <h2 class="section-title">{{ t('salesCrm.title') }}</h2>
    <div class="grid">
      <router-link
        v-for="page in salesCrmPages"
        :key="page.id"
        :to="{ name: page.routeName, params: page.params || {} }"
        class="page-card"
        target="_blank"
      >
        <span class="page-id">{{ page.id }}</span>
        <span class="page-title">{{ t(page.titleKey) }}</span>
        <span class="page-status">
          <span class="status-dot"></span>
          {{ t('screens.statusReady') }}
        </span>
      </router-link>
    </div>

    <h2 class="section-title">{{ t('screens.sectionProcurement') }}</h2>
    <div class="grid">
      <router-link
        v-for="page in suppliersPages"
        :key="page.id"
        :to="page.to"
        class="page-card"
        target="_blank"
      >
        <span class="page-id">{{ page.id }}</span>
        <span class="page-title">{{ t(page.titleKey) }}</span>
        <span class="page-status">
          <span class="status-dot"></span>
          {{ t('screens.statusReady') }}
        </span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/map_of_screens.css'

const { t } = useI18n()

useHead({
  title: () => t('screens.seo.title'),
  description: () => t('screens.seo.description'),
})

const publicPages = [
  { id: '00.0', to: '/', titleKey: 'screens.p00' },
  { id: '00.1', to: '/login', titleKey: 'screens.p01' },
  { id: '00.2', to: '/register', titleKey: 'screens.p02' },
  { id: '01.0', to: '/support', titleKey: 'screens.p03' },
  { id: '02.0', to: '/about', titleKey: 'screens.p04' },
  { id: '03.0', to: '/terms', titleKey: 'screens.p05' },
  { id: '04.0', to: '/404', titleKey: 'screens.p06' },
  { id: '05.0', to: '/screens', titleKey: 'screens.p07' },
]

const analyticsPages = [
  { id: '7.1', routeName: 'admin-dashboard', titleKey: 'dashboard.header_title' },
  { id: '7.2', routeName: 'admin-analytics-warehouse', titleKey: 'warehouse.header_title' },
  { id: '7.3', routeName: 'admin-sales', titleKey: 'sales.header_title' },
  { id: '7.4', routeName: 'admin-supply', titleKey: 'supply.header_title' },
  { id: '7.5', routeName: 'admin-staff', titleKey: 'staff.header_title' },
  { id: '7.6', routeName: 'admin-logistics', titleKey: 'logistics.header_title' },
  { id: '7.7', routeName: 'admin-pl-report', titleKey: 'plReport.header_title' },
  { id: '7.8', routeName: 'admin-deficit', titleKey: 'deficit.header_title' },
]

const categoriesPages = [
  { id: '1.1', to: { name: 'admin-products' }, titleKey: 'products.header_title' },
  {
    id: '1.1c',
    to: { name: 'admin-product-card', params: { id: 'prod-001' } },
    titleKey: 'products.section_info',
  },
  { id: '1.2', to: { name: 'admin-categories' }, titleKey: 'categories.header_title' },
  { id: '1.3', to: { name: 'admin-services' }, titleKey: 'services.header_title' },
  {
    id: '1.2c',
    to: { name: 'admin-category-card', params: { id: 'cat-1' } },
    titleKey: 'categories.section_info',
  },
]

const salesCrmPages = [
  { id: '3.0', routeName: 'admin-sales-crm', titleKey: 'salesCrm.header_title' },
  { id: '3.1', routeName: 'admin-clients', titleKey: 'clients.header_title' },
  {
    id: '3.1c',
    routeName: 'admin-client-card',
    params: { id: 'CL-001' },
    titleKey: 'clients.card_title',
  },
]

const suppliersPages = [
  { id: '04.0', to: { name: 'admin-suppliers' }, titleKey: 'suppliers.header_title' },
  {
    id: '04.1',
    to: { name: 'admin-supplier-card', params: { id: '1' } },
    titleKey: 'supplier.header_title',
  },
  { id: '04.2', to: { name: 'admin-bcc-request' }, titleKey: 'bcc.header_title' },
  { id: '04.3', to: { name: 'admin-supplier-config' }, titleKey: 'cardConfig.header_title' },
  { id: '04.4', to: { name: 'admin-supplier-create' }, titleKey: 'supplier.create_title' },
]
</script>

<style scoped>
.screens-page {
  position: relative;
  z-index: 10;
  padding: 2rem 2.5rem 3rem;
  flex: 1;
}
</style>
