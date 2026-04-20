<script setup lang="ts">
defineProps<{
  label: string
  value: string
  percent: number
  gradient?: string
}>()
</script>

<template>
  <div class="bar-chart-row">
    <span class="bar-label">{{ label }}</span>
    <div class="bar-track">
      <div
        class="bar-fill"
        :style="{
          width: `${percent}%`,
          background: gradient ?? 'linear-gradient(90deg,#1890FF,#40a9ff)',
        }"
      ></div>
    </div>
    <span class="bar-val">{{ value }}</span>
  </div>
</template>
