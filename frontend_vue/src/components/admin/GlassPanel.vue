<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  title?: string
  badge?: string
  loading?: boolean
  skeletonRows?: number
}>()

/**
 * Скелет — признак ПЕРВОЙ загрузки, а не каждого перезапроса.
 *
 * `.glass-panel.loading .panel-body { display: none }` прячет тело целиком. Пока
 * тело пустое, это ровно то, что нужно. Но страницы перезапрашивают список на
 * каждую нажатую клавишу в поиске — и тогда правило прячет вместе с содержимым
 * само поле ввода, а браузер снимает фокус с исчезнувшего элемента. Печатать
 * слово целиком становится невозможно: после каждой буквы приходится возвращать
 * курсор мышью.
 *
 * Обходили это по одному на страницу — флагом `initialized` в композабле
 * (питфолл #20) или условием вида `:loading="loading && items.length === 0"` в
 * шаблоне. То есть правило «скелет только в первый раз» было записано в каждом
 * вызывающем заново, а кто его не записал — получал баг. Теперь оно здесь, один
 * раз, и страницам помнить о нём не нужно.
 *
 * Защёлка ловит именно ЗАВЕРШЁННУЮ загрузку — переход `true → false`. Проверять
 * «сейчас не грузится» с `immediate` нельзя: у большинства страниц `loading`
 * стартует как `false` и становится `true` уже в `onMounted`, то есть после
 * монтирования дочерней панели. Такая защёлка сработала бы до первой загрузки и
 * отменила бы скелет вовсе.
 */
const settled = ref(false)
watch(
  () => props.loading,
  (now, before) => {
    if (before && !now) settled.value = true
  },
)

const showSkeleton = computed(() => Boolean(props.loading) && !settled.value)
</script>

<template>
  <div class="glass-panel" :class="{ loading: showSkeleton }">
    <div v-if="title || badge || $slots.header" class="panel-header">
      <span v-if="title" class="panel-title">{{ title }}</span>
      <slot name="header" />
      <span v-if="badge" class="panel-badge"
        ><span>{{ badge }}</span></span
      >
    </div>
    <div v-if="showSkeleton" class="panel-skeleton">
      <div class="skeleton" style="width: 60%" />
      <div
        v-for="i in skeletonRows ?? 2"
        :key="i"
        class="skeleton"
        :style="{ height: '40px', marginTop: '10px' }"
      />
    </div>
    <div class="panel-body">
      <slot />
    </div>
  </div>
</template>
