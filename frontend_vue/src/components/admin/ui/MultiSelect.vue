<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import SvgIcon from '@/components/admin/SvgIcon.vue'

import '@styles/admin/components/_multiselect.css'

export interface MultiSelectOption {
  value: string
  label?: string
  group?: string
}

const props = defineProps<{
  modelValue: string[]
  options: MultiSelectOption[]
  placeholder?: string
  maxWidth?: string
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)
const tagsContainerRef = ref<HTMLElement | null>(null)
const popoverVisible = ref(false)

// --- Overflow detection ---
// All tags are always rendered in the DOM (no v-show/v-if on individual tags).
// Overflow is determined by measuring actual tag positions in the flex container.
// Hidden tags get display:none applied via inline style after measurement.

/** How many tags are hidden (overflowing). 0 = all visible. */
const overflowCount = ref(0)

let resizeObserver: ResizeObserver | null = null

const selectedLabels = computed(() =>
  props.modelValue.map((v) => {
    const opt = props.options.find((o) => o.value === v)
    return opt?.label ?? opt?.value ?? v
  }),
)

// Preserve first-seen group order; ungrouped options go under an empty-string key rendered without header.
const groupedOptions = computed(() => {
  const groups: { group: string; items: MultiSelectOption[] }[] = []
  const byKey = new Map<string, MultiSelectOption[]>()
  for (const opt of props.options) {
    const key = opt.group ?? ''
    if (!byKey.has(key)) {
      const arr: MultiSelectOption[] = []
      byKey.set(key, arr)
      groups.push({ group: key, items: arr })
    }
    byKey.get(key)!.push(opt)
  }
  return groups
})

/**
 * Measures the tags container and determines how many tags actually overflow.
 * All tags are visible during measurement (no v-show interference).
 * After measurement, hidden tags get display:none applied via inline style.
 *
 * Safety guarantees:
 *  - At least 1 tag is always visible when tags exist (never hide all).
 *  - If measurement yields visibleCount=0, it defaults to 1.
 */
function measureOverflow() {
  const container = tagsContainerRef.value
  if (!container) return

  // Get all tag elements (excluding the "+N more" button)
  const tags = container.querySelectorAll<HTMLElement>('.tag:not(.tag-more)')
  if (tags.length === 0) {
    overflowCount.value = 0
    return
  }

  // Make sure ALL tags are visible for measurement
  for (const tag of tags) {
    tag.style.display = ''
  }
  // Hide the "+N more" button during measurement (it's not a real tag)
  const moreBtn = container.querySelector<HTMLElement>('.tag-more')
  if (moreBtn) moreBtn.style.display = 'none'

  // Force reflow
  void container.offsetHeight

  const containerWidth = container.clientWidth

  // Measure each tag's position to find which ones overflow
  // A tag overflows if its offsetLeft + offsetWidth > containerWidth
  // OR if it wraps to a new line (offsetTop > first tag's offsetTop)
  const firstTag = tags[0]
  if (!firstTag) {
    overflowCount.value = 0
    return
  }
  const firstTop = firstTag.offsetTop
  let visibleCount = 0

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    if (!tag) break
    const wraps = tag.offsetTop > firstTop || (tag.offsetLeft + tag.offsetWidth > containerWidth)

    if (wraps) {
      break
    }
    visibleCount++
  }

  // Safety: at least 1 tag must always be visible when tags exist
  if (visibleCount === 0 && tags.length > 0) {
    visibleCount = 1
  }

  // Now hide the overflowing tags via inline style
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    if (!tag) continue
    if (i >= visibleCount) {
      tag.style.display = 'none'
    } else {
      tag.style.display = ''
    }
  }

  // Restore the "+N more" button
  if (moreBtn) moreBtn.style.display = ''

  overflowCount.value = tags.length - visibleCount
}

function getLabel(value: string): string {
  const option = props.options.find((o) => o.value === value)
  return option ? (option.label ?? option.value) : value
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    popoverVisible.value = false
  }
}

function isSelected(value: string) {
  return props.modelValue.includes(value)
}

function toggleOption(value: string) {
  const next = isSelected(value)
    ? props.modelValue.filter((v) => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

function removeTag(value: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((v) => v !== value),
  )
}

function togglePopover() {
  popoverVisible.value = !popoverVisible.value
}

function onClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    open.value = false
    popoverVisible.value = false
  }
}

// Re-measure whenever the selected values change (tags added/removed)
watch(
  () => props.modelValue,
  () => {
    nextTick(() => {
      measureOverflow()
      // Close popover if no more hidden items remain
      if (overflowCount.value === 0) {
        popoverVisible.value = false
      }
    })
  },
)

onMounted(() => {
  document.addEventListener('click', onClickOutside)

  nextTick(() => {
    const container = tagsContainerRef.value
    if (container) {
      // Measure initial overflow
      measureOverflow()

      // Observe size changes — re-measure on resize
      resizeObserver = new ResizeObserver(() => {
        measureOverflow()
      })
      resizeObserver.observe(container)
    }
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<template>
  <div ref="wrapRef" class="multi-select-wrap custom-select-wrap" :style="{ maxWidth }">
    <div class="glass-input custom-select-trigger" @click="toggle">
      <div ref="tagsContainerRef" class="multi-select-tags">
        <span v-if="selectedLabels.length === 0" class="multi-select-placeholder">
          {{ placeholder }}
        </span>
        <span
          v-for="value in modelValue"
          :key="value"
          class="tag"
        >
          <span class="tag-label">{{ getLabel(value) }}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="tag-remove"
            @click.stop="removeTag(value)"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
        <button
          v-if="overflowCount > 0"
          class="tag tag-more"
          @click.stop="togglePopover"
        >
          +{{ overflowCount }} {{ t('multi_select.more') }}
        </button>
      </div>
      <SvgIcon name="chevron-down" width="12" height="12" class="select-arrow" />
    </div>
    <div
      v-if="popoverVisible"
      class="multi-select-popover"
      @click.stop
    >
      <div class="multi-select-popover-header">{{ t('multi_select.selected_items') }}</div>
      <ul class="multi-select-popover-list">
        <li v-for="val in modelValue.slice(modelValue.length - overflowCount)" :key="val" class="multi-select-popover-item">
          <span>{{ getLabel(val) }}</span>
          <button
            class="multi-select-popover-item-remove"
            title="Remove"
            @click.stop="removeTag(val)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </li>
      </ul>
    </div>
    <div class="custom-select-list multi-select-list" :class="{ open }">
      <template v-for="group in groupedOptions" :key="group.group">
        <div v-if="group.group" class="multi-select-group-header">{{ group.group }}</div>
        <label v-for="opt in group.items" :key="opt.value" class="multi-select-option" @click.stop>
          <input
            type="checkbox"
            :checked="isSelected(opt.value)"
            @change="toggleOption(opt.value)"
          />
          <span>{{ opt.label ?? opt.value }}</span>
        </label>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tag {
  max-width: 100%;
  overflow: hidden;
}

.tag-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.multi-select-group-header {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
  user-select: none;
}
.multi-select-group-header:not(:first-child) {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 4px;
}

.multi-select-tags {
  overflow: hidden;
  max-width: 100%;
}

.tag-more {
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-weight: 600;
  flex-shrink: 0;
}

.tag-more:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

.multi-select-popover {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1100;
  min-width: 200px;
  max-width: 320px;
  max-height: 250px;
  overflow-y: auto;
  overflow-x: hidden;
  background: rgba(30, 30, 45, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 8px 0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.multi-select-popover-header {
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.multi-select-popover-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}

.multi-select-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  cursor: default;
  transition: background 0.15s;
  min-width: 0;
  overflow: hidden;
}

.multi-select-popover-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.multi-select-popover-item span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.multi-select-popover-item-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 77, 77, 0.15);
  color: rgba(255, 77, 77, 0.7);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
  padding: 0;
}

.multi-select-popover-item-remove:hover {
  background: rgba(255, 77, 77, 0.35);
  color: #ff4d4d;
  transform: scale(1.15);
}
</style>
