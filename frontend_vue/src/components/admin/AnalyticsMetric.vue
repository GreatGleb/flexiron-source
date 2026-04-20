<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineProps<{
  labelKey: string
  label: string
  value: string | number
  valueKey?: string
  valueClass?: string
}>()
</script>

<template>
  <div class="acard-metric">
    <span>{{ t(labelKey, label) }}</span>
    <strong :class="valueClass">
      {{ valueKey ? t(valueKey, String(value)) : value }}
    </strong>
  </div>
</template>
