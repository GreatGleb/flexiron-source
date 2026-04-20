<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SupplierFormSections from '@/components/admin/SupplierFormSections.vue'
import { useSupplierCreate } from '@/composables/useSupplierCreate'
import { useToast } from '@/composables/useToast'
import { useHead } from '@/composables/useHead'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/supplier_card.css'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const { supplier, saving, error, save } = useSupplierCreate()

useHead({
  title: () => `Flexiron — ${t('supplier.create_title')}`,
  description: () => t('supplier.create_title'),
})

async function handleSave() {
  const created = await save()
  if (!created) {
    const key =
      error.value === 'email_required'
        ? 'msg.validation_email_required'
        : 'msg.validation_company_required'
    toast.show(t(key), 'error')
    return
  }
  toast.show(t('msg.create_success'))
  router.push({ name: 'admin-supplier-card', params: { id: created.id } })
}

function handleCancel() {
  router.push({ name: 'admin-suppliers' })
}
</script>

<template>
  <h1 class="page-title" data-test="supplier-create-title">{{ t('supplier.create_title') }}</h1>

  <div class="flex-end" style="margin-bottom: 32px">
    <div
      class="entity-action-bar no-margin pos-static flex-group"
      data-test="supplier-create-action-bar"
    >
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-create-cancel-btn"
        @click="handleCancel"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-save dirty"
        :class="{ loading: saving }"
        :disabled="saving"
        data-test="supplier-create-save-btn"
        @click="handleSave"
      >
        <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
        <span>{{ t('btn.create_supplier') }}</span>
      </button>
    </div>
  </div>

  <div class="main-card-content" data-test="supplier-create-content">
    <div class="entity-card-grid create-grid">
      <SupplierFormSections v-model="supplier" />
    </div>
  </div>
</template>

<style>
.entity-card-grid.create-grid {
  grid-template-columns: 1fr 2fr;
}

@media (max-width: 1200px) {
  .entity-card-grid.create-grid {
    grid-template-columns: 1fr;
  }
}
</style>
