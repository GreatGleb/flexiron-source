<script setup lang="ts">
defineProps<{
  iconColor: 'blue' | 'red' | 'green' | 'gold'
  label: string
  value: string
  unit?: string
  delta?: string
  deltaDir?: 'up' | 'down' | 'neutral'
}>()
</script>

<template>
  <div class="kpi-card">
    <div class="kpi-icon" :class="`icon-${iconColor}`">
      <slot name="icon" />
    </div>
    <div class="kpi-label">
      <span>{{ label }}</span>
    </div>
    <div class="kpi-value">
      {{ value }} <span v-if="unit">{{ unit }}</span>
    </div>
    <div v-if="delta" class="kpi-delta" :class="deltaDir">{{ delta }}</div>
  </div>
</template>
