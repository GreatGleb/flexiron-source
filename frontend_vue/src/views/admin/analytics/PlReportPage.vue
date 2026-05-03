<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useAnalyticsTranslated } from '@/composables/useAnalytics'

import '@styles/admin/analytic_pl-report.css'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalyticsTranslated('pl-report')
load()
</script>

<template>
  <h1 class="page-title" data-test="pl-report-title">{{ t('plReport.header_title') }}</h1>
  <AnalyticsSubNav />

  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="charts-row">
      <GlassPanel :loading="true" :skeleton-rows="8" />
      <GlassPanel :loading="true" :skeleton-rows="5" />
    </div>
  </template>
  <div v-else-if="error" class="error-state">{{ error }}</div>
  <template v-else-if="data">
    <div class="charts-row" data-test="pl-report-charts-row">
      <div class="glass-panel" data-test="pl-report-breakdown">
        <div class="panel-header">
          <span class="panel-title">{{ t('plReport.chart1_title') }}</span>
          <span class="panel-badge">{{ t('plReport.badge_march') }}</span>
        </div>
        <template v-for="(row, idx) in data.plRows" :key="idx">
          <hr v-if="row.isDivider" class="pl-divider" />
          <div v-else :class="['pl-row', row.type === 'total' ? 'pl-total' : '']" data-test="pl-report-breakdown-row">
            <span class="pl-label">{{ tf(row.label) }}</span>
            <span :class="['pl-value', row.type === 'positive' ? 'green' : row.type === 'negative' ? 'red' : '']">{{ row.value }}</span>
          </div>
        </template>
      </div>

      <div class="glass-panel" data-test="pl-report-calendar">
        <div class="panel-header">
          <span class="panel-title">{{ t('plReport.chart2_title') }}</span>
          <span class="panel-badge">{{ t('plReport.badge_april') }}</span>
        </div>
        <div class="calendar-row" data-test="pl-report-calendar-grid">
          <div
            v-for="(evt, idx) in data.calendarEvents"
            :key="idx"
            class="cal-item"
            data-test="pl-report-calendar-item"
          >
            <div class="cal-date">{{ tf(evt.date) }}</div>
            <div class="cal-client">{{ evt.client }}</div>
            <div class="cal-amount" :style="evt.isNegative ? { color: 'var(--danger)' } : {}">{{ evt.amount }}</div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>
