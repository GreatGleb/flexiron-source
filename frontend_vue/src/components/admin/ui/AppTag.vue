<script setup lang="ts">
defineProps<{
  label: string
  removable?: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()
</script>

<template>
  <div class="tag">
    {{ label }}
    <svg
      v-if="removable"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="tag-remove"
      style="cursor: pointer"
      @click.stop="emit('remove')"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </div>
</template>
