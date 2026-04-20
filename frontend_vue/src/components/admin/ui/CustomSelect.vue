<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import '@styles/admin/components/_custom-select.css'

export interface SelectOption {
  value: string
  label?: string
}

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
  openUp?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt?.label ?? opt?.value ?? ''
})

function toggle() {
  open.value = !open.value
}

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
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
  <div ref="wrapRef" class="custom-select-wrap">
    <div class="glass-input custom-select-trigger" @click="toggle">
      <div class="curr-val">
        <slot name="selected" :label="selectedLabel" :value="modelValue">
          <span>{{ selectedLabel }}</span>
        </slot>
      </div>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="select-arrow"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
    <div class="custom-select-list" :class="{ open, 'open-up': openUp }">
      <div
        v-for="opt in options"
        :key="opt.value"
        class="custom-select-option"
        @click="select(opt.value)"
      >
        <slot name="option" :option="opt">
          <span>{{ opt.label ?? opt.value }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>
