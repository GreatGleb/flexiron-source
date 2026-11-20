<template>
  <LangSwitcher v-if="showLangSwitcher" />

  <div class="bg-image"></div>
  <div class="bg-overlay"></div>

  <RouterView />
</template>

<script setup>
import { computed, watchEffect, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import LangSwitcher from '@/components/LangSwitcher.vue'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const isAdmin = computed(() => route.meta.layout === 'admin')
// Лендинг пока только по-русски (решение 2 плана лендинга): маршрут прячет переключатель сам.
const showLangSwitcher = computed(() => !isAdmin.value && route.meta.hideLangSwitcher !== true)
const { fetchMe } = useAuth()

onMounted(() => {
  fetchMe()
})

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
