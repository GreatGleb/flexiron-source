<template>
  <LangSwitcher v-if="!isAdmin" />

  <div class="bg-image"></div>
  <div class="bg-overlay"></div>

  <RouterView />
</template>

<script setup>
import { computed, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import LangSwitcher from '@/components/LangSwitcher.vue'

const route = useRoute()
const isAdmin = computed(() => route.meta.layout === 'admin')

watchEffect(() => {
  if (isAdmin.value) {
    document.documentElement.style.height = ''
    document.documentElement.style.overflow = ''
  } else {
    document.documentElement.style.height = 'auto'
    document.documentElement.style.overflow = 'visible'
  }
})
</script>

<style>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
</style>
