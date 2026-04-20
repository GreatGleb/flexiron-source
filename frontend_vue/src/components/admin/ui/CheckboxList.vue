<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SvgIcon from '@/components/admin/SvgIcon.vue'

import '@styles/admin/components/_checkbox-list.css'

export interface CheckboxListOption {
  value: string
  label: string
}

const { t } = useI18n()

const props = defineProps<{
  modelValue: string[]
  options: CheckboxListOption[]
  searchable?: boolean
  showControls?: boolean
  selectLabel?: string
  deselectLabel?: string
  selectedText?: string
  searchPlaceholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const searchQuery = ref('')

const filteredOptions = computed(() => {
  if (!props.searchable || !searchQuery.value) return props.options
  const q = searchQuery.value.toLowerCase()
  return props.options.filter((o) => o.label.toLowerCase().includes(q))
})

function isChecked(value: string) {
  return props.modelValue.includes(value)
}

function toggle(value: string) {
  const next = isChecked(value)
    ? props.modelValue.filter((v) => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

function selectAll() {
  emit(
    'update:modelValue',
    props.options.map((o) => o.value),
  )
}

function deselectAll() {
  emit('update:modelValue', [])
}
</script>

<template>
  <div class="checkbox-list" :class="{ searchable }">
    <div v-if="showControls" class="checkbox-list-controls">
      <button type="button" class="text-btn select-all-btn" @click="selectAll">
        {{ selectLabel ?? t('common.select_all') }}
      </button>
      <button type="button" class="text-btn deselect-all-btn" @click="deselectAll">
        {{ deselectLabel ?? t('common.deselect_all') }}
      </button>
      <span class="selected-count">
        <span class="count">{{ modelValue.length }}</span>
        {{ selectedText ?? t('common.selected') }}
      </span>
    </div>
    <div v-if="searchable" class="checkbox-list-search">
      <SvgIcon name="search" width="14" height="14" class="search-icon" />
      <input
        v-model="searchQuery"
        type="text"
        class="glass-input search-input"
        :placeholder="searchPlaceholder ?? t('common.search')"
      />
    </div>
    <div class="checkbox-list-items">
      <label
        v-for="opt in filteredOptions"
        :key="opt.value"
        class="checkbox-list-item"
        @click.prevent="toggle(opt.value)"
      >
        <input
          type="checkbox"
          :checked="isChecked(opt.value)"
          @change="toggle(opt.value)"
          @click.stop
        />
        <span class="checkbox-custom" />
        <span>{{ opt.label }}</span>
      </label>
    </div>
  </div>
</template>
