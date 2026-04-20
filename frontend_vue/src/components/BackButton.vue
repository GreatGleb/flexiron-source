<template>
  <router-link :to="to" class="top-back-btn">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
    <span>{{ t('common.back') }}</span>
  </router-link>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  to: {
    type: [String, Object],
    default: '/',
  },
})

const { t } = useI18n()
</script>
