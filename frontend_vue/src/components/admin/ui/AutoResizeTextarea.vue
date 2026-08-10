<script setup lang="ts">
/**
 * A textarea that follows its own text.
 *
 * The same twelve lines used to live in seven cards and modals; this is that
 * function, once. The root element IS the textarea, so `class`, `rows`,
 * `placeholder` and `data-test` land on it as fall-through attributes and every
 * selector written against the old markup keeps working.
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined
    /** Past this the box stops growing and starts scrolling. */
    maxHeight?: number
  }>(),
  { maxHeight: 300 },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const el = ref<HTMLTextAreaElement | null>(null)

function resize() {
  const node = el.value
  if (!node) return
  node.style.height = 'auto'
  // A hidden box measures zero, and a zero height would survive the unhiding.
  // `.glass-panel.loading .panel-body` is display:none, and cards fill the form
  // before they drop the loading flag — so this is the ordinary case, not a rare one.
  if (node.scrollHeight === 0) return
  if (node.scrollHeight > props.maxHeight) {
    node.style.height = props.maxHeight + 'px'
    node.style.overflowY = 'auto'
  } else {
    node.style.height = node.scrollHeight + 'px'
    node.style.overflowY = 'hidden'
  }
}

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
  resize()
}

watch(
  () => props.modelValue,
  () => nextTick(resize),
)

/**
 * The measurement that mount could not take, taken the moment the box is shown.
 * Resizing does not change whether the element intersects, so this settles at once.
 */
let visibility: IntersectionObserver | null = null

onMounted(() => {
  resize()
  if (!el.value || typeof IntersectionObserver === 'undefined') return
  visibility = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) resize()
  })
  visibility.observe(el.value)
})

onBeforeUnmount(() => visibility?.disconnect())

defineExpose({ resize })
</script>

<template>
  <textarea ref="el" :value="modelValue ?? ''" @input="onInput" />
</template>
