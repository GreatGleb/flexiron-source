<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

defineProps<{
  items: { label: string; to?: RouteLocationRaw }[]
}>()
</script>

<template>
  <nav class="breadcrumb" aria-label="breadcrumb">
    <ol class="breadcrumb-list">
      <li v-for="(item, i) in items" :key="i" class="breadcrumb-item">
        <router-link v-if="item.to" :to="item.to" class="breadcrumb-link">
          {{ item.label }}
        </router-link>
        <span v-else class="breadcrumb-current" aria-current="page">{{ item.label }}</span>
        <span v-if="i < items.length - 1" class="breadcrumb-sep" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>
