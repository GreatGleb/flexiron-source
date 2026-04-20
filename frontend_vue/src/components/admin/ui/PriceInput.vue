<script setup lang="ts">
import '@styles/admin/components/_price-input.css'

defineProps<{
  modelValue: number | null
  unit: string
  units: string[]
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'update:unit': [unit: string]
}>()

function onValueInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  emit('update:modelValue', raw === '' ? null : parseFloat(raw))
}
</script>

<template>
  <div class="price-input-wrap">
    <input
      type="number"
      class="glass-input price-value"
      :value="modelValue ?? ''"
      :placeholder="placeholder"
      step="0.01"
      min="0"
      @input="onValueInput"
    />
    <div class="price-unit-select">
      <select
        class="glass-input unit-select"
        :value="unit"
        @change="emit('update:unit', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="u in units" :key="u" :value="u" :selected="u === unit">
          {{ u }}
        </option>
      </select>
    </div>
  </div>
</template>
