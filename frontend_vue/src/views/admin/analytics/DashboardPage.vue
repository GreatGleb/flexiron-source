<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'
import { useFeatureFlag } from '@/composables/useFeatureFlag'

const { t } = useI18n()
const showAlerts = useFeatureFlag('dashboardAlerts')
const showCharts = useFeatureFlag('dashboardCharts')
</script>

<template>
  <h1 class="page-title" data-test="dashboard-title">{{ t('dashboard.header_title') }}</h1>
  <AnalyticsSubNav />

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
      <div class="kpi-value">127 400 <span>EUR</span></div>
      <div class="kpi-delta up">{{ t('dashboard.kpi1_delta') }}</div>
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
      <div class="kpi-value">38 750 <span>EUR</span></div>
      <div class="kpi-delta down">{{ t('dashboard.kpi2_delta') }}</div>
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
      <div class="kpi-value">84 200 <span>EUR</span></div>
      <div class="kpi-delta up">{{ t('dashboard.kpi3_delta') }}</div>
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
      <div class="kpi-value">14 870 <span>EUR</span></div>
      <div class="kpi-delta neutral">{{ t('dashboard.kpi4_delta') }}</div>
    </div>
  </div>

  <div class="charts-row" data-test="dashboard-charts-row">
    <div v-if="showCharts" class="glass-panel" data-test="dashboard-charts">
      <div class="panel-header">
        <span class="panel-title">{{ t('dashboard.chart1_title') }}</span>
        <span class="panel-badge">{{ t('dashboard.badge_march') }}</span>
      </div>
      <div class="bar-chart">
        <div class="bar-chart-row" data-test="dashboard-chart-row">
          <span class="bar-label">{{ t('dashboard.cat_pipes') }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: 78%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
            ></div>
          </div>
          <span class="bar-val">32 400 €</span>
        </div>
        <div class="bar-chart-row" data-test="dashboard-chart-row">
          <span class="bar-label">{{ t('dashboard.cat_sheets') }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: 55%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
            ></div>
          </div>
          <span class="bar-val">22 800 €</span>
        </div>
        <div class="bar-chart-row" data-test="dashboard-chart-row">
          <span class="bar-label">{{ t('dashboard.cat_profile') }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: 38%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
            ></div>
          </div>
          <span class="bar-val">15 900 €</span>
        </div>
        <div class="bar-chart-row" data-test="dashboard-chart-row">
          <span class="bar-label">{{ t('dashboard.cat_rods') }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: 20%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
            ></div>
          </div>
          <span class="bar-val">8 200 €</span>
        </div>
        <div class="bar-chart-row" data-test="dashboard-chart-row">
          <span class="bar-label">{{ t('dashboard.cat_scraps') }}</span>
          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: 12%; background: linear-gradient(90deg, #52c41a, #73d13d)"
            ></div>
          </div>
          <span class="bar-val">4 900 €</span>
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
