<script setup lang="ts">
import { ref } from 'vue'
import { uploadFile, type UploadedFile } from '@/services/uploadsService'

import '@styles/admin/components/_dropzone.css'

defineProps<{
  hint: string
  multiple?: boolean
  accept?: string
}>()

const emit = defineEmits<{
  /** Raw File[] right after drop — kept for backward compat (parents can still use this). */
  files: [files: File[]]
  /** Server upload finished — { fileId, url, ... }. Parents should collect these into fileIds[] for save. */
  uploaded: [files: UploadedFile[]]
  /** Upload error (per file). */
  uploadError: [err: Error]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
const uploading = ref(false)

function openPicker() {
  fileInput.value?.click()
}

async function handleFiles(files: File[]) {
  if (files.length === 0) return
  emit('files', files) // raw notification for any legacy consumer
  uploading.value = true
  try {
    const results = await Promise.all(files.map((f) => uploadFile(f)))
    emit('uploaded', results)
  } catch (err) {
    emit('uploadError', err instanceof Error ? err : new Error('Upload failed'))
  } finally {
    uploading.value = false
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    handleFiles(Array.from(input.files))
    input.value = ''
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  if (e.dataTransfer?.files.length) {
    handleFiles(Array.from(e.dataTransfer.files))
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}
</script>

<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      style="display: none"
      :multiple="multiple"
      :accept="accept"
      @change="onFileChange"
    />
    <div
      class="dropzone"
      :class="{ 'dropzone-active': dragging, 'dropzone-uploading': uploading }"
      @click="openPicker"
      @drop.prevent="onDrop"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#a0a5b1"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        style="margin-bottom: 4px"
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      <div class="dropzone-text" v-html="hint" />
    </div>
  </div>
</template>
