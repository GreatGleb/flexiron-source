<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'
import AdminTopbar from '@/components/admin/AdminTopbar.vue'
import ToastContainer from '@/components/admin/ToastContainer.vue'
import { useSidebar } from '@/composables/useSidebar'

import '@styles/admin/admin-core.scss'

const route = useRoute()
const { collapsed, active } = useSidebar()

const shellClass = computed(() => ({
  'sidebar-collapsed': collapsed.value,
  'sidebar-active': active.value,
}))

const pageTitle = computed(() => {
  const name = route.meta.pageTitle as string | undefined
  return name ?? ''
})

watchEffect(() => {
  if (active.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <div class="shell" :class="shellClass" data-test="admin-shell">
    <AdminSidebar />
    <AdminTopbar />

    <main class="main" data-test="admin-main">
      <h1 v-if="pageTitle" class="page-title" data-test="page-title">{{ pageTitle }}</h1>
      <RouterView />
    </main>
  </div>
  <ToastContainer />
</template>

<style>
/* Reset public.css absolute positioning on lang-switcher inside admin shell */
.shell .lang-switcher {
  position: static;
  top: auto;
  right: auto;
}

/* Lift panels above siblings when a popup/dropdown is open inside — mirrors .custom-select-list.open rule from _glass-panel.css for datepicker + multi-select */
.glass-panel:has(.datepicker-popup.open),
.glass-panel:has(.multi-select-list.open) {
  z-index: 100 !important;
}
</style>
