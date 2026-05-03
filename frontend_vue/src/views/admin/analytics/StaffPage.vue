<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useAnalyticsTranslated } from '@/composables/useAnalytics'

const { t } = useI18n()
const { data, loading, error, load, tf } = useAnalyticsTranslated('staff')
load()
</script>

<template>
  <h1 class="page-title" data-test="staff-title">{{ t('staff.header_title') }}</h1>
  <AnalyticsSubNav />

  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="charts-row">
      <GlassPanel :loading="true" :skeleton-rows="5" />
      <GlassPanel :loading="true" :skeleton-rows="5" />
    </div>
    <GlassPanel :loading="true" :skeleton-rows="5" />
  </template>
  <div v-else-if="error" class="error-state">{{ error }}</div>
  <template v-else-if="data">
    <div class="charts-row" data-test="staff-charts-row">
      <div class="glass-panel" data-test="staff-managers">
        <div class="panel-header">
          <span class="panel-title">{{ t('staff.chart1_title') }}</span>
          <span class="panel-badge">{{ t('staff.badge_march') }}</span>
        </div>
        <table class="data-table" data-test="staff-managers-table">
          <thead>
            <tr>
              <th>{{ t('staff.th_manager') }}</th>
              <th>{{ t('staff.th_sales') }}</th>
              <th class="hid-320">{{ t('staff.th_deals') }}</th>
              <th>{{ t('staff.th_margin') }}</th>
              <th class="hid-320">{{ t('staff.th_rating') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(mgr, idx) in data.managers" :key="idx" data-test="staff-manager-row">
              <td>{{ tf(mgr.name) }}</td>
              <td>{{ mgr.sales.toLocaleString() }}</td>
              <td class="hid-320">{{ mgr.deals }}</td>
              <td>{{ mgr.margin }}</td>
              <td class="hid-320">
                <span :class="['status-pill', 'pill-' + mgr.ratingType]">{{ tf(mgr.rating) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass-panel" data-test="staff-warehouse-workers">
        <div class="panel-header">
          <span class="panel-title">{{ t('staff.chart2_title') }}</span>
          <span class="panel-badge">{{ t('staff.badge_march') }}</span>
        </div>
        <table class="data-table" data-test="staff-workers-table">
          <thead>
            <tr>
              <th>{{ t('staff.th_worker') }}</th>
              <th class="hid-320">{{ t('staff.th_orders') }}</th>
              <th>{{ t('staff.th_avgtime') }}</th>
              <th>{{ t('staff.th_errors') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(worker, idx) in data.workers" :key="idx" data-test="staff-worker-row">
              <td>{{ tf(worker.name) }}</td>
              <td class="hid-320">{{ worker.orders }}</td>
              <td>{{ tf(worker.avgTime) }}</td>
              <td><span :class="['status-pill', 'pill-' + worker.errorType]">{{ worker.errors }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="glass-panel" data-test="staff-revenue-dynamics">
      <div class="panel-header">
        <span class="panel-title">{{ t('staff.chart3_title') }}</span>
        <span class="panel-badge">{{ t('staff.badge_q1') }}</span>
      </div>
      <div
        v-for="(rev, idx) in data.revenues"
        :key="idx"
        class="bar-chart-row"
        data-test="staff-revenue-row"
      >
        <span class="bar-label">{{ tf(rev.name) }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{ width: rev.percentage + '%', background: rev.color === 'green' ? 'linear-gradient(90deg, #52c41a, #73d13d)' : rev.color === 'blue' ? 'linear-gradient(90deg, #1890ff, #40a9ff)' : rev.color === 'yellow' ? 'linear-gradient(90deg, #faad14, #ffc53d)' : 'linear-gradient(90deg, #ff4d4f, #ff7875)' }"
          ></div>
        </div>
        <span class="bar-val">{{ rev.value.toLocaleString() }} €</span>
      </div>
    </div>
  </template>
</template>
