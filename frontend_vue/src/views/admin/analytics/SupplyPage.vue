<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useAnalyticsTranslated } from '@/composables/useAnalytics'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalyticsTranslated('supply')
load()
</script>

<template>
  <h1 class="page-title" data-test="supply-title">{{ t('supply.header_title') }}</h1>
  <AnalyticsSubNav />

  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="kpi-row">
      <div v-for="i in 4" :key="i" class="kpi-card">
        <div class="kpi-icon"><div class="skeleton" style="width:24px;height:24px;border-radius:50%;margin:0" /></div>
        <div class="kpi-label"><div class="skeleton" style="width:70%;height:14px" /></div>
        <div class="kpi-value"><div class="skeleton" style="width:60%;height:22px" /></div>
        <div class="kpi-delta"><div class="skeleton" style="width:40%;height:12px" /></div>
      </div>
    </div>
    <div class="charts-row">
      <GlassPanel :loading="true" :skeleton-rows="5" />
      <GlassPanel :loading="true" :skeleton-rows="5" />
    </div>
  </template>
  <div v-else-if="error" class="error-state">{{ error }}</div>
  <template v-else-if="data">
    <div class="kpi-row" data-test="supply-kpi-row">
      <div
        v-for="kpi in data.kpis"
        :key="kpi.key"
        class="kpi-card"
        data-test="supply-kpi-card"
      >
        <div :class="['kpi-icon', 'icon-' + kpi.iconColor]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div class="kpi-label">{{ t('supply.kpi' + kpi.key.slice(-1) + '_label') }}</div>
        <div class="kpi-value">{{ kpi.value }} <span>{{ kpi.key === 'kpi3' ? t('supply.unit_pcs') : kpi.key === 'kpi2' ? '%' : kpi.key === 'kpi4' ? '%' : 'EUR' }}</span></div>
        <div :class="['kpi-delta', kpi.trend]">{{ kpi.delta }}</div>
      </div>
    </div>

    <div class="charts-row" data-test="supply-charts-row">
      <div class="glass-panel" data-test="supply-suppliers">
        <div class="panel-header">
          <span class="panel-title">{{ t('supply.chart1_title') }}</span>
          <span class="panel-badge">{{ t('supply.badge_march') }}</span>
        </div>
        <table class="data-table" data-test="supply-suppliers-table">
          <thead>
            <tr>
              <th>{{ t('supply.th_supplier') }}</th>
              <th class="hid-320">{{ t('supply.th_deliveries') }}</th>
              <th>{{ t('supply.th_ontime') }}</th>
              <th>{{ t('supply.th_status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(supplier, idx) in data.suppliers" :key="idx" data-test="supply-supplier-row">
              <td>{{ supplier.name }}</td>
              <td class="hid-320">{{ supplier.deliveries }}</td>
              <td>{{ supplier.ontime }}%</td>
              <td>
                <span :class="['status-pill', 'pill-' + supplier.statusType]">{{ tf(supplier.status) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass-panel" data-test="supply-categories">
        <div class="panel-header">
          <span class="panel-title">{{ t('supply.chart2_title') }}</span>
          <span class="panel-badge">{{ t('supply.badge_q1') }}</span>
        </div>
        <div
          v-for="(cat, idx) in data.supplyCategories"
          :key="idx"
          class="bar-chart-row"
          data-test="supply-category-row"
        >
          <span class="bar-label">{{ tf(cat.label) }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: cat.percentage + '%', background: cat.color === 'yellow' ? 'linear-gradient(90deg, #faad14, #ffc53d)' : cat.color === 'blue' ? 'linear-gradient(90deg, #1890ff, #40a9ff)' : 'linear-gradient(90deg, #ff4d4f, #ff7875)' }"
            ></div>
          </div>
          <span class="bar-val">{{ cat.change }}</span>
        </div>
      </div>
    </div>
  </template>
</template>
