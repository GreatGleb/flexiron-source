<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useAnalyticsTranslated } from '@/composables/useAnalytics'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalyticsTranslated('deficit')
load()
</script>

<template>
  <h1 class="page-title" data-test="deficit-title">{{ t('deficit.header_title') }}</h1>
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
    <div class="kpi-row" data-test="deficit-kpi-row">
      <div
        v-for="kpi in data.kpis"
        :key="kpi.key"
        class="kpi-card"
        data-test="deficit-kpi-card"
      >
        <div :class="['kpi-icon', 'icon-' + kpi.iconColor]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div class="kpi-label">{{ t('deficit.kpi' + kpi.key.slice(-1) + '_label') }}</div>
        <div class="kpi-value">{{ kpi.value }} <span>{{ kpi.key === 'kpi1' ? t('deficit.unit_pcs') : kpi.key === 'kpi3' || kpi.key === 'kpi4' ? t('deficit.unit_items') : 'EUR' }}</span></div>
        <div :class="['kpi-delta', kpi.trend]">{{ kpi.delta }}</div>
      </div>
    </div>

    <div class="charts-row" data-test="deficit-charts-row">
      <div class="glass-panel" data-test="deficit-items">
        <div class="panel-header">
          <span class="panel-title">{{ t('deficit.chart1_title') }}</span>
          <span class="panel-badge">{{ t('deficit.badge_signal') }}</span>
        </div>
        <table class="data-table" data-test="deficit-items-table">
          <thead>
            <tr>
              <th>{{ t('deficit.th_item') }}</th>
              <th class="hid-320">{{ t('deficit.th_stock') }}</th>
              <th class="hid-320">{{ t('deficit.th_min') }}</th>
              <th>{{ t('deficit.th_refusals') }}</th>
              <th>{{ t('deficit.th_status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in data.deficitItems" :key="idx" data-test="deficit-item-row">
              <td>{{ tf(item.name) }}</td>
              <td class="hid-320">{{ item.stock }} {{ t('deficit.unit_t') }}</td>
              <td class="hid-320">{{ item.min }} {{ t('deficit.unit_t') }}</td>
              <td>{{ item.refusals }}</td>
              <td>
                <span :class="['status-pill', 'pill-' + item.statusType]">{{ tf(item.status) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass-panel" data-test="deficit-refusals">
        <div class="panel-header">
          <span class="panel-title">{{ t('deficit.chart2_title') }}</span>
          <span class="panel-badge">{{ t('deficit.badge_autolist') }}</span>
        </div>
        <div
          v-for="(vol, idx) in data.refusalVolumes"
          :key="idx"
          class="bar-chart-row"
          data-test="deficit-refusals-row"
        >
          <span class="bar-label">{{ tf(vol.name) }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              :style="{ width: vol.percentage + '%', background: vol.color === 'red' ? 'linear-gradient(90deg, #ff4d4f, #ff7875)' : vol.color === 'yellow' ? 'linear-gradient(90deg, #faad14, #ffc53d)' : 'linear-gradient(90deg, #1890ff, #40a9ff)' }"
            ></div>
          </div>
          <span class="bar-val">{{ vol.value }}</span>
        </div>
      </div>
    </div>
  </template>
</template>
