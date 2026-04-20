<script setup lang="ts">
import '@styles/admin/components/_file-item.css'

defineProps<{
  name: string
  downloadUrl: string
  downloadName?: string
}>()

const emit = defineEmits<{
  delete: []
}>()
</script>

<template>
  <div class="file-item">
    <div class="file-info">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        class="action-btn-wrap"
      >
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span class="file-name">{{ name }}</span>
    </div>
    <div class="file-actions">
      <a :href="downloadUrl" :download="downloadName ?? name" class="file-action-btn">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          class="action-btn-wrap"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
      </a>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="action-btn-wrap"
        style="cursor: pointer"
        @click="emit('delete')"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  </div>
</template>
