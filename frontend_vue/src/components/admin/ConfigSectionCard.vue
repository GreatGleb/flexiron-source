<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SvgIcon from '@/components/admin/SvgIcon.vue'

const { t } = useI18n()

defineProps<{
  sectionId: string
  name: string
  collapsed?: boolean
  /** Mirrors the hidden state in the rendered supplier card — adds .hidden class + active state on the hide button. */
  hidden?: boolean
  fieldCount: number
  deletable?: boolean
}>()

const emit = defineEmits<{
  collapse: [sectionId: string]
  addField: [sectionId: string]
  edit: [sectionId: string]
  toggleVisibility: [sectionId: string]
  delete: [sectionId: string]
}>()
</script>

<template>
  <div
    class="config-section-card"
    :class="{ collapsed, 'is-hidden': hidden }"
    data-test="config-section-card"
    :data-section-id="sectionId"
    draggable="true"
  >
    <div class="section-card-header">
      <div class="section-drag-handle">
        <SvgIcon name="menu-bars" width="14" height="14" />
      </div>
      <div class="section-info">
        <span class="section-name" data-test="config-section-card-name">{{ name }}</span>
        <button
          v-tooltip="t('btn.collapse')"
          class="section-action-btn section-toggle-btn"
          type="button"
          data-test="config-section-card-collapse-btn"
          @click="emit('collapse', sectionId)"
        >
          <SvgIcon name="chevron-down" width="14" height="14" />
        </button>
        <span class="section-field-count" data-test="config-section-card-field-count">
          {{ t('section.fields') }}: {{ fieldCount }}
        </span>
      </div>
      <div class="section-actions">
        <button
          v-tooltip="t('btn.add_field')"
          class="section-action-btn section-add-field-btn"
          type="button"
          data-test="config-section-card-add-field-btn"
          @click="emit('addField', sectionId)"
        >
          <SvgIcon name="plus-add" width="14" height="14" />
        </button>
        <button
          v-tooltip="t('btn.edit')"
          class="section-action-btn section-edit-btn"
          type="button"
          data-test="config-section-card-edit-btn"
          @click="emit('edit', sectionId)"
        >
          <SvgIcon name="edit-pencil" width="14" height="14" />
        </button>
        <button
          v-tooltip="t('btn.hide_section')"
          class="section-action-btn section-hide-btn"
          :class="{ active: hidden }"
          type="button"
          data-test="config-section-card-hide-btn"
          @click="emit('toggleVisibility', sectionId)"
        >
          <SvgIcon name="eye-off" width="14" height="14" />
        </button>
        <button
          v-tooltip="deletable ? t('btn.delete') : t('btn.system_section')"
          class="section-action-btn section-delete-btn"
          :class="{ disabled: !deletable }"
          type="button"
          data-test="config-section-card-delete-btn"
          :disabled="!deletable"
          @click="deletable && emit('delete', sectionId)"
        >
          <SvgIcon name="x-close" width="14" height="14" />
        </button>
      </div>
    </div>
    <div class="section-card-body">
      <div class="section-fields-list drop-zone" :data-section-id="sectionId">
        <slot />
      </div>
    </div>
  </div>
</template>
