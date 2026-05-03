<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import '@styles/admin/components/_tag-input.css'

export type TagOption = string | { value: string; label: string }

const props = defineProps<{
  modelValue: string[]
  options?: TagOption[]
  placeholder?: string
  freeInput?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const dropdownOpen = ref(false)
const inputText = ref('')
const wrapRef = ref<HTMLElement | null>(null)

/** Normalise options to { value, label }[] for uniform handling. */
const normalisedOptions = computed(() =>
  (props.options ?? []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  ),
)

/** Get display label for a stored value. */
function labelFor(value: string): string {
  const found = normalisedOptions.value.find((o) => o.value === value)
  return found?.label ?? value
}

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
      {{ labelFor(tag) }}
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
        v-for="opt in normalisedOptions.filter((o) => !modelValue.includes(o.value))"
        :key="opt.value"
        class="tag-drop-item"
        @click.stop="addTag(opt.value)"
      >
        {{ opt.label }}
      </div>
    </div>
  </div>
</template>
