<script setup lang="ts">
export interface AlertRow {
  type: string
  description: string
  status: string
  pill: 'danger' | 'warning' | 'success' | 'info' | 'mint'
}

defineProps<{
  headers: { type: string; desc: string; status: string }
  rows: AlertRow[]
}>()
</script>

<template>
  <table class="alerts-table">
    <thead>
      <tr>
        <th>{{ headers.type }}</th>
        <th>{{ headers.desc }}</th>
        <th>{{ headers.status }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in rows" :key="i">
        <td>{{ row.type }}</td>
        <td>{{ row.description }}</td>
        <td>
          <span class="status-pill" :class="`pill-${row.pill}`">{{ row.status }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
