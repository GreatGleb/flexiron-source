<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/products_list.css'

const { t } = useI18n()

useHead({ title: () => t('products.title'), description: () => t('products.title') })
</script>

<template>
  <div class="page-products" data-test="page-products">
    <div class="products-header" data-test="products-header">
      <h1 class="page-title">{{ t('products.header_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <router-link :to="{ name: 'admin-categories' }" class="btn btn-secondary" data-test="products-link-categories">
          <SvgIcon name="folder" :width="18" :height="18" />
          <span>{{ t('categories.title') }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>
