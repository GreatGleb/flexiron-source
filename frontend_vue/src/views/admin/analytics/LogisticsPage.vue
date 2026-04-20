<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="logistics-title">{{ t('logistics.header_title') }}</h1>
  <AnalyticsSubNav />

  <div class="kpi-row" data-test="logistics-kpi-row">
    <div class="kpi-card" data-test="logistics-kpi-card">
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
          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('logistics.kpi1_label') }}</div>
      <div class="kpi-value">34 <span>pcs.</span></div>
      <div class="kpi-delta up">{{ t('logistics.delta1') }}</div>
    </div>
    <div class="kpi-card" data-test="logistics-kpi-card">
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
          <path
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('logistics.kpi2_label') }}</div>
      <div class="kpi-value">7.4 <span>t</span></div>
      <div class="kpi-delta neutral">{{ t('logistics.delta2') }}</div>
    </div>
    <div class="kpi-card" data-test="logistics-kpi-card">
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
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('logistics.kpi3_label') }}</div>
      <div class="kpi-value">5 <span>pcs.</span></div>
      <div class="kpi-delta down">↑ 14.7%</div>
    </div>
    <div class="kpi-card" data-test="logistics-kpi-card">
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
      <div class="kpi-label">{{ t('logistics.kpi4_label') }}</div>
      <div class="kpi-value">62 <span>%</span></div>
      <div class="kpi-delta up">↑ +5%</div>
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
          <tr data-test="logistics-route-row">
            <td>{{ t('logistics.route_vk') }}</td>
            <td class="hid-320">12</td>
            <td class="hid-320">8.2</td>
            <td>4 800</td>
            <td>
              <span class="status-pill pill-success">{{ t('logistics.status_profitable') }}</span>
            </td>
          </tr>
          <tr data-test="logistics-route-row">
            <td>{{ t('logistics.route_vr') }}</td>
            <td class="hid-320">8</td>
            <td class="hid-320">7.1</td>
            <td>3 600</td>
            <td>
              <span class="status-pill pill-success">{{ t('logistics.status_profitable') }}</span>
            </td>
          </tr>
          <tr data-test="logistics-route-row">
            <td>{{ t('logistics.route_vw') }}</td>
            <td class="hid-320">5</td>
            <td class="hid-320">9.4</td>
            <td>5 200</td>
            <td>
              <span class="status-pill pill-success">{{ t('logistics.status_profitable') }}</span>
            </td>
          </tr>
          <tr data-test="logistics-route-row">
            <td>{{ t('logistics.route_kt') }}</td>
            <td class="hid-320">4</td>
            <td class="hid-320">4.1</td>
            <td>1 200</td>
            <td>
              <span class="status-pill pill-warning">{{ t('logistics.status_breakeven') }}</span>
            </td>
          </tr>
          <tr data-test="logistics-route-row">
            <td>{{ t('logistics.route_pl') }}</td>
            <td class="hid-320">5</td>
            <td class="hid-320">2.3</td>
            <td>400</td>
            <td>
              <span class="status-pill pill-danger">{{ t('logistics.status_loss') }}</span>
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
      <div class="bar-chart-row" data-test="logistics-load-row">
        <span class="bar-label">{{ t('logistics.week1') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 82%; background: linear-gradient(90deg, #52c41a, #73d13d)"
          ></div>
        </div>
        <span class="bar-val">8.2 t</span>
      </div>
      <div class="bar-chart-row" data-test="logistics-load-row">
        <span class="bar-label">{{ t('logistics.week2') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 74%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">7.4 t</span>
      </div>
      <div class="bar-chart-row" data-test="logistics-load-row">
        <span class="bar-label">{{ t('logistics.week3') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 69%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">6.9 t</span>
      </div>
      <div class="bar-chart-row" data-test="logistics-load-row">
        <span class="bar-label">{{ t('logistics.week4') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 61%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">6.1 t</span>
      </div>
    </div>
  </div>
</template>
