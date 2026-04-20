<script setup lang="ts">
import { RouterLink } from 'vue-router'
import SvgIcon from './SvgIcon.vue'

export interface AcardMetric {
  label: string
  value: string
  status?: 'ok' | 'warn' | 'bad'
}

defineProps<{
  to: string
  num: string
  title: string
  metrics: AcardMetric[]
  linkText: string
}>()
</script>

<template>
  <RouterLink class="acard" :to="to">
    <div class="acard-num">{{ num }}</div>
    <div class="acard-title">{{ title }}</div>
    <div class="acard-metrics">
      <div v-for="(m, i) in metrics" :key="i" class="acard-metric">
        <span>{{ m.label }}</span>
        <strong :class="m.status">{{ m.value }}</strong>
      </div>
    </div>
    <div class="acard-footer">
      <span class="acard-link">
        <span>{{ linkText }}</span>
        <SvgIcon name="chevron-right" :width="24" :height="24" :stroke-width="2.5" />
      </span>
    </div>
  </RouterLink>
</template>
