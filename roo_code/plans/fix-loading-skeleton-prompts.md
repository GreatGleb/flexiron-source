# Промпты для исправления загрузки на страницах аналитики

Для каждой страницы нужно заменить `<div v-if="loading" class="loading-state">{{ t('common.loading') }}</div>` на skeleton-разметку, которая повторяет структуру страницы, используя класс `.skeleton` (уже есть в `main.css`) и компонент `GlassPanel` (уже импортирован в проекте).

## 7. DeficitPage.vue

**Файл:** `frontend_vue/src/views/admin/analytics/DeficitPage.vue`

**Что сделать:**
1. В `<script setup>` добавить импорт: `import GlassPanel from '@/components/admin/GlassPanel.vue'`
2. Заменить строку:
```html
  <div v-if="loading" class="loading-state">{{ t('common.loading') }}</div>
```
на:
```html
  <!-- Loading skeleton -->
  <template v-if="loading">
    <div class="kpi-row">
      <div v-for="i in 4" :key="i" class="kpi-card">
        <div class="kpi-icon"><div class="skeleton" style="width:24px;height:24px;border-radius:50%;margin:0" /></div>
        <div class="kpi-label"><div class="skeleton" style="width:70%;height:14px" /></div>
        <div class="kpi-value"><div class="skeleton" style="width:60%;height:22px" /></div>
        <div class="kpi-delta"><div class="skeleton" style="width:40%;height:12px" /></div>
      </div>
    </div>
    <div class="charts-row">
      <GlassPanel :loading="true" :skeleton-rows="5" />
      <GlassPanel :loading="true" :skeleton-rows="5" />
    </div>
  </template>
```
