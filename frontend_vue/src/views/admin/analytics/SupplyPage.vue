<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="supply-title">{{ t('supply.header_title') }}</h1>
  <AnalyticsSubNav />

  <div class="kpi-row" data-test="supply-kpi-row">
    <div class="kpi-card" data-test="supply-kpi-card">
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
          <path
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('supply.kpi1_label') }}</div>
      <div class="kpi-value">58 200 <span>EUR</span></div>
      <div class="kpi-delta neutral">{{ t('supply.delta1') }}</div>
    </div>
    <div class="kpi-card" data-test="supply-kpi-card">
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
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('supply.kpi2_label') }}</div>
      <div class="kpi-value">84 <span>%</span></div>
      <div class="kpi-delta up">{{ t('supply.delta2') }}</div>
    </div>
    <div class="kpi-card" data-test="supply-kpi-card">
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
      <div class="kpi-label">{{ t('supply.kpi3_label') }}</div>
      <div class="kpi-value">3 <span>pcs.</span></div>
      <div class="kpi-delta down">{{ t('supply.delta3') }}</div>
    </div>
    <div class="kpi-card" data-test="supply-kpi-card">
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
          <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <div class="kpi-label">{{ t('supply.kpi4_label') }}</div>
      <div class="kpi-value">+4.2 <span>%</span></div>
      <div class="kpi-delta down">{{ t('supply.delta4') }}</div>
    </div>
  </div>

  <div class="charts-row" data-test="supply-charts-row">
    <div class="glass-panel" data-test="supply-suppliers">
      <div class="panel-header">
        <span class="panel-title">{{ t('supply.chart1_title') }}</span>
        <span class="panel-badge">{{ t('supply.badge_march') }}</span>
      </div>
      <table class="data-table" data-test="supply-suppliers-table">
        <thead>
          <tr>
            <th>{{ t('supply.th_supplier') }}</th>
            <th class="hid-320">{{ t('supply.th_deliveries') }}</th>
            <th>{{ t('supply.th_ontime') }}</th>
            <th>{{ t('supply.th_status') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr data-test="supply-supplier-row">
            <td>Metalis LT</td>
            <td class="hid-320">8</td>
            <td>87%</td>
            <td>
              <span class="status-pill pill-success">{{ t('supply.status_reliable') }}</span>
            </td>
          </tr>
          <tr data-test="supply-supplier-row">
            <td>ArcelorMittal</td>
            <td class="hid-320">5</td>
            <td>100%</td>
            <td>
              <span class="status-pill pill-success">{{ t('supply.status_reliable') }}</span>
            </td>
          </tr>
          <tr data-test="supply-supplier-row">
            <td>StalProm LLC</td>
            <td class="hid-320">6</td>
            <td>50%</td>
            <td>
              <span class="status-pill pill-danger">{{ t('supply.status_risk') }}</span>
            </td>
          </tr>
          <tr data-test="supply-supplier-row">
            <td>SIA BalticMetal</td>
            <td class="hid-320">4</td>
            <td>75%</td>
            <td>
              <span class="status-pill pill-warning">{{ t('supply.status_monitor') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="glass-panel" data-test="supply-categories">
      <div class="panel-header">
        <span class="panel-title">{{ t('supply.chart2_title') }}</span>
        <span class="panel-badge">{{ t('supply.badge_q1') }}</span>
      </div>
      <div class="bar-chart-row" data-test="supply-category-row">
        <span class="bar-label">{{ t('supply.cat_pipe') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 72%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">+5.1%</span>
      </div>
      <div class="bar-chart-row" data-test="supply-category-row">
        <span class="bar-label">{{ t('supply.cat_sheet') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 45%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">+2.8%</span>
      </div>
      <div class="bar-chart-row" data-test="supply-category-row">
        <span class="bar-label">{{ t('supply.cat_angle') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 30%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">+1.9%</span>
      </div>
      <div class="bar-chart-row" data-test="supply-category-row">
        <span class="bar-label">{{ t('supply.cat_stainless') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 90%; background: linear-gradient(90deg, #ff4d4f, #ff7875)"
          ></div>
        </div>
        <span class="bar-val">+9.3%</span>
      </div>
    </div>
  </div>
</template>
