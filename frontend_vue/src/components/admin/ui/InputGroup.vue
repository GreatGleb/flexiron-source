<script setup lang="ts">
defineProps<{
  label?: string
}>()
</script>

<template>
  <div class="input-group">
    <label v-if="label" class="field-label">{{ label }}</label>
    <slot />
  </div>
</template>
