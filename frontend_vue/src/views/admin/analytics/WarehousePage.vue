<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useAnalytics } from '@/composables/useAnalytics'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalytics('warehouse')
load()
</script>

<template>
  <h1 class="page-title" data-test="warehouse-title">{{ t('warehouse.header_title') }}</h1>
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
    <div class="kpi-row" data-test="warehouse-kpi-row">
      <div
        v-for="kpi in data.kpis"
        :key="kpi.key"
        class="kpi-card"
        data-test="warehouse-kpi-card"
      >
        <div :class="['kpi-icon', 'icon-' + kpi.iconColor]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div class="kpi-label">{{ t('warehouse.kpi' + kpi.key.slice(-1) + '_label') }}</div>
        <div class="kpi-value">{{ kpi.value }} <span>{{ kpi.key === 'kpi2' ? t('warehouse.unit_items') : kpi.key === 'kpi3' ? t('warehouse.unit_days') : kpi.key === 'kpi4' ? '%' : 'EUR' }}</span></div>
        <div :class="['kpi-delta', kpi.trend]">{{ kpi.delta }}</div>
      </div>
    </div>

    <div class="charts-row" data-test="warehouse-charts-row">
      <div class="glass-panel" data-test="warehouse-deadstock">
        <div class="panel-header">
          <span class="panel-title">{{ t('warehouse.table1_title') }}</span>
          <span class="panel-badge">{{ t('warehouse.badge_march') }}</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('warehouse.th_item') }}</th>
              <th class="hid-320">{{ t('warehouse.th_zone') }}</th>
              <th>{{ t('warehouse.th_sum') }}</th>
              <th>{{ t('warehouse.th_age') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in data.deadstock" :key="idx" data-test="warehouse-deadstock-row">
              <td>{{ tf(item.name) }}</td>
              <td class="hid-320">{{ item.zone }}</td>
              <td>{{ item.sum.toLocaleString() }}</td>
              <td>
                <span :class="['status-pill', 'pill-' + item.ageStatus]">{{ tf(item.age) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass-panel" data-test="warehouse-turnover">
        <div class="panel-header">
          <span class="panel-title">{{ t('warehouse.chart1_title') }}</span>
          <span class="panel-badge">{{ t('warehouse.badge_march') }}</span>
        </div>
        <div
          v-for="(item, idx) in data.turnover"
          :key="idx"
          class="bar-chart-row"
          data-test="warehouse-chart-row"
        >
          <span class="bar-label">{{ tf(item.label) }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: item.percentage + '%', background: item.color === 'green' ? 'linear-gradient(90deg, #52c41a, #73d13d)' : item.color === 'blue' ? 'linear-gradient(90deg, #1890ff, #40a9ff)' : item.color === 'yellow' ? 'linear-gradient(90deg, #faad14, #ffc53d)' : 'linear-gradient(90deg, #ff4d4f, #ff7875)' }"
            ></div>
          </div>
          <span class="bar-val">{{ tf(item.value) }}</span>
        </div>
      </div>
    </div>
  </template>
</template>
