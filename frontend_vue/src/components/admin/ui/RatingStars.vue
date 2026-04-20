<script setup lang="ts">
import '@styles/admin/components/_rating.css'

const props = defineProps<{
  modelValue: number
  count?: number
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const starPath =
  'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'

function select(star: number) {
  if (!props.readonly) {
    emit('update:modelValue', star)
  }
}
</script>

<template>
  <div class="rating-stars" :class="{ 'rating-readonly': readonly }">
    <svg
      v-for="star in count ?? 5"
      :key="star"
      class="star-svg"
      :class="{ active: star <= modelValue }"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      :style="readonly ? undefined : { cursor: 'pointer' }"
      @click="select(star)"
    >
      <path :d="starPath" />
    </svg>
  </div>
</template>
