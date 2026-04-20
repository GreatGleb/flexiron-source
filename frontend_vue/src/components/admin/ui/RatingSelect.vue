<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import RatingStars from '@/components/admin/ui/RatingStars.vue'

import '@styles/admin/components/_rating.css'
import '@styles/admin/components/_custom-select.css'

const { t } = useI18n()

defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)

const options = [0, 5, 4, 3, 2, 1] as const

function select(value: number) {
  emit('update:modelValue', value)
  open.value = false
}

function toggle() {
  open.value = !open.value
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
        <span v-if="modelValue === 0" class="rating-any">{{ t('suppliers.any_rating') }}</span>
        <RatingStars v-else :model-value="modelValue" :readonly="true" />
      </div>
      <SvgIcon name="chevron-down" width="12" height="12" class="select-arrow" />
    </div>
    <div class="custom-select-list" :class="{ open }">
      <div v-for="val in options" :key="val" class="custom-select-option" @click="select(val)">
        <span v-if="val === 0" class="rating-any">{{ t('suppliers.any_rating') }}</span>
        <RatingStars v-else :model-value="val" :readonly="true" />
      </div>
    </div>
  </div>
</template>
