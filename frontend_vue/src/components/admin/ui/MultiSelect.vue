<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

import '@styles/admin/components/_multiselect.css'

export interface MultiSelectOption {
  value: string
  label?: string
  group?: string
}

const props = defineProps<{
  modelValue: string[]
  options: MultiSelectOption[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

const selectedLabels = computed(() =>
  props.modelValue.map((v) => {
    const opt = props.options.find((o) => o.value === v)
    return opt?.label ?? opt?.value ?? v
  }),
)

// Preserve first-seen group order; ungrouped options go under an empty-string key rendered without header.
const groupedOptions = computed(() => {
  const groups: { group: string; items: MultiSelectOption[] }[] = []
  const byKey = new Map<string, MultiSelectOption[]>()
  for (const opt of props.options) {
    const key = opt.group ?? ''
    if (!byKey.has(key)) {
      const arr: MultiSelectOption[] = []
      byKey.set(key, arr)
      groups.push({ group: key, items: arr })
    }
    byKey.get(key)!.push(opt)
  }
  return groups
})

function toggle() {
  open.value = !open.value
}

function isSelected(value: string) {
  return props.modelValue.includes(value)
}

function toggleOption(value: string) {
  const next = isSelected(value)
    ? props.modelValue.filter((v) => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

function removeTag(value: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((v) => v !== value),
  )
}

function onClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="wrapRef" class="multi-select-wrap custom-select-wrap">
    <div class="glass-input custom-select-trigger" @click="toggle">
      <div class="multi-select-tags">
        <span v-if="selectedLabels.length === 0" class="multi-select-placeholder">
          {{ placeholder }}
        </span>
        <span v-for="value in modelValue" :key="value" class="tag">
          {{ options.find((o) => o.value === value)?.label ?? value }}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="tag-remove"
            @click.stop="removeTag(value)"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
      </div>
      <SvgIcon name="chevron-down" width="12" height="12" class="select-arrow" />
    </div>
    <div class="custom-select-list multi-select-list" :class="{ open }">
      <template v-for="group in groupedOptions" :key="group.group">
        <div v-if="group.group" class="multi-select-group-header">{{ group.group }}</div>
        <label v-for="opt in group.items" :key="opt.value" class="multi-select-option" @click.stop>
          <input
            type="checkbox"
            :checked="isSelected(opt.value)"
            @change="toggleOption(opt.value)"
          />
          <span>{{ opt.label ?? opt.value }}</span>
        </label>
      </template>
    </div>
  </div>
</template>

<style scoped>
.multi-select-group-header {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
  user-select: none;
}
.multi-select-group-header:not(:first-child) {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 4px;
}
</style>
