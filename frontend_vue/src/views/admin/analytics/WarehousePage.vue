<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="warehouse-title">{{ t('warehouse.header_title') }}</h1>
  <AnalyticsSubNav />

  <div class="kpi-row" data-test="warehouse-kpi-row">
    <div class="kpi-card" data-test="warehouse-kpi-card">
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
      <div class="kpi-label">{{ t('warehouse.kpi1_label') }}</div>
      <div class="kpi-value">127 400 <span>EUR</span></div>
      <div class="kpi-delta up">{{ t('warehouse.delta1') }}</div>
    </div>
    <div class="kpi-card" data-test="warehouse-kpi-card">
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
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('warehouse.kpi2_label') }}</div>
      <div class="kpi-value">12 <span>items</span></div>
      <div class="kpi-delta down">{{ t('warehouse.delta2') }}</div>
    </div>
    <div class="kpi-card" data-test="warehouse-kpi-card">
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('warehouse.kpi3_label') }}</div>
      <div class="kpi-value">38 <span>days</span></div>
      <div class="kpi-delta neutral">{{ t('warehouse.delta3') }}</div>
    </div>
    <div class="kpi-card" data-test="warehouse-kpi-card">
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
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('warehouse.kpi4_label') }}</div>
      <div class="kpi-value">8.4 <span>%</span></div>
      <div class="kpi-delta up">{{ t('warehouse.delta4') }}</div>
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
          <tr data-test="warehouse-deadstock-row">
            <td>Sheet 2×1000×2000</td>
            <td class="hid-320">A2</td>
            <td>4 200</td>
            <td>
              <span class="status-pill pill-danger">{{ t('warehouse.age_7mos') }}</span>
            </td>
          </tr>
          <tr data-test="warehouse-deadstock-row">
            <td>Rod Ø20, L3000</td>
            <td class="hid-320">B4</td>
            <td>1 850</td>
            <td>
              <span class="status-pill pill-danger">{{ t('warehouse.age_9mos') }}</span>
            </td>
          </tr>
          <tr data-test="warehouse-deadstock-row">
            <td>Angle 50×50×4</td>
            <td class="hid-320">A5</td>
            <td>3 100</td>
            <td>
              <span class="status-pill pill-warning">{{ t('warehouse.age_6mos') }}</span>
            </td>
          </tr>
          <tr data-test="warehouse-deadstock-row">
            <td>Stainless 1mm</td>
            <td class="hid-320">C1</td>
            <td>2 640</td>
            <td>
              <span class="status-pill pill-warning">{{ t('warehouse.age_6mos') }}</span>
            </td>
          </tr>
          <tr data-test="warehouse-deadstock-row">
            <td>Pipe 40×4</td>
            <td class="hid-320">B2</td>
            <td>780</td>
            <td>
              <span class="status-pill pill-success">{{ t('warehouse.age_6plus') }}</span>
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
      <div class="bar-chart-row" data-test="warehouse-chart-row">
        <span class="bar-label">{{ t('warehouse.cat_pipes') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 85%; background: linear-gradient(90deg, #52c41a, #73d13d)"
          ></div>
        </div>
        <span class="bar-val">22 days</span>
      </div>
      <div class="bar-chart-row" data-test="warehouse-chart-row">
        <span class="bar-label">{{ t('warehouse.cat_sheets') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 65%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">31 day</span>
      </div>
      <div class="bar-chart-row" data-test="warehouse-chart-row">
        <span class="bar-label">{{ t('warehouse.cat_profile') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 50%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">38 days</span>
      </div>
      <div class="bar-chart-row" data-test="warehouse-chart-row">
        <span class="bar-label">{{ t('warehouse.cat_rods') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 35%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">54 days</span>
      </div>
      <div class="bar-chart-row" data-test="warehouse-chart-row">
        <span class="bar-label">{{ t('warehouse.cat_stainless') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 20%; background: linear-gradient(90deg, #ff4d4f, #ff7875)"
          ></div>
        </div>
        <span class="bar-val">78 days</span>
      </div>
    </div>
  </div>
</template>
