<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useWarehouseMap } from '@/composables/useWarehouseMap'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import DropZone from '@/components/admin/ui/DropZone.vue'
import type { UploadedFile } from '@/services/uploadsService'
import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/warehouse_map.css'

const { t, locale } = useI18n()

// Геттером, а не computed: useHead вызывает title() и ref сюда передавать нельзя.
useHead({
  title: () => `Flexiron — ${t('warehouse.map_title')}`,
  description: () => t('warehouse.map_subtitle'),
})

const { map, loading, saving, error, load, replaceWith, remove } = useWarehouseMap()

const showReplaceConfirm = ref(false)
const showDeleteConfirm = ref(false)
/** Файл уже на сервере (uploads), но текущей картой станет только после подтверждения. */
const pendingUpload = ref<UploadedFile | null>(null)

/**
 * Загрузка идёт сразу при выборе файла — так устроен DropZone и весь остальной
 * проект. Подтверждение спрашивается за то, что нельзя откатить: за ЗАМЕНУ прежней
 * карты. Если карты не было, заменять нечего — файл становится картой сразу.
 */
async function onUploaded(files: UploadedFile[]) {
  const file = files[0]
  if (!file) return
  if (map.value) {
    pendingUpload.value = file
    showReplaceConfirm.value = true
    return
  }
  await replaceWith(file)
}

async function onReplaceConfirm() {
  const file = pendingUpload.value
  if (!file) return
  const ok = await replaceWith(file)
  if (ok) {
    showReplaceConfirm.value = false
    pendingUpload.value = null
  }
}

function onReplaceCancel() {
  showReplaceConfirm.value = false
  pendingUpload.value = null
}

async function onDeleteConfirm() {
  const ok = await remove()
  if (ok) showDeleteConfirm.value = false
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale.value)
}

onMounted(load)
</script>

<template>
  <div class="page-warehouse-map" data-test="page-warehouse-map">
    <div class="warehouse-map-header" data-test="warehouse-map-header">
      <div>
        <h1 class="page-title">{{ t('warehouse.map_header_title') }}</h1>
        <p class="warehouse-map-subtitle">{{ t('warehouse.map_subtitle') }}</p>
      </div>
      <div class="entity-action-bar no-margin pos-static">
        <router-link
          :to="{ name: 'admin-warehouse' }"
          class="btn btn-secondary"
          data-test="warehouse-map-back-btn"
        >
          <SvgIcon name="corner-up-left" :width="18" :height="18" />
          <span>{{ t('warehouse.title') }}</span>
        </router-link>
      </div>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="3" data-test="warehouse-map-panel">
      <div v-if="error" class="error-state" data-test="warehouse-map-error">
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
      </div>

      <template v-else>
        <div v-if="map" class="warehouse-map-current" data-test="warehouse-map-current">
          <a
            :href="map.url"
            target="_blank"
            rel="noopener"
            class="warehouse-map-preview"
            data-test="warehouse-map-open-link"
          >
            <img :src="map.url" :alt="t('warehouse.map_preview_alt')" />
          </a>

          <div class="warehouse-map-meta">
            <span class="warehouse-map-name" data-test="warehouse-map-name">{{ map.name }}</span>
            <span class="warehouse-map-facts">
              {{ t('warehouse.map_uploaded_at') }}: {{ formatDate(map.uploadedAt) }} ·
              {{ t('warehouse.map_size') }}: {{ formatSize(map.size) }}
            </span>
            <span class="warehouse-map-hint">{{ t('warehouse.map_open_hint') }}</span>

            <div class="warehouse-map-actions">
              <a
                :href="map.url"
                target="_blank"
                rel="noopener"
                class="btn btn-primary"
                data-test="warehouse-map-open-btn"
              >
                <SvgIcon name="external-link" :width="18" :height="18" />
                <span>{{ t('warehouse.map_btn_open') }}</span>
              </a>
              <button
                class="btn btn-danger"
                :disabled="saving"
                data-test="warehouse-map-delete-btn"
                @click="showDeleteConfirm = true"
              >
                <SvgIcon name="trash" :width="18" :height="18" />
                <span>{{ t('warehouse.map_btn_delete') }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state" data-test="warehouse-map-empty">
          <SvgIcon name="map" :width="48" :height="48" />
          <p>{{ t('warehouse.map_empty') }}</p>
          <span class="warehouse-map-hint">{{ t('warehouse.map_empty_hint') }}</span>
        </div>

        <div class="warehouse-map-upload" data-test="warehouse-map-upload">
          <span class="warehouse-map-upload-label">
            {{ map ? t('warehouse.map_btn_replace') : t('warehouse.map_btn_upload') }}
          </span>
          <DropZone
            accept="image/*"
            :hint="t('warehouse.map_dropzone_hint')"
            data-test="warehouse-map-dropzone"
            @uploaded="onUploaded"
          />
        </div>
      </template>
    </GlassPanel>

    <AppModal
      v-model="showReplaceConfirm"
      :title="t('warehouse.map_confirm_replace_title')"
      size="small"
      data-test="warehouse-map-replace-modal"
    >
      <p>{{ t('warehouse.map_confirm_replace') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="warehouse-map-replace-cancel"
          @click="onReplaceCancel"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="saving"
          data-test="warehouse-map-replace-confirm"
          @click="onReplaceConfirm"
        >
          {{ t('warehouse.map_btn_replace') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteConfirm"
      :title="t('warehouse.map_confirm_delete_title')"
      size="small"
      data-test="warehouse-map-delete-modal"
    >
      <p>{{ t('warehouse.map_confirm_delete') }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="saving"
          data-test="warehouse-map-delete-cancel"
          @click="showDeleteConfirm = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          :disabled="saving"
          data-test="warehouse-map-delete-confirm"
          @click="onDeleteConfirm"
        >
          {{ t('btn.delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
