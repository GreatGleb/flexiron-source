<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FieldType } from '@/types/config'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t } = useI18n()

defineProps<{
  fieldId: string
  name: string
  type: FieldType
  draggable?: boolean
  usageCount?: number
  /** Required field — disables the hide button (can't be hidden). */
  hiddenRequired?: boolean
  deletable?: boolean
  /** Field is currently hidden inside the supplier card → apply .hidden class + .active on hide btn. */
  hidden?: boolean
  /** Show the eye-off (hide) button. Default true — set false for Global Fields list. */
  showHide?: boolean
  /** Show the × (delete) button. Default true — set false for fields that cannot be removed. */
  showDelete?: boolean
}>()

const emit = defineEmits<{
  toggleVisibility: [fieldId: string]
  delete: [fieldId: string]
}>()
</script>

<template>
  <div
    class="field-library-item"
    :class="{ 'is-hidden': hidden }"
    data-test="field-library-item"
    :data-field-id="fieldId"
    :data-field-type="type"
    :draggable="draggable"
  >
    <div class="field-item-drag-handle">
      <SvgIcon name="menu-bars" width="14" height="14" />
    </div>
    <div class="field-item-icon" :class="`field-icon-${type}`">
      <SvgIcon name="grid-products" width="16" height="16" />
    </div>
    <div class="field-item-info">
      <span class="field-item-name" data-test="field-library-item-name">{{ name }}</span>
      <span class="field-item-type">{{ t(`field.type_${type}`, type) }}</span>
    </div>
    <div
      v-if="usageCount"
      class="field-item-badge"
      :title="t('field.used_in_sections', { count: usageCount })"
    >
      {{ usageCount }}
    </div>
    <div class="field-item-actions">
      <button
        v-if="showHide !== false"
        v-tooltip="t('btn.hide_field')"
        class="field-action-btn field-hide-btn"
        :class="{ disabled: hiddenRequired, active: hidden }"
        type="button"
        data-test="field-library-item-hide-btn"
        :disabled="hiddenRequired"
        @click="!hiddenRequired && emit('toggleVisibility', fieldId)"
      >
        <SvgIcon name="eye-off" width="12" height="12" />
      </button>
      <button
        v-if="showDelete !== false"
        v-tooltip="t('btn.delete_field')"
        class="field-action-btn field-delete-btn"
        :class="{ disabled: !deletable }"
        type="button"
        data-test="field-library-item-delete-btn"
        :disabled="!deletable"
        @click="deletable && emit('delete', fieldId)"
      >
        <SvgIcon name="x-close" width="12" height="12" />
      </button>
    </div>
  </div>
</template>
