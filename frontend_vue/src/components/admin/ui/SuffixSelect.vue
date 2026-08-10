<script setup lang="ts">
/**
 * The small dropdown that lives in a field's suffix — the currency beside a
 * price, the unit beside a quantity.
 *
 * Not `CustomSelect`: that one owns the whole field, a full-width `.glass-input`
 * with a chevron. This one is a badge inside somebody else's box, so it renders
 * as a fragment — the trigger and the list, both absolutely positioned against
 * the surrounding `.input-with-suffix`. Wrapping them in an element of its own
 * would put a static box into that flex row and squeeze the input.
 *
 * The four hand-written copies this replaces each closed on "was the click
 * inside *a* suffixed field", which on a card with ten of them left the list
 * open over the box being typed into. This asks about *this* field.
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

import '@styles/admin/components/_custom-select.css'
import '@styles/admin/components/_input-suffix.css'

const props = defineProps<{
  modelValue: string
  options: string[]
  /** What the trigger shows, when that is not the value itself. */
  displayValue?: string
  /** `data-test` for the trigger — a fragment has no root to inherit one. */
  triggerTest?: string
  /** `data-test` repeated on every option. */
  optionTest?: string
  /** Name of the `data-*` stamped on each option, e.g. `currency` → `data-currency`. */
  optionAttr?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

defineOptions({ inheritAttrs: false })

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)

const label = computed(() => props.displayValue ?? props.modelValue)

function optionAttrs(option: string): Record<string, string> {
  return props.optionAttr ? { [`data-${props.optionAttr}`]: option } : {}
}

function select(option: string) {
  emit('update:modelValue', option)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  const field = triggerRef.value?.closest('.input-with-suffix')
  if (!field || !field.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div
    ref="triggerRef"
    class="input-suffix custom-select-trigger"
    :data-test="triggerTest"
    @click.stop="open = !open"
  >
    <span class="curr-val">{{ label }}</span>
  </div>
  <div class="custom-select-list" :class="{ open }">
    <div
      v-for="opt in options"
      :key="opt"
      class="custom-select-option"
      :data-test="optionTest"
      v-bind="optionAttrs(opt)"
      @click="select(opt)"
    >
      {{ opt }}
    </div>
  </div>
</template>
