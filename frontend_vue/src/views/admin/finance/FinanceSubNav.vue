<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

const { t } = useI18n()
const route = useRoute()

const tabs = computed(() => [
  {
    key: 'incoming',
    label: t('sub.finance_incoming'),
    to: '/admin/finance/incoming',
    active: route.path.startsWith('/admin/finance/incoming'),
  },
  {
    key: 'outgoing',
    label: t('sub.finance_outgoing'),
    to: '/admin/finance/outgoing',
    active: route.path.startsWith('/admin/finance/outgoing'),
  },
  {
    key: 'archive',
    label: t('sub.finance_archive'),
    to: '/admin/finance/archive',
    active: route.path.startsWith('/admin/finance/archive'),
  },
])
</script>

<template>
  <div class="sub-nav-tabs" data-test="finance-subnav">
    <router-link
      v-for="tab in tabs"
      :key="tab.key"
      :to="tab.to"
      class="sub-nav-tab"
      :class="{ active: tab.active }"
      :data-test="`finance-subnav-${tab.key}`"
    >
      {{ tab.label }}
    </router-link>
  </div>
</template>

<style scoped>
.sub-nav-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0;
}

.sub-nav-tab {
  padding: 10px 20px;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.55);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  cursor: pointer;
}

.sub-nav-tab:hover {
  color: rgba(255, 255, 255, 0.8);
}

.sub-nav-tab.active {
  color: #fff;
  border-bottom-color: #1890ff;
}
</style>
