<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

import '@styles/admin/components/_tag-input.css'

const props = defineProps<{
  modelValue: string[]
  options?: string[]
  placeholder?: string
  freeInput?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const dropdownOpen = ref(false)
const inputText = ref('')
const wrapRef = ref<HTMLElement | null>(null)

function removeTag(index: number) {
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function addTag(tag: string) {
  const trimmed = tag.trim()
  if (trimmed && !props.modelValue.includes(trimmed)) {
    emit('update:modelValue', [...props.modelValue, trimmed])
  }
  inputText.value = ''
  dropdownOpen.value = false
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && props.freeInput && inputText.value.trim()) {
    e.preventDefault()
    addTag(inputText.value)
  }
}

function toggleDropdown() {
  if (props.options?.length) {
    dropdownOpen.value = !dropdownOpen.value
  }
}

function onClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<template>
  <div ref="wrapRef" class="tag-container custom-select-wrap" @click="toggleDropdown">
    <div v-for="(tag, i) in modelValue" :key="tag" class="tag">
      {{ tag }}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="tag-remove"
        @click.stop="removeTag(i)"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
    <input
      v-if="freeInput"
      v-model="inputText"
      type="text"
      class="tag-input"
      :placeholder="placeholder"
      @keydown="onInputKeydown"
      @click.stop
    />
    <input v-else type="text" class="tag-input" :placeholder="placeholder" readonly />
    <div v-if="options?.length" class="tag-dropdown" :class="{ open: dropdownOpen }">
      <div
        v-for="opt in options.filter((o) => !modelValue.includes(o))"
        :key="opt"
        class="tag-drop-item"
        @click.stop="addTag(opt)"
      >
        {{ opt }}
      </div>
    </div>
  </div>
</template>
