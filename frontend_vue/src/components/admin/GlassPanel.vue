<script setup lang="ts">
defineProps<{
  title?: string
  badge?: string
  loading?: boolean
  skeletonRows?: number
}>()
</script>

<template>
  <div class="glass-panel" :class="{ loading }">
    <div v-if="title || badge || $slots.header" class="panel-header">
      <span v-if="title" class="panel-title">{{ title }}</span>
      <slot name="header" />
      <span v-if="badge" class="panel-badge"
        ><span>{{ badge }}</span></span
      >
    </div>
    <div v-if="loading" class="panel-skeleton">
      <div class="skeleton" style="width: 60%" />
      <div
        v-for="i in skeletonRows ?? 2"
        :key="i"
        class="skeleton"
        :style="{ height: '40px', marginTop: '10px' }"
      />
    </div>
    <div class="panel-body">
      <slot />
    </div>
  </div>
</template>
