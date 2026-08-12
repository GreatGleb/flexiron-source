<script setup lang="ts">
/**
 * The pagination bar under a table. It was written by hand twenty-two times,
 * in seventeen files, with three sizes of page button between them.
 *
 * It owns no state: the page window comes in as an array (from
 * `usePagination().pageNumbers()`), the page and the page size come in as
 * models. Which page exists and what "page size" means stay with the caller,
 * because for half these tables the server decides and for the other half the
 * browser does.
 */
import { computed } from 'vue'

import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

import '@styles/admin/components/_pagination.css'

const props = defineProps<{
  totalPages: number
  /** The window of numbers to draw, `'...'` where it skips. */
  pages: (number | '...')[]
  pageSizeOptions?: SelectOption[]
  /** Label in front of the page-size select — already translated. */
  sizeLabel?: string
  /** "1-25 of 300" — drawn only when `total` is given. */
  showingFrom?: number
  showingTo?: number
  total?: number
  ofLabel?: string
  /** 26px buttons, for a bar inside a modal. */
  compact?: boolean
  testId?: string
  sizeTestId?: string
  prevTestId?: string
  nextTestId?: string
  /** Stamped on each page button as `${prefix}${number}`. */
  pageTestPrefix?: string
}>()

/** The page size travels as the string `CustomSelect` speaks, so the caller
 * keeps its own setter — the one that also sends the reader back to page one. */
const size = defineModel<string>('size')
const page = defineModel<number>('page', { required: true })

/**
 * One page means nowhere to go, so the arrows leave rather than sit there
 * greyed out — pitfall #28 asks for exactly this, and half the pages did it.
 */
const navStyle = computed(() => ({ display: props.totalPages <= 1 ? 'none' : 'flex' }))
</script>

<template>
  <div class="pagination-bar" :class="{ 'pagination-compact': compact }" :data-test="testId">
    <div v-if="pageSizeOptions" class="page-size" :data-test="sizeTestId">
      <span>{{ sizeLabel }}</span>
      <CustomSelect
        v-model="size as string"
        :options="pageSizeOptions"
        :open-up="true"
        class="custom-select-sm"
      />
    </div>
    <div class="pagination-nav">
      <button
        class="btn btn-icon btn-sm"
        :disabled="page <= 1"
        :style="navStyle"
        :data-test="prevTestId"
        @click="page = page - 1"
      >
        <SvgIcon name="chevron-right" :width="14" :height="14" class="icon-flip-x" />
      </button>
      <div class="pagination-pages">
        <template v-for="(p, i) in pages" :key="i">
          <span v-if="p === '...'" class="pagination-ellipsis">...</span>
          <button
            v-else
            class="page-btn"
            :class="{ active: p === page }"
            :data-test="pageTestPrefix ? `${pageTestPrefix}${p}` : undefined"
            @click="page = p as number"
          >
            {{ p }}
          </button>
        </template>
      </div>
      <button
        class="btn btn-icon btn-sm"
        :disabled="page >= totalPages"
        :style="navStyle"
        :data-test="nextTestId"
        @click="page = page + 1"
      >
        <SvgIcon name="chevron-right" :width="14" :height="14" />
      </button>
    </div>
    <div v-if="total !== undefined" class="pagination-info">
      <span>{{ showingFrom }}-{{ showingTo }}</span>
      <span>&nbsp;{{ ofLabel }}&nbsp;</span>
      <span>{{ total }}</span>
    </div>
  </div>
</template>
