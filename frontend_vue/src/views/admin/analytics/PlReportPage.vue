<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AnalyticsSubNav from '@/components/admin/AnalyticsSubNav.vue'

import '@styles/admin/analytic_pl-report.css'

const { t } = useI18n()
</script>

<template>
  <h1 class="page-title" data-test="pl-report-title">{{ t('plReport.header_title') }}</h1>
  <AnalyticsSubNav />

  <div class="charts-row" data-test="pl-report-charts-row">
    <div class="glass-panel" data-test="pl-report-breakdown">
      <div class="panel-header">
        <span class="panel-title">{{ t('plReport.chart1_title') }}</span>
        <span class="panel-badge">{{ t('plReport.badge_march') }}</span>
      </div>
      <div class="pl-row" data-test="pl-report-breakdown-row">
        <span class="pl-label">{{ t('plReport.label_sales') }}</span
        ><span class="pl-value green">+ 84 200 €</span>
      </div>
      <hr class="pl-divider" />
      <div class="pl-row" data-test="pl-report-breakdown-row">
        <span class="pl-label">{{ t('plReport.label_cogs') }}</span
        ><span class="pl-value red">− 58 200 €</span>
      </div>
      <div class="pl-row" data-test="pl-report-breakdown-row">
        <span class="pl-label">{{ t('plReport.label_gross') }}</span
        ><span class="pl-value green">= 26 000 €</span>
      </div>
      <hr class="pl-divider" />
      <div class="pl-row" data-test="pl-report-breakdown-row">
        <span class="pl-label">{{ t('plReport.label_logistics') }}</span
        ><span class="pl-value red">− 6 800 €</span>
      </div>
      <div class="pl-row" data-test="pl-report-breakdown-row">
        <span class="pl-label">{{ t('plReport.label_rent') }}</span
        ><span class="pl-value red">− 2 100 €</span>
      </div>
      <div class="pl-row" data-test="pl-report-breakdown-row">
        <span class="pl-label">{{ t('plReport.label_salaries') }}</span
        ><span class="pl-value red">− 3 130 €</span>
      </div>
      <hr class="pl-divider" />
      <div class="pl-total" data-test="pl-report-breakdown-total">
        <span class="pl-label">{{ t('plReport.label_operating') }}</span
        ><span class="pl-value green">14 870 €</span>
      </div>
    </div>

    <div class="glass-panel" data-test="pl-report-calendar">
      <div class="panel-header">
        <span class="panel-title">{{ t('plReport.chart2_title') }}</span>
        <span class="panel-badge">{{ t('plReport.badge_april') }}</span>
      </div>
      <div class="calendar-row" data-test="pl-report-calendar-grid">
        <div class="cal-item" data-test="pl-report-calendar-item">
          <div class="cal-date">{{ t('plReport.date_apr2') }}</div>
          <div class="cal-client">UAB Metalis</div>
          <div class="cal-amount">+ 8 400 €</div>
        </div>
        <div class="cal-item" data-test="pl-report-calendar-item">
          <div class="cal-date">{{ t('plReport.date_apr5') }}</div>
          <div class="cal-client">SIA Steel Pro</div>
          <div class="cal-amount">+ 5 100 €</div>
        </div>
        <div class="cal-item" data-test="pl-report-calendar-item">
          <div class="cal-date">{{ t('plReport.date_apr8') }}</div>
          <div class="cal-client">Metallurg LLC</div>
          <div class="cal-amount">+ 3 750 €</div>
        </div>
        <div class="cal-item" data-test="pl-report-calendar-item">
          <div class="cal-date">{{ t('plReport.date_apr10') }}</div>
          <div class="cal-client">AS Rauad OÜ</div>
          <div class="cal-amount">+ 2 900 €</div>
        </div>
        <div class="cal-item" data-test="pl-report-calendar-item">
          <div class="cal-date">{{ t('plReport.date_apr12') }}</div>
          <div class="cal-client">Metalis LT</div>
          <div class="cal-amount" style="color: var(--danger)">− 18 000 €</div>
        </div>
        <div class="cal-item" data-test="pl-report-calendar-item">
          <div class="cal-date">{{ t('plReport.date_apr14') }}</div>
          <div class="cal-client">UAB Plieno</div>
          <div class="cal-amount">+ 1 600 €</div>
        </div>
      </div>
    </div>
  </div>
</template>
