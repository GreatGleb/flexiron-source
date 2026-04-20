<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="staff-title">{{ t('staff.header_title') }}</h1>
  <AnalyticsSubNav />

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
          <tr data-test="staff-manager-row">
            <td>{{ t('staff.name_andrew') }}</td>
            <td>28 400</td>
            <td class="hid-320">21</td>
            <td>22.4%</td>
            <td class="hid-320">
              <span class="status-pill pill-success">{{ t('staff.status_top') }}</span>
            </td>
          </tr>
          <tr data-test="staff-manager-row">
            <td>{{ t('staff.name_svetlana') }}</td>
            <td>22 100</td>
            <td class="hid-320">18</td>
            <td>19.1%</td>
            <td class="hid-320">
              <span class="status-pill pill-success">{{ t('staff.status_good') }}</span>
            </td>
          </tr>
          <tr data-test="staff-manager-row">
            <td>{{ t('staff.name_dmitry') }}</td>
            <td>18 700</td>
            <td class="hid-320">14</td>
            <td>14.2%</td>
            <td class="hid-320">
              <span class="status-pill pill-warning">{{ t('staff.status_monitor') }}</span>
            </td>
          </tr>
          <tr data-test="staff-manager-row">
            <td>{{ t('staff.name_irena') }}</td>
            <td>15 000</td>
            <td class="hid-320">10</td>
            <td>11.8%</td>
            <td class="hid-320">
              <span class="status-pill pill-danger">{{ t('staff.status_low') }}</span>
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
          <tr data-test="staff-worker-row">
            <td>{{ t('staff.name_taras') }}</td>
            <td class="hid-320">94</td>
            <td>38 {{ t('staff.unit_min') }}</td>
            <td><span class="status-pill pill-success">0</span></td>
          </tr>
          <tr data-test="staff-worker-row">
            <td>{{ t('staff.name_alexey') }}</td>
            <td class="hid-320">87</td>
            <td>44 {{ t('staff.unit_min') }}</td>
            <td><span class="status-pill pill-warning">2</span></td>
          </tr>
          <tr data-test="staff-worker-row">
            <td>{{ t('staff.name_petr') }}</td>
            <td class="hid-320">76</td>
            <td>51 {{ t('staff.unit_min') }}</td>
            <td><span class="status-pill pill-danger">5</span></td>
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
    <div class="bar-chart-row" data-test="staff-revenue-row">
      <span class="bar-label">{{ t('staff.name_andrew') }}</span>
      <div class="bar-track">
        <div
          class="bar-fill"
          style="width: 85%; background: linear-gradient(90deg, #52c41a, #73d13d)"
        ></div>
      </div>
      <span class="bar-val">28 400 €</span>
    </div>
    <div class="bar-chart-row" data-test="staff-revenue-row">
      <span class="bar-label">{{ t('staff.name_svetlana') }}</span>
      <div class="bar-track">
        <div
          class="bar-fill"
          style="width: 65%; background: linear-gradient(90deg, #1890ff, #40a9ff)"
        ></div>
      </div>
      <span class="bar-val">22 100 €</span>
    </div>
    <div class="bar-chart-row" data-test="staff-revenue-row">
      <span class="bar-label">{{ t('staff.name_dmitry') }}</span>
      <div class="bar-track">
        <div
          class="bar-fill"
          style="width: 50%; background: linear-gradient(90deg, #faad14, #ffc53d)"
        ></div>
      </div>
      <span class="bar-val">18 700 €</span>
    </div>
    <div class="bar-chart-row" data-test="staff-revenue-row">
      <span class="bar-label">{{ t('staff.name_irena') }}</span>
      <div class="bar-track">
        <div
          class="bar-fill"
          style="width: 38%; background: linear-gradient(90deg, #ff4d4f, #ff7875)"
        ></div>
      </div>
      <span class="bar-val">15 000 €</span>
    </div>
  </div>
</template>
