<script setup lang="ts">
import SvgIcon from '@/components/admin/SvgIcon.vue'

defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="checkbox-list-search">
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
