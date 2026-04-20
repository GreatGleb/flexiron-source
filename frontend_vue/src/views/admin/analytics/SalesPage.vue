<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="sales-title">{{ t('sales.header_title') }}</h1>
  <AnalyticsSubNav />

  <div class="kpi-row" data-test="sales-kpi-row">
    <div class="kpi-card" data-test="sales-kpi-card">
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
      <div class="kpi-label">{{ t('sales.kpi1_label') }}</div>
      <div class="kpi-value">84 200 <span>EUR</span></div>
      <div class="kpi-delta up">{{ t('sales.delta1') }}</div>
    </div>
    <div class="kpi-card" data-test="sales-kpi-card">
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('sales.kpi2_label') }}</div>
      <div class="kpi-value">47 <span>pcs.</span></div>
      <div class="kpi-delta up">{{ t('sales.delta2') }}</div>
    </div>
    <div class="kpi-card" data-test="sales-kpi-card">
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
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('sales.kpi3_label') }}</div>
      <div class="kpi-value">63 <span>pcs.</span></div>
      <div class="kpi-delta neutral">{{ t('sales.delta3') }}</div>
    </div>
    <div class="kpi-card" data-test="sales-kpi-card">
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
      <div class="kpi-label">{{ t('sales.kpi4_label') }}</div>
      <div class="kpi-value">11 400 <span>EUR</span></div>
      <div class="kpi-delta down">{{ t('sales.delta4') }}</div>
    </div>
  </div>

  <div class="charts-row" data-test="sales-charts-row">
    <div class="glass-panel" data-test="sales-top-clients">
      <div class="panel-header">
        <span class="panel-title">{{ t('sales.chart1_title') }}</span>
        <span class="panel-badge">{{ t('sales.badge_march') }}</span>
      </div>
      <div class="bar-chart-row" data-test="sales-top-clients-row">
        <span class="bar-label">UAB Metalis</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 88%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">18 400 €</span>
      </div>
      <div class="bar-chart-row" data-test="sales-top-clients-row">
        <span class="bar-label">SIA Steel Pro</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 62%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">13 100 €</span>
      </div>
      <div class="bar-chart-row" data-test="sales-top-clients-row">
        <span class="bar-label">Metallurg Ltd</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 45%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">9 500 €</span>
      </div>
      <div class="bar-chart-row" data-test="sales-top-clients-row">
        <span class="bar-label">AS Rauad OÜ</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 30%; background: linear-gradient(90deg, #52c41a, #73d13d)"
          ></div>
        </div>
        <span class="bar-val">6 300 €</span>
      </div>
      <div class="bar-chart-row" data-test="sales-top-clients-row">
        <span class="bar-label">UAB Plieno</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 19%; background: linear-gradient(90deg, #52c41a, #73d13d)"
          ></div>
        </div>
        <span class="bar-val">4 000 €</span>
      </div>
    </div>

    <div class="glass-panel" data-test="sales-refusal-reasons">
      <div class="panel-header">
        <span class="panel-title">{{ t('sales.chart2_title') }}</span>
        <span class="panel-badge">{{ t('sales.badge_deals') }}</span>
      </div>
      <div class="bar-chart-row" data-test="sales-refusal-row">
        <span class="bar-label">{{ t('sales.reason1') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 62%; background: linear-gradient(90deg, #ff4d4f, #ff7875)"
          ></div>
        </div>
        <span class="bar-val">62%</span>
      </div>
      <div class="bar-chart-row" data-test="sales-refusal-row">
        <span class="bar-label">{{ t('sales.reason2') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 28%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">28%</span>
      </div>
      <div class="bar-chart-row" data-test="sales-refusal-row">
        <span class="bar-label">{{ t('sales.reason3') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 10%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">10%</span>
      </div>
    </div>
  </div>
</template>
