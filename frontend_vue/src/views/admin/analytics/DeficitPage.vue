<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="deficit-title">{{ t('deficit.header_title') }}</h1>
  <AnalyticsSubNav />

  <div class="kpi-row" data-test="deficit-kpi-row">
    <div class="kpi-card" data-test="deficit-kpi-card">
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
      <div class="kpi-label">{{ t('deficit.kpi1_label') }}</div>
      <div class="kpi-value">8 <span>pcs.</span></div>
      <div class="kpi-delta down">{{ t('deficit.delta1') }}</div>
    </div>
    <div class="kpi-card" data-test="deficit-kpi-card">
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
      <div class="kpi-label">{{ t('deficit.kpi2_label') }}</div>
      <div class="kpi-value">4 800 <span>EUR</span></div>
      <div class="kpi-delta down">{{ t('deficit.delta2') }}</div>
    </div>
    <div class="kpi-card" data-test="deficit-kpi-card">
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <div class="kpi-label">{{ t('deficit.kpi3_label') }}</div>
      <div class="kpi-value">5 <span>items</span></div>
      <div class="kpi-delta neutral">{{ t('deficit.delta3') }}</div>
    </div>
    <div class="kpi-card" data-test="deficit-kpi-card">
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
      <div class="kpi-label">{{ t('deficit.kpi4_label') }}</div>
      <div class="kpi-value">3 <span>items</span></div>
      <div class="kpi-delta up">{{ t('deficit.delta4') }}</div>
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
          <tr data-test="deficit-item-row">
            <td>{{ t('deficit.item_pipe_60') }}</td>
            <td class="hid-320">0.4 {{ t('deficit.unit_t') }}</td>
            <td class="hid-320">2 {{ t('deficit.unit_t') }}</td>
            <td>4</td>
            <td>
              <span class="status-pill pill-danger">{{ t('deficit.status_critical') }}</span>
            </td>
          </tr>
          <tr data-test="deficit-item-row">
            <td>{{ t('deficit.item_sheet_3') }}</td>
            <td class="hid-320">0.8 {{ t('deficit.unit_t') }}</td>
            <td class="hid-320">3 {{ t('deficit.unit_t') }}</td>
            <td>3</td>
            <td>
              <span class="status-pill pill-danger">{{ t('deficit.status_critical') }}</span>
            </td>
          </tr>
          <tr data-test="deficit-item-row">
            <td>{{ t('deficit.item_profile_80') }}</td>
            <td class="hid-320">1.1 {{ t('deficit.unit_t') }}</td>
            <td class="hid-320">2 {{ t('deficit.unit_t') }}</td>
            <td>2</td>
            <td>
              <span class="status-pill pill-warning">{{ t('deficit.status_low') }}</span>
            </td>
          </tr>
          <tr data-test="deficit-item-row">
            <td>{{ t('deficit.item_rod_30') }}</td>
            <td class="hid-320">0.6 {{ t('deficit.unit_t') }}</td>
            <td class="hid-320">1.5 {{ t('deficit.unit_t') }}</td>
            <td>2</td>
            <td>
              <span class="status-pill pill-warning">{{ t('deficit.status_low') }}</span>
            </td>
          </tr>
          <tr data-test="deficit-item-row">
            <td>{{ t('deficit.item_angle_63') }}</td>
            <td class="hid-320">1.8 {{ t('deficit.unit_t') }}</td>
            <td class="hid-320">2 {{ t('deficit.unit_t') }}</td>
            <td>1</td>
            <td>
              <span class="status-pill pill-warning">{{ t('deficit.status_low') }}</span>
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
      <div class="bar-chart-row" data-test="deficit-refusals-row">
        <span class="bar-label">{{ t('deficit.item_pipe_60') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 90%; background: linear-gradient(90deg, #ff4d4f, #ff7875)"
          ></div>
        </div>
        <span class="bar-val">4 t</span>
      </div>
      <div class="bar-chart-row" data-test="deficit-refusals-row">
        <span class="bar-label">{{ t('deficit.item_sheet_3') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 75%; background: linear-gradient(90deg, #ff4d4f, #ff7875)"
          ></div>
        </div>
        <span class="bar-val">5 t</span>
      </div>
      <div class="bar-chart-row" data-test="deficit-refusals-row">
        <span class="bar-label">{{ t('deficit.item_profile_80') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 50%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">2 t</span>
      </div>
      <div class="bar-chart-row" data-test="deficit-refusals-row">
        <span class="bar-label">{{ t('deficit.item_rod_30') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 40%; background: linear-gradient(90deg, #faad14, #ffc53d)"
          ></div>
        </div>
        <span class="bar-val">1.5 t</span>
      </div>
      <div class="bar-chart-row" data-test="deficit-refusals-row">
        <span class="bar-label">{{ t('deficit.item_angle_63') }}</span>
        <div class="bar-track">
          <div
            class="bar-fill"
            style="width: 25%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
          ></div>
        </div>
        <span class="bar-val">1 t</span>
      </div>
    </div>
  </div>
</template>
