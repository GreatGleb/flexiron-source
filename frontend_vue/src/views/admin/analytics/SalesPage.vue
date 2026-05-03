<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useAnalyticsTranslated } from '@/composables/useAnalytics'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalyticsTranslated('sales')
load()
</script>

<template>
  <h1 class="page-title" data-test="sales-title">{{ t('sales.header_title') }}</h1>
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
    <div class="kpi-row" data-test="sales-kpi-row">
      <div
        v-for="kpi in data.kpis"
        :key="kpi.key"
        class="kpi-card"
        data-test="sales-kpi-card"
      >
        <div :class="['kpi-icon', 'icon-' + kpi.iconColor]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div class="kpi-label">{{ t('sales.kpi' + kpi.key.slice(-1) + '_label') }}</div>
        <div class="kpi-value">{{ kpi.value }} <span>{{ kpi.key === 'kpi2' || kpi.key === 'kpi3' ? t('sales.unit_pcs') : 'EUR' }}</span></div>
        <div :class="['kpi-delta', kpi.trend]">{{ kpi.delta }}</div>
      </div>
    </div>

    <div class="charts-row" data-test="sales-charts-row">
      <div class="glass-panel" data-test="sales-top-clients">
        <div class="panel-header">
          <span class="panel-title">{{ t('sales.chart1_title') }}</span>
          <span class="panel-badge">{{ t('sales.badge_march') }}</span>
        </div>
        <div
          v-for="(client, idx) in data.topClients"
          :key="idx"
          class="bar-chart-row"
          data-test="sales-top-clients-row"
        >
          <span class="bar-label">{{ client.name }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: client.percentage + '%', background: client.color === 'blue' ? 'linear-gradient(90deg, #1890ff, #40a9ff)' : 'linear-gradient(90deg, #52c41a, #73d13d)' }"
            ></div>
          </div>
          <span class="bar-val">{{ client.value.toLocaleString() }} €</span>
        </div>
      </div>

      <div class="glass-panel" data-test="sales-refusal-reasons">
        <div class="panel-header">
          <span class="panel-title">{{ t('sales.chart2_title') }}</span>
          <span class="panel-badge">{{ t('sales.badge_deals') }}</span>
        </div>
        <div
          v-for="(reason, idx) in data.refusalReasons"
          :key="idx"
          class="bar-chart-row"
          data-test="sales-refusal-row"
        >
          <span class="bar-label">{{ tf(reason.label) }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: reason.percentage + '%', background: reason.color === 'red' ? 'linear-gradient(90deg, #ff4d4f, #ff7875)' : reason.color === 'yellow' ? 'linear-gradient(90deg, #faad14, #ffc53d)' : 'linear-gradient(90deg, #1890ff, #40a9ff)' }"
            ></div>
          </div>
          <span class="bar-val">{{ reason.percentage }}%</span>
        </div>
      </div>
    </div>
  </template>
</template>
