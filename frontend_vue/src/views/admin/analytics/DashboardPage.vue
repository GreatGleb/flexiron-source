<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useAnalytics } from '@/composables/useAnalytics'

const { t } = useI18n()
const showAlerts = useFeatureFlag('dashboardAlerts')
const showCharts = useFeatureFlag('dashboardCharts')
const { data, loading, error, load, tf } = useAnalytics('dashboard')
load()

/** Map icon name → SVG path for KPI cards */
const kpiIconPaths: Record<string, string> = {
  'chart-bar': 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  receipt:
    'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
  'trending-up': 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  currency:
    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  alert:
    'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
}

/** Map alert status → pill CSS class */
const alertPillClass: Record<string, string> = {
  critical: 'pill-danger',
  overdue: 'pill-danger',
  risk: 'pill-warning',
  pending: 'pill-warning',
  ok: 'pill-success',
}

/** Map alert status → i18n label key */
const alertStatusLabel: Record<string, string> = {
  critical: 'status_critical',
  overdue: 'status_overdue',
  risk: 'status_risk',
  pending: 'status_pending',
  ok: 'status_ok',
}
</script>

<template>
  <h1 class="page-title" data-test="dashboard-title">{{ t('dashboard.header_title') }}</h1>
  <AnalyticsSubNav />

  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="kpi-row">
      <div v-for="i in 5" :key="i" class="kpi-card">
        <div class="kpi-icon">
          <div class="skeleton" style="width: 24px; height: 24px; border-radius: 50%; margin: 0" />
        </div>
        <div class="kpi-label"><div class="skeleton" style="width: 70%; height: 14px" /></div>
        <div class="kpi-value"><div class="skeleton" style="width: 60%; height: 22px" /></div>
        <div class="kpi-delta"><div class="skeleton" style="width: 40%; height: 12px" /></div>
      </div>
    </div>
    <div class="charts-row">
      <GlassPanel v-if="showCharts" :loading="true" :skeleton-rows="5" />
      <GlassPanel v-if="showAlerts" :loading="true" :skeleton-rows="5" />
    </div>
    <div class="section-label"><div class="skeleton" style="width: 120px; height: 18px" /></div>
    <div class="analytics-grid">
      <div v-for="i in 4" :key="i" class="acard">
        <div class="acard-num"><div class="skeleton" style="width: 50%; height: 14px" /></div>
        <div class="acard-title"><div class="skeleton" style="width: 80%; height: 16px" /></div>
        <div class="acard-metrics">
          <div v-for="j in 2" :key="j" class="acard-metric">
            <div class="skeleton" style="width: 100%; height: 14px" />
          </div>
        </div>
      </div>
    </div>
  </template>

  <div v-else-if="error" class="error-state">{{ error }}</div>
  <template v-else-if="data">
    <!-- ─── KPI Row: dynamic from data.kpis ─── -->
    <div class="kpi-row" data-test="dashboard-kpi-row">
      <div v-for="kpi in data.kpis" :key="kpi.key" class="kpi-card" data-test="dashboard-kpi-card">
        <div class="kpi-icon" :class="'icon-' + kpi.iconColor">
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
            <path :d="kpiIconPaths[kpi.icon] ?? ''" />
          </svg>
        </div>
        <div class="kpi-label">{{ tf(kpi.label) }}</div>
        <div class="kpi-value">{{ kpi.value }}</div>
        <div class="kpi-delta" :class="kpi.trend">{{ kpi.delta }}</div>
      </div>
    </div>

    <!-- ─── Charts + Alerts ─── -->
    <div class="charts-row" data-test="dashboard-charts-row">
      <div v-if="showCharts" class="glass-panel" data-test="dashboard-charts">
        <div class="panel-header">
          <span class="panel-title">{{ t('dashboard.chart1_title') }}</span>
          <span class="panel-badge">{{ t('dashboard.badge_march') }}</span>
        </div>
        <div class="bar-chart">
          <div
            v-for="item in data?.salesByCategory ?? []"
            :key="item.label.ru"
            class="bar-chart-row"
            data-test="dashboard-chart-row"
          >
            <span class="bar-label">{{ tf(item.label) }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :style="{
                  width: item.percentage + '%',
                  background: 'linear-gradient(90deg, #1890ff, #40a9ff)',
                }"
              />
            </div>
            <span class="bar-val">{{
              item.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'
            }}</span>
          </div>
        </div>
      </div>

      <!-- ─── Alerts table: dynamic from data.alerts ─── -->
      <div v-if="showAlerts" class="glass-panel" data-test="dashboard-alerts">
        <div class="panel-header">
          <span class="panel-title">{{ t('dashboard.chart2_title') }}</span>
          <span class="panel-badge">{{ t('dashboard.badge_today') }}</span>
        </div>
        <table class="alerts-table">
          <thead>
            <tr>
              <th>{{ t('dashboard.th_type') }}</th>
              <th>{{ t('dashboard.th_desc') }}</th>
              <th>{{ t('dashboard.th_status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="alert in data.alerts" :key="alert.type.ru" data-test="dashboard-alert-row">
              <td>{{ tf(alert.type) }}</td>
              <td>{{ tf(alert.description) }}</td>
              <td>
                <span class="status-pill" :class="alertPillClass[alert.status] ?? ''">
                  {{ t('dashboard.' + (alertStatusLabel[alert.status] ?? 'status_ok')) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ─── Section Previews: dynamic from data.sectionPreviews ─── -->
    <div class="section-label">{{ t('dashboard.sections_label') }}</div>
    <div class="analytics-grid" data-test="dashboard-analytics-grid">
      <router-link
        v-for="section in data.sectionPreviews"
        :key="section.key"
        class="acard"
        :to="'/admin/analytics/' + section.key"
        data-test="dashboard-acard"
      >
        <div class="acard-num">{{ t('sub.' + section.key) }}</div>
        <div class="acard-title">{{ tf(section.title) }}</div>
        <div class="acard-metrics">
          <div v-for="metric in section.metrics" :key="metric.label.ru" class="acard-metric">
            <span>{{ tf(metric.label) }}</span>
            <strong :class="metric.status ?? ''">{{ metric.value }}</strong>
          </div>
        </div>
        <div class="acard-footer">
          <span class="acard-link">
            {{ t('dashboard.open_link') }}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </router-link>
    </div>
  </template>
</template>
