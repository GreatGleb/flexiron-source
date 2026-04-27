<script setup lang="ts">
import SvgIcon from '@/components/admin/SvgIcon.vue'
import '@styles/admin/components/_search-input.css'

defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="search-input-wrap">
    <SvgIcon name="search" :width="14" :height="14" class="search-icon" />
    <input
      type="text"
      class="glass-input search-input"
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
