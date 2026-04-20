<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export interface HistoryColumn {
  key: string
  i18nKey: string
  label: string
  width?: string
  style?: string
}

export interface HistoryCell {
  content: string
  style?: string
  html?: boolean
}

export interface HistoryRow {
  cells: HistoryCell[]
}

defineProps<{
  columns: HistoryColumn[]
  rows?: HistoryRow[]
}>()
</script>

<template>
  <div class="table-responsive">
    <table class="history-table">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? `width: ${col.width}` : col.style"
          >
            {{ t(col.i18nKey, col.label) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-if="rows && rows.length">
          <tr v-for="(row, ri) in rows" :key="ri">
            <td v-for="(cell, ci) in row.cells" :key="ci" :style="cell.style">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span v-if="cell.html" v-html="cell.content" />
              <span v-else>{{ cell.content }}</span>
            </td>
          </tr>
        </template>
        <template v-else>
          <slot />
        </template>
      </tbody>
    </table>
  </div>
</template>
