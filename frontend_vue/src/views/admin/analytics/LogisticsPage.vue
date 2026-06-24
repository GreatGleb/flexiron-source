<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import { useAnalytics } from '@/composables/useAnalytics'
import GlassPanel from '@/components/admin/GlassPanel.vue'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalytics('logistics')
load()
</script>

<template>
  <h1 class="page-title" data-test="logistics-title">{{ t('logistics.header_title') }}</h1>
  <AnalyticsSubNav />

  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="kpi-row">
      <div v-for="i in 4" :key="i" class="kpi-card">
        <div class="kpi-icon">
          <div class="skeleton" style="width: 24px; height: 24px; border-radius: 50%; margin: 0" />
        </div>
        <div class="kpi-label"><div class="skeleton" style="width: 70%; height: 14px" /></div>
        <div class="kpi-value"><div class="skeleton" style="width: 60%; height: 22px" /></div>
        <div class="kpi-delta"><div class="skeleton" style="width: 40%; height: 12px" /></div>
      </div>
    </div>
    <div class="charts-row">
      <GlassPanel :loading="true" :skeleton-rows="5" />
      <GlassPanel :loading="true" :skeleton-rows="5" />
    </div>
  </template>
  <div v-else-if="error" class="error-state">{{ error }}</div>
  <template v-else-if="data">
    <div class="kpi-row" data-test="logistics-kpi-row">
      <div v-for="kpi in data.kpis" :key="kpi.key" class="kpi-card" data-test="logistics-kpi-card">
        <div :class="['kpi-icon', 'icon-' + kpi.iconColor]">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <div class="kpi-label">{{ tf(kpi.label) }}</div>
        <div class="kpi-value">{{ kpi.value }}</div>
        <div :class="['kpi-delta', kpi.trend]">{{ kpi.delta }}</div>
      </div>
    </div>

    <div class="charts-row" data-test="logistics-charts-row">
      <div class="glass-panel" data-test="logistics-routes">
        <div class="panel-header">
          <span class="panel-title">{{ t('logistics.chart1_title') }}</span>
          <span class="panel-badge">{{ t('logistics.badge_march') }}</span>
        </div>
        <table class="data-table" data-test="logistics-routes-table">
          <thead>
            <tr>
              <th>{{ t('logistics.th_route') }}</th>
              <th class="hid-320">{{ t('logistics.th_trips') }}</th>
              <th class="hid-320">{{ t('logistics.th_load') }}</th>
              <th>{{ t('logistics.th_revenue') }}</th>
              <th>{{ t('logistics.th_status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(route, idx) in data.routes" :key="idx" data-test="logistics-route-row">
              <td>{{ tf(route.route) }}</td>
              <td class="hid-320">{{ route.trips }}</td>
              <td class="hid-320">{{ route.load }}</td>
              <td>{{ route.revenue.toLocaleString() }}</td>
              <td>
                <span :class="['status-pill', 'pill-' + route.statusType]">{{
                  tf(route.status)
                }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass-panel" data-test="logistics-load">
        <div class="panel-header">
          <span class="panel-title">{{ t('logistics.chart2_title') }}</span>
          <span class="panel-badge">{{ t('logistics.badge_march') }}</span>
        </div>
        <div
          v-for="(loadItem, idx) in data.loads"
          :key="idx"
          class="bar-chart-row"
          data-test="logistics-load-row"
        >
          <span class="bar-label">{{ tf(loadItem.label) }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{
                width: loadItem.percentage + '%',
                background:
                  loadItem.color === 'green'
                    ? 'linear-gradient(90deg, #52c41a, #73d13d)'
                    : loadItem.color === 'blue'
                      ? 'linear-gradient(90deg, #1890ff, #40a9ff)'
                      : 'linear-gradient(90deg, #faad14, #ffc53d)',
              }"
            ></div>
          </div>
          <span class="bar-val">{{ loadItem.value }}</span>
        </div>
      </div>
    </div>
  </template>
</template>
