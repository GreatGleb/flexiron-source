<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  modelValue: 'table' | 'kanban'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'table' | 'kanban']
}>()
</script>

<template>
  <div class="view-tabs">
    <button
      type="button"
      class="view-tab"
      :class="{ active: modelValue === 'table' }"
      @click="emit('update:modelValue', 'table')"
    >
      {{ t('suppliers.view_table') }}
    </button>
    <button
      type="button"
      class="view-tab"
      :class="{ active: modelValue === 'kanban' }"
      @click="emit('update:modelValue', 'kanban')"
    >
      {{ t('suppliers.view_kanban') }}
    </button>
  </div>
</template>
