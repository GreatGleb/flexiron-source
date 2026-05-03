<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useAnalyticsTranslated } from '@/composables/useAnalytics'

const { t } = useI18n()
const showAlerts = useFeatureFlag('dashboardAlerts')
const showCharts = useFeatureFlag('dashboardCharts')
const { data, loading, error, load, tf } = useAnalyticsTranslated('dashboard')
load()

function formatCurrency(val: number): string {
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €'
}
</script>

<template>
  <h1 class="page-title" data-test="dashboard-title">{{ t('dashboard.header_title') }}</h1>
  <AnalyticsSubNav />

  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="kpi-row">
      <div v-for="i in 5" :key="i" class="kpi-card">
        <div class="kpi-icon"><div class="skeleton" style="width:24px;height:24px;border-radius:50%;margin:0" /></div>
        <div class="kpi-label"><div class="skeleton" style="width:70%;height:14px" /></div>
        <div class="kpi-value"><div class="skeleton" style="width:60%;height:22px" /></div>
        <div class="kpi-delta"><div class="skeleton" style="width:40%;height:12px" /></div>
      </div>
    </div>
    <div class="charts-row">
      <GlassPanel v-if="showCharts" :loading="true" :skeleton-rows="5" />
      <GlassPanel v-if="showAlerts" :loading="true" :skeleton-rows="5" />
    </div>
    <div class="section-label"><div class="skeleton" style="width:120px;height:18px" /></div>
    <div class="analytics-grid">
      <div v-for="i in 7" :key="i" class="acard">
        <div class="acard-num"><div class="skeleton" style="width:50%;height:14px" /></div>
        <div class="acard-title"><div class="skeleton" style="width:80%;height:16px" /></div>
        <div class="acard-metrics">
          <div v-for="j in 3" :key="j" class="acard-metric">
            <div class="skeleton" style="width:100%;height:14px" />
          </div>
        </div>
      </div>
    </div>
  </template>

  <div v-else-if="error" class="error-state">{{ error }}</div>
  <template v-else-if="data">
    <div class="kpi-row" data-test="dashboard-kpi-row">
    <div class="kpi-card" data-test="dashboard-kpi-card">
      <div class="kpi-icon icon-blue">
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
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('dashboard.kpi1_label') }}</div>
      <div class="kpi-value">{{ data?.kpis[0]?.value }} <span>EUR</span></div>
      <div class="kpi-delta" :class="data?.kpis[0]?.trend">{{ t('dashboard.kpi1_delta') }}</div>
    </div>
    <div class="kpi-card" data-test="dashboard-kpi-card">
      <div class="kpi-icon icon-red">
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
          <path
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('dashboard.kpi2_label') }}</div>
      <div class="kpi-value">{{ data?.kpis[1]?.value }} <span>EUR</span></div>
      <div class="kpi-delta" :class="data?.kpis[1]?.trend">{{ t('dashboard.kpi2_delta') }}</div>
    </div>
    <div class="kpi-card" data-test="dashboard-kpi-card">
      <div class="kpi-icon icon-green">
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
          <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('dashboard.kpi3_label') }}</div>
      <div class="kpi-value">{{ data?.kpis[2]?.value }} <span>EUR</span></div>
      <div class="kpi-delta" :class="data?.kpis[2]?.trend">{{ t('dashboard.kpi3_delta') }}</div>
    </div>
    <div class="kpi-card" data-test="dashboard-kpi-card">
      <div class="kpi-icon icon-gold">
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
          <path
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('dashboard.kpi4_label') }}</div>
      <div class="kpi-value">{{ data?.kpis[3]?.value }} <span>EUR</span></div>
      <div class="kpi-delta" :class="data?.kpis[3]?.trend">{{ t('dashboard.kpi4_delta') }}</div>
    </div>
    <div class="kpi-card" data-test="dashboard-kpi-card">
      <div class="kpi-icon icon-red">
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
          <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('dashboard.kpi5_label') }}</div>
      <div class="kpi-value">{{ data?.kpis[4]?.value }} <span>{{ t('dashboard.unit_pcs') }}</span></div>
      <div class="kpi-delta" :class="data?.kpis[4]?.trend">{{ t('dashboard.kpi5_delta') }}</div>
    </div>
  </div>

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
              :style="{ width: item.percentage + '%', background: 'linear-gradient(90deg, #1890ff, #40a9ff)' }"
            ></div>
          </div>
          <span class="bar-val">{{ formatCurrency(item.value) }}</span>
        </div>
      </div>
    </div>

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
          <tr data-test="dashboard-alert-row">
            <td>{{ t('dashboard.alert_deficit') }}</td>
            <td>{{ t('dashboard.alert_desc1') }}</td>
            <td>
              <span class="status-pill pill-danger">{{ t('dashboard.status_critical') }}</span>
            </td>
          </tr>
          <tr data-test="dashboard-alert-row">
            <td>{{ t('dashboard.alert_receivable') }}</td>
            <td>{{ t('dashboard.alert_desc2') }}</td>
            <td>
              <span class="status-pill pill-danger">{{ t('dashboard.status_overdue') }}</span>
            </td>
          </tr>
          <tr data-test="dashboard-alert-row">
            <td>{{ t('dashboard.alert_deadstock') }}</td>
            <td>{{ t('dashboard.alert_desc3') }}</td>
            <td>
              <span class="status-pill pill-warning">{{ t('dashboard.status_risk') }}</span>
            </td>
          </tr>
          <tr data-test="dashboard-alert-row">
            <td>{{ t('dashboard.alert_delivery') }}</td>
            <td>{{ t('dashboard.alert_desc4') }}</td>
            <td>
              <span class="status-pill pill-warning">{{ t('dashboard.status_pending') }}</span>
            </td>
          </tr>
          <tr data-test="dashboard-alert-row">
            <td>{{ t('dashboard.alert_payment') }}</td>
            <td>{{ t('dashboard.alert_desc5') }}</td>
            <td>
              <span class="status-pill pill-success">{{ t('dashboard.status_ok') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section-label">{{ t('dashboard.sections_label') }}</div>
  <div class="analytics-grid" data-test="dashboard-analytics-grid">
    <router-link class="acard" to="/admin/analytics/warehouse" data-test="dashboard-acard">
      <div class="acard-num">{{ t('sub.warehouse') }}</div>
      <div class="acard-title">{{ t('dashboard.card2Title') }}</div>
      <div class="acard-metrics">
        <div class="acard-metric">
          <span>{{ t('dashboard.card2m1') }}</span
          ><strong class="ok">127 400 €</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card2m2') }}</span
          ><strong class="bad">{{ t('dashboard.card2v2') }}</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card2m3') }}</span
          ><strong class="warn">{{ t('dashboard.card2v3') }}</strong>
        </div>
      </div>
      <div class="acard-footer">
        <span class="acard-link"
          >{{ t('dashboard.open_link') }}
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
            <path d="M9 5l7 7-7 7" /></svg
        ></span>
      </div>
    </router-link>

    <router-link class="acard" to="/admin/analytics/sales" data-test="dashboard-acard">
      <div class="acard-num">{{ t('sub.sales') }}</div>
      <div class="acard-title">{{ t('dashboard.card3Title') }}</div>
      <div class="acard-metrics">
        <div class="acard-metric">
          <span>{{ t('dashboard.card3m1') }}</span
          ><strong class="ok">84 200 €</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card3m2') }}</span
          ><strong class="ok">68%</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card3m3') }}</span
          ><strong class="bad">11 400 €</strong>
        </div>
      </div>
      <div class="acard-footer">
        <span class="acard-link"
          >{{ t('dashboard.open_link') }}
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
            <path d="M9 5l7 7-7 7" /></svg
        ></span>
      </div>
    </router-link>

    <router-link class="acard" to="/admin/analytics/supply" data-test="dashboard-acard">
      <div class="acard-num">{{ t('sub.supply') }}</div>
      <div class="acard-title">{{ t('dashboard.card4Title') }}</div>
      <div class="acard-metrics">
        <div class="acard-metric">
          <span>{{ t('dashboard.card4m1') }}</span
          ><strong class="ok">58 200 €</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card4m2') }}</span
          ><strong class="warn">84%</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card4m3') }}</span
          ><strong class="bad">{{ t('dashboard.card4v3') }}</strong>
        </div>
      </div>
      <div class="acard-footer">
        <span class="acard-link"
          >{{ t('dashboard.open_link') }}
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
            <path d="M9 5l7 7-7 7" /></svg
        ></span>
      </div>
    </router-link>

    <router-link class="acard" to="/admin/analytics/staff" data-test="dashboard-acard">
      <div class="acard-num">{{ t('sub.staff') }}</div>
      <div class="acard-title">{{ t('dashboard.card5Title') }}</div>
      <div class="acard-metrics">
        <div class="acard-metric">
          <span>{{ t('dashboard.card5m1') }}</span
          ><strong class="ok">{{ t('dashboard.card5v1') }}</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card5m2') }}</span
          ><strong class="ok">22.4%</strong>
        </div>
        <div class="acard-metric">
          <span>{{ t('dashboard.card5m3') }}</span
          ><strong class="bad">{{ t('dashboard.card5v3') }}</strong>
        </div>
      </div>
      <div class="acard-footer">
        <span class="acard-link"
          >{{ t('dashboard.open_link') }}
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
            <path d="M9 5l7 7-7 7" /></svg
        ></span>
      </div>
    </router-link>

    <div class="row2">
      <router-link class="acard" to="/admin/analytics/logistics" data-test="dashboard-acard">
        <div class="acard-num">{{ t('sub.logistics') }}</div>
        <div class="acard-title">{{ t('dashboard.card6Title') }}</div>
        <div class="acard-metrics">
          <div class="acard-metric">
            <span>{{ t('dashboard.card6m1') }}</span
            ><strong class="ok">34</strong>
          </div>
          <div class="acard-metric">
            <span>{{ t('dashboard.card6m2') }}</span
            ><strong class="bad">5 (14.7%)</strong>
          </div>
          <div class="acard-metric">
            <span>{{ t('dashboard.card6m3') }}</span
            ><strong class="warn">62%</strong>
          </div>
        </div>
        <div class="acard-footer">
          <span class="acard-link"
            >{{ t('dashboard.open_link') }}
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
              <path d="M9 5l7 7-7 7" /></svg
          ></span>
        </div>
      </router-link>

      <router-link class="acard" to="/admin/analytics/pl-report" data-test="dashboard-acard">
        <div class="acard-num">{{ t('sub.pl') }}</div>
        <div class="acard-title">{{ t('dashboard.card7Title') }}</div>
        <div class="acard-metrics">
          <div class="acard-metric">
            <span>{{ t('dashboard.card7m1') }}</span
            ><strong class="ok">14 870 €</strong>
          </div>
          <div class="acard-metric">
            <span>{{ t('dashboard.card7m2') }}</span
            ><strong class="ok">17.7%</strong>
          </div>
          <div class="acard-metric">
            <span>{{ t('dashboard.card7m3') }}</span
            ><strong class="warn">{{ t('dashboard.card7v3') }}</strong>
          </div>
        </div>
        <div class="acard-footer">
          <span class="acard-link"
            >{{ t('dashboard.open_link') }}
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
              <path d="M9 5l7 7-7 7" /></svg
          ></span>
        </div>
      </router-link>

      <router-link class="acard" to="/admin/analytics/deficit" data-test="dashboard-acard">
        <div class="acard-num">{{ t('sub.deficit') }}</div>
        <div class="acard-title">{{ t('dashboard.card8Title') }}</div>
        <div class="acard-metrics">
          <div class="acard-metric">
            <span>{{ t('dashboard.card8m1') }}</span
            ><strong class="bad">{{ t('dashboard.card8v1') }}</strong>
          </div>
          <div class="acard-metric">
            <span>{{ t('dashboard.card8m2') }}</span
            ><strong class="warn">{{ t('dashboard.card8v2') }}</strong>
          </div>
          <div class="acard-metric">
            <span>{{ t('dashboard.card3m3') }}</span
            ><strong class="bad">4 800 €</strong>
          </div>
        </div>
        <div class="acard-footer">
          <span class="acard-link"
            >{{ t('dashboard.open_link') }}
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
              <path d="M9 5l7 7-7 7" /></svg
          ></span>
        </div>
      </router-link>
      </div>
    </div>
  </template>
</template>
