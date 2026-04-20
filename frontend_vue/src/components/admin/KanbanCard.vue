<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import RatingStars from '@/components/admin/ui/RatingStars.vue'

const { t } = useI18n()

defineProps<{
  id: string
  companyName: string
  hasDeficit?: boolean
  rating: number
  categories: string[]
  leadTime: string | number
}>()
</script>

<template>
  <div class="kanban-card" :data-id="id" draggable="true">
    <div class="kanban-card-header">
      <router-link
        :to="{ name: 'admin-supplier-card', params: { id } }"
        class="kanban-card-title"
        draggable="false"
      >
        {{ companyName }}
      </router-link>
      <span
        v-if="hasDeficit"
        v-tooltip="t('tooltip.deficit_indicator')"
        class="deficit-indicator"
      />
    </div>
    <div class="kanban-card-body">
      <div class="kanban-card-rating">
        <RatingStars :model-value="rating" :readonly="true" />
      </div>
      <div class="kanban-card-tags">
        <span v-for="cat in categories" :key="cat" class="tag">{{ cat }}</span>
      </div>
      <div class="kanban-card-meta">
        <span class="lead-time"
          >{{ leadTime }} <span>{{ t('suppliers.days') }}</span></span
        >
      </div>
    </div>
    <div class="kanban-card-footer">
      <router-link
        :to="{ name: 'admin-bcc-request', query: { supplier: id } }"
        class="kanban-card-action"
        draggable="false"
      >
        <SvgIcon name="email" width="14" height="14" />
      </router-link>
    </div>
  </div>
</template>
