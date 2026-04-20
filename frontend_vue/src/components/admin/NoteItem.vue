<script setup lang="ts">
import '@styles/admin/components/_note-item.css'

defineProps<{
  date: string
  text: string
}>()

const emit = defineEmits<{
  delete: []
}>()
</script>

<template>
  <div class="note-item">
    <div class="note-header">
      <span class="note-date">{{ date }}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#a0a5b1"
        stroke-width="2"
        class="tag-remove"
        style="cursor: pointer; transition: 0.2s"
        @mouseover="($event.target as SVGElement).setAttribute('stroke', '#ffffff')"
        @mouseout="($event.target as SVGElement).setAttribute('stroke', '#a0a5b1')"
        @click="emit('delete')"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
    <div class="note-text">{{ text }}</div>
  </div>
</template>
