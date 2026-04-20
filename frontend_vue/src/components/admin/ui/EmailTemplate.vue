<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import '@styles/admin/components/_email-template.css'

const { t } = useI18n()

defineProps<{
  subject: string
  body: string
  subjectLabel?: string
  bodyLabel?: string
  subjectPlaceholder?: string
  bodyPlaceholder?: string
}>()

const emit = defineEmits<{
  'update:subject': [value: string]
  'update:body': [value: string]
}>()
</script>

<template>
  <div class="email-template">
    <div class="email-template-subject">
      <label class="field-label">{{ subjectLabel ?? t('bcc.subject') }}</label>
      <input
        type="text"
        class="glass-input subject-input"
        data-test="email-template-subject"
        :value="subject"
        :placeholder="subjectPlaceholder ?? t('bcc.subject_placeholder')"
        @input="emit('update:subject', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="email-template-body">
      <label class="field-label">{{ bodyLabel ?? t('bcc.body') }}</label>
      <textarea
        class="glass-input body-input"
        data-test="email-template-body"
        rows="8"
        :placeholder="bodyPlaceholder ?? t('bcc.body_placeholder')"
        :value="body"
        @input="emit('update:body', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
    <slot />
  </div>
</template>
