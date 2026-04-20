<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const { t } = useI18n()
const route = useRoute()

const tabs = [
  { to: '/admin/analytics/dashboard', key: 'sub.kpi' },
  { to: '/admin/analytics/warehouse', key: 'sub.warehouse' },
  { to: '/admin/analytics/sales', key: 'sub.sales' },
  { to: '/admin/analytics/supply', key: 'sub.supply' },
  { to: '/admin/analytics/staff', key: 'sub.staff' },
  { to: '/admin/analytics/logistics', key: 'sub.logistics' },
  { to: '/admin/analytics/pl-report', key: 'sub.pl' },
  { to: '/admin/analytics/deficit', key: 'sub.deficit' },
] as const

const currentPath = computed(() => route.path)
</script>

<template>
  <div class="sub-nav" data-test="analytics-sub-nav">
    <router-link
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      :class="{ current: currentPath === tab.to }"
      :data-test="`analytics-sub-nav-${tab.key.replace('sub.', '')}`"
    >
      {{ t(tab.key) }}
    </router-link>
  </div>
</template>
